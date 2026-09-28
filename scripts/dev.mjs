#!/usr/bin/env node
/*
 * npm run dev [-- --only tungsten] [--port 5173] [--host 0.0.0.0]
 *
 * Rebuilds in memory on every change under src/ and live-reloads the page over
 * server-sent events. The page stays on the scene you were viewing; ?scene=N
 * (1-based) picks one on first load. Binds to 127.0.0.1 unless --host is given
 * (e.g. --host 0.0.0.0 to view it on the spare screen across the LAN).
 */
import http from 'node:http';
import { watch, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { assemble } from './lib/assemble.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const CLIENT = readFileSync(join(ROOT, 'scripts/lib/dev-client.js'), 'utf8');

const { values } = parseArgs({
  options: {
    only: { type: 'string' },
    port: { type: 'string', default: process.env.PORT || '5173' },
    host: { type: 'string', default: '127.0.0.1' }
  }
});
const only = values.only ? values.only.split(',').map(s => s.trim()).filter(Boolean) : undefined;

let page = '';
let failure = null;
const clients = new Set();

const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const errorPage = msg => `<!doctype html><meta charset=utf-8><title>VIGIL — build failed</title>
<body style="background:#111;color:#e8e4dc;font:13px/1.6 ui-monospace,monospace;padding:40px">
<h3 style="color:#f2a47a">build failed</h3><pre style="white-space:pre-wrap">${esc(msg)}</pre>
<p style="opacity:.5">fix the source — this page reloads on the next successful build</p>
<script>${CLIENT}</script>`;

function rebuild() {
  const t0 = performance.now();
  try {
    page = assemble({ srcDir: SRC, only, devClient: CLIENT }).html;
    failure = null;
    console.log(`[dev] rebuilt in ${(performance.now() - t0).toFixed(0)} ms`);
  } catch (e) {
    failure = e.message;
    console.error(`[dev] build failed: ${e.message}`);
  }
}

/* Always a plain reload: a failed build serves the error page, a fixed one the app. */
function broadcast() {
  for (const res of clients) res.write('event: reload\ndata: {}\n\n');
}

let timer = null;
watch(SRC, { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(() => { rebuild(); broadcast(); }, 60);
});

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__vigil/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(failure ? 500 : 200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(failure ? errorPage(failure) : page);
    return;
  }
  res.writeHead(404).end();
});

rebuild();
server.listen(Number(values.port), values.host, () => {
  const shown = values.host === '0.0.0.0' ? 'localhost' : values.host;
  console.log(`[dev] http://${shown}:${values.port}/  (watching src/${only ? ', scenes: ' + only.join(',') : ''})`);
});
