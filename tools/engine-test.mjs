// Engine rule tests (no content dependencies beyond test fixtures).
//   node tools/engine-test.mjs
import '../src/engine/statuses.js';
import { defineCards, defineEnemies, defineHeroes, defineRelics, CARDS } from '../src/engine/registry.js';
import { Game, freshMeta } from '../src/engine/game.js';
import { PACE } from '../src/engine/pace.js';

PACE[1].hp = 1; // tests assume the fixture enemy has its written HP (pacing is tested separately below)

defineHeroes([{ id: 't_hero', special: { name: 'Smash', target: 'enemy', desc: '', use(g, t) { g.attack(t, 12); } }, name: 'T', hp: 80, gold: 99, deck: ['t_strike', 't_strike', 't_strike', 't_strike', 't_strike', 't_def', 't_def', 't_def', 't_def', 't_def'], relic: 't_relic' }]);
defineRelics([{ id: 't_relic', name: 'T', rarity: 'starter', desc: '' }]);
defineCards([
  { id: 't_strike', name: 'S', hero: 't_hero', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', v: { dmg: 6 }, up: { dmg: 3 }, text: '', play(g, v, t) { g.attack(t, v.dmg); } },
  { id: 't_def', name: 'D', hero: 't_hero', type: 'skill', rarity: 'starter', cost: 1, target: 'none', v: { blk: 5 }, text: '', play(g, v) { g.block(v.blk); } },
  { id: 't_x', name: 'X', hero: 't_hero', type: 'attack', rarity: 'common', cost: 'X', target: 'enemy', v: { dmg: 5 }, text: '', play(g, v, t) { g.attack(t, v.dmg, v.x); } },
  { id: 't_ret', name: 'R', hero: 't_hero', type: 'skill', rarity: 'common', cost: 1, target: 'none', kw: ['retain'], text: '', play() {} },
  { id: 't_eth', name: 'E', hero: 't_hero', type: 'skill', rarity: 'common', cost: 1, target: 'none', kw: ['ethereal'], text: '', play() {} },
]);
defineEnemies([{
  id: 't_dummy', name: 'Dummy', kind: 'normal', hp: 100,
  moves: { hit: { intent: 'atk', dmg: 10 }, wait: { intent: 'buff', fx() {} } },
  ai: () => 'wait',
}]);

let fails = 0, passes = 0;
const eq = (a, b, msg) => { if (a === b) passes++; else { fails++; console.log(`FAIL ${msg}: expected ${b}, got ${a}`); } };

async function fresh(opts = {}) {
  const g = new Game();
  g.meta = freshMeta();
  g.newRun('t_hero', 0, 42);
  g.run.screen = 'combat';
  await g.startCombat(['t_dummy']);
  if (opts.hand) { g.cb.hand = opts.hand.map((id) => g.makeCard(id)); }
  return g;
}
const E = (g) => g.cb.enemies[0];

// --- damage math
{
  const g = await fresh();
  eq(g.calcAttack(g.player, E(g), 6), 6, 'base dmg');
  g.applySelf('might', 3); eq(g.calcAttack(g.player, E(g), 6), 9, 'might');
  g.apply(E(g), 'exposed', 2); eq(g.calcAttack(g.player, E(g), 6), 13, 'might+exposed floor(9*1.5)');
  g.applySelf('weak', 1); eq(g.calcAttack(g.player, E(g), 6), 10, 'weak floor(9*.75*1.5)');
  g.applySelf('might', -20); eq(g.calcAttack(g.player, E(g), 6), 0, 'negative might clamps to 0');
}
// --- block & frail & guard
{
  const g = await fresh();
  g.applySelf('guard', 2); g.block(5); eq(g.player.block, 7, 'guard');
  g.applySelf('frail', 1); g.block(5); eq(g.player.block, 7 + 5, 'frail floor(7*.75)=5');
  g.damage(g.player, 8, { type: 'attack' }); eq(g.player.block, 4, 'block absorbs');
  eq(g.player.hp, 80, 'no hp loss through block');
  g.damage(g.player, 10, {}); eq(g.player.hp, 74, 'overflow to hp');
}
// --- ward negates a debuff, not buffs
{
  const g = await fresh();
  g.addStatus(E(g), 'ward', 1);
  g.apply(E(g), 'weak', 2); eq(g.st(E(g), 'weak'), 0, 'ward negates');
  eq(g.st(E(g), 'ward'), 0, 'ward consumed');
  g.apply(E(g), 'weak', 2); eq(g.st(E(g), 'weak'), 2, 'applies after ward gone');
}
// --- rot ticks at enemy turn start and decays
{
  const g = await fresh({ hand: [] });
  g.apply(E(g), 'rot', 5);
  await g.endTurn();
  eq(E(g).hp, 95, 'rot dealt 5');
  eq(g.st(E(g), 'rot'), 4, 'rot decayed');
}
// --- exposed decays at end of owner's turn
{
  const g = await fresh({ hand: [] });
  g.apply(E(g), 'exposed', 2);
  await g.endTurn();
  eq(g.st(E(g), 'exposed'), 1, 'exposed decays on enemy turn end');
}
// --- masks
{
  const g = await fresh();
  g.setMask('wolf');
  eq(g.calcAttack(g.player, E(g), 6), 9, 'wolf +50%');
  eq(g.calcAttack(E(g), g.player, 10), 12, 'wolf take +25%');
  g.setMask('owl'); const en = g.cb.energy; g.setMask('moth');
  eq(g.cb.energy, en + 2, 'leaving owl gives 2 energy');
  g.player.block = 0; g.block(6); eq(g.player.block, 9, 'moth +50% block');
  eq(g.tot.shifts, 3, 'shift counter');
}
// --- spirits
{
  const g = await fresh();
  g.channel('warden'); g.channel('warden'); g.channel('warden');
  g.player.block = 0;
  g.channel('wisp'); // releases oldest warden → 5 block
  eq(g.player.block, 5, 'overflow releases oldest');
  eq(g.cb.spirits.join(','), 'warden,warden,wisp', 'spirit order');
  g.applySelf('soul', 2); g.player.block = 0; g.release(1);
  eq(g.player.block, 7, 'release with soul');
}
// --- X cost and retain/ethereal
{
  const g = await fresh({ hand: ['t_x', 't_ret', 't_eth'] });
  const x = g.cb.hand[0];
  await g.playCard(x.uid, E(g).uid);
  eq(E(g).hp, 100 - 15, 'X=3 hits of 5');
  eq(g.cb.energy, 0, 'X spends all energy');
  await g.endTurn();
  eq(g.cb.hand.some((c) => c.id === 't_ret'), true, 'retain kept');
  eq(g.cb.exhaust.some((c) => c.id === 't_eth'), true, 'ethereal exhausted');
}
// --- enemy attack hits through block, intent shows modified damage
{
  const g = await fresh({ hand: [] });
  E(g).move = 'hit';
  g.applySelf('exposed', 1);
  eq(g.intentOf(E(g)).dmg, 15, 'intent shows exposed dmg');
  await g.endTurn();
  eq(g.player.hp, 65, 'enemy hit 15');
}
// --- victory → reward screen
{
  const g = await fresh();
  E(g).hp = 3;
  const c = g.cb.hand.find((c) => c.id === 't_strike');
  await g.playCard(c.uid, E(g).uid);
  eq(g.run.screen, 'reward', 'won → reward');
  eq(g.run.combat, null, 'combat cleared');
}
// --- death → death screen
{
  const g = await fresh({ hand: [] });
  g.player.hp = 5; E(g).move = 'hit';
  await g.endTurn();
  eq(g.run.screen, 'death', 'lost → death');
  eq(g.meta.deaths, 1, 'death counted');
}

// --- hero actions: Strike / Guard once per turn, meter, Special
{
  const g = await fresh();
  const e = E(g);
  eq(await g.useAction('strike', e.uid), true, 'strike works');
  eq(e.hp, 96, 'strike deals 4');
  eq(await g.useAction('strike', e.uid), false, 'strike once per turn');
  await g.useAction('guard');
  eq(g.player.block, 4, 'guard gives 4 block');
  eq(await g.useAction('guard'), false, 'guard once per turn');
  eq(g.cb.act.meter, 2, 'actions charge the meter');
  eq(await g.useAction('special', e.uid), false, 'special needs a full meter');
  g.cb.act.meter = 6;
  eq(await g.useAction('special', e.uid), true, 'special at full meter');
  eq(e.hp, 84, 'special dealt 12');
  eq(g.cb.act.meter, 0, 'special spends the meter');
  await g.endTurn();
  eq(g.actionList().find((a) => a.id === 'strike').ready, true, 'strike ready again next turn');
}
// --- playing a card and taking a hit charge the meter
{
  const g = await fresh({ hand: ['t_strike'] });
  await g.playCard(g.cb.hand[0].uid, E(g).uid);
  eq(g.cb.act.meter, 1, 'card play +1 meter');
  g.cb.hand = []; E(g).move = 'hit';
  await g.endTurn();
  eq(g.cb.act.meter, 2, 'taking an enemy hit +1 meter');
}
// --- timed Brace: success cuts the hit, miss does not, headless skips it
{
  const g = await fresh({ hand: [] });
  g.ui = { ...g.ui, brace: async () => true };
  E(g).move = 'hit';
  await g.endTurn();
  eq(g.player.hp, 74, 'brace success: 10 dmg -> 6');
  eq(g.cb.act.meter, 3, 'brace success +2 meter (+1 for the hit)');
}
{
  const g = await fresh({ hand: [] });
  g.ui = { ...g.ui, brace: async () => false };
  E(g).move = 'hit';
  await g.endTurn();
  eq(g.player.hp, 70, 'brace miss: full 10 dmg');
}
{
  const g = await fresh({ hand: [] });
  g.meta.settings.timedBrace = false;
  let called = 0; g.ui = { ...g.ui, brace: async () => { called++; return true; } };
  E(g).move = 'hit';
  await g.endTurn();
  eq(called, 0, 'brace window honours the setting');
  eq(g.player.hp, 70, 'no window -> full damage');
}
// --- suggestPlay offers something sensible and never null while there are cards
{
  const g = await fresh({ hand: ['t_def', 't_strike'] });
  E(g).move = 'wait';
  const s1 = g.suggestPlay();
  eq(s1 && s1.kind, 'card', 'suggestPlay picks a card');
}
// --- pacing: Act 1 enemies get the multiplier; short act-1 map
{
  PACE[1].hp = 0.7;
  const g = await fresh();
  eq(E(g).maxHp, 70, 'act 1 pace.hp scales enemy HP');
  PACE[1].hp = 1;
  const { generateMap } = await import('../src/engine/map.js');
  const { newStream } = await import('../src/engine/rng.js');
  const m1 = generateMap(newStream(5), 1, 0), m2 = generateMap(newStream(5), 2, 0);
  eq(m1.floors < m2.floors, true, 'act 1 map is shorter than act 2');
  eq(Object.values(m1.nodes).filter((n) => n.f === 0).length <= 4, true, 'act 1 map has few routes');
}
// --- opening card choice
{
  const g = new Game(); g.meta = freshMeta(); g.newRun('t_hero', 0, 11);
  eq(g.run.screen, 'starter', 'run opens on the starter pick');
  const n = g.run.deck.length;
  eq(g.run.starter.length >= 1, true, 'starter options offered');
  eq(g.pickStarter(0), true, 'pickStarter works');
  eq(g.run.deck.length, n + 1, 'picked card joins the deck');
  eq(g.run.screen, 'blessing', 'then blessing');
}
console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
