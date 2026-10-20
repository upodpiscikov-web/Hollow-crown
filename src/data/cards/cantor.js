// Brother Cael, the Gravecantor (WITNESS).
// Archetypes: Spirits (Channel / Release / slots / Soul), Bleed (spend HP, heal it back),
// Requiem (the dying, Exhaust, Retain) and Liturgy (sustained powers, hymns that grow).
import { defineCards, defineStatuses, defineRelics, definePotions } from '../../engine/registry.js';
import { SPIRITS } from '../../engine/combat.js';

// ---------------------------------------------------------------- helpers
const soul = (g) => g.st(g.player, 'soul');
const live = (g) => !!(g.cb && g.cb.phase !== 'over');

// Bleed N: lose HP, ignoring Block. Tagged so relics/statuses can tell it apart.
function bleed(g, n) {
  if (!(n > 0)) return 0;
  return g.loseHp(g.player, n, { type: 'hploss', bleed: true });
}
// Bleed cards cannot be played if paying would kill you.
function canBleed(g, card) {
  const b = g.cardVals(card).bleed || 0;
  const cost = g.st(g.player, 'phantasm') ? Math.min(1, b) : b;
  return g.player.hp > cost;
}
const BLEED_GUARD = { canPlay: canBleed, cantText: 'Too little blood left to give.' };

function channelN(g, kind, n) { for (let i = 0; i < n && live(g); i++) g.channel(kind); }

// Release the oldest Spirit `times` times. It leaves its slot on the first Release,
// so nothing channelled mid-sequence can be released by mistake.
function releaseOldest(g, times = 1) {
  const cb = g.cb;
  if (!cb.spirits.length || times <= 0) return null;
  const kind = cb.spirits[0];
  g.release(1);
  for (let i = 1; i < times && live(g); i++) {
    g.emit('release', { kind });
    SPIRITS[kind].release(g, soul(g));
    g.trigger('release', kind);
  }
  return kind;
}

// Add to a card's bonus values (this combat copy unless it is a deck card).
function grow(card, key, n) {
  card.bonus = { ...(card.bonus || {}), [key]: ((card.bonus && card.bonus[key]) || 0) + n };
}

function spiritBolt(g, n) {
  const e = g.randomEnemy();
  if (e && live(g)) g.damage(e, n, { type: 'spirit', src: g.player });
}

// ---------------------------------------------------------------- statuses (powers)
defineStatuses([
  {
    id: 'cantor_stigmata', name: 'Stigmata', kind: 'buff', icon: 'blood',
    desc: (n) => `Whenever you lose HP during your turn, Channel ${n} Wisp${n > 1 ? 's' : ''}.`,
    hpLost(g, o, n) {
      if (o.isPlayer && g.cb && g.cb.phase === 'player') channelN(g, 'wisp', n);
    },
  },
  {
    id: 'cantor_gradual', name: 'Gradual', kind: 'buff', icon: 'plating',
    desc: (n) => `At the end of your turn, gain ${n} Block. Grows by 1 each turn.`,
    turnEnd(g, o, n) {
      g.gainBlock(o, n, { raw: true });
      g.addStatus(o, 'cantor_gradual', 1, { silent: true });
    },
  },
  {
    id: 'cantor_tuba', name: 'Tuba Mirum', kind: 'buff', icon: 'echo',
    desc: (n) => `At the end of your turn, deal ${n} damage to ALL enemies. Grows by 1 each turn.`,
    turnEnd(g, o, n) {
      for (const e of g.enemies) g.damage(e, n, { type: 'spell', src: o });
      if (live(g)) g.addStatus(o, 'cantor_tuba', 1, { silent: true });
    },
  },
  {
    id: 'cantor_kyrie', name: 'Kyrie Eleison', kind: 'buff', icon: 'star',
    desc: (n) => `At the start of your turn, gain ${n} Soul.`,
    turnStart(g, o, n) { g.applySelf('soul', n); },
  },
  {
    id: 'cantor_psychopomp', name: 'Psychopomp', kind: 'buff', icon: 'spirit',
    desc: (n) => `Whenever you Release a Spirit or an enemy dies, deal ${n} damage to a random enemy.`,
    release(g, o, n) { if (o.isPlayer) spiritBolt(g, n); },
    enemyDied(g, o, n) { if (o.isPlayer) spiritBolt(g, n); },
  },
  {
    id: 'cantor_burial', name: 'Burial Rites', kind: 'buff', icon: 'skull',
    desc: (n) => `Whenever you Exhaust a card, Channel ${n} Warden${n > 1 ? 's' : ''}.`,
    cardExhausted(g, o, n) { if (o.isPlayer) channelN(g, 'warden', n); },
  },
]);

