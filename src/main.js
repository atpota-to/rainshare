// rainshare.dev. The screens are in ../ui and the data in ../core; this file is the site
// around them:
//
//   /               signed out, the landing, and everything open to everyone under it;
//                   signed in, the board
//   /board          the board on its own, signed in or out (the bar's "Help someone")
//   /new            asking for help (the bar's "Ask for help")
//   /example/…      the example circle, kept in this browser (linked from the landing)
//   /seed/…, /new, /me, /profile/…, /agents, /feedback, /terms, /privacy   Rainshare's own screens (see ../ui/rainshare.js)
//   /signed-in      where your server sends you back after signing in
//
// Signing in is a dialog of its own (./signin.js), opened from here.
import './fonts.css';
import '../ui/rainshare.css';
import './theme.css';
import { createRainshare } from '../ui/rainshare.js';
import { createSource } from '../core/source.js';
import { createDemoSource } from '../core/demo.js';
import { BOARD, GROUPS, MODERATOR } from '../core/ns.js';
import { canModerate } from './scope.js';
import { closeTo } from '../core/route.js';
import { profiles } from '../core/net.js';
// The spaces alpha's plumbing (credentials, signed reads, writes into a space) and the group
// host's methods, for private seeds.
import * as atp from './spaces.js';
import * as oauth from './oauth.js';
import { openSignIn } from './signin.js';
import { showLanding, hideLanding } from './landing/landing.js';
import { peekWords, peekPeople } from './landing/peek.js';
import { face, avatarFallback } from '../ui/bits.js';
import { still, glide, SPRING } from '../ui/motion.js';
import { mountLogo } from './logo/live.js';
import { mountMode } from './mode.js';
// Vercel Web Analytics: page views, including the in-page navigations between screens.
// In production its script is served from this site (/_vercel/insights/), so the
// Content-Security-Policy in vercel.json already allows it; nothing is sent in development.
import { inject } from '@vercel/analytics';

// A page view is counted by its path alone. What follows a ? or a # is left out: a link an
// agent hands back carries a pull request there, and coming back from signing in, a code.
// (The Privacy Policy says so: ../core/legal.js.)
inject({ beforeSend(e){ try { const u = new URL(e.url); return { ...e, url: u.origin + u.pathname }; } catch (_) { return e; } } });
// Day or night, from the toggle in the bar.
mountMode(document.querySelector('#rdMode'));

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = {
  get(k){ try { return JSON.parse(localStorage.getItem('rs:' + k)); } catch (_) { return null; } },
  set(k, v){ try { v == null ? localStorage.removeItem('rs:' + k) : localStorage.setItem('rs:' + k, JSON.stringify(v)); } catch (_) {} }
};

let session = null, me = null, ready = false;
// Someone with no sign-in to restore and none coming back: there's nothing to wait for, so the
// landing and the sign-in button show at once, rather than after the sign-in code has loaded.
const visitor = !oauth.mightBeSignedIn() && !oauth.isCallback();
let forges = [];   // the forges this sign-in lets Rainshare post to for you (knotless, tangled): see ./scope.js
let granted = '';  // everything this sign-in was granted, as a scope: whether @rainshare.dev's can moderate
const EXAMPLE = '/example';
const isExample = p => p === EXAMPLE || p.startsWith(EXAMPLE + '/');
const subOf = p => (isExample(p) ? p.slice(EXAMPLE.length) : p).replace(/^\/+/, '');

/* ---------- toasts ---------- */
let toastTimer;
function toast(msg){
  const t = $('#toast'), showing = !t.hidden && !t.classList.contains('out');
  t.textContent = msg; t.hidden = false; t.classList.remove('out');
  // It springs up from the foot of the window (and sinks and fades on the way out, as it always has).
  if (!showing && !still()) t.animate([{ opacity: 0, transform: 'translate(-50%,16px) scale(.95)' }, { opacity: 1, transform: 'translate(-50%,0)' }], { duration: 420, easing: SPRING });
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.classList.add('out'); toastTimer = setTimeout(() => { t.hidden = true; }, 300); }, 3200);
}

