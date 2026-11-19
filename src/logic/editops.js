// Editor operations on a booth. All pure: each returns { ok, booth, errors } and never mutates its input.
// Acceptance rule for every change: the thing being changed must end up problem-free, and nothing that
// was problem-free before may become a problem (so an old, already-broken layout never blocks edits).

import { ROOM } from './room.js';
import { buildLayout } from './layout.js';
import { snapToSurface, shelfTooShort } from './snap.js';
import { snapFixture, moveFixture, removeFixture, nextId, FLOOR_BAND } from './fixtures.js';
import { itemSizeIn, clampItemTweak } from './scale.js';
import { itemTweak } from './draft.js';
import { normalizeLibrary, byId, decorFamily } from './library.js';
import { isLampDef } from './lamps.js';
import { MAX_BOXES, newBox, normalizeBox, regrid, boxSizeIn, unbox, roomForAnother, styleOf, liningOf } from './boxes.js';

export const REASONS = Object.freeze({
  OVERLAP: 'That would overlap something already there.',
  NO_HEADROOM: 'Not enough room above that shelf.',
  SHELF_TOO_LOW: 'That one is too tall for the space above that shelf. Try a shelf with a taller gap, a table or the floor, or make it a little smaller.',
  BLOCKED_BY_FIXTURE: 'Something on the wall is in the way.',
  BLOCKED: 'A window or door is in the way.',
  OUT_OF_REGION: "That spot is off the wall or floor.",
  OUT_OF_ROOM: 'That would stick out of the room.',
  OFF_SURFACE: "It doesn't fit on that surface.",
  WRONG_MOUNT: "That can't go there.",
  NO_SURFACE: 'There is nothing there for it to stand on.',
  NO_SPOT: 'No free spot left for that. Move something or add another shelf.',
  OVER_LIMIT: 'Your room is full: 40 pieces is the limit (a collectibles box counts as one). Move one to the storage crate first.',
  MAX_BOXES: 'You can have up to 3 collectibles boxes.',
  NO_ROOM_TO_GROW: "There's no room for it to grow here. Move it somewhere roomier first.",
  UNKNOWN: "That can't be placed right now.",
});

export function reasonFor(errors) {
  const code = errors?.[0]?.code;
  return REASONS[code] ?? REASONS.UNKNOWN;
}

const ok = (booth) => ({ ok: true, booth, errors: [] });
const fail = (code, booth) => ({ ok: false, booth, errors: [{ code }] });

/** Accept `next` if the changed ids are clean and nothing clean became broken. */
export function judge(prev, next, lib, changedIds) {
  const before = buildLayout(prev, lib).problems;
  const after = buildLayout(next, lib).problems;
  // The thing the seller is moving explains itself first (its own OVERLAP beats a knock-on NO_HEADROOM).
  const errors = [];
  for (const id of changedIds) if (after[id]) errors.push(...after[id]);
  for (const [id, errs] of Object.entries(after)) {
    if (!changedIds.includes(id) && !before[id]) errors.push(...errs);
  }
  return errors.length ? { ok: false, booth: next, errors } : ok(next);
}

// ------------------------------------------------------------------ items

export const sizeOfItem = (item) => itemSizeIn(item, itemTweak(item));

/** Bottom-centre of a placed item/decor (the point a drag moves). */
export function anchorOf(placement, size) {
  return { x: placement.x + size.w / 2, y: placement.y };
}

const setItem = (booth, id, patch) => ({ ...booth, items: booth.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });

/**
 * Place (from storage) or move an item so its bottom-centre lands near `drop` (room inches).
 * Enforces the 40-item cap when an item leaves storage.
 */
export function placeItem(booth, libIn, itemId, drop) {
  const lib = normalizeLibrary(libIn);
  const item = (booth.items ?? []).find((i) => i.id === itemId);
  if (!item) return fail('UNKNOWN', booth);
  if (!item.placement && !roomForAnother(booth)) return fail('OVER_LIMIT', booth);
  const size = sizeOfItem(item);
  const { surfaces } = buildLayout(booth, lib);
  const p = snapToSurface(drop, size, surfaces, item.mount);
  if (!p) return fail('NO_SURFACE', booth);
  const tweak = clampItemTweak(item, itemTweak(item));
  let next = setItem(booth, itemId, { placement: { ...p, scaleAdj: tweak }, sizeTweak: tweak });
  if (booth.boxes) next = { ...next, boxes: unbox(booth.boxes, itemId) }; // out of its box, into the room
  const res = judge(booth, next, lib, [itemId]);
  // Refused after skipping a shelf that was too low for it: say so (not "overlap" from the floor fallback).
  if (!res.ok && item.mount !== 'wall' && item.mount !== 'flat' && item.mount !== 'floor') {
    const low = shelfTooShort(drop, size, surfaces);
    if (low) return { ...res, errors: [{ code: 'SHELF_TOO_LOW', headroomIn: low.headroomIn, heightIn: size.h }, ...res.errors] };
  }
  return res;
}

