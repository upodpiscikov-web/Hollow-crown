// Pacing + balance simulator for the Act 1 revamp (see REVAMP.md / BALANCE_NOTES.md).
//
// Plays full runs of every hero with the engine's own g.suggestPlay() as the "competent player" combat
// policy (Strike / Guard / Special / cards), plus simple, fixed heuristics for rewards, shops, rests, events
// and the map. Headless, so there is no Brace window: treat Brace as a bonus the human gets on top.
//
//   node tools/act1-stats.mjs [--runs 200] [--hero knight|witch|wren|cantor|all] [--seed 1] [--asc 0]
//                             [--act1]            stop each run after the Act 1 boss (fast; no full-run win rate)
//                             [--enc]             per-encounter table (Act 1)
//                             [--acts]            fight tables for every act, not only Act 1
//                             [--brace 0.6]       model the timed Brace window: the human taps in time 60% of the time (default 0 = off)
//                             [--legacy]          the pre-revamp game: no Strike/Guard/Special, Act 1 = 15 floors, HP x1
//                             [--meta fresh]      level-0 profile (default: everything unlocked, like tools/sim.mjs)
//                             [--turn-sec 20] [--node-sec 25] [--reward-sec 0]   minutes model
//                             [--set path=value]  override any knob for this run only (repeatable), e.g.
//                                   --set pace.2.hp=1.3  --set pace.2.dmg=1.1
//                                   --set hero.knight.actions.strike.dmg=5  --set hero.cantor.actions.meterMax=8
//                                   --set enemy.sir_rendrick.hp=[70,74]  --set enemy.marsh_hound.moves.bite.dmg=4
//                             [--json]            machine-readable summary on the last line
//
// Also importable: `import { simulate } from './act1-stats.mjs'`.
import '../src/data/index.js';
import { CARDS, POTIONS, ENEMIES, ENCOUNTERS, HEROES } from '../src/engine/registry.js';
import { Game, freshMeta } from '../src/engine/game.js';
import { newStream, rnd, pick } from '../src/engine/rng.js';
import { PACE } from '../src/engine/pace.js';
import { pathToFileURL } from 'node:url';

// ------------------------------------------------------------------ small helpers
const pct = (a, b) => (b ? (100 * a) / b : 0);
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');

function setPath(root, path, value) {
  const keys = path.split('.');
  let o = root;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}

// "pace.2.hp=1.3" / "hero.knight.actions.meterMax=8" / "enemy.bragg.hp=200"
export function applyOverride(spec) {
  const eq = spec.indexOf('=');
  if (eq < 0) throw new Error('bad --set ' + spec);
  const path = spec.slice(0, eq), raw = spec.slice(eq + 1);
  let value;
  try { value = JSON.parse(raw); } catch { value = raw; }
  const [head, ...rest] = path.split('.');
  const roots = { pace: PACE, hero: HEROES, enemy: ENEMIES };
  if (!roots[head]) throw new Error('bad --set root ' + head);
  setPath(roots[head], rest.join('.'), value);
}

// ------------------------------------------------------------------ card valuation for reward / shop / UI picks
const rarityScore = { starter: 0.5, common: 1, uncommon: 2, rare: 3, special: 1 };
function cardScore(c) {
  const d = CARDS[c.id];
  if (d.type === 'curse') return -10;
  if (d.type === 'status') return -8;
  let s = rarityScore[d.rarity] ?? 1;
  if (d.rarity === 'starter' && /strike|defend/.test(c.id)) s = 0;
  return s + (c.up ? 0.5 : 0);
}
function pickCards(o, rng) {
  const cards = [...o.cards];
  const t = o.title || '';
  const worstFirst = /remove|bury|exhaust|discard|banish|burn|sacrifice|lose/i.test(t);
  if (worstFirst) cards.sort((a, b) => cardScore(a) - cardScore(b));
  else cards.sort((a, b) => cardScore(b) - cardScore(a) || rnd(rng) - 0.5);
  const want = o.offer ? 1 : Math.max(o.min ?? 0, Math.min(o.count ?? 1, 1));
  return cards.slice(0, Math.max(want, o.min ?? 0));
}

