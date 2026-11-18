import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const faq = JSON.parse(readFileSync(new URL('../data/faq.json', import.meta.url), 'utf8'));
const agreement = JSON.parse(readFileSync(new URL('../data/agreement.json', import.meta.url), 'utf8'));
const all = faq.groups.flatMap((g) => g.items);
const text = JSON.stringify(faq.groups);

describe('faq.json', () => {
  it('has 8 to 14 questions for shoppers and sellers', () => {
    expect(all.length).toBeGreaterThanOrEqual(8);
    expect(all.length).toBeLessThanOrEqual(14);
    expect(faq.groups.map((g) => g.id)).toEqual(['shopping', 'selling']);
    for (const g of faq.groups) expect(g.items.length).toBeGreaterThan(0);
  });
  it('every question has an id, a question, an answer and a source', () => {
    const ids = new Set();
    for (const q of all) {
      expect(q.id).toMatch(/^[a-z0-9-]+$/);
      expect(ids.has(q.id)).toBe(false);
      ids.add(q.id);
      expect(q.q.trim().endsWith('?')).toBe(true);
      expect(q.a.length).toBeGreaterThan(0);
      expect(q.a.every((p) => typeof p === 'string' && p.trim().length > 0)).toBe(true);
      expect(q.source).toBeTruthy();
    }
  });
  it('writes the brand as one word', () => {
    expect(text).not.toMatch(/Ginger'?s Attic/);
    expect(text).toMatch(/GingersAttic/);
  });
  it('lists exactly the prohibited items in agreement.json', () => {
    const q = all.find((x) => x.id === 'prohibited');
    expect(q.list).toEqual(agreement.prohibited);
    expect(q.a[0]).toBe(agreement.prohibitedIntro);
  });
  it('states the settled shipping and sales facts', () => {
    expect(text).toMatch(/USPS calculates shipping at checkout/);
    expect(text).toMatch(/Ground Advantage, Priority Mail and Priority Mail Express/);
    expect(text).toMatch(/within the US only for now/);
    expect(text).toMatch(/within 3 business days/);
    expect(text).toMatch(/All sales are final/);
    expect(text).toMatch(/approves every item before it goes on sale/);
    expect(text).toMatch(/member account can open one booth/);
    expect(text).toMatch(/15% commission/);
  });
  it('has no local pickup any more: everything ships by USPS (2026-11-17 batch 2)', () => {
    expect(text.toLowerCase()).not.toMatch(/pickup|pick up|pick-up/);
    expect(text).toMatch(/Everything ships by USPS/);
    expect(JSON.stringify(agreement).toLowerCase()).not.toMatch(/pickup/);
  });
  it('defines a booth, explains asking about an item and the collectibles box, and allows disclosed hair items', () => {
    expect(all.map((q) => q.id)).toEqual(expect.arrayContaining(['what-is-a-booth', 'ask-about-an-item', 'collectibles-box']));
    expect(text).toMatch(/A booth is one seller's own space/);
    expect(text).toMatch(/goes to GingersAttic, which asks the seller/);
    expect(text).toMatch(/Victorian hair lockets and mourning jewelry, are allowed/);
    expect(text).toMatch(/2 × 2 to 4 × 4/);
  });
  it('the agreement keeps its version, says "immediately", and has the new clauses', () => {
    const a = JSON.stringify(agreement);
    expect(agreement.version).toBe('2026-11-17');
    expect(a).not.toMatch(/straight away/);
    expect(a).toMatch(/deal with each other only through GingersAttic/);
    expect(a).toMatch(/Why: it protects buyers and sellers/);
    expect(a).toMatch(/human hair.*allowed if they are antique or vintage and the listing says/);
    expect(a).toMatch(/Other human remains, such as teeth and bone, stay prohibited/);
    expect(a).toContain("GingersAttic ships within the United States only for now. When international sales open, buyers pay any customs duties and import taxes, and sellers must follow export rules; items that can't legally be exported to the buyer's country will not be sold there.");
  });
});
