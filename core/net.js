// Public reads from the open network: no sign-in, so they work the same from a browser,
// the CLI and the MCP server.
//
//   identity     handle → DID → DID document → PDS
//   records      com.atproto.repo.listRecords / getRecord, straight from each person's PDS
//   who has any  com.atproto.sync.listReposByCollection on a relay: which repos hold a collection
//   the graph    Bluesky's public AppView: relationships, profiles, lists
export const APPVIEW = 'https://public.api.bsky.app';
export const RELAYS = ['https://relay1.us-east.bsky.network', 'https://bsky.network'];
// Constellation (microcosm.blue): an index of which records link to what, across the network.
// It's asked who points at one seed, so nobody's server has to be searched to find out.
export const CONSTELLATION = 'https://constellation.microcosm.blue';
// How long each kind of server is given. A relay that's slow gets company rather than patience:
// after RELAY_HEDGE the next one is asked as well, and whichever answers first is used.
const RELAY_TIMEOUT = 8000, RELAY_HEDGE = 2500, PDS_TIMEOUT = 8000, INDEX_TIMEOUT = 4000;
export const PLC = 'https://plc.directory';

export class NetError extends Error {
  constructor(name, message, status){ super(message || name); this.name = name; this.status = status; }
}

export async function getJSON(url, { timeout = 15000, headers } = {}){
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = ctl && setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { accept: 'application/json', ...headers }, signal: ctl?.signal });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new NetError(body.error || 'HTTP' + r.status, body.message || `${r.status} from ${new URL(url).host}`, r.status);
    }
    return await r.json();
  } catch (e) {
    if (e?.name === 'AbortError') throw new NetError('Timeout', 'No answer from ' + new URL(url).host);
    throw e;
  } finally { if (t) clearTimeout(t); }
}
const q = params => new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').flatMap(([k, v]) => Array.isArray(v) ? v.map(x => [k, x]) : [[k, v]])).toString();
export const xrpc = (base, nsid, params = {}, opts) => getJSON(`${base.replace(/\/+$/, '')}/xrpc/${nsid}?${q(params)}`, opts);

/* ---------- identity ---------- */
const docs = new Map(), handles = new Map();
export function didDoc(did){
  if (!docs.has(did)) {
    const p = did.startsWith('did:plc:') ? getJSON(`${PLC}/${did}`)
      // atproto's did:web is a bare host name (a port only for development), never a path.
      : /^did:web:[a-z0-9.-]+(%3a\d{1,5})?$/i.test(did) ? getJSON(`https://${did.slice(8).replace(/%3a/i, ':')}/.well-known/did.json`)
      : Promise.reject(new NetError('BadDid', 'Unsupported DID: ' + did));
    docs.set(did, p); p.catch(() => docs.delete(did));
  }
  return docs.get(did);
}
// A PDS is reached over https; plain http only for one running on this machine (development).
const pdsUrl = raw => {
  try {
    const u = new URL(String(raw));
    if (u.protocol === 'https:' || (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname))) return u.origin;
  } catch (_) { /* not a URL */ }
  return null;
};
export async function pdsOf(did){
  const doc = await didDoc(did);
  const s = (doc?.service || []).find(x => x.id === '#atproto_pds' || x.id === did + '#atproto_pds');
  const pds = s?.serviceEndpoint && pdsUrl(s.serviceEndpoint);
  if (!pds) throw new NetError('NoPds', 'No server listed for ' + did);
  return pds;
}
/** A handle as atproto allows it: a domain name. Anything else (it comes from a DID document anyone can write) is ignored. */
export const isHandle = s => /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(String(s || '')) && String(s).length <= 253;
export async function handleOf(did){
  const aka = (await didDoc(did).catch(() => null))?.alsoKnownAs;
  const h = Array.isArray(aka) ? aka.find(a => typeof a === 'string' && a.startsWith('at://'))?.slice(5) : null;
  return isHandle(h) ? h.toLowerCase() : null;
}
export const isDid = s => /^did:(plc|web):[A-Za-z0-9._:%-]+$/.test(String(s || ''));
/** An at:// URI whose parts are all what atproto allows, so it's safe to put in a link or a command. */
export const safeAtUri = u => { const p = parseUri(u); return p && /^did:[a-z]+:[A-Za-z0-9._:%-]+$/.test(p.repo) && /^[a-zA-Z][a-zA-Z0-9.-]*$/.test(p.collection) && isRkey(p.rkey) ? String(u) : null; };
export const normalizeHandle = raw => String(raw || '').trim().replace(/^@/, '').toLowerCase();
export async function resolveHandle(raw){
  const h = normalizeHandle(raw);
  if (isDid(h)) return h;
  if (!handles.has(h)) {
    const p = xrpc(APPVIEW, 'com.atproto.identity.resolveHandle', { handle: h }).then(r => r.did);
    handles.set(h, p); p.catch(() => handles.delete(h));
  }
  return handles.get(h);
}

