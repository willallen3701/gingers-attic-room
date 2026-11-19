// "decor-more" (2026-11): the garland and the wreath may hang over a window (library `mayOverlap`), and twelve
// general vintage pieces were added to the library. Library ids are only ever added (live booths store them).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { normalizeLibrary, byId, pickerDecor } from '../src/logic/library.js';
import { buildLayout, decorMayOverlap } from '../src/logic/layout.js';
import { toDraft, applyDraft } from '../src/logic/draft.js';
import { placeDecor, placePlaceable, removeDecor } from '../src/logic/editops.js';
import { isLampDef, LAMP_LIGHTS } from '../src/logic/lamps.js';
import { cleanDraft } from '../../site/src/backend/boothShape.js';

const rawLib = JSON.parse(readFileSync(new URL('../data/library.json', import.meta.url), 'utf8'));
const lib = normalizeLibrary(rawLib);
const defs = byId(lib.decor);
const NEW_IDS = [
  'spinning-wheel', 'basket-sewing', 'candlestick-wooden', 'jug-floral', 'lantern-kerosene', 'trunk-ironbound',
  'kettle-vintage', 'milk-can', 'suitcase-stickers', 'print-chrysanthemum', 'print-white-eye', 'radio-field',
];
// the decor ids of the live room app (commit 2963cc9): never removed
const LIVE_DECOR_IDS = [
  'basket-wicker', 'books-leather-set', 'xmas-garland', 'xmas-gifts', 'xmas-nutcracker', 'xmas-tree', 'xmas-tree-tabletop',
  'xmas-wreath', 'clock-grandfather', 'clock-mantel', 'clock-wall', 'frame-landscape', 'frame-oval-mahogany', 'frame-street-scene',
  'chair-rocking', 'candelabra-brass', 'lamp-floor-fringe', 'lamp-oil', 'lantern-hanging', 'xmas-candles', 'mirror-ornate',
  'plant-fern', 'plant-philodendron', 'plant-succulent', 'plant-urn-tree', 'bust-marble', 'curtains-lace', 'curtains-velvet',
  'vase-blue-white',
];

const emptyBooth = (placeables = [], decor = [], fixtures = []) => ({
  id: 'b', name: 'T', boothNumber: 1, items: [], boxes: [], fixtures, decor,
  room: { wall: { type: 'paint', paintId: 'paint-bottle-green' }, floor: {}, light: null, architecture: [], placeables, sign: { style: 'wood' } },
});
// a window 36.43 x 58.64 in at x 40..76.4, base 80 (top 21.4); a door on the right
const win = { id: 'ar1', archId: 'window-sash', x: 40, y: 80 };
const door = { id: 'ar2', archId: 'door-panel-walnut', x: 70, y: 90 };
const withWindow = (decor = []) => emptyBooth([win], decor);
const overWindow = { x: 58, y: 50 }; // bottom-centre of the drop: inside the window rectangle
const dc = (decorId, x, y, id = 'dc9') => ({ id, decorId, placement: { surfaceId: 'wall', x, y, scaleAdj: 1 } });
const problems = (b) => buildLayout(b, rawLib).problems;
const codes = (res) => res.errors.map((e) => e.code);

describe('which pieces may hang over a window (library flag)', () => {
  it('only the garland and the wreath carry mayOverlap, and only for windows', () => {
    const flagged = lib.decor.filter((d) => d.mayOverlap !== undefined);
    expect(flagged.map((d) => d.id).sort()).toEqual(['xmas-garland', 'xmas-wreath']);
    for (const d of flagged) {
      expect(d.mount).toBe('wall');
      expect(d.mayOverlap).toEqual(['window']);
      expect(decorMayOverlap(d)).toEqual(['window']);
    }
  });
  it('the flag is read only from wall decor and only knows windows and doors', () => {
    expect(decorMayOverlap(undefined)).toEqual([]);
    expect(decorMayOverlap({ mount: 'stand', mayOverlap: ['window'] })).toEqual([]);
    expect(decorMayOverlap({ mount: 'wall', mayOverlap: ['window', 'wall', 'door'] })).toEqual(['window', 'door']);
    expect(decorMayOverlap({ mount: 'wall', mayOverlap: 'window' })).toEqual([]);
  });
});

