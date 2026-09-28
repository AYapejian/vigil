/* ---------------- 15 · STARLINGS ----------------
   Real boids: separation, alignment, cohesion, a wandering predator,
   soft borders. Nobody is in charge, and the shape still turns as one. */
(function () {
  const MAXN = 1400;
  let mesh = null;

  function init(s, w, h) {
    s.n = clamp(Math.round(650 * s._density), 200, MAXN);
    if (!s.x) {
      s.x = new Float32Array(MAXN); s.y = new Float32Array(MAXN);
      s.vx = new Float32Array(MAXN); s.vy = new Float32Array(MAXN);
      s.d = new Float32Array(MAXN);
    }
    for (let i = 0; i < MAXN; i++) {
      s.x[i] = w * (0.3 + Math.random() * 0.4); s.y[i] = h * (0.35 + Math.random() * 0.4);
      const a = Math.random() * TAU;
      s.vx[i] = Math.cos(a) * 60; s.vy[i] = Math.sin(a) * 60;
      s.d[i] = Math.random();
    }
    s.px = w * 0.2; s.py = h * 0.5; s.pa = 0; s.pT = 0; s.t = 0; s.acc = 0; s.w = w; s.h = h;
  }

  function step(s, dt, w, h) {
    const n = s.n, x = s.x, y = s.y, vx = s.vx, vy = s.vy;
    const sc = h / 720;
    const R = 72 * sc, R2 = R * R, SEP = 24 * sc, SEP2 = SEP * SEP;
    const fx = new Float32Array(n), fy = new Float32Array(n);
    const cx = new Float32Array(n), cy = new Float32Array(n), ax = new Float32Array(n), ay = new Float32Array(n), cnt = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      const xi = x[i], yi = y[i];
      for (let j = i + 1; j < n; j++) {
        const dx = x[j] - xi; if (dx > R || dx < -R) continue;
        const dy = y[j] - yi; if (dy > R || dy < -R) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 > R2 || d2 < 1e-4) continue;
        cnt[i]++; cnt[j]++;
        cx[i] += x[j]; cy[i] += y[j]; cx[j] += xi; cy[j] += yi;
        ax[i] += vx[j]; ay[i] += vy[j]; ax[j] += vx[i]; ay[j] += vy[i];
        if (d2 < SEP2) {
          const f = (1 - d2 / SEP2) / Math.sqrt(d2) * 240 * sc;
          fx[i] -= dx * f; fy[i] -= dy * f; fx[j] += dx * f; fy[j] += dy * f;
        }
      }
    }
    /* predator wanders in loops */
    s.pT -= dt;
    if (s.pT <= 0) { s.pa += (Math.random() - 0.5) * 2.4; s.pT = 1.5 + Math.random() * 3; }
    s.pa += Math.sin(s.t * 0.7) * 0.4 * dt;
    const pv = 150 * sc;
    s.px += Math.cos(s.pa) * pv * dt; s.py += Math.sin(s.pa) * pv * dt;
    if (s.px < w * 0.05 || s.px > w * 0.95) s.pa = Math.PI - s.pa;
    if (s.py < h * 0.10 || s.py > h * 0.90) s.pa = -s.pa;
    const FR = 170 * sc, FR2 = FR * FR;

    const vmax = 150 * sc, vmin = 55 * sc;
    for (let i = 0; i < n; i++) {
      let ax_ = fx[i], ay_ = fy[i];
      if (cnt[i] > 0) {
        const k = 1 / cnt[i];
        ax_ += (cx[i] * k - x[i]) * 0.9;                 // cohesion
        ay_ += (cy[i] * k - y[i]) * 0.9;
        ax_ += (ax[i] * k - vx[i]) * 2.2;                // alignment
        ay_ += (ay[i] * k - vy[i]) * 2.2;
      }
      const dxp = x[i] - s.px, dyp = y[i] - s.py, dp2 = dxp * dxp + dyp * dyp;
      if (dp2 < FR2) { const f = (1 - dp2 / FR2) * 1400 * sc / Math.sqrt(dp2 + 1); ax_ += dxp * f; ay_ += dyp * f; }
      /* soft bounds + a gentle pull to centre so the flock drifts, not escapes */
      const m = 80 * sc;
      if (x[i] < m) ax_ += (m - x[i]) * 6; if (x[i] > w - m) ax_ -= (x[i] - w + m) * 6;
      if (y[i] < m * 1.4) ay_ += (m * 1.4 - y[i]) * 6; if (y[i] > h - m) ay_ -= (y[i] - h + m) * 6;
      ax_ += (w * 0.5 - x[i]) * 0.10; ay_ += (h * 0.55 - y[i]) * 0.10;
      /* wander */
      ax_ += (Math.random() - 0.5) * 120 * sc; ay_ += (Math.random() - 0.5) * 120 * sc;

      vx[i] += ax_ * dt; vy[i] += ay_ * dt;
      const sp = Math.hypot(vx[i], vy[i]) || 1e-3;
      const tgt = clamp(sp, vmin, vmax);
      vx[i] *= tgt / sp; vy[i] *= tgt / sp;
      x[i] += vx[i] * dt; y[i] += vy[i] * dt;
    }
  }

  scene({
    id: 'starlings',
    name: 'Starlings',
    medium: 'boids · separation / alignment / cohesion · one hawk',
    chrome: '#e0d8dc',
    dwell: 210,
    post: {
      exposure: 1.08, bloom: 0.12, bloomThreshold: 0.55, bloomKnee: 0.8,
      vignette: 0.40, ca: 0.4, grain: 0.013, grainSize: 1.6
    },
    info: { on: true, pos: 'tr' },
    themes: [
      ['Plum Dusk', '#2A1E2E', '#3E2C40', '#14101A', '#5A5460', '#B8B0BC', '#F0E8EC'],
      ['Winter Grey', '#1E2228', '#2E363E', '#0E1216', '#4E5860', '#A0ACB6', '#E8F0F6'],
      ['Golden Hour', '#3A2618', '#4E3620', '#1A100A', '#6A5A46', '#C8B090', '#FFF0D0'],
      ['Teal Evening', '#16262A', '#22363A', '#0A1416', '#405A5E', '#98B4B8', '#E0F4F4'],
      ['Ash', '#222226', '#303036', '#101012', '#585860', '#A8A8B0', '#F0F0F4']
    ],
    alloc(s, w, h) {
      init(s, w, h);
      if (!mesh) mesh = new Mesh(MAXN * 3 + 64);
      if (s.trail) s.trail.dispose();
      s.trail = new Trail(w, h);
    },
    resize(s, w, h) {
      if (s.x && s.w) {
        const kx = w / s.w, ky = h / s.h;
        for (let i = 0; i < MAXN; i++) { s.x[i] *= kx; s.y[i] *= ky; s.vx[i] *= ky; s.vy[i] *= ky; }
        s.px *= kx; s.py *= ky;
      } else init(s, w, h);
      s.w = w; s.h = h;
      if (s.trail) s.trail.dispose();
      s.trail = new Trail(w, h);
    },
    reseed(s, manual) { if (manual) init(s, App.rw, App.rh); },
    tick(s, dt) {
      s.t += dt;
      const want = clamp(Math.round(650 * s._density), 200, MAXN);
      if (want !== s.n) s.n = want;
      s.acc += Math.min(dt, 0.05);
      let k = 0;
      while (s.acc >= 1 / 45 && k < 3) { step(s, 1 / 45, App.rw, App.rh); s.acc -= 1 / 45; k++; }
    },
    draw(s, target) {
      const far = palv(s, 3), near = palv(s, 4), lit = palv(s, 5);
      const sc = App.rh / 720;
      mesh.begin();
      for (let i = 0; i < s.n; i++) {
        const vx = s.vx[i], vy = s.vy[i];
        const sp = Math.hypot(vx, vy) || 1;
        const hx = vx / sp, hy = vy / sp;
        const depth = s.d[i];
        const L = (5 + 4 * depth) * sc, W = (2 + 1.6 * depth) * sc;
        const x = s.x[i], y = s.y[i];
        const c = [mix(far[0], near[0], depth), mix(far[1], near[1], depth), mix(far[2], near[2], depth)];
        if (depth > 0.94) { c[0] = lit[0]; c[1] = lit[1]; c[2] = lit[2]; }
        mesh.tri(x + hx * L, y + hy * L, x - hx * L * 0.6 - hy * W, y - hy * L * 0.6 + hx * W,
          x - hx * L * 0.6 + hy * W, y - hy * L * 0.6 - hx * W, c, 0.55 + 0.45 * depth);
      }
      s.trail.begin(0.86);
      mesh.draw(gl.TRIANGLES);
      s.trail.end();

      bindRT(target);
      const p = progOf(s); p.use(); setCommon(p, s);
      p.tex('uTrail', s.trail.tex, 0);
      drawTri();
    },
    frag: frag(`
uniform sampler2D uTrail;
#define C_SKYT uPal[0]
#define C_SKYB uPal[1]
#define C_VOID uPal[2]
void main(){
  vec2 uv = UVf();
  vec3 sky = mix(C_SKYB, C_SKYT, smoothstep(0.05, 1.0, uv.y));
  sky *= 0.35 + 0.45*smoothstep(0.0, 0.7, uv.y);
  sky = mix(C_VOID*1.1, sky, smoothstep(-0.25, 0.40, uv.y));
  sky *= 0.85 + 0.30*fbm2(uv*vec2(2.0,1.3) + uClocks.x*0.15, 3);
  vec3 birds = texture(uTrail, uv).rgb;
  fragColor = vec4(max(sky + birds*0.9, 0.0), 1.0);
}
`)
  });
})();