/** Back to the storage crate (out of the room or out of a box). Always allowed. */
export function storeItem(booth, itemId) {
  const next = setItem(booth, itemId, { placement: null, sizeTweak: 1 });
  return ok(booth.boxes ? { ...next, boxes: unbox(booth.boxes, itemId) } : next);
}

/**
 * Resize to tweak `want`. When the full size would bump into something, grow only as far as it fits here
 * (largest tweak found by halving), so the slider never snaps back to where it was.
 * `attempt(t)` -> judge result for tweak t. Returns the result plus { tweak, limited }.
 */
function fitResize(attempt, current, want) {
  const r = attempt(want);
  if (r.ok || want <= current + 1e-9) return { ...r, tweak: want, limited: false };
  let lo = current;
  let hi = want;
  let found = false;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (attempt(mid).ok) {
      lo = mid;
      found = true;
    } else hi = mid;
  }
  const t = Math.floor(lo * 100) / 100;
  const none = { ...r, ok: false, errors: [{ code: 'NO_ROOM_TO_GROW' }], tweak: current, limited: true };
  if (!found || t <= current + 1e-9) return none;
  const best = attempt(t);
  return best.ok ? { ...best, tweak: t, limited: true } : none;
}

/**
 * Change an item's size tweak, keeping its bottom-centre where it was. The tweak is clamped to the item's own
 * range (logic/scale.js: real size, 4 in minimum, room-sized maximum); if the size asked for doesn't fit here,
 * the item grows as far as it can ({ limited: true }) instead of refusing.
 * @returns {{ok:boolean, booth:object, errors:Array, tweak:number, limited:boolean}}
 */
export function setItemScale(booth, libIn, itemId, scaleAdj) {
  const lib = normalizeLibrary(libIn);
  const item = (booth.items ?? []).find((i) => i.id === itemId);
  if (!item?.placement) return fail('UNKNOWN', booth);
  const current = clampItemTweak(item, itemTweak(item));
  const oldSize = sizeOfItem(item);
  const attempt = (t) => {
    const newSize = itemSizeIn(item, t);
    const x = Math.round((item.placement.x + (oldSize.w - newSize.w) / 2) * 100) / 100;
    const next = setItem(booth, itemId, { placement: { ...item.placement, x, scaleAdj: t }, sizeTweak: t });
    return judge(booth, next, lib, [itemId]);
  };
  return fitResize(attempt, current, clampItemTweak(item, scaleAdj));
}

// ------------------------------------------------------------------ decor

const decorShape = (def) => ({ heightIn: def.heightIn, widthIn: def.widthIn, aspect: def.aspect, flat: def.mount === 'flat', mount: def.mount });
function decorSize(def, scaleAdj = 1) {
  return itemSizeIn(decorShape(def), scaleAdj);
}
const decorMount = (m) => (m === 'floor' ? 'floor' : m === 'wall' ? 'wall' : m === 'flat' ? 'flat' : 'stand');

/** Add a decor prop (or move an existing one when `instanceId` is given) near `drop`. */
export function placeDecor(booth, libIn, decorId, drop, instanceId = null) {
  const lib = normalizeLibrary(libIn);
  const def = byId(lib.decor)[decorId];
  if (!def) return fail('UNKNOWN', booth);
  const decor = booth.decor ?? [];
  const existing = instanceId ? decor.find((d) => d.id === instanceId) : null;
  const scaleAdj = existing?.placement?.scaleAdj ?? 1;
  const size = decorSize(def, scaleAdj);
  const { surfaces } = buildLayout(booth, lib);
  const p = snapToSurface(drop, size, surfaces, decorMount(def.mount));
  if (!p) return fail('NO_SURFACE', booth);
  const id = existing?.id ?? nextId('dc', decor.map((d) => d.id));
  // Moving keeps the entry's other fields (a lamp's `lit` switch); a new lamp starts switched off.
  const entry = existing
    ? { ...existing, decorId, placement: { ...p, scaleAdj } }
    : { id, decorId, placement: { ...p, scaleAdj }, ...(isLampDef(def) ? { lit: false } : {}) };
  const next = { ...booth, decor: existing ? decor.map((d) => (d.id === id ? entry : d)) : [...decor, entry] };
  const res = judge(booth, next, lib, [id]);
  return { ...res, id };
}

