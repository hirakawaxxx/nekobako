import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CATS, MAX_LEVEL, MAX_MERGE_BONUS, DROP_LEVEL_COUNT, catOf, mergeFrequency, mergeScore,
} from '../public/js/cats.js';
import { createDropQueue, drawLevel } from '../public/js/queue.js';
import { GAME_OVER_MS, GRACE_MS, createOverTimer, isOverLine } from '../public/js/game-over.js';
import { INNER_L, INNER_R, clampDropX, LINE_Y, DROP_Y } from '../public/js/config.js';
import { SPRITES, resolveSprite, spriteFileName } from '../public/js/sprites.js';
import { BASE_WORLD_H, MAX_WORLD_H, measureWorldHeight, worldHeightFor } from '../public/js/world-height.js';
import { createStats, heroScale } from '../public/js/stats.js';
import { BEST_KEY, loadBest, loadMuted, saveBest, saveMuted } from '../public/js/storage.js';

describe('cats', () => {
  test('has ten stages in the agreed order with strictly growing even diameters', () => {
    assert.deepEqual(CATS.map((c) => c.name), ['毛玉', '子猫', '白猫', '黒猫', '茶トラ', '三毛', 'ハチワレ', 'ボス猫', '虎', 'ライオン']);
    CATS.forEach((cat, i) => {
      assert.equal(cat.level, i + 1);
      assert.equal(cat.diameter % 2, 0);
      if (i > 0) assert.ok(cat.diameter > CATS[i - 1].diameter);
    });
  });

  test('the biggest cat fits the box and the held cat sits above the line', () => {
    assert.ok(catOf(MAX_LEVEL).diameter < INNER_R - INNER_L);
    for (const { diameter } of CATS.slice(0, DROP_LEVEL_COUNT)) {
      assert.ok(DROP_Y + diameter / 2 < LINE_Y);
    }
  });

  test('catOf rejects unknown levels', () => {
    assert.throws(() => catOf(0), RangeError);
    assert.throws(() => catOf(11), RangeError);
  });

  test('score grows with level and max-level pairs give the bonus', () => {
    for (let level = 2; level < MAX_LEVEL; level += 1) {
      assert.ok(mergeScore(level) > mergeScore(level - 1));
    }
    assert.equal(mergeScore(1), 3);
    assert.equal(mergeScore(MAX_LEVEL), MAX_MERGE_BONUS);
  });

  test('bigger cats make lower merge sounds', () => {
    for (let level = 3; level <= MAX_LEVEL; level += 1) {
      assert.ok(mergeFrequency(level) < mergeFrequency(level - 1));
    }
  });
});

describe('drop queue', () => {
  test('draws only the first five stages', () => {
    assert.equal(drawLevel(() => 0), 1);
    assert.equal(drawLevel(() => 0.999999), DROP_LEVEL_COUNT);
    assert.equal(drawLevel(() => 1), DROP_LEVEL_COUNT);
    const seen = new Set();
    for (let i = 0; i < 500; i += 1) seen.add(drawLevel());
    assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5]);
  });

  test('take() returns current, promotes next, and draws a new next', () => {
    const values = [0, 0.2, 0.4, 0.6, 0.8];
    let i = 0;
    const queue = createDropQueue(() => values[i++]);
    assert.deepEqual([queue.current, queue.next], [1, 2]);
    assert.equal(queue.take(), 1);
    assert.deepEqual([queue.current, queue.next], [2, 3]);
    assert.equal(queue.take(), 2);
    assert.equal(queue.next, 4);
  });
});

describe('game over timer', () => {
  const settled = { top: LINE_Y - 5, age: GRACE_MS };

  test('a cat just dropped is ignored while it falls past the line', () => {
    assert.equal(isOverLine({ top: 0, age: GRACE_MS - 1 }, LINE_Y), false);
    assert.equal(isOverLine(settled, LINE_Y), true);
    assert.equal(isOverLine({ top: LINE_Y, age: 5000 }, LINE_Y), false);
  });

  test('ends after two continuous seconds above the line', () => {
    const timer = createOverTimer({ lineY: LINE_Y });
    let over = false;
    let elapsed = 0;
    while (!over && elapsed < 5000) {
      over = timer.update(100, [settled]);
      elapsed += 100;
    }
    assert.equal(elapsed, GAME_OVER_MS);
  });

  test('resets when no cat is above the line', () => {
    const timer = createOverTimer({ lineY: LINE_Y });
    for (let i = 0; i < 15; i += 1) timer.update(100, [settled]);
    assert.ok(timer.progress > 0.5);
    assert.equal(timer.update(100, [{ top: LINE_Y + 10, age: 9999 }]), false);
    assert.equal(timer.progress, 0);
    assert.equal(timer.update(1900, [settled]), false);
  });
});

