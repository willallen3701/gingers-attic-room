// <attic-approvals> - GingersAttic approval queue (hidden "Approvals" page, owner only).
// Message contract: app -> page  ready{mode:'approvals'}, refresh-queue{requestId}, review{requestId, action, itemId?, boothId?, uploadId?, note?}
//                   page -> app  load-queue{queue}, queue-result{requestId, ok, queue}, review-result{requestId, ok, message}, not-admin{message}
// Standalone (no parent page) it shows a small demo queue so the layout can be checked.
import { esc, money, ensureFonts } from './room-render.js';
import { Bridge } from './bridge.js';

const MOUNT = { stand: 'Stands on a shelf/table/floor', wall: 'Hangs on the wall', flat: 'Lies flat (rug)' };
const FIELD_LABEL = {
  title: 'Name', description: 'Description', price: 'Price', quantity: 'Quantity', category: 'Category', condition: 'Condition',
  era: 'Era', eraNote: 'Era', mount: 'Display', heightIn: 'Size', widthIn: 'Size', depthIn: 'Size', weightLb: 'Weight',
  shippingPrice: 'Shipping', cutoutUrl: 'Cutout photo', photos: 'Extra photos',
};

const css = /* css */ `
:host {
  --plum: #6b3a5c; --plum-dark: #4b2741; --paper: #f3e8d0; --ink: #3a2a1e; --ink-soft: #6d5a48;
  --serif: "Playfair Display", "Iowan Old Style", Georgia, "Times New Roman", serif;
  --type: "Special Elite", "Courier Prime", "Courier New", Courier, monospace;
  display: block; font-family: var(--serif); color: var(--ink);
}
.wrap { padding: 16px; background: var(--paper); min-height: 100%; box-sizing: border-box; }
.head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.head h1 { margin: 0; flex: 1; font: 700 26px/1.2 var(--serif); color: var(--plum-dark); }
.counts { font: 13px var(--type); color: var(--ink-soft); }
.btn { padding: 8px 16px; border: 1px solid var(--plum); border-radius: 18px; background: #fffaf0; cursor: pointer; font: 13px var(--type); color: var(--plum-dark); }
.btn.go { background: #2e6b3a; border-color: #2e6b3a; color: #fff; }
.btn.no { border-color: #a3301c; color: #a3301c; }
.btn:disabled { opacity: .5; cursor: default; }
h2 { margin: 20px 0 8px; font: 700 19px var(--serif); color: var(--plum-dark); }
.empty { margin: 0; padding: 18px; border: 1px dashed #cdb88c; border-radius: 8px; font: italic 15px var(--serif); color: var(--ink-soft); text-align: center; }
.card { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 16px; margin-bottom: 14px; padding: 14px; border: 1px solid #d8c59c; border-radius: 10px; background: #fffaf0; }
.card.done { opacity: .55; }
.pic { display: grid; place-items: center; height: 240px; border-radius: 6px; background: conic-gradient(#eee 25%, #fff 0 50%, #eee 0 75%, #fff 0) 0 0 / 14px 14px; }
.pic img { max-width: 94%; max-height: 94%; object-fit: contain; }
.thumbs { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.thumbs a { display: block; width: 52px; height: 52px; border: 1px solid #d8c59c; border-radius: 4px; overflow: hidden; }
.thumbs img { width: 100%; height: 100%; object-fit: cover; }
.kind { display: inline-block; padding: 2px 8px; border-radius: 10px; font: 12px var(--type); background: #f5e6c4; color: #6b4a12; }
.kind.edit { background: #dbe8f5; color: #1f4a73; }
.booth { margin-left: 8px; font: 12.5px var(--type); color: var(--ink-soft); }
.title { margin: 6px 0 2px; font: 700 20px/1.25 var(--serif); }
.price { font: 700 17px var(--serif); color: var(--plum-dark); }
dl { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 3px 10px; margin: 10px 0; font: 14px/1.35 var(--serif); }
dt { font: 12.5px var(--type); color: var(--ink-soft); }
dd { margin: 0; }
.chg { background: #fff1b8; padding: 0 3px; border-radius: 3px; }
.was { display: block; font: 12.5px/1.3 var(--serif); color: #8a6d4a; text-decoration: line-through; }
.desc { white-space: pre-wrap; margin: 6px 0 10px; font: 14.5px/1.45 var(--serif); }
.acts { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; }
.rejectbox { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.rejectbox textarea { width: 100%; box-sizing: border-box; min-height: 64px; padding: 8px; border: 1px solid #cbb385; border-radius: 6px; font: 14px var(--serif); }
.result { font: 13px var(--type); }
.result.ok { color: #2e6b3a; }
.result.bad { color: #a3301c; }
.uploads { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.up { padding: 10px; border: 1px solid #d8c59c; border-radius: 8px; background: #fffaf0; }
.up .tex { height: 120px; border-radius: 4px; background-size: cover; background-position: center; margin-bottom: 8px; }
.msg { padding: 24px; font: 16px var(--serif); }
@media (max-width: 640px) { .card { grid-template-columns: 1fr; } .pic { height: 200px; } }
`;

