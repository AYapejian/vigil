# VIGIL

*Twenty quiet machines for a spare screen.*

A generative screensaver in one self-contained HTML file: twenty WebGL2 scenes
(volumetric light, plotter-drawn hyperboloids, frost, murmurations, an orrery,
and more). It has a slow slideshow, time-of-day dimming, and an optional clock
and weather overlay. There are no runtime dependencies. Open the file in a
Chromium browser with hardware acceleration and click for fullscreen.

## Use

```sh
npm install
npm run build        # → dist/index.html, the whole app in one file
```

| key | |
|---|---|
| ← → / A D | previous / next scene |
| space / S | start / pause the slideshow |
| ↑ ↓ | slideshow dwell ±30 s |
| 1 … 0, shift+digit | jump to scene 1–10, 11–20 |
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
npm test                             # unit, contract and parity tests
npm run test:e2e                     # every scene in headless Chromium
```

See [AGENTS.md](AGENTS.md) for the architecture, the scene contract, and how
the build works.

## Provenance

`_init/vigil-original-start.html` is the original single-file build this repo
was reconstructed from. `npm test` includes a check that the build reproduces it
byte for byte.
