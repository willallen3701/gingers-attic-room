// Booth directory "room peek" (2026-11-17): the small, look-only picture of a booth's room on its Booths-page card.
// The site sends it as `booth.peek` in load-directory (site/src/backend/boothShape.js publicPeek(): the room's
// look, fixtures, decor, collectibles boxes and, for shown items, only cut-out image, size and placement).
// peekBooth() turns that into a booth that buildLayout() and room-render accept, dropping anything malformed:
// buildLayout() throws on an item without a usable size, and one bad row must not blank the whole directory.
// Pure: no DOM.

import { ROOM } from './room.js';
import { normalizeBox, MAX_BOXES } from './boxes.js';

export const PEEK_LIMITS = Object.freeze({ fixtures: 30, decor: 30, boxes: MAX_BOXES, items: 100, placeables: 10, strips: 10 });

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const str = (v, max = 200) => typeof v === 'string' && v.length > 0 && v.length <= max;
const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);
// Same slack as the backend's cleanDraft(): positions a little outside the room are tolerated.
const inRoom = (x, y) => num(x) && num(y) && x >= -60 && x <= ROOM.widthIn + 60 && y >= -10 && y <= ROOM.heightIn + 10;

function placement(p, withScale) {
  if (!obj(p) || !str(p.surfaceId, 80) || !inRoom(p.x, p.y)) return null;
  const out = { surfaceId: p.surfaceId, x: p.x, y: p.y };
  if (withScale && num(p.scaleAdj)) out.scaleAdj = p.scaleAdj;
  return out;
}

function surface(cfg, isWall) {
  if (!obj(cfg)) return null;
  const out = {};
  if (isWall && (cfg.type === 'wallpaper' || cfg.type === 'paint')) out.type = cfg.type;
  if (str(cfg.textureId, 80)) out.textureId = cfg.textureId;
  if (isWall && str(cfg.paintId, 80)) out.paintId = cfg.paintId;
  if (isWall && typeof cfg.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(cfg.color)) out.color = cfg.color;
  // Seller uploads arrive as absolute http(s) URLs (the site only sends approved ones).
  if (str(cfg.src, 1000) && /^https?:\/\//.test(cfg.src)) {
    out.src = cfg.src;
    if (obj(cfg.tileIn) && num(cfg.tileIn.w) && num(cfg.tileIn.h) && cfg.tileIn.w > 0 && cfg.tileIn.h > 0) out.tileIn = { w: cfg.tileIn.w, h: cfg.tileIn.h };
  }
  if (cfg.mode === 'tile' || cfg.mode === 'fill') out.mode = cfg.mode;
  if (num(cfg.scale) && cfg.scale > 0) out.scale = cfg.scale;
  return Object.keys(out).length ? out : null;
}

function item(it) {
  if (!obj(it) || !str(it.id, 80) || !str(it.image, 1000)) return null;
  if (!(num(it.aspect) && it.aspect > 0)) return null;
  const flat = it.flat === true || it.mount === 'flat';
  const out = {
    id: it.id,
    title: '',
    image: it.image,
    mount: flat ? 'flat' : it.mount === 'wall' ? 'wall' : 'stand',
    aspect: it.aspect,
    flat,
    status: it.sold === true ? 'sold' : 'approved',
    placement: placement(it.placement, true),
  };
  if (flat) {
    if (!(num(it.widthIn) && it.widthIn > 0)) return null;
    out.widthIn = it.widthIn;
  } else {
    if (!(num(it.heightIn) && it.heightIn > 0)) return null;
    out.heightIn = it.heightIn;
  }
  return out;
}

/**
 * Directory booth (with `peek`) -> booth for buildLayout()/roomInnerHtml(), or null when there is no usable peek.
 * The sign style comes from the card's signStyle; the card hides the room's own sign anyway.
 */
export function peekBooth(b) {
  const pk = obj(b) && obj(b.peek) ? b.peek : null;
  if (!pk || !obj(pk.room)) return null;
  const r = pk.room;
  const room = {
    wall: surface(r.wall, true),
    floor: surface(r.floor, false),
    light: obj(r.light) && str(r.light.presetId, 80) ? { presetId: r.light.presetId, intensity: num(r.light.intensity) ? Math.max(0, Math.min(1, r.light.intensity)) : 1 } : null,
    architecture: arr(r.architecture).filter((a) => str(a, 80)).slice(0, PEEK_LIMITS.strips),
    placeables: arr(r.placeables)
      .filter((a) => obj(a) && str(a.id, 40) && str(a.archId, 80) && inRoom(a.x, a.y))
      .slice(0, PEEK_LIMITS.placeables)
      .map((a) => ({ id: a.id, archId: a.archId, x: a.x, y: a.y })),
    sign: { style: str(b.signStyle, 20) ? b.signStyle : 'wood' },
  };
  if (!room.wall) delete room.wall;
  if (!room.floor) delete room.floor;

  const fixtures = arr(pk.fixtures)
    .filter((f) => obj(f) && str(f.id, 40) && str(f.fixtureId, 80) && inRoom(f.x, f.y))
    .slice(0, PEEK_LIMITS.fixtures)
    .map((f) => ({ id: f.id, fixtureId: f.fixtureId, x: f.x, y: f.y }));

  const decor = [];
  for (const d of arr(pk.decor)) {
    if (decor.length >= PEEK_LIMITS.decor) break;
    const p = obj(d) && placement(d.placement, true);
    if (!p || !str(d.id, 40) || !str(d.decorId, 80)) continue;
    decor.push({ id: d.id, decorId: d.decorId, placement: p, ...(d.lit === true ? { lit: true } : {}) });
  }

  const items = [];
  const seen = new Set();
  for (const raw of arr(pk.items)) {
    if (items.length >= PEEK_LIMITS.items) break;
    const it = item(raw);
    if (!it || seen.has(it.id)) continue;
    seen.add(it.id);
    items.push(it);
  }
  const itemIds = new Set(items.map((i) => i.id));

  const boxes = [];
  const boxed = new Set();
  for (const raw of arr(pk.boxes)) {
    if (boxes.length >= PEEK_LIMITS.boxes) break;
    if (!obj(raw) || !str(raw.id, 40)) continue;
    const p = placement(raw.placement, false);
    if (!p) continue;
    const bx = normalizeBox({ ...raw, placement: p });
    // A compartment shows only an item the peek actually sent, and each item in one compartment at most.
    bx.slots = bx.slots.map((id) => (id && itemIds.has(id) && !boxed.has(id) ? (boxed.add(id), id) : null));
    boxes.push(bx);
  }
  // An item is drawn either at its placement or in its box; anything else (no spot, no box) is left out.
  const shown = items
    .map((it) => (boxed.has(it.id) ? { ...it, placement: null } : it))
    .filter((it) => it.placement || boxed.has(it.id));

  return {
    id: String(b.id ?? ''),
    boothNumber: b.boothNumber ?? '',
    name: String(b.name ?? ''),
    room,
    fixtures,
    decor,
    boxes,
    items: shown,
  };
}