/* ---------- records ---------- */
export const parseUri = uri => {
  const m = String(uri || '').match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  return m ? { repo: m[1], collection: m[2], rkey: m[3] } : null;
};
export const recordUri = (repo, collection, rkey) => `at://${repo}/${collection}/${rkey}`;
/** A record key as atproto allows it. Keys end up in links, file names and shell commands, so nothing else gets through. */
export const isRkey = s => /^[A-Za-z0-9._:~-]{1,512}$/.test(String(s ?? '')) && s !== '.' && s !== '..';

// Whatever a PDS answers is taken only as far as it agrees with what was asked: a record's
// address is rebuilt from the account, collection and key, never copied from the answer, and
// a record that claims to be somewhere else is left out.
const valueOf = r => r && typeof r.value === 'object' && r.value !== null && !Array.isArray(r.value) ? r.value : null;
export async function listRecords(did, collection, { limit = 100, pages = 3 } = {}){
  if (!isDid(did)) throw new NetError('BadDid', 'Not a DID: ' + did);
  const pds = await pdsOf(did), out = [];
  let cursor;
  for (let i = 0; i < pages; i++) {
    const r = await xrpc(pds, 'com.atproto.repo.listRecords', { repo: did, collection, limit, cursor }, { timeout: PDS_TIMEOUT });
    out.push(...(Array.isArray(r.records) ? r.records : []));
    cursor = r.cursor;
    if (!cursor || (r.records || []).length < limit) break;
  }
  return out.flatMap(r => {
    const at = parseUri(r?.uri);
    if (!at || at.repo !== did || at.collection !== collection || !isRkey(at.rkey) || !valueOf(r)) return [];
    return [{ uri: recordUri(did, collection, at.rkey), cid: typeof r.cid === 'string' ? r.cid : null, repo: did, collection, rkey: at.rkey, value: r.value }];
  });
}
export async function getRecord(did, collection, rkey){
  if (!isDid(did) || !isRkey(rkey)) throw new NetError('RecordNotFound', 'No such record', 400);
  const pds = await pdsOf(did);
  const r = await xrpc(pds, 'com.atproto.repo.getRecord', { repo: did, collection, rkey }, { timeout: PDS_TIMEOUT });
  const at = parseUri(r?.uri);
  if ((at && (at.repo !== did || at.collection !== collection || at.rkey !== rkey)) || !valueOf(r)) throw new NetError('RecordNotFound', 'No such record', 404);
  return { uri: recordUri(did, collection, rkey), cid: typeof r.cid === 'string' ? r.cid : null, repo: did, collection, rkey, value: r.value };
}
export async function getRecordOrNull(did, collection, rkey){
  try { return await getRecord(did, collection, rkey); }
  catch (e) { if (e.status === 400 || e.status === 404 || e.name === 'RecordNotFound') return null; throw e; }
}

// The first answer, of several ways to ask the same thing. The next way is started when the
// one before it fails, or hasn't answered after `wait` ms; it fails only if they all do.
export function firstOf(ways, wait){
  return new Promise((resolve, reject) => {
    let i = 0, pending = 0, done = false, last, timer;
    const start = () => {
      clearTimeout(timer);
      if (done || i >= ways.length) return;
      const way = ways[i++]; pending++;
      Promise.resolve().then(way).then(
        v => { if (!done) { done = true; clearTimeout(timer); resolve(v); } },
        e => { last = e; pending--; if (done) return; if (i < ways.length) start(); else if (!pending) { done = true; reject(last); } });
      if (i < ways.length) timer = setTimeout(start, wait);
    };
    start();
  });
}
/** Every repo the network has seen with a record in `collection`. */
export function reposWith(collection, { max = 2000 } = {}){
  const from = async relay => {
    const out = [];
    let cursor;
    do {
      const r = await xrpc(relay, 'com.atproto.sync.listReposByCollection', { collection, limit: 500, cursor }, { timeout: RELAY_TIMEOUT });
      out.push(...(Array.isArray(r.repos) ? r.repos : []).map(x => x?.did).filter(isDid));
      cursor = r.cursor;
    } while (cursor && out.length < max);
    return [...new Set(out)];
  };
  return firstOf(RELAYS.map(relay => () => from(relay)), RELAY_HEDGE);
}
/**
 * Which records of `collection` point at `subject` from the field at `path` ("seed.uri"), as
 * [{ repo, rkey }]: Constellation's answer. It says where to look, not what's there: each
 * record is still read from its owner's own server, and one that doesn't point back is dropped.
 */
export async function backlinks(subject, collection, path, { max = 300 } = {}){
  const out = [];
  let cursor;
  do {
    const r = await xrpc(CONSTELLATION, 'blue.microcosm.links.getBacklinks', { subject, source: `${collection}:${path}`, limit: 100, cursor }, { timeout: INDEX_TIMEOUT });
    if (!Array.isArray(r?.records)) throw new NetError('BadAnswer', 'No list from ' + new URL(CONSTELLATION).host);
    for (const x of r.records) if (isDid(x?.did) && x.collection === collection && isRkey(x.rkey)) out.push({ repo: x.did, rkey: x.rkey });
    cursor = typeof r.cursor === 'string' && r.records.length ? r.cursor : null;
  } while (cursor && out.length < max);
  return [...new Map(out.map(x => [x.repo + ' ' + x.rkey, x])).values()];
}

