/* ================================================================== *
 *  Scene registry + colour-theme infrastructure
 * ================================================================== */
const SCENES = [];

const POST_DEFAULT = {
  exposure: 1.0,
  bloom: 0.09, bloomThreshold: 0.70, bloomKnee: 0.70, ana: 0.0,
  vignette: 0.40, ca: 0.0, barrel: 0.0,
  grain: 0.014, grainSize: 1.7
};

/* themes: [ ['Name', '#hex0', ... up to 8 role colours], ... ] */
function buildThemes(themes) {
  return (themes || [['Default', '#808080']]).map(t => {
    const name = t[0];
    const pal = new Float32Array(24);
    for (let i = 0; i < 8; i++) {
      const hex = t[Math.min(i + 1, t.length - 1)];
      const c = hexLin(hex);
      pal[i * 3] = c[0]; pal[i * 3 + 1] = c[1]; pal[i * 3 + 2] = c[2];
    }
    return { name, pal };
  });
}

function scene(o) {
  o.post = Object.assign({}, POST_DEFAULT, o.post || {});
  o.dwell = o.dwell || 200;
  o._prog = null;
  o._themesLin = buildThemes(o.themes);
  o._themeIdx = 0;
  o._palCur = Float32Array.from(o._themesLin[0].pal);
  o._palTgt = o._themesLin[0].pal;
  o._density = 1.0;
  SCENES.push(o);
  return o;
}

/* current colour of palette slot i as [r,g,b] linear — for custom pipelines */
function palv(s, i) {
  const p = s._palCur;
  return [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
}

function frag(body) { return PRELUDE + body; }
