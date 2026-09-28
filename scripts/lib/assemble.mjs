/*
 * Assembler: src/ → one self-contained HTML document.
 *
 * Every script file shares ONE global scope in the output (classic <script>,
 * not modules), so order matters and is fixed by convention:
 *
 *   engine/   NN_*.js  (NN < 40)  sorted — primitives, GL, post chain, scene API, kit
 *   scenes/   sN_*.js             by number — each calls scene({...}); order = scene index
 *   runtime/  NN_*.js  (NN >= 40) sorted — connectors, app loop, UI, boot
 *
 * Each file is emitted as `/* ===== <basename> ===== *\/\n<text>` and files are
 * joined with '\n'. This is byte-compatible with how the original was built
 * (proven against _init/ in commit a6f729b).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import vm from 'node:vm';

export const MARKER = /\/\* ===== (\S+) ===== \*\//;
export const LAYERS = ['engine', 'scenes', 'runtime'];
const SCENE_FILE = /^s(\d+)_([a-z0-9-]+)\.js$/;
const ORDERED_FILE = /^(\d\d)_[a-z0-9_-]+\.js$/;

export const placeholder = name => `<!-- @inject:${name} -->`;
export const banner = name => `/* ===== ${name} ===== */`;

/** Which src/ subdirectory a script basename belongs in. */
export function layerOf(name) {
  if (SCENE_FILE.test(name)) return 'scenes';
  const m = ORDERED_FILE.exec(name);
  if (!m) throw new Error(`unrecognised script name "${name}" (want NN_name.js or sN_slug.js)`);
  return Number(m[1]) < 40 ? 'engine' : 'runtime';
}

/** Scene slug from a scene basename: s05_weather.js → weather. */
export const sceneSlug = name => SCENE_FILE.exec(name)?.[2] ?? null;

/** Scene number from a scene basename: s05_weather.js → 5. Any width; s100 sorts after s21. */
export const sceneNumber = name => { const m = SCENE_FILE.exec(name); return m ? Number(m[1]) : null; };

/** Ordered list of script files: [{ name, path, layer }]. */
export function listScripts(srcDir) {
  const out = [];
  for (const layer of LAYERS) {
    const dir = join(srcDir, layer);
    if (!existsSync(dir)) continue;
    const names = readdirSync(dir).filter(n => n.endsWith('.js')).sort();
    if (layer === 'scenes') names.sort((a, b) => (sceneNumber(a) ?? -1) - (sceneNumber(b) ?? -1) || (a < b ? -1 : 1));
    for (const name of names) {
      const want = layerOf(name);
      if (want !== layer) throw new Error(`${layer}/${name} belongs in ${want}/ by its name`);
      out.push({ name, path: join(dir, name), layer });
    }
  }
  const seen = new Set(), nums = new Map();
  for (const f of out) {
    if (seen.has(f.name)) throw new Error(`duplicate script name ${f.name}`);
    seen.add(f.name);
    const n = sceneNumber(f.name);
    if (n !== null && nums.has(n)) throw new Error(`scenes ${nums.get(n)} and ${f.name} share number ${n}`);
    if (n !== null) nums.set(n, f.name);
  }
  return out;
}

/** Keep only the named scenes (by slug or file number); engine/runtime always kept. */
export function filterScenes(files, only) {
  if (!only || only.length === 0) return files;
  const scenes = files.filter(f => f.layer === 'scenes');
  const pick = new Set();
  for (const want of only) {
    const hit = scenes.find(f => sceneSlug(f.name) === want || (/^\d+$/.test(want) && sceneNumber(f.name) === Number(want)));
    if (!hit) {
      const known = scenes.map(f => sceneSlug(f.name)).join(', ');
      throw new Error(`--only: no scene "${want}". Known: ${known}`);
    }
    pick.add(hit.name);
  }
  return files.filter(f => f.layer !== 'scenes' || pick.has(f.name));
}

/** Ordered, filtered script files with their text: [{ name, path, layer, text }]. */
export function loadScripts({ srcDir, only }) {
  const files = filterScenes(listScripts(srcDir), only)
    .map(f => ({ ...f, text: readFileSync(f.path, 'utf8') }));
  if (!files.some(f => f.layer === 'scenes')) throw new Error('no scenes to build');
  return files;
}

/** The body of the single <script>: each file behind its banner, joined by '\n'. */
export const joinScripts = files => files.map(f => banner(f.name) + '\n' + f.text).join('\n');

function inject(template, name, content) {
  const tag = placeholder(name);
  const at = template.indexOf(tag);
  if (at < 0) throw new Error(`template is missing ${tag}`);
  if (template.indexOf(tag, at + 1) >= 0) throw new Error(`template has ${tag} more than once`);
  return template.slice(0, at) + content + template.slice(at + tag.length);
}

/** Syntax-check each file on its own (precise file:line), then the joined bundle (cross-file redeclarations). */
function checkSyntax(files, bundle, srcDir) {
  for (const f of files) {
    try { new vm.Script(f.text, { filename: relative(srcDir, f.path) }); }
    catch (e) { throw withLocation(e, relative(srcDir, f.path)); }
  }
  try { new vm.Script(bundle, { filename: 'bundle.js' }); }
  catch (e) {
    const line = Number(/bundle\.js:(\d+)/.exec(e.stack || '')?.[1]);
    const loc = line ? locate(files, line) : null;
    throw withLocation(e, loc ? `${loc.file}:${loc.line}` : 'bundle.js');
  }
}

function withLocation(e, where) {
  const line = /:(\d+)\n/.exec(e.stack || '')?.[1];
  const err = new Error(`${where}${line && !where.includes(':') ? ':' + line : ''} — ${e.message}`);
  err.cause = e;
  return err;
}

/** Map a 1-based line in the joined script back to its source file. */
function locate(files, bundleLine) {
  let line = 1;
  for (const f of files) {
    // banner + body lines; the empty last element of split() is the line the '\n' join ends
    const span = 1 + f.text.split('\n').length;
    if (bundleLine < line + span) return { file: f.name, line: bundleLine - line };
    line += span;
  }
  return null;
}

/**
 * Build the document.
 * @param {object} o
 * @param {string} o.srcDir      path to src/
 * @param {string[]} [o.only]    scene slugs/numbers to include (default: all)
 * @param {string} [o.devClient] extra <script> body appended before </body> (dev server only)
 * @returns {{ html: string, files: {name,path,layer,text}[] }}
 */
export function assemble({ srcDir, only, devClient }) {
  const template = readFileSync(join(srcDir, 'shell/index.html'), 'utf8');
  const css = readFileSync(join(srcDir, 'shell/styles.css'), 'utf8');
  const files = loadScripts({ srcDir, only });
  const js = joinScripts(files);
  checkSyntax(files, js, srcDir);

  let html = inject(template, 'styles', `<style>${css}</style>`);
  html = inject(html, 'scripts', `<script>${js}</script>`);
  if (devClient) {
    const tag = `<script>${devClient}</script>\n`;
    const at = html.lastIndexOf('</body>');
    html = at < 0 ? html + tag : html.slice(0, at) + tag + html.slice(at);
  }
  return { html, files };
}