export function removeDecor(booth, instanceId) {
  return ok({ ...booth, decor: (booth.decor ?? []).filter((d) => d.id !== instanceId) });
}

/** Switch a placed lamp on or off (decor whose library category is 'lighting'). Nothing moves, so nothing to judge. */
export function setDecorLit(booth, libIn, instanceId, lit) {
  const lib = normalizeLibrary(libIn);
  const d = (booth.decor ?? []).find((x) => x.id === instanceId);
  const def = d && byId(lib.decor)[d.decorId];
  if (!def || !isLampDef(def)) return fail('UNKNOWN', booth);
  return ok({ ...booth, decor: booth.decor.map((x) => (x.id === instanceId ? { ...x, lit: !!lit } : x)) });
}

export function setDecorScale(booth, libIn, instanceId, scaleAdj) {
  const lib = normalizeLibrary(libIn);
  const d = (booth.decor ?? []).find((x) => x.id === instanceId);
  const def = d && byId(lib.decor)[d.decorId];
  if (!def || !d.placement) return fail('UNKNOWN', booth);
  const current = clampItemTweak(decorShape(def), d.placement.scaleAdj ?? 1);
  const oldSize = decorSize(def, current);
  const attempt = (t) => {
    const newSize = decorSize(def, t);
    const x = Math.round((d.placement.x + (oldSize.w - newSize.w) / 2) * 100) / 100;
    const next = { ...booth, decor: booth.decor.map((x0) => (x0.id === instanceId ? { ...x0, placement: { ...x0.placement, x, scaleAdj: t } } : x0)) };
    return judge(booth, next, lib, [instanceId]);
  };
  return fitResize(attempt, current, clampItemTweak(decorShape(def), scaleAdj));
}

/**
 * Swap a placed decor piece for another choice of its family (a garland's length, a pattern choice; see
 * library.js decorFamily). It keeps its bottom-centre, its size tweak (within what the new choice allows) and its other
 * fields. If the new choice would overlap something or leave the room, nothing changes and the errors say why.
 */
export function setDecorVariant(booth, libIn, instanceId, decorId) {
  const lib = normalizeLibrary(libIn);
  const defs = byId(lib.decor);
  const d = (booth.decor ?? []).find((x) => x.id === instanceId);
  const from = d && defs[d.decorId];
  const to = defs[decorId];
  const fam = from && decorFamily(lib, d.decorId);
  if (!d?.placement || !to || !fam || !fam.members.some((m) => m.id === decorId)) return fail('UNKNOWN', booth);
  if (d.decorId === decorId) return ok(booth);
  const tweak = clampItemTweak(decorShape(to), d.placement.scaleAdj ?? 1);
  const oldSize = decorSize(from, d.placement.scaleAdj ?? 1);
  const newSize = decorSize(to, tweak);
  const x = Math.round((d.placement.x + (oldSize.w - newSize.w) / 2) * 100) / 100;
  const next = { ...booth, decor: booth.decor.map((x0) => (x0.id === instanceId ? { ...x0, decorId, placement: { ...x0.placement, x, scaleAdj: tweak } } : x0)) };
  return judge(booth, next, lib, [instanceId]);
}

// ------------------------------------------------------------------ collectibles boxes (logic/boxes.js)

const setBox = (booth, id, fn) => ({ ...booth, boxes: (booth.boxes ?? []).map((b) => (b.id === id ? fn(b) : b)) });

/** Add a box of a style at `drop` (bottom-centre), or at the first spot that fits when drop is null. */
export function addBox(booth, libIn, style, drop = null) {
  const lib = normalizeLibrary(libIn);
  const boxes = booth.boxes ?? [];
  if (boxes.length >= MAX_BOXES) return fail('MAX_BOXES', booth);
  if (!roomForAnother(booth)) return fail('OVER_LIMIT', booth);
  const id = nextId('bx', boxes.map((b) => b.id));
  const box = newBox(id, styleOf(style).id);
  const size = boxSizeIn(box);
  const { surfaces } = buildLayout(booth, lib);
  const tryAt = (d) => {
    const p = snapToSurface(d, size, surfaces, 'stand');
    if (!p) return fail('NO_SURFACE', booth);
    const next = { ...booth, boxes: [...boxes, { ...box, placement: p }] };
    return { ...judge(booth, next, lib, [id]), id };
  };
  if (drop) return tryAt(drop);
  return { ...firstThatFits(autoDrops(booth, lib, 'stand'), tryAt), id };
}

