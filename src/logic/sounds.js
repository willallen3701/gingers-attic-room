// Booth ambience (2026-11-17): the seller picks one background sound for the booth (or none) in the editor's
// "Light & sound" tab; it is saved as booth.room.sound (an id below, or null). Shoppers hear it only after they
// press the booth's Sound button: nothing ever plays by itself. The files and their licences are listed in
// ../assets-src/LICENSES.md (Sounds) and CREDITS.md. Pure: no DOM.

/**
 * THE switch for booth sounds. false (2026-11-17 release, sounds paused by the server owner): the editor shows no
 * sound picker (its tab is "Lighting" again) and shoppers get no Sound button. Saved choices (room.sound) are kept
 * untouched either way. Set to true to turn sounds back on; nothing else needs changing.
 */
export const SOUNDS_ENABLED = false;

export const SOUNDS = Object.freeze([
  Object.freeze({ id: 'fireplace', name: 'Crackling fireplace', src: 'assets/sounds/fireplace.mp3' }),
  Object.freeze({ id: 'rain', name: 'Rain on the window', src: 'assets/sounds/rain.mp3' }),
  Object.freeze({ id: 'record', name: 'Quiet record player', src: 'assets/sounds/record-player.mp3' }),
  Object.freeze({ id: 'clock', name: 'Grandfather clock', src: 'assets/sounds/grandfather-clock.mp3' }),
  Object.freeze({ id: 'shop', name: 'Shop chatter and doorbell', src: 'assets/sounds/shop-chatter.mp3' }),
]);

export const SOUND_IDS = Object.freeze(SOUNDS.map((s) => s.id));

/** Playback volume: ambience stays in the background. */
export const SOUND_VOLUME = 0.6;

/** The sound for an id, or null (no sound, or an id this app doesn't know). */
export const soundOf = (id) => SOUNDS.find((s) => s.id === id) ?? null;

/** A room's sound id, cleaned: a known id or null. */
export const roomSoundId = (room) => soundOf(room?.sound)?.id ?? null;
