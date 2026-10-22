# Content API — The Hollow Crown

Read `DESIGN.md` first (story, heroes, statuses, rules). This file is the
technical contract for content. Plain ES modules, no dependencies.

**Golden rules**
- Only edit the files you own (listed in your brief). Never edit engine files —
  if you need an engine change, describe it in your final report instead.
- All randomness in content MUST use the game's streams: `g.crng` (combat/AI),
  `g.srng` (card shuffles/random cards), `g.run.rng.events` / `g.run.rng.misc`
  (events). Never `Math.random()` — runs are seeded and resumable.
- Content ids are global: prefix hero content with the hero id when generic
  (`strike_witch`), keep everything else descriptive and unique.
- Test with `node tools/sim.mjs --validate-only` and `node tools/sim.mjs --runs 30 --hero <id>`.
  The sim must report 0 validation problems for your content and 0 run errors.

Imports (paths relative to your file):
```js
import { defineCards, defineStatuses, defineRelics, definePotions, defineEnemies,
  defineEncounters, defineEvents, defineHubLines, defineLore, defineTexts } from '../../engine/registry.js';
import { defineSprites, PAL } from '../../gfx/sprite.js';
```

---------------------------------------------------------------------------------
## Game object `g` — what content code can call

### State
- `g.run` run state: `hero, asc, act, floor, gold, deck[], relics[{id,n}], potions[], flags{}, stats{}`
- `g.meta` persistent progression: `runs, wins, flags{}, heroes{id:{level,wins,runs,bestAct}}`
- `g.player` `{hp, maxHp, block, st:{statusId:n}, isPlayer:true}`
- `g.cb` combat state (null outside combat): `turn, energy, maxEnergy, hand[], draw[], discard[],
  exhaust[], enemies[], mask, spirits[], slots, playing (card being played)`
- `g.enemies` living enemies; `g.cnt` this-turn counters, `g.tot` this-combat counters:
  `{cards, attacks, skills, powers, drawn, exhausted, discarded, hpLost, shifts, channeled, brewed, oaths}`
- `g.st(entity, id)` → status amount (0 if none)
- `g.hasRelic(id)`, `g.relic(id)`
- `g.cardDef(card)` → definition; `g.cardVals(card)` → resolved values; `g.cardCost(card)`

### Combat actions (synchronous unless noted)
| call | effect |
|---|---|
| `g.attack(target, dmg, times=1)` | player attack (Might, Weakened, Exposed, masks, Vigor apply). returns unblocked dmg |
| `g.attackAll(dmg, times=1)` | attack every enemy |
| `g.attackRandom(dmg, times=1)` | each hit picks a random living enemy |
| `g.damage(entity, n, {type, src})` | raw damage through Block, no attack modifiers (`type`: 'spell','thorns','spirit','burn') |
| `g.loseHp(entity, n, {type:'hploss'})` | lose HP ignoring Block |
| `g.block(n)` | player gains Block (Guard, Frail, Moth apply) |
| `g.gainBlock(entity, n, {raw:true})` | raw Block (no modifiers) |
| `g.apply(target, statusId, n, src?)` | apply status (Ward negates debuffs). src defaults to player |
| `g.applyAll(id, n)` / `g.applySelf(id, n)` | all enemies / player |
| `g.addStatus(e, id, n, {silent})` | low-level add without Ward/triggers (use for self-bookkeeping) |
| `g.removeStatus(e, id)` | |
| `g.heal(entity, n)` / `g.healPlayer(n)` | |
| `g.draw(n)` | draw cards, returns array drawn |
| `g.gainEnergy(n)` | |
| `g.addCard(id, where, {up, cost0, costTurn, ethereal, exhaust})` | where: 'hand' 'draw' 'drawTop' 'discard'. returns card |
| `g.copyCard(card, where, opts)` | |
| `g.exhaustCard(card)` / `g.discardCard(card)` | move from wherever it is |
| `g.upgradeCard(card)` | upgrade (this combat copy) |
| `await g.choose({title, from:'hand'|'draw'|'discard'|'exhaust', cards?, count, min, filter})` | player picks cards → array |
| `await g.chooseHand(count, title, filter)` | shortcut |
| `await g.discover({type, rarity, hero, count:3, up, cost0:true})` | choose 1 of N random cards → added to hand |
| `await g.autoPlay(card, target?)` | play a card for free (e.g. top of draw pile) |
| `g.randomEnemy()`, `g.lowestEnemy()` | |
| `g.setMask('wolf'|'moth'|'owl'|null)` | Wren: shift masks (leaving Owl gives 2 Energy) |
| `g.channel('wisp'|'warden'|'lantern'|'banshee')` | Cantor: channel a spirit |
| `g.release(n=1)` / `g.releaseAll()` / `g.addSlots(n)` | Cantor |
| `g.brew(n, {id?, up?})` | Witch: add random Draught cards to hand |
| `g.swear(oathId, need, pay)` / `g.oathProgress(oathId, n=1)` | Knight oaths |
| `g.spawn(enemyId, {minion, front, hp})` | enemy summons |
| `g.rollIntent(enemy)` | re-roll an enemy's intent |

