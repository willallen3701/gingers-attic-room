// Screenshots for the "decor-more" branch, through the real editor UI (headless Chrome over the DevTools protocol).
// Usage: node scripts/decor-more-shots.mjs <outDir>
// The rooms are arranged with the editor's own operations (logic/editops.js, so every placement is validated), written to a
// temporary data/_shots/ folder and loaded by a temporary _shot-editor.html; both are removed afterwards.
// Saves: garland-over-window.png, wreath-over-window.png, room-new-fixtures.png, room-tables-display.png,
//        overhead-lights-off.png, overhead-lights-on.png, picker-decor.png, picker-lighting.png, picker-fixtures.png
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLibrary } from '../src/logic/library.js';
import { buildLayout } from '../src/logic/layout.js';
import { addFixture, placeDecor, placePlaceable, placeItem, autoPlaceItem, setDecorLit } from '../src/logic/editops.js';
import { FLOOR_BAND } from '../src/logic/fixtures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(process.argv[2] ?? join(root, 'screenshots'));
mkdirSync(outDir, { recursive: true });
const rawLib = JSON.parse(readFileSync(join(root, 'data/library.json'), 'utf8'));
const lib = normalizeLibrary(rawLib);
const fdef = Object.fromEntries(lib.fixtures.map((f) => [f.id, f]));
const demo = JSON.parse(readFileSync(join(root, 'data/demo-booth.json'), 'utf8'));

// ------------------------------------------------------------------ the rooms
const base = (room) => ({
  ...JSON.parse(JSON.stringify(demo)),
  fixtures: [],
  decor: [],
  boxes: [],
  items: demo.items.map((i) => ({ ...i, placement: null, sizeTweak: 1 })),
  room: { ...demo.room, sound: null, placeables: [], light: null, ...room },
});
const must = (r, what) => {
  if (!r.ok) throw new Error(`${what}: ${JSON.stringify(r.errors)}`);
  return r.booth;
};
const addFx = (b, id, x, base = FLOOR_BAND.yMax) => must(addFixture(b, rawLib, id, { x, y: fdef[id].mount === 'wall' ? base : base - fdef[id].heightIn }), `fixture ${id}`);
const dec = (b, id, drop) => {
  const r = placeDecor(b, rawLib, id, drop);
  if (!r.ok) throw new Error(`decor ${id}: ${JSON.stringify(r.errors)}`);
  return r;
};
const onSurface = (b, fxId, surfaceId, decorId, frac = 0.5) => {
  const L = buildLayout(b, rawLib);
  const s = L.surfaces.find((x) => x.id === `${fxId}:${surfaceId}`);
  const x = s.x1 + (s.x2 - s.x1) * frac;
  return dec(b, decorId, { x, y: s.y }).booth;
};
const fill = (b, ids) => {
  for (const id of ids) {
    const r = autoPlaceItem(b, rawLib, id);
    if (r.ok) b = r.booth;
  }
  return b;
};
const lit = (b, on) => ({ ...b, decor: b.decor.map((d) => (['lighting'].includes(lib.decor.find((x) => x.id === d.decorId)?.category) ? { ...d, lit: on } : d)) });

const sill = (b, archId, x, y) => must(placePlaceable(b, rawLib, archId, { x, y }), 'window');
const booths = {};

// 1 + 2: a garland and a wreath over a window
for (const [name, piece, drop] of [['garland', 'xmas-garland', { x: 60, y: 31 }], ['wreath', 'xmas-wreath', { x: 60, y: 61 }]]) {
  let b = base({ wall: { type: 'wallpaper', textureId: 'wp-mint-stripe', mode: 'tile', scale: 1 }, architecture: ['baseboard-walnut', 'crown-white'] });
  b = sill(b, 'window-sash', 41.5, 76);
  b = dec(b, piece, drop).booth;
  b = addFx(b, 'table-console-carved', 29, 118);
  b = onSurface(b, 'fx1', 's0', 'vase-blue-white', 0.25);
  b = onSurface(b, 'fx1', 's0', 'lantern-kerosene', 0.62);
  booths[`${name}-over-window`] = b;
}