/* ---------- the two circles ---------- */
const host = kind => ({
  brand: 'rainshare',
  // Nobody to restore and nobody coming back from signing in: the screens needn't wait to say hello.
  visitor: kind === 'real' && visitor,
  // Signed out, / is the landing with the board under it, so the board has an address of its own (/board).
  landing: kind === 'real',
  navigate,
  toast,
  // Only the circle on screen names the page: the other one goes on loading behind it.
  onTitle: t => { if (kind === (isExample(location.pathname) ? 'example' : 'real')) document.title = t ? `${t} · Rainshare` : 'Rainshare'; },
  // The 3D plants are drawn on demand: the models and three.js load only when one is on screen,
  // and until then (or if WebGL isn't to be had) the picture underneath, of the same kind, is what shows.
  plant3d(canvas, stage, kind){
    let off = null, gone = false;
    import('./plants/live.js').then(m => { if (!gone && canvas.isConnected) off = m.mountPlant(canvas, stage, kind); }).catch(() => {});
    return () => { gone = true; off?.(); };
  },
  // A "Sign in" on any screen opens the sign-in dialog, and signing in comes back to that screen.
  // The query comes along, so a link an agent handed back still has its pull request after signing in.
  signIn: kind === 'real' ? sub => openSignIn({ to: '/' + (sub || '') + location.search }) : null,
  // Posting to knotless or Tangled for you (an issue, a comment, a pull request, a vouch) is
  // asked for at sign-in. A sign-in that was granted less, one that left a forge unticked, or
  // one from before Rainshare asked, can add a forge: the dialog says what's being added and
  // where you're being sent to approve it, and you come back to where you were.
  // The example circle only pretends to post, so there both count as connected.
  forges: () => kind === 'example' ? ['knotless', 'tangled'] : forges,
  // What's open on your board: the landing's way down to it says who's asking, and how many.
  onBoard: kind === 'real' ? peek : null,
  // Whether this sign-in can write moderation records (only @rainshare.dev's asks to: ./scope.js).
  // One from before it asked is told to sign in again, on the moderation page.
  canModerate: kind === 'real' ? () => canModerate(granted) : null,
  connectForge: kind === 'real' ? (forge, sub) => { if (session) openSignIn({ person: me || { did: session.did }, to: '/' + (sub || '') + location.search, forges: [...new Set([...forges, forge])], adding: forge }); } : null,
  ...(kind === 'example' ? { exitDemo: session ? 'Back to the real board' : 'Sign in for the real board', onExitDemo: () => navigate('/') } : {})
});
let real = null, example = null;
function app(kind){
  if (kind === 'example') {
    if (!example) { example = createRainshare({ root: $('#example'), base: EXAMPLE, host: host('example') }); example.setSource(createDemoSource({ store, groups: GROUPS })); }
    return example;
  }
  real ||= createRainshare({ root: $('#circle'), base: '/', host: host('real') });
  return real;
}

// Your groups on the group host, and each one's Rainshare space.
const groups = {
  async mine(){
    const r = await atp.callHost(session, 'getActorGroups', { params: { actor: session.did, limit: 100 } });
    return (r.groups || []).map(g => ({ did: g.did, handle: g.handle, name: g.displayName || g.handle, memberCount: g.memberCount ?? null }));
  },
  async board(did){
    const v = await atp.callHost(session, 'getGroup', { params: { group: did } });
    return { space: (v.spaces || []).find(s => s.type === BOARD)?.uri || null, canAdd: (v.group?.viewer?.actions || []).includes('space.create') };
  },
  async add(did){
    await atp.callHost(session, 'createSpace', { body: { group: did, type: BOARD, skey: 'rainshare', name: 'Rainshare', readableBy: ['member'], credentialScopes: [{ role: 'admin', scopes: ['*'] }] } });
    return (await groups.board(did)).space;
  }
};
function sourceNow(){
  if (!session) return createSource();
  const agent = { did: session.did, fetchHandler: (path, init) => session.fetchHandler(path, init) };
  // Groups are coming (GROUPS in ../core/ns.js): until then every seed is public.
  if (!GROUPS) return createSource({ agent });
  return createSource({
    agent,
    spaces: {
      read: (space, cs) => atp.readSpace(session, space, cs),
      create: (space, c, rec) => atp.createOwn(session, space, c, rec),
      put: (space, c, k, rec) => atp.putOwn(session, space, c, k, rec),
      del: (space, c, k) => atp.deleteOwn(session, space, c, k)
    },
    groups
  });
}

