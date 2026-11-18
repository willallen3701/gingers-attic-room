// Builds the room peeks and listing reels of the sample booths in data/sample-directory.json (directory.html opened
// standalone).
// Usage: node scripts/make-sample-peeks.mjs [--check]
//
// Each sample booth is arranged with the editor's own operations (logic/editops.js), so every fixture, item, decor
// piece and box is placed by the same rules a seller's editor enforces; any refused step stops the script. The room
// then goes through the site's real whitelist, publicPeek() in site/src/backend/boothShape.js, exactly as
// listBooths() sends it. Only the image URLs are turned back into app-relative paths, so the sample works offline.
// Every item is fake demo data drawn from data/demo-booth.json (licensed photos, see CREDITS.md).
// The card's itemCount, itemTitles and previews are set from what the room shows. The reel comes from the site's
// publicReel(): the booth's highlights (HIGHLIGHTS below) if it has any, else its newest listings; listing dates
// are made up (later in the recipe = listed more recently). --check only compares.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLibrary } from '../src/logic/library.js';
import { buildLayout } from '../src/logic/layout.js';
import { addFixture, placeItem, autoPlaceItem, placeDecor, setDecorLit, placePlaceable, addBox, assignToBox, setBoxGrid, setBoxLook, reasonFor } from '../src/logic/editops.js';
import { publicPeek, publicReel, ROOM_BASE } from '../../site/src/backend/boothShape.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const lib = normalizeLibrary(read('data/library.json'));
const demo = read('data/demo-booth.json');
const demoItems = Object.fromEntries(demo.items.map((it) => [it.id, it]));
const samplePath = join(root, 'data/sample-directory.json');
const sample = read('data/sample-directory.json');

const must = (r, what) => {
  if (!r.ok) throw new Error(`${what}: ${reasonFor(r.errors)} ${JSON.stringify(r.errors)}`);
  return r;
};
/** A drop point on a fixture's surface: `fx2:s1` at 0..1 across it. */
function on(booth, surfaceId, f) {
  const s = buildLayout(booth, lib).surfaces.find((x) => x.id === surfaceId);
  if (!s) throw new Error(`no surface ${surfaceId}`);
  return { x: s.x1 + f * (s.x2 - s.x1), y: s.y };
}
const floorFixture = (id, x, base) => [id, { x, y: base - lib.fixtures.find((f) => f.id === id).heightIn }];

