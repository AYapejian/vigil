/*
 * Real-browser smoke test: boot the built page in headless Chromium (software
 * WebGL2 via SwiftShader), visit every scene, and fail on any shader compile or
 * render-loop error. This is the only test that compiles the GLSL.
 *
 *   npm run test:e2e            (first time: npx playwright install chromium --only-shell)
 *
 * All network is blocked — the weather/geolocation connectors fail closed, as
 * they would offline.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { assemble } from '../../scripts/lib/assemble.mjs';
import { SRC } from '../helpers/sandbox.mjs';

const FRAMES_PER_SCENE = 12;

test('every scene compiles and renders without errors', { timeout: 180_000 }, async t => {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    const errors = [];
    const blockedFetch = /^Failed to load resource: net::ERR_FAILED$/; // our route.abort(), by design
    page.on('console', m => { if (m.type() === 'error' && !blockedFetch.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/*', r => r.abort());

    await page.setContent(assemble({ srcDir: SRC }).html, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.VIGIL?.App.ready || document.getElementById('fail').classList.contains('show'));
    if (await page.evaluate(() => !window.VIGIL.App.ready)) {
      t.skip('this browser has no WebGL2 + EXT_color_buffer_float — cannot run the smoke test here');
      return;
    }

    const names = await page.evaluate(() => window.VIGIL.SCENES.map(s => s.id));
    const failures = [];
    for (let i = 0; i < names.length; i++) {
      errors.length = 0;
      await page.evaluate(async ([i, n]) => {
        window.VIGIL.hop(i);
        await new Promise(res => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
      }, [i, FRAMES_PER_SCENE]);
      const renderErrors = await page.evaluate(() => window.VIGIL.errors());
      if (errors.length || renderErrors) {
        failures.push(`${String(i + 1).padStart(2, '0')} ${names[i]}: ${renderErrors} render error(s)\n    ${errors.join('\n    ')}`);
      }
    }
    assert.equal(failures.length, 0, `scenes with errors:\n  ${failures.join('\n  ')}`);
  } finally {
    await browser.close();
  }
});
