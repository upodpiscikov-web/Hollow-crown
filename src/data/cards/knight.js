// Aldous Vane, the Disgraced Knight (BLOOD). Oaths, Might, Bulwark, Penance.
//
// Archetypes
//   Oathkeeper — swear Oaths (tracked goals) and cash them in. Payoffs read
//                g.tot.oaths, the Oaths you hold, or the oathFulfilled trigger.
//   Iron Wall  — Block, Bulwark / Iron Discipline, damage that scales off Block.
//   Might      — stack Might, then hit many times.
//   Penance    — lose HP and Exhaust cards for power: the guilt of the man who did nothing.
//
// Oath rules (all Knight content swears through swearOath below):
//   * An Oath card swears BEFORE its other effects, so the card's own hit, kill,
//     HP loss or Exhaust counts toward its Oath.
//   * Swearing an Oath you already hold adds the new reward to it and keeps your
//     progress (the stakes rise; the counter never resets).
import { defineCards, defineStatuses, defineRelics, definePotions, STATUSES } from '../../engine/registry.js';
import { pick } from '../../engine/rng.js';

// ------------------------------------------------------------------ helpers
const s = (n) => (n === 1 ? '' : 's');

const isOath = (id) => !!STATUSES[id] && STATUSES[id].kind === 'oath';

// Oaths the player currently holds (snapshot array, safe to iterate while fulfilling).
function heldOaths(g) {
  const st = g.player.st;
  return Object.keys(st).filter((id) => st[id] > 0 && isOath(id));
}

// Current reward of a held Oath, for status descriptions (works outside combat too).
function payOf(g, id, dflt) {
  const o = g && g.cb && g.cb.oaths && g.cb.oaths[id];
  return o && o.pay != null ? o.pay : dflt;
}

function swearOath(g, id, need, pay) {
  const cb = g.cb;
  if (!cb || cb.phase === 'over') return;
  cb.oathMeta = cb.oathMeta || {};
  cb.oathMeta[id] = { need, pay }; // un-reduced values, for The Long Vigil
  if (g.hasRelic('the_last_order')) need = Math.max(1, need - 1);
  const cur = cb.oaths[id];
  if (g.player.st[id] > 0 && cur) {
    cur.pay = (cur.pay || 0) + pay;
    g.emit('oath', { id, need: g.player.st[id], renewed: true });
    g.trigger('oathSworn', id);
    return;
  }
  g.swear(id, need, pay);
  if (cb.oaths[id]) cb.oaths[id].t = cb.turn;
}

// Default terms for Oaths sworn by relics/tinctures: [need, pay].
const OATH_POOL = {
  oath_wall: [2, 2], oath_unbroken: [1, 2], oath_sentry: [1, 2], oath_blade: [5, 6], oath_charge: [1, 1],
  oath_breaking: [1, 2], oath_headsman: [1, 4], oath_penance: [3, 3], oath_blood: [3, 2],
};

function swearRandomOath(g) {
  const all = Object.keys(OATH_POOL);
  const fresh = all.filter((id) => !(g.player.st[id] > 0));
  const id = pick(g.crng, fresh.length ? fresh : all);
  swearOath(g, id, OATH_POOL[id][0], OATH_POOL[id][1]);
  return id;
}

// Block the player will hold once this turn's end-of-turn effects finish: Plating whose
// hook has not fired yet still counts, so "end your turn with X Block" means what it says.
function endBlock(o, selfId) {
  const keys = Object.keys(o.st);
  let b = o.block;
  if (o.st.plating > 0 && keys.indexOf('plating') > keys.indexOf(selfId)) b += o.st.plating;
  return b;
}

// Total damage the enemies currently intend to deal to the player.
function incoming(g) {
  let t = 0;
  for (const e of g.enemies) {
    const it = g.intentOf(e);
    if (it && it.dmg != null) t += it.dmg * (it.times || 1);
  }
  return t;
}

const spellAll = (g, n) => { if (n > 0) for (const e of g.enemies) g.damage(e, n, { type: 'spell', src: g.player }); };

// ------------------------------------------------------------------ oaths
// Oath statuses: amount = steps remaining. fulfil(g, pay) runs once on completion.
const oath = (def) => ({ kind: 'oath', icon: 'oath', ...def });