Card play functions may be `async` (needed only if you `await g.choose/discover/autoPlay`).

### Run/meta actions (events, relic pickups, rest options)
`g.gainGold(n)`, `g.loseGold(n)`, `g.gainMaxHp(n)`, `g.loseMaxHp(n)`, `g.hurt(n)` (out-of-combat HP
loss; can kill), `g.healOut(n)`, `g.addToDeck(id, up)`, `g.removeFromDeck(card)`,
`await g.removeCardChoice(n)`, `await g.upgradeCardChoice(n)`, `await g.transformCardChoice(n)`,
`g.upgradeRandom(n, filter?)`, `await g.offerCards([ids], {title, forced})`, `g.randomCards({count, rarity, type, hero})`,
`g.obtainRelic(id | 'common'|'uncommon'|'rare'|undefined)`, `g.obtainPotion(id?)`, `g.addPotionSlots(n)`,
`g.setFlag(k)` / `g.flag(k)` (run flag, falls back to meta), `g.setMetaFlag(k)` / `g.metaFlag(k)`,
`g.unlockLore(id)`, `await g.eventCombat([enemyIds], {resume:'pageId', reward:{relic:'random'|id, gold, card}, kind:'fight'|'elite', flag})`.

---------------------------------------------------------------------------------
## Cards — `defineCards([...])`

```js
{
  id: 'cleave_knight', name: 'Cleave', hero: 'knight',     // hero id | 'neutral' | 'curse' | 'status'
  type: 'attack',            // attack | skill | power | curse | status
  rarity: 'common',          // starter | common | uncommon | rare | special (never in rewards) | curse
  cost: 1,                   // number, 'X', or -1 (unplayable)
  upCost: 0,                 // optional: cost when upgraded
  target: 'none',            // 'enemy' (player picks a target) | 'none' (everything else, incl. AoE)
  v: { dmg: 8 }, up: { dmg: 3 },   // values; `up` = deltas added on upgrade
  kw: ['exhaust'],           // innate | retain | ethereal | exhaust | unplayable
  upKw: { remove: ['exhaust'] },   // keyword changes on upgrade ({add:[...]} also allowed)
  tier: 0,                   // unlock tier 0-5 (hero Renown level). ~35 cards at 0, ~4 per tier after
  art: 'axe',                // card art key — MUST be from the ART KEYS list below
  text: 'Deal {dmg} damage to ALL enemies.',
  play(g, v, target, card) { g.attackAll(v.dmg); },
  // optional:
  canPlay(g, card) { return true; }, cantText: 'Why not',
  onDraw(g, card), onExhaust(g, card), onDiscard(g, card), onRetain(g, card),
  endTurnInHand(g, card),    // curses/statuses that hurt while held
  noUp: true,                // cannot be upgraded
  unremovable: true,         // shops/events can't remove it
}
```
**Text rules**
- Placeholders `{key}` are filled from `v` (+upgrade). Keys named `dmg`, `dmg2` show live
  attack-modified numbers; `blk`, `blk2` show live block-modified numbers; anything else
  is shown raw. `{x}` is not a placeholder — write "X" literally.
