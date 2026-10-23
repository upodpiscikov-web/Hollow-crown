// Tests for the per-act pacing knobs in src/engine/pace.js (hp / dmg, with elite and boss variants).
//   node tools/pace-test.mjs
import '../src/engine/statuses.js';
import { defineCards, defineEnemies, defineHeroes, defineRelics } from '../src/engine/registry.js';
import { Game, freshMeta } from '../src/engine/game.js';
import { PACE, paceOf } from '../src/engine/pace.js';

defineHeroes([{ id: 'p_hero', special: { name: 'S', target: 'none', desc: '', use() {} }, name: 'P', hp: 80, gold: 0, deck: ['p_strike'], relic: 'p_relic' }]);
defineRelics([{ id: 'p_relic', name: 'P', rarity: 'starter', desc: '' }]);
defineCards([{ id: 'p_strike', name: 'S', hero: 'p_hero', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', v: { dmg: 6 }, text: '', play(g, v, t) { g.attack(t, v.dmg); } }]);
const mk = (kind) => ({ id: 'p_' + kind, name: kind, kind, hp: 100, moves: { hit: { intent: 'atk', dmg: 10 }, multi: { intent: 'atk', dmg: 3, times: 2 }, none: { intent: 'buff', fx() {} } }, ai: () => 'hit' });
defineEnemies([mk('normal'), mk('elite'), mk('boss')]);

let fails = 0, passes = 0;
const eq = (a, b, msg) => { if (a === b) passes++; else { fails++; console.log(`FAIL ${msg}: expected ${b}, got ${a}`); } };

const saved = JSON.stringify(PACE);
function game(act) {
  const g = new Game(); g.meta = freshMeta(); g.newRun('p_hero', 0, 7); g.run.act = act; return g;
}

// --- a missing act falls back to the defaults; partial entries are merged over them
eq(paceOf(9).hp, 1, 'default hp'); eq(paceOf(9).dmg, 1, 'default dmg'); eq(paceOf(9).floors, 15, 'default floors');
PACE[2] = { hp: 0.5, dmg: 2 };
eq(paceOf(2).floors, 15, 'partial entry keeps default floors'); eq(paceOf(2).hpBoss, 1, 'partial entry keeps default hpBoss');

// --- HP multipliers: hp for everyone, hpElite / hpBoss on top
PACE[2] = { hp: 0.5, hpElite: 0.8, hpBoss: 2 };
{
  const g = game(2);
  eq(g.makeEnemy('p_normal').maxHp, 50, 'normal hp = 100 * 0.5');
  eq(g.makeEnemy('p_elite').maxHp, 40, 'elite hp = 100 * 0.5 * 0.8');
  eq(g.makeEnemy('p_boss').maxHp, 100, 'boss hp = 100 * 0.5 * 2');
  eq(g.makeEnemy('p_boss', { hp: 7 }).maxHp, 7, 'explicit minion hp is never scaled');
}

// --- damage multipliers: dmg for everyone, dmgElite / dmgBoss on top; applies per hit, rounds, never below 1
PACE[2] = { dmg: 1.5, dmgElite: 2, dmgBoss: 0.5 };
{
  const g = game(2);
  const n = g.makeEnemy('p_normal'), el = g.makeEnemy('p_elite'), b = g.makeEnemy('p_boss');
  eq(g.moveDmg(n, mk('normal').moves.hit), 15, 'normal dmg x1.5');
  eq(g.moveDmg(el, mk('elite').moves.hit), 30, 'elite dmg x1.5 x2');
  eq(g.moveDmg(b, mk('boss').moves.hit), 8, 'boss dmg x1.5 x0.5 (7.5 rounds to 8)');
  eq(g.moveDmg(b, mk('boss').moves.multi), 2, 'multi-hit damage is per hit: round(3 * 0.75)');
  eq(g.moveDmg(n, mk('normal').moves.none), null, 'non-attacks stay null');
  eq(g.intentOf(Object.assign(n, { move: 'hit' })).dmg, 15, 'the intent shows the scaled damage');
}
PACE[2] = { dmg: 0.1 };
eq(game(2).moveDmg(game(2).makeEnemy('p_normal'), mk('normal').moves.hit), 1, 'a hit never rounds down to 0');

// --- act 1 default knobs are the ones documented in BALANCE_NOTES.md
Object.assign(PACE, JSON.parse(saved));
eq(paceOf(1).floors, 15, 'act 1 has the full 15 floors again'); eq(paceOf(1).paths, 6, 'act 1 has 6 routes');
eq(paceOf(1).dmg, 1, 'act 1 damage is tuned in enemies/act1.js, not by a multiplier');

Object.assign(PACE, JSON.parse(saved));
console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
