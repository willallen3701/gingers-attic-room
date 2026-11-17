// Real-input smoke test of the booth editor: drives headless Chrome over the DevTools protocol
// (Node's built-in WebSocket; nothing installed) and checks drag, add-from-panel, place, undo and autosave.
// Usage: node scripts/editor-smoke.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const port = 5181;
const dbg = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), String(port)], { stdio: 'ignore' });
const profile = mkdtempSync(join(tmpdir(), 'attic-smoke-'));
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`,
  `--remote-debugging-port=${dbg}`, '--window-size=1440,1000', `http://localhost:${port}/editor.html?coach=0&storage=it-mug-brown`,
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
const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse', ...extra });
async function drag(from, to, steps = 12) {
  await mouse('mouseMoved', from.x, from.y, { buttons: 0 });
  await mouse('mousePressed', from.x, from.y);
  for (let i = 1; i <= steps; i++) {
    await mouse('mouseMoved', from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await sleep(20);
  }
  await mouse('mouseReleased', to.x, to.y);
  await sleep(150);
}
async function click(p) {
  await mouse('mouseMoved', p.x, p.y, { buttons: 0 });
  await mouse('mousePressed', p.x, p.y);
  await mouse('mouseReleased', p.x, p.y);
  await sleep(150);
}
const S = `document.querySelector('attic-editor').shadowRoot`;
// Scroll the element into view first: with the full library, panel cards can sit below the fold.
const rectOf = (sel) => evaluate(`(() => { const e = ${S}.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, w: r.width, h: r.height }; })()`);
const text = (sel) => evaluate(`${S}.querySelector(${JSON.stringify(sel)})?.textContent ?? null`);
const count = (sel) => evaluate(`${S}.querySelectorAll(${JSON.stringify(sel)}).length`);

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${dbg}/json`)).json();
      target = list.find((t) => t.type === 'page' && t.url.includes('editor.html'));
    } catch {
      /* chrome still starting */
    }
  }
  if (!target) throw new Error('Chrome did not start');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message));
      else p.resolve(m.result);
    }
  };
  await send('Runtime.enable');
  // The page (or the local server) can still be starting: tolerate a missing element, and reload once halfway.
  for (let i = 0; i < 80; i++) {
    if (i === 40) await send('Page.reload').catch(() => {});
    if (await evaluate(`!!document.querySelector('attic-editor')?.shadowRoot?.querySelector('.room.edit .item')`).catch(() => false)) break;
    await sleep(250);
  }
  await sleep(500);

  // 1. Drag the chair 12 % of the room to the right along the floor.
  const chairSel = '.room.edit [data-id="it-yellow-chair"]';
  const before = await rectOf(chairSel);
  const room = await rectOf('.room.edit');
  await drag({ x: before.x, y: before.y + before.h * 0.3 }, { x: before.x + room.w * 0.12, y: before.y + before.h * 0.3 });
  const after = await rectOf(chairSel);
  check('dragging the chair moves it right', after.l - before.l > room.w * 0.08, `${Math.round(after.l - before.l)} px`);
  check('the chair is selected after the drag', (await text('.selbar .selname b')) === 'Pretty Yellow Chair');

  // 2. Autosave kicks in after ~1.5 s and reports a saved draft.
  await sleep(2300);
  const status = await text('.status .savetext');
  check('autosave reports a saved draft', /Draft saved/.test(status ?? ''), status);
  check('status shows unopened changes', /changes shoppers/.test((await text('.status .chip')) ?? ''));

  // 3. Undo puts the chair back.
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2 });
  await sleep(200);
  const undone = await rectOf(chairSel);
  check('Ctrl+Z undoes the move', Math.abs(undone.l - before.l) < 2, `${Math.round(undone.l - before.l)} px`);

  // 4. Dropping a fixture onto an invalid spot (on top of a shelf stack) is refused.
  await click(await rectOf('.tab[data-tab="fixtures"]'));
  const fixturesBefore = await count('.room.edit .fixture');
  const card = await rectOf('.srccard[data-src-kind="fixture"][data-src-id="shelf-stack-4"]');
  const shelf1 = await rectOf('.room.edit [data-id="fx1"]');
  await drag(card, { x: shelf1.x, y: shelf1.y }, 16);
  check('a shelf dropped onto another shelf is refused', (await count('.room.edit .fixture')) === fixturesBefore);

  // 5. Clicking a fixture card adds it in a free spot.
  await click(await rectOf('.srccard[data-src-kind="fixture"][data-src-id="shelf-stack-4"]'));
  const fixturesAfter = await count('.room.edit .fixture');
  check('clicking a fixture card adds one', fixturesAfter === fixturesBefore + 1, `${fixturesBefore} -> ${fixturesAfter}`);

  // 6. My Items: the stored mug can be placed with the Place button.
  await click(await rectOf('.tab[data-tab="items"]'));
  const placedBefore = await count('.room.edit .item:not(.decor)');
  await click(await rectOf('.itemrow [data-act="place"][data-id="it-mug-brown"]'));
  check('Place puts the stored mug in the booth', (await count('.room.edit .item:not(.decor)')) === placedBefore + 1);

  // 7. Wallpaper swatch changes the wall.
  await click(await rectOf('.tab[data-tab="walls"]'));
  const wallBefore = await evaluate(`${S}.querySelector('.room.edit .wall').style.backgroundImage`);
  const sw = await evaluate(`[...${S}.querySelectorAll('.sw.tex[data-act="wallpaper"]')].findIndex((b) => !b.classList.contains('on'))`);
  await click(await rectOf(`.sw.tex[data-act="wallpaper"]:nth-child(${sw + 1})`));
  const wallAfter = await evaluate(`${S}.querySelector('.room.edit .wall').style.backgroundImage`);
  check('a wallpaper swatch changes the wall', wallAfter !== wallBefore);

  // 8. Move a teacup from one shelf board to the board above: it snaps onto the new board.
  const cupSel = '.room.edit [data-id="it-teacup-gold"]';
  const cup = await rectOf(cupSel);
  const roomR = await rectOf('.room.edit');
  const boardGap = (8.8 / 120) * roomR.w; // shelf boards are 8.8 in apart
  await drag({ x: cup.x, y: cup.y }, { x: cup.x, y: cup.y - boardGap });
  const cup2 = await rectOf(cupSel);
  check('a teacup dragged up one board snaps onto it', Math.abs(cup2.t + cup2.h - (cup.t + cup.h - boardGap)) < 3, `moved ${Math.round(cup.t - cup2.t)} px`);

  // 9. Upload a large floor photo: it is downscaled to <= 1600 px / 600 KB and used on the floor (Tile/Fill shown).
  await click(await rectOf('.tab[data-tab="floor"]'));
  const big = join(root, '..', 'assets-src', 'downloads', 'polyhaven', 'textures', 'american_walnut_veneer', 'american_walnut_veneer_Diffuse_2k.jpg');
  if (existsSync(big)) {
    const { result } = await send('Runtime.evaluate', { expression: `${S}.querySelector('input[data-act="upload"][data-kind="floor"]')` });
    await send('DOM.enable');
    await send('DOM.setFileInputFiles', { files: [big], objectId: result.objectId });
    for (let i = 0; i < 40; i++) {
      if (await evaluate(`/data:image\\/jpeg/.test(${S}.querySelector('.room.edit .floor-plane').style.backgroundImage)`)) break;
      await sleep(250);
    }
    const info = await evaluate(`(async () => {
      const bg = ${S}.querySelector('.room.edit .floor-plane').style.backgroundImage;
      const url = bg.slice(5, -2);
      const b64 = url.slice(url.indexOf(',') + 1);
      const img = new Image(); img.src = url; await img.decode();
      return { bytes: Math.floor(b64.length * 3 / 4), w: img.naturalWidth, h: img.naturalHeight, seg: !!${S}.querySelector('[data-act="floor-mode"]') };
    })()`);
    check('an uploaded floor photo is downscaled and applied', info.bytes <= 600 * 1024 && Math.max(info.w, info.h) <= 1600 && info.seg, `${info.w}x${info.h}, ${Math.round(info.bytes / 1024)} KB`);
  } else {
    check('upload test photo present', false, big);
  }

  // 10. Open/Update booth clears the unopened-changes state.
  await sleep(1800);
  await click(await rectOf('.open'));
  await sleep(900);
  check('Update booth marks the booth up to date', /shoppers see this version/.test((await text('.status .chip')) ?? ''));

  // 11. Setup guide: Next walks the steps (tabs follow), the Phase 3 steps say "coming next", Skip ends it.
  await send('Page.enable');
  await send('Page.navigate', { url: `http://localhost:${port}/editor.html?wizard=0` });
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    if (await evaluate(`!!${S}?.querySelector('.bubble.wizard')`)) break;
  }
  await evaluate(`window.__events = []; document.addEventListener('attic-booth:event', (e) => window.__events.push(e.detail.type));`);
  for (let i = 0; i < 3; i++) await click(await rectOf('[data-wiz="next"]'));
  const step4 = await text('.bubble.wizard h3');
  const soon = await text('.bubble.wizard .soon');
  check('step 4 of the guide is the live "Add your items" step', step4 === 'Add your items' && !soon, step4);
  check('step 4 opens the My Items tab with an Add button', (await evaluate(`${S}.querySelector('.tab[aria-selected="true"]').dataset.tab`)) === 'items' && (await count('[data-act="add-item"]')) === 1);
  await click(await rectOf('[data-wiz="next"]'));
  check('step 5 is placing items', (await text('.bubble.wizard h3')) === 'Place your items');
  await click(await rectOf('[data-wiz="finish"]'));
  check('Skip the tour closes the guide and reports wizard-done', !(await evaluate(`!!${S}.querySelector('.bubble.wizard')`)) && (await evaluate('window.__events.includes("wizard-done")')));

  // 12. Add an item: agreement -> photo -> automatic cutout -> erase brush -> details -> send.
  // Standalone, the editor answers the requests itself, so nothing leaves the browser.
  const waitFor = async (expr, ms) => {
    for (let t = 0; t < ms; t += 250) {
      if (await evaluate(expr)) return true;
      await sleep(250);
    }
    return false;
  };
  await send('Page.navigate', { url: `http://localhost:${port}/editor.html?coach=0&tab=items` });
  await waitFor(`!!${S}?.querySelector('[data-act="add-item"]')`, 10000);
  await click(await rectOf('[data-act="add-item"]'));
  check('the first item asks for the seller agreement', await waitFor(`!!${S}.querySelector('.agreebox h3')`, 8000));
  await evaluate(`${S}.querySelector('[data-agree="check"]').click()`);
  await click(await rectOf('[data-sheet="agree"]'));
  check('agreeing moves on to the photo step', await waitFor(`!!${S}.querySelector('[data-file="main"]')`, 5000));
  await evaluate(`(async () => {
    const c = document.createElement('canvas'); c.width = 900; c.height = 700;
    const x = c.getContext('2d'); x.fillStyle = '#e9e2d3'; x.fillRect(0, 0, 900, 700);
    x.fillStyle = '#5b3a1e'; x.beginPath(); x.ellipse(450, 430, 170, 200, 0, 0, Math.PI * 2); x.fill(); x.fillRect(400, 130, 100, 130);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const input = ${S}.querySelector('[data-file="main"]');
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'vase.png', { type: 'image/png' }));
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  const t0 = Date.now();
  const gotCanvas = await waitFor(`!!${S}.querySelector('.cutcanvas')`, 300000);
  const cutSecs = Math.round((Date.now() - t0) / 1000);
  const share = gotCanvas ? await evaluate(`(() => { const c = ${S}.querySelector('.cutcanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) k++; return k / (d.length / 4); })()`) : null;
  const note = await text('.sheetbody .note');
  check('the automatic cutout removes the background', share !== null && share > 0.08 && share < 0.5, `${share === null ? 'no canvas' : Math.round(share * 100) + '% kept'}, ${cutSecs} s${note ? `; note: ${note}` : ''}`);
  const cv = await rectOf('.cutcanvas');
  const alphaAt = (fx, fy) => evaluate(`(() => { const c = ${S}.querySelector('.cutcanvas'); return c.getContext('2d').getImageData(Math.round(c.width * ${fx}), Math.round(c.height * ${fy}), 1, 1).data[3]; })()`);
  const aBefore = await alphaAt(0.5, 0.62);
  await drag({ x: cv.l + cv.w * 0.42, y: cv.t + cv.h * 0.62 }, { x: cv.l + cv.w * 0.58, y: cv.t + cv.h * 0.62 }, 10);
  const aAfter = await alphaAt(0.5, 0.62);
  check('the Erase brush clears what it paints over', aBefore > 200 && aAfter < 30, `${aBefore} -> ${aAfter}`);
  await click(await rectOf('[data-go="details"]'));
  check('Looks good opens the details form with the cutout preview', await waitFor(`!!${S}.querySelector('.itemform') && !!${S}.querySelector('.cutprev img')`, 5000));
  await evaluate(`(() => {
    const f = ${S}.querySelector('.itemform');
    const set = (n, v) => { const el = f.querySelector('[name="' + n + '"]'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('title', 'Smoke Test Stoneware Vase'); set('description', 'Brown glazed stoneware vase. No chips.');
    set('category', 'glass-ceramics'); set('era', '1970s'); set('heightIn', '11'); set('widthIn', '7'); set('weightLb', '2'); set('weightOz', '4');
    set('price', '45'); set('quantity', '1'); set('shippingPrice', '12');
    f.querySelector('[name="condition"][value="very-good"]').checked = true;
  })()`);
  await click(await rectOf('.itemform [type="submit"]'));
  const sentOk = await waitFor(`!${S}.querySelector('.sheet') && [...${S}.querySelectorAll('.itemrow .nm')].some((n) => n.textContent === 'Smoke Test Stoneware Vase')`, 10000);
  check('Send adds the item to the crate', sentOk);
  check('the new item says it is waiting for Ginger', (await evaluate(`[...${S}.querySelectorAll('.itemrow')].find((r) => r.textContent.includes('Smoke Test Stoneware Vase'))?.querySelector('.badge')?.textContent ?? ''`)) === 'Waiting for Ginger');
  await click(await rectOf('.itemrow:last-of-type [data-act="place"]'));
  check('placing it draws it faded until approved', (await count('.room.edit .item.unapproved')) >= 1);
} catch (e) {
  console.error('ERROR', e.message);
  results.push({ name: 'harness', ok: false });
} finally {
  try {
    ws?.close();
  } catch {
    /* ignore */
  }
  chrome.kill();
  server.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
