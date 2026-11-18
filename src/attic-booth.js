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
import { anyLampLit } from './logic/lamps.js';
import { ANNOUNCE_TYPES } from './bridge.js';
import { Lens } from './lens.js';
import { boxOfItem, boxedItemIds, styleOf, liningOf } from './logic/boxes.js';
import { soundOf, SOUND_VOLUME, SOUNDS_ENABLED } from './logic/sounds.js';

const NARROW_PX = 600;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const MSG_SOURCE = 'attic-booth';

const ICONS = {
  cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 3h2.3l2.6 11.2A2 2 0 0 0 9.8 16H18v-2H9.8l-.4-1.7h8.9a1 1 0 0 0 1-.8L21 6H6.6L6 3.8A1 1 0 0 0 5 3H3zm6.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2 0 3.6 1.1 4.4 2.6h1.8c.8-1.5 2.4-2.6 4.4-2.6 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>',
};

export class AtticBooth extends HTMLElement {
  #root;
  #booth = null;
  #library = null;
  #layout = null;
  #zoom = 1;
  #favourites = new Set();
  #favBooths = new Set(); // booth ids the visitor saved (set-favourites boothIds)
  #lens = null; // magnifier
  #anchor = null; // the element the open card points at (an item in the room or a box compartment)
  #openBoxId = null; // collectibles box shown up close
  #openId = null;
  #fromSearch = false;
  #audio = null;
  #soundOn = false;
  #soundId = null;
  #pendingOpen = null; // open-item that arrived before the booth was drawn (e.g. from a directory reel) // the seller's booth sound (logic/sounds.js); the shopper starts it with the Sound button
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
    const open = this.#pendingOpen ?? this.getAttribute('open-item');
    this.#pendingOpen = null;
    if (open) requestAnimationFrame(() => requestAnimationFrame(() => this.openItem(open)));
  }

  /** Open an item's card, e.g. when arriving from search (fromSearch shows "Visit booth"). */
  openItem(itemId, { fromSearch = false } = {}) {
    let el = this.#root.querySelector(`.item[data-id="${CSS.escape(itemId)}"]`);
    if (!el) {
      // An item in a collectibles box: open the box, then the item's card on its compartment.
      const inBox = boxOfItem(this.#booth, itemId);
      if (!inBox) return;
      this.#openBox(inBox.boxId);
      el = this.#root.querySelector(`.bvcell[data-id="${CSS.escape(itemId)}"]`);
      if (!el) return;
    }
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
    const boxed = boxedItemIds(b);
    const forSale = L.items.filter((e) => e.item.status !== 'sold').length + (b.items ?? []).filter((i) => boxed.has(i.id) && i.status !== 'sold').length;
    // The Lights switch appears for a lighting preset or for lamps the seller left on; lit lamps start on.
    const hasLights = !!b.room?.light?.presetId || anyLampLit(L);
    const favBooth = this.#favBooths.has(b.id);
    // The seller's sound, if any. A different sound (fresh data from the page) stops what was playing.
    const sound = SOUNDS_ENABLED ? soundOf(b.room?.sound) : null; // logic/sounds.js SOUNDS_ENABLED
    if ((sound?.id ?? null) !== this.#soundId) this.#stopSound();
    this.#soundId = sound?.id ?? null;
    shell.innerHTML = `
      <header class="namebar">
        <div class="avatar" aria-hidden="true">${avatar}</div>
        <div class="who">
          <h2>${esc(b.name)}</h2>
          <p class="meta"><span class="chip">Booth ${esc(b.boothNumber)}</span>${esc(b.seller?.displayName ?? '')} &middot; ${forSale} item${forSale === 1 ? '' : 's'} for sale</p>
          ${b.about ? `<p class="about">${esc(b.about)}</p>` : ''}
        </div>
        <div class="controls">
          <button class="ctl favbooth" type="button" aria-pressed="${favBooth}" title="Save this booth to your favourites">${ICONS.heart}<span>${favBooth ? 'Saved' : 'Save booth'}</span></button>
          ${hasLights ? '<button class="ctl lights" type="button" aria-pressed="true" title="Turn the booth lighting on or off">&#128161; Lights on</button>' : ''}
          ${sound ? `<button class="ctl sound" type="button" aria-pressed="${this.#soundOn}" title="Play the booth's background sound: ${esc(sound.name)}">${this.#soundLabel()}</button>` : ''}
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
      <div class="boxview" role="dialog" aria-modal="false" aria-labelledby="bv-title" hidden></div>
      <div class="card" role="dialog" aria-modal="false" aria-labelledby="card-title" hidden></div>
      <div class="toast" role="status" aria-live="polite"></div>`;

    this.#lens = new Lens(shell);
    this.#openBoxId = null;
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
      // Magnifier: hover with a mouse or pen, keyboard focus, or a tap on a touch screen.
      el.addEventListener('pointerenter', (e) => {
        this.#swing(el.dataset.id);
        if (e.pointerType !== 'touch') this.#magnify(el);
      });
      el.addEventListener('pointerleave', (e) => {
        if (e.pointerType !== 'touch') this.#lens?.hide();
      });
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') this.#magnify(el);
      });
      el.addEventListener('focus', () => {
        this.#swing(el.dataset.id);
        this.#magnify(el);
      });
      el.addEventListener('blur', () => this.#lens?.hide());
    });
    shell.querySelectorAll('.box').forEach((el) => el.addEventListener('click', () => this.#openBox(el.dataset.id)));
    const bv = shell.querySelector('.boxview');
    bv.addEventListener('click', (e) => {
      if (e.target.closest('.bvclose')) {
        this.#closeBox(true);
        return;
      }
      const cell = e.target.closest('.bvcell[data-id]');
      if (cell) {
        this.#fromSearch = false;
        this.#openCard(cell.dataset.id, cell);
      }
    });
    shell.querySelectorAll('.tag').forEach((t) =>
      t.addEventListener('click', () => {
        const el = shell.querySelector(`.item[data-id="${CSS.escape(t.dataset.id)}"]`);
        if (el) this.#openCard(t.dataset.id, el);
      }),
    );
    shell.querySelector('.sound')?.addEventListener('click', () => this.#toggleSound());
    shell.querySelector('.favbooth').addEventListener('click', () => this.#toggleBoothFav());
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
    vp.addEventListener(
      'scroll',
      () => {
        this.#lens?.hide();
        if (this.#openId) this.#positionCard();
      },
      { passive: true },
    );
    vp.addEventListener('pointerdown', (e) => this.#pinch(e, 'down'));
    vp.addEventListener('pointermove', (e) => this.#pinch(e, 'move'));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => vp.addEventListener(t, (e) => this.#pinch(e, 'up')));
    shell.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.#openId) this.#closeCard(true);
      else if (this.#openBoxId) this.#closeBox(true);
    });
    shell.querySelector('.room').addEventListener('click', (e) => {
      if (!e.target.closest('.item, .tag, .box')) {
        this.#closeCard(false);
        this.#closeBox(false);
      }
    });
  }

  /** The magnifier over one item in the room. */
  #magnify(el) {
    const it = this.#item(el.dataset.id);
    if (!it || !this.#lens) return;
    this.#lens.show(el, { id: it.id, src: it.image, title: it.title, sub: it.status === 'sold' ? 'Sold' : money(it.price) });
  }

  // ---------------------------------------------------------------- collectibles box, up close
  #openBox(boxId) {
    const box = (this.#booth.boxes ?? []).find((b) => b.id === boxId);
    const bv = this.#root.querySelector('.boxview');
    if (!box || !bv) return;
    this.#closeCard(false);
    this.#lens?.hide();
    this.#openBoxId = boxId;
    const items = (box.slots ?? []).map((id) => (id ? this.#item(id) : null));
    const n = items.filter(Boolean).length;
    bv.innerHTML = `
      <div class="bvhead">
        <div style="flex:1"><h3 id="bv-title" tabindex="-1">${esc(styleOf(box.style).name)}</h3><p>${n} item${n === 1 ? '' : 's'} &middot; click one for its details</p></div>
        <button class="bvclose" type="button" aria-label="Close the box">&times;</button>
      </div>
      <div class="bvbox style-${esc(styleOf(box.style).id)}" style="grid-template-columns:repeat(${box.cols},1fr);--lining:${esc(liningOf(box.lining).color)}">
        ${items
          .map((it) => {
            if (!it) return '<span class="bvcell empty" aria-hidden="true"></span>';
            const sold = it.status === 'sold';
            return `<button class="bvcell" type="button" data-id="${esc(it.id)}" aria-label="${esc(`${it.title}, ${sold ? 'sold' : money(it.price)}`)}"><img src="${esc(it.image)}" alt=""><span class="bvtag${sold ? ' sold' : ''}">${sold ? 'SOLD' : esc(money(it.price))}</span></button>`;
          })
          .join('')}
      </div>`;
    bv.hidden = false;
    bv.querySelector('#bv-title').focus({ preventScroll: true });
  }

  #closeBox(restoreFocus) {
    const bv = this.#root.querySelector('.boxview');
    if (!bv || bv.hidden) return;
    this.#closeCard(false);
    bv.hidden = true;
    const id = this.#openBoxId;
    this.#openBoxId = null;
    if (restoreFocus) this.#root.querySelector(`.box[data-id="${CSS.escape(id ?? '')}"]`)?.focus();
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

  #soundLabel() {
    return `&#9835; Sound ${this.#soundOn ? 'on' : 'off'}`;
  }

  #paintSoundButton() {
    const btn = this.#root.querySelector('.sound');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(this.#soundOn));
    btn.innerHTML = this.#soundLabel();
  }

  #stopSound() {
    this.#audio?.pause();
    this.#audio = null;
    this.#soundOn = false;
  }

  // Only ever called from the shopper's click on the Sound button: the booth never plays sound by itself.
  #toggleSound() {
    const sound = soundOf(this.#soundId);
    if (!sound) return;
    this.#soundOn = !this.#soundOn;
    if (!this.#audio) {
      this.#audio = new Audio(sound.src);
      this.#audio.loop = true;
      this.#audio.volume = SOUND_VOLUME;
    }
    if (this.#soundOn) {
      const audio = this.#audio;
      audio.play().catch(() => {
        if (this.#audio !== audio) return;
        this.#soundOn = false;
        this.#paintSoundButton();
        this.#toast("Couldn't play the booth sound.");
      });
    } else this.#audio.pause();
    this.#paintSoundButton();
    this.#emit('sound-toggle', { on: this.#soundOn });
  }

  // ---------------------------------------------------------------- card
  #item(id) {
    return (this.#booth?.items ?? []).find((i) => i.id === id) ?? null;
  }

  #openCard(id, el) {
    const item = this.#item(id);
    if (!item) return;
    this.#root.querySelectorAll('.item.active, .bvcell.active').forEach((n) => n.classList.remove('active'));
    el.classList.add('active');
    this.#anchor = el;
    this.#openId = id;
    const card = this.#root.querySelector('.card');
    const sold = item.status === 'sold';
    const fav = this.#favourites.has(id);
    const size = item.dims ? `${item.dims.h} &times; ${item.dims.w} &times; ${item.dims.d} in (H &times; W &times; D)` : '';
    const ship = 'Ships by USPS within the US; the price is calculated at checkout';
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
        <button class="ask" type="button">Ask about this item</button>
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
    const el = this.#anchor?.isConnected ? this.#anchor : this.#root.querySelector(`.item[data-id="${CSS.escape(this.#openId ?? '')}"]`);
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
    const el = this.#anchor?.isConnected ? this.#anchor : this.#root.querySelector(`.item[data-id="${CSS.escape(this.#openId ?? '')}"]`);
    el?.classList.remove('active');
    if (restoreFocus) el?.focus();
    this.#openId = null;
    this.#anchor = null;
    this.#lens?.hide();
  }

  #toggleFav(id, btn) {
    const on = !this.#favourites.has(id);
    if (on) this.#favourites.add(id);
    else this.#favourites.delete(id);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Remove from favourites' : 'Save to favourites');
    this.#emit('toggle-favourite', { itemId: id, on });
  }

  /** The heart in the name bar: save or unsave the whole booth. */
  #toggleBoothFav() {
    const id = this.#booth?.id;
    if (!id) return;
    const on = !this.#favBooths.has(id);
    if (on) this.#favBooths.add(id);
    else this.#favBooths.delete(id);
    this.#syncFavs();
    this.#emit('toggle-favourite-booth', { boothId: id, on });
  }

  /** Bring the hearts in line with the favourite sets (after set-favourites or a toggle). */
  #syncFavs() {
    const fb = this.#root.querySelector('.favbooth');
    if (fb) {
      const on = this.#favBooths.has(this.#booth?.id);
      fb.setAttribute('aria-pressed', String(on));
      fb.querySelector('span').textContent = on ? 'Saved' : 'Save booth';
    }
    const fi = this.#root.querySelector('.card:not([hidden]) .fav');
    if (fi && this.#openId) {
      const on = this.#favourites.has(this.#openId);
      fi.setAttribute('aria-pressed', String(on));
      fi.setAttribute('aria-label', on ? 'Remove from favourites' : 'Save to favourites');
    }
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

  // Ask about this item: a small form inside the card. The question goes to GingersAttic (the Wix page stores
  // it), which asks the seller and emails the answer back; buyers and sellers never contact each other directly.
  #openAskForm(id) {
    const card = this.#root.querySelector('.card');
    if (!card || card.querySelector('.askform')) return;
    const form = document.createElement('form');
    form.className = 'askform';
    form.noValidate = false;
    form.innerHTML = `
      <p class="askhow">Your question goes to GingersAttic. We ask the seller and email you their answer: buyers and sellers don't contact each other directly.</p>
      <label>Your name<input name="fromName" maxlength="100" autocomplete="name"></label>
      <label>Your email (we send the answer here)<input name="fromEmail" type="email" required maxlength="200" autocomplete="email"></label>
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
      p.textContent = message || 'Sent! GingersAttic will email you the answer.';
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
      // Firefox: no ancestorOrigins and maybe no referrer, so the origin can be unknown until the page answers.
      else if (ANNOUNCE_TYPES.includes(type)) window.parent.postMessage(msg, '*');
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
        // Either list may come alone; a list that isn't sent leaves that set as it was.
        if (Array.isArray(m.itemIds)) this.#favourites = new Set(m.itemIds);
        if (Array.isArray(m.boothIds)) this.#favBooths = new Set(m.boothIds);
        this.#syncFavs();
        break;
      case 'cart-result':
        this.#cartResult(m);
        break;
      case 'open-item':
        if (typeof m.itemId !== 'string') break;
        if (!this.#layout) this.#pendingOpen = m.itemId; // the booth is still loading: open it once drawn
        else this.openItem(m.itemId, { fromSearch: !!m.fromSearch });
        break;
      default:
        break;
    }
  }
}

if (!customElements.get('attic-booth')) customElements.define('attic-booth', AtticBooth);
