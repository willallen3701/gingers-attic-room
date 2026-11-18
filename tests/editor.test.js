import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROOM } from '../src/logic/room.js';
import { normalizeLibrary, stripTopIn } from '../src/logic/library.js';
import { snapFixture, validateFixture, moveFixture, removeFixture, FLOOR_BAND, nextId } from '../src/logic/fixtures.js';
import { createHistory } from '../src/logic/history.js';
import { toDraft, applyDraft, defaultRoom } from '../src/logic/draft.js';
import { fitWithin, encodePlan, dataUrlBytes, uploadTileIn, MAX_LONG_PX, QUALITY_STEPS } from '../src/logic/downscale.js';
import { buildLayout } from '../src/logic/layout.js';
import {
  placeItem, storeItem, setItemScale, placeDecor, removeDecor, moveFixtureTo, addFixture, deleteFixture,
  placePlaceable, toggleStrip, autoDrops, firstThatFits, anchorOf, sizeOfItem, reasonFor,
} from '../src/logic/editops.js';

const rawLib = JSON.parse(readFileSync(new URL('../data/library.json', import.meta.url), 'utf8'));
const demo = JSON.parse(readFileSync(new URL('../data/demo-booth.json', import.meta.url), 'utf8'));

// A test library that does not depend on what the asset pipeline has added so far.
const lib = normalizeLibrary({
  ...rawLib,
  fixtures: [
    ...rawLib.fixtures.filter((f) => ['shelf-stack-4', 'table-farm-60'].includes(f.id)),
    { id: 't-shelf-1', name: 'Single shelf', category: 'shelf', mount: 'wall', widthIn: 30, heightIn: 4, image: 'x.png', surfaces: [{ id: 's0', x1: 0.5, x2: 29.5, y: 0 }] },
    { id: 't-cabinet', name: 'Glass case', category: 'cabinet', mount: 'floor', widthIn: 30, heightIn: 60, image: 'c.png', surfaces: [{ id: 'top', x1: 1, x2: 29, y: 0 }, { id: 'mid', x1: 2, x2: 28, y: 30 }] },
  ],
  decor: [
    { id: 't-fern', name: 'Fern', category: 'plant', mount: 'floor', heightIn: 30, aspect: 0.8, image: 'f.png' },
    { id: 't-clock', name: 'Clock', mount: 'wall', heightIn: 12, aspect: 1, image: 'k.png' },
    { id: 't-vase', name: 'Vase', mount: 'stand', heightIn: 8, aspect: 0.6, image: 'v.png' },
    // The demo booth's lit candelabra (the demo has to stay clean with this library).
    ...rawLib.decor.filter((d) => d.id === 'candelabra-brass'),
  ],
  architecture: [
    ...rawLib.architecture.filter((a) => a.id.startsWith('baseboard')),
    { id: 't-crown', name: 'Crown moulding', kind: 'strip', heightIn: 3, color: '#eee' },
    { id: 't-window', name: 'Sash window', kind: 'placeable', widthIn: 30, heightIn: 44, image: 'w.png' },
    { id: 't-door', name: 'Panel door', kind: 'placeable', widthIn: 34, heightIn: 80, image: 'd.png' },
  ],
});
const emptyBooth = () => ({ id: 'b', name: 'Test', boothNumber: 9, room: defaultRoom(lib), fixtures: [], decor: [], items: [] });
const anItem = (id, over = {}) => ({ id, title: id, price: 10, mount: 'stand', heightIn: 6, aspect: 1, status: 'approved', placement: null, ...over });

describe('library normalisation', () => {
  it('defaults mount and category for older fixture entries and accepts image or src', () => {
    const shelf = lib.fixtures.find((f) => f.id === 'shelf-stack-4');
    const table = lib.fixtures.find((f) => f.id === 'table-farm-60');
    expect(shelf.mount).toBe('wall');
    expect(table.mount).toBe('floor');
    expect(table.category).toBe('table');
    expect(lib.fixtures.find((f) => f.id === 't-shelf-1').src).toBe('x.png');
  });
  it('turns legacy baseboards into bottom strips and crown moulding into a top strip', () => {
    const bb = lib.architecture.find((a) => a.id === 'baseboard-walnut');
    const crown = lib.architecture.find((a) => a.id === 't-crown');
    expect(bb.kind).toBe('strip');
    expect(stripTopIn(bb)).toBe(ROOM.wallHeightIn - bb.heightIn);
    expect(stripTopIn(crown)).toBe(0);
    expect(lib.architecture.find((a) => a.id === 't-door').floorAligned).toBe(true);
  });
});

