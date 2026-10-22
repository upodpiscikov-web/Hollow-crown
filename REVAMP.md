# Act 1 Revamp — "less boring, less tiring, less overwhelming"

Player feedback after the first playtest: fights drag on, there is too much on screen, and
every turn feels the same (Strike/Defend). They want hero control buttons (not only cards),
speed/auto buttons, and a timed Brace button. They do NOT want a whole new game: keep it
turn-based deckbuilding, change as little as possible, try it on **Act 1 only**, then review.

Answers they gave: fights drag on / too much on screen / same cards no choices; wants hero action
buttons + speed & auto buttons + timed Brace; an act should take about **15 minutes**.

## What changed in the engine (done, tested: `node tools/engine-test.mjs`)

| Feature | Where | Notes |
|---|---|---|
| Hero actions Strike / Guard / Special | `src/engine/actions.js`, hero entries in `src/data/heroes.js` | Strike & Guard: free, once per turn (4 dmg / 4 Block). Special: hero move, usable when the **Momentum meter** is full (max 6). |
| Momentum meter | `cb.act.meter` | +1 per card played, +1 per Strike/Guard, +1 per enemy hit taken, +2 per successful Brace. Resets per combat; Special resets it to 0. |
| Timed Brace | `braceWindow()` in `combat.js` | Before a heavy enemy attack the engine awaits `g.ui.brace(...)`. Success → that attack deals 60% damage and +2 meter. At most 2 windows per enemy phase; light hits never trigger it. |
| Auto suggestions | `g.suggestPlay()` | Heuristic "next sensible move" for the Auto button. |
| Pacing | `src/engine/pace.js` | Act 1: 9 floors, 4 routes, enemy HP ×0.7. Other acts unchanged (until approved). |
| Opening card choice | `run.screen === 'starter'` | Each run starts by picking 1 of 3 hero cards (attack / skill / power), then the blessing. |

Heroes' Specials: Knight **Shield Bash** (12 dmg + 8 Block, targets an enemy), Witch **Plague Burst**
(6 Rot to all + Brew 1), Wren **Shift & Slash** (next Mask + 2 Knives), Cantor **Toll the Bell**
(Release all, Channel a Wisp, 6 Block).

## Engine API for the UI

```js
g.actionList()
// → [{ id:'strike'|'guard'|'special', name, icon, desc, target:'enemy'|'none',
//      ready:boolean, used?:boolean, value?:number, charge?:number, max?:number }]
await g.useAction(id, targetUid)       // false if not allowed; single living enemy auto-targets
g.hasPlayableCard(); g.hasFreeAction() // for Auto-End: nothing left worth waiting for
g.suggestPlay()                        // → { kind:'card', card, target } | { kind:'action', id, target } | null
// events via g.onEmit:  'action' {id,target}   'meter' {meter,max,full}   'braceOk' {e}   'braceMiss' {e}
// UI hook (optional, async):
g.ui.brace = async ({ enemy, dmg, times, ms }) => boolean   // resolve true if the player tapped in time
// settings (g.meta.settings): timedBrace (bool), braceMs (900|1400|2000), autoEnd (bool), speed (1|2|3), fast (legacy)
g.pickStarter(i)  // screen 'starter': run.starter = [{id, up}] (3 options), then screen becomes 'blessing'
```
Headless play (sim, tests) has no `g.ui.brace`, so the Brace window is skipped there.

## UI brief (combat screen first, Act 1 must feel great at 844×390 and 667×375)

1. **Action bar**: three thumb-sized buttons (≥ 48 px) Strike / Guard / Special, beside the hand, always visible
   in combat. Show icon, value, ready/used state; Special has a charge ring with `charge/max`, pulses
   when full. Tapping Strike with several enemies asks for a target the same way cards do.
2. **Brace window**: large centered "BRACE!" button with a shrinking ring for `ms`, shown over the attacking
   enemy's wind-up. Tap in time → resolve `true`, flash "Braced!" and show the damage reduction. No tap → `false`
   silently. Honour reduced-motion and the `timedBrace` setting.
3. **Speed / Auto / Auto-End**: ⏩ button cycles 1×/2×/3× (scales all waits & animations, persisted in
   `settings.speed`); **Auto** plays `suggestPlay()` moves one by one with normal animations (max 30 steps, stops at
   any card that asks the player to choose); **Auto-End** toggle ends the turn once `!hasPlayableCard() && !hasFreeAction()`.
4. **Declutter ("Simple view", default ON, toggle in Settings)**: hand cards show art, name, cost and big *effect
   chips* (⚔ 6, 🛡 5, keyword icons); the full rules text only when a card is selected or long-pressed. Top bar:
   HP, gold, potion pips; relics collapse into one button with a count that opens a sheet. Statuses: at most 4
   icons then "+N". Enemy: HP bar + a large, clear intent. No text under ~10 px anywhere. Fix the map header
   overlapping the first nodes.
5. **Faster feel**: shorter enemy-phase delays, skip the "Your Turn" banner after turn 1, skip most banners
   at speed ≥ 2.
6. **Starter screen**: "Choose your first card" with the 3 options (big cards), then continue to the blessing.
7. Settings: add Timed Brace (on/off + window Quick/Normal/Generous), Auto-End, Simple view, Speed.

## Balance brief (Act 1 pacing)

Targets: a normal fight ends in **2–3 turns**, an elite in 3–4, a boss in 5–7 (a competent player). Act 1 total
≈ 15 minutes (≈ 20 s per turn, ≈ 25 s per event/shop/rest node). Use `g.suggestPlay()` as the "competent
player" policy in sims. Because Strike/Guard/Special make every hero stronger in *every* act, calibrate
`pace.js` for Acts 2–3 as well (they currently get no discount): keep them challenging.

Everything must stay deterministic and `node tools/sim.mjs --validate-only` must report 0 problems.
