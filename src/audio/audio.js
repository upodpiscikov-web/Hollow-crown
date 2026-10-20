// =============================================================================
// THE HOLLOW CROWN — audio engine. Everything is synthesized with WebAudio at
// runtime: no audio files.
//
// Public API (stable; the UI calls exactly these):
//   unlockAudio()           call on a user gesture (creates the AudioContext lazily)
//   sfx(name, opts?)        one-shot sound effect. opts: { amount, pitch, volume, pan }
//                           unknown names are silently ignored
//   music(track)            'title' | 'hub' | 'act1' | 'act2' | 'act3' | 'act4' | 'boss' |
//                           'elite' | 'shop' | 'rest' | 'event' | 'victory' | 'death' | null
//   setVolume(kind, v)      kind 'music' | 'sfx', v 0..1 (defaults 0.5 / 0.7)
//   suspend() / resume()    page visibility: pause / restart the AudioContext
//
// Every function is a safe no-op before unlockAudio(), without WebAudio, and in
// Node (importing this module never touches `window` at load time).
//
// Graph (built once):
//   sfx voices ──> sDry ─────────────────────────┐
//              └─> sWet ──┐                      │
//   track ─> fade ─> mDry ─> mDuck ──────────────┤
//        └─> fadeW ─> mWet ─> mDuckW ─┐          ├─> master ─> compressor ─> out
//                                     ├─> verbIn ─> HP ─> Convolver ─> verbOut ┘
//                         sWet ───────┘   (one shared reverb, generated impulse)
//
// Music is generative: each track is a set of "layers" (drones, pads, melodies,
// bells, percussion grids) stepped by a lookahead scheduler (setTimeout 100 ms,
// 300 ms horizon). Voices are capped (≤ 9 music + ≤ 6 sfx); every finished voice
// disconnects all of its nodes.
// =============================================================================

const W = typeof window !== 'undefined' ? window : null;
const AC = W ? (W.AudioContext || W.webkitAudioContext || null) : null;

const LOOKAHEAD = 0.3;     // seconds scheduled ahead of currentTime
const TICK_MS = 100;       // scheduler wake-up period
const XFADE = 1.5;         // music crossfade, seconds
const MAX_SFX = 6;         // simultaneous sfx voices (oldest/lowest priority stolen)
const MAX_MUSIC = 9;       // music voices; non-essential notes are skipped beyond this
const IDLE_S = 20;         // auto-suspend the context after this long of total silence
const MUSIC_GAIN = 1.0;    // bus calibration (see tools/scratch/audio)
const SFX_GAIN = 1.0;

const HAS = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const semis = (s) => Math.pow(2, s / 12);
const curve = (v) => v * v; // perceptual slider curve

let ctx = null;
let G = null;                       // shared graph nodes and buffers
const vol = { music: 0.5, sfx: 0.7 };
let userPaused = false;             // suspend() called by the UI
let idlePaused = false;             // we suspended the context ourselves (silence)
let wanted = null;                  // track the UI asked for
let inst = null;                    // running track instance
let timer = null;
let idleTimer = null;
let lastSfx = 0;
const lastByName = Object.create(null);
const sfxVoices = [];
let musicVoices = 0;

// -----------------------------------------------------------------------------
// Voice: a group of nodes that live and die together.
// -----------------------------------------------------------------------------
class Voice {
  constructor(dry, wet, wetAmt, level, pan) {
    this.nodes = [];
    this.srcs = [];
    this.end = 0;
    this.anchor = null;
    this.dead = false;
    this.onfree = null;
    this.pri = 1;
    const out = (this.out = ctx.createGain());
    out.gain.value = level;
    this.nodes.push(out);
    let tail = out;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      out.connect(p);
      tail = p;
      this.nodes.push(p);
    }
    tail.connect(dry);
    if (wet && wetAmt > 0) {
      const w = ctx.createGain();
      w.gain.value = wetAmt;
      tail.connect(w);
      w.connect(wet);
      this.nodes.push(w);
    }
  }
  gain(v, dest) {
    const g = ctx.createGain();
    g.gain.value = v;
    const d = dest === undefined ? this.out : dest;
    if (d) g.connect(d);
    this.nodes.push(g);
    return g;
  }
  filter(type, f, q, dest) {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    const d = dest === undefined ? this.out : dest;
    if (d) b.connect(d);
    this.nodes.push(b);
    return b;
  }
  _src(s, t0, t1, dest, off) {
    const d = dest === undefined ? this.out : dest;
    if (d) s.connect(d);
    if (off) s.start(t0, off);
    else s.start(t0);
    s.stop(t1);
    this.nodes.push(s);
    this.srcs.push(s);
    if (t1 >= this.end) {
      this.end = t1;
      this.anchor = s;
    }
    return s;
  }
  osc(type, f, t0, t1, dest) {
    const o = ctx.createOscillator();
    if (typeof type === 'string') o.type = type;
    else o.setPeriodicWave(type);
    o.frequency.setValueAtTime(f, t0);
    return this._src(o, t0, t1, dest);
  }
  noise(buf, t0, t1, dest, rate) {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    if (rate && rate !== 1) s.playbackRate.value = rate;
    return this._src(s, t0, t1, dest, Math.random() * buf.duration * 0.8);
  }
  done() {
    if (this.anchor) this.anchor.onended = () => this.free();
    else this.free();
    return this;
  }
  free() {
    if (this.dead) return;
    this.dead = true;
    for (const n of this.nodes) {
      try { n.disconnect(); } catch (e) { /* already gone */ }
    }
    this.nodes.length = 0;
    this.srcs.length = 0;
    if (this.anchor) this.anchor.onended = null;
    this.anchor = null;
    const f = this.onfree;
    this.onfree = null;
    if (f) f(this);
  }
  kill(fade = 0.05) {
    if (this.dead) return;
    const t = ctx.currentTime;
    try {
      const g = this.out.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + fade);
    } catch (e) { /* ignore */ }
    for (const s of this.srcs) {
      try { s.stop(t + fade + 0.02); } catch (e) { /* old Safari: single stop() only */ }
    }
    setTimeout(() => this.free(), (fade + 0.25) * 1000);
  }
}

// ---- envelopes ---------------------------------------------------------------
function perc(p, t, peak, a, d) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(Math.max(peak, 1e-4), t + Math.max(a, 0.001));
  p.exponentialRampToValueAtTime(1e-4, t + Math.max(a, 0.001) + d);
}
function swell(p, t, peak, a, hold, r) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setValueAtTime(peak, t + a + hold);
  p.setTargetAtTime(0, t + a + hold, r / 5);
}

// ---- synthesis building blocks (all add nodes to voice V) ----------------------
// Oscillator with a percussive envelope; o: { a, f1 (glide target), g (glide time), dest }
function tone(V, type, f, t, d, v, o) {
  o = o || {};
  const a = o.a ?? 0.004;
  const g = V.gain(0, o.dest);
  perc(g.gain, t, v, a, d);
  const s = V.osc(type, f, t, t + a + d + 0.03, g);
  if (o.f1) s.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 1), t + (o.g ?? a + d));
  return s;
}
// Filtered noise burst; o: { type, f, f1 (sweep target), q, a, brown, rate, dest }
function hiss(V, t, d, v, o) {
  o = o || {};
  const a = o.a ?? 0.003;
  const g = V.gain(0, o.dest);
  perc(g.gain, t, v, a, d);
  const f0 = o.f || 1000;
  const fl = V.filter(o.type || 'bandpass', f0, o.q ?? 1, g);
  if (o.f1) {
    fl.frequency.setValueAtTime(f0, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 20), t + a + d);
  }
  V.noise(o.brown ? G.brown : G.white, t, t + a + d + 0.03, fl, o.rate);
}
// Two-operator FM: bells, clangs, coins, glass. Index decays for a natural strike.
function fm(V, f, ratio, index, t, d, v, o) {
  o = o || {};
  const g = V.gain(0, o.dest);
  perc(g.gain, t, v, o.a ?? 0.002, d);
  const end = t + d + 0.05;
  const car = V.osc('sine', f, t, end, g);
  const mg = V.gain(0, car.frequency);
  mg.gain.setValueAtTime(f * index, t);
  mg.gain.exponentialRampToValueAtTime(Math.max(f * index * 0.06, 0.5), t + d * (o.id ?? 0.6));
  V.osc('sine', f * ratio, t, end, mg);
  return car;
}
// Pitch-dropping body thump plus an octave partial so it reads on phone speakers.
function thump(V, t, f0, f1, d, v, o) {
  o = o || {};
  tone(V, 'sine', f0, t, d, v, { f1, g: d * 0.45, a: 0.002, dest: o.dest });
  tone(V, 'triangle', f0 * 2, t, d * 0.35, v * 0.3, { f1: f1 * 2, g: d * 0.3, a: 0.002, dest: o.dest });
}

