/* ================================================================== *
 *  Post chain:  sceneHDR -> [mix] -> bloom -> composite -> RGBA8
 * ================================================================== */

const POST_HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 fragColor;
`;

const P_MIX = new Program(POST_HEAD + `
uniform sampler2D uA, uB;
uniform float uT;
void main(){
  vec3 a = texture(uA, vUv).rgb;
  vec3 b = texture(uB, vUv).rgb;
  fragColor = vec4(mix(a, b, uT), 1.0);
}`, null, 'mix');

const P_BLIT = new Program(POST_HEAD + `
uniform sampler2D uT;
void main(){ fragColor = texture(uT, vUv); }`, null, 'blit');

const DOWN_SRC = POST_HEAD + `
uniform sampler2D uT;
uniform vec2 uTx;
uniform float uKaris;
uniform float uThreshold, uKnee;
uniform float uPrefilter;
float kw(vec3 c){ return 1.0/(1.0 + dot(c, vec3(0.2126,0.7152,0.0722))); }
vec3 pre(vec3 c){
  if(uPrefilter < 0.5) return c;
  float br = max(c.r, max(c.g, c.b));
  float knee = uThreshold*uKnee + 1e-5;
  float soft = clamp(br - uThreshold + knee, 0.0, 2.0*knee);
  soft = soft*soft/(4.0*knee);
  return c * max(soft, br - uThreshold) / max(br, 1e-4);
}
vec3 T(vec2 o){ return pre(max(texture(uT, vUv + o*uTx).rgb, vec3(0.0))); }
void main(){
  vec3 a=T(vec2(-2, 2)), b=T(vec2(0, 2)), c=T(vec2(2, 2));
  vec3 d=T(vec2(-2, 0)), e=T(vec2(0, 0)), f=T(vec2(2, 0));
  vec3 g=T(vec2(-2,-2)), h=T(vec2(0,-2)), i=T(vec2(2,-2));
  vec3 j=T(vec2(-1, 1)), k=T(vec2(1, 1));
  vec3 l=T(vec2(-1,-1)), m=T(vec2(1,-1));
  vec3 g0=(a+b+d+e)*0.25, g1=(b+c+e+f)*0.25, g2=(d+e+g+h)*0.25,
       g3=(e+f+h+i)*0.25, g4=(j+k+l+m)*0.25;
  vec3 flat_ = g0*0.125 + g1*0.125 + g2*0.125 + g3*0.125 + g4*0.5;
  float w0=kw(g0), w1=kw(g1), w2=kw(g2), w3=kw(g3), w4=kw(g4);
  float s = w0*0.125+w1*0.125+w2*0.125+w3*0.125+w4*0.5;
  vec3 karis = (g0*w0*0.125+g1*w1*0.125+g2*w2*0.125+g3*w3*0.125+g4*w4*0.5)/max(s,1e-5);
  fragColor = vec4(mix(flat_, karis, uKaris), 1.0);
}`;
const P_DOWN = new Program(DOWN_SRC, null, 'bloomDown');

const P_UP = new Program(POST_HEAD + `
uniform sampler2D uT;
uniform vec2 uTx;
uniform float uR;
void main(){
  vec4 o = vec4(1.0, 1.0, -1.0, 0.0) * uR;
  vec3 s = texture(uT, vUv - o.xy*uTx).rgb
         + texture(uT, vUv - o.wy*uTx).rgb * 2.0
         + texture(uT, vUv - o.zy*uTx).rgb
         + texture(uT, vUv + o.zw*uTx).rgb * 2.0
         + texture(uT, vUv            ).rgb * 4.0
         + texture(uT, vUv + o.xw*uTx).rgb * 2.0
         + texture(uT, vUv + o.zy*uTx).rgb
         + texture(uT, vUv + o.wy*uTx).rgb * 2.0
         + texture(uT, vUv + o.xy*uTx).rgb;
  fragColor = vec4(s * (1.0/16.0), 1.0);
}`, null, 'bloomUp');

const P_COMP = new Program(POST_HEAD + `
uniform sampler2D uScene, uBloom;
uniform vec2  uRes;
uniform float uExposure, uBloomAmt, uVignette, uCA, uBarrel;
uniform float uGrain, uGrainSize;
uniform vec3  uTint;
uniform float uDim;
uniform float uFade;
uniform int   uFrame;
uniform float uAnaX;