// ---------------------------------------------------------------- cards
const H = 'cantor';

defineCards([
  // ============================================================ starters
  {
    id: 'strike_cantor', name: 'Strike', hero: H, type: 'attack', rarity: 'starter', cost: 1, target: 'enemy',
    v: { dmg: 6 }, up: { dmg: 3 }, art: 'scythe',
    text: 'Deal {dmg} damage.',
    play(g, v, t) { g.attack(t, v.dmg); },
  },
  {
    id: 'defend_cantor', name: 'Defend', hero: H, type: 'skill', rarity: 'starter', cost: 1, target: 'none',
    v: { blk: 5 }, up: { blk: 3 }, art: 'cloak',
    text: 'Gain {blk} Block.',
    play(g, v) { g.block(v.blk); },
  },
  {
    id: 'call_the_wisp', name: 'Call the Wisp', hero: H, type: 'skill', rarity: 'starter', cost: 1, upCost: 0, target: 'none',
    art: 'wisp',
    text: 'Channel 1 Wisp.',
    play(g) { g.channel('wisp'); },
  },
  {
    id: 'requiem', name: 'Requiem', hero: H, type: 'skill', rarity: 'starter', cost: 1, upCost: 0, target: 'none',
    art: 'bell',
    text: 'Release your oldest Spirit twice.',
    play(g) { releaseOldest(g, 2); },
  },

  // ============================================================ common — attacks
  {
    id: 'corpse_light_cantor', name: 'Corpse Light', hero: H, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 7 }, up: { dmg: 3 }, art: 'wisp', tier: 0,
    text: 'Deal {dmg} damage. Channel 1 Wisp.',
    play(g, v, t) { g.attack(t, v.dmg); g.channel('wisp'); },
  },
  {
    id: 'lychgate_cantor', name: 'Lychgate', hero: H, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 6 }, up: { dmg: 3 }, art: 'key', tier: 0,
    text: 'Deal {dmg} damage. Channel 1 Warden.',
    play(g, v, t) { g.attack(t, v.dmg); g.channel('warden'); },
  },
  {
    id: 'keening_cantor', name: 'Keening', hero: H, type: 'attack', rarity: 'common', cost: 1, target: 'none',
    v: { dmg: 4 }, up: { dmg: 3 }, art: 'raven', tier: 0,
    text: 'Deal {dmg} damage to ALL enemies. Channel 1 Banshee.',
    play(g, v) { g.attackAll(v.dmg); g.channel('banshee'); },
  },
  {
    id: 'toll_cantor', name: 'Toll', hero: H, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 5 }, up: { dmg: 3 }, art: 'bell', tier: 0,
    text: 'Release your oldest Spirit. Deal {dmg} damage.',
    play(g, v, t) { releaseOldest(g, 1); if (live(g)) g.attack(t, v.dmg); },
  },
  {
    id: 'unseen_choir_cantor', name: 'Unseen Choir', hero: H, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 4 }, up: { dmg: 2 }, art: 'ghost', tier: 0,
    text: 'Deal {dmg} damage once for each Spirit you have.',
    play(g, v, t) { g.attack(t, v.dmg, g.cb.spirits.length); },
  },
  {
    id: 'blood_psalm_cantor', name: 'Blood Psalm', hero: H, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { bleed: 2, dmg: 12 }, up: { dmg: 4 }, art: 'blood', tier: 0, ...BLEED_GUARD,
    text: 'Bleed {bleed}. Deal {dmg} damage.',
    play(g, v, t) { bleed(g, v.bleed); if (live(g)) g.attack(t, v.dmg); },
  },
  {
    id: 'wergild_cantor', name: 'Wergild', hero: H, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 6, per: 2 }, up: { dmg: 2, per: 1 }, art: 'coin', tier: 0,
    text: 'Deal {dmg} damage, plus {per} for each HP you lost this turn.',
    play(g, v, t) { g.attack(t, v.dmg + v.per * (g.cnt.hpLost || 0)); },
  },
  {
    id: 'last_rites_cantor', name: 'Last Rites', hero: H, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 8, n: 2 }, up: { dmg: 3 }, art: 'skull', tier: 0,
    text: 'Deal {dmg} damage. If this kills the enemy, Channel {n} Wisps.',
    play(g, v, t) {
      g.attack(t, v.dmg);
      if (t.dead && !t.fled) channelN(g, 'wisp', v.n);
    },
  },

  // ============================================================ common — skills
  {
    id: 'vigil_cantor', name: 'Vigil', hero: H, type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { n: 1 }, up: { n: 1 }, art: 'candle', tier: 0,
    text: 'Channel 1 Wisp. Draw 1 card.', upText: 'Channel 1 Wisp. Draw 2 cards.',
    play(g, v) { g.channel('wisp'); g.draw(v.n); },
  },
  {
    id: 'penance_cantor', name: 'Penance', hero: H, type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { bleed: 2, blk: 9 }, up: { blk: 3 }, art: 'chain', tier: 0, ...BLEED_GUARD,
    text: 'Bleed {bleed}. Gain {blk} Block. Draw 1 card.',
    play(g, v) { bleed(g, v.bleed); if (!live(g)) return; g.block(v.blk); g.draw(1); },
  },
  {
    id: 'lancet_cantor', name: 'Lancet', hero: H, type: 'skill', rarity: 'common', cost: 0, target: 'none',
    v: { bleed: 1, n: 2 }, up: { n: 1 }, art: 'knife', tier: 0, ...BLEED_GUARD,
    text: 'Bleed {bleed}. Draw {n} cards.',
    play(g, v) { bleed(g, v.bleed); if (live(g)) g.draw(v.n); },
  },
  {
    id: 'winding_sheet_cantor', name: 'Winding Sheet', hero: H, type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 7 }, up: { blk: 3 }, art: 'web', tier: 0,
    text: 'Gain {blk} Block. Exhaust a card from your hand.',
    async play(g, v) {
      g.block(v.blk);
      const [c] = await g.choose({ from: 'hand', count: 1, title: 'Bury a card (Exhaust)' });
      if (c) g.exhaustCard(c);
    },
  },
  {
    id: 'revenant_cantor', name: 'Revenant', hero: H, type: 'skill', rarity: 'common', cost: 1, upCost: 0, target: 'none',
    art: 'swirl', tier: 0,
    text: 'Release your oldest Spirit, then Channel it again.',
    play(g) { const k = releaseOldest(g, 1); if (k && live(g)) g.channel(k); },
  },
  {
    id: 'fresh_grave_cantor', name: 'Fresh Grave', hero: H, type: 'skill', rarity: 'common', cost: 1, upCost: 0, target: 'none',
    kw: ['exhaust'], art: 'grave', tier: 0,
    text: 'Gain 1 Spirit slot. Channel 1 Warden.',
    play(g) { g.addSlots(1); g.channel('warden'); },
  },
  {
    id: 'sanctuary_cantor', name: 'Sanctuary', hero: H, type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 6, n: 2 }, up: { blk: 2, n: 1 }, kw: ['retain'], art: 'shield', tier: 0,
    text: 'Gain {blk} Block. When Retained, increase its Block by {n}.',
    play(g, v) { g.block(v.blk); },
    onRetain(g, c) { grow(c, 'blk', g.cardVals(c).n); },
  },
  {
    id: 'hear_confession_cantor', name: 'Hear Confession', hero: H, type: 'skill', rarity: 'common', cost: 1, target: 'enemy',
    v: { n: 1 }, up: { n: 1 }, art: 'scroll', tier: 0,
    text: 'Apply {n} Weakened and {n} Exposed. Draw 1 card.',
    play(g, v, t) { g.apply(t, 'weak', v.n); g.apply(t, 'exposed', v.n); g.draw(1); },
  },
  {
    id: 'mourning_veil_cantor', name: 'Mourning Veil', hero: H, type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 5 }, up: { blk: 3 }, art: 'moth', tier: 1,
    text: 'Gain {blk} Block. Channel 1 Banshee.',
    play(g, v) { g.block(v.blk); g.channel('banshee'); },
  },
  {
    id: 'commit_to_the_earth_cantor', name: 'Commit to the Earth', hero: H, type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { n: 2 }, up: { n: 1 }, art: 'bone', tier: 2,
    text: 'Exhaust up to {n} cards from your hand. Channel 1 Warden for each.',
    async play(g, v) {
      const cs = await g.choose({ from: 'hand', count: v.n, min: 0, title: `Bury up to ${v.n} cards (Exhaust)` });
      for (const c of cs) { g.exhaustCard(c); if (live(g)) g.channel('warden'); }
    },
  },

  // ============================================================ uncommon — attacks
  {
    id: 'passing_bell_cantor', name: 'Passing Bell', hero: H, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 6, n: 3 }, up: { dmg: 3, n: 1 }, kw: ['retain'], art: 'bell', tier: 0,
    text: 'Deal {dmg} damage. When Retained, increase its damage by {n}.',
    play(g, v, t) { g.attack(t, v.dmg); },
    onRetain(g, c) { grow(c, 'dmg', g.cardVals(c).n); },
  },
  {
    id: 'scourge_cantor', name: 'Scourge', hero: H, type: 'attack', rarity: 'uncommon', cost: 1, target: 'none',
    v: { bleed: 3, dmg: 10 }, up: { dmg: 4 }, art: 'thorn', tier: 0, ...BLEED_GUARD,
    text: 'Bleed {bleed}. Deal {dmg} damage to ALL enemies.',
    play(g, v) { bleed(g, v.bleed); if (live(g)) g.attackAll(v.dmg); },
  },
  {
    id: 'gather_the_fallen_cantor', name: 'Gather the Fallen', hero: H, type: 'attack', rarity: 'uncommon', cost: 1, target: 'none',
    v: { dmg: 6 }, up: { dmg: 3 }, art: 'wing', tier: 0,
    text: 'Deal {dmg} damage to ALL enemies. Channel 1 Wisp for each enemy slain.',
    play(g, v) {
      const alive = g.enemies;
      g.attackAll(v.dmg);
      channelN(g, 'wisp', alive.filter((e) => e.dead && !e.fled).length);
    },
  },
  {
    id: 'fetch_cantor', name: 'Fetch', hero: H, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 6 }, up: { dmg: 3 }, art: 'mirror', tier: 1,
    text: 'Deal {dmg} damage. Channel a copy of your newest Spirit.',
    play(g, v, t) {
      g.attack(t, v.dmg);
      const sp = g.cb.spirits;
      if (sp.length && live(g)) g.channel(sp[sp.length - 1]);
    },
  },
  {
    id: 'memento_mori_cantor', name: 'Memento Mori', hero: H, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 6, per: 2 }, up: { dmg: 3 }, art: 'hourglass', tier: 2,
    text: 'Deal {dmg} damage, plus {per} for each card in your Exhaust pile.',
    play(g, v, t) { g.attack(t, v.dmg + v.per * g.cb.exhaust.length); },
  },
  {
    id: 'epitaph_cantor', name: 'Epitaph', hero: H, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 12, n: 3 }, up: { n: 2 }, kw: ['exhaust'], art: 'rune', tier: 3,
    text: 'Deal {dmg} damage. If this kills the enemy, permanently increase its damage by {n}.',
    play(g, v, t, card) {
      g.attack(t, v.dmg);
      if (!t.dead || t.fled) return;
      grow(card, 'dmg', v.n);
      const dc = card.deckUid != null && g.run.deck.find((c) => c.uid === card.deckUid);
      if (dc) grow(dc, 'dmg', v.n);
    },
  },
  {
    id: 'antiphon_cantor', name: 'Antiphon', hero: H, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 7, per: 3 }, up: { dmg: 3 }, art: 'book', tier: 4,
    text: 'Deal {dmg} damage, plus {per} for each Power you played this combat.',
    play(g, v, t) { g.attack(t, v.dmg + v.per * (g.tot.powers || 0)); },
  },

  // ============================================================ uncommon — skills
  {
    id: 'libation_cantor', name: 'Libation', hero: H, type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
    v: { bleed: 2 }, up: { bleed: -1 }, art: 'flask', tier: 0, ...BLEED_GUARD,
    text: 'Bleed {bleed}. Channel 2 Wisps.',
    play(g, v) { bleed(g, v.bleed); channelN(g, 'wisp', 2); },
  },
  {
    id: 'ossuary_cantor', name: 'Ossuary', hero: H, type: 'skill', rarity: 'uncommon', cost: 2, target: 'none',
    v: { blk: 7 }, up: { blk: 3 }, art: 'skull', tier: 0,
    text: 'Gain {blk} Block. Channel 2 Wardens.',
    play(g, v) { g.block(v.blk); channelN(g, 'warden', 2); },
  },
  {
    id: 'lux_aeterna_cantor', name: 'Lux Aeterna', hero: H, type: 'skill', rarity: 'uncommon', cost: 2, upCost: 1, target: 'none',
    art: 'lantern', tier: 0,
    text: 'Channel 1 Lantern.',
    play(g) { g.channel('lantern'); },
  },
  {
    id: 'procession_cantor', name: 'Procession', hero: H, type: 'skill', rarity: 'uncommon', cost: 'X', target: 'none',
    v: { plus: 0 }, up: { plus: 1 }, kw: ['exhaust'], art: 'banner', tier: 0,
    text: 'Channel X Wisps.', upText: 'Channel X+1 Wisps.',
    play(g, v) { channelN(g, 'wisp', v.x + v.plus); },
  },
  {
    id: 'open_vein_cantor', name: 'Open Vein', hero: H, type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
    v: { bleed: 3, e: 2 }, up: { e: 1 }, art: 'dagger', tier: 0, ...BLEED_GUARD,
    text: 'Bleed {bleed}. Gain {e} Energy.',
    play(g, v) { bleed(g, v.bleed); if (live(g)) g.gainEnergy(v.e); },
  },
  {
    id: 'nunc_dimittis_cantor', name: 'Nunc Dimittis', hero: H, type: 'skill', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none',
    art: 'moon', tier: 0,
    text: 'Release ALL your Spirits. Draw 1 card for each.',
    play(g) {
      const n = g.cb.spirits.length;
      g.releaseAll();
      if (live(g)) g.draw(n);
    },
  },
  {
    id: 'absolution_cantor', name: 'Absolution', hero: H, type: 'skill', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none',
    kw: ['exhaust'], art: 'feather', tier: 1,
    text: 'Heal HP equal to the HP you lost this turn.',
    play(g) { g.healPlayer(g.cnt.hpLost || 0); },
  },
  {
    id: 'blood_tithe_cantor', name: 'Blood Tithe', hero: H, type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
    v: { bleed: 3, n: 1 }, up: { bleed: -1 }, kw: ['exhaust'], art: 'drop', tier: 2, ...BLEED_GUARD,
    text: 'Bleed {bleed}. Gain {n} Soul.',
    play(g, v) { bleed(g, v.bleed); if (live(g)) g.applySelf('soul', v.n); },
  },

  // ============================================================ uncommon — powers
  {
    id: 'communion_cantor', name: 'Communion', hero: H, type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
    v: { n: 1 }, up: { n: 1 }, art: 'sun', tier: 0,
    text: 'Gain {n} Soul.',
    play(g, v) { g.applySelf('soul', v.n); },
  },
  {
    id: 'consecrated_ground_cantor', name: 'Consecrated Ground', hero: H, type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
    v: { n: 2 }, up: { n: 1 }, art: 'sigil', tier: 0,
    text: 'Gain {n} Spirit slots.',
    play(g, v) { g.addSlots(v.n); },
  },
  {
    id: 'gradual_cantor', name: 'Gradual', hero: H, type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
    v: { n: 2 }, up: { n: 1 }, art: 'star', tier: 1,
    text: 'At the end of your turn, gain {n} Block. This grows by 1 each turn.',
    play(g, v) { g.applySelf('cantor_gradual', v.n); },
  },
  {
    id: 'stigmata_cantor', name: 'Stigmata', hero: H, type: 'power', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none',
    art: 'hand', tier: 3,
    text: 'Whenever you lose HP during your turn, Channel 1 Wisp.',
    play(g) { g.applySelf('cantor_stigmata', 1); },
  },
  {
    id: 'burial_rites_cantor', name: 'Burial Rites', hero: H, type: 'power', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none',
    art: 'tree', tier: 4,
    text: 'Whenever you Exhaust a card, Channel 1 Warden.',
    play(g) { g.applySelf('cantor_burial', 1); },
  },

  // ============================================================ rare — attacks
  {
    id: 'the_harrowing_cantor', name: 'The Harrowing', hero: H, type: 'attack', rarity: 'rare', cost: 3, target: 'none',
    v: { dmg: 4 }, up: { dmg: 1 }, art: 'spark', tier: 0,
    text: 'Deal {dmg} damage to a random enemy for each Spirit you Channeled this combat.',
    play(g, v) { g.attackRandom(v.dmg, g.tot.channeled || 0); },
  },
  {
    id: 'lacrimosa_cantor', name: 'Lacrimosa', hero: H, type: 'attack', rarity: 'rare', cost: 2, target: 'none',
    v: { dmg: 5 }, up: { dmg: 2 }, kw: ['exhaust'], art: 'eye', tier: 0,
    text: 'Deal {dmg} damage to ALL enemies. Heal HP equal to the unblocked damage.',
    play(g, v) { const dealt = g.attackAll(v.dmg); if (dealt > 0) g.healPlayer(dealt); },
  },
  {
    id: 'dies_irae_cantor', name: 'Dies Irae', hero: H, type: 'attack', rarity: 'rare', cost: 2, target: 'none',
    v: { dmg: 10 }, up: { dmg: 4 }, art: 'flame', tier: 3,
    text: 'Release ALL your Spirits. Deal {dmg} damage to ALL enemies.',
    play(g, v) { g.releaseAll(); if (live(g)) g.attackAll(v.dmg); },
  },
  {
    id: 'misericorde_cantor', name: 'Misericorde', hero: H, type: 'attack', rarity: 'rare', cost: 1, target: 'enemy',
    v: { dmg: 7, n: 20 }, up: { dmg: 2, n: 8 }, art: 'dagger', tier: 5,
    text: 'Deal {dmg} damage. Then, if the enemy has {n} HP or less, it dies.',
    play(g, v, t) {
      g.attack(t, v.dmg);
      if (!t.dead && live(g) && t.hp <= v.n) g.loseHp(t, t.hp, { type: 'hploss' });
    },
  },

  // ============================================================ rare — skills
  {
    id: 'offertory_cantor', name: 'Offertory', hero: H, type: 'skill', rarity: 'rare', cost: 0, target: 'none',
    v: { bleed: 6, e: 2, n: 3 }, up: { n: 2 }, kw: ['exhaust'], art: 'heart', tier: 0, ...BLEED_GUARD,
    text: 'Bleed {bleed}. Gain {e} Energy. Draw {n} cards.',
    play(g, v) { bleed(g, v.bleed); if (!live(g)) return; g.gainEnergy(v.e); g.draw(v.n); },
  },
  {
    id: 'all_souls_night_cantor', name: 'All Souls\' Night', hero: H, type: 'skill', rarity: 'rare', cost: 3, upCost: 2, target: 'none',
    kw: ['exhaust'], art: 'candle', tier: 0,
    text: 'Gain 1 Spirit slot. Channel 1 Wisp, Warden, Banshee and Lantern.',
    play(g) {
      g.addSlots(1);
      for (const k of ['wisp', 'warden', 'banshee', 'lantern']) if (live(g)) g.channel(k);
    },
  },
  {
    id: 'unspent_cantor', name: 'Unspent', hero: H, type: 'skill', rarity: 'rare', cost: 2, upCost: 1, target: 'none',
    kw: ['ethereal', 'exhaust'], art: 'ghost', tier: 4,
    text: 'Gain 1 Phantasm: until your next turn, all damage and HP loss you take is reduced to 1.',
    play(g) { g.applySelf('phantasm', 1); },
  },

  // ============================================================ rare — powers
  {
    id: 'kyrie_eleison_cantor', name: 'Kyrie Eleison', hero: H, type: 'power', rarity: 'rare', cost: 3, upCost: 2, target: 'none',
    art: 'prayer', tier: 0,
    text: 'At the start of your turn, gain 1 Soul.',
    play(g) { g.applySelf('cantor_kyrie', 1); },
  },
  {
    id: 'tuba_mirum_cantor', name: 'Tuba Mirum', hero: H, type: 'power', rarity: 'rare', cost: 2, target: 'none',
    v: { n: 3 }, up: { n: 2 }, art: 'crown', tier: 5,
    text: 'At the end of your turn, deal {n} damage to ALL enemies. This grows by 1 each turn.',
    play(g, v) { g.applySelf('cantor_tuba', v.n); },
  },
  {
    id: 'psychopomp_cantor', name: 'Psychopomp', hero: H, type: 'power', rarity: 'rare', cost: 1, target: 'none',
    v: { n: 3 }, up: { n: 1 }, art: 'owl', tier: 5,
    text: 'Whenever you Release a Spirit or an enemy dies, deal {n} damage to a random enemy.',
    play(g, v) { g.applySelf('cantor_psychopomp', v.n); },
  },
]);

