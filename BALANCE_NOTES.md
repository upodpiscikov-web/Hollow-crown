# Balance notes — full-length Act 1 with short fights (v4)

Measured with `tools/act1-stats.mjs` (below, "the bot"): the engine's own `g.suggestPlay()` plays every fight
(Strike / Guard / Special / cards, potions under 40% HP), simple fixed rules for the map, rewards, shops, rests and
events, **no Brace window** (headless) unless `--brace P` is given. 20 s per player turn, 25 s per non-combat node.
Deterministic for a given `--seed`; headline figures are 1000 runs per hero, tables 500.

v4 change: the playtest said the old act length was fine, so Act 1 is back to the pre-revamp map (15 floors, 6 routes)
while each fight stays short. The longer act means more fights, more attrition and a stronger deck at Act 2, so Act 1
bosses were softened a little and Acts 2-3 hit a little harder.

## Result in one table

| | v3 (9 floors) | v4 map only, no retune | **v4 (now)** | target |
|---|---|---|---|---|
| Act 1 clear rate (mean) | 80.7% | 75.7% (Wren 71.8) | **79.3%** (K 80.6, W 75.7, Wr 76.9, C 83.8) | 75-85% |
| Full 3-act win rate (mean) | 32.8% | 35.7% | **31.7%** (K 32.8, W 29.9, Wr 34.9, C 29.3) | 25-40% |
| Spread between heroes | 5.2 pts | 5.7 pts | **5.6 pts** | within ~10 |
| Act 1 turns: easy / hard / elite / boss | 2.4 / 3.0 / 3.7 / 6.3 | 2.4 / 3.0 / 3.4 / 5.9 | **2.4 / 2.9 / 3.5 / 6.0** | 2-3 / 2-3 / 3-4 / 5-7 |
| Fights in Act 1 (cleared runs) | 5.7 | 9.3 | **9.3** | |
| Act 1 minutes (20 s/turn + 25 s/node) | 8.3 | 12.7 | **12.7** (14.8 with 12 s per reward screen) | ~15 |
| Win rate with a 50% Brace player | 60.1% | - | **58.5%** (K 64, W 54, Wr 64, C 52) | under ~60% |

Act 1 duration per hero (cleared runs): Knight 14.3 min (33.7 turns), Wren 12.7, Witch 12.2, Cantor 11.7; about
26-34 player turns + 7 non-combat nodes. Adding ~12 s per card-reward screen gives 13.7-16.4 min (mean 14.8).

History: the revamp as handed over (v2) cleared Act 1 99.8% and won 85.5%; the pre-revamp game (no hero actions,
original enemies) cleared 24% and won 5% with the same bot.

## Final numbers

`src/engine/pace.js` (optional keys `hpElite`, `hpBoss`, `dmg`, `dmgElite`, `dmgBoss`; all default 1)

| act | floors / routes | hp | hpElite | hpBoss | dmg | dmgElite | dmgBoss |
|---|---|---|---|---|---|---|---|
| 1 | **15 / 6** (was 9 / 4) | 1 | 0.6 | 0.5 | 1 (damage lives in `enemies/act1.js`) | - | - |
| 2 | 15 / 6 | 1 | 0.7 | 0.65 | **1.7** (was 1.6) | 1.15 | - |
| 3 | 15 / 6 | 1 | 0.7 | 0.75 | **2.05** (was 1.95) | 1.15 | 1.5 |

Engine: `makeEnemy` applies hp x (hpElite/hpBoss by kind); `moveDmg` applies dmg x (dmgElite/dmgBoss by kind) per hit, min 1.
Act 1 `dmg` stays 1 because `tools/engine-test.mjs` runs its fixtures in Act 1 and expects raw damage.

`src/engine/actions.js`: **`BRACE_MUL` 0.6 -> 0.64** (a braced hit now deals 64%, i.e. -36% instead of -40%). See concern 1.

`src/data/heroes.js` (unchanged in v4)

| hero | Strike | Guard | meterMax | Special |
|---|---|---|---|---|
| Knight | 5 | 3 | 12 | Shield Bash: 12 dmg + 8 Block |
| Witch | 4 | 5 | 10 | Plague Burst: 7 Rot to all + Brew 1 |
| Wren | 4 | 5 | 10 | Shift & Slash: 2 Knives |
| Cantor | 4 | 4 | 7 | Toll the Bell: 11 Block |

The Special comes up about every 1.5-2.5 turns. The UI must read `value`, `charge`, `max` from `g.actionList()`.

`src/data/enemies/act1.js` (HP before pace.js: elites x0.6, bosses x0.5)
- Attack damage is about 2x the first draft (fights are half as long, so each enemy turn has to hurt about twice as much).
  Biggest single hits: Loose 22, Cleaver 24, Cleave 28, Wallow 30, Cudgel 32.
