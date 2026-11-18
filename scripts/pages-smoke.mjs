// Real-input smoke test of the lamp switch, the booth directory (All booths + My collection), the FAQ and the
// phone layouts, with headless Chrome over the DevTools protocol (Node's built-in WebSocket; nothing installed).
// The embeds run inside an iframe on a same-origin harness page that plays the Wix page: it posts the page's
// messages and records what the embed sends, so the real postMessage protocol is exercised both ways.
// Also saves screenshots (desktop and 375 px) to screenshots/, and compares Firefox with Chrome (WebDriver BiDi,
// scripts/firefox-bidi.mjs) for the directory, the booth view and the editor.
// Usage: node scripts/pages-smoke.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterBooths } from '../src/logic/directory.js';
import { applyDraft } from '../src/logic/draft.js';
import { launchFirefox } from './firefox-bidi.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = join(root, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const port = 5182;
const dbg = 9334;
const origin = `http://localhost:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sample = JSON.parse(readFileSync(join(root, 'data/sample-directory.json'), 'utf8'));

const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), String(port)], { stdio: 'ignore' });
const profile = mkdtempSync(join(tmpdir(), 'attic-pages-smoke-'));
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', `--user-data-dir=${profile}`,
  `--remote-debugging-port=${dbg}`, '--window-size=1440,1000', `${origin}/__harness`,
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
  if (r.exceptionDetails) throw new Error(`${r.exceptionDetails.exception?.description ?? 'eval failed'}\n  in: ${expr.slice(0, 160)}`);
  return r.result.value;
};
const waitFor = async (expr, ms = 8000) => {
  for (let t = 0; t < ms; t += 100) {
    if (await evaluate(expr).catch(() => false)) return true;
    await sleep(100);
  }
  return false;
};
const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse', ...extra });
async function clickAt(p) {
  if (!p) throw new Error('nothing to click');
  await mouse('mouseMoved', p.x, p.y, { buttons: 0 });
  await mouse('mousePressed', p.x, p.y);
  await mouse('mouseReleased', p.x, p.y);
  await sleep(120);
}
async function typeText(text) {
  await send('Input.insertText', { text });
  await sleep(60);
}
async function navigate(url, readyExpr) {
  await send('Page.navigate', { url });
  await sleep(150);
  if (readyExpr && !(await waitFor(readyExpr, 15000))) throw new Error(`page not ready: ${url}`);
}
const KEYS = { ArrowLeft: 37, ArrowRight: 39, End: 35, Home: 36, Escape: 27 };
async function key(k) {
  const vk = KEYS[k];
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(70);
}
async function hover(p) {
  await mouse('mouseMoved', p.x, p.y, { buttons: 0 });
  await sleep(250);
}
async function viewport(width, height, mobile = false, scale = 1) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
  await sleep(100);
}

// Rect (centre in top-level CSS px) of an element; `expr` is evaluated in the top document and may reach into the iframe.
const rectOf = (expr) =>
  evaluate(`(() => {
    const el = (${expr}); if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    let x = r.left, y = r.top;
    const f = el.ownerDocument.defaultView.frameElement;
    if (f) { const fr = f.getBoundingClientRect(); x += fr.left; y += fr.top; }
    return { x: x + r.width / 2, y: y + r.height / 2, l: x, t: y, w: r.width, h: r.height };
  })()`);

// ---- harness: this page plays the Wix page
const FRAME = `document.querySelector('iframe')`;
async function harness(page, w, h) {
  await navigate(`${origin}/__harness`, 'document.readyState === "complete"');
  await evaluate(`(() => {
    document.documentElement.innerHTML = '<head></head><body style="margin:0;background:#333"></body>';
    window.__msgs = [];
    window.addEventListener('message', (e) => { if (e.data && e.data.source === 'attic-booth') window.__msgs.push(e.data); });
    const f = document.createElement('iframe');
    f.src = ${JSON.stringify(`/${page}`)};
    f.style.cssText = 'display:block;border:0;width:${w}px;height:${h}px';
    document.body.append(f);
    return true;
  })()`);
}
const post = (type, data = {}) => evaluate(`${FRAME}.contentWindow.postMessage(${JSON.stringify({ target: 'attic-booth', version: 1, type, ...data })}, location.origin)`).then(() => sleep(150));
const msgs = (type) => evaluate(`window.__msgs.filter((m) => m.type === ${JSON.stringify(type)})`);
const waitMsg = (type, n = 1, ms = 6000) => waitFor(`window.__msgs.filter((m) => m.type === ${JSON.stringify(type)}).length >= ${n}`, ms);
const lastMsg = async (type) => (await msgs(type)).at(-1) ?? null;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

// ---- page-context helpers (strings, evaluated in the page)
const DEEP = `const __all = (root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((el) => { out.push(el); if (el.shadowRoot) walk(el.shadowRoot); }); walk(root); return out; };`;
const noSideScroll = () =>
  evaluate(`(() => { const se = document.scrollingElement; return { ok: se.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth, sw: se.scrollWidth, w: innerWidth }; })()`);
// Every visible tap target outside the room picture (items and price tags in the room zoom instead) must be >= 40 px.
const smallTargets = () =>
  evaluate(`(() => { ${DEEP}
    const shown = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const inRoom = (el) => { for (let n = el; n; n = n.parentNode ?? n.host) if (n.classList?.contains('room')) return true; return false; };
    const bad = [];
    for (const el of __all(document)) {
      const tag = el.tagName;
      let t = null;
      if (['BUTTON', 'SELECT', 'TEXTAREA', 'SUMMARY'].includes(tag) || (tag === 'A' && el.hasAttribute('href'))) t = el;
      else if (tag === 'INPUT' && el.type !== 'hidden') t = ['checkbox', 'radio', 'file'].includes(el.type) ? (el.closest('label') ?? el) : el;
      if (!t || !shown(t) || inRoom(t)) continue;
      const r = t.getBoundingClientRect();
      if (r.width < 39.5 || r.height < 39.5) bad.push(\`\${tag.toLowerCase()}.\${String(t.className || '').split(' ')[0]} "\${(t.textContent || t.getAttribute('aria-label') || t.name || '').trim().slice(0, 24)}" \${Math.round(r.width)}x\${Math.round(r.height)}\`);
    }
    return bad;
  })()`);

async function shot(name, { width, height, mobile = false, scale = 1, url, ready, before }) {
  await viewport(width, height, mobile, scale);
  await navigate(url, ready);
  if (before) await before();
  // Lazy thumbnails below the fold would be blank in a full-page capture: load them all, wait for fonts and decodes.
  await evaluate(`(async () => { ${DEEP}
    const imgs = __all(document).filter((e) => e.tagName === 'IMG');
    imgs.forEach((i) => { i.loading = 'eager'; });
    await document.fonts.ready;
    await Promise.all(imgs.map((i) => (i.complete && i.naturalWidth ? null : i.decode().catch(() => null))));
    return imgs.length;
  })()`);
  await sleep(700);
  const m = await send('Page.getLayoutMetrics');
  const h = Math.ceil(m.cssContentSize?.height ?? m.contentSize.height);
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.max(h, 200), scale: 1 } });
  const file = join(shotsDir, name);
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`saved ${file}`);
  return file;
}

const shotsSaved = [];
/** Screenshot of a region (rect from rectOf, in viewport px) plus a margin. */
async function clipShot(name, r, pad = 24) {
  const o = await evaluate('({ x: scrollX, y: scrollY, w: innerWidth, h: innerHeight })');
  const x = Math.max(0, r.l - pad);
  const y = Math.max(0, r.t - pad);
  const clip = { x: x + o.x, y: y + o.y, width: Math.min(o.w - x, r.w + 2 * pad), height: Math.min(o.h - y, r.h + 2 * pad), scale: 1 };
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
  const file = join(shotsDir, name);
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`saved ${file}`);
  shotsSaved.push(file);
  return file;
}

