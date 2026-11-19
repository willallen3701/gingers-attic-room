import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeLibrary } from '../src/logic/library.js';
import { buildLayout } from '../src/logic/layout.js';
import { toDraft, applyDraft, defaultRoom } from '../src/logic/draft.js';
import { placeDecor, setDecorLit, setDecorScale, moveFixtureTo } from '../src/logic/editops.js';
import { LAMP_LIGHTS, DEFAULT_LIGHT, isLampDef, lightFor, lampGlow, litLamps, anyLampLit } from '../src/logic/lamps.js';

const lib = normalizeLibrary(JSON.parse(readFileSync(new URL('../data/library.json', import.meta.url), 'utf8')));
const demo = JSON.parse(readFileSync(new URL('../data/demo-booth.json', import.meta.url), 'utf8'));
const lamps = lib.decor.filter((d) => d.category === 'lighting');
const def = (id) => lib.decor.find((d) => d.id === id);
const booth = (decor, fixtures = [{ id: 'fx3', fixtureId: 'table-farm-60', x: 58, y: 65.5 }]) => ({
  id: 'b', name: 'T', boothNumber: 1, room: defaultRoom(lib), fixtures, items: [], decor,
});
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

describe('which decor is a lamp', () => {
  it('every lighting decor in the library is a lamp and has a light position', () => {
    expect(lamps.map((d) => d.id).sort()).toEqual(['candelabra-brass', 'candlestick-wooden', 'chandelier-brass-shades', 'chandelier-candle', 'lamp-floor-fringe', 'lamp-oil', 'lamp-pipe-edison', 'lantern-hanging', 'lantern-kerosene', 'pendant-factory', 'pendant-opal-globe', 'sconce-bulkhead', 'xmas-candles']);
    for (const d of lamps) {
      expect(isLampDef(d)).toBe(true);
      expect(LAMP_LIGHTS[d.id], d.id).toBeTruthy();
    }
  });
  it('plants, clocks and mirrors are not lamps', () => {
    for (const d of lib.decor.filter((x) => x.category !== 'lighting')) expect(isLampDef(d)).toBe(false);
    expect(isLampDef(undefined)).toBe(false);
  });
  it('light points sit inside the artwork box', () => {
    for (const [id, L] of Object.entries(LAMP_LIGHTS)) {
      for (const p of L.points) {
        expect(p.x, id).toBeGreaterThan(0);
        expect(p.x, id).toBeLessThan(1);
        expect(p.y, id).toBeGreaterThanOrEqual(0);
        expect(p.y, id).toBeLessThan(1);
      }
    }
  });
  it('a lighting decor the table does not know gets the default bulb; a library glow overrides', () => {
    expect(lightFor({ id: 'lamp-new', category: 'lighting' })).toBe(DEFAULT_LIGHT);
    const own = lightFor({ id: 'lamp-new', category: 'lighting', glow: { kind: 'flame', points: [{ x: 0.4, y: 0.1 }] } });
    expect(own.kind).toBe('flame');
    expect(own.points).toEqual([{ x: 0.4, y: 0.1 }]);
    expect(lightFor({ id: 'lamp-new', glow: { points: 'nope' } })).toBe(DEFAULT_LIGHT);
  });
});

