// Combat engine. Methods are mixed into Game.prototype (see game.js), so card
// and enemy code calls them as g.attack(...), g.block(...), etc.
//
// The engine is UI-agnostic: it reports visual events through g.emit(type, data)
// and asks for pacing/choices through g.ui.wait(ms) and g.ui.choose(opts).

import { CARDS, STATUSES, ENEMIES, RELICS, POTIONS, ENCOUNTERS } from './registry.js';
import { rnd, int, pick, shuffle } from './rng.js';

export const MASKS = {
  wolf: {
    name: 'Wolf Mask', icon: 'mask_wolf',
    desc: 'Attacks deal 50% more damage. You take 25% more attack damage.',
    atkMul: 1.5, takeMul: 1.25,
  },
  moth: {
    name: 'Moth Mask', icon: 'mask_moth',
    desc: 'Block gained from cards is increased by 50%.',
    blockMul: 1.5,
  },
  owl: {
    name: 'Owl Mask', icon: 'mask_owl',
    desc: 'Draw 1 more card each turn. When you leave the Owl Mask, gain 2 Energy.',
    draw: 1, exitEnergy: 2,
  },
};

export const SPIRITS = {
  wisp: {
    name: 'Wisp', icon: 'sp_wisp',
    desc: (s) => `End of turn: deal ${3 + s} damage to a random enemy. Release: deal ${8 + s} damage to a random enemy.`,
    passive(g, s) { const e = g.randomEnemy(); if (e) g.damage(e, 3 + s, { type: 'spirit', src: g.player }); },
    release(g, s) { const e = g.randomEnemy(); if (e) g.damage(e, 8 + s, { type: 'spirit', src: g.player }); },
  },
  warden: {
    name: 'Warden', icon: 'sp_warden',
    desc: (s) => `End of turn: gain ${2 + s} Block. Release: gain ${5 + s} Block.`,
    passive(g, s) { g.gainBlock(g.player, 2 + s, { raw: true }); },
    release(g, s) { g.gainBlock(g.player, 5 + s, { raw: true }); },
  },
  lantern: {
    name: 'Lantern', icon: 'sp_lantern', startOfTurn: true,
    desc: () => `Start of turn: gain 1 Energy. Release: gain 2 Energy.`,
    passive(g) { g.gainEnergy(1); },
    release(g) { g.gainEnergy(2); },
  },
  banshee: {
    name: 'Banshee', icon: 'sp_banshee',
    desc: (s) => `End of turn: deal ${1 + s} damage to ALL enemies. Release: deal ${4 + s} damage to ALL enemies and apply 1 Exposed.`,
    passive(g, s) { for (const e of g.enemies) g.damage(e, 1 + s, { type: 'spirit', src: g.player }); },
    release(g, s) {
      for (const e of g.enemies) { g.damage(e, 4 + s, { type: 'spirit', src: g.player }); g.apply(e, 'exposed', 1); }
    },
  },
};

export const DRAUGHTS = ['draught_bile', 'draught_ash', 'draught_ember', 'draught_clarity', 'draught_marrow'];

// Status/enemy hooks with these names are only ever called on their owner.
const OWNER_ONLY = new Set(['turnStart', 'turnEnd', 'hpLost', 'onAttacked', 'died']);

// Hard cap on cards played in one turn; only a runaway infinite combo can ever reach it.
const MAX_CARDS_PER_TURN = 120;

const num = (x, g, e) => (typeof x === 'function' ? x(g, e) : x);

