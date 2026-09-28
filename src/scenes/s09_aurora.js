/* ---------------- 09 · POLAR NIGHT ----------------
   Curtains of aurora over a black ridge. Each curtain breathes on its
   own multi-minute cycle; the folds never repeat. */
scene({
  id: 'aurora',
  name: 'Polar Night',
  medium: 'three curtains · 557 nm · slow breathing',
  chrome: '#8ae8b4',
  dwell: 240,
  post: {
    exposure: 1.10, bloom: 0.26, bloomThreshold: 0.46, bloomKnee: 0.85,
    vignette: 0.38, ca: 0.0, grain: 0.014, grainSize: 1.7
  },
  themes: [
    ['Green Teal', '#071018', '#03060C', '#3AD98A', '#2CB4A6', '#7A5AC9', '#0A0E12', '#C9D8E8'],
    ['All Green', '#06100E', '#030608', '#2CD96B', '#3AB48A', '#4A7AC9', '#090E0C', '#D8E8DC'],
    ['Magenta', '#100714', '#06030A', '#C93A8A', '#964AC9', '#5A3AD9', '#100A12', '#E8D8F0'],
    ['Rare Gold', '#100C07', '#060403', '#D9A63A', '#C97A2C', '#965AC9', '#0E0C0A', '#F0E8D8'],
    ['Ice', '#0A0E14', '#040608', '#8AC9D9', '#A6D8E8', '#C9B4F0', '#0C1014', '#FFFFFF']
  ],
  frag: frag(`
#define C_SKYLO uPal[0]
#define C_SKYHI uPal[1]
#define C_LO    uPal[2]
#define C_MID   uPal[3]
#define C_HI    uPal[4]
#define C_RIDGE uPal[5]
#define C_STAR  uPal[6]

vec3 curtain(vec2 uv, float k, float env){
  float ph  = uClocks.x*(0.5 + 0.13*k) + k*17.0;
  float x   = uv.x*(0.85 + 0.22*k);
  float fold = 0.85*fbm2(vec2(x*1.05 + k*7.0, ph*0.14), 3)
             + 0.22*fbm2(vec2(x*3.1 + k*13.0, ph*0.26), 2);
  float y0 = 0.22 + 0.10*k + fold*0.44;
  float d = uv.y - y0;
  if(d < -0.05) return vec3(0.0);
  float base = smoothstep(-0.05, 0.10, d);
  float fade = exp(-max(d, 0.0)*(3.7 - 0.7*k));
  float lowGlow = exp(-abs(d)*11.0) * 1.35;
  float prof = base*fade + lowGlow*base;
  float rphase = x*16.0 + fold*11.0 - uClocks.y*(0.35 + 0.1*k);
  float w = fwidth(rphase);
  float rays = (0.42 + 0.58*pow(0.5 + 0.5*sin(rphase*TAU*0.5), 2.0)) / (1.0 + w*w*0.3);
  rays *= 0.55 + 0.45*fbm2(vec2(x*2.0, k*31.0 + uClocks.w*0.4), 3);
  float shim = 1.0 + 0.13*uMotion*sin(uClocks2.x*0.5 + x*3.1 + k*2.0);
  float I = prof * rays * shim * env;
  vec3 c = ramp3(C_LO, C_MID, C_HI, clamp(d*1.35, 0.0, 1.0));
  return c * I;
}

void main(){
  vec2 uv = UVf();
  vec3 col = mix(C_SKYLO, C_SKYHI, smoothstep(0.05, 0.95, uv.y));

  vec2 sp = PX()/7.0;
  vec2 si = floor(sp), sf = fract(sp);
  float sh = hash21(si);
  if(sh > 0.955 && uv.y > 0.20){
    vec2 pos = hash22(si + 41.0);
    float sd = length(sf - pos) * 7.0;
    float mag = pow(hash21(si + 7.0), 3.0);
    float tw = 0.80 + 0.20*sin(uClocks.y*1.5 + sh*TAU);
    col += C_STAR * exp(-sd*sd*0.9) * mag * tw * 0.8;
  }

  float e1 = 0.18 + 0.82*(0.5 + 0.5*sin(uClocks2.y*1.3 + 0.5));
  float e2 = 0.25 + 0.75*(0.5 + 0.5*sin(uClocks.w*0.9 + 2.8));
  float e3 = 0.20 + 0.80*(0.5 + 0.5*sin(uClocks2.w*0.7 + 4.4));
  float amp = 0.95 * uDensity;
  col += curtain(uv, 0.0, e1) * amp;
  col += curtain(uv, 1.0, e2) * amp * 0.6;
  col += curtain(uv, 2.0, e3) * amp * 0.38;

  float glow = exp(-pow((uv.y - 0.20)/0.10, 2.0));
  col += C_LO * glow * 0.045 * (e1 + e2) * uDensity;

  float hgt = 0.135 + 0.05*(fbmRidge(vec2(uv.x*1.9 + 7.0 - uClocks.y*0.006, 3.0), 5) - 0.3);
  float ridge = smoothstep(0.0022, -0.0022, uv.y - hgt);
  vec3 rc = C_RIDGE * (0.55 + 0.35*fbm2(uv*vec2(6.0, 12.0), 3));
  rc += C_LO * 0.05 * (e1);
  col = mix(col, rc, ridge);

  fragColor = vec4(max(col, 0.0), 1.0);
}
`)
});
