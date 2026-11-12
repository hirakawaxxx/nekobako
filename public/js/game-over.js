// "Full box" detection: a settled cat above the line for GAME_OVER_MS in a row ends the game.
export const GAME_OVER_MS = 2000;
// A cat that was just dropped (or just merged into existence) is still falling past the line.
export const GRACE_MS = 1000;

export function isOverLine(cat, lineY, graceMs = GRACE_MS) {
  return cat.age >= graceMs && cat.top < lineY;
}

// cats: [{ top, age }] with top = y of the cat's upper edge, age = ms since it appeared.
export function createOverTimer({ lineY, limitMs = GAME_OVER_MS, graceMs = GRACE_MS }) {
  let elapsed = 0;
  return {
    update(dtMs, cats) {
      elapsed = cats.some((cat) => isOverLine(cat, lineY, graceMs)) ? elapsed + dtMs : 0;
      return elapsed >= limitMs;
    },
    reset() {
      elapsed = 0;
    },
    get elapsed() {
      return elapsed;
    },
    // 0 when safe, 1 when the game ends.
    get progress() {
      return Math.min(1, elapsed / limitMs);
    },
  };
}
