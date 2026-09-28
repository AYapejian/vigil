/* ================================================================== *
 *  Kit — shared machinery for the physics / procedural scenes
 *    Mesh      CPU-built geometry (strokes, discs, triangles) → one VBO
 *    Trail     decaying accumulation layer at render resolution
 *    Particles GPGPU 2D particle boilerplate (MRT pos+vel, points)
 * ================================================================== */

/* ---------- Mesh ---------- */
const MESH_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;   // render pixels, y up
layout(location=1) in vec4 aCol;
layout(location=2) in vec2 aE;     // (edge -1..1, half width px)
uniform vec2 uRes, uDrift;
out vec4 vCol; out vec2 vE;
void main(){
  vec2 p = (aPos + uDrift) / uRes * 2.0 - 1.0;
  gl_Position = vec4(p, 0.0, 1.0);
  gl_PointSize = 2.0;
  vCol = aCol; vE = aE;
}`;
const MESH_FS = `#version 300 es
precision highp float;
in vec4 vCol; in vec2 vE;
out vec4 o;
void main(){
  float cov = vE.y > 50.0 ? 1.0 : clamp((1.0 - abs(vE.x)) * vE.y * 1.6, 0.0, 1.0);
  cov = cov*cov*(3.0 - 2.0*cov);
  o = vec4(vCol.rgb * cov * vCol.a, cov * vCol.a);   // premultiplied
}`;
function blendOver(){ gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
function blendAdd(){ gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); }
let P_MESH = null;

class Mesh {
  constructor(maxVerts) {
    this.max = maxVerts;
    this.buf = new Float32Array(maxVerts * 8);
    this.n = 0;
    this.vbo = gl.createBuffer();
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.buf.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
    gl.bindVertexArray(App.vao);
    if (!P_MESH) { P_MESH = new Program(MESH_FS, MESH_VS, 'mesh'); P_MESH.compile(); }
  }
  begin() { this.n = 0; }
  vert(x, y, r, g, b, a, e, w) {
    if (this.n >= this.max) return;
    const i = this.n * 8, B = this.buf;
    B[i] = x; B[i + 1] = y; B[i + 2] = r; B[i + 3] = g; B[i + 4] = b; B[i + 5] = a; B[i + 6] = e; B[i + 7] = w;
    this.n++;
  }
  /* anti-aliased stroke, optional second colour at the far end */
  stroke(x0, y0, x1, y1, w, c, a, c1, a1) {
    let dx = x1 - x0, dy = y1 - y0;
    const l = Math.hypot(dx, dy); if (l < 1e-4) return;
    const hw = Math.max(w * 0.5, 0.6) + 0.7;
    const nx = -dy / l * hw, ny = dx / l * hw;
    const e = hw;
    c1 = c1 || c; a1 = (a1 === undefined) ? a : a1;
    this.vert(x0 + nx, y0 + ny, c[0], c[1], c[2], a, 1, e);
    this.vert(x0 - nx, y0 - ny, c[0], c[1], c[2], a, -1, e);
    this.vert(x1 + nx, y1 + ny, c1[0], c1[1], c1[2], a1, 1, e);
    this.vert(x1 + nx, y1 + ny, c1[0], c1[1], c1[2], a1, 1, e);
    this.vert(x0 - nx, y0 - ny, c[0], c[1], c[2], a, -1, e);
    this.vert(x1 - nx, y1 - ny, c1[0], c1[1], c1[2], a1, -1, e);
  }
  /* soft disc: fan of n triangles, edge attr gives AA rim */
  disc(x, y, r, c, a, n) {
    n = n || 10;
    const hw = r;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU, a1 = (i + 1) / n * TAU;
      this.vert(x, y, c[0], c[1], c[2], a, 0, hw);
      this.vert(x + Math.cos(a0) * r, y + Math.sin(a0) * r, c[0], c[1], c[2], a, 1, hw);
      this.vert(x + Math.cos(a1) * r, y + Math.sin(a1) * r, c[0], c[1], c[2], a, 1, hw);
    }
  }
  tri(x0, y0, x1, y1, x2, y2, c, a) {
    this.vert(x0, y0, c[0], c[1], c[2], a, 0, 100);
    this.vert(x1, y1, c[0], c[1], c[2], a, 0, 100);
    this.vert(x2, y2, c[0], c[1], c[2], a, 0, 100);
  }
  /* triangle with per-vertex colour (for lit meshes) */
  tri3(x0, y0, c0, x1, y1, c1, x2, y2, c2, a) {
    this.vert(x0, y0, c0[0], c0[1], c0[2], a, 0, 100);
    this.vert(x1, y1, c1[0], c1[1], c1[2], a, 0, 100);
    this.vert(x2, y2, c2[0], c2[1], c2[2], a, 0, 100);
  }
  draw(mode) {
    if (this.n === 0) return;
    P_MESH.use();
    P_MESH.set('uRes', App.rw, App.rh);
    P_MESH.set('uDrift', App.driftX, App.driftY);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.buf, 0, this.n * 8);
    gl.drawArrays(mode || gl.TRIANGLES, 0, this.n);
    gl.bindVertexArray(App.vao);
  }
  dispose() { gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao); }
}

/* ---------- Trail layer ---------- */
const P_DECAY = new Program(`#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
uniform sampler2D uT;
uniform float uDecay;
out vec4 o;
void main(){
  vec3 c = texture(uT, vUv).rgb * uDecay;
  bvec3 ok = lessThan(abs(c), vec3(1.0e4));
  o = vec4(mix(vec3(0.0), c, vec3(ok)), 1.0);
}`, null, 'decay');

class Trail {
  constructor(w, h) {
    this.pp = new PingPong(w, h, { internalFormat: gl.RGBA16F, filter: gl.LINEAR });
    this.pp.rt.forEach(rt => { bindRT(rt); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); });
  }
  /* bind the write target with the previous frame faded in */
  begin(decay) {
    bindRT(this.pp.write); gl.disable(gl.BLEND);
    P_DECAY.use(); P_DECAY.tex('uT', this.pp.read.tex, 0); P_DECAY.set('uDecay', decay);
    drawTri();
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  }
  end() { gl.disable(gl.BLEND); this.pp.swap(); }
  get tex() { return this.pp.read.tex; }
  dispose() { this.pp.dispose(); }
}

/* ---------- 2D GPGPU particles ---------- */
const PART_HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
uniform sampler2D uPos, uVel;     // pos: x,y,age,seed   vel: vx,vy,extra,extra
uniform vec2  uRes;
uniform float uDt, uFrame, uLife, uDensity;
uniform vec4  uA, uB, uC, uD;     // scene parameters
layout(location=0) out vec4 outPos;
layout(location=1) out vec4 outVel;
#define PI 3.14159265359
#define TAU 6.28318530718
uint hashU(uint x){ x^=x>>16; x*=0x7feb352du; x^=x>>15; x*=0x846ca68bu; x^=x>>16; return x; }
float u2f(uint h){ return uintBitsToFloat((h >> 9u) | 0x3f800000u) - 1.0; }
vec4 rnd4(ivec2 c, float salt){
  uint s = uint(c.x)*1973u + uint(c.y)*9277u + uint(uFrame + salt)*26699u;
  return vec4(u2f(hashU(s)), u2f(hashU(s^0x9e37u)), u2f(hashU(s^0x85ebu)), u2f(hashU(s^0xdeadu)));
}
`;
const PART_PT_VS = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uPos, uVel;
uniform vec2 uRes, uDrift;
uniform int uW;
uniform float uLife;
out vec4 vP; out vec4 vV;
void main(){
  ivec2 c = ivec2(gl_VertexID % uW, gl_VertexID / uW);
  vP = texelFetch(uPos, c, 0);
  vV = texelFetch(uVel, c, 0);
  vec2 ndc = (vP.xy + uDrift) / uRes * 2.0 - 1.0;
  gl_Position = vec4(ndc, 0.0, 1.0);
  gl_PointSize = 1.0;
}`;

class Particles {
  /* w×h particles; simBody: GLSL main() that writes outPos/outVel; ptFS: point fragment shader */
  constructor(w, h, simBody, ptFS, seedBody) {
    this.w = w; this.h = h; this.n = w * h;
    this.pp = new PingPongMRT(w, h, [gl.RGBA32F, gl.RGBA32F]);
    this.sim = new Program(PART_HEAD + simBody, null, 'psim'); this.sim.compile();
    this.pt = new Program(ptFS, PART_PT_VS, 'ppt'); this.pt.compile();
    this.seedP = new Program(PART_HEAD + seedBody, null, 'pseed'); this.seedP.compile();
  }
  seed(setU) {
    const t = this.pp.write; t.bind();
    gl.disable(gl.BLEND);
    this.seedP.use();
    this.seedP.set('uRes', App.rw, App.rh);
    this.seedP.set('uFrame', App.frame % 65536);
    if (setU) setU(this.seedP);
    drawTri(); this.pp.swap();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  step(dt, setU) {
    const t = this.pp.write; t.bind();
    gl.disable(gl.BLEND);
    this.sim.use();
    this.sim.tex('uPos', this.pp.read.texs[0], 0);
    this.sim.tex('uVel', this.pp.read.texs[1], 1);
    this.sim.set('uRes', App.rw, App.rh);
    this.sim.set('uDt', dt);
    this.sim.set('uFrame', App.frame % 65536);
    if (setU) setU(this.sim);
    drawTri(); this.pp.swap();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  /* additive point splat into whatever target is bound */
  draw(setU) {
    this.pt.use();
    this.pt.tex('uPos', this.pp.read.texs[0], 0);
    this.pt.tex('uVel', this.pp.read.texs[1], 1);
    this.pt.set('uRes', App.rw, App.rh);
    this.pt.set('uDrift', App.driftX, App.driftY);
    this.pt.seti('uW', this.w);
    if (setU) setU(this.pt);
    gl.drawArrays(gl.POINTS, 0, this.n);
  }
  dispose() { this.pp.dispose(); }
}

/* deterministic PRNG per scene cycle */
function rng(seed) { return mulberry32(Math.floor(seed * 1e6) >>> 0); }