// Reward-card pick: keep the deck balanced, take uncommon+ always, commons only while the deck is small.
function chooseRewardCard(g, options, rng) {
  const deck = g.run.deck;
  const n = deck.length;
  const share = (type) => deck.filter((c) => CARDS[c.id].type === type).length / Math.max(1, n);
  let best = -1, bestV = -99;
  options.forEach((o, i) => {
    const d = CARDS[o.id];
    let v = cardScore(o);
    if (d.type === 'attack' && share('attack') < 0.35) v += 0.6;
    if (d.type === 'skill' && share('skill') < 0.25) v += 0.4;
    if (d.type === 'power' && deck.filter((c) => CARDS[c.id].type === 'power').length >= 2) v -= 1;
    v += rnd(rng) * 0.3;
    if (v > bestV) { bestV = v; best = i; }
  });
  const minV = n < 14 ? 0.9 : n < 20 ? 1.6 : 2.4;
  return bestV >= minV ? best : null;
}

// ------------------------------------------------------------------ one run
async function playRun(hero, seed, cfg) {
  const rng = newStream((seed ^ 0xb07b07) >>> 0);
  const ui = {
    wait: () => Promise.resolve(),
    choose: (o) => Promise.resolve(pickCards(o, rng)),
    // no ui.brace by default: the timed Brace window is skipped in headless play (--brace P models a human
    // who taps in time with probability P)
  };
  if (cfg.brace > 0) ui.brace = async () => rnd(rng) < cfg.brace;
  const g = new Game({ ui });
  g.meta = freshMeta();
  if (cfg.meta !== 'fresh') {
    for (const h in g.meta.heroes) { g.meta.heroes[h].unlocked = true; g.meta.heroes[h].level = 5; }
    g.meta.runs = 30;
  }
  if (cfg.legacy) g.actionList = () => []; // no Strike / Guard / Special: suggestPlay only sees cards
  g.newRun(hero, cfg.asc, seed);

  const out = {
    hero, seed, fights: [], nodes: { fight: 0, elite: 0, boss: 0, event: 0, rest: 0, shop: 0, treasure: 0 },
    act1: { turns: 0, nonCombat: 0, rewards: 0, cleared: false }, won: false, deathAct: 0, deathFloor: 0, killer: null,
    hpAfterAct1: null, potionsUsed: 0,
  };
  const startedAct = () => g.run.act;

  async function fight() {
    const cb = g.run.combat;
    const P = g.player;
    const hp0 = P.hp, maxHp = P.maxHp, act = g.run.act, floor = g.run.floor;
    let guard = 0;
    while (g.run && g.run.combat === cb && cb.phase === 'player' && guard++ < 400) {
      if (P.hp < P.maxHp * 0.4) {
        const slot = g.run.potions.findIndex((p) => p && POTIONS[p] && !POTIONS[p].revive);
        if (slot >= 0) {
          const t = g.enemies[0];
          if (await g.usePotion(slot, t && t.uid)) { out.potionsUsed++; continue; }
        }
      }
      const s = g.suggestPlay();
      if (!s) { await g.endTurn(); continue; }
      let ok = false;
      if (s.kind === 'card') ok = await g.playCard(s.card.uid, s.target);
      else ok = await g.useAction(s.id, s.target);
      if (!ok) await g.endTurn();
    }
    if (guard >= 400) throw new Error('combat stuck vs ' + cb.encounter);
    const enc = cb.encounter ? ENCOUNTERS[cb.encounter] : null;
    const pool = enc ? enc.pool : cb.kind === 'elite' ? 'elite' : cb.kind === 'boss' ? 'boss' : 'event';
    const rec = {
      act, floor, enc: cb.encounter || (cb.fromEvent ? 'event:' + cb.fromEvent.id : '?'), pool: enc ? pool : 'event',
      turns: cb.turn, hpLost: Math.max(0, cb.tot.hpLost), maxHp, hp0, won: cb.result === 'won',
      specials: cb.tot.specials || 0, cards: cb.tot.cards,
    };
    out.fights.push(rec);
    if (act === 1) out.act1.turns += cb.turn;
  }

  let steps = 0;
  while (g.run && !g.run.over && steps++ < 6000) {
    const scr = g.run.screen;
    switch (scr) {
      case 'starter': {
        // best of three by rarity, attack preferred
        const opts = g.run.starter.map((o, i) => ({ i, v: cardScore(o) + (CARDS[o.id].type === 'attack' ? 0.3 : 0) + rnd(rng) * 0.2 }));
        opts.sort((a, b) => b.v - a.v);
        g.pickStarter(opts[0].i);
        break;
      }
      case 'blessing': {
        // Prefer: remove > upgrade > card choice > max HP > potions > gold > nothing. Skip HP/gold-costing majors.
        const order = ['remove', 'upgrade', 'cardchoice', 'maxhp', 'potions', 'gold', 'none'];
        const bl = g.run.blessing.map((b, i) => ({ i, k: order.indexOf(b.id) })).filter((x) => x.k >= 0).sort((a, b) => a.k - b.k);
        await g.chooseBlessing(bl.length ? bl[0].i : g.run.blessing.length - 1);
        break;
      }
      case 'actIntro': g.beginAct(); break;
      case 'map': {
        const P = g.run.player;
        const r = P.hp / P.maxHp;
        const nodes = g.reachable().map((k) => g.run.map.nodes[k]);
        const pref = (n) => {
          const noise = rnd(rng) * 0.6;
          switch (n.type) {
            case 'rest': return (r < 0.6 ? -3 : 0.8) + noise;
            case 'elite': return (r >= 0.75 ? -0.8 : 4) + noise;
            case 'shop': return (g.run.gold >= 110 ? -1.5 : 1) + noise;
            case 'treasure': return -2 + noise;
            case 'event': return 0 + noise;
            default: return 0.4 + noise;
          }
        };
        let best = nodes[0];
        for (const n of nodes) if (pref(n) < pref(best)) best = n;
        const act = g.run.act;
        out.nodes[best.type]++;
        if (act === 1 && !['fight', 'elite', 'boss'].includes(best.type)) out.act1.nonCombat++;
        await g.enterNode(best.f + '_' + best.l);
        break;
      }
      case 'combat': await fight(); break;
      case 'reward': {
        const rw = g.run.reward;
        if (g.run.act === 1) out.act1.rewards++;
        // Take everything but cards first, then choose a card (or skip).
        const items = rw.items;
        let guard = 0;
        while (items.length && guard++ < 20) {
          const i = items.findIndex((it) => it.type !== 'card');
          if (i >= 0) {
            const it = items[i];
            if (it.type === 'potion' && !g.run.potions.includes(null)) items.splice(i, 1);
            else await g.takeReward(i);
            continue;
          }
          const ci = items.findIndex((it) => it.type === 'card');
          const choice = chooseRewardCard(g, items[ci].options, rng);
          g.pickRewardCard(ci, choice);
        }
        await g.leaveReward();
        break;
      }
      case 'bossRelic':
        if (g.run.act === 1) { out.act1.cleared = true; out.hpAfterAct1 = g.run.player.hp / g.run.player.maxHp; if (cfg.act1Only) return finish(); }
        g.chooseBossRelic(0);
        break;
      case 'rest': {
        if (g.run.rest.done) { g.leaveRoom(); break; }
        const P = g.run.player;
        const o = g.restOptions().filter((x) => !x.disabled);
        const want = P.hp < P.maxHp * 0.62 ? 'rest' : 'smith';
        await g.restAction((o.find((x) => x.id === want) || o[0]).id);
        if (!g.run.rest || !g.run.rest.done) g.leaveRoom();
        break;
      }
      case 'shop': {
        const s = g.run.shop;
        let did = false;
        const gold = () => g.run.gold;
        const hasJunk = g.run.deck.some((c) => cardScore(c) <= 0);
        if (!s.removed && hasJunk && gold() >= s.removePrice) { await g.buy('remove'); did = true; }
        else {
          const cand = [
            ...s.relics.map((c, i) => ({ k: 'relics', i, v: 3.2, c })),
            ...s.cards.map((c, i) => ({ k: 'cards', i, v: cardScore(c), c })),
          ].filter((x) => !x.c.sold && x.c.price <= gold() && x.v >= (x.k === 'cards' ? 2 : 0))
            .sort((a, b) => b.v - a.v || a.c.price - b.c.price);
          if (cand.length && g.run.deck.length < 26) { const x = cand[0]; if (await g.buy(x.k, x.i)) did = true; }
        }
        if (!did) g.leaveRoom();
        break;
      }
      case 'treasure': g.openChest(); break;
      case 'event': {
        const p = g.eventPage();
        if (!p) { g.leaveRoom(); break; }
        const ok = p.choices.filter((c) => !c.disabled);
        if (!ok.length) { g.leaveRoom(); break; }
        await g.eventChoose(pick(rng, ok).i);
        break;
      }
      case 'throne': {
        const o = g.throneOptions().filter((x) => !x.disabled);
        await g.throneChoose((o.find((x) => x.id === 'crown') || o[0]).id);
        break;
      }
      case 'ending': case 'death': return finish();
      default: throw new Error('unknown screen ' + scr);
    }
  }
  if (steps >= 6000) throw new Error('run stuck on screen ' + (g.run && g.run.screen));
  return finish();

  function finish() {
    const run = g.run;
    out.won = !!run && run.screen === 'ending';
    out.deathAct = run ? run.act : 0;
    out.deathFloor = run ? run.floor : 0;
    if (!out.won && !out.act1.cleared) out.act1.cleared = false;
    if (!out.won && g.meta.lastRun) out.killer = g.meta.lastRun.killer || (run && run.event ? 'event:' + run.event.id : '?');
    if (run && run.act > 1) out.act1.cleared = true;
    return out;
  }
}