// =============================================================================
// SFX
// Each recipe: (V, t, p = pitch multiplier, k = intensity 0..1, o = opts)
// =============================================================================
const SFX = {
  click(V, t, p) {
    hiss(V, t, 0.02, 0.2, { f: 3200 * p, q: 2.5 });
    tone(V, 'triangle', 1100 * p, t, 0.035, 0.14, { f1: 620 * p });
  },
  hover(V, t, p) {
    tone(V, 'sine', 1900 * p, t, 0.03, 0.05, { f1: 2250 * p, a: 0.003 });
  },
  card_draw(V, t, p) {
    hiss(V, t, 0.09, 0.16, { f: 1400 * p, f1: 4200 * p, q: 1.1, a: 0.012 });
    hiss(V, t + 0.01, 0.05, 0.06, { type: 'lowpass', f: 900 });
  },
  card_play(V, t, p) {
    hiss(V, t, 0.13, 0.22, { f: 700 * p, f1: 2600 * p, q: 0.9, a: 0.02 });
    tone(V, 'sine', 190 * p, t + 0.05, 0.12, 0.32, { f1: 70 * p });
  },
  card_select(V, t, p) {
    hiss(V, t, 0.04, 0.1, { f: 2600 * p, q: 1.5 });
    tone(V, 'triangle', 520 * p, t, 0.08, 0.12, { f1: 780 * p });
    tone(V, 'sine', 1560 * p, t + 0.02, 0.14, 0.035);
  },
  attack_light(V, t, p) {
    hiss(V, t, 0.13, 0.3, { type: 'highpass', f: 1600 * p, f1: 5200 * p, q: 0.8, a: 0.03 });
    fm(V, 2600 * p, 1.41, 1.5, t + 0.05, 0.22, 0.06);
  },
  attack_heavy(V, t, p) {
    hiss(V, t, 0.24, 0.38, { f: 280 * p, f1: 1300 * p, q: 0.8, a: 0.09 });
    thump(V, t + 0.13, 110 * p, 38 * p, 0.38, 0.5);
    hiss(V, t + 0.13, 0.12, 0.28, { type: 'lowpass', f: 1300 });
  },
  hit(V, t, p, k) {
    thump(V, t, 150 * p, 46 * p, 0.12 + 0.24 * k, 0.32 + 0.4 * k);
    hiss(V, t, 0.04 + 0.12 * k, 0.22 + 0.32 * k, { type: 'lowpass', f: 1400 + 2600 * k, q: 0.7 });
    hiss(V, t, 0.035, 0.22, { f: 900 * p, q: 1.4 }); // mid "slap": audible on small speakers
    if (k > 0.55) tone(V, 'square', 72 * p, t, 0.09, 0.07 * k, { f1: 42 * p, dest: V.filter('lowpass', 500, 0.7) });
  },
  crit(V, t, p) {
    SFX.hit(V, t, p, 1);
    fm(V, 1480 * p, 2.76, 2.2, t + 0.01, 0.6, 0.1);
    hiss(V, t + 0.02, 0.25, 0.1, { type: 'highpass', f: 5500 });
    tone(V, 'sine', 3000 * p, t + 0.03, 0.3, 0.04, { f1: 1700 * p });
  },
  block(V, t, p, k) {
    fm(V, 420 * p, 2.41, 2.6, t, 0.32 + 0.15 * k, 0.2);
    hiss(V, t, 0.03, 0.26, { f: 2600 * p, q: 2 });
    tone(V, 'triangle', 840 * p, t, 0.2, 0.06);
    thump(V, t, 140 * p, 80 * p, 0.1, 0.18);
  },
  block_break(V, t, p) {
    hiss(V, t, 0.42, 0.28, { type: 'highpass', f: 2200, q: 0.6, a: 0.002 });
    for (let i = 0; i < 4; i++) fm(V, rnd(2200, 4800) * p, rnd(1.3, 2.9), 1.2, t + rnd(0, 0.13), rnd(0.12, 0.28), 0.05);
    thump(V, t, 160 * p, 55 * p, 0.22, 0.32);
    tone(V, 'triangle', 620 * p, t + 0.02, 0.32, 0.09, { f1: 210 * p });
  },
  buff(V, t, p) {
    [440, 659.3, 880].forEach((f, i) => {
      tone(V, 'triangle', f * p, t + i * 0.065, 0.36, 0.1, { a: 0.01 });
      tone(V, 'sine', f * 2 * p, t + i * 0.065, 0.25, 0.025);
    });
    hiss(V, t, 0.32, 0.05, { type: 'highpass', f: 3500, a: 0.15 });
  },
  debuff(V, t, p) {
    const lp = V.filter('lowpass', 2200, 2);
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.45);
    tone(V, 'sawtooth', 300 * p, t, 0.45, 0.09, { f1: 230 * p, dest: lp, a: 0.01 });
    tone(V, 'sawtooth', 318 * p, t, 0.45, 0.09, { f1: 244 * p, dest: lp, a: 0.01 });
    tone(V, 'sine', 220 * p, t, 0.45, 0.1, { f1: 140 * p });
  },
  rot(V, t, p, k) {
    const n = 3 + Math.round(2 * k);
    for (let i = 0; i < n; i++) {
      const f = rnd(230, 480) * p;
      tone(V, 'sine', f, t + rnd(0, 0.32), 0.07, 0.12, { f1: f * 2.3, g: 0.05, a: 0.003 });
    }
    hiss(V, t, 0.3, 0.12, { type: 'lowpass', f: 480, a: 0.05 });
    tone(V, 'sine', 112 * p, t, 0.35, 0.09, { f1: 96 * p, a: 0.03 });
  },
  heal(V, t, p) {
    [587.3, 880, 1174.7].forEach((f, i) => tone(V, 'sine', f * p, t + i * 0.045, 0.9, 0.085, { a: 0.02 }));
    tone(V, 'triangle', 293.7 * p, t, 0.7, 0.06, { a: 0.03 });
    hiss(V, t, 0.4, 0.03, { type: 'highpass', f: 4500, a: 0.12 });
  },
  gold(V, t, p, k, o) {
    const n = clamp(Math.round(2 + (Number(o.amount) || 0) / 25), 2, 5);
    let tt = t;
    for (let i = 0; i < n; i++) {
      fm(V, rnd(2900, 4300) * p, 1.53, 1.4, tt, rnd(0.14, 0.22), 0.07);
      tt += rnd(0.045, 0.085);
    }
  },
  relic(V, t, p) {
    fm(V, 220 * p, 1.4, 2.4, t, 1.8, 0.16, { id: 0.4 });
    [880, 1318.5, 1760, 2217.5].forEach((f, i) => tone(V, 'sine', f * p, t + 0.08 + i * 0.07, 1.0, 0.045, { a: 0.01 }));
    hiss(V, t, 0.6, 0.035, { type: 'highpass', f: 4200, a: 0.35 });
  },
  potion(V, t, p) {
    fm(V, 2350 * p, 2.0, 1.0, t, 0.25, 0.09);
    for (let i = 0; i < 3; i++) {
      const f = rnd(520, 700) * p;
      tone(V, 'sine', f, t + 0.12 + i * 0.09, 0.08, 0.13, { f1: f * 0.55, g: 0.06 });
    }
  },
  enemy_death(V, t, p) {
    const lp = V.filter('lowpass', 1100, 1.2);
    lp.frequency.setValueAtTime(1100, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.9);
    tone(V, 'sawtooth', 140 * p, t, 0.9, 0.13, { f1: 44 * p, a: 0.03, dest: lp });
    hiss(V, t, 0.8, 0.16, { f: 650, f1: 200, q: 1.1, a: 0.06 });
    thump(V, t, 95 * p, 36 * p, 0.4, 0.34);
    hiss(V, t + 0.28, 0.15, 0.22, { type: 'lowpass', f: 800 });
    thump(V, t + 0.28, 80 * p, 40 * p, 0.2, 0.2);
  },
  player_hurt(V, t, p) {
    thump(V, t, 120 * p, 44 * p, 0.25, 0.5);
    hiss(V, t, 0.12, 0.28, { f: 760 * p, q: 1.2 });
    tone(V, 'sawtooth', 210 * p, t, 0.16, 0.07, { f1: 120 * p, dest: V.filter('lowpass', 750, 0.8) });
  },
  player_death(V, t, p) {
    fm(V, 98 * p, 1.4, 3, t, 4.5, 0.24, { id: 0.5 });
    tone(V, 'sine', 49 * p, t, 4.2, 0.12, { a: 0.01 });
    hiss(V, t + 0.1, 3, 0.14, { f: 1200, f1: 180, q: 1.2, a: 0.4 });
    const bp = V.filter('bandpass', 700, 3);
    [147, 220.5].forEach((f) => tone(V, 'sawtooth', f * p, t + 0.2, 2.6, 0.07, { a: 1.0, f1: f * 0.89 * p, dest: bp }));
  },
  end_turn(V, t, p) {
    hiss(V, t, 0.18, 0.13, { f: 1200, f1: 380, q: 0.9, a: 0.01 });
    tone(V, 'triangle', 196 * p, t + 0.02, 0.38, 0.13);
    tone(V, 'sine', 293.7 * p, t + 0.02, 0.3, 0.06);
  },
  turn_start(V, t, p) {
    tone(V, 'triangle', 392 * p, t, 0.4, 0.09, { a: 0.008 });
    tone(V, 'triangle', 587.3 * p, t + 0.085, 0.45, 0.09, { a: 0.008 });
    fm(V, 784 * p, 3.5, 1, t + 0.085, 0.6, 0.035);
  },
  shuffle(V, t, p) {
    for (let i = 0; i < 9; i++) hiss(V, t + i * 0.032 + rnd(0, 0.01), 0.022, rnd(0.07, 0.13), { f: rnd(2400, 4200) * p, q: 1.6 });
    hiss(V, t + 0.32, 0.04, 0.15, { type: 'lowpass', f: 1500 });
  },
  exhaust(V, t, p) {
    hiss(V, t, 0.38, 0.24, { f: 480 * p, f1: 3600 * p, q: 0.7, a: 0.06 });
    for (let i = 0; i < 5; i++) hiss(V, t + rnd(0.05, 0.4), 0.01, rnd(0.06, 0.12), { type: 'highpass', f: 3000 });
    tone(V, 'sine', 300 * p, t, 0.4, 0.03, { f1: 900 * p, a: 0.1 });
  },
  mask_shift(V, t, p) {
    tone(V, 'triangle', 650 * p, t, 0.06, 0.18, { f1: 420 * p });
    hiss(V, t, 0.03, 0.14, { f: 1800, q: 2 });
    tone(V, 'sine', 440 * p, t + 0.04, 0.5, 0.07, { f1: 660 * p, g: 0.3, a: 0.06 });
    tone(V, 'sine', 444 * p, t + 0.04, 0.5, 0.05, { f1: 652 * p, g: 0.35, a: 0.08 });
    hiss(V, t + 0.03, 0.3, 0.1, { f: 900, f1: 2100, q: 1, a: 0.1 });
  },
  channel(V, t, p) {
    tone(V, 'sine', 330 * p, t, 0.6, 0.09, { f1: 660 * p, g: 0.4, a: 0.15 });
    hiss(V, t, 0.5, 0.09, { f: 820, q: 6, a: 0.2 });
    tone(V, 'sine', 990 * p, t + 0.15, 0.5, 0.03, { a: 0.1 });
  },
  release(V, t, p) {
    hiss(V, t, 0.3, 0.3, { f: 2600 * p, f1: 600 * p, q: 1, a: 0.005 });
    tone(V, 'sine', 880 * p, t, 0.35, 0.1, { f1: 330 * p });
    fm(V, 1320 * p, 3.5, 1.2, t + 0.02, 0.5, 0.06);
  },
  brew(V, t, p) {
    for (let i = 0; i < 6; i++) {
      const f = rnd(180, 420) * p;
      tone(V, 'sine', f, t + rnd(0, 0.45), 0.08, 0.12, { f1: f * 2.4, g: 0.06 });
    }
    hiss(V, t, 0.5, 0.1, { type: 'lowpass', f: 420, a: 0.1 });
    fm(V, 2000 * p, 2.0, 1.0, t + 0.42, 0.3, 0.06);
  },
  oath(V, t, p) {
    const lp = V.filter('lowpass', 300, 1);
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.linearRampToValueAtTime(1500, t + 0.15);
    lp.frequency.exponentialRampToValueAtTime(500, t + 1.0);
    [146.8, 220, 293.7].forEach((f) => tone(V, 'sawtooth', f * p, t, 0.95, 0.06, { a: 0.12, dest: lp }));
    fm(V, 146.8 * p, 1.4, 2, t + 0.05, 1.6, 0.12, { id: 0.45 });
  },
  oath_done(V, t, p) {
    fm(V, 293.7 * p, 1.4, 2.4, t, 2, 0.13, { id: 0.45 });
    const lp = V.filter('lowpass', 400, 1);
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.linearRampToValueAtTime(2000, t + 0.12);
    lp.frequency.exponentialRampToValueAtTime(700, t + 1.3);
    [146.8, 220, 293.7, 370].forEach((f, i) => tone(V, 'sawtooth', f * p, t + i * 0.04, 1.2, 0.045, { a: 0.08, dest: lp }));
    fm(V, 1174.7 * p, 3.5, 1.2, t + 0.15, 1.2, 0.05);
  },
  map_step(V, t, p) {
    hiss(V, t, 0.07, 0.2, { type: 'lowpass', f: 900 * p });
    hiss(V, t + 0.005, 0.03, 0.06, { f: 2600, q: 1.5 });
    tone(V, 'sine', 95 * p, t, 0.08, 0.14, { f1: 60 * p });
  },
  door(V, t, p) {
    const bp = V.filter('bandpass', 1000, 4);
    const s = tone(V, 'sawtooth', 170 * p, t, 0.5, 0.07, { a: 0.05, dest: bp });
    let f = 170 * p;
    for (let i = 1; i <= 10; i++) {
      f = clamp(f * semis(rnd(-1.8, 1.8)), 100, 360);
      s.frequency.linearRampToValueAtTime(f, t + i * 0.05);
    }
    thump(V, t + 0.48, 100 * p, 44 * p, 0.3, 0.4);
    hiss(V, t + 0.48, 0.12, 0.24, { type: 'lowpass', f: 650 });
  },
  chest(V, t, p) {
    const bp = V.filter('bandpass', 1300, 4);
    const s = tone(V, 'sawtooth', 240 * p, t, 0.3, 0.05, { a: 0.04, dest: bp });
    let f = 240 * p;
    for (let i = 1; i <= 6; i++) {
      f = clamp(f * semis(rnd(-1.5, 2)), 150, 480);
      s.frequency.linearRampToValueAtTime(f, t + i * 0.05);
    }
    thump(V, t + 0.3, 140 * p, 70 * p, 0.15, 0.3);
    hiss(V, t + 0.3, 0.05, 0.16, { type: 'lowpass', f: 1200 });
    for (let i = 0; i < 3; i++) fm(V, rnd(3000, 4400) * p, 1.53, 1.3, t + 0.4 + i * 0.07 + rnd(0, 0.02), 0.2, 0.05);
    tone(V, 'sine', 1318.5 * p, t + 0.42, 0.7, 0.03, { a: 0.02 });
  },
  page(V, t, p) {
    [0, 0.05, 0.11].forEach((d, i) => hiss(V, t + d, 0.07, [0.07, 0.1, 0.06][i], { f: rnd(2800, 4500) * p, q: 0.8, a: 0.02 }));
  },
  error(V, t, p) {
    const lp = V.filter('lowpass', 900, 0.8);
    tone(V, 'square', 110 * p, t, 0.17, 0.07, { dest: lp, a: 0.005 });
    tone(V, 'square', 116.5 * p, t, 0.17, 0.07, { dest: lp, a: 0.005 });
    thump(V, t, 90, 60, 0.1, 0.14);
  },
  victory(V, t, p) {
    [293.7, 440, 587.3].forEach((f, i) => fm(V, f * p, 3.5, 1.4, t + i * 0.18, 1.8, 0.09));
    const lp = V.filter('lowpass', 1600, 0.7);
    [293.7, 370, 440, 587.3].forEach((f) => tone(V, 'sawtooth', f * p, t + 0.36, 1.8, 0.035, { a: 0.3, dest: lp }));
    fm(V, 146.8 * p, 1.4, 2.4, t, 2.6, 0.12, { id: 0.4 });
  },
  boss_intro(V, t, p) {
    thump(V, t, 72 * p, 30 * p, 1.2, 0.6);
    hiss(V, t, 0.5, 0.3, { type: 'lowpass', f: 600 });
    hiss(V, t, 2.6, 0.22, { type: 'lowpass', f: 220, brown: true, a: 1.0 });
    const lp = V.filter('lowpass', 200, 1.3);
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.linearRampToValueAtTime(950, t + 0.5);
    lp.frequency.exponentialRampToValueAtTime(260, t + 2.8);
    [82.4, 87.3, 123.5].forEach((f) => tone(V, 'sawtooth', f * p, t, 2.6, 0.1, { a: 0.3, dest: lp }));
    fm(V, 82.4 * p, 1.4, 4, t + 0.02, 3.6, 0.2, { id: 0.4 });
  },
  bell(V, t, p) {
    fm(V, 220 * p, 1.4, 2.8, t, 3.6, 0.2, { id: 0.45 });
    tone(V, 'sine', 110 * p, t, 3.6, 0.08, { a: 0.01 });
    hiss(V, t, 0.02, 0.1, { f: 3000, q: 1.5 });
  },
  spawn(V, t, p) {
    hiss(V, t, 0.06, 0.22, { f: 400, f1: 1800, q: 1, a: 0.34 });
    thump(V, t + 0.36, 100 * p, 48 * p, 0.25, 0.32);
    tone(V, 'sine', 160 * p, t, 0.1, 0.05, { a: 0.3, f1: 320 * p });
  },
  flee(V, t, p) {
    for (let i = 0; i < 4; i++) {
      const tt = t + i * 0.095, fall = 1 - i * 0.2;
      hiss(V, tt, 0.06, 0.16 * fall, { type: 'lowpass', f: 1000 * p });
      tone(V, 'sine', 90 * p, tt, 0.06, 0.1 * fall, { f1: 60 * p });
    }
    hiss(V, t, 0.35, 0.1, { type: 'highpass', f: 1500, f1: 700, a: 0.05 });
  },
  burn(V, t, p, k) {
    hiss(V, t, 0.45, 0.18 + 0.1 * k, { f: 500 * p, f1: 950 * p, q: 0.8, a: 0.05 });
    for (let i = 0; i < 7; i++) hiss(V, t + rnd(0, 0.42), rnd(0.006, 0.02), rnd(0.08, 0.18), { type: 'highpass', f: rnd(2500, 5000) });
  },
  ward(V, t, p) {
    [659.3, 987.8, 1318.5].forEach((f, i) => {
      tone(V, 'sine', f * p, t + i * 0.03, 0.8, 0.055, { a: 0.05 });
      tone(V, 'sine', f * 1.004 * p, t + i * 0.03, 0.8, 0.04, { a: 0.07 });
    });
    hiss(V, t, 0.4, 0.03, { type: 'highpass', f: 5000, a: 0.1 });
  },
  upgrade(V, t, p) {
    fm(V, 1400 * p, 2.76, 2, t, 0.6, 0.13);
    hiss(V, t, 0.02, 0.2, { f: 4000, q: 1.2 });
    tone(V, 'sine', 880 * p, t + 0.12, 0.5, 0.06, { a: 0.01 });
    tone(V, 'sine', 1318.5 * p, t + 0.22, 0.6, 0.06, { a: 0.01 });
  },
  purchase(V, t, p) {
    fm(V, 3400 * p, 1.53, 1.3, t, 0.18, 0.07);
    fm(V, 3900 * p, 1.53, 1.3, t + 0.06, 0.18, 0.06);
    thump(V, t, 160 * p, 90 * p, 0.1, 0.2);
    tone(V, 'sine', 1046.5 * p, t + 0.09, 0.25, 0.05);
    tone(V, 'sine', 1568 * p, t + 0.17, 0.3, 0.05);
  },
};

