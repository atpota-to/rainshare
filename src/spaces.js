// Private sidequests: the spaces alpha, from the browser, as the signed-in person.
//
//   reading   delegation token from your own PDS → space credential from the group's
//             host → each writer's records from their own PDS, every request signed
//             (RFC 9421) by a fresh P-256 key the credential is bound to
//   writing   your own records into a group's space, on your own PDS
//   host      the group host's methods (your groups, a group's spaces, adding Rainshare
//             to one), with service auth your PDS mints
//
// Spaces are an alpha and the network is mid-change: opensocial.fyi still speaks the
// first wire format (`Atproto-Space`, a signature labelled `atproto-space`), while
// Bluesky's spaces-alpha PDS speaks the newer one from proposal 0016
// (`Atproto-Space-Credential`, a `tag`ged signature, the key named in the body). Each
// server's format is learned on first contact and remembered, so either works.
import { HOST, AUD, NS } from './scope.js';
import { pdsOf } from '../core/net.js';

/** An error with a name the screens can say something plain about. */
export class SpaceError extends Error {
  constructor(name, message, detail){ super(message || name); this.name = name; this.detail = detail; }
}
async function failure(res, fallback){
  const body = await res.json().catch(() => ({}));
  return new SpaceError(body.error || fallback || 'HTTP' + res.status, body.message || `${fallback || 'Request'} failed (${res.status})`, body);
}

/* ---------- signing keys and space signatures ---------- */
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes){
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) { carry += digits[i] << 8; digits[i] = carry % 58; carry = (carry / 58) | 0; }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = '';
  for (const byte of bytes) { if (byte) break; out += '1'; }
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const utf8 = s => new TextEncoder().encode(s);

// A fresh, non-extractable P-256 key, named by its did:key (compressed point behind the
// p256-pub multicodec, 0x80 0x24).
async function newKey(){
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const point = [raw[64] & 1 ? 3 : 2, ...raw.subarray(1, 33)];
  const did = 'did:key:z' + base58(new Uint8Array([0x80, 0x24, ...point]));
  const sign = async data => new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, data));
  return { pair, did, sign };
}

// The two wire formats, by what each server answers to.
const OLD = 'atproto-space', NEW = 'atproto-space-credential';
const dialects = new Map([[new URL(HOST).origin, OLD]]);
const SCHEME = { [OLD]: 'Atproto-Space', [NEW]: 'Atproto-Space-Credential' };

async function useHeaders(key, credential, audience, dialect){
  const authorization = `${SCHEME[dialect]} ${credential}`;
  const params = '("authorization" "atproto-space-audience")' + (dialect === NEW ? `;tag="${NEW}"` : '');
  const base = [`"authorization": ${authorization}`, `"atproto-space-audience": ${audience}`, `"@signature-params": ${params}`].join('\n');
  return {
    authorization, 'atproto-space-audience': audience,
    'signature-input': `${dialect}=${params}`,
    signature: `${dialect}=:${b64(await key.sign(utf8(base)))}:`
  };
}
// The exchange is sent in both shapes at once: the first format reads the delegation
// token from `Authorization` and the key from a signature over it; the newer one reads
// both from the body. Each ignores the other's half.
async function exchangeHeaders(key, token){
  const authorization = `Bearer ${token}`, params = `("authorization");keyid="${key.did}"`;
  const base = `"authorization": ${authorization}\n"@signature-params": ${params}`;
  return { authorization, 'signature-input': `${OLD}=${params}`, signature: `${OLD}=:${b64(await key.sign(utf8(base)))}:` };
}
const wrongDialect = body => /unsupported authorization type|missing space credential|malformed .*signature|signature tag/i.test(`${body.error} ${body.message}`);

/* ---------- reading a space ---------- */
export const authorityOf = space => (space.match(/^at:\/\/(did:[^/]+)\/space\//) || [])[1] || '';
export const recordUri = (space, repo, collection, rkey) => `${space}/${repo}/${collection}/${rkey}`;

const creds = new Map();
const LEEWAY = 30;
const expOf = jwt => { try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp; } catch (_) { return 0; } };

// Delegation token from your own PDS, then a credential from the space's authority.
async function mint(session, space){
  const r = await session.fetchHandler('/xrpc/com.atproto.space.getDelegationToken?space=' + encodeURIComponent(space));
  if (!r.ok) {
    const e = await failure(r, 'DelegationRefused');
    if (r.status === 404 || r.status === 501 || /MethodNotImplemented|XRPCNotSupported|NotImplemented/.test(e.name)) throw new SpaceError('NoSpaces', 'Your account’s server doesn’t do spaces yet', e.detail);
    throw e;
  }
  const { token } = await r.json();
  const authority = authorityOf(space);
  const [key, pds] = await Promise.all([newKey(), pdsOf(authority)]);
  const res = await fetch(pds + '/xrpc/com.atproto.space.getSpaceCredential', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...(await exchangeHeaders(key, token)) },
    body: JSON.stringify({ space, credentialKid: key.did, delegationToken: token })
  });
  if (!res.ok) {
    const e = await failure(res, 'CredentialRefused');
    if (e.name === 'UserNotAuthorized' || e.name === 'NotAuthorized') throw new SpaceError('NotMember', 'Only members can open this', e.detail);
    if (e.name === 'BadJwtAudience') throw new SpaceError('VersionSkew', 'Your account’s server and the group’s host are on different versions of the spaces alpha', e.detail);
    throw e;
  }
  const { credential } = await res.json();
  return { key, credential, exp: expOf(credential), authority };
}

