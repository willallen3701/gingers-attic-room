// A too-tall item dropped on a low shelf is refused with a reason that names the shelf (not "overlap").
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { placeItem, reasonFor } from '../src/logic/editops.js';

const lib = JSON.parse(fs.readFileSync(new URL('../data/library.json', import.meta.url), 'utf8'));
const mk = (id, h, aspect = 1, placement = null) => ({ id, heightIn: h, aspect, mount: 'stand', status: 'approved', image: 'x', placement });
// a shelf stack whose boards leave 7.2 in; a wide item lying across the back of the floor so the floor fallback is refused too
const booth = (item) => ({
  room: {},
  fixtures: [{ id: 'fx1', fixtureId: 'shelf-stack-3-cream', x: 90, y: 4 }],
  decor: [],
  items: [item, mk('wide', 6, 19, { surfaceId: 'floor', x: 2, y: 91, scaleAdj: 1 })],
});

describe('shelf too low', () => {
  it('an item that fits the board is placed on it', () => {
    const r = placeItem(booth(mk('a', 6)), lib, 'a', { x: 105, y: 13 });
    expect(r.ok).toBe(true);
    expect(r.booth.items.find((i) => i.id === 'a').placement.surfaceId).toBe('fx1:s1');
  });
  it('an 8 in item that does not fit is refused with SHELF_TOO_LOW', () => {
    const r = placeItem(booth(mk('b', 8)), lib, 'b', { x: 105, y: 13 });
    expect(r.ok).toBe(false);
    expect(r.errors[0].code).toBe('SHELF_TOO_LOW');
    expect(reasonFor(r.errors)).toMatch(/too tall/);
  });
  it('a refusal far from any shelf keeps its own reason', () => {
    const r = placeItem(booth(mk('c', 8)), lib, 'c', { x: 30, y: 100 });
    expect(r.errors?.[0]?.code).not.toBe('SHELF_TOO_LOW');
  });
});
