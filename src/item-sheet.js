// "Add an item" / "Edit item" sheet inside the booth editor (desktop and phone).
// Steps: [agreement, first time only] -> photo -> cutout (+ erase/restore brush) -> details -> send.
// It talks to the Wix page only through `request(type, payload)`, which the editor provides.
import { esc } from './room-render.js';
import { CATEGORIES, CONDITIONS, ERAS, MOUNTS, MAX_PHOTOS, validateListing, formFromItem, needsReview } from './logic/listing.js';
import { brushLine, opaqueShare } from './logic/mask.js';
import { loadBitmap, workingPixels, photoJpeg, encodeCutout } from './imageio.js';
import { cutOut, warmUp, onModelStatus, modelReady, modelSizeMB } from './cutout.js';

const STEP_LABELS = { photo: 'Photo', cutout: 'Cutout', details: 'Details', send: 'Send' };
const UNDO_MAX = 12;

const opt = (list, cur) => list.map((o) => `<option value="${esc(o.id)}"${o.id === cur ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
const fieldErr = (errors, k) => (errors[k] ? `<span class="ferr" role="alert">${esc(errors[k])}</span>` : '');

export class ItemSheet {
  #host;
  #request;
  #toast;
  #onSaved;
  #agreementSrc;
  #step = null;
  #item = null; // existing item when editing
  #agreed = false;
  #agreement = null;
  #pix = null; // { w, h, rgba } working photo
  #alpha = null;
  #baseAlpha = null;
  #undo = [];
  #mode = 'erase';
  #brushPx = 26;
  #cutState = 'idle'; // idle | loading | running | ready | failed
  #cutMsg = '';
  #progress = null;
  #newCutout = null; // { dataUrl, w, h, aspect } waiting to upload
  #photos = []; // [{ id?, url?, dataUrl? }]
  #form = null;
  #errors = {};
  #dirty = false;
  #confirmClose = false;
  #sendLines = [];
  #unsub = null;
  #paint = null; // canvas state while brushing

  constructor({ host, request, toast, onSaved, agreementSrc = 'data/agreement.json' }) {
    this.#host = host;
    this.#request = request;
    this.#toast = toast;
    this.#onSaved = onSaved;
    this.#agreementSrc = agreementSrc;
    host.addEventListener('click', (e) => this.#onClick(e));
    host.addEventListener('change', (e) => this.#onChange(e));
    host.addEventListener('input', (e) => this.#onInput(e));
    host.addEventListener('submit', (e) => this.handleSubmit(e));
    host.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.#askClose();
    });
  }

  get isOpen() {
    return this.#step !== null;
  }

  /** Open for a new item (item = null) or to edit one. */
  open({ item = null, agreed = false } = {}) {
    this.#item = item;
    this.#agreed = agreed;
    this.#pix = null;
    this.#alpha = null;
    this.#baseAlpha = null;
    this.#undo = [];
    this.#newCutout = null;
    this.#errors = {};
    this.#dirty = false;
    this.#confirmClose = false;
    this.#cutState = 'idle';
    this.#form = item ? formFromItem(item) : formFromItem({ quantity: 1, mount: 'stand' });
    const files = item?.pendingEdit?.photoFiles ?? item?.photoFiles ?? (item?.photos ?? []).map((url) => ({ url }));
    this.#photos = item ? files.map((p) => ({ ...p })) : [];
    this.#unsub?.();
    this.#unsub = onModelStatus((s) => this.#onModelStatus(s));
    if (!agreed) this.#step = 'agree';
    else this.#step = item ? 'details' : 'photo';
    if (!item) warmUp();
    this.#render();
    this.#host.querySelector('.sheetcard')?.focus();
  }

  close() {
    this.#step = null;
    this.#unsub?.();
    this.#unsub = null;
    this.#host.innerHTML = '';
  }

  // ------------------------------------------------------------------ rendering

  #render() {
    if (!this.#step) return;
    const editing = !!this.#item;
    const title = editing ? `Edit: ${this.#item.title}` : 'Add an item';
    const steps = editing && !this.#pix ? ['details', 'send'] : ['photo', 'cutout', 'details', 'send'];
    const cur = this.#step === 'agree' ? -1 : steps.indexOf(this.#step);
    this.#host.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="sheetcard" tabindex="-1">
          <header class="sheethead">
            <h2>${esc(title)}</h2>
            ${this.#step === 'agree' ? '' : `<ol class="sheetsteps">${steps.map((s, i) => `<li class="${i === cur ? 'cur' : i < cur ? 'done' : ''}">${STEP_LABELS[s]}</li>`).join('')}</ol>`}
            <button class="sheetx" type="button" data-sheet="close" aria-label="Close">&times;</button>
          </header>
          ${this.#confirmClose ? `<div class="sheetconfirm" role="alert"><span>Discard this ${editing ? 'edit' : 'item'}?</span><button class="mini" type="button" data-sheet="discard">Discard</button><button class="mini" type="button" data-sheet="keep">Keep going</button></div>` : ''}
          <div class="sheetbody">${this.#bodyHtml()}</div>
        </div>
      </div>`;
    if (this.#step === 'cutout' && this.#cutState === 'ready') this.#mountCanvas();
  }

  #bodyHtml() {
    switch (this.#step) {
      case 'agree':
        return this.#agreeHtml();
      case 'photo':
        return this.#photoHtml();
      case 'cutout':
        return this.#cutoutHtml();
      case 'details':
        return this.#detailsHtml();
      case 'send':
        return this.#sendHtml();
      default:
        return '';
    }
  }

  #agreeHtml() {
    const a = this.#agreement;
    if (!a) {
      this.#loadAgreement();
      return '<p class="lede">Loading the seller agreement...</p>';
    }
    if (a.error) return `<p class="note">Couldn't load the seller agreement (${esc(a.error)}). Close this and try again.</p>`;
    return `
      <p class="lede">Before your first item, please read and agree to how selling at Ginger's Attic works.</p>
      <div class="agreebox" tabindex="0" aria-label="Seller agreement">
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.intro)}</p>
        ${a.sections.map((s) => `<h4>${esc(s.h)}</h4>${s.p.map((p) => `<p>${esc(p)}</p>`).join('')}`).join('')}
        <h4>Prohibited items</h4>
        <p>${esc(a.prohibitedIntro)}</p>
        <ul>${a.prohibited.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <p class="ver">Version ${esc(a.version)}</p>
      </div>
      <label class="agreecheck"><input type="checkbox" data-agree="check"> I've read the Seller Agreement and the prohibited items list, and I agree to them.</label>
      <div class="sheetbtns"><button class="primary" type="button" data-sheet="agree" disabled>Agree and continue</button></div>`;
  }

  #photoHtml() {
    return `
      <p class="lede">Photograph the item on its own. We'll cut out the background for you.</p>
      <ul class="tips">
        <li>Stand it against a plain wall or a sheet, in good daylight.</li>
        <li>Fit the whole item in the frame, straight on, the way it will sit in your booth.</li>
        <li>One item per photo. Close-ups of marks and flaws go in the extra photos later.</li>
      </ul>
      <label class="bigdrop">
        <input type="file" accept="image/*" data-file="main">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
        <span>Take or choose a photo</span>
      </label>
      ${this.#item ? '<div class="sheetbtns"><button class="wb2" type="button" data-go="details">Keep the current photo</button></div>' : ''}`;
  }

  #cutoutHtml() {
    if (this.#cutState === 'loading' || this.#cutState === 'running') {
      const p = this.#progress;
      const pct = p && p.total ? Math.round((p.loaded / p.total) * 100) : null;
      const first = this.#cutState === 'loading' && !modelReady();
      return `
        <div class="cutbusy" aria-live="polite">
          <div class="spinner" aria-hidden="true"></div>
          <p>${first ? `Getting the cutout tool ready. First time only: it's about ${modelSizeMB()} MB, so it can take a minute on a phone.` : 'Cutting out the background...'}</p>
          ${first && pct !== null ? `<div class="bar"><i style="width:${pct}%"></i></div><p class="dim">${pct}%</p>` : ''}
        </div>`;
    }
    const warn = this.#cutMsg ? `<p class="note">${esc(this.#cutMsg)}</p>` : '';
    return `
      ${warn}
      <div class="cutwrap"><canvas class="cutcanvas" aria-label="Your cutout. Paint to erase or restore."></canvas></div>
      <div class="cuttools">
        <div class="seg" role="group" aria-label="Brush">
          <button type="button" data-mode="erase" aria-pressed="${this.#mode === 'erase'}">Erase</button>
          <button type="button" data-mode="restore" aria-pressed="${this.#mode === 'restore'}">Restore</button>
        </div>
        <label class="range small">Brush<input type="range" min="6" max="90" step="2" value="${this.#brushPx}" data-brush="size" aria-label="Brush size"></label>
        <button class="tb" type="button" data-cut="undo" ${this.#undo.length ? '' : 'disabled'}>Undo</button>
        <button class="tb" type="button" data-cut="reset">Start over</button>
        <button class="tb" type="button" data-cut="whole">Keep whole photo</button>
      </div>
      <p class="hint">Paint over anything that isn't part of the item with <b>Erase</b>. <b>Restore</b> brings back bits that went missing; the faint picture shows what you can restore.</p>
      <div class="sheetbtns"><button class="wb2" type="button" data-go="photo">Use a different photo</button><button class="primary" type="button" data-go="details">Looks good</button></div>`;
  }

  #detailsHtml() {
    const f = this.#form;
    const e = this.#errors;
    const it = this.#item;
    const flat = f.mount === 'flat';
    const cutSrc = this.#newCutout?.dataUrl ?? it?.pendingEdit?.image ?? it?.image ?? '';
    let banner = '';
    if (it?.status === 'rejected' && it.rejectionNote) banner = `<p class="note warn"><b>Ginger asked for changes:</b> ${esc(it.rejectionNote)}</p>`;
    else if (it?.status === 'approved') {
      banner = `<p class="note">Price and quantity changes go live straight away. Other changes go to Ginger for a quick check; your item stays up as it is meanwhile.${it.rejectionNote ? ` <br><b>Last edit not approved:</b> ${esc(it.rejectionNote)}` : ''}</p>`;
    } else if (it?.status === 'pending') banner = '<p class="note">This item is waiting for Ginger. Changes you make now are checked together.</p>';
    const photoSlots = this.#photos
      .map((p, i) => `<li><img src="${esc(p.dataUrl ?? p.url)}" alt="Extra photo ${i + 1}"><button type="button" class="ph-x" data-photo-remove="${i}" aria-label="Remove photo ${i + 1}">&times;</button></li>`)
      .join('');
    return `
      ${banner}
      <form class="itemform" novalidate>
        <div class="formcols">
          <div class="formmain">
            <label class="fld">Name<input name="title" maxlength="80" value="${esc(f.title)}" placeholder="e.g. Brass candlestick pair" autocomplete="off">${fieldErr(e, 'title')}</label>
            <label class="fld">Description<textarea name="description" rows="4" maxlength="2000" placeholder="What is it? Maker's marks, materials, any chips, cracks or repairs.">${esc(f.description)}</textarea>${fieldErr(e, 'description')}</label>
            <div class="row2">
              <label class="fld">Category<select name="category"><option value="">Choose...</option>${opt(CATEGORIES, f.category)}</select>${fieldErr(e, 'category')}</label>
              <label class="fld">Era<select name="era"><option value="">Choose...</option>${opt(ERAS, f.era)}</select>${fieldErr(e, 'era')}</label>
            </div>
            <label class="fld">Era note <small>(optional)</small><input name="eraNote" maxlength="40" value="${esc(f.eraNote)}" placeholder="e.g. c. 1955, Victorian">${fieldErr(e, 'eraNote')}</label>
            <fieldset class="fld"><legend>Condition</legend>
              ${CONDITIONS.map((c) => `<label class="radio"><input type="radio" name="condition" value="${c.id}"${f.condition === c.id ? ' checked' : ''}><span><b>${esc(c.label)}</b> <small>${esc(c.hint)}</small></span></label>`).join('')}
              ${fieldErr(e, 'condition')}
            </fieldset>
            <fieldset class="fld"><legend>In your booth it...</legend>
              ${MOUNTS.map((m) => `<label class="radio"><input type="radio" name="mount" value="${m.id}"${f.mount === m.id ? ' checked' : ''}><span>${esc(m.label)}</span></label>`).join('')}
            </fieldset>
            <fieldset class="fld"><legend>Size in inches <small>(it's shown at real size)</small></legend>
              <div class="row3">
                <label>${flat ? 'Length' : 'Height'}<input name="heightIn" inputmode="decimal" value="${esc(f.heightIn)}"></label>
                <label>Width<input name="widthIn" inputmode="decimal" value="${esc(f.widthIn)}"></label>
                <label>Depth <small>(opt.)</small><input name="depthIn" inputmode="decimal" value="${esc(f.depthIn)}"></label>
              </div>
              ${fieldErr(e, 'heightIn')}${fieldErr(e, 'widthIn')}${fieldErr(e, 'depthIn')}
            </fieldset>
            <fieldset class="fld"><legend>Weight</legend>
              <div class="row2 tight">
                <label><input name="weightLb" inputmode="numeric" value="${esc(f.weightLb)}"> lb</label>
                <label><input name="weightOz" inputmode="decimal" value="${esc(f.weightOz)}"> oz</label>
              </div>
              ${fieldErr(e, 'weight')}
            </fieldset>
            <div class="row2">
              <label class="fld">Price ($)<input name="price" inputmode="decimal" value="${esc(f.price)}">${fieldErr(e, 'price')}</label>
              <label class="fld">Quantity<input name="quantity" inputmode="numeric" value="${esc(f.quantity)}">${fieldErr(e, 'quantity')}</label>
            </div>
            <fieldset class="fld"><legend>Shipping</legend>
              <label class="fld inline">Shipping price ($)<input name="shippingPrice" inputmode="decimal" value="${esc(f.shippingPrice)}" ${f.localPickupOnly ? 'disabled' : ''}></label>
              <label class="check"><input type="checkbox" name="localPickupOnly" ${f.localPickupOnly ? 'checked' : ''}> Local pickup only (no shipping)</label>
              ${fieldErr(e, 'shippingPrice')}
              <p class="dim">You ship within 3 business days of a sale. Price it to cover postage and packing.</p>
            </fieldset>
          </div>
          <aside class="formside">
            <div class="cutprev">${cutSrc ? `<img src="${esc(cutSrc)}" alt="Your cutout">` : '<span class="dim">No cutout yet</span>'}</div>
            <button class="wb2" type="button" data-go="photo">${it ? 'Change the main photo' : 'Retake the photo'}</button>
            <h4>Extra photos <small>(up to ${MAX_PHOTOS})</small></h4>
            <p class="dim">The back, maker's marks, close-ups of any flaws. They show in the item card.</p>
            <ul class="photogrid">${photoSlots}</ul>
            ${this.#photos.length < MAX_PHOTOS ? `<label class="uploadbtn small"><input type="file" accept="image/*" multiple data-file="extra"><span>Add photos</span></label>` : ''}
          </aside>
        </div>
        <div class="sheetbtns">
          ${!it || this.#pix ? '<button class="wb2" type="button" data-go="cutout">Back to the cutout</button>' : ''}
          <button class="primary" type="submit">${this.#submitLabel()}</button>
        </div>
      </form>`;
  }

  #submitLabel() {
    const it = this.#item;
    if (!it) return 'Send to Ginger for approval';
    if (it.status !== 'approved') return 'Save and send for approval';
    const v = validateListing(this.#form);
    if (v.ok && !this.#newCutout && !this.#photosChanged() && needsReview(this.#beforeListing(), v.listing).length === 0) return 'Save price & quantity';
    return 'Save changes';
  }

  #sendHtml() {
    return `
      <div class="cutbusy" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <ul class="sendlines">${this.#sendLines.map((l) => `<li class="${l.state}">${esc(l.text)}</li>`).join('')}</ul>
      </div>`;
  }

  // ------------------------------------------------------------------ agreement

  async #loadAgreement() {
    if (this.#agreement) return;
    this.#agreement = { loading: true };
    try {
      const r = await fetch(this.#agreementSrc);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.#agreement = await r.json();
    } catch (e) {
      this.#agreement = { error: e.message };
    }
    if (this.#step === 'agree') this.#render();
  }

  async #accept() {
    const btn = this.#host.querySelector('[data-sheet="agree"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
    }
    const r = await this.#request('accept-agreement', { version: this.#agreement.version });
    if (!r.ok) {
      this.#toast(r.message || "Couldn't save your agreement. Please try again.");
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Agree and continue';
      }
      return;
    }
    this.#agreed = true;
    this.#step = this.#item ? 'details' : 'photo';
    this.#render();
  }

  // ------------------------------------------------------------------ photo + cutout

  async #takePhoto(file) {
    if (!file || !/^image\//.test(file.type)) {
      this.#toast('Please choose a photo.');
      return;
    }
    let bmp;
    try {
      bmp = await loadBitmap(file);
    } catch {
      this.#toast("Couldn't read that photo. Try another one.");
      return;
    }
    this.#pix = workingPixels(bmp);
    this.#dirty = true;
    this.#undo = [];
    this.#cutMsg = '';
    this.#step = 'cutout';
    this.#cutState = modelReady() ? 'running' : 'loading';
    this.#render();
    try {
      const alpha = await cutOut(this.#pix);
      const share = opaqueShare(alpha);
      if (share < 0.01) {
        this.#cutMsg = "We couldn't find the item, so the whole photo is kept. Erase the background by hand, or try a photo with a plainer background.";
        alpha.fill(255);
      } else if (share > 0.97) {
        this.#cutMsg = 'The whole photo was kept. If there is background left, erase it, or try a plainer background.';
      }
      this.#alpha = alpha;
    } catch (e) {
      this.#cutMsg = `The automatic cutout didn't work on this device (${e.message}). You can still erase the background by hand.`;
      this.#alpha = new Uint8ClampedArray(this.#pix.w * this.#pix.h).fill(255);
    }
    this.#baseAlpha = this.#alpha.slice();
    if (this.#step !== 'cutout') return;
    this.#cutState = 'ready';
    this.#render();
  }

  #onModelStatus(s) {
    if (s.loaded !== undefined) {
      this.#progress = s;
      if (this.#step === 'cutout' && this.#cutState === 'loading') {
        const bar = this.#host.querySelector('.bar i');
        const pct = s.total ? Math.round((s.loaded / s.total) * 100) : null;
        if (bar && pct !== null) {
          bar.style.width = `${pct}%`;
          const d = this.#host.querySelector('.cutbusy .dim');
          if (d) d.textContent = `${pct}%`;
        } else this.#render();
      }
    } else if (s.ready && this.#step === 'cutout' && this.#cutState === 'loading') {
      this.#cutState = 'running';
      this.#render();
    }
  }

  #mountCanvas() {
    const cv = this.#host.querySelector('.cutcanvas');
    if (!cv) return;
    const { w, h, rgba } = this.#pix;
    cv.width = w;
    cv.height = h;
    const orig = document.createElement('canvas');
    orig.width = w;
    orig.height = h;
    orig.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
    const cut = document.createElement('canvas');
    cut.width = w;
    cut.height = h;
    const cutCtx = cut.getContext('2d');
    const img = cutCtx.createImageData(w, h);
    img.data.set(rgba);
    for (let i = 0; i < w * h; i++) img.data[i * 4 + 3] = this.#alpha[i];
    cutCtx.putImageData(img, 0, 0);
    this.#paint = { cv, ctx: cv.getContext('2d'), orig, cut, cutCtx, img, last: null, hover: null, down: false };
    this.#draw();
    cv.addEventListener('pointerdown', (e) => this.#brushDown(e));
    cv.addEventListener('pointermove', (e) => this.#brushMove(e));
    cv.addEventListener('pointerup', (e) => this.#brushUp(e));
    cv.addEventListener('pointercancel', (e) => this.#brushUp(e));
    cv.addEventListener('pointerleave', () => {
      if (this.#paint) {
        this.#paint.hover = null;
        this.#draw();
      }
    });
  }

  #draw() {
    const p = this.#paint;
    if (!p) return;
    const { ctx, cv } = p;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (this.#mode === 'restore') {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(p.orig, 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(p.cut, 0, 0);
    if (p.hover) {
      const r = this.#brushR();
      ctx.beginPath();
      ctx.arc(p.hover.x, p.hover.y, r, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1.5, cv.width / 500);
      ctx.strokeStyle = this.#mode === 'erase' ? '#c0392b' : '#2e7d32';
      ctx.stroke();
    }
  }

  #brushR() {
    const p = this.#paint;
    const rect = p.cv.getBoundingClientRect();
    const k = rect.width ? p.cv.width / rect.width : 1;
    return (this.#brushPx / 2) * k;
  }

  #toImage(e) {
    const p = this.#paint;
    const rect = p.cv.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * p.cv.width) / rect.width, y: ((e.clientY - rect.top) * p.cv.height) / rect.height };
  }

  #brushDown(e) {
    const p = this.#paint;
    if (!p) return;
    e.preventDefault();
    p.cv.setPointerCapture?.(e.pointerId);
    this.#undo.push(this.#alpha.slice());
    if (this.#undo.length > UNDO_MAX) this.#undo.shift();
    p.down = true;
    p.last = this.#toImage(e);
    this.#stroke(p.last, p.last);
    this.#dirty = true;
  }

  #brushMove(e) {
    const p = this.#paint;
    if (!p) return;
    const pt = this.#toImage(e);
    p.hover = pt;
    if (p.down) {
      this.#stroke(p.last, pt);
      p.last = pt;
    } else this.#draw();
  }

  #brushUp() {
    const p = this.#paint;
    if (!p || !p.down) return;
    p.down = false;
    p.last = null;
    const u = this.#host.querySelector('[data-cut="undo"]');
    if (u) u.disabled = !this.#undo.length;
  }

  #stroke(a, b) {
    const p = this.#paint;
    const { w, h } = this.#pix;
    const r = this.#brushR();
    const value = this.#mode === 'erase' ? 0 : 255;
    brushLine(this.#alpha, w, h, a.x, a.y, b.x, b.y, r, value);
    const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - r - 2));
    const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - r - 2));
    const x1 = Math.min(w, Math.ceil(Math.max(a.x, b.x) + r + 2));
    const y1 = Math.min(h, Math.ceil(Math.max(a.y, b.y) + r + 2));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) p.img.data[(y * w + x) * 4 + 3] = this.#alpha[y * w + x];
    p.cutCtx.putImageData(p.img, 0, 0, x0, y0, x1 - x0, y1 - y0);
    this.#draw();
  }

  #refreshCut() {
    const p = this.#paint;
    if (!p) return;
    const n = this.#pix.w * this.#pix.h;
    for (let i = 0; i < n; i++) p.img.data[i * 4 + 3] = this.#alpha[i];
    p.cutCtx.putImageData(p.img, 0, 0);
    this.#draw();
    const u = this.#host.querySelector('[data-cut="undo"]');
    if (u) u.disabled = !this.#undo.length;
  }

  #finishCutout() {
    const enc = encodeCutout(this.#pix.rgba, this.#alpha, this.#pix.w, this.#pix.h);
    if (!enc) {
      this.#toast('Nothing is left in the cutout. Use Restore to bring the item back.');
      return false;
    }
    this.#newCutout = enc;
    return true;
  }

  // ------------------------------------------------------------------ details

  #readForm() {
    const form = this.#host.querySelector('.itemform');
    if (!form) return;
    const fd = new FormData(form);
    const f = { ...this.#form };
    for (const k of ['title', 'description', 'category', 'era', 'eraNote', 'heightIn', 'widthIn', 'depthIn', 'weightLb', 'weightOz', 'price', 'quantity', 'shippingPrice']) {
      if (fd.has(k)) f[k] = String(fd.get(k));
    }
    f.condition = fd.get('condition') ?? f.condition;
    f.mount = fd.get('mount') ?? f.mount;
    f.localPickupOnly = fd.has('localPickupOnly');
    this.#form = f;
  }

  #beforeListing() {
    const v = validateListing(formFromItem({ ...this.#item, pendingEdit: null }));
    return v.ok ? v.listing : {};
  }

  #photosChanged() {
    const live = this.#item?.photoFiles ?? (this.#item?.photos ?? []).map((url) => ({ url }));
    const before = live.map((p) => p.url).join('|');
    return this.#photos.some((p) => p.dataUrl) || before !== this.#photos.map((p) => p.url).join('|');
  }

  async #addPhotos(files) {
    const room = MAX_PHOTOS - this.#photos.length;
    const list = [...files].filter((f) => /^image\//.test(f.type)).slice(0, room);
    if (!list.length) return;
    this.#readForm();
    for (const file of list) {
      try {
        const p = await photoJpeg(file);
        if (p) this.#photos.push({ dataUrl: p.dataUrl });
        else this.#toast('One photo was too large to use.');
      } catch {
        this.#toast("Couldn't read one of the photos.");
      }
    }
    this.#dirty = true;
    this.#render();
  }

  // ------------------------------------------------------------------ send

  async #submit() {
    this.#readForm();
    const v = validateListing(this.#form);
    this.#errors = v.errors;
    if (!v.ok) {
      this.#render();
      const first = this.#host.querySelector('.ferr');
      first?.closest('.fld, fieldset')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (!this.#item && !this.#newCutout) {
      this.#toast('Add a photo of the item first.');
      this.#step = 'photo';
      this.#render();
      return;
    }
    const lines = [];
    const newPhotos = this.#photos.filter((p) => p.dataUrl);
    if (this.#newCutout) lines.push({ key: 'cutout', text: 'Uploading the cutout', state: 'todo' });
    newPhotos.forEach((_, i) => lines.push({ key: `p${i}`, text: `Uploading extra photo ${i + 1} of ${newPhotos.length}`, state: 'todo' }));
    lines.push({ key: 'details', text: this.#item ? 'Saving your changes' : 'Sending it to Ginger', state: 'todo' });
    this.#sendLines = lines;
    const backTo = 'details';
    this.#step = 'send';
    this.#render();
    const mark = (key, state) => {
      const l = this.#sendLines.find((x) => x.key === key);
      if (l) l.state = state;
      if (this.#step === 'send') this.#render();
    };
    const failed = (msg) => {
      this.#toast(msg);
      this.#step = backTo;
      this.#render();
    };
    let cutout = null;
    if (this.#newCutout) {
      mark('cutout', 'doing');
      const r = await this.#request('upload-item-image', { role: 'cutout', dataUrl: this.#newCutout.dataUrl });
      if (!r.ok || !r.file) return failed(r.message || "The cutout didn't upload. Please try again.");
      cutout = { id: r.file.id, url: r.file.url, aspect: this.#newCutout.aspect, w: this.#newCutout.w, h: this.#newCutout.h };
      mark('cutout', 'done');
    }
    let k = 0;
    for (const p of this.#photos) {
      if (!p.dataUrl) continue;
      const key = `p${k++}`;
      mark(key, 'doing');
      const r = await this.#request('upload-item-image', { role: 'photo', dataUrl: p.dataUrl });
      if (!r.ok || !r.file) return failed(r.message || "A photo didn't upload. Please try again.");
      p.id = r.file.id;
      p.url = r.file.url;
      delete p.dataUrl;
      mark(key, 'done');
    }
    mark('details', 'doing');
    const listing = { ...v.listing, cutout, photos: this.#photos.map((p) => ({ id: p.id ?? null, url: p.url })) };
    const r = await this.#request('submit-item', { itemId: this.#item?.id ?? null, listing });
    if (!r.ok || !r.item) return failed(r.message || "Couldn't save the item. Please try again.");
    mark('details', 'done');
    const isNew = !this.#item;
    this.close();
    this.#onSaved(r.item, { isNew, review: r.review ?? null });
  }

  // ------------------------------------------------------------------ events

  #askClose() {
    if (this.#step === 'send') return;
    if (this.#dirty && !this.#confirmClose) {
      this.#readForm();
      this.#confirmClose = true;
      this.#render();
      return;
    }
    this.close();
  }

  #onClick(e) {
    const t = e.target;
    const sheetBtn = t.closest('[data-sheet]');
    if (sheetBtn) {
      const a = sheetBtn.dataset.sheet;
      if (a === 'close') this.#askClose();
      else if (a === 'discard') this.close();
      else if (a === 'keep') {
        this.#confirmClose = false;
        this.#render();
      } else if (a === 'agree') this.#accept();
      return;
    }
    if (t.classList?.contains('sheet')) {
      this.#askClose();
      return;
    }
    const go = t.closest('[data-go]');
    if (go) {
      const to = go.dataset.go;
      if (this.#step === 'details') this.#readForm();
      if (to === 'details' && this.#step === 'cutout' && !this.#finishCutout()) return;
      if (to === 'cutout' && !this.#pix) return;
      if (to === 'cutout') this.#cutState = 'ready';
      this.#step = to;
      this.#render();
      return;
    }
    const mode = t.closest('[data-mode]');
    if (mode && this.#step === 'cutout') {
      this.#mode = mode.dataset.mode;
      this.#host.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === this.#mode)));
      this.#draw();
      return;
    }
    const cut = t.closest('[data-cut]');
    if (cut && this.#alpha) {
      const a = cut.dataset.cut;
      if (a === 'undo' && this.#undo.length) this.#alpha = this.#undo.pop();
      else if (a === 'reset') {
        this.#undo.push(this.#alpha.slice());
        this.#alpha = this.#baseAlpha.slice();
      } else if (a === 'whole') {
        this.#undo.push(this.#alpha.slice());
        this.#alpha = new Uint8ClampedArray(this.#alpha.length).fill(255);
      }
      if (this.#undo.length > UNDO_MAX) this.#undo.shift();
      this.#refreshCut();
      return;
    }
    const rm = t.closest('[data-photo-remove]');
    if (rm) {
      this.#readForm();
      this.#photos.splice(Number(rm.dataset.photoRemove), 1);
      this.#dirty = true;
      this.#render();
    }
  }

  #onChange(e) {
    const t = e.target;
    if (t.dataset?.agree === 'check') {
      const b = this.#host.querySelector('[data-sheet="agree"]');
      if (b) b.disabled = !t.checked;
      return;
    }
    if (t.dataset?.file === 'main') {
      this.#takePhoto(t.files?.[0]);
      return;
    }
    if (t.dataset?.file === 'extra') {
      this.#addPhotos(t.files ?? []);
      return;
    }
    if (t.dataset?.brush === 'size') {
      this.#brushPx = Number(t.value) || 26;
      return;
    }
    if (t.closest?.('.itemform')) {
      this.#dirty = true;
      if (t.name === 'localPickupOnly' || t.name === 'mount') {
        this.#readForm();
        this.#render();
      } else if (this.#item?.status === 'approved') {
        this.#readForm();
        const b = this.#host.querySelector('.itemform [type="submit"]');
        if (b) b.textContent = this.#submitLabel();
      }
    }
  }

  #onInput(e) {
    if (e.target.dataset?.brush === 'size') this.#brushPx = Number(e.target.value) || 26;
    else if (e.target.closest?.('.itemform')) this.#dirty = true;
  }

  handleSubmit(e) {
    if (!e.target.closest?.('.itemform')) return false;
    e.preventDefault();
    this.#submit();
    return true;
  }
}
