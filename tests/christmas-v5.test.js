// Christmas v5 (stockings scratched by the owner): ONE real-photo garland (sized with the slider), a warmer nutcracker,
// the wall-hung shadow, and the generic library "family" (choices of one piece; no shipped piece uses it now, so it is
// tested on a synthetic library). Choices are library entries of one `family`, stored as plain decorIds,
// so the live site (cleanDraft keeps decorId, x, y, scaleAdj) needs no change.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { normalizeLibrary, byId, decorFamily, pickerDecor } from '../src/logic/library.js';
import { buildLayout } from '../src/logic/layout.js';
import { toDraft, applyDraft } from '../src/logic/draft.js';
import { placeDecor, setDecorVariant, setDecorScale, removeDecor } from '../src/logic/editops.js';
import { itemSizeIn, tweakRange } from '../src/logic/scale.js';
import { applyTemplate } from '../src/logic/templates.js';
import { roomInnerHtml } from '../src/room-render.js';
import { css } from '../src/styles.js';
import { cleanDraft } from '../../site/src/backend/boothShape.js';

const rawLib = JSON.parse(readFileSync(new URL('../data/library.json', import.meta.url), 'utf8'));
const demo = JSON.parse(readFileSync(new URL('../data/demo-booth.json', import.meta.url), 'utf8'));
const lib = normalizeLibrary(rawLib);
const defs = byId(lib.decor);
const NOV = new Date(2026, 10, 18, 12, 0, 0);
const xmas = () => applyTemplate({ ...JSON.parse(JSON.stringify(demo)), boxes: [] }, rawLib, 'christmas', { now: NOV }).booth;
const find = (b, prefix) => b.decor.find((d) => d.decorId === prefix);
const sizeOf = (d) => itemSizeIn({ heightIn: defs[d.decorId].heightIn, widthIn: defs[d.decorId].widthIn, aspect: defs[d.decorId].aspect, mount: 'wall' }, d.placement.scaleAdj ?? 1);
const emptyBooth = (decor = []) => ({ id: 'b', name: 'T', boothNumber: 1, room: { wall: { type: 'paint', paintId: 'paint-bottle-green' }, floor: {}, light: null, architecture: [], placeables: [] }, fixtures: [], decor, items: [], boxes: [] });
// a synthetic library: copies of a shipped wall piece stand in as three choices of ONE piece
const famRaw = (() => {
  const r = JSON.parse(JSON.stringify(rawLib));
  const base = r.decor.find((d) => d.id === 'xmas-wreath');
  const mk = (id, choice, swatch) => ({ ...base, id, name: `Test wreath, ${choice}`, family: { id: 'test-wreath', label: 'Design', choice, swatch } });
  r.decor.push(mk('test-wreath', 'Red', '#b5232b'), mk('test-wreath-green', 'Green', '#2a6b3a'), mk('test-wreath-blue', 'Blue', '#1f3a6b'));
  return r;
})();
const famLib = normalizeLibrary(famRaw);
const wallDecor = (decorId, x = 40, y = 40, id = 'dc1') => ({ id, decorId, placement: { surfaceId: 'wall', x, y, scaleAdj: 1 } });

describe('the garland is one real photographed swag, sized with the slider', () => {
  const g = defs['xmas-garland'];
  it('is a single library entry (no mirrored or lengthened versions, no family), 34 in wide', () => {
    expect(g.family).toBeUndefined();
    expect(decorFamily(lib, 'xmas-garland')).toBeNull();
    expect(lib.decor.filter((d) => /garland/i.test(d.name))).toHaveLength(1);
    expect(lib.decor.some((d) => d.id === 'xmas-garland-short' || d.id === 'xmas-garland-long')).toBe(false);
    expect(g.widthIn).toBe(34);
  });
  it('the Decor tab lists it once, and no stockings are left anywhere in the library', () => {
    const listed = pickerDecor(lib).map((d) => d.id);
    expect(listed.filter((id) => id.startsWith('xmas-garland'))).toEqual(['xmas-garland']);
    expect(lib.decor.some((d) => /stocking/i.test(d.id + d.name + d.src))).toBe(false);
    expect(lib.decor.some((d) => d.family)).toBe(false);
  });
  it('the size slider changes its width, 80 % to 120 % (27 to 41 in)', () => {
    const b = emptyBooth([wallDecor('xmas-garland', 20, 40)]);
    const small = setDecorScale(b, rawLib, 'dc1', 0.8);
    const big = setDecorScale(b, rawLib, 'dc1', 1.2);
    expect(small.ok && big.ok).toBe(true);
    expect(sizeOf(small.booth.decor[0]).w).toBeCloseTo(g.widthIn * 0.8, 1);
    expect(sizeOf(big.booth.decor[0]).w).toBeCloseTo(g.widthIn * 1.2, 1);
    const r = tweakRange({ heightIn: g.heightIn, widthIn: g.widthIn, aspect: g.aspect, mount: 'wall' });
    expect([r.lo, r.hi]).toEqual([0.8, 1.2]);
  });
});

