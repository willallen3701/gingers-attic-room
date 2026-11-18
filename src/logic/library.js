import { ROOM } from './room.js';

// Library normalisation. The library JSON is maintained by hand / by the asset pipeline and grows
// over time, so every consumer reads it through normalizeLibrary(), which fills in defaults:
//   fixtures[]     {id, name, category:'shelf'|'table'|'cabinet'|'hanger', mount:'wall'|'floor',
//                   widthIn, heightIn, src, surfaces:[{id,x1,x2,y}], boardThicknessIn}
//   decor[]        {id, name, category, mount:'wall'|'floor'|'stand'|'flat', heightIn, widthIn?, aspect, src,
//                   family?: {id, label, choice, swatch?, order?}}   (pieces of one family are choices of ONE piece: see decorFamily)
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

/**
 * The wallpapers the editor's picker offers. An entry flagged `hidden: true` stays in the library (the live site
 * validates booth wallpaper ids against it, and a booth that already uses it still renders and saves) but is no longer
 * offered. It is listed only while it is the booth's current wallpaper, so the seller can see what is applied and change it.
 */
export function pickerWallpapers(lib, wallCfg = null) {
  const current = wallCfg && !wallCfg.src && wallCfg.type !== 'paint' ? wallCfg.textureId : null;
  return (lib?.wallpapers ?? []).filter((w) => !w.hidden || w.id === current);
}

/**
 * Decor that comes in a few choices (a garland's length, a set's colour or pattern) is one library entry per
 * choice, all carrying the same `family.id`. The seller sees ONE piece in the Decor tab (the family's first entry in the
 * library) and picks the choice on the placed piece; the booth just stores the chosen entry's id as `decorId`, so nothing
 * new is saved (an old site that only knows decor ids stores it unchanged).
 * @returns {{id:string, label:string, members:Array}|null}  members in library order, each with its `family.choice`
 */
export function decorFamily(lib, decorId) {
  const def = (lib?.decor ?? []).find((d) => d.id === decorId);
  const fid = def?.family?.id;
  if (typeof fid !== 'string' || !fid) return null;
  // shown in `family.order` (default: library order); the Decor tab lists the family's first library entry
  const members = lib.decor.map((d, i) => ({ d, i })).filter(({ d }) => d.family?.id === fid).sort((a, b) => (a.d.family.order ?? a.i) - (b.d.family.order ?? b.i)).map(({ d }) => d);
  return members.length > 1 ? { id: fid, label: def.family.label ?? 'Choice', members } : null;
}

/** The decor the Decor tab lists: every entry, except that a family shows only its first entry. */
export function pickerDecor(lib) {
  const seen = new Set();
  return (lib?.decor ?? []).filter((d) => {
    const fid = d.family?.id;
    if (!fid) return true;
    if (seen.has(fid)) return false;
    seen.add(fid);
    return true;
  });
}

export const byId = (list) => Object.fromEntries((list ?? []).map((x) => [x.id, x]));