// ------------------------------------------------------------------ aggregation
const POOLS = ['easy', 'hard', 'elite', 'boss', 'event'];

function fightTable(fights, label, indent = '  ') {
  const lines = [`${indent}${label.padEnd(8)} ${'n'.padStart(5)} ${'turns'.padStart(6)} ${'hpLost'.padStart(7)} ${'%maxHP'.padStart(7)} ${'win%'.padStart(6)} ${'spc/f'.padStart(6)}`];
  for (const pool of POOLS) {
    const fs = fights.filter((f) => f.pool === pool);
    if (!fs.length) continue;
    lines.push(`${indent}${pool.padEnd(8)} ${String(fs.length).padStart(5)} ${f1(avg(fs.map((f) => f.turns))).padStart(6)} ${f1(avg(fs.map((f) => f.hpLost))).padStart(7)} ${f1(avg(fs.map((f) => 100 * f.hpLost / f.maxHp))).padStart(7)} ${f1(pct(fs.filter((f) => f.won).length, fs.length)).padStart(6)} ${f1(avg(fs.map((f) => f.specials))).padStart(6)}`);
  }
  return lines.join('\n');
}

function encTable(fights) {
  const by = {};
  for (const f of fights) (by[f.enc] ||= []).push(f);
  const rows = Object.entries(by).map(([enc, fs]) => ({
    enc, pool: fs[0].pool, n: fs.length, turns: avg(fs.map((f) => f.turns)), hp: avg(fs.map((f) => 100 * f.hpLost / f.maxHp)), win: pct(fs.filter((f) => f.won).length, fs.length),
  }));
  const order = { easy: 0, hard: 1, elite: 2, boss: 3, event: 4 };
  rows.sort((a, b) => order[a.pool] - order[b.pool] || a.enc.localeCompare(b.enc));
  return rows.map((r) => `  ${r.pool.padEnd(6)} ${r.enc.padEnd(26)} n ${String(r.n).padStart(4)}  turns ${f1(r.turns).padStart(4)}  hpLost ${f1(r.hp).padStart(5)}%  win ${f1(r.win).padStart(5)}%`).join('\n');
}

