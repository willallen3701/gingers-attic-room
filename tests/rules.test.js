// Listing rules of 2026-11-17 (batch 2). The site's server enforces the same numbers.
import { describe, it, expect } from 'vitest';
import { validateListing, lengthPlusGirth, LIMITS, SHIP, MESSAGES } from '../src/logic/listing.js';

const base = {
  title: 'Brass thimble',
  description: 'Small brass thimble with a worn top.',
  price: '12',
  quantity: '1',
  category: 'collectibles-other',
  condition: 'good',
  era: '1920s',
  mount: 'stand',
};
const v = (dims, lb, oz = '0', extra = {}) => validateListing({ ...base, heightIn: String(dims[0]), widthIn: String(dims[1]), depthIn: String(dims[2]), weightLb: String(lb), weightOz: String(oz), ...extra });

describe('sizes: height, width and depth are all required, 0.25 to 108 in', () => {
  it('has the agreed limits', () => {
    expect(LIMITS.sizeIn).toEqual([0.25, 108]);
    expect(LIMITS.weightLb).toEqual([0.05, 65]);
    expect(SHIP).toMatchObject({ packingIn: 4, maxLengthGirthIn: 130, maxLbPerIn3: 0.3, lightLbPerIn3: 0.0002, lightMinVolumeIn3: 50 });
  });
  it('each dimension is required', () => {
    for (const i of [0, 1, 2]) {
      const d = [2, 2, 2];
      d[i] = '';
      const r = v(d, 0, 4);
      expect(r.ok).toBe(false);
      expect(r.errors[['heightIn', 'widthIn', 'depthIn'][i]]).toMatch(/from 0.25 to 108/);
    }
  });
  it('0.25 in is the smallest size', () => {
    // (a 0.25 in cube can't weigh the 0.05 lb minimum without being denser than iron, so the others are 4 in)
    expect(v([0.25, 4, 4], 0, 0.8).errors).toEqual({});
    expect(v([4, 0.25, 4], 0, 0.8).errors).toEqual({});
    expect(v([4, 4, 0.25], 0, 0.8).errors).toEqual({});
    for (const i of [0, 1, 2]) {
      const d = [1, 1, 1];
      d[i] = 0.24;
      expect(Object.keys(v(d, 0, 0.8).errors)).toEqual([['heightIn', 'widthIn', 'depthIn'][i]]);
    }
  });
  it('108 in is the largest size (the parcel check then decides)', () => {
    expect(v([108, 1, 1], 2).errors.heightIn).toBeUndefined();
    expect(v([108.01, 1, 1], 2).errors.heightIn).toBeTruthy();
    expect(v([1, 108.01, 1], 2).errors.widthIn).toBeTruthy();
    expect(v([1, 1, 108.01], 2).errors.depthIn).toBeTruthy();
  });
  it('a rug asks for its length and thickness', () => {
    const r = validateListing({ ...base, mount: 'flat', heightIn: '', widthIn: '30', depthIn: '', weightLb: '3' });
    expect(r.errors.heightIn).toMatch(/length/);
    expect(r.errors.depthIn).toMatch(/thickness/);
  });
});

describe('USPS parcel: length + girth with 4 in of packing on each side, at most 130 in', () => {
  it('computes length + girth from the packed sizes, longest side first', () => {
    expect(lengthPlusGirth(50, 15, 15)).toBe(54 + 2 * (19 + 19));
    expect(lengthPlusGirth(15, 50, 15)).toBe(130);
    expect(lengthPlusGirth(15, 15, 50)).toBe(130);
  });
  it('exactly 130 is fine, a hair more is too big', () => {
    expect(v([50, 15, 15], 10).errors.size).toBeUndefined();
    expect(v([15, 50, 15], 10).ok).toBe(true);
    const r = v([50, 15, 15.01], 10);
    expect(r.ok).toBe(false);
    expect(r.errors.size).toBe("Too big to ship by USPS. Large furniture can't be listed yet.");
    expect(MESSAGES.tooBig).toBe(r.errors.size);
  });
  it('an 80 in armoire is too big to ship', () => {
    expect(v([80, 40, 20], 60).errors.size).toBe(MESSAGES.tooBig);
  });
});

describe('weight: 0.05 to 65 lb', () => {
  it('0.05 lb is the least (0 lb 0.8 oz)', () => {
    expect(v([2, 2, 2], 0, 0.8).ok).toBe(true);
    expect(v([2, 2, 2], 0, 0.7).errors.weight).toMatch(/Enter the weight/);
    expect(v([2, 2, 2], '', '').errors.weight).toMatch(/Enter the weight/);
  });
  it('65 lb is the most; over it gets the USPS message', () => {
    expect(v([20, 20, 20], 65).ok).toBe(true);
    const r = v([20, 20, 20], 65, 0.16); // 65.01 lb
    expect(r.ok).toBe(false);
    expect(r.errors.weight).toBe("USPS takes up to 70 lb including packing, so items over 65 lb can't be listed yet.");
  });
});

describe('weight against size', () => {
  it('heavier than 0.30 lb per cubic inch is impossible (an error)', () => {
    // 2 x 2 x 2 in = 8 in3 -> at most 2.4 lb
    expect(v([2, 2, 2], 2, 6.4).ok).toBe(true); // 2.4 lb exactly
    const r = v([2, 2, 2], 2, 6.56); // 2.41 lb
    expect(r.ok).toBe(false);
    expect(r.errors.weight).toBe("That's heavier than solid iron for its size. Check the weight and the measurements.");
  });
  it('lighter than 0.0002 lb per cubic inch needs a tick, but is not an error', () => {
    // 20 x 20 x 20 in = 8000 in3 -> below 1.6 lb is very light
    expect(v([20, 20, 20], 1, 9.6).ok).toBe(true); // 1.6 lb exactly
    const r = v([20, 20, 20], 1, 9.44); // 1.59 lb
    expect(r.ok).toBe(false);
    expect(r.needsConfirm).toBe(true);
    expect(r.errors).toEqual({});
    expect(r.warnings.weight).toBe(MESSAGES.veryLight);
    const ticked = v([20, 20, 20], 1, 9.44, { lightWeightOk: true });
    expect(ticked.ok).toBe(true);
    expect(ticked.listing.lightWeightConfirmed).toBe(true);
    expect(ticked.warnings.weight).toBe(MESSAGES.veryLight);
  });
  it('only asks for volumes over 50 cubic inches', () => {
    // 10 x 5 x 5 = 250 in3 -> threshold 0.05 lb (the minimum weight): no warning; 260 in3 -> 0.052 lb: warning
    expect(v([10, 5, 5], 0, 0.8).needsConfirm).toBe(false);
    expect(v([10, 5, 5.2], 0, 0.8).needsConfirm).toBe(true);
    // 5 x 5 x 2 = 50 in3: never asked, whatever the weight
    expect(v([5, 5, 2], 0, 0.8).warnings).toEqual({});
  });
  it('the size and weight messages wait for valid numbers', () => {
    const r = v([0, 2, 2], 99);
    expect(r.errors.heightIn).toBeTruthy();
    expect(r.errors.size).toBeUndefined();
    expect(r.errors.weight).toBe(MESSAGES.tooHeavy);
  });
});
