// Core status effects. Hero/content files may define more via defineStatuses().
//
// Status shape:
// { id, name, kind:'buff'|'debuff'|'oath', icon, desc(n, g, owner),
//   decay: 'ownerTurnEnd' | 'ownerTurnStart' | undefined  (amount -1 each time),
//   negOk: true if negative amounts are meaningful (Might, Guard),
//   hooks: turnStart, turnEnd (owner's own turn only),
//          atkAdd(g,o,n,ctx)->number, atkMul(g,o,n,ctx)->mult, takeMul(g,o,n,ctx)->mult,
//          blockAdd(g,o,n)->number, blockMul(g,o,n)->mult,
//          onAttacked(g,o,n,src,dmg), hpLost(g,o,n,amount), and any trigger() event
//          name (cardPlayed, cardExhausted, enemyDied, shift, channel ...) }

import { defineStatuses } from './registry.js';

defineStatuses([
  {
    id: 'might', name: 'Might', kind: 'buff', icon: 'might', negOk: true,
    desc: (n) => n >= 0 ? `Attacks deal ${n} more damage.` : `Attacks deal ${-n} less damage.`,
    atkAdd: (g, o, n) => n,
  },
  {
    id: 'guard', name: 'Guard', kind: 'buff', icon: 'guard', negOk: true,
    desc: (n) => n >= 0 ? `Gain ${n} more Block from cards.` : `Gain ${-n} less Block from cards.`,
    blockAdd: (g, o, n) => n,
  },
  {
    id: 'exposed', name: 'Exposed', kind: 'debuff', icon: 'exposed', decay: 'ownerTurnEnd',
    desc: (n, g, o) => `Takes ${Math.round((g ? g.exposedMul(o) - 1 : 0.5) * 100)}% more damage from attacks for ${n} turn${n > 1 ? 's' : ''}.`,
    takeMul: (g, o) => g.exposedMul(o),
  },
  {
    id: 'weak', name: 'Weakened', kind: 'debuff', icon: 'weak', decay: 'ownerTurnEnd',
    desc: (n) => `Deals 25% less attack damage for ${n} turn${n > 1 ? 's' : ''}.`,
    atkMul: (g, o) => g.weakMul(o),
  },
  {
    id: 'frail', name: 'Frail', kind: 'debuff', icon: 'frail', decay: 'ownerTurnEnd',
    desc: (n) => `Gains 25% less Block from cards for ${n} turn${n > 1 ? 's' : ''}.`,
    blockMul: () => 0.75,
  },
  {
    id: 'rot', name: 'Rot', kind: 'debuff', icon: 'rot',
    desc: (n) => `At the start of its turn, loses ${n} HP, then Rot decreases by 1.`,
    turnStart(g, o, n) {
      g.emit('rot', { e: o, n });
      g.loseHp(o, n, { type: 'rot' });
      g.addStatus(o, 'rot', -1, { silent: true });
    },
  },
  {
    id: 'ward', name: 'Ward', kind: 'buff', icon: 'ward',
    desc: (n) => `Negates the next ${n} debuff${n > 1 ? 's' : ''}.`,
  },
  {
    id: 'thorns', name: 'Thorns', kind: 'buff', icon: 'thorns',
    desc: (n) => `When attacked, deals ${n} damage back.`,
    onAttacked(g, o, n, src) {
      if (src && src !== o && !src.dead) g.damage(src, n, { type: 'thorns', src: o });
    },
  },
  {
    id: 'plating', name: 'Plating', kind: 'buff', icon: 'plating',
    desc: (n) => `At the end of its turn, gains ${n} Block.`,
    turnEnd(g, o, n) { g.gainBlock(o, n, { raw: true }); },
  },
  {
    id: 'mending', name: 'Mending', kind: 'buff', icon: 'mending',
    desc: (n) => `At the end of its turn, heals ${n} HP, then Mending decreases by 1.`,
    turnEnd(g, o, n) { g.heal(o, n); g.addStatus(o, 'mending', -1, { silent: true }); },
  },
  {
    id: 'rite', name: 'Rite', kind: 'buff', icon: 'rite',
    desc: (n) => `At the end of its turn, gains ${n} Might.`,
    turnEnd(g, o, n) { g.apply(o, 'might', n, o); },
  },
  {
    id: 'bulwark', name: 'Bulwark', kind: 'buff', icon: 'bulwark', decay: 'ownerTurnStartAfter',
    desc: (n) => `Block is not removed at the start of the next ${n} turn${n > 1 ? 's' : ''}.`,
  },
  {
    id: 'barricade', name: 'Iron Discipline', kind: 'buff', icon: 'bulwark',
    desc: () => `Block is never removed at the start of turn.`,
  },
  {
    id: 'soul', name: 'Soul', kind: 'buff', icon: 'soul', negOk: true,
    desc: (n) => `Spirits' effects are ${n >= 0 ? 'increased' : 'decreased'} by ${Math.abs(n)}.`,
  },
  {
    id: 'vigor', name: 'Vigor', kind: 'buff', icon: 'vigor',
    desc: (n) => `Your next Attack deals ${n} more damage.`,
    atkAdd: (g, o, n, ctx) => (ctx && ctx.card ? n : 0),
  },
  {
    id: 'shackled', name: 'Shackled', kind: 'debuff', icon: 'shackled',
    desc: (n) => `Regains ${n} Might at the end of its turn.`,
    turnEnd(g, o, n) {
      g.addStatus(o, 'might', n, { silent: true });
      g.removeStatus(o, 'shackled');
    },
  },
  {
    id: 'dread', name: 'Dread', kind: 'debuff', icon: 'dread',
    desc: (n) => `Draw ${n} fewer card${n > 1 ? 's' : ''} next turn.`,
  },
  {
    id: 'burning', name: 'Ash-Burn', kind: 'debuff', icon: 'burning',
    desc: (n) => `At the end of its turn, takes ${n} damage.`,
    turnEnd(g, o, n) { g.damage(o, n, { type: 'burn' }); },
  },
  {
    id: 'phantasm', name: 'Phantasm', kind: 'buff', icon: 'phantasm', decay: 'ownerTurnEnd',
    desc: (n) => `All damage and HP loss is reduced to 1 for ${n} turn${n > 1 ? 's' : ''}.`,
  },
  {
    id: 'draw_up', name: 'Insight', kind: 'buff', icon: 'insight',
    desc: (n) => `Draw ${n} more card${n > 1 ? 's' : ''} at the start of each turn.`,
  },
  {
    id: 'energy_up', name: 'Zeal', kind: 'buff', icon: 'zeal',
    desc: (n) => `Gain ${n} more Energy at the start of each turn.`,
  },
  {
    id: 'next_energy', name: 'Kindling', kind: 'buff', icon: 'zeal',
    desc: (n) => `Gain ${n} Energy next turn.`,
  },
  {
    id: 'next_draw', name: 'Foresight', kind: 'buff', icon: 'insight',
    desc: (n) => `Draw ${n} additional card${n > 1 ? 's' : ''} next turn.`,
  },
  {
    id: 'next_block', name: 'Bracing', kind: 'buff', icon: 'guard',
    desc: (n) => `Gain ${n} Block next turn.`,
  },
  // Enemy-flavoured statuses shared across acts.
  {
    id: 'enrage', name: 'Enrage', kind: 'buff', icon: 'enrage',
    desc: (n) => `Whenever you play a Skill, gains ${n} Might.`,
    cardPlayed(g, o, n, card) {
      if (!o.isPlayer && !o.dead && g.cardDef(card).type === 'skill') g.apply(o, 'might', n, o);
    },
  },
  {
    id: 'curl', name: 'Curl Up', kind: 'buff', icon: 'guard',
    desc: (n) => `The first time it takes attack damage, gains ${n} Block.`,
    onAttacked(g, o, n) { if (!o.dead) { g.gainBlock(o, n, { raw: true }); g.removeStatus(o, 'curl'); } },
  },
  {
    id: 'malleable', name: 'Hardening', kind: 'buff', icon: 'plating',
    desc: (n) => `Whenever it takes attack damage, gains ${n} Block (increases each time).`,
    onAttacked(g, o, n) { if (!o.dead) { g.gainBlock(o, n, { raw: true }); g.addStatus(o, 'malleable', 1, { silent: true }); } },
  },
  {
    id: 'spite', name: 'Spite', kind: 'buff', icon: 'thorns',
    desc: (n) => `When it dies, deals ${n} damage to you.`,
    died(g, o, n) { g.damage(g.player, n, { type: 'thorns', src: o }); },
  },
  {
    id: 'split', name: 'Splitting', kind: 'buff', icon: 'split',
    desc: () => `Splits in two when brought to half HP or below.`,
  },
  {
    id: 'minion', name: 'Minion', kind: 'buff', icon: 'minion',
    desc: () => `Flees when its master dies.`,
  },
  {
    id: 'regrowth', name: 'Regrowth', kind: 'buff', icon: 'mending',
    desc: (n) => `At the end of its turn, heals ${n} HP.`,
    turnEnd(g, o, n) { g.heal(o, n); },
  },
  {
    id: 'strangle', name: 'Thornbind', kind: 'debuff', icon: 'thorns',
    desc: (n) => `Whenever you play a card this turn, lose ${n} HP.`,
    cardPlayed(g, o, n) { if (o.isPlayer) g.loseHp(o, n, { type: 'hploss' }); },
    turnEnd(g, o) { g.removeStatus(o, 'strangle'); },
  },
  {
    id: 'no_draw', name: 'Bound', kind: 'debuff', icon: 'shackled',
    desc: () => `You cannot draw additional cards this turn.`,
    turnEnd(g, o) { g.removeStatus(o, 'no_draw'); },
  },
  {
    id: 'hex', name: 'Hex', kind: 'debuff', icon: 'dread',
    desc: (n) => `Whenever you play a non-Attack card, shuffle ${n} Daze into your draw pile.`,
    cardPlayed(g, o, n, card) {
      if (o.isPlayer && g.cardDef(card).type !== 'attack') for (let i = 0; i < n; i++) g.addCard('daze', 'draw');
    },
  },
  {
    id: 'entangled', name: 'Entangled', kind: 'debuff', icon: 'shackled',
    desc: () => `You cannot play Attacks this turn.`,
    canPlay: (g, o, n, card) => g.cardDef(card).type !== 'attack',
    turnEnd(g, o) { g.removeStatus(o, 'entangled'); },
  },
  {
    id: 'stasis_guard', name: 'Petrified', kind: 'buff', icon: 'plating',
    desc: (n) => `Takes no more than ${n} damage per hit.`,
  },
  {
    id: 'reactive', name: 'Reactive', kind: 'buff', icon: 'split',
    desc: () => `Changes its intent whenever it takes attack damage.`,
    onAttacked(g, o) { if (!o.dead) g.rollIntent(o); },
  },
  {
    id: 'invincible', name: 'Unyielding', kind: 'buff', icon: 'plating',
    desc: (n) => `Can lose at most ${n} more HP this turn.`,
  },
]);