describe('setDecorVariant: choosing one design of a family (generic, synthetic library)', () => {
  const fam = ['test-wreath', 'test-wreath-green', 'test-wreath-blue'];
  it('the Decor tab lists a family once', () => {
    const listed = pickerDecor(famLib).map((d) => d.id);
    expect(listed.filter((id) => id.startsWith('test-wreath'))).toEqual(['test-wreath']);
    expect(decorFamily(famLib, 'test-wreath-blue').members.map((m) => m.id)).toEqual(fam);
  });
  it('swaps in place: same bottom-centre, same size tweak, same instance id', () => {
    const b0 = emptyBooth([{ ...wallDecor('test-wreath', 40, 40), placement: { surfaceId: 'wall', x: 30, y: 40, scaleAdj: 1.1 } }]);
    const r = setDecorVariant(b0, famRaw, 'dc1', 'test-wreath-green');
    expect(r.ok).toBe(true);
    const d = r.booth.decor[0];
    expect(d.id).toBe('dc1');
    expect(d.decorId).toBe('test-wreath-green');
    expect(d.placement.scaleAdj).toBe(1.1);
    expect(d.placement.y).toBe(40);
    expect(d.placement.x).toBe(30);
    expect(buildLayout(r.booth, famLib).problems).toEqual({});
    expect(b0.decor[0].decorId).toBe('test-wreath'); // the input is untouched
  });
  it('every design can be chosen from every other, and nothing else about the piece changes', () => {
    let b = emptyBooth([wallDecor(fam[0], 40, 60)]);
    for (const id of [...fam.slice(1), fam[0]]) {
      const before = b.decor[0];
      const r = setDecorVariant(b, famRaw, 'dc1', id);
      expect(r.ok, id).toBe(true);
      expect(r.booth.decor[0].decorId).toBe(id);
      expect(r.booth.decor[0].placement).toEqual(before.placement);
      b = r.booth;
    }
  });
  it('refuses a piece from another family, an unknown id, a piece with no choices, and the same piece (nothing changes)', () => {
    const b = emptyBooth([wallDecor('xmas-garland', 5, 40), wallDecor('test-wreath', 40, 70, 'dc2')]);
    expect(setDecorVariant(b, famRaw, 'dc2', 'xmas-garland').ok).toBe(false);
    expect(setDecorVariant(b, famRaw, 'dc2', 'nope').ok).toBe(false);
    expect(setDecorVariant(b, famRaw, 'dc1', 'test-wreath').ok).toBe(false);
    expect(setDecorVariant(b, famRaw, 'dc9', 'test-wreath').ok).toBe(false);
    expect(setDecorVariant(emptyBooth([wallDecor('lamp-oil', 20, 60)]), famRaw, 'dc1', 'test-wreath').ok).toBe(false);
  });
  it('a variant keeps the other fields on the entry, and a draft round-trips it as a plain decorId', () => {
    const b = emptyBooth([{ ...wallDecor('test-wreath', 40, 60), note: 'keep' }]);
    const c = setDecorVariant(b, famRaw, 'dc1', 'test-wreath-blue').booth;
    expect(c.decor[0].note).toBe('keep');
    const draft = JSON.parse(JSON.stringify(toDraft(c)));
    expect(draft.decor[0].decorId).toBe('test-wreath-blue');
  });
});

describe('save and reload', () => {
  it('the garland size survives a draft round trip (plain decorIds, no new field)', () => {
    let b = xmas();
    const g = find(b, 'xmas-garland');
    b = setDecorScale(b, rawLib, g.id, 0.9).booth;
    const draft = JSON.parse(JSON.stringify(toDraft(b)));
    for (const d of draft.decor) expect(Object.keys(d).sort()).toEqual(d.lit ? ['decorId', 'id', 'lit', 'placement'] : ['decorId', 'id', 'placement']);
    const back = applyDraft({ ...JSON.parse(JSON.stringify(demo)), decor: [], fixtures: [], boxes: [] }, draft);
    expect(back.decor).toEqual(b.decor);
    expect(find(back, 'xmas-garland').placement.scaleAdj).toBe(0.9);
    expect(buildLayout(back, lib).problems).toEqual({});
  });
  it('the live site keeps the garland as saved: cleanDraft needs no change', () => {
    const ids = ['xmas-garland'];
    const decor = ids.map((id, i) => ({ id: `dc${i + 1}`, decorId: id, placement: { surfaceId: 'wall', x: 10 + i, y: 40, scaleAdj: 1.2 } }));
    const r = cleanDraft({ room: {}, placements: {}, decor }, { lib: rawLib, itemIds: [], uploadSrcs: [] });
    expect(r.ok, r.message).toBe(true);
    expect(r.draft.decor.map((d) => d.decorId)).toEqual(ids);
    for (const d of r.draft.decor) expect(d.placement).toMatchObject({ surfaceId: 'wall', scaleAdj: 1.2 });
  });
  it('the site clamps the size to 80-120 %, so the garland range is that slider, not a wider one', () => {
    const r = cleanDraft({ room: {}, placements: {}, decor: [{ id: 'dc1', decorId: 'xmas-garland', placement: { surfaceId: 'wall', x: 10, y: 40, scaleAdj: 1.8 } }] }, { lib: rawLib, itemIds: [], uploadSrcs: [] });
    expect(r.draft.decor[0].placement.scaleAdj).toBe(1.2);
  });
});

