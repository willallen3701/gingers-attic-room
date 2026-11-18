// Wallpapers: a wallpaper flagged `hidden: true` is no longer offered in the picker, but a booth that already uses it keeps
// rendering and saving (the live site validates wallpaper ids against the same library.json).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { normalizeLibrary, pickerWallpapers } from '../src/logic/library.js';
import { textureFor } from '../src/room-render.js';
import { TEMPLATES } from '../src/logic/templates.js';
import { applyDraft, toDraft, defaultRoom } from '../src/logic/draft.js';
import { cleanDraft } from '../../site/src/backend/boothShape.js';

const root = new URL('../', import.meta.url);
const rawLib = JSON.parse(readFileSync(new URL('data/library.json', root), 'utf8'));
const lib = normalizeLibrary(rawLib);
const HIDDEN = 'wp-rose-trellis';
const wall = (textureId) => ({ type: 'wallpaper', textureId, mode: 'tile', scale: 1 });

describe('hidden wallpapers', () => {
  it('the old Rose Trellis is hidden but still in the library, with its image', () => {
    const w = rawLib.wallpapers.find((x) => x.id === HIDDEN);
    expect(w?.hidden).toBe(true);
    expect(existsSync(new URL(w.src, root))).toBe(true);
    // only the flagged one is hidden
    expect(rawLib.wallpapers.filter((x) => x.hidden).map((x) => x.id)).toEqual([HIDDEN]);
  });

  it('the picker does not offer a hidden wallpaper, but offers the rest, including Blue Vine Trellis and the new one', () => {
    const ids = pickerWallpapers(lib, wall('wp-floral-blue')).map((x) => x.id);
    expect(ids).not.toContain(HIDDEN);
    expect(ids).toContain('wp-floral-blue');
    expect(ids).toContain('wp-gold-lattice');
    expect(ids.length).toBe(rawLib.wallpapers.length - 1);
    // paint, an uploaded photo or no choice at all never bring it back
    expect(pickerWallpapers(lib, { type: 'paint', paintId: 'paint-sage' }).map((x) => x.id)).not.toContain(HIDDEN);
    expect(pickerWallpapers(lib, { src: 'https://example.test/u.jpg' }).map((x) => x.id)).not.toContain(HIDDEN);
    expect(pickerWallpapers(lib, null).map((x) => x.id)).not.toContain(HIDDEN);
  });

  it('a booth that already uses it still sees it in the picker (as the current choice), so it can be changed', () => {
    expect(pickerWallpapers(lib, wall(HIDDEN)).map((x) => x.id)).toContain(HIDDEN);
  });

  it('still renders: the renderer resolves the hidden wallpaper from the full library', () => {
    const tex = textureFor(lib.wallpapers, wall(HIDDEN));
    expect(tex?.id).toBe(HIDDEN);
    expect(tex.tileIn.w).toBeGreaterThan(0);
    expect(existsSync(new URL(tex.src, root))).toBe(true);
  });

  it('still saves: the site accepts a draft that uses it, and keeps it, while an unknown id is still refused', () => {
    const ok = cleanDraft({ room: { wall: wall(HIDDEN) }, placements: {} }, { lib: rawLib, itemIds: [], uploadSrcs: [] });
    expect(ok.ok).toBe(true);
    expect(ok.draft.room.wall.textureId).toBe(HIDDEN);
    const bad = cleanDraft({ room: { wall: wall('wp-not-a-wallpaper') }, placements: {} }, { lib: rawLib, itemIds: [], uploadSrcs: [] });
    expect(bad.ok).toBe(false);
  });

  it('a saved booth with it survives the editor round trip (draft out, draft back in)', () => {
    const booth = { id: 'b', name: 'T', boothNumber: 1, room: { ...defaultRoom(lib), wall: wall(HIDDEN) }, fixtures: [], decor: [], boxes: [], items: [] };
    const d = toDraft(booth);
    expect(d.room.wall.textureId).toBe(HIDDEN);
    const back = applyDraft({ ...booth, room: defaultRoom(lib) }, d, lib);
    expect((back.booth ?? back).room.wall.textureId).toBe(HIDDEN);
  });

  it('no template uses a hidden wallpaper', () => {
    const hidden = new Set(rawLib.wallpapers.filter((x) => x.hidden).map((x) => x.id));
    for (const t of TEMPLATES) if (t.wall.wallpaper) expect(hidden.has(t.wall.wallpaper)).toBe(false);
  });
});

describe('wallpaper sources', () => {
  it('no two wallpapers in the additions licence file come from the same museum object', () => {
    const md = readFileSync(new URL('LICENSES-library-additions.md', root), 'utf8');
    const seen = new Map();
    for (const line of md.split(/\r?\n/)) {
      const m = line.match(/^\| `room-app\/assets\/textures\/wallpapers\/([^`]+)` \|.*?asitem\/id\/(\d+)\)/);
      if (!m) continue;
      expect(seen.has(m[2]), `${m[1]} repeats object ${m[2]} (${seen.get(m[2])})`).toBe(false);
      seen.set(m[2], m[1]);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it('every wallpaper in the library has an image and a licence row', () => {
    const md = readFileSync(new URL('LICENSES-library-additions.md', root), 'utf8');
    for (const id of ['wp-gold-lattice', 'wp-crimson-damask', 'wp-coral-damask', 'wp-acanthus-leaf']) {
      expect(md.includes(`wallpapers/${id}.jpg`)).toBe(true);
    }
    for (const w of rawLib.wallpapers) expect(existsSync(new URL(w.src, root))).toBe(true);
  });

  it('the removed duplicate (Red Rose Bouquets) is gone from the library and the files', () => {
    expect(rawLib.wallpapers.find((x) => x.id === 'wp-red-roses')).toBeUndefined();
    expect(existsSync(new URL('assets/textures/wallpapers/wp-red-roses.jpg', root))).toBe(false);
    expect(readFileSync(new URL('LICENSES-library-additions.md', root), 'utf8')).not.toMatch(/wp-red-roses/);
  });
});
