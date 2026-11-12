// Sprite definitions. Each stage draws a placeholder (generated at runtime, see cat-art.js)
// until you set `image` to a file in public/sprites/ (e.g. 'cat-03.png').
// An image should be diameter x diameter art pixels (see cats.js); it is scaled without smoothing.
export const SPRITE_DIR = '/sprites/';

export const SPRITES = Object.freeze([
  { level: 1, image: null },
  { level: 2, image: null },
  { level: 3, image: null },
  { level: 4, image: null },
  { level: 5, image: null },
  { level: 6, image: null },
  { level: 7, image: null },
  { level: 8, image: null },
  { level: 9, image: null },
  { level: 10, image: null },
].map(Object.freeze));

export const spriteFileName = (level) => `cat-${String(level).padStart(2, '0')}.png`;

export function resolveSprite(level, sprites = SPRITES) {
  const def = sprites.find((sprite) => sprite.level === level);
  return def?.image
    ? { kind: 'image', src: `${SPRITE_DIR}${def.image}` }
    : { kind: 'placeholder' };
}
