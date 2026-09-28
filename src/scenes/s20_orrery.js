/* ---------------- 20 · ORRERY ----------------
   A star system that does not exist, solved by Kepler's equation.
   Four to seven planets on slightly eccentric orbits, periods by the
   third law, a few moons, one ring, an asteroid belt; seen at a tilt,
   the inner worlds hurrying, the outer ones barely moving. */
(function () {
  let mesh = null;
  const TILT = 0.42;
  const LIFE = 270, FADE = 5;

  function kepler(M, e) {
    let E = M;
    for (let i = 0; i < 5; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return E;
  }
  /* position on an orbit in the ecliptic plane, before tilt */
  function orbitPos(o, E) {
    const x = o.a * (Math.cos(E) - o.e), y = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
    const c = Math.cos(o.w), s = Math.sin(o.w);
    return [x * c - y * s, x * s + y * c];
  }

  function build(s, w, h) {
    const R = rng(Math.random());
    const sc = h / 720;
    const cx = w * 0.5, cy = h * 0.5;
    const n = 4 + Math.floor(R() * 4);
    const a0 = (58 + R() * 16) * sc;
    const ratio = 1.36 + R() * 0.16;
    const T0 = 14 + R() * 6;
    const planets = [];
    for (let i = 0; i < n; i++) {
      const a = a0 * Math.pow(ratio, i) * (0.94 + R() * 0.12);
      const gas = i >= 2 && R() < 0.55;
      const p = {
        a, e: R() * R() * 0.14, w: R() * TAU, M0: R() * TAU,
        T: T0 * Math.pow(a / a0, 1.5),
        r: (gas ? 8.5 + R() * 5.0 : 3.6 + R() * 2.8) * sc,
        tint: R(), gas, moons: [], ring: null
      };
      if (gas) {
        const nm = 1 + Math.floor(R() * 3);
        for (let k = 0; k < nm; k++) p.moons.push({ d: p.r * (2.2 + k * 1.3 + R() * 0.6), T: 2.5 + R() * 5 + k * 2, M0: R() * TAU, r: (0.9 + R() * 0.8) * sc });
      }
      planets.push(p);
    }
    /* one ring on the largest gas giant, if any */
    let big = null;
    for (const p of planets) if (p.gas && (!big || p.r > big.r)) big = p;
    if (big) big.ring = { r0: big.r * 1.6, r1: big.r * 2.6, tilt: 0.35 + R() * 0.3, ang: (R() - 0.5) * 0.8 };
    /* a belt between two adjacent planets that have a gap */
    let gap = 1 + Math.floor(R() * Math.max(1, n - 2));
    const belt = [];
    const bIn = planets[gap - 1].a * 1.25, bOut = planets[gap].a * 0.8;
    const nb = Math.round(520 * clamp(s._density, 0.4, 2));
    for (let i = 0; i < nb; i++) {
      const a = bIn + (bOut - bIn) * (0.15 + 0.7 * R() + 0.15 * R());
      belt.push({ a, M0: R() * TAU, T: T0 * Math.pow(a / a0, 1.5), e: R() * 0.06, w: R() * TAU, z: (R() - 0.5) * 6 * sc, b: 0.3 + R() * 0.7 });
    }
    /* fit: the outermost orbit stays inside the frame */
    let amax = 0; for (const p of planets) amax = Math.max(amax, p.a * (1 + p.e));
    const fit = Math.min((w * 0.47) / amax, (h * 0.47 / TILT) / amax);
    for (const p of planets) { p.a *= fit; for (const m of p.moons) m.d *= 1; }
    for (const b of belt) b.a *= fit;
    s.planets = planets; s.belt = belt; s.cx = cx; s.cy = cy; s.sc = sc;
    s.starR = (10 + R() * 5) * sc; s.starHue = R();
    s.t = 0; s.age = 0; s.alpha = 0; s.w = w; s.h = h;
  }

  scene({
    id: 'orrery',
    name: 'Orrery',
    medium: 'kepler orbits · moons · a belt · one ring · seen at a tilt',
    chrome: '#e8dcc8',
    dwell: 240,
    post: {
      exposure: 1.08, bloom: 0.22, bloomThreshold: 0.45, bloomKnee: 0.8,
      vignette: 0.44, ca: 0.5, grain: 0.012, grainSize: 1.5
    },
    themes: [
      ['Brass', '#06060A', '#100C10', '#FFE0A0', '#8A7A60', '#C8A070', '#7A9AB8', '#D8D0C0', '#A09080'],
      ['Cold Star', '#04060C', '#0A0E1A', '#D8E8FF', '#5A6A8A', '#A0B8D8', '#E0C8A0', '#D0D8E8', '#8090A8'],
      ['Ember Star', '#0A0404', '#160A08', '#FFB070', '#8A5A40', '#E09060', '#A0B0C0', '#E0C8B0', '#A08070'],
      ['Nocturne', '#040408', '#0C0A14', '#F0F0FF', '#4A4A6A', '#B0A0D0', '#8AC0B0', '#D8D8F0', '#8A8AA8'],
      ['Verdigris', '#040808', '#0A1412', '#E8FFE0', '#4A7A70', '#A0D0B8', '#D0C080', '#C8E0D8', '#7AA090']
    ],
    alloc(s, w, h) {
      build(s, w, h);
      if (!mesh) mesh = new Mesh(40000);
      if (s.trail) s.trail.dispose();
      s.trail = new Trail(w, h);
    },
    resize(s, w, h) {
      if (s.planets && s.w) {
        const k = Math.min(w / s.w, h / s.h);
        for (const p of s.planets) {
          p.a *= k; p.r *= k;
          for (const m of p.moons) { m.d *= k; m.r *= k; }
          if (p.ring) { p.ring.r0 *= k; p.ring.r1 *= k; }
        }
        for (const b of s.belt) { b.a *= k; b.z *= k; }
        s.starR *= k; s.cx = w * 0.5; s.cy = h * 0.5; s.sc = h / 720; s.w = w; s.h = h;
      } else build(s, w, h);
      if (s.trail) s.trail.dispose();
      s.trail = new Trail(w, h);
    },
    reseed(s, manual) { if (manual) build(s, App.rw, App.rh); },
    demo(s) { s.age = 40; s.alpha = 1; },
    tick(s, dt) {
      s.t += dt; s.age += dt;
      /* fade in, live, fade out, regenerate */
      if (s.age < FADE) s.alpha = s.age / FADE;
      else if (s.age > LIFE - FADE) s.alpha = clamp((LIFE - s.age) / FADE, 0, 1);
      else s.alpha = 1;
      if (s.age > LIFE) { const t = s.t; build(s, App.rw, App.rh); s.t = t; }
      /* moons and inner planets advance quickly; everything is a function of s.t */
    },
    proj(s, x, y) { return [s.cx + x, s.cy + y * TILT]; },
    draw(s, target) {
      const sc = s.sc, T = s.t, A = s.alpha;
      const orbitC = palv(s, 3), c1 = palv(s, 4), c2 = palv(s, 5), c3 = palv(s, 6), beltC = palv(s, 7), starC = palv(s, 2);
      const bg = palv(s, 0);

      /* positions this frame */
      const pos = s.planets.map(p => {
        const E = kepler((T / p.T) * TAU + p.M0, p.e);
        const [x, y] = orbitPos(p, E);
        return this.proj(s, x, y);
      });

      /* tails: planets and belt splatted into the trail, additive */
      mesh.begin();
      s.planets.forEach((p, i) => {
        const [x, y] = pos[i];
        const c = p.tint < 0.33 ? c1 : (p.tint < 0.66 ? c2 : c3);
        mesh.disc(x, y, p.r * 0.9, c, 0.10 * A, 8);
      });
      s.trail.begin(0.972);
      mesh.draw(gl.TRIANGLES);
      s.trail.end();

      bindRT(target); gl.disable(gl.BLEND);
      const pb = progOf(s); pb.use(); setCommon(pb, s);
      pb.tex('uTrail', s.trail.tex, 0);
      pb.set('uStar', s.cx, s.cy, s.starR, A);
      drawTri();

      mesh.begin();
      /* orbits: faint, brighter near the planet */
      s.planets.forEach((p, i) => {
        const N = 120;
        let prev = null;
        for (let k = 0; k <= N; k++) {
          const E = k / N * TAU;
          const [x, y] = orbitPos(p, E);
          const q = this.proj(s, x, y);
          if (prev) {
            const behind = q[1] > s.cy ? 0.55 : 1.0;
            mesh.stroke(prev[0], prev[1], q[0], q[1], 0.9 * sc, orbitC, 0.16 * A * behind);
          }
          prev = q;
        }
      });
      /* belt */
      for (const b of s.belt) {
        const E = kepler((T / b.T) * TAU + b.M0, b.e);
        const [x, y] = orbitPos(b, E);
        const q = this.proj(s, x, y);
        const al = (0.25 + 0.5 * b.b) * A;
        const r = 0.8 * sc;
        mesh.tri(q[0] - r, q[1] + b.z * TILT - r, q[0] + r, q[1] + b.z * TILT - r, q[0], q[1] + b.z * TILT + r, beltC, al);
      }
      blendOver(); mesh.draw(gl.TRIANGLES);

      /* planets, back to front */
      const order = s.planets.map((p, i) => i).sort((i, j) => pos[j][1] - pos[i][1]);
      mesh.begin();
      for (const i of order) {
        const p = s.planets[i], [x, y] = pos[i];
        const base = p.tint < 0.33 ? c1 : (p.tint < 0.66 ? c2 : c3);
        /* occluded by the star when behind it */
        const d = Math.hypot(x - s.cx, y - s.cy);
        let al = A;
        if (y > s.cy) al *= smoothstep(s.starR * 0.8, s.starR * 1.4, d);
        if (al < 0.01) continue;
        const lx = (s.cx - x) / (d || 1), ly = (s.cy - y) / (d || 1);   // toward the star
        /* ring behind */
        if (p.ring) this.ring(s, p, x, y, base, al, true);
        const dark = [bg[0] * 1.6, bg[1] * 1.6, bg[2] * 1.6];
        mesh.disc(x, y, p.r, dark, al, 18);
        /* lit hemisphere: a disc offset toward the star, clipped by the body disc via overdraw */
        const lit = base.map((v, k) => mix(v, starC[k], 0.15));
        const litR = p.r * 0.82;
        mesh.disc(x + lx * p.r * 0.30, y + ly * p.r * 0.30, litR, lit, al * 0.95, 18);
        mesh.disc(x + lx * p.r * 0.48, y + ly * p.r * 0.48, p.r * 0.42, starC, al * 0.16, 10);
        /* bands on gas giants */
        if (p.gas) {
          for (let b = -2; b <= 2; b++) {
            const yy = y + b * p.r * 0.32;
            const half = Math.sqrt(Math.max(0, p.r * p.r - (b * p.r * 0.32) ** 2)) * 0.96;
            mesh.stroke(x - half, yy, x + half, yy, p.r * 0.10, dark, al * 0.25);
          }
        }
        if (p.ring) this.ring(s, p, x, y, base, al, false);
        /* moons */
        for (const m of p.moons) {
          const ang = (T / m.T) * TAU + m.M0;
          const mx = x + Math.cos(ang) * m.d, my = y + Math.sin(ang) * m.d * TILT;
          const front = Math.sin(ang) < 0;
          const mal = (front || Math.hypot(mx - x, my - y) > p.r * 1.05) ? al : 0;
          if (mal > 0) mesh.disc(mx, my, m.r, base.map(v => v * 0.9), mal * 0.9, 8);
        }
      }
      blendOver(); mesh.draw(gl.TRIANGLES); gl.disable(gl.BLEND);
    },
    ring(s, p, x, y, base, al, back) {
      const rg = p.ring, c = base.map(v => v * 0.85);
      const N = 64;
      for (let k = 0; k < N; k++) {
        const a0 = k / N * TAU, a1 = (k + 1) / N * TAU;
        const m = (a0 + a1) * 0.5;
        const isBack = Math.sin(m) > 0;
        if (isBack !== back) continue;
        for (let j = 0; j < 3; j++) {
          const rr = mix(rg.r0, rg.r1, (j + 0.5) / 3);
          const w = (rg.r1 - rg.r0) / 3 * 0.8;
          const ca = Math.cos(rg.ang), sa = Math.sin(rg.ang);
          const px0 = Math.cos(a0) * rr, py0 = Math.sin(a0) * rr * rg.tilt;
          const px1 = Math.cos(a1) * rr, py1 = Math.sin(a1) * rr * rg.tilt;
          mesh.stroke(x + px0 * ca - py0 * sa, y + px0 * sa + py0 * ca, x + px1 * ca - py1 * sa, y + px1 * sa + py1 * ca, w, c, al * (0.22 + 0.12 * (j === 1 ? 1 : 0)));
        }
      }
    },
    frag: frag(`
uniform sampler2D uTrail;
uniform vec4 uStar;
#define C_BG   uPal[0]
#define C_BG2  uPal[1]
#define C_STAR uPal[2]
void main(){
  vec2 uv = UVf(); vec2 px = PX(); vec2 p = NP();
  vec3 col = mix(C_BG2, C_BG, smoothstep(0.0, 1.5, length(p*vec2(0.8,1.0))));
  col *= 0.8 + 0.4*fbm2(p*1.1 + 21.0, 3);
  /* fixed starfield */
  vec2 g = floor(px / 3.0);
  float h = hash21(g + uSeed);
  float star = step(0.9965, h) * (0.3 + 0.7*hash21(g*1.7 + 3.0));
  star *= 0.7 + 0.3*sin(uClocks2.x*3.0 + h*40.0);
  col += vec3(star) * 0.35;
  /* the star */
  float d = length(px - uStar.xy) / uStar.z;
  float pulse = 1.0 + 0.04*sin(uClocks2.z*0.8);
  float core = exp(-d*d*2.2*pulse);
  float corona = exp(-d*0.55) * 0.45 + exp(-d*0.18)*0.10;
  col += C_STAR * (core*2.2 + corona) * uStar.w;
  /* ecliptic glow: a faint disc of dust in the plane */
  vec2 e = (px - uStar.xy) / vec2(1.0, 0.42);
  float ed = length(e) / (uStar.z*22.0);
  col += C_STAR * 0.020 * exp(-ed*ed*2.0) * uStar.w;
  col += texture(uTrail, uv).rgb;
  fragColor = vec4(max(col, 0.0), 1.0);
}
`)
  });
})();
