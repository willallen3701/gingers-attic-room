import { ROOM } from './room.js';

// Snap a dropped item onto the nearest surface it fits on.
// A placement is { surfaceId, x, y } where x = LEFT edge and y = BASE (bottom edge), in room inches.
// mount: 'stand' (sits on shelves/tables/floor), 'wall' (hangs on the wall), 'flat' (lies on the floor: rugs),
//        'floor' (stands, but only on the floor: plant pots, coat stands, floor lamps).

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * @param {{x:number, y:number}} drop  where the item's bottom-centre was released (room inches)
 * @param {{w:number, h:number}} size  drawn size in inches
 * @param {Array} surfaces             from worldSurfaces()
 * @param {'stand'|'wall'|'flat'|'floor'} mount
 * @returns {{surfaceId:string, x:number, y:number} | null}  null when nothing can hold the item
 */
export function snapToSurface(drop, size, surfaces, mount = 'stand') {
  if (mount === 'floor') return snapToSurface(drop, size, surfaces.filter((s) => s.kind === 'floor'), 'stand');
  const { w, h } = size;
  if (mount === 'wall') {
    const wall = surfaces.find((s) => s.kind === 'wall');
    if (!wall || w > ROOM.widthIn || h > wall.yMax - wall.yMin) return null;
    return {
      surfaceId: wall.id,
      x: clamp(drop.x - w / 2, 0, ROOM.widthIn - w),
      y: clamp(drop.y, wall.yMin + h, wall.yMax),
    };
  }

  const floor = surfaces.find((s) => s.kind === 'floor');
  if (mount === 'flat') {
    if (!floor || w > floor.x2 - floor.x1) return null;
    const lo = Math.min(floor.yMin + h, floor.yMax);
    return {
      surfaceId: floor.id,
      x: clamp(drop.x - w / 2, floor.x1, floor.x2 - w),
      y: clamp(drop.y, lo, floor.yMax),
    };
  }

  // Standing item: nearest line (shelf/tabletop) that is wide and tall enough, or the floor.
  let best = null;
  for (const s of surfaces) {
    if (s.kind === 'wall') continue;
    if (s.x2 - s.x1 < w) continue;
    if (s.kind === 'line' && s.headroomIn < h) continue;
    let baseY;
    if (s.kind === 'floor') baseY = clamp(drop.y, s.yMin, s.yMax);
    else baseY = s.y;
    const dist = Math.abs(drop.y - baseY);
    // Prefer surfaces horizontally under the drop point; others pay a horizontal penalty.
    const hDist = drop.x < s.x1 ? s.x1 - drop.x : drop.x > s.x2 ? drop.x - s.x2 : 0;
    const score = dist + hDist * 2 + (s.kind === 'floor' ? 0.001 : 0); // lines win ties
    if (!best || score < best.score) best = { s, baseY, score };
  }
  if (!best) return null;
  const { s, baseY } = best;
  return {
    surfaceId: s.id,
    x: clamp(drop.x - w / 2, s.x1, s.x2 - w),
    y: baseY,
  };
}

/**
 * A shelf or tabletop right under the drop point that is wide enough but too low (not enough headroom) for the item.
 * Used only to explain a refusal: snapToSurface() silently skips such a shelf and falls back to the nearest other
 * surface, so without this a too-tall item is refused with an unrelated "overlap" message.
 * @returns {object|null} the nearest such surface, or null
 */
export function shelfTooShort(drop, size, surfaces, reach = 14) {
  let best = null;
  for (const s of surfaces) {
    if (s.kind !== 'line' || s.x2 - s.x1 < size.w || s.headroomIn >= size.h) continue;
    if (drop.x < s.x1 || drop.x > s.x2 || Math.abs(drop.y - s.y) > reach) continue;
    if (!best || Math.abs(drop.y - s.y) < Math.abs(drop.y - best.y)) best = s;
  }
  return best;
}
