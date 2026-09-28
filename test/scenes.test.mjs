/*
 * Scene contract — what every file in src/scenes/ must satisfy.
 * Each scene file is loaded on its own (engine + that one file), so a failure
 * names the file and the rule. Shader *compilation* needs a real GPU: that is
 * test/e2e/smoke.test.mjs (npm run test:e2e).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { load, SRC } from './helpers/sandbox.mjs';
import { listScripts } from '../scripts/lib/assemble.mjs';

const HEX = /^#[0-9a-fA-F]{6}$/;
const HOOKS = ['alloc', 'resize', 'reseed', 'tick', 'sim', 'uni', 'draw', 'demo'];
const INFO_POS = ['tl', 'tr', 'bl', 'br'];

const sceneFiles = listScripts(SRC).filter(f => f.layer === 'scenes');

describe('scene contract', () => {
  const ids = new Map();

  for (const file of sceneFiles) {
    test(file.name, () => {
      const { pick } = load(f => f.layer === 'engine' || f.name === file.name);
      const { SCENES, POST_DEFAULT, PRELUDE } = pick('SCENES', 'POST_DEFAULT', 'PRELUDE');
      assert.equal(SCENES.length, 1, 'a scene file registers exactly one scene');
      const s = SCENES[0];

      assert.match(s.id, /^[a-z0-9-]+$/, 'id: lowercase slug');
      assert.ok(!ids.has(s.id), `id "${s.id}" already used by ${ids.get(s.id)}`);
      ids.set(s.id, file.name);

      for (const k of ['name', 'medium']) assert.ok(typeof s[k] === 'string' && s[k].trim(), `${k}: non-empty string`);
      assert.match(s.chrome, HEX, 'chrome: #rrggbb UI accent');
      assert.ok(Number.isFinite(s.dwell) && s.dwell > 0, 'dwell: seconds > 0');

      for (const [k, v] of Object.entries(s.post)) {
        assert.ok(k in POST_DEFAULT, `post.${k}: unknown key (known: ${Object.keys(POST_DEFAULT).join(', ')})`);
        assert.ok(Number.isFinite(v), `post.${k}: finite number`);
      }

      assert.ok(Array.isArray(s.themes) && s.themes.length >= 1, 'themes: at least one');
      const width = s.themes[0].length;
      for (const t of s.themes) {
        assert.ok(typeof t[0] === 'string' && t[0].trim(), 'theme[0]: name');
        const cols = t.slice(1);
        assert.ok(cols.length >= 1 && cols.length <= 8, `theme "${t[0]}": 1–8 colours`);
        for (const c of cols) assert.match(c, HEX, `theme "${t[0]}": colour ${c}`);
        assert.equal(t.length, width, `theme "${t[0]}": same colour count as "${s.themes[0][0]}" (short themes silently pad)`);
      }

      assert.equal(typeof s.frag, 'string', 'frag: shader source (also used as the fallback/background pass)');
      assert.ok(s.frag.startsWith(PRELUDE), 'frag: built with frag() so it gets the shared prelude');
      assert.match(s.frag, /void\s+main\s*\(\s*\)/, 'frag: defines main()');

      for (const h of HOOKS) if (h in s) assert.equal(typeof s[h], 'function', `${h}: function`);
      if (s.resize) assert.ok(s.alloc, 'resize without alloc never runs (resize fires only for allocated scenes)');
      if (s.info !== undefined) {
        assert.equal(typeof s.info.on, 'boolean', 'info.on: boolean');
        if (s.info.pos) assert.ok(INFO_POS.includes(s.info.pos), `info.pos: one of ${INFO_POS}`);
      }
    });
  }
});

test('the whole bundle evaluates without a DOM or GPU', () => {
  const { pick, run } = load();
  const { SCENES } = pick('SCENES');
  const VIGIL = run('window.VIGIL');
  assert.equal(SCENES.length, sceneFiles.length);
  assert.equal(typeof VIGIL.hop, 'function', 'window.VIGIL automation hook present');
});
