// <attic-booth> - GingersAttic booth room, VIEW mode (Phase 1).
// Usage:
//   <attic-booth booth-src="data/demo-booth.json" library-src="data/library.json" demo></attic-booth>
//   or element.load(booth, library)
// Attributes: booth-src, library-src, demo (shows placeholder badge), open-item (open a card on load),
//             allowed-origins (space-separated override of the postMessage allowlist).
// Talks to the hosting Wix page ONLY through postMessage (origin-checked both ways), and also
// dispatches a composed "attic-booth:event" DOM event with the same payload.

import { css } from './styles.js';
import { buildLayout } from './logic/layout.js';
import { normalizeLibrary } from './logic/library.js';
import { isAllowedOrigin, DEFAULT_ALLOWED_ORIGINS } from './logic/origin.js';
import { esc, money, ensureFonts, roomInnerHtml, paintSurfaces } from './room-render.js';

const NARROW_PX = 600;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const MSG_SOURCE = 'attic-booth';

const ICONS = {
  cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 3h2.3l2.6 11.2A2 2 0 0 0 9.8 16H18v-2H9.8l-.4-1.7h8.9a1 1 0 0 0 1-.8L21 6H6.6L6 3.8A1 1 0 0 0 5 3H3zm6.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2 0 3.6 1.1 4.4 2.6h1.8c.8-1.5 2.4-2.6 4.4-2.6 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>',
};

