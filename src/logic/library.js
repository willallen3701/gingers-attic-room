import { ROOM } from './room.js';

// Library normalisation. The library JSON is maintained by hand / by the asset pipeline and grows
// over time, so every consumer reads it through normalizeLibrary(), which fills in defaults:
//   fixtures[]     {id, name, category:'shelf'|'table'|'cabinet'|'hanger', mount:'wall'|'floor',
//                   widthIn, heightIn, src, surfaces:[{id,x1,x2,y}], boardThicknessIn}
//   decor[]        {id, name, category, mount:'wall'|'floor'|'stand'|'flat', heightIn, widthIn?, aspect, src}
//   architecture[] {id, name, kind:'strip'|'placeable', ...}
//                  strip:     spans the wall; top from topIn, or anchor 'top'|'bottom' + offsetIn; heightIn;
//                             color and/or src (repeat-x image); group (mutually exclusive set)
//                  placeable: window/door on the wall; widthIn, heightIn, src; floorAligned (doors)
// Older entries use `image` instead of `src`, `kind:'shelf'|'table'` instead of `category`, and
// `kind:'baseboard'` for the baseboard strip; all of those still work.

const CATEGORY_FROM_KIND = { shelf: 'shelf', table: 'table', cabinet: 'cabinet', hanger: 'hanger', stand: 'table' };
const WALL_CATEGORIES = new Set(['shelf', 'hanger']);

export function normalizeFixture(f) {
  const category = f.category ?? CATEGORY_FROM_KIND[f.kind] ?? 'shelf';
  return {
    ...f,
    category,
    mount: f.mount === 'wall' || f.mount === 'floor' ? f.mount : WALL_CATEGORIES.has(category) ? 'wall' : 'floor',
    src: f.src ?? f.image ?? '',
    surfaces: Array.isArray(f.surfaces) ? f.surfaces : [],
    boardThicknessIn: f.boardThicknessIn ?? 1,
  };
}

export function normalizeDecor(d) {
  const mount = ['wall', 'floor', 'stand', 'flat'].includes(d.mount) ? d.mount : 'stand';
  const aspect = d.aspect > 0 ? d.aspect : d.widthIn > 0 && d.heightIn > 0 ? d.widthIn / d.heightIn : 1;
  return { ...d, category: d.category ?? 'decor', mount, aspect, src: d.src ?? d.image ?? '' };
}

export function normalizeArchitecture(a) {
  if (a.kind === 'placeable') {
    const isDoor = a.category === 'door' || /door/i.test(`${a.id} ${a.name ?? ''}`);
    return { ...a, src: a.src ?? a.image ?? '', floorAligned: a.floorAligned ?? isDoor, category: a.category ?? (isDoor ? 'door' : 'window') };
  }
  // 'baseboard' (legacy) and 'strip'
  const isTop = a.anchor === 'top' || a.position === 'top' || /crown|cornice|frieze/i.test(`${a.id} ${a.name ?? ''}`);
  return {
    ...a,
    kind: 'strip',
    anchor: a.anchor ?? (isTop ? 'top' : 'bottom'),
    offsetIn: a.offsetIn ?? 0,
    heightIn: a.heightIn > 0 ? a.heightIn : 4,
    group: a.group ?? (a.kind === 'baseboard' || /baseboard|skirting/i.test(a.id) ? 'baseboard' : a.id),
    src: a.src ?? a.image ?? null,
  };
}

/** Top edge (room inches) of a wall strip. */
export function stripTopIn(strip) {
  if (typeof strip.topIn === 'number') return strip.topIn;
  return strip.anchor === 'top' ? strip.offsetIn : ROOM.wallHeightIn - strip.offsetIn - strip.heightIn;
}

export function normalizeLibrary(lib = {}) {
  if (lib.__normalized) return lib;
  return {
    ...lib,
    __normalized: true,
    wallpapers: lib.wallpapers ?? [],
    floors: lib.floors ?? [],
    paints: lib.paints ?? [],
    lights: lib.lights ?? [],
    fixtures: (lib.fixtures ?? []).map(normalizeFixture),
    decor: (lib.decor ?? []).map(normalizeDecor),
    architecture: (lib.architecture ?? []).map(normalizeArchitecture),
  };
}

export const byId = (list) => Object.fromEntries((list ?? []).map((x) => [x.id, x]));
