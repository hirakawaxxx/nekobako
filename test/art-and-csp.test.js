import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { CATS } from '../public/js/cats.js';
import { renderCatPixels } from '../public/js/cat-art.js';
import { PUBLIC_DIR } from '../scripts/sw-revision.mjs';

describe('placeholder cat art', () => {
  const sprites = CATS.map(({ level, diameter }) => ({ level, diameter, ...renderCatPixels(level) }));

  test('each sprite is diameter x diameter with only fully opaque or fully transparent pixels', () => {
    for (const { diameter, width, height, data } of sprites) {
      assert.deepEqual([width, height, data.length], [diameter, diameter, diameter * diameter * 4]);
      for (let i = 3; i < data.length; i += 4) assert.ok(data[i] === 0 || data[i] === 255);
    }
  });

  test('the disc is filled and the corners are transparent', () => {
    for (const { diameter, data } of sprites) {
      const alpha = (x, y) => data[(y * diameter + x) * 4 + 3];
      assert.equal(alpha(diameter / 2, diameter / 2), 255);
      assert.equal(alpha(diameter / 2, diameter - 1), 255);
      assert.equal(alpha(0, diameter - 1), 0);
      assert.equal(alpha(diameter - 1, diameter - 1), 0);
    }
  });

  test('every stage looks different at the same size', () => {
    const rendered = CATS.map(({ level }) => Buffer.from(renderCatPixels(level, 40).data).toString('base64'));
    assert.equal(new Set(rendered).size, CATS.length);
  });

  test('is left-right symmetric in silhouette (always upright)', () => {
    for (const { diameter, data } of sprites) {
      for (let y = 0; y < diameter; y += 1) {
        for (let x = 0; x < diameter / 2; x += 1) {
          assert.equal(data[(y * diameter + x) * 4 + 3], data[(y * diameter + (diameter - 1 - x)) * 4 + 3]);
        }
      }
    }
  });
});

describe('strict CSP friendliness', () => {
  const files = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
  const own = files(PUBLIC_DIR).filter((p) => ['.html', '.css', '.js'].includes(extname(p)) && !p.includes('/vendor/'));

  test('no inline style attributes, <style> blocks or data: URIs in own files', () => {
    for (const path of own) {
      const text = readFileSync(path, 'utf8');
      assert.doesNotMatch(text, /<style[\s>]/i, path);
      assert.doesNotMatch(text, /\sstyle\s*=/i, path);
      assert.doesNotMatch(text, /data:[a-z]+\//i, path);
    }
  });

  test('_headers sets default-src self and no microphone or blob media', () => {
    const headers = readFileSync(join(PUBLIC_DIR, '_headers'), 'utf8');
    assert.match(headers, /Content-Security-Policy: default-src 'self';/);
    assert.doesNotMatch(headers, /media-src|blob:/);
  });

  test('Matter.js is vendored with its MIT notice', () => {
    assert.ok(existsSync(join(PUBLIC_DIR, 'vendor', 'matter.min.js')));
    const notices = readFileSync(join(PUBLIC_DIR, '..', 'THIRD_PARTY_NOTICES.md'), 'utf8');
    assert.match(notices, /matter-js/);
    assert.match(notices, /MIT/);
  });
});
