// The signed-out landing: the pitch, and a scene to play with.
//
// The scene is the garden (./garden.js): your cloud, and your friends' plots to rain on. It's
// the page's whole backdrop, with the pitch in its sky. The water cycle it replaced is kept
// in ./cycle, in case it's wanted back; that one is drawn in a box beside the pitch.
//
// Either is three.js, so it's fetched only when the landing is actually on screen, and it
// holds still when it's scrolled away, the tab is hidden, or someone pauses it. If the browser
// can't draw it, a flat illustration takes its place with the scene's notes under it.
//
// A scene is a module with mount(figure), which wires up what's in the figure and gives back:
//   load({ dark })    fetch the scene and start drawing it (rejects where WebGL isn't to be had)
//   setRunning(on)    animate, or hold still
//   setDark(on)       night, or day: a running scene turns from one to the other over a moment
//   escape()          Escape was pressed
import './landing.css';
import * as garden from './garden.js';
import { isNight, onMode } from '../mode.js';

// Which scene the landing shows: 'garden', or 'cycle' for the water cycle. Adding ?scene=cycle
// (or ?scene=garden) to the address shows the other one without changing this.
const SCENE = 'garden';
const SCENES = { garden: () => garden, cycle: () => import('./cycle/cycle.js') };
const chosen = () => { const q = new URLSearchParams(location.search).get('scene'); return Object.hasOwn(SCENES, q) ? q : SCENE; };

const $ = (s, el = document) => el.querySelector(s);
const calm = matchMedia('(prefers-reduced-motion: reduce)');

let figure, pause, scene = null;
let wiring = null, loading = false, live = false;
let shown = false, inView = true, paused = calm.matches;

function sync(){
  const run = shown && inView && !document.hidden && !paused;
  if (live) scene.setRunning(run);
  pause.setAttribute('aria-pressed', String(paused));
  pause.setAttribute('aria-label', paused ? 'Play the animation' : 'Pause the animation');
}

async function load(){
  if (live || loading) return;
  loading = true;
  try {
    await scene.load({ dark: isNight() });
    live = true;
    figure.classList.add('live');
    sync();
  } catch (e) {
    console.warn('The landing’s scene couldn’t start', e);
    figure.classList.add('flat');
  }
  loading = false;
}

async function wire(){
  figure = $('#scene');
  scene = (await SCENES[chosen()]()).mount(figure);
  pause = $('#scenePause', figure);
  pause.addEventListener('click', e => { e.stopPropagation(); paused = !paused; sync(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && shown) scene.escape(); });
  // (The scene's own box, not the figure: the garden's is the page's backdrop, and is on screen before its figure is.)
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView && shown) load(); sync(); }, { rootMargin: '120px' }).observe($('#sceneView', figure));
  document.addEventListener('visibilitychange', sync);
  // The toggle in the bar, or the system's setting (../mode.js): a running scene turns smoothly, a still one at once.
  onMode(night => scene.setDark(night));
  calm.addEventListener('change', () => { paused = calm.matches; sync(); });
}

/** The landing is on screen (signed out, at /). */
export function showLanding(){
  shown = true;
  (wiring ||= wire()).then(() => { if (shown && inView) load(); sync(); });
}
/** The landing is hidden: another page, or someone signed in. */
export function hideLanding(){
  shown = false;
  wiring?.then(sync);
}