export async function simulate(cfg) {
  const heroes = cfg.hero === 'all' ? Object.keys(HEROES) : [cfg.hero];
  const result = { cfg, heroes: {}, errors: [] };
  for (const hero of heroes) {
    const hi = Object.keys(HEROES).indexOf(hero); // seeds depend on the hero, not on the --hero filter
    const runs = [];
    for (let i = 0; i < cfg.runs; i++) {
      const seed = ((cfg.seed * 100003 + i * 7919 + hi * 104729) >>> 0) || 1;
      try { runs.push(await playRun(hero, seed, cfg)); } catch (e) { result.errors.push({ hero, seed, err: e.stack }); }
    }
    result.heroes[hero] = summarise(hero, runs, cfg);
  }
  return result;
}

function summarise(hero, runs, cfg) {
  const n = runs.length;
  const cleared = runs.filter((r) => r.act1.cleared);
  const allFights = runs.flatMap((r) => r.fights);
  const a1Fights = allFights.filter((f) => f.act === 1);
  const minutes = (r) => (r.act1.turns * cfg.turnSec + r.act1.nonCombat * cfg.nodeSec + r.act1.rewards * cfg.rewardSec) / 60;
  const deaths = runs.filter((r) => !r.won && !(cfg.act1Only && r.act1.cleared));
  const dieBy = {};
  for (const d of deaths) { const k = `A${d.deathAct}:${d.killer || '?'}`; dieBy[k] = (dieBy[k] || 0) + 1; }
  const dieAct = [0, 0, 0, 0, 0];
  for (const d of deaths) dieAct[Math.min(4, d.deathAct)]++;
  return {
    hero, runs: n,
    act1Clear: pct(cleared.length, n),
    win: pct(runs.filter((r) => r.won).length, n),
    // of the runs that cleared Act 1: how many then won the whole thing
    winGivenA1: pct(runs.filter((r) => r.won).length, cleared.length),
    act1MinAll: avg(runs.map(minutes)),
    act1MinCleared: avg(cleared.map(minutes)),
    act1Turns: avg(cleared.map((r) => r.act1.turns)),
    act1Nodes: avg(cleared.map((r) => r.act1.nonCombat)),
    act1Fights: avg(cleared.map((r) => r.fights.filter((f) => f.act === 1).length)),
    hpAfterAct1: avg(cleared.map((r) => r.hpAfterAct1 ?? 0)) * 100,
    deathsByAct: dieAct.slice(1), dieBy, fights: allFights, a1Fights,
    potions: avg(runs.map((r) => r.potionsUsed)),
  };
}

