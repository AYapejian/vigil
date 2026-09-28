/* ---------------- 06 · FIRST FROST ----------------
   Gray-Scott reaction-diffusion, re-skinned as ice crystallising in
   from the edges of a cold pane, lit by a streetlamp below. */
(function () {
  const SIMH = 340;
  const HDR = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
uniform vec2 uTexel;
out vec4 outColor;
#define TAU 6.28318530718
float hash21(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float per(vec2 uv, float n1, float n2, float ph){
  return sin(TAU*n1*uv.x + ph) * sin(TAU*n2*uv.y + ph*1.37);
}
`;

  const P_SEED = new Program(HDR + `
uniform float uSeed;
void main(){
  vec2 uv = vUv;
  float n = hash21(floor(uv*46.0) + uSeed*13.0);
  float blob = step(0.965, n);
  float soft = smoothstep(0.9, 1.0, hash21(floor(uv*11.0) + uSeed*7.0));
  outColor = vec4(1.0 - 0.55*blob, 0.42*blob*soft + 0.10*blob, 0.0, 1.0);
}`, null, 'gsSeed');

  const P_STEP = new Program(HDR + `
uniform sampler2D uState;
uniform float uMood, uPhase, uSeedAmt, uFrame;
vec2 lap(vec2 uv){
  vec2 s = vec2(0.0);
  s += texture(uState, uv + vec2(-uTexel.x,-uTexel.y)).xy * 0.05;
  s += texture(uState, uv + vec2( 0.0,     -uTexel.y)).xy * 0.20;
  s += texture(uState, uv + vec2( uTexel.x,-uTexel.y)).xy * 0.05;
  s += texture(uState, uv + vec2(-uTexel.x, 0.0     )).xy * 0.20;
  s += texture(uState, uv)                             .xy * -1.0;
  s += texture(uState, uv + vec2( uTexel.x, 0.0     )).xy * 0.20;
  s += texture(uState, uv + vec2(-uTexel.x, uTexel.y)).xy * 0.05;
  s += texture(uState, uv + vec2( 0.0,      uTexel.y)).xy * 0.20;
  s += texture(uState, uv + vec2( uTexel.x, uTexel.y)).xy * 0.05;
  return s;
}
void main(){
  vec2 uv = vUv;
  vec2 st = texture(uState, uv).xy;
  float u = st.x, v = st.y;
  vec2 Lp = lap(uv);
  float g = 0.5 + 0.24*per(uv, 1.0, 1.0, uPhase)
                + 0.15*per(uv, 2.0, 1.0, uPhase*1.7 + 1.1)
                + 0.10*per(uv, 1.0, 3.0, uPhase*0.6 + 2.3);
  float band = clamp(0.5*g + 0.5*uMood, 0.02, 0.98);
  float perp = 0.32*per(uv, 3.0, 2.0, uPhase*2.1);
  float F = 0.0262 + 0.0298*band + 0.0026*perp;
  float K = 0.0556 + 0.0090*band + 0.0009*perp;
  float uvv = u*v*v;
  float du = 0.2097*Lp.x - uvv + F*(1.0 - u);
  float dv = 0.1050*Lp.y + uvv - (F + K)*v;
  u = clamp(u + du, 0.0, 1.0);
  v = clamp(v + dv, 0.0, 1.0);
  if(uSeedAmt > 0.0){
    float r = hash21(vUv*613.0 + uFrame);
    if(r > 1.0 - uSeedAmt) v = 0.42;
  }
  outColor = vec4(u, v, 0.0, 1.0);
}`, null, 'gsStep');

  scene({
    id: 'frost',
    name: 'First Frost',
    medium: 'gray-scott dendrites · cold glass · streetlamp',
    chrome: '#d8ecf8',
    dwell: 240,
    post: {
      exposure: 1.06, bloom: 0.14, bloomThreshold: 0.55, bloomKnee: 0.8,
      vignette: 0.42, ca: 0.5, grain: 0.012, grainSize: 1.5
    },
    themes: [
      ['Arctic', '#050A12', '#0C1624', '#7FA2C4', '#D8ECF8', '#FFFFFF', '#C9A26B'],
      ['Violet Pane', '#0A0714', '#161028', '#8A7FC4', '#E0D8F8', '#FFFFFF', '#C46B8A'],
      ['Teal Glass', '#04100F', '#0A211E', '#6BC4B4', '#D2F8EE', '#FFFFFF', '#C4A26B'],
      ['Silver', '#070708', '#111114', '#9AA0A8', '#E8ECF0', '#FFFFFF', '#8A8F98'],
      ['Candlelit', '#0D0906', '#1E140C', '#C4A67F', '#F8E8D2', '#FFFFFF', '#6BA2C9']
    ],
    st: { phase: 0, t: 0, warm: 0 },
    alloc(s, w, h) {
      const sh = SIMH, sw = Math.max(96, Math.round(SIMH * (w / h)));
      s.sw = sw; s.sh = sh;
      s.pp = new PingPong(sw, sh, { internalFormat: gl.RG32F, filter: gl.NEAREST, wrap: gl.REPEAT });
      this.doSeed(s);
    },
    resize(s, w, h) {
      const nw = Math.max(96, Math.round(SIMH * (w / h)));
      if (nw === s.sw) return;
      s.pp.dispose(); this.alloc(s, w, h);
    },
    doSeed(s) {
      bindRT(s.pp.write); gl.disable(gl.BLEND);
      P_SEED.use(); P_SEED.set('uTexel', 1 / s.sw, 1 / s.sh);
      P_SEED.set('uSeed', Math.random() * 90);
      drawTri(); s.pp.swap();
      s.st.warm = 6500;
    },
    reseed(s, manual) { if (s.pp && (manual || !s._seeded)) { this.doSeed(s); s._seeded = true; } },
    sim(s, dt) {
      const st = s.st;
      st.t += dt;
      st.phase += dt * 0.0091;
      let steps = Math.round(6 * clamp(s._density, 0.4, 2.0));
      if (st.warm > 0) { steps = Math.min(320, st.warm); st.warm -= steps; }
      let spike = 0;
      if (st.t > 19) { st.t = 0; spike = 1; }
      for (let i = 0; i < steps; i++) {
        bindRT(s.pp.write); gl.disable(gl.BLEND);
        P_STEP.use();
        P_STEP.set('uTexel', 1 / s.sw, 1 / s.sh);
        P_STEP.tex('uState', s.pp.read.tex, 0);
        P_STEP.set('uMood', 0.5 + 0.5 * Math.sin(App.simTime * 0.00431));
        P_STEP.set('uPhase', st.phase % TAU);
        P_STEP.set('uSeedAmt', (spike && i === 0) ? 6e-4 : 1.4e-5);
        P_STEP.set('uFrame', (App.frame * 7 + i) % 4096);
        drawTri(); s.pp.swap();
      }
    },
    uni(p, s) { p.tex('uState', s.pp.read.tex, 0); p.set('uSim', s.sw, s.sh); },
    frag: frag(`
uniform sampler2D uState;
uniform vec2 uSim;

#define C_BG   uPal[0]
#define C_BG2  uPal[1]
#define C_ICE  uPal[2]
#define C_LIT  uPal[3]
#define C_GLNT uPal[4]
#define C_WARM uPal[5]

float V(vec2 uv){
  vec2 p = uv*uSim - 0.5;
  vec2 i = floor(p), f = p - i;
  f = f*f*(3.0-2.0*f);
  return texture(uState, (i + 0.5 + f)/uSim).y;
}

void main(){
  vec2 uv = UVf() + vec2(uClocks.x*0.0042, uClocks2.w*0.0031);
  vec2 p = NP();

  vec2 uvc = UVf();
  float edgeD = min(min(uvc.x, 1.0 - uvc.x)*ASPECT(), min(uvc.y, 1.0 - uvc.y));
  float wob = 0.30*fbm2(uvc*vec2(3.2*ASPECT(), 3.2) + 7.0, 3)
            + 0.10*fbm2(uvc*vec2(9.0*ASPECT(), 9.0) + 31.0, 2);
  float claim = 0.34 + 0.16*sin(uClocks2.y*0.9) + 0.08*sin(uClocks.w*1.3);
  float frostMask = smoothstep(claim, claim - 0.42, edgeD + wob*0.55);

  float v = V(uv) * frostMask;

  vec2 e = 1.0/uSim;
  float vx = V(uv + vec2(e.x,0.0)) - V(uv - vec2(e.x,0.0));
  float vy = V(uv + vec2(0.0,e.y)) - V(uv - vec2(0.0,e.y));
  vec3 n = normalize(vec3(-vx*30.0, -vy*30.0, 1.0));

  float m    = smoothstep(0.06, 0.30, v);
  float body = smoothstep(0.18, 0.55, v);
  float edge = clamp(length(vec2(vx,vy))*40.0, 0.0, 1.0);

  float rad = length(p*vec2(0.72, 1.0));
  vec3 glass = mix(C_BG2*1.9, C_BG*1.4, smoothstep(0.1, 1.25, rad));
  glass *= 0.85 + 0.30*fbm2(p*1.1 + uClocks2.y*0.15, 3);
  glass += C_ICE * 0.10 * smoothstep(-0.2, 1.2, dot(p, normalize(vec2(-0.4, 0.9))));
  vec2 lampP = vec2(0.42 + 0.06*sin(uClocks.w), -1.18);
  float lamp = exp(-dot(p-lampP, p-lampP)*0.85);
  glass += C_WARM * lamp * 0.16;
  vec2 gp2 = vec2(-0.85, 0.55);
  glass += C_ICE * exp(-dot(p-gp2, p-gp2)*1.4) * 0.10;

  vec3 L = normalize(vec3(0.42, 0.75, 0.52));
  float key = clamp(dot(n, L), 0.0, 1.0);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 1.4);

  vec3 ice = mix(C_ICE*0.42, C_ICE*1.05, body);
  ice = mix(ice, C_LIT, pow(edge, 1.6)*0.45);
  ice += C_LIT * key * body * 0.20;
  ice += C_WARM * lamp * body * 0.14;
  ice += C_ICE * rim * 0.16;

  vec2 px = floor(PX()/2.0);
  float h = hash21(px);
  float tw = sin(uClocks.y*2.0 + h*TAU)*0.5 + 0.5;
  float glint = step(0.9965, h) * smoothstep(0.55, 1.0, tw) * body;
  ice += C_GLNT * glint * 1.5;

  vec3 col = mix(glass, ice*0.72, m*0.88);
  col += glass * m * 0.10;
  float halo = smoothstep(0.015, 0.10, v) - m;
  col += C_ICE * max(halo, 0.0) * 0.12;

  fragColor = vec4(max(col, 0.0), 1.0);
}
`)
  });
})();