/* ---------- the way down from the landing to the board ---------- */
// Under the sign-in: the faces of whoever's asking, how many asks are open, and an arrow down
// to them. The garden's people are made up; these are real. It's on the page from the first
// paint with placeholders (index.html), so the way down shows at once; once the board has
// loaded, the real faces and count fade in over them, and if nothing's open it goes.
const peekLink = $('#rdPeek');
avatarFallback(peekLink);
let peekGone = 0;
function peek(items){
  const words = peekWords((items || []).map(it => it.value));
  clearTimeout(peekGone);
  if (!words) {
    // (it fades, then gives its room back)
    peekLink.classList.remove('in');
    peekLink.removeAttribute('aria-busy');
    peekGone = setTimeout(() => { peekLink.hidden = true; }, 600);
    return;
  }
  const wordsBox = peekLink.querySelector('.rd-peek-words');
  if (!peekLink.classList.contains('wait') && wordsBox.textContent === words && !peekLink.hidden) {
    // (the same count as before: only the faces might have changed)
    peekLink.querySelector('.rd-peek-faces').innerHTML = peekPeople(items).map(p => face(p)).join('');
    return;
  }
  const shown = !peekLink.hidden && peekLink.classList.contains('in');
  const from = shown ? peekLink.getBoundingClientRect().width : 0;
  peekLink.hidden = false;
  peekLink.style.width = '';
  peekLink.querySelector('.rd-peek-faces').innerHTML = peekPeople(items).map(p => face(p)).join('');
  wordsBox.textContent = words;
  peekLink.classList.remove('wait');
  peekLink.removeAttribute('aria-busy');
  peekLink.classList.add('in');
  // The pane eases from the placeholders' width to the real words'.
  const to = peekLink.getBoundingClientRect().width;
  if (!shown || Math.abs(to - from) < 1 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  peekLink.classList.add('grow');
  peekLink.style.width = from + 'px';
  peekLink.getBoundingClientRect();
  peekLink.style.width = to + 'px';
  const done = e => { if (e && e.propertyName !== 'width') return; peekLink.classList.remove('grow'); peekLink.style.width = ''; peekLink.removeEventListener('transitionend', done); };
  peekLink.addEventListener('transitionend', done);
  setTimeout(done, 700);
}
function toBoard(){
  // (tapped before the board's had a chance to draw its head, it goes to where the board will be)
  const head = $('#circle .rs-head') || $('#circle');
  if (!head) return;
  head.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  // (and on from there, for whoever's using the keyboard)
  const h = head.querySelector('h1,h2');
  if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
}

/* ---------- moving around ---------- */
function route(){
  showMenu(false);
  const path = location.pathname, kind = isExample(path) ? 'example' : 'real', sub = subOf(path);
  // A slip of the keys on the way to the example circle still gets there.
  const [head, ...rest] = sub.split('/'), h = head.toLowerCase();
  if (kind === 'real' && head && (h === 'example' || ['examples', 'demo'].includes(h) || closeTo(h, 'example'))) return navigate([EXAMPLE, ...rest].join('/'), { replace: true });
  $('#example').hidden = kind !== 'example';
  $('#circle').hidden = kind !== 'real';
  const landing = (ready || visitor) && kind === 'real' && !session && !sub;
  $('#landing').hidden = !landing;
  // The example circle is reached from the landing. Its tab shows only while you're in it,
  // so every one of its pages says where you are.
  $('[data-tab="example"]').hidden = kind !== 'example';
  landing ? showLanding() : hideLanding();
  // The bar has the two things to do here: help someone (the board, and an ask's page) and ask
  // for help. (The landing isn't either, and nor are your profile, someone else's, or the pages
  // in the footer.)
  const top = sub.split('/')[0];
  const tab = kind === 'example' ? 'example' : landing ? null : top === 'new' ? 'new' : !top || top === 'board' || top === 'seed' ? 'circle' : null;
  // (The tab's tint slides over from the one you were on.)
  const was = document.querySelector('.rd-nav [aria-current="true"]');
  document.querySelectorAll('[data-tab]').forEach(a => a.setAttribute('aria-current', String(a.dataset.tab === tab)));
  const now = document.querySelector('.rd-nav [aria-current="true"]');
  if (was && now && was !== now) glide(now, was);
  app(kind).show(sub);
}
// Going to another page fades from one to the other, and what the two share travels between
// them: an ask's title and plant, from its card or the panel beside the board to its own page,
// and back. The screens mark those with data-rs-vt (../ui/rainshare.js). Where the browser can't
// (or someone's asked for less motion), the page changes at once, as it always did. The
// browser's own Back and Forward aren't faded: it puts the page back where it was scrolled to
// as it lands, and a transition would get in the way of that.
function navigate(path, o = {}){
  const go = () => {
    if (location.pathname !== path) history[o.replace ? 'replaceState' : 'pushState'](null, '', path);
    route();
    scrollTo({ top: 0 });
  };
  if (o.replace || !document.startViewTransition || still() || document.hidden) return go();
  const from = travellers(), names = new Map([...from.keys()].map((k, i) => [k, 'rs-vt-' + i]));
  let to = new Map();
  name(from, names);
  const t = document.startViewTransition(() => { name(from, null); go(); to = travellers(names); name(to, names); });
  t.finished.finally(() => name(to, null));
}
// What's marked to travel and on screen now, one of each (the panel's first, where it's showing),
// `only` the ones that were on the page before, if that's asked.
function travellers(only = null){
  const got = new Map(), vh = innerHeight;
  for (const el of [...document.querySelectorAll('.rs-side [data-rs-vt]'), ...document.querySelectorAll('[data-rs-vt]')]) {
    const k = el.dataset.rsVt;
    if (got.has(k) || (only && !only.has(k))) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > vh || getComputedStyle(el).visibility === 'hidden') continue;
    got.set(k, el);
    if (got.size >= 16) break;
  }
  return got;
}
function name(els, names){
  for (const [k, el] of els) {
    el.style.viewTransitionName = names ? names.get(k) : '';
    el.classList.toggle('rd-vt-title', !!names && k.startsWith('title:'));
  }
}
addEventListener('popstate', route);
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-nav]');
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); navigate(a.getAttribute('href')); }
  if (e.target.closest('[data-signout]')) signOut();
  if (e.target.closest('#rdPeek') && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); toBoard(); }
  // The bar's "Sign in": the dialog, and you come back to the page you were on (the example
  // board isn't yours to come back to).
  if (e.target.closest('[data-signin]')) openSignIn({ to: isExample(location.pathname) ? '/' : location.pathname + location.search });
  // The landing's two buttons: the same dialog, saying what it's for, and on to the board or to asking.
  const start = e.target.closest('[data-start]');
  if (start) openSignIn(START[start.dataset.start] || START.board);
  // "Make one", for someone with no account yet: the dialog, at the hosts to make one with.
  if (e.target.closest('[data-signup]')) openSignIn({ making: true, to: isExample(location.pathname) ? '/' : location.pathname + location.search });
});