// Recipes. Fixtures: [fixtureId, {x, y=top}] (instance ids fx1, fx2, ... in order). Items and decor:
// [id, surfaceId, fraction] on a fixture, [id, 'floor'|'wall', x, y] (bottom-centre), or [id] for the editor's
// "Place" button. `sold` lists items shown as sold. Boxes: {style, cols, rows, at:[surfaceId, f], items:[...]}.
const RECIPES = {
  'bt-lamplight': {
    room: { wall: { type: 'wallpaper', textureId: 'wp-gilded-damask', mode: 'tile', scale: 1 }, floor: { textureId: 'fl-herringbone', mode: 'tile', scale: 1 }, light: { presetId: 'lamp-glow', intensity: 0.55 }, architecture: ['baseboard-walnut', 'crown-walnut'] },
    fixtures: [['shelf-single-48-walnut', { x: 36, y: 34 }], floorFixture('table-console-carved', 30, 101), floorFixture('pedestal-42', 6, 106)],
    items: [['it-amber-lamp', 'fx2:s0', 0.24], ['it-genie-lamp', 'fx2:s0', 0.62], ['it-goblet-brass', 'fx1:s0', 0.78]],
    decor: [['lamp-oil', 'fx1:s0', 0.2, true], ['candelabra-brass', 'fx1:s0', 0.5, true], ['plant-fern', 'fx3:top', 0.5], ['lamp-floor-fringe', 'floor', 106, 112, true], ['lantern-hanging', 'wall', 102, 40, true]],
  },
  'bt-teacup': {
    room: { wall: { type: 'wallpaper', textureId: 'wp-rose-trellis', mode: 'tile', scale: 1 }, floor: { textureId: 'fl-white-tile', mode: 'tile', scale: 1 }, light: null, architecture: ['baseboard-white', 'crown-white'] },
    fixtures: [floorFixture('hutch-china-54', 6, 103), ['shelf-stack-4-cream', { x: 72, y: 22 }]],
    items: [['it-teacup-gold', 'fx2:s1', 0.3], ['it-teacup-mint', 'fx2:s1', 0.7], ['it-teacup-black', 'fx2:s2', 0.5], ['it-mug-brown', 'fx1:s1', 0.6]],
    decor: [['clock-wall', 'wall', 58, 30], ['plant-succulent', 'fx2:s0', 0.5], ['plant-fern', 'floor', 104, 114]],
  },
  'bt-rust': {
    room: { wall: { type: 'paint', paintId: 'paint-mustard' }, floor: { textureId: 'fl-terracotta', mode: 'tile', scale: 1 }, light: null, architecture: ['wainscot-walnut', 'baseboard-walnut'] },
    fixtures: [floorFixture('table-work-rustic', 62, 101), ['pegboard-36x24', { x: 70, y: 18 }], ['shelf-stack-2-oak', { x: 8, y: 26 }]],
    items: [['it-iron-truck', 'fx1:s0', 0.3], ['it-horseshoe', 'fx3:s0', 0.3], ['it-yellow-chair', 'floor', 26, 114]],
    sold: ['it-horseshoe'],
    decor: [['clock-wall', 'wall', 44, 34], ['lamp-oil', 'fx1:s0', 0.75], ['plant-succulent', 'fx3:s1', 0.6]],
  },
  'bt-paper': {
    room: { wall: { type: 'wallpaper', textureId: 'wp-parlour-stripe', mode: 'tile', scale: 1 }, floor: { textureId: 'fl-wood-light', mode: 'tile', scale: 1 }, light: { presetId: 'window-afternoon', intensity: 0.6 }, architecture: ['picturerail-walnut', 'baseboard-walnut'] },
    fixtures: [floorFixture('bookcase-rustic', 4, 100), floorFixture('table-writing', 68, 104)],
    items: [['it-book-stack', 'fx2:s0', 0.3], ['it-framed-art', 'wall', 76, 62], ['it-cameo', 'wall', 61, 52]],
    decor: [['lamp-oil', 'fx2:s0', 0.75, true], ['plant-philodendron', 'fx1:s0', 0.5]],
  },
  'bt-toybox': {
    room: { wall: { type: 'wallpaper', textureId: 'wp-yellow-stripe', mode: 'tile', scale: 1 }, floor: { textureId: 'fl-checker', mode: 'tile', scale: 1 }, light: null, architecture: ['baseboard-white'] },
    placeables: [['window-sash', { x: 8, y: 70 }]],
    fixtures: [['shelf-stack-3-oak', { x: 80, y: 20 }], floorFixture('case-counter-48', 52, 105)],
    items: [['it-tin-motorcycle', 'fx1:s1', 0.5], ['it-iron-truck', 'fx2:top', 0.3], ['it-rotary-phone', 'fx2:top', 0.75]],
    decor: [['plant-succulent', 'fx2:top', 0.08], ['clock-wall', 'wall', 66, 36]],
  },
  'bt-parlour': {
    room: { wall: { type: 'paint', paintId: 'paint-duck-egg' }, floor: { textureId: 'fl-octagon-lino', mode: 'tile', scale: 1 }, light: { presetId: 'window-afternoon', intensity: 0.7 }, architecture: ['wainscot-cream', 'baseboard-white'] },
    placeables: [['door-glass-oak', { x: 72, y: 90 }], ['window-sash-wide', { x: 10, y: 70 }]],
    fixtures: [floorFixture('stand-plant-short', 2, 104)],
    items: [['it-braided-rug', 'floor', 46, 116], ['it-yellow-chair', 'floor', 34, 108]],
    decor: [['plant-fern', 'fx1:s0', 0.5], ['plant-urn-tree', 'floor', 110, 112]],
  },
  'bt-velvet': {
    room: { wall: { type: 'wallpaper', textureId: 'wp-cabbage-rose', mode: 'tile', scale: 1 }, floor: { textureId: 'fl-wood-dark', mode: 'tile', scale: 1 }, light: null, architecture: ['crown-white', 'picturerail-white', 'baseboard-white'] },
    fixtures: [floorFixture('dresser-carved', 8, 102), floorFixture('case-glass-36', 76, 104)],
    items: [['it-goblet-brass', 'fx2:g1', 0.5], ['it-mug-brown', 'fx1:s0', 0.6], ['it-teacup-mint', 'fx2:g2', 0.5]],
    decor: [['mirror-ornate', 'wall', 32, 50], ['candelabra-brass', 'fx1:s0', 0.85]],
    boxes: [{ style: 'jewelry', lining: 'plum', cols: 2, rows: 2, at: ['fx1:s0', 0.3], items: ['it-cameo', 'it-teacup-gold', 'it-horseshoe', 'it-teacup-black'] }],
  },
};

// Sellers' highlighted items for the reel; booths not listed here haven't picked any (the reel shows their newest).
const HIGHLIGHTS = {
  'bt-ginger': ['it-yellow-chair', 'it-amber-lamp', 'it-teacup-gold', 'it-rotary-phone', 'it-framed-art', 'it-tin-motorcycle'],
  'bt-velvet': ['it-cameo', 'it-goblet-brass', 'it-teacup-gold'],
  'bt-lamplight': ['it-amber-lamp', 'it-genie-lamp'],
  'bt-toybox': ['it-tin-motorcycle', 'it-rotary-phone', 'it-iron-truck'],
};