// Per-sound mixing: w = reverb send, l = level, j = random pitch jitter (semitones),
// g = min re-trigger gap (s), pri = steal priority, duck = dip the music for N s.
const META = {
  click: { w: 0.03, j: 0.5 }, hover: { w: 0, j: 0.6, g: 0.05 },
  card_draw: { w: 0.05, j: 1 }, card_play: { w: 0.1, j: 0.8 }, card_select: { w: 0.08, j: 0.3 },
  attack_light: { w: 0.12, j: 1.2 }, attack_heavy: { w: 0.15, j: 0.8 },
  hit: { w: 0.1, j: 1.2 }, crit: { w: 0.25, j: 0.5, pri: 2 },
  block: { w: 0.2, j: 0.8 }, block_break: { w: 0.25, j: 0.5, pri: 2 },
  buff: { w: 0.35, j: 0.2 }, debuff: { w: 0.3, j: 0.4 }, rot: { w: 0.15, j: 0.8 },
  heal: { w: 0.45, j: 0.15 }, gold: { w: 0.2, j: 0.4 }, relic: { w: 0.55, j: 0, pri: 2 },
  potion: { w: 0.2, j: 0.5 }, enemy_death: { w: 0.3, j: 1.5, pri: 2 },
  player_hurt: { w: 0.12, j: 1 }, player_death: { w: 0.6, j: 0, pri: 3, duck: 4.5 },
  end_turn: { w: 0.25, j: 0.2 }, turn_start: { w: 0.35, j: 0 }, shuffle: { w: 0.05, j: 0.6 },
  exhaust: { w: 0.3, j: 0.8 }, mask_shift: { w: 0.35, j: 0.3 }, channel: { w: 0.5, j: 0.6 },
  release: { w: 0.4, j: 0.6 }, brew: { w: 0.2, j: 0.6 }, oath: { w: 0.45, j: 0, pri: 2 },
  oath_done: { w: 0.5, j: 0, pri: 2 }, map_step: { w: 0.05, j: 2 }, door: { w: 0.35, j: 0.8 },
  chest: { w: 0.3, j: 0.4 }, page: { w: 0.05, j: 1, g: 0.08 }, error: { w: 0.05, j: 0, g: 0.12 },
  victory: { w: 0.5, j: 0, pri: 3, duck: 2.5 }, boss_intro: { w: 0.5, j: 0, pri: 3, duck: 3 },
  bell: { w: 0.6, j: 0, pri: 2 }, spawn: { w: 0.35, j: 0.8 }, flee: { w: 0.15, j: 0.6 },
  burn: { w: 0.2, j: 0.8 }, ward: { w: 0.5, j: 0.3 }, upgrade: { w: 0.4, j: 0.2, pri: 2 },
  purchase: { w: 0.2, j: 0.3 },
};
const NO_META = {};

