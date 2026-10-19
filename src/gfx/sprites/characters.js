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
});
