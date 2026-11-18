// Sizing maths (2026-11-17 batch 2): real size against the 120 in booth, a 4 in minimum, a room-sized maximum,
// and a size slider that clamps instead of snapping back.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROOM } from '../src/logic/room.js';
import { normalizeLibrary } from '../src/logic/library.js';
import { buildLayout } from '../src/logic/layout.js';
import { defaultRoom } from '../src/logic/draft.js';
import { itemSizeIn, realSizeIn, sizeLimits, tweakRange, clampItemTweak, MIN_DRAW_IN, MAX_DRAW_IN, TWEAK_MIN, TWEAK_MAX } from '../src/logic/scale.js';
import { placeItem, setItemScale, setDecorScale, placeDecor, autoDrops, firstThatFits, autoPlaceItem } from '../src/logic/editops.js';

const lib = normalizeLibrary(JSON.parse(readFileSync(new URL('../data/library.json', import.meta.url), 'utf8')));
const item = (id, over = {}) => ({ id, title: id, price: 10, status: 'approved', mount: 'stand', heightIn: 10, aspect: 1, placement: null, ...over });
const booth = (items, fixtures = []) => ({ id: 'b', name: 'T', boothNumber: 1, room: defaultRoom(lib), fixtures, decor: [], items });
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

describe('drawn size follows the real size', () => {
  it('an 80 in armoire is drawn 80 in tall: two thirds of the 120 in booth', () => {
    const armoire = item('arm', { heightIn: 80, aspect: 0.55 });
    expect(itemSizeIn(armoire)).toEqual({ w: 44, h: 80 });
    const r = placeItem(booth([armoire]), lib, 'arm', { x: 60, y: 110 });
    expect(r.ok).toBe(true);
    const L = buildLayout(r.booth, lib);
    expect(L.items[0].size.h / ROOM.widthIn).toBeCloseTo(80 / 120, 6);
    expect(L.items[0].top).toBeGreaterThanOrEqual(0);
  });
  it('ordinary sizes are untouched', () => {
    expect(itemSizeIn(item('a', { heightIn: 6, aspect: 1.5 }))).toEqual({ w: 9, h: 6 });
    expect(sizeLimits(item('a', { heightIn: 6, aspect: 1.5 }))).toEqual({ base: 1, lo: TWEAK_MIN, hi: TWEAK_MAX });
  });
});

describe('tiny items are drawn at least 4 in', () => {
  it('a 2 in thimble is drawn 4 in tall and cannot shrink below it', () => {
    const thimble = item('t', { heightIn: 2, aspect: 1 });
    expect(realSizeIn(thimble)).toEqual({ w: 2, h: 2 });
    expect(itemSizeIn(thimble)).toEqual({ w: 4, h: 4 });
    expect(itemSizeIn(thimble, 0.8)).toEqual({ w: 4, h: 4 });
    expect(itemSizeIn(thimble, 1.2).h).toBeCloseTo(4.8);
    expect(tweakRange(thimble)).toEqual({ lo: 1, hi: 1.2 });
  });
  it('the longer side sets the minimum (a 1 x 6 in spoon is already big enough)', () => {
    expect(itemSizeIn(item('s', { heightIn: 1, aspect: 6 }))).toEqual({ w: 6, h: 1 });
    expect(Math.max(...Object.values(itemSizeIn(item('b', { heightIn: 1, aspect: 2 }))))).toBeCloseTo(MIN_DRAW_IN);
  });
});

describe('huge items are capped so they stay inside the room', () => {
  it('a 108 in standing item is drawn 100 in and cannot grow', () => {
    const tall = item('t', { heightIn: 108, aspect: 0.4 });
    expect(itemSizeIn(tall).h).toBeCloseTo(MAX_DRAW_IN.stand.h);
    expect(tweakRange(tall).hi).toBeCloseTo(1);
    expect(itemSizeIn(tall, 1.2).h).toBeCloseTo(100);
  });
  it('wall items stay on the 90 in wall; rugs stay in the floor band', () => {
    expect(itemSizeIn(item('w', { mount: 'wall', heightIn: 100, aspect: 1 })).h).toBeCloseTo(MAX_DRAW_IN.wall.h);
    const rug = itemSizeIn(item('r', { mount: 'flat', flat: true, widthIn: 140, heightIn: undefined, aspect: 4 }));
    expect(rug.h).toBeCloseTo(MAX_DRAW_IN.flat.h);
    expect(rug.w).toBeLessThanOrEqual(MAX_DRAW_IN.flat.w);
  });
  it('very wide items are capped by width', () => {
    expect(itemSizeIn(item('x', { heightIn: 30, aspect: 5 })).w).toBeCloseTo(MAX_DRAW_IN.stand.w);
  });
  it('a capped item still places inside the room and keeps the cap at its largest size', () => {
    const tall = item('t', { heightIn: 108, aspect: 0.4 });
    const r = firstThatFits(autoDrops(booth([tall]), lib, 'stand'), (d) => placeItem(booth([tall]), lib, 't', d));
    expect(r.ok).toBe(true);
    const e = buildLayout(r.booth, lib).items[0];
    expect(e.top).toBeGreaterThanOrEqual(0);
    expect(e.x).toBeGreaterThanOrEqual(0);
    expect(e.x + e.size.w).toBeLessThanOrEqual(ROOM.widthIn);
    const g = setItemScale(r.booth, lib, 't', 1.2);
    expect(buildLayout(g.booth, lib).items[0].size.h).toBeCloseTo(100);
  });
  it('the library curtains (87.6 in) and grandfather clock keep their real size', () => {
    for (const id of ['curtains-lace', 'clock-grandfather', 'lamp-floor-fringe']) {
      const d = lib.decor.find((x) => x.id === id);
      const s = itemSizeIn({ heightIn: d.heightIn, widthIn: d.widthIn, aspect: d.aspect, mount: d.mount });
      expect(s.h).toBeCloseTo(d.heightIn);
    }
  });
});