const DEMO_QUEUE = {
  items: [
    {
      kind: 'new', id: 'demo-1', itemNumber: 1, booth: { number: 2, name: 'Demo Booth' }, submittedAt: new Date().toISOString(),
      proposed: { title: 'Brass Genie Oil Lamp', description: 'Solid brass, small dent on the lid.', price: 38, quantity: 1, category: 'Lighting', condition: 'Good', era: '1920s (c. 1925)', mount: 'stand', heightIn: 4.5, widthIn: 9, depthIn: 3, weightLb: 1.2, shipping: '$9.00', image: 'assets/items/it-genie-lamp.png', photos: [] },
      current: null, changed: [],
    },
    {
      kind: 'edit', id: 'demo-2', itemNumber: 4, booth: { number: 2, name: 'Demo Booth' }, submittedAt: new Date().toISOString(),
      proposed: { title: 'Cream & Gold Teacup and Saucer', description: 'Bone china with gilt rim.', price: 20, quantity: 1, category: 'Glass & Ceramics', condition: 'Very good', era: '1950s', mount: 'stand', heightIn: 3, widthIn: 5, depthIn: null, weightLb: 0.6, shipping: '$8.00', image: 'assets/items/it-teacup-gold.png', photos: [] },
      current: { title: 'Cream & Gold Teacup', description: 'Bone china with gilt rim.', price: 20, quantity: 1, category: 'Glass & Ceramics', condition: 'Very good', era: '1950s', mount: 'stand', heightIn: 3, widthIn: 5, depthIn: null, weightLb: 0.6, shipping: '$8.00', image: 'assets/items/it-teacup-gold.png', photos: [] },
      changed: ['title'],
    },
  ],
  uploads: [],
};

const size = (v) => [v.heightIn && `${v.heightIn} in ${v.mount === 'flat' ? 'L' : 'H'}`, v.widthIn && `${v.widthIn} in W`, v.depthIn && `${v.depthIn} in D`].filter(Boolean).join(' x ');