/* ---------- you ---------- */
// Signed in, the bar has only your face, so it keeps to one row on a phone. It opens a little
// menu under it: who you're signed in as, which is the way to your profile, and "Sign out".
// It closes when you pick something, tap anywhere else, press Escape or tab away.
const meBox = $('#rdMe');
avatarFallback(meBox);
let menuOpen = false;
function renderMe(){
  const box = meBox;
  if (!ready && !visitor) { box.innerHTML = ''; return; }
  if (!session) { menuOpen = false; box.innerHTML = `<button class="rd-btn" type="button" data-signin title="Sign in"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4"/></svg><span>Sign in</span></button>`; return; }
  const p = me || { did: session.did };
  const name = p.displayName || (p.handle ? '@' + p.handle : 'You'), handle = p.displayName && p.handle ? '@' + p.handle : '';
  box.innerHTML = `<button class="rd-who" type="button" aria-expanded="false" aria-controls="rdMenu" aria-label="Signed in as ${esc(name)}" title="Signed in as ${esc(name)}">${face(p)}</button>`
    + `<div class="rd-menu" id="rdMenu" hidden>`
    + `<a class="rd-menu-you" href="/me" data-nav>${face(p)}<span class="rd-menu-name"><span class="rd-sr">Your profile: </span><b>${esc(name)}</b>${handle ? `<small>${esc(handle)}</small>` : ''}</span><svg class="rd-menu-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></a>`
    // @rainshare.dev's own sign-in has its moderation page here, and nobody else's mentions it.
    + (session.did === MODERATOR ? `<a href="/admin" data-nav><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l7 2.6v5.5c0 4.2-3 7.6-7 8.9-4-1.3-7-4.7-7-8.9V6.1z"/><path d="M9 12l2 2 4-4"/></svg>Moderation</a>` : '')
    // Directing your agent from a terminal, or letting it do the Rainshare side itself: setup, so it's here rather than in the bar.
    + `<a href="/agents" data-nav><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M7.5 10l2.5 2-2.5 2M12.5 14.5h4"/></svg>CLI &amp; MCP</a>`
    + `<a href="/feedback" data-nav><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-7l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z"/></svg>Feedback</a>`
    + `<hr>`
    + `<button type="button" data-signout><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3M15 16l4-4-4-4M19 12H9"/></svg>Sign out</button>`
    + `</div>`;
  showMenu(menuOpen);
}
function showMenu(open){
  menuOpen = open;
  const who = meBox.querySelector('.rd-who'), menu = meBox.querySelector('.rd-menu');
  if (!who || !menu) return;
  who.setAttribute('aria-expanded', String(open));
  if (open) { menu.classList.remove('rd-closing'); menu.hidden = false; return; }
  if (menu.hidden || menu.classList.contains('rd-closing')) return;
  if (still()) { menu.hidden = true; return; }
  // It shrinks back into your face, the way it came out of it.
  let wait = 0;
  const end = e => { if (e.target === menu) done(); };
  const done = () => {
    clearTimeout(wait); menu.removeEventListener('animationend', end);
    if (menu.classList.contains('rd-closing')) { menu.classList.remove('rd-closing'); menu.hidden = true; }
  };
  menu.addEventListener('animationend', end);
  wait = setTimeout(done, 300);
  menu.classList.add('rd-closing');
}
document.addEventListener('click', e => {
  if (e.target.closest('.rd-who')) showMenu(!menuOpen);
  // (anything picked in it, or anywhere off it)
  else if (menuOpen && (!e.target.closest('.rd-menu') || e.target.closest('a,button'))) showMenu(false);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && menuOpen) { showMenu(false); meBox.querySelector('.rd-who')?.focus(); }
});
meBox.addEventListener('focusout', e => { if (menuOpen && e.relatedTarget && !meBox.contains(e.relatedTarget)) showMenu(false); });
async function signOut(){
  const s = session; session = null; me = null; forges = []; granted = '';
  atp.forgetCredentials();
  await oauth.signOut(s);
  renderMe(); await app('real').setSource(sourceNow()); toast('Signed out'); navigate('/');
}
// Where the landing's two buttons lead once you're signed in, and what the dialog says first.
const START = {
  board: { to: '/board', why: 'Sign in, then pick something to help with.' },
  new: { to: '/new', why: 'Sign in, then say what you’d like help with. It’s kept in your own account.' }
};

/* ---------- boot ---------- */
async function boot(){
  renderMe();
  // The logo starts moving: until now it was a picture of itself.
  try { mountLogo($('#rdLogo'), { touch: $('.rd-logo') }); } catch (e) { console.warn('The logo stays a picture', e); }
  route();
  let r = null;
  try { r = await oauth.start(); }
  catch (e) { console.warn('sign-in', e); toast(/denied|cancel/i.test(String(e?.message)) ? 'Sign-in was cancelled' : 'Sign-in didn’t finish. Try again.'); }
  if (r?.redirecting) return;
  if (r?.session) {
    session = r.session; forges = r.forges || []; granted = r.scope || '';
    profiles([session.did]).then(m => { me = m.get(session.did); renderMe(); }, () => {});
  }
  if (oauth.isCallback() || location.pathname === '/signed-in') history.replaceState(null, '', r?.to && r.to !== '/signed-in' ? r.to : '/');
  ready = true;
  renderMe();
  route();
  // (Handing over the source shows the screen the address points at: there's nothing left to route.)
  await app('real').setSource(sourceNow());
}
boot();
