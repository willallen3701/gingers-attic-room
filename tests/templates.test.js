// "Use a template": the five looks, size-based auto-placement, the overwrite check and the Christmas cutoff.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROOM } from '../src/logic/room.js';
import { normalizeLibrary, byId } from '../src/logic/library.js';
import { buildLayout } from '../src/logic/layout.js';
import { toDraft, applyDraft, defaultRoom } from '../src/logic/draft.js';
import { boxProblems, boxedItemIds, placedPieces, MAX_BOXES } from '../src/logic/boxes.js';
import { placeItem } from '../src/logic/editops.js';
import {
  TEMPLATES, applyTemplate, availableTemplates, isTemplateAvailable, hasExistingLayout, classifyItem, templateSummary, TINY_MAX_IN,
} from '../src/logic/templates.js';

const rawLib = JSON.parse(readFileSync(new URL('../data/library.json', import.meta.url), 'utf8'));
const demo = JSON.parse(readFileSync(new URL('../data/demo-booth.json', import.meta.url), 'utf8'));
const lib = normalizeLibrary(rawLib);
const NOV = new Date(2026, 10, 18, 12, 0, 0); // local time, so the tests don't depend on the machine's time zone
const item = (id, over = {}) => ({ id, title: id, price: 10, status: 'approved', mount: 'stand', heightIn: 8, aspect: 0.8, placement: null, ...over });
const freshBooth = (items = []) => ({ id: 'b', name: 'T', boothNumber: 1, room: defaultRoom(lib), fixtures: [], decor: [], boxes: [], items });
const demoBooth = () => ({ ...JSON.parse(JSON.stringify(demo)), boxes: [] });
const ids = (booth) => booth.items.map((i) => i.id).sort();

/** Where every item ended up: placed in the room, in a box, or in the crate. */
function whereAre(booth) {
  const boxed = boxedItemIds(booth);
  const placed = booth.items.filter((i) => i.placement).map((i) => i.id);
  const crate = booth.items.filter((i) => !i.placement && !boxed.has(i.id)).map((i) => i.id);
  return { placed, boxed: [...boxed], crate };
}

/** Every rule the room app and the Wix site check for a saved booth (the site's checks are copied from boothShape.js). */
function expectValidBooth(booth) {
  const L = buildLayout(booth, lib);
  expect(L.problems).toEqual({});
  expect(boxProblems(booth)).toEqual([]);
  expect(placedPieces(booth)).toBeLessThanOrEqual(ROOM.maxPlacedItems);
  const w = whereAre(booth);
  expect([...w.placed, ...w.boxed, ...w.crate].sort()).toEqual(ids(booth)); // nothing lost, nothing twice
  // the site's draft limits
  const d = toDraft(booth);
  expect(d.fixtures.length).toBeLessThanOrEqual(30);
  expect(d.decor.length).toBeLessThanOrEqual(30);
  expect(d.boxes.length).toBeLessThanOrEqual(MAX_BOXES);
  const known = { fx: new Set(rawLib.fixtures.map((f) => f.id)), dc: new Set(rawLib.decor.map((x) => x.id)), ar: new Set(rawLib.architecture.map((a) => a.id)) };
  for (const f of d.fixtures) expect(known.fx.has(f.fixtureId)).toBe(true);
  for (const x of d.decor) expect(known.dc.has(x.decorId)).toBe(true);
  for (const a of d.room.architecture) expect(known.ar.has(a)).toBe(true);
  for (const a of d.room.placeables) expect(known.ar.has(a.archId)).toBe(true);
  const inRoom = (p) => p.x >= -60 && p.x <= 180 && p.y >= -10 && p.y <= 130;
  for (const p of Object.values(d.placements)) if (p) expect(inRoom(p)).toBe(true);
  for (const b of d.boxes) expect(inRoom(b.placement)).toBe(true);
}

