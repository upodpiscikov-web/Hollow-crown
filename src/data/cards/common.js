// Engine-required cards: statuses, the base curse, and the Witch's Draughts.
// The systems designer extends neutral cards/curses in neutral.js.
import { defineCards } from '../../engine/registry.js';

defineCards([
  // ---------------------------------------------------------------- statuses
  {
    id: 'daze', name: 'Daze', hero: 'status', type: 'status', rarity: 'special', cost: -1, target: 'none',
    kw: ['unplayable', 'ethereal'], art: 'swirl', noUp: true,
    text: 'Your thoughts swim.',
  },
  {
    id: 'wound', name: 'Wound', hero: 'status', type: 'status', rarity: 'special', cost: -1, target: 'none',
    kw: ['unplayable'], art: 'blood', noUp: true,
    text: 'It will not close.',
  },
  {
    id: 'ash', name: 'Ash', hero: 'status', type: 'status', rarity: 'special', cost: -1, target: 'none',
    kw: ['unplayable'], art: 'flame', noUp: true, v: { n: 2 },
    text: 'At the end of your turn, take {n} damage.',
    endTurnInHand(g, c) { g.damage(g.player, g.cardVals(c).n, { type: 'burn' }); },
  },
  {
    id: 'mire', name: 'Mire', hero: 'status', type: 'status', rarity: 'special', cost: 1, target: 'none',
    kw: ['exhaust'], art: 'drop', noUp: true,
    text: 'Wade free of it.',
    play() {},
  },
  // ---------------------------------------------------------------- base curse
  {
    id: 'regret', name: 'Regret', hero: 'curse', type: 'curse', rarity: 'curse', cost: -1, target: 'none',
    kw: ['unplayable'], art: 'skull', noUp: true,
    text: 'At the end of your turn, lose 1 HP for each card in your hand.',
    endTurnInHand(g) { g.loseHp(g.player, g.hand.length, { type: 'hploss' }); },
  },
  // ---------------------------------------------------------------- draughts (Witch Brew)
  {
    id: 'draught_bile', name: 'Draught of Bile', hero: 'witch', type: 'skill', rarity: 'special', cost: 0, target: 'none',
    kw: ['exhaust'], art: 'flask', v: { n: 3 }, up: { n: 2 },
    text: 'Apply {n} Rot to ALL enemies.',
    play(g, v) { g.applyAll('rot', v.n); },
  },
  {
    id: 'draught_ash', name: 'Draught of Ash', hero: 'witch', type: 'skill', rarity: 'special', cost: 0, target: 'none',
    kw: ['exhaust'], art: 'flask', v: { blk: 6 }, up: { blk: 3 },
    text: 'Gain {blk} Block.',
    play(g, v) { g.block(v.blk); },
  },
  {
    id: 'draught_ember', name: 'Draught of Ember', hero: 'witch', type: 'skill', rarity: 'special', cost: 0, target: 'none',
    kw: ['exhaust'], art: 'flask', v: { n: 6 }, up: { n: 3 },
    text: 'Deal {n} damage to a random enemy.',
    play(g, v) { const e = g.randomEnemy(); if (e) g.damage(e, v.n, { type: 'spell', src: g.player }); },
  },
  {
    id: 'draught_clarity', name: 'Draught of Clarity', hero: 'witch', type: 'skill', rarity: 'special', cost: 0, target: 'none',
    kw: ['exhaust'], art: 'flask', v: { n: 2 }, up: { n: 1 },
    text: 'Draw {n} cards.',
    play(g, v) { g.draw(v.n); },
  },
  {
    id: 'draught_marrow', name: 'Draught of Marrow', hero: 'witch', type: 'skill', rarity: 'special', cost: 0, target: 'none',
    kw: ['exhaust'], art: 'flask', v: { n: 3 }, up: { n: 2 },
    text: 'Heal {n} HP.',
    play(g, v) { g.healPlayer(v.n); },
  },
]);
