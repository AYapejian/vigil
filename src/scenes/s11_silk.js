/* ---------------- 11 · SILK ----------------
   A hanging curtain of cloth: 44×30 Verlet nodes, structural and shear
   constraints, gravity, and a wind that never quite settles. */
(function () {
  const CW = 44, CH = 40, N = CW * CH;
  let mesh = null;

  const BG = frag(`
#define C_WALL  uPal[0]
#define C_WALL2 uPal[1]
#define C_RIM   uPal[4]
#define C_FLOOR uPal[5]
void main(){
  vec2 uv = UVf(); vec2 p = NP();
  vec3 col = mix(C_WALL2, C_WALL, smoothstep(-1.0, 1.1, p.y));
  col *= 0.80 + 0.30*fbm2(p*1.3 + 9.0, 3);
  /* a window somewhere to the left lets in a soft slab of light */
  col *= 1.5;
  col += C_RIM * 0.14 * exp(-pow((p.x + 1.05)/0.45, 2.0)) * smoothstep(-0.9, 0.4, p.y);
  col += C_RIM * 0.035 * exp(-pow((p.x - 0.1)/0.9, 2.0)) * smoothstep(-1.0, 0.9, p.y);
  float floorY = -0.78;
  float fl = smoothstep(0.02, -0.03, p.y - floorY);
  vec3 floorC = C_FLOOR * (0.7 + 0.3*fbm2(vec2(p.x*6.0, p.y*40.0), 3));
  floorC *= 0.6 + 0.4*smoothstep(-1.0, floorY, p.y);
  col = mix(col, floorC, fl);
  /* soft shadow the curtain throws on the floor */
  col *= 1.0 - 0.35*fl*exp(-pow((p.x - 0.05)/0.75, 2.0))*smoothstep(-1.0, floorY, p.y);
  fragColor = vec4(col, 1.0);
}`);

  function build(s, w, h) {
    const sc = h / 720;
    s.sc = sc;
    const clothW = 0.80 * h, L = clothW / (CW - 1);
    s.L = L;
    s.cx = w * 0.53; s.top = h * 0.93;
    s.px = new Float32Array(N); s.py = new Float32Array(N); s.pz = new Float32Array(N);
    s.ox = new Float32Array(N); s.oy = new Float32Array(N); s.oz = new Float32Array(N);
    for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
      const k = j * CW + i;
      s.px[k] = s.cx + (i - (CW - 1) / 2) * L;
      s.py[k] = s.top - j * L;
      s.pz[k] = 0;
      s.ox[k] = s.px[k]; s.oy[k] = s.py[k]; s.oz[k] = 0;
    }
    s.acc = 0; s.t = 0; s.gust = 0; s.gustT = 20; s.w = w; s.h = h;
  }

  function step(s, dt) {
    const { px, py, pz, ox, oy, oz, L, sc } = s;
    const t = s.t;
    const W = 1.0 * s._density;
    const g = -520 * sc;
    /* wind: slow large-scale field + gusts */
    const base = 48 * sc * W * (0.55 + 0.45 * Math.sin(t * 0.21) * Math.sin(t * 0.073 + 1.3));
    const gust = s.gust * 170 * sc;
    for (let k = 0; k < N; k++) {
      const j = (k / CW) | 0, i = k - j * CW;
      if (j === 0) continue;                       // pinned hem
      const x = px[k], y = py[k], z = pz[k];
      const wx = (base + gust) * (0.7 + 0.3 * Math.sin(t * 0.63 + y * 0.011))
        + 16 * sc * W * Math.sin(t * 1.7 + x * 0.02 + j * 0.3);
      const wz = 95 * sc * W * Math.sin(t * 0.47 + x * 0.007 + y * 0.004)
        + 34 * sc * W * Math.sin(t * 1.31 + y * 0.015 + i * 0.2) + gust * 0.5;
      const damp = 0.980;
      const vx = (x - ox[k]) * damp, vy = (y - oy[k]) * damp, vz = (z - oz[k]) * damp;
      ox[k] = x; oy[k] = y; oz[k] = z;
      px[k] = x + vx + wx * dt * dt;
      py[k] = y + vy + g * dt * dt;
      pz[k] = z + vz + wz * dt * dt;
    }
    /* pins sway a little on their rail */
    const sway = 6 * sc * Math.sin(t * 0.35);
    for (let i = 0; i < CW; i++) { px[i] = s.cx + (i - (CW - 1) / 2) * L + sway; py[i] = s.top; pz[i] = 0; }

    const solve = (a, b, rest) => {
      let dx = px[b] - px[a], dy = py[b] - py[a], dz = pz[b] - pz[a];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      const diff = (d - rest) / d * 0.5;
      dx *= diff; dy *= diff; dz *= diff;
      const pa = (a < CW), pb = (b < CW);
      if (!pa) { px[a] += dx * (pb ? 2 : 1); py[a] += dy * (pb ? 2 : 1); pz[a] += dz * (pb ? 2 : 1); }
      if (!pb) { px[b] -= dx * (pa ? 2 : 1); py[b] -= dy * (pa ? 2 : 1); pz[b] -= dz * (pa ? 2 : 1); }
    };
    const D = L * Math.SQRT2;
    for (let it = 0; it < 5; it++) {
      for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
        const k = j * CW + i;
        if (i < CW - 1) solve(k, k + 1, L);
        if (j < CH - 1) solve(k, k + CW, L);
        if (i < CW - 1 && j < CH - 1) { solve(k, k + CW + 1, D); solve(k + 1, k + CW, D); }
      }
    }
    /* keep the cloth in front of the wall */
    for (let k = CW; k < N; k++) if (pz[k] < -30 * sc) pz[k] = -30 * sc;
  }

  scene({
    id: 'silk',
    name: 'Silk',
    medium: 'verlet cloth · 1 760 nodes · shear + structural',
    chrome: '#e4b8b0',
    dwell: 220,
    post: {
      exposure: 1.06, bloom: 0.08, bloomThreshold: 0.72, bloomKnee: 0.7,
      vignette: 0.48, ca: 0.4, grain: 0.014, grainSize: 1.6
    },
    themes: [
      ['Oxblood', '#2E2622', '#161210', '#7A1E28', '#D9606A', '#F2B8A8', '#2A211A'],
      ['Indigo', '#20242E', '#0E1016', '#1E2A6A', '#5A72D9', '#B8C8F2', '#1A1E2A'],
      ['Champagne', '#2E2820', '#161210', '#B89A5A', '#F2DCA0', '#FFF2D0', '#2A2418'],
      ['Moss', '#1E2A20', '#0E1410', '#2A5A34', '#6AB07A', '#C8F0CC', '#1A2A1C'],
      ['Slate', '#22262A', '#101214', '#4A5460', '#9AA8B8', '#E0E8F0', '#1E2226']
    ],
    frag: BG,
    alloc(s, w, h) { build(s, w, h); if (!mesh) mesh = new Mesh((CW - 1) * (CH - 1) * 6 + 64); },
    resize(s, w, h) {
      if (!s.px) { build(s, w, h); return; }
      const kx = w / s.w, ky = h / s.h;
      for (let k = 0; k < N; k++) { s.px[k] *= kx; s.ox[k] *= kx; s.py[k] *= ky; s.oy[k] *= ky; s.pz[k] *= ky; s.oz[k] *= ky; }
      s.L *= ky; s.sc = h / 720; s.cx = w * 0.53; s.top = h * 0.93; s.w = w; s.h = h;
    },
    tick(s, dt) {
      s.t += dt;
      s.gustT -= dt;
      if (s.gustT <= 0) { s.gust = 0.6 + Math.random() * 0.8; s.gustT = 18 + Math.random() * 40; }
      s.gust *= Math.exp(-dt / 2.2);
      s.acc += Math.min(dt, 0.05);
      let n = 0;
      while (s.acc >= 1 / 60 && n < 4) { step(s, 1 / 60); s.acc -= 1 / 60; n++; }
    },
    draw(s, target) {
      bindRT(target); gl.disable(gl.BLEND);
      const pb = progOf(s); pb.use(); setCommon(pb, s); drawTri();

      const { px, py, pz } = s;
      const cloth = palv(s, 2), lit = palv(s, 3), rim = palv(s, 4);
      const Lx = 0.66, Ly = 0.28, Lz = 0.70;
      const col = new Float32Array(N * 3);
      for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
        const k = j * CW + i;
        const ia = i > 0 ? k - 1 : k, ib = i < CW - 1 ? k + 1 : k;
        const ja = j > 0 ? k - CW : k, jb = j < CH - 1 ? k + CW : k;
        const ax = px[ib] - px[ia], ay = py[ib] - py[ia], az = pz[ib] - pz[ia];
        const bx = px[jb] - px[ja], by = py[jb] - py[ja], bz = pz[jb] - pz[ja];
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        const diff = Math.abs(nx * Lx + ny * Ly + nz * Lz);
        const sheen = Math.pow(diff, 8) * 0.60;
        const rimF = Math.pow(1 - Math.abs(nz), 2.2) * 0.35;
        const weave = 0.94 + 0.06 * Math.sin(i * 1.1 + j * 0.35);
        const sh = (0.14 + 0.86 * diff * diff) * weave;
        col[k * 3] = cloth[0] * sh + lit[0] * sheen + rim[0] * rimF;
        col[k * 3 + 1] = cloth[1] * sh + lit[1] * sheen + rim[1] * rimF;
        col[k * 3 + 2] = cloth[2] * sh + lit[2] * sheen + rim[2] * rimF;
      }
      mesh.begin();
      const c0 = [0, 0, 0], c1 = [0, 0, 0], c2 = [0, 0, 0];
      const P = k => [px[k] + pz[k] * 0.20, py[k] + pz[k] * 0.07];
      const C = (k, o) => { o[0] = col[k * 3]; o[1] = col[k * 3 + 1]; o[2] = col[k * 3 + 2]; return o; };
      for (let j = 0; j < CH - 1; j++) for (let i = 0; i < CW - 1; i++) {
        const k = j * CW + i;
        const a = P(k), b = P(k + 1), c = P(k + CW), d = P(k + CW + 1);
        mesh.tri3(a[0], a[1], C(k, c0), b[0], b[1], C(k + 1, c1), c[0], c[1], C(k + CW, c2), 1);
        mesh.tri3(b[0], b[1], C(k + 1, c0), d[0], d[1], C(k + CW + 1, c1), c[0], c[1], C(k + CW, c2), 1);
      }
      blendOver();
      mesh.draw(gl.TRIANGLES);
      gl.disable(gl.BLEND);
    }
  });
})();
