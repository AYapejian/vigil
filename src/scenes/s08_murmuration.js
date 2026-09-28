/* ---------------- 08 · MURMURATION ----------------
   262k agents transported by the Aizawa attractor plus a curl field. */
(function () {
  const PW = 512, PH = 512, N = PW * PH;

  const SIM = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
uniform sampler2D uPos;
uniform vec2  uTex;
uniform float uDt, uNoise, uSwirl, uFrame, uLife;
out vec4 outPos;
uint hashU(uint x){ x^=x>>16; x*=0x7feb352du; x^=x>>15; x*=0x846ca68bu; x^=x>>16; return x; }
float u2f(uint h){ return uintBitsToFloat((h >> 9u) | 0x3f800000u) - 1.0; }
vec3 hash33(vec3 p3){
  p3 = fract(p3*vec3(0.1031,0.1030,0.0973));
  p3 += dot(p3, p3.yxz+33.33);
  return fract((p3.xxy+p3.yxx)*p3.zyx);
}
float vnoise3(vec3 x){
  vec3 i = floor(x), f = fract(x);
  vec3 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  float a=hash33(i).x,               b=hash33(i+vec3(1,0,0)).x;
  float c=hash33(i+vec3(0,1,0)).x,   d=hash33(i+vec3(1,1,0)).x;
  float e=hash33(i+vec3(0,0,1)).x,   g=hash33(i+vec3(1,0,1)).x;
  float h=hash33(i+vec3(0,1,1)).x,   k=hash33(i+vec3(1,1,1)).x;
  return mix(mix(mix(a,b,u.x),mix(c,d,u.x),u.y), mix(mix(e,g,u.x),mix(h,k,u.x),u.y), u.z)*2.0-1.0;
}
vec3 curl(vec3 p){
  const float h = 0.42;
  float x1 = vnoise3(p + vec3(0.0,h,0.0)), x2 = vnoise3(p - vec3(0.0,h,0.0));
  float y1 = vnoise3(p + vec3(0.0,0.0,h)), y2 = vnoise3(p - vec3(0.0,0.0,h));
  float z1 = vnoise3(p + vec3(h,0.0,0.0)), z2 = vnoise3(p - vec3(h,0.0,0.0));
  vec3 q = p + vec3(31.4, 47.9, 12.8);
  float a1 = vnoise3(q + vec3(0.0,0.0,h)), a2 = vnoise3(q - vec3(0.0,0.0,h));
  float b1 = vnoise3(q + vec3(h,0.0,0.0)), b2 = vnoise3(q - vec3(h,0.0,0.0));
  return vec3((x1-x2) - (a1-a2), (y1-y2) - (b1-b2), (z1-z2) - (x1-x2)) / (2.0*h);
}
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 P = texelFetch(uPos, c, 0);
  vec3 p = P.xyz;
  float age = P.w;
  const float A=0.95, B=0.70, C=0.60, D=3.50, E=0.25, F=0.10;
  float h = 0.0085 * uSwirl;
  for(int i=0;i<3;i++){
    vec3 f = vec3((p.z - B)*p.x - D*p.y,
                  D*p.x + (p.z - B)*p.y,
                  C + A*p.z - p.z*p.z*p.z/3.0 - (p.x*p.x + p.y*p.y)*(1.0 + E*p.z)
                    + F*p.z*p.x*p.x*p.x);
    p += f * h;
  }
  p += curl(p*1.15 + vec3(0.0, 0.0, uFrame*0.0011)) * uNoise * uDt;
  age -= uDt;
  if(age <= 0.0 || !(dot(p,p) < 400.0)){
    uint sd = uint(c.x)*1973u + uint(c.y)*9277u + uint(uFrame)*26699u;
    vec3 r = vec3(u2f(hashU(sd)), u2f(hashU(sd^0x9e37u)), u2f(hashU(sd^0x85ebu)));
    p = vec3(0.10, 0.0, 0.55) + (r*2.0 - 1.0)*0.85;
    age = uLife*(0.20 + 0.80*u2f(hashU(sd^0xdeadu)));
  }
  outPos = vec4(p, age);
}`;

  const PT_VS = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uPos;
uniform vec2  uRes, uDrift;
uniform float uYaw, uPitch, uDist, uFocal, uLife;
uniform int   uW;
out float vFade; out float vNear; out float vSpeed;
vec3 rotY(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }
vec3 rotX(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z); }
void main(){
  ivec2 c = ivec2(gl_VertexID % uW, gl_VertexID / uW);
  vec4 P = texelFetch(uPos, c, 0);
  vec3 w = rotX(rotY((P.xyz - vec3(0.0,0.0,0.55))*3.05, uYaw), uPitch);
  w.z -= uDist;
  float z = max(-w.z, 0.05);
  vec2 ndc = vec2(w.x, w.y) * uFocal / z;
  ndc.x /= (uRes.x/uRes.y);
  ndc += uDrift/uRes*2.0;
  gl_Position = vec4(ndc, 0.0, 1.0);
  gl_PointSize = 1.0;
  float t = clamp(P.w/uLife, 0.0, 1.0);
  vFade = sin(3.14159*t);
  vNear = clamp((uDist + 5.0 - z)/10.0, 0.0, 1.0);
  vSpeed = clamp((P.z + 0.75)*0.42, 0.0, 1.0);
}`;

  const PT_FS = `#version 300 es
precision highp float;
in float vFade; in float vNear; in float vSpeed;
uniform float uBright;
uniform vec3 uCFar, uCNear, uCLit;
out vec4 o;
void main(){
  vec3 c = mix(uCFar, uCNear, vNear);
  c = mix(c, uCLit, smoothstep(0.62, 0.98, vSpeed)*0.75*vNear);
  float depth = mix(0.22, 1.0, vNear*vNear);
  o = vec4(c * vFade * depth * uBright, 1.0);
}`;

  const SEED = `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uSeed, uLife;
out vec4 o;
uint hashU(uint x){ x^=x>>16; x*=0x7feb352du; x^=x>>15; x*=0x846ca68bu; x^=x>>16; return x; }
float u2f(uint h){ return uintBitsToFloat((h >> 9u) | 0x3f800000u) - 1.0; }
void main(){
  uint sd = uint(gl_FragCoord.x)*1973u + uint(gl_FragCoord.y)*9277u + uint(uSeed*977.0);
  vec3 r = vec3(u2f(hashU(sd)), u2f(hashU(sd^0x9e37u)), u2f(hashU(sd^0x85ebu)));
  o = vec4(vec3(0.10,0.0,0.55) + (r*2.0-1.0)*0.85, uLife*u2f(hashU(sd^0xbeefu)));
}`;

  let pSim = null, pPt = null, pSeed = null;
  const LIFE = 34.0;

  scene({
    id: 'murmuration',
    name: 'Murmuration',
    medium: '262 144 agents · aizawa flow · hdr trails',
    chrome: '#e4dce2',
    dwell: 195,
    post: {
      exposure: 1.10, bloom: 0.22, bloomThreshold: 0.35, bloomKnee: 0.9,
      vignette: 0.36, ca: 0.6, grain: 0.012, grainSize: 1.6
    },
    info: { on: true, pos: 'tl' },
    themes: [
      ['Plum Dusk', '#241C2C', '#3A2C3E', '#12101A', '#4B4753', '#9A96A3', '#E4DCE2'],
      ['Winter', '#1C2026', '#2A323A', '#0E1216', '#46505A', '#96A2AC', '#DCE8F0'],
      ['Golden Hour', '#2C1F14', '#42301C', '#160F0A', '#5A4A38', '#B09A78', '#F2DCB4'],
      ['Teal Night', '#142024', '#1E3236', '#0A1214', '#3A5258', '#8AA6AA', '#D4ECEC'],
      ['Pale Dawn', '#26222C', '#463C46', '#14121A', '#524E5A', '#A89AA6', '#F0E2DC']
    ],
    alloc(s, w, h) {
      if (!pSim) {
        pSim = new Program(SIM, null, 'flockSim'); pSim.compile();
        pPt = new Program(PT_FS, PT_VS, 'flockPts'); pPt.compile();
        pSeed = new Program(SEED, null, 'flockSeed'); pSeed.compile();
      }
      if (!s.pos) {
        s.pos = new PingPong(PW, PH, { internalFormat: gl.RGBA32F, filter: gl.NEAREST });
        this.doSeed(s);
      }
      if (s.trail) s.trail.dispose();
      s.trail = new Trail(w, h);
    },
    resize(s, w, h) { this.alloc(s, w, h); },
    doSeed(s) {
      bindRT(s.pos.write); gl.disable(gl.BLEND);
      pSeed.use(); pSeed.set('uSeed', Math.random() * 900).set('uLife', LIFE);
      drawTri(); s.pos.swap();
    },
    reseed(s, manual) { if (s.pos && manual) this.doSeed(s); },
    sim(s, dt) {
      const st = App.simTime;
      const step = Math.min(dt, 1 / 30) * (App.reduced ? 0.35 : 1.0);
      bindRT(s.pos.write); gl.disable(gl.BLEND);
      pSim.use();
      pSim.tex('uPos', s.pos.read.tex, 0);
      pSim.set('uTex', 1 / PW, 1 / PH);
      pSim.set('uDt', step);
      pSim.set('uSwirl', 0.90 + 0.22 * Math.sin(st * 0.0071));
      pSim.set('uNoise', 0.055 + 0.030 * Math.sin(st * 0.0113));
      pSim.set('uLife', LIFE);
      pSim.set('uFrame', App.frame % 65536);
      drawTri(); s.pos.swap();
    },
    draw(s, target) {
      const st = App.simTime;
      s.trail.begin(0.945);
      pPt.use();
      pPt.tex('uPos', s.pos.read.tex, 0);
      pPt.set('uRes', App.rw, App.rh);
      pPt.set('uDrift', App.driftX, App.driftY);
      pPt.set('uYaw', (st * 0.0163) % TAU);
      pPt.set('uPitch', 0.34 + 0.26 * Math.sin(st * 0.00521));
      pPt.set('uDist', 12.9 + 1.4 * Math.sin(st * 0.00337));
      pPt.set('uFocal', 2.05);
      pPt.set('uLife', LIFE);
      pPt.set('uBright', 0.0138 * s._density);
      pPt.set('uCFar', palv(s, 3)); pPt.set('uCNear', palv(s, 4)); pPt.set('uCLit', palv(s, 5));
      pPt.seti('uW', PW);
      gl.drawArrays(gl.POINTS, 0, N);
      s.trail.end();

      bindRT(target);
      const p = progOf(s);
      p.use(); setCommon(p, s);
      p.tex('uTrail', s.trail.tex, 0);
      drawTri();
    },
    frag: frag(`
uniform sampler2D uTrail;
#define C_SKYT uPal[0]
#define C_SKYB uPal[1]
#define C_VOID uPal[2]
void main(){
  vec2 uv = UVf();
  vec3 sky = mix(C_SKYB, C_SKYT, smoothstep(0.05, 1.0, uv.y));
  sky *= 0.30 + 0.42*smoothstep(0.02, 0.62, uv.y);
  sky = mix(C_VOID*1.1, sky, smoothstep(-0.30, 0.42, uv.y));
  sky *= 0.85 + 0.30*fbm2(uv*vec2(2.2,1.4) + uClocks.x*0.2, 3);
  vec3 birds = texture(uTrail, UVf()).rgb;
  fragColor = vec4(max(sky + birds, 0.0), 1.0);
}
`)
  });
})();