// 3: a room using several of the new fixtures
{
  let b = base({ wall: { type: 'wallpaper', textureId: 'wp-gilded-damask', mode: 'tile', scale: 1 }, floor: { textureId: 'fl-wood-dark', mode: 'tile', scale: 1 }, architecture: ['baseboard-walnut', 'crown-walnut'] });
  b = addFx(b, 'rack-metal-worn', 1, 112);
  b = addFx(b, 'case-curio-tall', 41, 112);
  b = addFx(b, 'pie-safe-spindle', 76, 106);
  b = addFx(b, 'rack-plate-30', 76, 24);
  b = addFx(b, 'stand-tiered', 96, 119);
  const ids = Object.fromEntries(b.fixtures.map((f) => [f.fixtureId, f.id]));
  b = onSurface(b, ids['pie-safe-spindle'], 's0', 'basket-sewing', 0.3);
  b = onSurface(b, ids['pie-safe-spindle'], 's0', 'candlestick-wooden', 0.8);
  b = onSurface(b, ids['stand-tiered'], 't0', 'jug-floral', 0.5);
  b = onSurface(b, ids['stand-tiered'], 't2', 'plant-succulent', 0.5);
  b = fill(b, ['it-amber-lamp', 'it-goblet-brass', 'it-genie-lamp', 'it-teacup-gold', 'it-teacup-mint', 'it-teacup-black', 'it-mug-brown', 'it-book-stack', 'it-rotary-phone', 'it-tin-motorcycle', 'it-iron-truck', 'it-horseshoe', 'it-cameo']);
  booths['room-new-fixtures'] = b;
}

// 4: tables, a bench and a display cabinet
{
  let b = base({ wall: { type: 'paint', paintId: 'paint-sage' }, floor: { textureId: 'fl-herringbone', mode: 'tile', scale: 1 }, architecture: ['baseboard-white', 'picturerail-white'] });
  b = addFx(b, 'cabinet-display-lacquer', 3, 110);
  b = addFx(b, 'bench-painted', 40, 112);
  b = addFx(b, 'table-round-cupboard', 90, 114);
  const ids = Object.fromEntries(b.fixtures.map((f) => [f.fixtureId, f.id]));
  b = onSurface(b, ids['table-round-cupboard'], 's0', 'radio-field', 0.5);
  b = onSurface(b, ids['bench-painted'], 's0', 'kettle-vintage', 0.3);
  b = fill(b, ['it-framed-art', 'it-cameo', 'it-genie-lamp', 'it-goblet-brass', 'it-teacup-gold', 'it-teacup-black', 'it-mug-brown', 'it-book-stack']);
  booths['room-tables-display'] = b;
}

// 5: overhead lights, off and on
{
  let b = base({ wall: { type: 'paint', paintId: 'paint-bottle-green' }, floor: { textureId: 'fl-wood-dark', mode: 'tile', scale: 1 }, architecture: ['baseboard-walnut', 'crown-walnut'] });
  b = dec(b, 'chandelier-brass-shades', { x: 18, y: 3 }).booth; // right under the top of the wall
  b = dec(b, 'pendant-opal-globe', { x: 56, y: 40 }).booth; // dropped on its cord
  b = dec(b, 'chandelier-candle', { x: 88, y: 3 }).booth;
  b = dec(b, 'pendant-factory', { x: 111, y: 46 }).booth;
  b = dec(b, 'sconce-bulkhead', { x: 38, y: 56 }).booth;
  b = addFx(b, 'table-farm-60', 30, 113);
  b = onSurface(b, 'fx1', 'top', 'lamp-pipe-edison', 0.2);
  b = onSurface(b, 'fx1', 'top', 'kettle-vintage', 0.55);
  b = onSurface(b, 'fx1', 'top', 'candlestick-wooden', 0.85);
  booths['overhead-lights-off'] = lit(b, false);
  booths['overhead-lights-on'] = lit(b, true);
}

