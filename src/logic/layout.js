import { ROOM } from './room.js';
import { itemSizeIn } from './scale.js';
import { worldSurfaces } from './surfaces.js';
import { validatePlacement } from './validate.js';
import { validateFixture, fixtureRect } from './fixtures.js';
import { normalizeLibrary, byId } from './library.js';
import { itemTweak } from './draft.js';
import { boxSizeIn, boxedItemIds } from './boxes.js';

// Turns booth data + library into a render model: rectangles in room inches, draw order, and
// per-entity placement problems. Pure: no DOM.
//   booth.fixtures[]          {id, fixtureId, x, y}            (top-left)
//   booth.items[]             {id, ..., mount, heightIn|widthIn, aspect, placement|null, sizeTweak?}
//   booth.decor[]             {id, decorId, placement:{surfaceId,x,y,scaleAdj?}}   (never for sale)
//   booth.room.placeables[]   {id, archId, x, y}               (windows/doors; x = left, y = BASE)
//   booth.boxes[]             {id, style, lining, cols, rows, placement, slots}  (collectibles boxes, logic/boxes.js)

/**
 * Kinds of window/door ('window', 'door') a decor piece may overlap on the wall: the library entry's `mayOverlap` list
 * (data-driven; only wall decor, and only the garland and the wreath carry it). It never frees a piece from overlapping
 * other decor, items, boxes or wall fixtures.
 */
export function decorMayOverlap(def) {
  if (!def || def.mount !== 'wall' || !Array.isArray(def.mayOverlap)) return [];
  return def.mayOverlap.filter((k) => k === 'window' || k === 'door');
}

const Z = Object.freeze({ placeable: 40, wall: 100, flat: 900, depth: 1000 });

/** Item/decor mount -> the mount the snapping/validation code understands. */
const decorMount = (m) => (m === 'floor' ? 'floor' : m === 'wall' ? 'wall' : m === 'flat' ? 'flat' : 'stand');

/**
 * @returns {{
 *   fixtures: Array<{id:string, def:object, x:number, y:number, w:number, h:number, z:number}>,
 *   items: Array<{item:object, size:{w:number,h:number}, x:number, y:number, top:number, z:number, placed:boolean}>,
 *   decor: Array<{decor:object, def:object, size:{w:number,h:number}, x:number, y:number, top:number, z:number, mount:string}>,
 *   placeables: Array<{id:string, def:object, x:number, y:number, top:number, w:number, h:number, z:number}>,
 *   boxes: Array<{box:object, size:{w:number,h:number}, x:number, y:number, top:number, z:number, cells:Array<object|null>}>,
 *   storage: object[],
 *   surfaces: Array,
 *   problems: Record<string, Array>,
 *   placedCount: number,
 * }}
 */
