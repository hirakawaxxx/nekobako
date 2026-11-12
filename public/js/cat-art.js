// Placeholder cat sprites, drawn pixel by pixel (no anti-aliasing, always upright).
// renderCatPixels() is pure (returns RGBA bytes); sprite-cache.js turns it into a canvas.
// Replace a stage with a real image via sprites.js.
import { diameterOf, MAX_LEVEL } from './cats.js';

const INK = '#4a3a36';
const EYE_DARK = '#2d2630';
const EYE_GOLD = '#f2d24a';
const PINK = '#e58c9a';
const WHITE = '#fffdf8';

// body/shade: fur and its shadow. ear/inner: ear fill and inside of the ear.
const LOOKS = {
  1: { pattern: 'yarn', body: '#cdc3d8', shade: '#a99bbb', outline: '#5b4f66', ears: false, eye: 'dot', eyeColor: EYE_DARK, nose: null },
  2: { pattern: 'plain', body: '#f6dcb4', shade: '#e2bf8d', eye: 'sparkle', eyeColor: EYE_DARK, blush: true },
  3: { pattern: 'plain', body: '#f7f4ee', shade: '#d6d0c6', eye: 'tall', eyeColor: '#3f7fc8', whisker: '#b9b2a8' },
  4: { pattern: 'plain', body: '#4a4553', shade: '#38343f', outline: '#1d1a22', inner: '#8a5a6a', eye: 'tall', eyeColor: EYE_GOLD, whisker: '#d3cfdc', mouth: '#1d1a22' },
  5: { pattern: 'tabby', body: '#e8a152', shade: '#c97f36', stripe: '#b5631f', eye: 'dot', eyeColor: EYE_DARK },
  6: { pattern: 'calico', body: '#f7f4ee', shade: '#d6d0c6', orange: '#e8a152', black: '#3a3540', eye: 'happy', eyeColor: EYE_DARK, ear: '#e8a152' },
  7: { pattern: 'hachiware', body: '#f7f4ee', shade: '#d6d0c6', black: '#3a3540', eye: 'dot', eyeColor: EYE_GOLD, ear: '#3a3540', inner: '#8a5a6a' },
  8: { pattern: 'plain', body: '#8f929e', shade: '#6f727e', muzzle: '#b9bbc4', eye: 'angry', eyeColor: EYE_DARK, scar: '#c24a4a', ear: '#8f929e' },
  9: { pattern: 'tiger', body: '#eea63c', shade: '#cc8423', stripe: '#3a2a22', muzzle: '#fff0d4', eye: 'angry', eyeColor: EYE_DARK },
  10: { pattern: 'lion', body: '#eab864', shade: '#d09a45', mane: '#a9631f', maneDark: '#7d450f', muzzle: '#fbe3b0', eye: 'dot', eyeColor: EYE_DARK, ear: '#a9631f', inner: '#7d450f' },
};

const hexCache = new Map();
function rgb(hex) {
  let value = hexCache.get(hex);
  if (!value) {
    value = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
    hexCache.set(hex, value);
  }
  return value;
}

// Ear triangle for the left side in unit coordinates (-1..1 across the sprite); mirrored for the right.
const EAR = [[-1.0, -0.25], [-0.74, -1.0], [-0.38, -0.92]];

function inTriangle(px, py, [a, b, c]) {
  const sign = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const p = [px, py];
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const negative = d1 < 0 || d2 < 0 || d3 < 0;
  const positive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(negative && positive);
}

