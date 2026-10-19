// Game: owns meta (persistent progression) and run (current expedition).
// UI-agnostic. A UI attaches by setting g.ui = { wait, choose } and g.onEmit.

import { combatMethods } from './combat.js';
import { runMethods } from './run.js';
import { HEROES } from './registry.js';

const META_KEY = 'hc_meta_v1';
const RUN_KEY = 'hc_run_v1';

export function freshMeta() {
  return {
    v: 1, created: Date.now(), runs: 0, wins: 0, deaths: 0,
    heroes: {
      knight: { unlocked: true, renown: 0, level: 0, wins: 0, runs: 0, bestAct: 0, ascMax: 0 },
      witch: { unlocked: false, renown: 0, level: 0, wins: 0, runs: 0, bestAct: 0, ascMax: 0 },
      wren: { unlocked: false, renown: 0, level: 0, wins: 0, runs: 0, bestAct: 0, ascMax: 0 },
      cantor: { unlocked: false, renown: 0, level: 0, wins: 0, runs: 0, bestAct: 0, ascMax: 0 },
    },
    flags: {}, seenEvents: {}, lore: {}, endings: {}, deathsBy: {}, bossesDefeated: {},
    seen: { cards: {}, relics: {}, enemies: {}, potions: {} },
    hubSeen: {}, lastRun: null, playtime: 0,
    settings: { music: 0.5, sfx: 0.7, fast: false, shake: true, confirmEnd: false },
  };
}

// Storage adapter: localStorage in the browser, in-memory elsewhere (tests).
export function makeStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const t = '__hc_t';
      localStorage.setItem(t, '1');
      localStorage.removeItem(t);
      return {
        get: (k) => localStorage.getItem(k),
        set: (k, v) => localStorage.setItem(k, v),
        del: (k) => localStorage.removeItem(k),
      };
    }
  } catch (e) { /* fall through */ }
  const mem = {};
  return { get: (k) => mem[k] ?? null, set: (k, v) => { mem[k] = v; }, del: (k) => { delete mem[k]; } };
}

export const headlessUI = {
  wait: () => Promise.resolve(),
  choose: (o) => Promise.resolve(o.cards.slice(0, o.min ?? o.count ?? 1)),
};

export class Game {
  constructor(opts = {}) {
    this.storage = opts.storage || makeStorage();
    this.ui = opts.ui || headlessUI;
    this.onEmit = null;
    this.meta = this.loadMeta();
    this.run = this.loadRun();
  }

  emit(type, data) { if (this.onEmit) this.onEmit(type, data || {}); }

  loadMeta() {
    try {
      const raw = this.storage.get(META_KEY);
      if (raw) {
        const m = JSON.parse(raw);
        const f = freshMeta();
        // Fill any fields added in later versions.
        for (const k in f) if (m[k] === undefined) m[k] = f[k];
        for (const h in f.heroes) if (!m.heroes[h]) m.heroes[h] = f.heroes[h];
        for (const k in f.settings) if (m.settings[k] === undefined) m.settings[k] = f.settings[k];
        for (const k in f.seen) if (!m.seen[k]) m.seen[k] = {};
        return m;
      }
    } catch (e) { console.warn('meta load failed', e); }
    return freshMeta();
  }

  loadRun() {
    try {
      const raw = this.storage.get(RUN_KEY);
      if (raw) {
        const r = JSON.parse(raw);
        if (r && r.v === 1 && HEROES[r.hero]) return r;
      }
    } catch (e) { console.warn('run load failed', e); }
    return null;
  }

  save() {
    if (this.run && !this.run.over) {
      try { this.storage.set(RUN_KEY, JSON.stringify(this.run)); } catch (e) { console.warn('save failed', e); }
    }
    this.saveMeta();
  }

  saveMeta() {
    try { this.storage.set(META_KEY, JSON.stringify(this.meta)); } catch (e) { console.warn('meta save failed', e); }
  }

  clearRunSave() { this.storage.del(RUN_KEY); }

  abandonRun() {
    if (!this.run) return;
    if (!this.run.over) this.endRun(false);
    this.run = null;
    this.clearRunSave();
  }

  // After the death/ending screen is dismissed.
  closeRun() {
    this.run = null;
    this.clearRunSave();
    this.saveMeta();
  }

  exportSave() {
    const data = { meta: this.meta, run: this.run && !this.run.over ? this.run : null };
    const json = JSON.stringify(data);
    return typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json).toString('base64');
  }

  importSave(code) {
    const json = typeof atob !== 'undefined' ? decodeURIComponent(escape(atob(code.trim()))) : Buffer.from(code, 'base64').toString();
    const data = JSON.parse(json);
    if (!data.meta || !data.meta.heroes) throw new Error('Not a Hollow Crown save.');
    this.storage.set(META_KEY, JSON.stringify(data.meta));
    if (data.run) this.storage.set(RUN_KEY, JSON.stringify(data.run)); else this.storage.del(RUN_KEY);
    this.meta = this.loadMeta();
    this.run = this.loadRun();
  }

  resetAll() {
    this.storage.del(META_KEY);
    this.storage.del(RUN_KEY);
    this.meta = freshMeta();
    this.run = null;
  }
}

Object.defineProperties(Game.prototype, Object.getOwnPropertyDescriptors(combatMethods));
Object.defineProperties(Game.prototype, Object.getOwnPropertyDescriptors(runMethods));
