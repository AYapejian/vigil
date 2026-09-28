'use strict';
/* ------------------------------------------------------------------ *
 *  VIGIL — twenty quiet machines for a spare screen
 *  Single-file WebGL2 generative screensaver. No dependencies.
 * ------------------------------------------------------------------ */

const TAU = Math.PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function srgbToLinear(u) {
  return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
}
function hexLin(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}
/* GLSL literal for a hex colour, in linear light. */
function L(hex) {
  const c = hexLin(hex);
  return `vec3(${c[0].toFixed(5)},${c[1].toFixed(5)},${c[2].toFixed(5)})`;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
