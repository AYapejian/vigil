import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assemble, layerOf, sceneSlug, listScripts, filterScenes, banner } from '../scripts/lib/assemble.mjs';
import { SRC } from './helpers/sandbox.mjs';

/* Minimal src/ tree in a temp dir. files: { 'engine/00_a.js': 'text', ... } */
function fixture(files, template = '<body>\n<!-- @inject:styles -->\n<!-- @inject:scripts -->\n</body>') {
  const dir = mkdtempSync(join(tmpdir(), 'vigil-asm-'));
  const all = { 'shell/index.html': template, 'shell/styles.css': 'b{}', ...files };
  for (const [p, text] of Object.entries(all)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    writeFileSync(join(dir, p), text);
  }
  return { dir, done: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('naming', () => {
  test('layerOf routes by prefix', () => {
    assert.equal(layerOf('00_util.js'), 'engine');
    assert.equal(layerOf('35_kit.js'), 'engine');
    assert.equal(layerOf('40_scenes_tail.js'), 'runtime');
    assert.equal(layerOf('s07_ocean.js'), 'scenes');
    assert.throws(() => layerOf('util.js'), /unrecognised/);
  });
  test('sceneSlug', () => {
    assert.equal(sceneSlug('s05_weather.js'), 'weather');
    assert.equal(sceneSlug('50_app.js'), null);
  });
});

describe('ordering', () => {
  test('real tree: engine, then scenes in number order, then runtime', () => {
    const files = listScripts(SRC);
    const layers = files.map(f => f.layer);
    assert.deepEqual([...new Set(layers)], ['engine', 'scenes', 'runtime']);
    assert.ok(layers.lastIndexOf('engine') < layers.indexOf('scenes'));
    assert.ok(layers.lastIndexOf('scenes') < layers.indexOf('runtime'));
    const nums = files.filter(f => f.layer === 'scenes').map(f => Number(f.name.slice(1, 3)));
    assert.deepEqual(nums, [...nums].sort((a, b) => a - b));
  });

  test('a file in the wrong layer directory is rejected', () => {
    const fx = fixture({ 'engine/s01_x.js': 'scene({});\n' });
    try { assert.throws(() => listScripts(fx.dir), /belongs in scenes/); } finally { fx.done(); }
  });
});

describe('--only', () => {
  const files = listScripts(SRC);
  test('by slug and by number, engine/runtime always kept', () => {
    const out = filterScenes(files, ['weather', '1']);
    assert.deepEqual(out.filter(f => f.layer === 'scenes').map(f => f.name), ['s01_tungsten.js', 's05_weather.js']);
    assert.equal(out.filter(f => f.layer !== 'scenes').length, files.filter(f => f.layer !== 'scenes').length);
  });
  test('unknown scene names the known ones', () => {
    assert.throws(() => filterScenes(files, ['nope']), /no scene "nope".*tungsten/);
  });
  test('single-scene build assembles', () => {
    const { html } = assemble({ srcDir: SRC, only: ['aurora'] });
    assert.ok(html.includes(banner('s09_aurora.js')));
    assert.ok(!html.includes(banner('s01_tungsten.js')));
  });
});

describe('assembly', () => {
  test('banners, join separator and placeholders', () => {
    const fx = fixture({ 'engine/00_a.js': 'const A = 1;\n', 'scenes/s01_x.js': 'A;\n', 'runtime/50_b.js': 'A;\n' });
    try {
      const { html } = assemble({ srcDir: fx.dir });
      assert.equal(html,
        '<body>\n<style>b{}</style>\n<script>' +
        '/* ===== 00_a.js ===== */\nconst A = 1;\n\n' +
        '/* ===== s01_x.js ===== */\nA;\n\n' +
        '/* ===== 50_b.js ===== */\nA;\n' +
        '</script>\n</body>');
    } finally { fx.done(); }
  });

  test('dev client lands before </body> and only when asked', () => {
    const { html } = assemble({ srcDir: SRC, devClient: '/*dev*/' });
    assert.match(html, /<script>\/\*dev\*\/<\/script>\n<\/body><\/html>$/);
    assert.ok(!assemble({ srcDir: SRC }).html.includes('/*dev*/'));
  });

  test('missing placeholder is an error', () => {
    const fx = fixture({ 'scenes/s01_x.js': '1;\n' }, '<!-- @inject:styles -->');
    try { assert.throws(() => assemble({ srcDir: fx.dir }), /missing <!-- @inject:scripts -->/); } finally { fx.done(); }
  });

  test('syntax error is reported against its source file and line', () => {
    const fx = fixture({ 'engine/00_a.js': 'const A = 1;\n', 'scenes/s01_x.js': 'scene({\n  id: "x",\n  oops oops\n});\n' });
    try { assert.throws(() => assemble({ srcDir: fx.dir }), /scenes\/s01_x\.js:3/); } finally { fx.done(); }
  });

  test('cross-file redeclaration is caught and located', () => {
    const fx = fixture({ 'engine/00_a.js': 'const A = 1;\n', 'scenes/s01_x.js': '// one\nconst A = 2;\n' });
    try { assert.throws(() => assemble({ srcDir: fx.dir }), /s01_x\.js:2 — Identifier 'A' has already been declared/); } finally { fx.done(); }
  });
});
