// Addresses, and what a wrong one was probably meant to be. Links get cut short, pick up the
// full stop that ended a sentence, or are typed from memory. Where it's clear what was meant,
// the app goes there; where it isn't, it says nothing is there and offers the way back.
//
// A sub-path is the part after the app's base: '' (the board), 'new', 'me', 'agents',
// 'u/<who>', 'seed/<who>/<rkey>', 'seed/s/<code>' (see ../ui/rainshare.js).
import { isDid, isHandle, isRkey } from './net.js';

const PAGES = ['new', 'me', 'agents'];
// Other words people reach for.
const ALIAS = {
  ask: 'new', post: 'new', plant: 'new', create: 'new', add: 'new',
  profile: 'me', settings: 'me', account: 'me', you: 'me',
  agent: 'agents', cli: 'agents', mcp: 'agents', terminal: 'agents', install: 'agents', setup: 'agents', docs: 'agents', help: 'agents', faq: 'agents',
  board: '', home: '', index: '', 'index.html': '', circle: '', feed: '', all: ''
};
const SEED_WORDS = ['seed', 'seeds', 's', 'idea', 'ideas', 'project', 'projects', 'plant', 'plants', 'ask', 'asks'];
const PERSON_WORDS = ['u', 'user', 'users', 'profile', 'profiles', 'people', 'person', 'p', 'by'];

const who = s => { const x = String(s || '').replace(/^@/, ''); return isDid(x) ? x : isHandle(x) ? x.toLowerCase() : null; };

/** Whether `sub` is an address the app has a screen for (whether or not anything is there). */
export function known(sub){
  const p = String(sub || '').split('/');
  if (p.length === 1) return p[0] === '' || PAGES.includes(p[0]);
  if (p[0] === 'u') return p.length === 2 && !!p[1];
  if (p[0] === 'seed') return p.length === 3 && (p[1] === 's' ? /^[A-Za-z0-9_-]+$/.test(p[2]) : !!p[1] && !!p[2]);
  return false;
}

/** How many single-letter edits apart two words are, counting two swapped neighbours as one. */
export function editDistance(a, b){
  a = String(a); b = String(b);
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
/** A typed word that's a slip away from `word`: one edit for a short word, two for a longer one. */
export const closeTo = (typed, word) => {
  typed = String(typed || '').toLowerCase();
  return word.length >= 3 && typed !== word && typed.length >= 3 && Math.abs(typed.length - word.length) <= 2 && editDistance(typed, word) <= (word.length >= 6 ? 2 : 1);
};

/**
 * Where a sub-path the app doesn't know was probably meant to go: another sub-path, or null
 * if there's no telling. `sub` comes from the address bar, so nothing in it is trusted: what
 * comes back is only ever built from words on the lists above and from parts that are a DID,
 * a handle or a record key.
 */
export function reroute(sub){
  let s = String(sub || '');
  try { s = decodeURIComponent(s); } catch (_) { /* as typed */ }
  // The punctuation a sentence leaves on the end of a link, stray slashes, and an "at://" pasted whole.
  s = s.trim().replace(/[\s.,;:!?)\]>'"]+$/, '').replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '');
  const at = s.match(/^at:\/?\/?([^/]+)\/dev\.rainshare\.seed\/([^/]+)$/i);
  if (at) s = `seed/${at[1]}/${at[2]}`;
  const p = s.split('/').filter(Boolean);
  if (!p.length) return '';
  const head = p[0].toLowerCase(), tidy = [head, ...p.slice(1)].join('/');
  // Right all along, once tidied (a capital letter, a trailing full stop).
  if (known(tidy) && tidy !== sub) {
    if (head === 'u' && who(p[1])) return `u/${who(p[1])}`;
    if (head === 'seed' && p[1] !== 's' && who(p[1])) return `seed/${who(p[1])}/${p[2]}`;
    return tidy;
  }
  if (p.length === 1) {
    if (head in ALIAS) return ALIAS[head];
    if (who(p[0])) return `u/${who(p[0])}`;                       // /@someone.example, /did:plc:…
    const page = PAGES.find(w => closeTo(head, w));
    return page ?? (closeTo(head, 'board') ? '' : null);
  }
  const first = who(p[0]), second = who(p[1]);
  if (p.length === 2) {
    if (first && isRkey(p[1])) return `seed/${first}/${p[1]}`;      // someone.example/<key>, as the CLI takes it
    if ((PERSON_WORDS.includes(head) || SEED_WORDS.includes(head) || closeTo(head, 'seed')) && second) return `u/${second}`;   // an ask's link cut short leads to whoever asked
    return null;
  }
  if (p.length === 3 && second && isRkey(p[2]) && (SEED_WORDS.includes(head) || PERSON_WORDS.includes(head) || closeTo(head, 'seed'))) return `seed/${second}/${p[2]}`;
  return null;
}
