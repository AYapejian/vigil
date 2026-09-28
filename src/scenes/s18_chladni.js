/* ---------------- 18 · CHLADNI ----------------
   Sand on a vibrating plate. Grains are shaken off the antinodes and
   settle where the plate is still: the nodal lines of a square-plate
   mode. The mode numbers drift slowly, so the pattern re-forms itself. */
(function () {
  const PW = 512, PH = 512;

  /* mode function for a square plate, and its gradient */
  const MODE = `
uniform vec4 uPlate;   // cx, cy, halfSize, tiltless
float modeF(vec2 q, float n, float m){
  return cos(n*PI*q.x)*cos(m*PI*q.y) - cos(m*PI*q.x)*cos(n*PI*q.y);
}
vec2 modeG(vec2 q, float n, float m){
  float sx = sin(n*PI*q.x), cx = cos(n*PI*q.x), sy = sin(m*PI*q.y), cy = cos(m*PI*q.y);
  float sx2 = sin(m*PI*q.x), cx2 = cos(m*PI*q.x), sy2 = sin(n*PI*q.y), cy2 = cos(n*PI*q.y);
  return vec2(-n*PI*sx*cy + m*PI*sx2*cy2, -m*PI*cx*sy + n*PI*cx2*sy2);
}`;

  const SIM = MODE + `
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 P = texture(uPos, vUv);
  vec4 V = texture(uVel, vUv);
  vec2 p = P.xy, v = V.xy;
  float n = uA.x, m = uA.y, amp = uA.z, jit = uA.w;
  vec2 ctr = uPlate.xy; float hs = uPlate.z;
  vec2 q = (p - ctr) / hs;
  float f = modeF(q, n, m);
  vec2 g = modeG(q, n, m);
  /* grains are kicked toward regions of lower vibration amplitude (f²) */
  vec2 force = -amp * 2.0 * f * g;
  vec4 r = rnd4(c, 3.0);
  float shake = jit * (0.15 + abs(f));
  v = v * uB.x + force * uDt + (r.xy - 0.5) * shake;
  p += v * uDt;
  /* the plate's edge: bounce */
  vec2 lim = ctr + vec2(hs) - 1.0;
  vec2 lo  = ctr - vec2(hs) + 1.0;
  /* off the edge of the plate: the grain is lost and a new one is sprinkled on */
  if(p.x > lim.x || p.x < lo.x || p.y > lim.y || p.y < lo.y){
    vec4 r2 = rnd4(c, 23.0);
    p = ctr + (r2.xy - 0.5) * 2.0 * hs * 0.96; v = vec2(0.0);
  }
  if(!(dot(p,p) < 1.0e12) || !(dot(v,v) < 1.0e10)){
    vec4 r2 = rnd4(c, 17.0);
    p = ctr + (r2.xy - 0.5) * 2.0 * hs * 0.98; v = vec2(0.0);
  }
  /* a few grains are re-thrown each frame so the figure never fully freezes */
  if(r.z < uB.y){ vec4 r3 = rnd4(c, 29.0); p = ctr + (r3.xy - 0.5) * 2.0 * hs * 0.98; v = (r3.zw-0.5)*40.0; }
  outPos = vec4(p, abs(f), P.w);
  outVel = vec4(v, 0.0, 0.0);
}`;

  const SEED = `
uniform vec4 uPlate;
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 r = rnd4(c, 11.0);
  vec2 ctr = uPlate.xy; float hs = uPlate.z;
  outPos = vec4(ctr + (r.xy - 0.5) * 2.0 * hs * 0.98, 0.0, r.w);
  outVel = vec4(0.0);
}`;

  const PT_FS = `#version 300 es
precision highp float;
in vec4 vP; in vec4 vV;
uniform float uBright;
uniform vec3 uCSand, uCSand2;
out vec4 o;
void main(){
  float still = 1.0 - clamp(length(vV.xy)/60.0, 0.0, 1.0);
  vec3 c = mix(uCSand2, uCSand, still*still) * (0.75 + 0.5*vP.w);
  o = vec4(c * uBright, 1.0);
}`;

  let ps = null;

  function plate(s) {
    const w = App.rw, h = App.rh;
    const hs = Math.min(w, h) * 0.43;
    return [w * 0.5, h * 0.5, hs, 0];
  }

  scene({
    id: 'chladni',
    name: 'Chladni',
    medium: '262 144 grains · square plate · drifting modes',
    chrome: '#e8dcc0',
    dwell: 230,
    post: {
      exposure: 1.06, bloom: 0.08, bloomThreshold: 0.75, bloomKnee: 0.7,
      vignette: 0.48, ca: 0.5, grain: 0.014, grainSize: 1.5
    },
    themes: [
      ['Brass Plate', '#0C0A08', '#3A3022', '#4E4030', '#F0E0C0', '#C0A070', '#8A7448'],
      ['Slate', '#08090C', '#262C36', '#343C48', '#E8ECF0', '#A0A8B4', '#5A6270'],
      ['Ink Wash', '#0A0A0A', '#262626', '#303030', '#F4F0E8', '#B8B0A0', '#606060'],
      ['Verdigris', '#060A0A', '#1A2C2A', '#24383A', '#E0F4E8', '#8AC0A8', '#4A8070'],
      ['Ember', '#0C0604', '#381C10', '#482818', '#FFE0B0', '#E09050', '#8A4A24']
    ],
    alloc(s, w, h) {
      if (!ps) ps = new Particles(PW, PH, SIM, PT_FS, SEED);
      if (s.trail) s.trail.dispose();
      s.trail = new Trail(w, h);
      s.needSeed = true;
    },
    resize(s, w, h) { this.alloc(s, w, h); },
    reseed(s, manual) { if (manual) s.needSeed = true; },
    modes(s) {
      /* mode numbers wander through non-integer values; the figure melts
         between the classic patterns instead of snapping */
      const st = App.simTime;
      const n = 2.5 + 2.4 * Math.sin(st * 0.0131 + 0.4);
      const m = 3.5 + 2.4 * Math.sin(st * 0.0093 + 2.1);
      return [n, m];
    },
    sim(s, dt) {
      const [n, m] = this.modes(s), pl = plate(s);
      const sc = App.rh / 720;
      const setU = p => {
        p.set('uPlate', pl[0], pl[1], pl[2], 0);
        p.set('uA', n, m, 3200 * sc * sc, 5.0 * sc);           // n, m, restoring gain, shake
        p.set('uB', 0.90, 0.0006 * s._density, 0, 0);          // damping, re-throw probability
        p.set('uLife', 1); p.set('uDensity', s._density);
      };
      if (s.needSeed) { ps.seed(setU); s.needSeed = false; }
      const step = Math.min(dt, 1 / 30) * (App.reduced ? 0.5 : 1.0);
      ps.step(step, setU);
    },
    draw(s, target) {
      const pl = plate(s);
      s.trail.begin(0.84);
      ps.draw(p => {
        p.set('uBright', 0.10 * clamp(s._density, 0.5, 1.6));
        p.set('uCSand', palv(s, 3)); p.set('uCSand2', palv(s, 4));
      });
      s.trail.end();

      bindRT(target);
      const pr = progOf(s);
      pr.use(); setCommon(pr, s);
      pr.tex('uTrail', s.trail.tex, 0);
      pr.set('uPlate', pl[0], pl[1], pl[2], 0);
      const [n, m] = this.modes(s);
      pr.set('uNM', n, m);
      drawTri();
    },
    frag: frag(`
uniform sampler2D uTrail;
uniform vec4 uPlate;
uniform vec2 uNM;
#define C_BG    uPal[0]
#define C_PLATE uPal[1]
#define C_PLATE2 uPal[2]
#define C_EDGE  uPal[5]
void main(){
  vec2 uv = UVf(); vec2 px = PX();
  vec2 q = (px - uPlate.xy) / uPlate.z;          // -1..1 across the plate
  float inside = 1.0 - smoothstep(0.985, 1.0, max(abs(q.x), abs(q.y)));

  vec3 col = C_BG * (0.7 + 0.5*smoothstep(1.8, 0.2, length(NP())));
  col *= 0.85 + 0.3*fbm2(NP()*1.5 + 9.0, 3);

  /* the plate: brushed metal with a faint standing-wave sheen */
  float f = cos(uNM.x*PI*q.x)*cos(uNM.y*PI*q.y) - cos(uNM.y*PI*q.x)*cos(uNM.x*PI*q.y);
  float brush = 0.92 + 0.10*fbm2(vec2(q.x*40.0, q.y*3.0), 3);
  vec3 plate = mix(C_PLATE, C_PLATE2, 0.5 + 0.5*(q.x - q.y)*0.6) * brush;
  plate *= 0.95 + 0.06*sin(f*3.0 + uClocks2.x*2.0);
  /* soft top-left light */
  plate *= 0.85 + 0.35*smoothstep(1.4, -1.4, q.x + q.y);
  /* edge bevel */
  float e = max(abs(q.x), abs(q.y));
  float bevel = smoothstep(0.93, 1.0, e);
  plate = mix(plate, C_EDGE, bevel*0.4);
  col = mix(col, plate, inside);
  /* shadow beneath the plate */
  col *= 1.0 - 0.35*(1.0 - inside)*smoothstep(1.35, 1.0, e);

  /* grains pile up on the nodal lines; compress so a heap reads as sand, not as light */
  vec3 sand = texture(uTrail, uv).rgb;
  sand = sand / (1.0 + sand * 1.3);
  col += sand * inside;
  fragColor = vec4(max(col, 0.0), 1.0);
}
`)
  });
})();
