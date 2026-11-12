// Signing in to rainshare.dev: ordinary atproto OAuth against your own PDS.
//
//   loopback  in dev, served from 127.0.0.1: the client_id is the config, scope and all
//   hosted    everywhere else: the client_id is /oauth-client-metadata.json on this origin
//
// Sign-in asks for everything up front: your Rainshare records, and posting to knotless and
// Tangled for you (issues, comments, pull requests, vouches), so nobody is sent back to their
// server halfway through something. A server that refuses part of that (invalid_scope) is
// asked again for less, a step at a time, down to what any server grants: see `ladder`.
import { DECLARED_SCOPE, REDIRECT_PATH, PLC, FORGES, ladder, forgesIn } from './scope.js';

const LOOPBACK = /^http:\/\/(127\.0\.0\.1|\[::1\]|localhost)(:\d+)?$/.test(location.origin);
const SIGNED_IN = '@@atproto/oauth-client-browser(sub)';
const PENDING = 'rs:signin';

function clientId(){
  if (!LOOPBACK) return location.origin + '/oauth-client-metadata.json';
  const redirect = `http://127.0.0.1${location.port ? ':' + location.port : ''}${REDIRECT_PATH}`;
  return 'http://localhost?' + new URLSearchParams({ redirect_uri: redirect, scope: DECLARED_SCOPE });
}

let clientP;
function client(){
  clientP ??= import('@atproto/oauth-client-browser').then(({ BrowserOAuthClient }) =>
    BrowserOAuthClient.load({ clientId: clientId(), responseMode: 'fragment', plcDirectoryUrl: PLC, handleResolver: 'https://bsky.social' }));
  clientP.catch(() => { clientP = null; });
  return clientP;
}
const pending = () => { try { return JSON.parse(sessionStorage.getItem(PENDING)); } catch (_) { return null; } };
const setPending = v => { try { v ? sessionStorage.setItem(PENDING, JSON.stringify(v)) : sessionStorage.removeItem(PENDING); } catch (_) {} };
const hasCallback = () => location.pathname === REDIRECT_PATH && /(^|[#&])state=/.test(location.hash);
export const mightBeSignedIn = () => { try { return !!localStorage.getItem(SIGNED_IN); } catch (_) { return false; } };
export const isCallback = hasCallback;

// Where to go after signing in: a path on this site, and nothing a browser would read as another one (//host, /\host).
const samePath = to => {
  if (typeof to !== 'string' || !/^\/(?![\/\\])/.test(to) || /[\\\u0000-\u001f]/.test(to)) return null;
  try { const u = new URL(to, location.origin); return u.origin === location.origin ? u.pathname + u.search + u.hash : null; } catch (_) { return null; }
};

/** Finish a sign-in that just came back, or restore the last one: { session, to } or null. */
export async function start(){
  if (!hasCallback() && !mightBeSignedIn()) return null;
  const c = await client();
  let r;
  try { r = await c.init(); }
  catch (e) {
    const p = pending();
    // Refused for asking too much: ask again for the next step down, if there is one.
    if (e?.params?.get?.('error') === 'invalid_scope' && p?.handle && (p.step ?? 0) + 1 < ladder(p.forges).length) { signIn(p.handle, p.to, { forges: p.forges, step: (p.step ?? 0) + 1 }).catch(() => {}); return { redirecting: true }; }
    setPending(null);
    throw e;
  }
  setPending(null);
  if (!r) return null;
  let to = null;
  try { to = r.state ? JSON.parse(r.state).to : null; } catch (_) {}
  return { session: r.session, to: samePath(to), forges: await forgesOf(r.session) };
}
/** The forges this sign-in lets Rainshare post to (see FORGE_SCOPES): what your server granted, not what was asked for. */
export async function forgesOf(session){
  try { return forgesIn((await session.getTokenInfo(false)).scope); } catch (_) { return []; }
}

// `forges` is which forges to ask to post to: all of them unless told otherwise. `step` is
// how far down the ladder to start (after a refusal that came back through the address bar).
export async function signIn(handle, to, { forges = FORGES, step = 0 } = {}){
  const c = await client(), state = JSON.stringify({ to }), steps = ladder(forges);
  for (let i = Math.min(Math.max(0, step), steps.length - 1); ; i++) {
    setPending({ handle, to, forges, step: i });
    try { return await c.signIn(handle, { scope: steps[i], state }); }
    catch (e) { if (e?.error !== 'invalid_scope' || i >= steps.length - 1) throw e; }
  }
}

export async function signOut(session){
  try { await session.signOut(); } catch (_) {}
  try { localStorage.removeItem(SIGNED_IN); } catch (_) {}
}
