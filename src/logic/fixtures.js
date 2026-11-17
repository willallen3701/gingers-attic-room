import { ROOM } from './room.js';

// Fixtures (shelves, tables, cabinets, wall hangers) in the editor.
// A placed fixture is { id, fixtureId, x, y }: x = LEFT edge, y = TOP edge, in room inches
// (same as the booth JSON). Sizes are fixed by the library entry; size versions are separate entries.
//  - mount 'wall':  hangs on the back wall; must fit inside the wall band (y 0..90).
//  - mount 'floor': stands on the floor; its BASE (y + heightIn) sits somewhere in the floor band,
//                   which is the fixture's depth: a lower base = nearer the viewer = drawn in front.

export const FLOOR_BAND = Object.freeze({ yMin: ROOM.wallHeightIn + 1, yMax: ROOM.heightIn - 0.5 });
/** Two floor fixtures whose bases are at least this far apart (depth) may overlap side to side. */
export const FIXTURE_DEPTH_GAP_IN = 6;
export const GRID_IN = 0.5;

const EPS = 0.01;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const snapGrid = (v) => Math.round(v / GRID_IN) * GRID_IN;
const overlap1d = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1) > EPS;

export function fixtureRect(pf, def) {
  return { id: pf.id, x1: pf.x, x2: pf.x + def.widthIn, y1: pf.y, y2: pf.y + def.heightIn };
}

/**
 * Snap a proposed top-left position for a fixture. Returns null when the fixture can't fit the room at all.
 * @param {{x:number, y:number}} pos  proposed top-left, room inches
 * @param {{widthIn:number, heightIn:number, mount:'wall'|'floor'}} def
 */
export function snapFixture(pos, def) {
  const w = def.widthIn;
  const h = def.heightIn;
  if (!(w > 0) || !(h > 0) || w > ROOM.widthIn) return null;
  const x = clamp(snapGrid(pos.x), 0, ROOM.widthIn - w);
  if (def.mount === 'wall') {
    if (h > ROOM.wallHeightIn) return null;
    return { x, y: clamp(snapGrid(pos.y), 0, ROOM.wallHeightIn - h) };
  }
  if (h > FLOOR_BAND.yMax) return null;
  const base = clamp(snapGrid(pos.y + h), FLOOR_BAND.yMin, FLOOR_BAND.yMax);
  return { x, y: base - h };
}

/**
 * Problems with one placed fixture. Codes: UNKNOWN_FIXTURE, OUT_OF_ROOM, OUT_OF_REGION, OVERLAP, BLOCKED.
 * @param {{id:string, fixtureId:string, x:number, y:number}} pf
 * @param {{fixtures:Array, defs:Record<string,object>, obstacles?:Array<{id:string,x1:number,x2:number,y1:number,y2:number}>}} ctx
 *   obstacles: wall openings (windows/doors) a wall fixture may not cover
 */
export function validateFixture(pf, ctx) {
  const def = ctx.defs[pf.fixtureId];
  if (!def) return [{ code: 'UNKNOWN_FIXTURE', fixtureId: pf.fixtureId }];
  const errors = [];
  const r = fixtureRect(pf, def);
  if (r.x1 < -EPS || r.x2 > ROOM.widthIn + EPS || r.y1 < -EPS || r.y2 > ROOM.heightIn + EPS) errors.push({ code: 'OUT_OF_ROOM' });
  if (def.mount === 'wall') {
    if (r.y2 > ROOM.wallHeightIn + EPS) errors.push({ code: 'OUT_OF_REGION', region: 'wall' });
  } else if (r.y2 < FLOOR_BAND.yMin - EPS || r.y2 > FLOOR_BAND.yMax + EPS) {
    errors.push({ code: 'OUT_OF_REGION', region: 'floor' });
  }
  for (const o of ctx.fixtures) {
    if (o.id === pf.id) continue;
    const od = ctx.defs[o.fixtureId];
    if (!od || od.mount !== def.mount) continue; // a table standing in front of a wall shelf is fine
    const or = fixtureRect(o, od);
    const clash =
      def.mount === 'wall'
        ? overlap1d(r.x1, r.x2, or.x1, or.x2) && overlap1d(r.y1, r.y2, or.y1, or.y2)
        : overlap1d(r.x1, r.x2, or.x1, or.x2) && Math.abs(r.y2 - or.y2) < FIXTURE_DEPTH_GAP_IN;
    if (clash) errors.push({ code: 'OVERLAP', withId: o.id });
  }
  if (def.mount === 'wall') {
    for (const ob of ctx.obstacles ?? []) {
      if (overlap1d(r.x1, r.x2, ob.x1, ob.x2) && overlap1d(r.y1, r.y2, ob.y1, ob.y2)) errors.push({ code: 'BLOCKED', withId: ob.id });
    }
  }
  return errors;
}

const ridesOn = (placement, fixtureInstanceId) =>
  !!placement && typeof placement.surfaceId === 'string' && placement.surfaceId.startsWith(`${fixtureInstanceId}:`);

/**
 * Move a fixture; items and decor standing on it ride along. Pure: returns a new booth.
 * @param {object} booth
 * @param {string} fixtureInstanceId
 * @param {{x:number, y:number}} to  new top-left (already snapped)
 */
export function moveFixture(booth, fixtureInstanceId, to) {
  const pf = (booth.fixtures ?? []).find((f) => f.id === fixtureInstanceId);
  if (!pf) return booth;
  const dx = to.x - pf.x;
  const dy = to.y - pf.y;
  const shift = (p) => (ridesOn(p, fixtureInstanceId) ? { ...p, x: round2(p.x + dx), y: round2(p.y + dy) } : p);
  return {
    ...booth,
    fixtures: booth.fixtures.map((f) => (f.id === fixtureInstanceId ? { ...f, x: to.x, y: to.y } : f)),
    items: (booth.items ?? []).map((it) => (ridesOn(it.placement, fixtureInstanceId) ? { ...it, placement: shift(it.placement) } : it)),
    decor: (booth.decor ?? []).map((d) => (ridesOn(d.placement, fixtureInstanceId) ? { ...d, placement: shift(d.placement) } : d)),
  };
}

/**
 * Remove a fixture. Items on it go back to the storage crate; decor on it is removed (decor is free to re-add).
 * @returns {{booth:object, storedIds:string[], removedDecorIds:string[]}}
 */
export function removeFixture(booth, fixtureInstanceId) {
  const storedIds = [];
  const removedDecorIds = [];
  const items = (booth.items ?? []).map((it) => {
    if (!ridesOn(it.placement, fixtureInstanceId)) return it;
    storedIds.push(it.id);
    return { ...it, placement: null };
  });
  const decor = (booth.decor ?? []).filter((d) => {
    if (!ridesOn(d.placement, fixtureInstanceId)) return true;
    removedDecorIds.push(d.id);
    return false;
  });
  return {
    booth: { ...booth, fixtures: (booth.fixtures ?? []).filter((f) => f.id !== fixtureInstanceId), items, decor },
    storedIds,
    removedDecorIds,
  };
}

/** A fresh instance id that doesn't clash with existing ones (e.g. "fx4", "dc2", "ar1"). */
export function nextId(prefix, existing) {
  const used = new Set(existing);
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

const round2 = (v) => Math.round(v * 100) / 100;