/** Move a box so its bottom-centre lands near `drop`. */
export function placeBox(booth, libIn, boxId, drop) {
  const lib = normalizeLibrary(libIn);
  const box = (booth.boxes ?? []).find((b) => b.id === boxId);
  if (!box) return fail('UNKNOWN', booth);
  const { surfaces } = buildLayout(booth, lib);
  const p = snapToSurface(drop, boxSizeIn(box), surfaces, 'stand');
  if (!p) return fail('NO_SURFACE', booth);
  return judge(booth, setBox(booth, boxId, (b) => ({ ...b, placement: p })), lib, [boxId]);
}

/** Remove a box; its items go back to the storage crate. */
export function removeBox(booth, boxId) {
  const box = (booth.boxes ?? []).find((b) => b.id === boxId);
  return { ...ok({ ...booth, boxes: (booth.boxes ?? []).filter((b) => b.id !== boxId) }), freedIds: (box?.slots ?? []).filter(Boolean) };
}

/** Change the compartment grid (2..4 each way), keeping the box's bottom-centre; freed items go to the crate. */
export function setBoxGrid(booth, libIn, boxId, cols, rows) {
  const lib = normalizeLibrary(libIn);
  const box = (booth.boxes ?? []).find((b) => b.id === boxId);
  if (!box) return fail('UNKNOWN', booth);
  const { box: re, freed } = regrid(normalizeBox(box), cols, rows);
  const old = boxSizeIn(box);
  const now = boxSizeIn(re);
  const placement = box.placement ? { ...box.placement, x: Math.round((box.placement.x + (old.w - now.w) / 2) * 100) / 100 } : null;
  const next = setBox(booth, boxId, () => ({ ...re, placement }));
  return { ...judge(booth, next, lib, [boxId]), freedIds: freed };
}

/** Change a box's style and/or lining colour. */
export function setBoxLook(booth, boxId, { style, lining } = {}) {
  const box = (booth.boxes ?? []).find((b) => b.id === boxId);
  if (!box) return fail('UNKNOWN', booth);
  return ok(setBox(booth, boxId, (b) => ({ ...b, style: style ? styleOf(style).id : b.style, lining: lining ? liningOf(lining).id : b.lining })));
}

/**
 * Put an item in a compartment. It leaves the room or any other compartment; an item already in that
 * compartment goes back to the crate ({ freedIds }).
 */
export function assignToBox(booth, boxId, slot, itemId) {
  const box = (booth.boxes ?? []).find((b) => b.id === boxId);
  const item = (booth.items ?? []).find((i) => i.id === itemId);
  if (!box || !item || !Number.isInteger(slot) || slot < 0 || slot >= box.slots.length) return fail('UNKNOWN', booth);
  const was = box.slots[slot];
  const freedIds = was && was !== itemId ? [was] : [];
  let next = setItem(booth, itemId, { placement: null, sizeTweak: 1 });
  next = { ...next, boxes: unbox(next.boxes, itemId) };
  next = setBox(next, boxId, (b) => ({ ...b, slots: b.slots.map((s, i) => (i === slot ? itemId : s)) }));
  return { ...ok(next), freedIds };
}

/** Empty one compartment; its item goes back to the crate. */
export function clearBoxSlot(booth, boxId, slot) {
  const box = (booth.boxes ?? []).find((b) => b.id === boxId);
  if (!box || !Number.isInteger(slot) || slot < 0 || slot >= box.slots.length) return fail('UNKNOWN', booth);
  const next = setBox(booth, boxId, (b) => ({ ...b, slots: b.slots.map((s, i) => (i === slot ? null : s)) }));
  return { ...ok(next), freedIds: box.slots[slot] ? [box.slots[slot]] : [] };
}

// ------------------------------------------------------------------ fixtures

const ridingIds = (booth, fixtureInstanceId) => {
  const on = (p) => p?.surfaceId?.startsWith(`${fixtureInstanceId}:`);
  return [
    ...(booth.items ?? []).filter((i) => on(i.placement)).map((i) => i.id),
    ...(booth.decor ?? []).filter((d) => on(d.placement)).map((d) => d.id),
    ...(booth.boxes ?? []).filter((b) => on(b.placement)).map((b) => b.id),
  ];
};

