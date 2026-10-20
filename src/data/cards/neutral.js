// Neutral cards (any heir) and Curses. Systems & balance designer.
//
// Neutral cards never appear in normal card rewards: they are sold by the Pale
// Peddler (one uncommon + one rare per shop), handed out by events, and can be
// Discovered by "any"-pool effects. So each one should be a real tool.
//
// Curse ids are referenced by event writers — keep them stable:
//   doubt, shame, hunger, crowns_whisper, grief, oathbreaker, rot_touched, debt
// (regret lives in common.js because the engine needs it.)
import { defineCards, defineStatuses, STATUSES } from '../../engine/registry.js';
import { pick } from '../../engine/rng.js';

// ------------------------------------------------------------------ helpers
// Move a card from any pile into the hand (respecting the 10-card limit).
function toHand(g, c, opts = {}) {
  if (!c || g.hand.length >= 10) return false;
  g.removeFromPiles(c);
  if (opts.costTurn != null) c.costTurn = opts.costTurn;
  g.hand.push(c);
  g.emit('addCard', { card: c, where: 'hand' });
  return true;
}

function isDebuff(id, amount) {
  const d = STATUSES[id];
  return !!d && (d.kind === 'debuff' || (d.negOk && amount < 0));
}

// ------------------------------------------------------------------ statuses
defineStatuses([
  {
    id: 'n_gallows', name: 'Gallows Humour', kind: 'buff', icon: 'skull',
    desc: (n) => `Whenever you play your 5th, 10th, 15th... card in a turn, deal ${n} damage to ALL enemies.`,
    cardPlayed(g, o, n) {
      if (!o.isPlayer || !g.cb || g.cb.phase === 'over') return;
      const k = g.cnt.cards;
      const mark = g.cb.turn * 1000 + k;
      // autoPlay does not advance the counter; never fire twice on one count.
      if (k > 0 && k % 5 === 0 && g.cb.gallowsMark !== mark) {
        g.cb.gallowsMark = mark;
        for (const e of g.enemies) g.damage(e, n, { type: 'spell', src: o });
      }
    },
  },
  {
    id: 'n_zeal', name: 'Inquisitor\'s Zeal', kind: 'buff', icon: 'flame',
    desc: (n) => `Whenever you apply a debuff to an enemy, deal ${n} damage to it.`,
    statusApplied(g, o, n, target, id, amount, src) {
      if (!o.isPlayer || !src || !src.isPlayer || !target || target.isPlayer || target.dead) return;
      if (!isDebuff(id, amount)) return;
      g.damage(target, n, { type: 'spell', src: o });
    },
  },
  {
    id: 'n_held_hour', name: 'Held Hour', kind: 'buff', icon: 'moon', decay: 'ownerTurnEnd',
    desc: () => 'Your hand is not discarded at the end of this turn.',
    retainAll: (g, o, n) => n,
  },
]);

