/*
 * Evaluate the app's classic-script source in a DOM-less, GL-less Node vm.
 *
 * Top-level `const`/`class` declarations are not properties of the vm global,
 * but later scripts in the same context can see them — so `pick()` runs a tiny
 * script that returns the requested bindings.
 *
 * Boot never runs: document.readyState is 'loading' and addEventListener is a
 * no-op, so 60_ui.js registers boot() and stops. Anything a file touches at
 * load time (rather than inside a function) must exist in the stubs below.
 */
import vm from 'node:vm';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScripts, joinScripts } from '../../scripts/lib/assemble.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const SRC = join(ROOT, 'src');

const noop = () => { };

export function makeSandbox({ language = 'en-US' } = {}) {
  const el = () => ({ style: { setProperty: noop }, classList: { add: noop, remove: noop, toggle: noop } });
  const ctx = {
    console, performance, setTimeout, clearTimeout, setInterval, clearInterval,
    navigator: { language },
    document: {
      readyState: 'loading',
      getElementById: el,
      addEventListener: noop,
      documentElement: el(),
      body: el()
    },
    addEventListener: noop,
    requestAnimationFrame: noop,
    cancelAnimationFrame: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop })
  };
  ctx.window = ctx;
  return vm.createContext(ctx);
}

/**
 * Load source files into a fresh sandbox.
 * @param {(f: {name: string, layer: string}) => boolean} [which] file filter (default: all)
 */
export function load(which = () => true, opts) {
  const ctx = makeSandbox(opts);
  const files = loadScripts({ srcDir: SRC }).filter(which);
  vm.runInContext(joinScripts(files), ctx, { filename: 'bundle.js' });
  return {
    ctx,
    pick: (...names) => vm.runInContext(`({${names.join(',')}})`, ctx),
    run: code => vm.runInContext(code, ctx)
  };
}

export const byName = (...names) => f => names.includes(f.name);