export class AtticApprovals extends HTMLElement {
  #root;
  #bridge;
  #queue = null;
  #requests = new Map();
  #done = new Map(); // key -> { ok, text }
  #rejecting = null;
  #loaded = false;
  #readyTimer = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.innerHTML = `<style>${css}</style><div class="wrap"><p class="msg">Loading the approval queue...</p></div>`;
  }

  connectedCallback() {
    ensureFonts();
    this.#bridge = new Bridge(this, { onMessage: (m) => this.#onMessage(m) });
    this.#root.addEventListener('click', (e) => this.#onClick(e));
    if (!this.#bridge.hasParent) {
      this.#queue = DEMO_QUEUE;
      this.#render();
      return;
    }
    let tries = 0;
    const tick = () => {
      if (this.#loaded) return;
      this.#bridge.emit('ready', { mode: 'approvals' });
      if (++tries < 20) this.#readyTimer = setTimeout(tick, 1500);
    };
    tick();
  }

  disconnectedCallback() {
    clearTimeout(this.#readyTimer);
    this.#bridge?.dispose();
  }

  #onMessage(m) {
    if (m.requestId && this.#requests.has(m.requestId)) {
      const fn = this.#requests.get(m.requestId);
      this.#requests.delete(m.requestId);
      fn(m);
      return;
    }
    if (m.type === 'load-queue') {
      this.#loaded = true;
      clearTimeout(this.#readyTimer);
      this.#queue = m.queue;
      this.#done.clear();
      this.#render();
    } else if (m.type === 'not-admin') {
      this.#loaded = true;
      clearTimeout(this.#readyTimer);
      this.#root.querySelector('.wrap').innerHTML = `<p class="msg">${esc(m.message || 'This page is for the site owner.')}</p>`;
    }
  }

  #request(type, payload) {
    if (!this.#bridge.hasParent) return new Promise((r) => setTimeout(() => r({ ok: true, queue: this.#queue }), 300));
    const requestId = `ap${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        this.#requests.delete(requestId);
        resolve({ ok: false, message: 'No answer from the site. Try again.' });
      }, 60000);
      this.#requests.set(requestId, (m) => {
        clearTimeout(t);
        resolve(m);
      });
      this.#bridge.emit(type, { requestId, ...payload });
    });
  }

  // ---------------------------------------------------------------- render

  #render() {
    const q = this.#queue ?? { items: [], uploads: [] };
    const open = q.items.filter((i) => !this.#done.get(`i:${i.id}`)?.ok).length;
    const openUp = q.uploads.filter((u) => !this.#done.get(`u:${u.boothId}:${u.id}`)?.ok).length;
    this.#root.querySelector('.wrap').innerHTML = `
      <div class="head">
        <h1>Approvals</h1>
        <span class="counts">${open} item${open === 1 ? '' : 's'} &middot; ${openUp} wall/floor photo${openUp === 1 ? '' : 's'} waiting</span>
        <button class="btn" type="button" data-act="refresh">Refresh</button>
      </div>
      <h2>Items</h2>
      ${q.items.length ? q.items.map((it) => this.#cardHtml(it)).join('') : '<p class="empty">Nothing waiting. New items and edits from sellers show up here.</p>'}
      <h2>Wall &amp; floor photos</h2>
      ${q.uploads.length ? `<div class="uploads">${q.uploads.map((u) => this.#uploadHtml(u)).join('')}</div>` : '<p class="empty">No wallpaper or floor photos waiting.</p>'}`;
  }

  #cardHtml(it) {
    const p = it.proposed;
    const c = it.current;
    const ch = new Set(it.changed ?? []);
    const key = `i:${it.id}`;
    const done = this.#done.get(key);
    const mark = (fields, html, was) => {
      const changed = fields.some((f) => ch.has(f));
      return changed && c ? `<span class="chg">${html}</span><span class="was">${was}</span>` : html;
    };
    const kindLabel = { new: 'New item', edit: 'Edit to a live item', resubmitted: 'Sent again' }[it.kind] ?? it.kind;
    return `
      <article class="card${done?.ok ? ' done' : ''}">
        <div>
          <div class="pic">${p.image ? `<img src="${esc(p.image)}" alt="Cutout of ${esc(p.title)}">` : ''}</div>
          ${ch.has('cutoutUrl') && c?.image ? `<p class="was">Old cutout:</p><div class="thumbs"><a href="${esc(c.image)}" target="_blank" rel="noopener"><img src="${esc(c.image)}" alt="Old cutout"></a></div>` : ''}
          ${p.photos.length ? `<div class="thumbs">${p.photos.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener" title="Open photo ${i + 1}"><img src="${esc(u)}" alt="Photo ${i + 1}"></a>`).join('')}</div>` : ''}
        </div>
        <div>
          <span class="kind${it.kind === 'edit' ? ' edit' : ''}">${kindLabel}</span><span class="booth">Booth ${esc(String(it.booth.number))} &middot; ${esc(it.booth.name)} &middot; item #${esc(String(it.itemNumber ?? '?'))}</span>
          <h3 class="title">${mark(['title'], esc(p.title), esc(c?.title ?? ''))}</h3>
          <div class="price">${mark(['price'], esc(money(p.price)), esc(c ? money(c.price) : ''))} <small>&times; ${esc(String(p.quantity))}</small></div>
          <p class="desc">${mark(['description'], esc(p.description), esc(c?.description ?? ''))}</p>
          <dl>
            <dt>Category</dt><dd>${mark(['category'], esc(p.category), esc(c?.category ?? ''))}</dd>
            <dt>Condition</dt><dd>${mark(['condition'], esc(p.condition), esc(c?.condition ?? ''))}</dd>
            <dt>Era</dt><dd>${mark(['era', 'eraNote'], esc(p.era), esc(c?.era ?? ''))}</dd>
            <dt>Size</dt><dd>${mark(['heightIn', 'widthIn', 'depthIn'], esc(size(p)), esc(c ? size(c) : ''))}</dd>
            <dt>Display</dt><dd>${mark(['mount'], esc(MOUNT[p.mount] ?? p.mount), esc(c ? MOUNT[c.mount] ?? c.mount : ''))}</dd>
            <dt>Weight</dt><dd>${mark(['weightLb'], `${esc(String(p.weightLb))} lb`, c ? `${esc(String(c.weightLb))} lb` : '')}</dd>
            <dt>Shipping</dt><dd>${mark(['shippingPrice'], esc(p.shipping), esc(c?.shipping ?? ''))}</dd>
          </dl>
          ${it.kind === 'edit' && ch.size ? `<p class="counts">Changed: ${esc([...new Set([...ch].map((k) => FIELD_LABEL[k] ?? k))].join(', '))}</p>` : ''}
          ${this.#actsHtml(key, { itemId: it.id })}
        </div>
      </article>`;
  }

  #uploadHtml(u) {
    const key = `u:${u.boothId}:${u.id}`;
    return `
      <div class="up${this.#done.get(key)?.ok ? ' done' : ''}">
        <a href="${esc(u.src)}" target="_blank" rel="noopener"><div class="tex" style="background-image:url('${esc(u.src)}')"></div></a>
        <p class="counts">${u.kind === 'floor' ? 'Floor' : 'Wallpaper'} &middot; Booth ${esc(String(u.booth.number))} &middot; ${esc(u.booth.name)}</p>
        ${this.#actsHtml(key, { boothId: u.boothId, uploadId: u.id })}
      </div>`;
  }

  #actsHtml(key, ids) {
    const done = this.#done.get(key);
    const data = Object.entries(ids).map(([k, v]) => `data-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}="${esc(v)}"`).join(' ');
    if (done?.ok) return `<p class="result ok">${esc(done.text)}</p>`;
    const rejecting = this.#rejecting === key;
    return `
      <div class="acts" data-key="${esc(key)}" ${data}>
        ${rejecting
          ? `<div class="rejectbox"><textarea maxlength="500" placeholder="Tell the seller what to change, e.g. 'Please retake the photo in daylight' or 'Add the chip on the rim to the description'."></textarea>
              <div class="acts"><button class="btn no" type="button" data-act="reject-send">Send back with this note</button><button class="btn" type="button" data-act="reject-cancel">Cancel</button></div></div>`
          : `<button class="btn go" type="button" data-act="approve">Approve</button><button class="btn no" type="button" data-act="reject">Reject&hellip;</button>`}
        ${done && !done.ok ? `<p class="result bad">${esc(done.text)}</p>` : ''}
      </div>`;
  }

  // ---------------------------------------------------------------- actions

  async #onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'refresh') {
      btn.disabled = true;
      const r = await this.#request('refresh-queue', {});
      if (r.ok && r.queue) {
        this.#queue = r.queue;
        this.#done.clear();
      }
      this.#rejecting = null;
      this.#render();
      return;
    }
    const box = btn.closest('.acts[data-key]');
    if (!box) return;
    const key = box.dataset.key;
    const { itemId, boothId, uploadId } = box.dataset;
    if (act === 'reject') {
      this.#rejecting = key;
      this.#render();
      this.#root.querySelector(`.acts[data-key="${CSS.escape(key)}"] textarea`)?.focus();
      return;
    }
    if (act === 'reject-cancel') {
      this.#rejecting = null;
      this.#render();
      return;
    }
    let payload;
    if (act === 'approve') payload = itemId ? { action: 'approve-item', itemId } : { action: 'approve-upload', boothId, uploadId };
    else if (act === 'reject-send') {
      const note = box.querySelector('textarea')?.value.trim() ?? '';
      if (note.length < 3) {
        this.#done.set(key, { ok: false, text: 'Write a short note for the seller first.' });
        this.#render();
        return;
      }
      payload = itemId ? { action: 'reject-item', itemId, note } : { action: 'reject-upload', boothId, uploadId, note };
    } else return;
    box.querySelectorAll('button').forEach((b) => (b.disabled = true));
    btn.textContent = act === 'approve' ? 'Approving...' : 'Sending...';
    const r = await this.#request('review', payload);
    this.#rejecting = null;
    this.#done.set(key, r.ok
      ? { ok: true, text: act === 'approve' ? (itemId ? 'Approved: it is now in the store and shoppers can see it.' : 'Approved.') : 'Sent back to the seller with your note.' }
      : { ok: false, text: r.message || 'That did not work. Try again.' });
    this.#render();
  }
}

if (!customElements.get('attic-approvals')) customElements.define('attic-approvals', AtticApprovals);