/** Move a fixture to a proposed top-left; contents ride along. */
export function moveFixtureTo(booth, libIn, fixtureInstanceId, pos) {
  const lib = normalizeLibrary(libIn);
  const pf = (booth.fixtures ?? []).find((f) => f.id === fixtureInstanceId);
  const def = pf && byId(lib.fixtures)[pf.fixtureId];
  if (!def) return fail('UNKNOWN', booth);
  const to = snapFixture(pos, def);
  if (!to) return fail('OUT_OF_ROOM', booth);
  const next = moveFixture(booth, fixtureInstanceId, to);
  return judge(booth, next, lib, [fixtureInstanceId, ...ridingIds(booth, fixtureInstanceId)]);
}

/** Add a fixture at `pos` (top-left), or at the first free spot when pos is null. */
export function addFixture(booth, libIn, fixtureId, pos = null) {
  const lib = normalizeLibrary(libIn);
  const def = byId(lib.fixtures)[fixtureId];
  if (!def) return fail('UNKNOWN', booth);
  const fixtures = booth.fixtures ?? [];
  const id = nextId('fx', fixtures.map((f) => f.id));
  const tryAt = (p) => {
    const to = snapFixture(p, def);
    if (!to) return fail('OUT_OF_ROOM', booth);
    const next = { ...booth, fixtures: [...fixtures, { id, fixtureId, x: to.x, y: to.y }] };
    return { ...judge(booth, next, lib, [id]), id };
  };
  if (pos) return tryAt(pos);
  for (const p of fixtureScan(def)) {
    const r = tryAt(p);
    if (r.ok) return r;
  }
  return { ...fail('NO_SPOT', booth), id };
}

export function deleteFixture(booth, fixtureInstanceId) {
  const r = removeFixture(booth, fixtureInstanceId);
  return { ok: true, booth: r.booth, errors: [], storedIds: r.storedIds, removedDecorIds: r.removedDecorIds, removedBoxIds: r.removedBoxIds ?? [] };
}

/** Candidate top-left positions for auto-placing a fixture: centre-out, top to bottom. */
function fixtureScan(def) {
  const xs = [];
  const maxX = ROOM.widthIn - def.widthIn;
  const mid = maxX / 2;
  for (let d = 0; d <= maxX; d += 3) {
    xs.push(mid - d);
    if (d) xs.push(mid + d);
  }
  const out = [];
  if (def.mount === 'wall') {
    for (let y = 14; y + def.heightIn <= ROOM.wallHeightIn; y += 4) for (const x of xs) if (x >= 0 && x <= maxX) out.push({ x, y });
  } else {
    for (let base = FLOOR_BAND.yMin + 4; base <= FLOOR_BAND.yMax; base += 4) for (const x of xs) if (x >= 0 && x <= maxX) out.push({ x, y: base - def.heightIn });
  }
  return out;
}

// ------------------------------------------------------------------ windows & doors

export function placePlaceable(booth, libIn, archId, pos, instanceId = null) {
  const lib = normalizeLibrary(libIn);
  const def = byId(lib.architecture)[archId];
  if (!def || def.kind !== 'placeable') return fail('UNKNOWN', booth);
  const list = booth.room?.placeables ?? [];
  const id = instanceId ?? nextId('ar', list.map((p) => p.id));
  const tryAt = (p) => {
    const x = Math.min(ROOM.widthIn - def.widthIn, Math.max(0, Math.round(p.x * 2) / 2));
    const y = def.floorAligned ? ROOM.wallHeightIn : Math.min(ROOM.wallHeightIn, Math.max(def.heightIn, Math.round(p.y * 2) / 2));
    const entry = { id, archId, x, y };
    const placeables = instanceId ? list.map((q) => (q.id === id ? entry : q)) : [...list, entry];
    const next = { ...booth, room: { ...booth.room, placeables } };
    return { ...judge(booth, next, lib, [id]), id };
  };
  if (pos) return tryAt(pos);
  for (let x = (ROOM.widthIn - def.widthIn) / 2, d = 0; d <= ROOM.widthIn; d += 4) {
    for (const cx of [x - d, x + d]) {
      if (cx < 0 || cx > ROOM.widthIn - def.widthIn) continue;
      const r = tryAt({ x: cx, y: def.floorAligned ? ROOM.wallHeightIn : 16 + def.heightIn });
      if (r.ok) return r;
    }
  }
  return { ...fail('NO_SPOT', booth), id };
}

