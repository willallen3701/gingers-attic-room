import { ROOM } from './room.js';

// A surface is a horizontal line items can stand on (shelf board top, tabletop),
// or a region (floor band, wall area). Fixtures define surfaces in FIXTURE-LOCAL inches;
// worldSurfaces() converts them to room coordinates.

export const FLOOR_SURFACE_ID = 'floor';
export const WALL_SURFACE_ID = 'wall';
const FLOOR_FRONT_MARGIN_IN = 0.5;
const FLOOR_BACK_MARGIN_IN = 1;

/**
 * @param {Array<{id:string, fixtureId:string, x:number, y:number}>} placedFixtures
 * @param {Record<string, {surfaces:Array<{id:string,x1:number,x2:number,y:number}>, boardThicknessIn?:number, widthIn:number, heightIn:number}>} fixtureDefs
 * @returns {Array<{id:string, kind:'line'|'floor'|'wall', x1:number, x2:number, y:number, yMin?:number, yMax?:number, headroomIn:number, fixtureInstanceId?:string}>}
 */
export function worldSurfaces(placedFixtures, fixtureDefs) {
  const lines = [];
  for (const pf of placedFixtures) {
    const def = fixtureDefs[pf.fixtureId];
    if (!def) throw new Error(`Unknown fixture ${pf.fixtureId}`);
    for (const s of def.surfaces) {
      lines.push({
        id: `${pf.id}:${s.id}`,
        kind: 'line',
        x1: pf.x + s.x1,
        x2: pf.x + s.x2,
        y: pf.y + s.y,
        thicknessIn: def.boardThicknessIn ?? 1,
        fixtureInstanceId: pf.id,
      });
    }
  }
  // Headroom: distance from a line up to the underside of the nearest overlapping line above it
  // (or up to the ceiling).
  for (const s of lines) {
    let ceiling = 0;
    for (const o of lines) {
      if (o === s || o.y >= s.y) continue;
      const overlaps = o.x1 < s.x2 && o.x2 > s.x1;
      if (overlaps) ceiling = Math.max(ceiling, o.y + o.thicknessIn);
    }
    s.headroomIn = s.y - ceiling;
  }
  const floor = {
    id: FLOOR_SURFACE_ID,
    kind: 'floor',
    x1: 0,
    x2: ROOM.widthIn,
    yMin: ROOM.wallHeightIn + FLOOR_BACK_MARGIN_IN,
    yMax: ROOM.heightIn - FLOOR_FRONT_MARGIN_IN,
    y: ROOM.heightIn - FLOOR_FRONT_MARGIN_IN,
    headroomIn: ROOM.heightIn, // standing floor items may rise in front of the wall
  };
  const wall = {
    id: WALL_SURFACE_ID,
    kind: 'wall',
    x1: 0,
    x2: ROOM.widthIn,
    yMin: 0,
    yMax: ROOM.wallHeightIn,
    y: ROOM.wallHeightIn,
    headroomIn: ROOM.wallHeightIn,
  };
  return [...lines, floor, wall];
}
