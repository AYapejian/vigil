/* ---------------- 01 · TUNGSTEN HOUR ---------------- */
scene({
  id: 'tungsten',
  name: 'Tungsten Hour',
  medium: 'volumetric · single pass · 2700 K',
  chrome: '#f2c77a',
  dwell: 200,
  post: {
    exposure: 1.22, bloom: 0.34, bloomThreshold: 0.30, bloomKnee: 0.90, ana: 0.0,
    vignette: 0.52, ca: 0.0, grain: 0.017, grainSize: 1.8
  },
  st: { next: 40, occ: 0, t: 0 },
  reseed(s) { s.st.next = 30 + Math.random() * 40; s.st.occ = 0; s.st.t = 0; },
  tick(s, dt) {
    const st = s.st;
    st.t += dt;
    if (st.t > st.next) {
      st.occ += dt / 9.0;
      if (st.occ >= 1) { st.occ = 0; st.t = 0; st.next = 70 + Math.random() * 70; }
    }
  },
  uni(p, s) { p.set('uOcc', s.st.occ); },
  themes: [
    ['Tungsten', '#1E1512', '#241812', '#5A3616', '#C9791F', '#F2C77A', '#22323C'],
    ['Moonlight', '#10141C', '#131722', '#2C4258', '#7FA6C9', '#D8E8F2', '#3C2E22'],
    ['Ember', '#1C0F0E', '#221210', '#5A1F16', '#C24A2A', '#F2A47A', '#1E2E3C'],
    ['Verdigris', '#0F1714', '#121D18', '#2E5140', '#4FA98C', '#CFF2DC', '#3C2A22'],
    ['Violet Hour', '#16121C', '#1A1424', '#41305E', '#8A62C9', '#D9C2F2', '#223C30']
  ],
  frag: frag(`
uniform float uOcc;

#define C_ROOM  uPal[0]
#define C_FLOOR uPal[1]
#define C_MID   uPal[2]
#define C_TUNG  uPal[3]
#define C_HIGH  uPal[4]
#define C_COLD  uPal[5]

float moteLayer(vec2 p, float lay, float t){
  float sc = mix(7.0, 15.0, lay);
  vec2 q = (p + vec2(0.05*sin(t*0.043 + lay*2.1), -t*0.013*(0.6+0.7*lay))) * sc;
  vec2 g = floor(q), f = fract(q);
  float acc = 0.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 o  = vec2(float(i), float(j));
    vec2 h  = hash22(g + o + lay*137.0);
    vec2 h2 = hash22(g + o + lay*137.0 + 9.13);
    if(h2.x > 0.55) continue;
    float ph = h.x*TAU;
    vec2 pos = o + vec2(0.5) + 0.42*vec2(cos(ph + t*(0.11+0.10*h.y)),
                                         sin(ph*1.61 + t*(0.09+0.08*h.x)));
    float d = length(f - pos);
    float r = 0.026 + 0.030*h2.y;
    acc += exp(-d*d/(r*r)) * (0.25 + 0.75*h.y);
  }
  return acc;
}

void main(){
  vec2 p = NP();
  float t = uTime;

  float wander = sin(uClocks.w) * 0.5 + 0.5*sin(uClocks2.y*0.7);
  float ang = 0.58 + 0.30*wander + 0.05*sin(uClocks.x);
  vec2 dir  = vec2(sin(ang), -cos(ang));
  vec2 per  = vec2(-dir.y, dir.x);
  vec2 S    = vec2(-1.16 - 0.42*wander, 1.24) + 0.05*vec2(cos(uClocks.z), sin(uClocks.w));

  vec2  v      = p - S;
  float along  = dot(v, dir);
  float across = dot(v, per);

  float hz  = fbm3(vec3(p*1.10, t*0.019), 4);
  float hz2 = fbm3(vec3(p*2.90 + 17.0, t*0.030), 3);
  float dens = 0.60 + 0.40*hz + 0.16*hz2;

  across += 0.045*fbm2(vec2(along*1.35, t*0.055), 3) + 0.020*fbm2(vec2(along*4.1, 3.0 + t*0.09), 2);

  float w  = 0.150 + 0.058*max(along, 0.0);
  float a1 = across / w;
  float core = exp(-a1*a1*1.9);
  float halo = exp(-a1*a1*0.115) * 0.105;

  float b2 = exp(-pow((across - 0.30 - 0.055*along)/(0.050 + 0.028*max(along,0.0)), 2.0)*1.5) * 0.36;
  float b3 = exp(-pow((across + 0.33 + 0.045*along)/(0.040 + 0.024*max(along,0.0)), 2.0)*1.5) * 0.22;

  float fall = exp(-max(along,0.0)*0.40) * smoothstep(-0.25, 0.55, along);
  float breathe = 1.0 + 0.11*sin(uClocks.y) + 0.05*sin(uClocks2.x*1.7);

  float oc = 1.0;
  if(uOcc > 0.0){
    float pos = mix(-0.5, 3.4, uOcc);
    oc = mix(0.60, 1.0, smoothstep(0.0, 0.60, abs(along - pos)));
  }

  float beams = core + halo + b2 + b3;
  float shaft = beams * fall * dens * breathe * oc;

  float floorY = -0.60 + 0.045*p.x;
  float isFloor = smoothstep(0.02, -0.05, p.y - floorY);

  float wallTex = 0.6 + 0.4*fbm2(p*1.4 + 5.0, 3);
  float wall = smoothstep(1.5, -0.85, p.y) * wallTex * (1.0 - isFloor*0.55);

  float Ld = (floorY - S.y) / dir.y;
  vec2 land = S + dir*Ld;
  vec2 rel  = p - land;
  float pool = exp(-(rel.x*rel.x/0.16 + rel.y*rel.y/0.055))
             * (0.6 + 0.4*hz) * oc * breathe * isFloor;
  float bounce = exp(-(rel.x*rel.x/0.80 + max(rel.y,0.0)*max(rel.y,0.0)/0.16)) * 0.16 * oc;

  vec2 cq = p - vec2(-1.05, -0.18);
  float cold = exp(-dot(cq*vec2(0.9,1.25), cq*vec2(0.9,1.25))*1.5) * 0.5;

  vec3 col = vec3(0.0);
  col += C_ROOM  * wall * 0.80;
  col += C_FLOOR * isFloor * (0.24 + 0.26*wallTex);
  col += C_COLD  * cold * 0.40;
  col += ramp3(C_MID, C_TUNG, C_HIGH, clamp(shaft*1.05, 0.0, 1.0)) * shaft * 2.05;
  col += mix(C_TUNG, C_HIGH, clamp(pool*1.2,0.0,1.0)) * (pool*0.60 + bounce*0.45);

  float inBeam = clamp((core + b2*0.7 + b3*0.6) * fall * 2.2, 0.0, 1.5);
  float m = moteLayer(p, 0.0, t) * 0.55 + moteLayer(p, 1.0, t) * 0.28;
  float mote = m * (0.05 + 1.45*inBeam) * oc * uDensity;
  col += mix(C_TUNG, C_HIGH, clamp(inBeam, 0.0, 1.0)) * mote * 0.60;

  fragColor = vec4(max(col, 0.0), 1.0);
}
`)
});
