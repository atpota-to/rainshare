// The landing's water cycle, in three.js: a cut-away of sea, coast and hills.
//
//   evaporation     vapour lifts off the sea        spare usage rising off a plan
//   condensation    it gathers into clouds          forecasts, in your circle
//   precipitation   the clouds rain on the hills    agents sent after sidequests
//   collection      the river runs back to the sea  pull requests coming home
//
// Everything is made here from a seed: no models or textures to download. The page asks for
// this file only when the landing is on screen (see ./landing.js), so three.js stays out of
// the way of anyone who's signed in.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Vector3, Group, Object3D,
  HemisphereLight, DirectionalLight,
  BufferGeometry, BufferAttribute, IcosahedronGeometry, ConeGeometry, CylinderGeometry, BoxGeometry, PlaneGeometry, SphereGeometry,
  Mesh, InstancedMesh, Points, Sprite,
  MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, SpriteMaterial,
  CanvasTexture, CatmullRomCurve3, DoubleSide, DynamicDrawUsage, SRGBColorSpace
} from 'three';

/* ---------- small maths ---------- */
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
function rng(seed){
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const hash = (i, j) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
function noise(x, z){
  const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return lerp(lerp(hash(i, j), hash(i + 1, j), a), lerp(hash(i, j + 1), hash(i + 1, j + 1), a), b);
}
const fbm = (x, z) => noise(x, z) * .58 + noise(x * 2.1 + 7.3, z * 2.1 - 3.1) * .28 + noise(x * 4.3 - 1.7, z * 4.3 + 9.2) * .14;

/* ---------- the land ---------- */
// The block is 16 by 10, sea to the left (-x), hills and a mountain to the right, y up.
const HX = 8, HZ = 5, BASE = -2.3;

function rawHeight(x, z){
  const shore = -2.5 + Math.sin(z * .55 + .6) * .65 + Math.sin(z * 1.4 + 2) * .18;
  const u = x - shore;
  if (u < 0) return -1.55 * smooth(0, 3.4, -u) + (fbm(x * .6, z * .6) - .5) * .3 * smooth(0, 2, -u);
  let h = .42 * smooth(0, 1.5, u) + .75 * smooth(1.6, 7, u);
  h += smooth(.6, 3.2, u) * (fbm(x * .5 + 3.1, z * .5 - 1.4) - .42) * 1.5;
  const m1 = Math.exp(-((x - 5.5) ** 2 / 4.2 + (z + 1.8) ** 2 / 5));
  const m2 = Math.exp(-((x - 7.1) ** 2 / 3 + (z - 3) ** 2 / 2.8));
  h += 3 * m1 + 1.5 * m2;
  h += (m1 + m2 * .6) * (fbm(x * 1.3, z * 1.3) - .5) * 1.1;
  return h;
}

// The river: from the mountain's flank to the sea, never uphill.
const RIVER = [[5.2, .7], [4.1, 1.7], [2.8, 1.1], [1.5, 2.1], [.3, 1.5], [-.9, 2.3], [-1.75, 2.05], [-2.25, 2.1]];
const RN = 90;
const riverPts = new CatmullRomCurve3(RIVER.map(([x, z]) => new Vector3(x, 0, z))).getSpacedPoints(RN);
const riverY = new Float32Array(RN + 1);
{
  let y = Infinity;
  for (let i = 0; i <= RN; i++) { y = Math.min(y, rawHeight(riverPts[i].x, riverPts[i].z) - .1); riverY[i] = Math.max(.07, y); }
  for (let pass = 0; pass < 6; pass++) for (let i = 1; i < RN; i++) riverY[i] = (riverY[i - 1] + riverY[i] * 2 + riverY[i + 1]) / 4;
}
const riverWidth = t => lerp(.26, .62, Math.pow(t, 1.3));

function height(x, z){
  let h = rawHeight(x, z), best = Infinity, bi = 0;
  for (let i = 0; i <= RN; i++) { const d = (x - riverPts[i].x) ** 2 + (z - riverPts[i].z) ** 2; if (d < best) { best = d; bi = i; } }
  const d = Math.sqrt(best), half = riverWidth(bi / RN) * .5, bank = half + .6;
  if (d < bank) h = Math.min(h, lerp(riverY[bi] - .16, h, smooth(half, bank, d)));
  return h;
}

const STEP = .14, NX = Math.round(2 * HX / STEP), NZ = Math.round(2 * HZ / STEP), DX = 2 * HX / NX, DZ = 2 * HZ / NZ;
const grid = new Float32Array((NX + 1) * (NZ + 1));
for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) grid[j * (NX + 1) + i] = height(-HX + i * DX, -HZ + j * DZ);
const at = (i, j) => grid[j * (NX + 1) + i];
/** The ground under (x, z), from the grid. */
function groundAt(x, z){
  const fx = clamp((x + HX) / DX, 0, NX - 1e-4), fz = clamp((z + HZ) / DZ, 0, NZ - 1e-4), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  return lerp(lerp(at(i, j), at(i + 1, j), u), lerp(at(i, j + 1), at(i + 1, j + 1), u), v);
}
const nearRiver = (x, z, pad) => riverPts.some((p, i) => (x - p.x) ** 2 + (z - p.z) ** 2 < (riverWidth(i / RN) * .5 + pad) ** 2);

