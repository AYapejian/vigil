/* ---------------- 16 · HOURGLASS ----------------
   Granular physics as a block cellular automaton (Margolus neighbourhood):
   grains fall, slide, and find their angle of repose. When the top bulb
   is spent the glass turns over. */
(function () {
  const S = 256;
  const HDR = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
float hash21(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
bool inside(vec2 u){
  vec2 a = (u - vec2(0.5,0.755))/vec2(0.31,0.235);
  vec2 b = (u - vec2(0.5,0.245))/vec2(0.31,0.235);
  bool funnel = abs(u.y-0.5) < 0.17 && abs(u.x-0.5) < 0.012 + 1.9*pow(abs(u.y-0.5), 1.5);
  return dot(a,a) < 1.0 || dot(b,b) < 1.0 || funnel;
}
`;
  const P_INIT = new Program(HDR + `
uniform float uSeed;
void main(){
  vec2 u = vUv;
  if(!inside(u)){ o = vec4(1.0, 0.0, 0.0, 1.0); return; }
  vec2 a = (u - vec2(0.5,0.755))/vec2(0.31,0.235);
  float h = hash21(floor(u*256.0) + uSeed);
  bool sand = dot(a,a) < 0.90 && u.y > 0.585 && h > 0.04;
  o = sand ? vec4(0.5, hash21(floor(u*256.0)*1.7 + uSeed*3.0), 0.0, 1.0) : vec4(0.0, 0.0, 0.0, 1.0);
}`, null, 'hgInit');

  const P_STEP = new Program(HDR + `
uniform sampler2D uT;
uniform float uOff, uFrame;
int typ(vec4 v){ return int(v.r*2.0 + 0.5); }
vec4 cell(ivec2 c){
  if(c.x < 0 || c.y < 0 || c.x >= ${S} || c.y >= ${S}) return vec4(1.0,0.0,0.0,1.0);
  return texelFetch(uT, c, 0);
}
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  int off = int(uOff);
  ivec2 b = c - ((c - off) & 1);
  vec4 TL = cell(b + ivec2(0,1)), TR = cell(b + ivec2(1,1));
  vec4 BL = cell(b),              BR = cell(b + ivec2(1,0));
  vec4 E = vec4(0.0,0.0,0.0,1.0);
  float r = hash21(vec2(b) + uFrame*0.37);
  float r2 = hash21(vec2(b) * 1.3 + uFrame*0.11);
  vec4 t;
  /* fall */
  if(typ(TL)==1 && typ(BL)==0){ t = TL; TL = BL; BL = t; }
  if(typ(TR)==1 && typ(BR)==0){ t = TR; TR = BR; BR = t; }
  /* slide diagonally when blocked below */
  if(typ(TL)==1 && typ(BL)!=0 && typ(BR)==0 && typ(TR)==0 && r < 0.80){ BR = TL; TL = E; }
  else if(typ(TR)==1 && typ(BR)!=0 && typ(BL)==0 && typ(TL)==0 && r < 0.80){ BL = TR; TR = E; }
  /* angle of repose: a grain resting on a full row topples off a lone peak */
  else if(typ(TL)==1 && typ(TR)==0 && typ(BL)==1 && typ(BR)==1 && r2 < 0.04){ TR = TL; TL = E; }
  else if(typ(TR)==1 && typ(TL)==0 && typ(BL)==1 && typ(BR)==1 && r2 < 0.04){ TL = TR; TR = E; }
  ivec2 rel = c - b;
  o = (rel.y == 0) ? (rel.x == 0 ? BL : BR) : (rel.x == 0 ? TL : TR);
}`, null, 'hgStep');

  const P_FLIP = new Program(HDR + `
uniform sampler2D uT;
void main(){ o = texture(uT, vec2(1.0) - vUv); }`, null, 'hgFlip');

  scene({
    id: 'hourglass',
    name: 'Hourglass',
    medium: 'block cellular automaton · 65 536 cells · angle of repose',
    chrome: '#e8c890',
    dwell: 270,
    post: {
      exposure: 1.06, bloom: 0.10, bloomThreshold: 0.7, bloomKnee: 0.7,
      vignette: 0.46, ca: 0.6, grain: 0.012, grainSize: 1.5
    },
    themes: [
      ['Amber', '#0E0B08', '#1E1710', '#7A8A96', '#E8B860', '#B07830', '#C9A050'],
      ['Silver Sand', '#08090C', '#141620', '#8A98A8', '#E8ECF0', '#A8B0BC', '#C0C8D0'],
      ['Black Sand', '#0C0A0A', '#1A1616', '#8A8A96', '#3A3A44', '#1A1A22', '#C9A050'],
      ['Rose', '#100A0C', '#20141A', '#98808A', '#F0B8C8', '#B87A90', '#D8B0A0'],
      ['Verdigris', '#080C0C', '#121C1C', '#7A9A98', '#9AE0C8', '#4A9A88', '#B8A870']
    ],
    st: { timer: 0, flipping: false, flipT: 0, off: 0 },
    alloc(s) {
      s.pp = new PingPong(S, S, { internalFormat: gl.RGBA8, filter: gl.NEAREST });
      this.doInit(s);
    },
    doInit(s) {
      bindRT(s.pp.write); gl.disable(gl.BLEND);
      P_INIT.use(); P_INIT.set('uSeed', Math.random() * 100); drawTri(); s.pp.swap();
      s.st.timer = 0; s.st.flipping = false; s.st.flipT = 0;
    },
    reseed(s, manual) { if (manual && s.pp) this.doInit(s); },
    sim(s, dt) {
      const st = s.st;
      st.timer += dt;
      if (st.flipping) {
        st.flipT += dt / 1.9;
        if (st.flipT >= 1) {
          st.flipping = false; st.flipT = 0; st.timer = 0;
          bindRT(s.pp.write); gl.disable(gl.BLEND);
          P_FLIP.use(); P_FLIP.tex('uT', s.pp.read.tex, 0); drawTri(); s.pp.swap();
        }
        return;
      }
      if (st.timer > 128) { st.flipping = true; st.flipT = 0; return; }
      const steps = clamp(Math.round(2 * s._density), 1, 5);
      for (let i = 0; i < steps; i++) {
        bindRT(s.pp.write); gl.disable(gl.BLEND);
        P_STEP.use();
        P_STEP.tex('uT', s.pp.read.tex, 0);
        P_STEP.set('uOff', st.off); P_STEP.set('uFrame', (App.frame * 3 + i) % 4096);
        drawTri(); s.pp.swap();
        st.off ^= 1;
      }
    },
    uni(p, s) {
      const k = s.st.flipping ? smoothstep(0, 1, s.st.flipT) : 0;
      p.tex('uSim', s.pp.read.tex, 0);
      p.set('uRot', k * Math.PI);
    },
    frag: frag(`
uniform sampler2D uSim;
uniform float uRot;
#define C_BG    uPal[0]
#define C_BG2   uPal[1]
#define C_GLASS uPal[2]
#define C_SAND  uPal[3]
#define C_SAND2 uPal[4]
#define C_BRASS uPal[5]
const float N = ${S}.0;
vec4 cellAt(vec2 u){ return texelFetch(uSim, ivec2(clamp(floor(u*N), 0.0, N-1.0)), 0); }
int typ(vec4 v){ return int(v.r*2.0 + 0.5); }

void main(){
  vec2 p = NP();
  vec2 q = rot(uRot) * p;
  float ext = 0.90;
  vec2 u = q / ext * 0.5 + 0.5;

  /* room */
  vec3 col = mix(C_BG2, C_BG, smoothstep(0.0, 1.5, length(p*vec2(0.7,1.0))));
  col *= 0.85 + 0.30*fbm2(p*1.2 + 3.0, 3);
  /* table under the glass */
  float table = smoothstep(-0.86, -0.90, q.y) * smoothstep(0.95, 0.4, abs(q.x));
  col = mix(col, C_BRASS*0.35*(0.8+0.3*fbm2(p*vec2(3.0,20.0),3)), table*0.9);

  if(u.x > 0.0 && u.x < 1.0 && u.y > 0.0 && u.y < 1.0){
    vec4 v = cellAt(u);
    int t = typ(v);
    float px = 1.0/N;
    int tU = typ(cellAt(u + vec2(0.0, px)));
    int tD = typ(cellAt(u - vec2(0.0, px)));
    int tL = typ(cellAt(u - vec2(px, 0.0)));
    int tR = typ(cellAt(u + vec2(px, 0.0)));
    if(t == 2){
      /* wall: glass edge where it meets the cavity */
      bool edge = tU != 2 || tD != 2 || tL != 2 || tR != 2;
      int tU2 = typ(cellAt(u + vec2(0.0, 2.0*px))), tD2 = typ(cellAt(u - vec2(0.0, 2.0*px)));
      int tL2 = typ(cellAt(u - vec2(2.0*px, 0.0))), tR2 = typ(cellAt(u + vec2(2.0*px, 0.0)));
      bool edge2 = tU2 != 2 || tD2 != 2 || tL2 != 2 || tR2 != 2;
      if(edge) col += C_GLASS * 0.9;
      else if(edge2) col += C_GLASS * 0.35;
      /* brass caps top and bottom */
      if(abs(u.y - 0.5) > 0.47 && abs(u.x - 0.5) < 0.36){
        float cap = 0.6 + 0.4*sin(u.x*40.0)*0.2 + 0.3*(1.0 - abs(u.x-0.5)/0.36);
        col = mix(col, C_BRASS*cap, 0.9);
      }
    } else {
      /* inside the glass: faint glass tint + interior light */
      col = mix(col, col*0.7 + C_GLASS*0.05, 0.6);
      col += C_GLASS * 0.03 * (1.0 - abs(u.x-0.5)*2.0);
      if(t == 1){
        float sh = v.g;
        vec3 sc = mix(C_SAND2, C_SAND, sh);
        float light = 0.78;
        if(tU == 0) light += 0.40;          // top surface catches the light
        if(tL == 0) light += 0.14;
        if(tD == 0) light -= 0.10;
        col = sc * light * 1.05;
      }
    }
  }
  fragColor = vec4(max(col, 0.0), 1.0);
}
`)
  });
})();