- v4 softening of the Act 1 bosses (they killed more once the act got longer): Bragg Cleaver 26 -> 24, Sic 'Em 14 -> 13,
  Frenzied Hacking 12 -> 11 x2; Mother of Rats Plague Kiss 20 -> 18, Tide of Teeth 8 -> 7 x4; the Sheriff's Noose 5 + 4 per
  card played (5 per card after Hanging Day; was 5 / 6).
- From v3, unchanged: Crow HP 12-15, Cultist 44-50, Sheriff base 320 (160 in play); Teeming 35 HP per rat; Cultist Rite +3;
  the Archer opens with Loose. Half-HP triggers (Blood Frenzy, Hanging Day, The Pit Boils) still fire in 95-99% of boss fights.

## Where the runs end (500 per hero)

| | Knight | Witch | Wren | Cantor |
|---|---|---|---|---|
| died Act 1 / 2 / 3 | 90 / 141 / 114 | 110 / 90 / 149 | 124 / 104 / 93 | 92 / 158 / 106 |
| won | 155 | 151 | 179 | 144 |
| top killers | Bragg 28, Abbess 28, Rival 24 | Bragg 37, Zealot Procession 30, Rival 23 | Sheriff 36, Rats 24, Bragg 22 | Bragg 40, Antlered King 35, Zealot Procession 26 |

All heroes: 79% clear Act 1, 69% of those survive Act 2, 58% of those survive Act 3.

| map fights, all heroes | turns | % max HP lost | win % |
|---|---|---|---|
| A1 easy / hard | 2.4 / 2.9 | 2.7 / 10.8 | 100 / 98.9 |
| A1 elite / boss | 3.5 / 6.0 | 22 / 51 | 97.7 / 85.0 |
| A2 easy / hard | 2.2 / 2.8 | 6.1 / 14.5 | 100 / 96.6 |
| A2 elite / boss | 3.7 / 6.6 | 30 / 51 | 93.6 / 85.0 |
| A3 easy / hard | 2.4 / 2.6 | 13.4 / 18.0 | 99.5 / 92.6 |
| A3 elite / boss | 4.0 / 6.4 | 19 / 51 | 95.9 / 84.0 |

Act 1 per fight: easy 2.1-2.7 turns, hard 2.3-3.6, Rendrick 3.3, Bog Mother 3.6, Choir 3.5; Bragg 5.7, Mother of Rats 6.1,
Sheriff 6.1 turns (boss win 80 / 87 / 88%).

## Do Act 1 enemies still need different answers? Yes

Hounds: kill the pair together (Pack Might). Crows: kill first or they feed. Coughing Dead: bank the free Strike to finish it at 1 HP.
Cultist: race the Rite. Cutthroat: keep a little Block (Backstab). Archer: opens with a 22 shot, so kill, Block or Brace. Leech: heals off
unblocked damage. Robber, Militiaman and Rats keep their gold, shield and Rot rules. Elites and bosses keep their phases. Strike and Guard
are not cards, so the Sheriff's Noose and Rendrick's Choke reward hero actions over card spam.

## Remaining concerns

1. **Brace is still a big bonus.** At 50% success the mean win rate is 58.5%, but Knight and Wren are at 64%. Windows open about 0.5 per
   player turn. `BRACE_MUL` 0.7 measures 54% mean (max 60%), but `tools/engine-test.mjs`'s Brace block (not mine) expects a braced 10 to
   become 6 (`hp 74`): 0.64 is the strongest cut that keeps it green. If you want 0.7, change that expectation to 73. Also
   `src/ui/brace.js` hardcodes `0.6` / "−40%"; it should import `BRACE_MUL` (workstream A).
2. **Cantor** is the strongest in Act 1 (84%) and the weakest afterwards (Antlered King, Abbess); his Act 1 comes from his starter deck.
3. **Knight is the slow hero** (Act 1: 2.9 / 3.4 / 4.0 / 6.8 turns), at the top of the turn targets.
4. The longer act makes the bot drink 6-7 tinctures per run (it drinks below 40% HP); shops/rests now do more of the work.
5. **Parity is policy-dependent.** The old `tools/sim.mjs` bot (random drafts) gives Knight 27 / Witch 55 / Wren 20 / Cantor 25%.
6. Act 4 (the descent) is untouched. The bot never plays the Sheriff's Warrants (it skips status cards), so he is a bit stronger here than
   against a human.
7. `REVAMP.md` still describes the 9-floor Act 1 and 4/4/6 actions.

## Reproduce

```
node tools/act1-stats.mjs --runs 500 --enc --acts        # everything above (~6 min; --hero knight for one hero, --act1 for Act 1 only)
node tools/act1-stats.mjs --runs 300 --act1 --reward-sec 12   # Act 1 duration incl. reward screens
node tools/act1-stats.mjs --brace 0.5                    # a 50% Brace player; --scale-dmg 1.2 / --set pace.2.dmg=1.6 ... for what-ifs
node tools/engine-test.mjs && node tools/pace-test.mjs && node tools/sim.mjs --validate-only
```