function freeSfx(v) {
  const i = sfxVoices.indexOf(v);
  if (i >= 0) sfxVoices.splice(i, 1);
}
function makeRoomSfx() {
  const now = ctx.currentTime;
  for (let i = sfxVoices.length - 1; i >= 0; i--) {
    const v = sfxVoices[i];
    if (v.dead) sfxVoices.splice(i, 1);
    else if (v.end < now - 0.5) v.free(); // onended never came: reap
  }
  while (sfxVoices.length >= MAX_SFX) {
    let bi = 0;
    for (let i = 1; i < sfxVoices.length; i++) if (sfxVoices[i].pri < sfxVoices[bi].pri) bi = i;
    const v = sfxVoices.splice(bi, 1)[0];
    v.onfree = null;
    v.kill(0.03);
  }
}
function duck(secs) {
  const now = ctx.currentTime;
  for (const g of [G.mDuck.gain, G.mDuckW.gain]) {
    g.cancelScheduledValues(now);
    g.setTargetAtTime(0.35, now, 0.08);
    g.setTargetAtTime(1, now + secs, 0.9);
  }
}

// =============================================================================
// MUSIC — instruments (each creates one Voice inside track instance I)
// =============================================================================
function mvoice(I, vel, wet, pan, essential) {
  if (!I || I.dead) return null;
  if (!essential && musicVoices >= MAX_MUSIC) return null;
  const V = new Voice(I.fade, I.fadeW, wet, vel, pan);
  musicVoices++;
  I.voices.add(V);
  V.onfree = (v) => {
    musicVoices--;
    I.voices.delete(v);
  };
  return V;
}
const FORMANTS = { ah: [680, 1100], oh: [500, 880], oo: [380, 820] };

// Choir pad: detuned saws through two formant band-passes + a dark body, with vibrato.
function choir(I, t, midis, dur, vel, o = {}) {
  const V = mvoice(I, vel, o.wet ?? 0.65, o.pan || 0, o.essential ?? true);
  if (!V) return;
  const a = o.a ?? 2.5, r = o.r ?? 3.5, hold = Math.max(0.2, dur - a - r), end = t + a + hold + r + 0.05;
  const env = V.gain(0);
  swell(env.gain, t, 1, a, hold, r);
  const F = FORMANTS[o.vowel] || FORMANTS.ah;
  const g1 = V.gain(1.0, env), g2 = V.gain(0.55, env), g3 = V.gain(0.22, env);
  const bp1 = V.filter('bandpass', F[0], 4, g1), bp2 = V.filter('bandpass', F[1], 6, g2), lp = V.filter('lowpass', 700, 0.4, g3);
  const mix = V.gain(1 / midis.length, bp1);
  mix.connect(bp2);
  mix.connect(lp);
  const lg = V.gain(o.vib ?? 8, null);
  V.osc('sine', rnd(4.2, 5.2), t, end, lg);
  for (const m of midis) {
    const f = mtof(m);
    for (const dt of [-7, 6]) {
      const s = V.osc('sawtooth', f, t, end, mix);
      s.detune.value = dt + rnd(-3, 3);
      lg.connect(s.detune);
    }
  }
  V.done();
}
// Pipe organ: drawbar PeriodicWave, slow speech, tiny chiff.
function organ(I, t, midis, dur, vel, o = {}) {
  const V = mvoice(I, vel, o.wet ?? 0.7, o.pan || 0, o.essential ?? true);
  if (!V) return;
  const a = o.a ?? 0.35, r = o.r ?? 1.6, hold = Math.max(0.05, dur - a - r), end = t + a + hold + r + 0.05;
  const env = V.gain(0);
  swell(env.gain, t, 1, a, hold, r);
  const lp = V.filter('lowpass', o.cut ?? 2400, 0.5, env);
  const mix = V.gain(0.6 / midis.length, lp);
  for (const m of midis) V.osc(G.organ, mtof(m), t, end, mix);
  hiss(V, t, 0.07, 0.03, { f: Math.min(mtof(midis[0]) * 4, 6000), q: 3 });
  V.done();
}
// FM bell with an octave-down hum; o: { ratio, index, dur, lp, wet, pan }
function bell(I, t, midi, vel, o = {}) {
  const V = mvoice(I, vel, o.wet ?? 0.75, o.pan ?? rnd(-0.35, 0.35), o.essential);
  if (!V) return;
  const f = mtof(midi), dur = o.dur ?? 5;
  const d = o.lp ? V.filter('lowpass', o.lp, 0.6) : undefined;
  fm(V, f, o.ratio ?? 1.4, o.index ?? 2.4, t, dur, 0.55, { dest: d, id: 0.45 });
  tone(V, 'sine', f * 0.5, t, dur * 1.1, 0.22, { a: 0.008, dest: d });
  V.done();
}
function toll(I, t, midi, n, gap, o) {
  for (let k = 0; k < n; k++) bell(I, t + k * gap, midi, o.vel * (1 - k * 0.15), o);
  return (n - 1) * gap;
}
// Plucked string (lute / harp / pizzicato): saw (+ doubled course) through a closing low-pass.
function pluck(I, t, midi, vel, o = {}) {
  const V = mvoice(I, vel, o.wet ?? 0.35, o.pan ?? rnd(-0.25, 0.25), o.essential);
  if (!V) return;
  const f = mtof(midi), dec = o.dec ?? 1.4;
  const env = V.gain(0);
  perc(env.gain, t, 1, 0.003, dec);
  const lp = V.filter('lowpass', f * 6, o.q ?? 1.5, env);
  lp.frequency.setValueAtTime(Math.min(f * (o.bright ?? 9), 10000), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.2, 80), t + dec * 0.5);
  V.osc(o.wave || 'sawtooth', f, t, t + dec + 0.05, lp);
  if (o.double !== false) V.osc('triangle', f * 1.004, t + 0.004, t + dec + 0.05, lp);
  V.done();
}
// Glass harmonica: near-pure sines with a slow beating partner.
function glass(I, t, midi, dur, vel, o = {}) {
  const V = mvoice(I, vel, o.wet ?? 0.7, o.pan ?? rnd(-0.5, 0.5), o.essential);
  if (!V) return;
  const f = mtof(midi), a = o.a ?? 0.25, r = o.r ?? 1.4, hold = Math.max(0.05, dur - a), end = t + a + hold + r + 0.05;
  const env = V.gain(0);
  swell(env.gain, t, 1, a, hold, r);
  V.osc('sine', f, t, end, env);
  V.osc('sine', f * 1.0035, t, end, V.gain(0.5, env));
  V.osc('triangle', f * 2, t, end, V.gain(0.1, env));
  V.done();
}
// Lonely whistle / flute: sine + triangle, delayed vibrato, breath noise.
function flute(I, t, midi, dur, vel, o = {}) {
  const V = mvoice(I, vel, o.wet ?? 0.65, o.pan ?? rnd(-0.3, 0.3), o.essential);
  if (!V) return;
  const f = mtof(midi), a = 0.12, r = 0.5, hold = Math.max(0.05, dur - a), end = t + a + hold + r + 0.05;
  const env = V.gain(0);
  swell(env.gain, t, 1, a, hold, r);
  const lg = V.gain(0, null);
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(14, t + Math.min(0.6, dur));
  V.osc('sine', 5.2, t, end, lg);
  lg.connect(V.osc('sine', f, t, end, env).detune);
  lg.connect(V.osc('triangle', f, t, end, V.gain(0.3, env)).detune);
  V.noise(G.white, t, end, V.filter('bandpass', f * 2, 3, V.gain(0.1, env)));
  V.done();
}
// Celesta / music-box tine.
function celesta(I, t, midi, vel, o = {}) {
  const V = mvoice(I, vel, o.wet ?? 0.6, o.pan ?? rnd(-0.4, 0.4), o.essential);
  if (!V) return;
  const f = mtof(midi), dec = o.dec ?? 1.3;
  tone(V, 'sine', f, t, dec, 0.6, { a: 0.002 });
  tone(V, 'sine', f * 4, t, dec * 0.25, 0.12, { a: 0.001 });
  tone(V, 'triangle', f * 2, t, dec * 0.4, 0.08, { a: 0.002 });
  V.done();
}
// A run of tines inside ONE voice (fae sparkle, sly music box).
function sparkle(I, t, midis, gap, vel, o = {}) {
  const V = mvoice(I, vel, o.wet ?? 0.7, o.pan ?? rnd(-0.4, 0.4), o.essential);
  if (!V) return 0;
  midis.forEach((m, k) => {
    const f = mtof(m), tt = t + k * gap + (o.swing && k % 2 ? gap * 0.25 : 0);
    tone(V, 'sine', f, tt, o.dec ?? 1.2, 0.5, { a: 0.002 });
    tone(V, 'sine', f * 4, tt, 0.25, 0.08, { a: 0.001 });
  });
  V.done();
  return midis.length * gap;
}
// Low brass swell: detuned saws, filter opening with the swell.
function brass(I, t, midis, dur, vel, o = {}) {
  const V = mvoice(I, vel, o.wet ?? 0.5, o.pan || 0, o.essential ?? true);
  if (!V) return;
  const a = o.a ?? 0.8, r = o.r ?? 1.5, hold = Math.max(0.05, dur - a - r), end = t + a + hold + r + 0.05;
  const env = V.gain(0);
  swell(env.gain, t, 1, a, hold, r);
  const lp = V.filter('lowpass', 180, 1.2, env);
  lp.frequency.setValueAtTime(180, t);
  lp.frequency.linearRampToValueAtTime(o.bright ?? 1100, t + a);
  lp.frequency.setTargetAtTime(450, t + a, (hold + r) / 3);
  const mix = V.gain(0.5 / midis.length, lp);
  for (const m of midis) {
    for (const dt of [-6, 5]) V.osc('sawtooth', mtof(m), t, end, mix).detune.value = dt;
  }
  V.done();
}
// Shimmering glass pad (fae): sine + slightly detuned triangle per note.
function shimmer(I, t, midis, dur, vel, o = {}) {
  const V = mvoice(I, vel, o.wet ?? 0.75, o.pan || 0, o.essential ?? true);
  if (!V) return;
  const a = o.a ?? 2.5, r = o.r ?? 3.5, hold = Math.max(0.2, dur - a - r), end = t + a + hold + r + 0.05;
  const env = V.gain(0);
  swell(env.gain, t, 1, a, hold, r);
  const mix = V.gain(0.5 / midis.length, env);
  for (const m of midis) {
    const f = mtof(m);
    V.osc('sine', f, t, end, mix);
    V.osc('triangle', f * 1.0045, t, end, mix);
  }
  V.done();
}
// Tremolo strings cluster (tension).
function tremolo(I, t, midis, dur, vel) {
  const V = mvoice(I, vel, 0.6, 0);
  if (!V) return;
  const a = dur * 0.4, r = dur * 0.4, hold = dur - a - r, end = t + dur + 0.1;
  const env = V.gain(0);
  swell(env.gain, t, 1, a, hold, r);
  const trem = V.gain(0.6, env);
  V.osc('sine', 6.5, t, end, V.gain(0.4, trem.gain));
  const lp = V.filter('lowpass', 1400, 0.7, trem);
  const mix = V.gain(0.5 / midis.length, lp);
  for (const m of midis) for (const dt of [-8, 7]) V.osc('sawtooth', mtof(m), t, end, mix).detune.value = dt;
  V.done();
}
// Continuous drone (root + fifth), stopped when the track is disposed.
function drone(I, t, midis, o = {}) {
  const V = mvoice(I, o.vel ?? 0.06, o.wet ?? 0.4, 0, true);
  const end = t + 7200;
  const env = V.gain(0);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + (o.a ?? 4));
  const lp = V.filter('lowpass', o.cut ?? 400, o.q ?? 0.8, env);
  const mix = V.gain(0.5 / midis.length, lp);
  for (const m of midis) {
    for (const dt of [-5, 4]) V.osc(o.type || 'sawtooth', mtof(m), t, end, mix).detune.value = dt + rnd(-2, 2);
  }
  V.done();
  return { V, lp, env };
}
// Marsh wind: brown noise through a drifting band-pass plus a faint whistle band.
function wind(I, t, level) {
  const V = mvoice(I, level, 0.3, 0, true);
  const end = t + 7200;
  const g1 = V.gain(0);
  g1.gain.setValueAtTime(0, t);
  g1.gain.linearRampToValueAtTime(0.7, t + 3);
  const g2 = V.gain(0.05);
  const bp1 = V.filter('bandpass', 500, 1.4, g1);
  const bp2 = V.filter('bandpass', 1400, 12, g2);
  V.noise(G.brown, t, end, bp1).connect(bp2);
  V.done();
  return { V, bp1, bp2, g1, g2 };
}
// Stream / still water bed.
function stream(I, t, level) {
  const V = mvoice(I, level, 0.5, 0, true);
  const end = t + 7200;
  const g = V.gain(0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1, t + 3);
  V.noise(G.brown, t, end, V.filter('bandpass', 420, 0.7, g));
  V.noise(G.white, t, end, V.filter('bandpass', 2400, 0.7, V.gain(0.05, g)));
  V.done();
  return { V, g };
}
// Hearth: low roar bed + a pre-rendered crackle loop with drifting playback rate.
function fire(I, t, level) {
  const V = mvoice(I, level, 0.25, 0, true);
  const end = t + 7200;
  const g = V.gain(0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1, t + 2);
  const bed = V.gain(0.8, g);
  V.noise(G.brown, t, end, V.filter('lowpass', 380, 0.7, bed));
  const cs = V.noise(crackleBuf(), t, end, V.filter('highpass', 1100, 0.7, V.gain(0.5, g)), rnd(0.9, 1.1));
  V.done();
  return { V, bed, cs };
}
function drip(I, t, vel) {
  const V = mvoice(I, vel, 0.8, rnd(-0.7, 0.7));
  if (!V) return;
  const f0 = rnd(700, 1500);
  tone(V, 'sine', f0, t, 0.07, 0.6, { f1: f0 * rnd(1.8, 2.6), g: 0.05, a: 0.002 });
  V.done();
}
function heartbeat(I, t, vel) {
  const V = mvoice(I, vel, 0.15, 0, true);
  for (const [dt, amp, f] of [[0, 1, 62], [0.24, 0.72, 70]]) {
    tone(V, 'sine', f * 1.6, t + dt, 0.2, amp, { f1: f, g: 0.06, a: 0.004 });
    tone(V, 'triangle', f * 3, t + dt, 0.07, amp * 0.25, { f1: f * 1.6, a: 0.002 });
  }
  V.done();
}
function drum(I, t, kind, vel) {
  const V = mvoice(I, vel, 0.25, rnd(-0.1, 0.1), kind !== 'tick');
  if (!V) return;
  if (kind === 'boom') {
    tone(V, 'sine', 90, t, 0.9, 1, { f1: 38, g: 0.4, a: 0.002 });
    tone(V, 'triangle', 180, t, 0.25, 0.35, { f1: 76, g: 0.2, a: 0.002 });
    hiss(V, t, 0.12, 0.35, { type: 'lowpass', f: 700 });
  } else if (kind === 'tom') {
    tone(V, 'sine', 140, t, 0.4, 0.8, { f1: 62, g: 0.2, a: 0.002 });
    tone(V, 'triangle', 280, t, 0.15, 0.3, { f1: 124, a: 0.002 });
    hiss(V, t, 0.05, 0.25, { type: 'lowpass', f: 1200 });
  } else if (kind === 'hit') {
    hiss(V, t, 0.16, 0.5, { f: 1600, q: 0.8 });
    tone(V, 'triangle', 210, t, 0.1, 0.3, { f1: 150, a: 0.002 });
  } else {
    hiss(V, t, 0.03, 0.2, { type: 'highpass', f: 6000 });
  }
  V.done();
}
function woodblock(I, t, hi, vel) {
  const V = mvoice(I, vel, 0.2, hi ? 0.15 : -0.15);
  if (!V) return;
  tone(V, 'sine', hi ? 1250 : 930, t, 0.05, 0.8, { a: 0.001 });
  hiss(V, t, 0.012, 0.3, { f: hi ? 2600 : 2000, q: 4 });
  V.done();
}
// Change-ringing peal (rounds, then plain hunt) in ONE voice.
function peal(I, t, midis, rows, gap, vel) {
  const V = mvoice(I, vel, 0.75, rnd(-0.2, 0.2), true);
  const row = midis.slice();
  let tt = t;
  for (let r = 0; r < rows; r++) {
    for (const m of row) {
      fm(V, mtof(m), 3.5, 1.5, tt + rnd(0, 0.025), 1.6, 0.32);
      tt += gap;
    }
    if (r % 2 === 1) tt += gap; // handstroke gap
    for (let i = r % 2; i + 1 < row.length; i += 2) {
      const x = row[i];
      row[i] = row[i + 1];
      row[i + 1] = x;
    }
  }
  V.done();
  return tt - t;
}

