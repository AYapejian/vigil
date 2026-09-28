# AGENTS.md

VIGIL is a generative screensaver: twenty WebGL2 scenes, a slideshow, and a quiet
overlay (clock, weather), shipped as **one self-contained HTML file with no runtime
dependencies**. This repo is the source for that file.

## Commands

| | |
|---|---|
| `npm run dev` | dev server on http://127.0.0.1:5173 with live reload. `-- --only aurora,ocean` builds a subset; `-- --host 0.0.0.0` serves on the LAN; `?scene=N` opens scene N (1-based). A reload keeps you on the scene you were viewing |
| `npm run build` | writes `dist/index.html` (`-- --only <slug|NN,...>`, `-- --out <path>`) |
| `npm test` | Node unit + contract + parity tests (`node:test`, no browser) |
| `node --test test/scenes.test.mjs` | one test file; add `--test-name-pattern s05` for one case |
| `npm run test:e2e` | headless Chromium: boots the page, visits every scene, fails on any shader compile or render error. First run needs `npx playwright install chromium --only-shell` |
| `npm run check` | build + `npm test` (what CI runs before e2e) |
| deploy | automatic: a push to `main` that passes CI publishes `dist/` to GitHub Pages (https://ayapejian.github.io/vigil/) |
| `npm run new:scene -- <slug> ["Name"]` | scaffold `src/scenes/sNN_<slug>.js` with the next number |

Node ≥ 22. The only dependency is `playwright` (dev, e2e only).

## How the output is assembled

`scripts/lib/assemble.mjs` is the whole build. It reads `src/shell/index.html` and
replaces two placeholders:

- `<!-- @inject:styles -->` → `<style>` + `src/shell/styles.css` + `</style>`
- `<!-- @inject:scripts -->` → one `<script>` holding every JS file, each behind a
  `/* ===== <basename> ===== */` banner, joined with `\n`

**All JS files share one global scope.** They are classic scripts concatenated
in order, not modules. There is no import or export. A file can use anything
declared by a file before it. Order comes from where a file lives and its
number prefix:

1. `src/engine/NN_*.js` (NN < 40): primitives, GL wrappers, post chain, scene registry, kit
2. `src/scenes/sNN_<slug>.js`: each calls `scene({...})`. **The file number is the
   scene's index** (slideshow order, digit keys, `?scene=N`)
3. `src/runtime/NN_*.js` (NN ≥ 40): data connectors, app loop, UI, then `boot()`

The build syntax-checks every file on its own, then the joined bundle. That
second pass catches a top-level `const`/`function` that collides with another
file's, and reports it as `file.js:line`. Scenes avoid the problem by wrapping
private state in an IIFE (`(function () { ... scene({...}); })();`).

Line 1 of `src/shell/index.html` (the `<head>` with `color-scheme:light` and a
cream body background) is the claude.ai artifact-publish wrapper the original was
exported with. The app's own CSS overrides it. It is kept only for byte parity.

## Runtime architecture

**Frame pipeline** (`runtime/50_app.js` `render()`): scene → RGBA16F HDR target
(`Post.hdrA`). During a transition both scenes render and `P_MIX` crossfades them
over 2.6 s while their `post` settings are interpolated. Then comes the bloom
chain (`engine/20_post.js`: 5-level Karis-weighted downsample and tent
upsample), then `P_COMP` to the canvas: exposure, vignette, CA/barrel,
time-of-day tint and dim, AgX tonemap, sRGB, film grain, dither.

**Adaptive quality**: the frame time is smoothed. Past 20.5 ms for 2 s,
`App.renderScale` steps down (floor 0.56). Under 17.4 ms for 14 s, it steps
back up. The render size is capped at 2560×1440 and devicePixelRatio at 1.5.

**GL lifetime**: `gl` is `null` until `boot()`. Nothing may touch GL when a file
first loads. `new Program(src)` only stores source and compiles on first `use()`.
`Mesh`/`Trail`/`Particles` must be built in a scene's `alloc`, never at the top
of the file. The e2e and sandbox tests both depend on this.

### The scene contract (`engine/30_scenes_head.js` `scene()`)

Data fields: `id` (unique slug; need not match the file slug, e.g. `s07_ocean.js`
→ `openwater`), `name`, `medium` (one-line caption), `chrome` (#hex UI accent),
`dwell` (slideshow seconds, default 200), `post` (overrides of `POST_DEFAULT`),
`themes`, `st` (scene state), `info: { on, pos: 'tl'|'tr'|'bl'|'br' }` (clock and
weather overlay default), and `frag`, a fragment shader built with `frag(body)`.
`frag()` puts the shared `PRELUDE` first (in `engine/10_gl.js`): it holds
`#version`, the uniforms, hashes, noise, fbm, worley, thin-film and the
CIE→sRGB helpers. Optional `vs` supplies a custom vertex shader.

Lifecycle, driven by `activate()` and `renderScene()` in `50_app.js`:

| hook | when |
|---|---|
| `reseed(s, manual)` | every activation (`manual=false`) and on the **R** key (`true`) |
| `alloc(s, w, h)` | once, on first activation; build GPU resources here |
| `resize(s, w, h)` | on canvas resize or quality change, **only if already allocated** |
| `tick(s, dt)` | every frame: CPU state |
| `sim(s, dt)` | every frame after `tick`: GPU simulation passes |
| `draw(s, target, dt)` | if present, it owns rendering into `target` (bind it, and call `setCommon(prog, s)` for the shared uniforms). Otherwise the default runs one full-screen `frag` pass |
| `uni(p, s)` | default path only: set extra uniforms after `setCommon` |
| `demo(s)` | `window.VIGIL.demo()` jumps to a representative state (used for screenshots) |

`dt` is already scaled by the **[ ]** speed setting. Shared uniforms (`setCommon`)
are `uTime` (scene-local), `uClocks`/`uClocks2` (eight incommensurate phases of
the global sim time, for motion that never visibly loops), `uMood`, `uSeed`,
`uDrift` (sub-pixel burn-in drift), `uMotion` (0.3 when reduced motion is
preferred), `uDensity` (the **, .** keys, also in `s._density`), and `uPal[8]`.

**Themes**: `['Name', '#c0', ... up to 8]`. Colours become linear-light `uPal[i]`,
and the **C** key crossfades to the next theme. A theme with fewer colours is
padded with its last colour, so the contract test requires every theme in a
scene to have the same count. Scenes name slots with `#define C_X uPal[i]`. In
custom pipelines, read them with `palv(s, i)`.

### Data connectors (`runtime/45_connectors.js`)

`startConnectors()` runs 2.5 s after boot. It tries browser geolocation first,
reverse-geocoding the city name through bigdatacloud. If that fails, it falls
back to an IP lookup (ipwho.is), which returns the city itself. After that it
polls open-meteo every 15 min. None of these need keys. Results go into the `Data` global.
Subscribe with `Data.on(fn)`. Scenes read normalised weather through
`wxParams()` (`null` until data arrives, so scenes must fall back). Units follow
`navigator.language` (`-US` → imperial). New data sources belong here, following
the same pattern.

### Automation hook

`window.VIGIL` exposes `App`, `SCENES`, `Data`, `hop(i)` (jump instantly and pause the
slideshow), `warp(sec)`, `spin(n)` (step `tick`/`sim` n frames without rendering),
`theme(i)`, `injectWx(loc, wx)`, `quiet()`, `errors()`, `fps()`. The dev client and
e2e test are built on it, so keep it stable.

## Tests, and what each layer can and cannot see

- `test/parity.test.mjs`: **the refactor gate.** The build must equal
  `_init/vigil-original-start.html` byte for byte. It proves the split into
  `src/` lost nothing. **The first commit that intentionally changes the output
  (a new scene, any source edit) deletes this test.** Keep `_init/` as provenance.
- `test/scenes.test.mjs`: loads each scene file alone (the engine plus that one
  file) in a DOM-less `vm` sandbox (`test/helpers/sandbox.mjs`) and checks the
  contract above. It also evaluates the whole bundle once.
- `test/engine.test.mjs`, `test/connectors.test.mjs`: pure helpers (colour
  conversion, PRNG, theme packing, weather parsing and normalisation).
- `test/assemble.test.mjs`: ordering, `--only`, placeholders, and error
  locations. Uses temp-dir fixtures.
- `test/e2e/smoke.test.mjs`: the **only** layer that compiles GLSL. It runs on
  SwiftShader (software GL), so it proves compile and run, not appearance or
  real-GPU performance.

To test code in the sandbox, load files with `load(filter)` and read top-level
bindings with `pick('name', ...)`. Arrays made inside the vm have a different
`Array` prototype: spread them (`[...x]`) before `deepEqual`.

## Known limits (deliberate, for now)

- Digit keys reach scenes 1–20 only. The help text and boot line ("twenty quiet
  machines") are hard-coded in `src/shell/index.html`.
- No linter or formatter yet. The global-scope script style needs a declared
  globals list (or a move to ES modules plus a bundler) before `no-undef` is
  useful. Running a formatter would also rewrite every line of the parity-locked
  source.
- `scripts/extract-init.mjs` is the one-time script that created `src/` from
  `_init/`. It is not part of the workflow, and it refuses to overwrite `src/`.
