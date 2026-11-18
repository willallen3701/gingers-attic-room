// Booth templates ("Use a template"): a ready-made look plus automatic placement of the seller's items, for sellers
// who don't want to design. Pure: no DOM. The result is an ordinary booth (room, fixtures, decor, boxes, placements)
// built ONLY with the editor's own operations (logic/editops.js), so everything it produces is valid by the same
// rules a hand-made layout is, and it saves as a normal draft (nothing new reaches the Wix site or its data).
//
// What a template does
//   - sets wall (wallpaper or paint), floor, wall strips (baseboard, wainscot ...), a light preset, windows,
//     shelving and furniture, and a lamp or two (lamps come on);
//   - places the seller's items by size: rugs on the floor, wall hangings on the wall, tiny things in collectibles
//     boxes, big things on the floor and on tables, small things on shelves;
//   - nothing is lost: an item that doesn't fit, or would pass the 40-piece limit, goes to the storage crate;
//   - items the site has rejected stay in the crate too (they can't be shown to shoppers anyway).
// It keeps the booth sign, the booth sound and the highlights. It replaces fixtures, decor, boxes, windows/doors and
// where every item sits, so the editor asks before applying it over a layout (hasExistingLayout()).
//
// Seasonal: a template may carry `until: 'YYYY-MM-DD'`. It is offered while now is before that date's local midnight
// (so the Christmas look is offered through December 31 and gone on January 1). Nothing about a template is stored in
// the booth, so a booth that already uses the Christmas layout simply keeps it.

import { ROOM } from './room.js';
import { buildLayout } from './layout.js';
import { normalizeLibrary, byId } from './library.js';
import { itemSizeIn, realSizeIn } from './scale.js';
import { itemTweak, defaultRoom } from './draft.js';
import { snapToSurface } from './snap.js';
import { MAX_BOXES, boxSizeIn, boxedItemIds, placedPieces } from './boxes.js';
import { FLOOR_BAND } from './fixtures.js';
import * as ops from './editops.js';

// ------------------------------------------------------------------ the five looks
// Library ids only (no new art): wallpapers/paints/floors/strips/fixtures/decor from data/library.json.
// fixtures: { k, id, x, y } for wall fixtures (top-left) or { k, id, x, base } for floor fixtures (x = left edge,
//   base = the line it stands on, 91..119.5; a bigger base is nearer the viewer).
// windows: { id, x, base } (base = bottom edge on the wall).
// decor:  { id, on: {fx, s, u} | {floor:true, x, base} | {wall:true, x, base}, lit? }; on a fixture: surface s, u = 0..1 along it.
// Anything that can't be placed (an id missing from the library, no room) is skipped, never an error.