// ---- melody ------------------------------------------------------------------
// "The Crown" motif (scale degrees / beats): falls a fifth, turns, settles.
const CROWN = { d: [4, 3, 2, 0, 1, -1, 0], b: [1, 1, 1, 2, 1, 1, 3] };

function motifBells(I, T, t, beat, vel, oct) {
  const V = mvoice(I, vel, 0.8, rnd(-0.3, 0.3));
  if (!V) return 0;
  let tt = t;
  CROWN.d.forEach((d, i) => {
    fm(V, mtof(T.deg(d, oct)), 3.5, 1.3, tt, 2.4, 0.4);
    tt += CROWN.b[i] * beat;
  });
  V.done();
  return tt - t;
}
function nearestStable(d) {
  const m = ((d % 7) + 7) % 7, base = d - m;
  let best = base, bd = 99;
  for (const s of [0, 2, 4, 7]) if (Math.abs(base + s - d) < bd) { bd = Math.abs(base + s - d); best = base + s; }
  return best;
}
// A phrase: random walk on the mode, biased downwards ("fall"), ending on a stable degree.
function phrase(o) {
  const out = [];
  if (o.motif && Math.random() < o.motif) {
    const beat = o.beat ?? 1;
    CROWN.d.forEach((d, i) => out.push({ d, len: CROWN.b[i] * beat, v: rnd(0.85, 1) }));
    return out;
  }
  const n = rint(o.min ?? 3, o.max ?? 5), lo = o.lo ?? -2, hi = o.hi ?? 9;
  let d = pick(o.starts ?? [0, 2, 4, 4, 7]);
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    if (last) d = nearestStable(d);
    out.push({ d, len: last ? Math.max(...o.lens) * 1.3 : pick(o.lens), v: rnd(0.75, 1) });
    if (o.rest && !last && Math.random() < o.rest) out.push({ d: null, len: pick(o.lens) });
    const mag = Math.random() < 0.7 ? 1 : Math.random() < 0.8 ? 2 : 3;
    d = clamp(d + (Math.random() < (o.fall ?? 0.55) ? -mag : mag), lo, hi);
  }
  return out;
}

// ---- layers (stepped by the scheduler) ----------------------------------------
const every = (start, a, b, fn) => ({ next: start, step(t) { return t + (fn(t) || 0) + rnd(a, b); } });
const wander = (start, param, lo, hi, a, b) => ({
  next: start,
  step(t) {
    const d = rnd(a, b);
    param.setTargetAtTime(rnd(lo, hi), t, d * 0.4);
    return t + d;
  },
});
function grid(start, bpm, div, fn) {
  const st = 60 / bpm / div;
  let i = 0;
  return { next: start, period: st, skip(k) { i += k; }, step(t) { fn(i++, t); return t + st; } };
}
function pads(T, chords, o) {
  let i = 0;
  return {
    next: T.t0 + (o.delay ?? 0.2),
    step(t) {
      if (o.rest && i > 0 && Math.random() < o.rest) { i++; return t + rnd(4, 9); }
      const ch = o.shuffle ? pick(chords) : chords[i % chords.length];
      i++;
      const dur = rnd(o.dur[0], o.dur[1]);
      o.inst(T.I, t, ch.map((d) => T.deg(d, o.oct ?? 0)), dur, o.vel, o);
      return t + dur - (o.overlap ?? 3);
    },
  };
}
function melody(T, play, o) {
  let q = [];
  return {
    next: T.t0 + (o.delay ?? 4),
    step(t) {
      if (!q.length) q = phrase(o);
      const n = q.shift();
      if (n.d !== null) {
        const v = (o.vel ?? 0.08) * n.v;
        play(t, T.deg(n.d, o.oct ?? 1), n.len, v);
        if (o.dyad && Math.random() < o.dyad) play(t + 0.03, T.deg(n.d + pick(o.dyadInt || [2]), o.oct ?? 1), n.len, v * 0.7);
      }
      return t + n.len + (q.length ? 0 : rnd(o.gap[0], o.gap[1]));
    },
  };
}
const gusts = (start, w, lvl = 1) => ({
  next: start,
  step(t) {
    const d = rnd(2, 5);
    w.bp1.frequency.setTargetAtTime(rnd(260, 900), t, d * 0.4);
    w.bp1.Q.setTargetAtTime(rnd(0.9, 2.6), t, d * 0.4);
    w.g1.gain.setTargetAtTime(rnd(0.25, 1) * lvl, t, d * 0.35);
    w.bp2.frequency.setTargetAtTime(rnd(700, 1900), t, d * 0.5);
    w.g2.gain.setTargetAtTime(Math.random() < 0.4 ? rnd(0.08, 0.3) : 0.02, t, d * 0.4);
    return t + d;
  },
});
const breath = (start, f) => ({
  next: start,
  step(t) {
    const d = rnd(1.5, 4);
    f.bed.gain.setTargetAtTime(rnd(0.45, 1), t, d * 0.4);
    f.cs.playbackRate.setTargetAtTime(rnd(0.8, 1.25), t, d * 0.5);
    return t + d;
  },
});

