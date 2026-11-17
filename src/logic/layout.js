import { ROOM } from './room.js';
import { itemSizeIn } from './scale.js';
import { worldSurfaces } from './surfaces.js';
import { validatePlacement } from './validate.js';

// Turns booth data + library into a render model: rectangles in room inches, draw order, and
// per-item placement problems. Pure: no DOM.

const Z = Object.freeze({ wall: 100, flat: 900, depth: 1000 });

/**
 * @returns {{
 *   fixtures: Array<{id:string, def:object, x:number, y:number, w:number, h:number, z:number}>,
 *   items: Array<{item:object, size:{w:number,h:number}, x:number, y:number, top:number, z:number, placed:boolean}>,
 *   storage: object[],
 *   surfaces: Array,
 *   problems: Record<string, Array>,
 *   placedCount: number,
 * }}
 */
export function buildLayout(booth, library) {
  const fixtureDefs = Object.fromEntries((library.fixtures ?? []).map((f) => [f.id, f]));
  const surfaces = worldSurfaces(booth.fixtures ?? [], fixtureDefs);

  const fixtures = (booth.fixtures ?? []).map((pf) => {
    const def = fixtureDefs[pf.fixtureId];
    const baseY = pf.y + def.heightIn;
    return { id: pf.id, def, x: pf.x, y: pf.y, w: def.widthIn, h: def.heightIn, z: Z.depth + Math.round(baseY * 10) };
  });
  const fixtureZ = Object.fromEntries(fixtures.map((f) => [f.id, f.z]));
  const fixtureRects = fixtures.map((f) => ({ id: f.id, x1: f.x, x2: f.x + f.w, y1: f.y, y2: f.y + f.h }));

  const storage = [];
  const items = [];
  let wallN = 0;
  let flatN = 0;
  const onFixtureN = {};
  for (const item of booth.items ?? []) {
    if (!item.placement) {
      storage.push(item);
      continue;
    }
    const size = itemSizeIn(item, item.sizeTweak);
    const p = item.placement;
    const surface = surfaces.find((s) => s.id === p.surfaceId);
    let z;
    if (item.mount === 'wall') z = Z.wall + wallN++;
    else if (item.mount === 'flat') z = Z.flat + flatN++;
    else if (surface && surface.kind === 'line') {
      const fid = surface.fixtureInstanceId;
      onFixtureN[fid] = (onFixtureN[fid] ?? 0) + 1;
      z = fixtureZ[fid] + onFixtureN[fid];
    } else z = Z.depth + Math.round(p.y * 10);
    items.push({ item, size, x: p.x, y: p.y, top: p.y - size.h, z, placed: true });
  }

  const problems = {};
  const others = items.map((e) => ({ id: e.item.id, mount: e.item.mount, size: e.size, placement: e.item.placement }));
  for (const e of items) {
    const errs = validatePlacement(
      { id: e.item.id, mount: e.item.mount, size: e.size, placement: e.item.placement },
      { surfaces, others, fixtureRects },
    );
    if (errs.length) problems[e.item.id] = errs;
  }
  if (items.length > ROOM.maxPlacedItems) {
    problems._room = [{ code: 'OVER_LIMIT', placed: items.length, max: ROOM.maxPlacedItems }];
  }
  return { fixtures, items, storage, surfaces, problems, placedCount: items.length };
}
