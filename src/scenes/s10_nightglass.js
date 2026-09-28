/* ---------------- 10 · NIGHT GLASS ----------------
   The city through a rained-on window. When the weather link says it
   is raining outside, it rains here too. */
scene({
  id: 'nightglass',
  name: 'Night Glass',
  medium: 'rain on glass · bokeh · syncs to live rain',
  chrome: '#e8a23c',
  dwell: 250,
  post: {
    exposure: 1.04, bloom: 0.20, bloomThreshold: 0.55, bloomKnee: 0.85, ana: 0.3,
    vignette: 0.44, ca: 0.8, grain: 0.016, grainSize: 1.7
  },
  themes: [
    ['Sodium', '#0C0906', '#05070C', '#E8A23C', '#C4622C', '#4A7AC9', '#C93A5A'],
    ['Neon', '#060A0E', '#04060C', '#2CC9E8', '#3A6BE8', '#C93AE8', '#E83A8A'],
    ['Candle', '#0E0A06', '#070503', '#E8C48A', '#C9903C', '#6B8AC9', '#E86B3A'],
    ['Blue Rain', '#06080C', '#04050A', '#8AA6E8', '#4A6BC9', '#2C4A9A', '#E8C48A'],
    ['Silver', '#08090A', '#050607', '#C9CDD4', '#8A9098', '#5A6068', '#E8ECF0']
  ],
  uni(p, s) {
    const wx = wxParams();
    const live = wx ? clamp(0.45 + wx.rain * 1.6, 0.35, 1.8) : 1.0;
    p.set('uWet', live * s._density);
  },
  frag: frag(`
uniform float uWet;

#define C_BASE uPal[0]
#define C_SKY  uPal[1]
#define C_W1   uPal[2]
#define C_W2   uPal[3]
#define C_COOL uPal[4]
#define C_SIGN uPal[5]

vec3 bokeh(vec2 uv){
  float asp = ASPECT();
  vec3 col = mix(C_SKY, C_BASE, smoothstep(0.85, 0.15, uv.y)) * 1.6;
  col += C_W2 * exp(-pow((uv.y - 0.10)/0.30, 2.0)) * 0.30;
  col += C_W1 * exp(-pow((uv.y - 0.42)/0.34, 2.0)) * 0.05;
  for(int l = 0; l < 3; l++){
    float fl = float(l);
    float sc = 3.0 + fl*2.6;
    float drift = uClocks.x * (0.010 + 0.006*fl);
    vec2 q = vec2(uv.x*asp + drift + fl*13.7, uv.y) * sc;
    vec2 g = floor(q), f = fract(q);
    for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
      vec2 o = vec2(float(i), float(j));
      vec2 h  = hash22(g + o + fl*57.0);
      vec2 h2 = hash22(g + o + fl*57.0 + 19.3);
      if(h2.x > 0.62) continue;
      vec2 pos = o + 0.15 + h*0.7;
      float cy = (g.y + pos.y)/sc;
      float below = smoothstep(1.00, 0.16, cy);
      if(below < 0.04) continue;
      float d = length(f - pos);
      float rad = (0.34 + 0.30*h2.y) * (0.7 + 0.5*fl/2.0);
      float disc = smoothstep(rad, rad*0.30, d);
      float pick = hash21(g + o + fl*91.0);
      vec3 lc = pick < 0.40 ? C_W1 : pick < 0.66 ? C_W2 : pick < 0.87 ? C_COOL : C_SIGN;
      float br = 0.55 + 0.75*h.y;
      if(pick > 0.93) br *= 0.7 + 0.3*sin(uClocks.y*2.0 + h.x*TAU);
      col += lc * disc * br * below * (1.15 - 0.28*fl);
    }
  }
  return col;
}

vec4 drops(vec2 uv, float t){
  float asp = ASPECT();
  vec2 U = vec2(uv.x*asp, uv.y);
  vec2 nrm = vec2(0.0);
  float wet = 0.0, clearF = 0.0;
  for(int l = 0; l < 2; l++){
    float fl = float(l);
    vec2 grid = vec2(10.0, 1.6) * (1.0 + fl*0.35);
    vec2 q = U * grid + vec2(fl*23.0, 0.0);
    vec2 id = floor(q);
    float colH = hash21(vec2(id.x, fl*7.0));
    if(colH > 0.15*uWet + 0.05) continue;
    vec2 f = fract(q);
    float spd = (0.06 + 0.11*hash21(vec2(id.x, 9.1+fl))) * uMotion;
    float prog = t*spd + hash21(vec2(id.x, 3.7));
    float dropY = 1.0 - fract(prog + 0.22*sin(prog*TAU*2.0 + id.x));
    float wob = 0.28*sin(U.y*14.0 + id.x*7.0) * 0.35;
    vec2 rel = vec2((f.x - 0.5 - wob), (fract(q.y) - dropY));
    rel.y *= grid.x/grid.y*0.42;
    float d = length(rel);
    float R = 0.16 + 0.05*hash21(id + 31.0);
    float inDrop = smoothstep(R, R*0.45, d);
    if(inDrop > 0.0){
      vec2 nd = rel / max(R, 1e-4);
      nrm += nd * inDrop * (1.0 - dot(nd,nd)*0.5) * 1.6;
      wet = max(wet, inDrop);
    }
    float above = (fract(q.y) - dropY);
    float trail = smoothstep(0.055, 0.012, abs(f.x - 0.5 - wob))
                * smoothstep(0.0, 0.10, above) * smoothstep(1.2, 0.12, above);
    clearF = max(clearF, trail*0.5);
    float beadY = fract(q.y*6.0 + hash21(vec2(id.x, 77.0)));
    float bead = smoothstep(0.07, 0.02, abs(f.x - 0.5 - wob))
               * smoothstep(0.15, 0.02, abs(beadY - 0.5)) * trail;
    nrm += vec2(0.0, bead*0.5);
    wet = max(wet, bead*0.8);
  }
  {
    vec2 q = U * vec2(34.0, 22.0);
    vec2 id = floor(q), f = fract(q);
    vec2 h = hash22(id);
    float age = fract(t*0.008 + h.y*7.0);
    float ex = step(h.x, 0.16*uWet + 0.05) * smoothstep(0.0, 0.15, age) * smoothstep(1.0, 0.75, age);
    vec2 pos = 0.25 + hash22(id + 5.0)*0.5;
    vec2 rel = f - pos;
    float R = 0.10 + 0.16*h.y;
    float inD = smoothstep(R, R*0.4, length(rel)) * ex;
    nrm += (rel/max(R,1e-4)) * inD * 1.1;
    wet = max(wet, inD*0.9);
  }
  return vec4(nrm, wet, clearF);
}

void main(){
  vec2 uv = UVf();
  float t = uTime;
  vec4 D = drops(uv, t);
  vec2 nrm = D.xy; float wet = D.z; float clearF = D.w;
  vec2 refr = nrm * vec2(0.045, 0.065);
  vec3 sharp = bokeh(uv + refr);
  sharp *= 1.0 + wet*0.85;
  vec3 misted = bokeh(uv);
  float ml = luma(misted);
  vec3 fogged = mix(misted, vec3(ml)*0.9, 0.40) * 0.55 + C_SKY*0.5;
  float see = clamp(wet + clearF, 0.0, 1.0);
  vec3 col = mix(fogged, sharp, see);
  col += vec3(1.0) * pow(clamp(1.0 - length(nrm - vec2(0.35, -0.5)), 0.0, 1.0), 18.0) * wet * 0.28;
  float breathe = 0.5 + 0.5*sin(uClocks2.y*0.8);
  col *= 1.0 - 0.10*breathe*smoothstep(0.4, 1.1, length(NP()));
  fragColor = vec4(max(col, 0.0), 1.0);
}
`)
});
