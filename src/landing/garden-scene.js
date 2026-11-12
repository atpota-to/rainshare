// The landing's garden, in three.js: your cloud, and your friends' plots.
//
//   your cloud      your AI plan: full when the plan resets, and gone by the next reset
//                   whether it rained or not
//   the plots       what the people you follow would like a hand with: an idea is the marker
//                   where a seed went in, a project a plant grown as far as it has
//                   (../plants/models.js, the same plants the app draws)
//   rain            your agent, sent after one of them
//   a stage on      the work landing: the plant grows, and wears the logo's gold spark
//
// The plots stand in a row and the cloud slides along it. Behind them a friend's cloud is
// already raining on a plot of its own, so the whole of it shows before anyone touches it.
// The clouds are the ones atmosphere.online's sky is made of (./puffs.js), under the same
// morning and night (./sky.js). The ground is made here from a seed: nothing to download but
// this file, which the page asks for only when the landing is on screen (see ./garden.js).
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Vector3, Vector4, Fog, Box3,
  HemisphereLight, DirectionalLight,
  BufferGeometry, BufferAttribute, OctahedronGeometry,
  Mesh, LineSegments, Points,
  MeshStandardMaterial, LineBasicMaterial, ShaderMaterial,
  DynamicDrawUsage, LinearSRGBColorSpace
} from 'three';
import { makeNoise, mulberry, puffBatch, newCloud, shapeCloud, settleCloud, stageCloud } from './puffs.js';
import { SKY, SKY_RAW, SUN_LIGHT, skyDome } from './sky.js';
import { buildPlant, disposePlant } from '../plants/models.js';

/* ---------- small maths ---------- */
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (i, j) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
function noise(x, z){
  const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return lerp(lerp(hash(i, j), hash(i + 1, j), a), lerp(hash(i, j + 1), hash(i + 1, j + 1), a), b);
}
const fbm = (x, z) => noise(x, z) * .58 + noise(x * 2.1 + 7.3, z * 2.1 - 3.1) * .28 + noise(x * 4.3 - 1.7, z * 4.3 + 9.2) * .14;
// a plant coming up: past its size and back
const pop = t => { const u = clamp(t, 0, 1) - 1; return 1 + 2.70158 * u * u * u + 1.70158 * u * u; };

/* ---------- the garden ---------- */
// The camera looks north (-z). The row runs left to right in front of it: where your cloud
// waits, then three plots in one bed. The first spot is the friend's, set back on a rise
// behind the row, where it shows between the first two. y is up.
const SPOTS = [{ x: .72, z: -5.4 }, { x: -.5, z: -.15 }, { x: 1.75, z: .3 }, { x: 4, z: -.1 }];
const HOME = { x: -2.75, z: .15 };
const X0 = -3.9, X1 = 4.7;                  // how far along the row the cloud can slide
const CLOUD_Y = 4.7, FRIEND_Y = 3.85;      // how high the clouds' bases hang: the friend's, further off, shows under yours
const PATCH = 1.55;                         // how far the dug earth reaches round a plot
const GROWN = 1.15;                         // how big the plants are drawn
const KNOLL = .5;                           // how far the friend's plot is lifted, to be seen over the row
// How deep into the scene the cloud is at each point along the row: over each plot as it passes.
const RAIL = [HOME, ...SPOTS.slice(1)];
function railZ(x){
  if (x <= RAIL[0].x) return RAIL[0].z;
  for (let i = 1; i < RAIL.length; i++) if (x <= RAIL[i].x) return lerp(RAIL[i - 1].z, RAIL[i].z, smooth(RAIL[i - 1].x, RAIL[i].x, x));
  return RAIL[RAIL.length - 1].z;
}

