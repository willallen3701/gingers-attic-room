import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { peekBooth } from '../src/logic/peek.js';
import { buildLayout } from '../src/logic/layout.js';
import { normalizeLibrary } from '../src/logic/library.js';
import { roomInnerHtml } from '../src/room-render.js';
// The site backend's whitelist (site/src/backend/boothShape.js has no Wix imports, so it runs under Node).
import { publicPeek, toRoomBooth } from '../../site/src/backend/boothShape.js';

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const lib = normalizeLibrary(json('../data/library.json'));
const sample = json('../data/sample-directory.json');

const item = (id, over = {}) => ({ id, image: `assets/items/${id}.png`, mount: 'stand', aspect: 1, heightIn: 6, placement: { surfaceId: 'floor', x: 10, y: 110, scaleAdj: 1 }, ...over });
const card = (peek, over = {}) => ({ id: 'b1', boothNumber: 3, name: 'Test', signStyle: 'cream', peek, ...over });
const room = { wall: { type: 'wallpaper', textureId: 'wp-floral-blue', mode: 'tile', scale: 1 }, floor: { textureId: 'fl-wood-honey', mode: 'tile', scale: 1 }, light: null, architecture: [], placeables: [] };

describe('peekBooth: the directory card room peek', () => {
  it('is null without a usable peek', () => {
    expect(peekBooth(null)).toBeNull();
    expect(peekBooth({ id: 'b1' })).toBeNull();
    expect(peekBooth(card('nope'))).toBeNull();
    expect(peekBooth(card({ items: [] }))).toBeNull();
  });

  it('keeps the room look and takes the sign style from the card', () => {
    const b = peekBooth(card({ room, fixtures: [{ id: 'fx1', fixtureId: 'shelf-stack-4', x: 3, y: 12.2 }] }));
    expect(b.room.wall.textureId).toBe('wp-floral-blue');
    expect(b.room.sign.style).toBe('cream');
    expect(b.fixtures).toHaveLength(1);
  });

  it('drops items buildLayout could not size, instead of failing the whole directory', () => {
    const items = [
      item('ok'),
      item('no-aspect', { aspect: 0 }),
      item('nan-aspect', { aspect: Number.NaN }),
      item('no-height', { heightIn: undefined }),
      item('flat-no-width', { mount: 'flat', flat: true, heightIn: undefined }),
      item('rug', { mount: 'flat', flat: true, heightIn: undefined, widthIn: 40, aspect: 3 }),
      item('no-image', { image: '' }),
      item('nowhere', { placement: null }),
      item('far-away', { placement: { surfaceId: 'floor', x: 9999, y: 110 } }),
      item('ok'), // duplicate id
    ];
    const b = peekBooth(card({ room, items }));
    expect(b.items.map((i) => i.id)).toEqual(['ok', 'rug']);
    expect(() => buildLayout(b, lib)).not.toThrow();
  });

  it('marks sold items, and items carry no title or price', () => {
    const b = peekBooth(card({ room, items: [item('a', { sold: true, title: 'Secret', price: 9 }), item('b')] }));
    expect(b.items.map((i) => i.status)).toEqual(['sold', 'approved']);
    expect(b.items[0].title).toBe('');
    expect(b.items[0].price).toBeUndefined();
  });

  it('shows a boxed item only in its box, once, and only items the peek sent', () => {
    const box = { id: 'bx1', style: 'jewelry', lining: 'plum', cols: 2, rows: 2, placement: { surfaceId: 'floor', x: 50, y: 110 }, slots: ['a', 'a', 'ghost', null] };
    const b = peekBooth(card({ room, items: [item('a', { placement: null }), item('b')], boxes: [box, { ...box, id: 'bx2', slots: ['a', null, null, null] }] }));
    expect(b.boxes[0].slots).toEqual(['a', null, null, null]);
    expect(b.boxes[1].slots).toEqual([null, null, null, null]);
    expect(b.items.find((i) => i.id === 'a').placement).toBeNull();
    expect(() => buildLayout(b, lib)).not.toThrow();
  });

  it('only accepts uploaded textures by absolute http(s) URL', () => {
    const up = (src) => peekBooth(card({ room: { ...room, wall: { type: 'wallpaper', src, tileIn: { w: 24, h: 24 } } } })).room.wall;
    expect(up('https://static.wixstatic.com/media/x.jpg')?.src).toBe('https://static.wixstatic.com/media/x.jpg');
    expect(up('javascript:alert(1)')?.src).toBeUndefined();
    expect(up('assets/x.jpg')?.src).toBeUndefined();
  });

  it('draws every sample booth with no placement problems, its items and no sign or price tags to click', () => {
    expect(sample.booths.length).toBeGreaterThanOrEqual(6);
    for (const c of sample.booths) {
      const b = peekBooth(c);
      expect(b, c.id).not.toBeNull();
      const L = buildLayout(b, lib);
      expect(L.problems, c.id).toEqual({});
      const boxed = L.boxes.flatMap((x) => x.cells).filter(Boolean).length;
      expect(L.items.length + boxed, c.id).toBe(c.peek.items.length);
      const html = roomInnerHtml(b, lib, L);
      for (const it of c.peek.items) expect(html, `${c.id} ${it.id}`).toContain(it.image);
    }
  });

  it('sample cards count what their room shows', () => {
    for (const c of sample.booths) {
      expect(c.itemCount, c.id).toBe(c.peek.items.filter((i) => !i.sold).length);
      expect(c.itemTitles.length, c.id).toBe(c.peek.items.length);
    }
  });
});

