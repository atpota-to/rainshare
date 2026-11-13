// Day and night: which one the site is in, and the turn from one to the other.
//
// The site follows the system's light or dark setting until someone picks the other with the
// toggle in the bar (src/mode.js); that choice is kept in this browser, and forgotten again
// once it's the same as the system's, so the site goes back to following it. Nothing here
// touches the page, so the tests can run it.
//
//   modeOf(saved, systemDark)   'day' or 'night': the saved choice, or else the system's
//   other(mode)                 the one it isn't
//   keep(mode, systemDark)      what to save after choosing `mode`: it, or null to follow the system
//   blend(day, night, t)        a look part of the way from one to the other (colours, numbers, lists, objects of them)
//   dusk(night)                 how far into night it is, moving to wherever it's set over TURN seconds

export const MODES = ['day', 'night'];
/** Where the choice is kept in localStorage. (public/mode.js reads it too, before the page is drawn.) */
export const KEY = 'rs:mode';
/** How long the turn from day to night takes, in seconds. (src/theme.css fades the page's colours over the same time.) */
export const TURN = 1.2;
/** The browser's own colour (theme-color) in each mode: the top of the page's sky. */
export const CHROME = { day: '#EEF3FF', night: '#0B1220' };

export const modeOf = (saved, systemDark) => MODES.includes(saved) ? saved : systemDark ? 'night' : 'day';
export const other = mode => mode === 'night' ? 'day' : 'night';
export const keep = (mode, systemDark) => mode === modeOf(null, systemDark) ? null : mode;

const HEX = /^#[0-9a-f]{6}$/i;
const channels = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const two = n => Math.round(n).toString(16).padStart(2, '0');

/**
 * What lies `t` of the way from `a` to `b` (0 is a, 1 is b). Numbers are mixed; so are colours
 * written as '#RRGGBB', channel by channel; lists and objects are mixed part by part. Anything
 * else changes over at the halfway point.
 */
export function blend(a, b, t){
  if (t <= 0) return a;
  if (t >= 1) return b;
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (typeof a === 'string' && typeof b === 'string' && HEX.test(a) && HEX.test(b)) {
    const x = channels(a), y = channels(b);
    return '#' + x.map((v, i) => two(v + (y[i] - v) * t)).join('');
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.map((v, i) => blend(v, b[i], t));
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b))
    return Object.fromEntries(Object.keys(a).map(k => [k, k in b ? blend(a[k], b[k], t) : a[k]]));
  return t < .5 ? a : b;
}

const smooth = x => x * x * (3 - 2 * x);

/**
 * How far into night it is, from 0 (day) to 1 (night). `set(night)` says where it's going, and
 * `step(seconds)` takes it there, the whole way in TURN seconds; `set(night, true)` puts it
 * there at once. `mix` is how far along it is, eased at both ends, for blend().
 */
export function dusk(night = false){
  let at = night ? 1 : 0, to = at;
  return {
    get at(){ return at; },
    get mix(){ return smooth(at); },
    get moving(){ return at !== to; },
    get night(){ return to === 1; },
    set(on, snap = false){ to = on ? 1 : 0; if (snap) at = to; },
    /** Move on by `seconds` (Infinity: all the way). True if anything changed. */
    step(seconds){
      if (at === to || !(seconds > 0)) return false;
      const by = seconds / TURN;
      at = to > at ? Math.min(to, at + by) : Math.max(to, at - by);
      return true;
    }
  };
}