const C = hex => new Color(hex);
const LAND = {
  deep: C('#4E7FB8'), shallow: C('#D9C993'), sand: C('#EBDCA8'),
  grassA: C('#9BD67F'), grassB: C('#5FB36C'), grassC: C('#3F9463'),
  rockA: C('#9AA3B8'), rockB: C('#737D97'), snow: C('#F6F9FF'),
  top: C('#7A5A3E'), sub: C('#B58E62'), bed: C('#6E667E'), bedDeep: C('#585070')
};

function buildGeometry(positions, colors){
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  return g;
}

function landGeometry(){
  const P = [], K = [], col = new Color();
  const tri = (ax, ay, az, bx, by, bz, cx, cy, cz, i, j) => {
    const h = (ay + by + cy) / 3, x = (ax + bx + cx) / 3, z = (az + bz + cz) / 3, n = fbm(x * 1.7 + 11, z * 1.7 + 5);
    // How level the ground is around here (1 is flat), over a wider reach than one triangle
    // so rock and grass come in patches rather than speckles.
    const up = 1 / Math.hypot(1, (groundAt(x + .3, z) - groundAt(x - .3, z)) / .6, (groundAt(x, z + .3) - groundAt(x, z - .3)) / .6);
    if (h < -.03) col.lerpColors(LAND.shallow, LAND.deep, smooth(0, 1.2, -h));
    else if (h < .13 + n * .1) col.copy(LAND.sand);
    else if (h > 2.75 + n * .5 && up > .45) col.copy(LAND.snow);
    else if (up < .74 && h > .9 || h > 2.5) col.lerpColors(LAND.rockA, LAND.rockB, n);
    else { col.lerpColors(LAND.grassA, LAND.grassB, clamp(smooth(.2, 2, h) * .6 + n * .6, 0, 1)); if (n > .62) col.lerp(LAND.grassC, .45); if (up < .82) col.lerp(LAND.rockA, .35); }
    col.multiplyScalar(.95 + .1 * hash(i * 3 + 1, j * 5 + 2));
    P.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    for (let k = 0; k < 3; k++) K.push(col.r, col.g, col.b);
  };
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x0 = -HX + i * DX, x1 = x0 + DX, z0 = -HZ + j * DZ, z1 = z0 + DZ, a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    if ((i + j) & 1) { tri(x0, a, z0, x0, c, z1, x1, b, z0, i, j); tri(x1, b, z0, x0, c, z1, x1, d, z1, i, j); }
    else { tri(x0, a, z0, x0, c, z1, x1, d, z1, i, j); tri(x0, a, z0, x1, d, z1, x1, b, z0, i, j); }
  }
  return buildGeometry(P, K);
}