export function buildLayout(booth, libraryIn) {
  const library = normalizeLibrary(libraryIn);
  const fixtureDefs = byId(library.fixtures);
  const decorDefs = byId(library.decor);
  const archDefs = byId(library.architecture);
  const problems = {};

  const knownFixtures = (booth.fixtures ?? []).filter((pf) => {
    if (fixtureDefs[pf.fixtureId]) return true;
    problems[pf.id] = [{ code: 'UNKNOWN_FIXTURE', fixtureId: pf.fixtureId }];
    return false;
  });
  const surfaces = worldSurfaces(knownFixtures, fixtureDefs);

  const fixtures = knownFixtures.map((pf) => {
    const def = fixtureDefs[pf.fixtureId];
    const baseY = pf.y + def.heightIn;
    const z = def.mount === 'wall' ? Z.wall + 50 + Math.round(baseY) : Z.depth + Math.round(baseY * 10);
    return { id: pf.id, def, x: pf.x, y: pf.y, w: def.widthIn, h: def.heightIn, z };
  });
  const fixtureZ = Object.fromEntries(fixtures.map((f) => [f.id, f.z]));

  const placeables = (booth.room?.placeables ?? [])
    .map((p, i) => {
      const def = archDefs[p.archId];
      if (!def || def.kind !== 'placeable') return null;
      return { id: p.id, def, x: p.x, y: p.y, top: p.y - def.heightIn, w: def.widthIn, h: def.heightIn, z: Z.placeable + i };
    })
    .filter(Boolean);
  const placeableRects = placeables.map((p) => ({ id: p.id, x1: p.x, x2: p.x + p.w, y1: p.top, y2: p.y }));
  // What a placeable is, for decor that may hang over some kinds of them (library `mayOverlap`, see decorMayOverlap).
  const placeableKind = Object.fromEntries(placeables.map((p) => [p.id, p.def.category]));
  const fixtureRects = [...fixtures.map((f) => fixtureRect({ id: f.id, x: f.x, y: f.y }, f.def)), ...placeableRects];

  let wallN = 0;
  let flatN = 0;
  const onFixtureN = {};
  const zFor = (mount, p) => {
    const surface = surfaces.find((s) => s.id === p.surfaceId);
    if (mount === 'wall') return Z.wall + wallN++;
    if (mount === 'flat') return Z.flat + flatN++;
    if (surface && surface.kind === 'line') {
      const fid = surface.fixtureInstanceId;
      onFixtureN[fid] = (onFixtureN[fid] ?? 0) + 1;
      return fixtureZ[fid] + onFixtureN[fid];
    }
    return Z.depth + Math.round(p.y * 10);
  };

  const storage = [];
  const items = [];
  const boxed = boxedItemIds(booth);
  for (const item of booth.items ?? []) {
    if (!item.placement) {
      if (!boxed.has(item.id)) storage.push(item); // boxed items live in their box, not the crate
      continue;
    }
    const size = itemSizeIn(item, itemTweak(item));
    const p = item.placement;
    items.push({ item, size, x: p.x, y: p.y, top: p.y - size.h, z: zFor(item.mount, p), placed: true });
  }

  const decor = [];
  for (const d of booth.decor ?? []) {
    const def = decorDefs[d.decorId];
    if (!def) {
      problems[d.id] = [{ code: 'UNKNOWN_DECOR', decorId: d.decorId }];
      continue;
    }
    if (!d.placement) continue;
    const mount = decorMount(def.mount);
    const size = itemSizeIn({ heightIn: def.heightIn, widthIn: def.widthIn, aspect: def.aspect, flat: mount === 'flat', mount }, d.placement.scaleAdj ?? 1);
    const p = d.placement;
    decor.push({ decor: d, def, mount, size, x: p.x, y: p.y, top: p.y - size.h, z: zFor(mount, p) });
  }

  const itemById = new Map((booth.items ?? []).map((i) => [i.id, i]));
  const boxes = [];
  for (const b of booth.boxes ?? []) {
    if (!b.placement) continue;
    const size = boxSizeIn(b);
    const p = b.placement;
    boxes.push({ box: b, size, x: p.x, y: p.y, top: p.y - size.h, z: zFor('stand', p), cells: (b.slots ?? []).map((id) => (id ? itemById.get(id) ?? null : null)) });
  }

  const others = [
    ...items.map((e) => ({ id: e.item.id, mount: e.item.mount, size: e.size, placement: e.item.placement })),
    ...decor.map((e) => ({ id: e.decor.id, mount: e.mount, size: e.size, placement: e.decor.placement })),
    ...boxes.map((e) => ({ id: e.box.id, mount: 'stand', size: e.size, placement: e.box.placement })),
  ];
  const decorDefOf = Object.fromEntries(decor.map((e) => [e.decor.id, e.def]));
  for (const o of others) {
    // A garland or wreath (library `mayOverlap: ['window']`) may hang over a window; every other wall piece may not.
    const may = decorMayOverlap(decorDefOf[o.id]);
    const rects = may.length ? fixtureRects.filter((r) => !may.includes(placeableKind[r.id])) : fixtureRects;
    const errs = validatePlacement(o, { surfaces, others, fixtureRects: rects });
    if (errs.length) problems[o.id] = errs;
  }
  for (const pf of knownFixtures) {
    const errs = validateFixture(pf, { fixtures: knownFixtures, defs: fixtureDefs, obstacles: placeableRects });
    if (errs.length) problems[pf.id] = errs;
  }
  for (const p of placeables) {
    const r = placeableRects.find((x) => x.id === p.id);
    const errs = [];
    if (r.x1 < -0.01 || r.x2 > ROOM.widthIn + 0.01 || r.y1 < -0.01 || r.y2 > ROOM.wallHeightIn + 0.01) errs.push({ code: 'OUT_OF_REGION', region: 'wall' });
    for (const o of placeableRects) {
      if (o.id !== p.id && Math.min(r.x2, o.x2) - Math.max(r.x1, o.x1) > 0.01 && Math.min(r.y2, o.y2) - Math.max(r.y1, o.y1) > 0.01) errs.push({ code: 'OVERLAP', withId: o.id });
    }
    if (errs.length) problems[p.id] = errs;
  }
  // A collectibles box counts as one placed piece; the items inside it don't count separately.
  const pieces = items.length + boxes.length;
  if (pieces > ROOM.maxPlacedItems) {
    problems._room = [{ code: 'OVER_LIMIT', placed: pieces, max: ROOM.maxPlacedItems }];
  }
  return { fixtures, items, decor, placeables, boxes, storage, surfaces, problems, placedCount: pieces };
}
