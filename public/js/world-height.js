// How tall the world is. The box grows downwards to use the height a phone screen leaves free,
// so the page has no empty band under it. Decided once at startup; the top of the box never moves.
export const BASE_WORLD_H = 240;
export const MAX_WORLD_H = 340;
const WORLD_W = 180;
const SAFETY_CSS_PX = 12; // fonts that load later may make the header a little taller

// Pure: world height (even, in art pixels) for `spare` free art pixels below a BASE_WORLD_H box.
export function worldHeightFor(spare) {
  const extra = Number.isFinite(spare) ? Math.max(0, Math.floor(spare / 2) * 2) : 0;
  return Math.min(MAX_WORLD_H, BASE_WORLD_H + extra);
}

// Browser side: lay the page out at the scale the width allows and see how much height is left.
export function measureWorldHeight() {
  if (typeof document === 'undefined') return BASE_WORLD_H;
  const app = document.getElementById('app');
  if (!app) return BASE_WORLD_H;
  const dpr = window.devicePixelRatio || 1;
  const px = Math.max(1, Math.floor(((window.innerWidth - 16) * dpr) / WORLD_W)) / dpr;
  document.body.style.setProperty('--px', `${px}px`);
  // .app is at least one screen tall, so measure where its content ends instead of its box.
  const contentBottom = app.lastElementChild.getBoundingClientRect().bottom
    + (parseFloat(getComputedStyle(app).paddingBottom) || 0);
  const spareCss = window.innerHeight - contentBottom - SAFETY_CSS_PX;
  return worldHeightFor(spareCss / px);
}