describe('clampDropX', () => {
  test('keeps the whole cat inside the walls', () => {
    assert.equal(clampDropX(-50, 30), INNER_L + 15);
    assert.equal(clampDropX(999, 30), INNER_R - 15);
    assert.equal(clampDropX(90, 30), 90);
  });
});

describe('sprite definitions', () => {
  test('one entry per stage', () => {
    assert.deepEqual(SPRITES.map((s) => s.level), CATS.map((c) => c.level));
  });

  test('every image is a PNG of diameter x diameter art pixels', () => {
    for (const { level, diameter } of CATS) {
      const sprite = resolveSprite(level);
      if (sprite.kind !== 'image') continue;
      const png = readFileSync(new URL(`../public${sprite.src}`, import.meta.url));
      assert.equal(png.readUInt32BE(16), diameter, `${sprite.src} width`);
      assert.equal(png.readUInt32BE(20), diameter, `${sprite.src} height`);
    }
  });

  test('a stage with an image resolves to it; others stay placeholders', () => {
    const defs = [{ level: 1, image: null }, { level: 2, image: spriteFileName(2) }];
    assert.deepEqual(resolveSprite(2, defs), { kind: 'image', src: '/sprites/cat-02.png' });
    assert.equal(resolveSprite(1, defs).kind, 'placeholder');
    assert.equal(resolveSprite(3, defs).kind, 'placeholder');
  });

  test('file names are cat-01.png to cat-10.png', () => {
    assert.equal(spriteFileName(1), 'cat-01.png');
    assert.equal(spriteFileName(10), 'cat-10.png');
  });
});

describe('storage', () => {
  const memory = (initial = {}) => {
    const map = new Map(Object.entries(initial));
    return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  };
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

  test('round-trips the best score and ignores bad values', () => {
    const s = memory();
    assert.equal(loadBest(s), 0);
    assert.equal(saveBest(s, 120), true);
    assert.equal(loadBest(s), 120);
    assert.equal(loadBest(memory({ [BEST_KEY]: 'abc' })), 0);
    assert.equal(loadBest(memory({ [BEST_KEY]: '-4' })), 0);
  });

  test('round-trips mute', () => {
    const s = memory();
    saveMuted(s, true);
    assert.equal(loadMuted(s), true);
  });

  test('never throws when storage is unavailable', () => {
    assert.equal(loadBest(broken), 0);
    assert.equal(saveBest(broken, 5), false);
    assert.equal(loadMuted(broken), false);
    assert.equal(saveMuted(broken, true), false);
    assert.equal(loadBest(null), 0);
    assert.equal(saveBest(null, 5), true);
  });
});

describe('world height', () => {
  test('stays at the base height without a browser or without spare room', () => {
    assert.equal(measureWorldHeight(), BASE_WORLD_H);
    assert.equal(worldHeightFor(0), BASE_WORLD_H);
    assert.equal(worldHeightFor(-40), BASE_WORLD_H);
    assert.equal(worldHeightFor(Number.NaN), BASE_WORLD_H);
  });

  test('grows by the spare art pixels, kept even and capped', () => {
    assert.equal(worldHeightFor(61.7), BASE_WORLD_H + 60);
    assert.equal(worldHeightFor(1000), MAX_WORLD_H);
  });
});

describe('game stats', () => {
  test('counts drops and merges and remembers the biggest stage', () => {
    const stats = createStats();
    assert.deepEqual([stats.drops, stats.merges, stats.maxLevel], [0, 0, 0]);
    stats.drop(2);
    stats.drop(2);
    stats.merge(3);
    stats.drop(1);
    assert.deepEqual([stats.drops, stats.merges, stats.maxLevel], [3, 1, 3]);
  });

  test('two biggest cats vanishing counts as a merge without changing the biggest stage', () => {
    const stats = createStats();
    stats.merge(MAX_LEVEL);
    stats.merge();
    assert.deepEqual([stats.merges, stats.maxLevel], [2, MAX_LEVEL]);
  });

  test('reset clears everything', () => {
    const stats = createStats();
    stats.drop(4);
    stats.merge(5);
    stats.reset();
    assert.deepEqual([stats.drops, stats.merges, stats.maxLevel], [0, 0, 0]);
  });

  test('the big cat fits its box at a whole scale for every stage', () => {
    for (const { diameter } of CATS) {
      const k = heroScale(diameter);
      assert.ok(Number.isInteger(k) && k >= 1 && k <= 8);
      assert.ok(diameter * k <= 176);
    }
  });
});