- Do NOT write keyword lines (Exhaust., Retain., Ethereal., Innate., Unplayable.) — the
  UI appends them from `kw`. Write effects only. Keep text short (≤ ~90 chars ideal,
  max ~130); the card is small on a phone.
- Capitalise game terms: Block, Might, Guard, Exposed, Weakened, Frail, Rot, Ward, Thorns,
  Plating, Mending, Rite, Bulwark, Soul, Vigor, Wither, Oath, Brew, Draught, Shift,
  Wolf/Moth/Owl Mask, Channel, Release, Wisp, Warden, Lantern, Banshee, Bleed, Knife.
- If the upgraded text must differ beyond numbers, provide `upText`.
- "Wither N" means `g.apply(t, 'might', -N)` (permanent Might loss).
- "Bleed N" means `g.loseHp(g.player, N, {type:'hploss'})` (Cantor).

**Power cards** usually apply a status to the player whose hooks do the work. Define those
statuses in the same file with `defineStatuses`.

### Status hooks (for powers, oaths, enemy passives)
```js
{ id, name, kind: 'buff'|'debuff'|'oath', icon: 'might', desc: (n, g, owner) => '...',
  decay: 'ownerTurnEnd',      // optional: -1 at end of owner's turn (duration statuses)
  negOk: true,                // amount may go negative (like Might)
  // owner's own turn:
  turnStart(g, owner, n) {}, turnEnd(g, owner, n) {},
  // modifiers (return values):
  atkAdd(g, o, n, ctx) → +dmg,  atkMul(g, o, n, ctx) → ×,  takeMul(g, o, n, ctx) → ×,
  blockAdd(g, o, n) → +,  blockMul(g, o, n) → ×,  costMod(g, o, n, card, cost) → +/- cost,
  drawMod(g, o, n, first) → +cards,  extraPlays(g, o, n, card) → +times (decrement yourself!),
  applyAdd(g, o, n, target, id, amount) → +amount when the player applies a debuff,
  canPlay(g, o, n, card) → bool,  healMul, xBonus, retainAll (>0 = retain hand),
  // reactions (any trigger event; owner may be player OR an enemy — check o.isPlayer):
  onAttacked(g, o, n, attacker, unblocked), hpLost(g, o, n, amount, opts), died(g, o, n),
  cardPlayed(g, o, n, card, target), cardDrawn, cardExhausted(g,o,n,card), cardDiscarded,
  shuffle, blockGained(g,o,n,entity,amount), statusApplied(g,o,n,target,id,amount,src),
  enemyDied(g,o,n,enemy), shift(g,o,n,from,to), channel(g,o,n,kind), release(g,o,n,kind),
  brewed(g,o,n,count), oathSworn(g,o,n,id), oathFulfilled(g,o,n,id), potionUsed, playerAttacked,
  enemyAttacked(g,o,n,enemy,unblocked), combatStart, turnStart*, afterDraw(g,o,n,turn), roundEnd,
}
```
(*`turnStart`/`turnEnd` on statuses fire only on the owner's turn. Relics get global ones.)

Oath statuses (Knight) also need `fulfil(g, pay)`; their hooks call `g.oathProgress(id)`.

Status `icon` must be from the ICON KEYS list (status icons).

---------------------------------------------------------------------------------
## Relics — `defineRelics([...])`
```js
{ id: 'grave_salt', name: 'Grave Salt', rarity: 'common',  // starter|common|uncommon|rare|boss|shop|special
  hero: 'witch',              // optional: only appears for that hero
  icon: 'pouch', tint: '#d8cfb8',   // icon from RELIC ICONS list; tint = main colour
  desc: 'Whenever you apply Rot, apply 1 more.', flavor: 'One line of lore.',
  counter: 0,                 // optional numeric counter shown on the relic (r.n)
  tier: 0,                    // unlocks after meta.runs >= tier*3
  // any trigger event as a method (g, r, ...args): combatStart, turnStart(g,r,turn), turnEnd,
  // cardPlayed(g,r,card,target), cardExhausted, shuffle, enemyDied, hpLost(g,r,entity,n), healed,
  // combatEnd(g,r,won), floorEnter(g,r,roomType), rested, smithed, shopEnter, purchase, chestOpened,
  // goldGained, cardAdded(g,r,card), potionUsed, actStart(g,r,act), shift, channel, brewed, oathFulfilled ...
  // modifier methods (player only): atkAdd, atkMul, takeMul, blockAdd, blockMul, costMod, drawMod,
  // maxEnergy (returns +energy), healMul, priceMul, restHealAdd, cardChoices (+reward choices),
  // extraEliteRelic, potionDouble, applyAdd, owlExitAdd, brewUp, xBonus, curseBlock, noRest, noSmith,
  // modDamageTaken(g,r,amount,opts) → amount, modHpLoss(g,r,n,opts) → n,
  // exposedBonus: 0.25 (number, enemies take +25% more from Exposed), weakBonus: 0.15,
  pickup(g, r) {},            // run when obtained (gain max HP, gold, potion slots...)
  revive(g, r) { return true if it saved you (set g.player.hp yourself) },
  restOption: { id, label, desc, icon, can(g,r), async use(g,r) },   // extra rest-site action
  canSpawn(g) { return true },
}
```

## Potions ("Tinctures") — `definePotions([...])`
```js
{ id: 'tincture_of_iron', name: 'Tincture of Iron', rarity: 'common',  // common|uncommon|rare
  hero: 'knight',            // optional
  target: 'none',            // 'enemy' or 'none'
  icon: 'flask_round', color: '#8e98a3',   // icon from POTION ICONS; color = liquid
  desc: 'Gain 12 Block.',    // describe base potency
  anytime: false,            // true = usable outside combat (healing etc.)
  async use(g, target, mul) { g.block(12 * mul); },   // mul = 2 with the potency relic
  revive: 0.3,               // optional: auto-used on death, heals 30% max HP
}
```

---------------------------------------------------------------------------------
## Enemies — `defineEnemies([...])`, `defineEncounters([...])`
```js
{ id: 'marsh_hound', name: 'Marsh Hound', kind: 'normal',   // normal | elite | boss
  act: 1, hp: [24, 28],      // range or number (ascension scaling is automatic)
  sprite: 'en_marsh_hound',  // sprite id you define (see Sprites)
  desc: 'Bestiary line.',
  init(g, e) { g.addStatus(e, 'thorns', 2, { silent: true }); },  // pre-battle setup
  moves: {
    bite:  { name: 'Bite', intent: 'atk', dmg: 7 },
    maul:  { name: 'Maul', intent: 'atkdebuff', dmg: 4, times: 2, fx(g, e) { g.apply(g.player, 'weak', 1, e); } },
    howl:  { name: 'Howl', intent: 'buff', fx(g, e) { g.apply(e, 'might', 2, e); } },
    // dmg/times may be functions (g, e) => number for scaling attacks
  },
  ai(g, e) {                 // return next move id. e.hist = past moves, e.turns = turns taken, e.data = memory
    if (e.turns === 0) return 'howl';
    return g.aiPick(e, { bite: 60, maul: 40 }, { bite: 2, maul: 1 });  // weights, max consecutive
  },
  on: { hpLost(g, e, n) {}, death(g, e) {}, cardPlayed(g, e, card) {} },  // optional reactions
  immune: ['weak'],          // optional status immunities
  leader: true,              // optional: minions (spawned with {minion:true}) flee when it dies
  scale: 1,                  // optional display scale multiplier
}
```
- The engine performs the move's attack automatically when `dmg` is set (`times` hits),
  THEN calls `fx(g, e)` for extra effects. Enemy block: `g.gainBlock(e, n, {raw:true})`.
  Enemy self-buffs: `g.apply(e, 'might', 2, e)` (pass `e` as src).
  Debuffs on player: `g.apply(g.player, 'weak', 2, e)`. Add status cards to the player's
  piles: `g.addCard('daze', 'draw')`, `g.addCard('wound', 'discard')`.
- **intent** values: `atk`, `atkdef`, `atkbuff`, `atkdebuff`, `def`, `buff`, `debuff`, `defbuff`,
  `strongdebuff`, `summon`, `heal`, `sleep`, `flee`, `unknown`, `special`.
- AI helpers: `g.aiPick(e, weights, maxRepeat)`, `g.lastMove(e, id)`, `g.lastTwo(e, id)`, `g.cycle(e, [ids])`.
- Fleeing: in fx set `e.dead = true; e.fled = true; g.emit('flee', {e}); g.checkEnd();`
- Boss phase changes: track in `e.data`; change `e.maxHp`, `e.name` etc. as needed;
  `g.emit('phase', {e, text:'...'})` for a banner.

**Balance targets** (Slay-the-Spire-like, player ~70-80 HP, 3 energy, ~5-9 dmg/card early):
- Act 1 normal: 12-50 HP total per encounter; 6-12 dmg per turn. Elites 80-110 HP. Bosses 240-300 HP, 15-30 dmg per turn spikes.
- Act 2: normals 40-90 HP total per encounter, 10-20 dmg/turn; elites 140-200 HP; bosses 300-420 HP.
- Act 3: normals 70-140 HP total; elites 200-280; bosses 450-600 HP.
- Act 4: elite ~300; final boss ~700 total across phases.

**Encounters**
```js
{ id: 'a1_hounds', act: 1, pool: 'easy',   // easy (first 3 fights) | hard | elite | boss
  enemies: ['marsh_hound', 'marsh_hound'],  // or (g, rng) => [...]  (use pick(rng, ...) from rng.js)
  weight: 1, name: 'Marsh Hounds' }
```
Boss encounters need `name` (shown on the map). An act needs ≥4 easy, ≥8 hard, ≥3 elite, 3 boss encounters.

---------------------------------------------------------------------------------
## Events — `defineEvents([...])`
```js
{ id: 'hanging_tree', title: 'The Hanging Tree',
  acts: [1],                  // [1,2,3,4] or 'any'
  hero: 'witch',              // optional: only for this hero
  weight: 1, minFloor: 0,
  story: false,               // story events get priority (see below)
  priority: 0,                // among eligible story events, highest first
  unique: false,              // true = only ever once per save (story events are always unique)
  req(g) { return true; },    // eligibility
  art: 'scene_gibbet',        // illustration sprite id (SCENE / NPC / enemy / hero sprite ids)
  speaker: 'pell',            // optional default portrait for the page
  init(g, data) {},           // optional: per-visit state in `data`
  pages: {
    start: {
      text: 'Paragraphs separated by blank lines. *Italics* allowed.',   // or (g, data) => string
      choices: [
        { label: '[Cut them down] Lose 6 HP. Obtain a relic.',
          req: (g) => g.player.hp > 6 || 'Too weak.',   // true or a reason string (shows disabled)
          show: (g) => true,                            // hide entirely if false
          async fx(g, data) { g.hurt(6); g.obtainRelic(); return 'cut'; },  // return next page id
        },
        { label: '[Leave]', end: true },
      ],
    },
    cut: { text: '...', choices: [{ label: '[Leave]', end: true }] },
  },
}
```
- `fx` returns the next page id, or nothing (then `next:` or `end:` on the choice applies).
  A returned page id of `'end'` (or `null`) leaves the event, so never name a page `end`.
  `acts: 'any'` means Acts 1-3; list `4` explicitly for Act 4 events.
- To start a fight: `await g.eventCombat(['ghoul','ghoul'], { resume: 'after', reward: { relic: 'random' } })`
  and return nothing — after the fight + rewards the event resumes at page `after`
  (omit `resume` to go straight back to the map).
- Labels: start with a bracketed verb `[Take the ring]`, then the mechanical outcome in plain
  words. Keep outcomes honest. Text: 60–180 words per page, second person, present tense,
  grim and literary but readable on a phone. Characters speak in quotes.

**Story events** (`story: true`) are chosen first (≤1 per act) when eligible. Use meta flags
to sequence beats. Flags (set with `g.setMetaFlag`):
- Hero arcs: `knight_1`..`knight_4`, `truth_knight` (beat 5); same for `witch_*`, `wren_*`, `cantor_*`.
- Main plot: `met_pell`, `pell_2`..`pell_6`, `knows_heart` (enables the Shatter ending),
  `met_peddler`, `peddler_is_pell`, `knows_unspent`, `knows_founder`, `hob_is_aldane`, `crane_knows`.
- Endings set automatically: `won_<hero>`; meta.endings[crown|shatter|true].

## Hub dialogue (Hob at the Waystone) — `defineHubLines([...])`
```js
{ id: 'hob_first_death', pri: 90, once: true,
  req: (meta, last) => last && !last.won && meta.deaths === 1,   // last = meta.lastRun (may be null)
  lines: [['hob', 'Back already? Grave\'s still warm.'], ['knight', '...'], ['hob', 'Sit. Tea\'s on.']],
  sets: ['hob_tea'],         // optional meta flags to set when shown
  lore: 'lore_waystone' }    // optional lore unlock
```
Speakers: `hob`, `pell`, `peddler`, `crown`, `narrator`, `knight`, `witch`, `wren`, `cantor`.
`last` fields: `hero, won, ending, act, floor, asc, killer (encounter id or event id), stats`.
Shown after each run: highest `pri` eligible unseen `once` line; otherwise a random eligible
repeatable line (`once: false`).

## Lore (Chronicle) — `defineLore([...])`
`{ id: 'lore_long_king', cat: 'world'|'heirs'|'crown'|'bestiary'|'letters', title, text }`

## Texts — `defineTexts({...})`
- `act_intro: { 1: {title, text}, 2: ..., 3: ..., 4: ... }`
- `death_lines: ['Again.', ...]` (the Crown, shown on the death screen)
- `endings: { crown: { title, default, knight, witch, wren, cantor }, shatter: {...}, true: {...} }`
- `shop_greet: [...]`, `shop_buy: [...]`, `shop_leave: [...]` (the Pale Peddler)
- `rest_lines: { knight: [...], witch: [...], wren: [...], cantor: [...] }`
- `boss_intro: { encounterId: 'line shown when the fight starts' }`
- `hero_select: { knight: 'quote', ... }`, `title_quotes: [...]`

---------------------------------------------------------------------------------
## Sprites — `defineSprites({...})` (from `src/gfx/sprite.js`)
```js
defineSprites({
  en_marsh_hound: {
    w: 48, h: 36,            // canvas size in art pixels (outline adds 1px border)
    draw(p, opts) {          // p = Painter. Coordinates in art pixels, origin top-left.
      p.ellipse(22, 22, 14, 8, PAL.ash, { shade: 0.3 });   // body with volumetric shading
      p.circle(35, 15, 6, PAL.ash, { shade: 0.3 });        // head
      p.path([[12, 26], [8, 34]], PAL.dusk, 3);            // leg (thick polyline)
      p.glow(37, 14, PAL.ember, 2);                        // glowing eye
    },
  },
});
```
Painter: `rect(x,y,w,h,col,o)`, `ellipse(cx,cy,rx,ry,col,o)`, `circle(cx,cy,r,col,o)`,
`poly([[x,y]...],col,o)`, `tri(...)`, `line(x1,y1,x2,y2,col,width)`, `path(points,col,width)`,
`ring(cx,cy,r,col,width)`, `px(x,y,col)`, `glow(x,y,col,r)`, `erase(x,y,w,h)`, `eraseEllipse(cx,cy,rx,ry)`,
`mirror()` (copy left half → right), `speckle(col, density, seed, [x0,y0,x1,y1])`, `recolor(from,to)`.
`o = { shade: 0..0.5 }` adds dithered volumetric light (top-left) to that shape.
Post-processing adds rim light and a dark outline automatically (`outline:false` / `rim:false`
on the def to disable). Colours: `PAL.*` or hex. Draw back-to-front.
- Enemies FACE LEFT (the hero stands on the left). Heroes face right.
- Sizes: normal enemies ≤ 64×64, elites ≤ 80×80, bosses ≤ 112×112, heroes ~40×56.
- Silhouette first: readable shapes at small size, 3–5 colours per figure + shading.
- LOOK at your work: `node tools/sprite-sheet.mjs src/data/enemies/act1.js --out tools/out/act1.png`
  then open the PNG with your image-viewing tool, and iterate until it reads well.

### Shared art keys (implemented by the art team — content must only use these)
**ART KEYS (card art)**: sword, greatsword, axe, dagger, spear, mace, bow, fist, shield, tower_shield,
oath, banner, crown, skull, bone, flask, cauldron, herb, mushroom, rot, flame, spark, drop, blood,
heart, eye, mask, mask_wolf, mask_moth, mask_owl, feather, knife, moon, sun, star, candle, bell,
book, scroll, chain, ghost, wisp, lantern, grave, hand, wing, web, thorn, swirl, rune, coin, key,
hourglass, wolf, raven, moth, owl, tree, sigil, prayer, scythe, claw, tooth, cloak, mirror.

**ICON KEYS (status icons)**: might, guard, exposed, weak, frail, rot, ward, thorns, plating, mending,
rite, bulwark, soul, vigor, shackled, dread, burning, phantasm, insight, zeal, enrage, split, minion,
oath, mask, spirit, brew, echo, knife, blood, eye, crown, skull, moon, star, flame, chain, feather, heart.

**RELIC ICONS**: ring, amulet, coin, skull, bottle, tooth, feather, key, book, candle, bell, chalice,
dagger, gem, eye, hand, horn, bone, rosary, sigil, mask, crown, lantern, mirror, hourglass, scroll,
seed, flower, rope, nail, egg, heart, moon, sun, chain, pouch, dice, whistle, cloak, bowl, shell,
stone, idol, pipe, spoon, thimble, locket, map, quill, mortar.

**POTION ICONS**: flask_round, flask_tall, vial, jar, skull_flask, horn_cup.

**SCENES (event art, ~96×64)**: scene_road, scene_gibbet, scene_village, scene_chapel, scene_camp,
scene_ruins, scene_forest, scene_abbey, scene_water, scene_shrine, scene_crypt, scene_city,
scene_court, scene_throne, scene_undercroft, scene_market, scene_battlefield, scene_well.

**NPC / PORTRAITS**: npc_hob, npc_pell, npc_peddler, npc_crane, npc_maren, npc_grall, npc_crown,
npc_mother; hero portraits: portrait_knight, portrait_witch, portrait_wren, portrait_cantor.
Hero battle sprites: hero_knight, hero_witch, hero_wren, hero_cantor.

### Sprite id naming (art team defines, UI uses)
| prefix | what | size (art px) | notes |
|---|---|---|---|
| `art_<ARTKEY>` | card art | 32×24 | e.g. `art_sword` |
| `st_<ICONKEY>` | status icon | 10×10 | e.g. `st_might` |
| `rl_<RELICICON>` | relic icon | 16×16 | `draw(p, {c})` — use `opts.c` (relic tint) as main colour |
| `pt_<POTIONICON>` | potion icon | 12×16 | `draw(p, {c})` — `opts.c` = liquid colour |
| `in_<intent>` | enemy intent | 14×14 | in_atk, in_atk_heavy, in_def, in_buff, in_debuff, in_strongdebuff, in_unknown, in_sleep, in_summon, in_flee, in_heal, in_special |
| `map_<type>` | map node | 16×16 | fight, elite, event, rest, shop, treasure, boss |
| `ui_<name>` | UI glyph | 12–16 | energy, gold, hp, block, deck, draw, discard, exhaust, map, settings, potion_empty, chronicle, back, lock, star |
| `sp_<kind>` | spirit | 14×14 | wisp, warden, lantern, banshee |
| `mask_<kind>` | mask | 16×16 | wolf, moth, owl |
| `hero_<id>` | hero battle sprite | ~40×56 | faces right |
| `portrait_<id>` / `npc_<id>` | dialogue portrait | 40×40 | |
| `scene_<id>` | event illustration | 96×64 | `outline:false` recommended |
| `bg_<id>` | backgrounds | 256×144 | bg_act1..bg_act4, bg_hub, bg_title, bg_throne |
| `en_<id>` | enemies | see sizes | faces left |