/** 1 s of silence as a WAV data URI: placeholder until real ambience audio is licensed. */
function silentWav() {
  const rate = 8000;
  const n = rate;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  let bin = '';
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

export class AtticBooth extends HTMLElement {
  #root;
  #booth = null;
  #library = null;
  #layout = null;
  #zoom = 1;
  #favourites = new Set();
  #openId = null;
  #fromSearch = false;
  #audio = null;
  #soundOn = false;
  #parentOrigin = null;
  #libraryPromise = null;
  #loaded = false;
  #readyTimer = null;
  #pointers = new Map();
  #pinchStart = null;
  #ro = null;
  #onMessage = (e) => this.#handleMessage(e);

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.innerHTML = `<style>${css}</style><div class="booth" part="booth"><p class="loading">Opening the booth...</p></div>`;
  }

  get allowedOrigins() {
    const attr = this.getAttribute('allowed-origins');
    return attr ? attr.split(/\s+/).filter(Boolean) : DEFAULT_ALLOWED_ORIGINS;
  }

  connectedCallback() {
    ensureFonts();
    window.addEventListener('message', this.#onMessage);
    this.#parentOrigin = this.#detectParentOrigin();
    const boothSrc = this.getAttribute('booth-src');
    const librarySrc = this.getAttribute('library-src');
    if (boothSrc && librarySrc) {
      Promise.all([fetch(boothSrc), fetch(librarySrc)])
        .then(async ([b, l]) => {
          if (!b.ok || !l.ok) throw new Error(`HTTP ${b.status}/${l.status}`);
          this.load(await b.json(), await l.json());
        })
        .catch((err) => this.#fail(`Couldn't load the booth (${err.message}).`));
    } else if (librarySrc) {
      // Embedded in Wix: the library ships with the app; the page sends only the booth.
      this.#libraryPromise = fetch(librarySrc).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
    }
    this.#announceReady();
  }

  // Say "ready" now and keep repeating until a booth arrives: the Wix page's code can
  // register its listener after this iframe has already loaded.
  #announceReady() {
    let tries = 0;
    const tick = () => {
      if (this.#loaded) return;
      this.#emit('ready', {});
      tries += 1;
      if (this.#hasParent() && tries < 20) this.#readyTimer = setTimeout(tick, 1500);
    };
    tick();
  }

  disconnectedCallback() {
    clearTimeout(this.#readyTimer);
    window.removeEventListener('message', this.#onMessage);
    this.#ro?.disconnect();
    this.#audio?.pause();
  }

  /** Render a booth. Safe to call again (e.g. when the Wix page pushes fresh data). */
  load(booth, library) {
    this.#loaded = true;
    clearTimeout(this.#readyTimer);
    this.#booth = booth;
    this.#library = normalizeLibrary(library);
    this.#layout = buildLayout(booth, this.#library);
    if (Object.keys(this.#layout.problems).length) {
      console.warn('[attic-booth] placement problems', this.#layout.problems);
    }
    this.#render();
    const open = this.getAttribute('open-item');
    if (open) requestAnimationFrame(() => requestAnimationFrame(() => this.openItem(open)));
  }

  /** Open an item's card, e.g. when arriving from search (fromSearch shows "Visit booth"). */
  openItem(itemId, { fromSearch = false } = {}) {
    const el = this.#root.querySelector(`.item[data-id="${CSS.escape(itemId)}"]`);
    if (!el) return;
    this.#fromSearch = fromSearch;
    this.#openCard(itemId, el);
  }

  // ---------------------------------------------------------------- rendering
  #render() {
    const b = this.#booth;
    const lib = this.#library;
    const L = this.#layout;
    const shell = this.#root.querySelector('.booth');
    const initial = esc((b.seller?.displayName ?? b.name ?? '?').trim().charAt(0).toUpperCase());
    const avatar = b.seller?.avatarSrc ? `<img src="${esc(b.seller.avatarSrc)}" alt="">` : initial;
    const forSale = L.items.filter((e) => e.item.status !== 'sold').length;
    shell.innerHTML = `
      <header class="namebar">
        <div class="avatar" aria-hidden="true">${avatar}</div>
        <div class="who">
          <h2>${esc(b.name)}</h2>
          <p class="meta"><span class="chip">Booth ${esc(b.boothNumber)}</span>${esc(b.seller?.displayName ?? '')} &middot; ${forSale} item${forSale === 1 ? '' : 's'} for sale</p>
          ${b.about ? `<p class="about">${esc(b.about)}</p>` : ''}
        </div>
        <div class="controls">
          ${b.room?.light?.presetId ? '<button class="ctl lights" type="button" aria-pressed="true" title="Turn the booth lighting on or off">&#128161; Lights on</button>' : ''}
          <button class="ctl sound" type="button" aria-pressed="false" title="Ambient sound">&#9835; Sound off</button>
          <button class="ctl zoom-out" type="button" aria-label="Zoom out">&minus;</button>
          <button class="ctl zoom-in" type="button" aria-label="Zoom in">+</button>
        </div>
      </header>
      <div class="viewport">
        <div class="room" role="group" aria-label="${esc(b.name)} - booth ${esc(b.boothNumber)}">
          ${roomInnerHtml(b, lib, L)}
          ${this.hasAttribute('demo') ? '<div class="badge">Demo items &middot; not for sale</div>' : ''}
        </div>
      </div>
      <div class="card" role="dialog" aria-modal="false" aria-labelledby="card-title" hidden></div>
      <div class="toast" role="status" aria-live="polite"></div>`;

    paintSurfaces(this.#root, this.#booth, lib);
    this.#wire(shell);
    this.#applyZoom(this.#zoom);
    this.#ro?.disconnect();
    this.#ro = new ResizeObserver(() => {
      shell.classList.toggle('narrow', shell.clientWidth < NARROW_PX);
      paintSurfaces(this.#root, this.#booth, lib);
      if (this.#openId) this.#positionCard();
    });
    this.#ro.observe(shell);
    shell.classList.toggle('narrow', shell.clientWidth < NARROW_PX);
  }

  // ---------------------------------------------------------------- interaction
  #wire(shell) {
    shell.querySelectorAll('.item:not(.decor)').forEach((el) => {
      el.addEventListener('click', () => {
        this.#fromSearch = false;
        this.#openCard(el.dataset.id, el);
      });
      el.addEventListener('pointerenter', () => this.#swing(el.dataset.id));
      el.addEventListener('focus', () => this.#swing(el.dataset.id));
    });
    shell.querySelectorAll('.tag').forEach((t) =>
      t.addEventListener('click', () => {
        const el = shell.querySelector(`.item[data-id="${CSS.escape(t.dataset.id)}"]`);
        if (el) this.#openCard(t.dataset.id, el);
      }),
    );
    shell.querySelector('.sound').addEventListener('click', () => this.#toggleSound());
    shell.querySelector('.lights')?.addEventListener('click', (e) => {
      // The light switch: the seller's chosen lighting fades on and off.
      const btn = e.currentTarget;
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      btn.innerHTML = `&#128161; Lights ${on ? 'on' : 'off'}`;
      shell.querySelector('.room')?.classList.toggle('lights-off', !on);
    });
    shell.querySelector('.zoom-in').addEventListener('click', () => this.#applyZoom(this.#zoom + 0.5));
    shell.querySelector('.zoom-out').addEventListener('click', () => this.#applyZoom(this.#zoom - 0.5));
    const vp = shell.querySelector('.viewport');
    vp.addEventListener('scroll', () => this.#openId && this.#positionCard(), { passive: true });
    vp.addEventListener('pointerdown', (e) => this.#pinch(e, 'down'));
    vp.addEventListener('pointermove', (e) => this.#pinch(e, 'move'));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => vp.addEventListener(t, (e) => this.#pinch(e, 'up')));
    shell.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.#openId) this.#closeCard(true);
    });
    shell.querySelector('.room').addEventListener('click', (e) => {
      if (!e.target.closest('.item, .tag')) this.#closeCard(false);
    });
  }

  #swing(id) {
    const tag = this.#root.querySelector(`.tag[data-id="${CSS.escape(id)}"]`);
    if (!tag) return;
    tag.classList.remove('swing');
    void tag.offsetWidth; // restart the animation
    tag.classList.add('swing');
  }

  #applyZoom(z) {
    const vp = this.#root.querySelector('.viewport');
    const room = this.#root.querySelector('.room');
    if (!vp || !room) return;
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    const cx = (vp.scrollLeft + vp.clientWidth / 2) / (room.clientWidth || 1);
    const cy = (vp.scrollTop + vp.clientHeight / 2) / (room.clientHeight || 1);
    this.#zoom = next;
    room.style.width = `${next * 100}%`;
    vp.style.touchAction = next > 1 ? 'pan-x pan-y' : 'pan-y';
    vp.scrollLeft = cx * room.clientWidth - vp.clientWidth / 2;
    vp.scrollTop = cy * room.clientHeight - vp.clientHeight / 2;
    paintSurfaces(this.#root, this.#booth, this.#library);
    const zi = this.#root.querySelector('.zoom-in');
    const zo = this.#root.querySelector('.zoom-out');
    if (zi) zi.disabled = next >= ZOOM_MAX;
    if (zo) zo.disabled = next <= ZOOM_MIN;
    if (this.#openId) this.#positionCard();
  }

  /** Two-finger pinch zoom on touch screens. */
  #pinch(e, phase) {
    if (e.pointerType !== 'touch') return;
    if (phase === 'down') this.#pointers.set(e.pointerId, e);
    else if (phase === 'move' && this.#pointers.has(e.pointerId)) this.#pointers.set(e.pointerId, e);
    else if (phase === 'up') this.#pointers.delete(e.pointerId);
    const pts = [...this.#pointers.values()];
    if (pts.length !== 2) {
      this.#pinchStart = null;
      return;
    }
    const d = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
    if (!this.#pinchStart) this.#pinchStart = { d, zoom: this.#zoom };
    else this.#applyZoom(this.#pinchStart.zoom * (d / this.#pinchStart.d));
  }

  #toggleSound() {
    this.#soundOn = !this.#soundOn;
    if (!this.#audio) {
      this.#audio = new Audio(silentWav()); // placeholder ambience
      this.#audio.loop = true;
    }
    if (this.#soundOn) this.#audio.play().catch(() => {});
    else this.#audio.pause();
    const btn = this.#root.querySelector('.sound');
    btn.setAttribute('aria-pressed', String(this.#soundOn));
    btn.innerHTML = `&#9835; Sound ${this.#soundOn ? 'on' : 'off'}`;
    this.#emit('sound-toggle', { on: this.#soundOn });
  }

  // ---------------------------------------------------------------- card
  #item(id) {
    return this.#layout.items.find((e) => e.item.id === id)?.item;
  }

  #openCard(id, el) {
    const item = this.#item(id);
    if (!item) return;
    this.#root.querySelectorAll('.item.active').forEach((n) => n.classList.remove('active'));
    el.classList.add('active');
    this.#openId = id;
    const card = this.#root.querySelector('.card');
    const sold = item.status === 'sold';
    const fav = this.#favourites.has(id);
    const size = item.dims ? `${item.dims.h} &times; ${item.dims.w} &times; ${item.dims.d} in (H &times; W &times; D)` : '';
    const ship = item.localPickupOnly ? 'Local pickup only (arranged with the seller after purchase)' : 'Ships by USPS, calculated at checkout';
    card.innerHTML = `
      <div class="grab" aria-hidden="true"></div>
      <button class="close" type="button" aria-label="Close">&times;</button>
      <div class="top">
        <div class="photo"><img src="${esc(item.image)}" alt="${esc(item.title)}"></div>
        <div><h3 id="card-title" tabindex="-1">${esc(item.title)}</h3><p class="desc">${esc(item.description)}</p></div>
      </div>
      <details class="more"><summary>More details</summary><dl>
        ${item.condition ? `<dt>Condition</dt><dd>${esc(item.condition)}</dd>` : ''}
        ${item.era ? `<dt>Era</dt><dd>${esc(item.era)}</dd>` : ''}
        ${size ? `<dt>Size</dt><dd>${size}</dd>` : ''}
        ${ship ? `<dt>Shipping</dt><dd>${esc(ship)}</dd>` : ''}
        ${item.category ? `<dt>Category</dt><dd>${esc(item.category)}</dd>` : ''}
      </dl></details>
      <div class="buy">
        <span class="price">${sold ? 'Sold' : esc(money(item.price))}</span>
        <button class="fav" type="button" aria-pressed="${fav}" aria-label="${fav ? 'Remove from favourites' : 'Save to favourites'}">${ICONS.heart}</button>
        <button class="cart" type="button" ${sold ? 'disabled' : ''}>${ICONS.cart}<span>${sold ? 'Sold' : 'Add to cart'}</span></button>
      </div>
      <div class="links">
        <button class="ask" type="button">Ask the seller</button>
        <button class="visit" type="button" ${this.#fromSearch ? '' : 'hidden'}>Visit booth</button>
      </div>`;
    card.hidden = false;
    card.querySelector('.close').addEventListener('click', () => this.#closeCard(true));
    card.querySelector('.fav').addEventListener('click', (e) => this.#toggleFav(id, e.currentTarget));
    card.querySelector('.cart').addEventListener('click', (e) => this.#addToCart(id, e.currentTarget));
    card.querySelector('.ask').addEventListener('click', () => this.#openAskForm(id));
    card.querySelector('.visit').addEventListener('click', () => this.#emit('visit-booth', { itemId: id }));
    this.#positionCard();
    card.querySelector('#card-title').focus({ preventScroll: true });
    this.#emit('item-open', { itemId: id });
  }

  #positionCard() {
    const card = this.#root.querySelector('.card');
    const shell = this.#root.querySelector('.booth');
    const el = this.#root.querySelector(`.item[data-id="${CSS.escape(this.#openId ?? '')}"]`);
    if (!card || !el || card.hidden) return;
    if (shell.classList.contains('narrow')) {
      card.style.left = card.style.top = '';
      card.classList.remove('left', 'right');
      return;
    }
    const sr = shell.getBoundingClientRect();
    const ir = el.getBoundingClientRect();
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const gap = 14;
    let left = ir.right - sr.left + gap;
    let side = 'right';
    if (left + cw > sr.width - 8) {
      left = ir.left - sr.left - gap - cw;
      side = 'left';
    }
    left = Math.max(8, Math.min(left, sr.width - cw - 8));
    const itemMid = ir.top - sr.top + ir.height / 2;
    const top = Math.max(8, Math.min(itemMid - 40, sr.height - ch - 8));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.classList.toggle('left', side === 'left');
    card.classList.toggle('right', side === 'right');
    card.style.setProperty('--nub-top', `${Math.max(14, Math.min(itemMid - top - 7, ch - 28))}px`);
  }

  #closeCard(restoreFocus) {
    const card = this.#root.querySelector('.card');
    if (!card || card.hidden) return;
    card.hidden = true;
    const el = this.#root.querySelector(`.item[data-id="${CSS.escape(this.#openId ?? '')}"]`);
    el?.classList.remove('active');
    if (restoreFocus) el?.focus();
    this.#openId = null;
  }

  #toggleFav(id, btn) {
    const on = !this.#favourites.has(id);
    if (on) this.#favourites.add(id);
    else this.#favourites.delete(id);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Remove from favourites' : 'Save to favourites');
    this.#emit('toggle-favourite', { itemId: id, on });
  }

  #addToCart(id, btn) {
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Adding...';
    this.#emit('add-to-cart', { itemId: id, quantity: 1 });
    if (!this.#hasParent()) {
      // Standalone demo: no Wix page to answer, so simulate success.
      setTimeout(() => this.#cartResult({ itemId: id, ok: true }), 350);
    }
  }

  #cartResult({ itemId, ok, message }) {
    if (itemId !== this.#openId) return;
    const btn = this.#root.querySelector('.card .cart');
    if (!btn) return;
    btn.disabled = false;
    btn.querySelector('span').textContent = ok ? 'Added ✓' : 'Add to cart';
    if (!ok) this.#toast(message || "Couldn't add to cart. Please try again.");
  }

  // Ask the seller: a small form inside the card; the Wix page stores and forwards it.
  #openAskForm(id) {
    const card = this.#root.querySelector('.card');
    if (!card || card.querySelector('.askform')) return;
    const form = document.createElement('form');
    form.className = 'askform';
    form.noValidate = false;
    form.innerHTML = `
      <label>Your name<input name="fromName" maxlength="100" autocomplete="name"></label>
      <label>Your email (the seller replies here)<input name="fromEmail" type="email" required maxlength="200" autocomplete="email"></label>
      <label>Your question<textarea name="message" required minlength="3" maxlength="2000" rows="3"></textarea></label>
      <div class="askbtns"><button class="send" type="submit">Send question</button><button class="askcancel" type="button">Cancel</button></div>`;
    card.querySelector('.links').after(form);
    form.querySelector('.askcancel').addEventListener('click', () => {
      form.remove();
      this.#positionCard();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const send = form.querySelector('.send');
      send.disabled = true;
      send.textContent = 'Sending...';
      this.#emit('ask-seller', {
        itemId: id,
        fromName: String(fd.get('fromName') || '').trim(),
        fromEmail: String(fd.get('fromEmail') || '').trim(),
        message: String(fd.get('message') || '').trim()
      });
      if (!this.#hasParent()) {
        setTimeout(() => this.#askResult({ itemId: id, ok: true, message: 'Demo: question not actually sent.' }), 350);
      }
    });
    this.#positionCard();
    form.querySelector('input[name="fromName"]').focus({ preventScroll: true });
  }

  #askResult({ itemId, ok, message }) {
    if (itemId !== this.#openId) return;
    const form = this.#root.querySelector('.card .askform');
    if (!form) return;
    if (ok) {
      const p = document.createElement('p');
      p.className = 'asksent';
      p.textContent = message || 'Sent! The seller will email you back.';
      form.replaceWith(p);
    } else {
      const send = form.querySelector('.send');
      send.disabled = false;
      send.textContent = 'Send question';
      this.#toast(message || "Couldn't send your question. Please try again.");
    }
    this.#positionCard();
  }

  #toast(text) {
    const t = this.#root.querySelector('.toast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  #fail(text) {
    const shell = this.#root.querySelector('.booth');
    shell.innerHTML = `<p class="loading" role="alert">${esc(text)}</p>`;
  }

  // ---------------------------------------------------------------- messaging
  #hasParent() {
    return window.parent && window.parent !== window;
  }

  #detectParentOrigin() {
    if (!this.#hasParent()) return null;
    let origin = null;
    try {
      origin = window.location.ancestorOrigins?.[0] ?? null;
    } catch {
      /* not supported */
    }
    if (!origin && document.referrer) {
      try {
        origin = new URL(document.referrer).origin;
      } catch {
        origin = null;
      }
    }
    return origin && isAllowedOrigin(origin, this.allowedOrigins) ? origin : null;
  }

  #emit(type, data) {
    const msg = { source: MSG_SOURCE, version: 1, type, boothId: this.#booth?.id ?? null, ...data };
    this.dispatchEvent(new CustomEvent('attic-booth:event', { detail: msg, bubbles: true, composed: true }));
    if (this.#hasParent()) {
      if (this.#parentOrigin) window.parent.postMessage(msg, this.#parentOrigin);
      else console.warn('[attic-booth] parent origin not allowed; message not sent', type);
    }
  }

  #handleMessage(e) {
    if (!this.#hasParent() || e.source !== window.parent) return;
    if (!isAllowedOrigin(e.origin, this.allowedOrigins)) return;
    const m = e.data;
    if (!m || typeof m !== 'object' || m.target !== MSG_SOURCE) return;
    this.#parentOrigin = e.origin;
    switch (m.type) {
      case 'load-booth':
        if (m.booth && m.library) this.load(m.booth, m.library);
        else if (m.booth && this.#libraryPromise) {
          this.#libraryPromise
            .then((lib) => this.load(m.booth, lib))
            .catch((err) => this.#fail(`Couldn't load the booth (${err.message}).`));
        }
        break;
      case 'ask-seller-result':
        this.#askResult(m);
        break;
      case 'set-favourites':
        this.#favourites = new Set(Array.isArray(m.itemIds) ? m.itemIds : []);
        break;
      case 'cart-result':
        this.#cartResult(m);
        break;
      case 'open-item':
        if (typeof m.itemId === 'string') this.openItem(m.itemId, { fromSearch: !!m.fromSearch });
        break;
      default:
        break;
    }
  }
}

if (!customElements.get('attic-booth')) customElements.define('attic-booth', AtticBooth);