defineStatuses([
  oath({
    id: 'oath_wall', name: 'Oath of the Wall',
    desc: (n, g) => `End ${n} more turn${s(n)} with 8 or more Block. Reward: gain ${payOf(g, 'oath_wall', 2)} Might.`,
    turnEnd(g, o) { if (endBlock(o, 'oath_wall') >= 8) g.oathProgress('oath_wall'); },
    fulfil(g, pay) { g.applySelf('might', pay); },
  }),
  oath({
    id: 'oath_unbroken', name: 'Oath of the Unbroken',
    desc: (n, g) => `Go ${n === 1 ? 'a full round' : n + ' rounds'} without taking unblocked damage. Reward: gain ${payOf(g, 'oath_unbroken', 2)} Plating.`,
    hpLost(g, o, n, amount, opts) {
      const st = g.cb && g.cb.oaths.oath_unbroken;
      if (st && (!opts || opts.type !== 'hploss')) st.hit = true;
    },
    turnStart(g) {
      const st = g.cb.oaths.oath_unbroken;
      if (!st || g.cb.turn <= (st.t || 0)) return;
      if (st.hit) st.hit = false;
      else g.oathProgress('oath_unbroken');
    },
    fulfil(g, pay) { g.applySelf('plating', pay); },
  }),
  oath({
    id: 'oath_sentry', name: 'Oath of the Sentry',
    desc: (n, g) => `End ${n === 1 ? 'a turn' : n + ' turns'} without playing an Attack. Reward: next turn, gain ${payOf(g, 'oath_sentry', 2)} Energy.`,
    turnEnd(g) { if (g.cnt.attacks === 0) g.oathProgress('oath_sentry'); },
    fulfil(g, pay) { g.applySelf('next_energy', pay); },
  }),
  oath({
    id: 'oath_blade', name: 'Oath of the Blade',
    desc: (n, g) => `Hit enemies ${n} more time${s(n)}. Reward: deal ${payOf(g, 'oath_blade', 6)} damage to ALL enemies.`,
    enemyAttacked(g, o) { if (o.isPlayer) g.oathProgress('oath_blade'); },
    fulfil(g, pay) { spellAll(g, pay); },
  }),
  oath({
    id: 'oath_charge', name: 'Oath of the Charge',
    desc: (n, g) => `Play 3 Attacks in a single turn${n > 1 ? ` (${n} turns)` : ''}. Reward: gain ${payOf(g, 'oath_charge', 1)} Energy.`,
    cardPlayed(g, o, n, card) {
      if (!o.isPlayer || g.cardDef(card).type !== 'attack' || g.cnt.attacks < 3) return;
      if (g.cb.chargeTurn === g.cb.turn) return; // once per turn, even when sworn anew
      g.cb.chargeTurn = g.cb.turn;
      g.oathProgress('oath_charge');
    },
    fulfil(g, pay) { g.gainEnergy(pay); },
  }),
  oath({
    id: 'oath_breaking', name: 'Oath of the Breaking Blow',
    desc: (n, g) => `Hit an enemy for 20 or more damage at once${n > 1 ? ` (${n} times)` : ''}. Reward: apply ${payOf(g, 'oath_breaking', 2)} Weakened to ALL enemies.`,
    enemyAttacked(g, o, n, enemy, unblocked, a) { if (o.isPlayer && a >= 20) g.oathProgress('oath_breaking'); },
    fulfil(g, pay) { g.applyAll('weak', pay); },
  }),
  oath({
    id: 'oath_headsman', name: 'Headsman\'s Oath',
    desc: (n, g) => `Kill ${n === 1 ? 'an enemy' : n + ' enemies'}. Reward: heal ${payOf(g, 'oath_headsman', 4)} HP.`,
    enemyDied(g, o) { if (o.isPlayer) g.oathProgress('oath_headsman'); },
    fulfil(g, pay) { g.healPlayer(pay); },
  }),
  oath({
    id: 'oath_penance', name: 'Oath of Penance',
    desc: (n, g) => `Exhaust ${n} more card${s(n)}. Reward: draw ${payOf(g, 'oath_penance', 3)} cards.`,
    cardExhausted(g, o) { if (o.isPlayer) g.oathProgress('oath_penance'); },
    // Exhausted at end of turn (Ethereal): the cards arrive next turn instead.
    fulfil(g, pay) { if (g.cb.phase === 'player') g.draw(pay); else g.applySelf('next_draw', pay); },
  }),
  oath({
    id: 'oath_blood', name: 'Blood Oath',
    desc: (n, g) => `Lose HP ${n === 1 ? 'once more' : n + ' more times'}. Reward: gain ${payOf(g, 'oath_blood', 2)} Might.`,
    hpLost(g) { g.oathProgress('oath_blood'); },
    fulfil(g, pay) { g.applySelf('might', pay); },
  }),
  oath({
    id: 'oath_door', name: 'Oath of the Unopened Door',
    desc: (n) => `End ${n} more turn${s(n)} with enough Block to stop all incoming damage. Reward: deal damage equal to your Block to ALL enemies.`,
    turnEnd(g, o) { if (endBlock(o, 'oath_door') >= incoming(g)) g.oathProgress('oath_door'); },
    fulfil(g) { spellAll(g, g.player.block); },
  }),
]);

