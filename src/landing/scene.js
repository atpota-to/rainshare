// The landing's water cycle, in three.js: a stretch of coast under atmosphere.online's sky.
//
//   evaporation     mist lifts off the sea            spare time rising off a plan
//   condensation    it gathers into clouds            plans and setups, in your circle
//   precipitation   a cloud breaks over the hills     agents sent after a friend's request
//   collection      the river runs back to the sea    pull requests coming home
//
// The clouds are the ones atmosphere.online's sky is made of (./puffs.js), lit by the same
// morning and night. A cloud here has a life: it starts small over the sea, takes on puffs as
// it drifts inland, towers into a thunderhead over the hills, rains, and thins out past the
// mountains. Everything is made here from a seed: no models or textures to download. The
// page asks for this file only when the landing is on screen (see ./landing.js), so three.js
// stays out of the way of anyone who's signed in.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Vector3, Vector4, Group, Fog,
  HemisphereLight, DirectionalLight,
  BufferGeometry, BufferAttribute, InstancedBufferGeometry, InstancedBufferAttribute, PlaneGeometry, SphereGeometry, BoxGeometry, ConeGeometry,
  Mesh, LineSegments, Points,
  MeshStandardMaterial, LineBasicMaterial, ShaderMaterial,
  CatmullRomCurve3, BackSide, DoubleSide, DynamicDrawUsage, LinearSRGBColorSpace
} from 'three';
import { makeNoise, puffMaterial, mulberry, GEN } from './puffs.js';

/* ---------- small maths ---------- */
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const hash = (i, j) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
function noise(x, z){
  const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return lerp(lerp(hash(i, j), hash(i + 1, j), a), lerp(hash(i, j + 1), hash(i + 1, j + 1), a), b);
}
const fbm = (x, z) => noise(x, z) * .58 + noise(x * 2.1 + 7.3, z * 2.1 - 3.1) * .28 + noise(x * 4.3 - 1.7, z * 4.3 + 9.2) * .14;
// creased noise, for ridgelines
function ridged(x, z){
  let s = 0, a = .55, f = 1;
  for (let o = 0; o < 4; o++) { const v = 1 - Math.abs(noise(x * f, z * f) * 2 - 1); s += v * v * a; a *= .5; f *= 2.1; }
  return s;
}
// A colour whose numbers go to the screen as written, for the shaders that came from
// atmosphere.online's sky (three.js would otherwise convert them to linear light first).
const raw = hex => new Color().setStyle(hex, LinearSRGBColorSpace);

/* ---------- the land ---------- */
// The camera looks north (-z) from above the sea. The coast runs away to the left, the sea
// on its left (-x) and the land rising to a range of mountains on the right. y is up.
const shoreAt = z => -4 + (z + 6) * .28 + 1.5 * Math.sin(z * .21 + 1.1) + .6 * Math.sin(z * .57 + .4);

function rawHeight(x, z){
  const u = x - shoreAt(z);                 // how far inland
  if (u < 0) return -(.9 * smooth(0, 3.5, -u) + 1.9 * smooth(2, 14, -u)) + (fbm(x * .3, z * .3) - .5) * .25 * smooth(0, 3, -u);
  let h = .14 * smooth(0, .6, u) + .46 * smooth(.4, 4, u);
  h += smooth(2, 9, u) * (fbm(x * .12 + 3.1, z * .12 - 1.4) - .4) * 2.6;
  h = Math.max(h, .12 * smooth(0, .6, u));
  // the near range, and a farther, taller one in the haze
  const w1 = Math.exp(-(((u - 18 - 3 * Math.sin(z * .15 + .5)) / 6.2) ** 2)) * smooth(-50, -30, z) * (1 - smooth(-10, 2, z));
  const w2 = Math.exp(-(((u - 42 - 6 * Math.sin(z * .07)) / 12) ** 2)) * smooth(-95, -70, z) * (1 - smooth(-34, -12, z));
  if (w1 > .002) h += w1 * (2.6 + 7 * ridged(x * .15 + 3, z * .15 - 7));
  if (w2 > .002) h += w2 * (4 + 9 * ridged(x * .09 - 5, z * .09 + 2));
  return h;
}

// The river: from a valley in the range to the sea in front of the camera, never uphill.
const RIVER = [[13.2, -13], [11, -9.5], [8.6, -6.6], [6.6, -3.4], [5.4, 0], [4.2, 2.6], [2.9, 4.6], [1.6, 6.4], [.5, 8.2], [-.6, 9.6]];
const RN = 120;
const riverPts = new CatmullRomCurve3(RIVER.map(([x, z]) => new Vector3(x, 0, z))).getSpacedPoints(RN);
const riverY = new Float32Array(RN + 1);
{
  let y = Infinity;
  for (let i = 0; i <= RN; i++) { y = Math.min(y, rawHeight(riverPts[i].x, riverPts[i].z) - .08); riverY[i] = Math.max(.05, y); }
  for (let pass = 0; pass < 8; pass++) for (let i = 1; i < RN; i++) riverY[i] = (riverY[i - 1] + riverY[i] * 2 + riverY[i + 1]) / 4;
}
const riverWidth = t => lerp(.3, .86, Math.pow(t, 1.2));
function riverNear(x, z){
  let best = Infinity, bi = 0;
  for (let i = 0; i <= RN; i++) { const d = (x - riverPts[i].x) ** 2 + (z - riverPts[i].z) ** 2; if (d < best) { best = d; bi = i; } }
  return [Math.sqrt(best), bi];
}
function baseHeight(x, z){
  let h = rawHeight(x, z);
  if (x > -3 && x < 16 && z > -16 && z < 12) {
    const [d, bi] = riverNear(x, z), half = riverWidth(bi / RN) * .5, bank = half + .8;
    if (d < bank) h = Math.min(h, lerp(riverY[bi] - .14, h, smooth(half, bank, d)));
  }
  return h;
}

// Plots where seeds go in: the gentlest ground in the valley, on the sea side of the river,
// under the path the rain takes. The ground is levelled a little under each one.
const PLOTS = [], PLOT_W = .95, PLOT_D = .6;
{
  const r = mulberry(4407), found = [];
  for (let tries = 0; tries < 2500; tries++) {
    const x = lerp(2.6, 8.2, r()), z = lerp(-7.8, -2.2, r()), h = baseHeight(x, z), turn = r() * Math.PI;
    if (h < .3 || h > 2.2) continue;
    const [d, bi] = riverNear(x, z);
    if (d < riverWidth(bi / RN) * .5 + 1.25) continue;
    found.push({ x, z, h, cos: Math.cos(turn), sin: Math.sin(turn), wet: 0, slope: Math.abs(baseHeight(x + .7, z) - h) + Math.abs(baseHeight(x - .7, z) - h) + Math.abs(baseHeight(x, z + .7) - h) + Math.abs(baseHeight(x, z - .7) - h) });
  }
  for (const c of found.sort((a, b) => a.slope - b.slope)) if (PLOTS.length < 5 && c.slope < 1 && !PLOTS.some(p => (p.x - c.x) ** 2 + (p.z - c.z) ** 2 < 5.8)) PLOTS.push(c);
}
// A point in a plot's own frame: along its rows, and across them.
const inPlot = (p, x, z) => [(x - p.x) * p.cos + (z - p.z) * p.sin, (z - p.z) * p.cos - (x - p.x) * p.sin];
function height(x, z){
  let h = baseHeight(x, z);
  for (const p of PLOTS) if (Math.abs(x - p.x) < 2.2 && Math.abs(z - p.z) < 2.2) {
    const [u, v] = inPlot(p, x, z);
    h = lerp(h, p.h, (1 - smooth(PLOT_W + .1, PLOT_W + .7, Math.abs(u))) * (1 - smooth(PLOT_D + .1, PLOT_D + .7, Math.abs(v))));
  }
  return h;
}

