import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fitAnswerHeight, MIN_PANEL_PX, SLACK_PX } from '../src/logic/faqfit.js';

// Measured 2026-11-18 with scripts/pages-smoke.mjs on faq.html: the closed list is about 1074 px tall at 375 px wide,
// and the longest answer (q-prohibited) brings the page to 2271 px, so that answer is about 1200 px tall.
const CLOSED = 1074;
const LONG = 1197;

describe('fitAnswerHeight', () => {
  it('leaves an answer alone when everything already fits in the frame', () => {
    expect(fitAnswerHeight({ frameH: 2400, contentH: CLOSED + LONG, answerH: LONG })).toBeNull();
    expect(fitAnswerHeight({ frameH: 1500, contentH: CLOSED + 200, answerH: 200 })).toBeNull();
  });
  it('caps an answer that would run past the bottom edge, so the whole page ends inside the frame', () => {
    const cap = fitAnswerHeight({ frameH: 1600, contentH: CLOSED + LONG, answerH: LONG });
    expect(cap).toBe(1600 - CLOSED - SLACK_PX);
    expect(CLOSED + cap).toBeLessThanOrEqual(1600);
  });
  it('the cap follows the frame: a taller frame gives the answer more room', () => {
    const at = (frameH) => fitAnswerHeight({ frameH, contentH: CLOSED + LONG, answerH: LONG });
    expect(at(1400)).toBeLessThan(at(1600));
    expect(at(1600)).toBeLessThan(at(2000));
  });
  it('never squeezes an answer below the minimum, even in a tiny frame (the frame scrolls instead)', () => {
    expect(fitAnswerHeight({ frameH: 700, contentH: CLOSED + LONG, answerH: LONG })).toBe(MIN_PANEL_PX);
    expect(fitAnswerHeight({ frameH: 1000, contentH: CLOSED + LONG, answerH: LONG })).toBe(MIN_PANEL_PX);
  });
  it('a short answer is never capped to something taller than itself', () => {
    expect(fitAnswerHeight({ frameH: 1000, contentH: CLOSED + 150, answerH: 150 })).toBeNull();
  });
  it('does nothing without usable measurements (not laid out yet)', () => {
    expect(fitAnswerHeight({ frameH: 0, contentH: 100, answerH: 50 })).toBeNull();
    expect(fitAnswerHeight({ frameH: 800, contentH: NaN, answerH: 50 })).toBeNull();
    expect(fitAnswerHeight({ frameH: 800, contentH: 100, answerH: 0 })).toBeNull();
  });
});

describe('attic-faq height handling (source checks; the real browser checks are in scripts/pages-smoke.mjs)', () => {
  const src = readFileSync(new URL('../src/attic-faq.js', import.meta.url), 'utf8');
  it('keeps one answer open at a time and refits on toggle, resize and font load', () => {
    expect(src).toMatch(/details\.qa\[open\]/);
    expect(src).toMatch(/addEventListener\('toggle'/);
    expect(src).toMatch(/addEventListener\('resize'/);
    expect(src).toMatch(/fonts\?\.ready/);
  });
  it('sends no new message type to the Wix page, so the live page code is unaffected', () => {
    const emitted = [...src.matchAll(/emit\('([a-z-]+)'/g)].map((m) => m[1]);
    expect(emitted).toEqual(['ready']);
  });
});
