// ねこばこ: wires Matter.js physics, canvas drawing, input, audio and the DOM together.
// Rules and numbers live in js/*.js (pure modules with tests); this file is the glue.
import { CATS, MAX_LEVEL, catOf, diameterOf, mergeScore } from './js/cats.js';
import { createDropQueue } from './js/queue.js';
import { createOverTimer } from './js/game-over.js';
import {
  BOX_TOP, COOLDOWN_MS, DROP_Y, FLOOR_Y, INNER_L, INNER_R, KEY_SPEED, LINE_Y,
  STEP_MS, WALL, WORLD_H, WORLD_W, clampDropX,
} from './js/config.js';
import { createSpriteCache } from './js/sprite-cache.js';
import { createAudio } from './js/audio.js';
import { loadBest, loadMuted, saveBest, saveMuted } from './js/storage.js';
import { createStats, heroScale } from './js/stats.js';

const { Engine, Bodies, Body, Composite, Events } = globalThis.Matter;

const $ = (id) => document.getElementById(id);
const app = $('app');
const boardCanvas = $('board');
const nextCanvas = $('next');
const scoreEl = $('score');
const bestEl = $('best');
const muteButton = $('mute');
const overEl = $('over');
const againButton = $('again');

const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();

// ?seed=N makes the drop order repeatable (used for testing).
function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedParam = new URLSearchParams(location.search).get('seed');
const queue = createDropQueue(seedParam === null ? Math.random : seededRng(Number(seedParam) || 1));

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const sprites = createSpriteCache();
const audio = createAudio({ muted: loadMuted(storage) });
const overTimer = createOverTimer({ lineY: LINE_Y });
const stats = createStats();

// ---------- Drawing ----------

boardCanvas.height = WORLD_H;
document.body.style.setProperty('--world-h', String(WORLD_H));
const ctx = boardCanvas.getContext('2d', { alpha: false });
const nextCtx = nextCanvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
nextCtx.imageSmoothingEnabled = false;

const CARDBOARD = {
  light: { kraft: '#c9a06a', shade: '#b08756', dark: '#7b5c36', lip: '#dfba86', tape: '#e8d9ab' },
  dark: { kraft: '#8a6a42', shade: '#765a38', dark: '#4f3a22', lip: '#a07e50', tape: '#a89a6c' },
};

let theme = null;
let frontLayer = null;

function readTheme() {
  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();
  theme = {
    air: token('--color-surface'),
    inside: token('--color-surface-sunken'),
    line: token('--color-indicator'),
    danger: token('--color-error-text'),
    guide: token('--color-text-muted'),
    paper: darkScheme.matches ? CARDBOARD.dark : CARDBOARD.light,
  };
  frontLayer = drawCardboard(theme.paper);
  drawNext();
}

// The box walls and floor, drawn once per theme and laid over the cats.
function drawCardboard(c) {
  const layer = document.createElement('canvas');
  layer.width = WORLD_W;
  layer.height = WORLD_H;
  const g = layer.getContext('2d');
  const wallH = WORLD_H - BOX_TOP;
  g.fillStyle = c.kraft;
  g.fillRect(0, BOX_TOP, WALL, wallH);
  g.fillRect(WORLD_W - WALL, BOX_TOP, WALL, wallH);
  g.fillRect(0, FLOOR_Y, WORLD_W, WALL);
  // Corrugation stripes.
  g.fillStyle = c.shade;
  for (let y = BOX_TOP + 8; y < FLOOR_Y; y += 4) {
    g.fillRect(1, y, WALL - 3, 1);
    g.fillRect(WORLD_W - WALL + 2, y, WALL - 3, 1);
  }
  for (let x = 1; x < WORLD_W; x += 4) {
    g.fillRect(x, FLOOR_Y + 3, 2, WALL - 4);
  }
  // Packing tape across the floor.
  g.fillStyle = c.tape;
  g.fillRect(WORLD_W / 2 - 10, FLOOR_Y, 20, WALL);
  // Top lip of the walls and the inner edges.
  g.fillStyle = c.lip;
  g.fillRect(0, BOX_TOP, WALL, 4);
  g.fillRect(WORLD_W - WALL, BOX_TOP, WALL, 4);
  g.fillStyle = c.dark;
  g.fillRect(0, BOX_TOP + 4, WALL, 1);
  g.fillRect(WORLD_W - WALL, BOX_TOP + 4, WALL, 1);
  g.fillRect(WALL - 1, BOX_TOP + 5, 1, FLOOR_Y - BOX_TOP - 5);
  g.fillRect(WORLD_W - WALL, BOX_TOP + 5, 1, FLOOR_Y - BOX_TOP - 5);
  g.fillRect(WALL, FLOOR_Y, WORLD_W - 2 * WALL, 1);
  g.fillRect(0, BOX_TOP, 1, wallH);
  g.fillRect(WORLD_W - 1, BOX_TOP, 1, wallH);
  g.fillRect(0, WORLD_H - 1, WORLD_W, 1);
  return layer;
}