function report(result, cfg) {
  const lines = [];
  const cfgLine = `runs/hero ${cfg.runs}  seed ${cfg.seed}  asc ${cfg.asc}  meta ${cfg.meta}${cfg.legacy ? '  LEGACY(no actions, 15 floors)' : ''}${cfg.brace ? `  BRACE ${cfg.brace}` : ''}${cfg.act1Only ? '  ACT1-ONLY' : ''}  turn ${cfg.turnSec}s  node ${cfg.nodeSec}s${cfg.rewardSec ? `  reward ${cfg.rewardSec}s` : ''}`;
  lines.push(cfgLine);
  const H = Object.values(result.heroes);
  for (const s of H) {
    lines.push(`\n=== ${s.hero.toUpperCase()}  (${s.runs} runs) ===`);
    lines.push(`Act 1 clear ${f1(s.act1Clear)}%   full-run win ${cfg.act1Only ? 'n/a' : f1(s.win) + '%'}   win | cleared A1 ${cfg.act1Only ? 'n/a' : f1(s.winGivenA1) + '%'}   HP left after A1 boss ${f1(s.hpAfterAct1)}%`);
    lines.push(`Act 1 time (cleared runs) ${f1(s.act1MinCleared)} min  = ${f1(s.act1Turns)} turns x ${cfg.turnSec}s + ${f1(s.act1Nodes)} non-combat nodes x ${cfg.nodeSec}s${cfg.rewardSec ? ` + rewards x ${cfg.rewardSec}s` : ''}   (all runs, deaths included: ${f1(s.act1MinAll)} min; ${f1(s.act1Fights)} fights/run; potions used ${f1(s.potions)}/run)`);
    lines.push('Act 1 fights (map fights; "event" = fights started from events):');
    lines.push(fightTable(s.a1Fights, 'pool'));
    if (cfg.acts && !cfg.act1Only) for (const a of [2, 3, 4]) {
      const fs = s.fights.filter((f) => f.act === a);
      if (fs.length) { lines.push(`Act ${a} fights:`); lines.push(fightTable(fs, 'pool')); }
    }
    if (!cfg.act1Only) lines.push(`Runs ended in act [1,2,3,4]: ${JSON.stringify(s.deathsByAct)}  (won ${Math.round(s.win * s.runs / 100)})`);
    const top = Object.entries(s.dieBy).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join('  ');
    lines.push(`Died to: ${top || '-'}`);
  }
  if (cfg.enc) {
    const all = H.flatMap((s) => s.a1Fights);
    lines.push('\n=== ACT 1 PER-ENCOUNTER (all heroes) ===');
    lines.push(encTable(all));
  }
  if (H.length > 1 && !cfg.act1Only) {
    lines.push('\n=== ALL HEROES, BY ACT (map fights; event fights excluded) ===');
    lines.push(`${'act/pool'.padEnd(10)} ${'n'.padStart(6)} ${'turns'.padStart(6)} ${'%maxHP'.padStart(7)} ${'win%'.padStart(6)}`);
    for (const a of [1, 2, 3]) for (const pool of ['easy', 'hard', 'elite', 'boss']) {
      const fs = H.flatMap((s) => s.fights).filter((f) => f.act === a && f.pool === pool);
      if (!fs.length) continue;
      lines.push(`${(`A${a} ${pool}`).padEnd(10)} ${String(fs.length).padStart(6)} ${f1(avg(fs.map((f) => f.turns))).padStart(6)} ${f1(avg(fs.map((f) => 100 * f.hpLost / f.maxHp))).padStart(7)} ${f1(pct(fs.filter((f) => f.won).length, fs.length)).padStart(6)}`);
    }
  }
  if (H.length > 1) {
    lines.push('\n=== SUMMARY ===');
    lines.push(`${'hero'.padEnd(8)} ${'A1clear'.padStart(8)} ${'win'.padStart(7)} ${'A1 min'.padStart(7)}  turns easy/hard/elite/boss`);
    for (const s of H) {
      const t = (p) => f1(avg(s.a1Fights.filter((f) => f.pool === p).map((f) => f.turns)));
      lines.push(`${s.hero.padEnd(8)} ${(f1(s.act1Clear) + '%').padStart(8)} ${(cfg.act1Only ? 'n/a' : f1(s.win) + '%').padStart(7)} ${f1(s.act1MinCleared).padStart(7)}  ${t('easy')} / ${t('hard')} / ${t('elite')} / ${t('boss')}`);
    }
    const wins = H.map((s) => s.win);
    lines.push(`mean A1 clear ${f1(avg(H.map((s) => s.act1Clear)))}%   mean win ${cfg.act1Only ? 'n/a' : f1(avg(wins)) + '%'}   spread (max-min) ${cfg.act1Only ? 'n/a' : f1(Math.max(...wins) - Math.min(...wins)) + ' pts'}   mean A1 minutes ${f1(avg(H.map((s) => s.act1MinCleared)))}`);
  }
  if (result.errors.length) {
    lines.push(`\n${result.errors.length} RUN ERRORS`);
    const seen = new Set();
    for (const e of result.errors) { const k = e.err.split('\n').slice(0, 2).join('|'); if (seen.has(k)) continue; seen.add(k); lines.push(`--- ${e.hero} seed ${e.seed}\n${e.err.split('\n').slice(0, 8).join('\n')}`); }
  }
  return lines.join('\n');
}

