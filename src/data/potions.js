// Tinctures (potions), generic. Systems & balance designer.
// `mul` is 2 with the potency relic; every effect scales with it.
import { definePotions, defineStatuses } from '../engine/registry.js';

defineStatuses([
  {
    id: 'tincture_echo', name: 'Echo', kind: 'buff', icon: 'echo',
    desc: (n) => `This turn, your next ${n > 1 ? n + ' cards are' : 'card is'} played twice.`,
    extraPlays(g, o) { g.addStatus(o, 'tincture_echo', -1); return 1; },
    turnEnd(g, o) { g.removeStatus(o, 'tincture_echo'); },
  },
]);

const healAny = (g, n) => (g.cb ? g.healPlayer(n) : g.healOut(n));

definePotions([
  // ================================================================ COMMON
  {
    id: 'marrow_broth', name: 'Marrow Broth', rarity: 'common', target: 'none',
    icon: 'horn_cup', color: '#c9a77a', anytime: true,
    desc: 'Heal 20% of your Max HP. Can be drunk at any time.',
    async use(g, t, mul) { healAny(g, Math.round(g.player.maxHp * 0.2 * mul)); },
  },
  {
    id: 'ironbark_tincture', name: 'Ironbark Tincture', rarity: 'common', target: 'none',
    icon: 'flask_round', color: '#8e98a3',
    desc: 'Gain 12 Block.',
    async use(g, t, mul) { g.gainBlock(g.player, 12 * mul, { raw: true }); },
  },
  {
    id: 'ember_tincture', name: 'Ember Tincture', rarity: 'common', target: 'enemy',
    icon: 'vial', color: '#e8a33a',
    desc: 'Deal 20 damage to an enemy.',
    async use(g, t, mul) { g.damage(t, 20 * mul, { type: 'spell', src: g.player }); },
  },
  {
    id: 'blackpowder_flask', name: 'Blackpowder Flask', rarity: 'common', target: 'none',
    icon: 'flask_round', color: '#342c3b',
    desc: 'Deal 10 damage to ALL enemies.',
    async use(g, t, mul) { for (const e of g.enemies) g.damage(e, 10 * mul, { type: 'spell', src: g.player }); },
  },
  {
    id: 'nightshade_tincture', name: 'Nightshade Tincture', rarity: 'common', target: 'enemy',
    icon: 'skull_flask', color: '#7b5aa6',
    desc: 'Apply 6 Rot to an enemy.',
    async use(g, t, mul) { g.apply(t, 'rot', 6 * mul); },
  },
  {
    id: 'bulls_blood', name: 'Bull\'s Blood', rarity: 'common', target: 'none',
    icon: 'horn_cup', color: '#8a1c1c',
    desc: 'Gain 2 Might.',
    async use(g, t, mul) { g.applySelf('might', 2 * mul); },
  },
  {
    id: 'stoneskin_tincture', name: 'Stoneskin Tincture', rarity: 'common', target: 'none',
    icon: 'flask_tall', color: '#9e9a9c',
    desc: 'Gain 2 Guard.',
    async use(g, t, mul) { g.applySelf('guard', 2 * mul); },
  },
  {
    id: 'quickening_draught', name: 'Quickening Draught', rarity: 'common', target: 'none',
    icon: 'vial', color: '#f0d27a',
    desc: 'Gain 2 Energy.',
    async use(g, t, mul) { g.gainEnergy(2 * mul); },
  },

  // ================================================================ UNCOMMON
  {
    id: 'clear_eye_tincture', name: 'Clear-Eye Tincture', rarity: 'uncommon', target: 'none',
    icon: 'flask_tall', color: '#b9d3e0',
    desc: 'Draw 3 cards.',
    async use(g, t, mul) { g.draw(3 * mul); },
  },
  {
    id: 'bottled_vision', name: 'Bottled Vision', rarity: 'uncommon', target: 'none',
    icon: 'jar', color: '#b49ad6',
    desc: 'Choose 1 of 3 random cards to add to your hand. It costs 0 this turn.',
    async use(g, t, mul) {
      const c = await g.discover({ costTurn: 0, title: 'What do you see?' });
      if (c && mul > 1) g.copyCard(c, 'hand', { costTurn: 0 });
    },
  },
  {
    id: 'hallowed_water', name: 'Hallowed Water', rarity: 'uncommon', target: 'none',
    icon: 'vial', color: '#d8e8f0',
    desc: 'Gain 2 Ward.',
    async use(g, t, mul) { g.applySelf('ward', 2 * mul); },
  },
  {
    id: 'mourners_ash', name: 'Mourner\'s Ash', rarity: 'uncommon', target: 'none',
    icon: 'jar', color: '#5d5a5e',
    desc: 'Apply 2 Weakened and 2 Exposed to ALL enemies.',
    async use(g, t, mul) { g.applyAll('weak', 2 * mul); g.applyAll('exposed', 2 * mul); },
  },
  {
    id: 'briar_tonic', name: 'Briar Tonic', rarity: 'uncommon', target: 'none',
    icon: 'flask_round', color: '#3d5226',
    desc: 'Gain 4 Thorns.',
    async use(g, t, mul) { g.applySelf('thorns', 4 * mul); },
  },
  {
    id: 'liquid_memory', name: 'Liquid Memory', rarity: 'uncommon', target: 'none',
    icon: 'flask_tall', color: '#7fd1c4',
    desc: 'Return a card from your discard pile to your hand. It costs 0 this turn.',
    async use(g, t, mul) {
      const picked = await g.choose({ from: 'discard', count: mul, min: mul, title: 'Remember a card' });
      for (const c of picked) {
        if (g.hand.length >= 10) break;
        g.removeFromPiles(c);
        c.costTurn = 0;
        g.hand.push(c);
        g.emit('addCard', { card: c, where: 'hand' });
      }
    },
  },
  {
    id: 'ironwort_grog', name: 'Ironwort Grog', rarity: 'uncommon', target: 'none',
    icon: 'horn_cup', color: '#5a5f66',
    desc: 'Gain 4 Plating.',
    async use(g, t, mul) { g.applySelf('plating', 4 * mul); },
  },

  // ================================================================ RARE
  {
    id: 'unspent_breath', name: 'Unspent Breath', rarity: 'rare', target: 'none',
    icon: 'skull_flask', color: '#a9c6c2', revive: 0.3,
    desc: 'When you would die, heal to 30% of your Max HP instead. Drink it to heal 30% now.',
    async use(g, t, mul) { g.healPlayer(Math.round(g.player.maxHp * 0.3 * mul)); },
  },
  {
    id: 'ash_cult_ichor', name: 'Ash-Cult Ichor', rarity: 'rare', target: 'none',
    icon: 'skull_flask', color: '#c4501e',
    desc: 'Gain 1 Rite (gain 1 Might at the end of each of your turns).',
    async use(g, t, mul) { g.applySelf('rite', 1 * mul); },
  },
  {
    id: 'echoing_draught', name: 'Echoing Draught', rarity: 'rare', target: 'none',
    icon: 'flask_tall', color: '#7b5aa6',
    desc: 'This turn, your next card is played twice.',
    async use(g, t, mul) { g.applySelf('tincture_echo', 1 * mul); },
  },
  {
    id: 'bottled_wraith', name: 'Bottled Wraith', rarity: 'rare', target: 'none',
    icon: 'jar', color: '#a9c6c2',
    desc: 'Gain 1 Phantasm: all damage and HP loss you take is reduced to 1 until next turn.',
    async use(g, t, mul) { g.applySelf('phantasm', 1 * mul); },
  },
  {
    id: 'fools_flagon', name: 'Fool\'s Flagon', rarity: 'rare', target: 'none',
    icon: 'horn_cup', color: '#b5536b', anytime: true,
    desc: 'Fill all your empty Tincture slots with random Tinctures.',
    async use(g) {
      let guard = 0;
      while (g.run.potions.includes(null) && guard++ < 12) if (!g.obtainPotion()) break;
    },
  },
]);
