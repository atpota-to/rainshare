// The signed-out landing: the water cycle scene, its four pins, and the four stages under it.
//
// The scene is three.js, so it's fetched only when the landing is actually on screen, and it
// holds still when it's scrolled away, the tab is hidden, or someone pauses it. If the browser
// can't draw it, a flat illustration takes its place and the stages read fine without it.
import './landing.css';

const STAGE_MS = 7000;
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const calm = matchMedia('(prefers-reduced-motion: reduce)'), night = matchMedia('(prefers-color-scheme: dark)');

let root, figure, cycle, pins, cards, pause;
let scene = null, loading = false, wired = false;
let shown = false, inView = true, paused = calm.matches, auto = true, stage = 0, elapsed = 0;

function setStage(i, byHand){
  stage = (i + 4) % 4; elapsed = 0;
  if (byHand) auto = false;
  cards.forEach((c, k) => { c.classList.toggle('on', k === stage); $('button', c).setAttribute('aria-pressed', String(k === stage)); c.style.removeProperty('--p'); });
  pins.forEach((p, k) => p.classList.toggle('on', k === stage));
  cycle.classList.toggle('auto', auto);
  scene?.setStage(stage);
}

function sync(){
  const run = shown && inView && !document.hidden && !paused;
  scene?.setRunning(run);
  figure.classList.toggle('still', !run);
  pause.setAttribute('aria-pressed', String(paused));
  pause.setAttribute('aria-label', paused ? 'Play the animation' : 'Pause the animation');
}

// Each drawn frame: put the pins where their places in the scene are, and move the active
// stage's timer along.
function onFrame({ dt, pins: at }){
  const w = figure.clientWidth;
  pins.forEach((p, k) => {
    const x = at[k * 2], flip = x > w * .6;
    p.classList.toggle('flip', flip);
    p.style.transform = `translate(${x.toFixed(1)}px,${at[k * 2 + 1].toFixed(1)}px)${flip ? ' translateX(calc(30px - 100%))' : ''}`;
  });
  if (!auto || !dt) return;
  elapsed += dt * 1000;
  if (elapsed >= STAGE_MS) setStage(stage + 1);
  else cards[stage].style.setProperty('--p', (elapsed / STAGE_MS).toFixed(3));
}

async function load(){
  if (scene || loading) return;
  loading = true;
  try {
    const { createWaterCycle } = await import('./scene.js');
    scene = createWaterCycle($('canvas', figure), { dark: night.matches, onFrame });
    scene.setStage(stage);
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
  root = $('#landing'); figure = $('#scene'); cycle = $('#cycle'); pause = $('#scenePause');
  pins = $$('.rd-pin', figure); cards = $$('.rd-stage', cycle);
  cards.forEach((c, k) => $('button', c).addEventListener('click', () => setStage(k, true)));
  pins.forEach((p, k) => p.addEventListener('click', () => setStage(k, true)));
  pause.addEventListener('click', () => { paused = !paused; sync(); });
  figure.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = figure.getBoundingClientRect();
    scene?.setPointer((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1);
  });
  figure.addEventListener('pointerleave', () => scene?.setPointer(0, 0));
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView && shown) load(); sync(); }, { rootMargin: '120px' }).observe(figure);
  document.addEventListener('visibilitychange', sync);
  night.addEventListener('change', () => scene?.setDark(night.matches));
  calm.addEventListener('change', () => { paused = calm.matches; sync(); });
  setStage(0);
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
