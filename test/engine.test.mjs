import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { load, byName } from './helpers/sandbox.mjs';

/* Arrays built inside the vm have the vm's Array prototype; spread them before deepEqual. */

const ENGINE = f => f.layer === 'engine';

describe('00_util.js', () => {
  const { clamp, mix, smoothstep, hexLin, L, mulberry32 } =
    load(byName('00_util.js')).pick('clamp', 'mix', 'smoothstep', 'hexLin', 'L', 'mulberry32');

  test('clamp / mix / smoothstep', () => {
    assert.equal(clamp(5, 0, 1), 1);
    assert.equal(clamp(-5, 0, 1), 0);
    assert.equal(mix(2, 4, 0.25), 2.5);
    assert.equal(smoothstep(0, 1, 0.5), 0.5);
    assert.equal(smoothstep(0, 1, -1), 0);
    assert.equal(smoothstep(0, 1, 2), 1);
  });

  test('hexLin decodes sRGB hex to linear light', () => {
    assert.deepEqual([...hexLin('#000000')], [0, 0, 0]);
    assert.deepEqual([...hexLin('#ffffff')], [1, 1, 1]);
    const [r, g, b] = hexLin('#808080');
    assert.ok(Math.abs(r - 0.21586) < 1e-4 && r === g && g === b);
    assert.deepEqual([...hexLin('FF0000')], [1, 0, 0], 'leading # is optional');
  });

  test('L() emits a GLSL vec3 literal', () => {
    assert.equal(L('#ffffff'), 'vec3(1.00000,1.00000,1.00000)');
    assert.equal(L('#000000'), 'vec3(0.00000,0.00000,0.00000)');
  });

  test('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const sa = Array.from({ length: 1000 }, a), sb = Array.from({ length: 1000 }, b);
    assert.deepEqual(sa, sb);
    assert.notEqual(c(), sa[0]);
    assert.ok(sa.every(v => v >= 0 && v < 1));
  });
});

describe('30_scenes_head.js — scene registry', () => {
  test('scene() fills defaults and registers', () => {
    const { run, pick } = load(ENGINE);
    run(`scene({ id: 't', name: 'T', medium: 'm', frag: frag('void main(){}'), post: { bloom: 0.5 } })`);
    const { SCENES, POST_DEFAULT, PRELUDE } = pick('SCENES', 'POST_DEFAULT', 'PRELUDE');
    const s = SCENES[0];
    assert.equal(SCENES.length, 1);
    assert.equal(s.dwell, 200);
    assert.equal(s.post.bloom, 0.5);
    assert.equal(s.post.exposure, POST_DEFAULT.exposure);
    assert.equal(s._themesLin.length, 1, 'no themes → one grey default');
    assert.ok(s.frag.startsWith(PRELUDE));
  });

  test('buildThemes pads short themes with their last colour to 8 slots', () => {
    const { buildThemes, hexLin } = load(ENGINE).pick('buildThemes', 'hexLin');
    const [t] = buildThemes([['Two', '#000000', '#ffffff']]);
    assert.equal(t.name, 'Two');
    assert.equal(t.pal.length, 24);
    assert.deepEqual([...t.pal.slice(0, 3)], [...hexLin('#000000')]);
    for (let i = 1; i < 8; i++) assert.deepEqual([...t.pal.slice(i * 3, i * 3 + 3)], [1, 1, 1]);
  });

  test('palv reads the live palette slot', () => {
    const { run, pick } = load(ENGINE);
    run(`scene({ id: 't', themes: [['A', '#000000', '#ffffff']] })`);
    const { SCENES, palv } = pick('SCENES', 'palv');
    assert.deepEqual([...palv(SCENES[0], 1)], [1, 1, 1]);
  });
});
