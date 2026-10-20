// Isolde Marrow, the Plague Witch (KIN).
//
// Four threads run through her cards:
//   ROT     — apply heavy Rot, multiply it, spread it when the rotting die, cash it in.
//   BREW    — Brew Draughts (free, exhausting 0-cost cards); reward 0-cost plays and Exhaust.
//   WITHER  — permanently strip enemy Might, Weaken them: defence through control.
//   FESTER  — cards that grow while Retained, and payoffs for what you burn away.
//
// Card text conventions: "Wither N" = g.apply(t, 'might', -N). "Brew N" = g.brew(N).
import { defineCards, defineStatuses, defineRelics, definePotions, STATUSES } from '../../engine/registry.js';

// ------------------------------------------------------------------ helpers
const BASE_DRAUGHTS = ['draught_bile', 'draught_ash', 'draught_ember', 'draught_clarity', 'draught_marrow'];
const isDraught = (c) => !!c && typeof c.id === 'string' && c.id.startsWith('draught_');
const wither = (g, t, n) => { if (t && !t.dead && n > 0) g.apply(t, 'might', -n); };

// Fester: permanently (for this combat) add `amt` to one of a card's values.
function grow(c, key, amt) {
  if (!amt) return;
  c.bonus = { ...(c.bonus || {}) };
  c.bonus[key] = (c.bonus[key] || 0) + amt;
}

// Debuffs currently on an entity (Malice). Withered (negative) Might counts as one.
function debuffCount(e) {
  let k = 0;
  for (const id of Object.keys(e.st)) {
    if (id === 'witch_kept') continue; // bookkeeping marker, not a real affliction
    const d = STATUSES[id];
    const n = e.st[id];
    if (d && n && (d.kind === 'debuff' || (d.negOk && n < 0))) k++;
  }
  return k;
}

// The Long Rot: mark enemies so their Rot never decays.
function keepRot(g, e) { if (e && !e.dead && !e.st.witch_kept) g.addStatus(e, 'witch_kept', 1, { silent: true }); }
function keepAll(g) { for (const e of g.enemies) keepRot(g, e); }