function drawSprite(target, level, cx, cy) {
  const size = diameterOf(level);
  target.drawImage(sprites.get(level), Math.round(cx - size / 2), Math.round(cy - size / 2));
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  drawSprite(nextCtx, queue.next, nextCanvas.width / 2, nextCanvas.height / 2);
  nextCanvas.setAttribute('aria-label', `つぎの猫: ${catOf(queue.next).name}`);
}

function dashedRow(y, x0, x1, on, off) {
  for (let x = x0; x < x1; x += on + off) {
    ctx.fillRect(x, y, Math.min(on, x1 - x), 1);
  }
}

function render() {
  ctx.fillStyle = theme.air;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = theme.inside;
  ctx.fillRect(INNER_L, BOX_TOP, INNER_R - INNER_L, FLOOR_Y - BOX_TOP);

  // Drop guide under the held cat.
  const holding = !state.over && state.cooldown <= 0;
  if (holding) {
    const bottom = Math.round(DROP_Y + diameterOf(state.heldLevel) / 2) + 2;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = theme.guide;
    for (let y = bottom; y < FLOOR_Y; y += 4) {
      ctx.fillRect(Math.round(state.heldX), y, 1, 2);
    }
    ctx.globalAlpha = 1;
  }

  // Game-over line.
  ctx.fillStyle = overTimer.progress > 0 ? theme.danger : theme.line;
  dashedRow(LINE_Y, INNER_L, INNER_R, 3, 3);

  for (const body of cats) {
    drawSprite(ctx, body.catLevel, body.position.x, body.position.y);
  }
  if (holding) {
    drawSprite(ctx, state.heldLevel, state.heldX, DROP_Y);
  }
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
  }
  ctx.drawImage(frontLayer, 0, 0);
}

// ---------- Physics ----------

const engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
engine.gravity.scale = 0.0011;
const WALL_OPTIONS = { isStatic: true, friction: 0.4, restitution: 0, label: 'wall' };
const WALL_THICKNESS = 200;
Composite.add(engine.world, [
  Bodies.rectangle(INNER_L - WALL_THICKNESS / 2, 100, WALL_THICKNESS, 1000, WALL_OPTIONS),
  Bodies.rectangle(INNER_R + WALL_THICKNESS / 2, 100, WALL_THICKNESS, 1000, WALL_OPTIONS),
  Bodies.rectangle(WORLD_W / 2, FLOOR_Y + WALL_THICKNESS / 2, WORLD_W + 2 * WALL_THICKNESS, WALL_THICKNESS, WALL_OPTIONS),
]);

const MAX_SPEED = 12;
const cats = [];
const pendingMerges = [];
const particles = [];

function addCat(level, x, y, velocity = { x: 0, y: 0 }) {
  const diameter = diameterOf(level);
  const body = Bodies.circle(x, y, diameter / 2, {
    label: 'cat',
    restitution: 0.05,
    friction: 0.4,
    frictionStatic: 0.6,
    frictionAir: 0.012,
    density: 0.002,
  }, 40);
  body.catLevel = level;
  body.born = state.time;
  body.dead = false;
  Body.setVelocity(body, velocity);
  Composite.add(engine.world, body);
  cats.push(body);
  return body;
}

function removeCat(body) {
  body.dead = true;
  Composite.remove(engine.world, body);
  cats.splice(cats.indexOf(body), 1);
}

