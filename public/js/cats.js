// Cat stages, scoring and merge pitch. Pure: no DOM, no Matter.

// Diameters are in "art pixels" (1 art pixel = one pixel of the 180x240 world). All even.
export const CATS = Object.freeze([
  { level: 1, name: '毛玉', diameter: 14 },
  { level: 2, name: '子猫', diameter: 18 },
  { level: 3, name: '白猫', diameter: 24 },
  { level: 4, name: '黒猫', diameter: 30 },
  { level: 5, name: '茶トラ', diameter: 36 },
  { level: 6, name: '三毛', diameter: 44 },
  { level: 7, name: 'ハチワレ', diameter: 52 },
  { level: 8, name: 'ボス猫', diameter: 60 },
  { level: 9, name: '虎', diameter: 70 },
  { level: 10, name: 'ライオン', diameter: 82 },
].map(Object.freeze));

export const MAX_LEVEL = CATS.length;
// Only the first five stages can be dropped.
export const DROP_LEVEL_COUNT = 5;
export const MAX_MERGE_BONUS = 150;

export function catOf(level) {
  const cat = CATS[level - 1];
  if (!cat) {
    throw new RangeError(`unknown cat level: ${level}`);
  }
  return cat;
}

export const diameterOf = (level) => catOf(level).diameter;

// Points for merging two cats of `level`: the triangular number of the level they become.
// Two max-level cats vanish together and give a flat bonus instead.
export function mergeScore(level) {
  catOf(level);
  if (level >= MAX_LEVEL) {
    return MAX_MERGE_BONUS;
  }
  return ((level + 1) * (level + 2)) / 2;
}

// Pitch (Hz) of the merge sound for the cat that was created: the bigger the cat, the lower the note.
export function mergeFrequency(level) {
  catOf(level);
  return 1320 * 2 ** (-(level - 2) * 0.3);
}
