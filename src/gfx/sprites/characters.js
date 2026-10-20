// Characters: hero battle sprites (40x56, facing right) and dialogue portraits (40x40).
import { defineSprites, PAL, shadeColor, mix } from '../sprite.js';

const sh = (c, f) => shadeColor(c, f);
// Character accent hues (desaturated to sit inside PAL).
const ROYAL = '#2f4577', ROYAL_D = '#1f2b4a', ROYAL_L = '#4a6296';

defineSprites({
  hero_knight: {
    w: 40, h: 56,
    draw(p) {
      const steel = PAL.steel, iron = PAL.iron;
      // tattered cape behind the near shoulder
      p.poly([[12, 14], [20, 15], [19, 38], [16, 47], [13, 44], [11, 50], [8, 46], [5, 51], [3, 46], [4, 36], [7, 22]], mix(ROYAL_D, PAL.ink, 0.2), { shade: 0.35 });
      p.line(8, 26, 6, 44, mix(ROYAL_D, PAL.void, 0.5)); p.line(12, 30, 11, 46, mix(ROYAL_D, PAL.void, 0.5));
      // greatsword trailing behind (near hand), blade down-back
      p.poly([[10, 34], [13, 35], [5, 54], [2, 54]], steel, { shade: 0.3 });
      p.line(11, 35, 4, 52, PAL.stone, 1);
      p.line(12, 35, 5, 52, PAL.fog, 1);
      // far leg (steps forward, right side)
      p.path([[25, 38], [28, 46], [29, 52]], iron, 5);
      p.poly([[26, 51], [32, 51], [35, 55], [26, 55]], iron, { shade: 0.3 });
      p.ellipse(28, 46, 2.5, 2, iron, { shade: 0.4 });
      // near leg (planted back, left side)
      p.path([[18, 38], [16, 46], [15, 52]], steel, 5);
      p.poly([[12, 51], [18, 51], [20, 55], [11, 55]], steel, { shade: 0.3 });
      p.ellipse(16, 46, 3, 2.2, steel, { shade: 0.4 });
      // breastplate + faulds
      p.poly([[14, 15], [29, 15], [31, 27], [30, 38], [14, 38], [12, 27]], steel, { shade: 0.35 });
      // tabard, tattered hem
      p.poly([[16, 17], [28, 17], [29, 31], [30, 42], [28, 40], [26, 45], [24, 41], [22, 46], [20, 42], [18, 45], [16, 41], [14, 43], [15, 31]], ROYAL, { shade: 0.3 });
      p.line(15, 30, 16, 41, ROYAL_D); p.line(24, 34, 25, 41, ROYAL_D);
      // belt
      p.rect(15, 31, 15, 2, PAL.leather, { shade: 0.3 });
      p.rect(21, 31, 2, 2, PAL.gold);
      // sigil: a crown, cracked through
      p.rect(19, 23, 7, 3, PAL.gold, { shade: 0.25 });
      p.px(19, 22, PAL.gold).px(19, 21, PAL.candle).px(22, 22, PAL.gold).px(22, 21, PAL.gold).px(22, 20, PAL.candle).px(25, 22, PAL.gold).px(25, 21, PAL.candle);
      p.rect(19, 26, 7, 1, sh(PAL.gold, -0.35));
      p.path([[23, 20], [22, 23], [23, 24], [22, 27]], ROYAL_D, 1);
      // gorget
      p.rect(18, 13, 8, 3, iron, { shade: 0.3 });
      // far pauldron
      p.ellipse(29, 17, 3.5, 3, iron, { shade: 0.4 });
      // head
      p.ellipse(22.5, 8, 4.5, 5.5, PAL.skin, { shade: 0.3 });
      p.poly([[17, 9], [17, 4], [20, 1], [25, 1], [28, 3], [27, 5], [24, 4], [21, 5], [20, 8], [19, 12]], PAL.dusk, { shade: 0.3 });
      p.px(22, 2, PAL.fog).px(24, 2, PAL.stone).px(19, 4, PAL.stone);
      p.poly([[20, 10], [23, 11], [26, 10], [27, 11], [26, 13], [21, 14], [19, 12]], mix(PAL.skin, PAL.dusk, 0.55));
      p.px(27, 7, PAL.skin).px(27, 8, PAL.skin); // nose
      p.rect(23, 6, 3, 1, PAL.dusk); // brow
      p.px(24, 7, PAL.void).px(25, 7, PAL.bone); // eye
      p.line(22, 5, 23, 10, sh(PAL.skin, -0.3)); // scar
      // shield on far arm
      p.poly([[27, 18], [38, 18], [38, 30], [36, 37], [32, 42], [28, 37], [27, 30]], PAL.wood, { shade: 0.35 });
      p.rect(27, 25, 11, 2, iron);
      p.path([[27, 18], [38, 18], [38, 30], [36, 37], [32, 42], [28, 37], [27, 30], [27, 18]], iron, 1);
      p.px(29, 19, PAL.steel).px(36, 19, PAL.steel).px(29, 26, PAL.steel).px(36, 26, PAL.steel);
      p.line(31, 29, 34, 35, PAL.bark); p.line(33, 20, 31, 24, PAL.bark);
      // battle damage on the plate
      p.px(13, 27, PAL.iron).px(14, 33, PAL.iron).px(29, 35, PAL.ash).px(17, 49, PAL.iron).px(36, 22, PAL.bark);
      p.erase(37, 18, 2, 2).erase(38, 20, 1, 1); // chipped shield corner
      // near arm hanging, gripping the sword
      p.path([[14, 20], [12, 26], [11, 31]], iron, 4);
      p.line(13, 21, 11, 26, PAL.stone, 1);
      p.path([[16, 21], [14, 27], [13, 31]], sh(iron, -0.45), 1);
      p.ellipse(12, 26, 2, 1.6, steel, { shade: 0.4 }); // couter
      p.ellipse(14.5, 17.5, 4.5, 3.5, steel, { shade: 0.45 }); // pauldron
      p.ellipse(14, 20.5, 4, 1.6, steel, { shade: 0.4 });
      p.line(10, 21, 18, 21, PAL.iron, 1);
      p.line(6, 32, 15, 36, PAL.gold, 2); // crossguard
      p.px(6, 32, PAL.candle);
      p.ellipse(11.5, 31.5, 2.2, 2, iron, { shade: 0.35 }); // gauntlet
      p.px(12, 30, PAL.steel);
    },
  },
  hero_witch: {
    w: 40, h: 56,
    draw(p) {
      const robe = mix(PAL.ink, PAL.moss, 0.45), robeD = mix(PAL.void, PAL.moss, 0.25);
      const cape = mix(PAL.sick, PAL.ash, 0.6), inner = mix(PAL.night, PAL.rot, 0.3);
      // staff (behind near hand)
      p.line(9, 55, 11, 3, PAL.bark, 2);
      p.line(9, 54, 11, 4, PAL.wood, 1);
      // coat, flared + tattered hem
      p.poly([[15, 17], [27, 17], [29, 30], [34, 52], [31, 50], [29, 54], [26, 51], [23, 55], [20, 51], [17, 54], [14, 50], [10, 53], [12, 40], [14, 28]], robe, { shade: 0.2 });
      // open front showing the underdress
      p.poly([[22, 30], [27, 30], [30, 52], [27, 50], [25, 54], [23, 50]], inner, { shade: 0.2 });
      p.line(21, 31, 22, 51, robeD); p.line(16, 34, 13, 50, robeD); p.line(28, 31, 31, 49, sh(robe, 0.2));
      // boots
      p.rect(18, 53, 4, 3, PAL.bark); p.poly([[25, 53], [29, 53], [31, 56], [25, 56]], PAL.bark);
      // belt, satchel and vials
      p.rect(14, 29, 16, 2, PAL.bark);
      p.px(22, 29, PAL.gold);
      p.rect(14, 31, 6, 6, PAL.leather, { shade: 0.35 });
      p.rect(14, 31, 6, 2, sh(PAL.leather, -0.3));
      p.px(17, 34, PAL.gold);
      p.rect(15, 28, 1, 3, PAL.venom); p.rect(17, 27, 1, 4, PAL.bile); p.px(17, 27, PAL.bone); p.rect(18, 29, 1, 2, PAL.spirit);
      p.rect(27, 31, 2, 3, PAL.venom); p.px(27, 31, PAL.bone); p.glow(28, 33, PAL.venom, 2);
      // capelet, ragged
      p.poly([[14, 15], [28, 15], [31, 23], [29, 22], [27, 26], [24, 23], [21, 27], [18, 23], [15, 26], [12, 23]], cape, { shade: 0.35 });
      // hood, point trailing back
      p.poly([[15, 5], [21, 1], [26, 3], [29, 9], [28, 16], [17, 17], [13, 16], [8, 11], [13, 10]], robe, { shade: 0.35 });
      p.poly([[22, 6], [27, 6], [28, 13], [24, 15], [21, 12]], PAL.void);
      p.line(21, 5, 21, 12, sh(robe, 0.35));
      // beaked respirator
      p.poly([[24, 8], [28, 7], [36, 13], [37, 15], [33, 14], [27, 14], [24, 13]], PAL.bone, { shade: 0.3 });
      p.line(28, 11, 35, 14, sh(PAL.bone, -0.35));
      p.px(29, 9, sh(PAL.bone, -0.3)).px(31, 10, sh(PAL.bone, -0.3)).px(33, 11, sh(PAL.bone, -0.3)); // stitches
      p.circle(26, 9.5, 1.7, PAL.iron);
      p.px(26, 9, PAL.venom).px(25, 10, PAL.bile);
      p.glow(26, 9, PAL.venom, 2);
      p.rect(25, 12, 2, 2, PAL.leather);
      // near arm on the staff
      p.path([[16, 18], [13, 25], [11, 29]], cape, 4);
      p.path([[17, 20], [14, 26]], sh(cape, -0.35), 1);
      p.circle(11, 29, 1.6, PAL.pale);
      // far arm offering a sick-glowing vial
      p.path([[26, 18], [30, 24], [33, 26]], cape, 4);
      p.circle(33.5, 26, 1.6, PAL.pale);
      p.rect(33, 20, 3, 5, PAL.venom); p.px(34, 19, PAL.bone); p.px(34, 21, PAL.parch); p.px(33, 23, PAL.bile);
      p.glow(34, 22, PAL.venom, 5);
      p.glow(35, 17, PAL.venom, 1); p.glow(37, 14, PAL.bile, 1);
      // herb bundle + charm atop the staff
      p.path([[11, 3], [8, 0], [6, 2]], PAL.moss, 2);
      p.path([[11, 3], [14, 0], [16, 1]], PAL.rot, 2);
      p.path([[11, 4], [8, 7], [7, 10]], PAL.bile, 1);
      p.path([[11, 4], [14, 6], [15, 9]], PAL.moss, 1);
      p.rect(10, 4, 3, 2, PAL.leather);
      p.line(12, 6, 13, 10, PAL.stone); p.rect(12, 10, 2, 3, PAL.bile); p.px(12, 10, PAL.bone); p.glow(13, 12, PAL.venom, 3);
    },
  },
  hero_wren: {
    w: 40, h: 56,
    draw(p) {
      const cloak = PAL.violet, cloakD = mix(PAL.violet, PAL.night, 0.55), lining = mix(PAL.wine, PAL.night, 0.4);
      const cloth = mix(PAL.night, PAL.violet, 0.22), clothL = mix(PAL.dusk, PAL.violet, 0.3);
      const silver = PAL.frost;
      // cloak flowing back
      p.poly([[15, 15], [22, 16], [20, 34], [15, 44], [12, 41], [9, 47], [7, 42], [3, 46], [3, 38], [7, 27], [11, 19]], cloak, { shade: 0.35 });
      p.poly([[14, 20], [19, 22], [17, 36], [12, 40], [10, 36], [7, 39], [9, 28]], lining);
      p.line(10, 22, 5, 40, cloakD);
      // far leg forward (right), near leg back (left), light crouch
      p.path([[24, 36], [29, 43], [28, 52]], cloth, 4);
      p.poly([[26, 51], [31, 51], [34, 55], [26, 55]], PAL.ink);
      p.path([[19, 36], [15, 44], [13, 52]], clothL, 4);
      p.poly([[10, 51], [16, 51], [17, 55], [9, 55]], PAL.night, { shade: 0.3 });
      p.px(29, 50, silver).px(14, 50, silver);
      // slim torso
      p.poly([[17, 17], [26, 17], [27, 28], [26, 37], [17, 37], [16, 28]], clothL, { shade: 0.35 });
      p.path([[17, 19], [26, 33]], silver, 1); // baldric
      p.px(19, 22, PAL.steel).px(21, 25, PAL.steel).px(23, 28, PAL.steel);
      p.rect(16, 32, 11, 2, PAL.night);
      p.px(21, 32, silver).px(21, 33, PAL.steel);
      // hip sheaths
      p.rect(25, 33, 2, 6, PAL.leather); p.px(25, 33, silver);
      // high collar + cloak clasp
      p.poly([[15, 14], [26, 14], [27, 18], [15, 19]], cloakD, { shade: 0.3 });
      p.circle(17, 17, 1.3, silver);
      // hood up; the white mask is the focal point
      p.poly([[15, 9], [17, 4], [21, 1], [26, 2], [29, 6], [29, 12], [26, 16], [17, 16], [14, 13]], cloak, { shade: 0.35 });
      p.poly([[21, 5], [27, 4], [29, 7], [29, 13], [26, 16], [21, 14]], PAL.void);
      p.rect(22, 14, 3, 2, PAL.pale); // smooth, featureless jaw/neck
      // carved white mask (3/4, facing right)
      p.poly([[22, 5], [26, 4], [28, 6], [29, 9], [28, 12], [26, 14], [23, 14], [22, 10]], PAL.parch, { shade: 0.25 });
      p.rect(24, 8, 2, 1, PAL.void); p.px(28, 8, PAL.void); // eye slits
      p.px(24, 7, sh(PAL.bone, -0.25)).px(25, 7, sh(PAL.bone, -0.25)).px(28, 7, sh(PAL.bone, -0.25));
      p.line(25, 11, 27, 11, sh(PAL.bone, -0.4)); // carved smile
      p.px(24, 9, PAL.lilac).px(24, 10, PAL.violet); // painted tear
      p.line(26, 4, 25, 6, silver); p.px(26, 12, silver); // silver seam
      // near arm low, reverse-grip knife
      p.path([[17, 19], [14, 26], [12, 31]], clothL, 3);
      p.circle(12, 31, 1.4, PAL.pale);
      p.line(12, 32, 8, 37, PAL.steel, 2); p.line(12, 32, 9, 36, silver, 1);
      p.px(13, 31, PAL.leather);
      // far arm thrust forward, knife at the enemy
      p.path([[25, 19], [29, 23], [32, 22]], clothL, 3);
      p.circle(32.5, 22, 1.4, PAL.pale);
      p.line(33, 22, 39, 18, PAL.steel, 2); p.line(33, 21, 38, 18, silver, 1);
      p.px(32, 23, PAL.leather);
    },
  },
  hero_cantor: {
    w: 40, h: 56,
    draw(p) {
      const robe = mix(PAL.ash, PAL.ghost, 0.18), robeD = mix(PAL.dusk, PAL.ash, 0.45), robeL = mix(PAL.stone, PAL.ghost, 0.25);
      // lantern pole (far hand), crook at the top
      p.line(31, 55, 31, 6, PAL.bark, 2);
      p.line(30, 54, 30, 7, PAL.wood, 1);
      p.path([[31, 6], [32, 3], [35, 2], [37, 4]], PAL.bark, 2);
      // cassock, flaring to the ground
      p.poly([[17, 15], [26, 15], [28, 28], [31, 44], [33, 56], [9, 56], [12, 42], [15, 28]], robe, { shade: 0.3 });
      p.path([[16, 31], [14, 44], [12, 55]], robeD, 1); p.path([[22, 33], [21, 45], [21, 55]], robeD, 1);
      p.path([[27, 32], [29, 44], [30, 55]], robeD, 1); p.path([[19, 33], [18, 55]], robeL, 1);
      // cord belt with a knotted tail
      p.rect(15, 28, 13, 1, PAL.bone);
      p.path([[16, 29], [15, 33], [16, 37]], PAL.bone, 1); p.px(16, 33, PAL.parch);
      // candle-gold stole
      p.poly([[18, 15], [20, 15], [20, 43], [18, 43]], PAL.gold, { shade: 0.25 });
      p.poly([[23, 15], [25, 15], [26, 43], [24, 43]], PAL.gold, { shade: 0.25 });
      p.line(17, 44, 20, 44, PAL.candle); p.line(23, 44, 26, 44, PAL.candle);
      p.px(17, 45, PAL.gold).px(19, 45, PAL.gold).px(23, 45, PAL.gold).px(25, 45, PAL.gold);
      for (const y of [22, 34]) { p.px(19, y, PAL.bark).px(18, y + 1, PAL.bark).px(19, y + 1, PAL.bark).px(19, y + 2, PAL.bark); p.px(24, y, PAL.bark).px(24, y + 1, PAL.bark).px(25, y + 1, PAL.bark).px(24, y + 2, PAL.bark); }
      // fallen hood on the shoulders
      p.poly([[15, 14], [27, 13], [29, 17], [26, 19], [17, 19], [13, 17]], robeD, { shade: 0.35 });
      // head: pale, gentle, tonsured, eyes closed in prayer
      p.ellipse(22, 8, 4.3, 5.2, PAL.pale, { shade: 0.3 });
      p.poly([[17, 10], [17, 6], [19, 4], [20, 6], [19, 9], [19, 12]], PAL.fog, { shade: 0.2 });
      p.px(21, 3, PAL.fog).px(23, 3, PAL.fog).px(25, 3, PAL.fog).px(26, 4, PAL.fog);
      p.px(26, 8, PAL.pale).px(27, 9, PAL.pale); // nose
      p.line(23, 8, 25, 8, sh(PAL.pale, -0.45)); // closed lids
      p.line(23, 7, 25, 6, PAL.fog); // brow
      p.px(24, 11, sh(PAL.pale, -0.3)).px(25, 11, sh(PAL.pale, -0.3)); // mouth
      p.px(21, 9, sh(PAL.pale, -0.25)).px(21, 10, sh(PAL.pale, -0.25)); // hollow cheek
      // near arm, wide sleeve, a bone rosary
      p.poly([[15, 16], [18, 18], [17, 26], [19, 30], [14, 31], [12, 26]], robe, { shade: 0.35 });
      p.circle(17, 30, 1.5, PAL.pale);
      for (const [x, y] of [[17, 32], [16, 34], [16, 36], [17, 38], [18, 40]]) p.px(x, y, PAL.bone);
      p.rect(17, 41, 3, 2, PAL.bone); p.px(17, 42, PAL.void).px(19, 42, PAL.void); // little skull bead
      // far arm on the pole, wide sleeve
      p.poly([[25, 16], [28, 18], [31, 24], [30, 28], [26, 26], [24, 20]], robe, { shade: 0.35 });
      p.circle(31, 26, 1.5, PAL.pale);
      // lantern hanging from the crook
      p.line(37, 4, 37, 6, PAL.iron);
      p.tri(35, 7, 39, 7, 37, 5, PAL.iron);
      p.rect(35, 7, 5, 6, PAL.candle);
      p.line(35, 7, 35, 12, PAL.iron); p.line(39, 7, 39, 12, PAL.iron);
      p.px(37, 9, '#fff3c8').px(37, 10, PAL.flame);
      p.rect(35, 13, 5, 1, PAL.iron);
      p.glow(37, 10, PAL.candle, 4);
      // translucent: the hem dissolves into nothing (ordered dither, ghost-tinted)
      const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      for (let y = 38; y < 56; y++) for (let x = 8; x < 35; x++) {
        const c = p.get(x, y);
        if (c && x !== 30 && x !== 31) p.px(x, y, [169, 198, 194, Math.round(110 * (y - 38) / 18)]);
      }
      for (let y = 46; y < 56; y++) for (let x = 8; x < 35; x++) {
        const k = (y - 45) / 11;
        const t = (B[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
        if (t < k * 0.95) p.erase(x, y);
        else if (t < k * 1.5 && p.get(x + 1, y + 1)) { p.erase(x, y); p.px(x, y, [169, 198, 194, 80]); }
      }
    },
  },
  // ------------------------------------------------------------------ hero portraits (40x40)
  portrait_knight: {
    w: 40, h: 40,
    draw(p) {
      const steel = PAL.steel, iron = PAL.iron, skin = PAL.skin, skinD = sh(skin, -0.28), skinL = sh(skin, 0.25), hair = PAL.dusk;
      // cape, pauldrons, tabard
      p.poly([[0, 36], [5, 31], [35, 31], [40, 36], [40, 40], [0, 40]], mix(ROYAL_D, PAL.ink, 0.2));
      p.ellipse(5, 37, 8, 6, steel, { shade: 0.4 });
      p.ellipse(35, 37, 7, 6, iron, { shade: 0.4 });
      p.poly([[11, 35], [29, 35], [29, 40], [11, 40]], ROYAL, { shade: 0.25 });
      p.line(11, 35, 29, 35, PAL.gold);
      p.rect(17, 37, 6, 2, PAL.gold); p.px(17, 36, PAL.candle).px(20, 36, PAL.candle).px(22, 36, PAL.candle);
      p.path([[20, 35], [19, 37], [20, 39]], ROYAL_D, 1);
      // gorget
      p.poly([[12, 29], [28, 29], [29, 35], [11, 35]], iron, { shade: 0.35 });
      p.line(12, 32, 28, 32, steel); p.px(14, 30, PAL.fog);
      // neck
      p.rect(15, 26, 11, 4, skinD);
      // head
      p.poly([[12, 12], [16, 7], [27, 7], [30, 11], [31, 17], [30, 23], [27, 28], [22, 30], [17, 29], [13, 25], [12, 19]], skin);
      p.poly([[28, 12], [30, 11], [31, 17], [30, 23], [27, 28], [24, 29], [27, 23], [28, 17]], skinD); // far cheek in shade
      p.ellipse(12, 18, 2, 3, skinD); p.px(12, 18, sh(skin, -0.45));
      p.line(15, 10, 22, 9, skinL); // lit brow
      // hair, swept back, grey at the temple
      p.poly([[10, 20], [9, 10], [12, 5], [19, 2], [27, 2], [31, 5], [31, 10], [28, 8], [22, 7], [16, 8], [14, 11], [13, 16], [11, 21]], hair, { shade: 0.25 });
      p.path([[12, 8], [17, 4], [25, 3]], PAL.ash, 1); p.px(11, 14, PAL.stone).px(12, 12, PAL.stone).px(11, 16, PAL.ash);
      // heavy brows, tired eyes
      p.rect(15, 13, 6, 1, hair); p.rect(24, 13, 5, 1, hair);
      p.line(16, 15, 20, 15, PAL.ink); p.line(24, 15, 27, 15, PAL.ink);
      p.rect(16, 16, 4, 1, PAL.bone); p.px(18, 16, PAL.water).px(19, 16, PAL.ink);
      p.rect(24, 16, 3, 1, PAL.bone); p.px(25, 16, PAL.water).px(26, 16, PAL.ink);
      p.line(16, 17, 19, 17, skinD); p.line(24, 17, 26, 17, skinD); // bags
      // nose
      p.path([[23, 15], [24, 19], [25, 21]], skinD, 1); p.px(22, 17, skinL).px(22, 18, skinL);
      p.line(23, 22, 26, 22, sh(skin, -0.45));
      // short grizzled beard
      p.poly([[13, 21], [16, 25], [19, 26], [24, 25], [28, 22], [30, 21], [28, 26], [23, 30], [18, 30], [14, 26]], mix(hair, PAL.ash, 0.3));
      p.poly([[19, 24], [26, 24], [25, 26], [20, 26]], mix(hair, PAL.ash, 0.3));
      p.line(19, 25, 25, 25, sh(PAL.rose, -0.45)); // mouth, set hard
      p.px(17, 27, PAL.stone).px(22, 28, PAL.stone).px(26, 27, PAL.stone);
      // scar through the near brow
      p.path([[16, 9], [18, 14], [19, 20]], sh(PAL.rose, 0.25), 1);
      p.px(18, 15, sh(PAL.rose, 0.25));
    },
  },
  portrait_witch: {
    w: 40, h: 40,
    draw(p) {
      const robe = mix(PAL.ink, PAL.moss, 0.45), cape = mix(PAL.sick, PAL.ash, 0.6);
      const skin = mix(PAL.pale, PAL.sick, 0.22), skinD = mix(skin, PAL.dusk, 0.35), skinL = sh(skin, 0.3), hair = mix(PAL.wine, PAL.night, 0.25);
      // hood + shoulders
      p.poly([[0, 40], [1, 32], [7, 27], [8, 12], [13, 4], [21, 1], [29, 4], [33, 11], [33, 27], [39, 32], [40, 40]], robe, { shade: 0.3 });
      p.poly([[0, 40], [2, 34], [11, 30], [29, 30], [38, 34], [40, 40]], cape, { shade: 0.35 });
      p.poly([[4, 40], [7, 35], [9, 38], [12, 34], [15, 40]], sh(cape, -0.25));
      p.poly([[11, 12], [16, 6], [26, 6], [30, 11], [31, 30], [10, 30]], PAL.void);
      // hair spilling from the hood
      p.poly([[10, 16], [13, 9], [20, 7], [27, 9], [30, 14], [30, 26], [27, 18], [22, 11], [16, 12], [13, 18], [12, 28], [10, 28]], hair, { shade: 0.25 });
      // face: sharp, narrow chin
      p.poly([[14, 15], [18, 11], [25, 12], [28, 16], [28, 21], [25, 27], [21, 30], [17, 27], [14, 21]], skin);
      p.poly([[26, 15], [28, 16], [28, 21], [25, 27], [21, 30], [24, 25], [26, 20]], skinD);
      p.line(15, 19, 17, 25, skinL);
      p.rect(18, 29, 6, 2, skinD);
      // arched brows, one raised; narrowed green eyes
      p.path([[15, 15], [17, 13], [20, 14]], hair, 1); p.path([[23, 15], [25, 14], [27, 15]], hair, 1);
      p.line(16, 16, 20, 16, PAL.ink); p.line(23, 17, 27, 17, PAL.ink);
      p.rect(16, 17, 4, 1, PAL.bone); p.px(18, 17, PAL.bile).px(19, 17, PAL.ink);
      p.rect(23, 18, 3, 1, PAL.bone); p.px(24, 18, PAL.bile).px(25, 18, PAL.ink);
      // nose + crooked smirk
      p.path([[22, 17], [23, 21], [22, 22]], skinD, 1); p.px(21, 19, skinL);
      p.line(19, 25, 23, 25, sh(PAL.rose, -0.3)); p.px(24, 24, sh(PAL.rose, -0.3)).px(25, 24, skinD);
      p.line(20, 26, 22, 26, mix(skin, PAL.rose, 0.3));
      // sickly underglow
      p.px(19, 28, PAL.bile).px(20, 29, PAL.sick).px(22, 29, PAL.sick).px(26, 25, PAL.sick);
      // beaked mask hanging at the throat
      p.line(12, 30, 28, 30, PAL.leather);
      p.poly([[13, 31], [21, 31], [24, 33], [33, 38], [34, 40], [20, 40], [14, 37]], PAL.bone, { shade: 0.3 });
      p.line(22, 35, 33, 39, sh(PAL.bone, -0.35));
      p.circle(16, 34, 2, PAL.iron); p.px(15, 33, PAL.venom); p.px(16, 35, PAL.bile);
      // vial glow
      p.rect(4, 33, 3, 5, PAL.venom); p.px(5, 32, PAL.bone); p.glow(5, 35, PAL.venom, 4);
    },
  },
  portrait_wren: {
    w: 40, h: 40,
    draw(p) {
      const cloak = PAL.violet, cloakD = mix(PAL.violet, PAL.night, 0.55), silver = PAL.frost;
      const T = 0.15; // curious head tilt
      const R = (pts) => pts.map(([x, y]) => [20 + (x - 20) * Math.cos(T) - (y - 18) * Math.sin(T), 18 + (x - 20) * Math.sin(T) + (y - 18) * Math.cos(T)]);
      const E = (pts, c, o) => p.poly(R(pts), c, o);
      // cloak shoulders + hood
      p.poly([[0, 40], [1, 33], [8, 28], [32, 28], [39, 33], [40, 40]], cloak, { shade: 0.35 });
      p.line(20, 30, 20, 40, cloakD); p.line(8, 33, 5, 40, cloakD); p.line(33, 33, 35, 40, cloakD);
      p.circle(20, 32, 2.2, silver); p.px(19, 31, '#ffffff'); p.ring(20, 32, 2.3, PAL.steel, 1);
      E([[6, 28], [7, 12], [12, 3], [20, 0], [29, 3], [34, 12], [34, 28], [27, 32], [13, 32]], cloak, { shade: 0.35 });
      E([[10, 27], [10, 13], [14, 6], [26, 6], [30, 13], [30, 27], [25, 31], [15, 31]], PAL.void);
      E([[7, 14], [12, 4], [14, 5], [10, 14]], PAL.lilac);
      // smooth, featureless chin
      E([[15, 25], [25, 25], [24, 30], [16, 30]], PAL.pale);
      E([[22, 25], [25, 25], [24, 30], [21, 30]], sh(PAL.pale, -0.25));
      // the mask
      E([[12, 15], [15, 9], [20, 7], [25, 9], [28, 15], [28, 21], [25, 26], [20, 27], [15, 26], [12, 21]], PAL.parch);
      E([[25, 10], [28, 15], [28, 21], [25, 26], [21, 27], [24, 23], [26, 16]], sh(PAL.parch, -0.18));
      E([[14, 16], [19, 15], [18, 18], [15, 18]], PAL.void);
      E([[21, 15], [26, 16], [25, 18], [22, 18]], PAL.void);
      E([[14, 14], [18, 13], [18, 14], [14, 15]], sh(PAL.bone, -0.3));
      E([[22, 13], [26, 14], [26, 15], [22, 14]], sh(PAL.bone, -0.3));
      E([[17, 22], [23, 22], [22, 23], [18, 23]], sh(PAL.bone, -0.4)); // carved closed smile
      E([[16, 19], [17, 19], [17, 23], [16, 23]], PAL.violet); // painted tear
      E([[13, 20], [14, 20], [15, 22], [14, 23], [13, 22]], sh(PAL.bone, -0.25)); // cheek curl
      E([[26, 20], [27, 20], [27, 22], [26, 23], [25, 22]], sh(PAL.bone, -0.4));
      E([[20, 7], [21, 7], [20, 12], [19, 12]], silver); // silver-mended seam
      E([[19, 12], [20, 12], [21, 15], [20, 15]], silver);
      p.speckle(sh(PAL.parch, 0.3), 0.04, 9, [13, 8, 27, 26]);
    },
  },
  portrait_cantor: {
    w: 40, h: 40,
    draw(p) {
      const robe = mix(PAL.ash, PAL.ghost, 0.15), robeD = mix(PAL.dusk, PAL.ash, 0.45);
      const skin = mix(PAL.pale, PAL.ghost, 0.12), skinD = mix(skin, PAL.water, 0.32), skinL = sh(skin, 0.3), hair = PAL.fog;
      // cassock shoulders + fallen hood
      p.poly([[0, 40], [2, 32], [10, 28], [30, 28], [38, 32], [40, 40]], robe, { shade: 0.3 });
      p.poly([[4, 34], [11, 28], [29, 28], [36, 34], [28, 33], [20, 34], [12, 33]], robeD, { shade: 0.3 });
      // stole
      p.poly([[12, 33], [16, 32], [17, 40], [13, 40]], PAL.gold, { shade: 0.2 });
      p.poly([[24, 32], [28, 33], [27, 40], [23, 40]], PAL.gold, { shade: 0.2 });
      for (const x of [14, 25]) { p.px(x, 35, PAL.bark).px(x - 1, 36, PAL.bark).px(x, 36, PAL.bark).px(x + 1, 36, PAL.bark).px(x, 37, PAL.bark); }
      // neck
      p.rect(16, 25, 8, 5, skinD);
      // head (facing the viewer, bowed a little)
      p.poly([[12, 11], [15, 5], [20, 4], [25, 5], [28, 11], [28, 19], [25, 25], [20, 28], [15, 25], [12, 19]], skin);
      p.poly([[25, 7], [28, 11], [28, 19], [25, 25], [21, 28], [24, 22], [26, 15]], skinD);
      p.line(16, 6, 22, 5, skinL); p.px(14, 9, skinL);
      p.ellipse(11.5, 16, 1.5, 2.5, skinD); p.ellipse(28.5, 16, 1.5, 2.5, sh(skinD, -0.15));
      // tonsure: a ring of pale hair low around a bare crown
      p.poly([[11, 14], [11, 10], [13, 8], [17, 8], [14, 10], [13, 14]], hair, { shade: 0.2 });
      p.poly([[29, 14], [29, 10], [27, 8], [23, 8], [26, 10], [27, 14]], sh(hair, -0.2));
      p.line(17, 8, 23, 8, hair);
      // closed eyes, gentle brows, small sad mouth
      p.line(14, 12, 18, 12, hair); p.line(22, 12, 26, 12, sh(hair, -0.2));
      p.path([[14, 15], [16, 16], [18, 15]], skinD, 1); p.path([[22, 15], [24, 16], [26, 15]], sh(skinD, -0.2), 1);
      p.path([[20, 14], [21, 19], [19, 20]], skinD, 1); p.px(19, 16, skinL);
      p.line(18, 22, 22, 22, sh(skin, -0.38)); p.px(17, 23, skinD).px(23, 23, skinD);
      p.px(15, 19, skinD).px(25, 19, skinD);
      // candlelight from the right
      p.px(28, 13, PAL.candle).px(28, 17, PAL.candle).px(27, 21, PAL.candle).px(29, 15, PAL.flame).px(25, 24, PAL.candle);
      // shoulders fading out (he is not quite here)
      const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      for (let y = 28; y < 40; y++) for (let x = 0; x < 40; x++) {
        const edge = Math.max(0, 1 - Math.min(x, 39 - x) / 10) * ((y - 26) / 12);
        if ((B[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < edge) p.erase(x, y);
      }
    },
  },
  // ------------------------------------------------------------------ NPC portraits (40x40)
  npc_hob: {
    w: 40, h: 40,
    draw(p) {
      const coat = mix(PAL.leather, PAL.bark, 0.5), skin = mix(PAL.skin, PAL.leather, 0.25), skinD = sh(skin, -0.3), lamp = PAL.candle;
      // spade over the shoulder
      p.line(30, 40, 37, 6, PAL.wood, 2);
      p.poly([[33, 1], [39, 3], [39, 9], [36, 10], [33, 7]], PAL.iron, { shade: 0.35 });
      // coat + scarf
      p.poly([[0, 40], [2, 31], [10, 27], [30, 27], [37, 31], [40, 40]], coat, { shade: 0.3 });
      p.rect(7, 34, 4, 4, mix(PAL.wood, PAL.ash, 0.4)); p.px(7, 34, PAL.bone).px(10, 37, PAL.bone); // patch
      p.poly([[12, 27], [28, 27], [27, 32], [13, 32]], PAL.wine, { shade: 0.3 });
      // face
      p.poly([[11, 13], [14, 9], [26, 9], [29, 13], [29, 20], [26, 26], [20, 28], [14, 26], [11, 20]], skin);
      p.poly([[26, 12], [29, 13], [29, 20], [26, 26], [23, 27], [26, 20]], skinD);
      p.ellipse(10.5, 17, 1.6, 2.5, skinD); p.ellipse(29.5, 17, 1.6, 2.5, skinD);
      // battered felt hat
      p.poly([[3, 12], [10, 9], [12, 3], [20, 1], [28, 3], [30, 9], [37, 12], [30, 13], [10, 13]], mix(PAL.dusk, PAL.bark, 0.5), { shade: 0.3 });
      p.line(11, 9, 29, 9, PAL.bark); p.px(34, 11, PAL.night).px(5, 11, PAL.ash);
      // bushy white brows, crinkled kind eyes
      p.rect(13, 14, 5, 2, PAL.bone); p.rect(22, 14, 5, 2, PAL.bone);
      p.path([[14, 17], [15, 18], [17, 17]], PAL.ink, 1); p.path([[23, 17], [24, 18], [26, 17]], PAL.ink, 1);
      p.px(15, 17, PAL.water).px(24, 17, PAL.water);
      p.px(12, 18, skinD).px(13, 19, skinD).px(27, 18, skinD).px(26, 19, skinD); // crow's feet
      // big nose
      p.ellipse(20, 20, 2, 2, sh(skin, 0.1)); p.px(19, 19, sh(skin, 0.35)); p.px(21, 21, skinD);
      // white beard with a smile in it
      p.poly([[11, 20], [14, 22], [18, 22], [20, 23], [22, 22], [26, 22], [29, 20], [29, 25], [26, 31], [20, 34], [14, 31], [11, 25]], PAL.bone, { shade: 0.25 });
      p.path([[17, 24], [20, 25], [23, 24]], sh(PAL.rose, -0.4), 1);
      p.px(16, 28, PAL.fog).px(20, 30, PAL.fog).px(24, 28, PAL.fog);
      // lantern light from below-left
      p.px(12, 21, lamp).px(11, 19, lamp).px(12, 25, lamp).px(14, 30, lamp);
      p.rect(1, 31, 5, 7, PAL.candle); p.rect(1, 30, 5, 1, PAL.iron); p.rect(1, 38, 5, 1, PAL.iron); p.line(3, 31, 3, 37, PAL.gold);
      p.glow(3, 34, PAL.candle, 5);
    },
  },
  npc_pell: {
    w: 40, h: 40,
    draw(p) {
      const red = mix(PAL.rose, PAL.ash, 0.35), mus = mix(PAL.gold, PAL.ash, 0.4), teal = mix(PAL.ghost, PAL.ash, 0.45);
      const T = -0.12;
      const R = (pts) => pts.map(([x, y]) => [20 + (x - 20) * Math.cos(T) - (y - 18) * Math.sin(T), 18 + (x - 20) * Math.sin(T) + (y - 18) * Math.cos(T)]);
      const E = (pts, c, o) => p.poly(R(pts), c, o);
      // motley shoulders (faded diamonds)
      p.poly([[0, 40], [2, 31], [10, 27], [30, 27], [38, 31], [40, 40]], red, { shade: 0.3 });
      for (let i = 0; i < 6; i++) { const x = 3 + i * 7; p.poly([[x, 31], [x + 3, 35], [x, 40], [x - 3, 35]], i % 2 ? mus : teal, { shade: 0.2 }); }
      p.poly([[11, 27], [29, 27], [32, 31], [26, 30], [20, 33], [14, 30], [8, 31]], PAL.bone, { shade: 0.3 }); // ruff
      // jester hood with drooping points + bells
      E([[8, 26], [8, 13], [12, 6], [20, 4], [28, 6], [32, 13], [32, 26], [27, 29], [13, 29]], mus, { shade: 0.3 });
      E([[20, 4], [28, 6], [32, 13], [32, 26], [27, 29], [20, 29]], red, { shade: 0.3 });
      p.path(R([[12, 7], [6, 3], [2, 8], [2, 14]]), mus, 3);
      p.path(R([[28, 6], [34, 2], [38, 7], [38, 13]]), red, 3);
      for (const [x, y] of R([[2, 15], [38, 14]])) { p.circle(x, y, 1.6, PAL.gold, { shade: 0.3 }); p.px(Math.round(x), Math.round(y) + 1, PAL.bark); }
      // cracked porcelain smile-mask
      E([[11, 15], [14, 9], [20, 8], [26, 9], [29, 15], [28, 22], [24, 27], [20, 28], [16, 27], [12, 22]], PAL.parch);
      E([[26, 10], [29, 15], [28, 22], [24, 27], [21, 28], [25, 22], [27, 15]], sh(PAL.parch, -0.18));
      E([[13, 15], [18, 14], [17, 17], [14, 17]], PAL.void); E([[22, 14], [27, 15], [26, 17], [23, 17]], PAL.void);
      E([[15, 18], [16, 18], [16, 21], [15, 21]], PAL.ink); E([[24, 18], [25, 18], [25, 21], [24, 21]], PAL.ink); // painted diamonds
      E([[13, 21], [16, 23], [20, 24], [24, 23], [27, 21], [25, 25], [20, 26], [15, 25]], PAL.blood); // painted grin
      E([[15, 22], [25, 22], [24, 23], [16, 23]], PAL.gore);
      p.path(R([[19, 8], [18, 11], [20, 13], [19, 17], [21, 19], [20, 22]]), PAL.ink, 1); // the crack
      for (const [x, y] of R([[15, 16], [24, 16]])) p.px(Math.round(x), Math.round(y), PAL.candle);
    },
  },
  npc_peddler: {
    w: 40, h: 40,
    draw(p) {
      const cloak = mix(PAL.bark, PAL.dusk, 0.5), cloakL = mix(PAL.wood, PAL.ash, 0.4);
      // heavy cloak with straps and trinkets
      p.poly([[0, 40], [1, 30], [9, 25], [31, 25], [39, 30], [40, 40]], cloak, { shade: 0.3 });
      p.line(9, 27, 17, 40, PAL.leather, 2); p.line(31, 27, 23, 40, PAL.leather, 2);
      p.rect(5, 32, 3, 5, PAL.rot); p.px(6, 31, PAL.bone); // bottle
      p.ring(33, 34, 2, PAL.gold, 1); p.line(33, 36, 34, 39, PAL.gold); p.px(35, 39, PAL.gold); // key
      p.circle(13, 35, 1.5, PAL.gold); p.circle(27, 36, 1.5, PAL.gold); p.px(13, 35, PAL.candle);
      p.rect(19, 30, 3, 4, PAL.bone); p.px(19, 31, PAL.void).px(21, 31, PAL.void); // skull trinket
      // deep hood
      p.poly([[6, 27], [7, 12], [12, 4], [20, 1], [28, 4], [33, 12], [34, 27], [28, 31], [12, 31]], cloakL, { shade: 0.35 });
      p.poly([[10, 27], [10, 14], [14, 8], [26, 8], [30, 14], [30, 27], [25, 30], [15, 30]], PAL.void);
      p.line(13, 8, 9, 26, sh(cloakL, 0.25));
      // only the grin
      p.poly([[13, 21], [17, 23], [20, 24], [23, 23], [27, 21], [25, 25], [20, 27], [15, 25]], PAL.bone);
      for (const x of [15, 17, 19, 21, 23, 25]) p.px(x, 24, PAL.ash);
      p.line(14, 23, 26, 23, sh(PAL.bone, 0.3));
      p.px(16, 15, PAL.candle).px(24, 15, PAL.candle);
      p.px(16, 15, '#ffe9a8');
    },
  },
  npc_crane: {
    w: 40, h: 40,
    draw(p) {
      const blk = mix(PAL.ink, PAL.night, 0.5), skin = mix(PAL.pale, PAL.fog, 0.25), skinD = mix(skin, PAL.dusk, 0.45), silver = PAL.steel;
      // black coat, high collar, silver trim
      p.poly([[0, 40], [2, 30], [11, 25], [29, 25], [38, 30], [40, 40]], blk, { shade: 0.3 });
      p.poly([[11, 22], [16, 28], [20, 31], [24, 28], [29, 22], [31, 30], [20, 36], [9, 30]], mix(PAL.night, PAL.dusk, 0.3), { shade: 0.3 });
      p.path([[9, 30], [20, 36], [31, 30]], silver, 1);
      // chain of office
      for (let i = 0; i <= 10; i++) { const t = i / 10, x = 4 + t * 32, y = 33 + Math.sin(t * Math.PI) * 4; p.rect(Math.round(x), Math.round(y), 2, 1, i % 2 ? PAL.frost : silver); }
      p.circle(20, 38, 2.5, silver, { shade: 0.4 }); p.px(20, 38, PAL.wine);
      // gaunt face, 3/4 left
      p.poly([[12, 11], [15, 6], [24, 5], [28, 10], [28, 17], [26, 23], [22, 27], [18, 27], [14, 23], [12, 17]], skin);
      p.poly([[12, 13], [15, 13], [15, 21], [18, 26], [14, 23], [12, 17]], skinD); // shadowed far cheek
      p.poly([[23, 17], [26, 16], [25, 22], [23, 21]], skinD); // hollow cheek
      p.ellipse(28.5, 16, 1.5, 2.5, skinD);
      // slicked silver hair
      p.poly([[11, 14], [11, 7], [15, 3], [23, 2], [29, 5], [30, 12], [28, 10], [26, 6], [18, 6], [14, 9], [13, 14]], PAL.fog, { shade: 0.3 });
      p.line(15, 4, 26, 4, PAL.frost); p.line(14, 7, 25, 5, PAL.stone);
      // cold pale eyes under severe brows
      p.line(13, 12, 17, 13, PAL.ash); p.line(20, 13, 25, 12, PAL.ash);
      p.rect(14, 14, 3, 1, PAL.bone); p.px(14, 14, PAL.frost).px(15, 14, PAL.ink);
      p.rect(21, 14, 3, 1, PAL.bone); p.px(21, 14, PAL.frost).px(22, 14, PAL.ink);
      p.line(14, 15, 16, 15, skinD); p.line(21, 15, 23, 15, skinD);
      // long thin nose, thin hard mouth
      p.path([[18, 14], [17, 19], [18, 20]], skinD, 1); p.px(19, 16, sh(skin, 0.3));
      p.line(16, 23, 21, 23, sh(PAL.wine, -0.2)); p.px(15, 22, skinD);
    },
  },
  npc_maren: {
    w: 40, h: 40,
    draw(p) {
      const skin = mix(PAL.ghost, PAL.frost, 0.3), skinD = mix(PAL.ghost, PAL.water, 0.5), hair = mix(PAL.deep, PAL.moss, 0.35), weed = PAL.moss;
      // weed-tangled hair falling past the shoulders
      p.poly([[3, 40], [4, 24], [7, 10], [13, 3], [20, 1], [27, 3], [33, 10], [36, 24], [37, 40]], hair, { shade: 0.3 });
      p.poly([[9, 40], [11, 30], [29, 30], [31, 40]], mix(PAL.water, PAL.ghost, 0.3), { shade: 0.3 }); // drowned gown
      p.path([[11, 30], [20, 34], [29, 30]], PAL.frost, 1);
      // face
      p.poly([[12, 12], [15, 7], [25, 7], [28, 12], [28, 19], [25, 25], [20, 28], [15, 25], [12, 19]], skin);
      p.poly([[25, 9], [28, 12], [28, 19], [25, 25], [21, 28], [24, 21], [26, 14]], skinD);
      p.rect(17, 27, 6, 3, skinD);
      // hair strands across the brow
      p.poly([[11, 16], [13, 9], [20, 6], [17, 10], [14, 15], [13, 22]], hair); p.poly([[29, 16], [27, 9], [21, 6], [25, 10], [27, 15], [27, 23]], hair);
      // tarnished crown
      p.poly([[12, 7], [14, 2], [16, 5], [18, 1], [20, 4], [22, 1], [24, 5], [26, 2], [28, 7], [27, 8], [13, 8]], mix(PAL.gold, PAL.moss, 0.45), { shade: 0.3 });
      p.px(20, 6, PAL.spirit).px(15, 6, PAL.rot).px(25, 4, PAL.rot);
      // hollow, sorrowing eyes
      p.rect(14, 14, 4, 2, PAL.deep); p.rect(22, 14, 4, 2, PAL.deep);
      p.px(15, 14, PAL.spirit).px(23, 14, PAL.spirit);
      p.path([[14, 13], [16, 12], [18, 13]], skinD, 1); p.path([[22, 13], [24, 12], [26, 13]], skinD, 1);
      p.path([[20, 15], [20, 19], [19, 20]], skinD, 1);
      p.path([[17, 23], [20, 22], [23, 23]], PAL.deep, 1);
      // water tears and dripping weed
      p.line(15, 16, 15, 21, PAL.spirit); p.px(15, 22, PAL.frost);
      p.path([[8, 12], [6, 22], [7, 32], [5, 39]], weed, 1); p.path([[32, 14], [34, 26], [32, 34], [34, 39]], weed, 1);
      p.path([[11, 20], [9, 28], [10, 36]], PAL.rot, 1); p.px(9, 25, PAL.bile).px(33, 22, PAL.bile);
      // translucent: dissolve toward the bottom
      const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      for (let y = 30; y < 40; y++) for (let x = 0; x < 40; x++) if ((B[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < (y - 29) / 13) p.erase(x, y);
    },
  },
  npc_grall: {
    w: 40, h: 40,
    draw(p) {
      const blk = mix(PAL.ink, PAL.bark, 0.25), skin = mix(PAL.skin, PAL.ash, 0.2), skinD = sh(skin, -0.32), hat = mix(PAL.night, PAL.bark, 0.3);
      // black coat, white falling bands, iron gorget
      p.poly([[0, 40], [2, 30], [11, 26], [29, 26], [38, 30], [40, 40]], blk, { shade: 0.3 });
      p.poly([[12, 27], [28, 27], [28, 32], [12, 32]], PAL.iron, { shade: 0.35 });
      p.poly([[16, 32], [24, 32], [25, 39], [21, 37], [19, 37], [15, 39]], PAL.parch, { shade: 0.25 });
      p.line(20, 32, 20, 37, sh(PAL.parch, -0.3));
      // face: heavy jaw, 3/4 left
      p.poly([[12, 13], [27, 13], [28, 19], [26, 25], [21, 28], [16, 27], [12, 22]], skin);
      p.poly([[12, 14], [15, 14], [15, 22], [17, 27], [12, 22]], skinD);
      p.ellipse(28, 18, 1.5, 2.5, skinD);
      // brows, hard eyes
      p.rect(14, 15, 5, 1, PAL.night); p.rect(21, 15, 5, 1, PAL.night);
      p.rect(15, 17, 3, 1, PAL.bone); p.px(15, 17, PAL.ink); p.rect(21, 17, 3, 1, PAL.bone); p.px(21, 17, PAL.ink);
      p.line(15, 16, 18, 16, skinD); p.line(21, 16, 24, 16, skinD);
      p.path([[19, 16], [18, 21], [19, 22]], skinD, 1);
      p.line(16, 24, 22, 24, sh(PAL.rose, -0.5)); p.px(15, 25, skinD).px(23, 25, skinD);
      p.path([[24, 19], [25, 24]], sh(PAL.rose, 0.15), 1); // old burn scar
      p.speckle(skinD, 0.12, 4, [13, 22, 27, 28]); // stubble
      // capotain hat: tall crown, broad brim, buckle
      p.poly([[13, 12], [14, 2], [26, 1], [27, 12]], hat, { shade: 0.3 });
      p.rect(13, 9, 14, 2, PAL.ink); p.rect(19, 9, 3, 2, PAL.steel); p.px(20, 9, PAL.ink);
      p.poly([[2, 14], [9, 11], [31, 11], [38, 14], [31, 15], [9, 15]], hat, { shade: 0.3 });
      // the brand, iron hot at the tip
      p.line(36, 40, 33, 14, PAL.iron, 2);
      p.rect(31, 9, 5, 5, PAL.ember); p.rect(32, 10, 3, 3, PAL.flame); p.px(33, 11, PAL.candle);
      p.glow(33, 11, PAL.ember, 5);
      p.px(27, 17, PAL.ember).px(27, 21, PAL.ember).px(26, 24, PAL.ember);
    },
  },
  npc_crown: {
    w: 40, h: 40, outline: false, rim: false,
    draw(p) {
      // darkness, with the faintest hunger-glow
      for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
        const d = Math.hypot(x - 20, (y - 23) * 1.2) / 24;
        p.px(x, y, mix(mix(PAL.wine, PAL.night, 0.35), PAL.void, Math.min(1, d * 1.1 + ((x * 7 + y * 11) % 5) * 0.025)));
      }
      // inside of the circlet (back band in shadow)
      p.ellipse(20, 24, 15, 5, mix(PAL.ink, PAL.wine, 0.2));
      p.ellipse(20, 25, 13, 3.5, PAL.void);
      // front band
      p.poly([[5, 24], [35, 24], [35, 30], [28, 33], [20, 34], [12, 33], [5, 30]], PAL.iron, { shade: 0.45 });
      // spikes: one snapped short
      p.tri(4.5, 26, 10, 26, 6, 15, PAL.iron, { shade: 0.3 });
      p.poly([[11, 26], [17, 26], [15, 13], [14, 15], [13, 12]], PAL.iron, { shade: 0.3 });
      p.tri(16, 26, 24, 26, 20, 4, PAL.iron, { shade: 0.3 });
      p.poly([[23, 26], [29, 26], [28, 19], [26, 20], [25, 18]], PAL.iron, { shade: 0.3 });
      p.tri(30, 26, 35.5, 26, 34, 15, PAL.iron, { shade: 0.3 });
      p.line(5, 25, 35, 25, PAL.steel); p.line(6, 31, 34, 31, sh(PAL.iron, -0.45));
      p.px(9, 28, PAL.ember).px(30, 29, sh(PAL.ember, -0.3)).px(25, 31, sh(PAL.ember, -0.3)).px(13, 30, PAL.bark);
      // the empty socket, hungry
      p.glow(20, 29, PAL.wine, 9); p.glow(20, 29, PAL.rose, 5);
      p.ellipse(20, 29, 3, 2.6, PAL.void);
      p.ring(20, 29, 3.6, PAL.steel, 1);
      p.px(18, 28, PAL.wine).px(21, 30, mix(PAL.wine, PAL.void, 0.5));
      // tips catch a cold light
      p.px(20, 5, PAL.fog).px(20, 6, PAL.stone).px(6, 16, PAL.stone).px(34, 16, PAL.stone).px(13, 13, PAL.stone);
      p.speckle(PAL.fog, 0.008, 21, [0, 0, 40, 18]);
    },
  },
  npc_mother: {
    w: 40, h: 40, outline: false, rim: false,
    draw(p) {
      const face = mix(PAL.pale, PAL.sick, 0.2), faceD = mix(face, PAL.moss, 0.35), faceDD = mix(PAL.moss, PAL.ink, 0.3);
      p.rect(0, 0, 40, 40, mix(PAL.ink, PAL.bark, 0.3));
      // roots behind
      for (const [pts, w] of [[[[0, 6], [8, 9], [12, 4], [18, 0]], 2], [[[40, 10], [32, 12], [28, 5], [30, 0]], 2], [[[0, 30], [6, 27], [10, 33], [6, 40]], 2], [[[40, 28], [34, 31], [33, 40]], 2]])
        p.path(pts, PAL.bark, w);
      // the immense face
      p.ellipse(20, 20, 15, 18, face);
      p.ellipse(25, 23, 10, 15, faceD); p.ellipse(18, 18, 12, 15, face);
      // brow, closed eyes, nose, lips
      p.path([[9, 15], [13, 13], [17, 14]], faceD, 1); p.path([[23, 14], [27, 13], [31, 15]], faceDD, 1);
      p.path([[9, 18], [11, 19], [14, 19], [17, 18]], faceDD, 1); p.path([[23, 18], [26, 19], [29, 19], [31, 18]], faceDD, 1);
      p.px(10, 19, faceDD).px(30, 19, faceDD);
      p.path([[20, 17], [21, 25], [19, 26]], faceD, 1); p.px(19, 22, sh(face, 0.3)).px(19, 23, sh(face, 0.3));
      p.path([[16, 29], [20, 28], [24, 29]], faceDD, 1); p.line(17, 30, 23, 30, faceD);
      // roots across the face, moss in the hollows
      p.path([[4, 0], [8, 8], [7, 16], [10, 24], [9, 34], [12, 40]], PAL.wood, 2);
      p.path([[36, 0], [33, 9], [35, 18], [31, 27], [33, 40]], PAL.bark, 2);
      p.path([[22, 0], [21, 6], [24, 11]], PAL.wood, 1); p.path([[8, 8], [13, 10]], PAL.wood, 1);
      p.path([[31, 27], [26, 33], [27, 40]], PAL.bark, 1); p.path([[10, 24], [14, 27]], PAL.wood, 1);
      p.speckle(PAL.moss, 0.35, 5, [2, 30, 14, 40]); p.speckle(PAL.rot, 0.3, 6, [27, 2, 38, 12]);
      p.speckle(PAL.moss, 0.25, 7, [28, 30, 38, 40]); p.speckle(PAL.bile, 0.06, 8, [2, 28, 38, 40]);
      p.px(12, 4, PAL.bone).px(30, 33, PAL.bone).px(7, 33, PAL.lilac);
    },
  },
});
