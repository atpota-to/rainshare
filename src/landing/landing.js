// The signed-out landing: the water cycle scene, and its four parts to look closer at.
//
// Picking a part (its pin, or anywhere near it in the scene) flies the camera in and shows a
// short note: what that part stands for in Rainshare, and a link to the screen in the example
// circle where it happens. "Next" walks round the cycle; "Whole view" backs out.
//
// The scene is three.js, so it's fetched only when the landing is actually on screen, and it
// holds still when it's scrolled away, the tab is hidden, or someone pauses it. If the browser
// can't draw it, a flat illustration takes its place with all four notes under it.
import './landing.css';

const NAMES = ['Evaporation', 'Condensation', 'Precipitation', 'Collection'];
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const calm = matchMedia('(prefers-reduced-motion: reduce)'), night = matchMedia('(prefers-color-scheme: dark)');

let figure, view, pins, notes, hint, tour, next, pause;
let scene = null, loading = false, wired = false;
let shown = false, inView = true, paused = calm.matches, focus = -1;

/** Look closer at one part of the cycle, or back out to the whole of it (-1). */
function setFocus(i){
  focus = i;
  figure.classList.toggle('close', i >= 0);
  pins.forEach((p, k) => { p.classList.toggle('on', k === i); p.setAttribute('aria-expanded', String(k === i)); });
  notes.forEach((n, k) => { n.hidden = k !== i; });
  hint.hidden = i >= 0; tour.hidden = i < 0;
  if (i >= 0) $('span', next).textContent = NAMES[(i + 1) % 4];
  scene?.focus(i);
}

function sync(){
  const run = shown && inView && !document.hidden && !paused;
  scene?.setRunning(run);
  pause.setAttribute('aria-pressed', String(paused));
  pause.setAttribute('aria-label', paused ? 'Play the animation' : 'Pause the animation');
}

// Each drawn frame: put the pins where their places in the scene are. One that would hang
// off the right of the scene turns to face left; one that's out of view is hidden.
function onFrame({ pins: at }){
  const w = view.clientWidth;
  pins.forEach((p, k) => {
    const x = at[k * 2], y = at[k * 2 + 1], seen = x === x, flip = x > w * .56;
    p.style.visibility = seen ? '' : 'hidden';
    if (!seen) return;
    p.classList.toggle('flip', flip);
    p.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)${flip ? ' translateX(calc(28px - 100%))' : ''}`;
  });
}

async function load(){
  if (scene || loading) return;
  loading = true;
  try {
    const { createWaterCycle } = await import('./scene.js');
    scene = createWaterCycle($('canvas', view), { dark: night.matches, onFrame });
    scene.focus(focus);
    figure.classList.add('live');
    sync();
  } catch (e) {
    console.warn('The water cycle scene couldn’t start', e);
    figure.classList.add('flat');
  }
  loading = false;
}

function wire(){
  wired = true;
  figure = $('#scene'); view = $('#sceneView'); pause = $('#scenePause'); hint = $('#sceneHint'); tour = $('#sceneTour'); next = $('#tourNext');
  pins = $$('.rd-pin', figure); notes = $$('.rd-note', figure);
  pins.forEach((p, k) => p.addEventListener('click', e => { e.stopPropagation(); setFocus(k === focus ? -1 : k); }));
  pause.addEventListener('click', e => { e.stopPropagation(); paused = !paused; sync(); });
  // Anywhere else in the scene: the part nearest the tap. Tapping the part you're at, or
  // nothing in particular, backs out.
  view.addEventListener('click', e => {
    if (!scene) return;
    const r = view.getBoundingClientRect(), k = scene.stageAt(e.clientX - r.left, e.clientY - r.top);
    setFocus(k === focus ? -1 : k);
  });
  next.addEventListener('click', () => setFocus((focus + 1) % 4));
  $('#tourOut').addEventListener('click', () => { setFocus(-1); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && shown && focus >= 0) setFocus(-1); });
  view.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = view.getBoundingClientRect();
    scene?.setPointer((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1);
  });
  view.addEventListener('pointerleave', () => scene?.setPointer(0, 0));
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView && shown) load(); sync(); }, { rootMargin: '120px' }).observe(figure);
  document.addEventListener('visibilitychange', sync);
  night.addEventListener('change', () => scene?.setDark(night.matches));
  calm.addEventListener('change', () => { paused = calm.matches; sync(); });
}

/** The landing is on screen (signed out, at /). */
export function showLanding(){
  if (!wired) wire();
  shown = true;
  if (inView) load();
  sync();
}
/** The landing is hidden: another page, or someone signed in. */
export function hideLanding(){
  if (!wired) return;
  shown = false;
  sync();
}
