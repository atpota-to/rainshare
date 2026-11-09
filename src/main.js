// rainshare.dev. The screens are in ../ui and the data in ../core; this file is the site
// around them:
//
//   /               your circle (signed out: the landing, and everything open to everyone)
//   /example/…      the example circle, kept in this browser
//   /q/…, /new, /me, /u/…, /agents   Rainshare's own screens (see ../ui/rainshare.js)
//   /signed-in      where your server sends you back after signing in
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/inter';
import '../ui/rainshare.css';
import './theme.css';
import { createRainshare } from '../ui/rainshare.js';
import { createSource } from '../core/source.js';
import { createDemoSource } from '../core/demo.js';
import { BOARD } from '../core/ns.js';
import { profiles } from '../core/net.js';
// The spaces alpha's plumbing (credentials, signed reads, writes into a space) and the group
// host's methods, for private sidequests.
import * as atp from './spaces.js';
import * as oauth from './oauth.js';
import { showLanding, hideLanding } from './landing/landing.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = {
  get(k){ try { return JSON.parse(localStorage.getItem('rs:' + k)); } catch (_) { return null; } },
  set(k, v){ try { v == null ? localStorage.removeItem('rs:' + k) : localStorage.setItem('rs:' + k, JSON.stringify(v)); } catch (_) {} }
};

let session = null, me = null, ready = false;
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
  navigate,
  toast,
  onTitle: t => { document.title = t ? `${t} · Rainshare` : 'Rainshare'; },
  signIn: kind === 'real' ? (handle, sub) => oauth.signIn(handle, '/' + (sub || '')) : null,
  ...(kind === 'example' ? { exitDemo: session ? 'Back to your circle' : 'Sign in for your real circle', onExitDemo: () => navigate('/') } : {})
});
let real = null, example = null;
function app(kind){
  if (kind === 'example') {
    if (!example) { example = createRainshare({ root: $('#example'), base: EXAMPLE, host: host('example') }); example.setSource(createDemoSource({ store })); }
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
  return createSource({
    agent: { did: session.did, fetchHandler: (path, init) => session.fetchHandler(path, init) },
    spaces: {
      read: (space, cs) => atp.readSpace(session, space, cs),
      create: (space, c, rec) => atp.createOwn(session, space, c, rec),
      put: (space, c, k, rec) => atp.putOwn(session, space, c, k, rec),
      del: (space, c, k) => atp.deleteOwn(session, space, c, k)
    },
    groups
  });
}

/* ---------- moving around ---------- */
function route(){
  const path = location.pathname, kind = isExample(path) ? 'example' : 'real', sub = subOf(path);
  $('#example').hidden = kind !== 'example';
  $('#circle').hidden = kind !== 'real';
  const landing = ready && kind === 'real' && !session && !sub;
  $('#landing').hidden = !landing;
  landing ? showLanding() : hideLanding();
  document.querySelectorAll('[data-tab]').forEach(a => a.setAttribute('aria-current', String(a.dataset.tab === (kind === 'example' ? 'example' : sub === 'agents' ? 'agents' : 'circle'))));
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
});

/* ---------- you ---------- */
function renderMe(){
  const box = $('#rdMe');
  if (!ready) { box.innerHTML = ''; return; }
  if (!session) { box.innerHTML = `<a class="rd-btn" href="/" data-nav data-signin>Sign in</a>`; return; }
  const p = me || { did: session.did };
  const img = p.avatar ? `<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">` : esc((p.displayName || p.handle || '?')[0].toUpperCase());
  box.innerHTML = `<a class="rd-who" href="/me" data-nav title="Your Rainshare profile"><span class="rd-face">${img}</span><span>${esc(p.displayName || (p.handle ? '@' + p.handle : 'You'))}</span></a><button class="rd-link" type="button" data-signout>Sign out</button>`;
}
async function signOut(){
  const s = session; session = null; me = null;
  atp.forgetCredentials();
  await oauth.signOut(s);
  renderMe(); await app('real').setSource(sourceNow()); toast('Signed out'); navigate('/');
}
$('#rdSignIn').addEventListener('submit', async e => {
  e.preventDefault();
  const handle = e.target.handle.value.trim().replace(/^@/, '').toLowerCase(), err = $('#rdErr'), btn = e.target.querySelector('button');
  if (!handle) return;
  btn.disabled = true; btn.textContent = 'Off to your server…'; err.hidden = true;
  try { await oauth.signIn(handle, '/'); }
  catch (x) { console.warn(x); err.hidden = false; err.textContent = /resolve|not found|handle/i.test(String(x?.message)) ? 'We couldn’t find that handle. Check the spelling.' : 'Your server didn’t let us start signing in. Try again in a moment.'; btn.disabled = false; btn.textContent = 'Sign in with your handle'; }
});
document.addEventListener('click', e => { if (e.target.closest('[data-signin]') && $('#rdSignIn')) setTimeout(() => $('#rdSignIn input')?.focus(), 50); });

/* ---------- boot ---------- */
async function boot(){
  route();
  let r = null;
  try { r = await oauth.start(); }
  catch (e) { console.warn('sign-in', e); toast(/denied|cancel/i.test(String(e?.message)) ? 'Sign-in was cancelled' : 'Sign-in didn’t finish. Try again.'); }
  if (r?.redirecting) return;
  if (r?.session) {
    session = r.session;
    profiles([session.did]).then(m => { me = m.get(session.did); renderMe(); }, () => {});
  }
  if (oauth.isCallback() || location.pathname === '/signed-in') history.replaceState(null, '', r?.to && r.to !== '/signed-in' ? r.to : '/');
  ready = true;
  renderMe();
  route();
  await app('real').setSource(sourceNow());
  route();
}
boot();