// ------------------------------------------------------------------ power & effect statuses
defineStatuses([
  {
    id: 'knight_fervor', name: 'Grim Resolve', kind: 'buff', icon: 'enrage',
    desc: (n) => `At the end of your turn, lose ${n} Might.`,
    turnEnd(g, o, n) { g.addStatus(o, 'might', -n); g.removeStatus(o, 'knight_fervor'); },
  },
  {
    id: 'knight_bristle', name: 'Hedge of Spears', kind: 'buff', icon: 'thorns',
    desc: (n) => `Until your next turn, whenever you are attacked, deal ${n} damage back.`,
    onAttacked(g, o, n, src) { if (src && src !== o && !src.dead) g.damage(src, n, { type: 'thorns', src: o }); },
    turnStart(g, o) { g.removeStatus(o, 'knight_bristle'); },
  },
  {
    id: 'knight_iron_penance', name: 'Iron Penance', kind: 'buff', icon: 'feather',
    desc: (n) => `Whenever you Exhaust a card, gain ${n} Block.`,
    cardExhausted(g, o, n) { if (o.isPlayer) g.block(n); },
  },
  {
    id: 'knight_zeal', name: 'Flagellant\'s Zeal', kind: 'buff', icon: 'blood',
    desc: (n) => `Whenever you lose HP during your turn, gain ${n} Might.`,
    hpLost(g, o, n) { if (g.cb && g.cb.phase === 'player') g.applySelf('might', n); },
  },
  {
    id: 'knight_honour', name: 'Honour Bound', kind: 'buff', icon: 'star',
    desc: (n) => `Whenever you fulfil an Oath, gain ${n} Might.`,
    oathFulfilled(g, o, n) { if (o.isPlayer) g.applySelf('might', n); },
  },
  {
    id: 'knight_vigil', name: 'The Long Vigil', kind: 'buff', icon: 'moon',
    desc: () => 'Whenever you fulfil an Oath, swear it again.',
    oathFulfilled(g, o, n, id) {
      if (!o.isPlayer || g.player.st[id] > 0) return;
      const m = g.cb.oathMeta && g.cb.oathMeta[id];
      if (m) swearOath(g, id, m.need, m.pay);
    },
  },
]);

// ------------------------------------------------------------------ cards
const K = { hero: 'knight' };