export function removePlaceable(booth, instanceId) {
  return ok({ ...booth, room: { ...booth.room, placeables: (booth.room?.placeables ?? []).filter((p) => p.id !== instanceId) } });
}

// ------------------------------------------------------------------ auto-placement for items & decor

/** Drop points to try when the seller clicks "Place" instead of dragging: shelves and tables first, then floor, then wall. */
export function autoDrops(booth, libIn, mount) {
  const lib = normalizeLibrary(libIn);
  const { surfaces } = buildLayout(booth, lib);
  const drops = [];
  const along = (x1, x2, y) => {
    for (let x = x1 + 2; x <= x2 - 2; x += 2.5) drops.push({ x, y });
  };
  if (mount === 'wall') {
    for (let y = 30; y <= ROOM.wallHeightIn - 8; y += 6) along(0, ROOM.widthIn, y);
    return drops;
  }
  if (mount !== 'flat' && mount !== 'floor') for (const s of surfaces.filter((s) => s.kind === 'line')) along(s.x1, s.x2, s.y);
  for (let y = ROOM.heightIn - 2; y >= FLOOR_BAND.yMin + 2; y -= 4) along(0, ROOM.widthIn, y);
  return drops;
}

/**
 * Click "Place": try the spots that hide the least first (no other item, decor, box or fixture behind or in front
 * of it is best; standing on a rug doesn't count), keeping the usual scan order among equals.
 */
export function autoPlaceItem(booth, libIn, itemId) {
  const lib = normalizeLibrary(libIn);
  const item = (booth.items ?? []).find((i) => i.id === itemId);
  if (!item) return fail('UNKNOWN', booth);
  const L = buildLayout(booth, lib);
  const size = sizeOfItem(item);
  const rect = (x, top, w, h, extra = {}) => ({ x1: x, x2: x + w, y1: top, y2: top + h, ...extra });
  const rects = [
    ...L.items.filter((e) => e.item.id !== itemId && e.item.mount !== 'flat').map((e) => rect(e.x, e.top, e.size.w, e.size.h)),
    ...L.decor.filter((e) => e.mount !== 'flat').map((e) => rect(e.x, e.top, e.size.w, e.size.h)),
    ...L.boxes.map((e) => rect(e.x, e.top, e.size.w, e.size.h)),
    ...L.fixtures.map((f) => rect(f.x, f.y, f.w, f.h, { fixtureId: f.id })),
  ];
  const covered = (d) => {
    const p = snapToSurface(d, size, L.surfaces, item.mount);
    if (!p) return Infinity;
    const r = rect(p.x, p.y - size.h, size.w, size.h);
    const on = p.surfaceId.split(':')[0];
    let area = 0;
    for (const o of rects) {
      if (o.fixtureId === on) continue; // the shelf or table it stands on
      const w = Math.min(r.x2, o.x2) - Math.max(r.x1, o.x1);
      const h = Math.min(r.y2, o.y2) - Math.max(r.y1, o.y1);
      if (w > 0.01 && h > 0.01) area += w * h;
    }
    return area;
  };
  const drops = autoDrops(booth, lib, item.mount)
    .map((d, i) => ({ d, i, area: covered(d) }))
    .filter((x) => x.area < Infinity)
    .sort((a, b) => a.area - b.area || a.i - b.i)
    .map((x) => x.d);
  return firstThatFits(drops, (d) => placeItem(booth, lib, itemId, d));
}

/** First drop that works, via `tryDrop(drop) -> result`. */
export function firstThatFits(drops, tryDrop) {
  let last = null;
  for (const d of drops) {
    const r = tryDrop(d);
    if (r.ok) return r;
    if (r.errors?.[0]?.code === 'OVER_LIMIT') return r;
    last = r;
  }
  return last ? { ...last, ok: false, errors: [{ code: 'NO_SPOT' }] } : { ok: false, errors: [{ code: 'NO_SPOT' }] };
}

// ------------------------------------------------------------------ room settings

/** Toggle a wall strip; strips in the same group (e.g. two baseboards) replace each other. */
export function toggleStrip(room, libIn, stripId) {
  const lib = normalizeLibrary(libIn);
  const defs = byId(lib.architecture);
  const def = defs[stripId];
  if (!def || def.kind !== 'strip') return room;
  const current = room.architecture ?? [];
  if (current.includes(stripId)) return { ...room, architecture: current.filter((id) => id !== stripId) };
  const kept = current.filter((id) => defs[id]?.group !== def.group);
  return { ...room, architecture: [...kept, stripId] };
}
