/* ---------------- 17 · MARIONETTE ----------------
   A jointed figure on strings. Verlet ragdoll: fifteen joints, rigid
   bones, rope constraints to a control bar that sways, gusts that make
   it stir, a floor it can rest its feet on. */
(function () {
  let mesh = null;

  /* joint template, y up, in 720p pixels */
  const J = {
    head: [0, 0], neck: [0, -24], chest: [0, -52], pelvis: [0, -96],
    shL: [-22, -46], shR: [22, -46], elL: [-40, -82], elR: [40, -82], haL: [-46, -120], haR: [46, -120],
    hipL: [-13, -98], hipR: [13, -98], knL: [-15, -156], knR: [15, -156], ftL: [-17, -214], ftR: [17, -214]
  };
  const NAMES = Object.keys(J);
  const BONES = [
    ['head', 'neck', 9], ['neck', 'chest', 12], ['chest', 'pelvis', 13],
    ['neck', 'shL', 8], ['neck', 'shR', 8], ['chest', 'shL', 0], ['chest', 'shR', 0],
    ['shL', 'elL', 7], ['elL', 'haL', 6], ['shR', 'elR', 7], ['elR', 'haR', 6],
    ['pelvis', 'hipL', 0], ['pelvis', 'hipR', 0], ['hipL', 'hipR', 0],
    ['hipL', 'knL', 9], ['knL', 'ftL', 8], ['hipR', 'knR', 9], ['knR', 'ftR', 8],
    ['shL', 'shR', 0], ['neck', 'pelvis', 0], ['head', 'chest', 0]
  ];
  /* minimum-distance constraints so limbs do not fold through the body */
  const MINS = [['chest', 'knL', 70], ['chest', 'knR', 70], ['head', 'haL', 40], ['head', 'haR', 40],
    ['pelvis', 'ftL', 80], ['pelvis', 'ftR', 80], ['knL', 'knR', 14], ['elL', 'elR', 40]];
  const STRINGS = [['head', 0, 0, 130], ['haL', -80, 0, 175], ['haR', 80, 0, 175], ['knL', -34, -8, 262], ['knR', 34, -8, 262]];

  function makePuppet(cx, sc) {
    const P = {};
    for (const n of NAMES) {
      const x = cx + J[n][0] * sc, y = J[n][1] * sc;
      P[n] = { x, y, ox: x, oy: y };
    }
    return { P, cx, phase: Math.random() * TAU, pump: 0 };
  }

  function build(s, w, h) {
    const sc = (h / 720) * 1.7;
    s.sc = sc;
    const count = clamp(Math.round(s._density), 1, 3);
    s.pups = [];
    for (let i = 0; i < count; i++) {
      const cx = w * (count === 1 ? 0.52 : 0.5 + (i - (count - 1) / 2) * 0.30);
      const pup = makePuppet(cx, sc);
      const barY = h * 0.88;
      for (const n of NAMES) { pup.P[n].y += barY - 150 * sc; pup.P[n].oy = pup.P[n].y; }
      s.pups.push(pup);
    }
    s.floorY = h * 0.13; s.barY = h * 0.90; s.t = 0; s.acc = 0; s.gust = 0; s.gustT = 12; s.w = w; s.h = h;
  }

  function step(s, dt) {
    const sc = s.sc, g = -560 * sc;
    for (const pup of s.pups) {
      const P = pup.P, t = s.t + pup.phase;
      const swayX = 42 * sc * Math.sin(t * 0.42) + 16 * sc * Math.sin(t * 1.13);
      const bobY = 14 * sc * Math.sin(t * 0.31 + 1.0) - pup.pump * 60 * sc;
      const bx = pup.cx + swayX, by = s.barY + bobY;
      const gustX = s.gust * 900 * sc * Math.sin(t * 2.1);

      for (const n of NAMES) {
        const q = P[n];
        const vx = (q.x - q.ox) * 0.975, vy = (q.y - q.oy) * 0.975;
        q.ox = q.x; q.oy = q.y;
        q.x += vx + gustX * dt * dt;
        q.y += vy + g * dt * dt;
      }
      for (let it = 0; it < 6; it++) {
        for (const [a, b] of BONES) {
          const A = P[a], B = P[b];
          const rest = Math.hypot(J[a][0] - J[b][0], J[a][1] - J[b][1]) * sc;
          let dx = B.x - A.x, dy = B.y - A.y;
          const d = Math.hypot(dx, dy) || 1e-6;
          const k = (d - rest) / d * 0.5;
          dx *= k; dy *= k;
          A.x += dx; A.y += dy; B.x -= dx; B.y -= dy;
        }
        for (const [a, b, mn] of MINS) {
          const A = P[a], B = P[b], rest = mn * sc;
          let dx = B.x - A.x, dy = B.y - A.y;
          const d = Math.hypot(dx, dy) || 1e-6;
          if (d < rest) { const k = (d - rest) / d * 0.5; dx *= k; dy *= k; A.x += dx; A.y += dy; B.x -= dx; B.y -= dy; }
        }
        for (const [n, ox, oy, len] of STRINGS) {
          const q = P[n];
          const ax = bx + ox * sc, ay = by + oy * sc;
          let dx = q.x - ax, dy = q.y - ay;
          const d = Math.hypot(dx, dy) || 1e-6, L = len * sc;
          if (d > L) { const k = (d - L) / d; q.x -= dx * k; q.y -= dy * k; }
        }
        for (const n of NAMES) {
          const q = P[n];
          if (q.y < s.floorY) { q.y = s.floorY; q.x += (q.ox - q.x) * 0.5; }
        }
      }
      pup.bx = bx; pup.by = by;
    }
  }

  scene({
    id: 'marionette',
    name: 'Marionette',
    medium: 'verlet ragdoll · 16 joints · rope constraints',
    chrome: '#e8c9a0',
    dwell: 220,
    post: {
      exposure: 1.06, bloom: 0.10, bloomThreshold: 0.72, bloomKnee: 0.7,
      vignette: 0.50, ca: 0.4, grain: 0.015, grainSize: 1.6
    },
    themes: [
      ['Workshop', '#1E1710', '#241A12', '#B08050', '#E8C090', '#C8C0B0', '#E8B860'],
      ['Ghost', '#08090C', '#0C0E12', '#8A96A8', '#E0E8F0', '#788090', '#B0C0E0'],
      ['Stage', '#2A0C10', '#1A0808', '#C89A70', '#F0D0A8', '#E0D0C0', '#F0C060'],
      ['Blue Hour', '#10141E', '#0C1018', '#7A8AA8', '#C8D8F0', '#A0B0C8', '#E0C890'],
      ['Ink', '#0C0C0C', '#080808', '#B8B8B8', '#F0F0F0', '#909090', '#E0E0E0']
    ],
    alloc(s, w, h) { build(s, w, h); if (!mesh) mesh = new Mesh(6000); },
    resize(s, w, h) {
      if (!s.pups || !s.w) { build(s, w, h); return; }
      const kx = w / s.w, ky = h / s.h;
      for (const pup of s.pups) {
        pup.cx *= kx;
        for (const n of NAMES) { const q = pup.P[n]; q.x *= kx; q.ox *= kx; q.y *= ky; q.oy *= ky; }
      }
      s.sc = (h / 720) * 1.7; s.floorY = h * 0.13; s.barY = h * 0.90; s.w = w; s.h = h;
    },
    reseed(s, manual) { if (manual) build(s, App.rw, App.rh); },
    tick(s, dt) {
      s.t += dt;
      const want = clamp(Math.round(s._density), 1, 3);
      if (want !== s.pups.length) build(s, App.rw, App.rh);
      s.gustT -= dt;
      if (s.gustT <= 0) { s.gust = 0.5 + Math.random() * 0.8; s.gustT = 22 + Math.random() * 40; }
      s.gust *= Math.exp(-dt / 1.6);
      for (const pup of s.pups) {
        /* the puppeteer occasionally lifts, then lets the feet down to the floor */
        pup.pump = 0.5 + 0.5 * Math.sin(s.t * 0.09 + pup.phase * 3.0);
      }
      s.acc += Math.min(dt, 0.05);
      let k = 0;
      while (s.acc >= 1 / 60 && k < 4) { step(s, 1 / 60); s.acc -= 1 / 60; k++; }
    },
    draw(s, target) {
      bindRT(target); gl.disable(gl.BLEND);
      const pb = progOf(s); pb.use(); setCommon(pb, s); drawTri();

      const sc = s.sc;
      const wood = palv(s, 2), lit = palv(s, 3), str = palv(s, 4), shadow = palv(s, 1);
      mesh.begin();
      /* floor shadows */
      for (const pup of s.pups) {
        const P = pup.P;
        const cx = (P.ftL.x + P.ftR.x) * 0.5, lift = clamp((Math.min(P.ftL.y, P.ftR.y) - s.floorY) / (120 * sc), 0, 1);
        const rr = (34 + 26 * lift) * sc;
        for (let i = 0; i < 10; i++) {
          const a0 = i / 10 * TAU, a1 = (i + 1) / 10 * TAU;
          const al = 0.55 * (1 - lift * 0.7);
          mesh.vert(cx, s.floorY - 2 * sc, shadow[0] * 0.3, shadow[1] * 0.3, shadow[2] * 0.3, al, 0, rr);
          mesh.vert(cx + Math.cos(a0) * rr, s.floorY - 2 * sc + Math.sin(a0) * rr * 0.22, 0, 0, 0, al, 1, rr);
          mesh.vert(cx + Math.cos(a1) * rr, s.floorY - 2 * sc + Math.sin(a1) * rr * 0.22, 0, 0, 0, al, 1, rr);
        }
      }
      blendOver(); mesh.draw(gl.TRIANGLES);

      mesh.begin();
      for (const pup of s.pups) {
        const P = pup.P;
        /* control bar */
        mesh.stroke(pup.bx - 90 * sc, pup.by, pup.bx + 90 * sc, pup.by, 5 * sc, wood, 1);
        mesh.stroke(pup.bx, pup.by - 20 * sc, pup.bx, pup.by + 14 * sc, 4 * sc, wood, 1);
        /* strings */
        for (const [n, ox, oy] of STRINGS) {
          mesh.stroke(pup.bx + ox * sc, pup.by + oy * sc, P[n].x, P[n].y, 1.1 * sc, str, 0.55);
        }
        /* bones */
        for (const [a, b, w] of BONES) {
          if (!w) continue;
          const A = P[a], B = P[b];
          const shade = 0.7 + 0.3 * Math.abs((B.x - A.x) / (Math.hypot(B.x - A.x, B.y - A.y) || 1));
          const c = [wood[0] * shade, wood[1] * shade, wood[2] * shade];
          mesh.stroke(A.x, A.y, B.x, B.y, w * sc, c, 1, lit.map((v, i) => mix(c[i], v, 0.35)), 1);
        }
        /* joints and head */
        for (const n of NAMES) if (n !== 'head') mesh.disc(P[n].x, P[n].y, 4.2 * sc, lit, 1, 8);
        mesh.disc(P.head.x, P.head.y, 12 * sc, wood, 1, 14);
        mesh.disc(P.head.x - 3 * sc, P.head.y + 3 * sc, 7 * sc, lit, 0.55, 10);
      }
      mesh.draw(gl.TRIANGLES);
      gl.disable(gl.BLEND);
    },
    frag: frag(`
#define C_WALL  uPal[0]
#define C_FLOOR uPal[1]
#define C_LAMP  uPal[5]
void main(){
  vec2 p = NP();
  float floorY = -1.0 + 0.26;
  vec3 col = C_WALL * (0.55 + 0.45*smoothstep(-1.0, 1.2, p.y));
  col *= 0.82 + 0.30*fbm2(p*1.6 + 5.0, 3);
  /* lamp upper left */
  vec2 lp = vec2(-1.25, 1.05);
  col += C_LAMP * 0.20 * exp(-dot(p-lp, p-lp)*1.1);
  float fl = smoothstep(0.015, -0.02, p.y - floorY);
  vec3 fc = C_FLOOR * (0.9 + 0.35*fbm2(vec2(p.x*5.0, p.y*30.0), 3)) * (0.5 + 0.5*smoothstep(-1.0, floorY, p.y));
  fc += C_LAMP * 0.10 * exp(-pow((p.x+0.8), 2.0)*0.8);
  col = mix(col, fc, fl);
  fragColor = vec4(col, 1.0);
}
`)
  });
})();
