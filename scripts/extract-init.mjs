#!/usr/bin/env node
/*
 * One-time provenance script: split _init/vigil-original-start.html into src/.
 *
 * The original single-file build was produced by concatenating ordered source
 * files; each one is still marked in the <script> by a `/* ===== name ===== *\/`
 * banner. This script reverses that; the parity test in commit a6f729b proved the round trip.
 *
 * It already ran to create src/ — it is kept so the origin of every file is
 * reproducible, not as part of the normal workflow. Refuses to overwrite src/
 * unless --force is given.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKER, placeholder, layerOf } from './lib/assemble.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = join(ROOT, '_init/vigil-original-start.html');
const SRC = join(ROOT, 'src');

if (existsSync(SRC) && !process.argv.includes('--force')) {
  console.error('src/ already exists — refusing to overwrite (pass --force to regenerate).');
  process.exit(1);
}

const html = readFileSync(INPUT, 'utf8');

function one(re, what) {
  const m = [...html.matchAll(re)];
  if (m.length !== 1) throw new Error(`expected exactly one ${what}, found ${m.length}`);
  return m[0];
}

/* The second <style> block is the app's; the first (inside <head>) belongs to the
   artifact publish wrapper and stays in the template verbatim. */
const styleRe = /<style>([\s\S]*?)<\/style>/g;
const styles = [...html.matchAll(styleRe)];
if (styles.length !== 2) throw new Error(`expected 2 <style> blocks, found ${styles.length}`);
const appStyle = styles[1];

const script = one(/<script>([\s\S]*?)<\/script>/g, '<script> block');

/* Template = original with the app <style> and <script> elements swapped for placeholders. */
const template =
  html.slice(0, appStyle.index) +
  placeholder('styles') +
  html.slice(appStyle.index + appStyle[0].length, script.index) +
  placeholder('scripts') +
  html.slice(script.index + script[0].length);

/* Split the script body on banners. Joined back as banner+file, separated by '\n'. */
const body = script[1];
const banner = new RegExp(MARKER.source, 'g');
const marks = [...body.matchAll(banner)];
if (marks.length === 0 || marks[0].index !== 0) throw new Error('script does not start with a banner');

const files = marks.map((m, i) => {
  const start = m.index + m[0].length + 1; // skip banner + its newline
  const end = i + 1 < marks.length ? marks[i + 1].index - 1 : body.length; // drop the '\n' join separator
  if (body[start - 1] !== '\n') throw new Error(`banner for ${m[1]} not followed by newline`);
  if (i + 1 < marks.length && body[end] !== '\n') throw new Error(`no separator before banner after ${m[1]}`);
  return { name: m[1], text: body.slice(start, end) };
});

mkdirSync(join(SRC, 'shell'), { recursive: true });
writeFileSync(join(SRC, 'shell/index.html'), template);
writeFileSync(join(SRC, 'shell/styles.css'), appStyle[1]);
for (const f of files) {
  const dir = join(SRC, layerOf(f.name));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, f.name), f.text);
}
console.log(`extracted template, styles, and ${files.length} script files into src/`);
