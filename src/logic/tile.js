// Wallpaper / floor fill maths -> CSS background values.
// mode 'tile': the texture repeats; one tile covers texture.tileIn inches at scale 1.
// mode 'fill': one image covers the whole area (cover, centred).

export const SCALE_MIN = 0.25;
export const SCALE_MAX = 4;

export function clampScale(scale) {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return 1;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale));
}

/**
 * @param {{tileIn:{w:number,h:number}}} texture
 * @param {'tile'|'fill'} mode
 * @param {number} scale
 * @param {number} ppi  pixels per inch of the area being painted
 * @returns {{backgroundSize:string, backgroundRepeat:string, backgroundPosition:string, tilePx?:{w:number,h:number}}}
 */
export function backgroundFor(texture, mode, scale, ppi) {
  if (mode === 'fill') {
    return { backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' };
  }
  if (mode !== 'tile') throw new RangeError(`mode must be 'tile' or 'fill', got ${mode}`);
  if (!(ppi > 0)) throw new RangeError('ppi must be > 0');
  const s = clampScale(scale);
  const w = round2(texture.tileIn.w * s * ppi);
  const h = round2(texture.tileIn.h * s * ppi);
  return {
    backgroundSize: `${w}px ${h}px`,
    backgroundRepeat: 'repeat',
    backgroundPosition: 'left top',
    tilePx: { w, h },
  };
}

const round2 = (v) => Math.round(v * 100) / 100;