defineCards([
  // ============================================================ starters
  {
    ...K, id: 'strike_knight', name: 'Strike', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy',
    v: { dmg: 6 }, up: { dmg: 3 }, art: 'sword',
    text: 'Deal {dmg} damage.',
    play(g, v, t) { g.attack(t, v.dmg); },
  },
  {
    ...K, id: 'defend_knight', name: 'Defend', type: 'skill', rarity: 'starter', cost: 1, target: 'none',
    v: { blk: 5 }, up: { blk: 3 }, art: 'shield',
    text: 'Gain {blk} Block.',
    play(g, v) { g.block(v.blk); },
  },
  {
    ...K, id: 'vow_of_the_wall', name: 'Vow of the Wall', type: 'skill', rarity: 'starter', cost: 1, target: 'none',
    v: { blk: 7, pay: 2 }, up: { blk: 3, pay: 1 }, art: 'oath',
    text: 'Gain {blk} Block. Oath: end 2 turns with 8+ Block. Reward: gain {pay} Might.',
    play(g, v) { swearOath(g, 'oath_wall', 2, v.pay); g.block(v.blk); },
  },

  // ============================================================ commons
  {
    ...K, id: 'penitent_blow', name: 'Penitent Blow', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { hp: 2, dmg: 12 }, up: { dmg: 4 }, tier: 0, art: 'mace',
    text: 'Lose {hp} HP. Deal {dmg} damage.',
    play(g, v, t) { g.loseHp(g.player, v.hp, { type: 'hploss' }); g.attack(t, v.dmg); },
  },
  {
    ...K, id: 'hilt_and_edge', name: 'Hilt and Edge', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 5 }, up: { dmg: 2 }, tier: 0, art: 'sword',
    text: 'Deal {dmg} damage twice.',
    play(g, v, t) { g.attack(t, v.dmg, 2); },
  },
  {
    ...K, id: 'shield_bash_knight', name: 'Shield Bash', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { blk: 5, dmg: 5 }, up: { blk: 2, dmg: 2 }, tier: 0, art: 'shield',
    text: 'Gain {blk} Block. Deal {dmg} damage.',
    play(g, v, t) { g.block(v.blk); g.attack(t, v.dmg); },
  },
  {
    ...K, id: 'reaping_arc', name: 'Reaping Arc', type: 'attack', rarity: 'common', cost: 1, target: 'none',
    v: { dmg: 8 }, up: { dmg: 3 }, tier: 0, art: 'scythe',
    text: 'Deal {dmg} damage to ALL enemies.',
    play(g, v) { g.attackAll(v.dmg); },
  },
  {
    ...K, id: 'iron_rush', name: 'Iron Rush', type: 'attack', rarity: 'common', cost: 1, upCost: 0, target: 'enemy',
    tier: 0, art: 'tower_shield',
    text: 'Deal damage equal to your Block.',
    play(g, v, t) { g.attack(t, g.player.block); },
  },
  {
    ...K, id: 'sworn_strike', name: 'Sworn Strike', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 7, pay: 1 }, up: { dmg: 3 }, tier: 0, art: 'banner',
    text: 'Deal {dmg} damage. Oath: play 3 Attacks in one turn. Reward: gain {pay} Energy.',
    play(g, v, t) { swearOath(g, 'oath_charge', 1, v.pay); g.attack(t, v.dmg); },
  },
  {
    ...K, id: 'headsmans_swing', name: 'Headsman\'s Swing', type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    v: { dmg: 14, pay: 4 }, up: { dmg: 4, pay: 2 }, tier: 0, art: 'axe',
    text: 'Deal {dmg} damage. Oath: kill an enemy. Reward: heal {pay} HP.',
    play(g, v, t) { swearOath(g, 'oath_headsman', 1, v.pay); g.attack(t, v.dmg); },
  },
  {
    ...K, id: 'grave_edge', name: 'Grave Edge', type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    v: { base: 14, mult: 3 }, up: { mult: 2 }, tier: 0, art: 'greatsword',
    text: 'Deal {base} damage. Might counts {mult} times for this card.',
    play(g, v, t) { g.attack(t, v.base + (v.mult - 1) * g.st(g.player, 'might')); },
  },
  {
    ...K, id: 'steel_vow', name: 'Steel Vow', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 4, pay: 6 }, up: { dmg: 1, pay: 3 }, tier: 0, art: 'rune',
    text: 'Deal {dmg} damage twice. Oath: hit enemies 5 times. Reward: deal {pay} damage to ALL enemies.',
    play(g, v, t) { swearOath(g, 'oath_blade', 5, v.pay); g.attack(t, v.dmg, 2); },
  },
  {
    ...K, id: 'felling_blow', name: 'Felling Blow', type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    v: { dmg: 12, w: 2 }, up: { dmg: 2, w: 1 }, tier: 2, art: 'mace',
    text: 'Deal {dmg} damage. Apply {w} Weakened.',
    play(g, v, t) { g.attack(t, v.dmg); g.apply(t, 'weak', v.w); },
  },
  {
    ...K, id: 'ringing_blow', name: 'Ringing Blow', type: 'attack', rarity: 'common', cost: 1, target: 'none',
    v: { dmg: 4 }, up: { dmg: 3 }, tier: 1, art: 'bell',
    text: 'Deal {dmg} damage to ALL enemies. Apply 1 Exposed to ALL enemies.',
    play(g, v) { g.attackAll(v.dmg); g.applyAll('exposed', 1); },
  },
  {
    ...K, id: 'steel_yourself', name: 'Steel Yourself', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 8 }, up: { blk: 3 }, tier: 0, art: 'cloak',
    text: 'Gain {blk} Block. Draw 1 card.',
    play(g, v) { g.block(v.blk); g.draw(1); },
  },
  {
    ...K, id: 'hair_shirt', name: 'Hair Shirt', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 7, choose: 0 }, up: { blk: 2, choose: 1 }, tier: 0, art: 'thorn',
    text: 'Gain {blk} Block. Exhaust a random card in your hand.',
    upText: 'Gain {blk} Block. Exhaust a card in your hand.',
    async play(g, v) {
      g.block(v.blk);
      if (v.choose) {
        const [c] = await g.chooseHand(1, 'Exhaust a card');
        if (c) g.exhaustCard(c);
      } else if (g.hand.length) g.exhaustCard(pick(g.srng, g.hand));
    },
  },
  {
    ...K, id: 'grim_resolve', name: 'Grim Resolve', type: 'skill', rarity: 'common', cost: 0, target: 'none',
    v: { n: 2 }, up: { n: 2 }, tier: 0, art: 'fist',
    text: 'Gain {n} Might this turn.',
    play(g, v) { g.applySelf('might', v.n); g.addStatus(g.player, 'knight_fervor', v.n); },
  },
  {
    ...K, id: 'hold_the_line', name: 'Hold the Line', type: 'skill', rarity: 'common', cost: 2, target: 'none',
    v: { blk: 12 }, up: { blk: 4 }, tier: 0, art: 'tower_shield',
    text: 'Gain {blk} Block and 1 Bulwark.',
    play(g, v) { g.block(v.blk); g.applySelf('bulwark', 1); },
  },
  {
    ...K, id: 'vow_of_the_unbroken', name: 'Vow of the Unbroken', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 7, pay: 2 }, up: { blk: 3, pay: 1 }, tier: 0, art: 'oath',
    text: 'Gain {blk} Block. Oath: go a round without taking unblocked damage. Reward: gain {pay} Plating.',
    play(g, v) { swearOath(g, 'oath_unbroken', 1, v.pay); g.block(v.blk); },
  },
  {
    ...K, id: 'shield_of_vows', name: 'Shield of Vows', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 6, per: 3 }, up: { blk: 2, per: 1 }, tier: 0, art: 'sigil',
    text: 'Gain {blk} Block, plus {per} for each Oath you hold.',
    play(g, v) { g.block(v.blk + v.per * heldOaths(g).length); },
  },
  {
    ...K, id: 'squires_care', name: 'Squire\'s Care', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 5, all: 0 }, up: { all: 1 }, tier: 1, art: 'hand',
    text: 'Gain {blk} Block. Upgrade a card in your hand.',
    upText: 'Gain {blk} Block. Upgrade ALL cards in your hand.',
    async play(g, v) {
      g.block(v.blk);
      if (v.all) { for (const c of g.hand) if (g.canUpgrade(c)) g.upgradeCard(c); return; }
      const [c] = await g.choose({ from: 'hand', count: 1, title: 'Upgrade a card', filter: (x) => g.canUpgrade(x) });
      if (c) g.upgradeCard(c);
    },
  },

  // ============================================================ uncommons
  {
    ...K, id: 'sundering_blow', name: 'Sundering Blow', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    v: { dmg: 15, pay: 2 }, up: { dmg: 3 }, tier: 0, art: 'mace',
    text: 'Deal {dmg} damage. Oath: hit for 20+ damage at once. Reward: apply {pay} Weakened to ALL enemies.',
    play(g, v, t) { swearOath(g, 'oath_breaking', 1, v.pay); g.attack(t, v.dmg); },
  },
  {
    ...K, id: 'whirl_of_steel', name: 'Whirl of Steel', type: 'attack', rarity: 'uncommon', cost: 'X', target: 'none',
    v: { dmg: 5 }, up: { dmg: 3 }, tier: 0, art: 'swirl',
    text: 'Deal {dmg} damage to ALL enemies X times.',
    play(g, v) { if (v.x > 0) g.attackAll(v.dmg, v.x); },
  },
  {
    ...K, id: 'rain_of_blows', name: 'Rain of Blows', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 2, times: 4 }, up: { times: 1 }, kw: ['exhaust'], tier: 1, art: 'fist',
    text: 'Deal {dmg} damage {times} times.',
    play(g, v, t) { g.attack(t, v.dmg, v.times); },
  },
  {
    ...K, id: 'word_kept', name: 'Word Kept', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 7, per: 5 }, up: { dmg: 2, per: 2 }, tier: 0, art: 'scroll',
    text: 'Deal {dmg} damage, plus {per} for each Oath fulfilled this combat.',
    play(g, v, t) { g.attack(t, v.dmg + v.per * g.tot.oaths); },
  },
  {
    ...K, id: 'lash_of_penance', name: 'Lash of Penance', type: 'attack', rarity: 'uncommon', cost: 1, target: 'none',
    v: { hp: 3, dmg: 5 }, up: { dmg: 2 }, tier: 3, art: 'chain',
    text: 'Lose {hp} HP. Deal {dmg} damage to ALL enemies twice.',
    play(g, v) { g.loseHp(g.player, v.hp, { type: 'hploss' }); g.attackAll(v.dmg, 2); },
  },
  {
    ...K, id: 'old_grudge', name: 'Old Grudge', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 8, inc: 5 }, up: { inc: 3 }, tier: 3, art: 'skull',
    text: 'Deal {dmg} damage. Increase this card\'s damage by {inc} this combat.',
    play(g, v, t, card) {
      g.attack(t, v.dmg);
      card.bonus = { ...(card.bonus || {}), dmg: ((card.bonus && card.bonus.dmg) || 0) + v.inc };
    },
  },
  {
    ...K, id: 'shield_of_the_dead_king', name: 'Shield of the Dead King', type: 'attack', rarity: 'uncommon', cost: 2, upCost: 1, target: 'none',
    tier: 2, art: 'crown',
    text: 'Deal damage equal to your Block to ALL enemies.',
    play(g) { g.attackAll(g.player.block); },
  },
  {
    ...K, id: 'redoubt_knight', name: 'Redoubt', type: 'skill', rarity: 'uncommon', cost: 2, upCost: 1, target: 'none',
    tier: 0, art: 'tower_shield',
    text: 'Double your Block.',
    play(g) { if (g.player.block > 0) g.gainBlock(g.player, g.player.block, { raw: true }); },
  },
  {
    ...K, id: 'vow_of_the_sentry', name: 'Vow of the Sentry', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
    v: { blk: 6, pay: 2 }, up: { blk: 3 }, tier: 0, art: 'lantern',
    text: 'Gain {blk} Block. Oath: end a turn without playing an Attack. Reward: next turn, gain {pay} Energy.',
    play(g, v) { swearOath(g, 'oath_sentry', 1, v.pay); g.block(v.blk); },
  },
  {
    ...K, id: 'blood_oath_knight', name: 'Blood Oath', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
    v: { hp: 2, pay: 2 }, up: { pay: 1 }, tier: 0, art: 'blood',
    text: 'Lose {hp} HP. Oath: lose HP 3 times. Reward: gain {pay} Might.',
    play(g, v) { swearOath(g, 'oath_blood', 3, v.pay); g.loseHp(g.player, v.hp, { type: 'hploss' }); },
  },
  {
    ...K, id: 'vow_of_penance', name: 'Vow of Penance', type: 'skill', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none',
    v: { pay: 3 }, tier: 0, art: 'candle',
    text: 'Exhaust a card. Oath: Exhaust 3 cards. Reward: draw {pay} cards.',
    async play(g, v) {
      swearOath(g, 'oath_penance', 3, v.pay);
      const [c] = await g.chooseHand(1, 'Exhaust a card');
      if (c) g.exhaustCard(c);
    },
  },
  {
    ...K, id: 'burn_the_banners', name: 'Burn the Banners', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
    v: { blk: 5 }, up: { blk: 2 }, tier: 4, art: 'flame',
    text: 'Exhaust all non-Attack cards in your hand. Gain {blk} Block for each.',
    play(g, v) {
      for (const c of g.hand.filter((x) => g.cardDef(x).type !== 'attack')) { g.exhaustCard(c); g.block(v.blk); }
    },
  },
  {
    ...K, id: 'mortification', name: 'Mortification', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
    v: { hp: 3, e: 2 }, up: { e: 1 }, tier: 2, art: 'heart',
    text: 'Lose {hp} HP. Gain {e} Energy.',
    play(g, v) { g.loseHp(g.player, v.hp, { type: 'hploss' }); g.gainEnergy(v.e); },
  },
  {
    ...K, id: 'hedge_of_spears', name: 'Hedge of Spears', type: 'skill', rarity: 'uncommon', cost: 2, target: 'none',
    v: { blk: 12, n: 4 }, up: { blk: 4, n: 2 }, tier: 4, art: 'spear',
    text: 'Gain {blk} Block. Until your next turn, deal {n} damage back whenever you are attacked.',
    play(g, v) { g.block(v.blk); g.addStatus(g.player, 'knight_bristle', v.n); },
  },
  {
    ...K, id: 'recite_the_vows', name: 'Recite the Vows', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
    v: { blk: 5 }, up: { blk: 3 }, tier: 2, art: 'book',
    text: 'Gain {blk} Block. Advance each of your Oaths by 1 step.',
    play(g, v) {
      g.block(v.blk);
      for (const id of heldOaths(g)) if (g.player.st[id] > 0) g.oathProgress(id, 1);
    },
  },
  {
    ...K, id: 'burning_shame', name: 'Burning Shame', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
    v: { n: 2 }, up: { n: 1 }, tier: 0, art: 'spark',
    text: 'Gain {n} Might.',
    play(g, v) { g.applySelf('might', v.n); },
  },
  {
    ...K, id: 'old_guards_mail', name: 'Old Guard\'s Mail', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
    v: { n: 3 }, up: { n: 1 }, tier: 0, art: 'ghost',
    text: 'Gain {n} Plating.',
    play(g, v) { g.applySelf('plating', v.n); },
  },
  {
    ...K, id: 'iron_penance', name: 'Iron Penance', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
    v: { blk: 3 }, up: { blk: 1 }, tier: 1, art: 'prayer',
    text: 'Whenever you Exhaust a card, gain {blk} Block.',
    play(g, v) { g.addStatus(g.player, 'knight_iron_penance', v.blk); },
  },
  {
    ...K, id: 'flagellants_zeal', name: 'Flagellant\'s Zeal', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
    v: { n: 1 }, up: { n: 1 }, tier: 3, art: 'thorn',
    text: 'Whenever you lose HP during your turn, gain {n} Might.',
    play(g, v) { g.addStatus(g.player, 'knight_zeal', v.n); },
  },
  {
    ...K, id: 'honour_bound', name: 'Honour Bound', type: 'power', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none',
    v: { n: 2 }, tier: 0, art: 'oath',
    text: 'Whenever you fulfil an Oath, gain {n} Might.',
    play(g, v) { g.addStatus(g.player, 'knight_honour', v.n); },
  },

  // ============================================================ rares
  {
    ...K, id: 'oath_of_the_unopened_door', name: 'Oath of the Unopened Door', type: 'skill', rarity: 'rare', cost: 1, target: 'none',
    v: { blk: 8 }, up: { blk: 4 }, tier: 0, art: 'key',
    text: 'Gain {blk} Block. Oath: end 2 turns Blocking all incoming damage. Reward: deal damage equal to your Block to ALL enemies.',
    play(g, v) { swearOath(g, 'oath_door', 2, 0); g.block(v.blk); },
  },
  {
    ...K, id: 'word_of_honour', name: 'Word of Honour', type: 'skill', rarity: 'rare', cost: 1, upCost: 0, target: 'none',
    kw: ['exhaust'], tier: 3, art: 'scroll',
    text: 'Fulfil every Oath you hold.',
    canPlay: (g) => heldOaths(g).length > 0, cantText: 'You hold no Oaths.',
    play(g) { for (const id of heldOaths(g)) if (g.player.st[id] > 0) g.oathProgress(id, g.player.st[id]); },
  },
  {
    ...K, id: 'blood_will_out', name: 'Blood Will Out', type: 'skill', rarity: 'rare', cost: 1, target: 'none',
    kw: ['exhaust'], upKw: { remove: ['exhaust'] }, tier: 0, art: 'blood',
    text: 'Double your Might.',
    play(g) { const m = g.st(g.player, 'might'); if (m > 0) g.applySelf('might', m); },
  },
  {
    ...K, id: 'iron_discipline_knight', name: 'Iron Discipline', type: 'power', rarity: 'rare', cost: 3, upCost: 2, target: 'none',
    tier: 0, art: 'sigil',
    text: 'Your Block is no longer removed at the start of your turn.',
    play(g) { if (!g.player.st.barricade) g.applySelf('barricade', 1); },
  },
  {
    ...K, id: 'blood_of_kings', name: 'Blood of Kings', type: 'power', rarity: 'rare', cost: 3, target: 'none',
    v: { n: 2 }, up: { n: 1 }, tier: 0, art: 'crown',
    text: 'At the end of each of your turns, gain {n} Might.',
    play(g, v) { g.applySelf('rite', v.n); },
  },
  {
    ...K, id: 'the_long_vigil', name: 'The Long Vigil', type: 'power', rarity: 'rare', cost: 2, upCost: 1, target: 'none',
    tier: 5, art: 'hourglass',
    text: 'Whenever you fulfil an Oath, swear it again.',
    play(g) { if (!g.player.st.knight_vigil) g.addStatus(g.player, 'knight_vigil', 1); },
  },
  {
    ...K, id: 'pyre_of_regrets', name: 'Pyre of Regrets', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy',
    v: { dmg: 7 }, up: { dmg: 3 }, kw: ['exhaust'], tier: 0, art: 'flame',
    text: 'Exhaust all other cards in your hand. Deal {dmg} damage for each.',
    play(g, v, t) {
      const cards = [...g.hand];
      for (const c of cards) g.exhaustCard(c);
      if (cards.length) g.attack(t, v.dmg, cards.length);
    },
  },
  {
    ...K, id: 'wergild', name: 'Wergild', type: 'attack', rarity: 'rare', cost: 1, target: 'enemy',
    v: { dmg: 10, hp: 3 }, up: { dmg: 2, hp: 1 }, kw: ['exhaust'], tier: 4, art: 'coin',
    text: 'Deal {dmg} damage. If this kills, raise your Max HP by {hp}.',
    play(g, v, t) { g.attack(t, v.dmg); if (t && t.dead && !t.fled) g.gainMaxHp(v.hp); },
  },
  {
    ...K, id: 'reckoning_knight', name: 'Reckoning', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy',
    v: { dmg: 4, times: 5 }, up: { dmg: 1 }, tier: 5, art: 'greatsword',
    text: 'Deal {dmg} damage {times} times.',
    play(g, v, t) { g.attack(t, v.dmg, v.times); },
  },
  {
    ...K, id: 'forsworn', name: 'Forsworn', type: 'attack', rarity: 'rare', cost: 1, target: 'none',
    v: { dmg: 8 }, up: { dmg: 3 }, tier: 5, art: 'skull',
    text: 'Break every Oath you hold. Deal {dmg} damage to ALL enemies for each one broken.',
    canPlay: (g) => heldOaths(g).length > 0, cantText: 'You hold no Oaths to break.',
    play(g, v) {
      const ids = heldOaths(g);
      for (const id of ids) { g.removeStatus(g.player, id); delete g.cb.oaths[id]; }
      if (ids.length) g.attackAll(v.dmg, ids.length);
    },
  },
]);