// The cut sides of the block: soil in three layers, and the sea in section.
function sideGeometries(){
  const soil = { P: [], K: [] }, sea = { P: [], K: [] }, col = new Color();
  const quad = (out, x0, z0, x1, z1, top0, top1, bot0, bot1, color) => {
    if (top0 - bot0 < 1e-4 && top1 - bot1 < 1e-4) return;
    out.P.push(x0, top0, z0, x0, bot0, z0, x1, top1, z1, x1, top1, z1, x0, bot0, z0, x1, bot1, z1);
    for (let k = 0; k < 6; k++) out.K.push(color.r, color.g, color.b);
  };
  const edge = pts => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, z0] = pts[k], [x1, z1] = pts[k + 1], h0 = groundAt(x0, z0), h1 = groundAt(x1, z1), w = hash(k, Math.round(x0 * 7 + z0 * 13));
      const layer = (x, z, h) => Math.min(h - .55, -.95 + Math.sin(x * .8 + z * .5) * .22 + Math.sin(x * 2.3 - z * 1.7) * .08);
      const a0 = h0 - .24, a1 = h1 - .24, b0 = layer(x0, z0, h0), b1 = layer(x1, z1, h1), under = (h0 + h1) / 2 < .12;
      quad(soil, x0, z0, x1, z1, h0, h1, a0, a1, col.copy(under ? LAND.shallow : LAND.top).multiplyScalar(under ? .9 + .06 * w : .94 + .12 * w));
      quad(soil, x0, z0, x1, z1, a0, a1, b0, b1, col.copy(LAND.sub).multiplyScalar(.94 + .1 * w));
      const mid0 = (b0 + BASE) / 2 + .1 * Math.sin(x0 * 1.1 + z0), mid1 = (b1 + BASE) / 2 + .1 * Math.sin(x1 * 1.1 + z1);
      quad(soil, x0, z0, x1, z1, b0, b1, mid0, mid1, col.copy(LAND.bed).multiplyScalar(.95 + .1 * w));
      quad(soil, x0, z0, x1, z1, mid0, mid1, BASE, BASE, col.copy(LAND.bedDeep).multiplyScalar(.95 + .1 * w));
      if (h0 < 0 || h1 < 0) quad(sea, x0, z0, x1, z1, 0, 0, Math.min(h0, 0), Math.min(h1, 0), col.set('#ffffff'));
    }
  };
  const xs = Array.from({ length: NX + 1 }, (_, i) => -HX + i * DX), zs = Array.from({ length: NZ + 1 }, (_, j) => -HZ + j * DZ);
  edge(xs.map(x => [x, HZ])); edge(xs.map(x => [x, -HZ])); edge(zs.map(z => [-HX, z])); edge(zs.map(z => [HX, z]));
  return { soil: buildGeometry(soil.P, soil.K), sea: buildGeometry(sea.P, sea.K) };
}

/* ---------- particles ---------- */
// World-sized sprites: soft dots for vapour, slanted streaks for rain.
const particleMaterial = streak => new ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uScale: { value: 1 }, uOpacity: { value: 1 } },
  vertexShader: `
    attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
    uniform float uScale; varying float vAlpha; varying vec3 vColor;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uScale / -mv.z;
      vAlpha = aAlpha; vColor = aColor;
    }`,
  fragmentShader: `
    uniform float uOpacity; varying float vAlpha; varying vec3 vColor;
    void main(){
      vec2 p = gl_PointCoord - .5;
      ${streak
    ? 'p.x -= p.y * .16; float a = smoothstep(.085, .03, length(vec2(p.x, max(abs(p.y) - .38, 0.)))) * mix(.3, 1., smoothstep(-.45, .45, p.y));'
    : 'float a = smoothstep(.5, .08, length(p));'}
      a *= vAlpha * uOpacity;
      if (a < .01) discard;
      gl_FragColor = vec4(vColor, a);
      #include <colorspace_fragment>
    }`
});
function particles(count, streak){
  const g = new BufferGeometry();
  const attr = (name, size) => { const a = new BufferAttribute(new Float32Array(count * size), size); a.setUsage(DynamicDrawUsage); g.setAttribute(name, a); return a; };
  const pos = attr('position', 3), size = attr('aSize', 1), alpha = attr('aAlpha', 1), color = attr('aColor', 3);
  const points = new Points(g, particleMaterial(streak));
  points.frustumCulled = false; points.renderOrder = 5;
  return { points, pos, size, alpha, color };
}

function glowTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.3, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

/* ---------- day and night ---------- */
const LOOKS = {
  day: {
    sky: '#E4EEFF', ground: '#A9B3C9', hemi: 1.55, light: '#FFF3D9', sun: 2.5,
    cloud: '#FFFFFF', storm: '#96A4C4', cloudGlow: .08,
    vapour: '#7DB0FA', rain: '#2F63F0', spark: '#F0A81F',
    water: '#3F8BEA', waterSide: '#2E6BD0', riverMid: '#8CC8FF', riverEdge: '#3C82E4', foam: '#FFFFFF',
    orb: '#FFC53D', glow: '#FFD873', glowOpacity: .7, windows: .25
  },
  night: {
    sky: '#4A62A8', ground: '#1A2440', hemi: 1.25, light: '#BFD0FF', sun: 1.7,
    cloud: '#C7D4F2', storm: '#5E6E96', cloudGlow: .1,
    vapour: '#9CBBFF', rain: '#8DB2FF', spark: '#FFC857',
    water: '#2B55B8', waterSide: '#1E3F92', riverMid: '#A9CBFF', riverEdge: '#3F68D2', foam: '#EAF2FF',
    orb: '#F3F6FF', glow: '#A9C0FF', glowOpacity: .55, windows: 2.6
  }
};

