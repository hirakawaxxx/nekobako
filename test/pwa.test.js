import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PUBLIC_DIR, SW_PATH, computeRevision, readPrecacheUrls, readRevision, urlToFile,
} from '../scripts/sw-revision.mjs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const read = (name) => readFileSync(join(PUBLIC_DIR, name), 'utf8');

const swSource = readFileSync(SW_PATH, 'utf8');
const precacheUrls = readPrecacheUrls(swSource);
const manifest = JSON.parse(read('manifest.webmanifest'));

describe('service worker precache', () => {
  test('uses the nekobako cache prefix', () => {
    assert.match(swSource, /const CACHE_PREFIX = 'nekobako-';/);
  });

  test('lists the shell, game code and Matter.js', () => {
    for (const url of ['/', '/game.js', '/vendor/matter.min.js', '/js/cats.js', '/js/cat-art.js', '/js/sprites.js']) {
      assert.ok(precacheUrls.includes(url), `${url} missing from precache`);
    }
  });

  test('has no duplicate entries and no redirected .html URLs', () => {
    assert.equal(new Set(precacheUrls).size, precacheUrls.length);
    assert.ok(precacheUrls.every((url) => !url.endsWith('.html')));
  });

  test('every precached URL exists in public/', () => {
    assert.deepEqual(precacheUrls.filter((url) => !existsSync(urlToFile(url))), []);
  });

  test('every js module under public/js is precached', async () => {
    const { readdirSync } = await import('node:fs');
    const modules = readdirSync(join(PUBLIC_DIR, 'js')).map((name) => `/js/${name}`);
    assert.deepEqual(modules.filter((url) => !precacheUrls.includes(url)), []);
  });

  test('PRECACHE_REVISION matches the precached files (run `node scripts/sw-revision.mjs`)', () => {
    assert.equal(readRevision(swSource), computeRevision(precacheUrls));
  });
});

describe('web app manifest and icons', () => {
  test('is a standalone app rooted at /', () => {
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.scope, '/');
  });

  test('every manifest icon is precached and exists', () => {
    for (const { src } of manifest.icons) {
      assert.ok(precacheUrls.includes(src), `${src} not precached`);
      assert.ok(existsSync(urlToFile(src)), `${src} missing`);
    }
  });

  test('PNG icons are real PNGs of the declared size', () => {
    for (const { src, sizes } of manifest.icons.filter(({ type }) => type === 'image/png')) {
      const bytes = readFileSync(urlToFile(src));
      assert.ok(bytes.subarray(0, 8).equals(PNG_SIGNATURE), `${src} is not a PNG`);
      assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, sizes);
    }
  });
});

describe('HTML PWA wiring', () => {
  test('index.html links the manifest and registers the service worker', () => {
    const html = read('index.html');
    assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"/);
    assert.match(html, /<meta name="theme-color" content="#[0-9a-f]{6}"/);
    assert.match(html, /<script src="\/register-sw\.js"><\/script>/);
  });

  test('register-sw.js registers /sw.js on load', () => {
    const source = read('register-sw.js');
    assert.match(source, /serviceWorker\.register\('\/sw\.js'\)/);
    assert.match(source, /addEventListener\('load'/);
  });

  test('viewport allows no accidental scrolling or zoom gestures (touch-action none)', () => {
    assert.match(read('style.css'), /touch-action:\s*none/);
  });
});
