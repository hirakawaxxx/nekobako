// World geometry in art pixels. The canvas is WORLD_W x WORLD_H and is scaled up by a constant factor.
import { measureWorldHeight } from './world-height.js';

export const WORLD_W = 180;
// 240 in tests and on short screens; taller on phones that have room (see world-height.js).
export const WORLD_H = measureWorldHeight();
export const WALL = 10;
export const INNER_L = WALL;
export const INNER_R = WORLD_W - WALL;
export const BOX_TOP = 30;
export const FLOOR_Y = WORLD_H - WALL;
export const LINE_Y = 52;
export const DROP_Y = 18;
export const COOLDOWN_MS = 500;
export const STEP_MS = 1000 / 60;
export const KEY_SPEED = 90; // art pixels per second while an arrow key is held

export function clampDropX(x, diameter) {
  const r = diameter / 2;
  return Math.min(INNER_R - r, Math.max(INNER_L + r, x));
}
