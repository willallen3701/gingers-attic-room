import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROOM, pct, pxPerInch } from '../src/logic/room.js';
import { clampTweak, itemSizeIn } from '../src/logic/scale.js';
import { worldSurfaces } from '../src/logic/surfaces.js';
import { snapToSurface } from '../src/logic/snap.js';
import { validatePlacement, canPlaceAnother } from '../src/logic/validate.js';
import { backgroundFor, clampScale } from '../src/logic/tile.js';
import { isAllowedOrigin } from '../src/logic/origin.js';
import { buildLayout } from '../src/logic/layout.js';

const library = JSON.parse(readFileSync(new URL('../data/library.json', import.meta.url), 'utf8'));
const demo = JSON.parse(readFileSync(new URL('../data/demo-booth.json', import.meta.url), 'utf8'));
const defs = Object.fromEntries(library.fixtures.map((f) => [f.id, f]));
const fixtures = [
  { id: 'fx1', fixtureId: 'shelf-stack-4', x: 3, y: 12.2 },
  { id: 'fx3', fixtureId: 'table-farm-60', x: 58, y: 65.5 },
];
const surfaces = worldSurfaces(fixtures, defs);
const byId = (id) => surfaces.find((s) => s.id === id);

describe('room units', () => {
  it('is a square 10 ft room with the wall taking 3/4', () => {
    expect(ROOM.widthIn).toBe(120);
    expect(ROOM.heightIn).toBe(120);
    expect(ROOM.wallHeightIn / ROOM.heightIn).toBe(0.75);
  });
  it('converts inches to percent and px-per-inch', () => {
    expect(pct(60)).toBe(50);
    expect(pxPerInch(960)).toBe(8);
    expect(() => pxPerInch(0)).toThrow(RangeError);
  });
});

describe('real-size scale', () => {
  it('clamps the seller tweak to +/-20 %', () => {
    expect(clampTweak(1.5)).toBe(1.2);
    expect(clampTweak(0.1)).toBe(0.8);
    expect(clampTweak(1.1)).toBe(1.1);
    expect(clampTweak(undefined)).toBe(1);
    expect(clampTweak(NaN)).toBe(1);
  });
  it('sizes standing items from height and aspect', () => {
    expect(itemSizeIn({ heightIn: 10, aspect: 0.5 })).toEqual({ w: 5, h: 10 });
    const t = itemSizeIn({ heightIn: 10, aspect: 0.5 }, 1.2);
    expect(t.h).toBeCloseTo(12);
    expect(t.w).toBeCloseTo(6);
    expect(itemSizeIn({ heightIn: 10, aspect: 1 }, 9).h).toBeCloseTo(12); // tweak clamped
  });
  it('sizes flat items (rugs) from width', () => {
    expect(itemSizeIn({ widthIn: 60, aspect: 4, flat: true })).toEqual({ w: 60, h: 15 });
  });
  it('rejects missing dimensions', () => {
    expect(() => itemSizeIn({ aspect: 1 })).toThrow(RangeError);
    expect(() => itemSizeIn({ heightIn: 5, aspect: 0 })).toThrow(RangeError);
    expect(() => itemSizeIn({ aspect: 2, flat: true })).toThrow(RangeError);
  });
});

describe('surfaces', () => {
  it('converts fixture-local surfaces to room coordinates', () => {
    const s2 = byId('fx1:s2');
    expect(s2.x1).toBeCloseTo(3.5);
    expect(s2.x2).toBeCloseTo(41.5);
    expect(s2.y).toBeCloseTo(29.8);
    expect(byId('fx3:top').y).toBeCloseTo(65.5);
  });
  it('computes headroom to the board above, and to the ceiling for the top board', () => {
    expect(byId('fx1:s1').headroomIn).toBeCloseTo(8.8 - 1.2);
    expect(byId('fx1:s0').headroomIn).toBeCloseTo(12.2);
    // table sits under nothing that overlaps it horizontally in this layout -> ceiling
    expect(byId('fx3:top').headroomIn).toBeCloseTo(65.5);
  });
  it('always has a floor band and a wall region', () => {
    expect(byId('floor').yMin).toBeGreaterThan(ROOM.wallHeightIn);
    expect(byId('wall').yMax).toBe(ROOM.wallHeightIn);
  });
  it('throws on an unknown fixture', () => {
    expect(() => worldSurfaces([{ id: 'x', fixtureId: 'nope', x: 0, y: 0 }], defs)).toThrow(/Unknown fixture/);
  });
});