export const TEMPLATES = Object.freeze([
  {
    id: 'cozy-cottage',
    name: 'Cozy Cottage',
    blurb: 'Cabbage-rose wallpaper, honey oak floor, a blue hutch and a sunny window.',
    wall: { wallpaper: 'wp-cabbage-rose' },
    floor: 'fl-wood-honey',
    strips: ['beadboard-white', 'baseboard-white'],
    light: 'window-afternoon',
    box: { style: 'crate', lining: 'green' },
    windows: [{ id: 'window-sash', x: 41, base: 64 }],
    fixtures: [
      { k: 'hutch', id: 'hutch-blue', x: 3, base: 107 },
      { k: 'table', id: 'table-farm-48', x: 36, base: 113 },
      { k: 'dresser', id: 'dresser-chippy', x: 70, base: 101 },
      { k: 'stackR', id: 'shelf-stack-3-cream', x: 90, y: 4 },
    ],
    decor: [
      { id: 'lamp-oil', on: { fx: 'dresser', s: 's0', u: 0.2 }, lit: true },
      { id: 'plant-fern', on: { fx: 'dresser', s: 's0', u: 0.78 } },
      { id: 'plant-philodendron', on: { floor: true, x: 33, base: 117 } },
      { id: 'chair-rocking', on: { floor: true, x: 90, base: 119 } },
    ],
  },
  {
    id: 'victorian-parlor',
    name: 'Victorian Parlor',
    blurb: 'Gilded damask, walnut woodwork, a carved console and a glass display case.',
    wall: { wallpaper: 'wp-gilded-damask' },
    floor: 'fl-herringbone',
    strips: ['crown-walnut', 'wainscot-walnut', 'baseboard-walnut'],
    light: 'lamp-glow',
    box: { style: 'jewelry', lining: 'plum' },
    windows: [],
    fixtures: [
      { k: 'case', id: 'case-glass-36', x: 2, base: 108 },
      { k: 'console', id: 'table-console-carved', x: 40, base: 104 },
      { k: 'stackR', id: 'shelf-stack-4-walnut', x: 80, y: 8 },
    ],
    decor: [
      { id: 'mirror-ornate', on: { wall: true, x: 60, base: 52 } },
      { id: 'candelabra-brass', on: { fx: 'console', s: 's0', u: 0.15 }, lit: true },
      { id: 'lamp-oil', on: { fx: 'console', s: 's0', u: 0.85 }, lit: true },
      { id: 'clock-mantel', on: { fx: 'console', s: 's0', u: 0.5 } },
      { id: 'bust-marble', on: { fx: 'case', s: 'top', u: 0.5 } },
      { id: 'frame-oval-mahogany', on: { wall: true, x: 12, base: 34 } },
      { id: 'clock-grandfather', on: { floor: true, x: 107, base: 117 } },
    ],
  },
  {
    id: 'farmhouse',
    name: 'Farmhouse',
    blurb: 'Sage gingham, pale planks, a long farm table and open shelves.',
    wall: { wallpaper: 'wp-sage-gingham' },
    floor: 'fl-wood-light',
    strips: ['beadboard-white', 'picturerail-white'],
    light: 'cool-morning',
    box: { style: 'crate', lining: 'cream' },
    windows: [{ id: 'window-sash', x: 6, base: 62 }],
    fixtures: [
      { k: 'shelfA', id: 'shelf-single-48-oak', x: 70, y: 18 },
      { k: 'table', id: 'table-farm-60', x: 6, base: 113 },
      { k: 'bookcase', id: 'bookcase-rustic', x: 72, base: 108 },
    ],
    decor: [
      { id: 'plant-philodendron', on: { fx: 'table', s: 'top', u: 0.85 } },
      { id: 'lamp-oil', on: { fx: 'table', s: 'top', u: 0.1 }, lit: true },
      { id: 'basket-wicker', on: { fx: 'table', s: 'top', u: 0.36 } },
      { id: 'frame-landscape', on: { wall: true, x: 57, base: 46 } },
    ],
  },
  {
    id: 'antique-library',
    name: 'Antique Library',
    blurb: 'Bottle green walls, dark boards, tall bookcases and a writing table.',
    wall: { paint: 'paint-bottle-green' },
    floor: 'fl-wood-dark',
    strips: ['crown-walnut', 'picturerail-walnut', 'baseboard-walnut'],
    light: 'lamp-glow',
    box: { style: 'curio', lining: 'blue' },
    windows: [],
    fixtures: [
      { k: 'caseL', id: 'bookcase-rustic', x: 2, base: 109 },
      { k: 'desk', id: 'table-writing', x: 52, base: 113 },
      { k: 'shelf', id: 'shelf-stack-4-walnut', x: 54, y: 6 },
      { k: 'shelfR', id: 'shelf-single-24-walnut', x: 96, y: 14 },
    ],
    decor: [
      { id: 'lamp-oil', on: { fx: 'desk', s: 's0', u: 0.85 }, lit: true },
      { id: 'plant-succulent', on: { fx: 'desk', s: 's0', u: 0.12 } },
      { id: 'lamp-floor-fringe', on: { floor: true, x: 106, base: 119 }, lit: true },
      { id: 'bust-marble', on: { fx: 'desk', s: 's0', u: 0.4 } },
      { id: 'frame-oval-mahogany', on: { wall: true, x: 17, base: 32 } },
    ],
  },
  {
    id: 'christmas',
    name: 'Christmas',
    blurb: 'Deep red damask walls, a full tree with gifts, garland, stockings and glowing candles.',
    until: '2027-01-01',
    wall: { wallpaper: 'wp-crimson-damask' },
    floor: 'fl-wood-dark',
    strips: ['picturerail-white', 'wainscot-cream', 'baseboard-white'],
    light: 'lamp-glow',
    box: { style: 'jewelry', lining: 'red' },
    windows: [],
    fixtures: [
      { k: 'stackR', id: 'shelf-stack-3-cream', x: 86, y: 8 },
      { k: 'console', id: 'table-console-carved', x: 4, base: 108 },
    ],
    decor: [
      { id: 'xmas-garland', on: { wall: true, x: 45, base: 22 } },
      { id: 'xmas-wreath', on: { wall: true, x: 24, base: 56 } },
      { id: 'xmas-stockings', on: { wall: true, x: 63, base: 52 } },
      { id: 'xmas-candles', on: { fx: 'console', s: 's0', u: 0.2 }, lit: true },
      { id: 'lamp-oil', on: { fx: 'console', s: 's0', u: 0.62 }, lit: true },
      { id: 'xmas-nutcracker', on: { floor: true, x: 30, base: 118 } },
      { id: 'xmas-gifts', on: { floor: true, x: 53, base: 119 } },
      { id: 'xmas-tree', on: { floor: true, x: 95, base: 118 } },
    ],
  },
]);

