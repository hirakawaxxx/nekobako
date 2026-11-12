"""Scale each cat of a magenta-background sheet to its in-game diameter, then pixelize.

Every output is diameter x diameter "art pixels", so all cats share one dot size in the game.
usage: pixelize.py SHEET OUT_DIR
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

DIAMETERS = [14, 18, 24, 30, 36, 44, 52, 60, 70, 82]  # must match public/js/cats.js
DARK_LUMA = 75       # source pixels darker than this count as outline / eyes
DARK_SHARE = 0.30    # a dot turns dark when this share of its source block is dark
PALETTE_COLORS = 32

sheet_path, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)
rgb = np.asarray(Image.open(sheet_path).convert("RGB")).astype(np.float64)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
foreground = ~((r > 170) & (b > 170) & (g < 110) & (abs(r - b) < 70))

# --- find the 10 cats; drop thin bits (whisker tips, stray tail) hanging off the body ---
body = ndimage.binary_opening(foreground, iterations=6)
labels, count = ndimage.label(body)
sizes = ndimage.sum(body, labels, range(1, count + 1))
keep = np.argsort(sizes)[::-1][:10] + 1
all_boxes = ndimage.find_objects(labels)
cats = []
for k in keep:
    near_body = ndimage.binary_dilation(labels == k, iterations=4)
    mask = foreground & near_body
    ys, xs = np.where(mask)
    cats.append((ys.min(), ys.max() + 1, xs.min(), xs.max() + 1, mask))
height = rgb.shape[0]
cats.sort(key=lambda c: (c[0] + c[1] > height, c[2]))

luma = 0.299 * r + 0.587 * g + 0.114 * b
outline_color = np.median(rgb[foreground & (luma < DARK_LUMA)], axis=0)


def pixelize(y0, y1, x0, x1, mask, size):
    h, w = y1 - y0, x1 - x0
    side = max(h, w)
    # square source window centred on the cat, so the collision circle sits on the body
    cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
    step = side / size
    out = np.zeros((size, size, 4), np.uint8)
    # on a black cat the light details (eyes, whiskers) are the ones that must survive
    black_cat = (luma[mask] < DARK_LUMA).mean() > 0.5
    for j in range(size):
        for i in range(size):
            a, c = int(round(cy - side / 2 + j * step)), int(round(cy - side / 2 + (j + 1) * step))
            l, m = int(round(cx - side / 2 + i * step)), int(round(cx - side / 2 + (i + 1) * step))
            a, c, l, m = max(a, 0), min(max(c, a + 1), rgb.shape[0]), max(l, 0), min(max(m, l + 1), rgb.shape[1])
            block_mask = mask[a:c, l:m]
            if block_mask.size == 0 or block_mask.mean() < 0.5:
                continue
            pixels = rgb[a:c, l:m][block_mask]
            dark = luma[a:c, l:m][block_mask] < DARK_LUMA
            share = (1 - dark.mean()) if black_cat else dark.mean()
            if dark.all() or (share < 0.2 if black_cat else share >= DARK_SHARE):
                out[j, i, :3] = outline_color
            else:
                out[j, i, :3] = np.median(pixels[~dark], axis=0)
            out[j, i, 3] = 255
    # a one-dot outline on every cat, whatever its size
    alpha = out[..., 3] > 0
    padded = np.pad(alpha, 1)
    inner = padded[:-2, 1:-1] & padded[2:, 1:-1] & padded[1:-1, :-2] & padded[1:-1, 2:]
    out[alpha & ~inner, :3] = outline_color
    return out


sprites = [pixelize(*cat, size) for cat, size in zip(cats, DIAMETERS)]

opaque = np.concatenate([s[s[..., 3] > 0][:, :3] for s in sprites])
palette_img = Image.fromarray(opaque.reshape(1, -1, 3), "RGB").quantize(colors=PALETTE_COLORS, method=Image.Quantize.MEDIANCUT)
palette = np.asarray(palette_img.getpalette()[: PALETTE_COLORS * 3]).reshape(-1, 3)

scale, gap = 6, 6
preview = Image.new("RGBA", (sum(s.shape[1] * scale + gap for s in sprites), max(DIAMETERS) * scale), (60, 70, 66, 255))
x = 0
for n, sprite in enumerate(sprites, 1):
    flat = sprite[..., :3].reshape(-1, 3).astype(np.int32)
    nearest = ((flat[:, None, :] - palette[None]) ** 2).sum(axis=2).argmin(axis=1)
    sprite[..., :3] = palette[nearest].reshape(sprite.shape[0], sprite.shape[1], 3)
    sprite[sprite[..., 3] == 0] = 0
    image = Image.fromarray(sprite, "RGBA")
    image.save(out_dir / f"cat-{n:02d}.png", optimize=True)
    big = image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST)
    preview.alpha_composite(big, (x, preview.height - big.height))
    x += big.width + gap
preview.save(out_dir / "_preview.png")
print("ok", [s.shape[0] for s in sprites])
