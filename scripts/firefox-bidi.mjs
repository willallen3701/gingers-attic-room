// A tiny WebDriver BiDi client for headless Firefox (Firefox's remote protocol; it no longer speaks CDP).
// Node's built-in WebSocket; nothing installed. Used by pages-smoke.mjs for the Firefox vs Chrome comparison.
//   const ff = await launchFirefox();          // null when Firefox isn't installed
//   await ff.viewport(1280, 900); await ff.navigate(url); await ff.waitFor('expr'); await ff.evaluate('expr');
//   const png = await ff.screenshot();          // whole document, Buffer
//   ff.errors                                   // console errors and uncaught exceptions seen so far
//   await ff.close();
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FIREFOX = ['C:/Program Files/Mozilla Firefox/firefox.exe', 'C:/Program Files (x86)/Mozilla Firefox/firefox.exe'].find(existsSync);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchFirefox({ port = 9338, timeoutMs = 30000 } = {}) {
  if (!FIREFOX) return null;
  const profile = mkdtempSync(join(tmpdir(), 'attic-ff-'));
  // Quiet first run: no welcome pages, no telemetry upload, no update checks.
  writeFileSync(
    join(profile, 'user.js'),
    [
      'user_pref("browser.shell.checkDefaultBrowser", false);',
      'user_pref("browser.aboutwelcome.enabled", false);',
      'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
      'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
      'user_pref("app.update.disabledForTesting", true);',
      'user_pref("browser.startup.homepage_override.mstone", "ignore");',
    ].join('\n'),
  );
  const proc = spawn(FIREFOX, ['--headless', `--remote-debugging-port=${port}`, '-no-remote', '-profile', profile, 'about:blank'], { stdio: 'ignore' });
  let ws = null;
  for (let t = 0; t < timeoutMs && !ws; t += 250) {
    await sleep(250);
    try {
      ws = await new Promise((resolve, reject) => {
        const s = new WebSocket(`ws://127.0.0.1:${port}/session`);
        s.onopen = () => resolve(s);
        s.onerror = () => reject(new Error('not yet'));
      });
    } catch {
      ws = null;
    }
  }
  if (!ws) {
    proc.kill();
    throw new Error('Firefox did not open its WebDriver BiDi port');
  }
  let seq = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.type === 'error') p.reject(new Error(`${m.error}: ${m.message}`));
      else p.resolve(m.result);
    } else if (m.method === 'log.entryAdded') {
      const e = m.params;
      if (e.level === 'error') errors.push(`${e.type === 'javascript' ? 'exception' : 'console.error'}: ${String(e.text).slice(0, 300)}`);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send('session.new', { capabilities: {} });
  await send('session.subscribe', { events: ['log.entryAdded'] });
  const { contexts } = await send('browsingContext.getTree', {});
  const context = contexts[0].context;

  /** Evaluate in the page; the value comes back through JSON, so return plain data. */
  const evaluate = async (expr) => {
    const r = await send('script.evaluate', {
      expression: `(async () => JSON.stringify(await (${expr})))()`,
      target: { context },
      awaitPromise: true,
      resultOwnership: 'none',
    });
    if (r.type === 'exception') throw new Error(r.exceptionDetails?.text ?? 'evaluate failed');
    const v = r.result?.value;
    return v === undefined ? undefined : JSON.parse(v);
  };
  const waitFor = async (expr, ms = 10000) => {
    for (let t = 0; t < ms; t += 150) {
      if (await evaluate(expr).catch(() => false)) return true;
      await sleep(150);
    }
    return false;
  };
  return {
    errors,
    evaluate,
    waitFor,
    viewport: (width, height) => send('browsingContext.setViewport', { context, viewport: { width, height } }),
    navigate: (url) => send('browsingContext.navigate', { context, url, wait: 'complete' }),
    /** PNG of the whole document. */
    screenshot: async () => Buffer.from((await send('browsingContext.captureScreenshot', { context, origin: 'document' })).data, 'base64'),
    close: async () => {
      try {
        await send('session.end', {});
      } catch {
        /* closing anyway */
      }
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      proc.kill();
    },
  };
}
