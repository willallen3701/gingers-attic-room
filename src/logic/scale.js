// Real-size display: an item's drawn size comes from its real dimensions, with a seller tweak of +/-20 %.

export const TWEAK_MIN = 0.8;
export const TWEAK_MAX = 1.2;

/** Clamp a seller's size tweak to [0.8, 1.2]. Missing/invalid -> 1. */
export function clampTweak(tweak) {
  if (typeof tweak !== 'number' || !Number.isFinite(tweak)) return 1;
  return Math.min(TWEAK_MAX, Math.max(TWEAK_MIN, tweak));
}

/**
 * Drawn size of an item in inches.
 * - Standing / wall items: height = heightIn * tweak, width from the cutout's aspect (w/h).
 * - Flat items (rugs lying on the floor): width = widthIn * tweak, height from aspect, because the
 *   visible height of a flat rug is foreshortened and not its real height.
 * @param {{heightIn?:number, widthIn?:number, aspect:number, flat?:boolean}} item
 * @param {number} [tweak]
 * @returns {{w:number, h:number}}
 */
export function itemSizeIn(item, tweak = 1) {
  const t = clampTweak(tweak);
  const aspect = item.aspect;
  if (!(aspect > 0)) throw new RangeError(`item.aspect must be > 0, got ${aspect}`);
  if (item.flat) {
    if (!(item.widthIn > 0)) throw new RangeError('flat item needs widthIn > 0');
    const w = item.widthIn * t;
    return { w, h: w / aspect };
  }
  if (!(item.heightIn > 0)) throw new RangeError('item needs heightIn > 0');
  const h = item.heightIn * t;
  return { w: h * aspect, h };
}
