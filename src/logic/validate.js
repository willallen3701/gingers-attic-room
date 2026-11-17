import { ROOM } from './room.js';

// Placement validation. Returns a list of { code, ... } problems; empty list = valid.
// Codes: UNKNOWN_SURFACE, WRONG_MOUNT, OUT_OF_ROOM, OFF_SURFACE, NO_HEADROOM,
//        OUT_OF_REGION, OVERLAP, BLOCKED_BY_FIXTURE.

const EPS = 0.01;
// Two standing floor items whose bases are this close (inches) are treated as side by side.
export const FLOOR_DEPTH_GAP_IN = 6;

const rect = (p, size) => ({ x1: p.x, x2: p.x + size.w, y1: p.y - size.h, y2: p.y });
const overlap1d = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1) > EPS;
const rectsOverlap = (a, b) => overlap1d(a.x1, a.x2, b.x1, b.x2) && overlap1d(a.y1, a.y2, b.y1, b.y2);

/**
 * @param {{id:string, mount:'stand'|'wall'|'flat', size:{w:number,h:number}, placement:{surfaceId:string,x:number,y:number}}} item
 * @param {{surfaces:Array, others?:Array, fixtureRects?:Array<{id:string,x1:number,x2:number,y1:number,y2:number}>}} ctx
 */
export function validatePlacement(item, ctx) {
  const errors = [];
  const { placement: p, size, mount } = item;
  const s = ctx.surfaces.find((x) => x.id === p.surfaceId);
  if (!s) return [{ code: 'UNKNOWN_SURFACE', surfaceId: p.surfaceId }];

  const mountOk =
    (mount === 'wall' && s.kind === 'wall') ||
    (mount === 'flat' && s.kind === 'floor') ||
    (mount === 'stand' && (s.kind === 'line' || s.kind === 'floor'));
  if (!mountOk) errors.push({ code: 'WRONG_MOUNT', mount, surfaceKind: s.kind });

  const r = rect(p, size);
  if (r.x1 < -EPS || r.x2 > ROOM.widthIn + EPS || r.y1 < -EPS || r.y2 > ROOM.heightIn + EPS) {
    errors.push({ code: 'OUT_OF_ROOM' });
  }

  if (s.kind === 'line') {
    if (Math.abs(p.y - s.y) > EPS || r.x1 < s.x1 - EPS || r.x2 > s.x2 + EPS) errors.push({ code: 'OFF_SURFACE' });
    if (size.h > s.headroomIn + EPS) errors.push({ code: 'NO_HEADROOM', headroomIn: s.headroomIn, heightIn: size.h });
  } else if (s.kind === 'wall' || s.kind === 'floor') {
    const topOk = s.kind === 'wall' ? r.y1 >= s.yMin - EPS : true;
    const baseOk = p.y >= s.yMin - EPS && p.y <= s.yMax + EPS;
    const flatInside = mount === 'flat' ? r.y1 >= s.yMin - EPS : true;
    if (!topOk || !baseOk || !flatInside) errors.push({ code: 'OUT_OF_REGION', region: s.kind });
  }

  for (const o of ctx.others ?? []) {
    if (o.id === item.id || !o.placement) continue;
    const or = rect(o.placement, o.size);
    let clash = false;
    if (s.kind === 'line') {
      clash = o.placement.surfaceId === p.surfaceId && overlap1d(r.x1, r.x2, or.x1, or.x2);
    } else if (s.kind === 'wall') {
      clash = o.placement.surfaceId === p.surfaceId && rectsOverlap(r, or);
    } else if (s.kind === 'floor' && o.placement.surfaceId === p.surfaceId) {
      if (mount === 'flat' && o.mount === 'flat') clash = rectsOverlap(r, or);
      else if (mount !== 'flat' && o.mount !== 'flat') {
        clash = overlap1d(r.x1, r.x2, or.x1, or.x2) && Math.abs(p.y - o.placement.y) < FLOOR_DEPTH_GAP_IN;
      }
      // a standing item on a rug is fine
    }
    if (clash) errors.push({ code: 'OVERLAP', withId: o.id });
  }

  if (s.kind === 'wall') {
    for (const f of ctx.fixtureRects ?? []) {
      if (rectsOverlap(r, f)) errors.push({ code: 'BLOCKED_BY_FIXTURE', fixtureId: f.id });
    }
  }
  return errors;
}

/** True while another item may be placed in the room (cap = 40 placed items; the rest wait in storage). */
export function canPlaceAnother(placedCount) {
  return placedCount < ROOM.maxPlacedItems;
}
