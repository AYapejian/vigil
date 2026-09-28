/* ================================================================== *
 *  Chrome / interaction — keyboard, touch, info overlay, notifications
 * ================================================================== */
const UI = {
  el: {}, idle: 0, visible: false, forced: 0,
  toastT: 0, glyphT: 0, helpOpen: false, hidden: false,
  lastMouse: [0, 0], booted: false, bootT: 0,
  touchX: 0, touchY: 0, touchT: 0,
  pick: '', pickT: 0
};

function initUI() {
  const q = id => document.getElementById(id);
  UI.el = {
    chrome: q('chrome'), label: q('label'), idx: q('idx'), title: q('title'),
    medium: q('medium'), clock: q('clock'), dots: q('dots'), bar: q('bar'),
    fill: q('barFill'), help: q('help'), toast: q('toast'), glyph: q('glyph'),
    boot: q('boot'), hNight: q('hNight'), hQual: q('hQual'),
    hInfo: q('hInfo'), hSpeed: q('hSpeed'), hDens: q('hDens'),
    info: q('info'), iClock: q('iClock'), iDate: q('iDate'), iWx: q('iWx'),
    tbar: q('tbar'), nstack: q('nstack')
  };
  UI.el.dots.innerHTML = SCENES.map(() => '<i></i>').join('');
  updateChrome(App.cur);
  reveal(4.5);
  applyInfo();

  addEventListener('keydown', onKey, { passive: false });
  addEventListener('mousemove', e => {
    const dx = e.clientX - UI.lastMouse[0], dy = e.clientY - UI.lastMouse[1];
    if (dx * dx + dy * dy < 16) return;
    UI.lastMouse = [e.clientX, e.clientY];
    reveal(2.6);
  }, { passive: true });
  addEventListener('mousedown', e => {
    if (e.target.closest && e.target.closest('#tbar')) return;
    if (!UI.booted) { dismissBoot(); requestFS(); return; }
    reveal(2.6);
  });
  addEventListener('wheel', () => reveal(2.6), { passive: true });

  addEventListener('touchstart', e => {
    if (e.target.closest && e.target.closest('#tbar')) return;
    const t = e.touches[0];
    UI.touchX = t.clientX; UI.touchY = t.clientY; UI.touchT = performance.now();
    if (!UI.booted) dismissBoot();
  }, { passive: true });
  addEventListener('touchend', e => {
    if (e.target.closest && e.target.closest('#tbar')) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - UI.touchX, dy = t.clientY - UI.touchY;
    const dt = performance.now() - UI.touchT;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 90 && dt < 700) {
      go(dx < 0 ? 1 : -1);
    } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      if (UI.visible) hideChrome(); else reveal(5.0);
    }
  }, { passive: true });

  UI.el.tbar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    reveal(4.0);
    switch (b.dataset.act) {
      case 'prev': go(-1); break;
      case 'next': go(1); break;
      case 'play': togglePlay(); break;
      case 'theme': cycleTheme(); break;
      case 'info': cycleInfo(); break;
      case 'fs':
        if (document.fullscreenElement) document.exitFullscreen();
        else requestFS();
        break;
    }
  });
}

function requestFS() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => { });
}
function dismissBoot() {
  if (UI.booted) return;
  UI.booted = true;
  UI.el.boot.classList.add('gone');
  setTimeout(() => { UI.el.boot.style.display = 'none'; }, 1400);
}

function reveal(seconds) {
  UI.forced = Math.max(UI.forced, seconds);
  UI.visible = true;
  UI.el.chrome.classList.add('show');
  UI.el.bar.classList.add('live');
  UI.el.tbar.classList.add('show');
  document.body.classList.remove('hidecursor');
}
function hideChrome() {
  UI.visible = false;
  UI.el.chrome.classList.remove('show');
  UI.el.bar.classList.remove('live');
  UI.el.tbar.classList.remove('show');
  document.body.classList.add('hidecursor');
  if (UI.helpOpen) { UI.helpOpen = false; UI.el.help.classList.remove('show'); }
}

