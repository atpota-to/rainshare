// The plants, drawn. One WebGL renderer serves every plant on the page: it draws each in
// turn and copies the picture onto that plant's own small canvas, so a page can show several
// without running into a browser's limit on WebGL contexts. They turn slowly, and stop when
// they're off screen or when someone has asked for less motion.
//
//   mountPlant(canvas, stage)   a plant on a 2D canvas, turning; returns a function that takes it down
//   stillOf(stage, size)        one picture of it as a WebP data URL (what public/plants holds)
import * as THREE from 'three';
import { buildPlant, PLANT_STAGES } from './models.js';

const SIZE = 384;                 // the shared drawing, in pixels: enough for a 192px plant on a sharp screen
const POSE = -.55;                // which way a plant faces when it isn't turning
let stage3d = null;

function ensure(){
  if (stage3d) return stage3d;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: true });
  renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false); renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  // One framing for all four, so how big each is says how far along it is.
  const camera = new THREE.PerspectiveCamera(24, 1, .1, 50); camera.position.set(0, 2.0, 6.5); camera.lookAt(0, .98, 0);
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9c4a8', 1.7));
  const sun = new THREE.DirectionalLight('#fff4e2', 2.1); sun.position.set(-2.4, 4, 3); scene.add(sun);
  const fill = new THREE.DirectionalLight('#dbe7ff', 1.1); fill.position.set(3, 2, 2.5); scene.add(fill);
  const back = new THREE.DirectionalLight('#eaf2ff', .9); back.position.set(1, 2.5, -4); scene.add(back);
  // a soft shadow on the ground, which stays put while the plant turns
  const blot = document.createElement('canvas'); blot.width = blot.height = 128;
  const b = blot.getContext('2d'), grad = b.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(18,28,52,.34)'); grad.addColorStop(.6, 'rgba(18,28,52,.14)'); grad.addColorStop(1, 'rgba(18,28,52,0)');
  b.fillStyle = grad; b.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blot), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .001; shadow.scale.z = .62; scene.add(shadow);
  const plants = {};
  for (const s of PLANT_STAGES) { plants[s] = buildPlant(s); plants[s].visible = false; scene.add(plants[s]); }
  stage3d = { renderer, scene, camera, plants, views: new Set(), raf: 0 };
  return stage3d;
}
function draw(stage, turn){
  const S = ensure(), key = S.plants[stage] ? stage : 'young';
  for (const s of PLANT_STAGES) S.plants[s].visible = s === key;
  S.plants[key].rotation.y = turn;
  S.renderer.render(S.scene, S.camera);
  return S.renderer.domElement;
}
const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// Every plant turns by the same clock, so one that's redrawn picks up where it was.
const turnNow = () => calm() ? POSE : POSE + performance.now() / 1000 * .5;

function paint(view){
  const pic = draw(view.stage, turnNow());
  view.ctx.clearRect(0, 0, view.canvas.width, view.canvas.height);
  view.ctx.drawImage(pic, 0, 0, view.canvas.width, view.canvas.height);
}
function loop(){
  const S = stage3d; if (!S) return;
  for (const v of S.views) if (v.seen && v.canvas.isConnected) paint(v);
  for (const v of S.views) if (!v.canvas.isConnected) S.views.delete(v);
  S.raf = S.views.size && !calm() && !document.hidden ? requestAnimationFrame(loop) : 0;
}

/** Show a plant on a 2D canvas, turning slowly. Returns a function that takes it down. Throws where WebGL isn't to be had. */
export function mountPlant(canvas, stage){
  const S = ensure(), box = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = canvas.height = Math.min(SIZE, Math.max(64, Math.round((box.width || 128) * dpr)));
  const view = { canvas, ctx: canvas.getContext('2d'), stage, seen: true };
  paint(view);                                  // straight away, so there's no empty moment
  canvas.dataset.live = '1';
  const watch = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => { view.seen = es.some(e => e.isIntersecting); if (view.seen && !S.raf) loop(); }) : null;
  watch?.observe(canvas);
  S.views.add(view);
  if (!S.raf) loop();
  return () => { S.views.delete(view); watch?.disconnect(); };
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (stage3d && !document.hidden && !stage3d.raf) loop(); });

/** One picture of a plant, as a WebP data URL with a clear background. */
export function stillOf(stage, size = 256){
  const S = ensure();
  S.renderer.setSize(size, size, false);
  const url = draw(stage, POSE).toDataURL('image/webp', .92);
  S.renderer.setSize(SIZE, SIZE, false);
  return url;
}
