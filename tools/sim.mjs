// Headless simulator: a simple bot plays full runs to find crashes and get
// rough balance numbers. Also validates content definitions.
//
//   node tools/sim.mjs [--runs 20] [--hero knight|witch|wren|cantor|all] [--asc 0]
//                      [--seed 1] [--verbose] [--validate-only] [--act 2]
import '../src/data/index.js';
import { CARDS, RELICS, POTIONS, ENEMIES, ENCOUNTERS, EVENTS, HEROES, STATUSES, HUB_LINES, LORE } from '../src/engine/registry.js';
import { Game, freshMeta } from '../src/engine/game.js';
import { newStream, rnd, pick, shuffle } from '../src/engine/rng.js';
import { SPRITES } from '../src/gfx/sprite.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const RUNS = +opt('runs', 20), ASC = +opt('asc', 0), VERBOSE = !!opt('verbose', false);
const HERO = opt('hero', 'all'), SEED = +opt('seed', 1), START_ACT = +opt('act', 1);

// ------------------------------------------------------------------ validation
const problems = [];
const warn = (m) => problems.push(m);
for (const c of Object.values(CARDS)) {
  if (!['attack', 'skill', 'power', 'curse', 'status'].includes(c.type)) warn(`card ${c.id}: bad type ${c.type}`);
  if (!c.name) warn(`card ${c.id}: no name`);
  if (c.cost !== -1 && !(c.kw || []).includes('unplayable') && typeof c.play !== 'function') warn(`card ${c.id}: playable but no play()`);
  if (!['starter', 'common', 'uncommon', 'rare', 'special', 'curse'].includes(c.rarity)) warn(`card ${c.id}: bad rarity ${c.rarity}`);
  if (!c.text && c.text !== '') warn(`card ${c.id}: no text`);
  if (typeof c.text === 'string') for (const m of c.text.matchAll(/\{(\w+)\}/g)) if (!(c.v && m[1] in c.v) && m[1] !== 'x') warn(`card ${c.id}: placeholder {${m[1]}} not in v`);
  if (!['enemy', 'none', 'all', 'random'].includes(c.target || 'none')) warn(`card ${c.id}: bad target ${c.target}`);
  if (c.hero && !['neutral', 'status', 'curse'].includes(c.hero) && !HEROES[c.hero]) warn(`card ${c.id}: unknown hero ${c.hero}`);
}
for (const h of Object.values(HEROES)) {
  for (const id of h.deck) if (!CARDS[id]) warn(`hero ${h.id}: starter card ${id} missing`);
  if (!RELICS[h.relic]) warn(`hero ${h.id}: starter relic ${h.relic} missing`);
}
for (const e of Object.values(ENEMIES)) {
  if (!e.moves || !e.ai) warn(`enemy ${e.id}: missing moves/ai`);
  if (!['normal', 'elite', 'boss'].includes(e.kind)) warn(`enemy ${e.id}: bad kind ${e.kind}`);
  if (e.sprite && Object.keys(SPRITES).length > 1 && !SPRITES[e.sprite]) warn(`enemy ${e.id}: sprite ${e.sprite} not defined`);
  for (const [k, m] of Object.entries(e.moves || {})) {
    if (!m.intent) warn(`enemy ${e.id}.${k}: no intent`);
    if (/atk/.test(m.intent || '') && m.dmg == null) warn(`enemy ${e.id}.${k}: attack intent without dmg`);
  }
}
for (const enc of Object.values(ENCOUNTERS)) {
  if (Array.isArray(enc.enemies)) for (const id of enc.enemies) if (!ENEMIES[id]) warn(`encounter ${enc.id}: enemy ${id} missing`);
  if (!['easy', 'hard', 'elite', 'boss'].includes(enc.pool)) warn(`encounter ${enc.id}: bad pool ${enc.pool}`);
}
for (const ev of Object.values(EVENTS)) {
  if (!ev.pages || !ev.pages.start) warn(`event ${ev.id}: no start page`);
  for (const [pid, p] of Object.entries(ev.pages || {})) for (const c of p.choices || []) {
    if (c.next && !ev.pages[c.next]) warn(`event ${ev.id}.${pid}: next '${c.next}' missing`);
  }
}
for (const r of Object.values(RELICS)) if (!['starter', 'common', 'uncommon', 'rare', 'boss', 'shop', 'special'].includes(r.rarity)) warn(`relic ${r.id}: bad rarity ${r.rarity}`);
for (const p of Object.values(POTIONS)) if (typeof p.use !== 'function') warn(`potion ${p.id}: no use()`);

const counts = {
  cards: Object.keys(CARDS).length, relics: Object.keys(RELICS).length, potions: Object.keys(POTIONS).length,
  statuses: Object.keys(STATUSES).length, enemies: Object.keys(ENEMIES).length, encounters: Object.keys(ENCOUNTERS).length,
  events: Object.keys(EVENTS).length, hubLines: HUB_LINES.length, lore: Object.keys(LORE).length, sprites: Object.keys(SPRITES).length,
};
console.log('content:', JSON.stringify(counts));
const byHero = {};
for (const c of Object.values(CARDS)) { const k = c.hero + ':' + c.rarity; byHero[k] = (byHero[k] || 0) + 1; }
console.log('cards by hero:rarity:', JSON.stringify(byHero));
if (problems.length) { console.log(`\n${problems.length} VALIDATION PROBLEMS:`); for (const p of problems) console.log('  - ' + p); }
if (opt('validate-only', false)) process.exit(problems.length ? 1 : 0);

