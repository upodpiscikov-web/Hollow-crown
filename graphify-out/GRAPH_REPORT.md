# Graph Report - hollow-crown  (2026-10-22)

## Corpus Check
- 61 files · ~255,959 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: .css 5, .woff2 4, (none) 1)

## Summary
- 1055 nodes · 2635 edges · 41 communities (40 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 58 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `36aa6e3b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Procedural Audio Engine
- Relics and Modifiers
- Act 3 Enemies
- Sprite and Icon Loader
- Combat Screen UI
- Icon Art Library
- Act 2 Enemies
- Act 2 Events
- rooms.js
- overlay.js
- Act 1 Events
- Hub and Meta Screens
- Knight Cards and Oaths
- App Boot and Lore
- Shared Cards and Story Content
- Witch Cards and Brewing
- Act 1 Enemies
- Scenes and Backgrounds
- Cantor Cards and Bleed
- Wren Cards and Masks
- text.js
- sim.mjs
- story.js
- Pixel Painter
- build.mjs
- hub.js
- Content API Reference
- Hub Dialogue and Deep Truth
- stage
- Sprite Rendering
- Sprite API and Palette
- Project Config
- vercel.json
- potions.js
- Acts and Balance Design
- erng
- Story Events and Meta Flags
- Neutral Cards and Curses
- The Hollow Crown (artifact)
- Combat Rules and Mechanics
- Wren, Maren and Antlered King

## God Nodes (most connected - your core abstractions)
1. `h()` - 64 edges
2. `$$` - 31 edges
3. `tap()` - 31 edges
4. `pick()` - 29 edges
5. `safe()` - 27 edges
6. `draw()` - 24 edges
7. `mvoice()` - 23 edges
8. `sfx()` - 23 edges
9. `Painter` - 22 edges
10. `anim()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Potion/Tincture Definition Schema (definePotions)` --references--> `definePotions()`  [EXTRACTED]
  CONTENT_API.md → src/engine/registry.js
- `Card Definition Schema (defineCards)` --references--> `defineCards()`  [EXTRACTED]
  CONTENT_API.md → src/engine/registry.js
- `Relic Definition Schema (defineRelics)` --references--> `defineRelics()`  [EXTRACTED]
  CONTENT_API.md → src/engine/registry.js
- `Status Hooks (defineStatuses)` --references--> `defineStatuses()`  [EXTRACTED]
  CONTENT_API.md → src/engine/registry.js
- `Enemy Definition Schema (defineEnemies)` --references--> `defineEnemies()`  [EXTRACTED]
  CONTENT_API.md → src/engine/registry.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The Deep Truth: the Pale Mother's heart, the Crown, and the Unspent** — design_aldane_founder, design_pale_mother, design_hollow_crown, design_unspent, design_queen_maren, design_wren_changeling [EXTRACTED 1.00]
- **Hero signature mechanics (Oaths, Rot/Brew, Masks, Spirits)** — design_oaths, design_rot_brew_wither, design_masks, design_spirits, design_combat_rules [EXTRACTED 1.00]
- **Four heir Truths unlock the True Ending** — story_outline_knight_arc, story_outline_witch_arc, story_outline_wren_arc, story_outline_cantor_arc, design_true_ending [INFERRED 0.95]

## Communities (41 total, 1 thin omitted)

### Community 0 - "Procedural Audio Engine"
Cohesion: 0.06
Nodes (72): applyMusic(), applyVolumes(), bell(), brass(), build(), celesta(), checkIdle(), choir() (+64 more)

### Community 1 - "Relics and Modifiers"
Cohesion: 0.06
Nodes (20): atkMul(), cardAdded(), cardExhausted(), cardPlayed(), CHEST_CURSES, chestOpened(), combatEnd(), enemyDied() (+12 more)

### Community 2 - "Act 3 Enemies"
Cohesion: 0.08
Nodes (43): againOf(), ai(), allies(), asMinionOf(), block(), buff(), choirSync(), cleanse() (+35 more)

### Community 3 - "Sprite and Icon Loader"
Cohesion: 0.14
Nodes (30): TEXTS, ROMAN, bgStyle(), cache, hasSprite(), icon(), potionIcon(), relicIcon() (+22 more)

### Community 4 - "Combat Screen UI"
Cohesion: 0.12
Nodes (33): INTENT_GLYPH, INTENT_ICON, INTENT_WORD, $$, anim(), longPress(), sleep(), UI (+25 more)

### Community 5 - "Icon Art Library"
Cohesion: 0.06
Nodes (32): art(), ball(), BASE, bay(), BAYER, bloom(), BR, cyl() (+24 more)

### Community 6 - "Act 2 Enemies"
Cohesion: 0.10
Nodes (20): abbessPhase2(), addCards(), ai(), block(), buff(), countCards(), debuff(), draw() (+12 more)

### Community 7 - "Act 2 Events"
Cohesion: 0.12
Nodes (38): addCurse(), beltFull(), curseId(), curseName(), deckReq(), foes(), fx(), giveRelic() (+30 more)

### Community 8 - "rooms.js"
Cohesion: 0.17
Nodes (29): append(), fmtTime(), h(), safe(), actTitle(), openMapPeek(), applyHubLine(), confirmBox() (+21 more)

### Community 9 - "overlay.js"
Cohesion: 0.18
Nodes (27): Stage DOM Layers (#stage, #screen, #fx, #overlay, #toasts, #particles), choose(), cardDetail(), sortCards(), upgradedCopy(), clear(), tap(), open() (+19 more)

### Community 10 - "Act 1 Events"
Cohesion: 0.16
Nodes (24): byHero(), curse(), curses(), fight(), FOES, fx(), hasGold(), hasHp() (+16 more)

### Community 11 - "Hub and Meta Screens"
Cohesion: 0.08
Nodes (27): ENCOUNTERS, ENEMIES, LORE, POTIONS, RELICS, RENOWN_LEVELS, pickRandom(), initDev() (+19 more)

### Community 12 - "Knight Cards and Oaths"
Cohesion: 0.11
Nodes (15): endBlock(), fulfil(), heldOaths(), incoming(), isOath(), K, OATH_POOL, oathFulfilled() (+7 more)

### Community 13 - "App Boot and Lore"
Cohesion: 0.12
Nodes (24): applySettings(), boot, currentName(), g, go(), mount(), render(), requestRender() (+16 more)

### Community 14 - "Shared Cards and Story Content"
Cohesion: 0.12
Nodes (9): defineCards(), defineEncounters(), defineEnemies(), defineHeroes(), defineLore(), definePotions(), defineRelics(), defineStatuses() (+1 more)

### Community 15 - "Witch Cards and Brewing"
Cohesion: 0.13
Nodes (14): BASE_DRAUGHTS, cardPlayed(), combatStart(), debuffCount(), grow(), isDraught(), keepAll(), keepRot() (+6 more)

### Community 16 - "Act 1 Enemies"
Cohesion: 0.15
Nodes (14): ai(), count(), draw(), flee(), fx(), hpLost(), leechFig(), ratFig() (+6 more)

### Community 17 - "Scenes and Backgrounds"
Cohesion: 0.14
Nodes (28): BG, BY, C(), crow(), deadTree(), dk(), dome(), draw() (+20 more)

### Community 18 - "Cantor Cards and Bleed"
Cohesion: 0.20
Nodes (18): bleed(), BLEED_GUARD, cardExhausted(), cardPlayed(), channelN(), enemyDied(), grow(), hpLost() (+10 more)

### Community 19 - "Wren Cards and Masks"
Cohesion: 0.13
Nodes (12): addKnives(), chooseMask(), MASK_IDS, maskIs(), onAttacked(), play(), returnToHand(), shift() (+4 more)

### Community 20 - "text.js"
Cohesion: 0.11
Nodes (23): HEROES, canShowUpgrade(), cardEl(), costInfo(), heroColor(), RAR_ORDER, TYPE_LABEL, TYPE_ORDER (+15 more)

### Community 21 - "sim.mjs"
Cohesion: 0.06
Nodes (43): hero(), combatMethods, DRAUGHTS, MASKS, OWNER_ONLY, SPIRITS, freshMeta(), Game (+35 more)

### Community 22 - "story.js"
Cohesion: 0.08
Nodes (14): CANTOR, curse(), curseId(), curseName(), HEIRS, HNAME, hurt(), KNIGHT (+6 more)

### Community 23 - "Pixel Painter"
Cohesion: 0.17
Nodes (6): Painter, postProcess(), rgba(), shadeColor(), finishLayer(), lt()

### Community 24 - "build.mjs"
Cohesion: 0.07
Nodes (26): body, cssLinks, html, js, OUT, ROOT, SRC, cssLinks (+18 more)

### Community 25 - "hub.js"
Cohesion: 0.15
Nodes (16): allTruths(), as(), BARK, beat(), died(), diedInEvent(), F(), HEROES (+8 more)

### Community 26 - "Content API Reference"
Cohesion: 0.19
Nodes (12): Content API - The Hollow Crown, Shared Art Keys (card art, icons, scenes, portraits), Card Definition Schema (defineCards), Event Definition Schema (defineEvents), Game Object g, Lore Chronicle (defineLore), Potion/Tincture Definition Schema (definePotions), Relic Definition Schema (defineRelics) (+4 more)

### Community 27 - "Hub Dialogue and Deep Truth"
Cohesion: 0.16
Nodes (19): Hub Dialogue (defineHubLines), Texts (defineTexts), Act 4 - Beneath the Throne, Aldane the Founder, Brother Cael, the Gravecantor (WITNESS), Hob the Gravekeeper, The Hollow King (final boss), The Pale Peddler (+11 more)

### Community 28 - "stage"
Cohesion: 0.33
Nodes (6): allTruths(), beatFlags(), heirsAt(), mf(), stage(), totalBeats()

### Community 29 - "Sprite Rendering"
Cohesion: 0.13
Nodes (18): BAYER, cache, canvasCache, draw(), renderSprite(), spriteCanvas(), spriteEl(), SPRITES (+10 more)

### Community 30 - "Sprite API and Palette"
Cohesion: 0.27
Nodes (8): Sprite ID Naming Convention, Sprites and Painter API (defineSprites), defineSprites(), mix(), PAL, draw(), sh(), inkC()

### Community 31 - "Project Config"
Cohesion: 0.17
Nodes (11): devDependencies, esbuild, name, private, scripts, build, dev, sim (+3 more)

### Community 32 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, headers, installCommand, outputDirectory

### Community 34 - "Acts and Balance Design"
Cohesion: 0.40
Nodes (5): Encounter Definition Schema (defineEncounters), Enemy Definition Schema (defineEnemies), Act 1 - The Ashen Marches, Content Targets, Run Structure (Acts, 15-floor branching map)

### Community 35 - "erng"
Cohesion: 0.67
Nodes (3): erng(), FOES, offerHeroCards()

### Community 36 - "Story Events and Meta Flags"
Cohesion: 0.27
Nodes (11): Story Events and Meta Flags, Act 3 - Ashgrave, Aldous Vane, the Knight (BLOOD), Ashfall (night of the king's death), The Blight, Isolde Marrow, the Plague Witch (KIN), Mattias Grall, the Witchfinder General, Lord Severin Crane, the Regent (+3 more)

### Community 38 - "Neutral Cards and Curses"
Cohesion: 0.24
Nodes (7): CURSE, endTurnInHand(), isDebuff(), play(), statusApplied(), toHand(), STATUSES

### Community 39 - "The Hollow Crown (artifact)"
Cohesion: 0.16
Nodes (11): The Hollow Crown - Design Bible, Ashgrave (capital), Long Live the King (Crown ending), The Hollow Crown (artifact), King Aldric IV, the Long King, Kingdom of Morrow, The Undercroft, index.html (app shell) (+3 more)

### Community 40 - "Combat Rules and Mechanics"
Cohesion: 0.39
Nodes (3): Combat Actions API, Combat Rules (Slay-the-Spire-like), Status Table

### Community 41 - "Wren, Maren and Antlered King"
Cohesion: 0.60
Nodes (6): Act 2 - The Weeping Wood and the Drowned Abbey, The Antlered King, The Pale Mother (Lady Under the Hill), Queen Maren, Wren, the Changeling (WARD), Wren Arc (wren_1 - truth_wren)

## Knowledge Gaps
- **1 isolated node(s):** `Act 1 - The Ashen Marches`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 320 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pick()` connect `sim.mjs` to `Relics and Modifiers`, `Act 3 Enemies`, `erng`, `Neutral Cards and Curses`, `Act 2 Enemies`, `Act 2 Events`, `Act 1 Events`, `Knight Cards and Oaths`, `Wren Cards and Masks`, `story.js`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `Act 1 - The Ashen Marches` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Procedural Audio Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.05593008739076155 - nodes in this community are weakly interconnected._
- **Why does `CARDS` connect `Act 1 Events` to `Relics and Modifiers`, `Combat Screen UI`, `Act 2 Events`, `rooms.js`, `overlay.js`, `Hub and Meta Screens`, `App Boot and Lore`, `Shared Cards and Story Content`, `text.js`, `sim.mjs`, `story.js`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `Relics and Modifiers` be split into smaller, more focused modules?**
  _Cohesion score 0.06236786469344609 - nodes in this community are weakly interconnected._
- **Why does `defineSprites()` connect `Sprite API and Palette` to `Act 3 Enemies`, `Icon Art Library`, `Act 2 Enemies`, `Act 1 Enemies`, `Scenes and Backgrounds`, `build.mjs`, `Sprite Rendering`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Should `Act 3 Enemies` be split into smaller, more focused modules?**
  _Cohesion score 0.08244680851063829 - nodes in this community are weakly interconnected._