describe('fixture snapping', () => {
  const shelf = lib.fixtures.find((f) => f.id === 'shelf-stack-4');
  const table = lib.fixtures.find((f) => f.id === 'table-farm-60');
  it('keeps wall fixtures inside the wall and on the half-inch grid', () => {
    expect(snapFixture({ x: -10, y: 80 }, shelf)).toEqual({ x: 0, y: ROOM.wallHeightIn - shelf.heightIn });
    expect(snapFixture({ x: 50.3, y: 20.26 }, shelf)).toEqual({ x: 50.5, y: 20.5 });
  });
  it('stands floor fixtures with their base inside the floor band', () => {
    const top = snapFixture({ x: 30, y: 0 }, table);
    expect(top.y + table.heightIn).toBe(FLOOR_BAND.yMin);
    const low = snapFixture({ x: 30, y: 200 }, table);
    expect(low.y + table.heightIn).toBe(FLOOR_BAND.yMax);
  });
  it('rejects a fixture wider than the room', () => {
    expect(snapFixture({ x: 0, y: 0 }, { widthIn: 200, heightIn: 10, mount: 'wall' })).toBeNull();
  });
  it('flags overlapping wall fixtures but lets a floor table stand in front of a wall shelf', () => {
    const defs = Object.fromEntries(lib.fixtures.map((f) => [f.id, f]));
    const a = { id: 'a', fixtureId: 'shelf-stack-4', x: 10, y: 20 };
    const b = { id: 'b', fixtureId: 'shelf-stack-4', x: 30, y: 30 };
    const t = { id: 't', fixtureId: 'table-farm-60', x: 10, y: 65 };
    expect(validateFixture(b, { fixtures: [a, b, t], defs }).map((e) => e.code)).toContain('OVERLAP');
    expect(validateFixture(t, { fixtures: [a, b, t], defs })).toEqual([]);
  });
  it('lets floor fixtures overlap side to side only when they are at clearly different depths', () => {
    const defs = Object.fromEntries(lib.fixtures.map((f) => [f.id, f]));
    const t1 = { id: 't1', fixtureId: 'table-farm-60', x: 10, y: 92 - 30 };
    const near = { id: 't2', fixtureId: 'table-farm-60', x: 30, y: 95 - 30 };
    const far = { id: 't3', fixtureId: 'table-farm-60', x: 30, y: 110 - 30 };
    expect(validateFixture(near, { fixtures: [t1, near], defs }).map((e) => e.code)).toContain('OVERLAP');
    expect(validateFixture(far, { fixtures: [t1, far], defs })).toEqual([]);
  });
  it('moves the items on a fixture with it and stores them when the fixture is removed', () => {
    const b = applyDraft(demo, toDraft(demo));
    const onFx1 = b.items.filter((i) => i.placement?.surfaceId?.startsWith('fx1:'));
    expect(onFx1.length).toBeGreaterThan(0);
    const fx1 = b.fixtures.find((f) => f.id === 'fx1');
    const moved = moveFixture(b, 'fx1', { x: fx1.x + 2, y: fx1.y + 3 });
    for (const it of onFx1) {
      const m = moved.items.find((x) => x.id === it.id);
      expect(m.placement.x).toBeCloseTo(it.placement.x + 2, 5);
      expect(m.placement.y).toBeCloseTo(it.placement.y + 3, 5);
    }
    const { booth: after, storedIds } = removeFixture(b, 'fx1');
    expect(storedIds.sort()).toEqual(onFx1.map((i) => i.id).sort());
    expect(after.items.filter((i) => storedIds.includes(i.id)).every((i) => i.placement === null)).toBe(true);
  });
  it('accepts a fixture move only when the fixture and its contents stay valid', () => {
    const b = applyDraft(demo, toDraft(demo));
    const ok = moveFixtureTo(b, lib, 'fx1', { x: 3, y: 16 });
    expect(ok.ok).toBe(true);
    const clash = moveFixtureTo(b, lib, 'fx1', { x: 70, y: 12 }); // onto the other shelf stack
    expect(clash.ok).toBe(false);
    expect(reasonFor(clash.errors)).toMatch(/overlap/i);
  });
  it('auto-places a new fixture in a free spot', () => {
    const r = addFixture(applyDraft(demo, toDraft(demo)), lib, 't-shelf-1');
    expect(r.ok).toBe(true);
    expect(r.booth.fixtures.at(-1)).toMatchObject({ id: 'fx4', fixtureId: 't-shelf-1' });
    expect(buildLayout(r.booth, lib).problems.fx4).toBeUndefined();
  });
  it('deleteFixture reports what went back to storage', () => {
    const r = deleteFixture(applyDraft(demo, toDraft(demo)), 'fx3');
    expect(r.storedIds.length).toBeGreaterThan(0);
    expect(r.booth.fixtures.some((f) => f.id === 'fx3')).toBe(false);
  });
  it('makes unique instance ids', () => {
    expect(nextId('fx', ['fx1', 'fx2', 'fx4'])).toBe('fx3');
  });
});

