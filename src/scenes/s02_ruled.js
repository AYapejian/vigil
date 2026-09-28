/* ---------------- 02 · RULED SURFACE ----------------
   A hyperboloid of one sheet — but you watch it being drawn.
   Generators are laid down one straight line at a time; the curved
   surface simply appears. Build → hold → retract → begin again. */
(function () {
  const NPF_MAX = 150;
  const COMMON = `
uniform vec2  uRes;
uniform float uYaw, uPitch, uTwist, uR, uH, uDist, uFocal, uWidth;
uniform vec2  uOff, uDrift;
uniform float uBlue, uNPF, uReveal;
uniform vec3  uColMid, uColAcc, uColBlue, uColBone;
#define PI 3.14159265359
#define TAU 6.28318530718
`;

  const VS = `#version 300 es
precision highp float;
${COMMON}
out float vX;
out float vNear;
out float vFam;
out float vBlue;
out float vTip;

vec3 rotY(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }
vec3 rotX(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z); }

void proj(vec3 o, out vec2 ndc, out float near){
  vec3 w = vec3(o.x, o.z, o.y);
  w = rotY(w, uYaw);
  w = rotX(w, uPitch);
  w.z -= uDist;
  float z = max(-w.z, 0.08);
  ndc = vec2(w.x, w.y) * uFocal / z;
  ndc.x /= (uRes.x/uRes.y);
  ndc += uOff;
  near = clamp((uDist + 1.9 - z) / 3.8, 0.0, 1.0);
}

void main(){
  int vid = gl_VertexID;
  int quad = vid / 6;
  int corner = vid % 6;
  int npf = int(uNPF + 0.5);
  int fam = quad / npf;
  float idx = float(quad - fam*npf);
  vFam = float(fam);

  float order = float(fam)*uNPF + idx;
  float vis = uReveal - order;
  if(vis <= 0.0){ gl_Position = vec4(3.0, 3.0, 0.0, 1.0); vX = 0.0; return; }
  float part = clamp(vis, 0.0, 1.0);

  float th = (idx + 0.5*float(fam)) / uNPF * TAU;
  float tw = uTwist * (float(fam)*2.0 - 1.0);

  vec3 pb = vec3(cos(th - tw)*uR, sin(th - tw)*uR, -uH);
  vec3 pt = vec3(cos(th + tw)*uR, sin(th + tw)*uR,  uH);
  pt = mix(pb, pt, part);

  vec2 s0, s1; float n0, n1;
  proj(pb, s0, n0);
  proj(pt, s1, n1);

  int lut[6] = int[6](0,1,2, 2,1,3);
  int t = lut[corner];
  int end  = t >> 1;
  float side = float(t & 1)*2.0 - 1.0;

  float aspect = uRes.x/uRes.y;
  vec2 dd = (s1 - s0) * vec2(aspect, 1.0);
  float dl = max(length(dd), 1e-6);
  vec2 dir = dd / dl;
  vec2 nrm = vec2(-dir.y, dir.x) / vec2(aspect, 1.0);

  vec2 s = (end == 0) ? s0 : s1;
  float near = (end == 0) ? n0 : n1;
  float wpx = uWidth * mix(0.72, 1.18, near);
  float wndc = wpx / uRes.y * 2.0;

  s += nrm * side * wndc;
  s += uDrift / uRes * 2.0;

  vX = side;
  vNear = near;
  vBlue = (fam == 0 && abs(idx - uBlue) < 0.5) ? 1.0 : 0.0;
  vTip = (part < 1.0 && end == 1) ? 1.0 : 0.0;
  gl_Position = vec4(s, 0.0, 1.0);
}`;

  const FS = `#version 300 es
precision highp float;
${COMMON}
in float vX; in float vNear; in float vFam; in float vBlue; in float vTip;
out vec4 fragColor;
void main(){
  float hw = uWidth * mix(0.72, 1.18, vNear);
  float cov = clamp((1.0 - abs(vX)) * hw, 0.0, 1.0);
  cov *= cov * (3.0 - 2.0*cov);
  vec3 c = mix(uColAcc, uColMid, vFam);
  c = mix(c, uColBlue*2.2, vBlue);
  c += uColBone * vTip * 2.6;
  float depth = mix(0.26, 1.0, vNear*vNear);
  fragColor = vec4(c * cov * depth * 1.65, 1.0);
}`;

  const BG = frag(`
#define C_PAPER uPal[0]
void main(){
  vec2 p = NP();
  float grainTex = 0.70 + 0.30*fbm2(p*38.0, 2);
  float g = 1.0 - 0.24*length(p*vec2(0.55,0.9));
  vec2 h = p - vec2(0.25, -0.04);
  float halo = exp(-dot(h,h)*0.55);
  fragColor = vec4(C_PAPER * grainTex * max(g,0.0) * (3.2 + 3.4*halo), 1.0);
}`);

  let progLines = null, progBg = null;

  scene({
    id: 'ruled',
    name: 'Ruled Surface',
    medium: 'drawn one straight line at a time · hyperboloid',
    chrome: '#f4f3ef',
    dwell: 210,
    post: {
      exposure: 1.0, bloom: 0.055, bloomThreshold: 0.80, bloomKnee: 0.55,
      vignette: 0.22, ca: 0.0, grain: 0.009, grainSize: 1.35
    },
    themes: [
      ['Plotter Ink', '#0E0F12', '#52565E', '#C7C9CC', '#3A56E8', '#F4F3EF'],
      ['Blueprint', '#071020', '#42597E', '#AEC4E4', '#E8503A', '#F0F4FA'],
      ['Redline', '#120C0C', '#5E5252', '#CCC0BE', '#E83A3A', '#F4EFEF'],
      ['Gilt', '#0F0D08', '#5E5638', '#D4C088', '#3AE8C9', '#F8F0D8'],
      ['Phosphor', '#070C08', '#3A5E44', '#9ACCA8', '#E8E83A', '#E0FFE8']
    ],
    frag: BG,
    st: { blue: 11, mode: 'build', t: 0, reveal: 0, lines: 104 },
    demo(s) { s.st.mode = 'build'; s.st.reveal = 146; },
    reseed(s, manual) {
      if (!manual) return;
      s.st.mode = 'build'; s.st.reveal = 0; s.st.t = 0;
      s.st.blue = Math.floor(Math.random() * s.st.lines);
    },
    tick(s, dt) {
      const st = s.st;
      const total = st.lines * 2;
      st.t += dt;
      switch (st.mode) {
        case 'build':
          st.reveal += dt * (total / 72);
          if (st.reveal >= total) { st.reveal = total; st.mode = 'hold'; st.t = 0; }
          break;
        case 'hold':
          if (st.t > 62) { st.mode = 'retract'; st.t = 0; }
          break;
        case 'retract':
          st.reveal -= dt * (total / 34);
          if (st.reveal <= 0) { st.reveal = 0; st.mode = 'pause'; st.t = 0; }
          break;
        case 'pause':
          if (st.t > 3.5) {
            st.mode = 'build'; st.t = 0;
            st.lines = clamp(Math.round(104 * s._density), 36, NPF_MAX);
            st.blue = Math.floor(Math.random() * st.lines);
          }
          break;
      }
    },
    draw(s, target) {
      if (!progBg) { progBg = new Program(BG, null, 'ruledBg'); progBg.compile(); }
      if (!progLines) { progLines = new Program(FS, VS, 'ruledLines'); progLines.compile(); }
      const st = App.simTime, S = s.st;
      bindRT(target);
      gl.disable(gl.BLEND);
      progBg.use(); setCommon(progBg, s); drawTri();

      const nLines = Math.min(S.lines * 2, Math.floor(S.reveal) + 1);
      if (nLines <= 0 || S.reveal <= 0) return;

      const twist = 0.72 + 0.62 * Math.sin(st * 0.00713) + 0.14 * Math.sin(st * 0.0231);
      const p = progLines.use();
      p.set('uRes', App.rw, App.rh);
      p.set('uDrift', App.driftX, App.driftY);
      p.set('uYaw', (st * 0.0421) % TAU);
      p.set('uPitch', 0.30 + 0.20 * Math.sin(st * 0.01109));
      p.set('uTwist', twist);
      p.set('uR', 1.30); p.set('uH', 1.16);
      p.set('uDist', 4.85 + 0.28 * Math.sin(st * 0.00531));
      p.set('uFocal', 2.62);
      p.set('uWidth', 0.72);
      p.set('uOff', 0.14 + 0.05 * Math.sin(st * 0.0091), -0.04);
      p.set('uBlue', S.blue);
      p.set('uNPF', S.lines);
      p.set('uReveal', S.reveal);
      p.set('uColMid', palv(s, 1));
      p.set('uColAcc', palv(s, 2));
      p.set('uColBlue', palv(s, 3));
      p.set('uColBone', palv(s, 4));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.TRIANGLES, 0, 6 * nLines);
      gl.disable(gl.BLEND);
    }
  });
})();
