import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  fold, terms, matchBooth, inCategory, sortBooths, filterBooths, shuffle, seededRandom, availability, AVAILABILITY_LABEL, SORTS,
} from '../src/logic/directory.js';

const sample = JSON.parse(readFileSync(new URL('../data/sample-directory.json', import.meta.url), 'utf8'));

const booth = (id, over = {}) => ({
  id, slug: id, boothNumber: 1, name: id, about: '', sellerName: '', itemCount: 0, categories: [], itemTitles: [], previews: [],
  updatedAt: '2026-11-01T00:00:00Z', ...over,
});
const B = [
  booth('a', { boothNumber: 10, name: 'Lamplight Lane', sellerName: 'Ruth', about: 'Slag glass lamps', categories: ['lighting'], itemTitles: ['Brass Student Lamp'], updatedAt: '2026-11-15T09:00:00Z' }),
  booth('b', { boothNumber: 2, name: 'The Teacup Shelf', sellerName: 'June', about: 'Bone china', categories: ['glass-ceramics'], itemTitles: ['Gold Rim Teacup', 'Crème Brûlée Dish'], updatedAt: '2026-11-17T08:00:00Z' }),
  booth('c', { boothNumber: 3, name: 'Rust & Rosewood', sellerName: 'Hank', about: 'Farmhouse iron', categories: ['tools-hardware', 'lighting'], itemTitles: ['Railroad Lantern'], updatedAt: null }),
  booth('d', { boothNumber: '1', name: 'Paper Trail', sellerName: 'Agnes Teague', about: 'Old books', categories: ['books-paper'], itemTitles: [], updatedAt: '2026-11-17T08:00:00Z' }),
];
const ids = (rows) => rows.map((r) => (r.booth ?? r).id);

describe('search', () => {
  it('folds case, accents and punctuation', () => {
    expect(fold('  Crème  BRÛLÉE! ')).toBe('creme brulee');
    expect(fold('Rust & Rosewood')).toBe('rust rosewood');
    expect(terms('  Brass   lamp ')).toEqual(['brass', 'lamp']);
    expect(terms('')).toEqual([]);
  });
  it('matches the booth name, the seller, the about text and item titles', () => {
    expect(ids(filterBooths(B, { query: 'lamplight' }))).toEqual(['a']); // name
    expect(ids(filterBooths(B, { query: 'june' }))).toEqual(['b']); // seller
    expect(ids(filterBooths(B, { query: 'farmhouse' }))).toEqual(['c']); // about
    expect(ids(filterBooths(B, { query: 'lantern' }))).toEqual(['c']); // item title
  });
  it('needs every word, but each word may match a different field', () => {
    expect(ids(filterBooths(B, { query: 'ruth student' }))).toEqual(['a']);
    expect(ids(filterBooths(B, { query: 'ruth teacup' }))).toEqual([]);
  });
  it('ignores accents and case in the booth data too', () => {
    expect(ids(filterBooths(B, { query: 'CREME brulee' }))).toEqual(['b']);
  });
  it('matches parts of words ("tea" finds Teacup and Teague)', () => {
    expect(ids(filterBooths(B, { query: 'tea', sort: 'number' }))).toEqual(['d', 'b']);
  });
  it('reports which item titles matched, for the card', () => {
    expect(matchBooth(B[1], 'gold').titles).toEqual(['Gold Rim Teacup']);
    expect(matchBooth(B[1], 'shelf').titles).toEqual([]); // matched the name, not an item
    expect(matchBooth(B[1], '').ok).toBe(true);
  });
  it('copes with booths missing optional fields', () => {
    expect(matchBooth({ id: 'x', name: 'Odd Lot' }, 'odd').ok).toBe(true);
    expect(matchBooth({ id: 'x' }, 'odd').ok).toBe(false);
  });
});