float ign(vec2 p, int f){
  p += 5.588238 * float(f & 63);
  return fract(52.9829189 * fract(0.06711056*p.x + 0.00583715*p.y));
}
float hash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx)*0.1031);
  p3 += dot(p3, p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}
vec3 linearToSRGB(vec3 c){
  c = max(c, vec3(0.0));
  return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(vec3(0.0031308), c));
}
const mat3 AGX_IN  = mat3(0.856627153315983, 0.137318972929847, 0.111898212999950,
                          0.095121240538159, 0.761241990602591, 0.076799418603190,
                          0.048251606145858, 0.101439036467562, 0.811302368396859);
const mat3 AGX_OUT = mat3( 1.127100581814437,-0.141329763498438,-0.141329763498438,
                          -0.110606643096603, 1.157823702216272,-0.110606643096603,
                          -0.016493938717835,-0.016493938717834, 1.251936406595041);
const mat3 SRGB_TO_2020 = mat3(0.6274,0.0691,0.0164, 0.3293,0.9195,0.0880, 0.0433,0.0113,0.8956);
const mat3 R2020_TO_SRGB = mat3( 1.6605,-0.1246,-0.0182, -0.5876,1.1329,-0.1006, -0.0728,-0.0083,1.1187);
vec3 agxCurve(vec3 x){
  vec3 x2 = x*x, x4 = x2*x2;
  return 15.5*x4*x2 - 40.14*x4*x + 31.96*x4 - 6.868*x2*x + 0.4298*x2 + 0.1191*x - 0.00232;
}
vec3 tonemapAgX(vec3 c){
  c = SRGB_TO_2020 * max(c, vec3(0.0));
  c = AGX_IN * c;
  c = log2(max(c, vec3(1e-10)));
  c = (c + 12.47393) / (4.026069 + 12.47393);
  c = clamp(c, 0.0, 1.0);
  c = agxCurve(c);
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  c = clamp(mix(vec3(l), c, 1.18), 0.0, 1.0);
  c = AGX_OUT * c;
  c = pow(max(c, vec3(0.0)), vec3(2.2));
  c = R2020_TO_SRGB * c;
  return clamp(c, 0.0, 1.0);
}