// =============================================================================
// TRACKS — root (MIDI), mode, level, setup(T) -> layers. T.deg(d, oct) maps a
// scale degree to MIDI. Continuous beds are created in setup and live until the
// track is disposed.
// =============================================================================
const MODES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  ionian: [0, 2, 4, 5, 7, 9, 11], locrian: [0, 1, 3, 5, 6, 8, 10],
};

const TRACKS = {
  // Title: grey choir over a D drone, distant toll, the Crown motif on glass.
  title: {
    root: 50, mode: 'aeolian', level: 1,
    setup(T) {
      const { I, t0 } = T;
      const dr = drone(I, t0, [T.deg(0, -1), T.deg(4, -1)], { cut: 380, vel: 0.07 });
      const w = wind(I, t0, 0.035);
      return [
        wander(t0, dr.lp.frequency, 220, 650, 5, 10),
        gusts(t0, w, 0.8),
        pads(T, [[0, 2, 4], [-2, 0, 2], [-4, -2, 0], [-3, -1, 1]], { inst: choir, dur: [14, 18], overlap: 4.5, vel: 0.12 }),
        every(t0 + 3, 9, 16, (t) => toll(I, t, T.deg(0, -1), rint(1, 2), 2.8, { vel: 0.15, lp: 1800 })),
        melody(T, (t, m, len, v) => glass(I, t, m, len, v), { oct: 1, lens: [1.2, 1.8, 2.4], gap: [7, 14], motif: 0.5, beat: 0.9, vel: 0.08, delay: 6 }),
      ];
    },
  },
  // Waystone hub: hearth crackle, intimate lute in G dorian, a hum, a rare far bell.
  hub: {
    root: 55, mode: 'dorian', level: 1,
    setup(T) {
      const { I, t0 } = T;
      const f = fire(I, t0, 0.07);
      drone(I, t0, [T.deg(0, -1), T.deg(4, -1)], { type: 'triangle', cut: 500, vel: 0.045 });
      const PROG = [[0, 2, 4], [3, 5, 7], [0, 2, 4], [-1, 1, 3]];
      const PATS = [[0, 1, 2, 3, 2, 1, null, 1], [0, 2, 1, 3, 4, 3, 2, null], [0, null, 2, 1, 3, null, 2, null], [0, 1, 2, null, null, null, null, null]];
      let pat = PATS[0], ch = [], silent = false;
      return [
        breath(t0, f),
        grid(t0 + 2, 66, 2, (i, t) => {
          const bar = Math.floor(i / 8), s = i % 8;
          if (s === 0) {
            ch = PROG[Math.floor(bar / 2) % PROG.length].map((d) => T.deg(d));
            pat = pick(PATS);
            silent = bar % 4 === 3 && Math.random() < 0.6;
          }
          if (silent) return;
          const idx = pat[s];
          if (idx === null) return;
          const tones = [ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12];
          pluck(I, t + rnd(0, 0.02), tones[idx], 0.085 * (s === 0 ? 1.1 : rnd(0.7, 0.95)), { dec: 1.3, bright: 7 });
          if (s === 0 && Math.random() < 0.7) pluck(I, t, ch[0] - 12, 0.07, { dec: 2, bright: 4, double: false });
        }),
        pads(T, [[0, 4], [0, 4, 7]], { inst: choir, vowel: 'oo', dur: [12, 16], overlap: 4, vel: 0.05, rest: 0.45, delay: 6 }),
        every(t0 + 25, 35, 60, (t) => bell(I, t, T.deg(4, -1), 0.06, { lp: 900, dur: 6 })),
      ];
    },
  },
  // Act 1, the Ashen Marches: marsh wind, low drone, a far bell, a lonely whistle.
  act1: {
    root: 45, mode: 'aeolian', level: 1,
    setup(T) {
      const { I, t0 } = T;
      const w = wind(I, t0, 0.09);
      const dr = drone(I, t0, [T.deg(0, -1), T.deg(4, -1)], { cut: 300, vel: 0.07 });
      return [
        gusts(t0, w),
        wander(t0, dr.lp.frequency, 180, 500, 4, 9),
        every(t0 + 4, 12, 22, (t) => toll(I, t, pick([T.deg(0, 1), T.deg(4)]), rint(1, 3), 2.6, { vel: 0.13, lp: 1200, wet: 0.9 })),
        pads(T, [[0, 2, 4], [-2, 0, 2], [-1, 1, 3], [-4, -2, 0]], { inst: choir, oct: 1, dur: [14, 22], overlap: 4, vel: 0.08, rest: 0.35, delay: 5 }),
        melody(T, (t, m, len, v) => flute(I, t, m, len, v), { oct: 2, lens: [0.9, 1.4, 2.2], gap: [10, 22], min: 3, max: 5, vel: 0.07, fall: 0.6, delay: 9 }),
      ];
    },
  },
  // Act 2, the Weeping Wood & Drowned Abbey: water, drips, fae glass, phrygian shimmer.
  act2: {
    root: 52, mode: 'phrygian', level: 1,
    setup(T) {
      const { I, t0 } = T;
      const st = stream(I, t0, 0.035);
      const dr = drone(I, t0, [T.deg(0, -1), T.deg(4, -1)], { type: 'triangle', cut: 700, vel: 0.05 });
      return [
        wander(t0, dr.lp.frequency, 400, 1100, 5, 9),
        wander(t0, st.g.gain, 0.5, 1, 4, 8),
        every(t0 + 1, 0.4, 2.8, (t) => {
          drip(I, t, rnd(0.03, 0.07));
          if (Math.random() < 0.2) drip(I, t + rnd(0.1, 0.25), rnd(0.02, 0.05));
        }),
        pads(T, [[0, 4], [1, 5], [-1, 3], [0, 2, 4], [1, 3, 5]], { inst: shimmer, oct: 1, dur: [12, 18], overlap: 4, vel: 0.05, rest: 0.15 }),
        melody(T, (t, m, len, v) => glass(I, t, m, len, v), { oct: 2, lens: [1, 1.5, 2.5], min: 2, max: 5, gap: [5, 11], vel: 0.07, dyad: 0.25, dyadInt: [1, 4], fall: 0.5, delay: 4 }),
        every(t0 + 15, 18, 35, (t) => {
          const n = rint(5, 7), top = rint(9, 12), notes = [];
          for (let k = 0; k < n; k++) notes.push(T.deg(top - k, 1));
          return sparkle(I, t, notes, 0.09, 0.035);
        }),
      ];
    },
  },
  // Act 3, Ashgrave: cathedral organ, a pedal that will not settle, tolling, choir.
  act3: {
    root: 48, mode: 'phrygian', level: 1,
    setup(T) {
      const { I, t0 } = T;
      const dr = drone(I, t0, [T.deg(0, -1), T.deg(4, -1)], { cut: 260, vel: 0.06 });
      return [
        wander(t0, dr.lp.frequency, 180, 420, 4, 8),
        pads(T, [[0, 2, 4], [1, 3, 5], [0, 2, 4], [-1, 1, 3], [3, 5, 7], [1, 3, 5]], { inst: organ, dur: [9, 12], overlap: 1.2, vel: 0.07, cut: 2200 }),
        grid(t0 + 0.1, 52, 1, (i, t) => {
          const bar = Math.floor(i / 4), s = i % 4;
          if (s === 0 || s === 2) organ(I, t, [T.deg(bar % 4 === 3 && s === 2 ? 1 : 0, -1)], 1.1, 0.06, { a: 0.08, r: 0.6, essential: false, cut: 900 });
        }),
        every(t0 + 5, 10, 16, (t) => toll(I, t, T.deg(0), rint(1, 2), 3.2, { vel: 0.13, lp: 2400 })),
        melody(T, (t, m, len, v) => choir(I, t, [m], len + 1.5, v, { a: 0.7, r: 1.6, vowel: 'oh', essential: false }), { oct: 1, lens: [2, 2.5, 3], min: 3, max: 4, gap: [12, 22], vel: 0.09, delay: 12 }),
        every(t0 + 20, 22, 34, (t) => { tremolo(I, t, [T.deg(0, 1), T.deg(1, 1)], 6, 0.035); return 6; }),
      ];
    },
  },
  // Act 4, Beneath the Throne: vast choir, deep drone, a lament, the Crown in bells.
  act4: {
    root: 50, mode: 'aeolian', level: 1,
    setup(T) {
      const { I, t0 } = T;
      const dr = drone(I, t0, [T.deg(0, -1), T.deg(4, -1)], { cut: 240, vel: 0.08, a: 6 });
      return [
        wander(t0, dr.lp.frequency, 150, 380, 6, 12),
        pads(T, [[0, 2, 4, 7], [-2, 0, 2, 5], [2, 4, 6, 9], [-1, 1, 3, 6], [-4, -2, 0, 3], [-3, -1, 1, 4]], { inst: choir, dur: [18, 26], overlap: 6, vel: 0.12, a: 4.5, r: 6, wet: 0.85 }),
        melody(T, (t, m, len, v) => choir(I, t, [m], len + 2, v, { a: 1, r: 2.5, vowel: 'oo', essential: false, wet: 0.85 }), { oct: 1, lens: [2.5, 3, 4], min: 3, max: 5, gap: [10, 18], vel: 0.08, fall: 0.7, motif: 0.3, beat: 1.6, delay: 10 }),
        every(t0 + 20, 25, 40, (t) => motifBells(I, T, t, 1.1, 0.06, 1)),
        every(t0 + 8, 30, 50, (t) => bell(I, t, T.deg(0, -1), 0.12, { lp: 700, dur: 8 })),
      ];
    },
  },
  // Boss: driving low drums at 96 bpm, phrygian bass ostinato, brass, choir stabs.
  boss: {
    root: 40, mode: 'phrygian', level: 1,
    setup(T) {
      const { I, t0 } = T;
      const bpm = 96, s0 = t0 + 0.1;
      const dr = drone(I, t0, [T.deg(0), T.deg(4)], { cut: 420, vel: 0.06, a: 1.5 });
      const DR = [
        [[0, 'boom', 1], [3, 'tom', 0.6], [6, 'tom', 0.7], [8, 'hit', 0.8], [10, 'tom', 0.6], [11, 'tom', 0.5], [12, 'hit', 0.5], [14, 'tom', 0.7]],
        [[0, 'boom', 1], [4, 'hit', 0.6], [6, 'tom', 0.7], [7, 'tom', 0.5], [8, 'boom', 0.8], [11, 'tom', 0.6], [12, 'hit', 0.8], [14, 'tom', 0.5], [15, 'tom', 0.6]],
      ];
      const FILL = [[0, 'boom', 1], [4, 'hit', 0.7], [8, 'tom', 0.6], [10, 'tom', 0.7], [12, 'tom', 0.8], [13, 'tom', 0.85], [14, 'tom', 0.9], [15, 'hit', 1]];
      const BASS = [[0, 0, 1, 0, 0, 0, 2, 1], [0, 0, 1, 0, -2, -2, -1, 0], [0, null, 0, 1, 0, null, 3, 1]];
      let pat = DR[0], bass = BASS[0];
      return [
        wander(t0, dr.lp.frequency, 250, 750, 3, 7),
        grid(s0, bpm, 4, (i, t) => {
          const bar = Math.floor(i / 16), s = i % 16;
          if (s === 0) pat = bar % 4 === 3 ? FILL : pick(DR);
          for (const [st, k, v] of pat) if (st === s) drum(I, t, k, 0.32 * v);
          if (s % 2 === 1 && Math.random() < 0.35) drum(I, t, 'tick', 0.06);
        }),
        grid(s0, bpm, 2, (i, t) => {
          const bar = Math.floor(i / 8), s = i % 8;
          if (s === 0) bass = bar % 4 === 3 ? BASS[1] : pick([BASS[0], BASS[0], BASS[2]]);
          const d = bass[s];
          if (d !== null) pluck(I, t, T.deg(d), 0.11 * (s % 4 === 0 ? 1 : 0.75), { dec: 0.28, bright: 6, q: 4, wet: 0.15, double: false });
        }),
        grid(s0, bpm / 8, 1, (i, t) => brass(I, t, i % 2 ? [T.deg(1), T.deg(5)] : [T.deg(0), T.deg(4)], 4.8, 0.08, { a: 1.2, bright: 900 })),
        grid(s0, bpm / 16, 1, (i, t) => {
          choir(I, t, [T.deg(0, 1), T.deg(2, 1), T.deg(4, 1)], 3.5, 0.08, { a: 0.4, r: 2 });
          if (i % 2 === 1) bell(I, t + 1.25, T.deg(1, 2), 0.05, { ratio: 2.41, index: 3, dur: 3, lp: 3000 });
        }),
      ];
    },
  },
  // Elite: a heartbeat, a tritone drone, metallic scrapes, clustered brass and choir.
  elite: {
    root: 47, mode: 'locrian', level: 1,
    setup(T) {
      const { I, t0 } = T;
      const dr = drone(I, t0, [T.deg(0), T.deg(4)], { cut: 360, vel: 0.055, a: 2 });
      return [
        wander(t0, dr.lp.frequency, 220, 600, 3, 7),
        grid(t0 + 0.5, 66, 1, (i, t) => { if (i % 16 !== 15) heartbeat(I, t, 0.3); }),
        every(t0 + 4, 6, 12, (t) => bell(I, t, T.deg(pick([0, 1, 4]), 1), 0.045, { ratio: 2.76, index: 4, dur: 3.5, lp: 2600 })),
        every(t0 + 2, 6, 11, (t) => { brass(I, t, [T.deg(0), T.deg(1)], 5, 0.06, { a: 1.8, bright: 700 }); return 3; }),
        pads(T, [[0, 1, 4], [-1, 0, 3]], { inst: choir, oct: 1, dur: [8, 12], overlap: 2, vel: 0.05, rest: 0.4, a: 2, r: 3, delay: 6 }),
      ];
    },
  },
  // Shop: a sly creeping pizzicato, a peddler's clock, a crooked music box.
  shop: {
    root: 50, mode: 'dorian', level: 1,
    setup(T) {
      const { I, t0 } = T;
      drone(I, t0, [T.deg(0, -1), T.deg(4, -1)], { type: 'triangle', cut: 520, vel: 0.04 });
      let prev = 4;
      const pz = { dec: 0.35, bright: 5, q: 2, wave: 'triangle', double: false, wet: 0.25 };
      return [
        grid(t0 + 0.1, 84, 2, (i, t) => {
          const s = i % 8, bar = Math.floor(i / 8);
          if (s % 2 === 0) woodblock(I, t, s % 4 === 0, 0.03);
          if (bar % 8 === 7) return;
          if (s === 0) pluck(I, t, T.deg(0, -1), 0.1, pz);
          else if (s === 4) pluck(I, t, T.deg(Math.random() < 0.25 ? 3 : 4, -1) + (Math.random() < 0.15 ? -1 : 0), 0.085, pz);
          else if (s !== 1 && s !== 5 && Math.random() < 0.5) {
            prev = clamp(prev + pick([-2, -1, 1, 2]), 0, 9);
            pluck(I, t + 0.04, T.deg(prev) + (Math.random() < 0.2 ? -1 : 0), 0.06, pz);
          }
        }),
        every(t0 + 10, 14, 24, (t) => {
          const start = rint(4, 7), notes = [];
          for (let k = 0; k < rint(4, 6); k++) notes.push(T.deg(start + pick([-1, 0, 1, 2]) - k, 1) + (k === 1 ? -1 : 0));
          return sparkle(I, t, notes, 0.18, 0.04, { swing: true, dec: 0.8 });
        }),
      ];
    },
  },
  // Rest site: campfire, slow warm harp, a soft hum — comfort, briefly.
  rest: {
    root: 53, mode: 'ionian', level: 1,
    setup(T) {
      const { I, t0 } = T;
      const f = fire(I, t0, 0.05);
      drone(I, t0, [T.deg(0, -1), T.deg(4, -1)], { type: 'triangle', cut: 450, vel: 0.035 });
      const PROG = [[0, 2, 4], [-2, 0, 2], [-4, -2, 0], [-3, -1, 1]];
      const PATS = [[0, 1, 2, 3, 2, 1, null, null], [0, 2, 1, 3, null, 2, 1, null], [0, null, 1, 2, 3, null, null, null]];
      let pat = PATS[0], ch = [], silent = false;
      const harp = { wave: 'triangle', dec: 2.2, bright: 4, double: false, wet: 0.5 };
      return [
        breath(t0, f),
        grid(t0 + 1.5, 56, 2, (i, t) => {
          const bar = Math.floor(i / 8), s = i % 8;
          if (s === 0) {
            ch = PROG[bar % PROG.length].map((d) => T.deg(d));
            pat = pick(PATS);
            silent = bar % 4 === 3 && Math.random() < 0.5;
          }
          if (silent) return;
          const idx = pat[s];
          if (idx === null) return;
          pluck(I, t + rnd(0, 0.015), [ch[0], ch[1], ch[2], ch[0] + 12][idx], 0.09 * rnd(0.75, 1), harp);
          if (s === 0) pluck(I, t, ch[0] - 12, 0.07, { ...harp, dec: 3 });
        }),
        pads(T, [[0, 4], [0, 4, 7]], { inst: choir, vowel: 'oo', dur: [12, 16], overlap: 4, vel: 0.05, rest: 0.3, delay: 5 }),
      ];
    },
  },
  // Event: curious and uneasy — music-box tines, a glass pad, a low bell.
  event: {
    root: 47, mode: 'dorian', level: 1,
    setup(T) {
      const { I, t0 } = T;
      const dr = drone(I, t0, [T.deg(0), T.deg(4)], { type: 'triangle', cut: 650, vel: 0.045 });
      return [
        wander(t0, dr.lp.frequency, 400, 900, 4, 9),
        melody(T, (t, m, len, v) => celesta(I, t, m, v), { oct: 2, lens: [0.35, 0.7, 1.05], min: 3, max: 7, gap: [4, 9], vel: 0.055, rest: 0.15, delay: 2 }),
        pads(T, [[0, 4], [2, 6], [-2, 2], [3, 7]], { inst: shimmer, oct: 1, dur: [10, 14], overlap: 3, vel: 0.04, rest: 0.35 }),
        every(t0 + 8, 20, 35, (t) => bell(I, t, T.deg(0), 0.08, { lp: 1200, dur: 6 })),
      ];
    },
  },
  // Victory: change-ringing peal, warm choir, the Crown motif turned to the major.
  victory: {
    root: 50, mode: 'ionian', level: 1,
    setup(T) {
      const { I, t0 } = T;
      drone(I, t0, [T.deg(0, -1), T.deg(4, -1)], { type: 'triangle', cut: 600, vel: 0.045 });
      return [
        pads(T, [[0, 2, 4], [-4, -2, 0], [-2, 0, 2], [-3, -1, 1]], { inst: choir, dur: [10, 14], overlap: 3.5, vel: 0.1, a: 2 }),
        every(t0 + 1.5, 12, 18, (t) => peal(I, t, [7, 6, 5, 4, 3, 2].map((d) => T.deg(d, 1)), rint(2, 3), 0.3, 0.07)),
        melody(T, (t, m, len, v) => flute(I, t, m, len, v), { oct: 1, lens: [0.8, 1.2, 1.6], gap: [10, 18], vel: 0.06, motif: 0.5, beat: 0.75, delay: 8 }),
      ];
    },
  },
  // Death: a single deep toll, sighing choir, a falling lament. "Again."
  death: {
    root: 45, mode: 'aeolian', level: 1,
    setup(T) {
      const { I, t0 } = T;
      const dr = drone(I, t0, [T.deg(0), T.deg(4)], { cut: 300, vel: 0.05, a: 3 });
      return [
        wander(t0, dr.lp.frequency, 180, 420, 5, 10),
        every(t0 + 0.5, 11, 16, (t) => bell(I, t, T.deg(0), 0.16, { lp: 900, dur: 7, wet: 0.9 })),
        pads(T, [[0, 2, 4], [-4, -2, 0], [0, 2, 4], [-3, -1, 1]], { inst: choir, oct: 1, dur: [16, 22], overlap: 5, vel: 0.085, vowel: 'oo', a: 4, r: 5, rest: 0.15, delay: 2 }),
        melody(T, (t, m, len, v) => flute(I, t, m, len, v), { oct: 2, lens: [1.6, 2.2, 3], fall: 0.8, gap: [14, 24], vel: 0.055, motif: 0.4, beat: 1.3, delay: 9 }),
      ];
    },
  },
};

