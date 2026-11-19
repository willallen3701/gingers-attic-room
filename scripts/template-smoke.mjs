// Real-click smoke test of "Use a template" in the editor (headless Chrome over the DevTools protocol; nothing installed).
// Checks: the button and picker, the five looks before January 1 and four after, the "replace your booth?" question
// (shown over a layout, skipped on a new booth, "Keep" changes nothing), Undo bringing the old booth back, and that
// applying marks the draft as changed. Usage: node scripts/template-smoke.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const port = 5193;
const dbg = 9338;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), String(port)], { stdio: 'ignore' });
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'attic-tplsmoke-'))}`,
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
const SR = `document.querySelector('attic-editor').shadowRoot`;
const q = (sel) => `${SR}.querySelector(${JSON.stringify(sel)})`;
// A real mouse click at the middle of an element (not element.click()).
async function click(sel) {
  const p = await evaluate(`(() => { const e = ${q(sel)}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  if (!p) throw new Error(`nothing to click: ${sel}`);
  const m = (type, buttons) => send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', buttons, clickCount: 1, pointerType: 'mouse' });
  await m('mouseMoved', 0);
  await m('mousePressed', 1);
  await m('mouseReleased', 0);
  await sleep(250);
}
let failures = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
  if (!ok) failures += 1;
};
const state = () =>
  evaluate(`(() => ({ fixtures: ${SR}.querySelectorAll('.room.edit .fixture, .room.edit [data-kind="fixture"]').length, items: ${SR}.querySelectorAll('.room.edit .item[data-kind="item"]').length, boxes: ${SR}.querySelectorAll('.room.edit [data-kind="box"]').length, wall: getComputedStyle(${q('.room.edit')}).getPropertyValue('--wall') || '', sheet: !!${q('.tplsheet')}, confirm: !!${q('.tplconfirm')}, cards: [...${SR}.querySelectorAll('[data-tpl-id]')].map((b) => b.dataset.tplId), status: ${q('.status')}?.textContent ?? '', toast: ${q('.toast')}?.textContent ?? '', undo: !${q('.undo')}.disabled, html: ${q('.room.edit')}.innerHTML.length }))()`);

async function open(query) {
  await send('Page.navigate', { url: `http://localhost:${port}/editor.html?coach=0&${query}` });
  await sleep(2500);
}

try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${dbg}/json`)).json();
      if (targets.find((t) => t.type === 'page')) break;
    } catch { /* starting */ }
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  // 1. Over the demo booth (it has shelves, decor and items out): before the cutoff.
  await open('now=2026-12-31T23:30:00');
  const before = await state();
  check('the "Use a template" button is in the top bar', !!(await evaluate(`!!${q('.usetpl')}`)));
  await click('.usetpl');
  let s = await state();
  check('the picker opens with five looks (Dec 31, 23:30)', s.sheet && s.cards.length === 5 && s.cards.includes('christmas'), s.cards.join(','));
  await click('[data-tpl-id="farmhouse"]');
  s = await state();
  check('over an existing layout it asks first and has not changed anything', s.confirm && s.html === before.html);
  await click('[data-tpl="back"]');
  s = await state();
  check('"Keep my booth as it is" goes back to the picker, booth unchanged', s.sheet && !s.confirm && s.html === before.html);
  await click('[data-tpl="close"]');
  s = await state();
  check('closing the picker changes nothing and sends nothing to save', !s.sheet && s.html === before.html && !/Unsaved/.test(s.status));
  await click('.usetpl');
  await click('[data-tpl-id="christmas"]');
  await click('[data-tpl="yes"]');
  s = await state();
  check('"Yes" applies the Christmas look', !s.sheet && s.html !== before.html && /Christmas is ready/.test(s.toast), s.toast.slice(0, 60));
  check('the draft is marked changed (it is saved as a draft, not opened to shoppers)', /Unsaved|Saving|saved/i.test(s.status) && s.undo);
  await click('.undo');
  s = await state();
  check('Undo brings the old booth straight back', s.html === before.html);

  // 2. After the cutoff: January 1.
  await open('now=2027-01-01T00:00:00');
  await click('.usetpl');
  s = await state();
  check('on January 1 the picker offers four looks and no Christmas', s.cards.length === 4 && !s.cards.includes('christmas'), s.cards.join(','));

  // 3. A new booth: nothing to lose, so no question.
  await open('fresh=1&now=2026-11-18T12:00:00');
  const fresh = await state();
  await click('.usetpl');
  await click('[data-tpl-id="cozy-cottage"]');
  s = await state();
  check('on a new booth it applies straight away, no question', !s.sheet && !s.confirm && s.html !== fresh.html && /Cozy Cottage is ready/.test(s.toast), s.toast.slice(0, 80));
  check('items were placed (more items on the wall/floor than before)', s.items > fresh.items, `${fresh.items} -> ${s.items}`);

  // 4. Escape closes the picker.
  await click('.usetpl');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(200);
  s = await state();
  check('Escape closes the picker', !s.sheet);

  // 5. Christmas: one garland on the wall, no stockings (the owner scratched them).
  await open('now=2026-11-18T12:00:00');
  await click('.usetpl');
  await click('[data-tpl-id="christmas"]');
  await click('[data-tpl="yes"]');
  await evaluate(`(() => { window.__drafts = []; document.querySelector('attic-editor').addEventListener('attic-booth:event', (e) => { if (e.detail.type === 'save-draft') window.__drafts.push(e.detail.draft); }); })()`);
  const decorBy = (part) => evaluate(`(() => { const e = [...${SR}.querySelectorAll('.room.edit [data-kind="decor"]')].find((x) => (x.querySelector('img')?.getAttribute('src') ?? '').includes(${JSON.stringify(part)})); return e ? e.dataset.id : null; })()`);
  const chips = () => evaluate(`[...${SR}.querySelectorAll('.selbar .variant')].map((b) => [b.title, b.getAttribute('aria-pressed')])`);
  const gaId = await decorBy('xmas-garland');
  check('the template put one garland on the wall and no stockings', !!gaId && !(await decorBy('xmas-stockings')) && (await evaluate(`[...${SR}.querySelectorAll('.room.edit [data-kind="decor"] img')].filter((i) => i.getAttribute('src').includes('garland')).length`)) === 1);
  let c;
  await click(`.room.edit [data-kind="decor"][data-id="${gaId}"]`);
  c = await chips();
  check('selecting the garland shows no length choices (it is one real swag)', c.length === 0, c.map((x) => x[0]).join(', '));
  const slider = await evaluate(`(() => { const i = ${q('.selbar input[data-act="sel-scale"]')}; return i ? [i.min, i.max] : null; })()`);
  check('the Size slider is still there for fine adjustment (80-120 %)', !!slider && slider[0] === '80' && slider[1] === '120', String(slider));
  const sh = await evaluate(`(() => { const e = ${q(`.room.edit [data-kind="decor"][data-id="${gaId}"]`)}; return { contact: !!e.querySelector('.contact'), filter: getComputedStyle(e.querySelector('img')).filter }; })()`);
  check('a wall piece has a drop shadow on the wall and no floor-style contact shadow', !sh.contact && /drop-shadow/.test(sh.filter), sh.filter.slice(0, 60));
  const fl = await evaluate(`(() => { const e = ${SR}.querySelector('.room.edit .item.decor.mount-stand'); return e ? !!e.querySelector('.contact') : null; })()`);
  check('floor and shelf pieces keep their contact shadow', fl === true);
} finally {
  try { ws?.close(); } catch { /* closed */ }
  chrome.kill();
  server.kill();
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll template checks passed');
process.exit(failures ? 1 : 0);
