// Pacing knobs per act. Act 1 is tuned for a short, readable act: a small map with few
// branches and enemies that die in 2-3 turns. Acts 2-3 keep their full map but are
// re-balanced against the hero action buttons (see BALANCE_NOTES.md, tools/act1-stats.mjs).
//   floors: nodes per path before the boss   paths: branching routes drawn
//   hp:     multiplier on every enemy's base HP (before Crown Weight scaling)
//   dmg:    multiplier on every enemy attack's damage (moveDmg in combat.js)
//   hpElite / hpBoss: optional extra HP multipliers (on top of hp) for elites / bosses
export const PACE = {
  1: { floors: 9, paths: 4, hp: 0.7, dmg: 1 },
};
const DEFAULT = { floors: 15, paths: 6, hp: 1, dmg: 1, hpElite: 1, hpBoss: 1 };
export const paceOf = (act) => {
  const p = PACE[act];
  return p ? { ...DEFAULT, ...p } : DEFAULT;
};
