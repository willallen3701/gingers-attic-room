// Real-size display: an item's drawn size comes from its real dimensions against the 120 in booth, with a
// seller tweak of +/-20 %. Two guards keep every item usable:
//   - tiny things (a 2 in thimble) are drawn no smaller than MIN_DRAW_IN, so they can be seen and clicked;
//   - huge things are capped by MAX_DRAW_IN for their mount, so they always fit inside the room, on the wall
//     or the floor, and stay selectable.
// The tweak range of one item is narrowed by those guards too (tweakRange), so the size slider only offers
// sizes that can actually be drawn.

export const TWEAK_MIN = 0.8;
export const TWEAK_MAX = 1.2;

/** Smallest drawn size: the longer side of anything is at least this many inches on screen. */
export const MIN_DRAW_IN = 4;

/**
 * Largest drawn size per mount, in inches (room: 120 wide; wall 0..90 tall; floor band 91..119.5 deep).
 *   stand: a floor item's base can be 119.5 in down, so 100 in tall still starts below the ceiling.
 *   wall:  the wall is 90 in tall (the tallest library curtains are 87.6 in).
 *   flat:  rugs are foreshortened into the 28.5 in deep floor band.
 */
export const MAX_DRAW_IN = Object.freeze({
  stand: Object.freeze({ w: 116, h: 100 }),
  wall: Object.freeze({ w: 116, h: 88 }),
  flat: Object.freeze({ w: 116, h: 27 }),
});

/** Clamp a seller's size tweak to [0.8, 1.2]. Missing/invalid -> 1. */
export function clampTweak(tweak) {
  if (typeof tweak !== 'number' || !Number.isFinite(tweak)) return 1;
  return Math.min(TWEAK_MAX, Math.max(TWEAK_MIN, tweak));
}

const capFor = (item) => (item.flat || item.mount === 'flat' ? MAX_DRAW_IN.flat : item.mount === 'wall' ? MAX_DRAW_IN.wall : MAX_DRAW_IN.stand);

/**
 * Real size in inches, before any guard or tweak.
 * - Standing / wall items: height = heightIn, width from the cutout's aspect (w/h).
 * - Flat items (rugs lying on the floor): width = widthIn, height from aspect, because the
 *   visible height of a flat rug is foreshortened and not its real height.
 * @param {{heightIn?:number, widthIn?:number, aspect:number, flat?:boolean}} item
 */
export function realSizeIn(item) {
  const aspect = item.aspect;
  if (!(aspect > 0)) throw new RangeError(`item.aspect must be > 0, got ${aspect}`);
  if (item.flat) {
    if (!(item.widthIn > 0)) throw new RangeError('flat item needs widthIn > 0');
    return { w: item.widthIn, h: item.widthIn / aspect };
  }
  if (!(item.heightIn > 0)) throw new RangeError('item needs heightIn > 0');
  return { w: item.heightIn * aspect, h: item.heightIn };
}

/**
 * How the guards scale an item's real size, and the tweak range left for the slider.
 * @returns {{base:number, lo:number, hi:number}}  drawn = real * base * tweak, with tweak in [lo, hi]
 */
export function sizeLimits(item) {
  const real = realSizeIn(item);
  const cap = capFor(item);
  const longest = Math.max(real.w, real.h);
  const fitCap = Math.min(cap.w / real.w, cap.h / real.h); // largest factor that still fits
  const fitMin = MIN_DRAW_IN / longest; // smallest factor that is still readable
  // Tiny: grow to the minimum. Huge: shrink to the cap. (An item can't be both unless it is absurdly thin.)
  const base = fitMin > 1 ? Math.min(fitMin, fitCap) : Math.min(1, fitCap);
  const lo = Math.min(1, Math.max(TWEAK_MIN, fitMin / base));
  const hi = Math.max(lo, Math.min(TWEAK_MAX, fitCap / base));
  return { base, lo, hi };
}

/** The tweak range one item allows: [lo, hi] within [0.8, 1.2]. */
export function tweakRange(item) {
  const { lo, hi } = sizeLimits(item);
  return { lo, hi };
}

/** Clamp a tweak for one item (its own range, not just 0.8..1.2). */
export function clampItemTweak(item, tweak) {
  const { lo, hi } = sizeLimits(item);
  return Math.min(hi, Math.max(lo, clampTweak(tweak)));
}

/**
 * Drawn size of an item in inches: real size, brought into [MIN_DRAW_IN, MAX_DRAW_IN], times the seller's
 * tweak (clamped to what this item allows).
 * @param {{heightIn?:number, widthIn?:number, aspect:number, flat?:boolean, mount?:string}} item
 * @param {number} [tweak]
 * @returns {{w:number, h:number}}
 */
export function itemSizeIn(item, tweak = 1) {
  const real = realSizeIn(item);
  const { base, lo, hi } = sizeLimits(item);
  const k = base * Math.min(hi, Math.max(lo, clampTweak(tweak)));
  return { w: real.w * k, h: real.h * k };
}