describe('the looks', () => {
  it('offers five: four permanent and a Christmas one that ends on January 1', () => {
    expect(TEMPLATES).toHaveLength(5);
    expect(TEMPLATES.filter((t) => !t.until)).toHaveLength(4);
    expect(TEMPLATES.find((t) => t.id === 'christmas').until).toBe('2027-01-01');
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(5);
    expect(new Set(TEMPLATES.map((t) => t.name)).size).toBe(5);
  });

  it('use only things the library has', () => {
    for (const t of TEMPLATES) {
      const w = t.wall.paint ? byId(lib.paints)[t.wall.paint] : byId(lib.wallpapers)[t.wall.wallpaper];
      expect(w, `${t.id} wall`).toBeTruthy();
      expect(byId(lib.floors)[t.floor], `${t.id} floor`).toBeTruthy();
      for (const s of t.strips) expect(byId(lib.architecture)[s]?.kind, `${t.id} ${s}`).toBe('strip');
      expect(byId(lib.lights)[t.light], `${t.id} light`).toBeTruthy();
      for (const x of t.windows) expect(byId(lib.architecture)[x.id]?.kind).toBe('placeable');
      for (const x of t.fixtures) expect(byId(lib.fixtures)[x.id], `${t.id} ${x.id}`).toBeTruthy();
      for (const x of t.decor) expect(byId(lib.decor)[x.id], `${t.id} ${x.id}`).toBeTruthy();
    }
  });

  it.each(TEMPLATES.map((t) => t.id))('%s sets wall, floor, shelving, furniture, a lit lamp and a window or lamp light', (id) => {
    const t = TEMPLATES.find((x) => x.id === id);
    const r = applyTemplate(demoBooth(), rawLib, id, { now: NOV });
    expect(r.ok).toBe(true);
    const b = r.booth;
    expect(b.room.wall.paintId ?? b.room.wall.textureId).toBe(t.wall.paint ?? t.wall.wallpaper);
    expect(b.room.floor.textureId).toBe(t.floor);
    expect(b.room.architecture.length).toBeGreaterThan(0);
    expect(b.room.light?.presetId).toBe(t.light);
    const defs = byId(lib.fixtures);
    expect(b.fixtures.some((f) => defs[f.fixtureId].mount === 'wall')).toBe(true); // shelving
    expect(b.fixtures.some((f) => defs[f.fixtureId].mount === 'floor')).toBe(true); // furniture
    const lamps = b.decor.filter((d) => byId(lib.decor)[d.decorId].category === 'lighting');
    expect(lamps.length).toBeGreaterThanOrEqual(1);
    expect(lamps.some((d) => d.lit === true)).toBe(true);
    expect(r.report.skipped).toEqual([]); // every planned fixture, window and decor piece found its place
  });

  it.each(TEMPLATES.map((t) => t.id))('%s gives a valid booth the site would accept, with nothing lost', (id) => {
    const r = applyTemplate(demoBooth(), rawLib, id, { now: NOV });
    expectValidBooth(r.booth);
    // and it survives the draft round trip (save, reload)
    const back = applyDraft(freshBooth(demoBooth().items), JSON.parse(JSON.stringify(toDraft(r.booth))));
    expectValidBooth(back);
    expect(back.fixtures).toEqual(r.booth.fixtures);
    expect(back.boxes).toEqual(r.booth.boxes);
  });

  it('keeps the booth sign, the sound and the highlights, and does not change its input', () => {
    const b = { ...demoBooth(), highlights: ['it-cameo'] };
    b.room = { ...b.room, sign: { style: 'brass' }, sound: 'rain' };
    const before = JSON.stringify(b);
    const r = applyTemplate(b, rawLib, 'farmhouse', { now: NOV });
    expect(JSON.stringify(b)).toBe(before);
    expect(r.booth.room.sign).toEqual({ style: 'brass' });
    expect(r.booth.room.sound).toBe('rain');
    expect(r.booth.highlights).toEqual(['it-cameo']);
  });

  it('works on a brand-new booth with no items', () => {
    const r = applyTemplate(freshBooth(), rawLib, 'cozy-cottage', { now: NOV });
    expect(r.ok).toBe(true);
    expect(r.report).toMatchObject({ placed: 0, boxed: 0, stored: 0 });
    expectValidBooth(r.booth);
  });

  it('rejects an unknown template', () => {
    const b = freshBooth();
    expect(applyTemplate(b, rawLib, 'nope', { now: NOV })).toMatchObject({ ok: false, errors: [{ code: 'UNKNOWN_TEMPLATE' }] });
  });

  it('tells the seller what happened', () => {
    expect(templateSummary('Farmhouse', { placed: 10, boxed: 5, stored: 1 })).toBe(
      "Farmhouse is ready. 10 out in the room, 5 in a collectibles box, 1 in your storage crate. Move anything you like, then press Update booth when you're happy.",
    );
    expect(templateSummary('Farmhouse', { placed: 0, boxed: 0, stored: 0 })).toMatch(/^Farmhouse is ready\. Move anything/);
  });
});

