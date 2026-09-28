/* ================================================================== *
 *  GL layer
 * ================================================================== */

const canvas = document.getElementById('c');
let gl = null;

function makeContext() {
  const g = canvas.getContext('webgl2', {
    alpha: false, depth: false, stencil: false, antialias: false,
    premultipliedAlpha: false, powerPreference: 'high-performance',
    desynchronized: true, preserveDrawingBuffer: false
  });
  if (!g) return null;
  if (!g.getExtension('EXT_color_buffer_float')) return null;
  g.getExtension('OES_texture_float_linear');
  g.getExtension('EXT_float_blend');
  return g;
}

/* ---------- render targets ---------- */
function makeRT(w, h, o) {
  o = o || {};
  const internalFormat = o.internalFormat || gl.RGBA16F;
  const filter = o.filter || gl.LINEAR;
  const wrap = o.wrap || gl.CLAMP_TO_EDGE;
  w = Math.max(1, w | 0); h = Math.max(1, h | 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, internalFormat, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return {
    tex, fbo, w, h, internalFormat, filter, wrap,
    dispose() { gl.deleteFramebuffer(fbo); gl.deleteTexture(tex); }
  };
}

function makeMRT(w, h, formats) {
  const texs = formats.map(f => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, f, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  });
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  texs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return {
    texs, fbo, w, h,
    bind() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.drawBuffers(texs.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
      gl.viewport(0, 0, w, h);
    },
    dispose() { gl.deleteFramebuffer(fbo); texs.forEach(t => gl.deleteTexture(t)); }
  };
}

class PingPong {
  constructor(w, h, opts) { this.rt = [makeRT(w, h, opts), makeRT(w, h, opts)]; this.i = 0; }
  get read() { return this.rt[this.i]; }
  get write() { return this.rt[this.i ^ 1]; }
  swap() { this.i ^= 1; }
  dispose() { this.rt[0].dispose(); this.rt[1].dispose(); }
}
class PingPongMRT {
  constructor(w, h, f) { this.rt = [makeMRT(w, h, f), makeMRT(w, h, f)]; this.i = 0; }
  get read() { return this.rt[this.i]; }
  get write() { return this.rt[this.i ^ 1]; }
  swap() { this.i ^= 1; }
  dispose() { this.rt[0].dispose(); this.rt[1].dispose(); }
}

