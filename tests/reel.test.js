import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAX_HIGHLIGHTS, cleanHighlights, setHighlight, canHighlight, reelOf } from '../src/logic/reel.js';
import { toDraft, applyDraft } from '../src/logic/draft.js';
// The site backend (no Wix imports in this module): the reel each directory card gets, and the draft cleaner.
import { publicReel, cleanDraft, toRoomBooth, MAX_HIGHLIGHTS as SITE_MAX } from '../../site/src/backend/boothShape.js';

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const lib = json('../data/library.json');
const sample = json('../data/sample-directory.json');

const items = (n, over = {}) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, status: 'approved', ...over }));

describe('seller highlights (editor, My Items)', () => {
  it('allows up to six of the seller\'s own items, not sold or rejected ones', () => {
    expect(MAX_HIGHLIGHTS).toBe(6);
    expect(SITE_MAX).toBe(MAX_HIGHLIGHTS);
    let b = { items: [...items(7), { id: 'sold', status: 'sold' }, { id: 'rej', status: 'rejected' }, { id: 'pend', status: 'pending' }] };
    expect(setHighlight(b, 'sold', true).ok).toBe(false);
    expect(setHighlight(b, 'rej', true).ok).toBe(false);
    expect(setHighlight(b, 'nope', true).ok).toBe(false);
    expect(canHighlight({ status: 'pending' })).toBe(true);
    for (const id of ['pend', 'i0', 'i1', 'i2', 'i3', 'i4']) b = setHighlight(b, id, true).booth;
    expect(b.highlights).toEqual(['pend', 'i0', 'i1', 'i2', 'i3', 'i4']);
    const seventh = setHighlight(b, 'i5', true);
    expect(seventh.ok).toBe(false);
    expect(seventh.errors[0].code).toBe('FULL');
    b = setHighlight(b, 'i1', false).booth;
    expect(b.highlights).toEqual(['pend', 'i0', 'i2', 'i3', 'i4']);
    expect(setHighlight(b, 'i0', true).booth.highlights).toEqual(b.highlights); // already on: no change
  });

  it('drops highlights of deleted, sold or repeated items', () => {
    expect(cleanHighlights({ items: [{ id: 'a', status: 'approved' }, { id: 'b', status: 'sold' }], highlights: ['a', 'a', 'b', 'gone', 7] })).toEqual(['a']);
    expect(cleanHighlights({})).toEqual([]);
  });

  it('are saved with the draft and survive a reload', () => {
    const booth = { room: {}, fixtures: [], decor: [], boxes: [], items: items(3), highlights: ['i2', 'i0'] };
    const d = toDraft(booth);
    expect(d.highlights).toEqual(['i2', 'i0']);
    expect(applyDraft({ room: {}, items: items(3) }, JSON.parse(JSON.stringify(d))).highlights).toEqual(['i2', 'i0']);
  });

  it('the site keeps only the seller\'s own items and refuses more than six', () => {
    const save = (highlights, itemIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g']) => cleanDraft({ room: {}, placements: {}, highlights }, { lib, itemIds, uploadSrcs: [] });
    expect(save(['b', 'zz', 'b', 'a', 3]).draft.highlights).toEqual(['b', 'a']);
    expect(save(undefined).draft.highlights).toEqual([]);
    expect(save(['a', 'b', 'c', 'd', 'e', 'f', 'g']).ok).toBe(false);
  });

  it('reach the editor from the saved draft, and the live booth from the published layout', () => {
    const row = { _id: 'b1', room: { room: {}, highlights: ['live1'] }, uploads: [] };
    expect(toRoomBooth(row, []).highlights).toEqual(['live1']);
    expect(toRoomBooth(row, [], { draft: { room: {}, highlights: ['draft1'] } }).highlights).toEqual(['draft1']);
  });
});

describe('site publicReel(): the reel on a directory card', () => {
  const row = (id, over = {}) => ({
    _id: id, title: `Title ${id}`, price: 10, quantity: 1, status: 'approved', cutoutUrl: `assets/items/${id}.png`, photos: [],
    _createdDate: '2026-11-01T00:00:00Z', ownerId: 'member-secret', description: 'desc', rejectionNote: 'note', ...over,
  });
  const rows = [
    row('old', { _createdDate: '2026-10-01T00:00:00Z' }),
    row('new', { _createdDate: '2026-11-15T00:00:00Z' }),
    row('mid', { _createdDate: '2026-11-05T00:00:00Z' }),
    row('sold', { status: 'sold', _createdDate: '2026-11-16T00:00:00Z' }),
    row('soldout', { quantity: 0, _createdDate: '2026-11-16T00:00:00Z' }),
    row('pending', { status: 'pending', _createdDate: '2026-11-17T00:00:00Z' }),
    row('photo-only', { cutoutUrl: null, photos: ['https://static.wixstatic.com/media/p.jpg'], _createdDate: '2026-10-02T00:00:00Z' }),
  ];

  it('shows the seller\'s picks that are still for sale, in the seller\'s order', () => {
    const r = publicReel(rows, ['mid', 'sold', 'pending', 'old', 'mid']);
    expect(r.kind).toBe('picks');
    expect(r.items.map((i) => i.id)).toEqual(['mid', 'old']);
  });

  it('falls back to the newest listings for sale when there are no picks (or none still for sale)', () => {
    for (const picks of [[], undefined, ['sold', 'gone']]) {
      const r = publicReel(rows, picks);
      expect(r.kind).toBe('newest');
      expect(r.items.map((i) => i.id)).toEqual(['new', 'mid', 'photo-only', 'old']);
    }
  });

  it('shows at most six, each with only its photo, price and title', () => {
    const many = Array.from({ length: 9 }, (_, i) => row(`m${i}`, { _createdDate: `2026-11-0${i + 1}T00:00:00Z` }));
    const r = publicReel(many, []);
    expect(r.items).toHaveLength(6);
    expect(r.items[0].id).toBe('m8');
    for (const it of r.items) expect(Object.keys(it).sort()).toEqual(['id', 'image', 'price', 'title']);
    const text = JSON.stringify(publicReel(rows, []));
    for (const secret of ['member-secret', 'desc', 'note']) expect(text).not.toContain(secret);
    expect(publicReel(rows, []).items.find((i) => i.id === 'photo-only').image).toBe('https://static.wixstatic.com/media/p.jpg');
    expect(publicReel(rows, []).items[0].image).toMatch(/^https:\/\/.+\/assets\/items\/new\.png$/);
  });

  it('is null for a booth with nothing for sale', () => {
    expect(publicReel([row('s', { status: 'sold' })], [])).toBeNull();
    expect(publicReel([], ['x'])).toBeNull();
  });
});

describe('reelOf: the directory card reads the reel', () => {
  it('drops malformed entries and keeps at most six', () => {
    const r = reelOf({ reel: { kind: 'picks', items: [
      { id: 'a', price: 5, image: 'a.png', title: 'A' },
      { id: 'a', price: 5, image: 'a.png' },
      { id: 'b', price: 'free', image: 'b.png' },
      { id: 'c', price: 5 },
      { id: 'd', price: -1, image: 'd.png' },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, price: i, image: `${i}.png` })),
    ] } });
    expect(r.kind).toBe('picks');
    expect(r.items.map((i) => i.id)).toEqual(['a', 'x0', 'x1', 'x2', 'x3', 'x4']);
    expect(reelOf({ reel: { kind: 'weird', items: [{ id: 'a', price: 1, image: 'a.png' }] } }).kind).toBe('newest');
    expect(reelOf({})).toBeNull();
    expect(reelOf({ reel: { items: [] } })).toBeNull();
  });

  it('every sample booth has a reel; picks and newest both appear, and nothing sold is in one', () => {
    const kinds = new Set();
    for (const c of sample.booths) {
      const r = reelOf(c);
      expect(r, c.id).not.toBeNull();
      expect(r.items.length).toBeLessThanOrEqual(6);
      kinds.add(r.kind);
      const sold = new Set(c.peek.items.filter((i) => i.sold).map((i) => i.id));
      for (const it of r.items) expect(sold.has(it.id), `${c.id} ${it.id}`).toBe(false);
    }
    expect([...kinds].sort()).toEqual(['newest', 'picks']);
  });
});
