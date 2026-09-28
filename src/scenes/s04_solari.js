/* ---------------- 04 · SOLARI ----------------
   The split-flap board tells the truth: date, time, sun, moon,
   the weather outside your window, and five cities that are awake
   or asleep while you are watching. */
(function () {
  const COLS = 34, ROWS = 18;
  const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:/-°%';
  const NC = CHARS.length;
  const ATLAS_COLS = 8, CELL = 64;
  const STEP_MS = 0.068;

  function makeAtlas() {
    const cv = document.createElement('canvas');
    cv.width = ATLAS_COLS * CELL; cv.height = ATLAS_COLS * CELL;
    const x = cv.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, cv.width, cv.height);
    x.fillStyle = '#fff';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 ' + Math.round(CELL * 0.70) + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    for (let i = 0; i < NC; i++) {
      const c = CHARS[i];
      if (c === ' ') continue;
      const cx = (i % ATLAS_COLS) * CELL + CELL * 0.5;
      const cy = Math.floor(i / ATLAS_COLS) * CELL + CELL * 0.52;
      x.save(); x.translate(cx, cy); x.scale(1.42, 1.0);
      x.fillText(c, 0, 0); x.restore();
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, cv.width, cv.height);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  const ci = c => { const k = CHARS.indexOf(c); return k < 0 ? 0 : k; };

  const CITIES = [
    ['NEW YORK', 'America/New_York'],
    ['LONDON', 'Europe/London'],
    ['TOKYO', 'Asia/Tokyo'],
    ['SYDNEY', 'Australia/Sydney'],
    ['LOS ANGELES', 'America/Los_Angeles']
  ];
  function cityTime(tz, now) {
    try {
      return new Intl.DateTimeFormat('en-GB',
        { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    } catch (e) { return '--:--'; }
  }
  function moon(now) {
    const SYNODIC = 29.530588853;
    const epoch = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
    const days = now.getTime() / 86400000 - epoch;
    const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
    const illum = Math.round((1 - Math.cos(TAU * age / SYNODIC)) / 2 * 100);
    const names = ['NEW MOON', 'WAXING CRESCENT', 'FIRST QUARTER', 'WAXING GIBBOUS',
      'FULL MOON', 'WANING GIBBOUS', 'LAST QUARTER', 'WANING CRESCENT'];
    const oct = Math.floor(((age / SYNODIC * 8) + 0.5) % 8);
    return { name: names[oct], illum };
  }
  function weekNum(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }
  function dayOfYear(d) { return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); }
  const pad2 = n => String(n).padStart(2, '0');
  function lr(l, r) {
    l = l.slice(0, COLS); r = r.slice(0, COLS);
    const gap = COLS - l.length - r.length;
    return gap >= 0 ? l + ' '.repeat(gap) + r : (l + ' ' + r).slice(0, COLS);
  }

  function buildRows() {
    const now = new Date();
    const R = new Array(ROWS).fill('');
    const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY',
      'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const hm = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    const utc = pad2(now.getUTCHours()) + ':' + pad2(now.getUTCMinutes());
    const mo = moon(now);
    const w = Data.wx;

    R[1] = lr(DAYS[now.getDay()], now.getDate() + ' ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear());
    R[2] = lr('LOCAL ' + hm, 'UTC ' + utc);
    R[3] = lr('WEEK ' + weekNum(now), 'DAY ' + dayOfYear(now) + '/365');
    R[5] = w && w.sunrise
      ? lr('SUNRISE ' + w.sunrise, 'SUNSET ' + w.sunset)
      : lr('SUNRISE --:--', 'SUNSET --:--');
    R[6] = lr('MOON ' + mo.illum + '%', mo.name);

    const locName = Data.loc && Data.loc.name ? Data.loc.name.slice(0, 20) : 'WEATHER';
    if (w) {
      R[8] = lr(locName, w.text);
      R[9] = lr('TEMP ' + Math.round(w.temp) + '°', 'FEELS ' + Math.round(w.feels) + '°');
      R[10] = lr('WIND ' + Math.round(w.wind) + ' ' + w.windDir, 'CLOUD ' + Math.round(w.cloud) + '%');
      R[11] = lr('HUMIDITY ' + Math.round(w.rh) + '%', 'PRECIP ' + w.precip.toFixed(1) + w.pUnit);
    } else {
      R[8] = lr('WEATHER', Data.status === 'no-location' ? 'NO LOCATION'
        : Data.status === 'offline' ? 'OFFLINE' : 'LINKING...');
    }
    CITIES.forEach((c, i) => { R[13 + i] = lr(c[0], cityTime(c[1], now)); });
    return R;
  }

  scene({
    id: 'solari',
    name: 'Solari',
    medium: 'split-flap · live time, sun, moon & weather',
    chrome: '#d9c56b',
    dwell: 215,
    post: {
      exposure: 1.10, bloom: 0.07, bloomThreshold: 0.72, bloomKnee: 0.6,
      vignette: 0.46, ca: 0.5, barrel: 0.016, grain: 0.014, grainSize: 1.6
    },
    themes: [
      ['Sulphur', '#0A0B0D', '#15171C', '#2E333B', '#C2BEB4', '#D9C56B'],
      ['Amber Hall', '#0D0A07', '#1C1510', '#3B2E1E', '#D9B88A', '#F0A03C'],
      ['Ivory', '#0C0C0C', '#1A1A1A', '#383838', '#E8E4DC', '#D0553A'],
      ['Terminal', '#070C08', '#101C12', '#1E3B24', '#8AD9A0', '#C2FFD0'],
      ['Cool Blue', '#08090D', '#12151C', '#262E3B', '#A6B8C9', '#6BA0D9']
    ],
    st: null,
    alloc(s) {
      const n = COLS * ROWS;
      s.st = {
        cur: new Uint8Array(n), tgt: new Uint8Array(n),
        t0: new Float32Array(n), steps: new Uint8Array(n),
        hot: new Float32Array(n),
        clock: 0, check: 0, tex: null, buf: new Uint8Array(n * 4),
        atlas: makeAtlas(), rows: new Array(ROWS).fill('')
      };
      const st = s.st;
      const rows = buildRows();
      for (let r = 0; r < ROWS; r++) {
        st.rows[r] = rows[r];
        for (let c = 0; c < COLS; c++) {
          const g = ci(rows[r][c] || ' ');
          st.cur[r * COLS + c] = g; st.tgt[r * COLS + c] = g;
        }
      }
      st.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, st.tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, COLS, ROWS);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    },
    reseed(s, manual) {
      if (!manual || !s.st) return;
      for (let r = 0; r < ROWS; r++) this.setRow(s, r, s.st.rows[r], r * 0.12, true);
    },
    setRow(s, r, line, delayBase, force) {
      const st = s.st;
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const g = ci(line[c] || ' ');
        if (!force && g === st.tgt[i] && st.steps[i] === 0) continue;
        st.tgt[i] = g;
        st.t0[i] = st.clock + delayBase + c / 22.0;
        let k = (g - st.cur[i] + NC) % NC;
        if (force && k === 0) k = NC;
        st.steps[i] = k;
      }
    },
    tick(s, dt) {
      const st = s.st; if (!st) return;
      st.clock += dt;
      st.check -= dt;
      if (st.check <= 0) {
        st.check = 0.5;
        const rows = buildRows();
        for (let r = 0; r < ROWS; r++) {
          if (rows[r] !== st.rows[r]) {
            this.setRow(s, r, rows[r], 0.05 * (r % 3));
            st.rows[r] = rows[r];
          }
        }
      }
      const buf = st.buf;
      for (let i = 0; i < COLS * ROWS; i++) {
        let disp = st.cur[i], sub = 0;
        if (st.steps[i] > 0) {
          const el = st.clock - st.t0[i];
          if (el > 0) {
            const k = Math.floor(el / STEP_MS);
            if (k >= st.steps[i]) {
              st.cur[i] = st.tgt[i]; st.steps[i] = 0; st.hot[i] = 1.0;
              disp = st.cur[i];
            } else {
              disp = (st.cur[i] + k) % NC;
              sub = (el / STEP_MS) - k;
            }
          }
        }
        st.hot[i] = Math.max(0, st.hot[i] - dt / 22.0);
        const nxt = st.steps[i] > 0 ? (disp + 1) % NC : disp;
        const o = i * 4;
        buf[o] = disp; buf[o + 1] = nxt;
        buf[o + 2] = Math.round(clamp(sub, 0, 1) * 255);
        buf[o + 3] = Math.round(clamp(st.hot[i], 0, 1) * 255);
      }
      gl.bindTexture(gl.TEXTURE_2D, st.tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, COLS, ROWS, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    },
    uni(p, s) {
      p.tex('uBoard', s.st.tex, 0);
      p.tex('uAtlas', s.st.atlas, 1);
      p.set('uGrid', COLS, ROWS);
      p.set('uRot', 0.0070 + 0.0045 * Math.sin(App.simTime * 0.0031));
    },
    frag: frag(`
uniform sampler2D uBoard, uAtlas;
uniform vec2  uGrid;
uniform float uRot;

#define C_VOID uPal[0]
#define C_FACE uPal[1]
#define C_LIT  uPal[2]
#define C_TEXT uPal[3]
#define C_SULF uPal[4]

float glyphAt(float g, vec2 gv){
  if(g < 0.5) return 0.0;
  gv = clamp(gv, 0.001, 0.999);
  float col = mod(g, 8.0), row = floor(g/8.0);
  vec2 a = (vec2(col, row) + vec2(gv.x, 1.0 - gv.y)) / 8.0;
  return texture(uAtlas, a).r;
}

void main(){
  vec2 uv = UVf();
  vec2 c = uv - 0.5;
  c = rot(uRot) * c;
  c += vec2(0.0009*sin(uClocks.z), 0.0007*cos(uClocks.w));
  uv = c + 0.5;

  vec2 b = (uv - vec2(0.052, 0.128)) / vec2(1.0 - 0.052 - 0.092, 1.0 - 0.128 - 0.098);
  vec3 col = C_VOID * (0.55 + 0.55*(1.0 - length((uv-vec2(0.32,0.62))*vec2(0.8,1.0))));

  if(b.x > 0.0 && b.x < 1.0 && b.y > 0.0 && b.y < 1.0){
    vec2 g  = b * uGrid;
    vec2 gi = floor(g);
    vec2 gf = fract(g);
    float row = uGrid.y - 1.0 - gi.y;

    vec4 st = texelFetch(uBoard, ivec2(int(gi.x), int(row)), 0);
    float gCur = floor(st.r*255.0 + 0.5);
    float gNxt = floor(st.g*255.0 + 0.5);
    float pr   = st.b;
    float hot  = st.a;

    vec2 pad = vec2(0.055, 0.045);
    vec2 gv = (gf - pad) / (1.0 - 2.0*pad);

    float ink = 0.0;
    float shade = 1.0;
    float v = gv.y;
    float half_ = step(0.5, v);
    if(pr < 0.001){
      ink = glyphAt(gCur, gv);
    } else if(pr < 0.5){
      float sc = max(cos(pr*PI), 0.02);
      if(half_ > 0.5){
        float src = 0.5 + (v - 0.5)/sc;
        if(src <= 1.0) { ink = glyphAt(gCur, vec2(gv.x, src)); shade = mix(0.35, 1.0, sc); }
      } else {
        ink = glyphAt(gCur, gv);
      }
    } else {
      float sc = max(-cos(pr*PI), 0.02);
      if(half_ < 0.5){
        float src = 0.5 - (0.5 - v)/sc;
        if(src >= 0.0) { ink = glyphAt(gNxt, vec2(gv.x, src)); shade = mix(0.35, 1.0, sc); }
      } else {
        ink = glyphAt(gNxt, gv);
      }
    }
    if(gv.x < 0.0 || gv.x > 1.0) ink = 0.0;

    float faceLit = 0.86 + 0.20*(1.0 - gf.y) + 0.16*(1.0 - b.y*0.8) + 0.10*(1.0-b.x);
    float seam = 1.0 - 0.55*exp(-pow((gf.y - 0.5)/0.022, 2.0));
    float bevel = smoothstep(0.0, 0.055, gf.x) * smoothstep(1.0, 0.945, gf.x)
                * smoothstep(0.0, 0.045, gf.y) * smoothstep(1.0, 0.955, gf.y);
    vec3 face = mix(C_FACE, C_LIT, 0.30 + 0.30*hash21(gi + 3.0)) * faceLit * seam;
    face *= mix(0.55, 1.0, bevel);

    vec3 tc = mix(C_TEXT, C_SULF, hot*0.85);
    col = face + tc * ink * shade * (0.92 + 0.35*hot);
  }
  fragColor = vec4(max(col,0.0), 1.0);
}
`)
  });
})();
