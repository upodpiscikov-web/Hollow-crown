// Hero action buttons: free, card-less actions that sit beside the hand.
//   Strike   - once per turn, deals a little damage
//   Guard    - once per turn, gains a little Block
//   Special  - a hero move that charges as you fight (the Momentum meter)
// Plus suggestPlay(), a simple "what would a sensible player do next?" helper that
// powers the Auto button. Mixed into Game.prototype (see game.js).
//
// UI contract is documented in REVAMP.md.
import { CARDS, HEROES } from './registry.js';

export const ACTION_DEFAULTS = {
  strike: { dmg: 4 },
  guard: { blk: 4 },
  meterMax: 6,
};

export const BRACE_MUL = 0.64; // damage taken from a hit you Braced against (tuned in BALANCE_NOTES.md: was 0.6)

export const actionMethods = {
  actCfg() {
    const h = HEROES[this.run.hero] || {};
    const a = h.actions || {};
    return {
      strike: { ...ACTION_DEFAULTS.strike, ...(a.strike || {}) },
      guard: { ...ACTION_DEFAULTS.guard, ...(a.guard || {}) },
      meterMax: a.meterMax ?? ACTION_DEFAULTS.meterMax,
      special: h.special || null,
    };
  },

  freshActions() { return { strike: false, guard: false, meter: 0 }; },

  gainMeter(n) {
    const cb = this.cb;
    if (!cb || !cb.act || n <= 0) return;
    const max = this.actCfg().meterMax;
    const before = cb.act.meter;
    cb.act.meter = Math.min(max, before + n);
    if (cb.act.meter !== before) this.emit('meter', { meter: cb.act.meter, max, full: cb.act.meter >= max });
  },

  // Everything the UI needs to draw the action bar right now.
  actionList() {
    const cb = this.cb;
    if (!cb || !cb.act) return [];
    const cfg = this.actCfg();
    const a = cb.act;
    const mine = cb.phase === 'player' && !cb.busy;
    const list = [
      {
        id: 'strike', name: 'Strike', icon: 'act_strike', target: 'enemy', value: cfg.strike.dmg,
        desc: `Deal ${cfg.strike.dmg} damage. Once per turn.`,
        ready: mine && !a.strike && this.enemies.length > 0, used: a.strike,
      },
      {
        id: 'guard', name: 'Guard', icon: 'act_guard', target: 'none', value: cfg.guard.blk,
        desc: `Gain ${cfg.guard.blk} Block. Once per turn.`,
        ready: mine && !a.guard, used: a.guard,
      },
    ];
    if (cfg.special) {
      list.push({
        id: 'special', name: cfg.special.name, icon: cfg.special.icon || 'act_special', target: cfg.special.target || 'none',
        desc: cfg.special.desc, charge: a.meter, max: cfg.meterMax, ready: mine && a.meter >= cfg.meterMax && this.enemies.length > 0,
      });
    }
    return list;
  },

  async useAction(id, targetUid) {
    const cb = this.cb;
    if (!cb || !cb.act || cb.phase !== 'player' || cb.busy) return false;
    const cfg = this.actCfg();
    const a = cb.act;
    const spec = id === 'special' ? cfg.special : null;
    if (id === 'special' && (!spec || a.meter < cfg.meterMax)) return false;
    if (id === 'strike' && a.strike) return false;
    if (id === 'guard' && a.guard) return false;
    if (!['strike', 'guard', 'special'].includes(id)) return false;
    let target = targetUid != null ? this.byUid(targetUid) : null;
    const needsTarget = id === 'strike' || (spec && spec.target === 'enemy');
    if (needsTarget && (!target || target.dead)) {
      if (this.enemies.length === 1) target = this.enemies[0];
      else return false;
    }
    cb.busy = true;
    try {
      this.emit('action', { id, target });
      if (id === 'strike') {
        a.strike = true;
        this.attack(target, cfg.strike.dmg);
        this.gainMeter(1);
      } else if (id === 'guard') {
        a.guard = true;
        this.block(cfg.guard.blk);
        this.gainMeter(1);
      } else {
        a.meter = 0;
        this.emit('meter', { meter: 0, max: cfg.meterMax, full: false });
        this.tot.specials = (this.tot.specials || 0) + 1;
        await spec.use(this, target);
      }
      this.checkEnd();
    } finally { cb.busy = false; }
    await this.afterAction();
    return true;
  },

  // True when the player still has something to do that is worth waiting for.
  hasPlayableCard() { const cb = this.cb; return !!cb && cb.hand.some((c) => this.canPlay(c)); },
  hasFreeAction() { return this.actionList().some((x) => x.id !== 'special' && x.ready); },

  // Next sensible move for the Auto button, or null when there is nothing worth doing.
  //   { kind: 'card', card, target }  or  { kind: 'action', id, target }
  suggestPlay() {
    const cb = this.cb;
    if (!cb || cb.phase !== 'player' || cb.busy) return null;
    const foes = this.enemies;
    if (!foes.length) return null;
    const P = this.player;
    const weakest = foes.reduce((m, e) => (e.hp + e.block < m.hp + m.block ? e : m), foes[0]);
    let incoming = 0;
    for (const e of foes) { const it = this.intentOf(e); if (it && it.dmg != null) incoming += it.dmg * (it.times || 1); }
    const needBlock = incoming > P.block;
    const usable = cb.hand.filter((c) => this.canPlay(c) && CARDS[c.id].type !== 'curse' && CARDS[c.id].type !== 'status');
    const pickBy = (fn) => usable.find(fn);
    const tgtFor = (c) => (CARDS[c.id].target === 'enemy' ? weakest.uid : null);
    const vals = (c) => this.cardVals(c);
    const acts = Object.fromEntries(this.actionList().map((x) => [x.id, x]));

    // 1. Powers set up the rest of the turn.
    const power = pickBy((c) => CARDS[c.id].type === 'power');
    if (power) return { kind: 'card', card: power, target: null };
    // 2. A full Special is always worth using.
    if (acts.special && acts.special.ready) return { kind: 'action', id: 'special', target: acts.special.target === 'enemy' ? weakest.uid : null };
    // 3. Block first when the enemies would hurt.
    if (needBlock) {
      const blk = pickBy((c) => vals(c).blk != null && CARDS[c.id].type === 'skill');
      if (blk) return { kind: 'card', card: blk, target: null };
      if (acts.guard && acts.guard.ready) return { kind: 'action', id: 'guard', target: null };
    }
    // 4. Attacks, then the free Strike.
    const atk = pickBy((c) => CARDS[c.id].type === 'attack');
    if (atk) return { kind: 'card', card: atk, target: tgtFor(atk) };
    if (acts.strike && acts.strike.ready) return { kind: 'action', id: 'strike', target: weakest.uid };
    // 5. Any other skill, then a spare Guard.
    const skill = pickBy((c) => CARDS[c.id].type === 'skill' && !(this.cardCost(c) === 'X' && cb.energy < 1));
    if (skill) return { kind: 'card', card: skill, target: tgtFor(skill) };
    if (acts.guard && acts.guard.ready) return { kind: 'action', id: 'guard', target: null };
    return null;
  },
};