function onCollision({ pairs }) {
  for (const { bodyA: a, bodyB: b } of pairs) {
    if (a.label === 'cat' && b.label === 'cat' && a.catLevel === b.catLevel && !a.dead && !b.dead) {
      pendingMerges.push([a, b]);
    }
  }
}
Events.on(engine, 'collisionStart', onCollision);
Events.on(engine, 'collisionActive', onCollision);

function burst(x, y, level) {
  if (reducedMotion.matches) return;
  const count = 4 + Math.floor(level / 2);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    particles.push({
      x, y, vx: Math.cos(angle) * 1.4, vy: Math.sin(angle) * 1.4 - 0.5, life: 18,
      color: i % 2 ? '#fffdf8' : '#f2d24a',
    });
  }
}

function resolveMerges() {
  for (const [a, b] of pendingMerges) {
    if (a.dead || b.dead) continue;
    const level = a.catLevel;
    const x = (a.position.x + b.position.x) / 2;
    const y = (a.position.y + b.position.y) / 2;
    const velocity = {
      x: (a.velocity.x + b.velocity.x) / 2,
      y: (a.velocity.y + b.velocity.y) / 2,
    };
    removeCat(a);
    removeCat(b);
    addScore(mergeScore(level));
    burst(x, y, level);
    if (level >= MAX_LEVEL) {
      stats.merge();
      audio.playMerge(MAX_LEVEL);
    } else {
      const next = level + 1;
      stats.merge(next);
      const r = diameterOf(next) / 2;
      addCat(next, Math.min(INNER_R - r, Math.max(INNER_L + r, x)), Math.min(FLOOR_Y - r, y), velocity);
      audio.playMerge(next);
    }
  }
  pendingMerges.length = 0;
}

// ---------- Game state ----------

const state = {
  time: 0,
  score: 0,
  best: loadBest(storage),
  over: false,
  cooldown: 0,
  heldLevel: queue.take(),
  heldX: WORLD_W / 2,
  targetX: WORLD_W / 2,
};

function addScore(points) {
  state.score += points;
  scoreEl.textContent = String(state.score);
}

function tryDrop() {
  if (state.over || state.cooldown > 0) return;
  const level = state.heldLevel;
  addCat(level, state.heldX, DROP_Y);
  stats.drop(level);
  state.heldLevel = queue.take();
  state.cooldown = COOLDOWN_MS;
  drawNext();
}

// One small canvas showing the sprite of `level` at its native size.
function catCanvas(level, canvas = document.createElement('canvas')) {
  const size = diameterOf(level);
  canvas.width = size;
  canvas.height = size;
  canvas.classList.add('pixel');
  canvas.style.setProperty('--d', String(size));
  canvas.getContext('2d').drawImage(sprites.get(level), 0, 0);
  return canvas;
}

function showResult() {
  const top = Math.max(1, stats.maxLevel);
  const hero = catCanvas(top, $('over-hero'));
  hero.style.setProperty('--k', String(heroScale(diameterOf(top))));
  $('over-hero-name').textContent = `${catOf(top).name}まで育ちました`;
  $('over-drops').textContent = String(stats.drops);
  $('over-merges').textContent = String(stats.merges);
  const zukan = $('over-zukan');
  zukan.replaceChildren(...CATS.map(({ level }) => {
    const canvas = catCanvas(level);
    canvas.classList.toggle('is-locked', level > top);
    return canvas;
  }));
  zukan.setAttribute('aria-label', `10段階のうち${top}段階まで育ちました`);
}

function endGame() {
  state.over = true;
  const record = state.score > state.best;
  if (record) {
    state.best = state.score;
    saveBest(storage, state.best);
  }
  bestEl.textContent = String(state.best);
  $('over-score').textContent = String(state.score);
  $('over-best').textContent = String(state.best);
  $('over-record').hidden = !record;
  showResult();
  overEl.hidden = false;
  audio.playGameOver();
  againButton.focus();
}

function restart() {
  for (const body of [...cats]) removeCat(body);
  pendingMerges.length = 0;
  particles.length = 0;
  overTimer.reset();
  stats.reset();
  state.over = false;
  state.score = 0;
  state.cooldown = 0;
  state.time = 0;
  state.heldLevel = queue.take();
  scoreEl.textContent = '0';
  overEl.hidden = true;
  drawNext();
}

