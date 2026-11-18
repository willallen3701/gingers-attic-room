// <attic-editor> - GingersAttic booth EDITOR (Phase 2): the seller arranges their own booth.
// Usage (embedded in Wix): <attic-editor library-src="data/library.json"></attic-editor>; the page sends load-editor.
// Usage (standalone demo):  <attic-editor booth-src="data/demo-booth.json" library-src="data/library.json"></attic-editor>
// Attributes: booth-src, library-src, first-visit (standalone: start the wizard), allowed-origins.
//
// Message contract (see README): page -> app  load-editor, save-result, open-result, upload-result, info-result
//                                 app -> page  ready{mode:'edit'}, save-draft, open-booth, upload-texture, save-info, wizard-done
// Edits autosave as a DRAFT (debounced 1.5 s). Shoppers see the last OPENED version until "Open my booth" / "Update booth".

import { css as roomCss } from './styles.js';
import { editorCss } from './editor-styles.js';
import { ROOM, pct } from './logic/room.js';
import { buildLayout } from './logic/layout.js';
import { normalizeLibrary, byId } from './logic/library.js';
import { createHistory } from './logic/history.js';
import { toDraft, applyDraft, defaultRoom } from './logic/draft.js';
import { encodePlan, dataUrlBytes, MAX_BYTES, uploadTileIn } from './logic/downscale.js';
import * as ops from './logic/editops.js';
import { Bridge } from './bridge.js';
import { ItemSheet } from './item-sheet.js';
import {
  esc, money, ensureFonts, roomInnerHtml, placeablesHtml, fixturesHtml, decorHtml, boxesHtml, itemsHtml, tagsHtml, lampsHtml, paintSurfaces, SIGN_STYLES,
} from './room-render.js';
import { isLampDef } from './logic/lamps.js';
import { tweakRange, itemSizeIn } from './logic/scale.js';
import { BOX_STYLES, BOX_LININGS, BOX_GRID_MIN, BOX_GRID_MAX, MAX_BOXES, boxOfItem, boxedItemIds, placedPieces, styleOf, liningOf } from './logic/boxes.js';
import { Lens } from './lens.js';

const NARROW_EDIT_PX = 768;
const AUTOSAVE_MS = 1500;
const SAVE_TIMEOUT_MS = 15000;
const COACH_KEY = 'attic-editor:coach-off';
const DRAG_START_PX = 4;

const TABS = [
  { id: 'walls', label: 'Walls', icon: '<path d="M4 4h16v16H4z M4 9h16 M4 14h16 M9 4v5 M15 9v5 M9 14v6"/>' },
  { id: 'floor', label: 'Floor', icon: '<path d="M3 20 8 6h8l5 14z M6 13h12 M10 6l-1 14 M14 6l1 14"/>' },
  { id: 'light', label: 'Lighting', icon: '<path d="M9 18h6 M10 21h4 M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.6 1 2.5h6c0-.9.2-1.7 1-2.5A6 6 0 0 0 12 3z"/>' },
  { id: 'fixtures', label: 'Fixtures', icon: '<path d="M3 7h18 M3 13h18 M3 19h18 M5 7v3 M19 7v3 M5 13v3 M19 13v3"/>' },
  { id: 'decor', label: 'Decor', icon: '<path d="M12 21v-7 M12 14c-4 0-6-3-6-7 3 0 6 2 6 5 0-3 3-5 6-5 0 4-2 7-6 7z M8 21h8"/>' },
  { id: 'items', label: 'My Items', icon: '<path d="M3 8h18v12H3z M3 8l3-4h12l3 4 M9 12h6"/>' },
  { id: 'sign', label: 'Booth sign', icon: '<path d="M4 9h16v8H4z M8 9l4-5 4 5"/>' },
];

const WIZARD = [
  { tab: 'walls', title: 'Choose your wallpaper', text: 'Pick a pattern for your back wall, paint it a colour, or upload a photo of your own wallpaper.' },
  { tab: 'floor', title: 'Lay your floor', text: 'Wood, tile or lino: choose what suits your booth. You can upload your own too.' },
  { tab: 'fixtures', title: 'Shelves, tables & finishing touches', text: 'Add shelves and tables to hold your treasures. The Lighting and Decor tabs add atmosphere: a window, a clock, a fern.' },
  { tab: 'items', title: 'Add your items', text: "Click \"Add an item\": snap a photo, we cut out the background, then you add the price, size and details. GingersAttic checks each item before shoppers see it." },
  { tab: 'items', title: 'Place your items', text: 'Drag items from your storage crate onto a shelf, a table or the floor. Up to 40 can be out at once. Items marked Private only show to shoppers once GingersAttic approves them.' },
  { target: 'open', title: 'Open your booth', text: 'When it looks right, open it to shoppers. Your changes keep saving as a draft, and you can update the booth any time.' },
];

// The guide before Phase 3, kept for a Wix site whose published code can't take items yet
// (the room app updates on GitHub Pages before the site is republished).
const WIZARD_NO_ITEMS = [
  WIZARD[0],
  WIZARD[1],
  WIZARD[2],
  { soon: true, title: 'Add your items', text: "Coming next: snap a photo of each item and we'll cut out the background for you. Skip this step for now." },
  { tab: 'items', title: 'Place your items', text: 'Drag items from your storage crate onto a shelf, a table or the floor. Up to 40 can be out at once.' },
  WIZARD[WIZARD.length - 1],
];

const STATUS_BADGE = {
  pending: ['wait', 'Private · waiting for approval'],
  rejected: ['bad', 'Private · needs changes'],
  approved: ['sale', 'For sale'],
  sold: ['sold', 'Sold'],
};

const FIXTURE_GROUPS = [
  ['shelf', 'Shelves'],
  ['table', 'Tables & stands'],
  ['cabinet', 'Cabinets & cases'],
  ['hanger', 'Wall hangers'],
];

const store = {
  get(k) {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* storage blocked: the tips simply show again next time */
    }
  },
};
const timeFmt = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?([AP]M)$/i, (m, p) => ` ${p.toLowerCase()}`);
  } catch {
    return '';
  }
};
const icon = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const inches = (w, h) => `${+w.toFixed(1)} &times; ${+h.toFixed(1)} in`;
/** A small picture of a collectibles box (panel cards, selection bar). */
const miniBox = (style, lining, cols, rows) =>
  `<span class="minibox style-${esc(styleOf(style).id)}" style="grid-template-columns:repeat(${cols},1fr);--lining:${esc(liningOf(lining).color)}" aria-hidden="true">${'<i></i>'.repeat(cols * rows)}</span>`;

export class AtticEditor extends HTMLElement {
  #root;
  #bridge = null;
  #lib = null;
  #booth = null;
  #meta = { isFirstVisit: false, boothStatus: 'new', hasUnopenedChanges: false, lastSavedAt: null, maxPlaced: ROOM.maxPlacedItems };
  #uploads = [];
  #history = createHistory(150);
  #tab = 'walls';
  #sel = null; // { kind, id }
  #drag = null; // room drag in progress
  #panelDrag = null; // dragging a new thing from the panel
  #save = { state: 'idle', savedAt: null, timer: null, inFlight: false, again: false, retry: 0, guard: null, retryTimer: null };
  #changeN = 0;
  #pendingOpen = false;
  #opening = null; // changeN at the time open-booth was sent
  #pendingUploads = new Map();
  #wizard = null; // step index or null
  #coach = false;
  #loaded = false;
  #readyTimer = null;
  #waitingLogin = false; // the page said the visitor must log in first
  #sheet = null;
  #requests = new Map(); // requestId -> resolve, for request/response messages
  #confirmDel = null; // item id whose Delete / Take down asks "are you sure?"
  #lightsOff = false; // editor preview of the shoppers' light switch (not saved)
  #simN = 0;
  #libraryPromise = null;
  #narrow = false;
  #ro = null;
  #raf = 0;
  #lens = null; // magnifier over items (hover)
  #boxSheet = null; // { boxId, slot } while the "Fill the compartments" sheet is open