// ------------------------------------------------------------------ statuses
defineStatuses([
  {
    id: 'witch_spores', name: 'Spore Cloud', kind: 'buff', icon: 'echo',
    desc: (n) => `At the start of your turn, apply ${n} Rot to ALL enemies.`,
    turnStart(g, o, n) { g.applyAll('rot', n); },
  },
  {
    id: 'witch_pestilence', name: 'Pestilence', kind: 'buff', icon: 'skull',
    desc: (n) => n > 1
      ? `Whenever an enemy dies, apply ${n} times its Rot to ALL other enemies.`
      : 'Whenever an enemy dies, apply its Rot to ALL other enemies.',
    enemyDied(g, o, n, enemy) {
      if (!o.isPlayer || !enemy) return;
      const r = g.st(enemy, 'rot');
      if (r > 0) for (const e of g.enemies) g.apply(e, 'rot', r * n);
    },
  },
  {
    id: 'witch_cauldron', name: 'Bubbling Cauldron', kind: 'buff', icon: 'brew',
    desc: (n) => `At the start of your turn, Brew ${n}.`,
    turnStart(g, o, n) { g.brew(n); },
  },
  {
    id: 'witch_compost', name: 'Compost Heap', kind: 'buff', icon: 'guard',
    desc: (n) => `Whenever you Exhaust a card, gain ${n} Block.`,
    cardExhausted(g, o, n) { if (o.isPlayer) g.block(n); },
  },
  {
    id: 'witch_ferment', name: 'Ferment', kind: 'buff', icon: 'moon',
    desc: () => 'At the end of your turn, Retain your Draughts and upgrade them.',
    turnEnd(g) {
      for (const c of g.hand) if (isDraught(c)) { c.retainOnce = true; g.upgradeCard(c); }
    },
  },
  {
    id: 'witch_long_rot', name: 'The Long Rot', kind: 'buff', icon: 'chain',
    desc: () => 'Rot on enemies no longer decreases.',
    turnStart(g) { keepAll(g); },
    cardPlayed(g, o) { if (o.isPlayer) keepAll(g); },
    statusApplied(g, o, n, tgt, id) { if (o.isPlayer && id === 'rot' && tgt && !tgt.isPlayer) keepRot(g, tgt); },
  },
  {
    // Marker on enemies under The Long Rot. Rot ticks via loseHp(type 'rot') and then
    // decrements; restoring 1 here when it ticks cancels the decrement.
    id: 'witch_kept', name: 'Long Rot', kind: 'debuff', icon: 'chain',
    desc: () => 'Its Rot does not decrease.',
    hpLost(g, o, n, amount, opts) {
      if (opts && opts.type === 'rot' && g.st(o, 'rot') > 0) g.addStatus(o, 'rot', 1, { silent: true });
    },
  },
  {
    id: 'witch_consumption', name: 'Consumption', kind: 'buff', icon: 'blood',
    desc: (n) => `At the start of your turn, Wither ${n} from each enemy with Rot.`,
    turnStart(g, o, n) { for (const e of g.enemies) if (g.st(e, 'rot') > 0) wither(g, e, n); },
  },
  {
    id: 'witch_kettle', name: "Kettle's Song", kind: 'buff', icon: 'flame',
    desc: (n) => `Whenever you play a card that costs 0, deal ${n} damage to a random enemy.`,
    cardPlayed(g, o, n, card) {
      if (!o.isPlayer || !card || g.cardCost(card) !== 0) return;
      const e = g.randomEnemy();
      if (e) g.damage(e, n, { type: 'spell', src: g.player });
    },
  },
  {
    id: 'witch_bloom', name: 'Corpse Bloom', kind: 'debuff', icon: 'star',
    desc: (n) => `When it dies, deals ${n > 1 ? n + ' times ' : ''}its Max HP as damage to ALL other enemies.`,
    died(g, o, n) {
      for (const e of g.enemies) if (e !== o) g.damage(e, o.maxHp * n, { type: 'spell', src: g.player });
    },
  },
]);

