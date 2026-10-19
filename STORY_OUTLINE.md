# Story Outline — canonical beats (all writers follow this)

Story events are `story: true` events in `src/data/events/story.js` (Story Lead). Other writers
may REFERENCE these beats (Hob reacting in the hub, an act event nodding to them) by checking
the flags below — never re-implement them.

Tone: grim, literary, humane. Gallows humour. Mystery revealed in fragments — every beat
should answer one small question and raise another. Never dump the whole truth at once.

## The Knight — Aldous Vane (BLOOD)
1. `knight_1` (Act 1) **The Door.** A ghostly sentry at a ruined gatehouse asks "Who goes there?"
   Flashback: Ashfall night, Aldous on guard, the king begging behind the door. He did nothing.
2. `knight_2` (Act 1–2) **The Squire's Grave.** Memory surfaces: as a boy, the king made him
   swear, "When I die, do not let them crown another." He has forgotten that oath until now.
3. `knight_3` (Act 2) **The Witchfinder's Question.** Mattias Grall, who served beside him, asks
   who locked the door. Aldous realises the door was never locked. He chose not to open it.
4. `knight_4` (Act 3) **The Shield Wall.** His old men, the undead Royal Guard. Lord Crane offers
   him the captaincy if he will crown Crane's puppet. Hints: no one else was ever in the room.
5. `truth_knight` (Act 3) **The Unopened Door.** He opens the king's chamber door in Ashgrave:
   only the king, alone, begging the Crown to let him die. Aldous swears his own oath.

## The Witch — Isolde Marrow (KIN)
1. `witch_1` (Act 1) **The Plague Cart.** The Blight's victims are not dying; they're *stopped*.
2. `witch_2` (Act 1–2) **Mother's Garden.** Elowen's old herb garden, blooming in rot. A letter
   in her mother's hand, dated *after* her supposed death.
3. `witch_3` (Act 2) **The Witchfinder.** Grall hunts her. She learns rot-witches were burned
   because rot is death returning — the one thing the Crown forbids.
4. `witch_4` (Act 3) **The Ledger of the Kept.** Crane's archive lists souls "kept" beneath the
   throne. Her mother's name is in it.
5. `truth_witch` (Act 3) **What the Rot Is For.** The Blight is the land healing. Her mother is
   Unspent below, neither living nor dead. Isolde chooses to let things die.

## The Changeling — Wren (WARD)
1. `wren_1` (Act 1) **The Mask-Maker.** A dead mask-maker's shop; masks whisper. Wren tries a
   face that isn't theirs and feels the Crown *pull*, like a tide.
2. `wren_2` (Act 1–2) **The Lady in the Mere.** Queen Maren's drowned ghost knows Wren:
   "My little stolen thing." She will not say more. Yet.
3. `wren_3` (Act 2) **The Antlered Court.** The fae of the Weeping Wood bow to Wren and call
   them "Heartwood." Wren is frightened by how right it feels.
4. `wren_4` (Act 3) **The Empty Socket.** A portrait of the Crown in the treasury: the missing
   gem has Wren's colours. The Crown hums when Wren is near. Sets `knows_heart` too.
5. `truth_wren` (Act 3) **Heartwood.** Wren is the Pale Mother's heart, stolen by Maren. They
   could make the Crown whole, or go home. Wren chooses home.

## The Gravecantor — Brother Cael (WITNESS)
1. `cantor_1` (Act 1) **The Bell That Does Not Ring.** A chapel bell for the dead, unrung for a
   century. Cael performs the first funeral rite in a hundred years.
2. `cantor_2` (Act 1–2) **Those Who Cannot Hear.** The living don't answer him; only the dead
   and the heirs do. He tells himself it is grief.
3. `cantor_3` (Act 2) **The Confession, Part One.** He reads what he carries: the Founder tore
   the heart from the Lady Under the Hill.
4. `cantor_4` (Act 3) **His Own Grave.** In an Ashgrave chapel, his own body, laid out on
   Ashfall night. He died at the king's bedside.
5. `truth_cantor` (Act 3) **Witness.** He accepts he is dead. The confession must be delivered,
   not to the throne, but below it.

## Main plot
- `met_pell` (Act 1) **The Fool at the Crossroads.** Riddles. "Why is a crown hollow? Because
  the heart walked off." Pell remembers the loops.
- `pell_2` (Act 2) **The Lady Under the Hill.** Pell tells the old tale of the Pale Mother.
- `pell_3` (Act 2–3) **Two Coats.** Pell and the Pale Peddler are the same. (`peddler_is_pell`)
- `pell_4` (Act 3) **The Grate.** Through a sewer grate in Ashgrave, the Unspent: a century of
  the dead who never got to die. (`knows_unspent`)
- `pell_5` (Act 3) **How a Crown Breaks.** Requires ≥2 heroes at beat 3+. Pell explains the
  Crown can be broken only by someone who knows what it holds. (`knows_heart`)
- `crane_knows` (Act 3) **The Regent's Offer.** Crane reveals he remembers the loops too.
- `pell_6` (late, needs all four truths) **The Fool's Farewell.** Pell hints Hob is more than
  a gravekeeper. (`knows_founder`) In the hub, Hob then confesses he is Aldane the Founder
  (`hob_is_aldane`).

## Endings (Story Lead writes; see TEXTS.endings)
- **Long Live the King** (crown) — per-hero epilogue; the world freezes again.
- **Ashfall** (shatter) — per-hero epilogue; time resumes, the Unspent flood out.
- **The Turning of the Year** (true) — after Act 4. The heart goes home, the dead lie down,
  spring, Hob rests in his own grave.
