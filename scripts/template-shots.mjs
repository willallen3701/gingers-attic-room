// Screenshots of the "Use a template" feature, driven through the real editor UI (headless Chrome over the DevTools
// protocol; nothing is installed). Usage: node scripts/template-shots.mjs [outDir]
// Saves: template-picker.png, template-confirm.png, template-<id>.png for every look offered, template-phone.png.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(process.argv[2] ?? join(root, 'screenshots'));
mkdirSync(outDir, { recursive: true });
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const port = 5192;
const dbg = 9337;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), String(port)], { stdio: 'ignore' });
const profile = mkdtempSync(join(tmpdir(), 'attic-tplshots-'));
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`,
  `--remote-debugging-port=${dbg}`, '--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore' });

let ws;
let seq = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed');
  return r.result.value;
};
const ED = `document.querySelector('attic-editor').shadowRoot`;
const click = (sel) => evaluate(`(() => { const e = ${ED}.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('no ${sel.replace(/'/g, '')}'); e.click(); return true; })()`);
const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, name), Buffer.from(data, 'base64'));
  console.log('saved', join(outDir, name));
};
const viewport = (width, height, mobile = false) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });

try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${dbg}/json`)).json();
      if (targets.find((t) => t.type === 'page')) break;
    } catch { /* chrome still starting */ }
    await sleep(200);
  }
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id);
      pending.delete(d.id);
      if (d.error) p.reject(new Error(d.error.message));
      else p.resolve(d.result);
    }
  };
  await send('Page.enable');
  const openEditor = async () => {
    await viewport(1440, 1000);
    await send('Page.navigate', { url: `http://localhost:${port}/editor.html?coach=0&now=2026-11-18T12:00:00` });
    await sleep(2500);
  };
  await openEditor();
  // The same sample booth every time: the demo booth with its own shelves and decor (so each look is a real overwrite).
  await click('.usetpl');
  await sleep(600);
  await shot('template-picker.png');
  const ids = await evaluate(`[...${ED}.querySelectorAll('[data-tpl-id]')].map((b) => b.dataset.tplId)`);
  console.log('offered', ids.join(', '));
  await click(`[data-tpl-id="${ids[0]}"]`);
  await sleep(400);
  await shot('template-confirm.png');
  for (const id of ids) {
    await openEditor();
    await click('.usetpl');
    await sleep(300);
    await click(`[data-tpl-id="${id}"]`);
    await sleep(200);
    await click('[data-tpl="yes"]');
    await sleep(900);
    await shot(`template-${id}.png`);
    if (id === ids[0]) {
      await viewport(390, 844, true);
      await sleep(1200);
      await evaluate(`${ED}.querySelector('.roomframe').scrollIntoView({ block: 'end' })`);
      await sleep(500);
      await shot('template-phone.png');
    }
  }
} finally {
  try { ws?.close(); } catch { /* closed */ }
  chrome.kill();
  server.kill();
}