describe('the garland and the wreath can be placed over a window', () => {
  for (const id of ['xmas-garland', 'xmas-wreath']) {
    it(`${id}: placeDecor over the window is accepted and the room stays problem-free`, () => {
      const res = placeDecor(withWindow(), rawLib, id, overWindow);
      expect(res.ok, JSON.stringify(res.errors)).toBe(true);
      const d = res.booth.decor[0];
      const size = { w: defs[id].widthIn, h: defs[id].heightIn };
      // it really overlaps the window rectangle (x 40..76.43, y 21.36..80)
      expect(d.placement.x + size.w).toBeGreaterThan(40);
      expect(d.placement.x).toBeLessThan(76.43);
      expect(d.placement.y).toBeGreaterThan(21.4);
      expect(d.placement.y - size.h).toBeLessThan(80);
      expect(problems(res.booth)).toEqual({});
    });
    it(`${id}: is drawn above the window`, () => {
      const b = placeDecor(withWindow(), rawLib, id, overWindow).booth;
      const L = buildLayout(b, rawLib);
      expect(L.decor[0].z).toBeGreaterThan(L.placeables[0].z);
    });
  }
  it('a window added under an already hung garland is accepted too', () => {
    const hung = placeDecor(emptyBooth(), rawLib, 'xmas-garland', overWindow);
    expect(hung.ok).toBe(true);
    const added = placePlaceable(hung.booth, rawLib, 'window-sash', { x: 40, y: 80 });
    expect(added.ok, JSON.stringify(added.errors)).toBe(true);
    expect(problems(added.booth)).toEqual({});
  });
});

describe('every other piece still cannot overlap a window', () => {
  const others = lib.decor.filter((d) => d.mount === 'wall' && !d.mayOverlap);
  it('there are other wall pieces to check (curtains, frames, clock, mirror, lantern, the new prints)', () => {
    const ids = others.map((d) => d.id);
    for (const id of ['curtains-lace', 'frame-landscape', 'clock-wall', 'mirror-ornate', 'lantern-hanging', 'print-chrysanthemum', 'print-white-eye']) {
      expect(ids).toContain(id);
    }
  });
  for (const d of others) {
    it(`${d.id}: refused over the window (placeDecor)`, () => {
      const res = placeDecor(withWindow(), rawLib, d.id, overWindow);
      expect(res.ok).toBe(false);
      expect(codes(res)).toContain('BLOCKED_BY_FIXTURE');
    });
    it(`${d.id}: flagged as a problem when a saved booth has it over a window`, () => {
      const b = withWindow([dc(d.id, 45, 70)]);
      expect(problems(b).dc9?.map((e) => e.code)).toContain('BLOCKED_BY_FIXTURE');
    });
  }
  it('a window cannot be put under an ordinary wall piece either', () => {
    const framed = emptyBooth([], [dc('frame-landscape', 45, 60)]);
    const res = placePlaceable(framed, rawLib, 'window-sash', { x: 40, y: 80 });
    expect(res.ok).toBe(false);
  });
});

describe('the garland and the wreath still cannot overlap anything else', () => {
  for (const id of ['xmas-garland', 'xmas-wreath']) {
    it(`${id}: refused over another wall piece`, () => {
      const b = withWindow([dc('frame-landscape', 45, 60, 'dc1')]);
      const res = placeDecor(b, rawLib, id, { x: 57, y: 56 });
      expect(res.ok).toBe(false);
      expect(codes(res)).toContain('OVERLAP');
    });
    it(`${id}: another wall piece cannot be put on top of it (hung over a window)`, () => {
      const hung = placeDecor(withWindow(), rawLib, id, overWindow);
      expect(hung.ok).toBe(true);
      const g = hung.booth.decor[0].placement;
      const res = placeDecor(hung.booth, rawLib, 'frame-oval-mahogany', { x: g.x + 8, y: g.y - 1 });
      expect(res.ok).toBe(false);
    });
    it(`${id}: still blocked by a wall shelf`, () => {
      const shelfDef = rawLib.fixtures.find((f) => f.mount === 'wall' || f.category === 'shelf');
      const shelf = { id: 'fx1', fixtureId: shelfDef.id, x: 10, y: 30 };
      const res = placeDecor(emptyBooth([], [], [shelf]), rawLib, id, { x: 10 + shelfDef.widthIn / 2, y: 30 + shelfDef.heightIn / 2 + 6 });
      expect(res.ok).toBe(false);
      expect(codes(res)).toContain('BLOCKED_BY_FIXTURE');
    });
    it(`${id}: still blocked by a door`, () => {
      const res = placeDecor(emptyBooth([door], []), rawLib, id, { x: 92, y: 50 });
      expect(res.ok).toBe(false);
      expect(codes(res)).toContain('BLOCKED_BY_FIXTURE');
    });
    it(`${id}: a saved booth with it off the wall is still flagged`, () => {
      const bad = withWindow([{ id: 'dc9', decorId: id, placement: { surfaceId: 'wall', x: 110, y: 50, scaleAdj: 1 } }]);
      expect(problems(bad).dc9?.map((e) => e.code)).toContain('OUT_OF_ROOM');
    });
  }
});