describe('the size slider grows and shrinks without snapping back', () => {
  const placed = (over = {}) => placeItem(booth([item('a', { heightIn: 20, aspect: 1, ...over })]), lib, 'a', { x: 60, y: 110 }).booth;
  it('grows and shrinks in the open', () => {
    const b = placed();
    const g = setItemScale(b, lib, 'a', 1.2);
    expect(g.ok).toBe(true);
    expect(g.limited).toBe(false);
    expect(g.tweak).toBe(1.2);
    expect(buildLayout(g.booth, lib).items[0].size.h).toBeCloseTo(24);
    const s = setItemScale(g.booth, lib, 'a', 0.8);
    expect(s.ok).toBe(true);
    expect(buildLayout(s.booth, lib).items[0].size.h).toBeCloseTo(16);
  });
  it('keeps the bottom-centre where it was', () => {
    const b = placed();
    const before = buildLayout(b, lib).items[0];
    const g = buildLayout(setItemScale(b, lib, 'a', 1.2).booth, lib).items[0];
    expect(close(before.x + before.size.w / 2, g.x + g.size.w / 2, 0.01)).toBe(true);
    expect(g.y).toBe(before.y);
  });
  it('next to a neighbour it grows as far as it fits instead of refusing', () => {
    // two 20 in items side by side on the floor, 1 in apart: 'a' can widen by 1 in on each side (to 22 in)
    const b0 = booth([item('a', { heightIn: 20, aspect: 1 }), item('b', { heightIn: 20, aspect: 1 })]);
    const b1 = placeItem(b0, lib, 'a', { x: 40, y: 110 }).booth;
    const b2 = placeItem(b1, lib, 'b', { x: 61, y: 110 }).booth;
    const g = setItemScale(b2, lib, 'a', 1.2);
    expect(g.ok).toBe(true);
    expect(g.limited).toBe(true);
    expect(g.tweak).toBeCloseTo(1.1, 2);
    expect(buildLayout(g.booth, lib).problems).toEqual({});
  });
  it('with no room to grow it says so and keeps the size', () => {
    const b0 = booth([item('a', { heightIn: 20, aspect: 1 }), item('b', { heightIn: 20, aspect: 1 })]);
    const b1 = placeItem(b0, lib, 'a', { x: 40, y: 110 }).booth;
    const b2 = placeItem(b1, lib, 'b', { x: 60, y: 110 }).booth; // touching
    const g = setItemScale(b2, lib, 'a', 1.2);
    expect(g.ok).toBe(false);
    expect(g.errors[0].code).toBe('NO_ROOM_TO_GROW');
    expect(g.tweak).toBe(1);
  });
  it('moving a resized item keeps its size', () => {
    const g = setItemScale(placed(), lib, 'a', 1.15).booth;
    const moved = placeItem(g, lib, 'a', { x: 30, y: 112 });
    expect(moved.ok).toBe(true);
    expect(buildLayout(moved.booth, lib).items[0].size.h).toBeCloseTo(23);
    expect(moved.booth.items[0].placement.scaleAdj).toBe(1.15);
  });
  it('the item range clamps a tweak', () => {
    expect(clampItemTweak(item('t', { heightIn: 2 }), 0.8)).toBe(1);
    expect(clampItemTweak(item('t', { heightIn: 108, aspect: 0.4 }), 1.2)).toBeCloseTo(1);
    expect(clampItemTweak(item('t'), 5)).toBe(1.2);
  });
  it('decor resizes the same way', () => {
    const b = placeDecor(booth([]), lib, 'plant-fern', { x: 60, y: 110 }).booth;
    const g = setDecorScale(b, lib, b.decor[0].id, 1.2);
    expect(g.ok).toBe(true);
    expect(g.booth.decor[0].placement.scaleAdj).toBe(1.2);
  });
});

describe('Place picks a spot that hides nothing when it can', () => {
  it('a 30 in chair does not land in front of a wall shelf when the floor has a clear spot', () => {
    const shelf = { id: 'fx1', fixtureId: 'shelf-stack-4', x: 3, y: 50 };
    const b = booth([item('c', { heightIn: 30, aspect: 0.8 })], [shelf]);
    const r = autoPlaceItem(b, lib, 'c');
    expect(r.ok).toBe(true);
    const e = buildLayout(r.booth, lib).items[0];
    const overlapsShelf = Math.min(e.x + e.size.w, 42) - Math.max(e.x, 3) > 0 && Math.min(e.y, 80) - Math.max(e.top, 50) > 0;
    expect(overlapsShelf).toBe(false);
  });
  it('still places when every spot covers something', () => {
    const r = autoPlaceItem(booth([item('a', { heightIn: 100, aspect: 1.1 })]), lib, 'a');
    expect(r.ok).toBe(true);
  });
});