// ------------------------------------------------------------------ availability (the Christmas cutoff)

/** Local midnight at the start of 'YYYY-MM-DD'. */
function startOfDay(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** True while `t` may still be offered at `now`: before its `until` date's local midnight (or no end date). */
export function isTemplateAvailable(t, now = new Date()) {
  if (!t?.until) return true;
  const at = now instanceof Date ? now.getTime() : Number(now);
  return Number.isFinite(at) && at < startOfDay(t.until).getTime();
}

/** The templates to offer at `now`, in display order. */
export function availableTemplates(now = new Date(), list = TEMPLATES) {
  return list.filter((t) => isTemplateAvailable(t, now));
}

// ------------------------------------------------------------------ "is there work to lose?"

const sameTexture = (a, b) => (a?.textureId ?? a?.paintId ?? a?.src ?? null) === (b?.textureId ?? b?.paintId ?? b?.src ?? null) && (a?.type ?? null) === (b?.type ?? null);

/**
 * True when applying a template would replace something the seller arranged: any fixture, decor, box, window or
 * door, any item out in the room or in a box, or a wall/floor/strip choice that isn't the new-booth default.
 */
export function hasExistingLayout(booth, libIn = null) {
  const b = booth ?? {};
  if ((b.fixtures ?? []).length || (b.decor ?? []).length || (b.boxes ?? []).length) return true;
  if ((b.room?.placeables ?? []).length || (b.room?.architecture ?? []).length) return true;
  if ((b.items ?? []).some((i) => i.placement)) return true;
  if (libIn && b.room) {
    const d = defaultRoom(normalizeLibrary(libIn));
    if (!sameTexture(b.room.wall, d.wall) || !sameTexture(b.room.floor, d.floor)) return true;
  }
  return false;
}

// ------------------------------------------------------------------ sizes and classes

/** An item whose longest real side is at most this many inches goes in a collectibles box. */
export const TINY_MAX_IN = 5.5;
/** Drawn height from which a standing item counts as medium / big (big ones go on tables and the floor). */
export const BIG_H_IN = 14;
export const BIG_W_IN = 16;
/** Standing items at least this tall go straight to the floor (a table top would be silly). */
export const FLOOR_H_IN = 24;
const GAP_IN = 0.75;

/** 'flat' | 'wall' | 'tiny' | 'small' | 'big' | 'tall' | null (null = size unknown, so it waits in the crate). */
export function classifyItem(item) {
  try {
    if (item.mount === 'flat' || item.flat) return 'flat';
    if (item.mount === 'wall') return 'wall';
    const real = realSizeIn(item);
    if (Math.max(real.w, real.h) <= TINY_MAX_IN) return 'tiny';
    const size = itemSizeIn(item, itemTweak(item));
    if (item.mount === 'floor' || size.h >= FLOOR_H_IN) return 'tall';
    if (size.h >= BIG_H_IN || size.w >= BIG_W_IN) return 'big';
    return 'small';
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ building the look

const clone = (v) => JSON.parse(JSON.stringify(v));

function roomLook(t, lib, room) {
  const arch = byId(lib.architecture);
  const wallDef = t.wall.paint ? byId(lib.paints)[t.wall.paint] : byId(lib.wallpapers)[t.wall.wallpaper];
  const floorDef = byId(lib.floors)[t.floor];
  const dflt = defaultRoom(lib);
  const wall = wallDef ? (t.wall.paint ? { type: 'paint', paintId: wallDef.id } : { type: 'wallpaper', textureId: wallDef.id, mode: 'tile', scale: 1 }) : dflt.wall;
  const floor = floorDef ? { textureId: floorDef.id, mode: 'tile', scale: 1 } : dflt.floor;
  let architecture = [];
  for (const id of t.strips ?? []) {
    if (arch[id]?.kind !== 'strip') continue;
    architecture = ops.toggleStrip({ architecture }, lib, id).architecture;
  }
  const light = t.light && byId(lib.lights)[t.light] ? { presetId: t.light, intensity: 0.8 } : null;
  return { ...room, wall, floor, light, architecture, placeables: [] };
}

function buildLook(booth, lib, t) {
  const report = { skipped: [] };
  // Start from an empty room that keeps the sign, sound, highlights and every item (all waiting in the crate).
  let b = {
    ...booth,
    room: roomLook(t, lib, clone(booth.room ?? {})),
    fixtures: [],
    decor: [],
    boxes: [],
    items: (booth.items ?? []).map((it) => ({ ...it, placement: null })),
  };
  const defs = { fixtures: byId(lib.fixtures), decor: byId(lib.decor), arch: byId(lib.architecture) };
  for (const w of t.windows ?? []) {
    const def = defs.arch[w.id];
    if (!def) {
      report.skipped.push(w.id);
      continue;
    }
    const r = ops.placePlaceable(b, lib, w.id, { x: w.x, y: w.base });
    if (r.ok) b = r.booth;
    else report.skipped.push(w.id);
  }
  const fxId = {};
  for (const f of t.fixtures ?? []) {
    const def = defs.fixtures[f.id];
    if (!def) {
      report.skipped.push(f.id);
      continue;
    }
    const r = ops.addFixture(b, lib, f.id, { x: f.x, y: f.base != null ? f.base - def.heightIn : f.y });
    if (r.ok) {
      b = r.booth;
      fxId[f.k] = r.id;
    } else report.skipped.push(f.id);
  }
  for (const d of t.decor ?? []) {
    const def = defs.decor[d.id];
    if (!def) {
      report.skipped.push(d.id);
      continue;
    }
    let drop = null;
    let wanted = null; // the surface it is meant to stand on (a decor that snapped somewhere else is dropped)
    if (d.on.fx) {
      const inst = fxId[d.on.fx];
      wanted = inst && `${inst}:${d.on.s}`;
      const s = wanted && buildLayout(b, lib).surfaces.find((x) => x.id === wanted);
      if (s) drop = { x: s.x1 + d.on.u * (s.x2 - s.x1), y: s.y };
    } else drop = { x: d.on.x, y: d.on.base };
    if (!drop) {
      report.skipped.push(d.id);
      continue;
    }
    const r = ops.placeDecor(b, lib, d.id, drop);
    if (!r.ok || (wanted && r.booth.decor.find((x) => x.id === r.id)?.placement.surfaceId !== wanted)) {
      report.skipped.push(d.id);
      continue;
    }
    b = r.booth;
    if (d.lit && r.id) {
      const lit = ops.setDecorLit(b, lib, r.id, true);
      if (lit.ok) b = lit.booth;
    }
  }
  return { booth: b, report };
}

// ------------------------------------------------------------------ placing items

/** Line surfaces of the booth, tagged 'shelf' or 'table' (a cabinet's top board counts as a table). */
function surfaceTiers(booth, lib) {
  const L = buildLayout(booth, lib);
  const fxDefs = byId(lib.fixtures);
  const inst = new Map((booth.fixtures ?? []).map((f, i) => [f.id, { f, order: i }]));
  const lines = L.surfaces.filter((s) => s.kind === 'line');
  const topOf = {};
  for (const s of lines) topOf[s.fixtureInstanceId] = Math.min(topOf[s.fixtureInstanceId] ?? Infinity, s.y);
  const out = { shelf: [], table: [] };
  for (const s of lines) {
    const e = inst.get(s.fixtureInstanceId);
    const def = e && fxDefs[e.f.fixtureId];
    if (!def) continue;
    const isTop = s.y === topOf[s.fixtureInstanceId];
    const tier = def.category === 'table' || (def.category === 'cabinet' && isTop) ? 'table' : 'shelf';
    out[tier].push({ s, order: e.order });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.order - b.order || a.s.y - b.s.y);
  return { L, tiers: { shelf: out.shelf.map((x) => x.s), table: out.table.map((x) => x.s) } };
}

/** Occupied x-ranges per line surface from what is already standing on it. */
function occupancy(L) {
  const occ = new Map();
  const add = (surfaceId, x1, x2) => {
    if (!occ.has(surfaceId)) occ.set(surfaceId, []);
    occ.get(surfaceId).push([x1, x2]);
  };
  for (const e of L.items) if (e.item.mount !== 'wall') add(e.item.placement.surfaceId, e.x, e.x + e.size.w);
  for (const e of L.decor) if (e.decor.placement.surfaceId.includes(':')) add(e.decor.placement.surfaceId, e.x, e.x + e.size.w);
  for (const e of L.boxes) add(e.box.placement.surfaceId, e.x, e.x + e.size.w);
  return occ;
}

const usedFraction = (occ, s) => (occ.get(s.id) ?? []).reduce((n, [a, b]) => n + (b - a), 0) / (s.x2 - s.x1);

/** First x on the surface where a thing `w` wide fits beside what is there, or null. */
function freeX(occ, s, w) {
  const taken = [...(occ.get(s.id) ?? [])].sort((a, b) => a[0] - b[0]);
  let x = s.x1 + 0.5;
  for (const [a, b] of taken) {
    if (x + w + GAP_IN <= a) break;
    x = Math.max(x, b + GAP_IN);
  }
  return x + w <= s.x2 + 1e-6 ? x : null;
}

/**
 * Try the line surfaces of the given tiers (the emptiest first within a tier) for something `size` big.
 * `attempt(drop)` returns an editops-style result. Returns the successful result or null.
 */
function onLines(state, tierNames, size, attempt) {
  for (const name of tierNames) {
    const cands = state.tiers[name]
      .filter((s) => s.x2 - s.x1 >= size.w && s.headroomIn >= size.h)
      .map((s, i) => ({ s, i, used: usedFraction(state.occ, s) }))
      .sort((a, b) => a.used - b.used || a.i - b.i);
    for (const { s } of cands) {
      const x = freeX(state.occ, s, size.w);
      if (x == null) continue;
      const r = attempt({ x: x + size.w / 2, y: s.y });
      if (r.ok) {
        if (!state.occ.has(s.id)) state.occ.set(s.id, []);
        state.occ.get(s.id).push([x, x + size.w]);
        return r;
      }
    }
  }
  return null;
}

/** Floor placement that hides the least: rows from the front, spots over nothing else first. */
function onFloor(booth, lib, item, size) {
  const L = buildLayout(booth, lib);
  const rect = (x, top, w, h) => ({ x1: x, x2: x + w, y1: top, y2: top + h });
  const others = [
    ...L.items.filter((e) => e.item.mount !== 'flat').map((e) => rect(e.x, e.top, e.size.w, e.size.h)),
    ...L.decor.filter((e) => e.mount !== 'flat').map((e) => rect(e.x, e.top, e.size.w, e.size.h)),
    ...L.boxes.map((e) => rect(e.x, e.top, e.size.w, e.size.h)),
    ...L.fixtures.map((f) => rect(f.x, f.y, f.w, f.h)),
  ];
  const cands = [];
  let i = 0;
  for (const base of [FLOOR_BAND.yMax - 1, 113, 107, 101, 96]) {
    for (let cx = size.w / 2 + 1; cx <= ROOM.widthIn - size.w / 2 - 1; cx += 3) {
      const p = snapToSurface({ x: cx, y: base }, size, L.surfaces.filter((s) => s.kind === 'floor'), 'stand');
      if (!p) continue;
      const r = rect(p.x, p.y - size.h, size.w, size.h);
      let area = 0;
      for (const o of others) {
        const w = Math.min(r.x2, o.x2) - Math.max(r.x1, o.x1);
        const h = Math.min(r.y2, o.y2) - Math.max(r.y1, o.y1);
        if (w > 0.01 && h > 0.01) area += w * h;
      }
      cands.push({ d: { x: cx, y: base }, area, i: i++ });
    }
  }
  cands.sort((a, b) => a.area - b.area || a.i - b.i);
  for (const c of cands.slice(0, 60)) {
    const r = ops.placeItem(booth, lib, item.id, c.d);
    if (r.ok) return r;
  }
  return null;
}

const gridFor = (n) => {
  if (n <= 4) return [2, 2];
  if (n <= 6) return [3, 2];
  if (n <= 9) return [3, 3];
  if (n <= 12) return [4, 3];
  return [4, 4];
};

/**
 * Apply a template to a booth. Pure; the input is not changed.
 * @param {object} booth   editor booth (room, fixtures, decor, boxes, items with placement)
 * @param {object} libIn   library.json
 * @param {string} id      template id
 * @param {{now?:Date, maxPlaced?:number}} [opts]  `now` decides whether a seasonal template is still offered
 * @returns {{ok:boolean, booth:object, errors:Array, report?:{placed:number, boxed:number, stored:number, rejected:number, skipped:string[], pieces:number}}}
 */
export function applyTemplate(booth, libIn, id, { now = new Date(), maxPlaced = ROOM.maxPlacedItems } = {}) {
  const lib = normalizeLibrary(libIn);
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) return { ok: false, booth, errors: [{ code: 'UNKNOWN_TEMPLATE' }] };
  if (!isTemplateAvailable(t, now)) return { ok: false, booth, errors: [{ code: 'TEMPLATE_ENDED' }] };
  const max = Math.min(ROOM.maxPlacedItems, maxPlaced);

  const built = buildLook(booth, lib, t);
  let b = built.booth;
  const state = { ...surfaceTiers(b, lib) };
  state.occ = occupancy(state.L);
  const refresh = () => {
    state.occ = occupancy(buildLayout(b, lib));
  };
  const room = () => placedPieces(b) < max;
  const itemOf = (itemId) => b.items.find((i) => i.id === itemId);
  const take = (r) => {
    b = r.booth;
  };

  // Which items go where. Rejected items wait in the crate; sold ones are placed last.
  const rank = (it) => (it.status === 'sold' ? 1 : 0);
  const pool = b.items.filter((it) => it.status !== 'rejected').sort((a, c) => rank(a) - rank(c));
  const cls = new Map(pool.map((it) => [it.id, classifyItem(it)]));
  const of = (name) => pool.filter((it) => cls.get(it.id) === name);
  const area = (it) => {
    const s = itemSizeIn(it, itemTweak(it));
    return s.w * s.h;
  };
  const biggestFirst = (list) => [...list].sort((a, c) => area(c) - area(a));

  // 1) rugs (so things can stand on them), then wall hangings.
  for (const it of of('flat')) {
    if (!room()) break;
    const r = ops.autoPlaceItem(b, lib, it.id);
    if (r.ok) take(r);
  }
  for (const it of biggestFirst(of('wall'))) {
    if (!room()) break;
    const r = ops.autoPlaceItem(b, lib, it.id);
    if (r.ok) take(r);
  }

  // 2) collectibles boxes for the tiny things (each box counts as one piece).
  const tiny = of('tiny');
  const boxedIds = new Set();
  if (tiny.length) {
    const k = Math.min(MAX_BOXES, Math.ceil(tiny.length / 9));
    const per = Math.ceil(tiny.length / k);
    for (let bi = 0; bi < k; bi++) {
      const chunk = tiny.slice(bi * per, bi * per + per).slice(0, 16);
      if (!chunk.length || !room()) break;
      const [cols, rows] = gridFor(chunk.length);
      refresh();
      const size = boxSizeIn({ cols, rows });
      // Tables first (a box reads best at eye level on a tabletop), then shelves.
      const res = onLines(state, ['table', 'shelf'], size, (drop) => {
        const r = ops.addBox(b, lib, t.box.style, drop);
        if (!r.ok) return r;
        let nb = r.booth;
        const grid = ops.setBoxGrid(nb, lib, r.id, cols, rows);
        if (!grid.ok) return { ...grid, ok: false };
        nb = ops.setBoxLook(grid.booth, r.id, t.box).booth;
        return { ok: true, booth: nb, id: r.id };
      });
      if (!res) continue;
      take(res);
      chunk.forEach((it, slot) => {
        const a = ops.assignToBox(b, res.id, slot, it.id);
        if (a.ok) {
          b = a.booth;
          boxedIds.add(it.id);
        }
      });
    }
  }

  // 3) the rest, big things first so they get the room they need.
  const order = [
    ...biggestFirst(of('tall')).map((it) => [it, ['floor']]),
    ...biggestFirst(of('big')).map((it) => [it, ['table', 'floor']]),
    ...biggestFirst(of('small')).map((it) => [it, ['shelf', 'table', 'floor']]),
    // tiny things that didn't make it into a box still deserve a shelf
    ...biggestFirst(tiny.filter((it) => !boxedIds.has(it.id))).map((it) => [it, ['shelf', 'table', 'floor']]),
  ];
  for (const [it0, tiers] of order) {
    if (!room()) break;
    const it = itemOf(it0.id);
    if (it.placement) continue;
    const size = itemSizeIn(it, itemTweak(it));
    refresh();
    let r = null;
    // Lines and the floor, in tier order (e.g. table, then floor).
    for (const tier of tiers) {
      r = tier === 'floor' ? onFloor(b, lib, it, size) : onLines(state, [tier], size, (drop) => ops.placeItem(b, lib, it.id, drop));
      if (r) break;
    }
    if (r) take(r);
  }

  // Whatever is not out or in a box waits in the crate, at normal size.
  const boxed = boxedItemIds(b);
  b = { ...b, items: b.items.map((it) => (it.placement ? it : { ...it, placement: null, sizeTweak: 1 })) };
  const stored = b.items.filter((it) => !it.placement && !boxed.has(it.id) && it.status !== 'rejected').length;
  const report = {
    placed: b.items.filter((it) => it.placement).length,
    boxed: boxed.size,
    stored,
    rejected: b.items.filter((it) => it.status === 'rejected').length,
    skipped: built.report.skipped,
    pieces: placedPieces(b),
  };
  return { ok: true, booth: b, errors: [], report, templateId: t.id };
}

/** The seller-facing sentence for what applyTemplate did. */
export function templateSummary(name, report) {
  const bits = [];
  if (report.placed) bits.push(`${report.placed} out in the room`);
  if (report.boxed) bits.push(`${report.boxed} in a collectibles box`);
  if (report.stored) bits.push(`${report.stored} in your storage crate`);
  const where = bits.length ? ` ${bits.join(', ')}.` : '';
  return `${name} is ready.${where} Move anything you like, then press Update booth when you're happy.`;
}
