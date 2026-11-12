// Browser side: one native-size canvas per stage (placeholder or image), no smoothing.
import { CATS, diameterOf } from './cats.js';
import { renderCatPixels } from './cat-art.js';
import { SPRITES, resolveSprite } from './sprites.js';

function placeholderCanvas(level) {
  const { width, height, data } = renderCatPixels(level);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
  return canvas;
}

function imageCanvas(level, image) {
  const size = diameterOf(level);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, size, size);
  return canvas;
}

// Returns { get(level) }. Placeholders are ready immediately; stages whose sprite definition
// points at an image are swapped in when the image loads (a failed load keeps the placeholder).
export function createSpriteCache(sprites = SPRITES) {
  const canvases = new Map(CATS.map(({ level }) => [level, placeholderCanvas(level)]));
  for (const { level } of CATS) {
    const resolved = resolveSprite(level, sprites);
    if (resolved.kind !== 'image') continue;
    const image = new Image();
    image.addEventListener('load', () => canvases.set(level, imageCanvas(level, image)));
    image.src = resolved.src;
  }
  return { get: (level) => canvases.get(level) };
}
