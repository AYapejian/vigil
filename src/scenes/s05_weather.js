/* ---------------- 05 · DISTANT WEATHER ----------------
   A low ridge under moving overcast. When the weather link is up, the
   overcast, rain, wind and light follow the sky outside. */
scene({
  id: 'weather',
  name: 'Distant Weather',
  medium: 'three sheets · syncs to local weather when linked',
  chrome: '#8fa0a6',
  dwell: 250,
  post: {
    exposure: 1.28, bloom: 0.16, bloomThreshold: 0.55, bloomKnee: 0.85, ana: 0.55,
    vignette: 0.34, ca: 0.4, grain: 0.019, grainSize: 2.5
  },
  info: { on: true, pos: 'tr' },
  themes: [
    ['Slate', '#070A0D', '#131A20', '#2B3742', '#4E606C', '#8FA0A6', '#6B5B4C'],
    ['Dawn', '#0D0A0E', '#1E141C', '#42303E', '#6C4E5A', '#C9908F', '#B06B4C'],
    ['Moorland', '#090D0A', '#141E16', '#2B4234', '#4E6C55', '#A0B89C', '#6B5B3C'],
    ['Indigo Night', '#06070D', '#10131E', '#22293E', '#3A466C', '#8090C9', '#4C4E6B'],
    ['Storm Sepia', '#0D0B08', '#201812', '#423A2B', '#6C614E', '#B8AC8F', '#8A5A3C']
  ],
  st: { rain: -0.15, windT: 0 },
  reseed(s) { s.st.rain = -0.2 - Math.random() * 0.4; },
  tick(s, dt) {
    const wx = wxParams();
    const mul = wx ? wx.windMul : 1.0;
    s.st.windT = (s.st.windT + dt * mul) % 4096;
    s.st.rain += dt * 0.0016;
    if (s.st.rain > 1.9) s.st.rain = -0.6;
  },
  uni(p, s) {
    p.set('uRain', s.st.rain);
    p.set('uWindT', s.st.windT);
    const wx = wxParams();
    if (wx) { p.set('uWx', wx.cloud, wx.rain, wx.windMul, wx.day); p.set('uWxOn', 1); }
    else { p.set('uWx', 0.5, 0, 1, 0); p.set('uWxOn', 0); }
  },
  frag: frag(`
uniform float uRain, uWindT, uWxOn;
uniform vec4  uWx;

#define C_VOID  uPal[0]
#define C_NEAR  uPal[1]
#define C_FOG   uPal[2]
#define C_SKY   uPal[3]
#define C_BREAK uPal[4]
#define C_WARM  uPal[5]

float sheet(vec2 uv, float horiz, float H, float drift, float scale, int oct){
  float e = uv.y - horiz;
  if(e <= 0.0018) return 0.0;
  float d = H / (e + 0.085);
  vec2 q = vec2((uv.x - 0.5) * d * 1.55 + drift, d) * scale;
  return fbm2(q, oct);
}

void main(){
  vec2 uv = UVf();
  float horiz = 0.322;
  float sky = smoothstep(horiz, 1.05, uv.y);

  vec3 col = mix(C_FOG, C_SKY, pow(sky, 0.80));
  col = mix(col, C_VOID*1.4, smoothstep(0.55, 1.02, uv.y)*0.42);

  float warmBand = exp(-pow((uv.y - horiz - 0.020)/0.030, 2.0)) * smoothstep(0.25, 0.95, uv.x);
  col += C_WARM * warmBand * 0.55;

  float t = uTime;
  float s1 = sheet(uv, horiz, 0.090, uClocks.x*3.6 + uWindT*0.0075, 9.0, 5);
  float s2 = sheet(uv, horiz, 0.220, uClocks.y*1.1 + uWindT*0.0030, 5.6, 5);
  float s3 = sheet(uv, horiz, 0.520, uClocks.z*0.7 + uWindT*0.0011, 3.2, 4);

  vec2 bp = vec2(0.72 + 0.075*sin(uClocks2.y), 0.30 + 0.028*sin(uClocks.w));
  vec2 bd = (uv - bp) * vec2(1.0, 2.1);
  float brk = exp(-dot(bd,bd)*13.0);

  float ov3 = smoothstep(-0.30, 0.42, s3);
  float ov2 = smoothstep(-0.20, 0.46, s2);
  float ov1 = smoothstep(-0.10, 0.50, s1);
  float ccov = mix(1.0, 0.18 + 1.5*uWx.x, uWxOn);
  ov3 *= ccov; ov2 *= ccov; ov1 *= min(ccov, 1.0);

  vec3 cloudFar  = mix(C_FOG, C_SKY, 0.30);
  vec3 cloudMid  = mix(C_FOG, C_SKY, 0.55);
  vec3 cloudNear = mix(C_NEAR*1.6, C_FOG, 0.62);
  col = mix(col, cloudFar,  ov3 * 0.60 * sky);
  col = mix(col, cloudMid,  ov2 * 0.50 * sky);
  col = mix(col, cloudNear, ov1 * 0.62 * sky);

  float brkAmp = mix(1.0, 0.6 + 1.7*(1.0 - uWx.x), uWxOn);
  col += C_BREAK * brk * (0.16 + 0.36*(1.0 - ov1)) * (0.85 + 0.25*sin(uClocks.y)) * brkAmp;
  col += C_BREAK * brk*brk * 0.22;

  float rx    = mix(0.13 + uRain*0.42, 0.42 + 0.08*sin(uClocks2.y), uWxOn);
  float rAmp  = mix(clamp(uRain*1.4 + 0.25, 0.0, 1.0), clamp(uWx.y*2.2, 0.0, 1.15), uWxOn);
  float rWide = mix(0.16, 0.34, uWxOn * clamp(uWx.y*1.6, 0.0, 1.0));
  float curtain = exp(-pow((uv.x - rx)/rWide, 2.0))
                * smoothstep(horiz + 0.115, horiz - 0.005, uv.y)
                * smoothstep(horiz - 0.10, horiz + 0.06, uv.y)
                * rAmp * uDensity;
  float streak = 0.55 + 0.45*fbm2(vec2(uv.x*26.0, uv.y*3.0 + uWindT*0.05), 2);
  col = mix(col, C_FOG*0.55, clamp(curtain*0.55*streak, 0.0, 0.8));

  float xr = uv.x + uClocks.x*0.010;
  for(int i=0;i<3;i++){
    float fi = float(i);
    float par = 0.020 + fi*0.028;
    float freq = mix(2.6, 1.15, fi/2.0);
    float amp  = mix(0.028, 0.086, fi/2.0);
    float baseY = horiz - 0.006 - fi*0.036;
    float hgt = baseY + amp*(fbmRidge(vec2(xr*freq + fi*23.0 - uClocks.y*par, fi*7.0), 5) - 0.30);
    float m = smoothstep(0.0018, -0.0018, uv.y - hgt);
    vec3 rc = mix(C_FOG*1.30, C_VOID*1.25, 0.22 + 0.72*(fi/2.0));
    rc *= 0.72 + 0.30*fbm2(vec2(uv.x*7.0 + fi*3.0, uv.y*10.0), 3);
    rc += C_BREAK * 0.055 * (1.0 - fi/3.0) * smoothstep(0.35, 0.95, uv.x);
    col = mix(col, rc, m);
  }

  float fogBand = exp(-pow((uv.y - horiz + 0.055)/0.055, 2.0));
  col = mix(col, C_FOG*0.85, fogBand*0.42*(0.6 + 0.4*fbm2(vec2(uv.x*3.0 - uClocks.z*0.4, 1.0), 3)));
  float near = smoothstep(horiz - 0.02, -0.10, uv.y);
  col = mix(col, C_VOID*1.15, near*0.86);
  col += C_NEAR * near * 0.30 * (0.5 + 0.5*fbm2(uv*vec2(5.0,9.0) + 40.0, 3));

  float chill = clamp(mix(uRain*0.55, uWx.y*0.9, uWxOn), 0.0, 0.42);
  col = mix(col, mix(col, C_FOG, 0.35)*0.88, chill);
  float lum = mix(1.0, 0.66 + 0.50*uWx.w, uWxOn);

  fragColor = vec4(max(col,0.0)*1.02*lum, 1.0);
}
`)
});
