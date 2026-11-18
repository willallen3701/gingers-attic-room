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
    expect(text).toMatch(/within the US only/);
    expect(text).toMatch(/within 3 business days/);
    expect(text).toMatch(/All sales are final/);
    expect(text).toMatch(/approves every item before it goes on sale/);
    expect(text).toMatch(/member account can open one booth/);
    expect(text).toMatch(/the seller arranges the pickup with you/);
    expect(text).toMatch(/15% commission/);
  });
});
