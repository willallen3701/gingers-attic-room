// Editor operations on a booth. All pure: each returns { ok, booth, errors } and never mutates its input.
// Acceptance rule for every change: the thing being changed must end up problem-free, and nothing that
// was problem-free before may become a problem (so an old, already-broken layout never blocks edits).

import { ROOM } from './room.js';
import { buildLayout } from './layout.js';
import { snapToSurface } from './snap.js';
import { snapFixture, moveFixture, removeFixture, nextId, FLOOR_BAND } from './fixtures.js';
import { itemSizeIn, clampTweak } from './scale.js';
import { itemTweak } from './draft.js';
import { canPlaceAnother } from './validate.js';
import { normalizeLibrary, byId } from './library.js';

export const REASONS = Object.freeze({
  OVERLAP: 'That would overlap something already there.',
  NO_HEADROOM: 'Not enough room above that shelf.',
  BLOCKED_BY_FIXTURE: 'Something on the wall is in the way.',
  BLOCKED: 'A window or door is in the way.',
  OUT_OF_REGION: "That spot is off the wall or floor.",
  OUT_OF_ROOM: 'That would stick out of the room.',
  OFF_SURFACE: "It doesn't fit on that surface.",
  WRONG_MOUNT: "That can't go there.",
  NO_SURFACE: 'There is nothing there for it to stand on.',
  NO_SPOT: 'No free spot left for that. Move something or add another shelf.',
  OVER_LIMIT: 'Your room is full: 40 items is the limit. Move one to the storage crate first.',
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
  const placed = booth.items.filter((i) => i.placement).length;
  if (!item.placement && !canPlaceAnother(placed)) return fail('OVER_LIMIT', booth);
  const size = sizeOfItem(item);
  const { surfaces } = buildLayout(booth, lib);
  const p = snapToSurface(drop, size, surfaces, item.mount);
  if (!p) return fail('NO_SURFACE', booth);
  const tweak = itemTweak(item);
  const next = setItem(booth, itemId, { placement: { ...p, scaleAdj: tweak }, sizeTweak: tweak });
  return judge(booth, next, lib, [itemId]);
}

/** Back to the storage crate. Always allowed. */
export function storeItem(booth, itemId) {
  return ok(setItem(booth, itemId, { placement: null, sizeTweak: 1 }));
}

/** Change an item's size tweak (0.8..1.2), keeping its bottom-centre where it was. */
export function setItemScale(booth, libIn, itemId, scaleAdj) {
  const lib = normalizeLibrary(libIn);
  const item = (booth.items ?? []).find((i) => i.id === itemId);
  if (!item?.placement) return fail('UNKNOWN', booth);
  const t = clampTweak(scaleAdj);
  const oldSize = sizeOfItem(item);
  const newSize = itemSizeIn(item, t);
  const x = Math.round((item.placement.x + (oldSize.w - newSize.w) / 2) * 100) / 100;
  const next = setItem(booth, itemId, { placement: { ...item.placement, x, scaleAdj: t }, sizeTweak: t });
  return judge(booth, next, lib, [itemId]);
}

// ------------------------------------------------------------------ decor

function decorSize(def, scaleAdj = 1) {
  return itemSizeIn({ heightIn: def.heightIn, widthIn: def.widthIn, aspect: def.aspect, flat: def.mount === 'flat' }, scaleAdj);
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
  const entry = { id, decorId, placement: { ...p, scaleAdj } };
  const next = { ...booth, decor: existing ? decor.map((d) => (d.id === id ? entry : d)) : [...decor, entry] };
  const res = judge(booth, next, lib, [id]);
  return { ...res, id };
}

export function removeDecor(booth, instanceId) {
  return ok({ ...booth, decor: (booth.decor ?? []).filter((d) => d.id !== instanceId) });
}

export function setDecorScale(booth, libIn, instanceId, scaleAdj) {
  const lib = normalizeLibrary(libIn);
  const d = (booth.decor ?? []).find((x) => x.id === instanceId);
  const def = d && byId(lib.decor)[d.decorId];
  if (!def || !d.placement) return fail('UNKNOWN', booth);
  const t = clampTweak(scaleAdj);
  const oldSize = decorSize(def, d.placement.scaleAdj ?? 1);
  const newSize = decorSize(def, t);
  const x = Math.round((d.placement.x + (oldSize.w - newSize.w) / 2) * 100) / 100;
  const next = { ...booth, decor: booth.decor.map((x0) => (x0.id === instanceId ? { ...x0, placement: { ...x0.placement, x, scaleAdj: t } } : x0)) };
  return judge(booth, next, lib, [instanceId]);
}

// ------------------------------------------------------------------ fixtures

const ridingIds = (booth, fixtureInstanceId) => {
  const on = (p) => p?.surfaceId?.startsWith(`${fixtureInstanceId}:`);
  return [...(booth.items ?? []).filter((i) => on(i.placement)).map((i) => i.id), ...(booth.decor ?? []).filter((d) => on(d.placement)).map((d) => d.id)];
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
  return { ok: true, booth: r.booth, errors: [], storedIds: r.storedIds, removedDecorIds: r.removedDecorIds };
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
