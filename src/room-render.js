// Shared room rendering for <attic-booth> (view) and <attic-editor> (edit).
// Everything returns HTML strings positioned in % of the room (room inches -> pct()).
// In edit mode each movable thing carries data-kind / data-id so the editor can pick it up.

import { ROOM, pct } from './logic/room.js';
import { backgroundFor } from './logic/tile.js';
import { stripTopIn } from './logic/library.js';
import { litLamps } from './logic/lamps.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const money = (n) => (typeof n === 'number' ? `$${n % 1 ? n.toFixed(2) : n}` : '');

// @font-face rules inside a shadow root are ignored by browsers, so the Google Fonts stylesheet
// is added to the document head once (Playfair Display: OFL 1.1, Special Elite: Apache 2.0).
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Special+Elite&display=swap';
export function ensureFonts() {
  if (typeof document === 'undefined' || document.querySelector('link[data-attic-fonts]')) return;
  for (const [rel, href, cross] of [
    ['preconnect', 'https://fonts.googleapis.com', false],
    ['preconnect', 'https://fonts.gstatic.com', true],
    ['stylesheet', FONTS_HREF, false],
  ]) {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    if (cross) link.crossOrigin = 'anonymous';
    if (rel === 'stylesheet') link.dataset.atticFonts = '';
    document.head.append(link);
  }
}

const box = (x, top, w, h, z) => `left:${pct(x)}%;top:${pct(top)}%;width:${pct(w)}%;height:${pct(h)}%;z-index:${z}`;
const stateCls = (id, opts) => `${opts.selectedId === id ? ' sel' : ''}${opts.badIds?.has(id) ? ' bad' : ''}`;

/** Wall strips (baseboards, crown moulding, wainscoting, picture rails). */
export function stripsHtml(booth, lib) {
  const defs = lib.architecture ?? [];
  return (booth.room?.architecture ?? [])
    .map((id) => defs.find((a) => a.id === id && a.kind === 'strip'))
    .filter(Boolean)
    .map((a) => {
      const top = stripTopIn(a);
      const bg = a.src
        ? `background:url('${esc(a.src)}') left top / auto 100% repeat-x${a.color ? `, ${esc(a.color)}` : ''}`
        : `background:linear-gradient(180deg, ${esc(a.color ?? '#6a4128')}, ${esc(a.color ?? '#6a4128')} 80%, rgba(0,0,0,.35))`;
      const shadow = a.anchor === 'bottom' && (a.offsetIn ?? 0) === 0 ? ' baseboard' : ' strip';
      return `<div class="${shadow.trim()}" data-strip="${esc(a.id)}" style="top:${pct(top)}%;height:${pct(a.heightIn)}%;${bg};z-index:${a.anchor === 'top' ? 945 : 950}"></div>`;
    })
    .join('');
}

/** Windows and doors set into the wall. */
export function placeablesHtml(layout, opts = {}) {
  return (layout.placeables ?? [])
    .map(
      (p) =>
        `<div class="placeable${opts.edit ? ' movable' : ''}${stateCls(p.id, opts)}" data-kind="placeable" data-id="${esc(p.id)}" style="${box(p.x, p.top, p.w, p.h, p.z)}">` +
        `<img src="${esc(p.def.src)}" alt="" draggable="false"></div>`,
    )
    .join('');
}

export function fixturesHtml(layout, opts = {}) {
  return layout.fixtures
    .map(
      (f) =>
        `<div class="fixture${opts.edit ? ' movable' : ''}${stateCls(f.id, opts)}" data-kind="fixture" data-id="${esc(f.id)}" style="${box(f.x, f.y, f.w, f.h, f.z)}">` +
        `<img src="${esc(f.def.src)}" alt="" draggable="false"></div>`,
    )
    .join('');
}

export function itemsHtml(layout, opts = {}) {
  return layout.items
    .map(({ item, size, x, top, z }) => {
      const sold = item.status === 'sold';
      const label = `${item.title}, ${sold ? 'sold' : money(item.price)}`;
      // In the editor, items GingersAttic hasn't approved yet are drawn faded with a dashed outline.
      const unapproved = opts.edit && (item.status === 'pending' || item.status === 'rejected');
      return (
        `<button class="item mount-${esc(item.mount)}${sold ? ' sold' : ''}${unapproved ? ' unapproved' : ''}${opts.edit ? ' movable' : ''}${stateCls(item.id, opts)}" type="button" ` +
        `data-kind="item" data-id="${esc(item.id)}" aria-label="${esc(label)}" style="${box(x, top, size.w, size.h, z)}">` +
        `<span class="contact"></span><img src="${esc(item.image)}" alt="" draggable="false"></button>`
      );
    })
    .join('');
}

