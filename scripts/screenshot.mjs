// Screenshots of the demo and the editor with the locally installed Chrome (headless). Nothing is installed.
// Usage: node scripts/screenshot.mjs [name-filter]   (starts its own static server on port 5179)
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'screenshots');
mkdirSync(outDir, { recursive: true });
const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!chrome) throw new Error('No Chrome/Edge found');

const port = 5179;
const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const shots = [
  { name: 'desktop.png', size: '1280,1250', q: '' },
  { name: 'desktop-card.png', size: '1280,1250', q: '?open=it-yellow-chair' },
  // Headless Chrome won't go below ~500 px wide, so phone shots render index.html in a 390 px iframe.
  { name: 'mobile-390.png', size: '600,860', q: '', page: 'phone.html' },
  { name: 'mobile-390-card.png', size: '600,860', q: '?open=it-amber-lamp', page: 'phone.html' },
  // Booth editor (Phase 2)
  { name: 'editor-wizard-step1.png', size: '1440,1000', page: 'editor.html', q: '?wizard=0' },
  { name: 'editor-fixture-drag.png', size: '1440,1000', page: 'editor.html', q: '?tab=fixtures&coach=0&drag=fixture:fx3:-12:6' },
  { name: 'editor-my-items.png', size: '1440,1000', page: 'editor.html', q: '?tab=items&coach=0&storage=it-mug-brown,it-cameo,it-goblet-brass&select=item:it-yellow-chair' },
  { name: 'editor-coach.png', size: '1440,1000', page: 'editor.html', q: '?tab=walls' },
  { name: 'editor-narrow.png', size: '700,1000', page: 'editor.html', q: '?coach=0' },
];
const filter = process.argv[2];
try {
  for (const s of shots) {
    if (filter && !s.name.includes(filter)) continue;
    const file = join(outDir, s.name);
    execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${join(outDir, '.chrome-profile')}`,
      `--window-size=${s.size}`, '--virtual-time-budget=5000', `--screenshot=${file}`,
      `http://localhost:${port}/${s.page ?? ''}${s.q}`,
    ], { stdio: 'ignore', timeout: 60000 });
    console.log('saved', file);
  }
} finally {
  server.kill();
}