describe('placing items by size', () => {
  const items = [
    item('rug', { mount: 'flat', flat: true, widthIn: 40, heightIn: undefined, aspect: 3 }),
    item('art', { mount: 'wall', heightIn: 20, aspect: 0.8 }),
    item('thimble1', { heightIn: 1.5, aspect: 1 }),
    item('thimble2', { heightIn: 2, aspect: 1 }),
    item('pin', { heightIn: 1, aspect: 2 }),
    item('chair', { heightIn: 40, aspect: 0.7 }),
    item('lamp', { heightIn: 18, aspect: 0.5 }),
    item('book', { heightIn: 7, aspect: 1.2 }),
    item('cup', { heightIn: 4, aspect: 1.5 }),
  ];
  const result = () => applyTemplate(freshBooth(items), rawLib, 'cozy-cottage', { now: NOV });

  it('classifies by size', () => {
    const c = Object.fromEntries(items.map((i) => [i.id, classifyItem(i)]));
    expect(c).toEqual({ rug: 'flat', art: 'wall', thimble1: 'tiny', thimble2: 'tiny', pin: 'tiny', chair: 'tall', lamp: 'big', book: 'small', cup: 'small' });
    expect(classifyItem(item('x', { heightIn: TINY_MAX_IN, aspect: 1 }))).toBe('tiny');
    expect(classifyItem(item('y', { heightIn: TINY_MAX_IN + 0.1, aspect: 1 }))).toBe('small');
    expect(classifyItem(item('z', { aspect: 0 }))).toBeNull();
  });

  it('puts rugs on the floor, wall hangings on the wall, tiny things in a box, big things on the floor or a table, small things on a shelf', () => {
    const b = result().booth;
    expectValidBooth(b);
    const L = buildLayout(b, lib);
    const surf = Object.fromEntries(b.items.filter((i) => i.placement).map((i) => [i.id, L.surfaces.find((s) => s.id === i.placement.surfaceId)]));
    const fxOf = (s) => byId(lib.fixtures)[b.fixtures.find((f) => f.id === s.fixtureInstanceId).fixtureId];
    expect(surf.rug.kind).toBe('floor');
    expect(surf.art.kind).toBe('wall');
    expect(surf.chair.kind).toBe('floor');
    expect(['floor', 'line']).toContain(surf.lamp.kind);
    if (surf.lamp.kind === 'line') expect(fxOf(surf.lamp).category).toBe('table');
    expect(surf.book.kind).toBe('line');
    expect(['shelf', 'cabinet']).toContain(fxOf(surf.book).category); // not a table or the floor
    // the three tiniest are boxed (the cup is 6 in long, so it is a shelf item)
    expect(b.boxes).toHaveLength(1);
    expect(b.boxes[0].slots.filter(Boolean).sort()).toEqual(['pin', 'thimble1', 'thimble2']);
    expect(b.boxes[0].style).toBe('crate');
    for (const id of ['thimble1', 'thimble2', 'pin']) expect(b.items.find((i) => i.id === id).placement).toBeNull();
  });

  it('keeps a seller\'s size tweak on items it places', () => {
    const tweaked = items.map((i) => (i.id === 'book' ? { ...i, placement: { surfaceId: 'floor', x: 1, y: 100, scaleAdj: 1.2 }, sizeTweak: 1.2 } : i));
    const b = applyTemplate(freshBooth(tweaked), rawLib, 'cozy-cottage', { now: NOV }).booth;
    expect(b.items.find((i) => i.id === 'book').placement.scaleAdj).toBe(1.2);
  });

  it('sends sold items to the end and rejected items to the crate', () => {
    const many = Array.from({ length: 6 }, (_, i) => item(`s${i}`, { heightIn: 7 }));
    const r = applyTemplate(freshBooth([...many, item('rej', { status: 'rejected', heightIn: 7 }), item('sold', { status: 'sold', heightIn: 7 })]), rawLib, 'farmhouse', { now: NOV });
    expect(r.booth.items.find((i) => i.id === 'rej').placement).toBeNull();
    expect(r.report.rejected).toBe(1);
    expect(r.booth.items.find((i) => i.id === 'sold').placement).toBeTruthy();
    expectValidBooth(r.booth);
  });
});