/** Decor props: drawn like items, but never for sale (no tag, no card). */
export function decorHtml(layout, opts = {}) {
  return (layout.decor ?? [])
    .map(
      ({ decor, def, mount, size, x, top, z }) =>
        `<div class="item decor mount-${esc(mount === 'floor' ? 'stand' : mount)}${opts.edit ? ' movable' : ''}${stateCls(decor.id, opts)}" ` +
        `data-kind="decor" data-id="${esc(decor.id)}" aria-hidden="true" style="${box(x, top, size.w, size.h, z)}">` +
        `<span class="contact"></span><img src="${esc(def.src)}" alt="" draggable="false"></div>`,
    )
    .join('');
}

export function tagsHtml(layout) {
  return layout.items
    .map(({ item, size, x, top }) => {
      // Hang the tag from the item's upper-right (a rug's right edge; a frame's corner).
      const ax = x + size.w * (item.mount === 'flat' ? 0.92 : 0.9);
      const ay = top + (item.mount === 'flat' ? size.h * 0.35 : Math.min(size.h * 0.18, 2.5));
      const sold = item.status === 'sold';
      return (
        `<div class="tag" data-id="${esc(item.id)}" aria-hidden="true" style="left:${pct(ax)}%;top:${pct(ay)}%">` +
        `<span class="paper">${esc(money(item.price))}</span>${sold ? '<span class="sold">SOLD</span>' : ''}</div>`
      );
    })
    .join('');
}

export const SIGN_STYLES = Object.freeze([
  { id: 'wood', name: 'Dark wood' },
  { id: 'cream', name: 'Painted cream' },
  { id: 'brass', name: 'Brass plate' },
]);

export function signHtml(booth) {
  const w = 26;
  const h = 11; // must end above the top of wall art (~12 in)
  const x = (ROOM.widthIn - w) / 2;
  const style = SIGN_STYLES.some((s) => s.id === booth.room?.sign?.style) ? booth.room.sign.style : 'wood';
  return (
    `<div class="sign style-${style}" style="left:${pct(x)}%;top:0;width:${pct(w)}%;height:${pct(h)}%">` +
    `<span class="chain" style="left:18%"></span><span class="chain" style="right:18%"></span>` +
    `<div class="board"><span class="no">Booth No. ${esc(booth.boothNumber)}</span><span class="nm">${esc(booth.name)}</span></div></div>`
  );
}

/** Optional light overlay. No light configured (the default) renders nothing. */
export function lightHtml(booth, lib) {
  const cfg = booth.room?.light;
  const preset = cfg && lib.lights?.find((l) => l.id === cfg.presetId);
  if (!preset) return '';
  const k = Math.max(0, Math.min(1, cfg.intensity ?? 1));
  let panes = '';
  if (preset.panes) {
    const p = preset.panes;
    const gapPct = 6;
    const cell = `linear-gradient(${p.color}, ${p.color})`;
    const bgs = [];
    const pos = [];
    const sizes = [];
    const cw = (100 - gapPct * (p.cols - 1)) / p.cols;
    const ch = (100 - gapPct * (p.rows - 1)) / p.rows;
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        bgs.push(cell);
        // background-position % is relative to (container - image); convert cell offset accordingly
        const ox = p.cols > 1 ? ((c * (cw + gapPct)) / (100 - cw)) * 100 : 0;
        const oy = p.rows > 1 ? ((r * (ch + gapPct)) / (100 - ch)) * 100 : 0;
        pos.push(`${ox.toFixed(2)}% ${oy.toFixed(2)}%`);
        sizes.push(`${cw.toFixed(2)}% ${ch.toFixed(2)}%`);
      }
    }
    panes =
      `<div class="panes" style="left:${pct(p.x)}%;top:${pct(p.y)}%;width:${pct(p.w)}%;height:${pct(p.h)}%;` +
      `transform:skewX(${p.skewDeg}deg);opacity:${(0.9 * k).toFixed(2)};background-image:${bgs.join(',')};` +
      `background-position:${pos.join(',')};background-size:${sizes.join(',')};background-repeat:no-repeat"></div>`;
  }
  return (
    `<div class="light" data-preset="${esc(preset.id)}">` +
    `<div class="wash" style="background:${esc(preset.wash)};opacity:${k.toFixed(2)}"></div>${panes}` +
    (preset.vignette ? `<div class="vignette" style="opacity:${(preset.vignette * k).toFixed(2)}"></div>` : '') +
    `</div>`
  );
}

