// Run lifecycle: start, map navigation, rooms, rewards, shops, rest sites,
// events, act transitions, endings. Mixed into Game.prototype.

import { CARDS, RELICS, POTIONS, ENEMIES, ENCOUNTERS, EVENTS, HEROES } from './registry.js';
import { derive, int, rnd, pick, shuffle, weighted, chance } from './rng.js';
import { generateMap, key, FLOORS } from './map.js';

const RARITY_PRICE = { common: [45, 55], uncommon: [68, 82], rare: [135, 165] };
const RELIC_PRICE = { common: [143, 157], uncommon: [238, 262], rare: [285, 315], shop: [143, 157] };
const POTION_PRICE = { common: [48, 52], uncommon: [72, 78], rare: [95, 105] };

export const runMethods = {
  // ------------------------------------------------------------- new run
  newRun(heroId, asc = 0, seed) {
    const H = HEROES[heroId];
    seed = seed >>> 0;
    const streams = {};
    for (const s of ['map', 'combat', 'shuffle', 'cards', 'events', 'shop', 'potions', 'relics', 'misc', 'enc']) streams[s] = derive(seed, s);
    let maxHp = H.hp;
    if (asc >= 6) maxHp -= Math.round(H.hp * 0.06);
    this.run = {
      v: 1, hero: heroId, asc, seed, act: 1, floor: 0,
      player: { isPlayer: true, id: 'player', hp: maxHp, maxHp, block: 0, st: {} },
      gold: asc >= 9 ? H.gold - 25 : H.gold,
      deck: [], relics: [], potions: [null, null, null],
      rng: streams, uidc: 0,
      map: null, pos: null, path: [], screen: 'blessing',
      flags: {}, stats: {
        floors: 0, kills: 0, elites: 0, bosses: 0, cardsPlayed: 0, damageTaken: 0,
        goldEarned: 0, potionsUsed: 0, events: 0, start: Date.now(), acts: 1,
      },
      seenEvents: [], encHistory: [], rareBonus: -5, potionChance: 40,
      relicPool: null, bosses: {}, storyThisAct: 0, removals: 0,
      combat: null, reward: null, event: null, shop: null, rest: null, treasure: null,
    };
    const run = this.run;
    for (const id of H.deck) run.deck.push(this.makeCard(id));
    if (asc >= 7) run.deck.push(this.makeCard('regret'));
    this.buildRelicPool();
    this.addRelic(H.relic, { silent: true });
    this.startAct(1);
    run.screen = 'blessing';
    run.blessing = this.rollBlessings();
    this.meta.runs++;
    this.heroMeta(heroId).runs++;
    this.saveMeta();
    this.save();
    return run;
  },

  heroMeta(id) {
    const h = this.meta.heroes;
    if (!h[id]) h[id] = { unlocked: true, renown: 0, level: 0, wins: 0, runs: 0, bestAct: 0, ascMax: 0 };
    return h[id];
  },

  buildRelicPool() {
    const run = this.run;
    const pool = { common: [], uncommon: [], rare: [], boss: [], shop: [] };
    for (const r of Object.values(RELICS)) {
      if (!pool[r.rarity]) continue;
      if (r.hero && r.hero !== run.hero) continue;
      if (!this.relicUnlocked(r)) continue;
      pool[r.rarity].push(r.id);
    }
    for (const k in pool) shuffle(run.rng.relics, pool[k]);
    run.relicPool = pool;
  },

  relicUnlocked(r) { return !r.tier || this.meta.runs >= r.tier * 3; },

  startAct(act) {
    const run = this.run;
    run.act = act;
    run.floor = 0;
    run.pos = null;
    run.path = [];
    run.storyThisAct = 0;
    run.map = generateMap(run.rng.map, act, run.asc);
    run.boss = this.pickBoss(act);
    run.encCount = 0;
    if (act > 1) run.stats.acts = act;
  },

  pickBoss(act) {
    const run = this.run;
    const bosses = Object.values(ENCOUNTERS).filter((e) => e.act === act && e.pool === 'boss' && (!e.req || e.req(this)));
    if (!bosses.length) return null;
    return pick(run.rng.enc, bosses).id;
  },

  // ------------------------------------------------------------- blessing
  rollBlessings() {
    const r = this.run.rng.misc;
    const minor = [
      { id: 'maxhp', label: `Drink from the grave-well. Gain ${Math.round(this.run.player.maxHp * 0.1)} Max HP.` },
      { id: 'gold', label: 'Take the coins from the dead men\'s eyes. Gain 100 Gold.' },
      { id: 'potions', label: 'Hob\'s tinctures. Obtain 2 random Tinctures.' },
    ];
    const mid = [
      { id: 'remove', label: 'Bury something. Remove a card from your deck.' },
      { id: 'upgrade', label: 'Sharpen your purpose. Upgrade a card.' },
      { id: 'cardchoice', label: 'Grave goods. Choose a card to add to your deck.' },
    ];
    const major = [
      { id: 'rarecard', label: 'Lose 10% Max HP. Choose a rare card.', cost: true },
      { id: 'relic', label: 'Lose all Gold. Obtain a random relic.', cost: true },
      { id: 'remove2', label: 'Become Cursed (Regret). Remove 2 cards.', cost: true },
    ];
    return [pick(r, minor), pick(r, mid), pick(r, major), { id: 'none', label: 'Take nothing. Walk on.' }];
  },

  async chooseBlessing(i) {
    const run = this.run;
    if (run.screen !== 'blessing') return;
    const b = run.blessing[i];
    if (!b) return;
    switch (b.id) {
      case 'maxhp': this.gainMaxHp(Math.round(run.player.maxHp * 0.1)); break;
      case 'gold': this.gainGold(100); break;
      case 'potions': this.obtainPotion(); this.obtainPotion(); break;
      case 'remove': await this.removeCardChoice(1); break;
      case 'upgrade': await this.upgradeCardChoice(1); break;
      case 'cardchoice': await this.offerCards(this.randomCards({ count: 3, rarity: 'uncommon' })); break;
      case 'rarecard':
        this.loseMaxHp(Math.round(run.player.maxHp * 0.1));
        await this.offerCards(this.randomCards({ count: 3, rarity: 'rare' }));
        break;
      case 'relic': run.gold = 0; this.obtainRelic(); break;
      case 'remove2': this.addToDeck('regret'); await this.removeCardChoice(2); break;
    }
    run.blessing = null;
    run.screen = 'map';
    this.save();
    this.emit('refresh', {});
  },

  // ------------------------------------------------------------- map
  reachable() {
    const run = this.run;
    const nodes = run.map.nodes;
    if (!run.pos) return Object.values(nodes).filter((n) => n.f === 0).map((n) => key(n.f, n.l));
    const cur = nodes[run.pos];
    return cur.next.map((l) => key(cur.f + 1, l)).filter((k) => nodes[k]);
  },

  async enterNode(k) {
    const run = this.run;
    if (run.screen !== 'map') return false;
    if (!this.reachable().includes(k)) return false;
    const node = run.map.nodes[k];
    run.pos = k;
    run.path.push(k);
    run.floor = node.f + 1;
    run.stats.floors++;
    run.room = node.type;
    this.trigger('floorEnter', node.type);
    this.emit('enterNode', { node });
    switch (node.type) {
      case 'fight': await this.startEncounter('easyhard'); break;
      case 'elite': await this.startEncounter('elite'); break;
      case 'boss': await this.startEncounter('boss'); break;
      case 'event': await this.startRandomEvent(); break;
      case 'rest': this.openRest(); break;
      case 'shop': this.openShop(); break;
      case 'treasure': this.openTreasure(); break;
    }
    this.save();
    this.emit('refresh', {});
    return true;
  },

  async startEncounter(kind) {
    const run = this.run;
    let enc;
    if (kind === 'boss') enc = ENCOUNTERS[run.boss];
    else {
      const pool = kind === 'elite' ? 'elite' : (run.encCount < 3 && run.act < 4 ? 'easy' : 'hard');
      let list = Object.values(ENCOUNTERS).filter((e) => e.act === run.act && e.pool === pool && (!e.req || e.req(this)));
      if (!list.length) list = Object.values(ENCOUNTERS).filter((e) => e.act === run.act && (e.pool === 'hard' || e.pool === 'easy'));
      const recent = run.encHistory.slice(-3);
      const fresh = list.filter((e) => !recent.includes(e.id));
      enc = weighted(run.rng.enc, fresh.length ? fresh : list, (e) => e.weight || 1);
      if (kind !== 'elite') run.encCount++;
    }
    run.encHistory.push(enc.id);
    const ids = typeof enc.enemies === 'function' ? enc.enemies(this, run.rng.enc) : enc.enemies;
    run.screen = 'combat';
    await this.startCombat(ids, { kind: kind === 'easyhard' ? 'fight' : kind, encounter: enc.id });
  },

  // ------------------------------------------------------------- combat end
  async combatWon() {
    const run = this.run;
    const cb = run.combat;
    const P = run.player;
    this.trigger('combatEnd', true);
    run.stats.kills += cb.enemies.filter((e) => e.dead && !e.fled).length;
    if (cb.kind === 'elite') run.stats.elites++;
    if (cb.kind === 'boss') run.stats.bosses++;
    P.block = 0; P.st = {};
    const reward = { items: [], kind: cb.kind, fromEvent: cb.fromEvent };
    const r = run.rng.misc;
    if (!cb.noGold) {
      let gold = cb.kind === 'boss' ? int(r, 95, 105) : cb.kind === 'elite' ? int(r, 25, 35) : int(r, 10, 20);
      if (run.asc >= 9 && cb.kind === 'boss') gold = Math.round(gold * 0.75);
      if (cb.stolen) gold += cb.stolen;
      reward.items.push({ type: 'gold', n: gold });
    }
    if (cb.kind !== 'event-nocard' && !(cb.extraReward && cb.extraReward.noCards)) {
      reward.items.push({ type: 'card', options: this.rewardCards(cb.kind) });
      if (this.sumMod(P, 'extraCardReward') > 0) reward.items.push({ type: 'card', options: this.rewardCards(cb.kind) });
    }
    const pc = run.potionChance + (cb.kind === 'elite' ? 10 : 0);
    if (cb.kind !== 'boss' && rnd(run.rng.potions) * 100 < pc) {
      const pid = this.randomPotion();
      if (pid) reward.items.push({ type: 'potion', id: pid });
      run.potionChance = Math.max(0, run.potionChance - 10);
    } else run.potionChance = Math.min(100, run.potionChance + 10);
    if (cb.kind === 'elite') {
      reward.items.push({ type: 'relic', id: this.takeRelicFromPool(this.rollRelicRarity()) });
      if (this.sumMod(P, 'extraEliteRelic') > 0) reward.items.push({ type: 'relic', id: this.takeRelicFromPool(this.rollRelicRarity()) });
    }
    if (cb.extraReward) {
      if (cb.extraReward.relic) reward.items.push({ type: 'relic', id: cb.extraReward.relic === 'random' ? this.takeRelicFromPool(this.rollRelicRarity()) : cb.extraReward.relic });
      if (cb.extraReward.gold) reward.items.push({ type: 'gold', n: cb.extraReward.gold });
      if (cb.extraReward.card) reward.items.push({ type: 'card', options: [].concat(cb.extraReward.card) });
    }
    if (cb.kind === 'boss') {
      reward.boss = true;
      if (run.act < 3) reward.bossRelics = [0, 1, 2].map(() => this.takeRelicFromPool('boss')).filter(Boolean);
      this.heroMeta(run.hero).bestAct = Math.max(this.heroMeta(run.hero).bestAct || 0, run.act + 1);
      this.markBossDefeated(cb.encounter);
    }
    reward.items = reward.items.filter((it) => it.type !== 'relic' || it.id);
    run.reward = reward;
    run.combat = null;
    run.screen = 'reward';
    if (cb.fromEvent && cb.fromEvent.flag) run.flags[cb.fromEvent.flag] = true;
    this.emit('combatWon', {});
  },

  async combatLost() {
    this.emit('combatLost', {});
    this.endRun(false);
  },

  // ------------------------------------------------------------- rewards
  rewardCards(kind) {
    const run = this.run;
    const n = 3 + this.sumMod(run.player, 'cardChoices');
    const out = [];
    for (let i = 0; i < n * 6 && out.length < n; i++) {
      let rarity;
      if (kind === 'boss') rarity = 'rare';
      else {
        const roll = rnd(run.rng.cards) * 100;
        const rare = (kind === 'elite' ? 10 : 3) + run.rareBonus;
        const unc = kind === 'elite' ? 40 : 37;
        rarity = roll < rare ? 'rare' : roll < rare + unc ? 'uncommon' : 'common';
      }
      const [id] = this.randomCards({ count: 1, rarity, rng: run.rng.cards, exclude: out.map((o) => o.id) });
      if (!id) continue;
      if (kind !== 'boss') {
        if (rarity === 'rare') run.rareBonus = -5;
        else if (rarity === 'common') run.rareBonus = Math.min(40, run.rareBonus + 1);
      }
      const upChance = run.act === 2 ? 0.12 : run.act >= 3 ? 0.25 : 0;
      const up = CARDS[id].type !== 'curse' && rnd(run.rng.cards) < upChance * (run.asc >= 9 ? 0.5 : 1) ? 1 : 0;
      out.push({ id, up });
    }
    return out;
  },

  // Card pool for the current hero (or 'neutral'), respecting unlocks.
  cardPool(opts = {}) {
    const hero = opts.hero ?? this.run.hero;
    return Object.values(CARDS).filter((c) => {
      if (c.rarity === 'starter' || c.rarity === 'special' || c.rarity === 'curse') return false;
      if (c.type === 'status' || c.type === 'curse') return false;
      if (opts.any) { if (c.hero !== 'neutral' && !HEROES[c.hero]) return false; }
      else if (c.hero !== hero) return false;
      if (opts.type && c.type !== opts.type) return false;
      if (opts.rarity && c.rarity !== opts.rarity) return false;
      if (!this.cardUnlocked(c)) return false;
      return true;
    });
  },

  cardUnlocked(c) {
    if (!c.tier) return true;
    if (c.hero === 'neutral') return this.meta.runs >= c.tier * 2;
    const h = this.meta.heroes[c.hero];
    return h && h.level >= c.tier;
  },

  randomCards(opts = {}) {
    const r = opts.rng || this.run.rng.cards;
    let pool = this.cardPool(opts).filter((c) => !(opts.exclude || []).includes(c.id));
    if (!pool.length && opts.rarity) pool = this.cardPool({ ...opts, rarity: undefined }).filter((c) => !(opts.exclude || []).includes(c.id));
    shuffle(r, pool);
    return pool.slice(0, opts.count || 1).map((c) => c.id);
  },

  randomPotion(rarity) {
    const r = this.run.rng.potions;
    if (!rarity) { const x = rnd(r); rarity = x < 0.65 ? 'common' : x < 0.9 ? 'uncommon' : 'rare'; }
    const all = Object.values(POTIONS).filter((p) => !p.hero || p.hero === this.run.hero);
    if (!all.length) return null;
    const list = all.filter((p) => p.rarity === rarity);
    return (list.length ? pick(r, list) : pick(r, all)).id;
  },

  rollRelicRarity() {
    const x = rnd(this.run.rng.relics);
    return x < 0.5 ? 'common' : x < 0.83 ? 'uncommon' : 'rare';
  },

  takeRelicFromPool(rarity) {
    const pool = this.run.relicPool;
    const order = rarity === 'boss' ? ['boss'] : rarity === 'shop' ? ['shop', 'common', 'uncommon', 'rare'] : [rarity, 'uncommon', 'common', 'rare'];
    for (const tier of order) {
      while (pool[tier] && pool[tier].length) {
        const id = pool[tier].pop();
        const d = RELICS[id];
        if (this.hasRelic(id)) continue;
        if (d.canSpawn && !d.canSpawn(this)) continue;
        return id;
      }
    }
    return null;
  },

  async takeReward(i) {
    const run = this.run;
    const it = run.reward && run.reward.items[i];
    if (!it) return;
    if (it.type === 'gold') { this.gainGold(it.n); run.reward.items.splice(i, 1); }
    else if (it.type === 'potion') {
      if (!this.obtainPotion(it.id)) { this.emit('toast', { text: 'Your tincture belt is full.' }); return; }
      run.reward.items.splice(i, 1);
    } else if (it.type === 'relic') { this.addRelic(it.id); run.reward.items.splice(i, 1); }
    this.save();
    this.emit('refresh', {});
  },

  pickRewardCard(i, j) {
    const run = this.run;
    const it = run.reward && run.reward.items[i];
    if (!it || it.type !== 'card') return;
    if (j != null && it.options[j]) {
      const o = it.options[j];
      this.addToDeck(o.id, o.up);
    }
    run.reward.items.splice(i, 1);
    this.save();
    this.emit('refresh', {});
  },

  async leaveReward() {
    const run = this.run;
    const rw = run.reward;
    run.reward = null;
    if (rw && rw.boss) {
      if (run.act >= 4) { await this.finishRun('true'); return; }
      if (run.act === 3) { run.screen = 'throne'; this.save(); this.emit('refresh', {}); return; }
      run.screen = 'bossRelic';
      run.bossRelics = rw.bossRelics || [];
      this.save();
      this.emit('refresh', {});
      return;
    }
    if (run.event && run.event.resume) { run.screen = 'event'; run.event.page = run.event.resume; run.event.resume = null; }
    else { run.event = null; run.screen = 'map'; }
    this.save();
    this.emit('refresh', {});
  },

  chooseBossRelic(i) {
    const run = this.run;
    if (run.screen !== 'bossRelic') return;
    if (i != null && run.bossRelics[i]) this.addRelic(run.bossRelics[i]);
    run.bossRelics = null;
    this.nextAct(run.act + 1);
  },

  nextAct(act) {
    const run = this.run;
    const P = run.player;
    const missing = P.maxHp - P.hp;
    P.hp += run.asc >= 5 ? Math.round(missing * 0.75) : missing;
    this.startAct(act);
    run.screen = 'actIntro';
    this.trigger('actStart', act);
    this.save();
    this.emit('refresh', {});
  },

  beginAct() { if (this.run.screen === 'actIntro') { this.run.screen = 'map'; this.save(); this.emit('refresh', {}); } },

  // ------------------------------------------------------------- deck ops
  addToDeck(id, up = 0) {
    const c = this.makeCard(id, up);
    const d = CARDS[id];
    if (d.type === 'curse' && this.sumMod(this.run.player, 'curseBlock') > 0) {
      const r = this.run.relics.find((x) => RELICS[x.id].curseBlock && (x.n ?? 1) > 0);
      if (r && r.n != null) r.n--;
      this.emit('toast', { text: `${RELICS[r.id].name} wards off the curse.` });
      return null;
    }
    this.run.deck.push(c);
    this.markSeen('cards', id);
    this.emit('cardObtained', { card: c });
    this.trigger('cardAdded', c);
    return c;
  },

  removeFromDeck(card) {
    const i = this.run.deck.indexOf(card);
    if (i >= 0) { this.run.deck.splice(i, 1); this.trigger('cardRemoved', card); }
  },

  deckChoose(opts) {
    let pool = this.run.deck;
    if (opts.filter) pool = pool.filter(opts.filter);
    if (!pool.length) return Promise.resolve([]);
    return this.ui.choose({ ...opts, cards: pool, count: Math.min(opts.count || 1, pool.length), min: opts.min ?? 0, deck: true });
  },

  async removeCardChoice(n = 1, title) {
    const picked = await this.deckChoose({ count: n, min: n, title: title || `Choose ${n > 1 ? n + ' cards' : 'a card'} to remove`, filter: (c) => !CARDS[c.id].unremovable });
    for (const c of picked) this.removeFromDeck(c);
    return picked;
  },

  async upgradeCardChoice(n = 1, title) {
    const picked = await this.deckChoose({ count: n, min: n, title: title || 'Choose a card to upgrade', filter: (c) => this.canUpgrade(c), upgradePreview: true });
    for (const c of picked) this.upgradeCard(c);
    return picked;
  },

  async transformCardChoice(n = 1) {
    const picked = await this.deckChoose({ count: n, min: n, title: 'Choose a card to transform', filter: (c) => !CARDS[c.id].unremovable });
    const out = [];
    for (const c of picked) {
      this.removeFromDeck(c);
      const d = CARDS[c.id];
      const [id] = this.randomCards({ count: 1, exclude: [c.id], hero: d.hero === 'neutral' || d.hero === 'curse' ? this.run.hero : d.hero, rng: this.run.rng.misc });
      if (id) out.push(this.addToDeck(id));
    }
    return out;
  },

  upgradeRandom(n = 1, filter) {
    const pool = shuffle(this.run.rng.misc, this.run.deck.filter((c) => this.canUpgrade(c) && (!filter || filter(c))));
    for (const c of pool.slice(0, n)) this.upgradeCard(c);
  },

  // ids: array of ids or {id, up}; player picks one (or skips)
  async offerCards(list, opts = {}) {
    const cards = list.map((x) => (typeof x === 'string' ? this.makeCard(x) : this.makeCard(x.id, x.up)));
    const [c] = await this.ui.choose({ cards, count: 1, min: opts.forced ? 1 : 0, title: opts.title || 'Choose a card', offer: true, always: true });
    if (c) return this.addToDeck(c.id, c.up);
    return null;
  },

  // ------------------------------------------------------------- resources
  gainGold(n) {
    if (n <= 0) return;
    if (this.sumMod(this.run.player, 'noGold') > 0) return;
    this.run.gold += n;
    this.run.stats.goldEarned += n;
    this.emit('gold', { n });
    this.trigger('goldGained', n);
  },
  loseGold(n) { this.run.gold = Math.max(0, this.run.gold - n); this.emit('gold', { n: -n }); },
  gainMaxHp(n) { const P = this.run.player; P.maxHp += n; P.hp += n; this.emit('maxhp', { n }); },
  loseMaxHp(n) { const P = this.run.player; P.maxHp = Math.max(1, P.maxHp - n); P.hp = Math.min(P.hp, P.maxHp); this.emit('maxhp', { n: -n }); },
  // Out-of-combat HP loss (events). Can kill.
  hurt(n) {
    const P = this.run.player;
    P.hp -= n;
    this.emit('hurt', { n });
    if (P.hp <= 0) {
      for (const r of this.run.relics) { const d = RELICS[r.id]; if (d && d.revive && d.revive(this, r)) return; }
      P.hp = 0;
      this.endRun(false);
    }
  },

  addRelic(id, opts = {}) {
    if (!id || !RELICS[id]) return;
    const d = RELICS[id];
    const r = { id };
    if (d.counter != null) r.n = d.counter;
    this.run.relics.push(r);
    for (const k in this.run.relicPool) { const i = this.run.relicPool[k].indexOf(id); if (i >= 0) this.run.relicPool[k].splice(i, 1); }
    this.markSeen('relics', id);
    if (!opts.silent) this.emit('relicObtained', { id });
    if (d.pickup) d.pickup(this, r);
  },

  obtainRelic(id) {
    if (!id || ['common', 'uncommon', 'rare', 'boss', 'shop'].includes(id)) id = this.takeRelicFromPool(id || this.rollRelicRarity());
    if (id) this.addRelic(id);
    return id;
  },

  obtainPotion(id) {
    const run = this.run;
    const i = run.potions.indexOf(null);
    if (i < 0) return false;
    id = id || this.randomPotion();
    if (!id) return false;
    run.potions[i] = id;
    this.markSeen('potions', run.potions[i]);
    this.emit('potionObtained', { id: run.potions[i] });
    return true;
  },

  addPotionSlots(n) { for (let i = 0; i < n; i++) this.run.potions.push(null); },

  // ------------------------------------------------------------- rest
  openRest() {
    this.run.screen = 'rest';
    this.run.rest = { done: false };
  },

  restOptions() {
    const run = this.run;
    const opts = [];
    const heal = Math.round(run.player.maxHp * 0.3) + this.sumMod(run.player, 'restHealAdd');
    if (this.sumMod(run.player, 'noRest') <= 0) opts.push({ id: 'rest', label: 'Rest', desc: `Heal ${heal} HP.`, icon: 'rest' });
    if (this.sumMod(run.player, 'noSmith') <= 0) opts.push({ id: 'smith', label: 'Smith', desc: 'Upgrade a card.', icon: 'smith', disabled: !run.deck.some((c) => this.canUpgrade(c)) });
    for (const r of run.relics) {
      const d = RELICS[r.id];
      if (d.restOption) for (const o of [].concat(d.restOption)) opts.push({ ...o, relic: r.id, disabled: o.can ? !o.can(this, r) : false });
    }
    // Never leave the player stuck at a site with nothing to do (e.g. no Rest, nothing to upgrade).
    if (!opts.some((o) => !o.disabled)) opts.push({ id: 'leave', label: 'Move on', desc: 'Nothing here for you.', icon: 'rest' });
    return opts;
  },

  async restAction(id) {
    const run = this.run;
    if (run.screen !== 'rest' || run.rest.done) return;
    const opt = this.restOptions().find((o) => o.id === id);
    if (!opt || opt.disabled) return;
    if (id === 'rest') {
      const heal = Math.round(run.player.maxHp * 0.3) + this.sumMod(run.player, 'restHealAdd');
      this.healOut(heal);
      this.trigger('rested');
    } else if (id === 'smith') {
      const up = await this.upgradeCardChoice(1);
      if (!up.length) return;
      this.trigger('smithed');
    } else if (id === 'leave') {
      // nothing to do
    } else if (opt.relic) {
      const ok = await opt.use(this, run.relics.find((r) => r.id === opt.relic));
      if (ok === false) return;
    }
    run.rest.done = true;
    run.rest.did = id;
    this.save();
    this.emit('refresh', {});
  },

  healOut(n) {
    const P = this.run.player;
    n = Math.floor(n * this.mulMod(P, 'healMul'));
    const before = P.hp;
    P.hp = Math.min(P.maxHp, P.hp + n);
    if (P.hp > before) this.emit('heal', { e: P, n: P.hp - before });
  },

  leaveRoom() {
    const run = this.run;
    run.rest = null; run.shop = null; run.treasure = null; run.event = null;
    run.screen = 'map';
    this.save();
    this.emit('refresh', {});
  },

  // ------------------------------------------------------------- treasure
  openTreasure() {
    const run = this.run;
    const x = rnd(run.rng.misc);
    const size = x < 0.5 ? 'small' : x < 0.83 ? 'medium' : 'large';
    const rarity = size === 'small' ? (rnd(run.rng.misc) < 0.75 ? 'common' : 'uncommon') : size === 'medium' ? (rnd(run.rng.misc) < 0.35 ? 'common' : rnd(run.rng.misc) < 0.8 ? 'uncommon' : 'rare') : (rnd(run.rng.misc) < 0.75 ? 'uncommon' : 'rare');
    const gold = chance(run.rng.misc, size === 'small' ? 0.5 : size === 'medium' ? 0.35 : 0.5) ? int(run.rng.misc, size === 'small' ? 23 : size === 'medium' ? 45 : 68, size === 'small' ? 27 : size === 'medium' ? 55 : 82) : 0;
    run.treasure = { size, opened: false, relic: this.takeRelicFromPool(rarity), gold };
    run.screen = 'treasure';
  },

  openChest() {
    const t = this.run.treasure;
    if (!t || t.opened) return;
    t.opened = true;
    this.trigger('chestOpened');
    this.run.reward = { items: [], kind: 'treasure' };
    if (t.gold) this.run.reward.items.push({ type: 'gold', n: t.gold });
    if (t.relic) this.run.reward.items.push({ type: 'relic', id: t.relic });
    this.run.screen = 'reward';
    this.save();
    this.emit('refresh', {});
  },

  // ------------------------------------------------------------- shop
  openShop() {
    const run = this.run;
    const r = run.rng.shop;
    const mul = this.mulMod(run.player, 'priceMul') * (run.asc >= 9 ? 1.1 : 1);
    const price = (range) => Math.round(int(r, range[0], range[1]) * mul);
    const rollR = () => { const x = rnd(r); return x < 0.09 ? 'rare' : x < 0.46 ? 'uncommon' : 'common'; };
    const cards = [];
    for (const type of ['attack', 'attack', 'skill', 'skill', 'power']) {
      const rarity = type === 'power' && rollR() === 'common' ? 'uncommon' : rollR();
      const [id] = this.randomCards({ count: 1, type, rarity, rng: r, exclude: cards.map((c) => c.id) });
      if (id) cards.push({ id, up: 0, price: price(RARITY_PRICE[CARDS[id].rarity]) });
    }
    for (const rarity of ['uncommon', 'rare']) {
      const [id] = this.randomCards({ count: 1, hero: 'neutral', rarity, rng: r });
      if (id) cards.push({ id, up: 0, price: Math.round(price(RARITY_PRICE[rarity]) * 1.2), neutral: true });
    }
    if (cards.length) { const s = pick(r, cards.slice(0, 5)); s.price = Math.round(s.price / 2); s.sale = true; }
    const relics = [];
    for (const rar of [this.rollRelicRarity(), this.rollRelicRarity(), 'shop']) {
      const id = this.takeRelicFromPool(rar);
      if (id) relics.push({ id, price: price(RELIC_PRICE[RELICS[id].rarity] || RELIC_PRICE.common) });
    }
    const potions = [0, 1, 2].map(() => this.randomPotion()).filter(Boolean).map((id) => ({ id, price: price(POTION_PRICE[POTIONS[id].rarity] || POTION_PRICE.common) }));
    run.shop = { cards, relics, potions, removePrice: Math.round((75 + 25 * run.removals) * mul), removed: false };
    run.screen = 'shop';
    this.trigger('shopEnter');
  },

  async buy(kind, i) {
    const run = this.run;
    const s = run.shop;
    if (!s) return false;
    if (kind === 'remove') {
      if (s.removed || run.gold < s.removePrice) return false;
      const picked = await this.removeCardChoice(1);
      if (!picked.length) return false;
      run.gold -= s.removePrice;
      s.removed = true;
      run.removals++;
    } else {
      const it = s[kind][i];
      if (!it || it.sold || run.gold < it.price) return false;
      if (kind === 'potions' && !run.potions.includes(null)) { this.emit('toast', { text: 'Your tincture belt is full.' }); return false; }
      run.gold -= it.price;
      it.sold = true;
      if (kind === 'cards') this.addToDeck(it.id, it.up);
      else if (kind === 'relics') this.addRelic(it.id);
      else this.obtainPotion(it.id);
    }
    this.emit('gold', { n: 0 });
    this.trigger('purchase', kind);
    this.save();
    this.emit('refresh', {});
    return true;
  },

  // ------------------------------------------------------------- events
  eligibleEvents(storyOnly) {
    const run = this.run;
    return Object.values(EVENTS).filter((e) => {
      if (!!e.story !== !!storyOnly) return false;
      if (e.acts && e.acts !== 'any' && !e.acts.includes(run.act)) return false;
      if (e.hero && e.hero !== run.hero) return false;
      if (run.seenEvents.includes(e.id)) return false;
      if ((e.story || e.unique) && this.meta.seenEvents[e.id]) return false;
      if (e.minFloor && run.floor < e.minFloor) return false;
      if (e.req && !e.req(this)) return false;
      return true;
    });
  },

  async startRandomEvent() {
    const run = this.run;
    const r = run.rng.events;
    let ev = null;
    const story = this.eligibleEvents(true);
    if (story.length && run.storyThisAct < 1 && rnd(r) < 0.8) {
      story.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      const top = story.filter((e) => (e.priority || 0) === (story[0].priority || 0));
      ev = pick(r, top);
      run.storyThisAct++;
    } else {
      const roll = rnd(r);
      if (roll < 0.1 && run.act < 4) { await this.startEncounter('easyhard'); return; }
      const list = this.eligibleEvents(false);
      if (list.length) ev = weighted(r, list, (e) => e.weight || 1);
      else if (story.length) ev = story[0];
    }
    if (!ev) { await this.startEncounter('easyhard'); return; }
    this.openEvent(ev.id);
  },

  openEvent(id) {
    const run = this.run;
    const ev = EVENTS[id];
    run.seenEvents.push(id);
    if (ev.story || ev.unique) this.meta.seenEvents[id] = true;
    run.stats.events++;
    run.event = { id, page: 'start', data: {}, log: [] };
    if (ev.init) ev.init(this, run.event.data);
    run.screen = 'event';
    this.saveMeta();
  },

  eventPage() {
    const run = this.run;
    if (!run.event) return null;
    const ev = EVENTS[run.event.id];
    const p = ev.pages[run.event.page];
    if (!p) return null;
    const text = typeof p.text === 'function' ? p.text(this, run.event.data) : p.text;
    const choices = (p.choices || [{ label: 'Leave.', end: true }]).map((c, i) => {
      if (c.show && !c.show(this, run.event.data)) return null;
      let disabled = false, why = '';
      if (c.req) { const ok = c.req(this, run.event.data); if (ok !== true) { disabled = true; why = typeof ok === 'string' ? ok : ''; } }
      const label = typeof c.label === 'function' ? c.label(this, run.event.data) : c.label;
      return { i, label, disabled, why };
    }).filter(Boolean);
    return { title: p.title || ev.title, text, art: p.art || ev.art, speaker: p.speaker || ev.speaker, choices };
  },

  async eventChoose(i) {
    const run = this.run;
    if (run.screen !== 'event' || !run.event || this._evBusy) return;
    const ev = EVENTS[run.event.id];
    const p = ev.pages[run.event.page];
    const choices = p.choices || [{ label: 'Leave.', end: true }];
    const c = choices[i];
    if (!c) return;
    if (c.show && !c.show(this, run.event.data)) return;
    if (c.req && c.req(this, run.event.data) !== true) return;
    this._evBusy = true;
    try {
      const evRef = run.event;
      let next = c.fx ? await c.fx(this, run.event.data) : undefined;
      if (this.run !== run || run.screen === 'death') return;
      if (run.screen !== 'event' || run.event !== evRef) { this.save(); this.emit('refresh', {}); return; }
      if (next === undefined) next = c.next;
      if (c.end || next === null || next === 'end' || (next === undefined && !c.next)) {
        if (next && next !== 'end' && ev.pages[next]) run.event.page = next;
        else this.leaveRoom();
      } else if (ev.pages[next]) run.event.page = next;
      else this.leaveRoom();
    } finally { this._evBusy = false; }
    this.save();
    this.emit('refresh', {});
  },

  // Start a fight from inside an event. opts: { resume: pageId (return to event after rewards),
  // reward: {relic, gold, card, noCards}, noGold, kind:'fight'|'elite'|'boss', flag }
  async eventCombat(enemyIds, opts = {}) {
    const run = this.run;
    if (opts.resume) run.event.resume = opts.resume;
    else run.event.resume = null;
    run.screen = 'combat';
    await this.startCombat(enemyIds, { kind: opts.kind || 'fight', fromEvent: { id: run.event.id, flag: opts.flag }, extraReward: opts.reward, noGold: opts.noGold });
  },

  // ------------------------------------------------------------- flags & lore
  flag(k) { return this.run.flags[k] || this.meta.flags[k]; },
  setFlag(k, v = true) { this.run.flags[k] = v; },
  setMetaFlag(k, v = true) { this.meta.flags[k] = v; this.saveMeta(); },
  metaFlag(k) { return this.meta.flags[k]; },
  unlockLore(id) {
    if (!this.meta.lore[id]) { this.meta.lore[id] = Date.now(); this.emit('lore', { id }); this.saveMeta(); }
  },
  markSeen(kind, id) { if (this.meta && this.meta.seen[kind] && !this.meta.seen[kind][id]) this.meta.seen[kind][id] = 1; },
  markBossDefeated(enc) { this.meta.bossesDefeated = this.meta.bossesDefeated || {}; this.meta.bossesDefeated[enc] = (this.meta.bossesDefeated[enc] || 0) + 1; },

  // ------------------------------------------------------------- throne & endings
  throneOptions() {
    const truths = ['knight', 'witch', 'wren', 'cantor'].every((h) => this.meta.flags['truth_' + h]);
    return [
      { id: 'crown', label: 'Take the Crown.', desc: 'Become the new Long King.' },
      { id: 'shatter', label: 'Shatter the Crown.', desc: 'End the hour. Let everything that was held come due.', disabled: !this.meta.flags.knows_heart, why: 'You do not yet know how it could be broken.' },
      { id: 'descend', label: 'Descend beneath the throne.', desc: 'Something below is calling the heart home.', disabled: !truths, why: 'Not all four heirs have learned their truth.' },
    ];
  },

  async throneChoose(id) {
    const run = this.run;
    if (run.screen !== 'throne') return;
    const opt = this.throneOptions().find((o) => o.id === id);
    if (!opt || opt.disabled) return;
    this.trigger('throne', id);
    if (id === 'descend') {
      run.flags.descended = true;
      this.nextAct(4);
      return;
    }
    await this.finishRun(id);
  },

  async finishRun(ending) {
    const run = this.run;
    run.ending = ending;
    run.screen = 'ending';
    this.endRun(true, ending);
  },

  // Victory or death: update meta, award renown, clear the run save.
  endRun(won, ending) {
    const run = this.run;
    if (run.over) return;
    run.over = true;
    const meta = this.meta;
    const H = this.heroMeta(run.hero);
    const s = run.stats;
    const renown = s.floors * 5 + s.elites * 15 + s.bosses * 40 + (won ? 150 : 0) + run.asc * 10;
    const before = H.level;
    H.renown += renown;
    H.level = renownLevel(H.renown);
    if (won) {
      meta.wins++;
      H.wins++;
      if (run.asc >= (H.ascMax || 0) && (H.ascMax || 0) < 10) H.ascMax = (run.asc || 0) + 1;
      meta.endings[ending] = (meta.endings[ending] || 0) + 1;
      meta.endings[ending + '_' + run.hero] = 1;
      meta.flags['won_' + run.hero] = true;
    } else {
      meta.deaths++;
      const killer = run.combat ? run.combat.encounter : run.event ? 'event:' + run.event.id : 'unknown';
      meta.deathsBy[killer] = (meta.deathsBy[killer] || 0) + 1;
    }
    H.bestAct = Math.max(H.bestAct || 0, run.act);
    meta.lastRun = {
      hero: run.hero, won, ending: ending || null, act: run.act, floor: run.floor, asc: run.asc,
      killer: won ? null : (run.combat ? run.combat.encounter : run.event ? run.event.id : null),
      renown, levelUp: H.level > before ? H.level : 0, stats: { ...s, time: Date.now() - s.start },
      seen: false,
    };
    // Hero unlocks
    if (!meta.heroes.witch.unlocked && meta.runs >= 1) meta.heroes.witch.unlocked = true;
    if (!meta.heroes.wren.unlocked && (meta.runs >= 3 || Object.values(meta.heroes).some((h) => (h.bestAct || 0) >= 2))) meta.heroes.wren.unlocked = true;
    if (!meta.heroes.cantor.unlocked && (meta.runs >= 5 || Object.values(meta.heroes).some((h) => (h.bestAct || 0) >= 3))) meta.heroes.cantor.unlocked = true;
    if (!won) run.screen = 'death';
    this.saveMeta();
    this.clearRunSave();
    this.emit('runOver', { won });
  },
};

export const RENOWN_LEVELS = [0, 250, 650, 1200, 1900, 2800];
export function renownLevel(xp) {
  let l = 0;
  for (let i = 0; i < RENOWN_LEVELS.length; i++) if (xp >= RENOWN_LEVELS[i]) l = i;
  return l;
}
