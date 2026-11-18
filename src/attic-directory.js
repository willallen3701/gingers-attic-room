// <attic-directory> - GingersAttic booth directory for the site's Booths page: "All booths" and "My collection".
// Usage (embedded in Wix): <attic-directory></attic-directory>; the page sends load-directory.
// Usage (standalone):      <attic-directory sample-src="data/sample-directory.json"></attic-directory>
//   Opened directly (no parent page) it shows the sample booths and answers its own requests, so it can be
//   tried on localhost. Attribute sample-options takes a query string: tab=collection, loggedIn=0, empty=1,
//   q=<search>, category=<id>, sort=updated|number|shuffle.
// Attributes: sample-src, sample-options, allowed-origins.
//
// Message contract (see README):
//   app -> page  ready{mode:'directory'} (about every second until load-directory), open-booth{slug},
//                toggle-favourite-booth{boothId, on}, toggle-favourite{itemId, on:false}, login-request,
//                get-collection, add-to-cart{itemId, quantity:1}
//   page -> app  load-directory{booths, loggedIn, favourites:{boothIds, itemIds}, categories:[{id, label}]},
//                set-favourites{boothIds?, itemIds?}, collection{booths, items}, cart-result{itemId, ok, message?}

import { css as roomCss } from './styles.js';
import { directoryCss } from './directory-styles.js';
import { Bridge } from './bridge.js';
import { esc, money, ensureFonts, signHtml } from './room-render.js';
import { filterBooths, SORTS, availability, AVAILABILITY_LABEL } from './logic/directory.js';

const READY_MS = 1000;
const READY_TRIES = 90;
const COLLECTION_TIMEOUT_MS = 15000;
const CART_TIMEOUT_MS = 20000;
const SEARCH_DEBOUNCE_MS = 120;

const ICONS = {
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.2-4.4-9.1-8.8C1.5 8.3 3.5 4.8 6.9 4.8c2 0 3.6 1.1 4.4 2.6h1.4c.8-1.5 2.4-2.6 4.4-2.6 3.4 0 5.4 3.5 4 6.7-1.9 4.4-9.1 8.8-9.1 8.8z"/></svg>',
  cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 3h2.3l2.6 11.2A2 2 0 0 0 9.8 16H18v-2H9.8l-.4-1.7h8.9a1 1 0 0 0 1-.8L21 6H6.6L6 3.8A1 1 0 0 0 5 3H3zm6.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>',
};