/**
 * Lamps the seller switched on: warm light at each bulb/flame/shade, a halo around it, a soft pool on the
 * wall, and a pool on the floor or shelf it stands on. Two layers: .wash (pools and halos, normal blending, so
 * a pale wall turns warm and a dark one brightens) and .glow (bright cores, screen-blended). Always returns the
 * .lamps wrapper (empty when nothing is lit) so the editor can refresh it during a drag. The shop's Lights
 * switch hides it with .lights-off.
 */
export function lampsHtml(layout) {
  const disc = (x, y, rx, ry) => `left:${pct(x - rx)}%;top:${pct(y - ry)}%;width:${pct(2 * rx)}%;height:${pct(2 * ry)}%`;
  const wash = [];
  const glow = [];
  litLamps(layout).forEach((g, n) => {
    const cls = `lamp kind-${esc(g.kind)}${g.flicker ? ' flicker' : ''}`;
    const w = [`<span class="pool" style="${disc(g.pool.x, g.pool.y, g.pool.r, g.pool.r)}"></span>`];
    if (g.ground) w.push(`<span class="ground" style="${disc(g.ground.x, g.ground.y, g.ground.rx, g.ground.ry)}"></span>`);
    const c = [];
    g.lights.forEach((l, i) => {
      // Flames flicker out of step with each other.
      const delay = g.flicker ? `;animation-delay:-${((n * 0.37 + i * 0.83) % 2.6).toFixed(2)}s` : '';
      w.push(`<span class="halo" style="${disc(l.x, l.y, l.halo, l.halo)}${delay}"></span>`);
      c.push(`<span class="core" style="${disc(l.x, l.y, l.rx, l.ry)}${delay}"></span>`);
    });
    wash.push(`<div class="${cls}" data-id="${esc(g.id)}">${w.join('')}</div>`);
    glow.push(`<div class="${cls}" data-id="${esc(g.id)}">${c.join('')}</div>`);
  });
  return `<div class="lamps" aria-hidden="true"><div class="wash">${wash.join('')}</div><div class="glow">${glow.join('')}</div></div>`;
}

/** A library texture by id, or a seller upload ({src, tileIn}) passed inline. */
export function textureFor(list, cfg) {
  if (cfg?.src) return { src: cfg.src, tileIn: cfg.tileIn ?? { w: 24, h: 24 } };
  return list?.find((t) => t.id === cfg?.textureId) ?? null;
}

/** Wallpaper/paint and floor backgrounds depend on the rendered pixel size (tile mode). */
export function paintSurfaces(root, booth, lib) {
  const room = root.querySelector('.room');
  if (!room) return;
  const ppi = room.clientWidth / ROOM.widthIn || 1;
  const wallCfg = booth.room?.wall ?? {};
  const wall = root.querySelector('.wall');
  if (wall) {
    wall.style.background = '';
    if (wallCfg.type === 'paint') {
      const paint = lib.paints?.find((p) => p.id === wallCfg.paintId);
      wall.style.background = paint?.color ?? wallCfg.color ?? '#efe6d2';
    } else {
      const tex = textureFor(lib.wallpapers, wallCfg);
      if (tex) Object.assign(wall.style, { backgroundImage: `url("${tex.src}")`, ...backgroundFor(tex, wallCfg.mode ?? 'tile', wallCfg.scale ?? 1, ppi) });
    }
  }
  const floorCfg = booth.room?.floor ?? {};
  const tex = textureFor(lib.floors, floorCfg);
  const plane = root.querySelector('.floor-plane');
  if (tex && plane) {
    plane.style.background = '';
    Object.assign(plane.style, { backgroundImage: `url("${tex.src}")`, ...backgroundFor(tex, floorCfg.mode ?? 'tile', floorCfg.scale ?? 1, ppi) });
    if ((floorCfg.mode ?? 'tile') === 'tile') plane.style.backgroundPosition = 'center top';
  }
}

/** The room's inner layers (without the card/toast chrome). */
export function roomInnerHtml(booth, lib, layout, opts = {}) {
  return (
    `<div class="wall"></div>` +
    `<div class="floor"><div class="floor-plane"></div></div>` +
    stripsHtml(booth, lib) +
    `<div class="layer">${placeablesHtml(layout, opts)}${fixturesHtml(layout, opts)}${decorHtml(layout, opts)}${itemsHtml(layout, opts)}</div>` +
    signHtml(booth) +
    lightHtml(booth, lib) +
    lampsHtml(layout) +
    `<div class="tags">${tagsHtml(layout)}</div>`
  );
}
