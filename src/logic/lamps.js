// Decor lamps that switch on and off. Pure: no DOM.
//
// A decor entry whose library def has category 'lighting' is a lamp. The seller's switch is stored on the
// decor entry itself: { id, decorId, placement, lit: true|false }. New lamps start off.
//
// Where the light sits in each lamp's artwork was read off assets/decor/*.webp. Those images are cropped
// tight to the lamp, so a point is a fraction of the drawn image box: x from the left edge, y from the top.
// Radii are inches at the lamp's library size and grow or shrink with the seller's size tweak.
//   kind 'flame'  candle or wick flame: small bright core, flickers (unless reduced motion is on)
//   kind 'bulb'   electric bulb seen through glass
//   kind 'shade'  bulb hidden in a fabric shade: the whole shade glows (rx/ry cover the shade)
//   coreIn        radius of the bright core (or rx/ry per point for an oval core)
//   haloIn        radius of the warm halo around each core
//   poolIn        radius of the soft pool of light the lamp throws on the wall around it

import { FLOOR_SURFACE_ID } from './surfaces.js';

export const LAMP_CATEGORY = 'lighting';

export const LAMP_LIGHTS = Object.freeze({
  // Three candles: the flames sit on the candle tips (left and right tips are lower than the centre one).
  'candelabra-brass': {
    kind: 'flame',
    points: [{ x: 0.09, y: 0.07 }, { x: 0.5, y: 0.025 }, { x: 0.905, y: 0.07 }],
    coreIn: 0.55,
    haloIn: 2.4,
    poolIn: 13,
  },
  // Pleated shade over the top 21 % of the lamp (fringe below it); the bulb is inside, so the shade glows.
  'lamp-floor-fringe': {
    kind: 'shade',
    points: [{ x: 0.5, y: 0.115, rx: 7.6, ry: 6 }],
    haloIn: 12,
    poolIn: 27,
  },
  // Flame inside the chimney, just above the brass burner collar.
  'lamp-oil': {
    kind: 'flame',
    points: [{ x: 0.5, y: 0.37 }],
    coreIn: 0.8,
    haloIn: 3.2,
    poolIn: 14,
  },
  // Four unlit white advent pillar candles on a fir wreath: flames sit a little above the wick tips (left to right).
  'xmas-candles': {
    kind: 'flame',
    points: [{ x: 0.1926, y: 0.1575 }, { x: 0.4325, y: 0.2825 }, { x: 0.5395, y: 0.0781 }, { x: 0.7203, y: 0.2344 }],
    coreIn: 0.55,
    haloIn: 2.4,
    poolIn: 14,
  },
  // The bulb is visible through the open front of the lantern cage.
  'lantern-hanging': {
    kind: 'bulb',
    points: [{ x: 0.5, y: 0.57 }],
    coreIn: 1.5,
    haloIn: 6,
    poolIn: 22,
  },
});

/** Any other lighting decor added to the library later: a bulb near the top of the artwork. */
export const DEFAULT_LIGHT = Object.freeze({ kind: 'bulb', points: [{ x: 0.5, y: 0.2 }], coreIn: 1, haloIn: 4, poolIn: 14 });

export const isLampDef = (def) => !!def && def.category === LAMP_CATEGORY;

const validLight = (g) =>
  g && typeof g === 'object' && Array.isArray(g.points) && g.points.length > 0 && g.points.every((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));

/** The light description for a lamp def: its own `glow` (if the library ever carries one), the table above, or the default. */
export function lightFor(def) {
  if (validLight(def?.glow)) return { ...DEFAULT_LIGHT, ...def.glow };
  return LAMP_LIGHTS[def?.id] ?? DEFAULT_LIGHT;
}

/**
 * Glow geometry for one placed lamp, in room inches.
 * @param {{decor:{id:string, decorId:string, placement:object}, def:object, size:{w:number,h:number}, x:number, y:number, top:number, mount:string}} entry
 *   one element of buildLayout(...).decor
 * @returns {{id:string, decorId:string, kind:string, flicker:boolean,
 *   lights:Array<{x:number, y:number, rx:number, ry:number, halo:number}>,
 *   pool:{x:number, y:number, r:number},
 *   ground:{x:number, y:number, rx:number, ry:number}|null}}
 */
export function lampGlow(entry) {
  const { decor, def, size, x, top } = entry;
  const L = lightFor(def);
  const k = def.heightIn > 0 ? size.h / def.heightIn : 1; // the seller's size tweak
  const lights = L.points.map((p) => {
    const rx = (p.rx ?? L.coreIn ?? 1) * k;
    const ry = (p.ry ?? p.rx ?? L.coreIn ?? 1) * k;
    return { x: x + p.x * size.w, y: top + p.y * size.h, rx, ry, halo: Math.max(rx, ry, (L.haloIn ?? 4) * k) };
  });
  const cx = lights.reduce((s, l) => s + l.x, 0) / lights.length;
  const cy = lights.reduce((s, l) => s + l.y, 0) / lights.length;
  const r = (L.poolIn ?? 14) * k;
  // Light on whatever the lamp stands on: a wide pool on the floor, a narrow strip on a shelf or table.
  // Hanging and wall lamps throw no ground pool.
  let ground = null;
  if (entry.mount !== 'wall') {
    const onFloor = decor.placement?.surfaceId === FLOOR_SURFACE_ID;
    ground = { x: x + size.w / 2, y: entry.y, rx: r * (onFloor ? 1.15 : 0.75), ry: r * (onFloor ? 0.3 : 0.1) };
  }
  return { id: decor.id, decorId: decor.decorId, kind: L.kind, flicker: L.kind === 'flame', lights, pool: { x: cx, y: cy, r }, ground };
}

/** Placed lamps that are switched on, as glow geometry. */
export function litLamps(layout) {
  return (layout?.decor ?? []).filter((e) => e.decor?.lit === true && isLampDef(e.def)).map(lampGlow);
}

/** True when at least one placed lamp is switched on (the shop view then shows its Lights button). */
export function anyLampLit(layout) {
  return (layout?.decor ?? []).some((e) => e.decor?.lit === true && isLampDef(e.def));
}