const dateFmt = (iso) => {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  try {
    return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
};
const boothLabel = (b) => `Booth No. ${b.boothNumber ?? ''}: ${b.name ?? ''}`;
const list = (v) => (Array.isArray(v) ? v : []);

export class AtticDirectory extends HTMLElement {
  #root;
  #bridge = null;
  #loaded = false;
  #readyTimer = null;
  #booths = [];
  #categories = [];
  #loggedIn = false;
  #favBooths = new Set();
  #favItems = new Set();
  #tab = 'all';
  #query = '';
  #category = '';
  #sort = 'updated';
  #seed = 1;
  #collection = null; // { booths, items } from the page
  #colState = 'idle'; // idle | loading | ready | error
  #colTimer = null;
  #carts = new Map(); // itemId -> 'adding' | 'added'
  #cartTimers = new Map();
  #loginAsked = false;
  #searchTimer = null;
  #sample = null; // standalone sample data
  #toastTimer = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.innerHTML = `<style>${roomCss}${directoryCss}</style><div class="dir"><p class="dmsg" role="status">Opening the booth directory...</p></div>`;
  }

  connectedCallback() {
    ensureFonts();
    const attr = this.getAttribute('allowed-origins');
    this.#bridge = new Bridge(this, { allowedOrigins: attr ? attr.split(/\s+/).filter(Boolean) : null, onMessage: (m) => this.#onMessage(m) });
    const sampleSrc = this.getAttribute('sample-src');
    if (sampleSrc && !this.#bridge.hasParent) {
      fetch(sampleSrc)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((sample) => this.#startSample(sample))
        .catch((err) => this.#fail(`Couldn't load the sample booths (${err.message}).`));
    }
    this.#announceReady();
  }

  disconnectedCallback() {
    clearTimeout(this.#readyTimer);
    clearTimeout(this.#colTimer);
    clearTimeout(this.#searchTimer);
    this.#cartTimers.forEach((t) => clearTimeout(t));
    this.#bridge?.dispose();
  }

  // Say "ready" now and about every second until the page sends the directory: the Wix page's code can
  // register its listener after this iframe has loaded.
  #announceReady() {
    let tries = 0;
    const tick = () => {
      if (this.#loaded) return;
      this.#bridge.emit('ready', { mode: 'directory' });
      tries += 1;
      if (this.#bridge.hasParent && tries < READY_TRIES) this.#readyTimer = setTimeout(tick, READY_MS);
    };
    tick();
  }

  // ================================================================ data in

  /** Show the directory. Safe to call again (the page may push fresh data, e.g. after the visitor logs in). */
  loadDirectory({ booths, loggedIn, favourites, categories } = {}) {
    const first = !this.#loaded;
    this.#loaded = true;
    clearTimeout(this.#readyTimer);
    this.#booths = list(booths).filter((b) => b && typeof b === 'object' && b.id);
    this.#categories = list(categories).filter((c) => c && c.id);
    const wasLoggedIn = this.#loggedIn;
    this.#loggedIn = !!loggedIn;
    this.#loginAsked = false;
    this.#setFavs(favourites ?? {});
    if (this.#category && !this.#categories.some((c) => c.id === this.#category)) this.#category = '';
    if (!this.#loggedIn) {
      this.#collection = null;
      this.#colState = 'idle';
    }
    if (first) this.#renderShell();
    else this.#syncTools();
    this.#renderTabs();
    this.#renderGrid();
    if (this.#tab === 'collection' && this.#loggedIn && (!wasLoggedIn || !this.#collection)) this.#requestCollection();
    else this.#renderCollection();
    this.dispatchEvent(new CustomEvent('attic-directory:loaded', { bubbles: true, composed: true }));
  }

  #onMessage(m) {
    switch (m.type) {
      case 'load-directory':
        this.loadDirectory(m);
        break;
      case 'set-favourites':
        this.#setFavs(m);
        this.#afterFavsChanged(true);
        break;
      case 'collection':
        this.#onCollection(m);
        break;
      case 'cart-result':
        this.#cartResult(m);
        break;
      default:
        break;
    }
  }

  /** Either list may come alone; a list that isn't sent leaves that set as it was. */
  #setFavs({ boothIds, itemIds } = {}) {
    if (Array.isArray(boothIds)) this.#favBooths = new Set(boothIds);
    if (Array.isArray(itemIds)) this.#favItems = new Set(itemIds);
  }

  #afterFavsChanged(fromPage = false) {
    this.#root.querySelectorAll('.bcard .heart[data-fav-booth]').forEach((h) => h.setAttribute('aria-pressed', String(this.#favBooths.has(h.dataset.favBooth))));
    this.#renderTabs();
    if (this.#tab === 'collection' && this.#collection) {
      // Something saved elsewhere (another tab, the booth view) that this collection doesn't have yet: fetch it.
      const known = (ids, rows) => [...ids].every((id) => rows.some((r) => r.id === id));
      if (fromPage && (!known(this.#favBooths, this.#collection.booths) || !known(this.#favItems, this.#collection.items))) this.#requestCollection();
      else this.#renderCollection();
    }
  }

  #onCollection(m) {
    clearTimeout(this.#colTimer);
    const booths = list(m.booths).filter((b) => b && b.id);
    const items = list(m.items).filter((i) => i && i.id);
    this.#collection = { booths, items };
    this.#colState = 'ready';
    // The collection is the visitor's saved list: make sure its hearts show as saved.
    booths.forEach((b) => this.#favBooths.add(b.id));
    items.forEach((i) => this.#favItems.add(i.id));
    this.#renderTabs();
    this.#renderCollection();
  }

  // ================================================================ rendering

  #fail(text) {
    const dir = this.#root.querySelector('.dir');
    dir.innerHTML = `<p class="dmsg" role="alert">${esc(text)}</p>`;
  }

  #renderShell() {
    const dir = this.#root.querySelector('.dir');
    dir.innerHTML = `
      <div class="tabs" role="tablist" aria-label="Booths">
        <button class="tab" role="tab" type="button" id="t-all" data-tab="all" aria-controls="p-all">All booths</button>
        <button class="tab" role="tab" type="button" id="t-col" data-tab="collection" aria-controls="p-col">My collection<span class="tcount" hidden></span></button>
      </div>
      <section class="panel" id="p-all" role="tabpanel" aria-labelledby="t-all">
        <form class="tools" role="search" aria-label="Find a booth">
          <label class="search"><span class="vh">Search booths, sellers and items</span>${ICONS.search}<input type="search" name="q" placeholder="Search booths, sellers or items" autocomplete="off" enterkeyhint="search" maxlength="80"></label>
          <label class="pick"><span>Category</span><select name="category"></select></label>
          <label class="pick"><span>Sort by</span><select name="sort">${SORTS.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select></label>
          <button class="ghostbtn reshuffle" type="button" hidden>Shuffle again</button>
        </form>
        <p class="resultline" role="status" aria-live="polite"></p>
        <div class="grid"></div>
      </section>
      <section class="panel" id="p-col" role="tabpanel" aria-labelledby="t-col" hidden></section>
      ${this.#sample ? '<p class="demo">Preview with sample booths: not connected to the GingersAttic site.</p>' : ''}
      <div class="dtoast" role="status" aria-live="polite"></div>`;
    this.#syncTools();
    this.#wire(dir);
  }

  /** Put the search/filter/sort state into the controls (categories can change with load-directory). */
  #syncTools() {
    const form = this.#root.querySelector('.tools');
    if (!form) return;
    form.hidden = !this.#booths.length;
    const cat = form.querySelector('[name="category"]');
    cat.innerHTML = `<option value="">All categories</option>${this.#categories.map((c) => `<option value="${esc(c.id)}">${esc(c.label ?? c.id)}</option>`).join('')}`;
    cat.value = this.#category;
    form.querySelector('[name="sort"]').value = this.#sort;
    const q = form.querySelector('[name="q"]');
    if (q.value !== this.#query) q.value = this.#query;
    form.querySelector('.reshuffle').hidden = this.#sort !== 'shuffle';
  }

  #renderTabs() {
    this.#root.querySelectorAll('.tab').forEach((t) => {
      const on = t.dataset.tab === this.#tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    const n = this.#favBooths.size + this.#favItems.size;
    const c = this.#root.querySelector('.tcount');
    if (c) {
      c.hidden = !this.#loggedIn || !n;
      c.textContent = String(n);
      c.setAttribute('aria-label', `${n} saved`);
    }
    const pa = this.#root.querySelector('#p-all');
    const pc = this.#root.querySelector('#p-col');
    if (pa) pa.hidden = this.#tab !== 'all';
    if (pc) pc.hidden = this.#tab !== 'collection';
  }

  #signBox(b) {
    // room-render's sign, exactly as the booth view hangs it, in the booth's sign style.
    const booth = { boothNumber: b.boothNumber ?? '', name: b.name ?? '', room: { sign: { style: b.signStyle } } };
    return `<div class="signclip" aria-hidden="true"><div class="signroom">${signHtml(booth)}</div></div>`;
  }

  #cardHtml({ booth: b, titles }) {
    const fav = this.#favBooths.has(b.id);
    const n = Number(b.itemCount) || 0;
    const previews = list(b.previews).filter((s) => typeof s === 'string' && s).slice(0, 4);
    const updated = dateFmt(b.updatedAt);
    const label = boothLabel(b);
    const more = titles.length > 2 ? ` and ${titles.length - 2} more` : '';
    return `
      <article class="bcard paper" data-id="${esc(b.id)}">
        <h3 class="vh">${esc(label)}</h3>
        ${this.#signBox(b)}
        ${b.sellerName ? `<p class="by">by ${esc(b.sellerName)}</p>` : ''}
        ${b.about ? `<p class="babout">${esc(b.about)}</p>` : ''}
        ${previews.length ? `<ul class="thumbs" aria-hidden="true">${previews.map((src) => `<li><img src="${esc(src)}" alt="" loading="lazy" decoding="async"></li>`).join('')}${'<li class="none"></li>'.repeat(4 - previews.length)}</ul>` : ''}
        ${titles.length ? `<p class="hits">Has: ${titles.slice(0, 2).map(esc).join(', ')}${more}</p>` : ''}
        <div class="bfoot">
          <span class="meta"><span class="count"><b>${n}</b> item${n === 1 ? '' : 's'}</span>${updated ? `<span class="upd">Updated ${esc(updated)}</span>` : ''}</span>
          <button class="visit" type="button" data-open="${esc(b.slug ?? '')}" aria-label="Visit ${esc(label)}">Visit booth</button>
          <button class="heart" type="button" data-fav-booth="${esc(b.id)}" aria-pressed="${fav}" aria-label="Save ${esc(label)} to my collection" title="Save to my collection">${ICONS.heart}</button>
        </div>
      </article>`;
  }

  #renderGrid() {
    const grid = this.#root.querySelector('.grid');
    const line = this.#root.querySelector('.resultline');
    if (!grid) return;
    const total = this.#booths.length;
    if (!total) {
      grid.innerHTML = '<div class="nobooths paper"><p>No other booths are open yet.</p></div>';
      line.textContent = '';
      return;
    }
    const rows = filterBooths(this.#booths, { query: this.#query, category: this.#category, sort: this.#sort, seed: this.#seed });
    const cat = this.#categories.find((c) => c.id === this.#category);
    const q = String(this.#query ?? '').trim();
    if (!rows.length) {
      let msg;
      if (q && cat) msg = `No booths in ${esc(cat.label)} match &ldquo;${esc(q)}&rdquo;.`;
      else if (q) msg = `No booths match &ldquo;${esc(q)}&rdquo;.`;
      else msg = `No booths have ${esc(cat?.label ?? 'that kind of')} items yet.`;
      grid.innerHTML = `<div class="nomatch paper"><p>${msg}</p><p class="empty">Try another word or category.</p><button class="primary clearsearch" type="button">Show all booths</button></div>`;
      line.textContent = `No booths found out of ${total}.`;
      return;
    }
    grid.innerHTML = rows.map((r) => this.#cardHtml(r)).join('');
    const filtered = q || cat;
    line.textContent = filtered ? `${rows.length} of ${total} booth${total === 1 ? '' : 's'}` : `${total} booth${total === 1 ? '' : 's'}`;
  }

  #miniBoothHtml(b) {
    const n = Number(b.itemCount);
    const label = boothLabel(b);
    return `
      <article class="mcard paper" data-id="${esc(b.id)}">
        <h3 class="vh">${esc(label)}</h3>
        ${this.#signBox(b)}
        ${b.sellerName || Number.isFinite(n) ? `<p class="by">${b.sellerName ? `by ${esc(b.sellerName)}` : ''}${b.sellerName && Number.isFinite(n) ? ' &middot; ' : ''}${Number.isFinite(n) ? `${n} item${n === 1 ? '' : 's'}` : ''}</p>` : ''}
        <div class="macts">
          <button class="primary" type="button" data-open="${esc(b.slug ?? '')}" aria-label="Visit ${esc(label)}">Visit</button>
          <button class="heart" type="button" data-unfav-booth="${esc(b.id)}" aria-pressed="true" aria-label="Remove ${esc(label)} from my collection" title="Remove from my collection">${ICONS.heart}</button>
        </div>
      </article>`;
  }

  #cartLabel(id) {
    const st = this.#carts.get(id);
    return st === 'adding' ? 'Adding...' : st === 'added' ? 'Added ✓' : 'Add to cart';
  }

  #itemHtml(it) {
    const state = availability(it);
    const ok = state === 'available';
    return `
      <article class="icard paper${ok ? '' : ' out'}" data-id="${esc(it.id)}">
        <div class="iphoto">${it.image ? `<img src="${esc(it.image)}" alt="" loading="lazy" decoding="async">` : ''}</div>
        <div class="ibody">
          <h3 class="ititle">${esc(it.title)}</h3>
          ${typeof it.price === 'number' ? `<p class="iprice">${esc(money(it.price))}</p>` : ''}
          ${AVAILABILITY_LABEL[state] ? `<p class="istatus ${state}">${esc(AVAILABILITY_LABEL[state])}</p>` : ''}
          ${it.boothName ? `<p class="ifrom">from ${it.boothSlug ? `<button class="lnk" type="button" data-open="${esc(it.boothSlug)}">${esc(it.boothName)}</button>` : esc(it.boothName)}</p>` : ''}
          <div class="iacts">
            ${ok ? `<button class="cartbtn" type="button" data-cart="${esc(it.id)}" ${this.#carts.get(it.id) === 'adding' ? 'disabled' : ''}>${ICONS.cart}<span>${this.#cartLabel(it.id)}</span></button>` : ''}
            <button class="heart" type="button" data-unfav-item="${esc(it.id)}" aria-pressed="true" aria-label="Remove ${esc(it.title)} from my collection" title="Remove from my collection">${ICONS.heart}</button>
          </div>
        </div>
      </article>`;
  }

  #renderCollection() {
    const p = this.#root.querySelector('#p-col');
    if (!p) return;
    if (!this.#loggedIn) {
      p.innerHTML = `
        <div class="gate paper">
          <h2>Your collection</h2>
          <p>Log in to see the booths and items you've saved with the heart.</p>
          <button class="primary login" type="button" ${this.#loginAsked ? 'disabled' : ''}>${this.#loginAsked ? 'Opening log in...' : 'Log in'}</button>
        </div>`;
      return;
    }
    if (!this.#collection) {
      p.innerHTML =
        this.#colState === 'error'
          ? `<div class="gate paper"><h2>Your collection</h2><p>Couldn't load your collection.</p><button class="primary retry" type="button">Try again</button></div>`
          : '<p class="dmsg" role="status">Opening your collection...</p>';
      return;
    }
    const booths = this.#collection.booths.filter((b) => this.#favBooths.has(b.id));
    const items = this.#collection.items.filter((i) => this.#favItems.has(i.id));
    p.innerHTML = `
      <section class="colsec" aria-labelledby="h-booths">
        <h2 id="h-booths" tabindex="-1">Saved booths <small>(${booths.length})</small></h2>
        ${booths.length ? `<div class="mgrid">${booths.map((b) => this.#miniBoothHtml(b)).join('')}</div>` : '<p class="empty paper">No saved booths yet. Tap the heart on a booth to keep it here.</p>'}
      </section>
      <section class="colsec" aria-labelledby="h-items">
        <h2 id="h-items" tabindex="-1">Saved items <small>(${items.length})</small></h2>
        ${items.length ? `<div class="igrid">${items.map((i) => this.#itemHtml(i)).join('')}</div>` : '<p class="empty paper">No saved items yet. Tap the heart on an item in any booth to keep it here.</p>'}
      </section>`;
  }

  // ================================================================ interaction

  #wire(dir) {
    const tabs = dir.querySelector('.tabs');
    tabs.addEventListener('click', (e) => {
      const t = e.target.closest('.tab');
      if (t) this.#selectTab(t.dataset.tab);
    });
    tabs.addEventListener('keydown', (e) => {
      const order = ['all', 'collection'];
      const i = order.indexOf(this.#tab);
      let next = null;
      if (e.key === 'ArrowRight') next = order[(i + 1) % order.length];
      else if (e.key === 'ArrowLeft') next = order[(i + order.length - 1) % order.length];
      else if (e.key === 'Home') next = order[0];
      else if (e.key === 'End') next = order[order.length - 1];
      if (!next) return;
      e.preventDefault();
      this.#selectTab(next);
      this.#root.querySelector(`.tab[data-tab="${next}"]`)?.focus();
    });
    const form = dir.querySelector('.tools');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearTimeout(this.#searchTimer);
      this.#query = form.querySelector('[name="q"]').value;
      this.#renderGrid();
    });
    form.addEventListener('input', (e) => {
      // Keep the element now: the DOM clears event.target after dispatch for events from a shadow tree.
      const input = e.target;
      if (input.name !== 'q') return;
      clearTimeout(this.#searchTimer);
      this.#searchTimer = setTimeout(() => {
        this.#query = input.value;
        this.#renderGrid();
      }, SEARCH_DEBOUNCE_MS);
    });
    form.addEventListener('change', (e) => {
      if (e.target.name === 'category') this.#category = e.target.value;
      else if (e.target.name === 'sort') {
        this.#sort = e.target.value;
        if (this.#sort === 'shuffle') this.#seed = newSeed();
        form.querySelector('.reshuffle').hidden = this.#sort !== 'shuffle';
      } else return;
      this.#renderGrid();
    });
    form.querySelector('.reshuffle').addEventListener('click', () => {
      this.#seed = newSeed();
      this.#renderGrid();
    });
    dir.querySelector('#p-all').addEventListener('click', (e) => {
      const heart = e.target.closest('[data-fav-booth]');
      if (heart) {
        this.#toggleBooth(heart.dataset.favBooth, heart.getAttribute('aria-pressed') !== 'true');
        return;
      }
      if (e.target.closest('.clearsearch')) {
        this.#query = '';
        this.#category = '';
        this.#syncTools();
        this.#renderGrid();
        this.#root.querySelector('.tools [name="q"]')?.focus();
        return;
      }
      const open = e.target.closest('[data-open]');
      if (open) this.#openBooth(open.dataset.open);
    });
    dir.querySelector('#p-col').addEventListener('click', (e) => {
      const el = e.target.closest('button');
      if (!el) return;
      if (el.classList.contains('login')) this.#login(el);
      else if (el.classList.contains('retry')) this.#requestCollection();
      else if (el.dataset.unfavBooth) this.#toggleBooth(el.dataset.unfavBooth, false, true);
      else if (el.dataset.unfavItem) this.#unfavItem(el.dataset.unfavItem);
      else if (el.dataset.cart) this.#addToCart(el.dataset.cart);
      else if (el.dataset.open) this.#openBooth(el.dataset.open);
    });
  }

  #selectTab(tab) {
    if (tab !== 'all' && tab !== 'collection') return;
    this.#tab = tab;
    this.#renderTabs();
    if (tab === 'collection') {
      if (this.#loggedIn) this.#requestCollection();
      else this.#renderCollection();
    }
  }

  #openBooth(slug) {
    if (!slug) return;
    this.#send('open-booth', { slug });
  }

  #toggleBooth(boothId, on, fromCollection = false) {
    if (!boothId) return;
    if (on) this.#favBooths.add(boothId);
    else this.#favBooths.delete(boothId);
    // A booth saved from the grid shows in the collection right away (its data is already here).
    if (on && this.#collection && !this.#collection.booths.some((b) => b.id === boothId)) {
      const b = this.#booths.find((x) => x.id === boothId);
      if (b) this.#collection = { ...this.#collection, booths: [...this.#collection.booths, b] };
    }
    this.#send('toggle-favourite-booth', { boothId, on });
    this.#afterFavsChanged();
    if (fromCollection) {
      this.#toast('Removed from your collection.');
      this.#root.querySelector('#h-booths')?.focus();
    }
  }

  #unfavItem(itemId) {
    this.#favItems.delete(itemId);
    this.#send('toggle-favourite', { itemId, on: false });
    this.#afterFavsChanged();
    this.#toast('Removed from your collection.');
    this.#root.querySelector('#h-items')?.focus();
  }

  #login(btn) {
    this.#loginAsked = true;
    btn.disabled = true;
    btn.textContent = 'Opening log in...';
    this.#send('login-request', {});
  }

  #requestCollection() {
    this.#colState = 'loading';
    if (!this.#collection) this.#renderCollection();
    clearTimeout(this.#colTimer);
    this.#colTimer = setTimeout(() => {
      if (this.#colState !== 'loading') return;
      this.#colState = 'error';
      if (!this.#collection) this.#renderCollection();
      else this.#toast("Couldn't refresh your collection.");
    }, COLLECTION_TIMEOUT_MS);
    this.#send('get-collection', {});
  }

  #addToCart(itemId) {
    if (this.#carts.get(itemId) === 'adding') return;
    this.#carts.set(itemId, 'adding');
    this.#paintCart(itemId);
    clearTimeout(this.#cartTimers.get(itemId));
    this.#cartTimers.set(itemId, setTimeout(() => this.#cartResult({ itemId, ok: false, message: 'The site took too long to answer. Please try again.' }), CART_TIMEOUT_MS));
    this.#send('add-to-cart', { itemId, quantity: 1 });
  }

  #cartResult({ itemId, ok, message }) {
    if (this.#carts.get(itemId) !== 'adding') return;
    clearTimeout(this.#cartTimers.get(itemId));
    this.#cartTimers.delete(itemId);
    if (ok) this.#carts.set(itemId, 'added');
    else {
      this.#carts.delete(itemId);
      this.#toast(message || "Couldn't add to cart. Please try again.");
    }
    this.#paintCart(itemId);
  }

  #paintCart(itemId) {
    const btn = this.#root.querySelector(`[data-cart="${CSS.escape(itemId)}"]`);
    if (!btn) return;
    btn.disabled = this.#carts.get(itemId) === 'adding';
    btn.querySelector('span').textContent = this.#cartLabel(itemId);
  }

  #toast(text) {
    const t = this.#root.querySelector('.dtoast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ================================================================ messages out (+ standalone answers)

  #send(type, data) {
    this.#bridge.emit(type, data);
    if (!this.#bridge.hasParent && this.#sample) this.#simulate(type, data);
  }

  #startSample(sample) {
    this.#sample = sample ?? {};
    const o = new URLSearchParams(this.getAttribute('sample-options') ?? '');
    if (o.get('q')) this.#query = o.get('q');
    if (o.get('category')) this.#category = o.get('category');
    if (SORTS.some((s) => s.id === o.get('sort'))) this.#sort = o.get('sort');
    if (o.get('tab') === 'collection') this.#tab = 'collection';
    this.loadDirectory({
      booths: o.get('empty') === '1' ? [] : this.#sample.booths,
      loggedIn: o.get('loggedIn') === '0' ? false : this.#sample.loggedIn !== false,
      favourites: this.#sample.favourites,
      categories: this.#sample.categories,
    });
  }

  /** Standalone demo (no Wix page): answer the page's side locally. */
  #simulate(type, data) {
    const s = this.#sample;
    if (type === 'get-collection') {
      setTimeout(() => {
        const booths = list(s.booths).filter((b) => this.#favBooths.has(b.id));
        const items = list(s.collection?.items).filter((i) => this.#favItems.has(i.id));
        this.#onMessage({ type: 'collection', booths, items });
      }, 300);
    } else if (type === 'add-to-cart') {
      setTimeout(() => this.#onMessage({ type: 'cart-result', itemId: data.itemId, ok: true }), 350);
    } else if (type === 'login-request') {
      setTimeout(() => this.loadDirectory({ booths: this.#booths, loggedIn: true, favourites: s.favourites, categories: this.#categories }), 400);
    }
  }
}

function newSeed() {
  return (Math.random() * 0x100000000) >>> 0;
}

if (!customElements.get('attic-directory')) customElements.define('attic-directory', AtticDirectory);