  /** Adding items needs Phase 3 site code; the page says so with meta.itemsEnabled (standalone: always on). */
  get #itemsOn() {
    return !this.#bridge?.hasParent || !!this.#meta.itemsEnabled;
  }

  get #steps() {
    return this.#itemsOn ? WIZARD : WIZARD_NO_ITEMS;
  }

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.innerHTML = `<style>${roomCss}${editorCss}</style><div class="ed loading"><p class="loadmsg">Opening your booth editor...</p></div><div class="sheethost"></div><div class="boxhost"></div>`;
  }

  connectedCallback() {
    ensureFonts();
    const attr = this.getAttribute('allowed-origins');
    this.#bridge = new Bridge(this, { allowedOrigins: attr ? attr.split(/\s+/).filter(Boolean) : null, onMessage: (m) => this.#onMessage(m) });
    const boothSrc = this.getAttribute('booth-src');
    const librarySrc = this.getAttribute('library-src');
    if (librarySrc) {
      this.#libraryPromise = fetch(librarySrc).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
    }
    if (boothSrc && !this.#bridge.hasParent) {
      Promise.all([fetch(boothSrc).then((r) => r.json()), this.#libraryPromise])
        .then(([booth, library]) =>
          this.loadEditor({
            booth,
            library,
            meta: {
              isFirstVisit: this.hasAttribute('first-visit'),
              boothStatus: this.hasAttribute('first-visit') ? 'new' : 'live',
              hasUnopenedChanges: false,
              lastSavedAt: null,
            },
            uploads: [],
          }),
        )
        .catch((err) => this.#fail(`Couldn't open the editor (${err.message}).`));
    }
    this.#announceReady();
    this.#ro = new ResizeObserver(() => this.#onResize());
    this.#ro.observe(this);
    this.#root.addEventListener('keydown', (e) => this.#onKey(e));
    const boxhost = this.#root.querySelector('.boxhost');
    boxhost.addEventListener('click', (e) => this.#boxSheetClick(e));
    boxhost.addEventListener('change', (e) => this.#boxSheetChange(e));
  }

  disconnectedCallback() {
    clearTimeout(this.#readyTimer);
    clearTimeout(this.#save.timer);
    clearTimeout(this.#save.guard);
    clearTimeout(this.#save.retryTimer);
    this.#bridge?.dispose();
    this.#ro?.disconnect();
  }

  #announceReady() {
    let tries = 0;
    const tick = () => {
      if (this.#loaded || this.#waitingLogin) return;
      this.#bridge.emit('ready', { mode: 'edit' });
      tries += 1;
      if (this.#bridge.hasParent && tries < 20) this.#readyTimer = setTimeout(tick, 1500);
    };
    tick();
  }

  // ================================================================ data in

  /** Load a booth into the editor. `booth` already has the seller's draft applied. */
  async loadEditor({ booth, library, meta = {}, uploads = [] }) {
    const lib = normalizeLibrary(library ?? (await this.#libraryPromise));
    this.#loaded = true;
    this.#waitingLogin = false;
    clearTimeout(this.#readyTimer);
    this.#lib = lib;
    const room = { ...defaultRoom(lib), ...(booth.room ?? {}) };
    if (!Array.isArray(room.placeables)) room.placeables = [];
    if (!Array.isArray(room.architecture)) room.architecture = [];
    this.#booth = { ...booth, room, fixtures: booth.fixtures ?? [], decor: booth.decor ?? [], items: booth.items ?? [], boxes: booth.boxes ?? [] };
    this.#meta = { ...this.#meta, ...meta, maxPlaced: meta.maxPlaced ?? ROOM.maxPlacedItems };
    this.#uploads = Array.isArray(uploads) ? uploads : [];
    this.#history.reset(toDraft(this.#booth));
    this.#save = { ...this.#save, state: this.#meta.lastSavedAt ? 'saved' : 'idle', savedAt: this.#meta.lastSavedAt };
    this.#wizard = this.#meta.isFirstVisit ? 0 : null;
    this.#coach = !this.#meta.isFirstVisit && store.get(COACH_KEY) !== '1';
    if (this.#wizard !== null) this.#tab = this.#steps[0].tab;
    this.#render();
    this.dispatchEvent(new CustomEvent('attic-editor:loaded', { bubbles: true, composed: true }));
  }

  #onMessage(m) {
    if (m.requestId && this.#requests.has(m.requestId)) {
      const resolve = this.#requests.get(m.requestId);
      this.#requests.delete(m.requestId);
      resolve(m);
      return;
    }
    switch (m.type) {
      case 'load-editor':
        if (m.booth) this.loadEditor({ booth: m.booth, library: m.library, meta: m.meta, uploads: m.uploads }).catch((e) => this.#fail(`Couldn't open the editor (${e.message}).`));
        break;
      case 'save-result':
        this.#onSaveResult(m);
        break;
      case 'open-result':
        this.#onOpenResult(m);
        break;
      case 'upload-result':
        this.#onUploadResult(m);
        break;
      case 'info-result':
        this.#toast(m.ok ? 'Booth sign saved.' : m.message || "Couldn't save your booth sign.");
        break;
      case 'need-login':
        if (!this.#loaded) this.#needLogin(m.message);
        break;
      default:
        break;
    }
  }

  // Logged-out visitor: stop asking the page for a booth and offer a Log in button instead.
  #needLogin(text) {
    this.#waitingLogin = true;
    clearTimeout(this.#readyTimer);
    const ed = this.#root.querySelector('.ed');
    ed.className = 'ed loading';
    ed.innerHTML = `<p class="loadmsg" role="alert">${esc(text || 'Log in to set up your booth.')}</p><p class="loadmsg"><button type="button" class="primary loginbtn">Log in</button></p>`;
    const btn = ed.querySelector('.loginbtn');
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = 'Opening log in...';
      this.#bridge.emit('login-request', {});
    });
  }

  // ================================================================ edits, history, autosave

  #commit(nextBooth) {
    this.#booth = nextBooth;
    if (this.#history.push(toDraft(nextBooth))) this.#changed();
    this.#renderAll();
  }

  #changed() {
    this.#changeN += 1;
    this.#meta.hasUnopenedChanges = true;
    this.#scheduleSave();
  }

  #undo() {
    const d = this.#history.undo();
    if (!d) return;
    this.#booth = applyDraft(this.#booth, d);
    this.#sel = null;
    this.#changed();
    this.#renderAll();
  }

  #redo() {
    const d = this.#history.redo();
    if (!d) return;
    this.#booth = applyDraft(this.#booth, d);
    this.#sel = null;
    this.#changed();
    this.#renderAll();
  }

  #scheduleSave() {
    clearTimeout(this.#save.timer);
    clearTimeout(this.#save.retryTimer);
    if (this.#save.state !== 'saving') this.#save.state = 'pending';
    this.#save.timer = setTimeout(() => this.#flushSave(), AUTOSAVE_MS);
    this.#renderStatus();
  }

  #flushSave() {
    clearTimeout(this.#save.timer);
    if (this.#save.inFlight) {
      this.#save.again = true;
      return;
    }
    this.#save.inFlight = true;
    this.#save.state = 'saving';
    this.#renderStatus();
    this.#bridge.emit('save-draft', { draft: toDraft(this.#booth) });
    clearTimeout(this.#save.guard);
    this.#save.guard = setTimeout(() => this.#onSaveResult({ ok: false, message: 'No answer from the site.' }), SAVE_TIMEOUT_MS);
    if (!this.#bridge.hasParent) setTimeout(() => this.#onSaveResult({ ok: true, savedAt: new Date().toISOString() }), 350);
  }

  #onSaveResult(m) {
    if (!this.#save.inFlight) return;
    clearTimeout(this.#save.guard);
    this.#save.inFlight = false;
    if (m.ok) {
      this.#save.retry = 0;
      this.#save.savedAt = m.savedAt ?? new Date().toISOString();
      this.#save.state = 'saved';
      if (this.#save.again) {
        this.#save.again = false;
        this.#flushSave();
      } else if (this.#pendingOpen) {
        this.#pendingOpen = false;
        this.#sendOpen();
      }
    } else {
      this.#save.retry += 1;
      this.#save.state = 'error';
      const wait = Math.min(30000, 1000 * 2 ** this.#save.retry);
      this.#save.retryTimer = setTimeout(() => this.#flushSave(), wait);
    }
    this.#renderStatus();
  }

  #open() {
    if (this.#save.state === 'pending' || this.#save.inFlight || this.#save.state === 'error') {
      this.#pendingOpen = true;
      this.#flushSave();
      this.#renderStatus();
      return;
    }
    this.#sendOpen();
  }

  #sendOpen() {
    this.#opening = this.#changeN;
    this.#renderStatus();
    this.#bridge.emit('open-booth', {});
    if (!this.#bridge.hasParent) setTimeout(() => this.#onOpenResult({ ok: true, openedAt: new Date().toISOString() }), 400);
  }

  #onOpenResult(m) {
    const sentAt = this.#opening;
    this.#opening = null;
    if (m.ok) {
      const wasNew = this.#meta.boothStatus !== 'live';
      this.#meta.boothStatus = 'live';
      this.#meta.hasUnopenedChanges = sentAt !== this.#changeN;
      this.#toast(wasNew ? 'Your booth is open! Shoppers can visit it now.' : 'Booth updated. Shoppers see your changes now.');
    } else {
      this.#toast(m.message || "Couldn't open your booth. Please try again.");
    }
    this.#renderStatus();
  }

  // ================================================================ uploads

  async #upload(kind, file) {
    if (!file || !/^image\//.test(file.type)) {
      this.#toast('Please choose a photo (JPEG or PNG).');
      return;
    }
    const requestId = `up${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.#toast('Preparing your photo...');
    let shrunk;
    try {
      shrunk = await downscaleFile(file);
    } catch (e) {
      this.#toast("Couldn't read that photo. Try another one.");
      return;
    }
    if (!shrunk) {
      this.#toast('That photo is too detailed to send. Try a smaller one.');
      return;
    }
    this.#pendingUploads.set(requestId, { kind, tileIn: uploadTileIn(shrunk.w, shrunk.h) });
    this.#toast('Uploading...');
    this.#bridge.emit('upload-texture', { requestId, kind, dataUrl: shrunk.dataUrl, fileName: file.name });
    if (!this.#bridge.hasParent) {
      setTimeout(() => this.#onUploadResult({ ok: true, requestId, upload: { id: requestId, kind, src: shrunk.dataUrl, approved: false } }), 400);
    }
  }

  #onUploadResult(m) {
    const pending = this.#pendingUploads.get(m.requestId);
    this.#pendingUploads.delete(m.requestId);
    if (!m.ok || !m.upload) {
      this.#toast(m.message || "Couldn't upload that photo. Please try again.");
      return;
    }
    const up = { ...m.upload, tileIn: m.upload.tileIn ?? pending?.tileIn };
    this.#uploads = [...this.#uploads.filter((u) => u.id !== up.id), up];
    this.#applyUpload(up);
    this.#toast(up.approved ? 'Uploaded.' : 'Uploaded! Only you can see it until GingersAttic approves it.');
  }

  #applyUpload(up) {
    const room = this.#booth.room;
    const base = { src: up.src, uploadId: up.id, mode: 'tile', scale: 1, tileIn: up.tileIn ?? { w: 24, h: 24 } };
    const next = up.kind === 'floor' ? { ...room, floor: base } : { ...room, wall: { type: 'wallpaper', ...base } };
    this.#commit({ ...this.#booth, room: next });
  }

  // ================================================================ items: add, edit, delete

  /** Send a request to the page and wait for its *-result (matched by requestId). */
  #request(type, payload, timeoutMs = 90000) {
    if (!this.#bridge.hasParent) return this.#simulate(type, payload);
    const requestId = `rq${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        this.#requests.delete(requestId);
        resolve({ ok: false, message: 'The site took too long to answer. Please try again.' });
      }, timeoutMs);
      this.#requests.set(requestId, (m) => {
        clearTimeout(t);
        resolve(m);
      });
      this.#bridge.emit(type, { requestId, ...payload });
    });
  }

  /** Standalone demo (no Wix page): answer requests locally so the whole flow can be tried. */
  async #simulate(type, p) {
    await new Promise((r) => setTimeout(r, 250));
    if (type === 'accept-agreement') return { ok: true };
    if (type === 'upload-item-image') return { ok: true, file: { id: `local-${++this.#simN}`, url: p.dataUrl } };
    if (type === 'delete-item') return { ok: true, itemId: p.itemId };
    if (type === 'submit-item') {
      const L = p.listing;
      const old = this.#booth.items.find((i) => i.id === p.itemId);
      const flat = L.mount === 'flat';
      const item = {
        ...(old ?? {}),
        id: old?.id ?? `new-${++this.#simN}`,
        title: L.title,
        description: L.description,
        price: L.price,
        quantity: L.quantity,
        category: L.category,
        condition: L.condition,
        era: L.era,
        eraNote: L.eraNote,
        mount: L.mount,
        dims: { h: L.heightIn, w: L.widthIn, d: L.depthIn },
        depthIn: L.depthIn,
        heightIn: flat ? undefined : L.heightIn,
        widthIn: L.widthIn,
        flat,
        weightLb: L.weightLb,
        shippingPrice: L.shippingPrice,
        image: L.cutout?.url ?? old?.image,
        aspect: L.cutout?.aspect ?? old?.aspect,
        photos: L.photos.map((x) => x.url),
        photoFiles: L.photos,
        status: old?.status === 'approved' ? 'approved' : 'pending',
        placement: old?.placement ?? null,
      };
      return { ok: true, item };
    }
    return { ok: false, message: 'Not available in the demo.' };
  }

  #openSheet(item = null) {
    if (!this.#sheet) {
      this.#sheet = new ItemSheet({
        host: this.#root.querySelector('.sheethost'),
        request: (type, payload) => this.#request(type, payload),
        toast: (t) => this.#toast(t),
        onSaved: (it, info) => this.#onItemSaved(it, info),
        onAgreed: () => {
          this.#meta.sellerAgreed = true;
        },
        // The editor is tall; ask the Wix page to scroll so the sheet (pinned to the top) is in view.
        onOpen: () => this.#bridge.emit('scroll-into-view', {}),
      });
    }
    this.#sheet.open({ item, agreed: !!this.#meta.sellerAgreed || !!this.#meta.agreedThisVisit });
  }

  #onItemSaved(item, { isNew, review }) {
    this.#meta.agreedThisVisit = true;
    const b = this.#booth;
    const old = b.items.find((i) => i.id === item.id);
    // The editor's placement (draft) wins over the one stored on the item row.
    const merged = old ? { ...item, placement: old.placement, sizeTweak: old.sizeTweak } : { ...item, placement: null };
    this.#booth = { ...b, items: old ? b.items.map((i) => (i.id === item.id ? merged : i)) : [...b.items, merged] };
    this.#tab = 'items';
    this.#renderAll();
    if (isNew) this.#toast('Sent for approval! It stays private until GingersAttic approves it; you can place it in your booth now.');
    else if (review === 'none') this.#toast('Saved. The new price and quantity are live.');
    else this.#toast('Saved. GingersAttic will check your changes.');
  }

  async #deleteItem(id) {
    const it = this.#booth.items.find((i) => i.id === id);
    if (!it) return;
    this.#confirmDel = null;
    const r = await this.#request('delete-item', { itemId: id });
    if (!r.ok) {
      this.#renderAll();
      this.#toast(r.message || "Couldn't remove that item. Please try again.");
      return;
    }
    if (this.#sel?.id === id) this.#sel = null;
    this.#booth = { ...this.#booth, items: this.#booth.items.filter((i) => i.id !== id) };
    this.#changed();
    this.#renderAll();
    this.#toast(it.status === 'approved' ? 'Taken down. It is no longer for sale.' : 'Item deleted.');
  }

  #itemBadge(it) {
    if (it.status === 'approved' && it.pendingEdit) return '<span class="ibadge sale">For sale</span><span class="ibadge wait">Edit waiting for approval</span>';
    const b = STATUS_BADGE[it.status];
    return b ? `<span class="ibadge ${b[0]}">${b[1]}</span>` : '';
  }

  #itemListHtml(items, { placeable = true } = {}) {
    const max = this.#meta.maxPlaced ?? ROOM.maxPlacedItems;
    const full = placedPieces(this.#booth) >= max;
    const boxed = boxedItemIds(this.#booth);
    return `<ul class="itemlist">${items
      .map((it) => {
        const inRoom = !!it.placement;
        const canDelete = it.status !== 'sold';
        const delLabel = it.status === 'approved' ? 'Take down' : 'Delete';
        const asking = this.#confirmDel === it.id;
        return `
        <li class="itemrow${!inRoom && placeable ? ' src' : ''}" ${!inRoom && placeable ? `data-src-kind="item" data-src-id="${esc(it.id)}"` : ''}>
          <span class="thumb"><img src="${esc(it.image)}" alt="" draggable="false"></span>
          <span class="txt"><span class="nm">${esc(it.title)}</span><span class="dim">${it.status === 'sold' ? 'Sold' : esc(money(it.price))}${boxed.has(it.id) ? ' &middot; in a collectibles box' : ''}</span>${this.#itemBadge(it)}
            <span class="rowacts">
              ${placeable && (inRoom || boxed.has(it.id)) ? `<button class="lnk" type="button" data-act="show-item" data-id="${esc(it.id)}">Show me</button>` : ''}
              ${it.status !== 'sold' ? `<button class="lnk" type="button" data-act="edit-item" data-id="${esc(it.id)}">Edit</button>` : ''}
              ${canDelete ? (asking
                ? `<button class="lnk danger" type="button" data-act="delete-item-yes" data-id="${esc(it.id)}">${delLabel}: are you sure?</button><button class="lnk" type="button" data-act="delete-item-no">Keep</button>`
                : `<button class="lnk" type="button" data-act="delete-item" data-id="${esc(it.id)}">${delLabel}</button>`) : ''}
            </span>
            ${it.status === 'rejected' && it.rejectionNote ? `<span class="rownote">GingersAttic: ${esc(it.rejectionNote)}</span>` : ''}
          </span>
          ${placeable
            ? inRoom || boxed.has(it.id)
              ? `<button class="mini" type="button" data-act="store" data-id="${esc(it.id)}">${inRoom ? 'Store' : 'Take out'}</button>`
              : `<button class="mini" type="button" data-act="place" data-id="${esc(it.id)}" ${full ? 'disabled' : ''}>Place</button>`
            : ''}
        </li>`;
      })
      .join('')}</ul>`;
  }

  // ================================================================ rendering

  #fail(text) {
    const ed = this.#root.querySelector('.ed');
    ed.className = 'ed loading';
    ed.innerHTML = `<p class="loadmsg" role="alert">${esc(text)}</p>`;
  }

  #onResize() {
    if (!this.#booth) return;
    const narrow = this.clientWidth > 0 && this.clientWidth < NARROW_EDIT_PX;
    if (narrow !== this.#narrow) {
      this.#narrow = narrow;
      this.#render();
    } else {
      paintSurfaces(this.#root, this.#booth, this.#lib);
    }
  }

  #render() {
    const ed = this.#root.querySelector('.ed');
    this.#narrow = this.clientWidth > 0 && this.clientWidth < NARROW_EDIT_PX;
    if (this.#narrow) {
      ed.className = 'ed narrowmode';
      const L = buildLayout(this.#booth, this.#lib);
      const items = this.#booth.items;
      ed.innerHTML = `
        <div class="narrowmsg">
          <h2>Arrange your booth on a computer or tablet</h2>
          <p>The booth editor needs a bigger screen to drag shelves and treasures around. You can add items from your phone: they wait in your storage crate until you place them.</p>
        </div>
        ${this.#itemsOn ? `<section class="narrowitems">
          <button class="primary additem" type="button" data-act="add-item">+ Add an item</button>
          ${items.length ? this.#itemListHtml(items, { placeable: false }) : '<p class="empty">No items yet.</p>'}
        </section>` : ''}
        <div class="roomframe"><div class="room viewonly">${roomInnerHtml(this.#booth, this.#lib, L)}</div></div>
        <div class="toast" role="status" aria-live="polite"></div>`;
      ed.querySelector('.narrowitems')?.addEventListener('click', (e) => this.#panelClick(e));
      paintSurfaces(this.#root, this.#booth, this.#lib);
      return;
    }
    ed.className = 'ed';
    ed.innerHTML = `
      <aside class="panel">
        <div class="brand"><span class="kicker">GingersAttic${this.#meta.memberName ? ` &middot; signed in as ${esc(this.#meta.memberName)}` : ''}</span><span class="title">${this.#booth.boothNumber ? `Your booth: No. ${esc(String(this.#booth.boothNumber))}` : 'Arrange your booth'}</span>${this.#booth.name ? `<span class="whose">${esc(this.#booth.name)}</span>` : ''}</div>
        <div class="panelbody">
          <nav class="tabs" role="tablist" aria-label="Booth editor tools">
            ${TABS.map((t) => `<button class="tab" role="tab" type="button" data-tab="${t.id}" aria-selected="false">${icon(t.icon)}<span>${t.label}</span></button>`).join('')}
          </nav>
          <div class="tabbody" role="tabpanel"></div>
        </div>
      </aside>
      <main class="stage">
        <div class="topbar">
          <div class="status" aria-live="polite"></div>
          <div class="acts">
            <button class="tb undo" type="button" title="Undo (Ctrl+Z)">&#8630; Undo</button>
            <button class="tb redo" type="button" title="Redo (Ctrl+Y)">&#8631; Redo</button>
            <button class="primary open" type="button"></button>
          </div>
        </div>
        <div class="roomframe"><div class="room edit" tabindex="0" aria-label="Your booth. Click something to select it, drag to move it, arrow keys to nudge."></div></div>
        <div class="selbar"></div>
      </main>
      <div class="overlay"></div>
      <div class="ghost" hidden></div>
      <div class="toast" role="status" aria-live="polite"></div>`;
    this.#wireStatic(ed);
    this.#renderAll();
  }

  #renderAll() {
    if (this.#narrow) {
      this.#render();
      return;
    }
    this.#renderTabs();
    this.#renderPanel();
    this.#renderRoom();
    this.#renderStatus();
    this.#renderSelbar();
    this.#renderOverlay();
    if (this.#boxSheet) this.#renderBoxSheet();
  }

  #renderTabs() {
    const wizTab = this.#wizard !== null ? this.#steps[this.#wizard].tab : null;
    this.#root.querySelectorAll('.tab').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.tab === this.#tab));
      b.classList.toggle('pulse', b.dataset.tab === wizTab);
    });
  }

  #layoutFor(booth) {
    return buildLayout(booth, this.#lib);
  }

  #renderRoom(booth = this.#booth, extra = {}) {
    const room = this.#root.querySelector('.room.edit');
    if (!room) return;
    const L = this.#layoutFor(booth);
    room.innerHTML = roomInnerHtml(booth, this.#lib, L, { edit: true, selectedId: this.#sel?.id, badIds: extra.badIds }) + '<div class="guide" hidden></div>';
    paintSurfaces(this.#root, booth, this.#lib);
  }

  /** Fast path during a drag: only the movable layer and the tags. */
  #renderLayer(booth, extra = {}) {
    const room = this.#root.querySelector('.room.edit');
    if (!room) return;
    const L = this.#layoutFor(booth);
    const opts = { edit: true, selectedId: this.#sel?.id, badIds: extra.badIds };
    room.querySelector('.layer').innerHTML = placeablesHtml(L, opts) + fixturesHtml(L, opts) + decorHtml(L, opts) + boxesHtml(L, opts) + itemsHtml(L, opts);
    room.querySelector('.tags').innerHTML = tagsHtml(L);
    const lamps = room.querySelector('.lamps');
    if (lamps) lamps.outerHTML = lampsHtml(L); // a lit lamp's glow follows it while it is dragged
    const guide = room.querySelector('.guide');
    if (guide) {
      const s = extra.guide && L.surfaces.find((x) => x.id === extra.guide);
      guide.hidden = !s || s.kind !== 'line';
      if (s && s.kind === 'line') Object.assign(guide.style, { left: `${pct(s.x1)}%`, top: `${pct(s.y)}%`, width: `${pct(s.x2 - s.x1)}%` });
    }
  }

  #renderStatus() {
    const st = this.#root.querySelector('.status');
    if (!st) return;
    const s = this.#save;
    let saveText;
    if (s.state === 'saving') saveText = 'Saving...';
    else if (s.state === 'pending') saveText = 'Unsaved changes';
    else if (s.state === 'error') saveText = "Couldn't save &ndash; retrying";
    else if (s.state === 'saved' && s.savedAt) saveText = `Draft saved ${esc(timeFmt(s.savedAt))}`;
    else saveText = 'All changes saved';
    const live = this.#meta.boothStatus === 'live';
    const unopened = this.#meta.hasUnopenedChanges;
    const chip = !live
      ? '<span class="chip off">Not open to shoppers yet</span>'
      : unopened
        ? '<span class="chip warn">Open &middot; you have changes shoppers can&rsquo;t see yet</span>'
        : '<span class="chip on">Open &middot; shoppers see this version</span>';
    st.innerHTML = `<span class="savedot ${s.state}"></span><span class="savetext">${saveText}</span>${chip}`;
    const open = this.#root.querySelector('.open');
    if (open) {
      const busy = this.#opening !== null || this.#pendingOpen;
      open.textContent = busy ? 'Opening...' : live ? (unopened ? 'Update booth' : 'Booth is up to date') : 'Open my booth';
      open.disabled = busy || (live && !unopened);
    }
    const u = this.#root.querySelector('.undo');
    const r = this.#root.querySelector('.redo');
    if (u) u.disabled = !this.#history.canUndo;
    if (r) r.disabled = !this.#history.canRedo;
  }

  // ---------------------------------------------------------------- panel

  #renderPanel() {
    const body = this.#root.querySelector('.tabbody');
    if (!body) return;
    const lib = this.#lib;
    const room = this.#booth.room;
    const html = {
      walls: () => this.#wallsHtml(lib, room),
      floor: () => this.#floorHtml(lib, room),
      light: () => this.#lightHtml(lib, room),
      fixtures: () => this.#fixturesPanelHtml(lib),
      decor: () => this.#decorPanelHtml(lib),
      items: () => this.#itemsPanelHtml(),
      sign: () => this.#signPanelHtml(),
    }[this.#tab]();
    const keep = body.dataset.tab === this.#tab ? body.scrollTop : 0; // same tab re-rendered: stay put
    body.innerHTML = html;
    body.scrollTop = keep;
    body.dataset.tab = this.#tab;
  }

  #texSwatches(list, cfg, act) {
    return `<div class="swatches">${list
      .map((t) => {
        const on = !cfg.src && cfg.type !== 'paint' && cfg.textureId === t.id;
        return `<button class="sw tex${on ? ' on' : ''}" type="button" data-act="${act}" data-id="${esc(t.id)}" aria-pressed="${on}" title="${esc(t.name)}" style="background-image:url('${esc(t.src)}')"><span>${esc(t.name)}</span></button>`;
      })
      .join('')}</div>`;
  }

  #uploadSection(kind, cfg) {
    const mine = this.#uploads.filter((u) => u.kind === kind);
    const current = cfg.src ? mine.find((u) => u.id === cfg.uploadId) ?? { approved: true } : null;
    return `
      <section>
        <h3>Your own ${kind === 'wall' ? 'wallpaper' : 'floor'}</h3>
        <label class="uploadbtn">${icon('<path d="M12 16V4 M7 9l5-5 5 5 M4 17v3h16v-3"/>')}<span>Upload a photo</span><input type="file" accept="image/*" data-act="upload" data-kind="${kind}"></label>
        ${mine.length ? `<div class="swatches">${mine.map((u) => `<button class="sw tex${cfg.uploadId === u.id ? ' on' : ''}" type="button" data-act="use-upload" data-id="${esc(u.id)}" style="background-image:url('${esc(u.src)}')"><span>${u.approved ? 'Your photo' : u.rejected ? 'Not approved' : 'Awaiting approval'}</span></button>`).join('')}</div>` : ''}
        ${current ? `
          <div class="seg" role="group" aria-label="How the photo fills the ${kind}">
            <button type="button" data-act="${kind}-mode" data-mode="tile" aria-pressed="${(cfg.mode ?? 'tile') === 'tile'}">Tile (repeat)</button>
            <button type="button" data-act="${kind}-mode" data-mode="fill" aria-pressed="${cfg.mode === 'fill'}">Fill (one photo)</button>
          </div>
          ${current.approved === false ? '<p class="note">Only you can see this photo until GingersAttic approves it. Shoppers see your last approved choice.</p>' : ''}` : ''}
      </section>`;
  }

  #scaleSection(kind, cfg) {
    if (cfg.type === 'paint' || cfg.mode === 'fill') return '';
    const v = Math.round((cfg.scale ?? 1) * 100);
    return `<section><h3>Pattern size</h3><div class="range"><input type="range" min="50" max="200" step="5" value="${v}" data-act="${kind}-scale" aria-label="Pattern size"><output>${v}%</output></div></section>`;
  }

  #wallsHtml(lib, room) {
    const wall = room.wall ?? {};
    const strips = lib.architecture.filter((a) => a.kind === 'strip');
    return `
      <p class="lede">Pick your back wall: wallpaper, paint or your own photo.</p>
      <section><h3>Wallpaper</h3>${this.#texSwatches(lib.wallpapers, wall, 'wallpaper')}</section>
      ${this.#scaleSection('wall', wall)}
      <section><h3>Paint</h3><div class="swatches paints">${lib.paints
        .map((p) => {
          const on = wall.type === 'paint' && wall.paintId === p.id;
          return `<button class="sw paint${on ? ' on' : ''}" type="button" data-act="paint" data-id="${esc(p.id)}" aria-pressed="${on}" title="${esc(p.name)}"><i style="background:${esc(p.color)}"></i><span>${esc(p.name)}</span></button>`;
        })
        .join('')}</div></section>
      ${this.#uploadSection('wall', wall)}
      ${strips.length ? `<section><h3>Trim &amp; moulding</h3><div class="toggles">${strips
        .map((s) => {
          const on = (room.architecture ?? []).includes(s.id);
          return `<button class="toggle${on ? ' on' : ''}" type="button" data-act="strip" data-id="${esc(s.id)}" aria-pressed="${on}"><i style="background:${esc(s.color ?? '#8a6a4a')}"></i>${esc(s.name)}</button>`;
        })
        .join('')}</div></section>` : ''}`;
  }

  #floorHtml(lib, room) {
    const floor = room.floor ?? {};
    return `
      <p class="lede">Lay your floor. Real sizes: one plank or tile is drawn at its true width.</p>
      <section><h3>Flooring</h3>${this.#texSwatches(lib.floors, floor, 'floor')}</section>
      ${this.#scaleSection('floor', floor)}
      ${this.#uploadSection('floor', floor)}`;
  }

  #lightHtml(lib, room) {
    const cur = room.light?.presetId ?? null;
    const k = Math.round((room.light?.intensity ?? 0.8) * 100);
    const decorDefs = byId(lib.decor);
    const lit = this.#booth.decor.filter((d) => d.lit === true && isLampDef(decorDefs[d.decorId])).length;
    return `
      <p class="lede">Optional. A soft light can set the mood; most booths look best with none.</p>
      <section><div class="lights">
        <button class="lightopt${cur === null ? ' on' : ''}" type="button" data-act="light" data-id="" aria-pressed="${cur === null}"><i class="none"></i><span>No lighting effect</span></button>
        ${lib.lights
          .map((l) => `<button class="lightopt${cur === l.id ? ' on' : ''}" type="button" data-act="light" data-id="${esc(l.id)}" aria-pressed="${cur === l.id}"><i style="background:${esc(l.wash)}, #e9dcc0"></i><span>${esc(l.name)}</span></button>`)
          .join('')}
      </div></section>
      ${cur ? `<section><h3>Strength</h3><div class="range"><input type="range" min="20" max="100" step="5" value="${k}" data-act="light-strength" aria-label="Lighting strength"><output>${k}%</output></div></section>` : ''}
      <section><h3>Lamps</h3><p class="note">Lamps from the Decor tab light up: click a lamp in your booth and use its On/Off switch.${lit ? ` ${lit} lamp${lit === 1 ? ' is' : 's are'} on.` : ''}</p></section>
      ${cur || lit ? `<section><h3>Light switch</h3><p class="note">Shoppers get a &#128161; Lights button in your booth to turn the lighting${lit ? ' and your lamps' : ''} on and off. Try it here:</p>
        <button class="toggle${this.#lightsOff ? '' : ' on'}" type="button" data-act="light-preview" aria-pressed="${!this.#lightsOff}">&#128161; Lights ${this.#lightsOff ? 'off' : 'on'}</button></section>` : ''}`;
  }

  #srcCard(kind, def, sub) {
    return `<button class="srccard" type="button" data-src-kind="${kind}" data-src-id="${esc(def.id)}" title="Click to add, or drag into your booth">
      <span class="thumb">${def.src ? `<img src="${esc(def.src)}" alt="" draggable="false">` : ''}</span>
      <span class="nm">${esc(def.name ?? def.id)}</span><span class="dim">${sub}</span></button>`;
  }

  #fixturesPanelHtml(lib) {
    const groups = FIXTURE_GROUPS.map(([cat, label]) => {
      const list = lib.fixtures.filter((f) => f.category === cat);
      if (!list.length) return '';
      return `<section><h3>${label}</h3><div class="srcgrid">${list.map((f) => this.#srcCard('fixture', f, `${inches(f.widthIn, f.heightIn)} &middot; ${f.mount === 'wall' ? 'on the wall' : 'on the floor'}`)).join('')}</div></section>`;
    }).join('');
    const placed = this.#booth.fixtures.length;
    const nb = this.#booth.boxes.length;
    const boxes = `<section><h3>Collectibles boxes</h3>
      <p class="note">For small things: a box with 2 &times; 2 up to 4 &times; 4 compartments, one item in each. Up to ${MAX_BOXES} boxes; each counts as one piece of your ${this.#meta.maxPlaced ?? ROOM.maxPlacedItems}. Shoppers click a box to see it up close.</p>
      <div class="srcgrid">${BOX_STYLES.map((st) => `<button class="srccard" type="button" data-src-kind="box" data-src-id="${st.id}" title="Click to add, or drag into your booth" ${nb >= MAX_BOXES ? 'disabled' : ''}>
        <span class="thumb">${miniBox(st.id, st.lining, 3, 3)}</span><span class="nm">${esc(st.name)}</span><span class="dim">shelf, table or floor</span></button>`).join('')}</div>
      <p class="foot">${nb} of ${MAX_BOXES} boxes in your booth</p></section>`;
    return `<p class="lede">Shelves and tables hold your items. Click to add one, or drag it into your booth. Drag it in the room to move it; anything on it moves too.</p>
      ${groups || '<p class="empty">No fixtures in the library yet.</p>'}
      ${boxes}
      <p class="foot">${placed} fixture${placed === 1 ? '' : 's'} in your booth</p>`;
  }

  #decorPanelHtml(lib) {
    const openings = lib.architecture.filter((a) => a.kind === 'placeable');
    const cats = [...new Set(lib.decor.map((d) => d.category))];
    return `<p class="lede">Decor is just for atmosphere: it's never for sale and has no price tag.</p>
      ${openings.length ? `<section><h3>Windows &amp; doors</h3><div class="srcgrid">${openings.map((a) => this.#srcCard('placeable', a, inches(a.widthIn, a.heightIn))).join('')}</div></section>` : ''}
      ${cats
        .map((c) => `<section><h3>${esc(c.charAt(0).toUpperCase() + c.slice(1))}</h3>${c === 'lighting' ? '<p class="note lampnote">Lamps start off. Click one in your booth to switch it on.</p>' : ''}<div class="srcgrid">${lib.decor
          .filter((d) => d.category === c)
          .map((d) => this.#srcCard('decor', d, `${+d.heightIn.toFixed(1)} in tall &middot; ${d.mount === 'wall' ? 'wall' : d.mount === 'floor' ? 'floor' : 'shelf or floor'}`))
          .join('')}</div></section>`)
        .join('')}
      ${!openings.length && !lib.decor.length ? '<p class="empty">More decor is on its way: plants, clocks, curtains and lamps.</p>' : ''}`;
  }

  #itemsPanelHtml() {
    const items = this.#booth.items;
    const boxed = boxedItemIds(this.#booth);
    const stored = items.filter((i) => !i.placement && !boxed.has(i.id));
    const placed = items.filter((i) => i.placement);
    const inBoxes = items.filter((i) => boxed.has(i.id));
    const max = this.#meta.maxPlaced ?? ROOM.maxPlacedItems;
    const pieces = placedPieces(this.#booth);
    const full = pieces >= max;
    const nb = this.#booth.boxes.length;
    return `
      ${this.#itemsOn ? '<button class="primary additem" type="button" data-act="add-item">+ Add an item</button>' : ''}
      <div class="count${full ? ' full' : ''}"><b>${pieces}</b> of ${max} pieces out in your booth${nb ? ` <small>(a collectibles box counts as one)</small>` : ''}</div>
      <section class="crate"><h3>${icon('<path d="M3 8h18v12H3z M3 8l3-4h12l3 4 M9 12h6"/>')} Storage crate <small>(${stored.length})</small></h3>
        ${stored.length ? this.#itemListHtml(stored) : items.length ? '<p class="empty">Your crate is empty: everything is out on display.</p>' : '<p class="empty">No items yet. Click "Add an item" to photograph your first one.</p>'}
        ${full && stored.length ? '<p class="note">Your booth is full. Store something to make room.</p>' : ''}
      </section>
      <section><h3>In your booth <small>(${placed.length})</small></h3>
        ${placed.length ? this.#itemListHtml(placed) : '<p class="empty">Nothing out yet. Drag items from the crate onto a shelf.</p>'}
      </section>
      ${inBoxes.length ? `<section><h3>In collectibles boxes <small>(${inBoxes.length})</small></h3>${this.#itemListHtml(inBoxes)}</section>` : ''}
      <p class="foot">${this.#itemsOn ? 'Items marked Private are only visible to you until GingersAttic approves them.' : 'Adding new items with photos and prices comes in the next update.'}</p>`;
  }

  #signPanelHtml() {
    const b = this.#booth;
    const cur = b.room?.sign?.style ?? 'wood';
    return `
      <p class="lede">Your sign hangs at the top of your booth, and your name and note show above it.</p>
      <form class="signform">
        <label>Booth name<input name="name" maxlength="40" required value="${esc(b.name ?? '')}"></label>
        <label>A short note about your booth<textarea name="about" maxlength="160" rows="3">${esc(b.about ?? '')}</textarea></label>
        <fieldset><legend>Sign style</legend><div class="signstyles">${SIGN_STYLES.map(
          (s) => `<label class="signopt"><input type="radio" name="signStyle" value="${s.id}" ${cur === s.id ? 'checked' : ''}><span class="signchip style-${s.id}">${esc(s.name)}</span></label>`,
        ).join('')}</div></fieldset>
        <button class="primary" type="submit">Save sign</button>
      </form>`;
  }

  // ---------------------------------------------------------------- selection bar

  #selected() {
    const s = this.#sel;
    if (!s) return null;
    const b = this.#booth;
    if (s.kind === 'item') {
      const it = b.items.find((i) => i.id === s.id);
      if (!it?.placement) return null;
      const scale = it.sizeTweak ?? it.placement.scaleAdj ?? 1;
      const drawn = itemSizeIn(it, scale);
      return { ...s, name: it.title, img: it.image, scale, range: tweakRange(it), dims: `shown ${inches(drawn.w, drawn.h)}` };
    }
    if (s.kind === 'decor') {
      const d = b.decor.find((x) => x.id === s.id);
      const def = d && byId(this.#lib.decor)[d.decorId];
      if (!def) return null;
      const shape = { heightIn: def.heightIn, widthIn: def.widthIn, aspect: def.aspect, flat: def.mount === 'flat', mount: def.mount };
      return { ...s, name: def.name, img: def.src, scale: d.placement?.scaleAdj ?? 1, range: tweakRange(shape), lamp: isLampDef(def), lit: d.lit === true };
    }
    if (s.kind === 'box') {
      const bx = (b.boxes ?? []).find((x) => x.id === s.id);
      if (!bx) return null;
      const n = bx.slots.filter(Boolean).length;
      return { ...s, name: styleOf(bx.style).name, box: bx, dims: `${bx.cols} &times; ${bx.rows} &middot; ${n} of ${bx.slots.length} filled` };
    }
    if (s.kind === 'fixture') {
      const f = b.fixtures.find((x) => x.id === s.id);
      const def = f && byId(this.#lib.fixtures)[f.fixtureId];
      return def ? { ...s, name: def.name, img: def.src, dims: inches(def.widthIn, def.heightIn) } : null;
    }
    if (s.kind === 'placeable') {
      const p = b.room.placeables.find((x) => x.id === s.id);
      const def = p && byId(this.#lib.architecture)[p.archId];
      return def ? { ...s, name: def.name, img: def.src, dims: inches(def.widthIn, def.heightIn) } : null;
    }
    return null;
  }

  #renderSelbar() {
    const bar = this.#root.querySelector('.selbar');
    if (!bar) return;
    const s = this.#selected();
    if (!s) {
      this.#sel = null;
      bar.className = 'selbar idle';
      bar.innerHTML = `<span class="hint">Click anything in your booth to select it &middot; drag to move &middot; arrow keys nudge &middot; <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes</span>`;
      return;
    }
    const sizable = s.kind === 'item' || s.kind === 'decor';
    // The slider offers only the sizes this thing can be drawn at (real size +/-20 %, 4 in minimum, room-sized maximum).
    const lo = Math.ceil((s.range?.lo ?? 0.8) * 100 - 1e-6);
    const hi = Math.floor((s.range?.hi ?? 1.2) * 100 + 1e-6);
    const pctv = Math.min(hi, Math.max(lo, Math.round((s.scale ?? 1) * 100)));
    const fixed = hi - lo < 1;
    const why = fixed ? (lo >= 100 ? 'Shown at the smallest size that can be seen' : 'Shown at the largest size that fits the room') : 'Size';
    bar.className = 'selbar';
    bar.innerHTML = `
      <span class="thumb">${s.box ? miniBox(s.box.style, s.box.lining, s.box.cols, s.box.rows) : s.img ? `<img src="${esc(s.img)}" alt="">` : ''}</span>
      <span class="selname"><b>${esc(s.name)}</b>${s.dims ? `<small>${s.dims}</small>` : ''}</span>
      ${s.lamp ? `<button class="lampswitch" type="button" role="switch" aria-checked="${s.lit}" data-act="lamp-toggle" title="Switch this lamp on or off"><span class="track" aria-hidden="true"><span class="knob"></span></span><span class="lbl">${s.lit ? 'On' : 'Off'}</span></button>` : ''}
      ${s.box ? '<button class="tb primaryish" type="button" data-act="box-fill">Fill the compartments</button>' : ''}
      ${sizable ? `<label class="range small" title="${why}">Size<input type="range" min="${lo}" max="${Math.max(hi, lo)}" step="1" value="${pctv}" data-act="sel-scale" aria-label="${why}" ${fixed ? 'disabled' : ''}><output>${pctv}%</output></label>` : ''}
      <span class="nudges" role="group" aria-label="Nudge">
        <button class="tb" type="button" data-act="nudge" data-dx="-1" data-dy="0" aria-label="Nudge left">&#9664;</button>
        ${s.kind === 'fixture' || s.kind === 'placeable' ? '<button class="tb" type="button" data-act="nudge" data-dx="0" data-dy="-1" aria-label="Nudge up">&#9650;</button><button class="tb" type="button" data-act="nudge" data-dx="0" data-dy="1" aria-label="Nudge down">&#9660;</button>' : ''}
        <button class="tb" type="button" data-act="nudge" data-dx="1" data-dy="0" aria-label="Nudge right">&#9654;</button>
      </span>
      ${s.kind === 'item'
        ? '<button class="tb" type="button" data-act="sel-store">Move to storage</button>'
        : `<button class="tb danger" type="button" data-act="sel-remove">Remove${s.kind === 'fixture' ? ' fixture' : s.kind === 'box' ? ' box' : ''}</button>`}
      <button class="tb" type="button" data-act="sel-done">Done</button>`;
  }

  // ---------------------------------------------------------------- wizard / coach marks

  #renderOverlay() {
    const ov = this.#root.querySelector('.overlay');
    if (!ov) return;
    if (this.#wizard !== null) {
      const i = this.#wizard;
      const step = this.#steps[i];
      const last = i === this.#steps.length - 1;
      ov.innerHTML = `
        <div class="bubble wizard${step.target === 'open' ? ' at-open' : ''}" role="dialog" aria-label="Booth setup guide">
          <div class="steps">${this.#steps.map((_, n) => `<span class="${n === i ? 'cur' : n < i ? 'done' : ''}"></span>`).join('')}</div>
          <p class="stepno">Step ${i + 1} of ${this.#steps.length}${step.soon ? ' &middot; <em>coming next</em>' : ''}</p>
          <h3>${esc(step.title)}</h3>
          <p>${esc(step.text)}</p>
          ${step.soon ? '<div class="soon">This part arrives in the next update.</div>' : ''}
          <div class="wbtns">
            ${i > 0 ? '<button class="wb alt" type="button" data-wiz="back">Back</button>' : ''}
            ${last
              ? `<button class="wb" type="button" data-wiz="open-now">${this.#meta.boothStatus === 'live' ? 'Update my booth' : 'Open my booth now'}</button><button class="wb alt" type="button" data-wiz="finish">I'll open it later</button>`
              : `<button class="wb" type="button" data-wiz="next">${step.soon ? 'Skip for now' : 'Next'}</button>`}
            ${last ? '' : '<button class="wb link" type="button" data-wiz="finish">Skip the tour</button>'}
          </div>
        </div>`;
      return;
    }
    if (this.#coach) {
      ov.innerHTML = `
        <div class="bubble coach c-tabs"><p>Pick wallpaper, floor, lighting, fixtures and decor here.</p></div>
        <div class="bubble coach c-room"><p>Drag anything in your booth to move it. Click it to resize, nudge or remove it.</p></div>
        <div class="bubble coach c-open"><p>Changes save as a draft. Shoppers see them once you update your booth.</p>
          <div class="wbtns"><button class="wb" type="button" data-coach="ok">Got it</button><button class="wb link" type="button" data-coach="never">Don't show again</button></div></div>`;
      return;
    }
    ov.innerHTML = '';
  }

  #wizardAction(a) {
    if (a === 'next') this.#wizard = Math.min(this.#steps.length - 1, this.#wizard + 1);
    else if (a === 'back') this.#wizard = Math.max(0, this.#wizard - 1);
    else if (a === 'finish' || a === 'open-now') {
      this.#wizard = null;
      this.#meta.isFirstVisit = false;
      this.#bridge.emit('wizard-done', {});
      if (a === 'open-now') this.#open();
      else this.#toast('You can come back to this any time. Open your booth when it looks right.');
    }
    if (this.#wizard !== null && this.#steps[this.#wizard].tab) this.#tab = this.#steps[this.#wizard].tab;
    this.#renderTabs();
    this.#renderPanel();
    this.#renderOverlay();
  }

  // ================================================================ interaction

  #wireStatic(ed) {
    ed.querySelector('.tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab');
      if (!b) return;
      this.#tab = b.dataset.tab;
      this.#renderTabs();
      this.#renderPanel();
    });
    const body = ed.querySelector('.tabbody');
    body.addEventListener('click', (e) => this.#panelClick(e));
    body.addEventListener('input', (e) => this.#panelInput(e, false));
    body.addEventListener('change', (e) => this.#panelInput(e, true));
    body.addEventListener('submit', (e) => this.#signSubmit(e));
    body.addEventListener('pointerdown', (e) => this.#panelPointerDown(e));
    ed.querySelector('.undo').addEventListener('click', () => this.#undo());
    ed.querySelector('.redo').addEventListener('click', () => this.#redo());
    ed.querySelector('.open').addEventListener('click', () => this.#open());
    const bar = ed.querySelector('.selbar');
    bar.addEventListener('click', (e) => this.#selbarClick(e));
    bar.addEventListener('input', (e) => this.#selScale(e, false));
    bar.addEventListener('change', (e) => this.#selScale(e, true));
    ed.querySelector('.overlay').addEventListener('click', (e) => {
      const w = e.target.closest('[data-wiz]');
      if (w) this.#wizardAction(w.dataset.wiz);
      const c = e.target.closest('[data-coach]');
      if (c) {
        if (c.dataset.coach === 'never') store.set(COACH_KEY, '1');
        this.#coach = false;
        this.#renderOverlay();
      }
    });
    const room = ed.querySelector('.room.edit');
    this.#lens = new Lens(ed);
    room.addEventListener('pointerover', (e) => {
      const el = e.target.closest?.('.item[data-kind="item"]');
      if (!el || this.#drag || e.pointerType === 'touch') return;
      const it = this.#booth.items.find((i) => i.id === el.dataset.id);
      if (it) this.#lens.show(el, { id: it.id, src: it.image, title: it.title, sub: it.status === 'sold' ? 'Sold' : money(it.price) });
    });
    room.addEventListener('pointerout', (e) => {
      if (e.target.closest?.('.item[data-kind="item"]') && !e.relatedTarget?.closest?.('.item[data-kind="item"]')) this.#lens.hide();
    });
    room.addEventListener('pointerdown', () => this.#lens.hide(), true);
    room.addEventListener('pointerdown', (e) => this.#roomPointerDown(e));
    room.addEventListener('pointermove', (e) => this.#roomPointerMove(e));
    room.addEventListener('pointerup', (e) => this.#roomPointerUp(e));
    room.addEventListener('pointercancel', () => this.#cancelDrag());
  }

  #setRoom(patch) {
    this.#commit({ ...this.#booth, room: { ...this.#booth.room, ...patch } });
  }

  #panelClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    const { act, id } = el.dataset;
    const room = this.#booth.room;
    switch (act) {
      case 'wallpaper':
        this.#setRoom({ wall: { type: 'wallpaper', textureId: id, mode: 'tile', scale: room.wall?.src ? 1 : room.wall?.scale ?? 1 } });
        break;
      case 'paint':
        this.#setRoom({ wall: { type: 'paint', paintId: id } });
        break;
      case 'floor':
        this.#setRoom({ floor: { textureId: id, mode: 'tile', scale: room.floor?.src ? 1 : room.floor?.scale ?? 1 } });
        break;
      case 'use-upload': {
        const up = this.#uploads.find((u) => u.id === id);
        if (up) this.#applyUpload(up);
        break;
      }
      case 'wall-mode':
        this.#setRoom({ wall: { ...room.wall, mode: el.dataset.mode } });
        break;
      case 'floor-mode':
        this.#setRoom({ floor: { ...room.floor, mode: el.dataset.mode } });
        break;
      case 'strip':
        this.#commit({ ...this.#booth, room: ops.toggleStrip(room, this.#lib, id) });
        break;
      case 'light':
        this.#setRoom({ light: id ? { presetId: id, intensity: room.light?.intensity ?? 0.8 } : null });
        break;
      case 'place':
        this.#autoPlace('item', id);
        break;
      case 'store':
        this.#commit(ops.storeItem(this.#booth, id).booth);
        break;
      case 'add-item':
        this.#openSheet(null);
        break;
      case 'show-item': {
        // Select an item from the list: handy when it sits behind something in the room.
        const inBox = boxOfItem(this.#booth, id);
        this.#sel = inBox ? { kind: 'box', id: inBox.boxId } : { kind: 'item', id };
        this.#renderAll();
        this.#root.querySelector('.room.edit')?.focus({ preventScroll: true });
        if (inBox) this.#openBoxSheet(inBox.boxId, inBox.slot);
        break;
      }
      case 'light-preview':
        this.#lightsOff = !this.#lightsOff;
        this.#root.querySelector('.room.edit')?.classList.toggle('lights-off', this.#lightsOff);
        this.#renderPanel();
        break;
      case 'edit-item': {
        const it = this.#booth.items.find((i) => i.id === id);
        if (it) this.#openSheet(it);
        break;
      }
      case 'delete-item':
        this.#confirmDel = id;
        if (this.#narrow) this.#render();
        else this.#renderPanel();
        break;
      case 'delete-item-no':
        this.#confirmDel = null;
        if (this.#narrow) this.#render();
        else this.#renderPanel();
        break;
      case 'delete-item-yes':
        this.#deleteItem(id);
        break;
      default:
        break;
    }
  }

  #panelInput(e, final) {
    const el = e.target;
    const act = el.dataset?.act;
    if (!act) return;
    if (act === 'upload') {
      if (!final) return; // file inputs fire input then change; act once, on change
      const file = el.files?.[0];
      el.value = '';
      if (file) this.#upload(el.dataset.kind, file);
      return;
    }
    const out = el.parentElement?.querySelector('output');
    if (out) out.textContent = `${el.value}%`;
    const v = Number(el.value) / 100;
    const room = this.#booth.room;
    let patch = null;
    if (act === 'wall-scale') patch = { wall: { ...room.wall, scale: v } };
    else if (act === 'floor-scale') patch = { floor: { ...room.floor, scale: v } };
    else if (act === 'light-strength') patch = { light: { ...room.light, intensity: v } };
    if (!patch) return;
    if (final) this.#setRoom(patch);
    else {
      // live preview while sliding; committed on change
      this.#booth = { ...this.#booth, room: { ...room, ...patch } };
      if (act === 'light-strength') this.#renderRoom();
      else paintSurfaces(this.#root, this.#booth, this.#lib);
    }
  }

  #signSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = String(fd.get('name') || '').trim().slice(0, 40);
    if (!name) {
      this.#toast('Your booth needs a name.');
      return;
    }
    const about = String(fd.get('about') || '').trim().slice(0, 160);
    const signStyle = String(fd.get('signStyle') || 'wood');
    this.#booth = { ...this.#booth, name, about };
    this.#commit({ ...this.#booth, room: { ...this.#booth.room, sign: { ...(this.#booth.room.sign ?? {}), style: signStyle } } });
    this.#bridge.emit('save-info', { name, about, signStyle });
    if (!this.#bridge.hasParent) setTimeout(() => this.#onMessage({ type: 'info-result', ok: true }), 300);
  }

  #selbarClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    const s = this.#sel;
    if (!s) return;
    switch (el.dataset.act) {
      case 'nudge':
        this.#nudge(Number(el.dataset.dx), Number(el.dataset.dy), 0.5);
        break;
      case 'sel-store':
        this.#sel = null;
        this.#commit(ops.storeItem(this.#booth, s.id).booth);
        this.#toast('Moved to your storage crate.');
        break;
      case 'sel-remove':
        this.#removeSelected();
        break;
      case 'box-fill':
        this.#openBoxSheet(s.id);
        break;
      case 'lamp-toggle':
        this.#setLampLit(s.id, el.getAttribute('aria-checked') !== 'true');
        break;
      case 'sel-done':
        this.#sel = null;
        this.#renderAll();
        break;
      default:
        break;
    }
  }

  /** The selected lamp's On/Off switch. Saved on the decor entry as `lit` (autosaved with the draft). */
  #setLampLit(id, lit) {
    const r = ops.setDecorLit(this.#booth, this.#lib, id, lit);
    if (!r.ok) return;
    if (lit && this.#lightsOff) {
      // The Lighting tab's preview had the lights off; show the lamp the seller just switched on.
      this.#lightsOff = false;
      this.#root.querySelector('.room.edit')?.classList.remove('lights-off');
    }
    this.#commit(r.booth);
  }

  #selScale(e, final) {
    const el = e.target;
    if (el.dataset?.act !== 'sel-scale' || !this.#sel) return;
    const out = el.parentElement.querySelector('output');
    if (out) out.textContent = `${el.value}%`;
    const v = Number(el.value) / 100;
    const r = this.#sel.kind === 'item' ? ops.setItemScale(this.#booth, this.#lib, this.#sel.id, v) : ops.setDecorScale(this.#booth, this.#lib, this.#sel.id, v);
    // A size that doesn't fit here is clamped to the largest that does (r.limited), so nothing snaps back.
    if (r.ok && out) out.textContent = `${Math.round(r.tweak * 100)}%`;
    if (!final) {
      this.#renderLayer(r.ok ? r.booth : this.#booth);
      return;
    }
    if (r.ok) {
      const hadFocus = this.#root.activeElement === el;
      this.#commit(r.booth);
      // The selection bar was redrawn: keep the keyboard on the slider so arrow keys keep working.
      if (hadFocus) this.#root.querySelector('.selbar input[data-act="sel-scale"]')?.focus();
      if (r.limited) this.#toast("That's as big as it fits here. Move it somewhere roomier to make it bigger.");
    } else {
      this.#toast(ops.reasonFor(r.errors));
      this.#renderAll();
    }
  }

  #removeSelected() {
    const s = this.#sel;
    if (!s) return;
    this.#sel = null;
    if (s.kind === 'item') {
      this.#commit(ops.storeItem(this.#booth, s.id).booth);
      this.#toast('Moved to your storage crate.');
    } else if (s.kind === 'decor') this.#commit(ops.removeDecor(this.#booth, s.id).booth);
    else if (s.kind === 'box') {
      const r = ops.removeBox(this.#booth, s.id);
      this.#commit(r.booth);
      if (r.freedIds.length) this.#toast(`Box removed. ${r.freedIds.length} item${r.freedIds.length === 1 ? '' : 's'} went back to your storage crate.`);
    }
    else if (s.kind === 'placeable') this.#commit(ops.removePlaceable(this.#booth, s.id).booth);
    else if (s.kind === 'fixture') {
      const r = ops.deleteFixture(this.#booth, s.id);
      this.#commit(r.booth);
      if (r.storedIds.length) this.#toast(`${r.storedIds.length} item${r.storedIds.length === 1 ? '' : 's'} on it went back to your storage crate${r.removedBoxIds.length ? ' (with the collectibles box on it removed)' : ''}.`);
    }
  }

  // ---------------------------------------------------------------- moving things

  /** Where a selected thing is now, for drags and nudges. */
  #origin(kind, id) {
    const b = this.#booth;
    if (kind === 'item') {
      const it = b.items.find((i) => i.id === id);
      return it?.placement ? ops.anchorOf(it.placement, ops.sizeOfItem(it)) : null;
    }
    if (kind === 'decor') {
      const L = this.#layoutFor(b);
      const e = L.decor.find((d) => d.decor.id === id);
      return e ? { x: e.x + e.size.w / 2, y: e.y } : null;
    }
    if (kind === 'fixture') {
      const f = b.fixtures.find((x) => x.id === id);
      return f ? { x: f.x, y: f.y } : null;
    }
    if (kind === 'placeable') {
      const p = b.room.placeables.find((x) => x.id === id);
      return p ? { x: p.x, y: p.y } : null;
    }
    if (kind === 'box') {
      const e = this.#layoutFor(b).boxes.find((x) => x.box.id === id);
      return e ? { x: e.x + e.size.w / 2, y: e.y } : null;
    }
    return null;
  }

  /** Try moving `kind/id` from its origin by (dx, dy) inches. */
  #moveBy(kind, id, o, dx, dy) {
    const b = this.#booth;
    const lib = this.#lib;
    if (kind === 'item') return ops.placeItem(b, lib, id, { x: o.x + dx, y: o.y + dy });
    if (kind === 'decor') {
      const d = b.decor.find((x) => x.id === id);
      return ops.placeDecor(b, lib, d.decorId, { x: o.x + dx, y: o.y + dy }, id);
    }
    if (kind === 'fixture') return ops.moveFixtureTo(b, lib, id, { x: o.x + dx, y: o.y + dy });
    if (kind === 'box') return ops.placeBox(b, lib, id, { x: o.x + dx, y: o.y + dy });
    if (kind === 'placeable') {
      const p = b.room.placeables.find((x) => x.id === id);
      return ops.placePlaceable(b, lib, p.archId, { x: o.x + dx, y: o.y + dy }, id);
    }
    return { ok: false, booth: b, errors: [{ code: 'UNKNOWN' }] };
  }

  #nudge(sx, sy, step) {
    const s = this.#sel;
    if (!s) return;
    const o = this.#origin(s.kind, s.id);
    if (!o) return;
    const vertical = s.kind === 'fixture' || s.kind === 'placeable';
    const r = this.#moveBy(s.kind, s.id, o, sx * step, vertical ? sy * step : 0);
    if (r.ok) this.#commit(r.booth);
    else this.#toast(ops.reasonFor(r.errors));
  }

  #pointerIn(e) {
    const room = this.#root.querySelector('.room.edit');
    const r = room.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * ROOM.widthIn, y: ((e.clientY - r.top) / r.height) * ROOM.heightIn, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom, ppi: r.width / ROOM.widthIn };
  }

  #roomPointerDown(e) {
    if (e.button !== 0) return;
    const el = e.target.closest('[data-kind]');
    const room = e.currentTarget;
    room.focus({ preventScroll: true });
    if (!el) {
      if (this.#sel) {
        this.#sel = null;
        this.#renderRoom();
        this.#renderSelbar();
      }
      return;
    }
    e.preventDefault();
    const kind = el.dataset.kind;
    const id = el.dataset.id;
    const o = this.#origin(kind, id);
    if (!o) return;
    room.setPointerCapture(e.pointerId);
    const p = this.#pointerIn(e);
    this.#drag = { kind, id, o, start: p, startClient: { x: e.clientX, y: e.clientY }, moved: false, result: null };
    if (this.#sel?.id !== id) {
      this.#sel = { kind, id };
      this.#renderLayer(this.#booth);
      this.#renderSelbar();
    }
  }

  #roomPointerMove(e) {
    const d = this.#drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startClient.x, e.clientY - d.startClient.y) < DRAG_START_PX) return;
    d.moved = true;
    const p = this.#pointerIn(e);
    d.last = { dx: p.x - d.start.x, dy: p.y - d.start.y, px: { x: e.clientX - d.startClient.x, y: e.clientY - d.startClient.y } };
    if (this.#raf) return;
    this.#raf = requestAnimationFrame(() => {
      this.#raf = 0;
      if (this.#drag) this.#dragPreview(this.#drag.kind, this.#drag.id, this.#drag.last.dx, this.#drag.last.dy, this.#drag.last.px);
    });
  }

  /** Show where a dragged thing would land (snapped), or follow the pointer in red when it can't land there. */
  #dragPreview(kind, id, dx, dy, px = null) {
    const d = this.#drag ?? { kind, id, o: this.#origin(kind, id) };
    if (!d.o) return;
    const r = this.#moveBy(kind, id, d.o, dx, dy);
    d.result = r;
    const room = this.#root.querySelector('.room.edit');
    room.classList.add('dragging');
    let guide = null;
    if (r.ok && (kind === 'item' || kind === 'decor' || kind === 'box')) {
      const list = kind === 'item' ? r.booth.items : kind === 'box' ? r.booth.boxes : r.booth.decor;
      guide = list.find((x) => x.id === id)?.placement?.surfaceId ?? null;
    }
    this.#renderLayer(r.ok ? r.booth : this.#booth, { badIds: r.ok ? null : new Set([id]), guide });
    const el = room.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (el) {
      el.classList.add('lifted');
      if (!r.ok) {
        const ppi = room.getBoundingClientRect().width / ROOM.widthIn;
        const off = px ?? { x: dx * ppi, y: dy * ppi };
        el.style.transform = `translate(${off.x}px, ${off.y}px)`;
      }
    }
  }

  #roomPointerUp(e) {
    const d = this.#drag;
    if (!d) return;
    this.#drag = null;
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    e.currentTarget.classList.remove('dragging');
    if (!d.moved) {
      this.#renderRoom();
      return;
    }
    const p = this.#pointerIn(e);
    const r = this.#moveBy(d.kind, d.id, d.o, p.x - d.start.x, p.y - d.start.y);
    if (r.ok) this.#commit(r.booth);
    else {
      this.#toast(ops.reasonFor(r.errors));
      this.#renderRoom();
    }
  }

  #cancelDrag() {
    if (!this.#drag) return;
    this.#drag = null;
    this.#root.querySelector('.room.edit')?.classList.remove('dragging');
    this.#renderRoom();
  }

  // ---------------------------------------------------------------- adding from the panel

  #panelPointerDown(e) {
    const src = e.target.closest('[data-src-kind]');
    if (!src || e.button !== 0 || e.target.closest('[data-act]')) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const kind = src.dataset.srcKind;
    const id = src.dataset.srcId;
    const img = src.querySelector('img')?.getAttribute('src') ?? '';
    const ghost = this.#root.querySelector('.ghost');
    let moved = false;
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_START_PX) return;
      if (!moved) {
        moved = true;
        ghost.innerHTML = img ? `<img src="${esc(img)}" alt="">` : '';
        ghost.className = `ghost kind-${kind}`;
        ghost.hidden = false;
      }
      ghost.style.left = `${ev.clientX}px`;
      ghost.style.top = `${ev.clientY}px`;
      const p = this.#pointerIn(ev);
      this.#root.querySelector('.room.edit')?.classList.toggle('dropping', p.inside);
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      ghost.hidden = true;
      this.#root.querySelector('.room.edit')?.classList.remove('dropping');
      if (!moved) {
        this.#autoPlace(kind, id);
        return;
      }
      const p = this.#pointerIn(ev);
      if (p.inside) this.#dropAt(kind, id, p);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  #dropAt(kind, id, p) {
    const b = this.#booth;
    const lib = this.#lib;
    let r;
    if (kind === 'item') r = ops.placeItem(b, lib, id, { x: p.x, y: p.y });
    else if (kind === 'decor') r = ops.placeDecor(b, lib, id, { x: p.x, y: p.y });
    else if (kind === 'box') r = ops.addBox(b, lib, id, { x: p.x, y: p.y });
    else if (kind === 'fixture') {
      const def = byId(lib.fixtures)[id];
      r = ops.addFixture(b, lib, id, { x: p.x - def.widthIn / 2, y: p.y - def.heightIn / 2 });
    } else if (kind === 'placeable') {
      const def = byId(lib.architecture)[id];
      r = ops.placePlaceable(b, lib, id, { x: p.x - def.widthIn / 2, y: p.y + def.heightIn / 2 });
    }
    this.#finishAdd(kind, id, r);
  }

  #autoPlace(kind, id) {
    const b = this.#booth;
    const lib = this.#lib;
    let r;
    if (kind === 'item') {
      r = ops.autoPlaceItem(b, lib, id); // a spot that hides nothing, when there is one
    } else if (kind === 'decor') {
      const def = byId(lib.decor)[id];
      const mount = def?.mount === 'floor' ? 'floor' : def?.mount;
      r = ops.firstThatFits(ops.autoDrops(b, lib, mount), (d) => ops.placeDecor(b, lib, id, d));
    } else if (kind === 'fixture') r = ops.addFixture(b, lib, id);
    else if (kind === 'box') r = ops.addBox(b, lib, id);
    else if (kind === 'placeable') r = ops.placePlaceable(b, lib, id, null);
    this.#finishAdd(kind, id, r);
  }

  #finishAdd(kind, srcId, r) {
    if (!r || !r.ok) {
      this.#toast(ops.reasonFor(r?.errors));
      return;
    }
    const newId = kind === 'item' ? srcId : r.id;
    this.#sel = { kind, id: newId };
    this.#commit(r.booth);
  }

  // ---------------------------------------------------------------- keyboard

  // ---------------------------------------------------------------- collectibles box: fill the compartments

  #openBoxSheet(boxId, slot = null) {
    const bx = this.#booth.boxes.find((b) => b.id === boxId);
    if (!bx) return;
    const firstEmpty = bx.slots.indexOf(null);
    this.#boxSheet = { boxId, slot: slot ?? (firstEmpty >= 0 ? firstEmpty : 0) };
    this.#lens?.hide();
    this.#renderBoxSheet();
    this.#root.querySelector('.boxhost .sheetcard')?.focus({ preventScroll: true });
    this.#bridge.emit('scroll-into-view', {}); // like the item sheet: the page scrolls the editor into view
  }

  #closeBoxSheet() {
    this.#boxSheet = null;
    this.#root.querySelector('.boxhost').innerHTML = '';
    this.#root.querySelector('.room.edit')?.focus({ preventScroll: true });
  }

  #renderBoxSheet() {
    const host = this.#root.querySelector('.boxhost');
    const st = this.#boxSheet;
    const bx = st && this.#booth.boxes.find((b) => b.id === st.boxId);
    if (!bx) {
      this.#boxSheet = null;
      host.innerHTML = '';
      return;
    }
    const keep = { list: host.querySelector('.bxitems')?.scrollTop ?? 0, body: host.querySelector('.sheetbody')?.scrollTop ?? 0 };
    st.slot = Math.min(Math.max(0, st.slot), bx.slots.length - 1);
    const byIdMap = new Map(this.#booth.items.map((i) => [i.id, i]));
    const boxNo = (id) => this.#booth.boxes.findIndex((b) => b.id === id) + 1;
    const where = (it) => {
      const ib = boxOfItem(this.#booth, it.id);
      if (ib) return ib.boxId === bx.id ? `In this box, compartment ${ib.slot + 1}` : `In collectibles box ${boxNo(ib.boxId)}`;
      return it.placement ? 'Out in your booth' : 'In your storage crate';
    };
    // Smallest things first: they're what boxes are for.
    const realH = (it) => it.heightIn ?? it.dims?.h ?? 999;
    const choices = this.#booth.items.filter((i) => i.status !== 'sold').sort((a, b) => realH(a) - realH(b));
    const dimOpts = (cur) => Array.from({ length: BOX_GRID_MAX - BOX_GRID_MIN + 1 }, (_, i) => BOX_GRID_MIN + i).map((n) => `<option value="${n}"${n === cur ? ' selected' : ''}>${n}</option>`).join('');
    const current = bx.slots[st.slot] ? byIdMap.get(bx.slots[st.slot]) : null;
    host.innerHTML = `
      <div class="sheet boxsheet" role="dialog" aria-modal="true" aria-labelledby="bx-title">
        <div class="sheetcard" tabindex="-1">
          <header class="sheethead"><h2 id="bx-title">${esc(styleOf(bx.style).name)}: fill the compartments</h2><button class="sheetx" type="button" data-bx="close" aria-label="Close">&times;</button></header>
          <div class="sheetbody">
            <div class="bxcols">
              <div class="bxleft">
                <div class="bvbox bxgrid style-${esc(styleOf(bx.style).id)}" style="grid-template-columns:repeat(${bx.cols},1fr);--lining:${esc(liningOf(bx.lining).color)}">
                  ${bx.slots
                    .map((id, i) => {
                      const it = id ? byIdMap.get(id) : null;
                      return `<div class="bxcellwrap"><button class="bxcell${i === st.slot ? ' sel' : ''}" type="button" data-bx-slot="${i}" aria-pressed="${i === st.slot}" aria-label="Compartment ${i + 1}: ${it ? esc(it.title) : 'empty'}">${it ? `<img src="${esc(it.image)}" alt="">` : `<span>${i + 1}</span>`}</button>${it ? `<button class="bxclear" type="button" data-bx-clear="${i}" aria-label="Empty compartment ${i + 1}" title="Empty it (the item goes back to your crate)">&times;</button>` : ''}</div>`;
                    })
                    .join('')}
                </div>
                <p class="hint">Pick a compartment, then the item to put in it. One item per compartment; the &times; puts it back in your crate.</p>
              </div>
              <div class="bxright">
                <fieldset class="bxfs"><legend>Style</legend><div class="seg">${BOX_STYLES.map((o) => `<button type="button" data-bx-style="${o.id}" aria-pressed="${bx.style === o.id}">${esc(o.name)}</button>`).join('')}</div></fieldset>
                <fieldset class="bxfs"><legend>Lining</legend><div class="linings">${BOX_LININGS.map((l) => `<button type="button" class="lining${bx.lining === l.id ? ' on' : ''}" data-bx-lining="${l.id}" aria-pressed="${bx.lining === l.id}" title="${esc(l.name)}" aria-label="${esc(l.name)}"><i style="background:${l.color}"></i></button>`).join('')}</div></fieldset>
                <fieldset class="bxfs"><legend>Compartments</legend><div class="bxdims"><label>Across<select data-bx-dim="cols">${dimOpts(bx.cols)}</select></label><span aria-hidden="true">&times;</span><label>Down<select data-bx-dim="rows">${dimOpts(bx.rows)}</select></label></div></fieldset>
                <h3 class="bxh">Put in compartment ${st.slot + 1}${current ? ` <small>(now: ${esc(current.title)})</small>` : ''}</h3>
                <ul class="bxitems">${
                  choices
                    .map((it) => `<li><button type="button" class="bxitem${bx.slots[st.slot] === it.id ? ' here' : ''}" data-bx-item="${esc(it.id)}"><span class="thumb"><img src="${esc(it.image)}" alt=""></span><span class="txt"><span class="nm">${esc(it.title)}</span><span class="dim">${esc(where(it))}</span></span></button></li>`)
                    .join('') || '<li class="empty">No items yet. Add some on the My Items tab.</li>'
                }</ul>
              </div>
            </div>
            <div class="sheetbtns"><button class="primary" type="button" data-bx="close">Done</button></div>
          </div>
        </div>
      </div>`;
    const list = host.querySelector('.bxitems');
    if (list) list.scrollTop = keep.list;
    const body = host.querySelector('.sheetbody');
    if (body) body.scrollTop = keep.body;
  }

  #boxSheetClick(e) {
    const t = e.target;
    if (t.classList?.contains('boxsheet') || t.closest('[data-bx="close"]')) {
      this.#closeBoxSheet();
      return;
    }
    const st = this.#boxSheet;
    if (!st) return;
    const slotBtn = t.closest('[data-bx-slot]');
    if (slotBtn) {
      st.slot = Number(slotBtn.dataset.bxSlot);
      this.#renderBoxSheet();
      this.#root.querySelector(`.boxhost [data-bx-slot="${st.slot}"]`)?.focus();
      return;
    }
    const clear = t.closest('[data-bx-clear]');
    if (clear) {
      const r = ops.clearBoxSlot(this.#booth, st.boxId, Number(clear.dataset.bxClear));
      if (r.ok) this.#commit(r.booth);
      return;
    }
    const style = t.closest('[data-bx-style]');
    if (style) {
      this.#commit(ops.setBoxLook(this.#booth, st.boxId, { style: style.dataset.bxStyle }).booth);
      return;
    }
    const lining = t.closest('[data-bx-lining]');
    if (lining) {
      this.#commit(ops.setBoxLook(this.#booth, st.boxId, { lining: lining.dataset.bxLining }).booth);
      return;
    }
    const pick = t.closest('[data-bx-item]');
    if (pick) {
      const itemId = pick.dataset.bxItem;
      const r = ops.assignToBox(this.#booth, st.boxId, st.slot, itemId);
      if (!r.ok) {
        this.#toast(ops.reasonFor(r.errors));
        return;
      }
      const bx = r.booth.boxes.find((b) => b.id === st.boxId);
      const after = bx.slots.findIndex((x, i) => !x && i > st.slot);
      const any = bx.slots.indexOf(null);
      if (after >= 0) st.slot = after;
      else if (any >= 0) st.slot = any;
      if (this.#sel?.kind === 'item' && this.#sel.id === itemId) this.#sel = null; // it left the room
      this.#commit(r.booth);
      if (r.freedIds.length) {
        const gone = this.#booth.items.find((i) => i.id === r.freedIds[0]);
        this.#toast(`${gone?.title ?? 'The item'} went back to your storage crate.`);
      }
    }
  }

  #boxSheetChange(e) {
    const dim = e.target.dataset?.bxDim;
    const st = this.#boxSheet;
    if (!dim || !st) return;
    const bx = this.#booth.boxes.find((b) => b.id === st.boxId);
    if (!bx) return;
    const cols = dim === 'cols' ? Number(e.target.value) : bx.cols;
    const rows = dim === 'rows' ? Number(e.target.value) : bx.rows;
    const r = ops.setBoxGrid(this.#booth, this.#lib, st.boxId, cols, rows);
    if (!r.ok) {
      this.#toast(`That size doesn't fit where the box is. ${ops.reasonFor(r.errors)}`);
      this.#renderBoxSheet();
      return;
    }
    this.#commit(r.booth);
    if (r.freedIds.length) this.#toast(`${r.freedIds.length} item${r.freedIds.length === 1 ? '' : 's'} went back to your storage crate.`);
  }

  #onKey(e) {
    if (this.#narrow || !this.#booth) return;
    if (this.#boxSheet) {
      // The box sheet is open: Escape closes it; nothing else moves things in the room behind it.
      if (e.key === 'Escape') this.#closeBoxSheet();
      return;
    }
    const t = e.composedPath()[0];
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !typing && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.#redo();
      else this.#undo();
      return;
    }
    if (mod && !typing && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.#redo();
      return;
    }
    if (typing || !this.#sel) return;
    const step = e.shiftKey ? 2 : 0.5;
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dirs[e.key]) {
      e.preventDefault();
      this.#nudge(dirs[e.key][0], dirs[e.key][1], step);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.#removeSelected();
    } else if (e.key === 'Escape') {
      if (this.#drag) this.#cancelDrag();
      this.#sel = null;
      this.#renderAll();
    }
  }

  #toast(text) {
    const t = this.#root.querySelector('.toast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ================================================================ standalone harness hooks

  /**
   * Test/demo hook for the standalone page and screenshots (no effect on the Wix flow):
   * { tab, wizard:stepIndex, coach:bool, select:{kind,id}, storage:[itemIds], drag:{kind,id,dx,dy} }
   */
  debugSetup(opts = {}) {
    if (!this.#booth) return;
    if (opts.storage?.length) {
      let b = this.#booth;
      for (const id of opts.storage) b = ops.storeItem(b, id).booth;
      this.#booth = b;
      this.#history.reset(toDraft(b));
    }
    if (typeof opts.wizard === 'number') this.#wizard = opts.wizard;
    if (opts.coach === false) this.#coach = false;
    if (opts.coach === true) this.#coach = true;
    if (opts.tab) this.#tab = opts.tab;
    if (opts.select) this.#sel = opts.select;
    this.#renderAll();
    if (opts.drag) {
      const { kind, id, dx, dy } = opts.drag;
      this.#sel = { kind, id };
      this.#renderSelbar();
      this.#drag = { kind, id, o: this.#origin(kind, id), moved: true };
      this.#dragPreview(kind, id, dx, dy);
      const room = this.#root.querySelector('.room.edit');
      const ghostOf = this.#layoutFor(this.#booth).fixtures.find((f) => f.id === id);
      if (ghostOf && kind === 'fixture') {
        room.insertAdjacentHTML('beforeend', `<div class="was" style="left:${pct(ghostOf.x)}%;top:${pct(ghostOf.y)}%;width:${pct(ghostOf.w)}%;height:${pct(ghostOf.h)}%"></div>`);
      }
      this.#drag = null;
    }
  }
}

/** Downscale an image file to <= 1600 px long side and <= 600 KB JPEG. Returns null if it can't get small enough. */
async function downscaleFile(file) {
  const bmp = await loadBitmap(file);
  const plan = encodePlan(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let lastSize = '';
  for (const step of plan) {
    const key = `${step.w}x${step.h}`;
    if (key !== lastSize) {
      canvas.width = step.w;
      canvas.height = step.h;
      ctx.fillStyle = '#fff'; // JPEG has no alpha
      ctx.fillRect(0, 0, step.w, step.h);
      ctx.drawImage(bmp, 0, 0, step.w, step.h);
      lastSize = key;
    }
    const dataUrl = canvas.toDataURL('image/jpeg', step.quality);
    if (dataUrlBytes(dataUrl) <= MAX_BYTES) return { dataUrl, w: step.w, h: step.h };
  }
  return null;
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall back to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

if (!customElements.get('attic-editor')) customElements.define('attic-editor', AtticEditor);
