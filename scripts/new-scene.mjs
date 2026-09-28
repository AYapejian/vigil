#!/usr/bin/env node
/*
 * npm run new:scene -- <slug> ["Display Name"]
 * Scaffolds src/scenes/sNN_<slug>.js with the next free number: a minimal
 * fragment-shader scene (the simplest of the scene contracts; see AGENTS.md).
 */
import { writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listScripts, sceneSlug } from './lib/assemble.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const [slug, displayName] = process.argv.slice(2);
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('usage: npm run new:scene -- <slug> ["Display Name"]   (slug: lowercase, digits, dashes)');
  process.exit(1);
}
const scenes = listScripts(SRC).filter(f => f.layer === 'scenes');
if (scenes.some(f => sceneSlug(f.name) === slug)) {
  console.error(`a scene with slug "${slug}" already exists`);
  process.exit(1);
}
const next = Math.max(0, ...scenes.map(f => Number(f.name.slice(1, 3)))) + 1;
if (next > 99) { console.error('scene numbers are two digits; 99 is the ceiling'); process.exit(1); }
const nn = String(next).padStart(2, '0');
const name = displayName || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const file = join(SRC, 'scenes', `s${nn}_${slug}.js`);
if (existsSync(file)) { console.error(`${file} exists`); process.exit(1); }

writeFileSync(file, `/* ---------------- ${nn} · ${name.toUpperCase()} ---------------- */
scene({
  id: '${slug}',
  name: '${name}',
  medium: 'describe the technique · in a few words',
  chrome: '#e8e4dc',
  dwell: 200,
  post: { exposure: 1.0, bloom: 0.12, vignette: 0.40 },
  themes: [
    ['Default', '#0E0F12', '#2C4258', '#7FA6C9', '#D8E8F2'],
    ['Ember', '#1C0F0E', '#5A1F16', '#C24A2A', '#F2A47A']
  ],
  frag: frag(\`
#define C_BG   uPal[0]
#define C_LOW  uPal[1]
#define C_MID  uPal[2]
#define C_HIGH uPal[3]

void main(){
  vec2 p = NP();                                  // centred, y in [-1, 1]
  float n = fbm2(p*1.6 + vec2(0.0, uTime*0.03), 5);
  float v = smoothstep(-0.4, 0.8, n) * uDensity;
  vec3 col = C_BG + ramp3(C_LOW, C_MID, C_HIGH, v) * v;
  fragColor = vec4(max(col, 0.0), 1.0);
}
\`)
});
`);

console.log(`created ${relative(ROOT, file)} (scene ${next})`);
if (next > 20) {
  console.log('note: digit keys only reach scenes 1–20; later scenes are reachable with ←/→, the slideshow, or ?scene=N in dev.');
}
