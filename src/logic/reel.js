// Listing reel (2026-11-17): a row of up to six highlighted listings on each booth's directory card, between the
// room peek and the seller's bio. The seller picks them in the editor's My Items tab (booth.highlights, saved with
// the draft like the layout); with no picks still for sale the site shows the booth's newest listings instead
// (site/src/backend/boothShape.js publicReel()). Shoppers scroll it by hand; nothing moves by itself. Pure: no DOM.

export const MAX_HIGHLIGHTS = 6;

/** Statuses a seller may highlight: anything not sold or rejected (pending ones show once approved). */
export const canHighlight = (item) => !!item && item.status !== 'sold' && item.status !== 'rejected';

/** A booth's highlight ids, cleaned: the booth's own highlightable items, no repeats, at most six. */
export function cleanHighlights(booth) {
  const items = new Map((booth?.items ?? []).map((i) => [i.id, i]));
  const out = [];
  for (const id of Array.isArray(booth?.highlights) ? booth.highlights : []) {
    if (out.length >= MAX_HIGHLIGHTS) break;
    if (typeof id === 'string' && !out.includes(id) && canHighlight(items.get(id))) out.push(id);
  }
  return out;
}

/**
 * Highlight an item or stop highlighting it. Returns { ok, booth, errors } like the editor operations;
 * a seventh highlight is refused with FULL.
 */
export function setHighlight(booth, itemId, on) {
  const cur = cleanHighlights(booth);
  const item = (booth.items ?? []).find((i) => i.id === itemId);
  if (on) {
    if (cur.includes(itemId)) return { ok: true, booth: { ...booth, highlights: cur }, errors: [] };
    if (!canHighlight(item)) return { ok: false, booth, errors: [{ code: 'UNKNOWN' }] };
    if (cur.length >= MAX_HIGHLIGHTS) return { ok: false, booth, errors: [{ code: 'FULL' }] };
    return { ok: true, booth: { ...booth, highlights: [...cur, itemId] }, errors: [] };
  }
  return { ok: true, booth: { ...booth, highlights: cur.filter((id) => id !== itemId) }, errors: [] };
}

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const str = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;

/**
 * Directory card -> its reel: { kind: 'picks'|'newest', items: [{id, title, price, image}] }, or null when there is
 * nothing to show. Malformed rows from the page are dropped (an item needs an image and a price).
 */
export function reelOf(card) {
  const r = card?.reel;
  if (!r || typeof r !== 'object' || !Array.isArray(r.items)) return null;
  const seen = new Set();
  const items = [];
  for (const it of r.items) {
    if (items.length >= MAX_HIGHLIGHTS) break;
    if (!it || !str(it.id, 80) || seen.has(it.id) || !str(it.image, 1000) || !num(it.price) || it.price < 0) continue;
    seen.add(it.id);
    items.push({ id: it.id, title: str(it.title, 200) ? it.title : '', price: it.price, image: it.image });
  }
  return items.length ? { kind: r.kind === 'picks' ? 'picks' : 'newest', items } : null;
}