describe('the Christmas template: ONE garland, no stockings', () => {
  it('has one garland piece and no stockings; no second garland anywhere', () => {
    const b = xmas();
    expect(b.decor.filter((d) => d.decorId.startsWith('xmas-garland'))).toHaveLength(1);
    expect(b.decor.some((d) => /stocking/i.test(d.decorId))).toBe(false);
    expect(b.decor.filter((d) => /garland/i.test(defs[d.decorId].name))).toHaveLength(1);
  });
  it('the garland sits left of the wreath without overlapping it, and can be resized or removed', () => {
    const b = xmas();
    const g = find(b, 'xmas-garland');
    const w = find(b, 'xmas-wreath');
    expect(g.placement.x + sizeOf(g).w).toBeLessThanOrEqual(w.placement.x + 0.001);
    expect(buildLayout(b, lib).problems).toEqual({});
    const small = setDecorScale(b, rawLib, g.id, 0.8);
    expect(small.ok).toBe(true);
    expect(buildLayout(small.booth, lib).problems).toEqual({});
    expect(removeDecor(b, g.id).booth.decor.some((d) => d.decorId === 'xmas-garland')).toBe(false);
  });
});

describe('library files', () => {
  const dir = new URL('../assets/decor/', import.meta.url);
  it('every Christmas piece has its picture, and no xmas picture is left unused', () => {
    const used = new Set(lib.decor.map((d) => d.src.replace('assets/decor/', '')));
    for (const d of lib.decor) expect(existsSync(new URL(`../${d.src}`, import.meta.url)), d.id).toBe(true);
    const onDisk = readdirSync(dir).filter((f) => f.startsWith('xmas-'));
    for (const f of onDisk) expect(used.has(f), `${f} is an orphan`).toBe(true);
    expect(onDisk).toHaveLength(lib.decor.filter((d) => d.id.startsWith('xmas-')).length);
  });
  it('every choice carries what the picker needs: a label, a choice name and a colour', () => {
    for (const d of famLib.decor.filter((x) => x.family)) {
      expect(d.family.id && d.family.label && d.family.choice).toBeTruthy();
      expect(d.family.swatch).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('wall-hung pieces cast a shadow on the wall behind them, not a floor shadow below', () => {
  const booth = (items = []) => ({ ...emptyBooth([wallDecor('xmas-wreath', 60, 40, 'dc1'), { id: 'dc2', decorId: 'plant-fern', placement: { surfaceId: 'floor', x: 20, y: 110, scaleAdj: 1 } }]), items });
  const html = (b) => roomInnerHtml(b, lib, buildLayout(b, lib));
  it('a wall decor piece has no floor-style contact shadow; a floor decor piece still does', () => {
    const h = html(booth());
    const wall = h.match(/<div class="item decor mount-wall[^>]*>.*?<\/div>/s)[0];
    const stand = h.match(/<div class="item decor mount-stand[^>]*>.*?<\/div>/s)[0];
    expect(wall).not.toContain('class="contact"');
    expect(stand).toContain('class="contact"');
  });
  it('a wall-mounted item (a frame) has none either; a standing item and a rug keep theirs', () => {
    const it = (id, mount, y, extra = {}) => ({ id, title: id, price: 5, status: 'approved', image: `assets/items/${id}.png`, mount, aspect: 1, heightIn: 8, placement: { surfaceId: mount === 'wall' ? 'wall' : 'floor', x: 30, y, scaleAdj: 1 }, ...extra });
    const h = html(booth([it('it-framed-art', 'wall', 40), it('it-amber-lamp', 'stand', 112)]));
    expect(h.match(/<button class="item mount-wall[^>]*>.*?<\/button>/s)[0]).not.toContain('class="contact"');
    expect(h.match(/<button class="item mount-stand[^>]*>.*?<\/button>/s)[0]).toContain('class="contact"');
  });
  it('the style gives them a blurred drop shadow offset down and to the right, and hides any contact ellipse', () => {
    const rule = css.match(/\.item\.mount-wall img \{ filter: drop-shadow\(([^)]*)\)/);
    expect(rule).toBeTruthy();
    const [dx, dy, blur] = rule[1].split(/\s+/).map((v) => parseFloat(v));
    expect(dx).toBeGreaterThan(0);
    expect(dy).toBeGreaterThan(dx * 0.9);
    expect(blur).toBeGreaterThan(0.3);
    expect(dy).toBeLessThan(1); // a small offset (cqw), so it reads as a shadow on the wall just behind it
    expect(css).toMatch(/\.item\.mount-wall \.contact \{ display: none; \}/);
    // standing pieces keep the floor-style ellipse
    expect(css).toMatch(/\.item \.contact \{[^}]*radial-gradient/);
    expect(css).not.toMatch(/\.item\.mount-stand \.contact \{ display: none/);
  });
});
