// Collectibles boxes: a display box the seller places in the booth (on a shelf, a table or the floor) with a
// grid of compartments, one item per compartment. Pure: no DOM.
//
// Draft shape (draft.boxes, saved with save-draft next to fixtures and decor):
//   {
//     id: 'bx1',                                  // 'bx' + number, unique in the booth
//     style: 'crate' | 'jewelry' | 'curio',       // wooden crate, jewelry box, curio drawer
//     lining: 'plum' | 'green' | 'red' | 'blue' | 'cream',
//     cols: 2..4, rows: 2..4,                     // compartment grid
//     placement: { surfaceId, x, y },             // like decor: x = left edge, y = base, room inches
//     slots: [itemId | null, ...]                 // exactly cols * rows entries, row by row from the top left
//   }
// Rules: at most 3 boxes; an item sits in at most one compartment of one box, and a boxed item has no room
// placement (draft.placements[itemId] is null); each box counts as ONE placed piece toward the 40 (the items
// inside it don't count separately).

import { ROOM } from './room.js';

export const MAX_BOXES = 3;
export const BOX_GRID_MIN = 2;
export const BOX_GRID_MAX = 4;
/** One compartment is 3 in square; the frame adds 0.75 in all round. A 2 x 2 box (7.5 in) fits a shelf. */
export const BOX_CELL_IN = 3;
export const BOX_FRAME_IN = 0.75;

export const BOX_STYLES = Object.freeze([
  { id: 'crate', name: 'Wooden crate', lining: 'green' },
  { id: 'jewelry', name: 'Jewelry box', lining: 'red' },
  { id: 'curio', name: 'Curio drawer', lining: 'cream' },
]);

export const BOX_LININGS = Object.freeze([
  { id: 'plum', name: 'Plum velvet', color: '#5b2a4a' },
  { id: 'green', name: 'Green baize', color: '#24503f' },
  { id: 'red', name: 'Ruby velvet', color: '#7b1e2c' },
  { id: 'blue', name: 'Navy silk', color: '#24375a' },
  { id: 'cream', name: 'Cream silk', color: '#efe2c4' },
]);

const STYLE_IDS = new Set(BOX_STYLES.map((s) => s.id));
const LINING_IDS = new Set(BOX_LININGS.map((l) => l.id));

export const clampGrid = (n) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(BOX_GRID_MAX, Math.max(BOX_GRID_MIN, v)) : 3;
};

export const styleOf = (id) => BOX_STYLES.find((s) => s.id === id) ?? BOX_STYLES[0];
export const liningOf = (id) => BOX_LININGS.find((l) => l.id === id) ?? BOX_LININGS[0];

/** Drawn size of a box in inches. */
export function boxSizeIn(box) {
  return { w: clampGrid(box.cols) * BOX_CELL_IN + 2 * BOX_FRAME_IN, h: clampGrid(box.rows) * BOX_CELL_IN + 2 * BOX_FRAME_IN };
}

/** A new, empty 3 x 3 box of a style (not placed yet). */
export function newBox(id, style = 'crate') {
  const s = styleOf(style);
  return { id, style: s.id, lining: s.lining, cols: 3, rows: 3, placement: null, slots: Array(9).fill(null) };
}

/** A box with every field valid: known style and lining, grid 2..4, slots exactly cols * rows long. */
export function normalizeBox(b) {
  const cols = clampGrid(b?.cols);
  const rows = clampGrid(b?.rows);
  const n = cols * rows;
  const slots = Array.from({ length: n }, (_, i) => (typeof b?.slots?.[i] === 'string' && b.slots[i] ? b.slots[i] : null));
  return {
    id: String(b?.id ?? ''),
    style: STYLE_IDS.has(b?.style) ? b.style : 'crate',
    lining: LINING_IDS.has(b?.lining) ? b.lining : styleOf(b?.style).lining,
    cols,
    rows,
    placement: b?.placement && typeof b.placement.surfaceId === 'string' ? { surfaceId: b.placement.surfaceId, x: b.placement.x, y: b.placement.y } : null,
    slots,
  };
}

/** Re-grid a box: compartments keep their row/column; items in compartments that disappear come out. */
export function regrid(box, cols, rows) {
  const c = clampGrid(cols);
  const r = clampGrid(rows);
  const freed = [];
  const slots = [];
  for (let y = 0; y < r; y++) for (let x = 0; x < c; x++) slots.push(y < box.rows && x < box.cols ? box.slots[y * box.cols + x] ?? null : null);
  box.slots.forEach((id, i) => {
    if (id && (Math.floor(i / box.cols) >= r || i % box.cols >= c)) freed.push(id);
  });
  return { box: { ...box, cols: c, rows: r, slots }, freed };
}

/** Ids of every item sitting in a box. */
export function boxedItemIds(booth) {
  return new Set((booth.boxes ?? []).flatMap((b) => b.slots ?? []).filter(Boolean));
}

/** Where an item is boxed: { boxId, slot } or null. */
export function boxOfItem(booth, itemId) {
  for (const b of booth.boxes ?? []) {
    const slot = (b.slots ?? []).indexOf(itemId);
    if (slot >= 0) return { boxId: b.id, slot };
  }
  return null;
}

/** Take an item out of every box (pure). */
export function unbox(boxes, itemId) {
  return (boxes ?? []).map((b) => ((b.slots ?? []).includes(itemId) ? { ...b, slots: b.slots.map((s) => (s === itemId ? null : s)) } : b));
}

/** Placed pieces toward the room's limit: items out in the room plus boxes (a box counts once). */
export function placedPieces(booth) {
  return (booth.items ?? []).filter((i) => i.placement).length + (booth.boxes ?? []).length;
}

/** Room limit check for one more piece. */
export const roomForAnother = (booth, max = ROOM.maxPlacedItems) => placedPieces(booth) < max;

/** Problems with the boxes list as a whole (the server checks the same). Empty = fine. */
export function boxProblems(booth) {
  const out = [];
  const boxes = booth.boxes ?? [];
  if (boxes.length > MAX_BOXES) out.push({ code: 'MAX_BOXES' });
  const seen = new Set();
  const itemIds = new Set((booth.items ?? []).map((i) => i.id));
  const placed = new Set((booth.items ?? []).filter((i) => i.placement).map((i) => i.id));
  for (const b of boxes) {
    if (!STYLE_IDS.has(b.style) || !LINING_IDS.has(b.lining)) out.push({ code: 'BAD_LOOK', boxId: b.id });
    if (clampGrid(b.cols) !== b.cols || clampGrid(b.rows) !== b.rows || (b.slots ?? []).length !== b.cols * b.rows) out.push({ code: 'BAD_GRID', boxId: b.id });
    for (const id of b.slots ?? []) {
      if (!id) continue;
      if (!itemIds.has(id)) out.push({ code: 'UNKNOWN_ITEM', boxId: b.id, itemId: id });
      if (seen.has(id)) out.push({ code: 'TWICE', itemId: id });
      if (placed.has(id)) out.push({ code: 'ALSO_IN_ROOM', itemId: id });
      seen.add(id);
    }
  }
  if (placedPieces(booth) > ROOM.maxPlacedItems) out.push({ code: 'OVER_LIMIT' });
  return out;
}
