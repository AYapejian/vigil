/*
 * Refactor gate: the build must reproduce _init/vigil-original-start.html byte-for-byte.
 *
 * This proves the split into src/ lost nothing. The first *intentional* change to
 * the output ends this test's job — retire it in that same commit (see AGENTS.md).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { assemble } from '../scripts/lib/assemble.mjs';
import { ROOT, SRC } from './helpers/sandbox.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');

test('build output is byte-identical to _init/vigil-original-start.html', () => {
  const golden = readFileSync(join(ROOT, '_init/vigil-original-start.html'));
  const built = Buffer.from(assemble({ srcDir: SRC }).html, 'utf8');
  if (!built.equals(golden)) {
    const a = built.toString('utf8').split('\n'), b = golden.toString('utf8').split('\n');
    const i = a.findIndex((line, k) => line !== b[k]);
    assert.fail(`output differs from golden at line ${i + 1}\n  built:  ${JSON.stringify(a[i])}\n  golden: ${JSON.stringify(b[i])}\n` +
      'If this change to the output is intentional, this test has done its job — delete it in the same commit.');
  }
  assert.equal(sha(built), sha(golden));
});
