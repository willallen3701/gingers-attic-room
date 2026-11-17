// Pure pixel maths for the item cutout: model input/output and the touch-up brush.
// The browser does the canvas work (resizing, drawing); these functions only touch typed arrays.

/**
 * RGBA pixels (already resized to the model's input size) -> Float32 CHW tensor data.
 * Matches rembg's `normalize()`: divide by the image's own maximum value (not 255), then (x - mean) / std.
 * @param {Uint8ClampedArray|Uint8Array} rgba
 * @param {{mean:number[], std:number[], divideByMax?:boolean}} spec
 */
export function preprocess(rgba, w, h, spec) {
  const n = w * h;
  let max = 255;
  if (spec.divideByMax !== false) {
    max = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (rgba[o] > max) max = rgba[o];
      if (rgba[o + 1] > max) max = rgba[o + 1];
      if (rgba[o + 2] > max) max = rgba[o + 2];
    }
    max = Math.max(max, 1e-6);
  }
  const out = new Float32Array(3 * n);
  const [m0, m1, m2] = spec.mean;
  const [s0, s1, s2] = spec.std;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    out[i] = (rgba[o] / max - m0) / s0;
    out[n + i] = (rgba[o + 1] / max - m1) / s1;
    out[2 * n + i] = (rgba[o + 2] / max - m2) / s2;
  }
  return out;
}

/** Model output (first n values = the mask plane) -> 0..255 mask, min-max normalised like rembg. */
export function outputToMask(data, n, { sigmoid = false } = {}) {
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = sigmoid ? 1 / (1 + Math.exp(-data[i])) : data[i];
  let mi = Infinity;
  let ma = -Infinity;
  for (let i = 0; i < n; i++) {
    if (v[i] < mi) mi = v[i];
    if (v[i] > ma) ma = v[i];
  }
  const out = new Uint8ClampedArray(n);
  const span = ma - mi;
  if (!(span > 1e-9)) return out; // flat output: nothing found
  for (let i = 0; i < n; i++) out[i] = Math.round(((v[i] - mi) / span) * 255);
  return out;
}

/** Drop faint haze: alpha below `floor` becomes 0. Returns the same array. */
export function clearHaze(alpha, floor = 10) {
  for (let i = 0; i < alpha.length; i++) if (alpha[i] < floor) alpha[i] = 0;
  return alpha;
}

/**
 * Paint a round brush into an alpha plane. value 0 = erase, 255 = restore.
 * The outer `feather` px blend softly. Returns true if anything changed.
 */
export function brush(alpha, w, h, cx, cy, r, value, feather = 1.5) {
  const x0 = Math.max(0, Math.floor(cx - r - 1));
  const x1 = Math.min(w - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1));
  const y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
  let changed = false;
  const inner = Math.max(0, r - feather);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r) continue;
      const k = d <= inner ? 1 : 1 - (d - inner) / Math.max(feather, 1e-6);
      const i = y * w + x;
      const next = Math.round(alpha[i] + (value - alpha[i]) * k);
      if (next !== alpha[i]) {
        alpha[i] = next;
        changed = true;
      }
    }
  }
  return changed;
}

/** Paint a stroke from (ax, ay) to (bx, by) with dabs every r/3 px. */
export function brushLine(alpha, w, h, ax, ay, bx, by, r, value) {
  const len = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(len / Math.max(1, r / 3)));
  let changed = false;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    if (brush(alpha, w, h, ax + (bx - ax) * t, ay + (by - ay) * t, r, value)) changed = true;
  }
  return changed;
}

/** Bounding box of pixels with alpha >= threshold, or null if none. x1/y1 are exclusive. */
export function alphaBounds(alpha, w, h, threshold = 16) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (alpha[row + x] >= threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x0, y0, x1: x1 + 1, y1: y1 + 1, w: x1 + 1 - x0, h: y1 + 1 - y0 };
}

/** Share of pixels that are mostly opaque (for "nothing was found" / "everything kept" warnings). */
export function opaqueShare(alpha, threshold = 128) {
  let k = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i] >= threshold) k++;
  return alpha.length ? k / alpha.length : 0;
}