describe('snap to surface', () => {
  const cup = { w: 5, h: 3.2 };
  it('drops a cup onto the nearest shelf board', () => {
    const p = snapToSurface({ x: 20, y: 28 }, cup, surfaces, 'stand');
    expect(p.surfaceId).toBe('fx1:s2');
    expect(p.y).toBeCloseTo(29.8);
    expect(p.x).toBeCloseTo(17.5);
  });
  it('clamps x so the item stays on the board', () => {
    const p = snapToSurface({ x: 41, y: 30 }, cup, surfaces, 'stand');
    expect(p.surfaceId).toBe('fx1:s2');
    expect(p.x + cup.w).toBeLessThanOrEqual(41.5 + 1e-9);
  });
  it('skips shelves without enough headroom', () => {
    const tall = { w: 6, h: 9 };
    const p = snapToSurface({ x: 20, y: 30 }, tall, surfaces, 'stand');
    expect(p.surfaceId).not.toBe('fx1:s2'); // 7.6 in headroom
    expect(['fx1:s0', 'fx3:top', 'floor']).toContain(p.surfaceId);
  });
  it('puts tall things on the floor when dropped low', () => {
    const chair = { w: 32, h: 34 };
    const p = snapToSurface({ x: 20, y: 105 }, chair, surfaces, 'stand');
    expect(p.surfaceId).toBe('floor');
    expect(p.y).toBe(105);
  });
  it('lands on the table when dropped near the tabletop', () => {
    const p = snapToSurface({ x: 80, y: 63 }, { w: 10, h: 8 }, surfaces, 'stand');
    expect(p.surfaceId).toBe('fx3:top');
    expect(p.y).toBeCloseTo(65.5);
  });
  it('keeps wall items inside the wall', () => {
    const p = snapToSurface({ x: 119, y: 2 }, { w: 20, h: 30 }, surfaces, 'wall');
    expect(p.surfaceId).toBe('wall');
    expect(p.x).toBe(100);
    expect(p.y).toBe(30);
  });
  it('keeps flat rugs inside the floor band', () => {
    const p = snapToSurface({ x: 60, y: 92 }, { w: 60, h: 14 }, surfaces, 'flat');
    expect(p.surfaceId).toBe('floor');
    expect(p.y - 14).toBeGreaterThanOrEqual(byId('floor').yMin - 1e-9);
  });
  it('returns null when nothing can hold the item', () => {
    expect(snapToSurface({ x: 60, y: 50 }, { w: 200, h: 5 }, surfaces, 'stand')).toBeNull();
    expect(snapToSurface({ x: 60, y: 50 }, { w: 10, h: 100 }, surfaces, 'wall')).toBeNull();
  });
});

describe('placement validation', () => {
  const ctx = (others = []) => ({
    surfaces,
    others,
    fixtureRects: [{ id: 'fx1', x1: 3, x2: 42, y1: 12.2, y2: 43.2 }],
  });
  const cupAt = (id, x) => ({ id, mount: 'stand', size: { w: 5, h: 3.2 }, placement: { surfaceId: 'fx1:s2', x, y: 29.8 } });

  it('accepts a cup sitting on a board', () => {
    expect(validatePlacement(cupAt('a', 10), ctx())).toEqual([]);
  });
  it('flags overlap with another item on the same board', () => {
    const errs = validatePlacement(cupAt('a', 10), ctx([cupAt('b', 13)]));
    expect(errs).toContainEqual({ code: 'OVERLAP', withId: 'b' });
  });
  it('allows items that just touch', () => {
    expect(validatePlacement(cupAt('a', 10), ctx([cupAt('b', 15)]))).toEqual([]);
  });
  it('flags floating items and missing headroom', () => {
    const floating = { ...cupAt('a', 10), placement: { surfaceId: 'fx1:s2', x: 10, y: 27 } };
    expect(validatePlacement(floating, ctx()).map((e) => e.code)).toContain('OFF_SURFACE');
    const tall = { ...cupAt('a', 10), size: { w: 5, h: 9 } };
    expect(validatePlacement(tall, ctx()).map((e) => e.code)).toContain('NO_HEADROOM');
  });
  it('flags unknown surfaces and wrong mounts', () => {
    expect(validatePlacement({ ...cupAt('a', 10), placement: { surfaceId: 'zz', x: 0, y: 0 } }, ctx())[0].code).toBe('UNKNOWN_SURFACE');
    const wallOnShelf = { ...cupAt('a', 10), mount: 'wall' };
    expect(validatePlacement(wallOnShelf, ctx()).map((e) => e.code)).toContain('WRONG_MOUNT');
  });
  it('keeps wall art off the fixtures and inside the wall', () => {
    const art = { id: 'art', mount: 'wall', size: { w: 20, h: 30 }, placement: { surfaceId: 'wall', x: 30, y: 45 } };
    expect(validatePlacement(art, ctx()).map((e) => e.code)).toContain('BLOCKED_BY_FIXTURE');
    const low = { ...art, placement: { surfaceId: 'wall', x: 50, y: 95 } };
    expect(validatePlacement(low, ctx()).map((e) => e.code)).toContain('OUT_OF_REGION');
  });
  it('lets a chair stand on a rug but not inside another chair', () => {
    const rug = { id: 'rug', mount: 'flat', size: { w: 60, h: 14 }, placement: { surfaceId: 'floor', x: 20, y: 112 } };
    const chair = { id: 'c1', mount: 'stand', size: { w: 30, h: 34 }, placement: { surfaceId: 'floor', x: 25, y: 108 } };
    const chair2 = { id: 'c2', mount: 'stand', size: { w: 30, h: 34 }, placement: { surfaceId: 'floor', x: 40, y: 110 } };
    expect(validatePlacement(chair, ctx([rug]))).toEqual([]);
    expect(validatePlacement(chair, ctx([rug, chair2]))).toContainEqual({ code: 'OVERLAP', withId: 'c2' });
  });
  it('caps a room at 40 placed items', () => {
    expect(canPlaceAnother(39)).toBe(true);
    expect(canPlaceAnother(40)).toBe(false);
  });
});

