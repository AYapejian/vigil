/* ================================================================== *
 *  Application
 * ================================================================== */

const App = {
  running: false, raf: 0, last: 0,
  frame: 0,
  simTime: 0,
  cur: 0, prev: -1,
  trans: null,
  slideshow: true,
  dwellLeft: 0,
  renderScale: 1.0, maxScale: 1.0,
  cssW: 0, cssH: 0, rw: 0, rh: 0,
  emaFrame: 16.7, slowFor: 0, fastFor: 0,
  fade: 0,
  nightMode: 'auto',
  reduced: false,
  speed: 1.0,
  infoMode: 'auto',
  driftCssX: 0, driftCssY: 0,
  quality: 'auto',
  err: 0,
  ready: false,
  vao: null
};

const MAX_PIXELS = 2560 * 1440;
const TRANS_DUR = 2.6;

function boot() {
  gl = makeContext();
  if (!gl) {
    const f = document.getElementById('fail');
    f.classList.add('show');
    f.innerHTML = 'VIGIL needs WebGL2 with float render targets.<br><br>' +
      'Try Chrome, Edge, or another Chromium browser<br>with hardware acceleration enabled.';
    return;
  }
  App.vao = gl.createVertexArray();
  gl.bindVertexArray(App.vao);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 1);

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); App.stop();
    toast('graphics context lost — restoring');
  });
  canvas.addEventListener('webglcontextrestored', () => { location.reload(); });

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  App.reduced = mq.matches;
  mq.addEventListener('change', e => { App.reduced = e.matches; });

  resize(true);
  window.addEventListener('resize', () => resize(false));

  App.dwellLeft = SCENES[App.cur].dwell;
  activate(App.cur, true);
  initUI();
  App.start();
  App.ready = true;
  setTimeout(() => { try { startConnectors(); } catch (e) { } }, 2500);
}

function resize(force) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const cw = Math.max(2, Math.round(window.innerWidth));
  const ch = Math.max(2, Math.round(window.innerHeight));
  App.cssW = cw; App.cssH = ch;
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';

  let base = App.quality === 'sharp' ? dpr
           : App.quality === 'soft' ? 1.0
           : Math.min(dpr, 1.25);
  let w = Math.round(cw * base * App.renderScale);
  let h = Math.round(ch * base * App.renderScale);
  const total = w * h;
  if (total > MAX_PIXELS) {
    const k = Math.sqrt(MAX_PIXELS / total);
    w = Math.round(w * k); h = Math.round(h * k);
  }
  w = Math.max(16, w & ~3); h = Math.max(16, h & ~3);
  if (!force && w === App.rw && h === App.rh) return;
  App.rw = w; App.rh = h;
  canvas.width = w; canvas.height = h;
  Post.alloc(w, h);
  for (const s of SCENES) if (s._alloced && s.resize) s.resize(s, w, h);
  document.documentElement.style.setProperty('--s',
    String(clamp(Math.min(cw / 1680, ch / 950), 0.72, 1.5)));
}

function progOf(s) {
  if (!s._prog) { s._prog = new Program(s.frag, s.vs || null, s.id); s._prog.compile(); }
  return s._prog;
}
function activate(i, immediate) {
  const s = SCENES[i];
  s._t = 0;
  s._seed = Math.random() * 1000;
  if (s.reseed) s.reseed(s, false);
  if (!s._alloced && s.alloc) { s.alloc(s, App.rw, App.rh); s._alloced = true; }
  progOf(s);
  App.dwellLeft = s.dwell;
  if (!immediate) App.trans = { t: 0, dur: TRANS_DUR };
  updateChrome(i);
  if (typeof applyInfo === 'function') applyInfo();
}
function go(delta) {
  if (App.trans) return;
  App.prev = App.cur;
  App.cur = (App.cur + delta + SCENES.length) % SCENES.length;
  activate(App.cur, false);
}
function jump(i) {
  if (i === App.cur || App.trans || i < 0 || i >= SCENES.length) return;
  App.prev = App.cur; App.cur = i; activate(i, false);
}

function todGrade() {
  if (App.nightMode === 'off') return { tint: [1, 1, 1], dim: 1 };
  const d = new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  let warm, dim;
  if (App.nightMode === 'on') { warm = 1; dim = 0.55; }
  else {
    if (h >= 9 && h < 17) { warm = 0; dim = 1.0; }
    else if (h >= 17 && h < 23) { const k = (h - 17) / 6; warm = k; dim = mix(1.0, 0.60, k); }
    else if (h >= 23 || h < 5) { warm = 1; dim = 0.55; }
    else { const k = (h - 5) / 4; warm = 1 - k; dim = mix(0.55, 1.0, k); }
  }
  const tint = [1.0, mix(1.0, 0.74, warm), mix(1.0, 0.46, warm)];
  return { tint, dim };
}

function setCommon(p, s) {
  const t = s._t;
  p.set('uRes', App.rw, App.rh);
  p.set('uDrift', App.driftX, App.driftY);
  p.set('uTime', t);
  const st = App.simTime;
  p.set('uClocks',
    (st * 0.02618) % TAU, (st * 0.08847) % TAU,
    (st * 0.04163) % TAU, (st * 0.01123) % TAU);
  p.set('uClocks2',
    (st * 0.15731) % TAU, (st * 0.00713) % TAU,
    (st * 0.31237) % TAU, (st * 0.05581) % TAU);
  p.set('uMood', 0.5 + 0.5 * Math.sin(st * 0.0037));
  p.set('uSeed', s._seed || 0);
  p.set('uMotion', App.reduced ? 0.3 : 1.0);
  p.seti('uFrame', App.frame & 0xffff);
  if (s._palCur) { const l = p.u('uPal[0]'); if (l) gl.uniform3fv(l, s._palCur); }
  p.set('uDensity', s._density || 1.0);
}