// Fill in missing acts with dummy enemies so the engine can be exercised early.
for (let act = 1; act <= 4; act++) {
  for (const pool of ['easy', 'hard', 'elite', 'boss']) {
    if (act === 4 && (pool === 'easy' || pool === 'hard')) continue;
    if (Object.values(ENCOUNTERS).some((e) => e.act === act && e.pool === pool)) continue;
    const id = `dummy_${act}_${pool}`;
    const hp = { easy: 18, hard: 30, elite: 75, boss: 160 }[pool] * (1 + (act - 1) * 0.6);
    ENEMIES[id] = {
      id, name: 'Dummy', kind: pool === 'elite' ? 'elite' : pool === 'boss' ? 'boss' : 'normal', hp: Math.round(hp),
      moves: {
        hit: { intent: 'atk', dmg: Math.round((5 + act * 3) * (pool === 'boss' ? 1.6 : pool === 'elite' ? 1.3 : 1)) },
        guard: { intent: 'def', fx: (g, e) => g.gainBlock(e, 6 * act, { raw: true }) },
        buff: { intent: 'buff', fx: (g, e) => g.apply(e, 'might', act, e) },
      },
      ai: (g, e) => g.aiPick(e, { hit: 60, guard: 20, buff: 20 }, { hit: 2, guard: 1, buff: 1 }),
    };
    ENCOUNTERS['enc_' + id] = { id: 'enc_' + id, act, pool, enemies: pool === 'easy' ? [id, id] : [id] };
  }
}

// ------------------------------------------------------------------ bot
const botR = newStream(SEED * 7919);
const botUI = {
  wait: () => Promise.resolve(),
  choose(o) {
    let cards = [...o.cards];
    const want = o.offer ? 1 : Math.max(o.min ?? 0, Math.min(o.count ?? 1, 1));
    if (o.title && /remove|bury/i.test(o.title)) cards.sort((a, b) => score(a) - score(b));
    else if (o.upgradePreview) cards.sort((a, b) => score(b) - score(a));
    else shuffle(botR, cards);
    return Promise.resolve(cards.slice(0, Math.max(want, o.min ?? 0)));
  },
};
function score(c) {
  const d = CARDS[c.id];
  if (d.type === 'curse') return -10;
  if (d.type === 'status') return -8;
  if (d.rarity === 'starter' && /strike|defend/.test(c.id)) return 0;
  return { common: 2, uncommon: 3, rare: 4 }[d.rarity] || 1;
}

function incoming(g) {
  let t = 0;
  for (const e of g.enemies) { const it = g.intentOf(e); if (it && it.dmg != null) t += it.dmg * (it.times || 1); }
  return t;
}

async function botCombat(g) {
  let guard = 0;
  while (g.run && g.run.combat && g.run.combat.phase === 'player' && guard++ < 400) {
    const cb = g.cb;
    const P = g.player;
    if (P.hp < P.maxHp * 0.4) {
      const slot = g.run.potions.findIndex((p) => p && POTIONS[p] && !POTIONS[p].revive);
      if (slot >= 0) { const t = g.enemies[0]; await g.usePotion(slot, t && t.uid); if (!g.run || !g.run.combat) return; continue; }
    }
    const playable = cb.hand.filter((c) => g.canPlay(c));
    if (!playable.length) { await g.endTurn(); continue; }
    const needBlock = incoming(g) > P.block;
    const pr = (c) => {
      const d = CARDS[c.id];
      if (d.type === 'power') return 0;
      const v = g.cardVals(c);
      if (needBlock && (v.blk != null)) return 1;
      if (d.type === 'attack') return 2;
      return 3 + rnd(botR);
    };
    playable.sort((a, b) => pr(a) - pr(b));
    const c = playable[0];
    const d = CARDS[c.id];
    const t = d.target === 'enemy' ? g.enemies.reduce((m, e) => (!m || e.hp < m.hp ? e : m), null) : null;
    const ok = await g.playCard(c.uid, t && t.uid);
    if (!ok) await g.endTurn();
  }
  if (guard >= 400) throw new Error('combat stuck');
}

