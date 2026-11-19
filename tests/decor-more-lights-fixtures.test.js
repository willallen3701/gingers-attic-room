// "decor-more" (2026-11), part 2: six new lights (four hang from the top of the wall on a cord the app draws) and eight new
// fixtures. Library ids are only ever added (live booths store them); the live site code (boothShape.js, read only) gates ids
// through the library it fetches, so it accepts these without any site change.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { normalizeLibrary, byId } from '../src/logic/library.js';
import { buildLayout } from '../src/logic/layout.js';
import { toDraft, applyDraft } from '../src/logic/draft.js';
import { placeDecor, setDecorLit, addFixture, deleteFixture } from '../src/logic/editops.js';
import { isLampDef, LAMP_LIGHTS, litLamps, anyLampLit } from '../src/logic/lamps.js';
import { decorHtml } from '../src/room-render.js';
import { FLOOR_BAND } from '../src/logic/fixtures.js';
import { cleanDraft } from '../../site/src/backend/boothShape.js';

const rawLib = JSON.parse(readFileSync(new URL('../data/library.json', import.meta.url), 'utf8'));
const lib = normalizeLibrary(rawLib);
const defs = byId(lib.decor);
const fdefs = byId(lib.fixtures);

const NEW_LIGHTS = ['chandelier-brass-shades', 'chandelier-candle', 'pendant-opal-globe', 'pendant-factory', 'sconce-bulkhead', 'lamp-pipe-edison'];
const OVERHEAD = ['chandelier-brass-shades', 'chandelier-candle', 'pendant-opal-globe', 'pendant-factory'];
const NEW_FIXTURES = [
  'pie-safe-spindle', 'bench-painted', 'table-round-cupboard', 'cabinet-display-lacquer', 'rack-metal-worn', 'stand-tiered', 'rack-plate-30', 'case-curio-tall',
];
// the fixture ids of the live room app (commit 2963cc9): never removed, and still first in the library, in the same order
const LIVE_FIXTURE_IDS = [
  'shelf-single-24-cream', 'shelf-single-24-oak', 'shelf-single-24-walnut', 'shelf-single-36-cream', 'shelf-single-36-oak', 'shelf-single-36-walnut',
  'shelf-single-48-cream', 'shelf-single-48-oak', 'shelf-single-48-walnut', 'shelf-spice-red', 'shelf-stack-2-cream', 'shelf-stack-2-oak',
  'shelf-stack-2-walnut', 'shelf-stack-3-cream', 'shelf-stack-3-oak', 'shelf-stack-3-walnut', 'shelf-stack-4-cream', 'shelf-stack-4-walnut',
  'shelf-stack-4', 'table-console-carved', 'table-farm-48', 'table-farm-60-walnut', 'table-farm-60', 'table-farm-72', 'pedestal-36', 'pedestal-42',
  'stand-plant-short', 'stand-plant-tall', 'table-side-blue', 'table-side-oak', 'table-side-carved', 'table-work-rustic', 'table-writing',
  'cabinet-apothecary', 'bookcase-white', 'bookcase-rustic', 'hutch-china-54', 'hutch-china-64', 'hutch-blue', 'cupboard-carved', 'dresser-chippy',
  'dresser-carved', 'case-glass-24', 'case-glass-36', 'case-counter-48', 'coatrack-24', 'coatrack-36', 'pegboard-24x36', 'pegboard-36x24',
  'ledge-picture-36', 'ledge-picture-48', 'rail-plate-36', 'rail-plate-48',
];

const emptyBooth = (placeables = [], decor = [], fixtures = []) => ({
  id: 'b', name: 'T', boothNumber: 1, items: [], boxes: [], fixtures, decor,
  room: { wall: { type: 'paint', paintId: 'paint-bottle-green' }, floor: {}, light: null, architecture: [], placeables, sign: { style: 'wood' } },
});
const win = { id: 'ar1', archId: 'window-sash', x: 40, y: 80 }; // 36.43 x 58.64 in at x 40..76.4, top 21.4
const withWindow = (decor = []) => emptyBooth([win], decor);
const dc = (decorId, x, y, id = 'dc9') => ({ id, decorId, placement: { surfaceId: 'wall', x, y, scaleAdj: 1 } });
const problems = (b) => buildLayout(b, rawLib).problems;
const codes = (res) => res.errors.map((e) => e.code);

