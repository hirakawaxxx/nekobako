// Which cat to drop: random among the first DROP_LEVEL_COUNT stages, with one cat of lookahead.
import { DROP_LEVEL_COUNT } from './cats.js';

export function drawLevel(rng = Math.random) {
  const level = 1 + Math.floor(rng() * DROP_LEVEL_COUNT);
  return Math.min(level, DROP_LEVEL_COUNT);
}

export function createDropQueue(rng = Math.random) {
  let current = drawLevel(rng);
  let next = drawLevel(rng);
  return {
    get current() {
      return current;
    },
    get next() {
      return next;
    },
    // Returns the cat to drop now and advances: next becomes current, and a new next is drawn.
    take() {
      const taken = current;
      current = next;
      next = drawLevel(rng);
      return taken;
    },
  };
}