async function playRun(hero, seed) {
  const g = new Game({ ui: botUI });
  g.meta = freshMeta();
  for (const h in g.meta.heroes) { g.meta.heroes[h].unlocked = true; g.meta.heroes[h].level = 5; }
  g.meta.runs = 30;
  g.newRun(hero, ASC, seed);
  if (START_ACT > 1) { g.run.screen = 'map'; for (let a = 2; a <= START_ACT; a++) g.nextAct(a); g.beginAct(); }
  let steps = 0;
  const run = g.run;
  while (g.run && !g.run.over && steps++ < 5000) {
    const scr = g.run.screen;
    if (VERBOSE && scr !== 'combat') console.log(`  [${hero}] act ${g.run.act} floor ${g.run.floor} ${scr} hp ${g.run.player.hp}/${g.run.player.maxHp} gold ${g.run.gold} deck ${g.run.deck.length}`);
    switch (scr) {
      case 'blessing': await g.chooseBlessing(Math.floor(rnd(botR) * g.run.blessing.length)); break;
      case 'actIntro': g.beginAct(); break;
      case 'map': {
        const opts = g.reachable();
        const nodes = opts.map((k) => g.run.map.nodes[k]);
        const P = g.run.player;
        let best = nodes[0];
        const pref = (n) => (n.type === 'rest' && P.hp < P.maxHp * 0.5 ? -2 : n.type === 'elite' && P.hp < P.maxHp * 0.6 ? 5 : n.type === 'shop' && g.run.gold > 150 ? -1 : rnd(botR));
        for (const n of nodes) if (pref(n) < pref(best)) best = n;
        await g.enterNode(best.f + '_' + best.l);
        break;
      }
      case 'combat': await botCombat(g); break;
      case 'reward': {
        const items = g.run.reward.items;
        if (!items.length) { await g.leaveReward(); break; }
        const it = items[0];
        if (it.type === 'card') g.pickRewardCard(0, rnd(botR) < 0.75 ? Math.floor(rnd(botR) * it.options.length) : null);
        else if (it.type === 'potion' && !g.run.potions.includes(null)) items.splice(0, 1);
        else await g.takeReward(0);
        break;
      }
      case 'bossRelic': g.chooseBossRelic(0); break;
      case 'rest': {
        if (g.run.rest.done) { g.leaveRoom(); break; }
        const P = g.run.player;
        const o = g.restOptions().filter((x) => !x.disabled);
        const want = P.hp < P.maxHp * 0.55 ? 'rest' : 'smith';
        await g.restAction((o.find((x) => x.id === want) || o[0]).id);
        if (!g.run.rest || !g.run.rest.done) g.leaveRoom();
        break;
      }
      case 'shop': {
        const s = g.run.shop;
        const buyable = [...s.cards.map((c, i) => ['cards', i, c]), ...s.relics.map((c, i) => ['relics', i, c])].filter(([, , c]) => !c.sold && c.price <= g.run.gold);
        if (!s.removed && g.run.gold >= s.removePrice && rnd(botR) < 0.6) await g.buy('remove');
        else if (buyable.length && rnd(botR) < 0.7) { const [k, i] = pick(botR, buyable); await g.buy(k, i); }
        else g.leaveRoom();
        break;
      }
      case 'treasure': g.openChest(); break;
      case 'event': {
        const p = g.eventPage();
        if (!p) { g.leaveRoom(); break; }
        const ok = p.choices.filter((c) => !c.disabled);
        if (!ok.length) { g.leaveRoom(); break; }
        await g.eventChoose(pick(botR, ok).i);
        break;
      }
      case 'throne': {
        const o = g.throneOptions().filter((x) => !x.disabled);
        await g.throneChoose(o[o.length - 1].id);
        break;
      }
      case 'ending': case 'death': return { g, run };
      default: throw new Error('unknown screen ' + scr);
    }
  }
  if (steps >= 5000) throw new Error('run stuck on screen ' + g.run.screen);
  return { g, run };
}

const heroes = HERO === 'all' ? Object.keys(HEROES) : [HERO];
const results = {};
const errors = [];
for (const hero of heroes) {
  results[hero] = { runs: 0, wins: 0, acts: [0, 0, 0, 0, 0], killers: {}, floors: 0 };
  for (let i = 0; i < RUNS; i++) {
    const seed = SEED * 100003 + i * 7 + hero.length;
    try {
      const { g, run } = await playRun(hero, seed);
      const R = results[hero];
      R.runs++;
      R.floors += run.stats.floors;
      R.acts[run.act]++;
      if (run.screen === 'ending') R.wins++;
      else { const k = g.meta.lastRun?.killer || '?'; R.killers[k] = (R.killers[k] || 0) + 1; }
    } catch (e) {
      errors.push({ hero, seed, err: e.stack });
    }
  }
}
for (const [h, R] of Object.entries(results)) {
  const top = Object.entries(R.killers).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k}:${n}`).join(' ');
  console.log(`${h.padEnd(7)} runs ${R.runs} wins ${R.wins} avgFloors ${(R.floors / Math.max(1, R.runs)).toFixed(1)} diedInAct ${JSON.stringify(R.acts.slice(1))} killers ${top}`);
}
if (errors.length) {
  console.log(`\n${errors.length} RUN ERRORS:`);
  const seen = new Set();
  for (const e of errors) { const k = e.err.split('\n').slice(0, 2).join('|'); if (seen.has(k)) continue; seen.add(k); console.log(`--- ${e.hero} seed ${e.seed}\n${e.err.split('\n').slice(0, 8).join('\n')}`); }
  process.exit(1);
}