void main(){
  vec2 uv = vUv;
  if(uBarrel > 0.0001){
    vec2 p = (uv-0.5)*2.0;
    float r2 = dot(p,p);
    p *= 1.0 + uBarrel*r2 + uBarrel*0.35*r2*r2;
    uv = p*0.5 + 0.5;
  }
  vec2 d = uv - 0.5;
  vec3 hdr;
  if(uCA > 0.0001){
    vec2 dir = d * dot(d,d) * (uCA / (0.25 * uRes.x));
    hdr.r = texture(uScene, uv + dir*1.0).r;
    hdr.g = texture(uScene, uv).g;
    hdr.b = texture(uScene, uv - dir*1.0).b;
    hdr.r = mix(hdr.r, texture(uScene, uv + dir*0.5).r, 0.5);
    hdr.b = mix(hdr.b, texture(uScene, uv - dir*0.5).b, 0.5);
  } else {
    hdr = texture(uScene, uv).rgb;
  }
  hdr = max(hdr, vec3(0.0));

  vec3 bl = texture(uBloom, uv).rgb;
  if(uAnaX > 0.001){
    vec2 tx = vec2(1.0/uRes.x, 0.0) * 3.0;
    bl = (bl*2.0
       + texture(uBloom, uv + tx*(1.0+uAnaX*3.0)).rgb
       + texture(uBloom, uv - tx*(1.0+uAnaX*3.0)).rgb
       + texture(uBloom, uv + tx*(2.5+uAnaX*7.0)).rgb*0.6
       + texture(uBloom, uv - tx*(2.5+uAnaX*7.0)).rgb*0.6) / 6.2;
  }
  hdr += bl * uBloomAmt;
  hdr *= uExposure;

  float aspect = uRes.x/uRes.y;
  float r = length((uv-0.5)*vec2(aspect,1.0)) * 1.4142 / max(aspect,1.0) * 1.15;
  float vg = smoothstep(1.06, 0.30, r);
  hdr *= mix(1.0, vg, uVignette);

  hdr *= uTint * uDim * uFade;
  hdr += (ign(gl_FragCoord.xy, uFrame) - 0.5) * 1.2e-4;

  vec3 ldr = tonemapAgX(hdr);
  vec3 disp = linearToSRGB(ldr);

  if(uGrain > 0.0001){
    int gF = uFrame / 3;
    vec2 gp = gl_FragCoord.xy / uGrainSize;
    vec2 gi = floor(gp), gf = fract(gp);
    gf = gf*gf*(3.0-2.0*gf);
    float fo = float(gF)*17.0;
    float n = mix(mix(hash21(gi+vec2(0,0)+fo), hash21(gi+vec2(1,0)+fo), gf.x),
                  mix(hash21(gi+vec2(0,1)+fo), hash21(gi+vec2(1,1)+fo), gf.x), gf.y);
    n = n*2.0-1.0;
    float l = dot(disp, vec3(0.2126,0.7152,0.0722));
    disp *= 1.0 + n * (uGrain * 4.0 * l * (1.0-l) + uGrain*0.22);
  }

  float n1 = ign(gl_FragCoord.xy, uFrame);
  float n2 = ign(gl_FragCoord.xy + 71.3, uFrame + 37);
  disp += (n1 - n2) * (1.0/255.0);

  fragColor = vec4(disp, 1.0);
}`, null, 'composite');

const Post = {
  hdrA: null, hdrB: null, hdrMix: null,
  mips: [], w: 0, h: 0,
  MIPS: 5,
  alloc(w, h) {
    this.free();
    this.w = w; this.h = h;
    const o = { internalFormat: gl.RGBA16F, filter: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE };
    this.hdrA = makeRT(w, h, o);
    this.hdrB = makeRT(w, h, o);
    this.hdrMix = makeRT(w, h, o);
    this.mips = [];
    let mw = Math.max(2, w >> 1), mh = Math.max(2, h >> 1);
    for (let i = 0; i < this.MIPS; i++) {
      this.mips.push(makeRT(mw, mh, o));
      mw = Math.max(2, mw >> 1); mh = Math.max(2, mh >> 1);
    }
  },
  free() {
    [this.hdrA, this.hdrB, this.hdrMix].forEach(r => r && r.dispose());
    this.mips.forEach(r => r.dispose());
    this.hdrA = this.hdrB = this.hdrMix = null; this.mips = [];
  },
  bloom(srcTex, threshold, knee) {
    gl.disable(gl.BLEND);
    for (let i = 0; i < this.mips.length; i++) {
      const dst = this.mips[i];
      const src = i === 0 ? srcTex : this.mips[i - 1].tex;
      const sw = i === 0 ? this.w : this.mips[i - 1].w;
      const sh = i === 0 ? this.h : this.mips[i - 1].h;
      bindRT(dst);
      P_DOWN.use();
      P_DOWN.tex('uT', src, 0);
      P_DOWN.set('uTx', 1 / sw, 1 / sh);
      P_DOWN.set('uKaris', i === 0 ? 1 : 0);
      P_DOWN.set('uPrefilter', i === 0 ? 1 : 0);
      P_DOWN.set('uThreshold', threshold);
      P_DOWN.set('uKnee', knee);
      drawTri();
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.mips.length - 1; i > 0; i--) {
      const src = this.mips[i], dst = this.mips[i - 1];
      bindRT(dst);
      P_UP.use();
      P_UP.tex('uT', src.tex, 0);
      P_UP.set('uTx', 1 / src.w, 1 / src.h);
      P_UP.set('uR', 1.15);
      drawTri();
    }
    gl.disable(gl.BLEND);
    return this.mips[0].tex;
  }
};
