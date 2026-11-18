// Collectibles boxes: the draft shape and the editing rules (2026-11-17 batch 2).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROOM } from '../src/logic/room.js';
import { normalizeLibrary } from '../src/logic/library.js';
import { buildLayout } from '../src/logic/layout.js';
import { toDraft, applyDraft, defaultRoom } from '../src/logic/draft.js';
import {
  MAX_BOXES, BOX_STYLES, BOX_LININGS, boxSizeIn, newBox, normalizeBox, regrid, boxedItemIds, boxOfItem, placedPieces, boxProblems,
} from '../src/logic/boxes.js';
import {
  addBox, placeBox, removeBox, setBoxGrid, setBoxLook, assignToBox, clearBoxSlot, storeItem, placeItem, moveFixtureTo, deleteFixture,
} from '../src/logic/editops.js';

const lib = normalizeLibrary(JSON.parse(readFileSync(new URL('../data/library.json', import.meta.url), 'utf8')));
const item = (id, over = {}) => ({ id, title: id, price: 10, status: 'approved', mount: 'stand', heightIn: 2, aspect: 1, placement: null, ...over });
const TABLE = { id: 'fx1', fixtureId: 'table-farm-60', x: 30, y: 65.5 };
const booth = (items = [item('t1'), item('t2'), item('t3')], fixtures = [TABLE]) => ({ id: 'b', name: 'T', boothNumber: 1, room: defaultRoom(lib), fixtures, decor: [], items, boxes: [] });

describe('box shape', () => {
  it('offers three styles, five linings and a 2..4 grid', () => {
    expect(BOX_STYLES.map((s) => s.id)).toEqual(['crate', 'jewelry', 'curio']);
    expect(BOX_LININGS.map((l) => l.id)).toEqual(['plum', 'green', 'red', 'blue', 'cream']);
    expect(MAX_BOXES).toBe(3);
  });
  it('a new box is an empty 3 x 3', () => {
    expect(newBox('bx1', 'jewelry')).toEqual({ id: 'bx1', style: 'jewelry', lining: 'red', cols: 3, rows: 3, placement: null, slots: Array(9).fill(null) });
  });
  it('3 in compartments in a 0.75 in frame: 2 x 2 is 7.5 in (fits a shelf), 4 x 4 is 13.5 in', () => {
    expect(boxSizeIn({ cols: 2, rows: 2 })).toEqual({ w: 7.5, h: 7.5 });
    expect(boxSizeIn({ cols: 4, rows: 3 })).toEqual({ w: 13.5, h: 10.5 });
  });
  it('normalizes bad input', () => {
    const b = normalizeBox({ id: 'bx9', style: 'nope', lining: 'pink', cols: 9, rows: 1, slots: ['a', 5, '', 'b'] });
    expect(b).toMatchObject({ style: 'crate', lining: 'green', cols: 4, rows: 2 });
    expect(b.slots).toEqual(['a', null, null, 'b', null, null, null, null]);
  });
  it('is saved in the draft exactly like this', () => {
    let b = addBox(booth(), lib, 'curio').booth;
    b = assignToBox(b, 'bx1', 4, 't2').booth;
    const draft = JSON.parse(JSON.stringify(toDraft(b)));
    expect(draft.boxes).toHaveLength(1);
    const box = draft.boxes[0];
    expect(Object.keys(box).sort()).toEqual(['cols', 'id', 'lining', 'placement', 'rows', 'slots', 'style']);
    expect(box).toMatchObject({ id: 'bx1', style: 'curio', lining: 'cream', cols: 3, rows: 3 });
    expect(Object.keys(box.placement).sort()).toEqual(['surfaceId', 'x', 'y']);
    expect(box.slots).toEqual([null, null, null, null, 't2', null, null, null, null]);
    expect(draft.placements.t2).toBeNull(); // boxed items have no room placement
    // and it comes back on reload
    const back = applyDraft(booth(), draft);
    expect(back.boxes).toEqual(draft.boxes);
    expect(buildLayout(back, lib).boxes[0].cells[4].id).toBe('t2');
  });
});