/* ---------- programs ---------- */
const VS_TRI = `#version 300 es
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

class Program {
  constructor(fsBody, vsSrc, name) {
    this.name = name || 'prog';
    this.vsSrc = vsSrc || VS_TRI;
    this.fsSrc = fsBody;
    this.id = null; this.loc = new Map(); this.ok = false;
  }
  compile() {
    if (this.id) return this.ok;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, this.vsSrc); gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, this.fsSrc); gl.compileShader(fs);
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const vlog = gl.getShaderInfoLog(vs), flog = gl.getShaderInfoLog(fs);
      console.error('[VIGIL] shader "' + this.name + '" failed');
      if (vlog) console.error('VS:', vlog);
      if (flog) console.error('FS:', flog);
      console.error(gl.getProgramInfoLog(p));
      this.ok = false;
    } else this.ok = true;
    gl.deleteShader(vs); gl.deleteShader(fs);
    this.id = p;
    return this.ok;
  }
  use() { this.compile(); gl.useProgram(this.id); return this; }
  u(n) {
    let l = this.loc.get(n);
    if (l === undefined) { l = gl.getUniformLocation(this.id, n); this.loc.set(n, l); }
    return l;
  }
  set(n, a, b, c, d) {
    const l = this.u(n); if (l === null) return this;
    if (b === undefined) {
      if (typeof a === 'number') gl.uniform1f(l, a);
      else if (a.length === 2) gl.uniform2fv(l, a);
      else if (a.length === 3) gl.uniform3fv(l, a);
      else if (a.length === 4) gl.uniform4fv(l, a);
      else if (a.length === 9) gl.uniformMatrix3fv(l, false, a);
      else if (a.length === 16) gl.uniformMatrix4fv(l, false, a);
    }
    else if (c === undefined) gl.uniform2f(l, a, b);
    else if (d === undefined) gl.uniform3f(l, a, b, c);
    else gl.uniform4f(l, a, b, c, d);
    return this;
  }
  seti(n, v) { const l = this.u(n); if (l !== null) gl.uniform1i(l, v); return this; }
  tex(n, t, unit) {
    const l = this.u(n); if (l === null) return this;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1i(l, unit);
    return this;
  }
  dispose() { if (this.id) gl.deleteProgram(this.id); this.id = null; this.loc.clear(); }
}

function bindRT(rt) {
  if (rt) { gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo); gl.viewport(0, 0, rt.w, rt.h); }
  else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); }
}
function drawTri() { gl.drawArrays(gl.TRIANGLES, 0, 3); }

/* ================================================================== *
 *  GLSL prelude — shared by every scene fragment shader
 * ================================================================== */
const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform vec2  uRes;
uniform vec2  uDrift;
uniform float uTime;
uniform vec4  uClocks;
uniform vec4  uClocks2;
uniform float uMood;
uniform float uSeed;
uniform float uMotion;
uniform int   uFrame;
uniform vec3  uPal[8];
uniform float uDensity;
out vec4 fragColor;

#define PI  3.14159265359
#define TAU 6.28318530718

vec2  PX()  { return gl_FragCoord.xy + uDrift; }
vec2  UVf() { return PX() / uRes; }
vec2  NP()  { return (PX() * 2.0 - uRes) / uRes.y; }
float ASPECT() { return uRes.x / uRes.y; }

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }

uint hashU(uint x){ x^=x>>16; x*=0x7feb352du; x^=x>>15; x*=0x846ca68bu; x^=x>>16; return x; }
float u2f(uint h){ return uintBitsToFloat((h >> 9u) | 0x3f800000u) - 1.0; }
float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx)*0.1031);
  p3 += dot(p3, p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}
vec2 hash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));
  p3 += dot(p3, p3.yzx+33.33);
  return fract((p3.xx+p3.yz)*p3.zy);
}
vec3 hash33(vec3 p3){
  p3 = fract(p3*vec3(0.1031,0.1030,0.0973));
  p3 += dot(p3, p3.yxz+33.33);
  return fract((p3.xxy+p3.yxx)*p3.zyx);
}
vec3 hash31(float p){
  vec3 p3 = fract(vec3(p)*vec3(0.1031,0.1030,0.0973));
  p3 += dot(p3, p3.yzx+33.33);
  return fract((p3.xxy+p3.yzz)*p3.zyx);
}
float ign(vec2 p, int f){
  p += 5.588238 * float(f & 63);
  return fract(52.9829189 * fract(0.06711056*p.x + 0.00583715*p.y));
}

float vnoise2(vec2 x){
  vec2 i = floor(x), f = fract(x);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(hash21(i), hash21(i+vec2(1,0)), u.x),
             mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), u.x), u.y)*2.0-1.0;
}
float vnoise3(vec3 x){
  vec3 i = floor(x), f = fract(x);
  vec3 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  float a = hash33(i).x,               b = hash33(i+vec3(1,0,0)).x;
  float c = hash33(i+vec3(0,1,0)).x,   d = hash33(i+vec3(1,1,0)).x;
  float e = hash33(i+vec3(0,0,1)).x,   g = hash33(i+vec3(1,0,1)).x;
  float h = hash33(i+vec3(0,1,1)).x,   k = hash33(i+vec3(1,1,1)).x;
  return mix(mix(mix(a,b,u.x), mix(c,d,u.x), u.y),
             mix(mix(e,g,u.x), mix(h,k,u.x), u.y), u.z)*2.0-1.0;
}
float snoise2(vec2 p){
  const float K1 = 0.366025404, K2 = 0.211324865;
  vec2 i = floor(p + (p.x+p.y)*K1);
  vec2 a = p - i + (i.x+i.y)*K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0-m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0*K2;
  vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
  vec3 n = h*h*h*h * vec3(dot(a, hash22(i)*2.0-1.0),
                          dot(b, hash22(i+o)*2.0-1.0),
                          dot(c, hash22(i+1.0)*2.0-1.0));
  return dot(n, vec3(70.0));
}

const mat2 R2 = mat2(0.80,0.60,-0.60,0.80);
const mat3 R3 = mat3(0.00,0.80,0.60, -0.80,0.36,-0.48, -0.60,-0.48,0.64);

float fbm2(vec2 p, int oct){
  float a = 0.5, s = 0.0, n = 0.0;
  for(int i=0;i<8;i++){ if(i>=oct) break;
    s += a*snoise2(p); n += a; p = R2*p*1.97; a *= 0.5; }
  return s/max(n,1e-5);
}
float fbm3(vec3 p, int oct){
  float a = 0.5, s = 0.0, n = 0.0;
  for(int i=0;i<8;i++){ if(i>=oct) break;
    s += a*vnoise3(p); n += a; p = R3*p*1.93; a *= 0.5; }
  return s/max(n,1e-5);
}
float fbmBillow(vec3 p, int oct){
  float a = 0.5, s = 0.0, n = 0.0;
  for(int i=0;i<8;i++){ if(i>=oct) break;
    s += a*(abs(vnoise3(p))*2.0-1.0); n += a; p = R3*p*1.93; a *= 0.5; }
  return s/max(n,1e-5);
}
float fbmRidge(vec2 p, int oct){
  float a = 0.5, s = 0.0, n = 0.0, prev = 1.0;
  for(int i=0;i<8;i++){ if(i>=oct) break;
    float v = 1.0 - abs(snoise2(p)); v *= v;
    s += a*v*prev; prev = clamp(v,0.0,1.0);
    n += a; p = R2*p*1.97; a *= 0.5; }
  return s/max(n,1e-5);
}
vec3 worley2(vec2 p, float jitter, float anim){
  vec2 n = floor(p), f = p - n;
  float f1 = 8.0, f2 = 8.0, id = 0.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash22(n+g);
    o = 0.5 + jitter*cos(anim + TAU*o);
    float d = length(g+o-f);
    if(d < f1){ f2 = f1; f1 = d; id = hash21(n+g); }
    else if(d < f2){ f2 = d; }
  }
  return vec3(f1,f2,id);
}

vec4 sanitize(vec4 v, vec4 fb, float lim){
  bvec4 ok = lessThan(abs(v), vec4(lim));
  return mix(fb, v, vec4(ok));
}
vec3 safeNormalize(vec3 v){ float l2 = dot(v,v); return l2 > 1e-20 ? v*inversesqrt(l2) : vec3(0,0,1); }

float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
vec3 sRGBToLinear(vec3 c){
  c = clamp(c,0.0,1.0);
  return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 ramp3(vec3 a, vec3 b, vec3 c, float t){
  t = clamp(t,0.0,1.0);
  return t < 0.5 ? mix(a,b,t*2.0) : mix(b,c,(t-0.5)*2.0);
}
vec3 ramp5(vec3 a, vec3 b, vec3 c, vec3 d, vec3 e, float t){
  t = clamp(t,0.0,1.0)*4.0;
  if(t<1.0) return mix(a,b,t);
  if(t<2.0) return mix(b,c,t-1.0);
  if(t<3.0) return mix(c,d,t-2.0);
  return mix(d,e,t-3.0);
}

float cieX(float w){
  float t1=(w-442.0)*((w<442.0)?0.0624:0.0374);
  float t2=(w-599.8)*((w<599.8)?0.0264:0.0323);
  float t3=(w-501.1)*((w<501.1)?0.0490:0.0382);
  return 0.362*exp(-0.5*t1*t1)+1.056*exp(-0.5*t2*t2)-0.065*exp(-0.5*t3*t3);
}
float cieY(float w){
  float t1=(w-568.8)*((w<568.8)?0.0213:0.0247);
  float t2=(w-530.9)*((w<530.9)?0.0613:0.0322);
  return 0.821*exp(-0.5*t1*t1)+0.286*exp(-0.5*t2*t2);
}
float cieZ(float w){
  float t1=(w-437.0)*((w<437.0)?0.0845:0.0278);
  float t2=(w-459.0)*((w<459.0)?0.0385:0.0725);
  return 1.217*exp(-0.5*t1*t1)+0.681*exp(-0.5*t2*t2);
}
const mat3 XYZ_TO_LSRGB = mat3( 3.2404542,-0.9692660, 0.0556434,
                               -1.5371385, 1.8760108,-0.2040259,
                               -0.4985314, 0.0415560, 1.0572252);
vec3 cmfToRGB(float w){ return XYZ_TO_LSRGB * vec3(cieX(w), cieY(w), cieZ(w)); }

vec3 thinFilm(float cosTheta, float thicknessNm, float nFilm, float nBase){
  cosTheta = clamp(cosTheta, 1e-3, 1.0);
  float sinT2 = (1.0 - cosTheta*cosTheta)/(nFilm*nFilm);
  if(sinT2 >= 1.0) return vec3(1.0);
  float cosT = sqrt(max(0.0, 1.0 - sinT2));
  float opd = 2.0*nFilm*thicknessNm*cosT;
  float r0a = (1.0-nFilm)/(1.0+nFilm); r0a *= r0a;
  float R1 = r0a + (1.0-r0a)*pow(1.0-cosTheta, 5.0);
  float r0b = (nFilm-nBase)/(nFilm+nBase); r0b *= r0b;
  float R2 = r0b + (1.0-r0b)*pow(1.0-cosT, 5.0);
  float phi = PI*((nFilm>1.0)?1.0:0.0) - PI*((nBase>nFilm)?1.0:0.0);
  vec3 acc = vec3(0.0), wsum = vec3(0.0);
  for(int i=0;i<10;i++){
    float lam = mix(400.0, 700.0, (float(i)+0.5)/10.0);
    float delta = TAU*opd/lam + phi;
    float I = R1 + R2 + 2.0*sqrt(R1*R2)*cos(delta);
    vec3 w = max(cmfToRGB(lam), vec3(0.0));
    acc += I*w; wsum += w;
  }
  return max(acc/max(wsum, vec3(1e-4)), vec3(0.0));
}
`;