// ---------------------------------------------------------------- relics
defineRelics([
  {
    id: 'bone_rosary', name: 'Bone Rosary', rarity: 'starter', hero: H, icon: 'rosary', tint: '#d8cfb8',
    desc: 'At the start of each combat, Channel 1 Wisp.',
    flavor: 'The beads are cold to the touch. So are his fingers. He has stopped noticing.',
    combatStart(g) { g.channel('wisp'); },
  },
  {
    id: 'knotted_cord', name: 'Knotted Cord', rarity: 'common', hero: H, icon: 'rope', tint: '#8a7356',
    desc: 'Whenever you Bleed, gain 3 Block.',
    flavor: 'Three knots: poverty, chastity, obedience. He tied a fourth on Ashfall night, and cannot recall the vow.',
    hpLost(g, r, e, n, opts) {
      if (e && e.isPlayer && opts && opts.bleed && live(g) && g.player.hp > 0) g.gainBlock(g.player, 3, { raw: true });
    },
  },
  {
    id: 'confessors_stole', name: 'Confessor\'s Stole', rarity: 'common', hero: H, icon: 'cloak', tint: '#6b3a6e',
    desc: 'At the start of each combat, gain 1 Soul.',
    flavor: 'Violet, for penance. He wore it to the king\'s bedside, and has not taken it off since.',
    combatStart(g) { g.applySelf('soul', 1); },
  },
  {
    id: 'lych_bell', name: 'Lych Bell', rarity: 'uncommon', hero: H, icon: 'bell', tint: '#b08d57',
    desc: 'Whenever an enemy dies, Channel 1 Wisp.',
    flavor: 'Rung before a coffin so the living step aside. In Morrow it has hung silent for a hundred years.',
    enemyDied(g) { if (live(g) && g.enemies.length) g.channel('wisp'); },
  },
  {
    id: 'stained_hymnal', name: 'Water-Stained Hymnal', rarity: 'uncommon', hero: H, icon: 'book', tint: '#5d6b5a',
    desc: 'Whenever you play a Power, Channel 1 Warden.',
    flavor: 'Fished from the abbey mere. Where the water took the words he sings anyway, and something sings back.',
    cardPlayed(g, r, card) { if (live(g) && g.cardDef(card).type === 'power') g.channel('warden'); },
  },
  {
    id: 'martyrs_chalice', name: 'Martyr\'s Chalice', rarity: 'rare', hero: H, icon: 'chalice', tint: '#9b2f2f',
    desc: 'If you lost HP last round, your Spirits trigger their passives at the start of your turn.',
    flavor: 'He fills it at every Mass. He cannot remember the last time he drank.',
    turnStart(g) {
      if (!g.cb || !(g.cnt.prevHpLost > 0)) return;
      for (const k of [...g.cb.spirits]) {
        if (!live(g)) break;
        SPIRITS[k].passive(g, soul(g));
        g.emit('spiritPulse', { kind: k });
      }
    },
  },
  {
    id: 'coffin_nail', name: 'Coffin Nail', rarity: 'boss', hero: H, icon: 'nail', tint: '#6f6a64',
    desc: 'Gain 1 Energy at the start of each turn. You have 1 fewer Spirit slot.',
    flavor: 'Driven into a lid so the dead stay put. He held it a long while before he could say why it frightened him.',
    maxEnergy: () => 1,
    combatStart(g) { g.addSlots(-1); },
  },
]);

// ---------------------------------------------------------------- tinctures
definePotions([
  {
    id: 'tincture_of_souls', name: 'Tincture of Souls', rarity: 'uncommon', hero: H, target: 'none',
    icon: 'vial', color: '#9fc4d8',
    desc: 'Gain 2 Soul.',
    async use(g, t, mul) { g.applySelf('soul', 2 * mul); },
  },
  {
    id: 'phial_of_grave_light', name: 'Phial of Grave-Light', rarity: 'common', hero: H, target: 'none',
    icon: 'flask_round', color: '#c9d27a',
    desc: 'Channel 3 Wisps.',
    async use(g, t, mul) { channelN(g, 'wisp', 3 * mul); },
  },
]);
