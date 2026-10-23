# Animation pass — "show, don't make me read"

Player feedback on the Act 1 revamp (v3): **the old act length was fine** (restore it), but the game
**still lacks animation and is boring at times**; **replace reading lots of text with animation**.

Scope: everything a player sees in a run up to the end of **Act 1** (combat animation is global, so
it also lands in Acts 2–4 for free). Keep the game turn-based; keep 60 fps on a mid-range phone at
844×390 / 667×375; respect `settings.speed` (via `timeMul()`/`speedOf()` in the UI) and reduced motion;
every animation is skippable or short enough not to block input (> 1.5 s blocking is a bug).

## Who owns what (do not edit files you don't own)

| Workstream | Owns | May read/import |
|---|---|---|
| **A. Combat animation & VFX** | `src/ui/combat.js`, `src/ui/fx.js`, `src/ui/brace.js`, `src/ui/auto.js`, `src/styles/combat.css`, new `src/ui/vfx*.js`. Minimal additions to engine **emit payloads** in `src/engine/combat.js`/`actions.js` (add fields only; tests must stay green) | sprites, sound |
| **B. Story & screen presentation** | `src/ui/rooms.js`, `src/ui/meta.js`, `src/ui/map.js`, `src/ui/overlay.js`, `src/styles/screens.css`, new `src/ui/story*.js` | fx.js exports (don't edit fx.js; put new helpers in your own file) |
| **C. Narrative trim** | text in `src/data/events/*.js`, `src/data/texts*.js`/hub lines, story beats, act intros, boss intro lines (text only — never change mechanics, ids, flags, choice effects) | everything |
| **D. Pose sprites** | `src/gfx/**` (new `src/gfx/sprites/poses.js` or parametric poses in `characters.js`) | — |
| **E. Balance** | `src/engine/pace.js`, numbers in `src/data/enemies/*.js` and `src/data/heroes.js` (`actions`, Special `v`), `BALANCE_NOTES.md`, `tools/act1-stats.mjs`, `tools/pace-test.mjs`, the pacing block of `tools/engine-test.mjs` | — |

`src/styles/base.css` and `src/main.js`: only append small, clearly commented sections if you must.
Nobody runs git; the lead commits.

## Contract 1 — pose sprites (D produces, A consumes)

Optional extra frames, same `w`/`h` and the **same foot baseline / anchor** as the base sprite so a
frame swap never jitters:

- Heroes: `hero_<id>_atk` (weapon swing / thrust at full extension), `hero_<id>_cast` (arm raised,
  casting glow), `hero_<id>_guard` (defensive, shield/arms up), `hero_<id>_hurt` (recoil) for
  `knight`, `witch`, `wren`, `cantor`.
- Enemies: `en_<id>_atk` (attack frame) for every Act 1 enemy sprite (normals, elites, bosses);
  optionally `en_<id>_hurt`.

A must work with or without these: `hasSprite(id)` (src/ui/gfx.js) decides; fall back to transforms.

## Contract 2 — event text (C writes, B renders)

Event pages keep `text` (string or `(g) => string`), but it is now **short**:

- `text` is split into **beats** on blank lines (`\n\n`, i.e. each `P(...)` paragraph is one beat).
  A beat is **≤ 25 words**; a page has **≤ 3 beats** (≤ 4 on an event's opening page if one is the
  hero-specific line).
- A beat that starts with `@<who>:` is **spoken** by `<who>`: a hero id (`knight`…), an NPC id
  (`hob`, `pell`, `peddler`, `crane`, `maren`, `grall`, `crown`, `mother` → sprite `npc_<id>`), or any
  other lowercase name (shown as a name tag, no portrait), e.g. `@dickon: "Don't suppose you've a knife?"`.
  B strips the marker and shows a speech bubble (portrait if a sprite exists, name tag otherwise).
  Unmarked beats are narration captions.
- The old long text moves to an optional page field **`long`** (same type as `text`). B shows a small
  "📜 Full story" button that opens it in a scroll sheet. Nothing of the story is lost.
- Optional page field `ambient`: `'ash' | 'fog' | 'rain' | 'embers' | 'candles' | 'spirits' | 'snow' |
  'blood' | 'none'` — B picks a sensible default per scene art when absent.
- Choice labels stay `"[Short action] Outcome."` with the action ≤ 5 words and outcomes written in
  these canonical phrases so B can turn them into icon chips:
  `Lose N HP`, `Heal N HP`, `Gain N Max HP`, `Lose N Max HP`, `Gain N Gold`, `Lose N Gold`,
  `Obtain a relic`, `Obtain a Tincture`, `Choose a card`, `Obtain a card`, `Remove a card`,
  `Upgrade a card`, `Transform a card`, `Gain a Curse`, `Fight`, `Learn …` (lore). Anything else
  stays as plain text in the chip row.

The same beat/`@who:` format applies to hub dialogue and story beats wherever they are plain strings.

## What "good" looks like

- Combat: the hero visibly **swings / throws / casts** for every attack, enemies **wind up, lunge and
  hit**, big hits have hit-stop + knockback + punchy numbers, AoE sweeps, statuses fly onto targets,
  Specials are a short cinematic, enemies enter and die with style, the field has ambient life.
- Story: events read like a short animated comic: the scene pans, ash drifts, a portrait talks in
  one-line bubbles, choices are big buttons with icons; outcomes fly into the top bar (coins, hearts,
  cards, relics). The player can tap through an event in ~10–20 seconds.