/* ---------- the stages ---------- */
// Where each stage's pin sits in the world, and how the camera leans toward it.
const STAGES = [
  { anchor: new Vector3(-6.2, 3.3, -1), yaw: -.09, pitch: 0, shift: [-.7, 0, 0], zoom: 1 },
  { anchor: new Vector3(-4.4, 7.9, 0), yaw: -.03, pitch: -.04, shift: [-.3, .5, 0], zoom: 1 },
  { anchor: new Vector3(3.3, 3.1, 3.2), yaw: .08, pitch: 0, shift: [.7, .1, 0], zoom: 1 },
  { anchor: new Vector3(-1.2, .45, 2.6), yaw: .02, pitch: .05, shift: [-.2, -.4, .5], zoom: .95 }
];

/**
 * Draw the water cycle into `canvas`. `onFrame({ dt, pins })` is called after each drawn
 * frame with the seconds since the last one (0 for a still) and where each stage's pin is,
 * in CSS pixels from the canvas's top left. Throws if the browser can't give a WebGL context.
 */
export function createWaterCycle(canvas, { dark = false, onFrame } = {}){
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, .5, 120);
  const rand = rng(20261109);
  let look = LOOKS[dark ? 'night' : 'day'];

  /* light */
  const hemi = new HemisphereLight();
  const sun = new DirectionalLight();
  sun.position.set(-7, 13, 7.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 11, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .04;
  scene.add(hemi, sun);

  /* land, its cut sides, and the sea */
  const land = new Mesh(landGeometry(), new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95, metalness: 0, shadowSide: DoubleSide }));
  land.receiveShadow = true; land.castShadow = true;
  const sides = sideGeometries();
  const soil = new Mesh(sides.soil, new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0, side: DoubleSide }));
  const seaSide = new Mesh(sides.sea, new MeshStandardMaterial({ flatShading: true, roughness: .5, metalness: 0, side: DoubleSide }));
  scene.add(land, soil, seaSide);

  const WX = .5, WNX = 22, WNZ = 26;
  const seaGeo = new BufferGeometry();
  {
    const p = new Float32Array((WNX + 1) * (WNZ + 1) * 3), idx = [];
    for (let j = 0; j <= WNZ; j++) for (let i = 0; i <= WNX; i++) { const k = (j * (WNX + 1) + i) * 3; p[k] = lerp(-HX, WX, i / WNX); p[k + 2] = lerp(-HZ, HZ, j / WNZ); }
    for (let j = 0; j < WNZ; j++) for (let i = 0; i < WNX; i++) { const a = j * (WNX + 1) + i, b = a + 1, c = a + WNX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const pa = new BufferAttribute(p, 3); pa.setUsage(DynamicDrawUsage);
    seaGeo.setAttribute('position', pa); seaGeo.setIndex(idx);
  }
  const sea = new Mesh(seaGeo, new MeshStandardMaterial({ transparent: true, opacity: .84, flatShading: true, roughness: .3, metalness: 0 }));
  sea.receiveShadow = true; sea.renderOrder = 1;
  scene.add(sea);
  function waves(t){
    const p = seaGeo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), z = p.getZ(k), calm = smooth(0, .6, x + HX) * smooth(0, .6, HZ - Math.abs(z));
      p.setY(k, calm * .045 * (Math.sin(x * 1.4 + t * 1.2) * .6 + Math.sin(z * 1.9 - t * .9 + x * .5) * .4));
    }
    p.needsUpdate = true;
  }

  /* the river */
  const riverMat = new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uGlow: { value: 0 }, uMid: { value: new Color() }, uEdge: { value: new Color() }, uFoam: { value: new Color() }, uSpark: { value: new Color() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `
      uniform float uTime, uGlow; uniform vec3 uMid, uEdge, uFoam, uSpark; varying vec2 vUv;
      void main(){
        float mid = 1. - abs(vUv.x - .5) * 2.;
        float flow = vUv.y * 46. - uTime * 2.4 + sin(vUv.x * 7. + vUv.y * 19.) * 1.3;
        float streak = smoothstep(.62, 1., sin(flow) * .5 + .5) * smoothstep(0., .5, mid);
        vec3 c = mix(uEdge, uMid, smoothstep(0., .8, mid));
        c = mix(c, uFoam, streak * (.4 + .5 * uGlow));
        float along = vUv.y * 11. - uTime * .3, id = floor(along), r = fract(sin(id * 91.7) * 43758.5453);
        float spark = step(.3, r) * smoothstep(.1, .035, length(vec2((vUv.x - .3 - .4 * fract(r * 7.3)) * .4, (fract(along) - .5) * .8)));
        c = mix(c, uSpark, spark);
        gl_FragColor = vec4(c, smoothstep(0., .04, vUv.y) * (1. - smoothstep(.9, 1., vUv.y)) * smoothstep(0., .12, mid));
        #include <colorspace_fragment>
      }`
  });
  {
    const p = [], uv = [], idx = [];
    for (let i = 0; i <= RN; i++) {
      const a = riverPts[Math.max(0, i - 1)], b = riverPts[Math.min(RN, i + 1)], c = riverPts[i];
      const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1, w = riverWidth(i / RN) * .72, y = riverY[i] + .02;
      p.push(c.x + tz / l * w, y, c.z - tx / l * w, c.x - tz / l * w, y, c.z + tx / l * w);
      uv.push(0, i / RN, 1, i / RN);
      if (i < RN) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    g.setIndex(idx);
    const river = new Mesh(g, riverMat);
    river.material.side = DoubleSide; river.renderOrder = 2;
    scene.add(river);
  }

  /* trees: they stand a little taller while it rains on them */
  const TREES = [];
  for (let tries = 0; TREES.length < 54 && tries < 4000; tries++) {
    const x = lerp(-2.4, 7.6, rand()), z = lerp(-4.6, 4.6, rand()), h = groundAt(x, z);
    if (h < .3 || h > 2.15 || nearRiver(x, z, .28)) continue;
    if (Math.abs(groundAt(x + .25, z) - h) + Math.abs(groundAt(x, z + .25) - h) > .26) continue;
    if (TREES.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < .2)) continue;
    TREES.push({ x, z, h, s: lerp(.75, 1.3, rand()), wet: 0, tint: rand() });
  }
  const leafGeo = new ConeGeometry(.21, .62, 7); leafGeo.translate(0, .45, 0);
  const trunkGeo = new CylinderGeometry(.035, .05, .2, 5); trunkGeo.translate(0, .09, 0);
  const leaves = new InstancedMesh(leafGeo, new MeshStandardMaterial({ flatShading: true, roughness: .9 }), TREES.length);
  const trunks = new InstancedMesh(trunkGeo, new MeshStandardMaterial({ color: '#8A6243', flatShading: true, roughness: 1 }), TREES.length);
  leaves.castShadow = trunks.castShadow = true;
  const leafA = C('#3E9B63'), leafB = C('#6FBF73'), tmpC = new Color(), dummy = new Object3D();
  TREES.forEach((t, i) => leaves.setColorAt(i, tmpC.lerpColors(leafA, leafB, t.tint)));
  scene.add(leaves, trunks);
  function placeTrees(){
    TREES.forEach((t, i) => {
      const s = t.s * (1 + .24 * t.wet);
      dummy.position.set(t.x, t.h - .02, t.z); dummy.scale.set(s, s, s); dummy.rotation.y = t.tint * 6; dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix); trunks.setMatrixAt(i, dummy.matrix);
    });
    leaves.instanceMatrix.needsUpdate = trunks.instanceMatrix.needsUpdate = true;
  }

  /* a few houses on the plain: your circle lives here */
  const windowMat = new MeshStandardMaterial({ color: '#F7C65A', emissive: '#F5B83D', roughness: .6 });
  {
    const wall = new MeshStandardMaterial({ color: '#F7F1E6', flatShading: true, roughness: .9 }), roofs = ['#E0745A', '#5B86E5', '#E0745A', '#F0A44B', '#5B86E5'].map(c => new MeshStandardMaterial({ color: c, flatShading: true, roughness: .8 }));
    const box = new BoxGeometry(.36, .26, .3), roof = new ConeGeometry(.31, .22, 4), pane = new PlaneGeometry(.09, .1);
    roof.rotateY(Math.PI / 4); roof.scale(1, 1, .86);
    [[-1.05, -1.5, .3], [-.25, -2.5, -.5], [.55, -1.05, .9], [-1.5, -3.1, .1], [.35, -3.4, -.3]].forEach(([x, z, turn], i) => {
      const g = new Group(), b = new Mesh(box, wall), r = new Mesh(roof, roofs[i]), w1 = new Mesh(pane, windowMat), w2 = new Mesh(pane, windowMat);
      b.position.y = .13; r.position.y = .37; w1.position.set(-.08, .14, .151); w2.position.set(.09, .14, .151);
      b.castShadow = r.castShadow = true; b.receiveShadow = true;
      g.add(b, r, w1, w2); g.position.set(x, groundAt(x, z) - .03, z); g.rotation.y = turn;
      scene.add(g);
    });
  }

  /* the sun (a moon at night) */
  const orb = new Mesh(new SphereGeometry(.78, 24, 16), new MeshBasicMaterial());
  const glow = new Sprite(new SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false }));
  orb.position.set(-5.6, 8.9, -4.4); glow.position.copy(orb.position); glow.scale.setScalar(5.6); glow.renderOrder = -1;
  scene.add(glow, orb);

  /* clouds: born small over the sea, heavy over the hills, rained out by the mountain */
  const PERIOD = 46, puff = new IcosahedronGeometry(1, 1);
  const CLOUDS = [-2.1, 1.5, -.5, 2.5].map((z, i) => {
    const mat = new MeshStandardMaterial({ flatShading: true, roughness: 1, emissive: '#ffffff' }), g = new Group(), size = lerp(.95, 1.2, rand());
    [[0, .1, 0, 1], [-.95, -.05, .1, .72], [.98, -.02, -.05, .78], [-.3, .05, .62, .6], [.42, .32, -.5, .66], [1.62, -.16, .12, .46], [-1.55, -.18, -.08, .44]].forEach(([x, y, zz, r]) => {
      const m = new Mesh(puff, mat);
      m.position.set(x + (rand() - .5) * .2, y, zz + (rand() - .5) * .2); m.scale.set(r, r * .78, r * .9); m.rotation.set(rand() * 3, rand() * 3, 0); m.castShadow = true;
      g.add(m);
    });
    scene.add(g);
    return { g, mat, z, size, offset: i / 4, bob: rand() * 6, rain: 0, x: 0, y: 0, scale: 0 };
  });
  const white = new Color(), storm = new Color();
  function moveClouds(t, lift){
    for (const c of CLOUDS) {
      const p = fract(t / PERIOD + c.offset);
      const grown = smooth(0, .3, p) * (1 - smooth(.87, 1, p)), heavy = smooth(.3, .5, p) * (1 - smooth(.8, .95, p));
      c.rain = smooth(.45, .53, p) * (1 - smooth(.8, .88, p));
      c.x = lerp(-6.3, 6.7, p); c.y = 6.55 + Math.sin(t * .45 + c.bob) * .1 - heavy * .22; c.scale = c.size * grown * (1 + .07 * lift);
      c.g.position.set(c.x, c.y, c.z); c.g.scale.setScalar(Math.max(c.scale, .001)); c.g.visible = c.scale > .1;
      c.mat.color.lerpColors(white, storm, heavy * .9);
      c.mat.emissiveIntensity = look.cloudGlow * (1 - heavy * .8) * (1 + lift);
    }
  }

  /* vapour: a function of time alone, so a still frame is as full as a moving one */
  const VN = 380, vapour = particles(VN, false), vSeed = Array.from({ length: VN }, (_, i) => ({ x: lerp(-7.6, -3, rand()), z: lerp(-4.5, 4.5, rand()), life: lerp(7, 12, rand()), offset: rand() * 12, sway: rand() * 6.28, top: lerp(5.4, 6.6, rand()), size: lerp(.7, 1.3, rand()), gold: i % 9 === 4 }));
  scene.add(vapour.points);
  function moveVapour(t, lift){
    for (let i = 0; i < VN; i++) {
      const s = vSeed[i], u = fract((t + s.offset) / s.life);
      vapour.pos.setXYZ(i, s.x + u * u * 1.5 + Math.sin(u * 6 + s.sway) * .24, .08 + u * s.top, s.z + Math.cos(u * 5 + s.sway) * .2);
      vapour.size.setX(i, (s.gold ? .16 : lerp(.12, .3, u)) * s.size * (1 + .25 * lift));
      vapour.alpha.setX(i, smooth(0, .1, u) * (1 - smooth(.66, 1, u)) * (s.gold ? .95 : .5 + .3 * lift));
    }
    vapour.pos.needsUpdate = vapour.size.needsUpdate = vapour.alpha.needsUpdate = true;
  }

  /* rain: each drop belongs to a cloud and falls while that cloud is raining */
  const DN = 440, rain = particles(DN, true), drops = Array.from({ length: DN }, (_, i) => ({ cloud: i % CLOUDS.length, need: rand() * .9, on: false, x: 0, y: 0, z: 0, ground: 0, v: lerp(6.5, 9, rand()), gold: i % 11 === 5 }));
  scene.add(rain.points);
  function moveRain(dt, lift){
    for (let i = 0; i < DN; i++) {
      const d = drops[i], c = CLOUDS[d.cloud];
      if (d.on) { d.y -= d.v * dt; d.x += .9 * dt; if (d.y <= d.ground) d.on = false; }
      if (!d.on && c.rain > d.need) {
        const a = rand() * 6.283, r = Math.sqrt(rand());
        d.x = c.x + Math.cos(a) * r * 1.5 * c.scale; d.z = c.z + Math.sin(a) * r * .85 * c.scale; d.y = c.y - .35 - rand() * (d.v * .12);
        d.ground = Math.max(groundAt(clamp(d.x + .5, -HX, HX), clamp(d.z, -HZ, HZ)), 0) + .1; d.on = Math.abs(d.x) < HX - .2 && Math.abs(d.z) < HZ - .15;
      }
      rain.pos.setXYZ(i, d.x, d.y, d.z);
      rain.size.setX(i, d.gold ? .62 : .52);
      rain.alpha.setX(i, d.on ? (d.gold ? .95 : .62 + .3 * lift) * smooth(d.ground, d.ground + .5, d.y) : 0);
    }
    rain.pos.needsUpdate = rain.size.needsUpdate = rain.alpha.needsUpdate = true;
  }
  function soak(dt){
    for (const t of TREES) {
      let wet = 0;
      for (const c of CLOUDS) wet = Math.max(wet, c.rain * (1 - smooth(.8, 2, Math.hypot((t.x - c.x - .4) / 1.5, (t.z - c.z) / .9))));
      t.wet += (wet - t.wet) * Math.min(1, dt * (wet > t.wet ? 2.2 : .5));
    }
    placeTrees();
  }

  /* day or night */
  function paint(){
    hemi.color.set(look.sky); hemi.groundColor.set(look.ground); hemi.intensity = look.hemi;
    sun.color.set(look.light); sun.intensity = look.sun;
    white.set(look.cloud); storm.set(look.storm);
    sea.material.color.set(look.water); seaSide.material.color.set(look.waterSide);
    riverMat.uniforms.uMid.value.set(look.riverMid); riverMat.uniforms.uEdge.value.set(look.riverEdge); riverMat.uniforms.uFoam.value.set(look.foam); riverMat.uniforms.uSpark.value.set(look.spark);
    orb.material.color.set(look.orb); glow.material.color.set(look.glow); glow.material.opacity = look.glowOpacity;
    windowMat.emissiveIntensity = look.windows;
    const v = C(look.vapour), r = C(look.rain), g = C(look.spark);
    for (let i = 0; i < VN; i++) { const c = vSeed[i].gold ? g : v; vapour.color.setXYZ(i, c.r, c.g, c.b); }
    for (let i = 0; i < DN; i++) { const c = drops[i].gold ? g : r; rain.color.setXYZ(i, c.r, c.g, c.b); }
    vapour.color.needsUpdate = rain.color.needsUpdate = true;
  }

  /* camera: a three-quarter view that fits the block, leans toward the stage being
     talked about, and drifts a little with the pointer */
  const view = { yaw: -.31, pitch: .37, dist: 30, target: new Vector3(.1, 2.3, 0) };
  const lean = { yaw: 0, pitch: 0, x: 0, y: 0, z: 0, zoom: 1 }, pointer = { x: 0, y: 0, ex: 0, ey: 0 };
  const weight = [1, 0, 0, 0];
  let stage = 0, width = 1, height_ = 1;
  const corners = [
    [-HX, BASE, HZ], [HX, BASE, HZ], [-HX, BASE, -HZ], [HX, BASE, -HZ], [-HX, .2, HZ], [-HX, .2, -HZ], [HX, 2.4, HZ], [HX, 3.6, -HZ],
    [-7.4, 7.7, -2.8], [-7.4, 7.7, 3], [8, 7.9, -2.8], [8, 7.9, 3.2], [orb.position.x - 1.3, orb.position.y + 1.2, orb.position.z]
  ].map(c => new Vector3(...c));
  const tmp = new Vector3();
  function aim(yaw, pitch, dist, tx, ty, tz){
    camera.position.set(tx + dist * Math.sin(yaw) * Math.cos(pitch), ty + dist * Math.sin(pitch), tz + dist * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(tx, ty, tz); camera.updateMatrixWorld();
  }
  function fit(){
    let d = 30;
    for (let k = 0; k < 8; k++) {
      aim(view.yaw, view.pitch, d, view.target.x, view.target.y, view.target.z);
      let m = 0;
      for (const c of corners) { tmp.copy(c).project(camera); m = Math.max(m, Math.abs(tmp.x), Math.abs(tmp.y)); }
      d *= lerp(1, m / .93, .9);
    }
    view.dist = d;
  }
  function pose(t){
    const sway = Math.sin(t * .13) * .035;
    aim(view.yaw + lean.yaw + sway + pointer.ex * .1, view.pitch + lean.pitch - pointer.ey * .04, view.dist * lean.zoom, view.target.x + lean.x, view.target.y + lean.y, view.target.z + lean.z);
  }
  function ease(dt, snap){
    const k = snap ? 1 : 1 - Math.exp(-dt * 2.6), s = STAGES[stage];
    for (let i = 0; i < 4; i++) weight[i] += ((i === stage ? 1 : 0) - weight[i]) * k;
    lean.yaw += (s.yaw - lean.yaw) * k; lean.pitch += (s.pitch - lean.pitch) * k; lean.zoom += (s.zoom - lean.zoom) * k;
    lean.x += (s.shift[0] - lean.x) * k; lean.y += (s.shift[1] - lean.y) * k; lean.z += (s.shift[2] - lean.z) * k;
    pointer.ex += (pointer.x - pointer.ex) * k; pointer.ey += (pointer.y - pointer.ey) * k;
  }

  /* drawing */
  const START = PERIOD * .12;
  let time = START, running = false, raf = 0, last = 0, lost = false;
  const pins = new Float32Array(8);
  function draw(dt, snap, real = dt){
    if (lost) return;
    ease(dt, snap);
    moveClouds(time, weight[1]); moveVapour(time, weight[0]); moveRain(dt, weight[2]); soak(snap ? 10 : dt); waves(time);
    riverMat.uniforms.uTime.value = time; riverMat.uniforms.uGlow.value = weight[3];
    pose(time);
    renderer.render(scene, camera);
    STAGES.forEach((s, i) => { tmp.copy(s.anchor).project(camera); pins[i * 2] = (tmp.x * .5 + .5) * width; pins[i * 2 + 1] = (-tmp.y * .5 + .5) * height_; });
    onFrame?.({ dt: real, pins });
  }
  // The scene moves at most a fifteenth of a second per frame, so a slow device sees it
  // slow down rather than jump; `real` is the time that actually passed, for the stage timer.
  function frame(now){
    raf = requestAnimationFrame(frame);
    const real = Math.min(.25, (now - last) / 1000), dt = Math.min(1 / 15, real); last = now; time += dt;
    draw(dt, false, real);
  }
  function resize(){
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    width = w; height_ = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const scale = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    vapour.points.material.uniforms.uScale.value = rain.points.material.uniforms.uScale.value = scale;
    fit();
    if (!running) draw(0, true);
  }

  const onLost = e => { e.preventDefault(); lost = true; }, onBack = () => { lost = false; if (!running) draw(0, true); };
  canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onBack);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  // Start mid-cycle with rain already falling, so even a still frame shows the whole loop.
  paint(); moveClouds(time, 0);
  for (let k = 0; k < 90; k++) moveRain(1 / 30, 0);
  resize();

  return {
    /** Which stage is being talked about: 0 evaporation, 1 condensation, 2 precipitation, 3 collection. */
    setStage(i){ stage = clamp(i | 0, 0, 3); if (!running) draw(0, true); },
    setDark(on){ look = LOOKS[on ? 'night' : 'day']; paint(); if (!running) draw(0, true); },
    /** Animate, or hold still on the current frame. */
    setRunning(on){
      if (on === running) return;
      running = on; cancelAnimationFrame(raf);
      if (on) { last = performance.now(); raf = requestAnimationFrame(frame); }
    },
    /** The pointer, from -1 to 1 across the scene, for a little parallax. */
    setPointer(x, y){ pointer.x = clamp(x, -1, 1); pointer.y = clamp(y, -1, 1); },
    get running(){ return running; },
    dispose(){
      cancelAnimationFrame(raf); observer.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onBack);
      scene.traverse(o => { o.geometry?.dispose?.(); [].concat(o.material || []).forEach(m => { m.map?.dispose?.(); m.dispose?.(); }); });
      renderer.dispose();
    }
  };
}