// Test pieces: an 80 in armoire and two 2 in thimbles (artwork in assets/placeholder), added to the demo booth.
const TEST_ITEMS = [
  { id: 'it-armoire', title: 'Walnut armoire', description: 'Two-door walnut armoire with a drawer.', price: 450, quantity: 1, status: 'approved', category: 'Furniture', image: 'assets/placeholder/item-armoire.svg', aspect: 0.55, heightIn: 80, widthIn: 44, mount: 'stand', dims: { h: 80, w: 44, d: 22 }, weightLb: 60, placement: null },
  { id: 'it-thimble', title: 'Brass thimble', description: 'Brass sewing thimble, worn top.', price: 12, quantity: 1, status: 'approved', category: 'Collectibles', image: 'assets/placeholder/item-thimble.svg', aspect: 0.85, heightIn: 2, widthIn: 1.7, mount: 'stand', dims: { h: 2, w: 1.7, d: 1.7 }, weightLb: 0.05, placement: null },
  { id: 'it-thimble2', title: 'Silver thimble', description: 'Silver thimble with a floral band.', price: 18, quantity: 1, status: 'approved', category: 'Collectibles', image: 'assets/placeholder/item-thimble.svg', aspect: 0.85, heightIn: 2, widthIn: 1.7, mount: 'stand', dims: { h: 2, w: 1.7, d: 1.7 }, weightLb: 0.05, placement: null },
];
let shopBooth = null; // the test booth as the shop sees it after the editor saved it (with a box)
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${dbg}/json`)).json();
      target = list.find((t) => t.type === 'page');
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
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      console.log(`  page error: ${d.exception?.description?.split('\n').slice(0, 3).join(' | ') ?? d.text}`);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      console.log(`  console.error: ${m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300)}`);
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  for (let i = 0; i < 40; i++) {
    if (await fetch(`${origin}/editor.html`).then((r) => r.ok).catch(() => false)) break;
    await sleep(250);
  }

  // =========================================================== 1. Editor: a lamp's On/Off switch
  console.log('\n-- lamps in the editor');
  await viewport(1440, 1000);
  const ED = `document.querySelector('attic-editor').shadowRoot`;
  await navigate(`${origin}/editor.html?coach=0&tab=decor`, `!!document.querySelector('attic-editor')?.shadowRoot?.querySelector('.srccard[data-src-id="lamp-floor-fringe"]')`);
  await evaluate(`window.__ev = []; document.addEventListener('attic-booth:event', (e) => window.__ev.push(JSON.parse(JSON.stringify(e.detail)))); true`);
  const lampsBefore = await evaluate(`${ED}.querySelectorAll('.room.edit .item.decor').length`);
  await clickAt(await rectOf(`${ED}.querySelector('.srccard[data-src-id="lamp-floor-fringe"]')`));
  const newId = await evaluate(`[...${ED}.querySelectorAll('.room.edit .item.decor')].map((e) => e.dataset.id).find((id) => id !== 'dc1') ?? null`);
  check('clicking the floor lamp card adds it to the booth', (await evaluate(`${ED}.querySelectorAll('.room.edit .item.decor').length`)) === lampsBefore + 1 && !!newId, newId);
  const sw0 = await evaluate(`(() => { const s = ${ED}.querySelector('.selbar .lampswitch'); return s ? { checked: s.getAttribute('aria-checked'), role: s.getAttribute('role'), text: s.textContent.trim() } : null; })()`);
  check('the selected lamp has an On/Off switch, and a new lamp starts off', sw0?.role === 'switch' && sw0.checked === 'false' && /Off/.test(sw0.text), JSON.stringify(sw0));
  check('an unlit lamp draws no glow', (await evaluate(`${ED}.querySelectorAll('.room.edit .lamps .lamp[data-id="${newId}"]').length`)) === 0);
  await clickAt(await rectOf(`${ED}.querySelector('.selbar .lampswitch')`));
  check('the switch turns on', (await evaluate(`${ED}.querySelector('.selbar .lampswitch')?.getAttribute('aria-checked')`)) === 'true');
  const glow = await evaluate(`(() => {
    const lamp = ${ED}.querySelector('.room.edit .item.decor[data-id="${newId}"]').getBoundingClientRect();
    const core = ${ED}.querySelector('.room.edit .lamps .glow .lamp[data-id="${newId}"] .core');
    const pool = ${ED}.querySelector('.room.edit .lamps .wash .lamp[data-id="${newId}"] .pool');
    if (!core || !pool) return null;
    const c = core.getBoundingClientRect();
    return { cx: (c.left + c.right) / 2, cy: (c.top + c.bottom) / 2, l: lamp.left, r: lamp.right, t: lamp.top, h: lamp.height, poolW: pool.getBoundingClientRect().width, lampW: lamp.width,
             ground: !!${ED}.querySelector('.room.edit .lamps .wash .lamp[data-id="${newId}"] .ground') };
  })()`);
  check('a lit floor lamp draws a glow in its shade (top quarter of the lamp)', glow && glow.cx > glow.l && glow.cx < glow.r && glow.cy > glow.t && glow.cy < glow.t + glow.h * 0.25, glow && `core at ${Math.round(((glow.cy - glow.t) / glow.h) * 100)}% down the lamp`);
  check('...with a soft pool on the wall and one on the floor', glow && glow.poolW > glow.lampW * 2 && glow.ground);
  await sleep(2400);
  const draft = (await evaluate(`window.__ev.filter((m) => m.type === 'save-draft').at(-1)?.draft ?? null`)) ?? {};
  const savedLamp = draft.decor?.find((d) => d.id === newId);
  check('autosave sends the lamp with lit: true in save-draft', savedLamp?.lit === true && savedLamp.decorId === 'lamp-floor-fringe', JSON.stringify(savedLamp));
  check('the demo candelabra stays lit in the draft', draft.decor?.find((d) => d.id === 'dc1')?.lit === true);
  // Reload: the page sends the saved draft back as decor[].lit
  await evaluate(`(async () => {
    const el = document.querySelector('attic-editor');
    const booth = await (await fetch('data/demo-booth.json')).json();
    booth.decor = ${JSON.stringify(draft.decor ?? [])};
    await el.loadEditor({ booth, library: await (await fetch('data/library.json')).json(), meta: { boothStatus: 'live' } });
    el.debugSetup({ coach: false, select: { kind: 'decor', id: ${JSON.stringify(newId)} } });
    return true;
  })()`);
  check('after a reload the lamp is still lit (glow + switch on)', (await evaluate(`${ED}.querySelectorAll('.room.edit .lamps .glow .lamp[data-id="${newId}"] .core').length`)) === 1 && (await evaluate(`${ED}.querySelector('.selbar .lampswitch')?.getAttribute('aria-checked')`)) === 'true');
  await clickAt(await rectOf(`${ED}.querySelector('.selbar .lampswitch')`));
  check('switching it off removes its glow', (await evaluate(`${ED}.querySelectorAll('.room.edit .lamps .lamp[data-id="${newId}"]').length`)) === 0 && (await evaluate(`${ED}.querySelector('.selbar .lampswitch')?.getAttribute('aria-checked')`)) === 'false');
  // a plant has no switch
  await evaluate(`document.querySelector('attic-editor').debugSetup({ select: null })`);
  await clickAt(await rectOf(`${ED}.querySelector('.tab[data-tab="decor"]')`));
  await clickAt(await rectOf(`${ED}.querySelector('.srccard[data-src-id="plant-succulent"]')`));
  check('other decor (a succulent) gets no lamp switch', (await evaluate(`${ED}.querySelector('.selbar .selname b')?.textContent`)) === 'Small succulent' && !(await evaluate(`!!${ED}.querySelector('.selbar .lampswitch')`)));

  // =========================================================== 2. Shop booth view: lit lamps, Lights switch, booth heart
  console.log('\n-- booth view');
  const BV = `document.querySelector('attic-booth').shadowRoot`;
  await navigate(`${origin}/embed.html`, `!!document.querySelector('attic-booth')?.shadowRoot?.querySelector('.room .item')`);
  await evaluate(`window.__ev = []; document.addEventListener('attic-booth:event', (e) => window.__ev.push(e.detail)); true`);
  const flames = await evaluate(`(() => {
    const c = ${BV}.querySelector('.item.decor[data-id="dc1"]').getBoundingClientRect();
    return [...${BV}.querySelectorAll('.lamps .glow .lamp[data-id="dc1"] .core')].map((e) => { const r = e.getBoundingClientRect(); return { x: (r.left + r.right) / 2 - c.left, y: (r.top + r.bottom) / 2 - c.top, w: c.width, h: c.height }; });
  })()`);
  check('the lamp the seller left lit is on when the booth opens', flames.length === 3);
  check('its three flames sit on the candle tips (top 10 %, left / centre / right)', flames.length === 3 && flames.every((f) => f.y < f.h * 0.1) && flames[0].x < flames[0].w * 0.2 && Math.abs(flames[1].x - flames[1].w / 2) < flames[1].w * 0.08 && flames[2].x > flames[2].w * 0.8, flames.map((f) => `${Math.round((f.x / f.w) * 100)}%,${Math.round((f.y / f.h) * 100)}%`).join(' '));
  check('the Lights button shows for lit lamps (no lighting preset)', (await evaluate(`${BV}.querySelector('.lights')?.getAttribute('aria-pressed')`)) === 'true');
  await clickAt(await rectOf(`${BV}.querySelector('.lights')`));
  await sleep(650);
  const offOp = await evaluate(`getComputedStyle(${BV}.querySelector('.lamps .wash')).opacity + '/' + getComputedStyle(${BV}.querySelector('.lamps .glow')).opacity`);
  check('Lights off turns the lamp glow off', (await evaluate(`${BV}.querySelector('.room').classList.contains('lights-off')`)) && offOp === '0/0', offOp);
  await clickAt(await rectOf(`${BV}.querySelector('.lights')`));
  await sleep(650);
  const onOp = await evaluate(`getComputedStyle(${BV}.querySelector('.lamps .wash')).opacity + '/' + getComputedStyle(${BV}.querySelector('.lamps .glow')).opacity`);
  check('Lights on brings it back', onOp === '1/1', onOp);
  await clickAt(await rectOf(`${BV}.querySelector('.favbooth')`));
  const fb = await evaluate(`window.__ev.filter((m) => m.type === 'toggle-favourite-booth').at(-1) ?? null`);
  check('the booth heart sends toggle-favourite-booth {boothId, on}', fb?.boothId === 'booth-demo-ginger' && fb.on === true && (await evaluate(`${BV}.querySelector('.favbooth').getAttribute('aria-pressed')`)) === 'true');
  // set-favourites from the page, through the real postMessage path
  await harness('embed.html', 1100, 900);
  const BVF = `${FRAME}.contentDocument.querySelector('attic-booth').shadowRoot`;
  await waitMsg('ready');
  const demoBooth = JSON.parse(readFileSync(join(root, 'data/demo-booth.json'), 'utf8'));
  await post('load-booth', { booth: demoBooth });
  await waitFor(`!!${BVF}.querySelector('.favbooth')`);
  await post('set-favourites', { boothIds: ['booth-demo-ginger'], itemIds: ['it-amber-lamp'] });
  check('set-favourites with boothIds lights the booth heart', (await evaluate(`${BVF}.querySelector('.favbooth').getAttribute('aria-pressed')`)) === 'true');
  await post('set-favourites', { itemIds: [] });
  check('set-favourites with only itemIds leaves the booth heart alone', (await evaluate(`${BVF}.querySelector('.favbooth').getAttribute('aria-pressed')`)) === 'true');
  await post('open-item', { itemId: 'it-amber-lamp' });
  await post('set-favourites', { itemIds: ['it-amber-lamp'] });
  check('...and itemIds still mark the item card heart', (await evaluate(`${BVF}.querySelector('.card .fav')?.getAttribute('aria-pressed')`)) === 'true');

  // =========================================================== 3. Directory: All booths
  console.log('\n-- directory');
  await harness('directory.html', 1100, 860);
  const DIR = `${FRAME}.contentDocument.querySelector('attic-directory').shadowRoot`;
  check('the directory says ready (mode directory)', (await waitMsg('ready')) && (await lastMsg('ready'))?.mode === 'directory');
  await sleep(1100);
  check('...and repeats it about every second until load-directory', (await msgs('ready')).length >= 2);
  await post('load-directory', { booths: sample.booths, loggedIn: false, favourites: { boothIds: ['bt-lamplight'], itemIds: [] }, categories: sample.categories });
  await waitFor(`${DIR}.querySelectorAll('.bcard').length > 0`);
  const readyN = (await msgs('ready')).length;
  await sleep(1300);
  check('ready stops once the directory has arrived', (await msgs('ready')).length === readyN);
  const cardIds = () => evaluate(`[...${DIR}.querySelectorAll('.bcard')].map((c) => c.dataset.id)`);
  check('one card per booth', (await cardIds()).length === sample.booths.length, `${(await cardIds()).length}`);
  const card0 = await evaluate(`(() => { const c = ${DIR}.querySelector('.bcard[data-id="bt-velvet"]'); return { sign: c.querySelector('.sign')?.className, no: c.querySelector('.sign .no')?.textContent, nm: c.querySelector('.sign .nm')?.textContent, thumbs: c.querySelectorAll('.thumbs img').length, count: c.querySelector('.count')?.textContent, about: c.querySelector('.babout')?.textContent }; })()`);
  check('a card draws the booth sign in its style, with about text, item count and thumbnails', card0.sign === 'sign style-brass' && card0.no === 'Booth No. 12' && card0.nm === 'The Velvet Drawer' && card0.thumbs === 4 && /17\s*items/.test(card0.count) && !!card0.about, JSON.stringify(card0));
  check('saved booths show a filled heart', (await evaluate(`${DIR}.querySelector('.bcard[data-id="bt-lamplight"] .heart').getAttribute('aria-pressed')`)) === 'true');
  const want = (opts) => filterBooths(sample.booths, opts).map((r) => r.booth.id);
  await clickAt(await rectOf(`${DIR}.querySelector('.tools input[name="q"]')`));
  await typeText('teacup');
  await sleep(400);
  check('search "teacup" matches booth names, item titles and about text', JSON.stringify(await cardIds()) === JSON.stringify(want({ query: 'teacup' })), (await cardIds()).join(','));
  check('a card shows which items matched', /Teacup/.test((await evaluate(`${DIR}.querySelector('.bcard[data-id="bt-velvet"] .hits')?.textContent`)) ?? ''));
  await evaluate(`(() => { const i = ${DIR}.querySelector('.tools input[name="q"]'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await clickAt(await rectOf(`${DIR}.querySelector('.tools input[name="q"]')`));
  await typeText('june');
  await sleep(400);
  check('search matches the seller name', JSON.stringify(await cardIds()) === JSON.stringify(['bt-teacup']));
  await evaluate(`(() => { const i = ${DIR}.querySelector('.tools input[name="q"]'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); const s = ${DIR}.querySelector('select[name="category"]'); s.value = 'lighting'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(300);
  check('the category filter keeps booths with lighting', JSON.stringify(await cardIds()) === JSON.stringify(want({ category: 'lighting' })), (await cardIds()).join(','));
  await clickAt(await rectOf(`${DIR}.querySelector('.tools input[name="q"]')`));
  await typeText('zzzz');
  await sleep(400);
  const nm = await evaluate(`${DIR}.querySelector('.nomatch')?.textContent ?? ''`);
  check('a search with no matches gets its own message', /No booths in Lighting match .zzzz./.test(nm), nm.trim().replace(/\s+/g, ' ').slice(0, 70));
  await clickAt(await rectOf(`${DIR}.querySelector('.nomatch .clearsearch')`));
  check('"Show all booths" clears search and filter', (await cardIds()).length === sample.booths.length && (await evaluate(`${DIR}.querySelector('select[name="category"]').value`)) === '');
  await evaluate(`(() => { const s = ${DIR}.querySelector('select[name="sort"]'); s.value = 'number'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(200);
  check('sort by booth number', JSON.stringify(await cardIds()) === JSON.stringify(want({ sort: 'number' })));
  await evaluate(`(() => { const s = ${DIR}.querySelector('select[name="sort"]'); s.value = 'updated'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(200);
  check('sort by recently updated', JSON.stringify(await cardIds()) === JSON.stringify(want({ sort: 'updated' })));
  await evaluate(`(() => { const s = ${DIR}.querySelector('select[name="sort"]'); s.value = 'shuffle'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(200);
  const shuffled = await cardIds();
  check('shuffle shows every booth and a Shuffle again button', shuffled.length === sample.booths.length && new Set(shuffled).size === shuffled.length && !(await evaluate(`${DIR}.querySelector('.reshuffle').hidden`)));
  await clickAt(await rectOf(`${DIR}.querySelector('.bcard[data-id="bt-paper"] .heart')`));
  const tfb = await lastMsg('toggle-favourite-booth');
  check('a card heart sends toggle-favourite-booth {boothId, on}', tfb?.boothId === 'bt-paper' && tfb.on === true);
  await clickAt(await rectOf(`${DIR}.querySelector('.bcard[data-id="bt-paper"] .babout')`));
  check('clicking a card sends open-booth {slug}', (await lastMsg('open-booth'))?.slug === 'the-paper-trail');
  await post('set-favourites', { boothIds: ['bt-toybox'] });
  check('set-favourites updates the hearts', (await evaluate(`[...${DIR}.querySelectorAll('.bcard .heart[aria-pressed="true"]')].map((h) => h.dataset.favBooth).join()`)) === 'bt-toybox');
  await post('load-directory', { booths: [], loggedIn: false, favourites: { boothIds: [], itemIds: [] }, categories: sample.categories });
  const empty = await evaluate(`${DIR}.querySelector('.nobooths')?.textContent?.trim() ?? ''`);
  check('no booths: "No other booths are open yet."', empty === 'No other booths are open yet.' && (await evaluate(`${DIR}.querySelector('.tools').hidden`)));

  // =========================================================== 4. Directory: My collection
  console.log('\n-- my collection');
  await post('load-directory', { booths: sample.booths, loggedIn: false, favourites: { boothIds: [], itemIds: [] }, categories: sample.categories });
  await clickAt(await rectOf(`${DIR}.querySelector('.tab[data-tab="collection"]')`));
  check('logged out, My collection offers a Log in button', !!(await evaluate(`!!${DIR}.querySelector('#p-col .login')`)) && (await evaluate(`${DIR}.querySelector('#p-col').hidden`)) === false);
  await clickAt(await rectOf(`${DIR}.querySelector('#p-col .login')`));
  check('Log in sends login-request', (await msgs('login-request')).length === 1);
  const favs = { boothIds: ['bt-lamplight', 'bt-teacup'], itemIds: sample.collection.items.map((i) => i.id) };
  await post('load-directory', { booths: sample.booths, loggedIn: true, favourites: favs, categories: sample.categories });
  check('logged in, the collection tab sends get-collection', await waitMsg('get-collection'));
  check('...and waits for it', !!(await evaluate(`!!${DIR}.querySelector('#p-col .dmsg')`)));
  await post('collection', { booths: sample.booths.filter((b) => favs.boothIds.includes(b.id)), items: sample.collection.items });
  await waitFor(`${DIR}.querySelectorAll('#p-col .icard').length > 0`);
  check('saved booths and items are listed', (await evaluate(`${DIR}.querySelectorAll('#p-col .mcard').length`)) === 2 && (await evaluate(`${DIR}.querySelectorAll('#p-col .icard').length`)) === 5);
  const itemInfo = (id) => evaluate(`(() => { const c = ${DIR}.querySelector('.icard[data-id="${id}"]'); return c ? { price: c.querySelector('.iprice')?.textContent, status: c.querySelector('.istatus')?.textContent ?? '', cart: !!c.querySelector('.cartbtn'), heart: !!c.querySelector('.heart') } : null; })()`);
  const lamp = await itemInfo('it-amber-lamp');
  check('an available item shows its price, Add to cart and a remove heart', lamp?.price === '$85' && lamp.cart && lamp.heart && !lamp.status, JSON.stringify(lamp));
  const sold = await itemInfo('it-horseshoe');
  const out = await itemInfo('it-rotary-phone');
  check('a sold item is labelled Sold, with no cart button', sold?.status === 'Sold' && !sold.cart);
  check('an item with quantity 0 is labelled Sold out, with no cart button', out?.status === 'Sold out' && !out.cart);
  await clickAt(await rectOf(`${DIR}.querySelector('.icard[data-id="it-amber-lamp"] .cartbtn')`));
  const atc = await lastMsg('add-to-cart');
  check('Add to cart sends add-to-cart {itemId}', atc?.itemId === 'it-amber-lamp' && (await evaluate(`${DIR}.querySelector('.icard[data-id="it-amber-lamp"] .cartbtn').disabled`)));
  await post('cart-result', { itemId: 'it-amber-lamp', ok: true });
  check('cart-result ok shows Added', /Added/.test(await evaluate(`${DIR}.querySelector('.icard[data-id="it-amber-lamp"] .cartbtn').textContent`)));
  await clickAt(await rectOf(`${DIR}.querySelector('.icard[data-id="it-cameo"] .cartbtn')`));
  await post('cart-result', { itemId: 'it-cameo', ok: false, message: 'Someone just bought this one.' });
  check('cart-result failure shows the page message and resets the button', (await evaluate(`${DIR}.querySelector('.dtoast').textContent`)) === 'Someone just bought this one.' && /Add to cart/.test(await evaluate(`${DIR}.querySelector('.icard[data-id="it-cameo"] .cartbtn').textContent`)));
  await clickAt(await rectOf(`${DIR}.querySelector('.icard[data-id="it-teacup-gold"] .heart')`));
  const tf = await lastMsg('toggle-favourite');
  check('an item remove heart sends toggle-favourite {itemId, on:false} and drops it', tf?.itemId === 'it-teacup-gold' && tf.on === false && (await evaluate(`${DIR}.querySelectorAll('#p-col .icard').length`)) === 4);
  await clickAt(await rectOf(`${DIR}.querySelector('.mcard[data-id="bt-lamplight"] .primary')`));
  check('a saved booth Visit sends open-booth {slug}', (await lastMsg('open-booth'))?.slug === 'lamplight-lane');
  await clickAt(await rectOf(`${DIR}.querySelector('.mcard[data-id="bt-teacup"] .heart')`));
  const tfb2 = await lastMsg('toggle-favourite-booth');
  check('a saved booth remove heart sends toggle-favourite-booth {boothId, on:false}', tfb2?.boothId === 'bt-teacup' && tfb2.on === false && (await evaluate(`${DIR}.querySelectorAll('#p-col .mcard').length`)) === 1);

  // =========================================================== 5. FAQ
  console.log('\n-- faq');
  await harness('faq.html', 1000, 860);
  const FQ = `${FRAME}.contentDocument.querySelector('attic-faq').shadowRoot`;
  check('the FAQ says ready (mode faq)', (await waitMsg('ready')) && (await lastMsg('ready'))?.mode === 'faq');
  await waitFor(`${FQ}.querySelectorAll('details.qa').length > 0`);
  const nq = await evaluate(`${FQ}.querySelectorAll('details.qa').length`);
  check('the accordion has 8-14 questions', nq >= 8 && nq <= 14, `${nq}`);
  await post('load-faq', { businessEmail: 'hello@example.com' });
  const line1 = await evaluate(`${FQ}.querySelector('.emailline').textContent.trim()`);
  check('load-faq with an address shows "Email us at <address>"', line1 === 'Email us at hello@example.com' && (await evaluate(`${FQ}.querySelector('.emailline a').getAttribute('href')`)) === 'mailto:hello@example.com', line1);
  await post('load-faq', { businessEmail: null });
  const line2 = await evaluate(`${FQ}.querySelector('.emailline').textContent.trim()`);
  check('load-faq without one says the address is coming soon', line2 === 'Our email address is coming soon - use the form below.', line2);
  await clickAt(await rectOf(`${FQ}.querySelector('details.qa summary')`));
  check('clicking a question opens its answer', (await evaluate(`${FQ}.querySelector('details.qa').open`)) && (await evaluate(`${FQ}.querySelector('details.qa .ans').getBoundingClientRect().height`)) > 10);
  await clickAt(await rectOf(`${FQ}.querySelector('details.qa summary')`));
  check('clicking it again closes it', !(await evaluate(`${FQ}.querySelector('details.qa').open`)));
  const fill = async (name, email, message) => {
    for (const [n, v] of [['name', name], ['email', email], ['message', message]]) {
      await clickAt(await rectOf(`${FQ}.querySelector('.cform [name="${n}"]')`));
      await evaluate(`${FQ}.querySelector('.cform [name="${n}"]').value = ''`);
      await typeText(v);
    }
  };
  await fill('Pat Shopper', 'not-an-email', 'Hello there');
  await clickAt(await rectOf(`${FQ}.querySelector('.cform .send')`));
  check('an invalid email is not sent', (await msgs('contact-send')).length === 0);
  await fill('Pat Shopper', 'pat@example.com', 'Do you ship to Alaska?');
  await clickAt(await rectOf(`${FQ}.querySelector('.cform .send')`));
  const cs = await lastMsg('contact-send');
  check('Send posts contact-send {requestId, name, email, message}', cs && cs.requestId && cs.name === 'Pat Shopper' && cs.email === 'pat@example.com' && cs.message === 'Do you ship to Alaska?', JSON.stringify(cs));
  await post('contact-result', { requestId: 'someone-else', ok: true });
  check('a contact-result for another request is ignored', (await evaluate(`${FQ}.querySelector('.csent').hidden`)) === true);
  await post('contact-result', { requestId: cs.requestId, ok: true, message: 'Thanks, we got it.' });
  check('contact-result ok shows the thank-you', (await evaluate(`!${FQ}.querySelector('.csent').hidden && ${FQ}.querySelector('.cform').hidden`)) && (await evaluate(`${FQ}.querySelector('.csent').textContent`)) === 'Thanks, we got it.');
  await clickAt(await rectOf(`${FQ}.querySelector('.again')`));
  await fill('Pat Shopper', 'pat@example.com', 'Second question');
  await clickAt(await rectOf(`${FQ}.querySelector('.cform .send')`));
  const cs2 = await lastMsg('contact-send');
  await post('contact-result', { requestId: cs2.requestId, ok: false, message: 'Our mail is down, try later.' });
  check('contact-result failure keeps the message and shows the error', (await evaluate(`${FQ}.querySelector('.cerr').textContent`)) === 'Our mail is down, try later.' && (await evaluate(`${FQ}.querySelector('.cform [name="message"]').value`)) === 'Second question');

  // =========================================================== 6. Sizing, magnifier, collectibles boxes, listing rules
  console.log('\n-- sizing, magnifier, collectibles boxes');
  const text = (sel) => evaluate(`${ED}.querySelector(${JSON.stringify(sel)})?.textContent ?? null`);
  const count = (sel) => evaluate(`${ED}.querySelectorAll(${JSON.stringify(sel)}).length`);
  await viewport(1440, 1000);
  const demoBase = JSON.parse(readFileSync(join(root, 'data/demo-booth.json'), 'utf8'));
  const testBooth = { ...demoBase, items: [...demoBase.items, ...TEST_ITEMS], boxes: [] };
  await navigate(`${origin}/editor.html?coach=0&tab=items`, `!!document.querySelector('attic-editor')?.shadowRoot?.querySelector('.room.edit .item')`);
  await evaluate(`(async () => {
    window.__ev = []; document.addEventListener('attic-booth:event', (e) => window.__ev.push(JSON.parse(JSON.stringify(e.detail))));
    const el = document.querySelector('attic-editor');
    await el.loadEditor({ booth: ${JSON.stringify(testBooth)}, library: await (await fetch('data/library.json')).json(), meta: { boothStatus: 'live' } });
    el.debugSetup({ coach: false, tab: 'items' });
    return true;
  })()`);
  const inches = (sel) => evaluate(`(() => { const room = ${ED}.querySelector('.room.edit').getBoundingClientRect(); const r = ${ED}.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { h: r.height / room.width * 120, w: r.width / room.width * 120, inside: r.top >= room.top - 1 && r.bottom <= room.bottom + 1 && r.left >= room.left - 1 && r.right <= room.right + 1 }; })()`);
  const ARM = '.room.edit .item[data-id="it-armoire"]';
  await clickAt(await rectOf(`${ED}.querySelector('[data-act="place"][data-id="it-armoire"]')`));
  const arm = await inches(ARM);
  check('an 80 in armoire is drawn 80 in tall on the 120 in booth (the wall is 90 in)', Math.abs(arm.h - 80) < 0.8 && Math.abs(arm.w - 44) < 0.8 && arm.inside, `${arm.h.toFixed(1)} x ${arm.w.toFixed(1)} in`);
  await clipShot('armoire-editor.png', await rectOf(`${ED}.querySelector('.room.edit')`), 8);
  const SL = `${ED}.querySelector('.selbar input[data-act="sel-scale"]')`;
  const sl0 = await evaluate(`(() => { const s = ${SL}; return s ? { min: +s.min, max: +s.max, v: +s.value, off: s.disabled } : null; })()`);
  check('the selected armoire has a size slider from 80 to 120 %', sl0 && sl0.min === 80 && sl0.max === 120 && sl0.v === 100 && !sl0.off, JSON.stringify(sl0));
  await evaluate(`${SL}.focus()`);
  for (let i = 0; i < 10; i++) await key('ArrowLeft');
  await sleep(250);
  const small = await inches(ARM);
  check('the slider shrinks it (90 % = 72 in)', Math.abs(small.h - 72) < 0.8 && (await evaluate(`+${SL}.value`)) === 90, `${small.h.toFixed(1)} in`);
  for (let i = 0; i < 20; i++) await key('ArrowRight');
  await sleep(250);
  const big = await inches(ARM);
  const bigPct = await evaluate(`+${SL}.value`);
  check('...and grows it again (to 110 %, or as far as it fits), without snapping back', big.h > small.h + 5 && Math.abs(big.h - 0.8 * bigPct) < 0.8, `${big.h.toFixed(1)} in at ${bigPct} %`);
  await evaluate(`${ED}.querySelector('.room.edit').focus()`);
  const armL0 = (await rectOf(`${ED}.querySelector(${JSON.stringify(ARM)})`)).l;
  await key('ArrowRight');
  await key('ArrowRight');
  await sleep(250);
  const moved = await inches(ARM);
  const armL1 = (await rectOf(`${ED}.querySelector(${JSON.stringify(ARM)})`)).l;
  check('moving it keeps the new size (no reset)', Math.abs(moved.h - big.h) < 0.1 && (await evaluate(`+${SL}.value`)) === bigPct, `moved ${Math.round(armL1 - armL0)} px, ${moved.h.toFixed(1)} in`);
  await sleep(2300);
  const draftNow = async () => (await evaluate(`window.__ev.filter((m) => m.type === 'save-draft').at(-1)?.draft ?? null`)) ?? {};
  check('the saved draft keeps the size', Math.abs(((await draftNow()).placements?.['it-armoire']?.scaleAdj ?? 0) - bigPct / 100) < 0.011);
  await evaluate(`${SL}.focus()`);
  await key('End');
  await sleep(300);
  const maxed = await inches(ARM);
  const hit = await evaluate(`(() => { const R = ${ED}; const r = R.querySelector(${JSON.stringify(ARM)}).getBoundingClientRect(); const el = R.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el?.closest('[data-kind]')?.dataset.id ?? null; })()`);
  check('at its largest it stays inside the room and on top: the point at its centre is the armoire', maxed.inside && hit === 'it-armoire' && maxed.h <= 96.01, `${maxed.h.toFixed(1)} in, hit ${hit}`);
  await clickAt(await rectOf(`${ED}.querySelector('[data-act="sel-done"]')`));
  const spot = await evaluate(`(() => { const R = ${ED}; const r = R.querySelector(${JSON.stringify(ARM)}).getBoundingClientRect(); for (let fy = 0.2; fy < 0.95; fy += 0.1) for (let fx = 0.2; fx < 0.85; fx += 0.15) { const x = r.left + r.width * fx; const y = r.top + r.height * fy; if (R.elementFromPoint(x, y)?.closest('[data-kind]')?.dataset.id === 'it-armoire') return { x, y }; } return null; })()`);
  if (spot) await clickAt(spot);
  check('after Done it can still be clicked and selected', !!spot && (await text('.selbar .selname b')) === 'Walnut armoire');
  await clickAt(await rectOf(`${ED}.querySelector('[data-act="sel-done"]')`));
  await clickAt(await rectOf(`${ED}.querySelector('.tab[data-tab="items"]')`));
  await clickAt(await rectOf(`${ED}.querySelector('[data-act="show-item"][data-id="it-armoire"]')`));
  check('"Show me" in My Items selects it from the list too', (await text('.selbar .selname b')) === 'Walnut armoire');
  // a 2 in thimble: drawn at the 4 in minimum, with the magnifier on hover
  await clickAt(await rectOf(`${ED}.querySelector('[data-act="place"][data-id="it-thimble"]')`));
  const th = await inches('.room.edit .item[data-id="it-thimble"]');
  check('a 2 in thimble is drawn at the 4 in minimum', Math.abs(th.h - 4) < 0.15, `${th.h.toFixed(2)} in tall`);
  await clickAt(await rectOf(`${ED}.querySelector('[data-act="sel-done"]')`));
  await hover(await rectOf(`${ED}.querySelector('.room.edit .item[data-id="it-thimble"]')`));
  const lensEd = await evaluate(`(() => { const l = ${ED}.querySelector('.lens'); if (!l || l.hidden) return null; const i = l.querySelector('img').getBoundingClientRect(); return { h: i.height, cap: l.querySelector('.cap')?.textContent }; })()`);
  check('hovering it in the editor shows the magnifier', lensEd && lensEd.h >= 120 && /Brass thimble/.test(lensEd.cap ?? ''), JSON.stringify(lensEd));
  // a collectibles box: place it, fill a compartment
  await clickAt(await rectOf(`${ED}.querySelector('.tab[data-tab="fixtures"]')`));
  await clickAt(await rectOf(`${ED}.querySelector('.srccard[data-src-kind="box"][data-src-id="jewelry"]')`));
  check('clicking the jewelry box card places a box and selects it', (await count('.room.edit .box')) === 1 && (await text('.selbar .selname b')) === 'Jewelry box');
  await clickAt(await rectOf(`${ED}.querySelector('[data-act="box-fill"]')`));
  check('"Fill the compartments" opens the box sheet', (await count('.boxhost .bxcell')) === 9);
  await clickAt(await rectOf(`${ED}.querySelector('.boxhost [data-bx-slot="4"]')`));
  await clickAt(await rectOf(`${ED}.querySelector('.boxhost [data-bx-item="it-thimble2"]')`));
  check('picking an item puts it in the chosen compartment', !!(await evaluate(`!!${ED}.querySelector('.boxhost [data-bx-slot="4"] img')`)));
  await clickAt(await rectOf(`${ED}.querySelector('.boxhost .lining[data-bx-lining="blue"]')`));
  await clickAt(await rectOf(`${ED}.querySelector('.boxhost .sheetbtns [data-bx="close"]')`));
  await sleep(2300);
  const bd = await draftNow();
  const bx = bd.boxes?.[0];
  check('the draft saves the box: {id, style, lining, cols, rows, placement, slots}', bd.boxes?.length === 1 && JSON.stringify(Object.keys(bx).sort()) === JSON.stringify(['cols', 'id', 'lining', 'placement', 'rows', 'slots', 'style']) && bx.style === 'jewelry' && bx.lining === 'blue' && bx.slots.length === 9 && bx.slots[4] === 'it-thimble2' && bd.placements['it-thimble2'] === null, JSON.stringify(bx));
  check('the box draws its item in the room', (await count('.room.edit .box .cell img')) === 1);
  shopBooth = applyDraft(testBooth, bd);
  // the shop view: open the box up close, then the item's card; the magnifier on the thimble
  await harness('embed.html', 1240, 900);
  const BVS = `${FRAME}.contentDocument.querySelector('attic-booth').shadowRoot`;
  await waitMsg('ready');
  await post('load-booth', { booth: shopBooth });
  await waitFor(`!!${BVS}.querySelector('.room .box')`);
  check('the shop view draws the box', (await evaluate(`${BVS}.querySelectorAll('.room .box .cell').length`)) === 9);
  await clipShot('armoire-shop.png', await rectOf(`${BVS}.querySelector('.room')`), 4);
  await clickAt(await rectOf(`${BVS}.querySelector('.room .box')`));
  const bvOpen = await evaluate(`(() => { const v = ${BVS}.querySelector('.boxview'); return v && !v.hidden ? { cells: v.querySelectorAll('.bvcell').length, items: v.querySelectorAll('.bvcell[data-id]').length, title: v.querySelector('h3')?.textContent } : null; })()`);
  check('clicking the box opens it up close', bvOpen && bvOpen.cells === 9 && bvOpen.items === 1 && bvOpen.title === 'Jewelry box', JSON.stringify(bvOpen));
  await sleep(300);
  await clipShot('box-closeup.png', await rectOf(`${BVS}.querySelector('.boxview')`), 30);
  await clickAt(await rectOf(`${BVS}.querySelector('.bvcell[data-id="it-thimble2"]')`));
  check('an item in the box opens its normal card', (await evaluate(`(() => { const c = ${BVS}.querySelector('.card'); return !c.hidden && c.querySelector('#card-title')?.textContent; })()`)) === 'Silver thimble' && (await lastMsg('item-open'))?.itemId === 'it-thimble2');
  await key('Escape');
  await key('Escape');
  check('Escape closes the card, then the box', (await evaluate(`${BVS}.querySelector('.card').hidden && ${BVS}.querySelector('.boxview').hidden`)) === true);
  const tRect = await rectOf(`${BVS}.querySelector('.room .item[data-id="it-thimble"]')`);
  await hover(tRect);
  const lensShop = await evaluate(`(() => { const l = ${BVS}.querySelector('.lens'); if (!l || l.hidden) return null; const r = l.getBoundingClientRect(); const i = l.querySelector('img').getBoundingClientRect(); return { h: i.height, l: r.left, t: r.top, w: r.width, hh: r.height }; })()`);
  check('hovering a 4 in item in the shop shows the magnifier', lensShop && lensShop.h >= 120, JSON.stringify(lensShop));
  if (lensShop) {
    const fr = await evaluate(`(() => { const r = ${FRAME}.getBoundingClientRect(); return { x: r.left, y: r.top }; })()`);
    const lx = Math.min(lensShop.l + fr.x, tRect.l);
    const ly = Math.min(lensShop.t + fr.y, tRect.t);
    await clipShot('magnifier.png', { l: lx, t: ly, w: Math.max(lensShop.l + fr.x + lensShop.w, tRect.l + tRect.w) - lx, h: Math.max(lensShop.t + fr.y + lensShop.hh, tRect.t + tRect.h) - ly }, 40);
  }
  // listing rules in the add/edit sheet: a very light weight needs the tick before it goes
  await navigate(`${origin}/editor.html?coach=0&tab=items`, `!!document.querySelector('attic-editor')?.shadowRoot?.querySelector('[data-act="edit-item"][data-id="it-mug-brown"]')`);
  await clickAt(await rectOf(`${ED}.querySelector('[data-act="edit-item"][data-id="it-mug-brown"]')`));
  if (await waitFor(`!!${ED}.querySelector('.agreebox h3')`, 5000)) {
    await evaluate(`${ED}.querySelector('[data-agree="check"]').click()`);
    await clickAt(await rectOf(`${ED}.querySelector('[data-sheet="agree"]')`));
  }
  await waitFor(`!!${ED}.querySelector('.itemform')`, 5000);
  const setField = (n, v) => evaluate(`(() => { const el = ${ED}.querySelector('.itemform [name="${n}"]'); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  // The demo mug's old free-text category, era and condition aren't list values: pick real ones first.
  const validRest = () => evaluate(`(() => { const f = ${ED}.querySelector('.itemform'); f.querySelector('[name="category"]').value = 'kitchen-barware'; f.querySelector('[name="era"]').value = '1950s'; f.querySelector('[name="condition"][value="good"]').checked = true; return true; })()`);
  await validRest();
  for (const [n, v] of [['heightIn', '10'], ['widthIn', '8'], ['depthIn', '8'], ['weightLb', '0'], ['weightOz', '1']]) await setField(n, v);
  await clickAt(await rectOf(`${ED}.querySelector('.itemform [type="submit"]')`));
  const warn = await evaluate(`(() => { const w = ${ED}.querySelector('.weightwarn'); return w ? { text: w.querySelector('.note').textContent, tick: !!w.querySelector('[name="lightWeightOk"]') } : null; })()`);
  check('a very light weight (1 oz for 10 x 8 x 8 in) asks for a tick before sending', warn && warn.tick && /very light for its size/.test(warn.text) && !!(await evaluate(`!!${ED}.querySelector('.itemform')`)) && (await evaluate(`${ED}.querySelectorAll('.itemform .ferr').length`)) === 0, JSON.stringify(warn));
  await clickAt(await rectOf(`${ED}.querySelector('.weightwarn [name="lightWeightOk"]')`));
  await clickAt(await rectOf(`${ED}.querySelector('.itemform [type="submit"]')`));
  check('...and goes once the tick is set', await waitFor(`!${ED}.querySelector('.sheethost .sheet')`, 6000));
  await clickAt(await rectOf(`${ED}.querySelector('[data-act="edit-item"][data-id="it-mug-brown"]')`));
  await waitFor(`!!${ED}.querySelector('.itemform')`, 5000);
  await validRest();
  await setField('weightLb', '70');
  await clickAt(await rectOf(`${ED}.querySelector('.itemform [type="submit"]')`));
  const errs = await evaluate(`[...${ED}.querySelectorAll('.itemform .ferr')].map((e) => e.textContent)`);
  check('over 65 lb is refused with the USPS message', errs.length === 1 && /USPS takes up to 70 lb including packing/.test(errs[0]), errs.join(' | '));
  const btns = await evaluate(`[...${ED}.querySelectorAll('.sheet button.primary, .sheet button.wb2')].map((b) => b.textContent.trim())`);
  check('the sheet buttons say what they do (no bare "Send" / "Looks good")', !btns.some((t) => /^(Send|Looks good)$/.test(t)) && btns.some((t) => /approval|price and quantity/.test(t)), btns.join(' | '));

  // =========================================================== 7. Phones: no sideways scroll, 40 px tap targets
  console.log('\n-- phone widths');
  const pages = [
    { name: 'directory', url: 'directory.html', ready: `${'document.querySelector("attic-directory")?.shadowRoot?.querySelectorAll(".bcard").length > 0'}` },
    { name: 'collection', url: 'directory.html?tab=collection', ready: 'document.querySelector("attic-directory")?.shadowRoot?.querySelectorAll(".icard").length > 0' },
    { name: 'collection (logged out)', url: 'directory.html?tab=collection&loggedIn=0', ready: '!!document.querySelector("attic-directory")?.shadowRoot?.querySelector("#p-col .login")' },
    { name: 'faq', url: 'faq.html#q-prohibited', ready: 'document.querySelector("attic-faq")?.shadowRoot?.querySelectorAll("details.qa").length > 0' },
    { name: 'booth view', url: 'embed.html', ready: '!!document.querySelector("attic-booth")?.shadowRoot?.querySelector(".room .item")' },
    { name: 'booth view + item card', url: 'embed.html', ready: '!!document.querySelector("attic-booth")?.shadowRoot?.querySelector(".room .item")', after: `document.querySelector('attic-booth').openItem('it-amber-lamp'); true` },
    { name: 'booth view + box close-up', url: 'embed.html', ready: '!!document.querySelector("attic-booth")?.shadowRoot?.querySelector(".room .item")', after: `(async () => { const el = document.querySelector('attic-booth'); el.load(${JSON.stringify(shopBooth)}, await (await fetch('data/library.json')).json()); await new Promise((r) => setTimeout(r, 300)); el.shadowRoot.querySelector('.room .box').click(); return true; })()`, wait: '!document.querySelector("attic-booth").shadowRoot.querySelector(".boxview").hidden' },
    { name: 'editor', url: 'editor.html?coach=0', ready: '!!document.querySelector("attic-editor")?.shadowRoot?.querySelector(".narrowmode .room")' },
    { name: 'editor add-item sheet', url: 'editor.html?coach=0', ready: '!!document.querySelector("attic-editor")?.shadowRoot?.querySelector(".narrowmode .room")', after: `document.querySelector('attic-editor').shadowRoot.querySelector('[data-act="add-item"]').click(); true`, wait: '!!document.querySelector("attic-editor").shadowRoot.querySelector(".agreebox")' },
  ];
  for (const w of [320, 375, 414]) {
    const bad = [];
    for (const p of pages) {
      await viewport(w, 800, true, 1);
      await navigate(`${origin}/${p.url}`, p.ready);
      if (p.after) await evaluate(p.after);
      if (p.wait) await waitFor(p.wait, 5000);
      await sleep(250);
      const s = await noSideScroll();
      if (!s.ok) bad.push(`${p.name} ${s.sw}px`);
      if (w === 375) {
        const small = await smallTargets();
        check(`${p.name} at 375 px: tap targets are at least 40 px`, small.length === 0, small.slice(0, 6).join('; '));
      }
    }
    check(`no horizontal scrolling at ${w} px (${pages.length} views)`, bad.length === 0, bad.join(', '));
  }

  // =========================================================== 8. Screenshots
  console.log('\n-- screenshots');
  const dirReady = 'document.querySelector("attic-directory")?.shadowRoot?.querySelectorAll(".bcard").length > 0';
  const colReady = 'document.querySelector("attic-directory")?.shadowRoot?.querySelectorAll(".icard").length > 0';
  const faqReady = 'document.querySelector("attic-faq")?.shadowRoot?.querySelectorAll("details.qa").length > 0';
  const boothReady = '!!document.querySelector("attic-booth")?.shadowRoot?.querySelector(".lamps .glow .core")';
  const openFaq = () => evaluate(`(() => { const r = document.querySelector('attic-faq').shadowRoot; ['q-shipping', 'q-collectibles-box'].forEach((id) => { r.getElementById(id).open = true; }); window.scrollTo(0, 0); return true; })()`);
  for (const [name, opts] of [
    ['directory-desktop.png', { width: 1280, height: 900, url: `${origin}/directory.html`, ready: dirReady }],
    ['directory-375.png', { width: 375, height: 812, mobile: true, scale: 2, url: `${origin}/directory.html`, ready: dirReady }],
    ['collection-desktop.png', { width: 1280, height: 900, url: `${origin}/directory.html?tab=collection`, ready: colReady }],
    ['collection-375.png', { width: 375, height: 812, mobile: true, scale: 2, url: `${origin}/directory.html?tab=collection`, ready: colReady }],
    ['faq-desktop.png', { width: 1280, height: 900, url: `${origin}/faq.html`, ready: faqReady, before: openFaq }],
    ['faq-375.png', { width: 375, height: 812, mobile: true, scale: 2, url: `${origin}/faq.html`, ready: faqReady, before: openFaq }],
    ['booth-lamp-desktop.png', { width: 1280, height: 900, url: `${origin}/embed.html`, ready: boothReady }],
    ['booth-lamp-375.png', { width: 375, height: 812, mobile: true, scale: 2, url: `${origin}/embed.html`, ready: boothReady }],
  ]) {
    shotsSaved.push(await shot(name, opts));
  }
  check('the screenshots are saved (4 sizing/box shots + 8 page shots)', shotsSaved.length === 12, `${shotsSaved.length}`);

  // =========================================================== 9. Firefox vs Chrome
  console.log('\n-- firefox vs chrome');
  let ff = null;
  try {
    ff = await launchFirefox({ port: 9347 });
  } catch (e) {
    console.log(`  ${e.message}`);
  }
  check('Firefox starts (WebDriver BiDi)', !!ff);
  if (ff) {
    const views = [
      { name: 'directory', url: 'directory.html', ready: 'document.querySelector("attic-directory")?.shadowRoot?.querySelectorAll(".bcard").length > 0', count: 'document.querySelector("attic-directory").shadowRoot.querySelectorAll(".bcard").length' },
      { name: 'booth', url: 'embed.html', ready: '!!document.querySelector("attic-booth")?.shadowRoot?.querySelector(".lamps .glow .core")', count: 'document.querySelector("attic-booth").shadowRoot.querySelectorAll(".room .item").length' },
      { name: 'editor', url: 'editor.html?coach=0', ready: '!!document.querySelector("attic-editor")?.shadowRoot?.querySelector(".room.edit .item")', count: 'document.querySelector("attic-editor").shadowRoot.querySelectorAll(".room.edit [data-kind]").length' },
    ];
    for (const v of views) {
      await shot(`compare-chrome-${v.name}.png`, { width: 1280, height: 900, url: `${origin}/${v.url}`, ready: v.ready });
      const chromeN = await evaluate(v.count);
      await ff.viewport(1280, 900);
      await ff.navigate(`${origin}/${v.url}`);
      const ok = await ff.waitFor(v.ready, 15000);
      await sleep(1200);
      const ffN = ok ? await ff.evaluate(v.count) : -1;
      const side = await ff.evaluate('document.scrollingElement.scrollWidth <= innerWidth');
      const file = join(shotsDir, `compare-firefox-${v.name}.png`);
      writeFileSync(file, await ff.screenshot());
      console.log(`saved ${file}`);
      shotsSaved.push(file);
      check(`Firefox draws the ${v.name} like Chrome (${chromeN} pieces), with no sideways scroll`, ok && ffN === chromeN && side, `firefox ${ffN}`);
    }
    // The embedded handshake: Firefox has no location.ancestorOrigins, and Wix may withhold the referrer.
    const demoNow = JSON.parse(readFileSync(join(root, 'data/demo-booth.json'), 'utf8'));
    const embeds = [
      { name: 'embed', page: 'embed.html', reply: { type: 'load-booth', booth: demoNow }, loaded: `!!document.querySelector('iframe').contentDocument.querySelector('attic-booth')?.shadowRoot?.querySelector('.room .item')` },
      { name: 'directory', page: 'directory.html', reply: { type: 'load-directory', booths: sample.booths, loggedIn: true, favourites: sample.favourites, categories: sample.categories }, loaded: `document.querySelector('iframe').contentDocument.querySelector('attic-directory')?.shadowRoot?.querySelectorAll('.bcard').length > 0` },
      { name: 'editor', page: 'editor.html', reply: { type: 'load-editor', booth: demoNow, meta: { boothStatus: 'live', isFirstVisit: false } }, loaded: `!!document.querySelector('iframe').contentDocument.querySelector('attic-editor')?.shadowRoot?.querySelector('.room.edit .item')` },
    ];
    await ff.viewport(1240, 860);
    for (const e of embeds) {
      await ff.navigate(`${origin}/__harness`);
      await ff.evaluate(`(() => {
        document.documentElement.innerHTML = '<head><style>body{margin:0;background:#633761;font:15px Georgia;color:#fee6c4} p{margin:6px 10px}</style></head><body><p>Harness = the Wix page. Embed in an iframe without a referrer; the page sends its data when the embed says ready.</p></body>';
        window.__m = [];
        const f = document.createElement('iframe'); f.referrerPolicy = 'no-referrer'; f.src = '/${e.page}'; f.style.cssText = 'display:block;border:0;width:1220px;height:800px;margin:0 10px'; document.body.append(f);
        addEventListener('message', (m) => { if (!m.data || m.data.source !== 'attic-booth') return; __m.push(m.data.type); if (m.data.type === 'ready') f.contentWindow.postMessage(Object.assign({ target: 'attic-booth', version: 1 }, ${JSON.stringify(e.reply)}), location.origin); });
        return true; })()`);
      const loaded = await ff.waitFor(e.loaded, 12000);
      await sleep(1200);
      const file = join(shotsDir, `firefox-after-${e.name}.png`);
      writeFileSync(file, await ff.screenshot());
      console.log(`saved ${file}`);
      shotsSaved.push(file);
      check(`Firefox, embedded without a referrer: the ${e.name} says ready and loads`, loaded && (await ff.evaluate('window.__m.includes("ready")')));
    }
    check('no JavaScript errors in Firefox', ff.errors.length === 0, ff.errors.slice(0, 3).join(' | '));
    await ff.close();
  }
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