function updateChrome(i) {
  if (!UI.el.title) return;
  const s = SCENES[i];
  const w = Math.max(2, String(SCENES.length).length);
  UI.el.idx.textContent = String(i + 1).padStart(w, '0') + ' / ' + String(SCENES.length).padStart(w, '0');
  UI.el.title.textContent = s.name;
  UI.el.medium.textContent = s.medium;
  document.documentElement.style.setProperty('--chrome', s.chrome || '#e8e4dc');
  [...UI.el.dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
  if (UI.el.hDens) UI.el.hDens.textContent = (s._density || 1).toFixed(2) + '×';
  reveal(4.5);
}

function toast(msg) {
  UI.el.toast.textContent = msg;
  UI.el.toast.classList.add('show');
  UI.toastT = 1.8;
}
function flashGlyph(g) {
  UI.el.glyph.textContent = g;
  UI.el.glyph.classList.add('flash');
  UI.glyphT = 0.95;
}

function notify(msg) {
  if (!UI.el.nstack) return;
  const d = document.createElement('div');
  d.className = 'note';
  d.textContent = msg;
  UI.el.nstack.appendChild(d);
  while (UI.el.nstack.children.length > 3) UI.el.nstack.firstChild.remove();
  requestAnimationFrame(() => d.classList.add('on'));
  setTimeout(() => { d.classList.remove('on'); d.classList.add('off'); }, 8000);
  setTimeout(() => d.remove(), 9200);
}
window.__vigilNotify = notify;

function cycleTheme() {
  const s = SCENES[App.cur];
  if (!s._themesLin || s._themesLin.length < 2) { toast('no alternate themes'); return; }
  s._themeIdx = (s._themeIdx + 1) % s._themesLin.length;
  s._palTgt = s._themesLin[s._themeIdx].pal;
  toast('theme · ' + s._themesLin[s._themeIdx].name.toLowerCase());
}
function cycleInfo() {
  App.infoMode = App.infoMode === 'auto' ? 'on' : App.infoMode === 'on' ? 'off' : 'auto';
  if (UI.el.hInfo) UI.el.hInfo.textContent = App.infoMode;
  applyInfo();
  toast('info display · ' + App.infoMode);
}
function applyInfo() {
  const el = UI.el.info; if (!el) return;
  const s = SCENES[App.cur];
  const def = s.info && s.info.on;
  const want = App.infoMode === 'on' || (App.infoMode === 'auto' && def);
  const pos = (s.info && s.info.pos) || 'br';
  el.className = 'pos-' + pos + (want ? ' show' : '');
}
function setSpeed(mult) {
  App.speed = clamp(App.speed * mult, 0.2, 3.0);
  if (Math.abs(App.speed - 1) < 0.08) App.speed = 1;
  if (UI.el.hSpeed) UI.el.hSpeed.textContent = App.speed.toFixed(2) + '×';
  toast('speed · ' + App.speed.toFixed(2) + '×');
}
function setDensity(mult) {
  const s = SCENES[App.cur];
  s._density = clamp((s._density || 1) * mult, 0.35, 2.5);
  if (Math.abs(s._density - 1) < 0.06) s._density = 1;
  if (UI.el.hDens) UI.el.hDens.textContent = s._density.toFixed(2) + '×';
  toast('density · ' + s._density.toFixed(2) + '× · ' + s.name.toLowerCase());
}
function togglePlay() {
  App.slideshow = !App.slideshow;
  if (App.slideshow && App.dwellLeft <= 0) App.dwellLeft = SCENES[App.cur].dwell;
  flashGlyph(App.slideshow ? '▶' : '❚❚');
  toast(App.slideshow ? 'slideshow · ' + Math.round(SCENES[App.cur].dwell) + 's' : 'slideshow paused');
}

function tickUI(dt) {
  if (!UI.booted) {
    UI.bootT += dt;
    if (UI.bootT > 4.2) dismissBoot();
  }
  if (UI.forced > 0) {
    UI.forced -= dt;
    if (UI.forced <= 0 && !UI.helpOpen) hideChrome();
  }
  if (UI.toastT > 0) { UI.toastT -= dt; if (UI.toastT <= 0) UI.el.toast.classList.remove('show'); }
  if (UI.glyphT > 0) { UI.glyphT -= dt; if (UI.glyphT <= 0) UI.el.glyph.classList.remove('flash'); }
  if (UI.pickT > 0) { UI.pickT -= dt; if (UI.pickT <= 0) commitPick(); }

  const s = SCENES[App.cur];
  const k = App.slideshow ? clamp(1 - App.dwellLeft / s.dwell, 0, 1) : 0;
  UI.el.fill.style.width = (k * 100).toFixed(3) + '%';

  const playBtn = UI.el.tbar && UI.el.tbar.querySelector('[data-act="play"]');
  if (playBtn) {
    const want = App.slideshow ? '❘❘' : '▸';
    if (playBtn.textContent !== want) playBtn.textContent = want;
  }

  if ((App.frame & 31) === 0) {
    const d = new Date();
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    UI.el.clock.textContent = hm;
    if (UI.el.iClock) {
      UI.el.iClock.textContent = hm;
      UI.el.iDate.textContent = d.toLocaleDateString('en-GB',
        { weekday: 'long', day: 'numeric', month: 'long' });
      const w = Data.wx;
      UI.el.iWx.textContent = w
        ? Math.round(w.temp) + '° · ' + w.text + ' · WIND ' + Math.round(w.wind) + ' ' + w.wUnit : '';
      UI.el.info.style.transform =
        'translate(' + App.driftCssX.toFixed(2) + 'px,' + App.driftCssY.toFixed(2) + 'px)';
    }
  }
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (!UI.booted && k !== 'F12') dismissBoot();
  let handled = true;
  switch (k) {
    case 'ArrowRight': case 'd': case 'D': go(1); break;
    case 'ArrowLeft': case 'a': case 'A': go(-1); break;
    case ' ': case 's': case 'S': togglePlay(); break;
    case 'ArrowUp': case 'w': case 'W': dwellAdjust(30); break;
    case 'ArrowDown': case 'x': case 'X': dwellAdjust(-30); break;
    case 'c': case 'C': cycleTheme(); break;
    case 'i': case 'I': cycleInfo(); break;
    case '[': setSpeed(1 / 1.2); break;
    case ']': setSpeed(1.2); break;
    case ',': setDensity(1 / 1.18); break;
    case '.': setDensity(1.18); break;
    case 'f': case 'F':
      if (document.fullscreenElement) document.exitFullscreen(); else requestFS();
      break;
    case 'r': case 'R': {
      const s = SCENES[App.cur];
      s._seed = Math.random() * 1000;
      if (s.reseed) s.reseed(s, true);
      toast('reseeded'); break;
    }
    case 'n': case 'N': {
      App.nightMode = App.nightMode === 'auto' ? 'on' : App.nightMode === 'on' ? 'off' : 'auto';
      UI.el.hNight.textContent = App.nightMode;
      toast('night dim · ' + App.nightMode); break;
    }
    case 'q': case 'Q': {
      App.quality = App.quality === 'auto' ? 'sharp' : App.quality === 'sharp' ? 'soft' : 'auto';
      App.renderScale = App.quality === 'soft' ? 0.7 : 1.0;
      UI.el.hQual.textContent = App.quality;
      resize(true);
      toast('render scale · ' + App.quality); break;
    }
    case 'h': case 'H':
      UI.hidden = !UI.hidden;
      document.body.classList.toggle('nochrome', UI.hidden);
      break;
    case '?': case '/':
      UI.helpOpen = !UI.helpOpen;
      UI.el.help.classList.toggle('show', UI.helpOpen);
      if (UI.helpOpen) reveal(9999); else reveal(2.6);
      break;
    case 'Enter':
      if (UI.pick) commitPick(); else handled = false;
      break;
    default: {
      /* digits type a 1-based scene number; e.code covers layouts where digits need shift */
      let digit = null;
      if (k >= '0' && k <= '9') digit = k;
      else if (e.code && /^(Digit|Numpad)\d$/.test(e.code)) digit = e.code.slice(-1);
      if (digit !== null) pickDigit(digit);
      else handled = false;
    }
  }
  if (handled) { e.preventDefault(); reveal(UI.helpOpen ? 9999 : 3.2); }
}

/* Scene-number entry: digits accumulate and jump once no longer number exists,
   after a short pause, or on Enter — works for any number of scenes. */
const PICK_WAIT = 0.9;
function pickDigit(d) {
  UI.pick = (UI.pick + d).slice(-6);
  const n = parseInt(UI.pick, 10);
  UI.el.glyph.textContent = UI.pick;
  UI.el.glyph.classList.add('flash');
  UI.glyphT = PICK_WAIT + 0.3;
  if (n * 10 > SCENES.length) commitPick();
  else UI.pickT = PICK_WAIT;
}
function commitPick() {
  const n = parseInt(UI.pick, 10);
  UI.pick = ''; UI.pickT = 0;
  if (n >= 1 && n <= SCENES.length) jump(n - 1);
  else toast('no scene ' + n + ' · 1–' + SCENES.length);
}

function dwellAdjust(d) {
  const s = SCENES[App.cur];
  s.dwell = clamp(s.dwell + d, 30, 900);
  App.dwellLeft = Math.min(App.dwellLeft + d, s.dwell);
  toast('dwell · ' + Math.round(s.dwell) + 's');
}

/* debug / automation hook */
window.VIGIL = {
  App, SCENES, Data,
  hop(i) {
    App.trans = null; App.prev = App.cur; App.cur = i; activate(i, true);
    App.slideshow = false;
  },
  warp(sec) { App.simTime += sec; SCENES[App.cur]._t += sec; },
  spin(n) {
    const s = SCENES[App.cur];
    if (!s.sim && !s.tick) return 0;
    for (let i = 0; i < n; i++) {
      if (s.tick) s.tick(s, 1 / 60);
      if (s.sim) s.sim(s, 1 / 60);
      s._t += 1 / 60;
    }
    return n;
  },
  demo() { const s = SCENES[App.cur]; if (s.demo) s.demo(s); },
  theme(i) {
    const s = SCENES[App.cur];
    s._themeIdx = i % s._themesLin.length;
    s._palTgt = s._themesLin[s._themeIdx].pal;
    s._palCur.set(s._palTgt);
  },
  injectWx(loc, wx) { Data.loc = loc; Data.wx = wx; Data.status = 'ok'; Data._emit(); },
  notify,
  fps: () => (1000 / App.emaFrame).toFixed(1),
  quiet() { App.slideshow = false; dismissBoot(); hideChrome(); document.body.classList.add('nochrome'); },
  errors: () => App.err
};

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();