export const combatMethods = {
  // ------------------------------------------------------------------ getters
  get cb() { return this.run && this.run.combat; },
  get player() { return this.run.player; },
  get enemies() { return this.cb ? this.cb.enemies.filter((e) => !e.dead) : []; },
  get crng() { return this.run.rng.combat; },
  get srng() { return this.run.rng.shuffle; },
  get cnt() { return this.cb.cnt; },
  get tot() { return this.cb.tot; },
  get hand() { return this.cb.hand; },
  get energy() { return this.cb.energy; },

  cardDef(card) { return CARDS[card.id]; },
  allEntities() { return this.cb ? [this.player, ...this.cb.enemies.filter((e) => !e.dead)] : [this.player]; },
  st(e, id) { return (e && e.st && e.st[id]) || 0; },
  byUid(uid) { return this.cb && this.cb.enemies.find((e) => e.uid === uid); },
  randomEnemy() { const a = this.enemies; return a.length ? pick(this.crng, a) : null; },
  lowestEnemy() { return this.enemies.reduce((m, e) => (!m || e.hp < m.hp ? e : m), null); },
  hasRelic(id) { return this.run.relics.some((r) => r.id === id); },
  relic(id) { return this.run.relics.find((r) => r.id === id); },

  // ---------------------------------------------------------- hook dispatch
  trigger(evt, ...args) {
    if (this.cb) {
      for (const e of this.allEntities()) {
        for (const id of Object.keys(e.st)) {
          if (!e.st[id]) continue;
          const d = STATUSES[id];
          if (d && d[evt] && !OWNER_ONLY.has(evt)) d[evt](this, e, e.st[id], ...args);
        }
        if (!e.isPlayer && !e.dead && !OWNER_ONLY.has(evt) && evt !== 'death') {
          const ed = ENEMIES[e.id];
          if (ed && ed.on && ed.on[evt]) ed.on[evt](this, e, ...args);
        }
      }
    }
    for (const r of [...this.run.relics]) {
      const d = RELICS[r.id];
      if (d && d[evt]) d[evt](this, r, ...args);
    }
  },

  ownerTurnHooks(e, evt) {
    for (const id of Object.keys(e.st)) {
      if (!e.st[id] || e.dead) continue;
      const d = STATUSES[id];
      if (d && d[evt]) d[evt](this, e, e.st[id]);
    }
  },

  sumMod(e, key, ...args) {
    let t = 0;
    for (const id of Object.keys(e.st)) {
      const d = STATUSES[id];
      if (d && d[key]) t += d[key](this, e, e.st[id], ...args) || 0;
    }
    if (e.isPlayer) {
      for (const r of this.run.relics) { const d = RELICS[r.id]; if (d && d[key]) t += d[key](this, r, ...args) || 0; }
      const m = this.cb && this.cb.mask && MASKS[this.cb.mask];
      if (m && m[key] != null) t += num(m[key], this) || 0;
    }
    return t;
  },

  mulMod(e, key, ...args) {
    let t = 1;
    for (const id of Object.keys(e.st)) {
      const d = STATUSES[id];
      if (d && d[key]) t *= d[key](this, e, e.st[id], ...args) ?? 1;
    }
    if (e.isPlayer) {
      for (const r of this.run.relics) { const d = RELICS[r.id]; if (d && d[key]) t *= d[key](this, r, ...args) ?? 1; }
      const m = this.cb && this.cb.mask && MASKS[this.cb.mask];
      if (m && m[key] != null) t *= num(m[key], this) ?? 1;
    }
    return t;
  },

  exposedMul(o) {
    let m = 1.5;
    if (!o.isPlayer) for (const r of this.run.relics) { const d = RELICS[r.id]; if (d && d.exposedBonus) m += d.exposedBonus; }
    else for (const r of this.run.relics) { const d = RELICS[r.id]; if (d && d.exposedSelf) m += d.exposedSelf; }
    return m;
  },
  weakMul(o) {
    let m = 0.75;
    if (!o.isPlayer) for (const r of this.run.relics) { const d = RELICS[r.id]; if (d && d.weakBonus) m -= d.weakBonus; }
    return m;
  },

  // ------------------------------------------------------------- statuses
  apply(tgt, id, n, src) {
    const d = STATUSES[id];
    if (!d) throw new Error('unknown status ' + id);
    if (!tgt || tgt.dead || !n) return false;
    if (src === undefined) src = this.player;
    const debuff = d.kind === 'debuff' || (d.negOk && n < 0);
    if (debuff && src !== tgt) {
      if (tgt.st.ward > 0) {
        this.addStatus(tgt, 'ward', -1);
        this.emit('negated', { e: tgt, id });
        return false;
      }
      if (src && src.isPlayer) n += this.sumMod(src, 'applyAdd', tgt, id, n);
      if (!tgt.isPlayer && ENEMIES[tgt.id]?.immune?.includes(id)) { this.emit('negated', { e: tgt, id }); return false; }
    }
    if (!n) return false;
    // A duration debuff the enemy puts on the player during the enemy phase must
    // survive this round's decay, or it would expire before it ever mattered.
    if (tgt.isPlayer && d.decay === 'ownerTurnEnd' && this.cb && this.cb.phase === 'enemy') {
      tgt.justApplied = tgt.justApplied || {};
      tgt.justApplied[id] = true;
    }
    this.addStatus(tgt, id, n);
    this.trigger('statusApplied', tgt, id, n, src);
    return true;
  },
  applyAll(id, n) { for (const e of this.enemies) this.apply(e, id, n); },
  applySelf(id, n) { return this.apply(this.player, id, n, this.player); },

  addStatus(e, id, n, opts = {}) {
    const d = STATUSES[id];
    const v = (e.st[id] || 0) + n;
    if (v === 0 || (v < 0 && !(d && d.negOk))) delete e.st[id];
    else e.st[id] = Math.max(-999, Math.min(999, v));
    if (!opts.silent) this.emit('status', { e, id, n });
  },
  removeStatus(e, id) { if (e.st[id] != null) { delete e.st[id]; this.emit('status', { e, id, n: 0 }); } },

  decay(e) {
    for (const id of Object.keys(e.st)) {
      const d = STATUSES[id];
      if (d && d.decay === 'ownerTurnEnd') {
        if (e.justApplied && e.justApplied[id]) { delete e.justApplied[id]; continue; }
        this.addStatus(e, id, -1, { silent: true });
      }
    }
  },

  // ---------------------------------------------------------- damage & block
  calcAttack(src, tgt, base, ctx = {}) {
    let d = base + this.sumMod(src, 'atkAdd', ctx);
    let m = this.mulMod(src, 'atkMul', ctx);
    if (tgt) m *= this.mulMod(tgt, 'takeMul', ctx);
    return Math.max(0, Math.floor(Math.max(0, d) * m + 1e-9));
  },

  // Player attack from a card.
  attack(target, dmg, times = 1) {
    let total = 0;
    for (let i = 0; i < times; i++) {
      if (!target || target.dead) break;
      total += this.hit(this.player, target, dmg, { card: this.cb.playing });
    }
    return total;
  },
  attackAll(dmg, times = 1) {
    let total = 0;
    for (let i = 0; i < times; i++) for (const e of this.enemies) total += this.hit(this.player, e, dmg, { card: this.cb.playing, aoe: true });
    return total;
  },
  attackRandom(dmg, times = 1) {
    let total = 0;
    for (let i = 0; i < times; i++) { const e = this.randomEnemy(); if (e) total += this.hit(this.player, e, dmg, { card: this.cb.playing }); }
    return total;
  },

  hit(src, tgt, base, ctx = {}) {
    if (!tgt || tgt.dead || !src || src.dead) return 0;
    const dmg = this.calcAttack(src, tgt, base, ctx);
    return this.damage(tgt, dmg, { type: 'attack', src, ...ctx });
  },

  damage(tgt, amount, opts = {}) {
    if (!tgt || tgt.dead || !this.cb || this.cb.phase === 'over') return 0;
    let a = Math.max(0, Math.floor(amount));
    if (tgt.isPlayer && a > 0) for (const r of this.run.relics) { const d = RELICS[r.id]; if (d && d.modDamageTaken) a = d.modDamageTaken(this, r, a, opts); }
    if (tgt.st.phantasm && a > 1) a = 1;
    if (tgt.st.stasis_guard && a > tgt.st.stasis_guard) a = tgt.st.stasis_guard;
    const blocked = Math.min(tgt.block, a);
    tgt.block -= blocked;
    const unblocked = a - blocked;
    this.emit('damage', { e: tgt, amount: a, blocked, unblocked, type: opts.type, src: opts.src });
    if (blocked > 0 && tgt.block === 0) this.emit('blockBroken', { e: tgt });
    if (unblocked > 0) this.loseHp(tgt, unblocked, opts);
    if (opts.type === 'attack' && opts.src) {
      for (const id of Object.keys(tgt.st)) {
        const d = STATUSES[id];
        if (d && d.onAttacked && tgt.st[id]) d.onAttacked(this, tgt, tgt.st[id], opts.src, unblocked);
      }
      if (tgt.isPlayer) this.trigger('playerAttacked', opts.src, unblocked, a);
      else this.trigger('enemyAttacked', tgt, unblocked, a);
    }
    return unblocked;
  },

  loseHp(e, n, opts = {}) {
    if (!e || e.dead || n <= 0 || !this.cb || this.cb.phase === 'over') return 0;
    if (e.st.phantasm && n > 1) n = 1;
    if (e.isPlayer) for (const r of this.run.relics) { const d = RELICS[r.id]; if (d && d.modHpLoss) n = d.modHpLoss(this, r, n, opts); }
    if (e.st.invincible != null) { n = Math.min(n, e.st.invincible); this.addStatus(e, 'invincible', -n, { silent: true }); if (!e.st.invincible) e.st.invincible = 0; }
    if (n <= 0) return 0;
    e.hp -= n;
    this.emit('hploss', { e, n, type: opts.type });
    if (e.isPlayer) { this.cnt.hpLost += n; this.tot.hpLost += n; this.run.stats.damageTaken += n; }
    for (const id of Object.keys(e.st)) {
      const d = STATUSES[id];
      if (d && d.hpLost && e.st[id]) d.hpLost(this, e, e.st[id], n, opts);
    }
    if (!e.isPlayer) { const ed = ENEMIES[e.id]; if (ed.on && ed.on.hpLost) ed.on.hpLost(this, e, n, opts); }
    this.trigger('hpLost', e, n, opts);
    if (e.hp <= 0) this.kill(e);
    return n;
  },

  kill(e) {
    if (e.isPlayer) {
      for (const r of this.run.relics) {
        const d = RELICS[r.id];
        if (d && d.revive && d.revive(this, r)) { this.emit('revive', { e }); return; }
      }
      const pi = this.run.potions.findIndex((p) => p && POTIONS[p] && POTIONS[p].revive);
      if (pi >= 0) {
        const pd = POTIONS[this.run.potions[pi]];
        this.run.potions[pi] = null;
        e.hp = Math.max(1, Math.floor(e.maxHp * pd.revive * this.potionMul()));
        this.emit('revive', { e });
        return;
      }
      e.hp = 0;
      this.cb.result = 'lost';
      this.cb.phase = 'over';
      return;
    }
    e.hp = 0;
    e.dead = true;
    this.emit('death', { e });
    for (const id of Object.keys(e.st)) { const d = STATUSES[id]; if (d && d.died) d.died(this, e, e.st[id]); }
    const ed = ENEMIES[e.id];
    if (ed.on && ed.on.death) ed.on.death(this, e);
    this.trigger('enemyDied', e);
    if (ed.leader) for (const m of this.enemies) if (m.st.minion) { m.dead = true; m.fled = true; this.emit('flee', { e: m }); }
    this.checkEnd();
  },

  gainBlock(e, n, opts = {}) {
    if (!e || e.dead) return 0;
    if (!opts.raw) {
      n += this.sumMod(e, 'blockAdd');
      n = Math.floor(Math.max(0, n) * this.mulMod(e, 'blockMul') + 1e-9);
    }
    n = Math.max(0, Math.floor(n));
    if (!n) return 0;
    e.block = Math.min(999, e.block + n);
    this.emit('block', { e, n });
    this.trigger('blockGained', e, n);
    return n;
  },
  block(n) { return this.gainBlock(this.player, n); },
  calcBlock(n) {
    const e = this.player;
    n += this.sumMod(e, 'blockAdd');
    return Math.max(0, Math.floor(Math.max(0, n) * this.mulMod(e, 'blockMul') + 1e-9));
  },

  heal(e, n) {
    if (!e || e.dead || n <= 0) return 0;
    if (e.isPlayer) n = Math.floor(n * this.mulMod(e, 'healMul'));
    const before = e.hp;
    e.hp = Math.min(e.maxHp, e.hp + n);
    const h = e.hp - before;
    if (h > 0) { this.emit('heal', { e, n: h }); if (e.isPlayer) this.trigger('healed', h); }
    return h;
  },
  healPlayer(n) { return this.heal(this.player, n); },

  gainEnergy(n) { this.cb.energy = Math.max(0, this.cb.energy + n); this.emit('energy', { n }); },

  // ------------------------------------------------------------- card piles
  makeCard(id, up = 0) {
    if (!CARDS[id]) throw new Error('unknown card ' + id);
    return { uid: ++this.run.uidc, id, up: up ? 1 : 0 };
  },

  cardVals(card) {
    const d = CARDS[card.id];
    const v = { ...(d.v || {}) };
    if (card.up && d.up) for (const k in d.up) v[k] = (v[k] || 0) + d.up[k];
    if (card.bonus) for (const k in card.bonus) v[k] = (v[k] || 0) + card.bonus[k];
    return v;
  },

  baseCost(card) {
    const d = CARDS[card.id];
    return card.up && d.upCost != null ? d.upCost : d.cost;
  },

  cardCost(card) {
    let c = this.baseCost(card);
    if (c === 'X' || c < 0) return c;
    if (card.costCombat != null) c = card.costCombat;
    if (card.costTurn != null) c = card.costTurn;
    if (this.cb) c += this.sumMod(this.player, 'costMod', card, c);
    return Math.max(0, c);
  },

  hasKw(card, kw) {
    if (card.kwAdd && card.kwAdd.includes(kw)) return true;
    if (card.kwDel && card.kwDel.includes(kw)) return false;
    const d = CARDS[card.id];
    if (card.up && d.upKw) {
      if (d.upKw.add && d.upKw.add.includes(kw)) return true;
      if (d.upKw.remove && d.upKw.remove.includes(kw)) return false;
    }
    return !!(d.kw && d.kw.includes(kw));
  },

  keywordsOf(card) {
    return ['innate', 'retain', 'ethereal', 'exhaust', 'unplayable'].filter((k) => this.hasKw(card, k));
  },

  canPlay(card) {
    const cb = this.cb;
    if (!cb || cb.phase !== 'player') return false;
    const d = CARDS[card.id];
    if (this.hasKw(card, 'unplayable') || d.cost === -1) return false;
    const cost = this.cardCost(card);
    if (cost !== 'X' && cost > cb.energy) return false;
    if (cb.cnt.cards >= MAX_CARDS_PER_TURN) return false; // runaway-combo safety net
    if (d.canPlay && !d.canPlay(this, card)) return false;
    for (const id of Object.keys(this.player.st)) {
      const sd = STATUSES[id];
      if (sd && sd.canPlay && !sd.canPlay(this, this.player, this.player.st[id], card)) return false;
    }
    for (const r of this.run.relics) { const rd = RELICS[r.id]; if (rd && rd.canPlay && !rd.canPlay(this, r, card)) return false; }
    return true;
  },

  whyUnplayable(card) {
    const d = CARDS[card.id];
    if (this.hasKw(card, 'unplayable') || d.cost === -1) return 'This card cannot be played.';
    const cost = this.cardCost(card);
    if (cost !== 'X' && cost > this.cb.energy) return 'Not enough Energy.';
    if (this.cb.cnt.cards >= MAX_CARDS_PER_TURN) return 'The hour will bear no more this turn.';
    if (d.canPlay && !d.canPlay(this, card)) return d.cantText || 'Cannot play this now.';
    return 'Cannot play this now.';
  },

  draw(n = 1) {
    const cb = this.cb;
    if (!cb || cb.phase === 'over') return [];
    if (this.player.st.no_draw && cb.phase === 'player' && cb.drawnThisTurn) return [];
    const drawn = [];
    for (let i = 0; i < n; i++) {
      if (cb.hand.length >= 10) { this.emit('handFull', {}); break; }
      if (!cb.draw.length) {
        if (!cb.discard.length) break;
        this.reshuffle();
      }
      const c = cb.draw.pop();
      cb.hand.push(c);
      drawn.push(c);
      this.cnt.drawn++;
      this.emit('draw', { card: c });
      const d = CARDS[c.id];
      if (d.onDraw) d.onDraw(this, c);
      this.trigger('cardDrawn', c);
    }
    return drawn;
  },

  reshuffle() {
    const cb = this.cb;
    cb.draw = shuffle(this.srng, cb.discard.concat(cb.draw));
    cb.discard = [];
    this.emit('shuffle', {});
    this.trigger('shuffle');
  },

  removeFromPiles(card) {
    const cb = this.cb;
    for (const p of ['hand', 'draw', 'discard', 'exhaust']) {
      const i = cb[p].indexOf(card);
      if (i >= 0) { cb[p].splice(i, 1); return p; }
    }
    return null;
  },

  exhaustCard(card) {
    const cb = this.cb;
    this.removeFromPiles(card);
    if (cb.playing === card) card._moved = true;
    cb.exhaust.push(card);
    this.cnt.exhausted++; this.tot.exhausted++;
    this.emit('exhaust', { card });
    const d = CARDS[card.id];
    if (d.onExhaust) d.onExhaust(this, card);
    this.trigger('cardExhausted', card);
  },

  discardCard(card, manual = true) {
    const cb = this.cb;
    this.removeFromPiles(card);
    if (cb.playing === card) card._moved = true;
    cb.discard.push(card);
    if (manual) {
      this.cnt.discarded++; this.tot.discarded++;
      this.emit('discard', { card });
      const d = CARDS[card.id];
      if (d.onDiscard) d.onDiscard(this, card);
      this.trigger('cardDiscarded', card);
    }
  },

  // where: 'hand' | 'draw' (random position) | 'drawTop' | 'discard'
  addCard(id, where = 'hand', opts = {}) {
    const cb = this.cb;
    const c = this.makeCard(id, opts.up);
    if (opts.cost0) c.costCombat = 0;
    if (opts.costTurn != null) c.costTurn = opts.costTurn;
    if (opts.ethereal) c.kwAdd = [...(c.kwAdd || []), 'ethereal'];
    if (opts.exhaust) c.kwAdd = [...(c.kwAdd || []), 'exhaust'];
    if (where === 'hand' && cb.hand.length >= 10) where = 'discard';
    if (where === 'hand') cb.hand.push(c);
    else if (where === 'draw') cb.draw.splice(int(this.srng, 0, cb.draw.length), 0, c);
    else if (where === 'drawTop') cb.draw.push(c);
    else cb.discard.push(c);
    this.emit('addCard', { card: c, where });
    this.trigger('cardCreated', c, where);
    return c;
  },

  copyCard(card, where = 'hand', opts = {}) {
    const c = this.addCard(card.id, where, { up: card.up, ...opts });
    if (card.bonus) c.bonus = { ...card.bonus };
    if (card.costCombat != null && !opts.cost0) c.costCombat = card.costCombat;
    return c;
  },

  upgradeCard(card) {
    if (card.up || CARDS[card.id].noUp) return false;
    card.up = 1;
    this.emit('upgrade', { card });
    return true;
  },
  canUpgrade(card) { const d = CARDS[card.id]; return !card.up && !d.noUp && d.type !== 'curse' && d.type !== 'status'; },

  // ------------------------------------------------------------- choices
  // opts: { title, from:'hand'|'draw'|'discard'|'exhaust'|'list', cards, count, min, filter }
  async choose(opts) {
    const cb = this.cb;
    let pool = opts.cards || (cb ? cb[opts.from || 'hand'] : []);
    if (opts.filter) pool = pool.filter(opts.filter);
    pool = pool.filter((c) => c !== (cb && cb.playing));
    const count = Math.min(opts.count ?? 1, pool.length);
    const min = Math.min(opts.min ?? count, pool.length);
    if (!pool.length || count <= 0) return [];
    if (pool.length <= min && !opts.always) return pool.slice(0, min);
    const res = await this.ui.choose({ ...opts, cards: pool, count, min });
    return res || [];
  },
  chooseHand(count, title, filter) { return this.choose({ from: 'hand', count, title, filter }); },

  async discover(opts = {}) {
    const ids = this.randomCards({ count: opts.count || 3, hero: opts.hero ?? this.run.hero, type: opts.type, rarity: opts.rarity, rng: this.srng, any: opts.any });
    const cards = ids.map((id) => this.makeCard(id, opts.up));
    const [c] = await this.choose({ cards, count: 1, min: 1, title: opts.title || 'Choose a card', always: true });
    if (!c) return null;
    return this.addCard(c.id, 'hand', { up: c.up, cost0: opts.cost0 !== false && opts.costTurn == null, costTurn: opts.costTurn });
  },

  // ------------------------------------------------------------- hero mechanics
  setMask(m) {
    const cb = this.cb;
    if (cb.mask === m) return false;
    const from = cb.mask;
    if (from && MASKS[from].exitEnergy) this.gainEnergy(MASKS[from].exitEnergy + this.sumMod(this.player, 'owlExitAdd'));
    cb.mask = m || null;
    this.cnt.shifts++; this.tot.shifts++;
    this.emit('mask', { from, to: cb.mask });
    this.trigger('shift', from, cb.mask);
    return true;
  },

  channel(kind) {
    const cb = this.cb;
    if (!SPIRITS[kind] || cb.slots <= 0) return;
    if (cb.spirits.length >= cb.slots) this.release(1);
    cb.spirits.push(kind);
    this.tot.channeled++;
    this.emit('channel', { kind });
    this.trigger('channel', kind);
  },
  release(n = 1) {
    const cb = this.cb;
    for (let i = 0; i < n && cb.spirits.length; i++) {
      const kind = cb.spirits.shift();
      this.emit('release', { kind });
      SPIRITS[kind].release(this, this.st(this.player, 'soul'));
      this.trigger('release', kind);
    }
  },
  releaseAll() { this.release(this.cb.spirits.length); },
  addSlots(n) {
    const cb = this.cb;
    cb.slots = Math.max(0, Math.min(10, cb.slots + n));
    while (cb.spirits.length > cb.slots) this.release(1);
    this.emit('slots', {});
  },

  brew(n = 1, opts = {}) {
    for (let i = 0; i < n; i++) {
      const id = opts.id || pick(this.srng, DRAUGHTS);
      this.addCard(id, 'hand', { up: opts.up || this.sumMod(this.player, 'brewUp') > 0 });
      this.tot.brewed++;
    }
    this.trigger('brewed', n);
  },

  swear(id, need, pay) {
    const cb = this.cb;
    const P = this.player;
    cb.oaths[id] = { need, pay };
    P.st[id] = need;
    this.emit('oath', { id, need });
    this.trigger('oathSworn', id);
  },
  // Called by oath statuses when a condition step is met.
  oathProgress(id, n = 1) {
    const P = this.player;
    if (!P.st[id]) return;
    P.st[id] -= n;
    if (P.st[id] <= 0) {
      const o = this.cb.oaths[id] || { pay: 1 };
      delete P.st[id];
      delete this.cb.oaths[id];
      this.tot.oaths++;
      this.emit('oathDone', { id });
      STATUSES[id].fulfil(this, o.pay);
      this.trigger('oathFulfilled', id);
    } else this.emit('status', { e: P, id, n: -n });
  },

  // ------------------------------------------------------------- enemies
  makeEnemy(id, opts = {}) {
    const d = ENEMIES[id];
    if (!d) throw new Error('unknown enemy ' + id);
    let hp = Array.isArray(d.hp) ? int(this.crng, d.hp[0], d.hp[1]) : d.hp;
    const asc = this.run.asc || 0;
    if (d.kind === 'normal' && asc >= 2) hp = Math.round(hp * 1.1);
    if (d.kind === 'elite' && asc >= 3) hp = Math.round(hp * 1.1);
    if (d.kind === 'boss' && asc >= 4) hp = Math.round(hp * 1.1);
    if (d.kind === 'boss' && this.run.act === 3 && asc >= 10) hp = Math.round(hp * 1.15);
    const e = {
      uid: ++this.run.uidc, id, name: d.name, isPlayer: false,
      hp: opts.hp || hp, maxHp: opts.maxHp || opts.hp || hp, block: 0, st: {},
      move: null, hist: [], turns: 0, data: {}, dead: false,
    };
    if (opts.minion) e.st.minion = 1;
    return e;
  },

  spawn(id, opts = {}) {
    const cb = this.cb;
    if (this.enemies.length >= 5) return null;
    const e = this.makeEnemy(id, opts);
    const d = ENEMIES[id];
    if (opts.front) cb.enemies.unshift(e); else cb.enemies.push(e);
    if (d.init) d.init(this, e);
    this.emit('spawn', { e });
    this.rollIntent(e);
    return e;
  },

  rollIntent(e) {
    if (e.dead) return;
    const d = ENEMIES[e.id];
    e.move = d.ai(this, e);
    if (!d.moves[e.move]) throw new Error(`enemy ${e.id} ai returned unknown move ${e.move}`);
    this.emit('intent', { e });
  },

  moveDmg(e, m) {
    let dmg = num(m.dmg, this, e);
    if (dmg == null) return null;
    if ((this.run.asc || 0) >= 8) dmg = Math.round(dmg * 1.1);
    return dmg;
  },

  intentOf(e) {
    const d = ENEMIES[e.id];
    const m = d.moves[e.move];
    if (!m) return null;
    const base = this.moveDmg(e, m);
    const times = num(m.times, this, e) || 1;
    return {
      type: m.intent, name: m.name,
      dmg: base == null ? null : this.calcAttack(e, this.player, base, {}),
      times,
    };
  },

  // Enemy attacks the player using the current move's damage.
  enemyHit(e, dmg, times = 1) {
    for (let i = 0; i < times; i++) {
      if (e.dead || this.cb.phase === 'over') break;
      this.emit('enemyStrike', { e });
      this.hit(e, this.player, dmg, { enemy: true });
    }
  },

  async enemyAct(e) {
    const d = ENEMIES[e.id];
    const m = d.moves[e.move];
    this.emit('enemyAct', { e, move: m });
    await this.ui.wait(220);
    const dmg = this.moveDmg(e, m);
    if (dmg != null) {
      const times = num(m.times, this, e) || 1;
      for (let i = 0; i < times; i++) {
        if (e.dead || this.cb.phase === 'over') break;
        this.emit('enemyStrike', { e });
        this.hit(e, this.player, dmg, { enemy: true });
        if (times > 1) await this.ui.wait(140);
      }
    }
    if (!e.dead && this.cb.phase !== 'over' && m.fx) await m.fx(this, e);
    e.hist.push(e.move);
    e.turns++;
  },

  // AI helpers
  lastMove(e, id) { return e.hist[e.hist.length - 1] === id; },
  lastTwo(e, id) { const h = e.hist; return h.length >= 2 && h[h.length - 1] === id && h[h.length - 2] === id; },
  cycle(e, list) { return list[e.turns % list.length]; },
  // weights: {move: w}; rules: {maxRepeat: {move: n}} (n consecutive allowed)
  aiPick(e, weights, maxRepeat = {}) {
    const opts = Object.keys(weights).filter((k) => {
      const lim = maxRepeat[k] ?? 99;
      if (lim <= 0) return false;
      let run = 0;
      for (let i = e.hist.length - 1; i >= 0 && e.hist[i] === k; i--) run++;
      return run < lim;
    });
    const list = opts.length ? opts : Object.keys(weights);
    let total = 0;
    for (const k of list) total += weights[k];
    let x = rnd(this.crng) * total;
    for (const k of list) { x -= weights[k]; if (x < 0) return k; }
    return list[list.length - 1];
  },

  // ------------------------------------------------------------- combat flow
  async startCombat(enemyIds, opts = {}) {
    const run = this.run;
    const P = run.player;
    P.block = 0; P.st = {}; P.justApplied = {};
    run.combat = {
      kind: opts.kind || 'fight', encounter: opts.encounter || null, fromEvent: opts.fromEvent || null,
      enemies: [], turn: 0, phase: 'start', result: null,
      draw: [], hand: [], discard: [], exhaust: [], playing: null,
      energy: 0, maxEnergy: 3, mask: null, spirits: [], slots: 3, oaths: {},
      cnt: this.freshCounters(), tot: this.freshCounters(),
      noGold: !!opts.noGold, extraReward: opts.extraReward || null, busy: false,
    };
    const cb = run.combat;
    cb.maxEnergy += this.sumMod(P, 'maxEnergy');
    for (const id of enemyIds) {
      const e = this.makeEnemy(id);
      cb.enemies.push(e);
    }
    for (const e of cb.enemies) { const d = ENEMIES[e.id]; if (d.init) d.init(this, e); }
    for (const e of cb.enemies) this.markSeen("enemies", e.id);
    // Draw pile: clone the deck; innate cards go on top.
    const pile = run.deck.map((c) => ({ ...c, deckUid: c.uid }));
    shuffle(this.srng, pile);
    const innate = pile.filter((c) => this.hasKw(c, 'innate'));
    cb.draw = pile.filter((c) => !this.hasKw(c, 'innate')).concat(innate);
    cb.innateCount = innate.length;
    this.emit('combatStart', {});
    this.trigger('combatStart');
    for (const e of cb.enemies) this.rollIntent(e);
    await this.beginPlayerTurn(true);
    await this.afterAction();
  },

  freshCounters() {
    return {
      cards: 0, attacks: 0, skills: 0, powers: 0, drawn: 0, exhausted: 0, discarded: 0,
      hpLost: 0, shifts: 0, channeled: 0, brewed: 0, oaths: 0, blockGainedTurns: 0,
    };
  },

  async beginPlayerTurn(first) {
    const cb = this.cb;
    const P = this.player;
    cb.turn++;
    cb.phase = 'player';
    cb.drawnThisTurn = false;
    if (P.st.bulwark || P.st.barricade) {
      if (P.st.bulwark) this.addStatus(P, 'bulwark', -1, { silent: true });
    } else P.block = 0;
    const keepCnt = cb.cnt;
    cb.cnt = this.freshCounters();
    cb.cnt.prevHpLost = keepCnt.hpLost;
    cb.energy = (P.st.conserve ? cb.energy : 0) + cb.maxEnergy + this.st(P, 'energy_up') + this.st(P, 'next_energy');
    this.removeStatus(P, 'next_energy');
    this.emit('turnStart', { turn: cb.turn });
    this.ownerTurnHooks(P, 'turnStart');
    if (this.checkEnd()) return;
    for (const k of [...cb.spirits]) if (SPIRITS[k].startOfTurn) SPIRITS[k].passive(this, this.st(P, 'soul'));
    if (P.st.next_block) { this.gainBlock(P, P.st.next_block, { raw: true }); this.removeStatus(P, 'next_block'); }
    this.trigger('turnStart', cb.turn);
    if (this.checkEnd()) return;
    let n = 5 + this.st(P, 'draw_up') + this.st(P, 'next_draw') - this.st(P, 'dread');
    if (cb.mask && MASKS[cb.mask].draw) n += MASKS[cb.mask].draw;
    n += this.sumMod(P, 'drawMod', first);
    if (first) n = Math.max(n, cb.innateCount || 0);
    this.removeStatus(P, 'next_draw');
    this.removeStatus(P, 'dread');
    this.draw(Math.max(0, n));
    cb.drawnThisTurn = true;
    this.trigger('afterDraw', cb.turn);
    this.checkEnd();
  },

  async playCard(cardUid, targetUid) {
    const cb = this.cb;
    if (!cb || cb.phase !== 'player' || cb.busy) return false;
    const card = cb.hand.find((c) => c.uid === cardUid);
    if (!card || !this.canPlay(card)) return false;
    const d = CARDS[card.id];
    let target = targetUid != null ? this.byUid(targetUid) : null;
    if (d.target === 'enemy') {
      if (!target || target.dead) {
        if (this.enemies.length === 1) target = this.enemies[0];
        else return false;
      }
    } else target = null;
    cb.busy = true;
    try {
      const cost = this.cardCost(card);
      let x = 0;
      if (cost === 'X') { x = cb.energy; cb.energy = 0; } else cb.energy -= cost;
      cb.hand.splice(cb.hand.indexOf(card), 1);
      cb.playing = card;
      card._moved = false;
      this.emit('play', { card, target });
      await this.resolveCard(card, target, x);
      cb.playing = null;
      if (!card._moved) {
        if (d.type === 'power') this.emit('powerUsed', { card });
        else if (this.hasKw(card, 'exhaust') || card.exhaustOnce) { card.exhaustOnce = false; this.exhaustCard(card); }
        else if (card.returnOnce) { card.returnOnce = false; cb.hand.push(card); this.emit('addCard', { card, where: 'hand' }); }
        else cb.discard.push(card);
      }
      delete card._moved;
      const t = d.type;
      cb.cnt.cards++; cb.tot.cards++;
      if (t === 'attack') { cb.cnt.attacks++; cb.tot.attacks++; }
      if (t === 'skill') { cb.cnt.skills++; cb.tot.skills++; }
      if (t === 'power') { cb.cnt.powers++; cb.tot.powers++; }
      this.run.stats.cardsPlayed++;
      if (t === 'attack' && this.player.st.vigor) this.removeStatus(this.player, 'vigor');
      if (cb.phase !== 'over') this.trigger('cardPlayed', card, target);
      this.checkEnd();
    } finally {
      cb.busy = false;
      cb.playing = null;
    }
    await this.afterAction();
    return true;
  },

  async resolveCard(card, target, x = 0, opts = {}) {
    const cb = this.cb;
    const d = CARDS[card.id];
    const times = 1 + (opts.noEcho ? 0 : this.sumMod(this.player, 'extraPlays', card));
    for (let i = 0; i < times; i++) {
      if (cb.phase === 'over') break;
      let t = target;
      if (d.target === 'enemy' && (!t || t.dead)) t = this.randomEnemy();
      if (d.target === 'enemy' && !t) break;
      const v = this.cardVals(card);
      v.x = x + (x || this.baseCost(card) === 'X' ? this.sumMod(this.player, 'xBonus') : 0);
      if (i > 0) this.emit('echo', { card });
      if (d.play) await d.play(this, v, t, card);
    }
  },

  // Auto-play a card for free (e.g. "play the top card of your draw pile").
  async autoPlay(card, target) {
    const cb = this.cb;
    const d = CARDS[card.id];
    this.removeFromPiles(card);
    const prev = cb.playing;
    cb.playing = card;
    card._moved = false;
    if (d.target === 'enemy' && (!target || target.dead)) target = this.randomEnemy();
    this.emit('play', { card, target, auto: true });
    const x = this.baseCost(card) === 'X' ? cb.energy : 0;
    if (!this.hasKw(card, 'unplayable')) await this.resolveCard(card, target, x);
    cb.playing = prev;
    if (!card._moved) {
      if (d.type === 'power') { /* consumed */ }
      else if (this.hasKw(card, 'exhaust')) this.exhaustCard(card);
      else cb.discard.push(card);
    }
    delete card._moved;
    if (cb.phase !== 'over') this.trigger('cardPlayed', card, target);
  },

  async endTurn() {
    const cb = this.cb;
    if (!cb || cb.phase !== 'player' || cb.busy) return;
    cb.busy = true;
    try {
      // Early exits (combat decided mid end-of-turn) must still reach afterAction().
      endTurnBody: {
      const P = this.player;
      cb.phase = 'enemy';
      this.emit('endTurn', {});
      // Spirit passives
      for (const k of [...cb.spirits]) {
        if (!SPIRITS[k].startOfTurn) { SPIRITS[k].passive(this, this.st(P, 'soul')); this.emit('spiritPulse', { kind: k }); }
        if (this.checkEnd()) break endTurnBody;
      }
      this.ownerTurnHooks(P, 'turnEnd');
      if (this.checkEnd()) break endTurnBody;
      for (const c of [...cb.hand]) { const d = CARDS[c.id]; if (d.endTurnInHand) d.endTurnInHand(this, c); }
      if (this.checkEnd()) break endTurnBody;
      this.trigger('turnEnd', cb.turn);
      if (this.checkEnd()) break endTurnBody;
      const retainAll = this.sumMod(P, 'retainAll') > 0;
      for (const c of [...cb.hand]) {
        if (this.hasKw(c, 'ethereal')) this.exhaustCard(c);
        else if (this.hasKw(c, 'retain') || c.retainOnce || retainAll) {
          c.retainOnce = false;
          const d = CARDS[c.id];
          if (d.onRetain) d.onRetain(this, c);
        } else this.discardCard(c, false);
      }
      for (const p of ['hand', 'draw', 'discard', 'exhaust']) for (const c of cb[p]) delete c.costTurn;
      this.emit('handDiscarded', {});
      await this.ui.wait(250);
      await this.enemyPhase();
      }
    } finally {
      cb.busy = false;
    }
    await this.afterAction();
  },

  async enemyPhase() {
    const cb = this.cb;
    for (const e of this.enemies) if (!e.st.barricade) e.block = 0;
    for (const e of [...this.enemies]) {
      if (cb.phase === 'over') return;
      if (e.dead) continue;
      this.ownerTurnHooks(e, 'turnStart');
      if (this.checkEnd()) return;
      if (e.dead) continue;
      await this.enemyAct(e);
      if (this.checkEnd()) return;
      if (!e.dead) { this.ownerTurnHooks(e, 'turnEnd'); this.decay(e); }
      if (this.checkEnd()) return;
      await this.ui.wait(160);
    }
    // Player duration statuses tick at the end of the round (after enemies act).
    this.decay(this.player);
    this.trigger('roundEnd', cb.turn);
    if (this.checkEnd()) return;
    for (const e of this.enemies) this.rollIntent(e);
    await this.beginPlayerTurn(false);
  },

  checkEnd() {
    const cb = this.cb;
    if (!cb) return true;
    if (cb.phase === 'over') return true;
    if (this.player.hp <= 0 || cb.result === 'lost') { cb.result = 'lost'; cb.phase = 'over'; return true; }
    if (!cb.enemies.some((e) => !e.dead)) { cb.result = 'won'; cb.phase = 'over'; return true; }
    return false;
  },

  async usePotion(slot, targetUid) {
    const run = this.run;
    const id = run.potions[slot];
    if (!id) return false;
    const d = POTIONS[id];
    const cb = this.cb;
    const inCombat = cb && cb.phase === 'player' && !cb.busy;
    if (!inCombat && !d.anytime) return false;
    if (cb && cb.busy) return false;
    let target = null;
    if (d.target === 'enemy') {
      if (!inCombat) return false;
      target = targetUid != null ? this.byUid(targetUid) : null;
      if (!target || target.dead) { if (this.enemies.length === 1) target = this.enemies[0]; else return false; }
    }
    run.potions[slot] = null;
    if (cb) cb.busy = true;
    try {
      this.emit('potion', { id, target });
      await d.use(this, target, this.potionMul());
      this.run.stats.potionsUsed++;
      this.trigger('potionUsed', id);
      if (inCombat) this.checkEnd();
    } finally { if (cb) cb.busy = false; }
    if (inCombat) await this.afterAction();
    else this.save();
    return true;
  },
  potionMul() { return this.sumMod(this.player, 'potionDouble') > 0 ? 2 : 1; },

  discardPotion(slot) { this.run.potions[slot] = null; this.save(); },

  // After any top-level action: finish combat if over, then save.
  async afterAction() {
    const cb = this.cb;
    if (cb && cb.phase === 'over' && !cb.finished) {
      cb.finished = true;
      if (cb.result === 'won') await this.combatWon();
      else await this.combatLost();
    }
    this.save();
    this.emit('refresh', {});
  },
};