// Level where the row is, a rise behind it for the friend's plot, rolling a little beyond,
// and low hills in the haze.
function height(x, z){
  const far = Math.hypot(x - 1, (z + 1) * 1.15);
  return (fbm(x * .13 + 3.1, z * .13 - 1.4) - .5) * 1.4 * smooth(8, 20, far)
    + KNOLL * Math.exp(-(((x - SPOTS[0].x) / 4.2) ** 2 + ((z - SPOTS[0].z) / 2.3) ** 2))
    + smooth(-16, -52, z) * (.2 + 3.4 * fbm(x * .045 + 7, z * .045 + 2));
}
// Grid lines from lo to hi that crowd together around mid, where the camera looks.
function warp(n, lo, hi, mid, k){
  const out = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) { const t = i / n * 2 - 1, w = k * t + (1 - k) * t * t * t; out[i] = w < 0 ? mid + (mid - lo) * w : mid + (hi - mid) * w; }
  return out;
}
const LAND = { meadow: '#A9C383', lush: '#7FA96C', dry: '#BDBC8C', wood: '#5E8C61', soil: '#9C7D64', dug: '#7C5D49' };
function groundGeometry(){
  const X = warp(190, -80, 80, 1, .22), Z = warp(170, -98, 15, -1, .22), nx = X.length, nz = Z.length;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), index = [];
  const K = Object.fromEntries(Object.entries(LAND).map(([k, v]) => [k, new Color(v)])), c = new Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = (j * nx + i) * 3, x = X[i], z = Z[j], n = fbm(x * .9 + 11, z * .9 + 5), big = fbm(x * .18 + 2, z * .18 + 8);
    pos[k] = x; pos[k + 1] = height(x, z); pos[k + 2] = z;
    c.lerpColors(K.meadow, K.lush, smooth(.3, .7, big));
    c.lerp(K.dry, smooth(.55, .8, n) * .45);
    c.lerp(K.wood, smooth(-18, -40, z) * smooth(.46, .6, fbm(x * .07 + 9, z * .07 + 3)) * .6);
    // dug earth round each plot, ragged at the edge and darker close under the mound
    for (const s of SPOTS) { const d = Math.hypot(x - s.x, (z - s.z) * 1.12) + (n - .5) * .5; if (d < PATCH + .3) { c.lerp(K.soil, 1 - smooth(PATCH - .32, PATCH + .12, d)); c.lerp(K.dug, (1 - smooth(.7, 1.15, d)) * .7); } }
    col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1; index.push(a, d, b, b, d, e); }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('color', new BufferAttribute(col, 3)); g.setIndex(index); g.computeVertexNormals();
  return g;
}

/* ---------- day and night ---------- */
// The sky's colours (./sky.js), and the garden's own: the grass, the far woods, and how much
// light the plants stand in.
const LOOKS = {
  day: { ...SKY.day, rain: '#7B84C8', tuft: '#B4D58E', tuftShade: '#7FAE74', leaf: '#8DB078', leafShade: '#3F6A50', key: 1.5, fill: .55, glow: 1 },
  night: { ...SKY.night, rain: '#8792D8', tuft: '#3F6079', tuftShade: '#1E2F52', leaf: '#30495F', leafShade: '#141E3A', key: .95, fill: .4, glow: .3 }
};
const RAW = [...SKY_RAW, 'tuft', 'tuftShade', 'leaf', 'leafShade'];
const FOG_NEAR = 22, FOG_FAR = 84;
// The sun stands up and to the left, just out of the picture: this close to the ground a sun
// in view would wash out the sky the clouds are seen against.
const SUN_AT = new Vector3(-.44, .42, -.79).normalize();
// The plants face the camera, so most of their light comes from in front of them, up and to
// the left; the sun itself is behind, and rims them.
const KEY_LIGHT = new Vector3(-.5, .74, .62).normalize(), FILL_LIGHT = new Vector3(.75, .35, .5).normalize();

/* ---------- how it goes ---------- */
const RESET = 30;            // seconds from one reset of your plan to the next
const RAIN = 5.2;            // seconds of your rain that bring a plot on a stage
const USE = .32;             // how much of a full cloud that takes: three plots, and a wisp left over
const FRIEND_RAIN = 9;       // the friend's cloud takes its time, so there's rain to see on arriving
const FRIEND_WET = .32;      // how far along its plot is to begin with
const EYE = [.35, 3, 15.2];   // where the camera stands: in front of the row's middle, at about the height of a grown plant
// What the camera takes in: how far to each side of the row's middle, and the height it looks
// at. Beside the pitch the scene's edges fade into the page, so the row is kept clear of them
// and of the line of words over its lower edge. `close` is for when it has the page's whole
// width to itself, with that line under it.
const FRAME = { wide: { reach: 6.23, aim: 2.55 }, close: { reach: 5.35, aim: 3.1 } };