describe('tile / fill backgrounds', () => {
  const tex = { tileIn: { w: 24, h: 12 } };
  it('tiles at real size times scale', () => {
    expect(backgroundFor(tex, 'tile', 1, 8)).toMatchObject({ backgroundSize: '192px 96px', backgroundRepeat: 'repeat' });
    expect(backgroundFor(tex, 'tile', 0.5, 8).backgroundSize).toBe('96px 48px');
  });
  it('clamps the pattern scale', () => {
    expect(clampScale(10)).toBe(4);
    expect(clampScale(0.01)).toBe(0.25);
    expect(clampScale('x')).toBe(1);
    expect(backgroundFor(tex, 'tile', 100, 1).backgroundSize).toBe('96px 48px');
  });
  it('fills with cover', () => {
    expect(backgroundFor(tex, 'fill', 3, 8)).toEqual({ backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' });
  });
  it('rejects bad input', () => {
    expect(() => backgroundFor(tex, 'stretch', 1, 8)).toThrow(RangeError);
    expect(() => backgroundFor(tex, 'tile', 1, 0)).toThrow(RangeError);
  });
});

describe('message origin allowlist', () => {
  it('accepts Wix free sites, the shop domain and localhost', () => {
    expect(isAllowedOrigin('https://ellisonrblair.wixsite.com')).toBe(true);
    expect(isAllowedOrigin('https://gingersattic.com')).toBe(true);
    expect(isAllowedOrigin('https://www.gingersattic.com')).toBe(true);
    expect(isAllowedOrigin('http://localhost:5178')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:8080')).toBe(true);
    expect(isAllowedOrigin('https://ellisonrblair-the-nostalgia-exchan.editor.wix.com')).toBe(true);
  });
  it('rejects wix.com look-alikes', () => {
    expect(isAllowedOrigin('https://wix.com.evil.io')).toBe(false);
    expect(isAllowedOrigin('https://evilwix.com')).toBe(false);
    expect(isAllowedOrigin('http://editor.wix.com')).toBe(false);
  });
  it('rejects look-alikes, http on production hosts and junk', () => {
    expect(isAllowedOrigin('https://wixsite.com')).toBe(false);
    expect(isAllowedOrigin('https://evil-wixsite.com')).toBe(false);
    expect(isAllowedOrigin('https://wixsite.com.evil.io')).toBe(false);
    expect(isAllowedOrigin('http://gingersattic.com')).toBe(false);
    expect(isAllowedOrigin('https://gingersattic.com:8443')).toBe(false);
    expect(isAllowedOrigin('https://gingersattic.com.evil.io')).toBe(false);
    expect(isAllowedOrigin('null')).toBe(false);
    expect(isAllowedOrigin('')).toBe(false);
    expect(isAllowedOrigin('https://gingersattic.com/path')).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(false);
  });
});

describe('demo booth layout', () => {
  const layout = buildLayout(demo, library);
  it('places every demo item with no placement problems', () => {
    expect(layout.problems).toEqual({});
    expect(layout.placedCount).toBe(demo.items.length);
    expect(layout.storage).toEqual([]);
  });
  it('draws items above the fixture they sit on, and rugs under the chair', () => {
    const z = (id) => layout.items.find((e) => e.item.id === id).z;
    const fz = (id) => layout.fixtures.find((f) => f.id === id).z;
    expect(z('it-amber-lamp')).toBeGreaterThan(fz('fx3'));
    expect(z('it-teacup-mint')).toBeGreaterThan(fz('fx1'));
    expect(z('it-braided-rug')).toBeLessThan(z('it-yellow-chair'));
    expect(z('it-framed-art')).toBeLessThan(fz('fx1'));
  });
});
