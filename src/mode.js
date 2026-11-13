// Day and night on the page: the toggle in the bar, and everything that follows it.
//
// The mode is the `data-mode` attribute on <html>, 'day' or 'night', which the stylesheets
// read (src/theme.css). It's set before the first paint by /mode.js, and kept right from
// here: it follows the system's setting until someone picks the other, and that choice stays
// in this browser (see ../core/mode.js for the rule).
//
//   isNight()           is it night?
//   onMode(fn)          call fn(night) whenever it changes; gives back a function that stops
//   toggleMode()        the other one, kept
//   mountMode(button)   make `button` the toggle
import { KEY, TURN, CHROME, modeOf, other, keep } from '../core/mode.js';

const root = document.documentElement;
const system = matchMedia('(prefers-color-scheme: dark)'), calm = matchMedia('(prefers-reduced-motion: reduce)');
const heard = new Set();

const saved = () => { try { return localStorage.getItem(KEY); } catch (_) { return null; } };
const save = v => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (_) {} };

let mode = modeOf(saved(), system.matches), toggle = null, turning = 0;

// What on the page says which mode it is, besides the styles: the browser's own colour, the
// still pictures that have a night version, and what the toggle would do.
function show(){
  root.dataset.mode = mode;
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.content = CHROME[mode];
  for (const s of document.querySelectorAll('source[data-night]')) s.media = mode === 'night' ? 'all' : 'not all';
  if (toggle) { const label = `Switch to ${other(mode)} mode`; toggle.setAttribute('aria-label', label); toggle.title = label; }
}

function set(to){
  if (to === mode) return;
  mode = to;
  // The page's colours fade for as long as the scenes take to turn (src/theme.css), unless less motion was asked for.
  if (!calm.matches) {
    root.classList.add('rd-turning');
    clearTimeout(turning); turning = setTimeout(() => root.classList.remove('rd-turning'), TURN * 1000 + 100);
  }
  show();
  for (const fn of heard) fn(mode === 'night');
}
const follow = () => set(modeOf(saved(), system.matches));

export const isNight = () => mode === 'night';
export const onMode = fn => { heard.add(fn); return () => heard.delete(fn); };
export function toggleMode(){
  const to = other(mode);
  save(keep(to, system.matches));
  set(to);
}
export function mountMode(button){
  toggle = button;
  button.addEventListener('click', toggleMode);
  button.hidden = false;
  show();
}

system.addEventListener('change', follow);
// Another tab of the site changed it.
addEventListener('storage', e => { if (e.key === KEY || e.key === null) follow(); });
show();
