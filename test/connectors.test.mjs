import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { load, byName } from './helpers/sandbox.mjs';

const FILES = byName('00_util.js', '45_connectors.js');
const connectors = language => load(FILES, { language }).pick('Data', 'parseWx', 'wxParams', 'windLetters');

const sample = (over = {}) => ({
  current: {
    temperature_2m: 20, apparent_temperature: 19, relative_humidity_2m: 50, is_day: 1,
    precipitation: 1.1, weather_code: 61, cloud_cover: 80, wind_speed_10m: 12, wind_direction_10m: 90,
    ...over
  },
  daily: { sunrise: ['2026-09-27T06:58'], sunset: ['2026-09-27T18:51'] }
});

describe('45_connectors.js', () => {
  test('units follow navigator.language', () => {
    assert.equal(connectors('en-US').Data.imperial, true);
    assert.equal(connectors('en-GB').Data.imperial, false);
  });

  test('windLetters maps degrees to 8-point compass', () => {
    const { windLetters } = connectors('en-GB');
    assert.equal(windLetters(0), 'N');
    assert.equal(windLetters(90), 'E');
    assert.equal(windLetters(225), 'SW');
    assert.equal(windLetters(359), 'N');
    assert.equal(windLetters(720), 'N');
  });

  test('parseWx normalises an open-meteo response', () => {
    const { parseWx } = connectors('en-GB');
    const w = parseWx(sample());
    assert.equal(w.text, 'LIGHT RAIN');
    assert.equal(w.windDir, 'E');
    assert.equal(w.isDay, true);
    assert.equal(w.sunrise, '06:58');
    assert.equal(w.sunset, '18:51');
    assert.deepEqual([w.tUnit, w.wUnit, w.pUnit], ['°C', 'KM/H', 'MM']);
    assert.equal(parseWx(sample({ weather_code: 42 })).text, 'CODE 42');
    assert.equal(connectors('en-US').parseWx(sample()).tUnit, '°F');
  });

  test('wxParams is null until weather arrives', () => {
    assert.equal(connectors('en-GB').wxParams(), null);
  });

  test('wxParams normalises metric and imperial to the same scale', () => {
    const metric = connectors('en-GB');
    metric.Data.wx = metric.parseWx(sample());
    const m = metric.wxParams();
    assert.equal(m.cloud, 0.8);
    assert.equal(m.rain, 0.5);        // 1.1 mm / 2.2
    assert.equal(m.windMul, 1.0);     // 0.5 + 12/24
    assert.equal(m.day, 1);
    assert.equal(m.snow, 0);

    const imp = connectors('en-US');
    imp.Data.wx = imp.parseWx(sample({ precipitation: 1.1 / 25.4, wind_speed_10m: 12 / 1.61, weather_code: 73 }));
    const i = imp.wxParams();
    assert.ok(Math.abs(i.rain - m.rain) < 1e-9);
    assert.ok(Math.abs(i.windMul - m.windMul) < 1e-9);
    assert.equal(i.snow, 1);
  });

  test('wxParams clamps extremes', () => {
    const c = connectors('en-GB');
    c.Data.wx = c.parseWx(sample({ precipitation: 50, wind_speed_10m: 400, cloud_cover: 250 }));
    const p = c.wxParams();
    assert.deepEqual([p.rain, p.windMul, p.cloud], [1, 2.3, 1]);
  });
});
