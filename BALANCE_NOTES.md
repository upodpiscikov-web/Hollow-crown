# Balance notes — Act 1 revamp, Acts 2-3 recalibration

Measured with `tools/act1-stats.mjs` (below, "the bot"): the engine's own `g.suggestPlay()` plays every fight
(Strike / Guard / Special / cards, potions under 40% HP), simple fixed rules for the map, rewards, shops, rests and
events, **no Brace window** (headless). 20 s per player turn, 25 s per non-combat node. All numbers are deterministic
for a given `--seed`; headline figures are 1000 runs per hero, tables are 500.

## Result in one table

| | before (revamp as handed over) | now | target |
|---|---|---|---|
| Act 1 clear rate (mean of 4 heroes) | 99.8% | **80.7%** (K 79, W 81, Wr 77, C 86) | 70-85% |
| Full 3-act win rate (mean) | 85.5% (K 92, W 93, Wr 86, C 72) | **32.8%** (K 34, W 31, Wr 35, C 30) | 25-40% |
| Spread between heroes | 22 pts | **5 pts** | within ~10 |
| Act 1 turns: easy / hard / elite / boss | 1.6 / 2.0 / 3.4 / 6.8 | **2.4 / 3.0 / 3.7 / 6.3** | 2-3 / 2-3 / 3-4 / 5-7 |
| Act 1 minutes (cleared runs, 20 s/turn + 25 s/node) | 7.2 | **8.3** (9.5 with 12 s per reward screen) | ~15 |

For reference the pre-revamp game (no actions, 15 floors, HP x1; run with the original enemy numbers) scored 24% Act 1 clear and
5% wins (Knight 10%) with the same bot, and ~19.6 minutes for Act 1.

## Final numbers

`src/engine/pace.js` (new optional keys: `hpElite`, `hpBoss`, `dmg`, `dmgElite`, `dmgBoss`; all default 1)

| act | floors / routes | hp | hpElite | hpBoss | dmg | dmgElite | dmgBoss |
|---|---|---|---|---|---|---|---|
| 1 | 9 / 4 | 1 | 0.6 | 0.5 | 1 (damage lives in `enemies/act1.js`) | - | - |
| 2 | 15 / 6 | 1 | 0.7 | 0.65 | 1.6 | 1.15 | - |
| 3 | 15 / 6 | 1 | 0.7 | 0.75 | 1.95 | 1.15 | 1.5 |

Engine: `makeEnemy` applies hp x (hpElite/hpBoss by kind); `moveDmg` applies dmg x (dmgElite/dmgBoss by kind) per hit, min 1.
Act 1 `dmg` stays 1 on purpose: `tools/engine-test.mjs` runs its fixtures in Act 1 and expects raw damage, so Act 1 enemy damage is
written straight into `src/data/enemies/act1.js`. Test for the new keys: `node tools/pace-test.mjs`.

`src/data/heroes.js` (Special numbers moved into `special.v`, `desc` is generated from them)

| hero | Strike | Guard | meterMax | Special |
|---|---|---|---|---|
| Knight | 5 | 3 | 12 | Shield Bash: 12 dmg + 8 Block (unchanged) |
| Witch | 4 | 5 | 10 | Plague Burst: **7** Rot to all + Brew 1 |
| Wren | 4 | 5 | 10 | Shift & Slash: 2 Knives (unchanged) |
| Cantor | 4 | 4 | **7** | Toll the Bell: **11** Block (was 6) |

With these the Special comes up about every 1.5-2.5 turns (the old shared 6 made it fire almost every turn). The UI must read
`value`, `charge`, `max` from `g.actionList()`: Strike/Guard values and the meter size now differ per hero.