// ------------------------------------------------------------------ temp files
const tmpData = join(root, 'data/_shots');
const tmpPage = join(root, '_shot-editor.html');
mkdirSync(tmpData, { recursive: true });
for (const [name, b] of Object.entries(booths)) {
  const L = buildLayout(b, rawLib);
  const bad = Object.keys(L.problems);
  if (bad.length) throw new Error(`${name}: problems ${JSON.stringify(L.problems)}`);
  writeFileSync(join(tmpData, `${name}.json`), JSON.stringify(b));
}
writeFileSync(tmpPage, readFileSync(join(root, 'editor.html'), 'utf8').replace("el.setAttribute('booth-src', 'data/demo-booth.json');", "el.setAttribute('booth-src', q.get('b') || 'data/demo-booth.json');"));

// ------------------------------------------------------------------ browser
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const port = 5197;
const dbg = 9342;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), String(port)], { stdio: 'ignore' });
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'attic-dmshots-'))}`,
  `--remote-debugging-port=${dbg}`, '--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore' });
let ws;
let seq = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed');
  return r.result.value;
};
const ED = `document.querySelector('attic-editor').shadowRoot`;
const q = (sel) => `${ED}.querySelector(${JSON.stringify(sel)})`;
const rectOf = (sel) => evaluate(`(() => { const e = ${q(sel)}; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; })()`);
const save = async (name, clip, scale = 1) => {
  const params = { format: 'png' };
  if (clip) params.clip = { x: clip.x, y: clip.y, width: clip.w, height: clip.h, scale };
  const { data } = await send('Page.captureScreenshot', params);
  writeFileSync(join(outDir, name), Buffer.from(data, 'base64'));
  console.log('saved', join(outDir, name));
};
const hideChrome = () => evaluate(`(() => { const st = document.createElement('style'); st.textContent = '.toast{display:none !important}'; ${ED}.appendChild(st); })()`);

try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${dbg}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch { /* starting */ }
    await sleep(200);
  }
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); if (d.error) p.reject(new Error(d.error.message)); else p.resolve(d.result); }
  };
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  for (const name of Object.keys(booths)) {
    await send('Page.navigate', { url: `http://localhost:${port}/_shot-editor.html?coach=0&now=2026-11-18T12:00:00&b=data/_shots/${name}.json` });
    await sleep(2600);
    await hideChrome();
    const rr = await rectOf('.room.edit');
    const problems = await evaluate(`${ED}.querySelectorAll('.room.edit .bad').length`);
    if (problems) console.log('WARNING', name, problems, 'pieces flagged as problems in the editor');
    await save(`${name}.png`, rr, 1.6);
  }
  // pickers (the demo booth)
  for (const [tab, name, height] of [['decor', 'picker-decor.png', 5200], ['fixtures', 'picker-fixtures.png', 4600]]) {
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://localhost:${port}/editor.html?coach=0&tab=${tab}&now=2026-11-18T12:00:00` });
    await sleep(2600);
    await evaluate(`(() => { const b = ${ED}.querySelector('.tabbody'); if (b) b.scrollTop = 0; return true; })()`);
    await save(name, { x: 0, y: 0, w: 340, h: height });
    if (tab === 'decor') {
      // the lighting section on its own
      const sec = await evaluate(`(() => { const h = [...${ED}.querySelectorAll('.tabbody section')].find((s) => s.querySelector('h3')?.textContent.trim() === 'Lighting'); if (!h) return null; const r = h.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; })()`);
      if (!sec) throw new Error('no Lighting section');
      await save('picker-lighting.png', { x: sec.x - 10, y: sec.y - 10, w: sec.w + 20, h: sec.h + 20 }, 1.5);
    }
  }
} finally {
  try { ws?.close(); } catch { /* closed */ }
  chrome.kill();
  server.kill();
  rmSync(tmpData, { recursive: true, force: true });
  rmSync(tmpPage, { force: true });
}
