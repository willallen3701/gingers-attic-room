// Downscaling a seller's wallpaper/floor upload before it is sent to the Wix page:
// at most 1600 px on the long side, encoded as JPEG of at most 600 KB.
// Pure maths only; the editor does the canvas work and walks the plan until a result fits.

export const MAX_LONG_PX = 1600;
export const MAX_BYTES = 600 * 1024;
export const QUALITY_STEPS = Object.freeze([0.86, 0.78, 0.7, 0.62, 0.54]);
export const SHRINK = 0.8;
export const MIN_LONG_PX = 400;

/** Scale (w, h) down so the long side is at most maxLong. Never scales up. */
export function fitWithin(w, h, maxLong = MAX_LONG_PX) {
  if (!(w > 0) || !(h > 0)) throw new RangeError(`bad image size ${w}x${h}`);
  const scale = Math.min(1, maxLong / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)), scale };
}

/**
 * Encode attempts, in order: every quality step at the fitted size, then shrink by 0.8 and try again,
 * down to a long side of MIN_LONG_PX (the last size is always included).
 * @returns {Array<{w:number, h:number, quality:number}>}
 */
export function encodePlan(w, h, { maxLong = MAX_LONG_PX, minLong = MIN_LONG_PX } = {}) {
  const plan = [];
  let { w: cw, h: ch } = fitWithin(w, h, maxLong);
  for (;;) {
    for (const quality of QUALITY_STEPS) plan.push({ w: cw, h: ch, quality });
    const long = Math.max(cw, ch);
    if (long <= minLong) break;
    const next = fitWithin(cw, ch, Math.max(minLong, Math.floor(long * SHRINK)));
    cw = next.w;
    ch = next.h;
  }
  return plan;
}

/** Decoded byte size of a base64 data URL. */
export function dataUrlBytes(dataUrl) {
  const i = dataUrl.indexOf(',');
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1).replace(/\s/g, '');
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/** Real-world tile size (inches) for an uploaded texture: 24 in wide at scale 1, height from its aspect. */
export function uploadTileIn(w, h, widthIn = 24) {
  return { w: widthIn, h: Math.round(((widthIn * h) / w) * 100) / 100 };
}
