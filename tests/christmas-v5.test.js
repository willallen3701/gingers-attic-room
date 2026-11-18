// Christmas v5: ONE real-photo garland (sized with the slider), stockings in six swatch designs that hang under
// it, a warmer nutcracker, and the wall-hung shadow. Choices are library entries of one `family`, stored as plain decorIds,
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
  it('the Decor tab lists it once, and the old separate "stockings garland" is gone', () => {
    const listed = pickerDecor(lib).map((d) => d.id);
    expect(listed.filter((id) => id.startsWith('xmas-garland'))).toEqual(['xmas-garland']);
    expect(listed.filter((id) => id.startsWith('xmas-stockings'))).toEqual(['xmas-stockings']);
    expect(lib.decor.some((d) => /garland/i.test(d.name) && d.family?.id === 'xmas-stockings')).toBe(false);
    for (const m of decorFamily(lib, 'xmas-stockings').members) expect(m.name.toLowerCase()).not.toContain('garland');
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

describe('setDecorVariant: choosing a length or a stocking design', () => {
  it('swaps in place: same bottom-centre, same size tweak, same instance id', () => {
    const b0 = emptyBooth([{ ...wallDecor('xmas-stockings', 40, 40), placement: { surfaceId: 'wall', x: 30, y: 40, scaleAdj: 1.1 } }]);
    const r = setDecorVariant(b0, rawLib, 'dc1', 'xmas-stockings-burgundy');
    expect(r.ok).toBe(true);
    const d = r.booth.decor[0];
    expect(d.id).toBe('dc1');
    expect(d.decorId).toBe('xmas-stockings-burgundy');
    expect(d.placement.scaleAdj).toBe(1.1);
    expect(d.placement.y).toBe(40);
    expect(d.placement.x).toBe(30);
    expect(buildLayout(r.booth, lib).problems).toEqual({});
    expect(b0.decor[0].decorId).toBe('xmas-stockings'); // the input is untouched
  });
  it('every stocking design can be chosen from every other, and nothing else about the piece changes', () => {
    const ids = decorFamily(lib, 'xmas-stockings').members.map((m) => m.id);
    expect(ids).toHaveLength(6);
    let b = emptyBooth([wallDecor(ids[0], 40, 60)]);
    for (const id of [...ids.slice(1), ids[0]]) {
      const before = b.decor[0];
      const r = setDecorVariant(b, rawLib, 'dc1', id);
      expect(r.ok, id).toBe(true);
      expect(r.booth.decor[0].decorId).toBe(id);
      expect(r.booth.decor[0].placement).toEqual(before.placement); // the designs are all the same size
      b = r.booth;
    }
  });
  it('refuses a piece from another family, an unknown id, a piece with no choices, and a choice that would leave the room (nothing changes)', () => {
    const b = emptyBooth([wallDecor('xmas-garland', 5, 40), wallDecor('xmas-stockings', 40, 70, 'dc2')]);
    expect(setDecorVariant(b, rawLib, 'dc2', 'xmas-garland').ok).toBe(false);
    expect(setDecorVariant(b, rawLib, 'dc2', 'nope').ok).toBe(false);
    expect(setDecorVariant(b, rawLib, 'dc1', 'xmas-stockings').ok).toBe(false);
    expect(setDecorVariant(b, rawLib, 'dc9', 'xmas-stockings').ok).toBe(false);
    expect(setDecorVariant(emptyBooth([wallDecor('lamp-oil', 20, 60)]), rawLib, 'dc1', 'xmas-stockings').ok).toBe(false);
    const wide = emptyBooth([wallDecor('xmas-stockings', 0, 70)]);
    expect(setDecorVariant(wide, rawLib, 'dc1', 'xmas-stockings-plaid').ok).toBe(true);
  });
  it('a variant keeps the other fields on the entry', () => {
    const b = emptyBooth([{ ...wallDecor('xmas-stockings', 40, 60), note: 'keep' }]);
    expect(setDecorVariant(b, rawLib, 'dc1', 'xmas-stockings-plaid').booth.decor[0].note).toBe('keep');
  });
});

describe('save and reload', () => {
  it('the chosen stocking design and the garland size survive a draft round trip (plain decorIds, no new field)', () => {
    let b = xmas();
    const g = find(b, 'xmas-garland');
    const s = find(b, 'xmas-stockings');
    b = setDecorVariant(b, rawLib, s.id, 'xmas-stockings-green').booth;
    b = setDecorScale(b, rawLib, g.id, 0.9).booth;
    const draft = JSON.parse(JSON.stringify(toDraft(b)));
    for (const d of draft.decor) expect(Object.keys(d).sort()).toEqual(d.lit ? ['decorId', 'id', 'lit', 'placement'] : ['decorId', 'id', 'placement']);
    const back = applyDraft({ ...JSON.parse(JSON.stringify(demo)), decor: [], fixtures: [], boxes: [] }, draft);
    expect(back.decor).toEqual(b.decor);
    expect(find(back, 'xmas-stockings-green')).toBeTruthy();
    expect(find(back, 'xmas-garland').placement.scaleAdj).toBe(0.9);
    expect(buildLayout(back, lib).problems).toEqual({});
  });
  it('the live site keeps the garland and every stocking design as saved: cleanDraft needs no change', () => {
    const ids = [{ id: 'xmas-garland' }, ...decorFamily(lib, 'xmas-stockings').members].map((m) => m.id);
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

describe('the Christmas template: ONE garland with the stockings hanging just under it', () => {
  it('has one garland piece and one stockings piece; no second garland anywhere', () => {
    const b = xmas();
    expect(b.decor.filter((d) => d.decorId.startsWith('xmas-garland'))).toHaveLength(1);
    expect(b.decor.filter((d) => d.decorId.startsWith('xmas-stockings'))).toHaveLength(1);
    expect(b.decor.filter((d) => defs[d.decorId].family?.id === 'xmas-garland' || /garland/i.test(defs[d.decorId].name))).toHaveLength(1);
  });
  it('the stockings start where the garland ends (within 0.1 in) and sit inside its width, without overlapping it', () => {
    const b = xmas();
    const g = find(b, 'xmas-garland');
    const s = find(b, 'xmas-stockings');
    const gs = sizeOf(g);
    const ss = sizeOf(s);
    const gBottom = g.placement.y;
    const sTop = s.placement.y - ss.h;
    expect(sTop).toBeGreaterThanOrEqual(gBottom - 0.001);
    expect(sTop - gBottom).toBeLessThan(0.1);
    expect(s.placement.x).toBeGreaterThanOrEqual(g.placement.x);
    expect(s.placement.x + ss.w).toBeLessThanOrEqual(g.placement.x + gs.w);
    expect(buildLayout(b, lib).problems).toEqual({});
  });
  it('the stockings can be re-dressed and the garland resized in the finished layout, and removed again', () => {
    let b = xmas();
    const s = find(b, 'xmas-stockings');
    b = setDecorVariant(b, rawLib, s.id, 'xmas-stockings-burgundy').booth;
    expect(find(b, 'xmas-stockings-burgundy')).toBeTruthy();
    const g = find(b, 'xmas-garland');
    const small = setDecorScale(b, rawLib, g.id, 0.8);
    expect(small.ok).toBe(true);
    expect(buildLayout(small.booth, lib).problems).toEqual({});
    expect(removeDecor(b, s.id).booth.decor.some((d) => d.decorId.startsWith('xmas-stockings'))).toBe(false);
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
  it('every choice carries what the picker needs: a label, and the stocking swatches carry a colour', () => {
    for (const d of lib.decor.filter((x) => x.family)) {
      expect(d.family.id && d.family.label && d.family.choice).toBeTruthy();
      expect(d.mount).toBe(defs[decorFamily(lib, d.id).members[0].id].mount); // a family never changes where it can hang
    }
    for (const m of decorFamily(lib, 'xmas-stockings').members) expect(m.family.swatch).toMatch(/^#[0-9a-f]{6}$/i);
    expect(new Set(decorFamily(lib, 'xmas-stockings').members.map((m) => m.family.choice)).size).toBe(6);
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
