// Booth directory logic: search, category filter, sorting and shuffling, and item availability for the
// "My collection" tab. Pure: no DOM.
//
// A directory booth (from the page's load-directory):
//   { id, slug, boothNumber, name, about, signStyle, sellerName, itemCount, categories:[categoryId],
//     itemTitles:[string], previews:[url] (up to 4), updatedAt: ISO string }

export const SORTS = Object.freeze([
  { id: 'updated', label: 'Recently updated' },
  { id: 'number', label: 'Booth number' },
  { id: 'shuffle', label: 'Shuffle' },
]);

/** Lower-case, accents removed, runs of spaces and punctuation folded to one space. */
export function fold(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Search words: folded and split on spaces; empty query -> []. */
export const terms = (query) => fold(query).split(' ').filter(Boolean);

/**
 * Does the booth match every search word? Words are matched against the booth name, the seller's name,
 * the about text and the item titles (each word may match a different field).
 * @returns {{ok:boolean, titles:string[]}} titles = item titles that contain at least one of the words
 */
export function matchBooth(booth, query) {
  const words = terms(query);
  if (!words.length) return { ok: true, titles: [] };
  const titles = Array.isArray(booth.itemTitles) ? booth.itemTitles : [];
  const fields = [booth.name, booth.sellerName, booth.about, ...titles].map(fold);
  const hay = ` ${fields.join(' ')} `;
  const ok = words.every((w) => hay.includes(w));
  if (!ok) return { ok: false, titles: [] };
  const hit = titles.filter((t) => {
    const f = fold(t);
    return words.some((w) => f.includes(w));
  });
  return { ok: true, titles: hit };
}

/** Booths in a category (category id from the page's categories list); '' or null = all. */
export function inCategory(booth, categoryId) {
  if (!categoryId) return true;
  return Array.isArray(booth.categories) && booth.categories.includes(categoryId);
}

const time = (iso) => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : -Infinity;
};
const numberCmp = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'en', { numeric: true, sensitivity: 'base' });

/** A small seeded random generator (mulberry32), so a shuffle can be repeated in tests. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates with a seed. Pure: returns a new array. */
export function shuffle(list, seed) {
  const out = [...list];
  const rnd = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Sort booths. 'updated': newest updatedAt first (booths without a date last), ties by booth number.
 * 'number': booth number, numbers compared as numbers ("2" before "10"). 'shuffle': seeded random order.
 */
export function sortBooths(booths, sort = 'updated', seed = 1) {
  if (sort === 'shuffle') return shuffle(booths, seed);
  const out = [...booths];
  if (sort === 'number') return out.sort((a, b) => numberCmp(a.boothNumber, b.boothNumber) || numberCmp(a.name, b.name));
  return out.sort((a, b) => time(b.updatedAt) - time(a.updatedAt) || numberCmp(a.boothNumber, b.boothNumber));
}

/**
 * Everything the "All booths" grid shows, in order.
 * @returns {Array<{booth:object, titles:string[]}>}  titles = matching item titles to show under the card
 */
export function filterBooths(booths, { query = '', category = '', sort = 'updated', seed = 1 } = {}) {
  const hits = [];
  for (const b of Array.isArray(booths) ? booths : []) {
    if (!inCategory(b, category)) continue;
    const m = matchBooth(b, query);
    if (m.ok) hits.push({ booth: b, titles: m.titles });
  }
  const order = sortBooths(hits.map((h) => h.booth), sort, seed);
  const byBooth = new Map(hits.map((h) => [h.booth, h]));
  return order.map((b) => byBooth.get(b));
}

/**
 * Can a saved item be bought? 'sold' (status sold), 'soldout' (quantity 0), 'unavailable' (taken down or
 * not approved) or 'available'.
 */
export function availability(item) {
  if (!item) return 'unavailable';
  if (item.status === 'sold') return 'sold';
  if (typeof item.quantity === 'number' && item.quantity <= 0) return 'soldout';
  if (item.status && item.status !== 'approved') return 'unavailable';
  return 'available';
}

export const AVAILABILITY_LABEL = Object.freeze({ sold: 'Sold', soldout: 'Sold out', unavailable: 'No longer available', available: '' });