describe('placing boxes', () => {
  it('adds a box on a surface, up to three', () => {
    let b = booth();
    for (const s of ['crate', 'jewelry', 'curio']) {
      const r = addBox(b, lib, s);
      expect(r.ok).toBe(true);
      b = r.booth;
    }
    expect(b.boxes.map((x) => x.id)).toEqual(['bx1', 'bx2', 'bx3']);
    expect(buildLayout(b, lib).problems).toEqual({});
    const fourth = addBox(b, lib, 'crate');
    expect(fourth.ok).toBe(false);
    expect(fourth.errors[0].code).toBe('MAX_BOXES');
  });
  it('a box is drawn like a piece of furniture and can be moved', () => {
    const b = addBox(booth(), lib, 'crate', { x: 50, y: 65.5 }).booth;
    const L = buildLayout(b, lib);
    expect(L.boxes[0].box.placement.surfaceId).toBe('fx1:top');
    expect(L.boxes[0].size).toEqual({ w: 10.5, h: 10.5 });
    const m = placeBox(b, lib, 'bx1', { x: 30, y: 110 });
    expect(m.ok).toBe(true);
    expect(m.booth.boxes[0].placement.surfaceId).toBe('floor');
  });
  it('rides with its table and goes when the table goes (its items back to the crate)', () => {
    let b = addBox(booth(), lib, 'crate', { x: 50, y: 65.5 }).booth;
    b = assignToBox(b, 'bx1', 0, 't1').booth;
    const x0 = b.boxes[0].placement.x;
    const moved = moveFixtureTo(b, lib, 'fx1', { x: 40, y: 65.5 });
    expect(moved.ok).toBe(true);
    expect(moved.booth.boxes[0].placement.x).toBeCloseTo(x0 + 10);
    const gone = deleteFixture(moved.booth, 'fx1');
    expect(gone.booth.boxes).toEqual([]);
    expect(gone.removedBoxIds).toEqual(['bx1']);
    expect(gone.storedIds).toContain('t1');
    expect(buildLayout(gone.booth, lib).storage.map((i) => i.id)).toContain('t1');
  });
  it('removing a box frees its items', () => {
    let b = addBox(booth(), lib, 'crate').booth;
    b = assignToBox(b, 'bx1', 2, 't3').booth;
    const r = removeBox(b, 'bx1');
    expect(r.freedIds).toEqual(['t3']);
    expect(r.booth.boxes).toEqual([]);
  });
});

describe('filling compartments', () => {
  it('one item per compartment; an item sits in one place only', () => {
    let b = addBox(booth(), lib, 'jewelry').booth;
    b = addBox(b, lib, 'crate').booth;
    b = assignToBox(b, 'bx1', 0, 't1').booth;
    // into another compartment: it moves
    b = assignToBox(b, 'bx1', 5, 't1').booth;
    expect(b.boxes[0].slots[0]).toBeNull();
    expect(b.boxes[0].slots[5]).toBe('t1');
    // into another box: it moves there
    b = assignToBox(b, 'bx2', 1, 't1').booth;
    expect(boxOfItem(b, 't1')).toEqual({ boxId: 'bx2', slot: 1 });
    expect(b.boxes[0].slots.filter(Boolean)).toEqual([]);
    // a taken compartment: the old item goes back to the crate
    const r = assignToBox(b, 'bx2', 1, 't2');
    expect(r.freedIds).toEqual(['t1']);
    expect(boxOfItem(r.booth, 't1')).toBeNull();
    expect(boxProblems(r.booth)).toEqual([]);
  });
  it('an item from the room leaves the room; storing takes it out of the box', () => {
    let b = placeItem(booth(), lib, 't1', { x: 60, y: 110 }).booth;
    b = addBox(b, lib, 'crate').booth;
    b = assignToBox(b, 'bx1', 3, 't1').booth;
    expect(b.items.find((i) => i.id === 't1').placement).toBeNull();
    const L = buildLayout(b, lib);
    expect(L.items).toEqual([]);
    expect(L.storage.map((i) => i.id)).not.toContain('t1'); // boxed, not in the crate
    expect([...boxedItemIds(b)]).toEqual(['t1']);
    const s = storeItem(b, 't1').booth;
    expect(boxOfItem(s, 't1')).toBeNull();
    expect(buildLayout(s, lib).storage.map((i) => i.id)).toContain('t1');
  });
  it('placing a boxed item in the room takes it out of the box', () => {
    let b = addBox(booth(), lib, 'crate').booth;
    b = assignToBox(b, 'bx1', 0, 't1').booth;
    const r = placeItem(b, lib, 't1', { x: 20, y: 112 });
    expect(r.ok).toBe(true);
    expect(boxOfItem(r.booth, 't1')).toBeNull();
  });
  it('emptying a compartment', () => {
    let b = addBox(booth(), lib, 'crate').booth;
    b = assignToBox(b, 'bx1', 7, 't3').booth;
    const r = clearBoxSlot(b, 'bx1', 7);
    expect(r.freedIds).toEqual(['t3']);
    expect(r.booth.boxes[0].slots[7]).toBeNull();
    expect(clearBoxSlot(b, 'bx1', 9).ok).toBe(false);
  });
});

