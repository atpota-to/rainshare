// rainshare.dev. The screens are in ../ui and the data in ../core; this file is the site
// around them:
//
//   /               signed out, the landing, and everything open to everyone under it;
//                   signed in, the board
//   /board          the board on its own, signed in or out (the bar's "Board")
//   /example/…      the example circle, kept in this browser (linked from the landing)
//   /seed/…, /new, /me, /profile/…, /agents   Rainshare's own screens (see ../ui/rainshare.js)
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
import { openSignIn, landingSignIn } from './signin.js';
import { showLanding, hideLanding } from './landing/landing.js';
import { peekWords, peekPeople } from './landing/peek.js';
import { face, avatarFallback } from '../ui/bits.js';
import { mountLogo } from './logo/live.js';
import { mountMode } from './mode.js';
// Vercel Web Analytics: page views, including the in-page navigations between screens.
// In production its script is served from this site (/_vercel/insights/), so the
// Content-Security-Policy in vercel.json already allows it; nothing is sent in development.
import { inject } from '@vercel/analytics';

inject();
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
  const t = $('#toast'); t.textContent = msg; t.hidden = false; t.classList.remove('out');
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
  ...(kind === 'example' ? { exitDemo: session ? 'Back to your circle' : 'Sign in for your real circle', onExitDemo: () => navigate('/') } : {})
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
// to them. The garden's people are made up; these are real. It comes in once the board has
// loaded (its room is kept for it until then, so nothing moves), and goes if nothing's open.
const peekLink = $('#rdPeek');
avatarFallback(peekLink);
function peek(items){
  const words = peekWords((items || []).map(it => it.value));
  peekLink.hidden = !words;
  if (!words) return;
  peekLink.querySelector('.rd-peek-faces').innerHTML = peekPeople(items).map(p => face(p)).join('');
  peekLink.querySelector('.rd-peek-words').textContent = words;
  peekLink.classList.add('in');
}
function toBoard(){
  const head = $('#circle .rs-head');
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
  // (The landing isn't the board: no tab is the page you're on there.)
  const tab = kind === 'example' ? 'example' : sub === 'agents' ? 'agents' : landing || sub === 'admin' ? null : 'circle';
  document.querySelectorAll('[data-tab]').forEach(a => a.setAttribute('aria-current', String(a.dataset.tab === tab)));
  app(kind).show(sub);
}
function navigate(path, o = {}){
  if (location.pathname !== path) history[o.replace ? 'replaceState' : 'pushState'](null, '', path);
  route();
  scrollTo({ top: 0 });
}
addEventListener('popstate', route);
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-nav]');
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); navigate(a.getAttribute('href')); }
  if (e.target.closest('[data-signout]')) signOut();
  if (e.target.closest('#rdPeek') && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); toBoard(); }
  // The bar's "Sign in": on the landing its handle field is right there; anywhere else, the
  // dialog, and you come back to the page you were on (the example circle isn't yours to come back to).
  if (e.target.closest('[data-signin]')) {
    if (!$('#landing').hidden) focusSignIn();
    else openSignIn({ to: isExample(location.pathname) ? '/' : location.pathname + location.search });
  }
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
  menu.hidden = !open;
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
// The landing's handle field is the first step of signing in; the dialog takes it from there.
landingSignIn($('#rdSignIn'), $('#rdErr'));
function focusSignIn(){
  scrollTo({ top: 0, behavior: 'smooth' });
  $('#rdSignIn input')?.focus({ preventScroll: true });
}

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