describe('glow positions', () => {
  it('the candelabra has three flames on its candle tips, in room inches', () => {
    const L = buildLayout(booth([{ id: 'c', decorId: 'candelabra-brass', placement: { surfaceId: 'fx3:top', x: 100, y: 65.5, scaleAdj: 1 }, lit: true }]), lib);
    const [g] = litLamps(L);
    const d = def('candelabra-brass');
    const w = d.heightIn * d.aspect;
    const top = 65.5 - d.heightIn;
    expect(g.kind).toBe('flame');
    expect(g.flicker).toBe(true);
    expect(g.lights).toHaveLength(3);
    const want = [[0.09, 0.07], [0.5, 0.025], [0.905, 0.07]];
    g.lights.forEach((l, i) => {
      expect(close(l.x, 100 + want[i][0] * w)).toBe(true);
      expect(close(l.y, top + want[i][1] * d.heightIn)).toBe(true);
    });
    // left and right flames are lower than the centre one, all near the top of the candelabra
    expect(g.lights[0].y).toBeGreaterThan(g.lights[1].y);
    expect(g.lights[1].y - top).toBeLessThan(1);
    // the wall pool is centred on the flames; it stands on the table, so a narrow pool lights the tabletop
    expect(close(g.pool.x, g.lights.reduce((s, l) => s + l.x, 0) / 3)).toBe(true);
    expect(g.ground.y).toBe(65.5);
    expect(g.ground.rx).toBeGreaterThan(g.ground.ry * 5);
  });

  it('the floor lamp glows across its shade and throws a pool on the floor', () => {
    const L = buildLayout(booth([{ id: 'f', decorId: 'lamp-floor-fringe', placement: { surfaceId: 'floor', x: 10, y: 100, scaleAdj: 1 }, lit: true }]), lib);
    const [g] = litLamps(L);
    const d = def('lamp-floor-fringe');
    const w = d.heightIn * d.aspect;
    expect(g.kind).toBe('shade');
    expect(g.flicker).toBe(false);
    const [l] = g.lights;
    expect(close(l.x, 10 + w / 2)).toBe(true);
    // inside the shade (top 21 % of the lamp)
    expect(l.y).toBeGreaterThan(100 - d.heightIn);
    expect(l.y).toBeLessThan(100 - d.heightIn * 0.79);
    expect(l.rx).toBeGreaterThan(w * 0.3); // the core covers most of the shade
    expect(g.ground.y).toBe(100);
    expect(g.ground.rx).toBeGreaterThan(g.pool.r); // floor pools spread wider than tall
  });

  it('the hanging lantern lights its bulb and throws no ground pool', () => {
    const L = buildLayout(booth([{ id: 'h', decorId: 'lantern-hanging', placement: { surfaceId: 'wall', x: 40, y: 50, scaleAdj: 1 }, lit: true }], []), lib);
    const [g] = litLamps(L);
    const d = def('lantern-hanging');
    expect(g.kind).toBe('bulb');
    expect(close(g.lights[0].y, 50 - d.heightIn + 0.57 * d.heightIn)).toBe(true);
    expect(g.ground).toBeNull();
  });

  it('the oil lamp flame sits in the chimney above the burner', () => {
    const L = buildLayout(booth([{ id: 'o', decorId: 'lamp-oil', placement: { surfaceId: 'fx3:top', x: 70, y: 65.5, scaleAdj: 1 }, lit: true }]), lib);
    const [g] = litLamps(L);
    const d = def('lamp-oil');
    expect(close(g.lights[0].y, 65.5 - d.heightIn + 0.37 * d.heightIn)).toBe(true);
    expect(close(g.lights[0].x, 70 + (d.heightIn * d.aspect) / 2)).toBe(true);
  });

  it('a lamp made bigger in the editor gets a bigger glow at the same spot of its artwork', () => {
    const at = (scaleAdj) => litLamps(buildLayout(booth([{ id: 'o', decorId: 'lamp-oil', placement: { surfaceId: 'fx3:top', x: 70, y: 65.5, scaleAdj }, lit: true }]), lib))[0];
    const a = at(1);
    const b = at(1.2);
    expect(close(b.pool.r, a.pool.r * 1.2)).toBe(true);
    expect(close(b.lights[0].halo, a.lights[0].halo * 1.2)).toBe(true);
    expect(b.lights[0].y).toBeLessThan(a.lights[0].y); // taller lamp, flame higher
  });

  it('only lamps that are switched on glow', () => {
    const L = buildLayout(booth([
      { id: 'a', decorId: 'lamp-oil', placement: { surfaceId: 'fx3:top', x: 62, y: 65.5 }, lit: false },
      { id: 'b', decorId: 'candelabra-brass', placement: { surfaceId: 'fx3:top', x: 80, y: 65.5 } },
      { id: 'c', decorId: 'plant-succulent', placement: { surfaceId: 'fx3:top', x: 100, y: 65.5 }, lit: true },
    ]), lib);
    expect(litLamps(L)).toEqual([]);
    expect(anyLampLit(L)).toBe(false);
    expect(anyLampLit(buildLayout(demo, lib))).toBe(true); // the demo booth's candelabra is on
  });

  it('lampGlow reads the layout entry directly', () => {
    const L = buildLayout(booth([{ id: 'c', decorId: 'candelabra-brass', placement: { surfaceId: 'fx3:top', x: 100, y: 65.5 }, lit: true }]), lib);
    expect(lampGlow(L.decor[0]).id).toBe('c');
  });
});

describe('the lamp switch in the editor data', () => {
  it('a new lamp starts off; other decor gets no switch', () => {
    const r = placeDecor(booth([]), lib, 'lamp-oil', { x: 80, y: 65 });
    expect(r.ok).toBe(true);
    expect(r.booth.decor[0].lit).toBe(false);
    const p = placeDecor(booth([]), lib, 'plant-succulent', { x: 80, y: 65 });
    expect('lit' in p.booth.decor[0]).toBe(false);
  });

  it('setDecorLit switches a lamp and refuses anything else', () => {
    const b0 = placeDecor(booth([]), lib, 'lamp-oil', { x: 80, y: 65 }).booth;
    const id = b0.decor[0].id;
    const on = setDecorLit(b0, lib, id, true);
    expect(on.ok).toBe(true);
    expect(on.booth.decor[0].lit).toBe(true);
    expect(b0.decor[0].lit).toBe(false); // pure
    expect(setDecorLit(on.booth, lib, id, false).booth.decor[0].lit).toBe(false);
    const plant = placeDecor(booth([]), lib, 'plant-succulent', { x: 80, y: 65 }).booth;
    expect(setDecorLit(plant, lib, plant.decor[0].id, true).ok).toBe(false);
    expect(setDecorLit(plant, lib, 'nope', true).ok).toBe(false);
  });

  it('moving, resizing or riding a moved table keeps the lamp on', () => {
    let b = placeDecor(booth([]), lib, 'lamp-oil', { x: 80, y: 65 }).booth;
    const id = b.decor[0].id;
    b = setDecorLit(b, lib, id, true).booth;
    const moved = placeDecor(b, lib, 'lamp-oil', { x: 90, y: 65 }, id);
    expect(moved.ok).toBe(true);
    expect(moved.booth.decor[0].lit).toBe(true);
    expect(setDecorScale(moved.booth, lib, id, 1.1).booth.decor[0].lit).toBe(true);
    const table = moveFixtureTo(moved.booth, lib, 'fx3', { x: 50, y: 65.5 });
    expect(table.ok).toBe(true);
    expect(table.booth.decor[0].lit).toBe(true);
  });

  it('lit travels in the saved draft and comes back on reload', () => {
    let b = placeDecor(booth([]), lib, 'candelabra-brass', { x: 80, y: 65 }).booth;
    b = setDecorLit(b, lib, b.decor[0].id, true).booth;
    const draft = JSON.parse(JSON.stringify(toDraft(b))); // what save-draft posts
    expect(draft.decor[0]).toMatchObject({ decorId: 'candelabra-brass', lit: true });
    const back = applyDraft(booth([]), draft);
    expect(back.decor[0].lit).toBe(true);
    expect(anyLampLit(buildLayout(back, lib))).toBe(true);
  });
});
