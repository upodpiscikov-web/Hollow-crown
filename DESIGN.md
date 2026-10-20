# THE HOLLOW CROWN — Design Bible

A dark-fantasy deckbuilding roguelike for mobile (landscape), turn-based, hardcore.
Plain JS, no frameworks, offline PWA. Target ~30 hours to reach the true ending.

---------------------------------------------------------------------------------
## 1. THE STORY

### The world
The kingdom of **Morrow**. Grey marshes, black forests, drowned abbeys, and at its heart
the capital **Ashgrave**, a city of spires built on a hill above the **Undercroft**.

For ninety-one years Morrow was ruled by **King Aldric IV, "the Long King"**. He did not age
as men should. Nothing in Morrow did, quite. Harvests never failed and never improved;
the old never died when they should have; the seasons turned, but never fully.

On the night called **Ashfall** the king died. The **Hollow Crown** — an iron circlet with an
empty socket where a gem once sat — rolled from his head across the throne-room floor.

Since then: the sky has been the colour of old pewter, ash falls like snow, the dead
do not stay buried, and a creeping **Blight** spreads outward from the capital.
And the night of Ashfall repeats.

### The loop (why runs restart)
The Crown "holds the hour." It held King Aldric's life for 91 years. Without a head to sit on,
it holds the hour of his death instead. It has **called four heirs**:

> "Blood, and Kin, and Ward, and Witness. One of you will wear me."

Whenever an heir dies, the Crown takes them back and the world resets to the morning
after Ashfall. The heir wakes at **the Waystone**, a standing stone on the edge of the kingdom,
in the graveyard of **Hob the Gravekeeper**. The Crown's voice says one word: *"Again."*

Most people in the world do not remember the loops. A few do (see NPCs).

### The four heirs (playable)
Each heir has a unique mechanic, a personal secret, and a 5-beat personal arc ("Truth").

1. **Aldous Vane — the Knight (BLOOD).** id: `knight`. Colour: steel blue / gold.
   The king's bastard son, once the King's Shield, stripped of rank after Ashfall.
   On Ashfall night he stood guard at the king's chamber with orders to *let no one in*,
   and heard his father begging someone inside. He obeyed. He did nothing.
   - Mechanic: **Oaths** — cards that, when played, swear an Oath (a tracked goal). Fulfil it in
     the same combat for a reward. Also **Might** and **Bulwark** (keep Block).
   - Secret/Truth: no one else was in the room. The king was begging the Crown to let him die,
     and it was Aldous, as a boy, whom the king once made swear: "When I die, do not let them
     crown another." Aldous's arc is about choosing his own oath instead of obeying.
   - Personality: stoic, self-loathing, dry gallows humour, deeply decent.

2. **Isolde Marrow — the Plague Witch (KIN).** id: `witch`. Colour: sickly green / bone.
   The king's niece, daughter of Princess Elowen, who "died of the Blight" when Isolde was
   twelve. Banished for rot-craft. She believes the Blight can be cured.
   - Mechanic: **Rot** (poison that ticks and decays), **Brew** (create Draughts — temporary
     0-cost cards), **Wither** (permanently reduce enemy Might).
   - Secret/Truth: the Blight is not a disease. It is death itself returning to a land that was
     denied it for a century; the land rotting so it can heal. Her mother never died at all —
     the Crown "kept" her, unspent, in the Undercroft. Isolde's arc is about accepting death.
   - Personality: sharp, sardonic, brilliant, angry, secretly tender.

3. **Wren — the Changeling (WARD).** id: `wren`. Colour: violet / silver.
   A foundling left on the castle steps nineteen years ago, raised as the king's ward.
   Wren has no face — only smooth skin — and wears carved masks.
   - Mechanic: **Masks** (stances): **Wolf** (attacks +50% dmg, take +25%), **Moth** (Block
     gained +50%), **Owl** (draw +1 each turn; leaving Owl gives 2 Energy). Changing masks is a
     "Shift" — many cards trigger on Shift. Also **Mimic** (copy cards) and **Knives** (0-cost
     Shards).
   - Secret/Truth: Wren is the Crown's missing gem — the heart of the **Pale Mother** that the
     Founder tore out to forge the Crown. Twenty years ago Queen Maren stole it from the Crown;
     the heart grew into a child. That is why the Long King began to fail.
   - Personality: playful, curious, unsettling, asks strange questions, lonely.