describe('the new lights', () => {
  it('six lighting pieces: four hang from the top of the wall, a wall lamp and a table lamp', () => {
    for (const id of NEW_LIGHTS) {
      expect(defs[id], id).toBeTruthy();
      expect(defs[id].category).toBe('lighting');
      expect(isLampDef(defs[id])).toBe(true);
      expect(LAMP_LIGHTS[id], `${id} has its own glow`).toBeTruthy();
      expect(existsSync(new URL('../' + defs[id].src, import.meta.url)), id).toBe(true);
    }
    expect(NEW_LIGHTS.filter((id) => defs[id].hang).sort()).toEqual([...OVERHEAD].sort());
    expect(defs['sconce-bulkhead'].mount).toBe('wall');
    expect(defs['lamp-pipe-edison'].mount).toBe('stand');
  });

  it('the overhead ones are ordinary wall decor with a well-formed hang block (no new mount type)', () => {
    for (const id of OVERHEAD) {
      const d = defs[id];
      expect(d.mount).toBe('wall');
      expect(d.hang.x).toBeGreaterThan(0.2);
      expect(d.hang.x).toBeLessThan(0.8);
      expect(d.hang.widthIn).toBeGreaterThan(0.2);
      expect(d.hang.maxDropIn).toBeGreaterThan(10);
      expect(d.hang.color).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(lib.decor.filter((d) => d.hang).map((d) => d.id).sort()).toEqual([...OVERHEAD].sort());
    expect(new Set(lib.decor.map((d) => d.mount))).toEqual(new Set(['wall', 'floor', 'stand']));
  });

  for (const id of NEW_LIGHTS) {
    it(`${id}: can be placed, starts off, switches on and off, and glows`, () => {
      const d = defs[id];
      const res = placeDecor(emptyBooth(), rawLib, id, d.mount === 'wall' ? { x: 60, y: 30 } : { x: 60, y: 100 });
      expect(res.ok, JSON.stringify(res.errors)).toBe(true);
      expect(res.booth.decor[0].lit).toBe(false);
      expect(anyLampLit(buildLayout(res.booth, rawLib))).toBe(false);
      const on = setDecorLit(res.booth, rawLib, res.id, true);
      expect(on.ok).toBe(true);
      expect(on.booth.decor[0].lit).toBe(true);
      const lay = buildLayout(on.booth, rawLib);
      expect(anyLampLit(lay)).toBe(true);
      const glow = litLamps(lay)[0];
      expect(glow.lights.length).toBeGreaterThan(0);
      const p = res.booth.decor[0].placement;
      for (const l of glow.lights) {
        expect(l.x).toBeGreaterThan(p.x - 0.01);
        expect(l.x).toBeLessThan(p.x + d.widthIn + 0.01);
        expect(l.y).toBeGreaterThan(p.y - d.heightIn - 0.01);
        expect(l.y).toBeLessThan(p.y + 0.01);
      }
      // overhead and wall lamps throw no pool on a floor or shelf; the table lamp does
      expect(glow.ground === null).toBe(d.mount === 'wall');
      const off = setDecorLit(on.booth, rawLib, res.id, false);
      expect(off.booth.decor[0].lit).toBe(false);
      expect(anyLampLit(buildLayout(off.booth, rawLib))).toBe(false);
      expect(problems(off.booth)).toEqual({});
    });
  }

  it('an overhead light hangs from the top of the wall: a drop near the top sits at the top, a low drop stops at maxDropIn', () => {
    for (const id of OVERHEAD) {
      const d = defs[id];
      const up = placeDecor(emptyBooth(), rawLib, id, { x: 60, y: 3 });
      expect(up.ok, id).toBe(true);
      expect(up.booth.decor[0].placement.y - d.heightIn).toBeCloseTo(0, 1); // top of the piece at the top of the wall
      const low = placeDecor(emptyBooth(), rawLib, id, { x: 60, y: 88 });
      expect(low.ok, id).toBe(true);
      expect(low.booth.decor[0].placement.y - d.heightIn).toBeCloseTo(d.hang.maxDropIn, 1);
      expect(problems(low.booth)).toEqual({});
    }
  });

  it('its cord is drawn from the top of the wall to the piece, only when the piece hangs lower than the top', () => {
    const d = defs['chandelier-candle'];
    const lowB = placeDecor(emptyBooth(), rawLib, 'chandelier-candle', { x: 60, y: 60 }).booth;
    const htmlLow = decorHtml(buildLayout(lowB, rawLib), {});
    expect(htmlLow).toContain('class="cord"');
    expect(htmlLow).toContain('class="item decor mount-wall hanging');
    expect(htmlLow).toContain(`--cord:${d.hang.color}`);
    const topB = placeDecor(emptyBooth(), rawLib, 'chandelier-candle', { x: 60, y: 3 }).booth;
    expect(decorHtml(buildLayout(topB, rawLib), {})).not.toContain('class="cord"');
    const frame = placeDecor(emptyBooth(), rawLib, 'frame-landscape', { x: 60, y: 60 }).booth;
    expect(decorHtml(buildLayout(frame, rawLib), {})).not.toContain('cord');
  });

  it('the cord adds no placement field: the saved decor entry is the ordinary one', () => {
    const b = placeDecor(emptyBooth(), rawLib, 'pendant-factory', { x: 40, y: 50 }).booth;
    expect(Object.keys(b.decor[0]).sort()).toEqual(['decorId', 'id', 'lit', 'placement']);
    expect(Object.keys(b.decor[0].placement).sort()).toEqual(['scaleAdj', 'surfaceId', 'x', 'y']);
  });

  it('lights stay in the room, switched on, after save -> load, and the live site code (cleanDraft) keeps them lit', () => {
    let b = emptyBooth();
    for (const [id, drop] of [['chandelier-brass-shades', { x: 30, y: 40 }], ['pendant-opal-globe', { x: 90, y: 40 }], ['sconce-bulkhead', { x: 60, y: 45 }], ['lamp-pipe-edison', { x: 20, y: 108 }]]) {
      const r = placeDecor(b, rawLib, id, drop);
      expect(r.ok, `${id} ${JSON.stringify(r.errors)}`).toBe(true);
      b = setDecorLit(r.booth, rawLib, r.id, true).booth;
    }
    const saved = JSON.parse(JSON.stringify(toDraft(b)));
    const loaded = applyDraft(emptyBooth(), saved);
    expect(loaded.decor).toEqual(b.decor);
    expect(loaded.decor.every((d) => d.lit === true)).toBe(true);
    expect(problems(loaded)).toEqual({});
    expect(litLamps(buildLayout(loaded, rawLib))).toHaveLength(4);
    const res = cleanDraft(saved, { lib: rawLib, itemIds: [], uploadSrcs: [] });
    expect(res.ok, res.message).toBe(true);
    expect(res.draft.decor).toHaveLength(4);
    expect(res.draft.decor.every((d) => d.lit === true)).toBe(true);
    expect(res.draft.decor.map((d) => d.placement.y)).toEqual(b.decor.map((d) => d.placement.y));
  });

  it('an overhead light cannot overlap another wall piece, and cannot be put over a window', () => {
    const framed = emptyBooth([], [dc('frame-landscape', 40, 40, 'dc1')]);
    expect(placeDecor(framed, rawLib, 'chandelier-brass-shades', { x: 50, y: 40 }).ok).toBe(false);
    const res = placeDecor(withWindow(), rawLib, 'pendant-opal-globe', { x: 58, y: 40 });
    expect(res.ok).toBe(false);
    expect(codes(res)).toContain('BLOCKED_BY_FIXTURE');
  });

  it('the existing hanging lantern is unchanged (no hang block, still placeable at any height)', () => {
    expect(defs['lantern-hanging'].hang).toBeUndefined();
    expect(placeDecor(emptyBooth(), rawLib, 'lantern-hanging', { x: 60, y: 70 }).ok).toBe(true);
  });
});

const gapsOf = (def) => {
  const lines = def.surfaces.filter((s) => !s.hang).sort((a, b) => a.y - b.y);
  const gaps = [];
  for (let i = 1; i < lines.length; i++) gaps.push(lines[i].y - lines[i - 1].y - def.boardThicknessIn);
  return gaps;
};

describe('the new fixtures', () => {
  it('library ids are only added: every live fixture id is still there, still first and in order, and nothing was dropped', () => {
    for (const id of LIVE_FIXTURE_IDS) expect(fdefs[id], id).toBeTruthy();
    const ids = lib.fixtures.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(LIVE_FIXTURE_IDS.length + NEW_FIXTURES.length);
    expect(ids.slice(0, LIVE_FIXTURE_IDS.length)).toEqual(LIVE_FIXTURE_IDS);
  });

  it('adds 8 fixtures in the existing categories, each with an image, a group and a variant', () => {
    expect(NEW_FIXTURES).toHaveLength(8);
    for (const id of NEW_FIXTURES) {
      const f = fdefs[id];
      expect(f, id).toBeTruthy();
      expect(['shelf', 'table', 'cabinet', 'hanger']).toContain(f.category);
      expect(['wall', 'floor']).toContain(f.mount);
      expect(typeof f.group).toBe('string');
      expect(typeof f.variant).toBe('string');
      expect(existsSync(new URL('../' + f.src, import.meta.url)), f.src).toBe(true);
      expect(f.boardThicknessIn).toBeGreaterThan(0);
    }
  });

  it('every standing surface lies inside the artwork and has a sensible width', () => {
    for (const id of NEW_FIXTURES) {
      const f = fdefs[id];
      expect(f.surfaces.length, id).toBeGreaterThan(0);
      for (const s of f.surfaces) {
        expect(s.x1, `${id}:${s.id}`).toBeGreaterThanOrEqual(0);
        expect(s.x2, `${id}:${s.id}`).toBeLessThanOrEqual(f.widthIn + 0.01);
        expect(s.x2 - s.x1).toBeGreaterThan(5);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThan(f.heightIn);
      }
      expect(new Set(f.surfaces.map((s) => s.id)).size).toBe(f.surfaces.length);
    }
  });

  it('shelf gaps are realistic, and some pieces offer roomy shelves (12 in or more) for taller items', () => {
    for (const id of ['rack-metal-worn', 'case-curio-tall', 'cabinet-display-lacquer', 'rack-plate-30', 'stand-tiered']) {
      for (const g of gapsOf(fdefs[id])) expect(g, id).toBeGreaterThan(5);
    }
    for (const id of ['rack-metal-worn', 'case-curio-tall']) {
      expect(gapsOf(fdefs[id]).every((g) => g >= 12), id).toBe(true);
    }
    // the lacquered cabinet's two niches are just under 12 in (11.8) and 15 in
    expect(Math.min(...gapsOf(fdefs['cabinet-display-lacquer']))).toBeGreaterThan(11.5);
    expect(gapsOf(fdefs['rack-metal-worn']).length).toBeGreaterThanOrEqual(4);
    expect(gapsOf(fdefs['case-curio-tall']).length).toBeGreaterThanOrEqual(4);
  });

  for (const id of NEW_FIXTURES) {
    it(`${id}: can be added to a room with no problems, and a piece stands on each of its surfaces`, () => {
      const def = fdefs[id];
      const pos = def.mount === 'wall' ? { x: 40, y: 30 } : { x: 40, y: FLOOR_BAND.yMax - def.heightIn };
      const add = addFixture(emptyBooth(), rawLib, id, pos);
      expect(add.ok, JSON.stringify(add.errors)).toBe(true);
      let b = add.booth;
      expect(problems(b)).toEqual({});
      const f = b.fixtures[0];
      let n = 0;
      for (const s of def.surfaces.filter((x) => !x.hang)) {
        const r = placeDecor(b, rawLib, 'plant-succulent', { x: f.x + (s.x1 + s.x2) / 2, y: f.y + s.y });
        expect(r.ok, `${id}:${s.id} ${JSON.stringify(r.errors)}`).toBe(true);
        expect(r.booth.decor.find((d) => d.id === r.id).placement.surfaceId, `${id}:${s.id}`).toBe(`${f.id}:${s.id}`);
        b = r.booth;
        n++;
      }
      expect(n).toBeGreaterThan(0);
      expect(problems(b)).toEqual({});
    });
  }

  it('taller items fit the roomy shelves: a 16 in candelabra on every shelf of the metal rack, a 12 in lantern in the curio cabinet', () => {
    for (const [id, piece] of [['rack-metal-worn', 'candelabra-brass'], ['case-curio-tall', 'lantern-kerosene']]) {
      const def = fdefs[id];
      let b = addFixture(emptyBooth(), rawLib, id, { x: 40, y: FLOOR_BAND.yMax - def.heightIn }).booth;
      const f = b.fixtures[0];
      const shelves = def.surfaces.filter((s) => !s.hang && s.y > 1 && s.y < def.heightIn - 9); // the boards between the top and the floor
      expect(shelves.length).toBeGreaterThanOrEqual(3);
      for (const s of shelves) {
        const r = placeDecor(b, rawLib, piece, { x: f.x + (s.x1 + s.x2) / 2, y: f.y + s.y });
        expect(r.ok, `${id}:${s.id} ${JSON.stringify(r.errors)}`).toBe(true);
        expect(r.booth.decor.find((d) => d.id === r.id).placement.surfaceId).toBe(`${f.id}:${s.id}`);
        b = r.booth;
      }
      expect(problems(b)).toEqual({});
    }
  });

  it('the wall plate rack stays on the wall and cannot cover a window', () => {
    expect(fdefs['rack-plate-30'].mount).toBe('wall');
    expect(addFixture(withWindow(), rawLib, 'rack-plate-30', { x: 45, y: 40 }).ok).toBe(false);
    const ok = addFixture(withWindow(), rawLib, 'rack-plate-30', { x: 5, y: 30 });
    expect(ok.ok, JSON.stringify(ok.errors)).toBe(true);
  });

  it('a room with several of the new fixtures: contents are removed with a deleted fixture', () => {
    let b = emptyBooth();
    for (const [id, x] of [['rack-metal-worn', 4], ['pie-safe-spindle', 46], ['stand-tiered', 84]]) {
      const r = addFixture(b, rawLib, id, { x, y: FLOOR_BAND.yMax - fdefs[id].heightIn });
      expect(r.ok, `${id} ${JSON.stringify(r.errors)}`).toBe(true);
      b = r.booth;
    }
    const wall = addFixture(b, rawLib, 'rack-plate-30', { x: 70, y: 20 });
    expect(wall.ok).toBe(true);
    b = wall.booth;
    expect(problems(b)).toEqual({});
    const tier = b.fixtures[2];
    const r = placeDecor(b, rawLib, 'plant-succulent', { x: tier.x + 12, y: tier.y + fdefs['stand-tiered'].surfaces[0].y });
    expect(r.ok, JSON.stringify(r.errors)).toBe(true);
    expect(r.booth.decor.find((d) => d.id === r.id).placement.surfaceId).toBe(`${tier.id}:t0`);
    expect(deleteFixture(r.booth, tier.id).removedDecorIds).toContain(r.id);
  });

  it('the draft survives save -> load, and the live site code (cleanDraft, read only) accepts the new fixture ids via lib.fixtures', () => {
    let b = emptyBooth();
    for (const [id, x] of [['pie-safe-spindle', 4], ['bench-painted', 40], ['table-round-cupboard', 90]]) {
      const r = addFixture(b, rawLib, id, { x, y: FLOOR_BAND.yMax - fdefs[id].heightIn });
      expect(r.ok, `${id} ${JSON.stringify(r.errors)}`).toBe(true);
      b = r.booth;
    }
    const saved = JSON.parse(JSON.stringify(toDraft(b)));
    const loaded = applyDraft(emptyBooth(), saved);
    expect(loaded.fixtures).toEqual(b.fixtures);
    expect(problems(loaded)).toEqual({});
    const res = cleanDraft(saved, { lib: rawLib, itemIds: [], uploadSrcs: [] });
    expect(res.ok, res.message).toBe(true);
    expect(res.draft.fixtures.map((f) => f.fixtureId)).toEqual(['pie-safe-spindle', 'bench-painted', 'table-round-cupboard']);
    // an unknown fixture id is still refused, so it is the library that gates the ids
    const bad = JSON.parse(JSON.stringify(saved));
    bad.fixtures[0].fixtureId = 'no-such-fixture';
    expect(cleanDraft(bad, { lib: rawLib, itemIds: [], uploadSrcs: [] }).ok).toBe(false);
  });

  it('every new fixture has exactly one CC0 licence row, and its source is not credited twice', () => {
    const md = readFileSync(new URL('../LICENSES-library-additions.md', import.meta.url), 'utf8');
    for (const id of NEW_FIXTURES) {
      const rows = md.split('\n').filter((l) => l.startsWith(`| \`room-app/assets/fixtures/${id}.webp\``));
      expect(rows, id).toHaveLength(1);
      expect(rows[0]).toMatch(/CC0 1\.0/);
    }
    for (const id of NEW_LIGHTS) {
      const rows = md.split('\n').filter((l) => l.startsWith(`| \`room-app/assets/decor/${id}.webp\``));
      expect(rows, id).toHaveLength(1);
      expect(rows[0]).toMatch(/CC0 1\.0/);
    }
  });
});
