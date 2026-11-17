import { describe, it, expect } from 'vitest';
import { validateListing, formFromItem, needsReview, parseNumber, CATEGORIES, ERAS, CONDITIONS } from '../src/logic/listing.js';
import { preprocess, outputToMask, brush, brushLine, alphaBounds, clearHaze, opaqueShare } from '../src/logic/mask.js';

const good = {
  title: 'Brass candlestick',
  description: 'Solid brass, lightly polished. Small dent on the base.',
  price: '$1,250.5',
  quantity: '1',
  category: 'lighting',
  condition: 'very-good',
  era: '1920s',
  eraNote: 'c. 1925',
  mount: 'stand',
  heightIn: '9.5',
  widthIn: '4',
  depthIn: '',
  weightLb: '1',
  weightOz: '8',
  localPickupOnly: false,
  shippingPrice: '12',
};

describe('listing rules', () => {
  it('has the agreed lists', () => {
    expect(CATEGORIES).toHaveLength(12);
    expect(CONDITIONS.map((c) => c.id)).toEqual(['excellent', 'very-good', 'good', 'fair', 'for-parts']);
    expect(ERAS[0].id).toBe('pre-1900');
    expect(ERAS.at(-1).id).toBe('unknown');
    expect(ERAS.map((e) => e.id)).toContain('1950s');
  });

  it('parses money and numbers', () => {
    expect(parseNumber('$1,200.50')).toBe(1200.5);
    expect(parseNumber('abc')).toBeNaN();
    expect(parseNumber('')).toBeNaN();
  });

  it('accepts a complete listing and normalises it', () => {
    const v = validateListing(good);
    expect(v.ok).toBe(true);
    expect(v.listing).toMatchObject({ price: 1250.5, quantity: 1, weightLb: 1.5, depthIn: null, shippingPrice: 12, localPickupOnly: false });
  });

  it('reports each missing field', () => {
    const v = validateListing({ ...good, title: 'x', description: '', price: '0', category: '', condition: '', era: '', heightIn: '', weightLb: '', weightOz: '' });
    expect(v.ok).toBe(false);
    expect(Object.keys(v.errors).sort()).toEqual(['category', 'condition', 'description', 'era', 'heightIn', 'price', 'title', 'weight'].sort());
  });

  it('needs a shipping price unless local pickup only', () => {
    expect(validateListing({ ...good, shippingPrice: '' }).errors.shippingPrice).toBeTruthy();
    const pickup = validateListing({ ...good, shippingPrice: '', localPickupOnly: true });
    expect(pickup.ok).toBe(true);
    expect(pickup.listing.shippingPrice).toBeNull();
    expect(validateListing({ ...good, shippingPrice: '0' }).listing.shippingPrice).toBe(0);
  });

  it('rejects 16 oz or more and fractional quantities', () => {
    expect(validateListing({ ...good, weightOz: '16' }).errors.weight).toBeTruthy();
    expect(validateListing({ ...good, quantity: '1.5' }).errors.quantity).toBeTruthy();
  });

  it('round-trips an item into the form (pending edit wins)', () => {
    const item = { title: 'Old', description: 'Old description here', price: 10, quantity: 2, category: 'lighting', condition: 'good', era: '1950s', mount: 'stand', dims: { h: 9, w: 4, d: null }, weightLb: 2.25, shippingPrice: 5, pendingEdit: { title: 'New name' } };
    const f = formFromItem(item);
    expect(f).toMatchObject({ title: 'New name', price: '10', heightIn: '9', depthIn: '', weightLb: '2', weightOz: '4', shippingPrice: '5' });
    expect(validateListing(f).ok).toBe(true);
  });

  it('only price and quantity skip review', () => {
    const a = validateListing(good).listing;
    expect(needsReview(a, { ...a, price: 99, quantity: 3 })).toEqual([]);
    expect(needsReview(a, { ...a, price: 99, title: 'Another' })).toEqual(['title']);
  });
});

describe('cutout maths', () => {
  it('preprocesses like rembg (divide by the image max, then mean/std)', () => {
    const rgba = new Uint8ClampedArray([200, 100, 0, 255, 0, 0, 0, 255]);
    const t = preprocess(rgba, 2, 1, { mean: [0.5, 0.5, 0.5], std: [1, 1, 1] });
    expect(Array.from(t).map((v) => +v.toFixed(3))).toEqual([0.5, -0.5, 0, -0.5, -0.5, -0.5]);
  });

  it('min-max normalises the model output', () => {
    expect(Array.from(outputToMask(new Float32Array([2, 4, 6]), 3))).toEqual([0, 128, 255]);
    expect(Array.from(outputToMask(new Float32Array([1, 1]), 2))).toEqual([0, 0]);
  });

  it('erases and restores with the brush', () => {
    const a = new Uint8ClampedArray(20 * 20).fill(255);
    expect(brush(a, 20, 20, 10, 10, 4, 0)).toBe(true);
    expect(a[10 * 20 + 10]).toBe(0);
    expect(a[0]).toBe(255);
    brushLine(a, 20, 20, 2, 2, 17, 2, 2, 0);
    expect(a[2 * 20 + 9]).toBeLessThan(8); // soft edge: a 2 px brush leaves at most a trace
    expect(a[17 * 20 + 9]).toBe(255);
    brush(a, 20, 20, 10, 10, 6, 255);
    expect(a[10 * 20 + 10]).toBe(255);
  });

  it('finds the visible bounds and the opaque share', () => {
    const a = new Uint8ClampedArray(10 * 10);
    expect(alphaBounds(a, 10, 10)).toBeNull();
    a[3 * 10 + 2] = 255;
    a[6 * 10 + 7] = 200;
    expect(alphaBounds(a, 10, 10)).toEqual({ x0: 2, y0: 3, x1: 8, y1: 7, w: 6, h: 4 });
    expect(opaqueShare(a)).toBeCloseTo(0.02);
    expect(Array.from(clearHaze(new Uint8ClampedArray([3, 9, 10, 200])))).toEqual([0, 0, 10, 200]);
  });
});