describe('limits: 40 pieces, 3 boxes, nothing lost', () => {
  it('60 small items: at most 40 pieces out, the rest wait in the storage crate', () => {
    const many = Array.from({ length: 60 }, (_, i) => item(`m${i}`, { heightIn: 6 + (i % 5), aspect: 0.9 }));
    const r = applyTemplate(freshBooth(many), rawLib, 'antique-library', { now: NOV });
    expectValidBooth(r.booth);
    const w = whereAre(r.booth);
    expect(w.placed.length + r.booth.boxes.length).toBeLessThanOrEqual(ROOM.maxPlacedItems);
    expect(w.crate.length).toBeGreaterThan(0);
    expect(w.placed.length + w.boxed.length + w.crate.length).toBe(60);
    for (const id of w.crate) expect(r.booth.items.find((i) => i.id === id).sizeTweak).toBe(1);
  });

  it('50 tiny items: at most 3 boxes of 16, the rest still land somewhere valid', () => {
    const tiny = Array.from({ length: 50 }, (_, i) => item(`t${i}`, { heightIn: 2, aspect: 1 }));
    const r = applyTemplate(freshBooth(tiny), rawLib, 'victorian-parlor', { now: NOV });
    expectValidBooth(r.booth);
    expect(r.booth.boxes.length).toBeLessThanOrEqual(MAX_BOXES);
    expect(boxedItemIds(r.booth).size).toBeGreaterThanOrEqual(27);
    for (const b of r.booth.boxes) expect(b.slots).toHaveLength(b.cols * b.rows);
  });

  it('an item that is too big for every surface, or has no size, goes to the crate instead of breaking the layout', () => {
    const odd = [item('huge', { heightIn: 100, aspect: 1.2 }), item('nosize', { heightIn: undefined, aspect: undefined }), item('ok', { heightIn: 8 })];
    const r = applyTemplate(freshBooth(odd), rawLib, 'cozy-cottage', { now: NOV });
    expectValidBooth(r.booth);
    expect(r.booth.items.find((i) => i.id === 'nosize').placement).toBeNull();
    expect(r.booth.items.find((i) => i.id === 'ok').placement).toBeTruthy();
    expect(ids(r.booth)).toEqual(['huge', 'nosize', 'ok']);
  });

  it('a smaller allowance (maxPlaced) is respected, boxes included', () => {
    const many = Array.from({ length: 12 }, (_, i) => item(`k${i}`, { heightIn: 7 }));
    const r = applyTemplate(freshBooth([...many, item('tiny1', { heightIn: 2, aspect: 1 })]), rawLib, 'farmhouse', { now: NOV, maxPlaced: 5 });
    expect(placedPieces(r.booth)).toBeLessThanOrEqual(5);
    expectValidBooth(r.booth);
  });

  it('placement is fast enough to run in the editor (40 items)', () => {
    const many = Array.from({ length: 45 }, (_, i) => item(`f${i}`, { heightIn: 3 + (i % 9) * 2, aspect: 0.6 + (i % 4) * 0.3 }));
    const t0 = Date.now();
    const r = applyTemplate(freshBooth(many), rawLib, 'cozy-cottage', { now: NOV });
    expect(Date.now() - t0).toBeLessThan(5000);
    expectValidBooth(r.booth);
  });
});

