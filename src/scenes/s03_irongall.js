/* ---------------- 03 · IRON GALL ----------------
   Semi-Lagrangian fluid. Ink blooms, ages, oxidises, and stains the glass. */
(function () {
  const SIMH = 288;
  const HDR = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
uniform vec2 uTexel;
uniform vec2 uSim;
out vec4 outColor;
float hash21(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec4 sanitize(vec4 v, vec4 fb, float lim){ bvec4 ok = lessThan(abs(v), vec4(lim)); return mix(fb, v, vec4(ok)); }
`;

  const P_VEL = new Program(HDR + `
uniform sampler2D uVel;
uniform float uDt, uDiss, uVort;
vec2 V(vec2 uv){ return texture(uVel, clamp(uv, uTexel*0.5, 1.0-uTexel*0.5)).xy; }
float curlAt(vec2 uv){
  return (V(uv+vec2(0.0,uTexel.y)).x - V(uv-vec2(0.0,uTexel.y)).x)
       - (V(uv+vec2(uTexel.x,0.0)).y - V(uv-vec2(uTexel.x,0.0)).y);
}
void main(){
  vec2 uv = vUv;
  vec2 v0 = V(uv);
  vec2 back = uv - v0 * uTexel * uDt;
  vec2 v = V(back) * uDiss;
  float c  = curlAt(uv);
  float cl = abs(curlAt(uv - vec2(uTexel.x,0.0)));
  float cr = abs(curlAt(uv + vec2(uTexel.x,0.0)));
  float cb = abs(curlAt(uv - vec2(0.0,uTexel.y)));
  float ct = abs(curlAt(uv + vec2(0.0,uTexel.y)));
  vec2 g = vec2(cr-cl, ct-cb) * 0.5;
  g /= max(length(g), 1e-4);
  v += vec2(g.y, -g.x) * c * uVort * uDt;
  vec2 e = smoothstep(vec2(0.0), uTexel*3.0, uv) * smoothstep(vec2(0.0), uTexel*3.0, 1.0-uv);
  v *= min(e.x, e.y);
  outColor = sanitize(vec4(v, 0.0, 1.0), vec4(0.0,0.0,0.0,1.0), 400.0);
}`, null, 'fluidVel');

  const P_DIV = new Program(HDR + `
uniform sampler2D uVel;
void main(){
  vec2 uv = vUv;
  float l = texture(uVel, uv - vec2(uTexel.x,0.0)).x;
  float r = texture(uVel, uv + vec2(uTexel.x,0.0)).x;
  float b = texture(uVel, uv - vec2(0.0,uTexel.y)).y;
  float t = texture(uVel, uv + vec2(0.0,uTexel.y)).y;
  outColor = vec4(0.5*(r-l + t-b), 0.0, 0.0, 1.0);
}`, null, 'fluidDiv');

  const P_JAC = new Program(HDR + `
uniform sampler2D uP, uDiv;
void main(){
  vec2 uv = vUv;
  float l = texture(uP, uv - vec2(uTexel.x,0.0)).x;
  float r = texture(uP, uv + vec2(uTexel.x,0.0)).x;
  float b = texture(uP, uv - vec2(0.0,uTexel.y)).x;
  float t = texture(uP, uv + vec2(0.0,uTexel.y)).x;
  float d = texture(uDiv, uv).x;
  outColor = vec4((l+r+b+t - d) * 0.25, 0.0, 0.0, 1.0);
}`, null, 'fluidJacobi');

  const P_SUB = new Program(HDR + `
uniform sampler2D uP, uVel;
void main(){
  vec2 uv = vUv;
  float l = texture(uP, uv - vec2(uTexel.x,0.0)).x;
  float r = texture(uP, uv + vec2(uTexel.x,0.0)).x;
  float b = texture(uP, uv - vec2(0.0,uTexel.y)).x;
  float t = texture(uP, uv + vec2(0.0,uTexel.y)).x;
  vec2 v = texture(uVel, uv).xy - vec2(r-l, t-b) * 0.5;
  outColor = sanitize(vec4(v, 0.0, 1.0), vec4(0.0,0.0,0.0,1.0), 400.0);
}`, null, 'fluidSub');

  const P_INJ = new Program(HDR + `
uniform sampler2D uSrc;
uniform vec2  uPos, uDir;
uniform float uRad, uAmt, uIsDye;
void main(){
  vec2 uv = vUv;
  vec4 s = texture(uSrc, uv);
  vec2 d = (uv - uPos) * vec2(uSim.x/uSim.y, 1.0);
  float f = exp(-dot(d,d)/(uRad*uRad));
  if(uIsDye > 0.5){
    s.x += f * uAmt;
    s.y = mix(s.y, 0.0, clamp(f*uAmt*2.4, 0.0, 1.0));
  } else {
    s.xy += uDir * f * uAmt;
  }
  outColor = s;
}`, null, 'fluidInject');

  const P_DYE = new Program(HDR + `
uniform sampler2D uVel, uDye;
uniform float uDt, uDiss, uAge;
void main(){
  vec2 uv = vUv;
  vec2 v = texture(uVel, uv).xy;
  vec2 back = clamp(uv - v * uTexel * uDt, uTexel*0.5, 1.0-uTexel*0.5);
  vec4 d = texture(uDye, back);
  d.x *= uDiss;
  d.y = min(d.y + uAge * step(0.004, d.x), 1.0);
  d.z = min(d.z * 0.999985 + d.x * 5.0e-6, 0.60);
  d.x = max(d.x - 3.0e-6, 0.0);
  outColor = sanitize(vec4(d.xyz, 1.0), vec4(0.0), 40.0);
}`, null, 'fluidDye');

  scene({
    id: 'irongall',
    name: 'Iron Gall',
    medium: 'semi-lagrangian · vorticity 0.28 · age grading',
    chrome: '#c9bfa6',
    dwell: 230,
    post: {
      exposure: 1.30, bloom: 0.05, bloomThreshold: 0.85, bloomKnee: 0.6,
      vignette: 0.44, ca: 1.1, grain: 0.013, grainSize: 1.7
    },
    themes: [
      ['Iron Gall', '#0B1220', '#16223C', '#243458', '#4E6296', '#7A4A2C', '#C9BFA6'],
      ['Verdant', '#0A1410', '#12291F', '#1D4030', '#4E9673', '#96803A', '#D8E2C0'],
      ['Oxblood', '#140A0C', '#2C1218', '#58242C', '#96424E', '#A66A2C', '#E2C9A6'],
      ['Sepia', '#14100A', '#2C2212', '#584324', '#96804E', '#7A5A2C', '#E8D9B0'],
      ['Abyss', '#060A0E', '#0E1E24', '#1E3A44', '#4E8A96', '#5A8A8F', '#C9E2E2']
    ],
    st: { next: 1.0, t: 0, pos: [0.5, 0.5], dir: [0, 0], pulse: 0, warm: 3 },
    alloc(s, w, h) {
      const sh = SIMH, sw = Math.max(96, Math.round(SIMH * (w / h)));
      s.vel = new PingPong(sw, sh, { internalFormat: gl.RG16F, filter: gl.LINEAR });
      s.dye = new PingPong(sw, sh, { internalFormat: gl.RGBA16F, filter: gl.LINEAR });
      s.prs = new PingPong(sw, sh, { internalFormat: gl.R16F, filter: gl.NEAREST });
      s.div = makeRT(sw, sh, { internalFormat: gl.R16F, filter: gl.NEAREST });
      s.sw = sw; s.sh = sh;
      [s.vel, s.dye, s.prs].forEach(pp => pp.rt.forEach(rt => {
        bindRT(rt); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      }));
      bindRT(s.div); gl.clear(gl.COLOR_BUFFER_BIT);
    },
    resize(s, w, h) {
      const nw = Math.max(96, Math.round(SIMH * (w / h)));
      if (nw === s.sw) return;
      s.vel.dispose(); s.dye.dispose(); s.prs.dispose(); s.div.dispose();
      this.alloc(s, w, h);
    },
    reseed(s, manual) { if (manual) { s.st.next = 0.5; s.st.t = 0; s.st.warm = 3; } },
    sim(s, dt) {
      const st = s.st;
      const tx = [1 / s.sw, 1 / s.sh];
      const setT = p => { p.set('uTexel', tx[0], tx[1]); p.set('uSim', s.sw, s.sh); };

      st.t += dt;
      if (st.t > st.next) {
        st.t = 0;
        st.next = st.warm > 0 ? (7 + Math.random() * 6) : (26 + Math.random() * 20);
        if (st.warm > 0) st.warm--;
        const a = Math.random() * TAU;
        st.pos = [0.26 + Math.random() * 0.48, 0.30 + Math.random() * 0.42];
        st.dir = [Math.cos(a) * 0.55, Math.sin(a) * 0.55 - 0.35];
        st.pulse = 1.5;
      }
      bindRT(s.vel.write); gl.disable(gl.BLEND);
      P_VEL.use(); setT(P_VEL);
      P_VEL.tex('uVel', s.vel.read.tex, 0);
      P_VEL.set('uDt', 1.0).set('uDiss', 0.9975).set('uVort', 0.28);
      drawTri(); s.vel.swap();

      if (st.pulse > 0) {
        bindRT(s.vel.write);
        P_INJ.use(); setT(P_INJ);
        P_INJ.tex('uSrc', s.vel.read.tex, 0);
        P_INJ.set('uPos', st.pos[0], st.pos[1]);
        P_INJ.set('uDir', st.dir[0], st.dir[1]);
        P_INJ.set('uRad', 0.055).set('uAmt', 9.0 * Math.min(dt, 0.05) * 60.0 * 0.28).set('uIsDye', 0);
        drawTri(); s.vel.swap();
      }

      bindRT(s.div);
      P_DIV.use(); setT(P_DIV); P_DIV.tex('uVel', s.vel.read.tex, 0); drawTri();
      for (let i = 0; i < 14; i++) {
        bindRT(s.prs.write);
        P_JAC.use(); setT(P_JAC);
        P_JAC.tex('uP', s.prs.read.tex, 0);
        P_JAC.tex('uDiv', s.div.tex, 1);
        drawTri(); s.prs.swap();
      }
      bindRT(s.vel.write);
      P_SUB.use(); setT(P_SUB);
      P_SUB.tex('uP', s.prs.read.tex, 0);
      P_SUB.tex('uVel', s.vel.read.tex, 1);
      drawTri(); s.vel.swap();

      bindRT(s.dye.write);
      P_DYE.use(); setT(P_DYE);
      P_DYE.tex('uVel', s.vel.read.tex, 0);
      P_DYE.tex('uDye', s.dye.read.tex, 1);
      P_DYE.set('uDt', 1.0).set('uDiss', 0.99928).set('uAge', 2.35e-4);
      drawTri(); s.dye.swap();

      if (st.pulse > 0) {
        bindRT(s.dye.write);
        P_INJ.use(); setT(P_INJ);
        P_INJ.tex('uSrc', s.dye.read.tex, 0);
        P_INJ.set('uPos', st.pos[0], st.pos[1]);
        P_INJ.set('uDir', 0, 0);
        P_INJ.set('uRad', 0.030).set('uAmt', 0.0235 * s._density).set('uIsDye', 1);
        drawTri(); s.dye.swap();
        st.pulse -= dt;
      }
    },
    uni(p, s) {
      p.tex('uDye', s.dye.read.tex, 0);
      p.tex('uVel', s.vel.read.tex, 1);
      p.set('uSim', s.sw, s.sh);
    },
    frag: frag(`
uniform sampler2D uDye, uVel;
uniform vec2 uSim;

#define C_WATER uPal[0]
#define C_DEEP  uPal[1]
#define C_INK   uPal[2]
#define C_EDGE  uPal[3]
#define C_RUST  uPal[4]
#define C_PARCH uPal[5]

vec3 smoothDye(vec2 uv){
  vec2 p = uv*uSim - 0.5;
  vec2 i = floor(p), f = p - i;
  f = f*f*(3.0-2.0*f);
  return texture(uDye, (i + 0.5 + f)/uSim).xyz;
}

void main(){
  vec2 uv = UVf();
  vec3 d0 = smoothDye(uv);
  vec2 e = 1.6/uSim;
  float gx = smoothDye(uv+vec2(e.x,0)).x - smoothDye(uv-vec2(e.x,0)).x;
  float gy = smoothDye(uv+vec2(0,e.y)).x - smoothDye(uv-vec2(0,e.y)).x;
  vec2 grad = vec2(gx, gy);

  vec3 d = smoothDye(uv - grad*0.030);
  float ink = clamp(d.x*7.5, 0.0, 1.5);
  float age = clamp(d.y, 0.0, 1.0);
  float res = d.z;

  float wob = fbm3(vec3(uv*3.4, uTime*0.035), 3);
  vec3 col = mix(C_WATER, C_DEEP, 0.5 + 0.5*wob) * (0.58 + 0.34*wob);
  col += C_DEEP * 0.22 * smoothstep(1.0, 0.0, uv.y);

  col = mix(col, mix(C_INK, C_RUST, 0.62), clamp(res*0.9, 0.0, 0.34));

  vec3 body = ramp3(C_EDGE, C_INK, C_RUST, age);
  float thin = smoothstep(0.55, 0.06, ink) * smoothstep(0.03, 0.16, ink);
  body = mix(body, C_PARCH, thin*0.14*(0.3+0.7*age));

  float a = clamp(ink*0.82, 0.0, 1.0);
  col = mix(col, body, a);

  float lit = clamp(dot(normalize(vec3(grad*130.0, 1.0)), normalize(vec3(-0.55,0.62,0.55))), 0.0, 1.0);
  col += mix(C_EDGE, C_PARCH, age*0.55) * pow(lit, 3.5) * a * 0.40;

  fragColor = vec4(max(col,0.0), 1.0);
}
`)
  });
})();
