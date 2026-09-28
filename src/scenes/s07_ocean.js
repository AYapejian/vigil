/* ---------------- 07 · OPEN WATER ----------------
   Deep ocean at last light. Five incommensurate swells, real Fresnel,
   a low sun's glitter path. */
scene({
  id: 'openwater',
  name: 'Open Water',
  medium: 'gerstner × 5 · fresnel 0.02 · last light',
  chrome: '#a8c8d0',
  dwell: 220,
  post: {
    exposure: 1.10, bloom: 0.18, bloomThreshold: 0.60, bloomKnee: 0.8, ana: 0.4,
    vignette: 0.36, ca: 0.5, grain: 0.012, grainSize: 1.6
  },
  themes: [
    ['Dusk', '#041018', '#0A2432', '#1E4A52', '#3A6A78', '#F0D8A8', '#0A1520'],
    ['Midnight', '#030A12', '#081A28', '#14323E', '#28485C', '#C9D8F0', '#060D16'],
    ['Tropic', '#04141A', '#0A2E36', '#14525A', '#2E8A8F', '#F8F0C9', '#08161C'],
    ['Storm', '#0A0E10', '#16242A', '#2A4248', '#4A626A', '#D8E0E0', '#0C1214'],
    ['Copper', '#100A08', '#241610', '#523628', '#7A5A42', '#F8C88A', '#140D0A']
  ],
  frag: frag(`
#define C_ABYSS uPal[0]
#define C_DEEP  uPal[1]
#define C_CREST uPal[2]
#define C_SKY   uPal[3]
#define C_SUN   uPal[4]
#define C_NIGHT uPal[5]

float waveH(vec2 P, float fp, out vec2 grad){
  grad = vec2(0.0);
  float h = 0.0;
  vec2  dirs[5]; float amps[5]; float freqs[5];
  dirs[0]=vec2( 0.26, 0.97); amps[0]=1.00; freqs[0]= 6.9;
  dirs[1]=vec2( 0.55, 0.84); amps[1]=0.52; freqs[1]=11.3;
  dirs[2]=vec2(-0.09, 1.00); amps[2]=0.34; freqs[2]=17.9;
  dirs[3]=vec2( 0.44, 0.90); amps[3]=0.22; freqs[3]=28.3;
  dirs[4]=vec2(-0.30, 0.95); amps[4]=0.15; freqs[4]=44.1;
  float phs[5];
  phs[0]=uClocks.x*17.5; phs[1]=uClocks.y*3.33; phs[2]=uClocks.z*4.43;
  phs[3]=uClocks.w*10.0; phs[4]=uClocks2.w*1.26;
  for(int i=0;i<5;i++){
    vec2 k = dirs[i]*freqs[i];
    float a = dot(k, P) + phs[i];
    float w = length(k)*fp;
    float at = 1.0/(1.0 + w*w*0.32);
    h    += amps[i]*sin(a)*at;
    grad += amps[i]*cos(a)*k*at;
  }
  return h;
}

void main(){
  vec2 uv = UVf();
  float horiz = 0.815;
  float e = horiz - uv.y;

  float sunX = 0.5 + 0.17*sin(uClocks2.y*0.8);
  vec3 sunDir = normalize(vec3((sunX-0.5)*2.2, 0.055 + 0.03*sin(uClocks.w), -1.0));

  if(e < 0.0006){
    float k = smoothstep(0.0, 0.22, uv.y - horiz);
    vec3 sky = mix(C_SKY*1.15, C_NIGHT, k);
    vec2 sd = (uv - vec2(sunX, horiz + 0.012)) * vec2(1.0, 3.2);
    sky += C_SUN * exp(-dot(sd,sd)*640.0) * 1.1;
    sky += C_SUN * exp(-dot(sd,sd)*40.0) * 0.16;
    float cb = fbm2(vec2(uv.x*4.0 + uClocks.x*0.5, uv.y*30.0), 3);
    sky += C_SKY * cb * 0.05 * smoothstep(0.3, 0.02, uv.y - horiz);
    fragColor = vec4(max(sky, 0.0), 1.0);
    return;
  }

  float H = 0.90;
  float d = H / (e + 0.030);
  vec2 P = vec2((uv.x - 0.5) * d * 1.65, d);
  P += vec2(0.30*sin(uClocks.z*0.5), 0.22*cos(uClocks.w*0.4));

  vec2 g;
  float fp = length(fwidth(P));
  float h = waveH(P, fp, g);
  float slope = 0.021 * uDensity;
  vec3 N = normalize(vec3(-g.x*slope, 1.0, -g.y*slope));

  vec3 V = normalize(vec3(-P.x*0.22, H*1.35, -d));
  float cosT = clamp(dot(N, V), 0.02, 1.0);
  vec3 R = reflect(-V, N);

  float up = clamp(R.y, 0.0, 1.0);
  vec3 env = mix(C_SKY, C_NIGHT, pow(up, 0.55));
  float F = 0.02 + 0.98*pow(1.0 - cosT, 5.0);

  float thin = clamp(h*0.5 + 0.5, 0.0, 1.0);
  vec3 body = mix(C_ABYSS, C_DEEP, 0.46 + 0.17*thin);
  body = mix(body, C_CREST, smoothstep(0.84, 1.12, thin) * 0.18);
  vec3 col = mix(body, env, F);

  vec3 Ls = normalize(vec3(sunDir.x, sunDir.y + 0.04, sunDir.z));
  float rl = max(dot(R, Ls), 0.0);
  float path = exp(-pow((uv.x - sunX)*2.6, 2.0));
  float spec = pow(rl, 900.0) * 3.2
             + pow(rl, 120.0) * 0.22 * path
             + pow(rl, 24.0)  * 0.030 * path;
  col += C_SUN * spec * (0.30 + 0.70*clamp(F*6.0, 0.0, 1.0));

  float cap = smoothstep(1.30, 1.60, h + 0.35*fbm2(P*2.6, 3)) * 0.20;
  col += C_SKY * cap;

  float fog = smoothstep(0.0, 0.15, e);
  vec3 hazeC = mix(C_SKY, C_SUN, 0.25*exp(-abs(uv.x - sunX)*4.0));
  col = mix(hazeC*0.68, col, fog);

  fragColor = vec4(max(col, 0.0), 1.0);
}
`)
});