4. **Brother Cael — the Gravecantor (WITNESS).** id: `cantor`. Colour: candle gold / grave grey.
   The king's confessor. He heard the king's last confession on Ashfall night.
   - Mechanic: **Spirits** (orbs): channel into slots (3 by default). Each has a passive at end
     of turn and a **Release** effect. **Wisp** (damage), **Warden** (Block), **Lantern**
     (Release: Energy), **Banshee** (debuff/AoE). **Soul** boosts spirit values. Also **Bleed**
     (spend HP for power).
   - Secret/Truth: Cael died on Ashfall night too. He is one of the Unspent — a ghost who does
     not know it. The confession he carries is the true history of the Crown. His arc is about
     realising he is dead, and choosing to deliver the confession anyway.
   - Personality: gentle, weary, devout but doubting, speaks in liturgical cadences.

### Recurring NPCs
- **Hob the Gravekeeper** — keeper of the Waystone hub. Old, kind, eerie. Remembers every loop.
  Digs a fresh grave for each heir each time they die ("Saves time"). Late reveal: he is
  **Aldane the Founder**, first king, who forged the Crown 400 years ago and was cursed never
  to die. He has buried every heir of every loop. In the true ending he finally rests.
- **Pell the Fool** — the late king's jester, in faded motley and a cracked porcelain smile.
  Appears in events in every act. Speaks in riddles and rhymes. Remembers loops. Servant of
  the Pale Mother (fae). Pushes heirs toward the truth.