// ------------------------------------------------------------------ relics
defineRelics([
  {
    id: 'broken_sigil', name: 'Broken Sigil', rarity: 'starter', hero: 'knight', icon: 'sigil', tint: '#8e98a3',
    desc: 'At the end of combat, heal 6 HP.',
    flavor: 'The King\'s Shield, cracked down the middle. He kept the pieces.',
    combatEnd(g, r, won) { if (won) g.healPlayer(6); },
  },
  {
    id: 'kingsguard_cloak', name: 'Kingsguard Cloak', rarity: 'common', hero: 'knight', icon: 'cloak', tint: '#4a5f86',
    desc: 'At the start of each combat, gain 8 Block and 1 Bulwark.',
    flavor: 'Royal blue, gone the grey of everything else. He wore it on the night of Ashfall.',
    turnStart(g, r, turn) {
      if (turn !== 1) return;
      g.gainBlock(g.player, 8, { raw: true });
      g.applySelf('bulwark', 1);
    },
  },
  {
    id: 'penitents_cord', name: 'Penitent\'s Cord', rarity: 'common', hero: 'knight', icon: 'rope', tint: '#8a6a4a',
    desc: 'Whenever you lose HP during your turn, gain 3 Block.',
    flavor: 'Three knots. One for the door, one for the king, one for the boy who swore.',
    hpLost(g, r, e) {
      if (e && e.isPlayer && g.cb && g.cb.phase === 'player') g.gainBlock(g.player, 3, { raw: true });
    },
  },
  {
    id: 'gate_watch_horn', name: 'Horn of the Gate Watch', rarity: 'uncommon', hero: 'knight', icon: 'horn', tint: '#c9a227',
    desc: 'At the start of each combat, swear a random Oath.',
    flavor: 'Sounded at Ashgrave\'s gate every dawn for ninety-one years. Never once for a battle.',
    turnStart(g, r, turn) { if (turn === 1) swearRandomOath(g); },
  },
  {
    id: 'knights_misericorde', name: 'Misericorde', rarity: 'uncommon', hero: 'knight', icon: 'dagger', tint: '#b8c0c8',
    desc: 'Whenever you play your third Attack in a turn, gain 1 Might.',
    flavor: 'The mercy-knife, for a knight past saving. He has carried it twenty years and never used it.',
    cardPlayed(g, r, card) {
      const cb = g.cb;
      if (!cb || g.cardDef(card).type !== 'attack' || g.cnt.attacks < 3 || cb.misericordeTurn === cb.turn) return;
      cb.misericordeTurn = cb.turn;
      g.applySelf('might', 1);
    },
  },
  {
    id: 'the_last_order', name: 'The Last Order', rarity: 'rare', hero: 'knight', icon: 'scroll', tint: '#d8cfb8',
    desc: 'Your Oaths need 1 fewer step to fulfil (minimum 1).',
    flavor: '"Let no one in." The seal is the king\'s own. He has been obeying it ever since.',
  },
  {
    id: 'penitents_chains', name: 'Penitent\'s Chains', rarity: 'boss', hero: 'knight', icon: 'chain', tint: '#6e6a66',
    desc: 'Gain 1 Energy at the start of each turn. At the start of your turn, lose 1 HP.',
    flavor: 'He woke at the Waystone wearing them. He does not remember putting them on, and he has not taken them off.',
    maxEnergy() { return 1; },
    turnStart(g) { g.loseHp(g.player, 1, { type: 'hploss' }); },
  },
]);

// ------------------------------------------------------------------ tinctures
definePotions([
  {
    id: 'tincture_of_vows', name: 'Tincture of Vows', rarity: 'uncommon', hero: 'knight', target: 'none',
    icon: 'vial', color: '#c9a227',
    desc: 'Swear a random Oath, then advance each of your Oaths by 2 steps.',
    async use(g, t, mul) {
      swearRandomOath(g);
      for (const id of heldOaths(g)) if (g.player.st[id] > 0) g.oathProgress(id, 2 * mul);
    },
  },
  {
    id: 'tincture_of_the_rampart', name: 'Tincture of the Rampart', rarity: 'common', hero: 'knight', target: 'none',
    icon: 'flask_tall', color: '#8e98a3',
    desc: 'Gain 10 Block and 1 Bulwark.',
    async use(g, t, mul) { g.gainBlock(g.player, 10 * mul, { raw: true }); g.applySelf('bulwark', mul); },
  },
]);