function renderScene(s, target, dt) {
  if (!s._alloced && s.alloc) { s.alloc(s, App.rw, App.rh); s._alloced = true; }
  if (s._palCur && s._palTgt) {
    const k = 1 - Math.exp(-dt * 2.4);
    for (let i = 0; i < 24; i++) s._palCur[i] += (s._palTgt[i] - s._palCur[i]) * k;
  }
  s._t += dt;
  if (s.tick) s.tick(s, dt);
  if (s.sim) s.sim(s, dt);
  if (s.draw) { s.draw(s, target, dt); return; }
  const p = progOf(s);
  bindRT(target);
  gl.disable(gl.BLEND);
  p.use();
  setCommon(p, s);
  if (s.uni) s.uni(p, s);
  drawTri();
}

function lerpPost(a, b, t) {
  const o = {};
  for (const k in a) o[k] = mix(a[k], b[k], t);
  return o;
}

App.start = function () {
  if (this.running) return;
  this.running = true; this.last = performance.now();
  this.raf = requestAnimationFrame(loop);
};
App.stop = function () {
  this.running = false; cancelAnimationFrame(this.raf); this.raf = 0;
};

function loop(now) {
  App.raf = requestAnimationFrame(loop);
  let dt = (now - App.last) * 0.001;
  App.last = now;
  if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
  dt = Math.min(dt, 1 / 20);
  App.emaFrame = App.emaFrame * 0.94 + (dt * 1000) * 0.06;
  try { render(dt); }
  catch (e) {
    App.err++;
    if (App.err < 4) console.error('[VIGIL] render error', e);
    if (App.err === 12) { App.stop(); }
  }
  App.frame++;
}

function render(dt) {
  App.simTime += dt;
  const st = App.simTime;

  const dScale = App.rw / Math.max(App.cssW, 1);
  App.driftCssX = 3.0 * Math.sin(TAU * st / 137) + 1.5 * Math.sin(TAU * st / 61);
  App.driftCssY = 3.0 * Math.cos(TAU * st / 91) + 1.5 * Math.cos(TAU * st / 53);
  App.driftX = App.driftCssX * dScale;
  App.driftY = App.driftCssY * dScale;

  App.fade = Math.min(1, App.fade + dt / 2.2);

  const s = SCENES[App.cur];
  if (App.slideshow && !App.trans) {
    App.dwellLeft -= dt;
    if (App.dwellLeft <= 0) go(1);
  }

  const sdt = dt * App.speed;
  let post = s.post, srcTex;
  if (App.trans) {
    const a = SCENES[App.prev], b = s;
    App.trans.t += dt;
    let k = clamp(App.trans.t / App.trans.dur, 0, 1);
    k = k * k * (3 - 2 * k);
    renderScene(a, Post.hdrA, sdt);
    renderScene(b, Post.hdrB, sdt);
    bindRT(Post.hdrMix);
    gl.disable(gl.BLEND);
    P_MIX.use();
    P_MIX.tex('uA', Post.hdrA.tex, 0);
    P_MIX.tex('uB', Post.hdrB.tex, 1);
    P_MIX.set('uT', k);
    drawTri();
    srcTex = Post.hdrMix.tex;
    post = lerpPost(a.post, b.post, k);
    if (App.trans.t >= App.trans.dur) App.trans = null;
  } else {
    renderScene(s, Post.hdrA, sdt);
    srcTex = Post.hdrA.tex;
  }

  const bloomTex = Post.bloom(srcTex, post.bloomThreshold, post.bloomKnee);

  const g = todGrade();
  bindRT(null);
  gl.disable(gl.BLEND);
  P_COMP.use();
  P_COMP.tex('uScene', srcTex, 0);
  P_COMP.tex('uBloom', bloomTex, 1);
  P_COMP.set('uRes', App.rw, App.rh);
  P_COMP.set('uExposure', post.exposure);
  P_COMP.set('uBloomAmt', post.bloom);
  P_COMP.set('uVignette', post.vignette);
  P_COMP.set('uCA', post.ca);
  P_COMP.set('uBarrel', post.barrel);
  P_COMP.set('uGrain', post.grain);
  P_COMP.set('uGrainSize', post.grainSize);
  P_COMP.set('uAnaX', post.ana);
  P_COMP.set('uTint', g.tint);
  P_COMP.set('uDim', g.dim);
  P_COMP.set('uFade', App.fade);
  P_COMP.seti('uFrame', App.frame & 0xffff);
  drawTri();

  adaptive(dt);
  tickUI(dt);
}

function adaptive(dt) {
  if (App.quality === 'sharp' || App.quality === 'fixed') return;
  if (App.emaFrame > 20.5) {
    App.slowFor += dt; App.fastFor = 0;
    if (App.slowFor > 2.0 && App.renderScale > 0.56) {
      App.renderScale = Math.max(0.56, App.renderScale - 0.12);
      App.slowFor = 0; resize(true);
    }
  } else if (App.emaFrame < 17.4) {
    App.fastFor += dt; App.slowFor = 0;
    if (App.fastFor > 14 && App.renderScale < 1.0) {
      App.renderScale = Math.min(1.0, App.renderScale + 0.08);
      App.fastFor = 0; resize(true);
    }
  } else { App.slowFor = 0; App.fastFor = 0; }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) App.stop();
  else { App.last = performance.now(); App.start(); }
});
