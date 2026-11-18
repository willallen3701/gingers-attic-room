// Draft <-> booth. The draft is everything a seller arranges in the editor:
//   { room, fixtures, decor, boxes, placements: { [itemId]: {surfaceId, x, y, scaleAdj} | null } }
// boxes: collectibles boxes (shape in logic/boxes.js); items in a box have a null placement.
// Item details (title, price, photos) are NOT part of the draft; only where each item sits.
// A null placement means the item waits in the storage crate.

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const r2 = (v) => Math.round(v * 100) / 100;

/** The size tweak of an item: sizeTweak (view model) or placement.scaleAdj (draft), default 1. */
export function itemTweak(item) {
  const t = item.sizeTweak ?? item.placement?.scaleAdj;
  return typeof t === 'number' && Number.isFinite(t) ? t : 1;
}

function draftPlacement(p, tweak) {
  if (!p) return null;
  return { surfaceId: p.surfaceId, x: r2(p.x), y: r2(p.y), scaleAdj: r2(tweak) };
}

/** Booth (view/editor model) -> draft payload for save-draft. */
export function toDraft(booth) {
  return {
    room: clone(booth.room ?? {}),
    fixtures: clone(booth.fixtures ?? []),
    decor: clone(booth.decor ?? []),
    boxes: clone(booth.boxes ?? []),
    placements: Object.fromEntries((booth.items ?? []).map((it) => [it.id, draftPlacement(it.placement, itemTweak(it))])),
  };
}

/**
 * Apply a draft to a booth. Pure. Items without an entry in draft.placements keep their placement;
 * placements for unknown item ids are ignored.
 */
export function applyDraft(booth, draft) {
  const b = clone(booth);
  if (!draft) return b;
  if (draft.room) b.room = clone(draft.room);
  if (draft.fixtures) b.fixtures = clone(draft.fixtures);
  if (draft.decor) b.decor = clone(draft.decor);
  if (draft.boxes) b.boxes = clone(draft.boxes);
  const pl = draft.placements ?? {};
  b.items = (b.items ?? []).map((it) => {
    if (!Object.prototype.hasOwnProperty.call(pl, it.id)) return it;
    const p = pl[it.id];
    if (!p) return { ...it, placement: null, sizeTweak: 1 };
    return { ...it, placement: { surfaceId: p.surfaceId, x: p.x, y: p.y, scaleAdj: p.scaleAdj ?? 1 }, sizeTweak: p.scaleAdj ?? 1 };
  });
  return b;
}

/** Defaults for a brand-new booth: wallpaper + floor from the library, no light (the user removed it). */
export function defaultRoom(library) {
  const wp = library.wallpapers?.[0];
  const fl = library.floors?.[0];
  return {
    wall: wp ? { type: 'wallpaper', textureId: wp.id, mode: 'tile', scale: 1 } : { type: 'paint', color: '#efe6d2' },
    floor: fl ? { textureId: fl.id, mode: 'tile', scale: 1 } : {},
    light: null,
    architecture: [],
    placeables: [],
    sign: { style: 'wood' },
  };
}
