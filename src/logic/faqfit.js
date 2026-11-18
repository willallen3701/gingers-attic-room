// Fits the one open FAQ answer into the iframe it lives in.
//
// Why: a Wix HTML component has a fixed height set in the Editor, and page code cannot change it (the $w HtmlComponent
// API has no height or width; see README, "FAQ and the frame height"). The embed can read how tall its own frame is
// (window.innerHeight), so it fits itself to that instead of anyone guessing a number: an answer that would run past
// the bottom edge gets a maximum height and scrolls inside its own panel.
//
// All numbers are CSS px.
export const MIN_PANEL_PX = 200; // never squeeze an answer below this; the page scrolls inside the frame instead
export const SLACK_PX = 4; // rounding and border room

/**
 * @param {{frameH:number, contentH:number, answerH:number, minPanel?:number}} m
 *   frameH   height of the frame (window.innerHeight)
 *   contentH height of the whole FAQ with the answer at its natural height
 *   answerH  the open answer at its natural height
 * @returns {number|null} max-height for the open answer, or null when it already fits (or there is no usable frame)
 */
export function fitAnswerHeight({ frameH, contentH, answerH, minPanel = MIN_PANEL_PX }) {
  if (![frameH, contentH, answerH].every((n) => Number.isFinite(n) && n > 0)) return null;
  if (contentH <= frameH - SLACK_PX) return null; // everything fits as it is
  const available = frameH - (contentH - answerH) - SLACK_PX; // room left for the answer once the rest is drawn
  const cap = Math.floor(Math.max(available, minPanel));
  return cap >= answerH ? null : cap;
}