describe('item and decor placement', () => {
  it('snaps a stored item onto the shelf under the drop point', () => {
    let b = emptyBooth();
    b = addFixture(b, lib, 't-shelf-1', { x: 40, y: 30 }).booth;
    b.items = [anItem('cup')];
    const r = placeItem(b, lib, 'cup', { x: 55, y: 31 });
    expect(r.ok).toBe(true);
    expect(r.booth.items[0].placement).toMatchObject({ surfaceId: 'fx1:s0', y: 30, scaleAdj: 1 });
  });
  it('refuses to drop an item on top of another one on the same shelf', () => {
    let b = emptyBooth();
    b = addFixture(b, lib, 't-shelf-1', { x: 40, y: 30 }).booth;
    b.items = [anItem('a'), anItem('b')];
    b = placeItem(b, lib, 'a', { x: 55, y: 30 }).booth;
    const r = placeItem(b, lib, 'b', { x: 55.5, y: 30 });
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain('OVERLAP');
  });
  it('keeps the bottom-centre still when the size tweak changes, and clamps to 80-120 %', () => {
    let b = emptyBooth();
    b.items = [anItem('lamp', { heightIn: 10 })];
    b = placeItem(b, lib, 'lamp', { x: 60, y: 110 }).booth;
    const before = anchorOf(b.items[0].placement, sizeOfItem(b.items[0]));
    const r = setItemScale(b, lib, 'lamp', 1.5);
    expect(r.ok).toBe(true);
    expect(r.booth.items[0].placement.scaleAdj).toBe(1.2);
    const after = anchorOf(r.booth.items[0].placement, sizeOfItem(r.booth.items[0]));
    expect(after.x).toBeCloseTo(before.x, 1);
  });
  it('enforces the 40-item cap; the 41st waits in storage', () => {
    let b = emptyBooth();
    b.items = Array.from({ length: 41 }, (_, i) => anItem(`i${i}`, { heightIn: 2, aspect: 1 }));
    let placed = 0;
    for (const it of b.items) {
      const r = firstThatFits(autoDrops(b, lib, 'stand'), (d) => placeItem(b, lib, it.id, d));
      if (r.ok) {
        b = r.booth;
        placed++;
      } else {
        expect(r.errors[0].code).toBe('OVER_LIMIT');
      }
    }
    expect(placed).toBe(ROOM.maxPlacedItems);
    expect(b.items.filter((i) => !i.placement)).toHaveLength(1);
    const freed = storeItem(b, 'i0').booth;
    expect(placeItem(freed, lib, 'i40', { x: 100, y: 110 }).ok).toBe(true);
  });
  it('places decor by mount: wall clock on the wall, fern only on the floor, vase on a shelf', () => {
    let b = emptyBooth();
    b = addFixture(b, lib, 't-shelf-1', { x: 40, y: 30 }).booth;
    const clock = placeDecor(b, lib, 't-clock', { x: 20, y: 40 });
    expect(clock.ok).toBe(true);
    expect(clock.booth.decor[0].placement.surfaceId).toBe('wall');
    const fern = placeDecor(b, lib, 't-fern', { x: 55, y: 31 }); // dropped at shelf height
    expect(fern.booth.decor.at(-1).placement.surfaceId).toBe('floor');
    const vase = placeDecor(b, lib, 't-vase', { x: 55, y: 31 });
    expect(vase.booth.decor.at(-1).placement.surfaceId).toBe('fx1:s0');
    expect(removeDecor(vase.booth, vase.id).booth.decor).toHaveLength(0);
  });
  it('blocks wall decor that would hang over a wall shelf', () => {
    let b = emptyBooth();
    b = addFixture(b, lib, 'shelf-stack-4', { x: 40, y: 20 }).booth;
    const r = placeDecor(b, lib, 't-clock', { x: 55, y: 40 });
    expect(r.ok).toBe(false);
  });
  it('aligns doors to the floor line and keeps windows off shelves', () => {
    let b = emptyBooth();
    const door = placePlaceable(b, lib, 't-door', { x: 10, y: 40 });
    expect(door.ok).toBe(true);
    expect(door.booth.room.placeables[0].y).toBe(ROOM.wallHeightIn);
    b = addFixture(b, lib, 'shelf-stack-4', { x: 60, y: 20 }).booth;
    const win = placePlaceable(b, lib, 't-window', { x: 62, y: 60 });
    expect(win.ok).toBe(false);
  });
  it('keeps baseboards mutually exclusive but lets crown moulding sit alongside', () => {
    let room = { architecture: [] };
    room = toggleStrip(room, lib, 'baseboard-walnut');
    room = toggleStrip(room, lib, 't-crown');
    room = toggleStrip(room, lib, 'baseboard-white');
    expect(room.architecture.sort()).toEqual(['baseboard-white', 't-crown']);
    room = toggleStrip(room, lib, 't-crown');
    expect(room.architecture).toEqual(['baseboard-white']);
  });
});