function shrink(tri, k) {
  const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
  const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
  return tri.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

const mirror = (tri) => tri.map(([x, y]) => [-x, y]);

// Fur pattern in unit coordinates (nx, ny in -1..1, y down). Returns a color or null for plain body.
function patternColor(look, nx, ny, px, py) {
  switch (look.pattern) {
    case 'yarn': {
      const x = nx - 0.25;
      const y = ny + 0.1;
      if (Math.abs(Math.hypot(x, y) - 0.6) < 0.08 && nx > -0.15) {
        return look.shade;
      }
      return (px * 5 + py * 11) % 7 === 0 ? look.shade : null;
    }
    case 'tabby': {
      const forehead = Math.abs(nx) < 0.34 && ny < -0.3 && Math.floor((nx + 1) * 10) % 2 === 0;
      const cheeks = Math.abs(nx) > 0.72 && ny > -0.3 && ny < 0.5 && Math.floor((ny + 1) * 7) % 2 === 0;
      return forehead || cheeks ? look.stripe : null;
    }
    case 'calico': {
      if (Math.hypot(nx + 0.5, ny + 0.45) < 0.5) return look.orange;
      if (Math.hypot(nx - 0.55, ny + 0.3) < 0.42) return look.black;
      if (Math.hypot(nx - 0.4, ny - 0.62) < 0.3) return look.orange;
      return null;
    }
    case 'hachiware':
      return ny < 0 && Math.abs(nx) > (ny + 0.95) * 0.38 ? look.black : null;
    case 'tiger': {
      const forehead = Math.abs(nx) < 0.5 && ny < -0.3 && Math.floor((nx + 1) * 6) % 2 === 0;
      const sides = Math.abs(nx) > 0.6 && Math.floor((ny + 1) * 4.5) % 2 === 0;
      return forehead || sides ? look.stripe : null;
    }
    case 'lion':
      if (Math.hypot(nx, ny) > 0.64) {
        return (px * 3 + py * 7) % 6 === 0 ? look.maneDark : look.mane;
      }
      return null;
    default:
      return null;
  }
}

export function renderCatPixels(level, diameter = diameterOf(level)) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new RangeError(`unknown cat level: ${level}`);
  }
  const look = LOOKS[level];
  const D = diameter;
  const R = D / 2;
  const data = new Uint8ClampedArray(D * D * 4);
  const put = (x, y, hex) => {
    if (x < 0 || y < 0 || x >= D || y >= D) return;
    data.set([...rgb(hex), 255], (y * D + x) * 4);
  };
  const rect = (x, y, w, h, hex) => {
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) put(x + i, y + j, hex);
  };
  const outline = look.outline ?? INK;
  const thickness = D >= 40 ? 2 : 1;

  // Ears first: the disc is drawn over their lower half.
  if (look.ears !== false) {
    const earFill = look.ear ?? look.body;
    const innerFill = look.inner ?? '#f0a5ae';
    for (const tri of [EAR, mirror(EAR)]) {
      const outer = tri;
      const fill = shrink(tri, 0.66);
      const inner = shrink(tri, 0.36);
      for (let py = 0; py < D; py += 1) {
        for (let px = 0; px < D; px += 1) {
          const ux = (px + 0.5 - R) / R;
          const uy = (py + 0.5 - R) / R;
          if (!inTriangle(ux, uy, outer)) continue;
          if (D >= 24 && inTriangle(ux, uy, inner)) put(px, py, innerFill);
          else if (inTriangle(ux, uy, fill)) put(px, py, earFill);
          else put(px, py, outline);
        }
      }
    }
  }

  // Head disc with outline, base color, shadow crescent and fur pattern.
  for (let py = 0; py < D; py += 1) {
    for (let px = 0; px < D; px += 1) {
      const x = px + 0.5 - R;
      const y = py + 0.5 - R;
      const d = Math.hypot(x, y);
      if (d > R) continue;
      if (d > R - thickness) {
        put(px, py, outline);
        continue;
      }
      let color = patternColor(look, x / R, y / R, px, py) ?? look.body;
      if (D >= 18 && d > R * 0.74 && x * 0.5 + y * 0.85 > 0.5 * R && color === look.body) {
        color = look.shade;
      }
      put(px, py, color);
    }
  }

  // Muzzle.
  if (look.muzzle && D >= 24) {
    for (let py = 0; py < D; py += 1) {
      for (let px = 0; px < D; px += 1) {
        const nx = (px + 0.5 - R) / (0.36 * R);
        const ny = (py + 0.5 - R - 0.3 * R) / (0.26 * R);
        if (nx * nx + ny * ny <= 1) put(px, py, look.muzzle);
      }
    }
  }

  // Eyes, mirrored around the center line.
  const eyeY = Math.round(R - 0.08 * R);
  const eyeOffset = 0.42 * R;
  const pair = (width, draw) => {
    const left = Math.round(R - eyeOffset - width / 2);
    draw(left, 1);
    draw(D - left - width, -1);
  };
  const ink = look.eyeColor;
  switch (look.eye) {
    case 'sparkle': {
      const w = Math.max(2, Math.round(D * 0.11));
      pair(w, (x) => {
        rect(x, eyeY - 1, w, w + 1, ink);
        put(x, eyeY - 1, WHITE);
      });
      break;
    }
    case 'tall': {
      const w = Math.max(1, Math.round(D * 0.07));
      pair(w, (x) => rect(x, eyeY - w, w, w * 2 + 1, ink));
      break;
    }
    case 'happy': {
      const w = Math.max(3, Math.round(D * 0.14));
      const thick = D >= 44 ? 2 : 1;
      pair(w, (x) => {
        for (let i = 0; i < w; i += 1) {
          const dy = Math.round(Math.abs(i - (w - 1) / 2) * 0.7);
          rect(x + i, eyeY + dy - 1, 1, thick, ink);
        }
      });
      break;
    }
    case 'angry': {
      const w = Math.max(2, Math.round(D * 0.08));
      const brow = Math.max(3, Math.round(D * 0.16));
      pair(w, (x, side) => {
        rect(x, eyeY - 1, w, w + 1, ink);
        for (let i = 0; i < brow; i += 1) {
          // Brows slope down toward the nose.
          const bx = side === 1 ? x - 1 + i : x + w - brow + i;
          const slope = side === 1 ? i : brow - 1 - i;
          put(bx, eyeY - 3 - Math.round((brow - 1 - slope) * 0.5), ink);
          if (D >= 44) put(bx, eyeY - 2 - Math.round((brow - 1 - slope) * 0.5), ink);
        }
      });
      break;
    }
    default: {
      const w = Math.max(1, Math.round(D * 0.06));
      const h = w + Math.max(1, Math.round(D * 0.05));
      pair(w, (x) => rect(x, eyeY - 1, w, h, ink));
    }
  }

  if (look.blush && D >= 18) {
    pair(2, (x, side) => rect(side === 1 ? x - 1 : x + 1, eyeY + Math.round(D * 0.12), 2, 1, '#f0a5ae'));
  }

  // Nose, mouth, whiskers.
  const noseY = Math.round(R + 0.22 * R);
  if (look.nose !== null && D >= 18) {
    rect(D / 2 - 1, noseY, 2, 1, look.nose ?? PINK);
    if (D >= 24) {
      const mouth = look.mouth ?? INK;
      for (const [dx, dy] of [[0, 1], [-1, 2], [-2, 2], [-3, 1]]) {
        put(D / 2 - 1 + dx, noseY + dy, mouth);
        put(D / 2 - dx, noseY + dy, mouth);
      }
    }
  }
  if (D >= 30 && look.nose !== null) {
    const length = Math.round(D * 0.12);
    const whisker = look.whisker ?? outline;
    for (let k = 0; k < 2; k += 1) {
      for (let i = 0; i < length; i += 1) {
        const dy = Math.round((k === 0 ? -i : i) / 3);
        const reach = Math.round(0.5 * R) + i;
        put(Math.round(R) + reach, noseY - 1 + k * 3 + dy, whisker);
        put(Math.round(R) - 1 - reach, noseY - 1 + k * 3 + dy, whisker);
      }
    }
  }

  // Scar across the left eye.
  if (look.scar && D >= 24) {
    for (let step = 0; step <= 100; step += 1) {
      const t = step / 100;
      put(Math.round(R + (-0.62 + 0.4 * t) * R), Math.round(R + (-0.55 + 0.85 * t) * R), look.scar);
    }
  }

  return { width: D, height: D, data };
}