describe('grid, style and lining', () => {
  it('shrinking the grid frees the items in compartments that disappear', () => {
    const b0 = { ...newBox('bx1'), slots: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] };
    const { box, freed } = regrid(b0, 2, 2);
    expect(box.slots).toEqual(['a', 'b', 'd', 'e']);
    expect(freed.sort()).toEqual(['c', 'f', 'g', 'h', 'i']);
    expect(regrid(b0, 4, 4).box.slots).toEqual(['a', 'b', 'c', null, 'd', 'e', 'f', null, 'g', 'h', 'i', null, null, null, null, null]);
  });
  it('setBoxGrid keeps the bottom-centre and refuses a size that does not fit', () => {
    let b = addBox(booth(), lib, 'crate', { x: 50, y: 65.5 }).booth;
    b = assignToBox(b, 'bx1', 8, 't1').booth;
    const before = buildLayout(b, lib).boxes[0];
    const r = setBoxGrid(b, lib, 'bx1', 2, 2);
    expect(r.ok).toBe(true);
    expect(r.freedIds).toEqual(['t1']);
    const after = buildLayout(r.booth, lib).boxes[0];
    expect(after.x + after.size.w / 2).toBeCloseTo(before.x + before.size.w / 2);
    expect(r.booth.boxes[0].slots).toHaveLength(4);
    // a 4 x 4 box on a shelf with 7.6 in of headroom doesn't fit
    const shelf = { id: 'fx2', fixtureId: 'shelf-stack-4', x: 70, y: 12.2 };
    const s = addBox(booth(undefined, [shelf]), lib, 'crate', { x: 85, y: 12.2 + 17.6 });
    const small = setBoxGrid(s.booth, lib, 'bx1', 2, 2); // a 3 x 3 doesn't fit a middle board, so it went elsewhere
    expect(small.ok).toBe(true);
    const onBoard = placeBox(small.booth, lib, 'bx1', { x: 85, y: 12.2 + 17.6 });
    expect(onBoard.ok).toBe(true);
    expect(onBoard.booth.boxes[0].placement.surfaceId).toBe('fx2:s2');
    expect(setBoxGrid(onBoard.booth, lib, 'bx1', 4, 4).ok).toBe(false);
  });
  it('style and lining change; unknown ids fall back', () => {
    const b = addBox(booth(), lib, 'crate').booth;
    const r = setBoxLook(b, 'bx1', { style: 'jewelry', lining: 'blue' });
    expect(r.booth.boxes[0]).toMatchObject({ style: 'jewelry', lining: 'blue' });
    expect(setBoxLook(b, 'bx1', { lining: 'pink' }).booth.boxes[0].lining).toBe('plum');
  });
});

describe('a box counts as one placed piece', () => {
  const many = (n) => Array.from({ length: n }, (_, i) => item(`m${i}`, { heightIn: 3, aspect: 0.5 }));
  it('pieces = items in the room + boxes; items inside a box do not count', () => {
    let b = addBox(booth(), lib, 'crate').booth;
    b = assignToBox(b, 'bx1', 0, 't1').booth;
    b = assignToBox(b, 'bx1', 1, 't2').booth;
    expect(placedPieces(b)).toBe(1);
    b = placeItem(b, lib, 't3', { x: 20, y: 112 }).booth;
    expect(placedPieces(b)).toBe(2);
    expect(buildLayout(b, lib).placedCount).toBe(2);
  });
  it('the 40th piece can be a box; after that nothing more goes out', () => {
    const items = many(41);
    let b = { ...booth(items, []), items: items.map((it, i) => ({ ...it, placement: i < 39 ? { surfaceId: 'floor', x: (i % 39) * 3, y: 95 + (i % 4) * 7 } : null })) };
    expect(placedPieces(b)).toBe(39);
    b = { ...b, boxes: [{ ...newBox('bx1'), placement: { surfaceId: 'floor', x: 100, y: 119 } }] };
    expect(placedPieces(b)).toBe(ROOM.maxPlacedItems);
    expect(addBox(b, lib, 'jewelry').errors[0].code).toBe('OVER_LIMIT');
    expect(placeItem(b, lib, 'm40', { x: 60, y: 110 }).errors[0].code).toBe('OVER_LIMIT');
    // filling compartments is still allowed
    expect(assignToBox(b, 'bx1', 0, 'm40').ok).toBe(true);
  });
  it('boxProblems flags what the server will refuse', () => {
    const b = booth();
    expect(boxProblems({ ...b, boxes: [newBox('a'), newBox('b'), newBox('c'), newBox('d')] }).map((p) => p.code)).toContain('MAX_BOXES');
    const twice = { ...b, boxes: [{ ...newBox('a'), slots: ['t1', 't1', null, null, null, null, null, null, null] }] };
    expect(boxProblems(twice).map((p) => p.code)).toContain('TWICE');
    const bad = { ...b, boxes: [{ ...newBox('a'), slots: ['t1'] }] };
    expect(boxProblems(bad).map((p) => p.code)).toContain('BAD_GRID');
    const both = { ...b, items: [item('t1', { placement: { surfaceId: 'floor', x: 1, y: 100 } })], boxes: [{ ...newBox('a'), slots: ['t1', null, null, null, null, null, null, null, null] }] };
    expect(boxProblems(both).map((p) => p.code)).toContain('ALSO_IN_ROOM');
  });
});
