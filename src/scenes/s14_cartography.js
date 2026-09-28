/* ---------------- 14 · CARTOGRAPHY ----------------
   A survey of a coastline that does not exist. Procedural terrain,
   hypsometric tints, contour lines, hillshade, a tide that comes and
   goes, and a slow drift across the chart. */
scene({
  id: 'cartography',
  name: 'Cartography',
  medium: 'procedural relief · contours · hillshade · tide',
  chrome: '#d8c9a0',
  dwell: 240,
  post: {
    exposure: 1.0, bloom: 0.0, bloomThreshold: 1.5, bloomKnee: 0.5,
    vignette: 0.42, ca: 0.0, grain: 0.020, grainSize: 1.8
  },
  themes: [
    ['Admiralty', '#10304C', '#2A6A8E', '#C9B88A', '#6A8A50', '#8A7A50', '#E8E4DC', '#1E1A14', '#D8C9A0'],
    ['Parchment', '#3A4A52', '#7A9AA0', '#D8C49A', '#B8B080', '#A08A62', '#F0E8D8', '#3A2A1A', '#E8DCC0'],
    ['Radar', '#020A04', '#0A2A12', '#2A6A32', '#3A8A44', '#5AB060', '#C8FFD0', '#0A3A14', '#7AE890'],
    ['Night Relief', '#04060A', '#0A1420', '#2A2E38', '#3A4048', '#5A5E6A', '#C0C8D4', '#8AA0C0', '#12161C'],
    ['Blue Marble', '#0C2440', '#1A4E80', '#C9C0A0', '#3A7A3A', '#6A6A50', '#F0F0F0', '#1A2A3A', '#B0C8E0']
  ],
  frag: frag(`
#define C_DEEP  uPal[0]
#define C_SHAL  uPal[1]
#define C_SAND  uPal[2]
#define C_LOW   uPal[3]
#define C_HIGH  uPal[4]
#define C_SNOW  uPal[5]
#define C_INK   uPal[6]
#define C_PAPER uPal[7]

float terrain(vec2 p){
  float cont = fbm2(p*0.30 + 17.0, 3);
  float h = fbm2(p*1.05 + vec2(uSeed*0.13, uSeed*0.07), 5)*0.62
          + 0.32*fbmRidge(p*2.4 + 5.0, 4) - 0.24
          + 0.45*cont;
  return h;
}

void main(){
  vec2 uv = UVf();
  float asp = ASPECT();
  vec2 p = NP() * 1.05 + vec2(uTime*0.0075, uTime*0.0021);   // slow survey drift

  float sea = 0.02 + 0.055*sin(uClocks2.y*1.4);              // the tide
  float h = terrain(p);
  float land = h - sea;

  /* hillshade from a cheap gradient */
  float e = 0.012;
  float hx = terrain(p + vec2(e, 0.0)) - h;
  float hy = terrain(p + vec2(0.0, e)) - h;
  vec3 n = normalize(vec3(-hx, -hy, e*1.6));
  float shade = clamp(dot(n, normalize(vec3(-0.55, 0.6, 0.55))), 0.0, 1.0);
  shade = 0.55 + 0.75*shade;

  /* hypsometric tint */
  vec3 col;
  if(land < 0.0){
    float d = smoothstep(0.0, 0.16, -land);
    col = mix(C_SHAL, C_DEEP, pow(d, 0.7));
    /* the old chart convention: a few hatched depth lines that fade offshore */
    float bc = fract(land/0.03);
    float bw = fwidth(land)/0.03*1.4;
    float bl = 1.0 - smoothstep(0.0, bw, min(bc, 1.0-bc));
    col = mix(col, C_INK, bl*0.16*(1.0 - smoothstep(0.02, 0.14, -land)));
    /* a slow, very faint swell so the water is not dead */
    col *= 0.96 + 0.04*sin(p.x*40.0 + p.y*18.0 + uClocks.y*2.0)*(1.0 - d*0.5);
  } else {
    col = ramp5(C_SAND, C_LOW, C_HIGH, mix(C_HIGH, C_SNOW, 0.5), C_SNOW, land/0.70);
    col *= shade;
    /* contour lines every 0.05, index contour every fifth */
    float cw = fwidth(land)/0.05*1.35;
    float c = fract(land/0.05);
    float line = 1.0 - smoothstep(0.0, cw, min(c, 1.0-c));
    float ci = fract(land/0.25);
    float idx = 1.0 - smoothstep(0.0, cw*0.25, min(ci, 1.0-ci));
    col = mix(col, C_INK, line*0.28 + idx*0.30);
  }

  /* coastline */
  float cw2 = fwidth(land)*2.2;
  float coast = 1.0 - smoothstep(0.0, cw2, abs(land));
  col = mix(col, C_INK, coast*0.75);

  /* graticule */
  vec2 gq = p * 1.6 + 0.3;
  vec2 gf = abs(fract(gq) - 0.5);
  float gw = fwidth(gq.x)*1.2;
  float grat = (1.0 - smoothstep(0.0, gw, gf.x)) + (1.0 - smoothstep(0.0, gw, gf.y));
  col = mix(col, C_INK, clamp(grat, 0.0, 1.0)*0.13);

  /* paper */
  float paper = 0.88 + 0.16*fbm2(PX()*0.08, 3);
  col *= paper;
  col = mix(col, C_PAPER*0.25, 0.06);

  fragColor = vec4(max(col, 0.0)*0.62, 1.0);
}
`)
});