- **The Pale Peddler** — hooded merchant who runs the shops. Remembers loops ("Back again?
  Prices haven't changed. Nothing ever changes."). Late reveal: it is Pell in another coat.
- **Lord Severin Crane, the Regent** — the king's chancellor who seized Ashgrave. He worked out
  the loop and is exploiting it, hoarding power each cycle. He cannot wear the Crown (not
  called) so he wants a puppet heir. Act 3 boss. Human villain: cold, reasonable, terrifying.
- **Queen Maren** — the king's late wife (died 20 years ago). Her drowned ghost haunts the
  abbey in Act 2. She stole the Crown's heart (Wren).
- **Mattias Grall, the Witchfinder General** — zealot who hunts Isolde. Act 2 boss.
- **The Antlered King** — ancient fae lord of the Weeping Wood, servant of the Pale Mother.
- **The Pale Mother** — the land's old god of rot and renewal, "the Lady Under the Hill."
  Imprisoned beneath the throne, her heart torn out. What the legends call "the Hunger
  beneath the throne" is her pain.

### The deep truth (revealed gradually, never all at once)
1. 400 years ago, the warlord **Aldane** tore the heart from the Pale Mother and set it in an
   iron crown. The Crown can "hold the hour": stop death and change. Aldane became first king.
2. Every king of Morrow wore it. Death was held back. The deaths that should have happened
   didn't vanish — they piled up beneath the throne as the **Unspent**: the dead who never
   got to die. The Undercroft is full of them.
3. The Crown feeds on its wearer to hold the hour. The legends say the wearer becomes "the
   vessel of the Hunger" — a lie the Crown tells. The Crown is the parasite.
4. Queen Maren stole the heart-gem. It became Wren. Without its heart the Crown weakened, and
   the Long King finally died.
5. To end the loop for good, the heart must go home — to the Mother, not to the Crown.

### Endings
After defeating the Act 3 boss, the heir enters the **Throne Room** (always counts as a win).
- **"Long Live the King"** (Crown ending) — Take the Crown. You become the new Long King.
  Each heir has a unique epilogue. The loop ends for you; the world freezes again.
- **"Ashfall"** (Shatter ending) — requires lore flag `knows_heart`. You break the Crown.
  Time resumes, but a century of the Unspent floods up out of the Undercroft. You walk out into
  a world that is finally moving, and finally dying. Bittersweet.
- **"The Turning of the Year"** (True ending) — requires all four Truths. Descend into the
  Undercroft (Act 4: *Beneath the Throne*), face the Unspent and **the Hollow King** (the
  Crown wearing King Aldric's corpse; phase 2: the Crown itself). Wren's heart returns to the
  Mother. The dead are laid to rest. Spring comes. Hob finally lies down in his own grave.

---------------------------------------------------------------------------------
## 2. THE RUN

- Each run: **Act 1 → Act 2 → Act 3** (→ Act 4 if unlocked). Each act is a branching map of
  15 floors + boss. Map scrolls horizontally (landscape).
- Node types: `fight`, `elite`, `event`, `rest`, `shop`, `treasure`, `boss`.
- **Act 1 — The Ashen Marches.** Grey fens, gibbets, plague villages, bandits, wolves,
  ash-cultists. Bosses: *The Hound-Lord Bragg*, *The Hanged Sheriff*, *Mother of Rats*.
- **Act 2 — The Weeping Wood & the Drowned Abbey.** Black forest, fae, drowned monks,
  witch-hunters. Bosses: *Mattias Grall the Witchfinder*, *The Antlered King*,
  *The Drowned Abbess (Queen Maren's ghost)*.
- **Act 3 — Ashgrave.** The capital under the Regent: crown-cultists, court phantoms, the
  undead Royal Guard. Bosses: *Lord Severin Crane the Regent*, *The Choir Immaculate*,
  *The Crowned Rival* (one of the OTHER three heirs, crowned in another loop — a dark mirror).
- **Act 4 — Beneath the Throne** (true path only). Short act: elite *The Unspent*, final boss
  *The Hollow King*.

### Hardcore rules
- No permanent stat upgrades. Death ends the run.
- What carries over: **story flags and lore**, **unlocked heroes**, **unlocked cards/relics**
  (via Renown per hero), **Crown Weight** levels (ascension) unlocked by winning.
- Seeded RNG per stream, saved after every action: no save-scumming.

### Meta unlocks
- Knight available from the start. Witch after the first run. Wren after 3 runs or reaching
  Act 2's boss. Cantor after 5 runs or reaching Act 3.
- **Renown** per hero (XP). Every level unlocks a batch of cards/relics into the pool.
- **Crown Weight 1–10** per hero, unlocked by winning at the previous level.

---------------------------------------------------------------------------------
## 3. COMBAT RULES (Slay-the-Spire-like)

- 3 Energy per turn; draw 5; max hand 10. Block resets at start of your turn.
- Card types: **attack, skill, power, curse, status**.
- Keywords: **Exhaust** (removed for the combat), **Retain** (not discarded at end of turn),
  **Ethereal** (exhausted if still in hand at end of turn), **Innate** (always in opening
  hand), **Unplayable**.

### Statuses (ids in code)
| id | name | kind | effect |
|---|---|---|---|
| might | Might | buff | +N damage on attacks |
| guard | Guard | buff | +N Block from cards |
| exposed | Exposed | debuff, turns | takes 50% more attack damage |
| weak | Weakened | debuff, turns | deals 25% less attack damage |
| frail | Frail | debuff, turns | gains 25% less Block from cards |
| rot | Rot | debuff | at start of its turn loses N HP, then Rot -1 |
| ward | Ward | buff | negates the next N debuffs |
| thorns | Thorns | buff | when attacked, deal N to attacker |
| plating | Plating | buff | at end of turn gain N Block |
| mending | Mending | buff, turns | at end of turn heal N, then -1 |
| rite | Rite | buff | at end of its turn gain N Might |
| bulwark | Bulwark | buff | Block is not removed at start of turn (N turns, or permanent if flagged) |
| soul | Soul | buff | spirit passive/release values +N |
| vigor | Vigor | buff | next attack deals +N damage, then removed |
| shackled | Shackled | debuff | lose N Might until end of turn (temporary) |
| dread | Dread | debuff | draw N fewer cards next turn |
| burning | Ash-Burn | debuff | at end of turn take N damage |

Names to use in card text: **Might, Guard, Exposed, Weakened, Frail, Rot, Ward, Thorns, Plating,
Mending, Rite, Bulwark, Soul, Vigor, Wither** (Wither = permanently remove enemy Might).

### Hero mechanics
- **Oath** (knight): card keyword. Playing it swears an Oath shown next to the hero with a
  progress counter, e.g. "Oath of the Wall: end 2 turns with 10+ Block → gain 2 Might".
  Fulfilled oaths pay out once (unless *Lasting*). Unfulfilled at combat end: nothing.
- **Rot / Brew / Wither** (witch). Draughts (status-like 0-cost exhaust cards):
  Draught of Bile (3 Rot to all), Draught of Ash (6 Block), Draught of Ember (6 dmg random),
  Draught of Clarity (draw 2), Draught of Marrow (heal 3).
- **Masks** (wren): wolf / moth / owl / none. Shift = changing masks.
- **Spirits** (cantor): wisp / warden / lantern / banshee. Slots 3. Channel when full
  releases the oldest first.

---------------------------------------------------------------------------------
## 4. CONTENT TARGETS

- Cards: per hero ~4 starter types + ~48 others (18 common, 20 uncommon, 10 rare).
  Neutral ~20, curses ~8, statuses ~6.
- Relics ~60, Tinctures (potions) ~20.
- Enemies: per act ~8 normal, 3 elite, 3 boss; Act 4: 1 elite + final boss.
- Events: ~14 per act + ~10 any-act + story events (each heir's 5 beats, main-plot beats).
- Hub: ~80 lines of Hob dialogue gated by meta flags.

## 5. ART & AUDIO
- Pixel art drawn in code: sprites are drawn with primitives at low resolution, then
  outlined and shaded automatically, and upscaled with nearest-neighbour.
- Palette: desaturated greys and umbers, bone white, blood red, rot green, candle gold,
  bruise violet. Fog and ash particles.
- Audio: WebAudio synthesis — no audio files. Dark ambient drones + sparse melody per act.
