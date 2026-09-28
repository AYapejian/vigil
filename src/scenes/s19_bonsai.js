/* ---------------- 19 · BONSAI ----------------
   A tree grown from a stochastic L-system, one segment at a time,
   over the better part of a minute. It leafs, holds, drops its leaves
   in a wind (each leaf a particle), stands bare, and is forgotten;
   then another tree, never the same, grows in its place. */
(function () {
  let mesh = null;

  const PH = { grow: 55, leaf: 15, hold: 35, autumn: 40, bare: 25, fade: 6 };

  function grow(s, w, h) {
    const R = rng(Math.random());
    const sc = h / 720;
    const segs = [], leaves = [];
    const rootX = w * (0.40 + R() * 0.20), rootY = h * 0.16;
    const maxDepth = 8;
    const style = R();                      // 0..1: upright ... cascade
    let order = 0;

    function pad(x, y, birth) {
      const nl = 5 + Math.floor(R() * 6);
      for (let i = 0; i < nl; i++) {
        leaves.push({
          x: x + (R() - 0.5) * 30 * sc, y: y + (R() - 0.5) * 12 * sc,
          r: (3.4 + R() * 3.4) * sc, birth: birth + R() * 3, tint: R(), a: R() * TAU,
          fall: R(), fx: 0, fy: 0, vx: 0, vy: 0, spin: (R() - 0.5) * 6, life: 1
        });
      }
    }

    function branch(x, y, ang, len, wid, depth, birth) {
      if (depth > maxDepth || len < 4 * sc) return;
      const dur = 2.2 + len / (28 * sc);
      const kink = (R() - 0.5) * (depth < 2 ? 0.25 : 0.5);
      const a = ang + kink;
      const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
      segs.push({ x0: x, y0: y, x1, y1, w0: wid, w1: wid * 0.70, birth, dur, depth, order: order++ });
      const end = birth + dur;
      const tip = depth >= maxDepth - 1 || len * 0.72 < 4 * sc;
      if (depth >= 4 && (tip || R() < 0.6)) pad(x1, y1, end);
      if (tip) return;
      /* children: usually two, sometimes three, sometimes one (pruned) */
      let nb = 2;
      const rr = R();
      if (depth >= 2 && rr < 0.18) nb = 1; else if (depth >= 1 && rr > 0.80) nb = 3;
      const spread = 0.55 + R() * 0.45;
      for (let i = 0; i < nb; i++) {
        const side = nb === 1 ? (R() < 0.5 ? -0.6 : 0.6) : (i / (nb - 1) - 0.5) * 2;
        let na = a + side * spread + (R() - 0.5) * 0.3;
        /* trained shape: branches are pulled toward the horizontal on their own side;
           cascade styles droop further */
        const horiz = Math.cos(na) >= 0 ? 0 : Math.PI;
        const pull = depth >= 2 ? 0.18 + 0.25 * style : 0.05;
        na += (horiz - na) * pull;
        if (style > 0.6 && depth >= 5) na -= 0.18 * Math.sign(Math.cos(na) || 1) * (Math.sin(na) > -0.3 ? 1 : 0);
        const nl = len * (0.62 + R() * 0.22) * (i === 0 && nb > 1 ? 1.08 : 0.92);
        const nw = wid * (0.52 + R() * 0.22);
        branch(x1, y1, na, nl, nw, depth + 1, end - dur * 0.25);
      }
    }

    /* trunk: two or three sections with an S-bend, side branches leaving at each bend */
    const lean = (R() - 0.5) * 0.6 * (1 + style);
    let tx = rootX, ty = rootY, ta = Math.PI / 2 + lean, tw = 20 * sc, tlen = (110 + R() * 40) * sc;
    let tb = 0;
    const nTrunk = 2 + Math.floor(R() * 2);
    for (let k = 0; k < nTrunk; k++) {
      const dur = 2.2 + tlen / (28 * sc);
      const bend = (k % 2 === 0 ? 1 : -1) * (0.25 + R() * 0.25) * (lean >= 0 ? 1 : -1);
      ta += bend;
      const x1 = tx + Math.cos(ta) * tlen, y1 = ty + Math.sin(ta) * tlen;
      segs.push({ x0: tx, y0: ty, x1, y1, w0: tw, w1: tw * 0.78, birth: tb, dur, depth: 0, order: order++ });
      const end = tb + dur;
      /* a primary branch leaves at the bend, on the outside of the curve */
      const bside = -Math.sign(bend) || 1;
      const ba = ta + bside * (0.9 + R() * 0.4);
      branch(x1, y1, ba, tlen * (0.75 + R() * 0.25), tw * 0.55, 1, end - dur * 0.2);
      tx = x1; ty = y1; tw *= 0.78; tlen *= 0.82; tb = end - dur * 0.3;
    }
    /* apex */
    branch(tx, ty, ta + (R() - 0.5) * 0.3, tlen * 0.9, tw * 0.8, 1, tb);

    /* normalise the schedule to fit the grow phase */
    let tmax = 0;
    for (const g of segs) tmax = Math.max(tmax, g.birth + g.dur);
    const k = (PH.grow - 4) / tmax;
    for (const g of segs) { g.birth *= k; g.dur *= k; }
    for (const l of leaves) { l.birth = l.birth * k + 1; }
    s.segs = segs; s.leaves = leaves;
    s.rootX = rootX; s.rootY = rootY; s.sc = sc;
    s.phase = 'grow'; s.t = 0; s.alpha = 1; s.wind = 0; s.w = w; s.h = h;
  }

  scene({
    id: 'bonsai',
    name: 'Bonsai',
    medium: 'stochastic l-system · grows · leafs · drops its leaves',
    chrome: '#e8d8c0',
    dwell: 300,
    post: {
      exposure: 1.0, bloom: 0.06, bloomThreshold: 0.8, bloomKnee: 0.6,
      vignette: 0.44, ca: 0.3, grain: 0.022, grainSize: 1.9
    },
    themes: [
      ['Sumi', '#CFC8B8', '#BCB4A2', '#2A2622', '#4A443C', '#4A6A48', '#8AA060', '#F4F0E8'],
      ['Sakura', '#D8CAC6', '#C8B8B4', '#3A2C2A', '#5A4844', '#E8A8B8', '#F8D0D8', '#FFF6F0'],
      ['Autumn', '#CEC2AC', '#BEB098', '#3A2A20', '#5A4430', '#C86A30', '#E8A840', '#F8F0E0'],
      ['Moonlit', '#101420', '#0C1018', '#3A3E48', '#5A6070', '#4A6A80', '#7AA0B8', '#E8F0FF'],
      ['Gilt', '#141008', '#1C160C', '#5A4A30', '#8A7040', '#C8A040', '#F0D070', '#FFF0C0']
    ],
    alloc(s, w, h) { grow(s, w, h); if (!mesh) mesh = new Mesh(120000); },
    resize(s, w, h) {
      if (!s.segs || !s.w) { grow(s, w, h); return; }
      const kx = w / s.w, ky = h / s.h;
      for (const g of s.segs) { g.x0 *= kx; g.x1 *= kx; g.y0 *= ky; g.y1 *= ky; g.w0 *= ky; g.w1 *= ky; }
      for (const l of s.leaves) { l.x *= kx; l.y *= ky; l.r *= ky; if (l.fx) { l.fx *= kx; l.fy *= ky; } l.vx *= kx; l.vy *= ky; }
      s.rootX *= kx; s.rootY = h * 0.16; s.sc = h / 720; s.w = w; s.h = h;
    },
    reseed(s, manual) { if (manual) grow(s, App.rw, App.rh); },
    demo(s) { s.phase = 'hold'; s.t = 3; },
    tick(s, dt) {
      s.t += dt;
      const sc = s.sc;
      /* wind: a slow base with gusts */
      s.wind = 0.5 * Math.sin(App.simTime * 0.37) + 0.35 * Math.sin(App.simTime * 1.13 + 1) + 0.25 * Math.sin(App.simTime * 2.7);
      switch (s.phase) {
        case 'grow': if (s.t > PH.grow) { s.phase = 'leaf'; s.t = 0; } break;
        case 'leaf': if (s.t > PH.leaf) { s.phase = 'hold'; s.t = 0; } break;
        case 'hold': if (s.t > PH.hold) { s.phase = 'autumn'; s.t = 0; for (const l of s.leaves) l.fall = l.fall * 0.85; } break;
        case 'autumn': if (s.t > PH.autumn) { s.phase = 'bare'; s.t = 0; } break;
        case 'bare': if (s.t > PH.bare) { s.phase = 'fade'; s.t = 0; } break;
        case 'fade': if (s.t > PH.fade) { grow(s, App.rw, App.rh); } break;
      }
      s.alpha = s.phase === 'fade' ? 1 - s.t / PH.fade : 1;

      if (s.phase === 'autumn' || s.phase === 'bare') {
        const T = s.t, g = -180 * sc, floor = s.rootY - 6 * sc;
        for (const l of s.leaves) {
          if (s.phase === 'autumn' && T < l.fall * (PH.autumn - 8)) continue;    // still on the tree
          if (l.life <= 0) continue;
          if (l.vx === 0 && l.vy === 0 && l.fx === 0) { l.fx = l.x; l.fy = l.y; l.vx = (Math.random() - 0.5) * 20 * sc; l.vy = 0; }
          if (l.fy > floor) {
            /* fluttering descent: drag, wind, a side-to-side rock */
            l.vy += g * dt; l.vy *= Math.exp(-dt * 3.2);
            l.vx += (s.wind * 70 * sc + Math.sin(App.simTime * 5.0 + l.a * 7) * 40 * sc - l.vx) * dt * 2.0;
            l.fx += l.vx * dt; l.fy += l.vy * dt; l.a += l.spin * dt;
            if (l.fy <= floor) { l.fy = floor; l.vx = 0; l.vy = 0; }
          } else {
            l.life -= dt / 30;                                                    // leaves on the ground fade away
          }
        }
      }
    },
    draw(s, target) {
      bindRT(target); gl.disable(gl.BLEND);
      const pb = progOf(s); pb.use(); setCommon(pb, s); drawTri();

      const sc = s.sc, T = s.t, A = s.alpha;
      const bark = palv(s, 2), barkLit = palv(s, 3), leaf = palv(s, 4), leaf2 = palv(s, 5);
      const wind = s.wind;
      mesh.begin();
      /* sway: shear every point by height above root */
      const shear = (y) => wind * 0.03 * (y - s.rootY) * (App.reduced ? 0.3 : 1);
      const growT = s.phase === 'grow' ? T : 1e9;
      /* a shallow pot under the root, and a little soil */
      {
        const pw = 92 * sc, pb = 78 * sc, ph = 24 * sc, rx = s.rootX, ry = s.rootY;
        const potC = [bark[0] * 0.8, bark[1] * 0.8, bark[2] * 0.8], potL = barkLit.map((v, i) => mix(potC[i], v, 0.35));
        mesh.tri(rx - pw, ry, rx + pw, ry, rx + pb, ry - ph, potC, A);
        mesh.tri(rx - pw, ry, rx + pb, ry - ph, rx - pb, ry - ph, potC, A);
        mesh.stroke(rx - pw - 3 * sc, ry + 2 * sc, rx + pw + 3 * sc, ry + 2 * sc, 5 * sc, potL, A);   // rim
        mesh.stroke(rx - pb, ry - ph, rx + pb, ry - ph, 2.5 * sc, potC.map(v => v * 0.6), A);      // foot
        mesh.stroke(rx - pw + 8 * sc, ry + 5 * sc, rx + pw - 8 * sc, ry + 5 * sc, 4 * sc, [bark[0] * 0.5, bark[1] * 0.5, bark[2] * 0.5], A * 0.8); // soil
        /* root flare */
        mesh.disc(rx, ry + 4 * sc, 12 * sc, bark, A, 8);
      }
      for (const g of s.segs) {
        const k = clamp((growT - g.birth) / g.dur, 0, 1);
        if (k <= 0) continue;
        const ks = k * k * (3 - 2 * k);
        const x1 = g.x0 + (g.x1 - g.x0) * ks, y1 = g.y0 + (g.y1 - g.y0) * ks;
        const sh0 = shear(g.y0), sh1 = shear(y1);
        const w0 = g.w0 * (0.35 + 0.65 * ks), w1 = g.w1 * ks;
        /* tapered: two strokes of different width faked by a thin overdraw */
        const shade = 0.85 + 0.25 * Math.abs(Math.cos(Math.atan2(y1 - g.y0, x1 - g.x0)));
        const c0 = [bark[0] * shade, bark[1] * shade, bark[2] * shade];
        const c1 = barkLit.map((v, i) => mix(c0[i], v, 0.25));
        mesh.stroke(g.x0 + sh0, g.y0, x1 + sh1, y1, w0, c0, A, c1, A);
        if (w0 > 5 * sc) mesh.stroke(g.x0 + sh0 - w0 * 0.22, g.y0, x1 + sh1 - w1 * 0.22, y1, w0 * 0.35, barkLit, A * 0.35);
        /* round the joint */
        if (g.depth > 0 && w0 > 2.5 * sc) mesh.disc(g.x0 + sh0, g.y0, w0 * 0.5, c0, A, 5);
      }
      /* leaves */
      const showLeaves = s.phase === 'leaf' || s.phase === 'hold' || s.phase === 'autumn' || s.phase === 'bare' || s.phase === 'fade';
      if (showLeaves || s.phase === 'grow') {
        for (const l of s.leaves) {
          let k;
          if (s.phase === 'grow') k = clamp((T - l.birth) / 3, 0, 1);
          else if (s.phase === 'leaf') k = clamp((T + PH.grow - l.birth) / 3, 0, 1);
          else k = 1;
          if (k <= 0) continue;
          const c = [mix(leaf[0], leaf2[0], l.tint), mix(leaf[1], leaf2[1], l.tint), mix(leaf[2], leaf2[2], l.tint)];
          let x = l.x + shear(l.y), y = l.y, r = l.r * k, al = A;
          if (s.phase === 'autumn' || s.phase === 'bare' || s.phase === 'fade') {
            if (l.fx !== 0) { x = l.fx; y = l.fy; al = A * clamp(l.life, 0, 1); }
            else if (s.phase !== 'autumn') continue;
            /* turning colour before the fall */
            const turn = s.phase === 'autumn' ? clamp(T / 10, 0, 1) : 1;
            c[0] = mix(c[0], leaf2[0] * 1.1, turn * 0.6); c[1] = mix(c[1], leaf2[1] * 0.8, turn * 0.6); c[2] = mix(c[2], leaf2[2] * 0.6, turn * 0.6);
          }
          if (al <= 0.01) continue;
          /* leaf: a small lens shape from two triangles */
          const ca = Math.cos(l.a), sa = Math.sin(l.a);
          const ex = ca * r * 1.6, ey = sa * r * 1.6, nx = -sa * r * 0.7, ny = ca * r * 0.7;
          mesh.tri(x - ex, y - ey, x + nx, y + ny, x + ex, y + ey, c, al * 0.92);
          mesh.tri(x - ex, y - ey, x + ex, y + ey, x - nx, y - ny, c.map(v => v * 0.85), al * 0.92);
        }
      }
      blendOver(); mesh.draw(gl.TRIANGLES); gl.disable(gl.BLEND);
    },
    frag: frag(`
#define C_PAPER  uPal[0]
#define C_PAPER2 uPal[1]
#define C_MOON   uPal[6]
void main(){
  vec2 p = NP(); vec2 uv = UVf();
  vec3 col = mix(C_PAPER2, C_PAPER, smoothstep(-0.2, 0.9, uv.y + 0.3*fbm2(p*1.2, 3)));
  /* paper fibre */
  col *= 0.94 + 0.09*fbm2(PX()*0.045, 4) + 0.03*fbm2(PX()*vec2(0.9, 0.02), 2);
  /* a pale disc high in the sheet — a sun or a moon depending on the theme */
  vec2 mp = vec2(0.55, 0.62);
  float md = length((p - mp) * vec2(1.0, 1.0));
  col = mix(col, C_MOON, 0.55*smoothstep(0.26, 0.20, md));
  col += C_MOON * 0.04 * exp(-md*md*4.0);
  /* ground: a single low wash */
  float gy = uv.y - 0.16;
  col = mix(col, col*0.86, smoothstep(0.02, -0.02, gy) * (0.6 + 0.3*fbm2(vec2(p.x*3.0, 0.0), 3)));
  col = mix(col, col*0.7, (1.0 - smoothstep(0.0, 0.05, abs(gy))) * 0.5);
  fragColor = vec4(col*0.64, 1.0);
}
`)
  });
})();
