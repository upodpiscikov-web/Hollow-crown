// Pacing knobs per act. Act 1 is tuned for a ~15 minute act: a short map with
// few branches and enemies that die in 2-3 turns. Other acts keep the original
// pacing until Act 1 has been played and approved (see REVAMP.md).
//   floors: nodes per path before the boss   paths: branching routes drawn
//   hp:     multiplier on every enemy's base HP (before Crown Weight scaling)
export const PACE = {
  1: { floors: 9, paths: 4, hp: 0.7 },
};
const DEFAULT = { floors: 15, paths: 6, hp: 1 };
export const paceOf = (act) => PACE[act] || DEFAULT;