/**
 * Draw the garden into `canvas`. `plots` says what's planted: for each, the `stage` it's at
 * ('seed', 'seedling', 'young' or 'established'), the stage it's drawn at once the work is
 * done (`next`), and which `kind` of plant it is. The first is the one a friend's cloud is
 * already raining on; the rest stand in the row, for your cloud.
 *
 * `onFrame(at)` is called after each drawn frame with where things are, in CSS pixels from the
 * canvas's top left: `plots` (x, y for the label under each), `cloud` (x, y of its middle, its
 * width and height), `friend` (x, y above the friend's cloud, and how much of it is left to
 * see), then `left` (how much of the time to the next reset is left, 0 to 1), `charge` (how
 * much rain is left in your cloud) and `fresh` (true while a new cloud is forming).
 * `onEvent(what, n)` says what happened: 'rain' and 'dry' (your rain started or stopped on
 * plot n), 'done' (plot n came on a stage) and 'reset' (your plan reset, with n of a cloud
 * unused). `close` frames the row tightly (see FRAME). Throws if the browser can't give a
 * WebGL context.
 */
export function createGarden(canvas, { dark = false, close = false, plots: planted = [], onFrame, onEvent } = {}){
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, .5, 700);
  let framing = FRAME[close ? 'close' : 'wide'];
  const rand = mulberry(20261112);
  let look = LOOKS[dark ? 'night' : 'day'];

  const noiseTex = makeNoise(256, rand);
  const uTime = { value: 0 }, uSunView = { value: new Vector3() }, uFogNear = { value: FOG_NEAR }, uFogFar = { value: FOG_FAR }, uFogMax = { value: .72 }, uScale = { value: 1 };
  const C = Object.fromEntries(RAW.map(k => [k, new Color()]));      // colours the shaders share
  const shadeCol = new Color();
  // where the two clouds' shadows fall (x, z, how wide, how dark), and how wet each plot's earth is
  const uClouds = { value: [new Vector4(0, 0, 1, 0), new Vector4(0, 0, 1, 0)] }, uWet = { value: SPOTS.map(s => new Vector4(s.x, s.z, PATCH, 0)) };
  scene.fog = new Fog(0xffffff, FOG_NEAR, FOG_FAR);

  /* light */
  const hemi = new HemisphereLight(), sun = new DirectionalLight(), key = new DirectionalLight(), fill = new DirectionalLight();
  sun.position.copy(SUN_LIGHT).multiplyScalar(60); key.position.copy(KEY_LIGHT).multiplyScalar(60); fill.position.copy(FILL_LIGHT).multiplyScalar(60);
  scene.add(hemi, sun, key, fill);

  const sky = skyDome(C, uTime, SUN_AT);
  scene.add(sky);

  /* the ground: darker under a cloud, and where rain has soaked into a plot */
  const SHADE = 'for (int i = 0; i < 2; i++) shade = max(shade, uClouds[i].w * (1.0 - smoothstep(0.2, 1.0, length((AT - uClouds[i].xy) / (uClouds[i].z * vec2(1.2, 0.85))))));';
  const groundMat = new MeshStandardMaterial({ vertexColors: true, roughness: .96, metalness: 0 });
  groundMat.onBeforeCompile = shader => {
    shader.uniforms.uClouds = uClouds; shader.uniforms.uWet = uWet; shader.uniforms.uShade = { value: shadeCol };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGround;').replace('#include <project_vertex>', '#include <project_vertex>\nvGround = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 uClouds[2]; uniform vec4 uWet[4]; uniform vec3 uShade; varying vec2 vGround;').replace('#include <color_fragment>', `#include <color_fragment>
      float shade = 0.0, wet = 0.0;
      ${SHADE.replace('AT', 'vGround')}
      for (int i = 0; i < 4; i++) wet = max(wet, uWet[i].w * (1.0 - smoothstep(0.5, 1.0, length(vGround - uWet[i].xy) / uWet[i].z)));
      diffuseColor.rgb *= mix(vec3(1.0), uShade, shade) * (1.0 - 0.34 * wet);`);
  };
  scene.add(new Mesh(groundGeometry(), groundMat));

  /* grass: tufts of three blades, each one point, thick near the garden and thinning out */
  const POINT = `
    attribute float aSize; attribute float aTone; uniform float uScale, uFogNear, uFogFar; uniform vec4 uClouds[2];
    varying float vTone; varying float vFog; varying float vShade;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uScale / -mv.z;
      vTone = aTone; vFog = smoothstep(uFogNear, uFogFar, -mv.z);
      float shade = 0.0;
      ${SHADE.replace('AT', 'position.xz')}
      vShade = shade;
    }`;
  const pointsOf = (P, S, T, material) => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(P), 3)); g.setAttribute('aSize', new BufferAttribute(new Float32Array(S), 1)); g.setAttribute('aTone', new BufferAttribute(new Float32Array(T), 1));
    const m = new Points(g, material); m.frustumCulled = false; scene.add(m);
  };
  {
    const P = [], S = [], T = [];
    for (let tries = 0; S.length < 3400 && tries < 60000; tries++) {
      const x = lerp(-13, 14, rand()), z = lerp(-13, 9.5, rand());
      if (rand() > .25 + .9 * fbm(x * .5 + 4, z * .5 + 9) - smooth(-4, -13, z) * .7) continue;
      if (SPOTS.some(s => Math.hypot(x - s.x, (z - s.z) * 1.12) < PATCH + .1)) continue;
      const size = lerp(.09, .2, rand());
      P.push(x, height(x, z) + size * .46, z); S.push(size); T.push(rand());
    }
    pointsOf(P, S, T, new ShaderMaterial({
      uniforms: { uScale, uTuft: { value: C.tuft }, uTuftShade: { value: C.tuftShade }, uFog: { value: C.hor }, uFogNear, uFogFar, uClouds, uShade: { value: C.shade } },
      vertexShader: POINT,
      fragmentShader: `
        uniform vec3 uTuft, uTuftShade, uFog, uShade; varying float vTone; varying float vFog; varying float vShade;
        void main(){
          vec2 p = vec2(gl_PointCoord.x - 0.5, 1.0 - gl_PointCoord.y);      // from the ground (y = 0) up
          float on = 0.0;
          for (int i = 0; i < 3; i++){
            float side = float(i) - 1.0, tall = 1.0 - 0.3 * abs(side + vTone - 0.5), y = p.y / tall;
            on = max(on, step(y, 1.0) * step(abs(p.x - (side * 0.34 + (vTone - 0.5) * 0.2) * y * y), 0.09 * (1.0 - y * 0.8)));
          }
          if (on < 0.5) discard;
          vec3 c = mix(uTuftShade, uTuft, p.y) * (0.9 + 0.2 * vTone) * mix(vec3(1.0), uShade, vShade);
          gl_FragColor = vec4(mix(c, uFog, vFog), 1.0);
        }`
    }));
  }
  /* woods on the far hills: soft round crowns in patches, each one point drawn as a little lit ball */
  {
    const P = [], S = [], T = [];
    for (let tries = 0; S.length < 1100 && tries < 60000; tries++) {
      const x = lerp(-80, 82, rand()), z = lerp(-88, -24, rand());
      if (fbm(x * .07 + 9, z * .07 + 3) < .52 + (rand() - .5) * .16) continue;
      const size = lerp(.9, 1.9, rand());
      P.push(x, height(x, z) + size * .36, z); S.push(size); T.push(rand());
    }
    pointsOf(P, S, T, new ShaderMaterial({
      uniforms: { uScale, uLeaf: { value: C.leaf }, uLeafShade: { value: C.leafShade }, uFog: { value: C.hor }, uFogNear, uFogFar, uClouds },
      vertexShader: POINT,
      fragmentShader: `
        uniform vec3 uLeaf, uLeafShade, uFog; varying float vTone; varying float vFog;
        void main(){
          vec2 p = (gl_PointCoord - 0.5) * vec2(2.5, 2.0);     // a crown a little taller than wide
          float r2 = dot(p, p);
          if (r2 > 1.0) discard;
          // lit from up and to the left, where the sun is
          float l = clamp(dot(normalize(vec3(p.x, -p.y, sqrt(1.0 - r2))), vec3(-0.44, 0.74, 0.5)) * 0.6 + 0.42, 0.0, 1.0);
          gl_FragColor = vec4(mix(mix(uLeafShade, uLeaf, l) * (0.88 + 0.2 * vTone), uFog, vFog), 1.0);
        }`
    }));
  }

  /* the plots: each a plant on its mound, and the gold spark it wears once the work is done */
  const gemGeo = new OctahedronGeometry(.15), gemMat = new MeshStandardMaterial({ roughness: .22, metalness: .15, flatShading: true });
  const box = new Box3();
  const PLOTS = SPOTS.map((s, i) => {
    const p = { ...s, y: height(s.x, s.z), theirs: i === 0, first: planted[i]?.stage || 'seed', next: planted[i]?.next || 'seedling', kind: planted[i]?.kind || 0, turn: -.55 + (i - 1.5) * .22, model: null, grown: null, top: 1, wet: 0, done: false, up: 1, gem: new Mesh(gemGeo, gemMat) };
    p.gem.scale.set(1, 1.5, 1); p.gem.visible = false; scene.add(p.gem);
    return p;
  });
  // A leaf's own glow is turned down at night, when there's less light for it to pass on.
  const glow = model => model.traverse(o => { for (const m of [].concat(o.material || [])) { m.userData.glow ??= m.emissiveIntensity; m.emissiveIntensity = m.userData.glow * look.glow; } });
  // A plant takes a moment to build, so the one a plot will grow into is built when rain
  // starts on it (`grown`), not at the moment it's wanted.
  const grow = p => { p.grown ??= buildPlant(p.next, p.kind); };
  function plant(p, model){
    if (p.model) { scene.remove(p.model); disposePlant(p.model); }
    p.model = model;
    p.model.position.set(p.x, p.y - .04, p.z); p.model.rotation.y = p.turn; p.model.scale.setScalar(GROWN);
    p.top = box.setFromObject(p.model).max.y - p.y;
    glow(p.model); scene.add(p.model);
  }
  /** The work on a plot is done: it's drawn a stage on, and wears the spark. */
  function finish(p, snap){
    p.done = true; p.wet = 1; p.up = snap ? 1 : 0;
    grow(p); plant(p, p.grown); p.grown = null; p.gem.visible = true;
    onEvent?.('done', PLOTS.indexOf(p));
  }
  function movePlants(t, dt){
    PLOTS.forEach((p, i) => {
      if (p.up < 1) p.up = Math.min(1, p.up + dt / .9);
      const s = p.done ? lerp(.55, 1, pop(p.up)) : 1 + .05 * p.wet;
      p.model.scale.setScalar(s * GROWN);
      p.model.rotation.y = p.turn + Math.sin(t * .55 + i * 1.7) * .1;
      p.model.rotation.z = Math.sin(t * .8 + i * 2.3) * .012;
      p.gem.position.set(p.x, p.y + p.top * s + .42 + Math.sin(t * 1.6 + i) * .05, p.z);
      p.gem.rotation.y = t * 1.1 + i; p.gem.scale.set(1, 1.5, 1).multiplyScalar(pop(p.up));
      uWet.value[i].w = p.wet;
    });
  }

  /* puffs: both clouds, a few far ones for depth, and the shafts of rain, in one sorted batch */
  const puffs = puffBatch(900, { uTime, uSunView, noise: noiseTex, lit: C.lit, shadow: C.shadow, rim: C.rim, storm: C.storm, fog: C.fog, fogNear: { value: 26 }, fogFar: { value: 130 }, fogMax: uFogMax, billow: 1 });
  puffs.mesh.renderOrder = 5;
  scene.add(puffs.mesh);
  const put = puffs.put, stage = (c, ...how) => stageCloud(put, SUN_LIGHT, c, ...how);
  // `foot` is how wide its rain falls; `rain` and `fade` ease between 0 and 1.
  const me = { ...newCloud(211, .62), x: HOME.x, z: HOME.z, y: CLOUD_Y, to: HOME.x, over: -1, charge: 1, rain: 0, fade: 1, fading: false, wet: false, size: .24, mood: 0, foot: .85, bob: 0 };
  const friend = { ...newCloud(137, .5), x: 0, z: 0, y: FRIEND_Y, rain: 1, fade: 1, away: 0, size: .21, mood: .4, foot: .7, bob: 2.4 };
  const FAR = [[-52, 15, -110, 1.7], [22, 19, -120, 2], [66, 14, -100, 1.5]].map(([x, y, z, s], i) => {
    const c = { ...newCloud(900 + i * 53, .6), x, y, z, s };
    shapeCloud(c, 'cumulus', .45, 1); settleCloud(c, 1);
    return c;
  });
  shapeCloud(friend, 'cumulus', .42, 1); settleCloud(friend, 1);
  const VEIL = Array.from({ length: 7 }, () => ({ x: (rand() - .5) * 1.5, z: (rand() - .5) * .9, r: lerp(.42, .7, rand()), y: rand(), seed: rand() }));

  let clock = RESET * .66, dragging = false, running = false;
  /** Everything that moves by itself: the friend's cloud, yours, the rain in them, and the reset. */
  function advance(dt, snap){
    const p0 = PLOTS[0];
    if (!p0.done) { p0.wet = Math.min(1, p0.wet + dt / FRIEND_RAIN * (1 - FRIEND_WET)); if (p0.wet >= 1) finish(p0, false); }
    else {
      // its work done, the friend's cloud stops raining, and drifts off
      friend.away += dt;
      if (friend.away > 1.4) { friend.x += dt * .6; friend.y += dt * .13; friend.fade = Math.max(0, friend.fade - dt / 4.5); }
    }
    friend.rain = snap ? (p0.done ? 0 : 1) : friend.rain + ((p0.done ? 0 : 1) - friend.rain) * (1 - Math.exp(-dt * 3));

    me.x = snap ? me.to : me.x + (me.to - me.x) * (1 - Math.exp(-dt * (dragging ? 16 : 3.4)));
    me.z = railZ(me.x);
    const p = PLOTS[me.over], wet = !!p && !p.done && !dragging && !me.fading && Math.abs(me.x - p.x) < .2;
    if (wet !== me.wet) { me.wet = wet; if (wet) grow(p); onEvent?.(wet ? 'rain' : 'dry', me.over); }
    if (wet) {
      const d = snap ? 1 : dt / RAIN;
      p.wet = Math.min(1, p.wet + d); me.charge = Math.max(.04, me.charge - d * USE);
      if (p.wet >= 1) { me.wet = false; clock = Math.max(clock, 4); finish(p, snap); }
    }
    me.rain = snap ? 0 : me.rain + ((me.wet ? 1 : 0) - me.rain) * (1 - Math.exp(-dt * 4));

    // The reset: whatever's left of the cloud goes, and a full one forms where it was. It
    // waits for a cloud that's being moved, or is on its way to a plot or raining on one,
    // and for a moment after the work on a plot is done.
    clock = Math.max(0, clock - dt);
    if (clock <= 0 && !me.fading && !dragging && !(p && !p.done) && dt > 0) { me.fading = true; onEvent?.('reset', me.charge); }
    if (me.fading) {
      me.fade -= dt / 1.1;
      if (me.fade <= 0) { me.fade = 0; me.fading = false; me.charge = 1; me.puffs = []; me.key = ''; clock = RESET; }
    } else me.fade = Math.min(1, me.fade + dt / .9);
  }
  function moveClouds(t, dt, snap){
    // yours: fewer puffs, smaller and paler as its rain is spent
    const key = String(Math.round(me.charge * 6));
    if (key !== me.key) { me.key = key; shapeCloud(me, 'cumulus', lerp(.24, .9, me.charge), 1); }
    for (const c of [me, friend]) { settleCloud(c, snap ? 1 : 1 - Math.exp(-dt * (c.form > 0 ? 1.6 : 5))); c.form = snap ? 0 : Math.max(0, c.form - dt / 3); }
    me.size = lerp(.18, .24, smooth(0, 1, me.charge)); me.mood = lerp(.05, .6, me.charge) + .12 * me.rain;
    [me, friend].forEach((c, i) => {
      const y = c.y + Math.sin(t * .32 + c.bob) * .06, alpha = c.fade * .96;
      stage(c, c.x, y, c.z, c.size, alpha, .6, c.mood);
      // its shadow on the ground, straight under it, so it's plain what it's over
      uClouds.value[i].set(c.x, c.z, 6.4 * c.size, alpha * (.3 + .45 * c.mood));
      if (c.rain * alpha < .02) return;
      for (const v of VEIL) put(c.x + v.x * c.foot, lerp(.5, y - .2, .3 + v.y * .55), c.z + v.z * c.foot, v.r * c.foot, .45, .5, c.rain * alpha * .12, v.seed, .9, .06, 1, 0, 3.2);
    });
    for (const c of FAR) stage(c, c.x, c.y, c.z, c.s, .7, .6, 0);
  }

  /* rain: streaks that fall while their cloud is raining, a few of them gold */
  const DN = 300, drops = Array.from({ length: DN }, (_, i) => ({ c: i % 3 ? me : friend, need: rand() * .9, on: false, x: 0, y: 0, z: 0, ground: 0, v: lerp(6.5, 9.5, rand()), gold: i % 11 === 5 }));
  const rainGeo = new BufferGeometry(), rainPos = new BufferAttribute(new Float32Array(DN * 6), 3), rainCol = new BufferAttribute(new Float32Array(DN * 6), 3);
  rainPos.setUsage(DynamicDrawUsage);
  rainGeo.setAttribute('position', rainPos); rainGeo.setAttribute('color', rainCol);
  const rainMat = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .8, depthWrite: false });
  const rain = new LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false; rain.renderOrder = 3;
  scene.add(rain);
  function moveRain(dt){
    const a = rainPos.array;
    for (let i = 0; i < DN; i++) {
      const d = drops[i], c = d.c;
      if (d.on) { d.y -= d.v * dt; d.x += .3 * dt; if (d.y <= d.ground) d.on = false; }
      if (!d.on && c.rain * c.fade > d.need) {
        const r = Math.sqrt(rand()) * c.foot, at = rand() * TAU;
        d.x = c.x + Math.cos(at) * r * 1.15 - .1; d.z = c.z + Math.sin(at) * r * .8; d.y = c.y + .2 - rand() * d.v * .14;
        d.ground = .12 + rand() * .3; d.on = true;
      }
      const o = i * 6, len = d.on ? Math.min(.55, c.y + .2 - d.y) : 0;
      a[o] = d.x; a[o + 1] = d.y; a[o + 2] = d.z; a[o + 3] = d.x - .04 * len; a[o + 4] = d.y + len; a[o + 5] = d.z;
    }
    rainPos.needsUpdate = true;
  }

  /* day or night */
  function paint(){
    for (const k of RAW) C[k].setStyle(look[k], LinearSRGBColorSpace);
    sky.material.uniforms.uStars.value = look.stars; uFogMax.value = look.fogMax;
    scene.fog.color.set(look.hor);
    hemi.color.set(look.hemiSky); hemi.groundColor.set(look.hemiGround); hemi.intensity = look.hemi;
    sun.color.set(look.light); sun.intensity = look.sun * .45;
    key.color.set(look.light); key.intensity = look.key;
    fill.color.set(look.hemiSky); fill.intensity = look.fill;
    shadeCol.set(look.shade);
    gemMat.color.set(look.spark); gemMat.emissive.set(look.spark); gemMat.emissiveIntensity = look === LOOKS.night ? .9 : .5;
    const r = new Color(look.rain), g = new Color(look.spark);
    for (let i = 0; i < DN; i++) { const c = drops[i].gold ? g : r; rainCol.setXYZ(i * 2, c.r, c.g, c.b); rainCol.setXYZ(i * 2 + 1, c.r, c.g, c.b); }
    rainCol.needsUpdate = true;
    for (const p of PLOTS) if (p.model) glow(p.model);
  }

  /* camera: still, but for a slow drift and a little give to the pointer */
  const pointer = { x: 0, y: 0, ex: 0, ey: 0 }, tmp = new Vector3();
  let width = 1, height_ = 1;
  function pose(t, dt, snap){
    const k = snap ? 1 : 1 - Math.exp(-dt * 2.4);
    pointer.ex += (pointer.x - pointer.ex) * k; pointer.ey += (pointer.y - pointer.ey) * k;
    camera.position.set(EYE[0] + Math.sin(t * .11) * .14 + pointer.ex * .4, EYE[1] - pointer.ey * .16, EYE[2]);
    camera.lookAt(EYE[0], framing.aim, 0); camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    uSunView.value.copy(SUN_AT).transformDirection(camera.matrixWorldInverse);
  }
  // A place in the scene, as CSS pixels from the canvas's top left.
  const seen = (x, y, z) => { tmp.set(x, y, z).project(camera); return [(tmp.x * .5 + .5) * width, (-tmp.y * .5 + .5) * height_]; };
  // How many CSS pixels a unit of the scene covers, at a place in it.
  const pixels = (x, y, z) => height_ / (2 * Math.tan(camera.fov * Math.PI / 360) * tmp.set(x, y, z).applyMatrix4(camera.matrixWorldInverse).z * -1);

  /* drawing */
  let time = 0, raf = 0, last = 0, lost = false;
  const at = { plots: new Float32Array(PLOTS.length * 2), cloud: new Float32Array(4), friend: new Float32Array(3), left: 1, charge: 1, fresh: false };
  function draw(dt, snap, real = dt){
    if (lost) return;
    pose(time, dt, snap);
    uTime.value = time;
    advance(dt, snap);
    puffs.begin(camera); moveClouds(time, dt, snap); puffs.flush();
    moveRain(dt); movePlants(time, dt);
    renderer.render(scene, camera);
    PLOTS.forEach((p, i) => { const [x, y] = seen(p.x, p.y, p.z + 1.2); at.plots[i * 2] = x; at.plots[i * 2 + 1] = y; });
    const tall = me.top * me.size, mid = me.y + tall * .45, px = pixels(me.x, mid, me.z), [cx, cy] = seen(me.x, mid, me.z);
    at.cloud[0] = cx; at.cloud[1] = cy; at.cloud[2] = 13 * me.size * px; at.cloud[3] = (tall + .5) * px;
    const [fx, fy] = seen(friend.x, friend.y + friend.top * friend.size + .2, friend.z);
    at.friend[0] = fx; at.friend[1] = fy; at.friend[2] = friend.fade;
    at.left = clock / RESET; at.charge = me.charge; at.fresh = me.fading || me.fade < 1;
    onFrame?.(at, real);
  }
  // The scene moves at most a fifteenth of a second per frame, so a slow device sees it
  // slow down rather than jump. A frame's timestamp can be earlier than the moment the loop
  // was started, so the first frame after a start counts as no time at all.
  function frame(now){
    raf = requestAnimationFrame(frame);
    if (last < 0) last = now;
    const real = clamp((now - last) / 1000, 0, .25), dt = Math.min(1 / 15, real); last = now; time += dt;
    draw(dt, false, real);
  }
  const still = () => { if (!running) draw(0, true); };
  function resize(){
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    width = w; height_ = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    // the lens is as wide as takes in the whole row, whatever shape the canvas is
    camera.aspect = w / h; camera.fov = clamp(2 * Math.atan(framing.reach / EYE[2] / camera.aspect) * 180 / Math.PI, 28, 62);
    camera.updateProjectionMatrix();
    uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    still();
  }
  // Everything as it is on arriving: the plots as they were planted, your cloud full and
  // waiting, and the friend's a little way into its rain.
  function begin(){
    PLOTS.forEach(p => { p.done = false; p.up = 1; p.wet = p.theirs ? FRIEND_WET : 0; p.gem.visible = false; plant(p, buildPlant(p.first, p.kind)); if (p.theirs) grow(p); });
    Object.assign(me, { x: HOME.x, to: HOME.x, over: -1, charge: 1, rain: 0, fade: 1, fading: false, wet: false, puffs: [], key: '' });
    Object.assign(friend, { x: SPOTS[0].x, z: SPOTS[0].z, y: FRIEND_Y, rain: 1, fade: 1, away: 0 });
    clock = RESET * .66;
    for (const d of drops) d.on = false;
    for (let k = 0; k < 50; k++) moveRain(1 / 30);      // rain already falling, so a still frame shows it
  }

  const onLost = e => { e.preventDefault(); lost = true; }, onBack = () => { lost = false; still(); };
  canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onBack);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  paint(); begin(); resize();

  // The plot your cloud would rain on if it were let go here: the nearest one still waiting.
  const under = x => { let best = -1, d = 1.15; PLOTS.forEach((p, i) => { const q = Math.abs(p.x - x); if (!p.theirs && !p.done && q < d) { d = q; best = i; } }); return best; };
  let grabX = 0, grabAt = 0, perPixel = 0;
  return {
    /** Send your cloud over plot n, to rain on it. */
    sendTo(n){ const p = PLOTS[n]; if (!p || p.theirs || p.done || me.fading) return; me.over = n; me.to = p.x; still(); },
    /** Take hold of your cloud, `x` CSS pixels across the canvas; then dragTo as the pointer moves, and drop to let go. */
    grab(x){ dragging = true; grabX = x; grabAt = me.to = me.x; perPixel = 1 / pixels(me.x, me.y, me.z); me.over = -1; still(); },
    dragTo(x){ if (!dragging) return; me.to = clamp(grabAt + (x - grabX) * perPixel, X0, X1); still(); },
    drop(){ if (!dragging) return; dragging = false; const n = under(me.to); if (n >= 0) { me.over = n; me.to = PLOTS[n].x; } still(); },
    /** The plot nearest a point on the canvas (CSS pixels), or -1 if none is near. */
    plotAt(x, y){
      let best = -1, d = Infinity;
      PLOTS.forEach((p, i) => { const [px, py] = seen(p.x, p.y + .7, p.z), r = 1.25 * pixels(p.x, p.y, p.z), q = (px - x) ** 2 + (py - y) ** 2; if (q < r * r && q < d) { d = q; best = i; } });
      return best;
    },
    /** Put everything back as it was on arriving. */
    again(){ begin(); still(); },
    setDark(on){ look = LOOKS[on ? 'night' : 'day']; paint(); still(); },
    /** Frame the row tightly, or leave room round it (see FRAME). */
    setClose(on){ framing = FRAME[on ? 'close' : 'wide']; resize(); },
    /** Animate, or hold still on the current frame. Held still, a cloud sent to a plot is there at once, and its work done. */
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
      for (const p of PLOTS) if (p.grown) disposePlant(p.grown);
      noiseTex.dispose(); renderer.dispose();
    }
  };
}