// Grid lines from lo to hi that crowd together around mid, where the camera looks.
function warp(n, lo, hi, mid, k){
  const out = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) { const t = i / n * 2 - 1, w = k * t + (1 - k) * t * t * t; out[i] = w < 0 ? mid + (mid - lo) * w : mid + (hi - mid) * w; }
  return out;
}

const LAND = {
  bedShallow: '#CFC9AC', bedDeep: '#6E8CAE', sand: '#E4DAC0',
  meadow: '#A9C383', lush: '#7FA96C', dry: '#BDBC8C', wood: '#5E8C61', soil: '#A98F72',
  rockA: '#9D9CAB', rockB: '#7B7C92', snow: '#F6F7FB'
};

function landGeometry(){
  const X = warp(230, -62, 62, 3, .3), Z = warp(210, -86, 24, -2, .3), nx = X.length, nz = Z.length;
  const pos = new Float32Array(nx * nz * 3), index = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = (j * nx + i) * 3; pos[k] = X[i]; pos[k + 1] = height(X[i], Z[j]); pos[k + 2] = Z[j]; }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; index.push(a, c, b, b, c, d); }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3)); g.setIndex(index); g.computeVertexNormals();
  // colour by height and by how level the ground is
  const nrm = g.attributes.normal, col = new Float32Array(nx * nz * 3), c = new Color(), t = new Color(), K = Object.fromEntries(Object.entries(LAND).map(([k, v]) => [k, new Color(v)]));
  for (let k = 0; k < nx * nz; k++) {
    const x = pos[k * 3], h = pos[k * 3 + 1], z = pos[k * 3 + 2], up = nrm.getY(k), n = fbm(x * .9 + 11, z * .9 + 5), big = fbm(x * .18 + 2, z * .18 + 8);
    if (h < 0) c.lerpColors(K.bedShallow, K.bedDeep, smooth(0, 2.4, -h));
    else {
      c.lerpColors(K.meadow, K.lush, smooth(.3, .7, big));
      c.lerp(K.dry, smooth(.55, .8, n) * .5);
      c.lerp(K.wood, smooth(.5, .62, fbm(x * .22 + 9, z * .22 + 3)) * .55);
      for (const p of PLOTS) if (Math.abs(x - p.x) < 1.7 && Math.abs(z - p.z) < 1.7) { const [u, v] = inPlot(p, x, z); c.lerp(K.soil, (1 - smooth(PLOT_W, PLOT_W + .25, Math.abs(u))) * (1 - smooth(PLOT_D, PLOT_D + .25, Math.abs(v))) * .82); }
      c.lerp(K.sand, 1 - smooth(.1, .34, h + (n - .5) * .12));
      c.lerp(t.lerpColors(K.rockA, K.rockB, n), Math.max(smooth(.86, .66, up), smooth(3.4, 5, h + (n - .5))));
      c.lerp(K.snow, smooth(5.4, 6.4, h + (n - .5) * 1.4) * smooth(.4, .72, up));
    }
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

// The sea: one sheet at y = 0, with how deep the water is under each point, so it can be
// clear over the shallows and break into foam at the shore. Cells over dry land are left out.
function seaGeometry(){
  const X = warp(230, -62, 62, -2, .3), Z = warp(200, -86, 24, 2, .3), nx = X.length, nz = Z.length;
  const pos = new Float32Array(nx * nz * 3), depth = new Float32Array(nx * nz), index = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; pos[k * 3] = X[i]; pos[k * 3 + 2] = Z[j]; depth[k] = clamp(-height(X[i], Z[j]), -1, 4); }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if (Math.max(depth[a], depth[b], depth[c], depth[d]) > -.2) index.push(a, c, b, b, c, d);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('aDepth', new BufferAttribute(depth, 1)); g.setIndex(index);
  return g;
}

/* ---------- day and night ---------- */
// The sky colours are atmosphere.online's Morning and Night.
const LOOKS = {
  day: {
    top: '#A7C4F2', mid: '#C4D7F6', low: '#E0E5F8', hor: '#F0EBF6', sunCol: '#FFE9C4', stars: 0,
    lit: '#FFFFFF', shadow: '#BCC5EE', rim: '#FFE2B5', storm: '#777BA6', fog: '#E3E7F7', fogMax: .72,
    rain: '#8C93C8', spark: '#F2B33C',
    hemiSky: '#DCE6FB', hemiGround: '#A49DBA', hemi: 1.7, light: '#FFEFD6', sun: 2.2,
    deep: '#4C78C2', shallow: '#A6D3D6', reflect: '#DDE5F8', glitter: '#FFF6E2', river: '#86AEE2',
    leaf: '#8DB078', leafShade: '#3F6A50', sprout: '#BDE386', shade: '#9AA0CC', windows: .1, mist: 1
  },
  night: {
    top: '#0C1030', mid: '#181F52', low: '#2B3270', hor: '#41478A', sunCol: '#8FA2E6', stars: 1,
    lit: '#B5C0EC', shadow: '#454C88', rim: '#C6D2FF', storm: '#22264A', fog: '#262C5E', fogMax: .78,
    rain: '#6D76B0', spark: '#FFC857',
    hemiSky: '#4A5AA6', hemiGround: '#1A1F44', hemi: 1.5, light: '#AFC0FF', sun: 1.4,
    deep: '#182259', shallow: '#33488C', reflect: '#4A55A0', glitter: '#D5DEFF', river: '#5F74C6',
    leaf: '#30495F', leafShade: '#141E3A', sprout: '#5E86A6', shade: '#5A5E96', windows: 2.6, mist: .5
  }
};
const RAW = ['top', 'mid', 'low', 'hor', 'sunCol', 'lit', 'shadow', 'rim', 'storm', 'fog', 'spark', 'deep', 'shallow', 'reflect', 'glitter', 'river', 'leaf', 'leafShade', 'sprout', 'shade'];
// Where the sun is seen, low over the sea, and where the light comes from: the same side,
// higher up, so a cloud's shadow falls near the rain under it.
const SUN_SEEN = new Vector3(-.155, .148, -.977).normalize(), SUN_LIGHT = new Vector3(-.28, .79, -.55).normalize();
const FOG_NEAR = 26, FOG_FAR = 118;