describe('asking before replacing the seller\'s work', () => {
  it('a new booth has nothing to lose', () => {
    expect(hasExistingLayout(freshBooth([item('a')]))).toBe(false);
    expect(hasExistingLayout(freshBooth([item('a')]), rawLib)).toBe(false);
  });
  it('anything arranged counts: fixtures, decor, boxes, windows, strips, placed items, a changed wall or floor', () => {
    const base = () => freshBooth([item('a')]);
    expect(hasExistingLayout({ ...base(), fixtures: [{ id: 'fx1', fixtureId: 'table-farm-60', x: 1, y: 60 }] })).toBe(true);
    expect(hasExistingLayout({ ...base(), decor: [{ id: 'dc1', decorId: 'plant-fern', placement: { surfaceId: 'floor', x: 1, y: 100 } }] })).toBe(true);
    expect(hasExistingLayout({ ...base(), boxes: [{ id: 'bx1' }] })).toBe(true);
    const b = base();
    expect(hasExistingLayout({ ...b, room: { ...b.room, placeables: [{ id: 'ar1', archId: 'window-sash', x: 1, y: 60 }] } })).toBe(true);
    expect(hasExistingLayout({ ...b, room: { ...b.room, architecture: ['baseboard-white'] } })).toBe(true);
    expect(hasExistingLayout({ ...base(), items: [item('a', { placement: { surfaceId: 'floor', x: 1, y: 100 } })] })).toBe(true);
    expect(hasExistingLayout({ ...b, room: { ...b.room, wall: { type: 'paint', paintId: 'paint-sage' } } }, rawLib)).toBe(true);
    expect(hasExistingLayout({ ...b, room: { ...b.room, floor: { textureId: 'fl-checker', mode: 'tile', scale: 1 } } }, rawLib)).toBe(true);
    expect(hasExistingLayout(demoBooth(), rawLib)).toBe(true);
  });
  it('applying a template over a layout can be undone: the input booth is never changed', () => {
    const b = demoBooth();
    const snapshot = JSON.stringify(toDraft(b));
    applyTemplate(b, rawLib, 'christmas', { now: NOV });
    expect(JSON.stringify(toDraft(b))).toBe(snapshot);
  });
});

describe('the Christmas cutoff (offered until January 1, 2027)', () => {
  const xmas = TEMPLATES.find((t) => t.id === 'christmas');
  it('is offered through the last minute of December 31', () => {
    expect(isTemplateAvailable(xmas, new Date(2026, 10, 18))).toBe(true);
    expect(isTemplateAvailable(xmas, new Date(2026, 11, 25, 9))).toBe(true);
    expect(isTemplateAvailable(xmas, new Date(2026, 11, 31, 23, 59, 59, 999))).toBe(true);
  });
  it('is gone from January 1, 00:00', () => {
    expect(isTemplateAvailable(xmas, new Date(2027, 0, 1, 0, 0, 0, 0))).toBe(false);
    expect(isTemplateAvailable(xmas, new Date(2027, 0, 1, 0, 0, 0, 1))).toBe(false);
    expect(isTemplateAvailable(xmas, new Date(2027, 5, 1))).toBe(false);
  });
  it('the other four are always offered', () => {
    for (const t of TEMPLATES.filter((x) => !x.until)) {
      expect(isTemplateAvailable(t, new Date(2030, 0, 1))).toBe(true);
    }
    expect(availableTemplates(new Date(2026, 11, 31, 23, 59)).map((t) => t.id)).toHaveLength(5);
    const after = availableTemplates(new Date(2027, 0, 1)).map((t) => t.id);
    expect(after).toEqual(['cozy-cottage', 'victorian-parlor', 'farmhouse', 'antique-library']);
  });
  it('applyTemplate refuses it after the cutoff and leaves the booth alone', () => {
    const b = demoBooth();
    const before = JSON.stringify(b);
    const r = applyTemplate(b, rawLib, 'christmas', { now: new Date(2027, 0, 1) });
    expect(r).toMatchObject({ ok: false, errors: [{ code: 'TEMPLATE_ENDED' }] });
    expect(r.booth).toBe(b);
    expect(JSON.stringify(b)).toBe(before);
  });
  it('a booth already using the Christmas layout keeps it after January 1 (nothing about a template is stored)', () => {
    const made = applyTemplate(demoBooth(), rawLib, 'christmas', { now: new Date(2026, 11, 30) }).booth;
    const draft = JSON.parse(JSON.stringify(toDraft(made)));
    expect(JSON.stringify(draft)).not.toMatch(/christmas|template/i); // nothing for the site to store or expire
    const reloaded = applyDraft(freshBooth(demoBooth().items), draft); // the seller comes back in February
    expect(reloaded.room).toEqual(made.room);
    expect(reloaded.fixtures).toEqual(made.fixtures);
    expect(reloaded.decor).toEqual(made.decor);
    expect(reloaded.boxes).toEqual(made.boxes);
    expectValidBooth(reloaded);
    // and the seller can still edit it
    const moved = placeItem(reloaded, lib, 'it-cameo', { x: 60, y: 30 });
    expect(moved.ok || moved.errors.length > 0).toBe(true);
  });
});
