// Thin, failure-proof wrapper around the audio module. The audio designer owns
// src/audio/audio.js; the UI never lets an audio error break gameplay.
import * as A from '../audio/audio.js';

let curTrack = undefined;
let unlocked = false;
const lastSfx = new Map();

export function sfx(name, opts) {
  if (!name) return;
  // Avoid machine-gun stacking of the same sound within a few ms.
  const now = performance.now();
  const last = lastSfx.get(name) || 0;
  if (now - last < 35) return;
  lastSfx.set(name, now);
  try { A.sfx(name, opts); } catch (e) { /* ignore */ }
}

export function music(track) {
  if (track === curTrack) return;
  curTrack = track;
  try { A.music(track); } catch (e) { /* ignore */ }
}

export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try { A.unlockAudio(); } catch (e) { /* ignore */ }
  // Re-issue the current track now that audio may play.
  const t = curTrack; curTrack = undefined; if (t !== undefined) music(t);
}

export function setVolume(kind, v) { try { A.setVolume(kind, v); } catch (e) { /* ignore */ } }
export function suspend() { try { A.suspend(); } catch (e) { /* ignore */ } }
export function resume() { try { A.resume(); } catch (e) { /* ignore */ } }
