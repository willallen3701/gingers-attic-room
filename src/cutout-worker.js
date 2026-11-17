// Web worker: downloads (and caches) the background-removal model and runs it with onnxruntime-web,
// so the page stays responsive. Messages in:  {type:'warm', spec} | {type:'run', id, spec, rgba, w, h}
// Messages out: {type:'progress', loaded, total} | {type:'ready'} | {type:'mask', id, mask, w, h} | {type:'error', id, message}
import { preprocess, outputToMask } from './logic/mask.js';
import { ORT_BASE } from './cutout-spec.js';

const CACHE = 'attic-models-v1';
let ortP = null;
let session = null;
let sessionUrl = '';
let sessionP = null;

function getOrt() {
  if (!ortP) {
    ortP = import(`${ORT_BASE}ort.wasm.min.mjs`).then((ort) => {
      ort.env.wasm.wasmPaths = ORT_BASE;
      // Threads need cross-origin isolation, which an embedded page doesn't have.
      ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, self.navigator.hardwareConcurrency || 2) : 1;
      return ort;
    });
  }
  return ortP;
}

async function fetchModel(url) {
  const abs = new URL(url, self.location.href).href;
  let cache = null;
  try {
    cache = await caches.open(CACHE);
    const hit = await cache.match(abs);
    if (hit) return new Uint8Array(await hit.arrayBuffer());
  } catch {
    cache = null; // storage blocked: download every time
  }
  const res = await fetch(abs);
  if (!res.ok) throw new Error(`model download failed (HTTP ${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  let lastPost = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    const now = Date.now();
    if (now - lastPost > 200) {
      lastPost = now;
      self.postMessage({ type: 'progress', loaded, total });
    }
  }
  const bytes = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) {
    bytes.set(c, o);
    o += c.length;
  }
  self.postMessage({ type: 'progress', loaded, total: total || loaded });
  if (cache) {
    try {
      await cache.put(abs, new Response(bytes.slice(), { headers: { 'content-type': 'application/octet-stream' } }));
    } catch {
      /* quota full: fine, it downloads again next time */
    }
  }
  return bytes;
}

function getSession(spec) {
  if (session && sessionUrl === spec.url) return Promise.resolve(session);
  if (sessionP && sessionUrl === spec.url) return sessionP;
  sessionUrl = spec.url;
  sessionP = (async () => {
    const ort = await getOrt();
    const bytes = await fetchModel(spec.url);
    const opts = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
    if (spec.sessionExtra) opts.extra = spec.sessionExtra;
    session = await ort.InferenceSession.create(bytes, opts);
    self.postMessage({ type: 'ready' });
    return session;
  })();
  sessionP.catch(() => {
    sessionP = null;
    sessionUrl = '';
  });
  return sessionP;
}

self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.type === 'warm') {
    getSession(m.spec).catch((err) => self.postMessage({ type: 'error', id: null, message: String(err?.message || err) }));
    return;
  }
  if (m.type !== 'run') return;
  try {
    const ort = await getOrt();
    const s = await getSession(m.spec);
    const input = preprocess(new Uint8ClampedArray(m.rgba), m.w, m.h, m.spec);
    const tensor = new ort.Tensor('float32', input, [1, 3, m.h, m.w]);
    const inName = m.spec.inputName || s.inputNames[0];
    const outName = m.spec.outputName || s.outputNames[0];
    const out = await s.run({ [inName]: tensor });
    const mask = outputToMask(out[outName].data, m.w * m.h, { sigmoid: !!m.spec.sigmoid });
    self.postMessage({ type: 'mask', id: m.id, mask, w: m.w, h: m.h }, [mask.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String(err?.message || err) });
  }
};
