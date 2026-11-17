// Main-thread side of the background remover: talks to cutout-worker.js and scales the mask
// back up to the photo's working size.
import { MODEL_SPEC } from './cutout-spec.js';
import { clearHaze } from './logic/mask.js';

let worker = null;
let seq = 0;
const waiting = new Map();
const listeners = new Set();
let ready = false;

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./cutout-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === 'progress') listeners.forEach((fn) => fn({ loaded: m.loaded, total: m.total }));
    else if (m.type === 'ready') {
      ready = true;
      listeners.forEach((fn) => fn({ ready: true }));
    } else if (m.type === 'mask' || m.type === 'error') {
      if (m.id === null) {
        listeners.forEach((fn) => fn({ error: m.message }));
        return;
      }
      const w = waiting.get(m.id);
      if (!w) return;
      waiting.delete(m.id);
      if (m.type === 'mask') w.resolve(m);
      else w.reject(new Error(m.message));
    }
  };
  worker.onerror = (e) => {
    const err = new Error(e.message || 'The cutout tool failed to start.');
    waiting.forEach((w) => w.reject(err));
    waiting.clear();
    listeners.forEach((fn) => fn({ error: err.message }));
  };
  return worker;
}

/** Subscribe to download progress / ready / error. Returns an unsubscribe function. */
export function onModelStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The worker lives in src/, so give it the model URL resolved against the page, not itself.
const absSpec = () => ({ ...MODEL_SPEC, url: new URL(MODEL_SPEC.url, document.baseURI).href });

export const modelReady = () => ready;
export const modelSizeMB = () => MODEL_SPEC.approxMB;

/** Start downloading the model early (when the sheet opens). */
export function warmUp() {
  try {
    getWorker().postMessage({ type: 'warm', spec: absSpec() });
  } catch {
    /* no workers: cutOut() will report it */
  }
}

/**
 * Find the item in the photo. `pix` = { w, h, rgba } at working size.
 * @returns {Promise<Uint8ClampedArray>} alpha (0..255) for each working pixel
 */
export async function cutOut(pix, { timeoutMs = 180000 } = {}) {
  const S = MODEL_SPEC.size;
  // Photo -> model input: stretched to S x S, as the model was trained.
  const src = document.createElement('canvas');
  src.width = pix.w;
  src.height = pix.h;
  src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pix.rgba), pix.w, pix.h), 0, 0);
  const inC = document.createElement('canvas');
  inC.width = S;
  inC.height = S;
  const inCtx = inC.getContext('2d', { willReadFrequently: true });
  inCtx.imageSmoothingQuality = 'high';
  inCtx.drawImage(src, 0, 0, S, S);
  const rgba = inCtx.getImageData(0, 0, S, S).data;

  const id = ++seq;
  const result = await new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      if (waiting.delete(id)) reject(new Error('The cutout took too long.'));
    }, timeoutMs);
    const done = (fn) => (v) => {
      clearTimeout(t);
      fn(v);
    };
    waiting.set(id, { resolve: done(resolve), reject: done(reject) });
    getWorker().postMessage({ type: 'run', id, spec: absSpec(), rgba: rgba.buffer, w: S, h: S }, [rgba.buffer]);
  });

  // Mask (S x S) -> working size, through a canvas so it is smoothly resampled.
  const mC = document.createElement('canvas');
  mC.width = S;
  mC.height = S;
  const mImg = new ImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = result.mask[i];
    mImg.data[i * 4] = v;
    mImg.data[i * 4 + 1] = v;
    mImg.data[i * 4 + 2] = v;
    mImg.data[i * 4 + 3] = 255;
  }
  mC.getContext('2d').putImageData(mImg, 0, 0);
  const outC = document.createElement('canvas');
  outC.width = pix.w;
  outC.height = pix.h;
  const oCtx = outC.getContext('2d', { willReadFrequently: true });
  oCtx.imageSmoothingQuality = 'high';
  oCtx.drawImage(mC, 0, 0, pix.w, pix.h);
  const big = oCtx.getImageData(0, 0, pix.w, pix.h).data;
  const alpha = new Uint8ClampedArray(pix.w * pix.h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = big[i * 4];
  return clearHaze(alpha, 10);
}