function startTrack(name) {
  const def = TRACKS[name];
  const now = ctx.currentTime, t0 = now + 0.06, lvl = def.level ?? 1;
  const I = { name, dead: false, voices: new Set(), layers: [] };
  I.fade = ctx.createGain();
  I.fadeW = ctx.createGain();
  for (const g of [I.fade, I.fadeW]) {
    g.gain.value = 0;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(lvl, now + XFADE);
  }
  I.fade.connect(G.mDry);
  I.fadeW.connect(G.mWet);
  const sc = MODES[def.mode];
  const T = { I, t0, deg: (d, oct = 0) => def.root + sc[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct) };
  try { I.layers = def.setup(T) || []; } catch (e) { I.layers = []; }
  return I;
}
function stopTrack(I) {
  I.dead = true;
  const now = ctx.currentTime;
  for (const g of [I.fade, I.fadeW]) {
    const p = g.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(0, now + XFADE);
  }
  setTimeout(() => {
    for (const v of Array.from(I.voices)) v.kill(0.05);
    setTimeout(() => {
      try { I.fade.disconnect(); I.fadeW.disconnect(); } catch (e) { /* ignore */ }
    }, 400);
  }, XFADE * 1000 + 100);
}

// ---- lookahead scheduler -------------------------------------------------------
function tick() {
  timer = null;
  if (!ctx || userPaused || !inst) return;
  const now = ctx.currentTime, horizon = now + LOOKAHEAD;
  for (const L of inst.layers) {
    if (L.next < now - 0.25) {
      // fell behind (throttled timers): skip ahead, keeping grids phase-aligned
      if (L.period) {
        const k = Math.ceil((now - L.next) / L.period);
        L.next += k * L.period;
        if (L.skip) L.skip(k);
      } else L.next = now + 0.05 + Math.random() * 0.2;
    }
    let n = 0;
    while (L.next < horizon && n++ < 64) {
      let nx;
      try { nx = L.step(L.next); } catch (e) { nx = L.next + 5; }
      L.next = typeof nx === 'number' && nx > L.next ? nx : L.next + 0.5;
    }
  }
  timer = setTimeout(tick, TICK_MS);
}
function ensureTick() {
  if (!timer && inst && ctx && !userPaused) tick();
}
function applyMusic() {
  if (!ctx) return;
  const want = wanted && vol.music > 0.001 ? wanted : null;
  if (inst && inst.name === want) return;
  if (inst) {
    stopTrack(inst);
    inst = null;
  }
  if (want) {
    wake();
    inst = startTrack(want);
    ensureTick();
  } else scheduleIdle();
}