describe('the draft survives save -> load with a garland and a wreath over a window', () => {
  it('toDraft -> JSON -> applyDraft keeps both pieces over the window, still problem-free', () => {
    let b = withWindow();
    b = placeDecor(b, rawLib, 'xmas-garland', { x: 58, y: 40 }).booth;
    const w = placeDecor(b, rawLib, 'xmas-wreath', { x: 58, y: 78 });
    expect(w.ok, JSON.stringify(w.errors)).toBe(true);
    b = w.booth;
    expect(b.decor).toHaveLength(2);
    const saved = JSON.parse(JSON.stringify(toDraft(b)));
    const loaded = applyDraft(emptyBooth([], [], []), saved);
    expect(loaded.decor).toEqual(b.decor);
    expect(loaded.room.placeables).toEqual([win]);
    expect(problems(loaded)).toEqual({});
  });
  it('the live site code (cleanDraft, read only) accepts the draft and keeps the placement', () => {
    const b = placeDecor(withWindow(), rawLib, 'xmas-wreath', overWindow).booth;
    const res = cleanDraft(JSON.parse(JSON.stringify(toDraft(b))), { lib: rawLib, itemIds: [], uploadSrcs: [] });
    expect(res.ok, res.message).toBe(true);
    expect(res.draft.decor).toHaveLength(1);
    expect(res.draft.decor[0].decorId).toBe('xmas-wreath');
    expect(res.draft.decor[0].placement.x).toBe(b.decor[0].placement.x);
    expect(res.draft.room.placeables).toEqual([win]);
  });
  it('removing the window afterwards leaves the garland where it was, and it can be removed', () => {
    const b = placeDecor(withWindow(), rawLib, 'xmas-garland', overWindow).booth;
    const noWin = { ...b, room: { ...b.room, placeables: [] } };
    expect(problems(noWin)).toEqual({});
    expect(removeDecor(b, b.decor[0].id).booth.decor).toHaveLength(0);
  });
});

describe('the new general decor', () => {
  it('library ids are only added: every live decor id is still there, once, and nothing else was dropped', () => {
    for (const id of LIVE_DECOR_IDS) expect(defs[id], id).toBeTruthy();
    expect(lib.decor.length).toBe(LIVE_DECOR_IDS.length + NEW_IDS.length + 6); // + the six new lights (decor-more-lights-fixtures.test.js)
    const ids = lib.decor.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('adds 12 pieces, none of them Christmas', () => {
    expect(NEW_IDS).toHaveLength(12);
    for (const id of NEW_IDS) {
      expect(defs[id], id).toBeTruthy();
      expect(defs[id].category).not.toBe('christmas');
    }
  });
  it('each has a real image on disk, a valid mount and a sensible size', () => {
    for (const id of NEW_IDS) {
      const d = defs[id];
      expect(existsSync(new URL('../' + d.src, import.meta.url)), d.src).toBe(true);
      expect(d.src).toBe(d.image);
      expect(['wall', 'floor', 'stand']).toContain(d.mount);
      expect(d.heightIn).toBeGreaterThan(3);
      expect(d.heightIn).toBeLessThan(90);
      expect(d.widthIn).toBeGreaterThan(3);
      expect(d.aspect).toBeCloseTo(d.widthIn / d.heightIn, 2);
      expect(d.mayOverlap).toBeUndefined();
    }
  });
  it('the Decor tab lists each new piece once', () => {
    const listed = pickerDecor(lib).map((d) => d.id);
    for (const id of NEW_IDS) expect(listed.filter((x) => x === id)).toHaveLength(1);
  });
  it('each new piece can be placed in an empty room (wall pieces on the wall, others on the floor)', () => {
    for (const id of NEW_IDS) {
      const d = defs[id];
      const res = placeDecor(emptyBooth(), rawLib, id, d.mount === 'wall' ? { x: 60, y: 50 } : { x: 60, y: 100 });
      expect(res.ok, `${id}: ${JSON.stringify(res.errors)}`).toBe(true);
    }
  });
  it('the candlestick and the kerosene lantern are switchable lamps with their own light point', () => {
    for (const id of ['candlestick-wooden', 'lantern-kerosene']) {
      expect(isLampDef(defs[id])).toBe(true);
      expect(LAMP_LIGHTS[id]).toBeTruthy();
    }
  });
  it('every new piece has exactly one CC0 licence row in LICENSES-library-additions.md, and no source repeats', () => {
    const md = readFileSync(new URL('../LICENSES-library-additions.md', import.meta.url), 'utf8');
    for (const id of NEW_IDS) {
      const rows = md.split('\n').filter((l) => l.startsWith(`| \`room-app/assets/decor/${id}.webp\``));
      expect(rows, id).toHaveLength(1);
      expect(rows[0]).toMatch(/CC0 1\.0/);
      expect(rows[0]).not.toMatch(/Pexels/);
    }
    const src = [...md.matchAll(/polyhaven\.com\/a\/([A-Za-z0-9_]+)/g)].map((m) => m[1]);
    const counts = {};
    for (const s of src) counts[s] = (counts[s] ?? 0) + 1;
    // a Poly Haven MODEL is credited once; the shared wood texture of the own-work fixtures is the one deliberate repeat
    expect(Object.entries(counts).filter(([k, n]) => n > 1 && k !== 'fine_grained_wood')).toEqual([]);
    const art = [...md.matchAll(/artic\.edu\/artworks\/(\d+)/g)].map((m) => m[1]);
    expect(new Set(art).size).toBe(art.length);
  });
});
