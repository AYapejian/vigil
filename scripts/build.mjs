#!/usr/bin/env node
/*
 * npm run build [-- --only tungsten,ocean] [--out path]
 * Writes the single-file screensaver to dist/index.html (default).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { assemble } from './lib/assemble.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const { values } = parseArgs({
  options: {
    only: { type: 'string' },
    out: { type: 'string', default: join(ROOT, 'dist/index.html') }
  }
});

try {
  const only = values.only ? values.only.split(',').map(s => s.trim()).filter(Boolean) : undefined;
  const { html, files } = assemble({ srcDir: join(ROOT, 'src'), only });
  mkdirSync(dirname(values.out), { recursive: true });
  writeFileSync(values.out, html);
  const bytes = Buffer.byteLength(html);
  const sha = createHash('sha256').update(html).digest('hex').slice(0, 12);
  const scenes = files.filter(f => f.layer === 'scenes').length;
  console.log(`built ${relative(process.cwd(), values.out)} — ${scenes} scenes, ${(bytes / 1024).toFixed(1)} KiB, sha256 ${sha}`);
} catch (e) {
  console.error(`build failed: ${e.message}`);
  process.exit(1);
}
