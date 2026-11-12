// What happened in one game, for the result screen. Pure: no DOM, no Matter.
export function createStats() {
  let drops = 0;
  let merges = 0;
  let maxLevel = 0;
  return {
    // A cat of `level` was dropped into the box.
    drop(level) {
      drops += 1;
      maxLevel = Math.max(maxLevel, level);
    },
    // Two cats merged into a cat of `level` (null when two of the biggest vanished together).
    merge(level = null) {
      merges += 1;
      if (level !== null) maxLevel = Math.max(maxLevel, level);
    },
    reset() {
      drops = 0;
      merges = 0;
      maxLevel = 0;
    },
    get drops() { return drops; },
    get merges() { return merges; },
    // Biggest stage seen this game; 0 before the first drop.
    get maxLevel() { return maxLevel; },
  };
}

// Whole CSS pixels per art pixel for the big cat on the result screen, so every stage ends up
// roughly the same size on screen (`box` is the room it has, in CSS pixels).
export function heroScale(diameter, box = 176, max = 8) {
  return Math.max(1, Math.min(max, Math.floor(box / diameter)));
}