`src/data/enemies/act1.js` (HP before pace.js: elites x0.6, bosses x0.5)
- Attack damage is about 2.1x the first draft for normals, 1.75-2x for elites, 1.7-2.2x for bosses (fights are half as long, so each
  enemy turn has to hurt about twice as much to keep the same cost per fight). Biggest hits are capped at 22-32 (a third to under half of a
  hero's HP): Loose 22, Cleaver 26, Cleave 28, Wallow 30, Cudgel 32.
- Effective HP: Hound 13-16, Crow 12-15 (was 9-12, they died before acting), Cultist 44-50 (was 36-40), Rendrick ~60, Bog Mother ~51,
  Choir 3 x 17-23, Bragg 125, Mother of Rats 125, Sheriff 160 (base 320, was 260).
- Signature mechanics re-fitted to the shorter fights (all still fire; checked with a move-frequency audit):
  Mother of Rats' Teeming 50 -> 35 HP per rat (she has half the HP); Hanged Sheriff's Noose is 5 + 5 per card played (6 after Hanging Day),
  keeping "play fewer cards" a real answer; Ash Cultist's Rite +2 -> +3 Might so the "race" still bites inside 2-3 turns;
  Marcher Archer now opens with Loose (he used to be dead before his big shot); the half-HP triggers are relative to max HP and fire in 95-99% of boss fights
  (Blood Frenzy 95%, Hanging Day 99%, The Pit Boils 96%).

## Where the runs end (500 per hero)

| | Knight | Witch | Wren | Cantor |
|---|---|---|---|---|
| died Act 1 / 2 / 3 | 111 / 124 / 106 | 105 / 100 / 140 | 120 / 109 / 93 | 66 / 147 / 134 |
| won | 159 | 155 | 178 | 153 |
| top killers | Bragg 48, Mother of Rats 40, Antlered King 26 | Bragg 43, Rats 34, Zealot Procession 33 | Sheriff 56, Rats 34, Thornwarden 23 | Bragg 38, Abbess 33, Zealot Procession 28 |

All heroes: Act 1 clear 80%, then 70% survive Act 2, 58% survive Act 3 (the last act is the deadliest, as it should be).

Fights, all four heroes, map fights only:

| | turns | % max HP lost | win % |
|---|---|---|---|
| A1 normal (easy / hard) | 2.4 / 3.0 | 2.7 / 11.5 | 100 / 99.4 |
| A1 elite / boss | 3.7 / 6.3 | 24 / 62 | 99.7 / 80.7 |
| A2 normal (easy / hard) | 2.3 / 2.8 | 5.7 / 13.6 | 100 / 97.2 |
| A2 elite / boss | 3.9 / 6.9 | 29 / 50 | 93.3 / 85.0 |
| A3 normal (easy / hard) | 2.4 / 2.7 | 12.9 / 18.3 | 99.5 / 92.5 |
| A3 elite / boss | 4.0 / 6.6 | 19 / 47 | 93.8 / 87.0 |

Act 1 per fight (all heroes): Hounds 2.3 turns, Cultist 2.7, Coughing Dead 2.4, Robber 2.1, Leech+Crow 2.4; hard 2.4-3.8; Rendrick 3.5,
Bog Mother 3.8, Choir 3.7; Bragg 6.1, Mother of Rats 6.4, Sheriff 6.4 (boss win 77 / 80 / 86%).

## Do Act 1 enemies still need different answers? Yes

Hounds: kill the pair together (Pack Might). Crows: kill first or they feed. Coughing Dead: bank the free Strike to finish it at 1 HP (it
rises in ~20% of fights, when you cannot). Cultist: race the Rite. Cutthroat: keep a little Block (Backstab). Archer: opens with a 22 shot,
kill/Block/Brace. Leech: heals off unblocked damage. Robber, Militiaman, Rats keep their gold / shield / Rot rules. Elites and bosses keep
their phases. Because Strike/Guard are not cards, the Sheriff's Noose and Rendrick's Choke are the places where hero actions beat card spam.

## The 15-minute target cannot be met together with the turn targets

At 20 s per turn, normal fights of 2-3 turns, elites of 3-4 and a boss of 5-7 on a 9-floor map are about 8-10 minutes (~19 turns +
~4.5 non-combat nodes). Every extra floor is worth about 0.9 minute: 11 floors = 11.2 min, 13 floors = 13.0 min (with 12 s per reward
screen; clear rate stays 76-80%). I kept the turn targets and the 9 floors; if 15 minutes matters more, change `floors` in `pace.js` to 12-14.

## Remaining concerns

1. **Brace is worth a lot and is not in the numbers.** With the headless bot the figures above hold. If the human taps the window in time 60% of
   the time (`--brace 0.6`), Act 1 clear goes to 96% and the win rate to 66%; at 50% it is 94% / 60%. Windows open about 0.5 per player turn
   (~2 per fight) because most Act 1 hits now clear the 8 HP threshold. Multiplying every enemy attack by 1.22 puts a 50% Brace player back
   at 79% / 30% (`--brace 0.5 --scale-dmg 1.22`). Either keep Brace as a skill bonus, or lower `BRACE_MUL` benefit / raise the window threshold.
   Win rate moves 15-20 pts for every 10% of enemy damage, so this is the single most sensitive knob.
2. **Cantor is above the Act 1 band (86%) and weakest in Act 2** (Abbess, Antlered King). His Act 1 comes from his starter deck, not the
   action numbers (Strike/Guard changes barely move it); I capped the Toll at 11 Block and gave him a short meter (7) so his strength sits in the later acts.
3. **Knight is the slow hero** (easy 2.9, hard 3.4, elite 4.2, boss 7.1 turns): slightly over the turn targets; faster Strike costs Guard.
4. **Parity is policy-dependent.** With the old `tools/sim.mjs` bot (random drafts) the wins are Knight 28 / Witch 53 / Wren 20 / Cantor 36%,
   so Witch (Rot) is the most forgiving hero and Wren (loses most to the Sheriff, which punishes card count) the least.
5. Act 4 (the descent) was not touched and still uses the old 1.0 pacing; with the new hero buttons it will be easy.
6. Act 1 now has several 20+ single hits. They are telegraphed and answerable, but check them in a real playtest (and the Brace window
   frequency) before locking the numbers. The Sheriff's Warrant cards are never played by the bot (it skips status cards), so he is a bit
   stronger here than against a human.
7. `REVAMP.md` still says Strike/Guard are 4/4 and the meter is 6: those are now only the defaults for heroes without an `actions` entry.

## Reproduce

```
node tools/act1-stats.mjs --runs 500 --enc --acts        # everything above (about 5 min; --hero knight for one hero, --act1 for Act 1 only)
node tools/act1-stats.mjs --runs 300 --act1 --enc        # Act 1 per encounter, 1 min
node tools/act1-stats.mjs --legacy                       # the pre-revamp game with the same bot (use the original act1.js numbers for a true baseline)
node tools/act1-stats.mjs --brace 0.6 --scale-dmg 1.2    # what-ifs; --set pace.2.dmg=1.5 --set hero.knight.actions.guard.blk=4 ... to tune
node tools/engine-test.mjs && node tools/pace-test.mjs && node tools/sim.mjs --validate-only
```
