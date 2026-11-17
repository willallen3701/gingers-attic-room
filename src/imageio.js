// Browser image helpers for the "Add an item" sheet: read a photo, shrink it for sending,
// and encode the finished cutout as a trimmed transparent image.
import { fitWithin, encodePlan, dataUrlBytes, MAX_BYTES } from './logic/downscale.js';
import { alphaBounds } from './logic/mask.js';

export const WORK_LONG_PX = 1200; // size the cutout is computed and touched up at
export const CUTOUT_LONG_PX = 1000; // size the finished cutout is sent at (at most)

/** Decode a File (EXIF rotation applied where the browser supports it). */
export async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall back to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const dims = (src) => ({ w: src.naturalWidth || src.width, h: src.naturalHeight || src.height });

/** The photo at working size, as pixels: { w, h, rgba }. */
export function workingPixels(src, maxLong = WORK_LONG_PX) {
  const { w: sw, h: sh } = dims(src);
  const { w, h } = fitWithin(sw, sh, maxLong);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, w, h);
  return { w, h, rgba: ctx.getImageData(0, 0, w, h).data };
}

/** A photo for the item card / store: JPEG, at most 1600 px and 600 KB. Returns { dataUrl, w, h } or null. */
export async function photoJpeg(file) {
  const bmp = await loadBitmap(file);
  const { w: sw, h: sh } = dims(bmp);
  const plan = encodePlan(sw, sh);
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  let last = '';
  for (const step of plan) {
    const key = `${step.w}x${step.h}`;
    if (key !== last) {
      c.width = step.w;
      c.height = step.h;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, step.w, step.h);
      ctx.drawImage(bmp, 0, 0, step.w, step.h);
      last = key;
    }
    const dataUrl = c.toDataURL('image/jpeg', step.quality);
    if (dataUrlBytes(dataUrl) <= MAX_BYTES) return { dataUrl, w: step.w, h: step.h };
  }
  return null;
}

/**
 * Trim the cutout to its visible pixels (plus a little margin) and encode it with transparency:
 * WebP where the browser can write it, else PNG; shrinks until it is under 600 KB.
 * @returns {{ dataUrl:string, w:number, h:number, aspect:number, mime:string } | null}
 */
export function encodeCutout(rgba, alpha, w, h) {
  const box = alphaBounds(alpha, w, h, 24);
  if (!box) return null;
  const pad = Math.round(Math.max(box.w, box.h) * 0.01) + 2;
  const x0 = Math.max(0, box.x0 - pad);
  const y0 = Math.max(0, box.y0 - pad);
  const x1 = Math.min(w, box.x1 + pad);
  const y1 = Math.min(h, box.y1 + pad);
  const cw = x1 - x0;
  const ch = y1 - y0;
  const full = document.createElement('canvas');
  full.width = cw;
  full.height = ch;
  const img = full.getContext('2d').createImageData(cw, ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = (y + y0) * w + (x + x0);
      const o = (y * cw + x) * 4;
      img.data[o] = rgba[si * 4];
      img.data[o + 1] = rgba[si * 4 + 1];
      img.data[o + 2] = rgba[si * 4 + 2];
      img.data[o + 3] = alpha[si];
    }
  }
  full.getContext('2d').putImageData(img, 0, 0);
  let long = Math.min(CUTOUT_LONG_PX, Math.max(cw, ch));
  const out = document.createElement('canvas');
  const ctx = out.getContext('2d');
  for (let tries = 0; tries < 8; tries++) {
    const s = fitWithin(cw, ch, long);
    out.width = s.w;
    out.height = s.h;
    ctx.clearRect(0, 0, s.w, s.h);
    ctx.drawImage(full, 0, 0, s.w, s.h);
    for (const [mime, q] of [['image/webp', 0.9], ['image/webp', 0.8], ['image/png', undefined]]) {
      const dataUrl = out.toDataURL(mime, q);
      if (!dataUrl.startsWith(`data:${mime}`)) continue; // browser can't write this type
      if (dataUrlBytes(dataUrl) <= MAX_BYTES) return { dataUrl, w: s.w, h: s.h, aspect: s.w / s.h, mime };
    }
    long = Math.floor(long * 0.8);
    if (long < 240) break;
  }
  return null;
}