// ------------------------------------------------------------------ cards
defineCards([
  // ============================================================ starters
  {
    id: 'strike_witch', name: 'Strike', hero: 'witch', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy',
    v: { dmg: 6 }, up: { dmg: 3 }, art: 'dagger',
    text: 'Deal {dmg} damage.',
    play(g, v, t) { g.attack(t, v.dmg); },
  },
  {
    id: 'defend_witch', name: 'Defend', hero: 'witch', type: 'skill', rarity: 'starter', cost: 1, target: 'none',
    v: { blk: 5 }, up: { blk: 3 }, art: 'cloak',
    text: 'Gain {blk} Block.',
    play(g, v) { g.block(v.blk); },
  },
  {
    id: 'blightseed', name: 'Blightseed', hero: 'witch', type: 'skill', rarity: 'starter', cost: 1, target: 'enemy',
    v: { n: 4 }, up: { n: 2 }, art: 'rot',
    text: 'Apply {n} Rot. Brew 1.',
    play(g, v, t) { g.apply(t, 'rot', v.n); g.brew(1); },
  },

  // ============================================================ special (brewed)
  {
    id: 'draught_hemlock', name: 'Draught of Hemlock', hero: 'witch', type: 'skill', rarity: 'special', cost: 0, target: 'enemy',
    kw: ['exhaust'], art: 'flask', v: { w: 1, weak: 1 }, up: { weak: 1 },
    text: 'Wither {w}. Apply {weak} Weakened.',
    play(g, v, t) { wither(g, t, v.w); g.apply(t, 'weak', v.weak); },
  },

  // ============================================================ common — attacks
  {
    id: 'lancet', name: 'Lancet', hero: 'witch', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 6, n: 3 }, up: { dmg: 2, n: 1 }, tier: 0, art: 'blood',
    text: 'Deal {dmg} damage. Apply {n} Rot.',
    play(g, v, t) { g.attack(t, v.dmg); g.apply(t, 'rot', v.n); },
  },
  {
    id: 'hemlock_lash', name: 'Hemlock Lash', hero: 'witch', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 6 }, up: { dmg: 3 }, tier: 0, art: 'herb',
    text: 'Deal {dmg} damage. Brew a Draught of Hemlock.',
    play(g, v, t) { g.attack(t, v.dmg); g.brew(1, { id: 'draught_hemlock' }); },
  },
  {
    id: 'sicklecut', name: 'Sicklecut', hero: 'witch', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 7 }, up: { dmg: 3 }, tier: 0, art: 'knife',
    text: 'Deal {dmg} damage. If the enemy has Rot, strike again.',
    play(g, v, t) { g.attack(t, v.dmg, g.st(t, 'rot') > 0 ? 2 : 1); },
  },
  {
    id: 'pestle_blow', name: 'Pestle Blow', hero: 'witch', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 6 }, up: { dmg: 3 }, tier: 0, art: 'mace',
    text: 'Deal {dmg} damage. Brew 1.',
    play(g, v, t) { g.attack(t, v.dmg); g.brew(1); },
  },
  {
    id: 'spore_burst', name: 'Spore Burst', hero: 'witch', type: 'attack', rarity: 'common', cost: 1, target: 'none',
    v: { dmg: 4, n: 2 }, up: { dmg: 2, n: 1 }, tier: 0, art: 'mushroom',
    text: 'Deal {dmg} damage and apply {n} Rot to ALL enemies.',
    play(g, v) { g.attackAll(v.dmg); g.applyAll('rot', v.n); },
  },
  {
    id: 'thorn_prick', name: 'Thorn Prick', hero: 'witch', type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    v: { dmg: 2, n: 2 }, up: { dmg: 2, n: 1 }, tier: 0, art: 'thorn',
    text: 'Deal {dmg} damage. Apply {n} Rot.',
    play(g, v, t) { g.attack(t, v.dmg); g.apply(t, 'rot', v.n); },
  },
  {
    id: 'bonesaw', name: 'Bonesaw', hero: 'witch', type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    v: { dmg: 12, w: 1 }, up: { dmg: 4 }, tier: 0, art: 'bone',
    text: 'Deal {dmg} damage. Wither {w}.',
    play(g, v, t) { g.attack(t, v.dmg); wither(g, t, v.w); },
  },
  {
    id: 'canker', name: 'Canker', hero: 'witch', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    kw: ['retain'], v: { dmg: 6, grow: 3 }, up: { dmg: 2, grow: 1 }, tier: 2, art: 'tooth',
    text: 'Deal {dmg} damage. Each turn it is Retained, +{grow} damage.',
    play(g, v, t) { g.attack(t, v.dmg); },
    onRetain(g, c) { grow(c, 'dmg', g.cardVals(c).grow); },
  },

  // ============================================================ common — skills
  {
    id: 'nightshade', name: 'Nightshade', hero: 'witch', type: 'skill', rarity: 'common', cost: 1, target: 'enemy',
    v: { n: 6 }, up: { n: 3 }, tier: 0, art: 'moon',
    text: 'Apply {n} Rot.',
    play(g, v, t) { g.apply(t, 'rot', v.n); },
  },
  {
    id: 'miasma_witch', name: 'Miasma', hero: 'witch', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { n: 4 }, up: { n: 2 }, tier: 0, art: 'swirl',
    text: 'Apply {n} Rot to ALL enemies.',
    play(g, v) { g.applyAll('rot', v.n); },
  },
  {
    id: 'simmer_witch', name: 'Simmer', hero: 'witch', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 5 }, up: { blk: 3 }, tier: 0, art: 'cauldron',
    text: 'Gain {blk} Block. Brew 1.',
    play(g, v) { g.block(v.blk); g.brew(1); },
  },
  {
    id: 'forage_witch', name: 'Forage', hero: 'witch', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 4, n: 2 }, up: { blk: 3 }, tier: 0, art: 'tree',
    text: 'Gain {blk} Block. Draw {n} cards.',
    play(g, v) { g.block(v.blk); g.draw(v.n); },
  },
  {
    id: 'withering_touch', name: 'Withering Touch', hero: 'witch', type: 'skill', rarity: 'common', cost: 1, target: 'enemy',
    v: { blk: 5, w: 1 }, up: { blk: 3 }, tier: 0, art: 'hand',
    text: 'Gain {blk} Block. Wither {w}.',
    play(g, v, t) { g.block(v.blk); wither(g, t, v.w); },
  },
  {
    id: 'censer_smoke', name: 'Censer Smoke', hero: 'witch', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 5, w: 1 }, up: { blk: 2, w: 1 }, tier: 0, art: 'lantern',
    text: 'Gain {blk} Block. Apply {w} Weakened to ALL enemies.',
    play(g, v) { g.block(v.blk); g.applyAll('weak', v.w); },
  },
  {
    id: 'sprig_of_rue', name: 'Sprig of Rue', hero: 'witch', type: 'skill', rarity: 'common', cost: 0, target: 'none',
    v: { blk: 4 }, up: { blk: 3 }, tier: 0, art: 'feather',
    text: 'Gain {blk} Block.',
    play(g, v) { g.block(v.blk); },
  },
  {
    id: 'steep_witch', name: 'Steep', hero: 'witch', type: 'skill', rarity: 'common', cost: 0, target: 'none',
    tier: 0, art: 'flask',
    text: 'Brew 1.', upText: 'Brew 1. It is upgraded.',
    play(g, v, t, card) { g.brew(1, { up: !!card.up }); },
  },
  {
    id: 'render_down', name: 'Render Down', hero: 'witch', type: 'skill', rarity: 'common', cost: 1, upCost: 0, target: 'none',
    v: { n: 2 }, tier: 1, art: 'candle',
    text: 'Exhaust a card in your hand. Brew {n}.',
    async play(g, v) {
      const [c] = await g.chooseHand(1, 'Exhaust a card');
      if (c) g.exhaustCard(c);
      g.brew(v.n);
    },
  },
  {
    id: 'wormwood', name: 'Wormwood', hero: 'witch', type: 'skill', rarity: 'common', cost: 1, target: 'enemy',
    kw: ['retain'], v: { n: 4, grow: 2 }, up: { n: 2, grow: 1 }, tier: 3, art: 'star',
    text: 'Apply {n} Rot. Each turn it is Retained, +{grow} Rot.',
    play(g, v, t) { g.apply(t, 'rot', v.n); },
    onRetain(g, c) { grow(c, 'n', g.cardVals(c).grow); },
  },

  // ============================================================ uncommon — attacks
  {
    id: 'lance_the_boil', name: 'Lance the Boil', hero: 'witch', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 5 }, up: { dmg: 3 }, tier: 0, art: 'spear',
    text: 'Deal {dmg} damage, +1 for each Rot on the enemy.',
    play(g, v, t) { g.attack(t, v.dmg + g.st(t, 'rot')); },
  },
  {
    id: 'hamstring_witch', name: 'Hamstring', hero: 'witch', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 8, w: 1 }, up: { dmg: 3 }, tier: 0, art: 'claw',
    text: 'Deal {dmg} damage. If the enemy is Weakened, Wither {w}.',
    play(g, v, t) {
      const weak = g.st(t, 'weak') > 0;
      g.attack(t, v.dmg);
      if (weak) wither(g, t, v.w);
    },
  },
  {
    id: 'withering_gale', name: 'Withering Gale', hero: 'witch', type: 'attack', rarity: 'uncommon', cost: 2, target: 'none',
    v: { dmg: 6, w: 1 }, up: { dmg: 3 }, tier: 0, art: 'wing',
    text: 'Deal {dmg} damage to ALL enemies. Wither {w} from ALL enemies.',
    play(g, v) { g.attackAll(v.dmg); for (const e of g.enemies) wither(g, e, v.w); },
  },
  {
    id: 'scalding_ladle', name: 'Scalding Ladle', hero: 'witch', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    v: { dmg: 11, n: 2 }, up: { dmg: 4 }, tier: 0, art: 'spark',
    text: 'Deal {dmg} damage. Brew {n}.',
    play(g, v, t) { g.attack(t, v.dmg); g.brew(v.n); },
  },
  {
    id: 'ash_and_bone', name: 'Ash and Bone', hero: 'witch', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 3, per: 2 }, up: { dmg: 2, per: 1 }, tier: 2, art: 'grave',
    text: 'Deal {dmg} damage, +{per} for each card in your exhaust pile.',
    play(g, v, t) { g.attack(t, v.dmg + v.per * g.cb.exhaust.length); },
  },
  {
    id: 'malice_witch', name: 'Malice', hero: 'witch', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 7, per: 3 }, up: { dmg: 2, per: 1 }, tier: 3, art: 'eye',
    text: 'Deal {dmg} damage, +{per} for each debuff on the enemy.',
    play(g, v, t) { g.attack(t, v.dmg + v.per * debuffCount(t)); },
  },
  {
    id: 'carrion_swarm', name: 'Carrion Swarm', hero: 'witch', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 3 }, up: { dmg: 1 }, tier: 4, art: 'raven',
    text: 'Deal {dmg} damage for each other card played this turn.',
    play(g, v, t) { const k = g.cnt.cards; if (k > 0) g.attack(t, v.dmg, k); },
  },

  // ============================================================ uncommon — skills
  {
    id: 'putrefy', name: 'Putrefy', hero: 'witch', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy',
    kw: ['exhaust'], v: { m: 2 }, up: { m: 1 }, tier: 0, art: 'web',
    text: "Double the enemy's Rot.", upText: "Triple the enemy's Rot.",
    play(g, v, t) { const r = g.st(t, 'rot'); if (r > 0) g.apply(t, 'rot', r * (v.m - 1)); },
  },
  {
    id: 'atrophy_witch', name: 'Atrophy', hero: 'witch', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy',
    kw: ['exhaust'], v: { w: 2 }, up: { w: 1 }, tier: 0, art: 'hourglass',
    text: 'Wither {w}.',
    play(g, v, t) { wither(g, t, v.w); },
  },
  {
    id: 'plague_kiss', name: 'Plague Kiss', hero: 'witch', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { n: 3 }, up: { n: 2 }, tier: 0, art: 'heart',
    text: "Apply {n} Rot, then apply that enemy's Rot to ALL other enemies.",
    play(g, v, t) {
      g.apply(t, 'rot', v.n);
      const r = g.st(t, 'rot');
      if (r > 0) for (const e of g.enemies) if (e !== t) g.apply(e, 'rot', r);
    },
  },
  {
    id: 'salve_of_comfrey', name: 'Salve of Comfrey', hero: 'witch', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
    kw: ['exhaust'], v: { blk: 6, m: 2 }, up: { blk: 2, m: 1 }, tier: 0, art: 'herb',
    text: 'Gain {blk} Block. Gain {m} Mending.',
    play(g, v) { g.block(v.blk); g.applySelf('mending', v.m); },
  },
  {
    id: 'mandrake_shriek', name: 'Mandrake Shriek', hero: 'witch', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
    kw: ['exhaust'], v: { w: 1, weak: 2 }, up: { w: 1 }, tier: 1, art: 'ghost',
    text: 'Wither {w} from ALL enemies. Apply {weak} Weakened to ALL enemies.',
    play(g, v) { for (const e of g.enemies) { wither(g, e, v.w); g.apply(e, 'weak', v.weak); } },
  },
  {
    id: 'boil_over', name: 'Boil Over', hero: 'witch', type: 'skill', rarity: 'uncommon', cost: 'X', target: 'none',
    v: { n: 1 }, up: { n: 1 }, tier: 2, art: 'drop',
    text: 'Brew X+{n}.',
    play(g, v) { const k = (v.x || 0) + v.n; if (k > 0) g.brew(k); },
  },
  {
    id: 'shroud_of_flies', name: 'Shroud of Flies', hero: 'witch', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { blk: 3 }, up: { blk: 3 }, tier: 2, art: 'moth',
    text: 'Gain {blk} Block, +1 for each Rot on the enemy.',
    play(g, v, t) { g.block(v.blk + g.st(t, 'rot')); },
  },
  {
    id: 'oak_gall', name: 'Oak Gall', hero: 'witch', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
    kw: ['retain'], v: { blk: 6, grow: 3 }, up: { blk: 2, grow: 1 }, tier: 3, art: 'tree',
    text: 'Gain {blk} Block. Each turn it is Retained, +{grow} Block.',
    play(g, v) { g.block(v.blk); },
    onRetain(g, c) { grow(c, 'blk', g.cardVals(c).grow); },
  },

  // ============================================================ uncommon — powers
  {
    id: 'spore_cloud', name: 'Spore Cloud', hero: 'witch', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
    v: { n: 2 }, up: { n: 1 }, tier: 0, art: 'mushroom',
    text: 'At the start of your turn, apply {n} Rot to ALL enemies.',
    play(g, v) { g.applySelf('witch_spores', v.n); },
  },
  {
    id: 'pestilence_witch', name: 'Pestilence', hero: 'witch', type: 'power', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none',
    tier: 0, art: 'skull',
    text: 'Whenever an enemy dies, apply its Rot to ALL other enemies.',
    play(g) { g.applySelf('witch_pestilence', 1); },
  },
  {
    id: 'bubbling_cauldron', name: 'Bubbling Cauldron', hero: 'witch', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
    upKw: { add: ['innate'] }, tier: 0, art: 'cauldron',
    text: 'At the start of your turn, Brew 1.',
    play(g) { g.applySelf('witch_cauldron', 1); },
  },
  {
    id: 'compost_heap', name: 'Compost Heap', hero: 'witch', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
    v: { blk: 3 }, up: { blk: 1 }, tier: 1, art: 'rot',
    text: 'Whenever you Exhaust a card, gain {blk} Block.',
    play(g, v) { g.applySelf('witch_compost', v.blk); },
  },
  {
    id: 'ferment_witch', name: 'Ferment', hero: 'witch', type: 'power', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none',
    tier: 4, art: 'flask',
    text: 'At the end of your turn, Retain your Draughts and upgrade them.',
    play(g) { g.applySelf('witch_ferment', 1); },
  },

  // ============================================================ rare — attacks
  {
    id: 'black_harvest', name: 'Black Harvest', hero: 'witch', type: 'attack', rarity: 'rare', cost: 2, target: 'none',
    v: { dmg: 8 }, up: { dmg: 4 }, tier: 0, art: 'scythe',
    text: 'Deal {dmg} damage to ALL enemies. Then each enemy loses HP equal to its Rot.',
    play(g, v) {
      g.attackAll(v.dmg);
      for (const e of g.enemies) { const r = g.st(e, 'rot'); if (r > 0) g.loseHp(e, r, { type: 'hploss' }); }
    },
  },
  {
    id: 'slash_and_burn', name: 'Slash and Burn', hero: 'witch', type: 'attack', rarity: 'rare', cost: 2, target: 'none',
    kw: ['exhaust'], v: { dmg: 5 }, up: { dmg: 2 }, tier: 5, art: 'flame',
    text: 'Exhaust your hand. Deal {dmg} damage to ALL enemies for each card Exhausted.',
    play(g, v) {
      const burnt = [...g.hand];
      for (const c of burnt) g.exhaustCard(c);
      if (burnt.length) g.attackAll(v.dmg, burnt.length);
    },
  },
  {
    id: 'long_held_grudge', name: 'Long-Held Grudge', hero: 'witch', type: 'attack', rarity: 'rare', cost: 3, target: 'enemy',
    kw: ['retain'], v: { dmg: 24 }, up: { dmg: 8 }, tier: 5, art: 'fist',
    text: 'Deal {dmg} damage. Each turn it is Retained, costs 1 less.',
    play(g, v, t) { g.attack(t, v.dmg); },
    onRetain(g, c) { c.costCombat = Math.max(0, (c.costCombat ?? g.baseCost(c)) - 1); },
  },

  // ============================================================ rare — skills
  {
    id: 'corpse_bloom', name: 'Corpse Bloom', hero: 'witch', type: 'skill', rarity: 'rare', cost: 2, target: 'enemy',
    v: { n: 6 }, up: { n: 3 }, tier: 0, art: 'wisp',
    text: 'Apply {n} Rot. When it dies, deal its Max HP as damage to ALL other enemies.',
    play(g, v, t) { g.apply(t, 'rot', v.n); g.apply(t, 'witch_bloom', 1); },
  },
  {
    id: 'elowens_recipe', name: "Elowen's Recipe", hero: 'witch', type: 'skill', rarity: 'rare', cost: 2, upCost: 1, target: 'none',
    kw: ['exhaust'], tier: 0, art: 'book',
    text: 'Brew one of each Draught.',
    play(g) { for (const id of BASE_DRAUGHTS) g.brew(1, { id }); },
  },
  {
    id: 'black_hellebore', name: 'Black Hellebore', hero: 'witch', type: 'skill', rarity: 'rare', cost: 'X', target: 'enemy',
    kw: ['exhaust'], v: { n: 0 }, up: { n: 1 }, tier: 1, art: 'sigil',
    text: 'Wither X. Apply X Weakened.', upText: 'Wither X+1. Apply X+1 Weakened.',
    play(g, v, t) { const k = (v.x || 0) + v.n; if (k > 0) { wither(g, t, k); g.apply(t, 'weak', k); } },
  },
  {
    id: 'perennial', name: 'Perennial', hero: 'witch', type: 'skill', rarity: 'rare', cost: 1, target: 'none',
    kw: ['exhaust'], v: { n: 4, grow: 2 }, up: { n: 2, grow: 1 }, tier: 4, art: 'sun',
    text: "Apply {n} Rot to ALL enemies. Permanently increase this card's Rot by {grow}.",
    play(g, v, t, card) {
      g.applyAll('rot', v.n);
      grow(card, 'n', v.grow);
      const master = card.deckUid != null && g.run.deck.find((c) => c.uid === card.deckUid);
      if (master) grow(master, 'n', v.grow);
    },
  },

  // ============================================================ rare — powers
  {
    id: 'the_long_rot', name: 'The Long Rot', hero: 'witch', type: 'power', rarity: 'rare', cost: 3, upCost: 2, target: 'none',
    tier: 0, art: 'crown',
    text: 'Rot on enemies no longer decreases.',
    play(g) { g.applySelf('witch_long_rot', 1); keepAll(g); },
  },
  {
    id: 'consumption_witch', name: 'Consumption', hero: 'witch', type: 'power', rarity: 'rare', cost: 2, upCost: 1, target: 'none',
    tier: 3, art: 'blood',
    text: 'At the start of your turn, Wither 1 from each enemy with Rot.',
    play(g) { g.applySelf('witch_consumption', 1); },
  },
  {
    id: 'kettles_song', name: "Kettle's Song", hero: 'witch', type: 'power', rarity: 'rare', cost: 1, target: 'none',
    v: { n: 3 }, up: { n: 1 }, tier: 5, art: 'bell',
    text: 'Whenever you play a card that costs 0, deal {n} damage to a random enemy.',
    play(g, v) { g.applySelf('witch_kettle', v.n); },
  },
]);