/** Room-app booth items -> CMS BoothItems rows, as publicReel() reads them. */
function cmsRows(roomBooth) {
  const base = Date.parse('2026-10-01T12:00:00Z');
  return roomBooth.items.map((it, i) => ({
    _id: it.id, title: it.title, price: it.price, status: it.status, quantity: it.status === 'sold' ? 0 : it.quantity ?? 1,
    cutoutUrl: it.image, photos: [], _createdDate: new Date(base + i * 86400000).toISOString(),
  }));
}

function dropFor(booth, spec) {
  const [, where, a, b] = spec;
  if (where === undefined) return null;
  if (where === 'floor' || where === 'wall') return { x: a, y: b };
  return on(booth, where, a);
}

function build(card, recipe) {
  const ids = [...recipe.items.map((i) => i[0]), ...(recipe.boxes ?? []).flatMap((bx) => bx.items)];
  let b = {
    id: card.id,
    boothNumber: card.boothNumber,
    name: card.name,
    room: { ...recipe.room, placeables: [], sign: { style: card.signStyle } },
    fixtures: [],
    decor: [],
    boxes: [],
    items: ids.map((id) => {
      const d = demoItems[id];
      if (!d) throw new Error(`no demo item ${id}`);
      return { ...d, placement: null, status: (recipe.sold ?? []).includes(id) ? 'sold' : 'approved' };
    }),
  };
  for (const [archId, pos] of recipe.placeables ?? []) b = must(placePlaceable(b, lib, archId, pos), `${card.id} ${archId}`).booth;
  for (const [fixtureId, pos] of recipe.fixtures ?? []) b = must(addFixture(b, lib, fixtureId, pos), `${card.id} ${fixtureId}`).booth;
  for (const spec of recipe.decor ?? []) {
    const r = must(placeDecor(b, lib, spec[0], dropFor(b, spec)), `${card.id} decor ${spec[0]}`);
    b = r.booth;
    if (spec[spec.length - 1] === true) b = must(setDecorLit(b, lib, r.id, true), `${card.id} light ${spec[0]}`).booth;
  }
  for (const bx of recipe.boxes ?? []) {
    const r = must(addBox(b, lib, bx.style, on(b, ...bx.at)), `${card.id} box`);
    b = must(setBoxGrid(r.booth, lib, r.id, bx.cols, bx.rows), `${card.id} box grid`).booth;
    b = must(setBoxLook(b, r.id, { lining: bx.lining }), `${card.id} box look`).booth;
    bx.items.forEach((id, i) => {
      b = must(assignToBox(b, r.id, i, id), `${card.id} box ${id}`).booth;
    });
  }
  for (const spec of recipe.items) {
    const drop = dropFor(b, spec);
    b = must(drop ? placeItem(b, lib, spec[0], drop) : autoPlaceItem(b, lib, spec[0]), `${card.id} item ${spec[0]}`).booth;
  }
  const problems = buildLayout(b, lib).problems;
  if (Object.keys(problems).length) throw new Error(`${card.id} has placement problems: ${JSON.stringify(problems)}`);
  return b;
}

/** The demo booth as the site would hold it: its live layout, unchanged. */
const demoRoomBooth = () => ({ ...demo, items: demo.items.map((it) => ({ ...it })) });

// publicPeek() makes app-relative image paths absolute (GitHub Pages); the sample keeps them relative.
const relative = (url) => (typeof url === 'string' && url.startsWith(ROOM_BASE) ? url.slice(ROOM_BASE.length) : url);

const next = structuredClone(sample);
for (const card of next.booths) {
  const roomBooth = card.id === 'bt-ginger' ? demoRoomBooth() : RECIPES[card.id] && build(card, RECIPES[card.id]);
  if (!roomBooth) throw new Error(`no recipe for ${card.id}`);
  const peek = publicPeek(roomBooth);
  for (const it of peek.items) it.image = relative(it.image);
  card.peek = peek;
  const shown = roomBooth.items.filter((it) => peek.items.some((p) => p.id === it.id));
  card.itemCount = shown.filter((it) => it.status === 'approved').length;
  card.itemTitles = shown.map((it) => it.title);
  card.previews = shown.filter((it) => it.status === 'approved').map((it) => it.image).slice(0, 4);
  const reel = publicReel(cmsRows(roomBooth), HIGHLIGHTS[card.id] ?? []);
  if (reel) for (const it of reel.items) it.image = relative(it.image);
  card.reel = reel;
}

const text = `${JSON.stringify(next, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const same = text === readFileSync(samplePath, 'utf8');
  console.log(same ? 'sample peeks are up to date' : 'sample peeks are out of date: run node scripts/make-sample-peeks.mjs');
  process.exit(same ? 0 : 1);
}
writeFileSync(samplePath, text);
for (const b of next.booths) console.log(`${b.id}: ${b.peek.items.length} items, ${b.peek.fixtures.length} fixtures, ${b.peek.decor.length} decor, ${b.peek.boxes.length} boxes; reel ${b.reel?.kind ?? 'none'} ${b.reel?.items.length ?? 0}`);
