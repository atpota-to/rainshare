// Signing in to rainshare.dev: ordinary atproto OAuth against your own PDS.
//
//   loopback  in dev, served from 127.0.0.1: the client_id is the config, scope and all
//   hosted    everywhere else: the client_id is /oauth-client-metadata.json on this origin
//
// It asks for everything private seeds need first; a server that doesn't know the
// spaces scopes refuses with invalid_scope, and is asked again for what any server grants.
import { SCOPE, BASIC_SCOPE, DECLARED_SCOPE, REDIRECT_PATH, PLC, withForges, forgesIn } from './scope.js';

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
    if (e?.params?.get?.('error') === 'invalid_scope' && p?.handle && !p.basic) { signIn(p.handle, p.to, { basic: true, forges: p.forges }).catch(() => {}); return { redirecting: true }; }
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

// `forges` adds what posting to those forges needs (knotless, tangled) to what's asked for.
// It's left out of an ordinary sign-in, and passed when someone connects a forge.
export async function signIn(handle, to, { basic, forges = [] } = {}){
  const c = await client();
  const state = JSON.stringify({ to });
  setPending({ handle, to, basic: !!basic, forges });
  if (basic) return c.signIn(handle, { scope: withForges(BASIC_SCOPE, forges), state });
  try { await c.signIn(handle, { scope: withForges(SCOPE, forges), state }); }
  catch (e) {
    if (e?.error !== 'invalid_scope') throw e;
    setPending({ handle, to, basic: true, forges });
    await c.signIn(handle, { scope: withForges(BASIC_SCOPE, forges), state });
  }
}

export async function signOut(session){
  try { await session.signOut(); } catch (_) {}
  try { localStorage.removeItem(SIGNED_IN); } catch (_) {}
}