// ------------------------------------------------------------------ relics
defineRelics([
  {
    id: 'mortar_and_pestle', name: 'Mortar and Pestle', rarity: 'starter', hero: 'witch', icon: 'mortar', tint: '#b8ad94',
    desc: 'At the start of each combat, Brew 2.',
    flavor: "Her mother's. The pestle is worn to the shape of a hand that was not Isolde's.",
    combatStart(g) { g.brew(2); },
  },
  {
    id: 'mouldering_skull', name: 'Mouldering Skull', rarity: 'common', hero: 'witch', icon: 'skull', tint: '#8fae3a',
    desc: 'Whenever you apply Rot, apply 1 more.',
    flavor: 'Somebody\'s grandfather. "He\'d want to be useful," Isolde says, and means it.',
    applyAdd(g, r, tgt, id, n) { return id === 'rot' && n > 0 ? 1 : 0; },
  },
  {
    id: 'witch_hagstone', name: 'Hag Stone', rarity: 'common', hero: 'witch', icon: 'stone', tint: '#9a968c',
    desc: 'At the start of each combat, Wither 1 from ALL enemies.',
    flavor: 'Look through the hole and you see things as they are: tired, and smaller than they pretend.',
    combatStart(g) { for (const e of g.enemies) wither(g, e, 1); },
  },
  {
    id: 'cracked_alembic', name: 'Cracked Alembic', rarity: 'uncommon', hero: 'witch', icon: 'bottle', tint: '#9fc7b8',
    desc: 'Draughts you Brew are upgraded.',
    flavor: 'It leaks. So does everything worth having.',
    brewUp() { return 1; },
  },
  {
    id: 'witchs_ladder', name: "Witch's Ladder", rarity: 'uncommon', hero: 'witch', icon: 'rope', tint: '#4a3b30', tier: 1,
    desc: 'Whenever you Wither an enemy, apply 3 Rot to it.',
    flavor: 'Knotted cord and black hen feathers. Each knot a name. Each name a grudge.',
    statusApplied(g, r, tgt, id, n, src) {
      if (id === 'might' && n < 0 && tgt && !tgt.isPlayer && !tgt.dead && src && src.isPlayer) g.apply(tgt, 'rot', 3);
    },
  },
  {
    id: 'bottomless_cup', name: 'Bottomless Cup', rarity: 'rare', hero: 'witch', icon: 'chalice', tint: '#c9c2d8', tier: 2,
    desc: 'The first time you play a Draught each turn, add a copy of it to your hand.',
    flavor: 'Fae silver, lifted from a feast in the Weeping Wood. It does not mind. It never empties.',
    combatStart(g, r) { r.turn = 0; },
    cardPlayed(g, r, card) {
      if (!g.cb || !isDraught(card) || r.turn === g.cb.turn) return;
      r.turn = g.cb.turn;
      g.copyCard(card, 'hand');
    },
  },
  {
    id: 'black_cauldron', name: 'Black Cauldron', rarity: 'boss', hero: 'witch', icon: 'bowl', tint: '#3a3d36',
    desc: 'Replaces Mortar and Pestle. At the start of your turn, Brew 1.',
    flavor: "Dug from the ashes of a burned witch's cottage. Still warm. Still hungry.",
    canSpawn(g) { return g.hasRelic('mortar_and_pestle'); },
    pickup(g) {
      const i = g.run.relics.findIndex((x) => x.id === 'mortar_and_pestle');
      if (i >= 0) g.run.relics.splice(i, 1);
    },
    turnStart(g) { g.brew(1); },
  },
]);

// ------------------------------------------------------------------ tinctures
definePotions([
  {
    id: 'blight_tincture', name: 'Tincture of Blight', rarity: 'common', hero: 'witch', target: 'enemy',
    icon: 'skull_flask', color: '#7fa33a',
    desc: 'Apply 8 Rot.',
    async use(g, t, mul) { g.apply(t, 'rot', 8 * mul); },
  },
  {
    id: 'cauldron_dregs', name: 'Cauldron Dregs', rarity: 'uncommon', hero: 'witch', target: 'none',
    icon: 'jar', color: '#6b5a3a',
    desc: 'Brew 3.',
    async use(g, t, mul) { g.brew(3 * mul); },
  },
]);
