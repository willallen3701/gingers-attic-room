// Screenshots for the Christmas v5 revision, through the real editor UI (headless Chrome over the DevTools protocol).
// Usage: node scripts/christmas-v5-shots.mjs <outDir>
// Saves into outDir (raw pieces; scripts/ compose step joins them): template-christmas-v5.png, christmas-wall-closeup-v5.png,
// raw-stock-<n>.png (+ raw-stock-bar.png), raw-garland-<pct>.png (+ raw-garland-bar-<pct>.png), raw-shadow-before.png / raw-shadow-after.png,
// and peek-card-v5.png when ?peek is available.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(process.argv[2] ?? join(root, 'screenshots'));
mkdirSync(outDir, { recursive: true });
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const port = 5194;
const dbg = 9339;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), String(port)], { stdio: 'ignore' });
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'attic-v5shots-'))}`,
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
const click = (sel) => evaluate(`(() => { const e = ${q(sel)}; if (!e) throw new Error('no ${sel.replace(/'/g, '')}'); e.click(); return true; })()`);
async function realClick(x, y) {
  const m = (type, buttons) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1, pointerType: 'mouse' });
  await m('mouseMoved', 0); await m('mousePressed', 1); await m('mouseReleased', 0);
  await sleep(250);
}
const rectOf = (sel) => evaluate(`(() => { const e = ${q(sel)}; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; })()`);
const save = async (name, clip, scale = 1) => {
  const params = { format: 'png' };
  if (clip) params.clip = { x: clip.x, y: clip.y, width: clip.w, height: clip.h, scale };
  const { data } = await send('Page.captureScreenshot', params);
  writeFileSync(join(outDir, name), Buffer.from(data, 'base64'));
  console.log('saved', name);
};
const decorSel = (prefix) => `[data-kind="decor"][data-id="${prefix}"]`;
/** Select a placed decor piece (by its decorId) with a real click on its picture. */
async function selectDecor(decorIdPrefix) {
  const info = await evaluate(`(() => {
    const room = ${q('.room.edit')};
    const els = [...room.querySelectorAll('[data-kind="decor"]')].filter((e) => (e.querySelector('img')?.getAttribute('src') ?? '').includes('/${decorIdPrefix}'));
    const e = els[0]; if (!e) return null;
    const r = e.getBoundingClientRect(); return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.55, id: e.dataset.id };
  })()`);
  if (!info) throw new Error(`no decor ${decorIdPrefix}`);
  await realClick(info.x, info.y);
  return info.id;
}
const roomRect = () => rectOf('.room.edit');

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
  const openChristmas = async () => {
    await send('Page.navigate', { url: `http://localhost:${port}/editor.html?coach=0&now=2026-11-18T12:00:00` });
    await sleep(2500);
    await click('.usetpl'); await sleep(300);
    await click('[data-tpl-id="christmas"]'); await sleep(200);
    await click('[data-tpl="yes"]'); await sleep(900);
  };
  const hideToast = () => evaluate(`(() => { const st = document.createElement('style'); st.textContent = '.toast{display:none !important}'; ${ED}.appendChild(st); })()`);
  await openChristmas();
  await save('template-christmas-v5.png');
  const rr = await roomRect();
  const wallClip = { x: rr.x, y: rr.y, w: rr.w * 0.78, h: rr.h * 0.62 };
  await save('christmas-wall-closeup-v5.png', wallClip, 2);

  // before / after of the wall shadow (the same booth: "before" puts the old floor-style contact ellipses back and the old filter)
  await save('raw-shadow-after.png', { x: rr.x, y: rr.y, w: rr.w * 0.78, h: rr.h * 0.62 }, 2);
  await evaluate(`(() => { const sr = ${ED}; const st = document.createElement('style'); st.id = 'oldshadow';
    st.textContent = '.item.mount-wall .contact{display:block !important} .item.mount-wall img{filter:drop-shadow(.35cqw .55cqw .35cqw rgba(30,20,10,.35)) !important}';
    sr.appendChild(st);
    sr.querySelectorAll('.room.edit .item.mount-wall').forEach((el) => { const s = document.createElement('span'); s.className = 'contact'; el.insertBefore(s, el.firstChild); }); })()`);
  await sleep(200);
  await save('raw-shadow-before.png', { x: rr.x, y: rr.y, w: rr.w * 0.78, h: rr.h * 0.62 }, 2);

  // the garland is one real swag: clear the wall of the wreath, centre it, then size it 80 / 100 / 120 %
  await openChristmas();
  await hideToast();
  for (const id of ['xmas-wreath']) { await selectDecor(id); await click('[data-act="sel-remove"]'); await sleep(200); }
  await selectDecor('xmas-garland');
  for (let i = 0; i < 22; i++) await click('.selbar [data-act="nudge"][data-dx="1"]');
  const r3 = await roomRect();
  for (const pct of [80, 100, 120]) {
    await evaluate(`(() => { const i = ${q('.selbar input[data-act="sel-scale"]')}; i.value = ${pct}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(350);
    const bar = await rectOf('.selbar');
    await save(`raw-garland-${pct}.png`, { x: r3.x, y: r3.y + r3.h * 0.08, w: r3.w, h: r3.h * 0.26 }, 1.5);
    await save(`raw-garland-bar-${pct}.png`, bar, 1);
  }
} finally {
  try { ws?.close(); } catch { /* closed */ }
  chrome.kill();
  server.kill();
}
