// Aldous Vane, the Disgraced Knight (BLOOD). Oaths, Might, Bulwark.
import { defineCards, defineStatuses, defineRelics } from '../../engine/registry.js';

// ---------------------------------------------------------------- oaths
// Oath statuses: amount = steps remaining. Hooks call g.oathProgress(id).
// fulfil(g, pay) runs once when the oath completes (pay is set by the card).
defineStatuses([
  {
    id: 'oath_wall', name: 'Oath of the Wall', kind: 'oath', icon: 'oath',
    desc: (n, g) => `End ${n} more turn${n > 1 ? 's' : ''} with 8 or more Block: gain ${g?.cb?.oaths.oath_wall?.pay ?? 2} Might.`,
    turnEnd(g, o) { if (o.block >= 8) g.oathProgress('oath_wall'); },
    fulfil(g, pay) { g.applySelf('might', pay); },
  },
]);

defineCards([
  {
    id: 'strike_knight', name: 'Strike', hero: 'knight', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy',
    v: { dmg: 6 }, up: { dmg: 3 }, art: 'sword',
    text: 'Deal {dmg} damage.',
    play(g, v, t) { g.attack(t, v.dmg); },
  },
  {
    id: 'defend_knight', name: 'Defend', hero: 'knight', type: 'skill', rarity: 'starter', cost: 1, target: 'none',
    v: { blk: 5 }, up: { blk: 3 }, art: 'shield',
    text: 'Gain {blk} Block.',
    play(g, v) { g.block(v.blk); },
  },
  {
    id: 'vow_of_the_wall', name: 'Vow of the Wall', hero: 'knight', type: 'skill', rarity: 'starter', cost: 1, target: 'none',
    v: { blk: 7, pay: 2 }, up: { blk: 3, pay: 1 }, art: 'oath',
    text: 'Gain {blk} Block. Oath: end 2 turns with 8+ Block. Reward: gain {pay} Might.',
    play(g, v) { g.block(v.blk); g.swear('oath_wall', 2, v.pay); },
  },
]);

defineRelics([
  {
    id: 'broken_sigil', name: 'Broken Sigil', rarity: 'starter', hero: 'knight', icon: 'sigil',
    desc: 'At the end of combat, heal 6 HP.',
    flavor: 'The King\'s Shield, cracked down the middle. He kept the pieces.',
    combatEnd(g, r, won) { if (won) g.healPlayer(6); },
  },
]);