describe('site backend publicPeek(): what a shopper\'s browser receives', () => {
  const boothRow = {
    _id: 'b-1',
    boothNumber: 4,
    name: 'Rust & Rosewood',
    about: 'Farmhouse iron',
    ownerId: 'member-secret',
    uploads: [
      { src: 'https://static.wixstatic.com/media/ok.jpg', approved: true },
      { src: 'https://static.wixstatic.com/media/pending.jpg', approved: false },
    ],
    room: {
      room: { wall: { type: 'wallpaper', src: 'https://static.wixstatic.com/media/pending.jpg', tileIn: { w: 24, h: 24 } }, floor: { src: 'https://static.wixstatic.com/media/ok.jpg', tileIn: { w: 30, h: 30 } }, architecture: ['baseboard-walnut'] },
      fixtures: [{ id: 'fx1', fixtureId: 'table-farm-60', x: 58, y: 65.5 }],
      decor: [{ id: 'dc1', decorId: 'candelabra-brass', placement: { surfaceId: 'fx1:top', x: 100, y: 65.5 }, lit: true }],
      boxes: [{ id: 'bx1', style: 'crate', lining: 'green', cols: 2, rows: 2, placement: { surfaceId: 'fx1:top', x: 60, y: 65.5 }, slots: ['i-boxed', 'i-pending', null, null] }],
      seller: { displayName: 'Hank', avatarSrc: null },
    },
  };
  const row = (id, over = {}) => ({
    _id: id, title: `Title ${id}`, description: 'desc', price: 12, quantity: 1, status: 'approved', cutoutUrl: `assets/items/${id}.png`,
    photos: ['https://static.wixstatic.com/media/photo.jpg'], heightIn: 6, widthIn: 4, depthIn: 4, aspect: 0.8, mount: 'stand',
    ownerId: 'member-secret', rejectionNote: 'secret note', pendingChanges: { price: 1 }, itemNumber: 77,
    placement: { surfaceId: 'fx1:top', x: 80, y: 65.5, scaleAdj: 1 }, ...over,
  });
  const rows = [
    row('i-shown'),
    row('i-sold', { status: 'sold', placement: { surfaceId: 'floor', x: 20, y: 110, scaleAdj: 1 } }),
    row('i-pending', { status: 'pending' }),
    row('i-stored', { placement: null }),
    row('i-boxed', { placement: null }),
  ];
  // listBooths() only reads approved/sold rows; a pending row is passed here to prove publicPeek drops it anyway.
  const peek = publicPeek(toRoomBooth(boothRow, rows));
  const text = JSON.stringify(peek);

  it('sends no private or shop-only fields', () => {
    for (const secret of ['member-secret', 'secret note', 'Title', 'desc', 'photo.jpg', 'Hank', 'itemNumber', 'pendingEdit', 'price', 'quantity']) {
      expect(text, secret).not.toContain(secret);
    }
    expect(Object.keys(peek).sort()).toEqual(['boxes', 'decor', 'fixtures', 'items', 'room']);
    for (const it of peek.items) expect(Object.keys(it).every((k) => ['id', 'image', 'mount', 'aspect', 'placement', 'heightIn', 'widthIn', 'flat', 'sold'].includes(k)), JSON.stringify(it)).toBe(true);
  });

  it('shows placed and boxed approved/sold items; not pending, not stored', () => {
    expect(peek.items.map((i) => i.id).sort()).toEqual(['i-boxed', 'i-shown', 'i-sold']);
    expect(peek.items.find((i) => i.id === 'i-sold').sold).toBe(true);
    expect(peek.boxes[0].slots).toEqual(['i-boxed', null, null, null]);
  });

  it('swaps an unapproved uploaded wallpaper for the default and keeps an approved floor upload', () => {
    expect(text).not.toContain('pending.jpg');
    expect(peek.room.wall.textureId).toBe('wp-floral-blue');
    expect(peek.room.floor.src).toBe('https://static.wixstatic.com/media/ok.jpg');
  });

  it('is drawn by the directory card without placement problems', () => {
    const b = peekBooth(card(peek));
    expect(b.items.map((i) => i.id).sort()).toEqual(['i-boxed', 'i-shown', 'i-sold']);
    expect(buildLayout(b, lib).problems).toEqual({});
  });
});