/* ---------- the social graph (Bluesky) ---------- */
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/**
 * How `actor` and each of `others` are connected: following (actor follows them) and
 * followedBy (they follow actor), as a Map by DID.
 */
export async function relationships(actor, others){
  const out = new Map(), dids = [...new Set(others.filter(d => d && d !== actor && isDid(d)))];
  // A few calls at a time: a long list of people (everyone you follow) is dozens of them.
  await pool(chunk(dids, 30), 6, async part => {
    const r = await xrpc(APPVIEW, 'app.bsky.graph.getRelationships', { actor, others: part });
    for (const x of r.relationships || []) if (x.did) out.set(x.did, { following: !!x.following, followedBy: !!x.followedBy, blocking: !!(x.blocking || x.blockingByList), blockedBy: !!x.blockedBy });
  });
  return out;
}

const people = new Map();
/** Bluesky profiles (name, handle, avatar, bio), falling back to the handle from the DID document. */
export async function profiles(dids){
  const todo = [...new Set(dids)].filter(d => isDid(d) && !people.has(d));
  await Promise.all(chunk(todo, 25).map(async part => {
    try {
      const r = await xrpc(APPVIEW, 'app.bsky.actor.getProfiles', { actors: part });
      for (const p of r.profiles || []) if (isDid(p?.did)) people.set(p.did, { did: p.did, handle: isHandle(p.handle) ? p.handle : null, displayName: typeof p.displayName === 'string' ? p.displayName : '', avatar: /^https:\/\//.test(p.avatar || '') ? p.avatar : null, description: typeof p.description === 'string' ? p.description.slice(0, 600) : '' });
    } catch (_) { /* fall through to the DID documents */ }
    await Promise.all(part.filter(d => !people.has(d)).map(async d => people.set(d, { did: d, handle: await handleOf(d).catch(() => null), displayName: '', avatar: null })));
  }));
  return new Map([...new Set(dids)].map(d => [d, people.get(d) || { did: d }]));
}
export const knownPerson = did => people.get(did) || null;
export const rememberPerson = p => { if (p?.did) people.set(p.did, { ...people.get(p.did), ...p }); };

const lists = new Map();
/** The DIDs on a Bluesky list. */
export function listMembers(uri){
  if (!lists.has(uri)) {
    const p = (async () => {
      const out = new Set();
      let cursor;
      for (let i = 0; i < 10; i++) {
        const r = await xrpc(APPVIEW, 'app.bsky.graph.getList', { list: uri, limit: 100, cursor });
        (r.items || []).forEach(it => { if (isDid(it.subject?.did)) out.add(it.subject.did); });
        cursor = r.cursor; if (!cursor) break;
      }
      return out;
    })();
    lists.set(uri, p); p.catch(() => lists.delete(uri));
  }
  return lists.get(uri);
}
/** How many people someone follows and is followed by on Bluesky, for "who could see it". */
export async function counts(did){
  const p = await xrpc(APPVIEW, 'app.bsky.actor.getProfile', { actor: did });
  return { following: p.followsCount ?? null, followers: p.followersCount ?? null };
}
/**
 * Who `did` follows on Bluesky, the most recently followed first: { dids, partial }. It stops
 * at `max`, and `partial` says there were more.
 */
export async function followsOf(did, { max = 1000 } = {}){
  const follows = [];
  let cursor;
  do {
    const r = await xrpc(APPVIEW, 'app.bsky.graph.getFollows', { actor: did, limit: 100, cursor });
    follows.push(...(r.follows || []).map(f => f?.did).filter(isDid));
    cursor = r.cursor;
  } while (cursor && follows.length < max);
  return { dids: [...new Set(follows)].slice(0, max), partial: !!cursor || follows.length > max };
}
/**
 * How many of the people `did` follows follow them back. It reads the whole follow list, so
 * it gives up (null) past `max` follows rather than make hundreds of calls.
 */
export async function mutualCount(did, { max = 600 } = {}){
  const { dids, partial } = await followsOf(did, { max });
  if (partial) return null;
  const rel = await relationships(did, dids);
  return [...rel.values()].filter(r => r.following && r.followedBy).length;
}
/** Someone's own Bluesky lists, for picking who a seed is for. */
export async function listsOf(did){
  const r = await xrpc(APPVIEW, 'app.bsky.graph.getLists', { actor: did, limit: 50 });
  return (r.lists || []).filter(l => /curatelist$/.test(l.purpose || '')).map(l => ({ uri: l.uri, name: l.name, count: l.listItemCount || 0 }));
}
/** Who someone blocks on Bluesky (public records in their own repo). */
export async function blocksOf(did){
  const recs = await listRecords(did, 'app.bsky.graph.block', { pages: 5 }).catch(() => []);
  return new Set(recs.map(r => r.value?.subject).filter(Boolean));
}

/** Run `fn` over `items`, a few at a time. */
export async function pool(items, n, fn){
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}