// ---- power management ----------------------------------------------------------
function scheduleIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(checkIdle, IDLE_S * 1000);
}
function checkIdle() {
  idleTimer = null;
  if (!ctx || userPaused || inst) return;
  if (sfxVoices.length || musicVoices || ctx.currentTime - lastSfx < IDLE_S - 1) {
    scheduleIdle();
    return;
  }
  if (ctx.state === 'running') {
    idlePaused = true;
    safe(ctx.suspend());
  }
}
function wake() {
  if (idlePaused && ctx && !userPaused) {
    idlePaused = false;
    safe(ctx.resume());
  }
}
function kick() {
  // any user gesture: recover from iOS 'interrupted' / blocked starts
  if (ctx && !userPaused && !idlePaused && ctx.state !== 'running' && ctx.state !== 'closed') safe(ctx.resume());
}
function safe(p) {
  if (p && typeof p.catch === 'function') p.catch(() => {});
}
function applyVolumes(immediate) {
  const now = ctx.currentTime, m = curve(vol.music) * MUSIC_GAIN, s = curve(vol.sfx) * SFX_GAIN;
  for (const [node, v] of [[G.mDry, m], [G.mWet, m], [G.sDry, s], [G.sWet, s]]) {
    const p = node.gain;
    p.cancelScheduledValues(now);
    if (immediate) p.setValueAtTime(v, now);
    else p.setTargetAtTime(v, now, 0.06);
  }
}

// ---- buffers -----------------------------------------------------------------
function makeNoise(sec, brown) {
  const sr = ctx.sampleRate, len = Math.floor(sr * sec), N = Math.floor(sr * 0.05);
  const raw = new Float32Array(len + N);
  let last = 0;
  for (let i = 0; i < raw.length; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      raw[i] = last * 3.5;
    } else raw[i] = w * 0.9;
  }
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = raw[i];
  for (let i = 0; i < N; i++) d[i] = raw[i] * (i / N) + raw[len + i] * (1 - i / N); // seamless loop
  return buf;
}
function makeImpulse(sec) {
  const sr = ctx.sampleRate, len = Math.max(2, Math.floor(sr * sec)), pre = Math.floor(sr * 0.012);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const x = (i - pre) / (len - pre);
      lp += (0.88 - 0.82 * x) * (Math.random() * 2 - 1 - lp); // darker as it decays
      d[i] = lp * Math.exp(-6.2 * x) * (1 - x);
    }
    for (let r = 0; r < 6; r++) {
      const i = pre + Math.floor(sr * rnd(0.004, 0.06));
      if (i < len) d[i] += (Math.random() < 0.5 ? -1 : 1) * rnd(0.2, 0.5) * (1 - r / 8);
    }
  }
  return buf;
}
function crackleBuf() {
  if (G.crackle) return G.crackle;
  const sr = ctx.sampleRate, len = Math.floor(sr * 5), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  let t = 0;
  for (;;) {
    t += -Math.log(1 - Math.random()) * 0.14;
    if (t > 4.9) break;
    const n = Math.random() < 0.25 ? rint(2, 4) : 1;
    for (let j = 0; j < n; j++) {
      const s0 = Math.floor((t + j * rnd(0.004, 0.03)) * sr);
      const L = Math.max(8, Math.floor(sr * rnd(0.0008, Math.random() < 0.1 ? 0.012 : 0.004)));
      const amp = 0.15 + 0.85 * Math.pow(Math.random(), 3);
      for (let i = 0; i < L && s0 + i < len; i++) d[s0 + i] += (Math.random() * 2 - 1) * amp * Math.exp((-5 * i) / L);
    }
  }
  G.crackle = buf;
  return buf;
}
function build() {
  const c = ctx;
  const gain = (v) => {
    const g = c.createGain();
    g.gain.value = v;
    return g;
  };
  const master = gain(0.8);
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.22;
  const out = gain(1);
  master.connect(comp);
  comp.connect(out);
  out.connect(c.destination);
  const verbIn = gain(1);
  verbIn.channelCount = 1;
  verbIn.channelCountMode = 'explicit';
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 160;
  hp.Q.value = 0.5;
  const conv = c.createConvolver();
  conv.buffer = makeImpulse(2.8);
  const verbOut = gain(0.9);
  verbIn.connect(hp);
  hp.connect(conv);
  conv.connect(verbOut);
  verbOut.connect(master);
  const mDry = gain(0), mWet = gain(0), mDuck = gain(1), mDuckW = gain(1), sDry = gain(0), sWet = gain(0);
  mDry.connect(mDuck);
  mDuck.connect(master);
  mWet.connect(mDuckW);
  mDuckW.connect(verbIn);
  sDry.connect(master);
  sWet.connect(verbIn);
  const real = new Float32Array(11);
  const imag = new Float32Array([0, 1, 0.75, 0.42, 0.5, 0.12, 0.28, 0, 0.18, 0, 0.1]);
  G = {
    master, comp, out, verbIn, conv, mDry, mWet, mDuck, mDuckW, sDry, sWet,
    white: makeNoise(2.5, false), brown: makeNoise(3, true), crackle: null,
    organ: c.createPeriodicWave(real, imag),
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================
export function unlockAudio() {
  try {
    if (!AC) return;
    if (!ctx) {
      let c;
      try { c = new AC({ latencyHint: 'balanced' }); } catch (e) { c = new AC(); }
      ctx = c;
      build();
      // iOS < 14.5: playing a buffer inside the gesture unlocks output
      const b = ctx.createBufferSource();
      b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      b.connect(ctx.destination);
      b.onended = () => b.disconnect();
      b.start(0);
      userPaused = false;
      applyVolumes(true);
      if (W && W.addEventListener) {
        for (const ev of ['pointerdown', 'touchend', 'keydown']) W.addEventListener(ev, kick, { capture: true, passive: true });
      }
      applyMusic();
      if (!inst) scheduleIdle();
    }
    idlePaused = false;
    if (ctx.state !== 'running' && !userPaused) safe(ctx.resume());
  } catch (e) { /* audio is optional */ }
}

export function sfx(name, opts) {
  try {
    if (!ctx || userPaused || typeof name !== 'string' || !HAS(SFX, name)) return;
    const st = ctx.state;
    if (st === 'closed' || st === 'interrupted') return;
    const m = HAS(META, name) ? META[name] : NO_META;
    const now = ctx.currentTime;
    const last = lastByName[name];
    if (last !== undefined && now >= last && now - last < (m.g ?? 0.03)) return; // multi-hit throttle
    lastByName[name] = now;
    lastSfx = now;
    wake();
    scheduleIdle();
    if (vol.sfx <= 0.001) return;
    const o = opts && typeof opts === 'object' ? opts : {};
    const amt = Number(o.amount);
    const k = Number.isFinite(amt) && amt > 0 ? clamp(Math.log2(1 + amt) / Math.log2(41), 0.12, 1) : 0.5;
    let p = semis((Math.random() * 2 - 1) * (m.j ?? 0.35));
    const pm = Number(o.pitch);
    if (Number.isFinite(pm) && pm > 0) p *= clamp(pm, 0.25, 4);
    const vm = Number(o.volume);
    const level = (m.l ?? 1) * (Number.isFinite(vm) && vm >= 0 ? Math.min(vm, 2) : 1);
    const pan = Number(o.pan);
    makeRoomSfx();
    const V = new Voice(G.sDry, G.sWet, m.w ?? 0.2, level, Number.isFinite(pan) ? pan : 0);
    V.pri = m.pri || 1;
    SFX[name](V, now + 0.005, p, k, o);
    V.onfree = freeSfx;
    sfxVoices.push(V);
    V.done();
    if (m.duck) duck(m.duck);
  } catch (e) { /* never throw into game code */ }
}

export function music(track) {
  try {
    if (track === undefined) track = null;
    if (track !== null && (typeof track !== 'string' || !HAS(TRACKS, track))) return; // unknown: ignore
    if (track === wanted) return; // re-calling the current track is a no-op
    wanted = track;
    applyMusic();
  } catch (e) { /* ignore */ }
}

export function setVolume(kind, v) {
  try {
    if (kind !== 'music' && kind !== 'sfx') return;
    v = Number(v);
    if (!Number.isFinite(v)) return;
    v = clamp(v, 0, 1);
    const was = vol[kind];
    vol[kind] = v;
    if (!ctx) return;
    applyVolumes(false);
    if (kind === 'music' && (was > 0.001) !== (v > 0.001)) applyMusic(); // fully muted music stops synthesizing
  } catch (e) { /* ignore */ }
}

export function suspend() {
  try {
    if (!ctx) return;
    userPaused = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    safe(ctx.suspend());
  } catch (e) { /* ignore */ }
}

export function resume() {
  try {
    if (!ctx) return;
    userPaused = false;
    idlePaused = false;
    safe(ctx.resume());
    applyMusic();
    ensureTick();
    if (!inst) scheduleIdle();
  } catch (e) { /* ignore */ }
}