describe('undo / redo', () => {
  it('walks back and forward and drops the redo branch after a new change', () => {
    const h = createHistory(10);
    h.reset({ n: 0 });
    h.push({ n: 1 });
    h.push({ n: 2 });
    expect(h.undo()).toEqual({ n: 1 });
    expect(h.undo()).toEqual({ n: 0 });
    expect(h.undo()).toBeNull();
    expect(h.redo()).toEqual({ n: 1 });
    h.push({ n: 5 });
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toEqual({ n: 1 });
  });
  it('ignores a push that changes nothing and caps its length', () => {
    const h = createHistory(3);
    h.reset({ n: 0 });
    expect(h.push({ n: 0 })).toBe(false);
    for (let i = 1; i <= 6; i++) h.push({ n: i });
    expect(h.depth).toBe(3);
  });
  it('is not affected by later mutation of pushed objects', () => {
    const h = createHistory();
    const s = { a: [1] };
    h.reset({ a: [] });
    h.push(s);
    s.a.push(2);
    expect(h.undo()).toEqual({ a: [] });
    expect(h.redo()).toEqual({ a: [1] });
  });
});

describe('draft serialisation', () => {
  it('round-trips the demo booth', () => {
    const d1 = toDraft(demo);
    const d2 = toDraft(applyDraft(demo, d1));
    expect(d2).toEqual(d1);
    expect(JSON.parse(JSON.stringify(d1))).toEqual(d1);
  });
  it('null placements send items to storage and unknown ids are ignored', () => {
    const id = demo.items[0].id;
    const b = applyDraft(demo, { placements: { [id]: null, nope: { surfaceId: 'floor', x: 1, y: 100 } } });
    expect(b.items[0].placement).toBeNull();
    expect(b.items.find((i) => i.id === 'nope')).toBeUndefined();
    expect(b.items[1].placement).toEqual(demo.items[1].placement);
  });
  it('carries the size tweak as scaleAdj', () => {
    const b = { ...demo, items: demo.items.map((it, i) => (i === 0 ? { ...it, sizeTweak: 1.1 } : it)) };
    expect(toDraft(b).placements[demo.items[0].id].scaleAdj).toBe(1.1);
    expect(applyDraft(demo, toDraft(b)).items[0].sizeTweak).toBe(1.1);
  });
  it('new booths start with no light', () => {
    expect(defaultRoom(lib).light).toBeNull();
    expect(demo.room.light ?? null).toBeNull();
  });
});

describe('texture downscale maths', () => {
  it('fits the long side within 1600 px and never upscales', () => {
    expect(fitWithin(4000, 3000)).toMatchObject({ w: 1600, h: 1200 });
    expect(fitWithin(1000, 3200)).toMatchObject({ w: 500, h: 1600 });
    expect(fitWithin(800, 600)).toMatchObject({ w: 800, h: 600, scale: 1 });
    expect(() => fitWithin(0, 10)).toThrow();
  });
  it('plans every quality at full size first, then shrinks down to the minimum', () => {
    const plan = encodePlan(5000, 2500);
    expect(plan[0]).toEqual({ w: MAX_LONG_PX, h: 800, quality: QUALITY_STEPS[0] });
    expect(plan.slice(0, QUALITY_STEPS.length).every((p) => p.w === MAX_LONG_PX)).toBe(true);
    expect(Math.max(plan.at(-1).w, plan.at(-1).h)).toBe(400);
    for (let i = 1; i < plan.length; i++) expect(plan[i].w).toBeLessThanOrEqual(plan[i - 1].w);
  });
  it('measures data URL bytes', () => {
    const b64 = Buffer.from('hello world!!').toString('base64');
    expect(dataUrlBytes(`data:image/jpeg;base64,${b64}`)).toBe(13);
  });
  it('gives uploads a 24 in tile in their own aspect', () => {
    expect(uploadTileIn(1200, 600)).toEqual({ w: 24, h: 12 });
  });
});

describe('layout with decor and windows', () => {
  it('lays out decor and placeables without problems, and the demo stays clean', () => {
    expect(buildLayout(demo, lib).problems).toEqual({});
    let b = emptyBooth();
    b = placePlaceable(b, lib, 't-window', null).booth;
    b = placeDecor(b, lib, 't-fern', { x: 100, y: 110 }).booth;
    const L = buildLayout(b, lib);
    expect(L.placeables).toHaveLength(1);
    expect(L.decor).toHaveLength(1);
    expect(L.problems).toEqual({});
  });
});
