// Finding where an account signs in (whereTo in ./oauth.js) asks three or four servers in
// turn: one for the handle, the PLC directory for the account, and the account's own server,
// twice. Any of them can be slow or out for a moment. What's here tells that apart from an
// account that isn't there, and stops a wait from going on for ever. Plain, so the tests can
// read it.

import { isDid } from '../core/net.js';

/**
 * Looking up which account a handle is, at `service` (bsky.social's resolveHandle), for the
 * sign-in library in place of its own. Its own knows one way of saying a handle isn't
 * anyone's, "InvalidRequest"; bsky.social now says "HandleNotFound" for its own handles, which
 * the library would take for a server out of order. Both mean nobody (null). A server that
 * doesn't answer, or answers with anything else, throws: that's a moment's trouble.
 */
export function handleLookup(service, fetchFn = (...a) => globalThis.fetch(...a)){
  return {
    async resolve(handle, options){
      const url = new URL('/xrpc/com.atproto.identity.resolveHandle', service);
      url.searchParams.set('handle', handle);
      const r = await fetchFn(url, { signal: options?.signal, cache: options?.noCache ? 'no-cache' : undefined, redirect: 'error' });
      const body = await r.json().catch(() => null);
      if (r.status === 400 && (body?.error === 'HandleNotFound' || /^unable to resolve handle/i.test(body?.message || ''))) return null;
      if (r.ok && isDid(body?.did)) return body.did;
      throw Object.assign(new Error(`Couldn't look up ${handle} at ${url.host} (${r.status})`), { name: 'HandleLookupError' });
    }
  };
}

// The errors the sign-in library gives as causes, by their shape: their class names don't
// survive being bundled. Walks the chain of causes, a few deep.
const causes = e => { const out = []; for (let x = e; x && out.length < 8; x = x.cause) out.push(x); return out; };
const didError = x => typeof x?.did === 'string' && typeof x?.code === 'string' && x.code.startsWith('did-');

/**
 * Whether resolving `who` failed because there's no such account: a handle that isn't one, or
 * that nothing answers to, or whose account doesn't list it; or a DID the directory doesn't
 * have. Anything else (a server that didn't answer, or answered with something unexpected) is
 * a moment's trouble, and false.
 */
export function noSuchAccount(e){
  return causes(e).some(x => x?.name === 'IdentityResolverError'
    || (didError(x) && (x.status === 404 || x.code === 'did-invalid' || x.code === 'did-method-invalid')));
}

/** `p`, or a TimeoutError if it hasn't settled in `ms`. (What it was waiting for goes on.) */
export function within(p, ms){
  return new Promise((ok, no) => {
    const t = setTimeout(() => no(Object.assign(new Error(`No answer in ${ms / 1000} seconds`), { name: 'TimeoutError' })), ms);
    Promise.resolve(p).then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); no(e); });
  });
}