// ------------------------------------------------------------------ neutral cards
defineCards([
  // ======================= UNCOMMON =======================
  {
    id: 'hobs_shovel', name: 'Hob\'s Shovel', hero: 'neutral', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 8 }, up: { dmg: 3 }, art: 'grave', tier: 0,
    text: 'Deal {dmg} damage. Dig up a card from your discard pile into your hand.',
    async play(g, v, t) {
      g.attack(t, v.dmg);
      if (g.cb.phase === 'over') return;
      const [c] = await g.choose({ from: 'discard', count: 1, min: 1, title: 'Dig up a card' });
      if (c) toHand(g, c);
    },
  },
  {
    id: 'last_rites', name: 'Last Rites', hero: 'neutral', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
    v: { blk: 4 }, up: { blk: 2 }, art: 'prayer', tier: 0,
    text: 'Exhaust any number of cards in your hand. Gain {blk} Block for each.',
    async play(g, v) {
      const picked = await g.choose({ from: 'hand', count: g.hand.length, min: 0, title: 'Lay cards to rest' });
      for (const c of picked) { g.exhaustCard(c); g.block(v.blk); }
    },
  },
  {
    id: 'pilgrims_step', name: 'Pilgrim\'s Step', hero: 'neutral', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
    v: { blk: 3 }, up: { blk: 2 }, art: 'cloak', tier: 0,
    text: 'Gain {blk} Block. Draw 1 card.',
    play(g, v) { g.block(v.blk); g.draw(1); },
  },
  {
    id: 'sudden_steel', name: 'Sudden Steel', hero: 'neutral', type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy',
    v: { dmg: 4 }, up: { dmg: 3 }, art: 'dagger', tier: 0,
    text: 'Deal {dmg} damage. Draw 1 card.',
    play(g, v, t) { g.attack(t, v.dmg); g.draw(1); },
  },
  {
    id: 'pall_of_ash', name: 'Pall of Ash', hero: 'neutral', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
    v: { n: 2 }, up: { n: 1 }, kw: ['exhaust'], art: 'swirl', tier: 0,
    text: 'Apply {n} Weakened and {n} Exposed to ALL enemies.',
    play(g, v) { g.applyAll('weak', v.n); g.applyAll('exposed', v.n); },
  },
  {
    id: 'grave_goods', name: 'Grave Goods', hero: 'neutral', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
    kw: ['exhaust'], upKw: { remove: ['exhaust'] }, art: 'key', tier: 0,
    text: 'Choose 1 of 3 random cards to add to your hand. It costs 0 this turn.',
    async play(g) { await g.discover({ costTurn: 0, title: 'Take something from the grave' }); },
  },
  {
    id: 'grave_moss_poultice', name: 'Grave-Moss Poultice', hero: 'neutral', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
    v: { n: 3 }, up: { n: 1 }, kw: ['exhaust'], art: 'herb', tier: 0,
    text: 'Gain {n} Mending.',
    play(g, v) { g.applySelf('mending', v.n); },
  },
  {
    id: 'funeral_bell', name: 'Funeral Bell', hero: 'neutral', type: 'attack', rarity: 'uncommon', cost: 0, target: 'none',
    v: { dmg: 8 }, up: { dmg: 4 }, kw: ['innate', 'exhaust'], art: 'bell', tier: 1,
    text: 'Deal {dmg} damage to ALL enemies.',
    play(g, v) { g.attackAll(v.dmg); },
  },
  {
    id: 'again', name: 'Again', hero: 'neutral', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
    v: { n: 1 }, up: { n: 1 }, art: 'hourglass', tier: 1,
    text: 'Shuffle your discard pile into your draw pile. Draw {n} card.',
    upText: 'Shuffle your discard pile into your draw pile. Draw {n} cards.',
    play(g, v) {
      if (g.cb.discard.length) g.reshuffle();
      g.draw(v.n);
    },
  },
  {
    id: 'borrowed_time', name: 'Borrowed Time', hero: 'neutral', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
    v: { e: 2, d: 2 }, up: { d: -1 }, kw: ['exhaust'], art: 'candle', tier: 1,
    text: 'Gain {e} Energy. Next turn, draw {d} fewer cards.',
    upText: 'Gain {e} Energy. Next turn, draw {d} fewer card.',
    play(g, v) { g.gainEnergy(v.e); if (v.d > 0) g.applySelf('dread', v.d); },
  },
  {
    id: 'salt_and_ash', name: 'Salt and Ash', hero: 'neutral', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
    upKw: { add: ['retain'] }, art: 'flame', tier: 1,
    text: 'Exhaust all Curses and Statuses in your hand. Draw 1 card for each.',
    play(g) {
      const bad = g.hand.filter((c) => { const t = g.cardDef(c).type; return t === 'curse' || t === 'status'; });
      for (const c of bad) g.exhaustCard(c);
      if (bad.length) g.draw(bad.length);
    },
  },
  {
    id: 'fools_gambit', name: 'Fool\'s Gambit', hero: 'neutral', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
    kw: ['exhaust'], upKw: { remove: ['exhaust'] }, art: 'mask', tier: 1,
    text: 'Discard your hand, then draw that many cards.',
    play(g) {
      const n = g.hand.length;
      for (const c of [...g.hand]) g.discardCard(c);
      if (n) g.draw(n);
    },
  },
  {
    id: 'hold_the_hour', name: 'Hold the Hour', hero: 'neutral', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
    v: { blk: 7 }, up: { blk: 3 }, art: 'moon', tier: 2,
    text: 'Gain {blk} Block. Retain your hand this turn.',
    play(g, v) {
      g.block(v.blk);
      if (!g.st(g.player, 'n_held_hour')) g.applySelf('n_held_hour', 1);
    },
  },
  {
    id: 'founders_iron', name: 'Founder\'s Iron', hero: 'neutral', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
    v: { n: 3 }, up: { n: 1 }, art: 'chain', tier: 2,
    text: 'Gain {n} Plating.',
    play(g, v) { g.applySelf('plating', v.n); },
  },
  {
    id: 'burden_of_years', name: 'Burden of Years', hero: 'neutral', type: 'attack', rarity: 'uncommon', cost: 2, upCost: 1, target: 'enemy',
    kw: ['innate'], art: 'mace', tier: 2,
    text: 'Deal damage equal to the number of cards in your draw pile.',
    play(g, v, t) { g.attack(t, g.cb.draw.length); },
  },

  // ======================= RARE =======================
  {
    id: 'crown_shard', name: 'Crown Shard', hero: 'neutral', type: 'skill', rarity: 'rare', cost: 0, target: 'none',
    v: { e: 2, n: 2 }, up: { n: 1 }, kw: ['exhaust'], art: 'crown', tier: 0,
    text: 'Gain {e} Energy. Draw {n} cards. Shuffle a Crown\'s Whisper into your draw pile.',
    play(g, v) { g.gainEnergy(v.e); g.draw(v.n); g.addCard('crowns_whisper', 'draw'); },
  },
  {
    id: 'counsel_of_the_dead', name: 'Counsel of the Dead', hero: 'neutral', type: 'skill', rarity: 'rare', cost: 0, target: 'none',
    v: { n: 3 }, up: { n: 1 }, kw: ['exhaust'], art: 'ghost', tier: 0,
    text: 'Draw {n} cards.',
    play(g, v) { g.draw(v.n); },
  },
  {
    id: 'gallows_humour', name: 'Gallows Humour', hero: 'neutral', type: 'power', rarity: 'rare', cost: 1, upCost: 0, target: 'none',
    v: { n: 10 }, art: 'skull', tier: 1,
    text: 'Whenever you play 5 cards in a single turn, deal {n} damage to ALL enemies.',
    play(g, v) { g.applySelf('n_gallows', v.n); },
  },
  {
    id: 'coins_for_the_eyes', name: 'Coins for the Eyes', hero: 'neutral', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy',
    v: { dmg: 20, gold: 20 }, up: { dmg: 5, gold: 5 }, kw: ['exhaust'], art: 'coin', tier: 2,
    text: 'Deal {dmg} damage. If this kills a non-minion enemy, gain {gold} Gold.',
    play(g, v, t) {
      g.attack(t, v.dmg);
      if (t && t.dead && !t.fled && !t.st.minion) g.gainGold(v.gold);
    },
  },
  {
    id: 'pells_riddle', name: 'Pell\'s Riddle', hero: 'neutral', type: 'skill', rarity: 'rare', cost: 0, target: 'none',
    kw: ['exhaust'], upKw: { remove: ['exhaust'] }, art: 'eye', tier: 2,
    text: 'Draw 2 cards. Put a card from your hand on top of your draw pile.',
    async play(g) {
      g.draw(2);
      const [c] = await g.choose({ from: 'hand', count: 1, min: 1, title: 'Put a card on top of your draw pile' });
      if (c) { g.removeFromPiles(c); g.cb.draw.push(c); }
    },
  },
  {
    id: 'coronation', name: 'Coronation', hero: 'neutral', type: 'skill', rarity: 'rare', cost: 2, upCost: 1, target: 'none',
    kw: ['exhaust'], art: 'banner', tier: 3,
    text: 'Upgrade ALL your cards for the rest of combat.',
    play(g) {
      for (const p of ['hand', 'draw', 'discard']) for (const c of g.cb[p]) if (g.canUpgrade(c)) g.upgradeCard(c);
    },
  },
  {
    id: 'inquisitors_zeal', name: 'Inquisitor\'s Zeal', hero: 'neutral', type: 'power', rarity: 'rare', cost: 0, target: 'none',
    v: { n: 4 }, up: { n: 2 }, art: 'sigil', tier: 3,
    text: 'Whenever you apply a debuff to an enemy, deal {n} damage to it.',
    play(g, v) { g.applySelf('n_zeal', v.n); },
  },
]);

