// Room coordinate system. Everything in the booth is measured in INCHES.
// Origin = top-left corner of the room. x grows right, y grows down.
// The room is square and drawn front-on: the back wall is the top 3/4 and the floor the bottom 1/4.
// A 10 ft wide room keeps real-size items legible (a 4 in teacup = 1/30 of the width).

export const ROOM = Object.freeze({
  widthIn: 120,
  heightIn: 120,
  wallHeightIn: 90, // wall spans y 0..90, floor spans y 90..120
  maxPlacedItems: 40,
});

/** Inches -> percent of the room's width (the room is square, so this also works for heights). */
export function pct(inches) {
  return (inches / ROOM.widthIn) * 100;
}

/** Pixels per inch for a room rendered `roomPx` pixels wide. */
export function pxPerInch(roomPx) {
  if (!(roomPx > 0)) throw new RangeError(`roomPx must be > 0, got ${roomPx}`);
  return roomPx / ROOM.widthIn;
}