const keys = { left: false, right: false };

function step() {
  const move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (move !== 0) {
    state.targetX += move * KEY_SPEED * (STEP_MS / 1000);
  }
  state.targetX = clampDropX(state.targetX, diameterOf(state.heldLevel));
  state.heldX = state.targetX;
  state.cooldown = Math.max(0, state.cooldown - STEP_MS);

  Engine.update(engine, STEP_MS);
  resolveMerges();
  for (const body of cats) {
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed > MAX_SPEED) {
      Body.setVelocity(body, { x: (body.velocity.x / speed) * MAX_SPEED, y: (body.velocity.y / speed) * MAX_SPEED });
    }
  }
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life -= 1;
    if (p.life <= 0) particles.splice(i, 1);
  }
  state.time += STEP_MS;

  const snapshot = cats.map((body) => ({
    top: body.position.y - diameterOf(body.catLevel) / 2,
    age: state.time - body.born,
  }));
  if (overTimer.update(STEP_MS, snapshot)) endGame();
}

let last = performance.now();
let accumulator = 0;
function frame(now) {
  accumulator += Math.min(now - last, 100);
  last = now;
  while (accumulator >= STEP_MS) {
    if (state.over) {
      accumulator = 0;
      break;
    }
    step();
    accumulator -= STEP_MS;
  }
  render();
  requestAnimationFrame(frame);
}

// ---------- Input ----------

let pressed = false;
const worldX = (event) => {
  const rect = boardCanvas.getBoundingClientRect();
  return ((event.clientX - rect.left) / rect.width) * WORLD_W;
};

boardCanvas.addEventListener('pointerdown', (event) => {
  pressed = true;
  boardCanvas.setPointerCapture?.(event.pointerId);
  state.targetX = worldX(event);
});
boardCanvas.addEventListener('pointermove', (event) => {
  state.targetX = worldX(event);
});
boardCanvas.addEventListener('pointerup', (event) => {
  audio.unlock();
  state.targetX = worldX(event);
  if (pressed) {
    state.heldX = clampDropX(state.targetX, diameterOf(state.heldLevel));
    tryDrop();
  }
  pressed = false;
});
boardCanvas.addEventListener('pointercancel', () => {
  pressed = false;
});

const isControl = (target) => target instanceof Element && target.closest('button') !== null;
document.addEventListener('keydown', (event) => {
  audio.unlock();
  if (event.key === 'ArrowLeft') keys.left = true;
  else if (event.key === 'ArrowRight') keys.right = true;
  else if ((event.key === ' ' || event.key === 'Enter') && !event.repeat && !isControl(event.target)) {
    tryDrop();
  } else {
    return;
  }
  event.preventDefault();
});
document.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowLeft') keys.left = false;
  else if (event.key === 'ArrowRight') keys.right = false;
});
window.addEventListener('blur', () => {
  keys.left = false;
  keys.right = false;
  pressed = false;
});

function showMuted() {
  muteButton.setAttribute('aria-pressed', String(audio.muted));
}
muteButton.addEventListener('click', (event) => {
  audio.unlock();
  audio.setMuted(!audio.muted);
  saveMuted(storage, audio.muted);
  showMuted();
  if (event.detail > 0) muteButton.blur();
});
againButton.addEventListener('click', () => {
  audio.unlock();
  restart();
});

// ---------- Layout: a whole number of device pixels per art pixel ----------

function fitScale() {
  const dpr = window.devicePixelRatio || 1;
  const maxByWidth = Math.floor(((window.innerWidth - 16) * dpr) / WORLD_W);
  for (let devicePx = Math.max(1, maxByWidth); devicePx >= 1; devicePx -= 1) {
    document.body.style.setProperty('--px', `${devicePx / dpr}px`);
    if (devicePx === 1 || app.getBoundingClientRect().height <= window.innerHeight + 0.5) break;
  }
}

window.addEventListener('resize', fitScale);
darkScheme.addEventListener('change', readTheme);
document.fonts?.ready.then(fitScale);

showMuted();
bestEl.textContent = String(state.best);
readTheme();
fitScale();
requestAnimationFrame(frame);
