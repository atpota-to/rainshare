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
import { BOARD, GROUPS } from '../core/ns.js';
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
// Vercel Web Analytics: page views, including the in-page navigations between screens.
// In production its script is served from this site (/_vercel/insights/), so the
// Content-Security-Policy in vercel.json already allows it; nothing is sent in development.
import { inject } from '@vercel/analytics';

inject();

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
  const tab = kind === 'example' ? 'example' : sub === 'agents' ? 'agents' : landing ? null : 'circle';
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
});

/* ---------- you ---------- */
function renderMe(){
  const box = $('#rdMe');
  if (!ready && !visitor) { box.innerHTML = ''; return; }
  if (!session) { box.innerHTML = `<button class="rd-btn" type="button" data-signin>Sign in</button>`; return; }
  const p = me || { did: session.did };
  const img = p.avatar ? `<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">` : esc((p.displayName || p.handle || '?')[0].toUpperCase());
  box.innerHTML = `<a class="rd-who" href="/me" data-nav title="Your Rainshare profile"><span class="rd-face">${img}</span><span>${esc(p.displayName || (p.handle ? '@' + p.handle : 'You'))}</span></a><button class="rd-link" type="button" data-signout>Sign out</button>`;
}
async function signOut(){
  const s = session; session = null; me = null; forges = [];
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
    session = r.session; forges = r.forges || [];
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