// ------------------------------------------------------------------ curses
// Applied with src = null so Ward can negate a curse's sting.
const CURSE = { hero: 'curse', type: 'curse', rarity: 'curse', target: 'none', noUp: true };

defineCards([
  {
    ...CURSE, id: 'doubt', name: 'Doubt', cost: -1, kw: ['unplayable'], art: 'mirror',
    text: 'At the end of your turn, gain 1 Weakened.',
    endTurnInHand(g) { g.apply(g.player, 'weak', 1, null); },
  },
  {
    ...CURSE, id: 'shame', name: 'Shame', cost: -1, kw: ['unplayable'], art: 'hand',
    text: 'At the end of your turn, gain 1 Frail.',
    endTurnInHand(g) { g.apply(g.player, 'frail', 1, null); },
  },
  {
    ...CURSE, id: 'hunger', name: 'Hunger', cost: -1, kw: ['unplayable'], art: 'tooth',
    text: 'At the end of your turn, Exhaust another random card in your hand.',
    endTurnInHand(g, card) {
      const others = g.hand.filter((c) => c !== card);
      if (others.length) g.exhaustCard(pick(g.srng, others));
    },
  },
  {
    ...CURSE, id: 'crowns_whisper', name: 'The Crown\'s Whisper', cost: 1, kw: ['exhaust'], art: 'crown',
    text: 'Play to silence it. At the end of your turn, lose 3 HP.',
    play() {},
    endTurnInHand(g) { g.loseHp(g.player, 3, { type: 'hploss' }); },
  },
  {
    ...CURSE, id: 'grief', name: 'Grief', cost: -1, kw: ['unplayable', 'retain'], art: 'drop',
    text: 'It does not leave. At the end of your turn, lose 1 HP.',
    endTurnInHand(g) { g.loseHp(g.player, 1, { type: 'hploss' }); },
  },
  {
    ...CURSE, id: 'oathbreaker', name: 'Oathbreaker', cost: -1, kw: ['unplayable', 'ethereal'], art: 'oath',
    unremovable: true,
    text: 'When drawn, gain 1 Weakened. Cannot be removed from your deck.',
    onDraw(g) { g.apply(g.player, 'weak', 1, null); },
  },
  {
    ...CURSE, id: 'rot_touched', name: 'Rot-Touched', cost: -1, kw: ['unplayable'], art: 'rot',
    text: 'When drawn, gain 2 Rot.',
    onDraw(g) { g.apply(g.player, 'rot', 2, null); },
  },
  {
    ...CURSE, id: 'debt', name: 'Debt', cost: -1, kw: ['unplayable'], art: 'coin',
    text: 'At the end of your turn, lose 5 Gold. If you have none, lose 2 HP instead.',
    endTurnInHand(g) {
      if (g.run.gold > 0) g.loseGold(5);
      else g.loseHp(g.player, 2, { type: 'hploss' });
    },
  },
]);
