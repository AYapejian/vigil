/* ---------------- 13 · GRAVITY WELL ----------------
   262 144 test particles in the field of three drifting masses.
   Velocity-Verlet, Plummer softening, tangential respawn, HDR trails. */
(function () {
  const PW = 512, PH = 512;

  const SIM = `
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 P = texture(uPos, vUv);
  vec4 V = texture(uVel, vUv);
  vec2 p = P.xy, v = V.xy;
  float age = P.z;
  float G = uD.x, drag = uD.y, eps2 = uD.z*uD.z;
  float h = uDt * 0.5;
  for(int k=0;k<2;k++){
    vec2 f = vec2(0.0);
    vec2 r; float d2;
    r = uA.xy - p; d2 = dot(r,r) + eps2; f += G*uA.z * r / (d2*sqrt(d2));
    r = uB.xy - p; d2 = dot(r,r) + eps2; f += G*uB.z * r / (d2*sqrt(d2));
    r = uC.xy - p; d2 = dot(r,r) + eps2; f += G*uC.z * r / (d2*sqrt(d2));
    v += f * h;
    p += v * h;
  }
  v *= drag;
  age -= uDt;
  vec2 m = uRes * 0.35;
  bool out_ = p.x < -m.x || p.y < -m.y || p.x > uRes.x + m.x || p.y > uRes.y + m.y;
  if(age <= 0.0 || out_ || !(dot(p,p) < 1.0e12) || !(dot(v,v) < 1.0e10)){
    vec4 r4 = rnd4(c, 0.0);
    vec4 r5 = rnd4(c, 91.0);
    /* pick a mass, spawn on a ring with near-circular tangential velocity */
    vec3 a = r4.x < 0.5 ? uA.xyz : (r4.x < 0.8 ? uB.xyz : uC.xyz);
    float rad = uRes.y * (0.025 + 0.50 * r4.y*r4.y);
    float ang = r4.z * TAU;
    vec2 off = vec2(cos(ang), sin(ang)) * rad;
    p = a.xy + off;
    float vc = sqrt(G*a.z / rad);
    float dirn = (r5.x < 0.85) ? 1.0 : -1.0;       // a few retrograde
    v = vec2(-off.y, off.x) / rad * vc * dirn * (0.86 + 0.22*r5.y);
    age = uLife * (0.35 + 0.65*r5.z);
  }
  outPos = vec4(p, age, P.w);
  outVel = vec4(v, 0.0, 0.0);
}`;

  const SEED = `
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 r = rnd4(c, 7.0);
  vec2 ctr = uRes*0.5;
  float rad = uRes.y * (0.05 + 0.45*r.x);
  float ang = r.y*TAU;
  vec2 off = vec2(cos(ang), sin(ang))*rad;
  float vc = sqrt(uD.x*uA.z / rad);
  outPos = vec4(ctr + off, uLife*r.z, r.w);
  outVel = vec4(vec2(-off.y, off.x)/rad*vc, 0.0, 0.0);
}`;

  const PT_FS = `#version 300 es
precision highp float;
in vec4 vP; in vec4 vV;
uniform float uBright, uVmax, uLife;
uniform vec3 uCSlow, uCFast;
out vec4 o;
void main(){
  float sp = clamp(length(vV.xy)/uVmax, 0.0, 1.0);
  vec3 c = mix(uCSlow, uCFast, sp*sp);
  float t = clamp(vP.z/uLife, 0.0, 1.0);
  float fade = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.85, t);
  o = vec4(c * uBright * fade, 1.0);
}`;

  let ps = null;
  const LIFE = 40.0;

  scene({
    id: 'gravity',
    name: 'Gravity Well',
    medium: '262 144 bodies · three masses · softened n-body',
    chrome: '#e8d29a',
    dwell: 230,
    post: {
      exposure: 1.10, bloom: 0.30, bloomThreshold: 0.35, bloomKnee: 0.9,
      vignette: 0.40, ca: 0.6, grain: 0.012, grainSize: 1.6
    },
    themes: [
      ['Violet Gold', '#07050E', '#140C22', '#4A2A8A', '#F2D89A', '#2A1A4A', '#FFF4D8'],
      ['Ice', '#04080E', '#0C1A2A', '#2A6AA0', '#E8F4FF', '#14304A', '#FFFFFF'],
      ['Ember', '#0E0604', '#22100A', '#8A2A10', '#FFC07A', '#3A160C', '#FFF0D0'],
      ['Teal', '#040C0C', '#0C2222', '#1A7A7A', '#D8FFF0', '#0E3A3A', '#FFFFFF'],
      ['Rose', '#0E060A', '#22101A', '#8A2A5A', '#FFD0E0', '#40182A', '#FFF0F6']
    ],
    alloc(s, w, h) {
      if (!ps) {
        ps = new Particles(PW, PH, SIM, PT_FS, SEED);
      }
      if (s.trail) s.trail.dispose();
      s.trail = new Trail(w, h);
      s.needSeed = true;
    },
    resize(s, w, h) { this.alloc(s, w, h); },
    reseed(s, manual) { if (manual) s.needSeed = true; },
    masses(s) {
      const st = App.simTime, w = App.rw, h = App.rh;
      const k = Math.pow(h / 720, 3);
      const M0 = 2.9e6 * k, G = 1.0;
      return {
        G,
        A: [w * 0.5 + h * 0.16 * Math.sin(st * 0.021), h * 0.5 + h * 0.10 * Math.sin(st * 0.0137), M0 * (1.0 + 0.15 * Math.sin(st * 0.05))],
        B: [w * 0.5 + h * 0.36 * Math.cos(st * 0.0171 + 1.0), h * 0.5 + h * 0.26 * Math.sin(st * 0.0234 + 2.0), M0 * 0.55],
        C: [w * 0.5 + h * 0.30 * Math.cos(st * 0.0293 + 3.5), h * 0.5 - h * 0.30 * Math.sin(st * 0.0111 + 0.7), M0 * 0.30]
      };
    },
    sim(s, dt) {
      const m = this.masses(s);
      const setU = p => {
        p.set('uA', m.A[0], m.A[1], m.A[2], 0); p.set('uB', m.B[0], m.B[1], m.B[2], 0);
        p.set('uC', m.C[0], m.C[1], m.C[2], 0);
        p.set('uD', m.G, 0.9995, 34 * App.rh / 720, 0);
        p.set('uLife', LIFE); p.set('uDensity', s._density);
      };
      if (s.needSeed) { ps.seed(setU); s.needSeed = false; }
      const step = Math.min(dt, 1 / 30) * (App.reduced ? 0.4 : 1.0);
      ps.step(step, setU);
    },
    draw(s, target) {
      const m = this.masses(s);
      s.trail.begin(0.955);
      ps.draw(p => {
        p.set('uBright', 0.023 * s._density);
        p.set('uVmax', 260 * App.rh / 720);
        p.set('uLife', LIFE);
        p.set('uCSlow', palv(s, 2)); p.set('uCFast', palv(s, 3));
      });
      s.trail.end();

      bindRT(target);
      const pr = progOf(s);
      pr.use(); setCommon(pr, s);
      pr.tex('uTrail', s.trail.tex, 0);
      pr.set('uA', m.A[0], m.A[1], m.A[2], 0); pr.set('uB', m.B[0], m.B[1], m.B[2], 0);
      pr.set('uC', m.C[0], m.C[1], m.C[2], 0);
      drawTri();
    },
    frag: frag(`
uniform sampler2D uTrail;
uniform vec4 uA, uB, uC;
#define C_BG   uPal[0]
#define C_BG2  uPal[1]
#define C_HALO uPal[4]
#define C_CORE uPal[5]
float star(vec2 px, vec2 c, float m){
  float d = length(px - c);
  return exp(-d*d/(m*m*0.6)) + 0.35*exp(-d/(m*2.2));
}
void main(){
  vec2 uv = UVf(); vec2 p = NP();
  vec3 col = mix(C_BG2, C_BG, smoothstep(0.0, 1.4, length(p*vec2(0.8,1.0))));
  col *= 0.75 + 0.35*fbm2(p*1.4 + uClocks.x*0.1, 3);
  vec3 tr = texture(uTrail, uv).rgb;
  col += tr;
  /* the masses: dark cores in a soft halo */
  float rs = uRes.y/720.0;
  vec2 px = PX();
  float sA = star(px, uA.xy, 13.0*rs), sB = star(px, uB.xy, 9.5*rs), sC = star(px, uC.xy, 7.0*rs);
  col += C_HALO * (sA + sB + sC) * 0.7;
  col += C_CORE * (exp(-pow(length(px-uA.xy)/(3.0*rs),2.0)) + exp(-pow(length(px-uB.xy)/(2.4*rs),2.0)) + exp(-pow(length(px-uC.xy)/(2.0*rs),2.0))) * 1.4;
  fragColor = vec4(max(col, 0.0), 1.0);
}
`)
  });
})();