describe('category filter', () => {
  it('keeps booths that have approved items in the category', () => {
    expect(ids(filterBooths(B, { category: 'lighting', sort: 'number' }))).toEqual(['c', 'a']);
    expect(inCategory(B[0], '')).toBe(true);
    expect(inCategory({ id: 'x' }, 'lighting')).toBe(false);
  });
  it('combines with search', () => {
    expect(ids(filterBooths(B, { category: 'lighting', query: 'lantern' }))).toEqual(['c']);
    expect(ids(filterBooths(B, { category: 'books-paper', query: 'lantern' }))).toEqual([]);
  });
});

describe('sorting', () => {
  it('recently updated: newest first, ties by booth number, undated last', () => {
    expect(ids(sortBooths(B, 'updated'))).toEqual(['d', 'b', 'a', 'c']);
  });
  it('booth number compares numbers as numbers, even when sent as text', () => {
    expect(ids(sortBooths(B, 'number'))).toEqual(['d', 'b', 'c', 'a']);
  });
  it('shuffle is a permutation and repeats for the same seed', () => {
    const many = Array.from({ length: 20 }, (_, i) => booth(`s${i}`, { boothNumber: i }));
    const a = sortBooths(many, 'shuffle', 42);
    expect(ids(a).sort()).toEqual(ids(many).sort());
    expect(ids(sortBooths(many, 'shuffle', 42))).toEqual(ids(a));
    expect(ids(sortBooths(many, 'shuffle', 7))).not.toEqual(ids(a));
    expect(ids(a)).not.toEqual(ids(many));
  });
  it('never changes the input list', () => {
    const copy = JSON.parse(JSON.stringify(B));
    sortBooths(B, 'number');
    shuffle(B, 3);
    filterBooths(B, { query: 'tea', sort: 'shuffle', seed: 9 });
    expect(B).toEqual(copy);
  });
  it('the random generator stays in [0, 1)', () => {
    const r = seededRandom(1);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v >= 0 && v < 1).toBe(true);
    }
  });
  it('offers the three sorts in order', () => {
    expect(SORTS.map((s) => s.id)).toEqual(['updated', 'number', 'shuffle']);
  });
  it('handles an empty or missing list', () => {
    expect(filterBooths([], { query: 'x' })).toEqual([]);
    expect(filterBooths(undefined)).toEqual([]);
  });
});

describe('saved items: can they be bought?', () => {
  it('sold, sold out (quantity 0) and taken down items have no cart button', () => {
    expect(availability({ status: 'approved', quantity: 1 })).toBe('available');
    expect(availability({ status: 'approved' })).toBe('available');
    expect(availability({ status: 'sold', quantity: 0 })).toBe('sold');
    expect(availability({ status: 'approved', quantity: 0 })).toBe('soldout');
    expect(availability({ status: 'rejected', quantity: 1 })).toBe('unavailable');
    expect(availability(null)).toBe('unavailable');
    expect(AVAILABILITY_LABEL.sold).toBe('Sold');
    expect(AVAILABILITY_LABEL.soldout).toBe('Sold out');
  });
});

describe('sample data for the standalone page', () => {
  it('has booths with every field the page sends', () => {
    expect(sample.booths.length).toBeGreaterThanOrEqual(6);
    for (const b of sample.booths) {
      for (const k of ['id', 'slug', 'boothNumber', 'name', 'about', 'signStyle', 'sellerName', 'itemCount', 'categories', 'itemTitles', 'previews', 'updatedAt']) {
        expect(b, `${b.id}.${k}`).toHaveProperty(k);
      }
      expect(b.previews.length).toBeLessThanOrEqual(4);
      expect(['wood', 'cream', 'brass']).toContain(b.signStyle);
      for (const c of b.categories) expect(sample.categories.map((x) => x.id)).toContain(c);
    }
  });
  it('has saved items that cover available, sold and sold out', () => {
    const states = sample.collection.items.map(availability);
    expect(states).toContain('available');
    expect(states).toContain('sold');
    expect(states).toContain('soldout');
  });
});
