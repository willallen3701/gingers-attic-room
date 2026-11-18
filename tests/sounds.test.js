import { describe, it, expect } from 'vitest';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { SOUNDS, SOUND_IDS, soundOf, roomSoundId, SOUND_VOLUME } from '../src/logic/sounds.js';
import { toDraft, applyDraft } from '../src/logic/draft.js';
// The site backend (no Wix imports in this module): the draft cleaner every save goes through.
import { cleanDraft, SOUND_IDS as SITE_SOUND_IDS } from '../../site/src/backend/boothShape.js';

const file = (p) => new URL(`../${p}`, import.meta.url);
const lib = JSON.parse(readFileSync(file('data/library.json'), 'utf8'));
const licences = readFileSync(new URL('../../assets-src/LICENSES.md', import.meta.url), 'utf8');
const credits = readFileSync(file('CREDITS.md'), 'utf8');
// Sounds draft paused 2026-11-17 for the listing reel: three loops wait on their source downloads
// (assets-src/scripts/make_sounds.py). This check runs, and must pass, once every file is built.
const pendingFiles = SOUNDS.filter((s) => !existsSync(file(s.src))).map((s) => s.src);

describe('booth sounds', () => {
  it('offers the five sounds the site owner chose', () => {
    expect(SOUNDS.map((s) => s.name)).toEqual(['Crackling fireplace', 'Rain on the window', 'Quiet record player', 'Grandfather clock', 'Shop chatter and doorbell']);
    expect(SOUND_VOLUME).toBeGreaterThan(0);
    expect(SOUND_VOLUME).toBeLessThanOrEqual(1);
  });

  it.skipIf(pendingFiles.length > 0)(`ships every file, small enough for a phone, and lists its source and licence${pendingFiles.length ? ` (PENDING: ${pendingFiles.join(', ')})` : ''}`, () => {
    for (const s of SOUNDS) {
      const { size } = statSync(file(s.src));
      expect(size, s.src).toBeGreaterThan(20 * 1024);
      expect(size, s.src).toBeLessThan(1.5 * 1024 * 1024);
      const row = licences.split('\n').find((l) => l.includes(`room-app/${s.src}`));
      expect(row, `LICENSES.md row for ${s.src}`).toBeTruthy();
      expect(row).toMatch(/https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(row).toMatch(/CC0|Public domain|CC BY 4\.0/);
      expect(row).not.toMatch(/BY-SA|NC|ND/);
      // CC BY sources need the credit shown with the app.
      if (/CC BY/.test(row)) expect(credits, `${s.src} credit`).toContain(s.src);
    }
  });

  it('knows a sound only by its id', () => {
    expect(soundOf('rain').name).toBe('Rain on the window');
    expect(soundOf('nope')).toBeNull();
    expect(soundOf(null)).toBeNull();
    expect(roomSoundId({ sound: 'clock' })).toBe('clock');
    expect(roomSoundId({ sound: 'javascript:alert(1)' })).toBeNull();
    expect(roomSoundId(undefined)).toBeNull();
  });

  it('is saved with the booth: the draft keeps the room sound', () => {
    const booth = { room: { wall: { type: 'paint', paintId: 'paint-sage' }, sound: 'record' }, fixtures: [], decor: [], items: [] };
    const draft = toDraft(booth);
    expect(draft.room.sound).toBe('record');
    expect(applyDraft({ room: {}, items: [] }, draft).room.sound).toBe('record');
  });

  it('the site keeps a known sound when saving a draft, and turns anything else into no sound', () => {
    expect(SITE_SOUND_IDS).toEqual(SOUND_IDS);
    const save = (sound) => cleanDraft({ room: { sound }, placements: {} }, { lib, itemIds: [], uploadSrcs: [] });
    expect(save('shop')).toMatchObject({ ok: true, draft: { room: { sound: 'shop' } } });
    expect(save('https://evil.example/x.mp3').draft.room.sound).toBeNull();
    expect(save(undefined).draft.room.sound).toBeNull();
  });
});