/* ---------- the stages ---------- */
// The whole view, then for each stage where its pin sits in the world, and where the camera
// stands and looks when someone picks it.
const WHOLE = { eye: [-1, 7.2, 30], aim: [2.6, 6.5, -6] };
const STAGES = [
  { anchor: new Vector3(-8.6, 3.4, -1), eye: [-3.4, 3, 13.5], aim: [-9.6, 3.7, -5] },
  { anchor: new Vector3(-5.6, 11, -6), eye: [2, 8.2, 12.5], aim: [-3, 9.9, -6] },
  { anchor: new Vector3(8.2, 4.6, -6), eye: [3.2, 3.5, 9.5], aim: [5.6, 2.6, -5] },
  { anchor: new Vector3(4.3, .7, 2.2), eye: [.3, 2.7, 15.5], aim: [4.8, 1, 1.2] }
];

/**
 * Draw the water cycle into `canvas`. `onFrame({ dt, pins })` is called after each drawn
 * frame with the seconds since the last one (0 for a still) and where each stage's pin is,
 * in CSS pixels from the canvas's top left (NaN for one that's out of view). Throws if the
 * browser can't give a WebGL context.
 */
export function createWaterCycle(canvas, { dark = false, onFrame } = {}){
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  const scene = new Scene();
  const camera = new PerspectiveCamera(44, 1, .5, 700);
  const rand = mulberry(20261110);
  let look = LOOKS[dark ? 'night' : 'day'];

  const noise = makeNoise(256, rand);
  const uTime = { value: 0 }, uSunView = { value: new Vector3() }, uFogNear = { value: FOG_NEAR }, uFogFar = { value: FOG_FAR }, uFogMax = { value: .72 };
  const C = Object.fromEntries(RAW.map(k => [k, new Color()]));      // colours the sky's shaders share
  const shadeCol = new Color(), uClouds = { value: Array.from({ length: 4 }, () => new Vector4(0, 0, 1, 0)) };
  scene.fog = new Fog(0xffffff, FOG_NEAR, FOG_FAR);

  /* light */
  const hemi = new HemisphereLight(), sun = new DirectionalLight();
  sun.position.copy(SUN_LIGHT).multiplyScalar(60);
  scene.add(hemi, sun);

  /* the dome: the sky's gradient, the sun low over the sea, stars at night */
  const sky = new Mesh(new SphereGeometry(500, 32, 16), new ShaderMaterial({
    side: BackSide, depthWrite: false, depthTest: false,
    uniforms: { uTop: { value: C.top }, uMid: { value: C.mid }, uLow: { value: C.low }, uHor: { value: C.hor }, uSunDir: { value: SUN_SEEN }, uSunCol: { value: C.sunCol }, uStars: { value: 0 }, uTime },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uTop, uMid, uLow, uHor, uSunDir, uSunCol; uniform float uStars, uTime;
      varying vec3 vDir;
      void main(){
        // the view only reaches a little way up the sky, so the gradient is drawn in that much
        vec3 d = normalize(vDir); float t = clamp(d.y * 2.3, 0.0, 1.0);
        vec3 c = mix(uHor, uLow, smoothstep(0.0, 0.12, t));
        c = mix(c, uMid, smoothstep(0.1, 0.4, t));
        c = mix(c, uTop, smoothstep(0.35, 0.95, t));
        float sd = max(dot(d, uSunDir), 0.0);
        c += uSunCol * (pow(sd, 6.0) * 0.14 + pow(sd, 60.0) * 0.3);
        c = mix(c, uSunCol * 0.4 + 0.6, smoothstep(0.99955, 0.9998, sd));
        if (uStars > 0.01){
          vec3 q = floor(d * 420.0);
          float h = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          c += vec3(step(0.9982, h) * uStars * (0.6 + 0.4 * sin(uTime * 2.0 + h * 60.0)) * smoothstep(0.02, 0.25, d.y));
        }
        gl_FragColor = vec4(c, 1.0);
      }`
  }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  // Ground and trees darken where a cloud stands between them and the sun.
  const underClouds = material => {
    material.onBeforeCompile = shader => {
      shader.uniforms.uClouds = uClouds; shader.uniforms.uShade = { value: shadeCol };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGround;').replace('#include <project_vertex>', `#include <project_vertex>
        vec4 ground = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          ground = instanceMatrix * ground;
        #endif
        vGround = (modelMatrix * ground).xz;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 uClouds[4]; uniform vec3 uShade; varying vec2 vGround;').replace('#include <color_fragment>', `#include <color_fragment>
        float shade = 0.0;
        for (int i = 0; i < 4; i++) shade = max(shade, uClouds[i].w * (1.0 - smoothstep(0.2, 1.0, length((vGround - uClouds[i].xy) / (uClouds[i].z * vec2(1.3, 0.8))))));
        diffuseColor.rgb *= mix(vec3(1.0), uShade, shade);`);
    };
    return material;
  };

  /* land */
  const land = new Mesh(landGeometry(), underClouds(new MeshStandardMaterial({ vertexColors: true, roughness: .96, metalness: 0 })));
  scene.add(land);

  /* sea */
  const seaMat = new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime, uNoise: { value: noise }, uSunDir: { value: SUN_SEEN }, uDeep: { value: C.deep }, uShallow: { value: C.shallow }, uReflect: { value: C.reflect }, uGlitter: { value: C.glitter }, uFog: { value: C.hor }, uFogNear, uFogFar, uClouds, uShade: { value: C.shade } },
    vertexShader: `
      attribute float aDepth; varying vec3 vW; varying float vDepth; varying float vZ;
      void main(){ vW = position; vDepth = aDepth; vec4 mv = modelViewMatrix * vec4(position, 1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform sampler2D uNoise; uniform float uTime, uFogNear, uFogFar; uniform vec3 uSunDir, uDeep, uShallow, uReflect, uGlitter, uFog, uShade; uniform vec4 uClouds[4];
      varying vec3 vW; varying float vDepth; varying float vZ;
      float swell(vec2 p){ return texture2D(uNoise, p * 0.07 + uTime * vec2(0.011, 0.006)).r + 0.5 * texture2D(uNoise, p * 0.19 - uTime * vec2(0.009, 0.015)).r; }
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        // ripples: the slope of two layers of drifting noise
        float h = swell(vW.xz), e = 0.14;
        vec3 N = normalize(vec3((h - swell(vW.xz + vec2(e, 0.0))) * 1.5, 1.0, (h - swell(vW.xz + vec2(0.0, e))) * 1.5));
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.7, vDepth));
        col = mix(col, uReflect, 0.22 + 0.62 * fres);
        // the sun's path on the water
        float spec = max(dot(N, normalize(V + uSunDir)), 0.0);
        col += uGlitter * (pow(spec, 260.0) * 1.5 + pow(spec, 28.0) * 0.16);
        // foam where it meets the shore
        float foam = smoothstep(0.24, 0.0, vDepth) * smoothstep(0.55, 1.0, h + 0.25 * sin(uTime * 0.9 + vW.x * 1.7 + vW.z * 1.3));
        col = mix(col, vec3(1.0), foam * 0.6);
        float shade = 0.0;
        for (int i = 0; i < 4; i++) shade = max(shade, uClouds[i].w * (1.0 - smoothstep(0.2, 1.0, length((vW.xz - uClouds[i].xy) / (uClouds[i].z * vec2(1.3, 0.8))))));
        col *= mix(vec3(1.0), uShade, shade * 0.8);
        col = mix(col, uFog, smoothstep(uFogNear, uFogFar, vZ));
        gl_FragColor = vec4(col, smoothstep(0.0, 0.16, vDepth) * mix(0.7, 0.97, smoothstep(0.0, 1.3, vDepth)));
      }`
  });
  const sea = new Mesh(seaGeometry(), seaMat);
  sea.renderOrder = 1; sea.frustumCulled = false;
  scene.add(sea);

  /* the river */
  const riverMat = new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide,
    uniforms: { uTime, uGlow: { value: 0 }, uRiver: { value: C.river }, uReflect: { value: C.reflect }, uSpark: { value: C.spark }, uFog: { value: C.hor }, uFogNear, uFogFar },
    vertexShader: 'varying vec2 vUv; varying float vZ; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `
      uniform float uTime, uGlow, uFogNear, uFogFar; uniform vec3 uRiver, uReflect, uSpark, uFog; varying vec2 vUv; varying float vZ;
      void main(){
        float mid = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float flow = vUv.y * 170.0 - uTime * 3.2 + sin(vUv.x * 9.0 + vUv.y * 44.0) * 0.9;
        float streak = smoothstep(0.7, 1.0, sin(flow) * 0.5 + 0.5) * smoothstep(0.1, 0.6, mid);
        vec3 c = mix(uRiver * 0.84, uRiver, smoothstep(0.0, 0.7, mid));
        c = mix(c, uReflect, 0.16 + streak * (0.32 + 0.35 * uGlow));
        // a few sparks, carried home
        float along = vUv.y * 22.0 - uTime * 0.34, id = floor(along), r = fract(sin(id * 91.7) * 43758.5453);
        c = mix(c, uSpark, step(0.55, r) * smoothstep(0.055, 0.02, length(vec2((vUv.x - 0.3 - 0.4 * fract(r * 7.3)) * 0.5, (fract(along) - 0.5) * 0.9))));
        c = mix(c, uFog, smoothstep(uFogNear, uFogFar, vZ));
        gl_FragColor = vec4(c, smoothstep(0.0, 0.03, vUv.y) * (1.0 - smoothstep(0.93, 1.0, vUv.y)) * smoothstep(0.0, 0.3, mid) * 0.94);
      }`
  });
  {
    const p = [], uv = [], idx = [];
    for (let i = 0; i <= RN; i++) {
      const a = riverPts[Math.max(0, i - 1)], b = riverPts[Math.min(RN, i + 1)], c = riverPts[i];
      const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1, w = riverWidth(i / RN) * .78, y = riverY[i] + .03;
      p.push(c.x + tz / l * w, y, c.z - tx / l * w, c.x - tz / l * w, y, c.z + tx / l * w);
      uv.push(0, i / RN, 1, i / RN);
      if (i < RN) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3)); g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2)); g.setIndex(idx);
    const river = new Mesh(g, riverMat); river.renderOrder = 2;
    scene.add(river);
  }

  /* a village by the river mouth: your circle lives here */
  const HOUSES = [[3.6, 6.2, .3], [4.4, 5.4, -.5], [5.2, 6.4, .9], [5.9, 5, .1], [4.3, 7.2, -.3], [6.6, 6.1, .6], [5.1, 4.2, -.8]];
  const windowMat = new MeshStandardMaterial({ color: '#F1D08A', emissive: '#F5B83D', roughness: .6 });
  {
    const wall = new MeshStandardMaterial({ color: '#EFE9DF', roughness: .9 }), roofs = ['#B9705C', '#8E8FA6', '#B9705C', '#A9806A', '#8E8FA6'].map(c => new MeshStandardMaterial({ color: c, roughness: .85 }));
    const box = new BoxGeometry(.34, .2, .26), roof = new ConeGeometry(.27, .16, 4), pane = new PlaneGeometry(.06, .07);
    roof.rotateY(Math.PI / 4); roof.scale(1, 1, .8);
    HOUSES.forEach(([x, z, turn], i) => {
      const g = new Group(), b = new Mesh(box, wall), r = new Mesh(roof, roofs[i % roofs.length]), w1 = new Mesh(pane, windowMat), w2 = new Mesh(pane, windowMat);
      b.position.y = .1; r.position.y = .28; w1.position.set(-.08, .1, .131); w2.position.set(.08, .1, .131);
      g.add(b, r, w1, w2); g.position.set(x, height(x, z) - .02, z); g.rotation.y = turn;
      scene.add(g);
    });
  }

  /* woods: soft round crowns in patches, thinning out with height. Each is one point, drawn
     as a little lit ball, so a wood reads as canopy rather than as a field of models. */
  const treeMat = new ShaderMaterial({
    uniforms: { uScale: { value: 1 }, uLeaf: { value: C.leaf }, uLeafShade: { value: C.leafShade }, uFog: { value: C.hor }, uFogNear, uFogFar, uClouds, uShade: { value: C.shade } },
    vertexShader: `
      attribute float aSize; attribute float aTone; uniform float uScale, uFogNear, uFogFar; uniform vec4 uClouds[4];
      varying float vTone; varying float vFog; varying float vShade;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / -mv.z;
        vTone = aTone; vFog = smoothstep(uFogNear, uFogFar, -mv.z);
        vShade = 0.0;
        for (int i = 0; i < 4; i++) vShade = max(vShade, uClouds[i].w * (1.0 - smoothstep(0.2, 1.0, length((position.xz - uClouds[i].xy) / (uClouds[i].z * vec2(1.3, 0.8))))));
      }`,
    fragmentShader: `
      uniform vec3 uLeaf, uLeafShade, uFog, uShade; varying float vTone; varying float vFog; varying float vShade;
      void main(){
        vec2 p = (gl_PointCoord - 0.5) * vec2(2.5, 2.0);     // a crown a little taller than wide
        float r2 = dot(p, p);
        if (r2 > 1.0) discard;
        // lit from up and to the left, where the sun is
        float l = clamp(dot(normalize(vec3(p.x, -p.y, sqrt(1.0 - r2))), vec3(-0.44, 0.74, 0.5)) * 0.6 + 0.42, 0.0, 1.0);
        vec3 c = mix(uLeafShade, uLeaf, l) * (0.88 + 0.2 * vTone);
        c *= mix(vec3(1.0), uShade, vShade);
        gl_FragColor = vec4(mix(c, uFog, vFog), 1.0);
      }`
  });
  {
    const P = [], S = [], T = [];
    for (let tries = 0; S.length < 3200 && tries < 80000; tries++) {
      const x = lerp(-9, 34, rand()), z = lerp(-46, 9.5, rand());
      if (x - shoreAt(z) < 1.2 || fbm(x * .22 + 9, z * .22 + 3) < .5 + (rand() - .5) * .2) continue;
      if (HOUSES.some(h => (h[0] - x) ** 2 + (h[1] - z) ** 2 < .5)) continue;
      const h = height(x, z);
      if (h < .3 || h > 4.4 || Math.abs(height(x + .3, z) - h) + Math.abs(height(x, z + .3) - h) > .36) continue;
      if (x > -3 && x < 16 && z > -16 && z < 12) { const [d, bi] = riverNear(x, z); if (d < riverWidth(bi / RN) * .5 + .45) continue; }
      const size = lerp(.22, .42, rand());
      P.push(x, h + size * .36, z); S.push(size); T.push(rand());
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(P), 3)); g.setAttribute('aSize', new BufferAttribute(new Float32Array(S), 1)); g.setAttribute('aTone', new BufferAttribute(new Float32Array(T), 1));
    const trees = new Points(g, treeMat);
    trees.frustumCulled = false;
    scene.add(trees);
  }

  /* seeds: rows of them in the plots along the river. Rain brings one up; once it has
     sprouted it holds its gold bud a while, and then a new seed goes in. */
  const SPROUTS = [];
  PLOTS.forEach((p, k) => {
    for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) {
      const u = lerp(-PLOT_W + .14, PLOT_W - .14, col / 6) + (rand() - .5) * .05, v = lerp(-PLOT_D + .13, PLOT_D - .13, row / 3) + (rand() - .5) * .05;
      const x = p.x + u * p.cos - v * p.sin, z = p.z + u * p.sin + v * p.cos, up = rand() < .35;
      SPROUTS.push({ plot: k, x, z, y: height(x, z), g: up ? 1 : rand() * .7, rest: up ? .5 + rand() * 20 : 0, hold: lerp(16, 30, rand()), rate: lerp(.1, .16, rand()) });
    }
  });
  const sproutGeo = new BufferGeometry(), sproutPos = new BufferAttribute(new Float32Array(SPROUTS.length * 3), 3), sproutSize = new BufferAttribute(new Float32Array(SPROUTS.length), 1), sproutBloom = new BufferAttribute(new Float32Array(SPROUTS.length), 1);
  for (const a of [sproutPos, sproutSize, sproutBloom]) a.setUsage(DynamicDrawUsage);
  sproutGeo.setAttribute('position', sproutPos); sproutGeo.setAttribute('aSize', sproutSize); sproutGeo.setAttribute('aBloom', sproutBloom);
  const sproutMat = new ShaderMaterial({
    uniforms: { uScale: { value: 1 }, uSprout: { value: C.sprout }, uLeafShade: { value: C.leafShade }, uSpark: { value: C.spark }, uFog: { value: C.hor }, uFogNear, uFogFar },
    vertexShader: `
      attribute float aSize; attribute float aBloom; uniform float uScale, uFogNear, uFogFar; varying float vBloom; varying float vFog;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / -mv.z; vBloom = aBloom; vFog = smoothstep(uFogNear, uFogFar, -mv.z); }`,
    fragmentShader: `
      uniform vec3 uSprout, uLeafShade, uSpark, uFog; varying float vBloom; varying float vFog;
      void main(){
        // a seedling: a stem, a leaf to each side, and a gold bud once it has sprouted
        vec2 p = (gl_PointCoord - 0.5) * vec2(2.0, -2.0);
        float stem = step(abs(p.x), 0.075) * step(p.y, 0.15);
        vec2 a = p - vec2(0.4, 0.2), b = p - vec2(-0.4, 0.2);
        float leaf = max(step(length(vec2(a.x * 0.82 + a.y * 0.57, a.y * 0.82 - a.x * 0.57) / vec2(0.52, 0.25)), 1.0), step(length(vec2(b.x * 0.82 - b.y * 0.57, b.y * 0.82 + b.x * 0.57) / vec2(0.52, 0.25)), 1.0));
        float bud = vBloom * step(length(p - vec2(0.0, 0.66)), 0.24);
        if (max(max(stem, leaf), bud) < 0.5) discard;
        vec3 c = mix(mix(uLeafShade, uSprout, 0.55 + 0.45 * p.y), uSpark, bud);
        gl_FragColor = vec4(mix(c, uFog, vFog), 1.0);
      }`
  });
  const sprouts = new Points(sproutGeo, sproutMat);
  sprouts.frustumCulled = false;
  scene.add(sprouts);
  function moveSprouts(dt){
    for (const p of PLOTS) {
      p.wet = 0;
      for (const c of CLOUDS) p.wet = Math.max(p.wet, c.rain * (1 - smooth(.55, 1.1, Math.hypot((p.x - c.x - .5) / (5.5 * c.size), (p.z - c.z) / (3.6 * c.size)))));
    }
    SPROUTS.forEach((s, i) => {
      if (s.rest > 0) { s.rest -= dt; if (s.rest <= 0) s.g = 0; }
      else { s.g = Math.min(1, s.g + dt * PLOTS[s.plot].wet * s.rate); if (s.g >= 1) s.rest = s.hold; }
      const size = lerp(.08, .3, s.g * s.g * (3 - 2 * s.g));
      sproutPos.setXYZ(i, s.x, s.y + size * .42, s.z); sproutSize.setX(i, size); sproutBloom.setX(i, s.g >= 1 ? 1 : 0);
    });
    sproutPos.needsUpdate = sproutSize.needsUpdate = sproutBloom.needsUpdate = true;
  }

  /* puffs: every cloud, the mist off the sea and the shafts of rain, in one sorted batch */
  const MAX = 2600;
  const puffGeo = new InstancedBufferGeometry();
  { const pl = new PlaneGeometry(2, 2); puffGeo.index = pl.index; puffGeo.setAttribute('position', pl.getAttribute('position')); }
  const attr = n => { const a = new InstancedBufferAttribute(new Float32Array(MAX * n), n); a.setUsage(DynamicDrawUsage); return a; };
  const aPos = attr(3), aRad = attr(1), aData = attr(4), aEro = attr(1), aShape = attr(4);
  puffGeo.setAttribute('aPos', aPos); puffGeo.setAttribute('aRad', aRad); puffGeo.setAttribute('aData', aData); puffGeo.setAttribute('aEro', aEro); puffGeo.setAttribute('aShape', aShape);
  puffGeo.instanceCount = 0;
  const puffMat = puffMaterial({ uTime, uSunView, noise, lit: C.lit, shadow: C.shadow, rim: C.rim, storm: C.storm, fog: C.fog, fogNear: { value: 30 }, fogFar: { value: 150 }, fogMax: uFogMax, billow: 1 });
  const puffMesh = new Mesh(puffGeo, puffMat);
  puffMesh.frustumCulled = false; puffMesh.renderOrder = 5;
  scene.add(puffMesh);

  // Puffs are staged unsorted, then written out far to near.
  const stPos = new Float32Array(MAX * 3), stRad = new Float32Array(MAX), stData = new Float32Array(MAX * 4), stEro = new Float32Array(MAX), stAx = new Float32Array(MAX * 4), depth = new Float32Array(MAX), order = new Uint32Array(MAX);
  const fwd = new Vector3();
  let staged = 0;
  function put(x, y, z, r, light, storm, alpha, seed, ero, ax, ay, az, st){
    if (staged >= MAX || r < .004 || alpha < .003) return;
    const n = staged++, i3 = n * 3, i4 = n * 4, cam = camera.position;
    stPos[i3] = x; stPos[i3 + 1] = y; stPos[i3 + 2] = z; stRad[n] = r;
    stData[i4] = light; stData[i4 + 1] = storm; stData[i4 + 2] = alpha; stData[i4 + 3] = seed; stEro[n] = ero;
    stAx[i4] = ax; stAx[i4 + 1] = ay; stAx[i4 + 2] = az; stAx[i4 + 3] = st;
    depth[n] = (x - cam.x) * fwd.x + (y - cam.y) * fwd.y + (z - cam.z) * fwd.z;
  }
  function flush(){
    const n = staged;
    for (let i = 0; i < n; i++) order[i] = i;
    order.subarray(0, n).sort((a, b) => depth[b] - depth[a]);
    const P = aPos.array, R = aRad.array, D = aData.array, E = aEro.array, A = aShape.array;
    for (let i = 0; i < n; i++) {
      const j = order[i];
      P[i * 3] = stPos[j * 3]; P[i * 3 + 1] = stPos[j * 3 + 1]; P[i * 3 + 2] = stPos[j * 3 + 2]; R[i] = stRad[j]; E[i] = stEro[j];
      for (let k = 0; k < 4; k++) { D[i * 4 + k] = stData[j * 4 + k]; A[i * 4 + k] = stAx[j * 4 + k]; }
    }
    puffGeo.instanceCount = n;
    aPos.needsUpdate = aRad.needsUpdate = aData.needsUpdate = aEro.needsUpdate = aShape.needsUpdate = true;
  }

  /* clouds */
  // Give a cloud a shape: its puffs glide to their new places, new ones swell from nothing,
  // and any left over shrink away.
  function shape(c, type, count, tall){
    const gen = GEN[type](c.seed, { count, height: tall, fluff: c.fluff }), next = [];
    // Growing leaves every puff where it is and adds to them. Turning into another kind of
    // cloud seats them again from the bottom up, so the base stays the base.
    if (type !== c.type) { gen.sort((a, b) => a.y - b.y); c.puffs.sort((a, b) => a.y - b.y); c.type = type; }
    let top = .5;
    for (let i = 0; i < gen.length; i++) {
      const g = gen[i], p = c.puffs[i] || { x: g.x, y: g.y, z: g.z, r: 0, sh: g.sh, ax: g.ax ?? 0, ay: g.ay ?? 1, az: g.az ?? 0, st: g.st ?? 1, seed: c.rand() };
      p.tx = g.x; p.ty = g.y; p.tz = g.z; p.tr = g.r; p.tsh = g.sh; p.tax = g.ax ?? 0; p.tay = g.ay ?? 1; p.taz = g.az ?? 0; p.tst = g.st ?? 1; p.dying = false;
      top = Math.max(top, g.y + g.r * .5);
      next.push(p);
    }
    for (let i = gen.length; i < c.puffs.length; i++) { const p = c.puffs[i]; p.tr = 0; p.dying = true; next.push(p); }
    c.puffs = next; c.top = top; c.form = 1;
  }
  function settle(c, k){
    let gone = false;
    for (const p of c.puffs) {
      p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k; p.r += (p.tr - p.r) * k; p.sh += (p.tsh - p.sh) * k;
      // an axis turned end for end is the same shape, so it turns the short way round
      if (p.ax * p.tax + p.ay * p.tay + p.az * p.taz < 0) { p.tax = -p.tax; p.tay = -p.tay; p.taz = -p.taz; }
      p.ax += (p.tax - p.ax) * k; p.ay += (p.tay - p.ay) * k; p.az += (p.taz - p.az) * k; p.st += (p.tst - p.st) * k;
      if (p.dying && p.r < .01) gone = p.gone = true;
    }
    if (gone) c.puffs = c.puffs.filter(p => !p.gone);
  }
  // Stage a cloud's puffs with its base at (x, y, z): each lit by how high it sits in the
  // cloud and whether it's on the sunny side.
  function stage(c, x, y, z, s, alpha, ero, mood){
    const my = y + c.top * s * .45;
    for (const p of c.puffs) {
      const wx = x + p.x * s, wy = y + p.y * s, wz = z + p.z * s, ox = wx - x, oy = wy - my, oz = wz - z, ol = Math.hypot(ox, oy, oz) || 1;
      const side = (ox * SUN_LIGHT.x + oy * SUN_LIGHT.y + oz * SUN_LIGHT.z) / ol, h = clamp(p.y / c.top, 0, 1), al = Math.hypot(p.ax, p.ay, p.az) || 1;
      put(wx, wy, wz, p.r * s, .17 + .5 * h + .45 * (.5 + .5 * side), clamp(p.sh + mood * .55 * (1 - h * .55), 0, .92), alpha, p.seed, ero, p.ax / al, p.ay / al, p.az / al, p.st);
    }
  }
  const newCloud = (seed, fluff = .5) => ({ seed, fluff, rand: mulberry(seed * 31 + 7), puffs: [], top: 1, form: 0, key: '', type: '' });

  // The ones with a life: across the sky in PERIOD seconds, four of them a quarter apart.
  const PERIOD = 76, X0 = -12.5, X1 = 21;
  const lifeAt = p => p < .1 ? ['cumulus', .3] : p < .22 ? ['cumulus', .55] : p < .34 ? ['cumulus', .8] : p < .46 ? ['cumulus', 1] : p < .86 ? ['nimbus', .62] : ['cumulus', .45];
  const CLOUDS = [[-7, 8.1], [-3.6, 8.6], [-9.4, 7.9], [-5.4, 8.4]].map(([z, y], i) => ({ ...newCloud(101 + i * 37, .45 + rand() * .3), z, base: y, offset: i / 4, bob: rand() * 6, p: -1, x: 0, y: 0, size: 0, alpha: 0, mood: 0, rain: 0 }));
  // And a few far ones that just sit in the haze, for depth.
  const FAR = [[-44, 10, -104, 1.8], [-10, 13.5, -118, 2], [22, 16, -108, 1.6], [58, 12, -96, 1.7], [-78, 11, -84, 1.5]].map(([x, y, z, s], i) => {
    const c = { ...newCloud(900 + i * 53, .6), x, y, z, s };
    shape(c, 'cumulus', .45, 1); settle(c, 1);
    return c;
  });
  function moveClouds(t, dt, snap, lift){
    CLOUDS.forEach((c, i) => {
      const p = fract(t / PERIOD + c.offset);
      if (p < c.p) { c.puffs = []; c.key = c.type = ''; }        // round again: a new cloud
      c.p = p;
      const [type, count] = lifeAt(p), key = type + count;
      if (key !== c.key) { c.key = key; shape(c, type, count, type === 'nimbus' ? .8 : 1); }
      settle(c, snap ? 1 : 1 - Math.exp(-dt * (c.form > 0 ? 1.4 : 5)));
      c.form = snap ? 0 : Math.max(0, c.form - dt / 3.2);
      c.size = lerp(.36, .6, smooth(0, .46, p)) + .05 * smooth(.46, .56, p) - .12 * smooth(.86, 1, p);
      c.alpha = smooth(0, .05, p) * (1 - smooth(.9, 1, p)) * .96;
      c.mood = smooth(.42, .56, p) * (1 - smooth(.78, .86, p)) * .62;
      c.rain = smooth(.5, .58, p) * (1 - smooth(.76, .83, p));
      c.x = lerp(X0, X1, p); c.y = c.base + Math.sin(t * .25 + c.bob) * .12;
      stage(c, c.x, c.y, c.z, c.size * (1 + .04 * lift), c.alpha, .62, c.mood);
      // its shadow on the ground, down the light from where it stands
      const H = c.y + c.top * c.size * .4, u = uClouds.value[i];
      u.set(c.x - SUN_LIGHT.x / SUN_LIGHT.y * H, c.z - SUN_LIGHT.z / SUN_LIGHT.y * H, 7.5 * c.size, c.alpha * (.45 + .5 * c.mood / .62) * smooth(.3, .5, c.size));
    });
    for (const c of FAR) stage(c, c.x, c.y, c.z, c.s, .9, .6, 0);
  }

  /* mist off the sea: a function of time alone, so a still frame is as full as a moving one */
  const VN = 120, mist = Array.from({ length: VN }, () => ({ x: lerp(-13, -3.5, rand()), z: lerp(-13, 7, rand()), life: lerp(15, 24, rand()), offset: rand() * 24, sway: rand() * 6.28, top: lerp(7.4, 8.8, rand()), size: lerp(.75, 1.3, rand()), seed: rand() }));
  function moveMist(t, lift){
    for (const s of mist) {
      const u = fract((t + s.offset) / s.life);
      put(s.x + u * u * 3 + Math.sin(u * 5 + s.sway) * .4, .25 + u * s.top, s.z + Math.cos(u * 4 + s.sway) * .35, lerp(.28, 1.05, u) * s.size, .7, 0,
        smooth(0, .14, u) * (1 - smooth(.4, .92, u)) * (.17 + .17 * lift) * look.mist, s.seed, .95, 0, 1, 0, 1.5);
    }
  }
  // the sparks in it: the gold from the logo, rising with the mist
  const SN = 34, sparkSeed = Array.from({ length: SN }, () => ({ x: lerp(-12, -4, rand()), z: lerp(-11, 6, rand()), life: lerp(13, 20, rand()), offset: rand() * 20, sway: rand() * 6.28 }));
  const sparkGeo = new BufferGeometry(), sparkPos = new BufferAttribute(new Float32Array(SN * 3), 3), sparkA = new BufferAttribute(new Float32Array(SN), 1);
  sparkPos.setUsage(DynamicDrawUsage); sparkA.setUsage(DynamicDrawUsage);
  sparkGeo.setAttribute('position', sparkPos); sparkGeo.setAttribute('aAlpha', sparkA);
  const sparkMat = new ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uScale: { value: 1 }, uColor: { value: C.spark } },
    vertexShader: 'attribute float aAlpha; uniform float uScale; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 0.2 * uScale / -mv.z; vA = aAlpha; }',
    fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5)) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uColor, a); }'
  });
  const sparks = new Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false; sparks.renderOrder = 4;
  scene.add(sparks);
  function moveSparks(t, lift){
    sparkSeed.forEach((s, i) => {
      const u = fract((t + s.offset) / s.life);
      sparkPos.setXYZ(i, s.x + u * u * 3 + Math.sin(u * 6 + s.sway) * .3, .2 + u * 8, s.z + Math.cos(u * 5 + s.sway) * .3);
      sparkA.setX(i, smooth(0, .1, u) * (1 - smooth(.7, 1, u)) * (.75 + .25 * lift));
    });
    sparkPos.needsUpdate = sparkA.needsUpdate = true;
  }

  /* rain: streaks that fall while their cloud is raining, inside soft grey shafts */
  const DN = 420, drops = Array.from({ length: DN }, (_, i) => ({ cloud: i % CLOUDS.length, need: rand() * .9, on: false, x: 0, y: 0, z: 0, ground: 0, v: lerp(9, 13, rand()), gold: i % 11 === 5 }));
  const rainGeo = new BufferGeometry(), rainPos = new BufferAttribute(new Float32Array(DN * 6), 3), rainCol = new BufferAttribute(new Float32Array(DN * 6), 3);
  rainPos.setUsage(DynamicDrawUsage);
  rainGeo.setAttribute('position', rainPos); rainGeo.setAttribute('color', rainCol);
  const rainMat = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .5, depthWrite: false });
  const rain = new LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false; rain.renderOrder = 3;
  scene.add(rain);
  function moveRain(dt){
    const a = rainPos.array;
    for (let i = 0; i < DN; i++) {
      const d = drops[i], c = CLOUDS[d.cloud];
      if (d.on) { d.y -= d.v * dt; d.x += .8 * dt; if (d.y <= d.ground) d.on = false; }
      if (!d.on && c.rain > d.need) {
        d.x = c.x + (rand() - .5) * 11 * c.size; d.z = c.z + (rand() - .5) * 5 * c.size; d.y = c.y + .4 - rand() * d.v * .2;
        d.ground = Math.max(height(d.x + .6, d.z), 0) + .05; d.on = true;
      }
      const o = i * 6, len = d.on ? Math.min(.8, c.y + .4 - d.y) : 0;
      a[o] = d.x; a[o + 1] = d.y; a[o + 2] = d.z; a[o + 3] = d.x - .07 * len; a[o + 4] = d.y + len; a[o + 5] = d.z;
    }
    rainPos.needsUpdate = true;
  }
  const VEIL = Array.from({ length: 16 }, () => ({ x: (rand() - .5) * 10, z: (rand() - .5) * 4, r: lerp(.9, 1.5, rand()), y: rand(), seed: rand() }));
  function moveVeil(lift){
    for (const c of CLOUDS) {
      if (c.rain < .02) continue;
      for (const v of VEIL) {
        const x = c.x + v.x * c.size + .4, z = c.z + v.z * c.size, g = Math.max(height(x, z), 0);
        put(x, lerp(g + 1.6, c.y - .6, .35 + v.y * .5), z, v.r, .45, .55, c.rain * c.alpha * (.11 + .05 * lift), v.seed, .9, .08, 1, 0, 3.4);
      }
    }
  }

  /* day or night */
  function paint(){
    for (const k of RAW) C[k].setStyle(look[k], LinearSRGBColorSpace);
    sky.material.uniforms.uStars.value = look.stars; uFogMax.value = look.fogMax;
    scene.fog.color.set(look.hor);
    hemi.color.set(look.hemiSky); hemi.groundColor.set(look.hemiGround); hemi.intensity = look.hemi;
    sun.color.set(look.light); sun.intensity = look.sun;
    shadeCol.set(look.shade);
    windowMat.emissiveIntensity = look.windows;
    const r = new Color(look.rain), g = new Color(look.spark);
    for (let i = 0; i < DN; i++) { const c = drops[i].gold ? g : r; rainCol.setXYZ(i * 2, c.r, c.g, c.b); rainCol.setXYZ(i * 2 + 1, c.r, c.g, c.b); }
    rainCol.needsUpdate = true;
  }

  /* camera: over the sea, looking up the coast, until someone picks a stage. Then it flies
     in for a closer look at that part of the cycle. It drifts a little with the pointer. */
  const eye = new Vector3(...WHOLE.eye), aim = new Vector3(...WHOLE.aim), pointer = { x: 0, y: 0, ex: 0, ey: 0 };
  const weight = [0, 0, 0, 0], tmp = new Vector3();
  let focus = -1, close = 0, width = 1, height_ = 1;       // close: 0 in the whole view, 1 right up to a stage
  function pose(t){
    const drift = 1 - .6 * close;
    camera.position.set(eye.x + (Math.sin(t * .11) * .3 + pointer.ex * .9) * drift, eye.y - pointer.ey * .35 * drift, eye.z);
    camera.lookAt(aim); camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    camera.getWorldDirection(fwd);
    uSunView.value.copy(SUN_SEEN).transformDirection(camera.matrixWorldInverse);
  }
  function ease(dt, snap){
    const k = snap ? 1 : 1 - Math.exp(-dt * 2.4), to = focus < 0 ? WHOLE : STAGES[focus];
    for (let i = 0; i < 4; i++) weight[i] += ((i === focus ? 1 : 0) - weight[i]) * k;
    eye.x += (to.eye[0] - eye.x) * k; eye.y += (to.eye[1] - eye.y) * k; eye.z += (to.eye[2] - eye.z) * k;
    aim.x += (to.aim[0] - aim.x) * k; aim.y += (to.aim[1] - aim.y) * k; aim.z += (to.aim[2] - aim.z) * k;
    close += ((focus < 0 ? 0 : 1) - close) * k;
    pointer.ex += (pointer.x - pointer.ex) * k; pointer.ey += (pointer.y - pointer.ey) * k;
  }

  /* drawing */
  const START = PERIOD * .11;
  let time = START, running = false, raf = 0, last = 0, lost = false;
  const pins = new Float32Array(8);
  function draw(dt, snap, real = dt){
    if (lost) return;
    ease(dt, snap); pose(time);
    uTime.value = time; riverMat.uniforms.uGlow.value = weight[3]; rainMat.opacity = (look === LOOKS.night ? .62 : .5) + .2 * weight[2];
    staged = 0;
    moveClouds(time, dt, snap, weight[1]); moveMist(time, weight[0]); moveVeil(weight[2]); flush();
    moveSparks(time, weight[0]); moveRain(dt); moveSprouts(dt);
    renderer.render(scene, camera);
    STAGES.forEach((s, i) => {
      tmp.copy(s.anchor).project(camera);
      const seen = tmp.z < 1 && Math.abs(tmp.x) < 1 && Math.abs(tmp.y) < 1;
      pins[i * 2] = seen ? (tmp.x * .5 + .5) * width : NaN; pins[i * 2 + 1] = seen ? (-tmp.y * .5 + .5) * height_ : NaN;
    });
    onFrame?.({ dt: real, pins });
  }
  // The scene moves at most a fifteenth of a second per frame, so a slow device sees it
  // slow down rather than jump; `real` is the time that actually passed.
  // A frame's timestamp can be earlier than the moment the loop was started, so the first
  // frame after a start counts as no time at all, and time never runs backwards.
  function frame(now){
    raf = requestAnimationFrame(frame);
    if (last < 0) last = now;
    const real = clamp((now - last) / 1000, 0, .25), dt = Math.min(1 / 15, real); last = now; time += dt;
    draw(dt, false, real);
  }
  function resize(){
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    width = w; height_ = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    // keep the whole coast in view on a narrow screen by widening the lens
    camera.aspect = w / h; camera.fov = clamp(2 * Math.atan(Math.tan(22 * Math.PI / 180) * Math.max(1, 1.19 / camera.aspect)) * 180 / Math.PI, 44, 64);
    camera.updateProjectionMatrix();
    sparkMat.uniforms.uScale.value = treeMat.uniforms.uScale.value = sproutMat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    if (!running) draw(0, true);
  }

  const onLost = e => { e.preventDefault(); lost = true; }, onBack = () => { lost = false; if (!running) draw(0, true); };
  canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onBack);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  // Start mid-cycle with rain already falling, so even a still frame shows the whole loop.
  paint(); pose(time); staged = 0; moveClouds(time, 0, true, 0);
  for (let k = 0; k < 60; k++) moveRain(1 / 30);
  resize();

  return {
    /** Fly in for a closer look at a stage (0 evaporation, 1 condensation, 2 precipitation, 3 collection), or back out to the whole view (-1). */
    focus(i){ focus = clamp(i | 0, -1, 3); if (!running) draw(0, true); },
    /** The stage whose pin is nearest a point on the canvas (CSS pixels), or -1 if none is near. */
    stageAt(x, y){
      let best = -1, d = (Math.min(width, height_) * .28) ** 2;
      for (let i = 0; i < 4; i++) { const q = (pins[i * 2] - x) ** 2 + (pins[i * 2 + 1] - y) ** 2; if (q < d) { d = q; best = i; } }
      return best;
    },
    setDark(on){ look = LOOKS[on ? 'night' : 'day']; paint(); if (!running) draw(0, true); },
    /** Animate, or hold still on the current frame. */
    setRunning(on){
      if (on === running) return;
      running = on; cancelAnimationFrame(raf);
      if (on) { last = -1; raf = requestAnimationFrame(frame); }
    },
    /** The pointer, from -1 to 1 across the scene, for a little parallax. */
    setPointer(x, y){ pointer.x = clamp(x, -1, 1); pointer.y = clamp(y, -1, 1); },
    get running(){ return running; },
    dispose(){
      cancelAnimationFrame(raf); observer.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onBack);
      scene.traverse(o => { o.geometry?.dispose?.(); [].concat(o.material || []).forEach(m => m.dispose?.()); });
      noise.dispose(); renderer.dispose();
    }
  };
}
