# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Claude-specific notes

- To look at a scene in a browser, run `npm run dev` and open `/?scene=N`. Drive
  it through `window.VIGIL` (`hop`, `theme`, `demo`, `warp`), not by simulating
  keys.
- A browser-automation tab is often a *hidden* tab, so `requestAnimationFrame`
  is throttled or paused and the scene will not advance. Use `VIGIL.spin(n)` to
  step the simulation, or use the Playwright e2e harness, which runs a visible
  headless page.
- Shader changes are only proven by `npm run test:e2e`. `npm test` never
  compiles GLSL.
