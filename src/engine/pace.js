// Pacing knobs per act (see BALANCE_NOTES.md; measured with tools/act1-stats.mjs).
// Act 1 is a short, readable act: a small map with few branches whose fights end fast
// (normal 2-3 turns, elite 3-4, boss 5-7 for the competent-player policy). Because the hero
// action buttons made every hero much stronger in EVERY act, Acts 2-3 get tougher enemy
// damage and slightly shorter elite/boss HP so they stay sharp instead of getting longer.
//   floors: nodes per path before the boss   paths: branching routes drawn
//   hp:     multiplier on every enemy's base HP (before Crown Weight scaling)
//   dmg:    multiplier on every enemy attack's damage (moveDmg in combat.js)
//   hpElite / hpBoss / dmgElite / dmgBoss: optional extra multipliers (on top of hp / dmg) for elites / bosses
export const PACE = {
  1: { floors: 9, paths: 4, hp: 1, hpElite: 0.6, hpBoss: 0.5, dmg: 1 },
  2: { hp: 1, hpElite: 0.85, hpBoss: 0.65, dmg: 1.5 },
  3: { hp: 1, hpElite: 0.85, hpBoss: 0.75, dmg: 1.85, dmgBoss: 1.5 },
};
const DEFAULT = { floors: 15, paths: 6, hp: 1, dmg: 1, hpElite: 1, hpBoss: 1, dmgElite: 1, dmgBoss: 1 };
export const paceOf = (act) => {
  const p = PACE[act];
  return p ? { ...DEFAULT, ...p } : DEFAULT;
};
