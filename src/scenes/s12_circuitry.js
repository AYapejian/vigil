/* ---------------- 12 · CIRCUITRY ----------------
   A board routes itself: traces walk out from their pads at 45° bends,
   avoid each other, terminate in vias. Then signals run. Then it fades
   and a new board is laid. */
(function () {
  const COLS = 72;
  let mesh = null;

  const BG = frag(`
#define C_SUB  uPal[0]
#define C_GRID uPal[1]
uniform float uCell;
void main(){
  vec2 px = PX();
  vec2 p = NP();
  vec3 col = C_SUB * (0.85 + 0.30*fbm2(p*2.2 + 3.0, 3));
  col *= 1.0 - 0.35*length(p*vec2(0.55,0.85));
  /* drill grid */
  vec2 g = fract(px/uCell) - 0.5;
  float dot_ = smoothstep(0.10, 0.04, length(g));
  col += C_GRID * dot_ * 0.30;
  fragColor = vec4(col, 1.0);
}`);

  const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  function generate(s) {
    const R = mulberry32((Math.random() * 1e9) >>> 0);
    const cols = COLS, rows = s.rows;
    const occ = new Uint8Array(cols * rows);
    const traces = [], pads = [];
    const NT = Math.round(150 * s._density);
    const tryTrace = () => {
      let c = 3 + Math.floor(R() * (cols - 6)), r = 3 + Math.floor(R() * (rows - 6));
      if (occ[r * cols + c]) return;
      let dir = Math.floor(R() * 8);
      const pts = [[c, r]];
      occ[r * cols + c] = 1;
      const len = 6 + Math.floor(R() * 42);
      for (let n = 0; n < len; n++) {
        if (R() > 0.72) dir = (dir + (R() < 0.5 ? 1 : 7)) % 8;
        let moved = false;
        for (let tryN = 0; tryN < 3 && !moved; tryN++) {
          const d = DIRS[dir];
          const nc = c + d[0], nr = r + d[1];
          if (nc < 1 || nr < 1 || nc >= cols - 1 || nr >= rows - 1) { dir = (dir + 1) % 8; continue; }
          if (occ[nr * cols + nc]) { dir = (dir + 7) % 8; continue; }
          /* diagonals may not slip between two occupied orthogonal neighbours */
          if (d[0] && d[1] && occ[r * cols + nc] && occ[nr * cols + c]) { dir = (dir + 1) % 8; continue; }
          c = nc; r = nr; occ[r * cols + c] = 1; pts.push([c, r]); moved = true;
        }
        if (!moved) break;
      }
      if (pts.length < 5) return;
      /* keep a one-cell moat so parallel traces do not touch */
      for (const [x, y] of pts) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < cols && yy < rows && !occ[yy * cols + xx]) occ[yy * cols + xx] = 2;
      }
      traces.push({
        pts, start: traces.length * 0.55 + R() * 0.5, speed: 12 + R() * 6,
        pulseAt: 4 + R() * 30, pulse: -1, pulseV: 22 + R() * 14,
        pad: R() < 0.55
      });
      if (R() < 0.55) pads.push(pts[0]);
    };
    for (let k = 0; k < NT * 4 && traces.length < NT; k++) tryTrace();
    s.traces = traces; s.pads = pads;
    s.phase = 'build'; s.t = 0; s.alpha = 0;
    s.buildT = traces.length * 0.55 + 4;
  }

  scene({
    id: 'circuitry',
    name: 'Circuitry',
    medium: 'procedural routing · 45° bends · signal pulses',
    chrome: '#d9a06a',
    dwell: 230,
    post: {
      exposure: 1.02, bloom: 0.16, bloomThreshold: 0.60, bloomKnee: 0.8,
      vignette: 0.42, ca: 0.3, grain: 0.011, grainSize: 1.5
    },
    themes: [
      ['Copper', '#0A1A12', '#1E3A28', '#B8703A', '#E8B070', '#FFE9B0', '#7AD9A0'],
      ['Gold on Black', '#0B0A08', '#2A2418', '#C9A23A', '#F0D27A', '#FFF6D0', '#A0B8FF'],
      ['Schematic', '#08101E', '#1C2C48', '#4AA0E8', '#A0D8FF', '#FFFFFF', '#FF7A5A'],
      ['Graphite', '#0C0C0E', '#222226', '#9AA0A8', '#D0D6DC', '#FFFFFF', '#FFB35A'],
      ['Redboard', '#180806', '#3A1610', '#E85A3A', '#FFB08A', '#FFE8D8', '#7AE8C8']
    ],
    frag: BG,
    alloc(s, w, h) {
      s.cell = w / COLS; s.rows = Math.max(20, Math.floor(h / s.cell) - 1);
      s.oy = (h - s.rows * s.cell) * 0.5;
      if (!mesh) mesh = new Mesh(90000);
      generate(s);
    },
    resize(s, w, h) {
      /* keep the board through a render-scale change; regenerate only if the grid changes shape */
      const rows = Math.max(20, Math.floor(h / (w / COLS)) - 1);
      s.cell = w / COLS; s.oy = (h - rows * s.cell) * 0.5;
      if (rows !== s.rows) { s.rows = rows; generate(s); }
    },
    reseed(s, manual) { if (manual) generate(s); },
    demo(s) { s.t = 0; s.phase = 'hold'; s.alpha = 1; s.traces.forEach(t => t.pulse = Math.random() * t.pts.length); },
    tick(s, dt) {
      s.t += dt;
      const S = s;
      if (S.phase === 'build') {
        S.alpha = Math.min(1, S.alpha + dt / 3);
        if (S.t > S.buildT + 8) { S.phase = 'hold'; S.t = 0; }
      } else if (S.phase === 'hold') {
        if (S.t > 120) { S.phase = 'fade'; S.t = 0; }
      } else if (S.phase === 'fade') {
        S.alpha = Math.max(0, S.alpha - dt / 6);
        if (S.alpha <= 0) { generate(S); }
      }
      /* pulses only travel on completed traces */
      for (const tr of S.traces) {
        if (tr.pulse >= 0) {
          tr.pulse += tr.pulseV * dt;
          if (tr.pulse > tr.pts.length + 3) { tr.pulse = -1; tr.pulseAt = 6 + Math.random() * 40; }
        } else if (S.phase !== 'build') {
          tr.pulseAt -= dt;
          if (tr.pulseAt <= 0) tr.pulse = 0;
        }
      }
    },
    draw(s, target) {
      bindRT(target); gl.disable(gl.BLEND);
      const pb = progOf(s); pb.use(); setCommon(pb, s); pb.set('uCell', s.cell); drawTri();

      const cs = s.cell, oy = s.oy, T = s.t;
      const cop = palv(s, 2), pad = palv(s, 3), pul = palv(s, 4), silk = palv(s, 5);
      const X = c => (c + 0.5) * cs, Y = r => oy + (r + 0.5) * cs;
      const A = s.alpha;

      /* --- copper layer (over) --- */
      mesh.begin();
      for (const tr of s.traces) {
        const prog = s.phase === 'build' ? clamp((T - tr.start) * tr.speed, 0, tr.pts.length - 1) : tr.pts.length - 1;
        const nFull = Math.floor(prog), frac = prog - nFull;
        for (let i = 0; i < nFull; i++) {
          const a = tr.pts[i], b = tr.pts[i + 1];
          mesh.stroke(X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), cs * 0.30, cop, A);
        }
        if (frac > 0 && nFull < tr.pts.length - 1) {
          const a = tr.pts[nFull], b = tr.pts[nFull + 1];
          mesh.stroke(X(a[0]), Y(a[1]), X(a[0]) + (X(b[0]) - X(a[0])) * frac, Y(a[1]) + (Y(b[1]) - Y(a[1])) * frac, cs * 0.30, cop, A);
        }
        if (prog > 0) {
          const p0 = tr.pts[0];
          if (tr.pad) { mesh.disc(X(p0[0]), Y(p0[1]), cs * 0.44, pad, A, 12); }
          else mesh.disc(X(p0[0]), Y(p0[1]), cs * 0.22, cop, A, 8);
        }
        if (prog >= tr.pts.length - 1) {
          const pe = tr.pts[tr.pts.length - 1];
          mesh.disc(X(pe[0]), Y(pe[1]), cs * 0.26, pad, A, 8);
        }
      }
      blendOver();
      mesh.draw(gl.TRIANGLES);

      /* --- pad holes + silk ring (over, in substrate colour) --- */
      const sub = palv(s, 0);
      mesh.begin();
      for (const tr of s.traces) {
        const prog = s.phase === 'build' ? (T - tr.start) * tr.speed : 1;
        if (prog <= 0) continue;
        const p0 = tr.pts[0];
        if (tr.pad) mesh.disc(X(p0[0]), Y(p0[1]), cs * 0.18, sub, A, 10);
        if (prog >= tr.pts.length - 1) {
          const pe = tr.pts[tr.pts.length - 1];
          mesh.disc(X(pe[0]), Y(pe[1]), cs * 0.11, sub, A, 8);
        }
      }
      mesh.draw(gl.TRIANGLES);

      /* --- signal pulses (additive) --- */
      mesh.begin();
      for (const tr of s.traces) {
        if (tr.pulse < 0) continue;
        const L = 3.2;
        for (let i = 0; i < tr.pts.length - 1; i++) {
          const d0 = tr.pulse - i, d1 = tr.pulse - (i + 1);
          const a0 = Math.max(0, 1 - Math.abs(d0) / L), a1 = Math.max(0, 1 - Math.abs(d1) / L);
          if (a0 <= 0 && a1 <= 0) continue;
          const a = tr.pts[i], b = tr.pts[i + 1];
          mesh.stroke(X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), cs * 0.34, pul, a0 * a0 * 1.4 * A, pul, a1 * a1 * 1.4 * A);
        }
      }
      blendAdd();
      mesh.draw(gl.TRIANGLES);
      gl.disable(gl.BLEND);
    }
  });
})();
