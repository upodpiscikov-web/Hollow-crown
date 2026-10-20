# Graph Report - hollow-crown  (2026-10-20)

## Corpus Check
- 60 files · ~170,062 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: .woff2 4, (none) 1, .css 1)

## Summary
- 943 nodes · 2386 edges · 42 communities (41 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Procedural Audio Engine
- Relics and Modifiers
- Act 3 Enemies
- Sprite and Icon Loader
- Combat Screen UI
- Icon Art Library
- Act 2 Enemies
- Act 2 Events
- Dev Panel and Events UI
- Card Rendering
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
- Combat Engine Core
- Game Class and Saves
- Map Generation and RNG
- Pixel Painter
- Build and PWA Pipeline
- Map Screen
- Content API Reference
- Hub Dialogue and Deep Truth
- Headless Simulator
- Sprite Rendering
- Sprite API and Palette
- Project Config
- Icon and PNG Tools
- Potions and Statuses
- Acts and Balance Design
- Hero Arcs and Endings
- Knight, Crown and Loop Lore
- Sprite Sheet Tool
- Neutral Cards and Curses
- App Shell and PWA Design
- Combat Rules and Mechanics
- Wren, Maren and Antlered King

## God Nodes (most connected - your core abstractions)
1. `h()` - 63 edges
2. `$$` - 31 edges
3. `tap()` - 31 edges
4. `pick()` - 27 edges
5. `safe()` - 27 edges
6. `mvoice()` - 23 edges
7. `sfx()` - 23 edges
8. `Painter` - 22 edges
9. `anim()` - 22 edges
10. `modal()` - 20 edges

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

## Communities (42 total, 1 thin omitted)

### Community 0 - "Procedural Audio Engine"
Cohesion: 0.06
Nodes (72): applyMusic(), applyVolumes(), bell(), brass(), build(), celesta(), checkIdle(), choir() (+64 more)

### Community 1 - "Relics and Modifiers"
Cohesion: 0.06
Nodes (20): atkMul(), cardAdded(), cardExhausted(), cardPlayed(), CHEST_CURSES, chestOpened(), combatEnd(), enemyDied() (+12 more)

### Community 2 - "Act 3 Enemies"
Cohesion: 0.08
Nodes (36): againOf(), ai(), allies(), asMinionOf(), block(), buff(), choirSync(), cleanse() (+28 more)

### Community 3 - "Sprite and Icon Loader"
Cohesion: 0.18
Nodes (32): longPress(), bgStyle(), cache, hasSprite(), icon(), potionIcon(), relicIcon(), spr() (+24 more)

### Community 4 - "Combat Screen UI"
Cohesion: 0.12
Nodes (30): ENEMIES, TEXTS, combatScreen, INTENT_ICON, INTENT_WORD, anim(), sleep(), UI (+22 more)

### Community 5 - "Icon Art Library"
Cohesion: 0.08
Nodes (25): art(), ball(), BASE, bay(), BAYER, bloom(), DARKER, ground() (+17 more)

### Community 6 - "Act 2 Enemies"
Cohesion: 0.10
Nodes (20): abbessPhase2(), addCards(), ai(), block(), buff(), countCards(), debuff(), draw() (+12 more)

### Community 7 - "Act 2 Events"
Cohesion: 0.11
Nodes (24): addCurse(), beltFull(), curseId(), curseName(), foes(), fx(), giveRelic(), giveTinctures() (+16 more)

### Community 8 - "Dev Panel and Events UI"
Cohesion: 0.19
Nodes (26): EVENTS, fmtTime(), h(), tap(), initDev(), open(), opts(), row() (+18 more)

### Community 9 - "Card Rendering"
Cohesion: 0.16
Nodes (26): HEROES, canShowUpgrade(), cardDetail(), cardEl(), costInfo(), heroColor(), RAR_ORDER, sortCards() (+18 more)

### Community 10 - "Act 1 Events"
Cohesion: 0.17
Nodes (23): byHero(), curse(), curses(), fight(), FOES, fx(), hasGold(), hasHp() (+15 more)

### Community 11 - "Hub and Meta Screens"
Cohesion: 0.09
Nodes (26): HUB_LINES, randomSeed(), $$, append(), cap(), pickRandom(), ROMAN, applyHubLine() (+18 more)

### Community 12 - "Knight Cards and Oaths"
Cohesion: 0.11
Nodes (15): endBlock(), fulfil(), heldOaths(), incoming(), isOath(), K, OATH_POOL, oathFulfilled() (+7 more)

### Community 13 - "App Boot and Lore"
Cohesion: 0.12
Nodes (24): LORE, applySettings(), boot, choose(), currentName(), g, go(), mount() (+16 more)

### Community 14 - "Shared Cards and Story Content"
Cohesion: 0.15
Nodes (8): defineCards(), defineEncounters(), defineEnemies(), defineHeroes(), defineLore(), definePotions(), defineRelics(), put()

### Community 15 - "Witch Cards and Brewing"
Cohesion: 0.13
Nodes (14): BASE_DRAUGHTS, cardPlayed(), combatStart(), debuffCount(), grow(), isDraught(), keepAll(), keepRot() (+6 more)

### Community 16 - "Act 1 Enemies"
Cohesion: 0.15
Nodes (15): ai(), count(), draw(), flee(), fx(), hpLost(), leechFig(), ratFig() (+7 more)

### Community 17 - "Scenes and Backgrounds"
Cohesion: 0.14
Nodes (15): BG, BY, C(), deadTree(), dk(), draw(), fbm(), gibbet() (+7 more)

### Community 18 - "Cantor Cards and Bleed"
Cohesion: 0.20
Nodes (18): bleed(), BLEED_GUARD, cardExhausted(), cardPlayed(), channelN(), enemyDied(), grow(), hpLost() (+10 more)

### Community 19 - "Wren Cards and Masks"
Cohesion: 0.13
Nodes (12): addKnives(), chooseMask(), MASK_IDS, maskIs(), onAttacked(), play(), returnToHand(), shift() (+4 more)

### Community 20 - "Combat Engine Core"
Cohesion: 0.12
Nodes (16): DRAUGHTS, MASKS, OWNER_ONLY, SPIRITS, CARDS, POTIONS, RELICS, ALIASES (+8 more)

### Community 21 - "Game Class and Saves"
Cohesion: 0.16
Nodes (7): combatMethods, freshMeta(), Game, headlessUI, makeStorage(), runMethods, fresh()

### Community 22 - "Map Generation and RNG"
Cohesion: 0.23
Nodes (16): finalMap(), FLOORS, generateMap(), key(), LANES, chance(), derive(), newStream() (+8 more)

### Community 24 - "Build and PWA Pipeline"
Cohesion: 0.11
Nodes (15): cssLinks, files, fontFiles, forever, gz, hash, html, icons (+7 more)

### Community 25 - "Map Screen"
Cohesion: 0.13
Nodes (15): ENCOUNTERS, ACT_NAMES, bossInfo(), GLYPH, legend(), mapScreen, TYPE_DESC, TYPE_NAME (+7 more)

### Community 26 - "Content API Reference"
Cohesion: 0.19
Nodes (12): Content API - The Hollow Crown, Shared Art Keys (card art, icons, scenes, portraits), Card Definition Schema (defineCards), Event Definition Schema (defineEvents), Game Object g, Lore Chronicle (defineLore), Potion/Tincture Definition Schema (definePotions), Relic Definition Schema (defineRelics) (+4 more)

### Community 27 - "Hub Dialogue and Deep Truth"
Cohesion: 0.20
Nodes (14): Hub Dialogue (defineHubLines), Texts (defineTexts), Act 4 - Beneath the Throne, Aldane the Founder, Hob the Gravekeeper, The Hollow King (final boss), The Pale Peddler, Pell the Fool (+6 more)

### Community 28 - "Headless Simulator"
Cohesion: 0.14
Nodes (12): args, botCombat(), botR, botUI, byHero, counts, errors, HERO (+4 more)

### Community 29 - "Sprite Rendering"
Cohesion: 0.23
Nodes (11): BAYER, cache, canvasCache, draw(), postProcess(), renderSprite(), spriteCanvas(), spriteEl() (+3 more)

### Community 30 - "Sprite API and Palette"
Cohesion: 0.23
Nodes (10): Sprite ID Naming Convention, Sprites and Painter API (defineSprites), defineSprites(), mix(), PAL, shadeColor(), draw(), sh() (+2 more)

### Community 31 - "Project Config"
Cohesion: 0.17
Nodes (11): devDependencies, esbuild, name, private, scripts, build, dev, sim (+3 more)

### Community 32 - "Icon and PNG Tools"
Cohesion: 0.26
Nodes (6): renderIcon(), chunk(), CRC, crc32(), encodePNG(), scaleOnto()

### Community 33 - "Potions and Statuses"
Cohesion: 0.18
Nodes (3): healAny(), use(), defineStatuses()

### Community 34 - "Acts and Balance Design"
Cohesion: 0.20
Nodes (10): Encounter Definition Schema (defineEncounters), Enemy Definition Schema (defineEnemies), The Hollow Crown - Design Bible, Act 1 - The Ashen Marches, Act 3 - Ashgrave, Ashgrave (capital), Content Targets, Kingdom of Morrow (+2 more)

### Community 35 - "Hero Arcs and Endings"
Cohesion: 0.33
Nodes (10): Story Events and Meta Flags, The Blight, Brother Cael, the Gravecantor (WITNESS), Isolde Marrow, the Plague Witch (KIN), Mattias Grall, the Witchfinder General, Ashfall (Shatter ending), The Unspent, Cantor Arc (cantor_1 - truth_cantor) (+2 more)

### Community 36 - "Knight, Crown and Loop Lore"
Cohesion: 0.27
Nodes (8): Aldous Vane, the Knight (BLOOD), Ashfall (night of the king's death), Long Live the King (Crown ending), The Hollow Crown (artifact), King Aldric IV, the Long King, Lord Severin Crane, the Regent, The Regent's Offer (crane_knows), Knight Arc (knight_1 - truth_knight)

### Community 37 - "Sprite Sheet Tool"
Cohesion: 0.20
Nodes (8): SPRITES, args, before, bg, cols, img, mods, rows

### Community 38 - "Neutral Cards and Curses"
Cohesion: 0.24
Nodes (7): CURSE, endTurnInHand(), isDebuff(), play(), statusApplied(), toHand(), STATUSES

### Community 39 - "App Shell and PWA Design"
Cohesion: 0.29
Nodes (5): index.html (app shell), Boot Splash (#boot, 'The hour is held'), PWA Manifest and Mobile Web-App Meta, Landscape Rotate Prompt (#rotate), Stage DOM Layers (#stage, #screen, #fx, #overlay, #toasts, #particles)

### Community 40 - "Combat Rules and Mechanics"
Cohesion: 0.43
Nodes (3): Combat Actions API, Combat Rules (Slay-the-Spire-like), Status Table

### Community 41 - "Wren, Maren and Antlered King"
Cohesion: 0.60
Nodes (6): Act 2 - The Weeping Wood and the Drowned Abbey, The Antlered King, The Pale Mother (Lady Under the Hill), Queen Maren, Wren, the Changeling (WARD), Wren Arc (wren_1 - truth_wren)

## Knowledge Gaps
- **1 isolated node(s):** `Act 1 - The Ashen Marches`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 280 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `defineCards()` connect `Shared Cards and Story Content` to `Act 3 Enemies`, `Neutral Cards and Curses`, `Act 2 Enemies`, `Knight Cards and Oaths`, `Witch Cards and Brewing`, `Act 1 Enemies`, `Cantor Cards and Bleed`, `Wren Cards and Masks`, `Content API Reference`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `Act 1 - The Ashen Marches` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Procedural Audio Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.05593008739076155 - nodes in this community are weakly interconnected._
- **Why does `defineSprites()` connect `Sprite API and Palette` to `Icon and PNG Tools`, `Act 3 Enemies`, `Icon Art Library`, `Act 2 Enemies`, `Act 1 Enemies`, `Scenes and Backgrounds`, `Sprite Rendering`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `Relics and Modifiers` be split into smaller, more focused modules?**
  _Cohesion score 0.06236786469344609 - nodes in this community are weakly interconnected._
- **Why does `pick()` connect `Map Generation and RNG` to `Relics and Modifiers`, `Act 3 Enemies`, `Neutral Cards and Curses`, `Act 2 Enemies`, `Act 2 Events`, `Act 1 Events`, `Knight Cards and Oaths`, `Wren Cards and Masks`, `Combat Engine Core`, `Headless Simulator`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Should `Act 3 Enemies` be split into smaller, more focused modules?**
  _Cohesion score 0.08305647840531562 - nodes in this community are weakly interconnected._