> [!WARNING]
> # 🚧 WORK IN PROGRESS 🚧
> VIGIL is being actively rebuilt from a single-file prototype into a real
> project. Scenes, keys, the build and the layout of this repo may all change
> without notice. Nothing here is stable yet.

# VIGIL

*Quiet machines for a spare screen.*

A generative screensaver in one self-contained HTML file: a growing set of WebGL2
scenes (volumetric light, plotter-drawn hyperboloids, frost, murmurations, an orrery,
and more). It has a slow slideshow, time-of-day dimming, and an optional clock
and weather overlay. There are no runtime dependencies. Open the file in a
Chromium browser with hardware acceleration and click for fullscreen.

## Use

**Live:** https://ayapejian.github.io/vigil/, deployed from `main` after CI passes.

```sh
npm install
npm run build        # → dist/index.html, the whole app in one file
```

| key | |
|---|---|
| ← → / A D | previous / next scene |
| space / S | start / pause the slideshow |
| ↑ ↓ | slideshow dwell ±30 s |
| 0 … 9 | type a scene number; it jumps once the number is unambiguous, after a short pause, or on Enter |
| C | cycle colour theme |
| I | clock and weather overlay (auto / on / off) |
| [ ] | animation speed |
| , . | scene density |
| F | fullscreen |
| R | reseed the scene |
| N | night dimming (auto / on / off) |
| Q | render scale (auto / sharp / soft) |
| H | hide all chrome |
| ? | key help |

On touch screens, swipe to change scenes.

Weather comes from [open-meteo](https://open-meteo.com), using browser
geolocation if you allow it, or an IP-based location otherwise. No API keys are
involved.

## Develop

```sh
npm run dev                          # live-reloading dev server on :5173
npm run new:scene -- my-scene "My Scene"
npm test                             # unit and scene-contract tests
npm run test:e2e                     # every scene in headless Chromium
```

See [AGENTS.md](AGENTS.md) for the architecture, the scene contract, and how
the build works.

## Provenance

`_init/vigil-original-start.html` is the original single-file build this repo
was reconstructed from. The first commit (`a6f729b`) rebuilds it byte for byte,
and its tests prove it.