function credentialFor(session, space){
  const id = session.did + ' ' + space;
  let held = creds.get(id);
  if (!held) {
    held = mint(session, space);
    creds.set(id, held);
    held.catch(() => { if (creds.get(id) === held) creds.delete(id); });
  }
  return held.then(async c => {
    if (c.exp - LEEWAY > Date.now() / 1000) return c;
    creds.delete(id); return credentialFor(session, space);
  });
}
/** Drop every held credential, for when someone signs out. */
export const forgetCredentials = () => creds.clear();

// A request signed with the credential, addressed to the repo it reads (or, for the
// space host, the authority), in whichever format that server speaks.
// The first request to a server learns its format; others to it wait for that answer
// rather than each guessing (a group's members are often all on one PDS).
const probing = new Map();
async function spaceFetch(session, space, url){
  const origin = new URL(url).origin;
  if (dialects.has(origin)) return negotiate(session, space, url);
  if (probing.has(origin)) { await probing.get(origin); return negotiate(session, space, url); }
  const p = negotiate(session, space, url);
  probing.set(origin, p.catch(() => {}));
  try { return await p; } finally { probing.delete(origin); }
}
async function negotiate(session, space, url){
  const origin = new URL(url).origin, audience = new URL(url).searchParams.get('repo') || authorityOf(space);
  const send = async (c, d) => fetch(url, { headers: { accept: 'application/json', ...(await useHeaders(c.key, c.credential, audience, d)) } });
  const bodyOf = r => r.clone().json().catch(() => ({}));
  let c = await credentialFor(session, space);
  const known = dialects.get(origin), first = known || NEW;
  let res = await send(c, first);
  if (res.ok) { dialects.set(origin, first); return res; }
  // A server that doesn't know the scheme says so with a 400 (a PDS) or a 401 (a host).
  if ((res.status === 400 || res.status === 401) && (wrongDialect(await bodyOf(res)) || (!known && res.status === 401))) {
    const other = first === NEW ? OLD : NEW, alt = await send(c, other);
    if (alt.ok) { dialects.set(origin, other); return alt; }
    // The other format was understood, so its answer is the real one.
    if (!wrongDialect(await bodyOf(alt))) { dialects.set(origin, other); res = alt; }
  }
  if (res.status !== 401) return res;
  // Not the format: the credential, then. Mint once more through the session.
  creds.delete(session.did + ' ' + space);
  c = await credentialFor(session, space);
  return send(c, dialects.get(origin) || first);
}

/** Who has written into a space: the writer set, from the space host. */
export async function writers(session, space){
  const res = await spaceFetch(session, space, `${await pdsOf(authorityOf(space))}/xrpc/com.atproto.space.listRepos?space=${encodeURIComponent(space)}&limit=100`);
  if (!res.ok) throw await failure(res, 'ListReposFailed');
  return ((await res.json()).repos || []).map(r => r.did);
}

/** Every record of these collections in a space, across every writer, each from its own PDS. */
export async function readSpace(session, space, collections, { repos } = {}){
  const who = repos || await writers(session, space);
  const out = [];
  await Promise.all(who.map(async repo => {
    const pds = await pdsOf(repo).catch(() => null); if (!pds) return;
    await Promise.all(collections.map(async collection => {
      const q = new URLSearchParams({ space, repo, collection, limit: '100' });
      const res = await spaceFetch(session, space, `${pds}/xrpc/com.atproto.space.listRecords?${q}`).catch(() => null);
      if (!res || !res.ok) return;
      for (const r of (await res.json()).records || []) out.push({ repo, collection, rkey: r.rkey, cid: r.cid, value: r.value, uri: recordUri(space, repo, collection, r.rkey) });
    }));
  }));
  return { writers: who, records: out };
}

/* ---------- your own records in a group's space (on your own PDS) ---------- */
async function own(session, method, body){
  const r = await session.fetchHandler('/xrpc/com.atproto.space.' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) {
    const e = await failure(r, method + 'Failed');
    if (r.status === 404 || r.status === 501) throw new SpaceError('NoSpaces', 'Your account’s server doesn’t do spaces yet', e.detail);
    throw e;
  }
  return r.json().catch(() => ({}));
}
export const putOwn = (session, space, collection, rkey, record) => own(session, 'putRecord', { space, repo: session.did, collection, rkey, validate: false, record: { $type: collection, ...record } });
export const createOwn = (session, space, collection, record) => own(session, 'createRecord', { space, repo: session.did, collection, validate: false, record: { $type: collection, ...record } });
export const deleteOwn = (session, space, collection, rkey) => own(session, 'deleteRecord', { space, repo: session.did, collection, rkey });

/* ---------- the group host's methods ---------- */
async function serviceAuth(session, lxm){
  const r = await session.fetchHandler(`/xrpc/com.atproto.server.getServiceAuth?aud=${encodeURIComponent(AUD)}&lxm=${encodeURIComponent(lxm)}`);
  if (!r.ok) throw await failure(r, 'ServiceAuthRefused');
  return (await r.json()).token;
}
/** A host method, as the signed-in person. */
export async function callHost(session, method, { body, params } = {}){
  const lxm = `${NS}.${method}`, url = new URL(`${HOST}/xrpc/${lxm}`);
  for (const [k, v] of Object.entries(params || {})) if (v != null) url.searchParams.set(k, v);
  const headers = { accept: 'application/json' };
  if (session) headers.authorization = 'Bearer ' + await serviceAuth(session, lxm);
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(url, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw await failure(res, method + 'Failed');
  return res.json().catch(() => ({}));
}