// ------------------------------------------------------------------ CLI
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const one = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
  const many = (k) => args.flatMap((a, i) => (a === '--' + k && args[i + 1] ? [args[i + 1]] : []));
  const cfg = {
    runs: +one('runs', 200), hero: one('hero', 'all'), seed: +one('seed', 1), asc: +one('asc', 0),
    act1Only: !!one('act1', false), enc: !!one('enc', false), acts: !!one('acts', false), legacy: !!one('legacy', false),
    meta: one('meta', 'full'), turnSec: +one('turn-sec', 20), nodeSec: +one('node-sec', 25), rewardSec: +one('reward-sec', 0), brace: +one('brace', 0),
  };
  if (cfg.legacy) { PACE[1] = { floors: 15, paths: 6, hp: 1 }; for (const a of [2, 3]) delete PACE[a]; }
  for (const s of many('set')) applyOverride(s);
  const result = await simulate(cfg);
  console.log(report(result, cfg));
  if (one('json', false)) {
    const byAct = (s, a) => Object.fromEntries(POOLS.map((p) => [p, avg(s.fights.filter((f) => f.act === a && f.pool === p).map((f) => f.turns))]));
    const slim = Object.fromEntries(Object.entries(result.heroes).map(([h, s]) => [h, {
      runs: s.runs, clear: s.act1Clear, win: s.win, min: s.act1MinCleared, deathsByAct: s.deathsByAct, dieBy: s.dieBy,
      turns: { 1: byAct(s, 1), 2: byAct(s, 2), 3: byAct(s, 3) },
      hpPct: Object.fromEntries([1, 2, 3].map((a) => [a, Object.fromEntries(POOLS.map((p) => [p, avg(s.fights.filter((f) => f.act === a && f.pool === p).map((f) => 100 * f.hpLost / f.maxHp))]))])),
    }]));
    console.log('JSON ' + JSON.stringify(slim));
  }
  if (result.errors.length) process.exit(1);
}
