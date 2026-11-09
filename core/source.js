// Rainshare over atproto: the board, a sidequest, profiles, and the writes, for whoever is
// signed in (or nobody). The same code runs in the browser (an OAuth session) and in the
// CLI and MCP server (an app password session): both hand in an `agent` with the person's
// DID and a fetchHandler that reaches their own PDS.
//
//   public    records in each person's repo. Which repos have any comes from a relay
//             (listReposByCollection); the records come from each person's own PDS; who
//             they're for is checked against the Bluesky graph (getRelationships, lists).
//   private   records in a group's Rainshare space, through `spaces` and `groups`, which
//             the browser host supplies (src/live/atp.js and the group host). Members only.
import { PROFILE, SIDEQUEST, TAKE, DELIVERY } from './ns.js';
import * as net from './net.js';
import * as R from './records.js';
import { closeness, meantFor } from './circle.js';
import { completeTangled, tangledRepos, tangledIssues } from './subjects.js';

const TTL = 60e3;
/** A record URI inside a space: the space, then repo/collection/rkey. */
export function splitSpaceUri(uri){
  const m = String(uri || '').match(/^(at:\/\/.+)\/(did:[^/]+)\/([^/]+)\/([^/]+)$/);
  return m && /\/space\//.test(m[1]) ? { space: m[1], repo: m[2], collection: m[3], rkey: m[4] } : null;
}

export class SourceError extends Error {
  constructor(name, message){ super(message || name); this.name = name; }
}
async function failure(res, what){
  const body = await res.json().catch(() => ({}));
  const name = body.error || 'HTTP' + res.status;
  if (/ScopeMissing|InsufficientScope|invalid_scope/i.test(name + ' ' + body.message)) return new SourceError('ScopeMissingError', 'Your sign-in is from before Rainshare needed this. Sign out and in again.');
  return new SourceError(name, body.message || `${what} failed (${res.status})`);
}

export function createSource({ agent = null, spaces = null, groups = null } = {}){
  const viewer = agent?.did || null;
  const cache = new Map();
  const memo = (key, fn, ttl = TTL) => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.p;
    const p = fn(); cache.set(key, { p, at: Date.now() });
    p.catch(() => { if (cache.get(key)?.p === p) cache.delete(key); });
    return p;
  };
  const forget = (...keys) => keys.length ? keys.forEach(k => cache.delete(k)) : cache.clear();

  /* ---------- writing to your own repo ---------- */
  async function repoCall(method, body){
    if (!agent) throw new SourceError('NotSignedIn', 'Sign in first.');
    const r = await agent.fetchHandler('/xrpc/com.atproto.repo.' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw await failure(r, method);
    return r.json().catch(() => ({}));
  }
  const create = (collection, record) => repoCall('createRecord', { repo: viewer, collection, record, validate: false });
  const put = (collection, rkey, record) => repoCall('putRecord', { repo: viewer, collection, rkey, record, validate: false });
  const del = (collection, rkey) => repoCall('deleteRecord', { repo: viewer, collection, rkey });
  // The same three, wherever the record lives: your repo, or your repo in a group's space.
  const into = space => space ? {
    create: async (c, rec) => { const r = await spaces.create(space, c, rec); return { uri: r?.uri || null, cid: r?.cid || null }; },
    put: (c, k, rec) => spaces.put(space, c, k, rec),
    del: (c, k) => spaces.del(space, c, k)
  } : { create, put, del };

  /* ---------- reading ---------- */
  // What you've just written or deleted. A relay can take a moment to list a repo that has
  // only just got its first record of a kind, so your own writes are layered over what the
  // network says until it catches up.
  const recent = new Map(), gone = new Set();
  const remember = (collection, rec) => { if (rec.uri) { gone.delete(rec.uri); recent.set(rec.uri, { collection, ...rec }); } };
  const forgetRecord = uri => { recent.delete(uri); gone.add(uri); };
  // Every public record of a collection, across everyone who has any.
  const everyone = collection => memo('all:' + collection, async () => {
    const dids = await net.reposWith(collection);
    const lists = await net.pool(dids, 6, d => net.listRecords(d, collection, { pages: 2 }).catch(() => []));
    return lists.flat();
  }).then(list => {
    const seen = new Set(list.map(r => r.uri));
    const mine = [...recent.values()].filter(r => r.collection === collection && !r.space && !seen.has(r.uri));
    return [...list.map(r => recent.get(r.uri)?.collection === collection && recent.get(r.uri).cid !== r.cid ? { ...r, ...recent.get(r.uri) } : r), ...mine].filter(r => !gone.has(r.uri));
  });
  const people = dids => net.profiles(dids);
  const publicProfile = did => memo('profile:' + did, () => net.getRecordOrNull(did, PROFILE, 'self'));

  // Your groups that have Rainshare, and what's in each one's space.
  const myGroups = () => memo('groups', async () => {
    if (!viewer || !groups) return [];
    const gs = await groups.mine();
    return Promise.all(gs.map(async g => ({ ...g, ...(await groups.board(g.did).catch(e => ({ space: null, error: e }))) })));
  });
  const groupRecords = g => memo('space:' + g.space, async () => {
    const { records } = await spaces.read(g.space, [SIDEQUEST, TAKE, DELIVERY, PROFILE]);
    return records;
  }, 20e3);

  function attach(items, takes, deliveries){
    const by = (list, uri) => list.filter(r => r.value?.sidequest?.uri === uri);
    for (const it of items) { it.takes = by(takes, it.uri); it.deliveries = by(deliveries, it.uri); }
    return items;
  }
  async function named(items){
    const dids = [...new Set(items.flatMap(it => [it.repo, ...(it.takes || []).map(t => t.repo), ...(it.deliveries || []).map(d => d.repo)]))];
    const who = await people(dids);
    for (const it of items) {
      it.author = who.get(it.repo) || { did: it.repo };
      for (const r of [...(it.takes || []), ...(it.deliveries || [])]) r.author = who.get(r.repo) || { did: r.repo };
    }
    return items;
  }

  /**
   * Everything the viewer can see and is meant for, public and private, newest first.
   * { items, notes }: notes are plain sentences about what couldn't be read.
   */
  async function board({ force } = {}){
    if (force) forget();
    const notes = [];
    const [sqs, takes, deliveries] = await Promise.all([everyone(SIDEQUEST), everyone(TAKE).catch(() => []), everyone(DELIVERY).catch(() => [])])
      .catch(e => { notes.push('The network didn’t answer, so public sidequests are missing. Try again in a moment.'); console.warn(e); return [[], [], []]; });
    const authors = [...new Set(sqs.map(r => r.repo))];
    let rels = new Map(), blocked = new Set();
    if (viewer) {
      [rels, blocked] = await Promise.all([
        net.relationships(viewer, authors).catch(() => { notes.push('Bluesky didn’t say who you follow, so only sidequests open to everyone are showing.'); return new Map(); }),
        net.blocksOf(viewer).catch(() => new Set())
      ]);
    }
    const visible = [];
    for (const r of sqs) {
      if (blocked.has(r.repo)) continue;
      const rel = rels.get(r.repo), aud = r.value?.audience?.$type || '';
      const inList = aud.endsWith('#list') && viewer ? (await net.listMembers(r.value.audience.list).catch(() => new Set())).has(viewer) : false;
      if (!meantFor(r.value, { viewer, author: r.repo, rel, inList })) continue;
      visible.push({ ...r, space: null, group: null, closeness: closeness({ viewer, author: r.repo, rel }), rel });
    }
    attach(visible, takes, deliveries);
    await Promise.all([...new Set(visible.map(v => v.repo))].map(async d => {
      const p = await publicProfile(d).catch(() => null);
      visible.filter(v => v.repo === d).forEach(v => { v.profile = p?.value || null; });
    }));

    // Private: each of your groups with a Rainshare space.
    const gs = await myGroups().catch(e => { notes.push('Your groups didn’t load.'); console.warn(e); return []; });
    for (const g of gs.filter(g => g.space)) {
      try {
        const fetched = await groupRecords(g), have = new Set(fetched.map(r => r.uri));
        const recs = [...fetched, ...[...recent.values()].filter(r => r.space === g.space && !have.has(r.uri))].filter(r => !gone.has(r.uri));
        const of = c => recs.filter(r => r.collection === c);
        const profs = new Map(of(PROFILE).filter(r => r.rkey === 'self').map(r => [r.repo, r.value]));
        const items = of(SIDEQUEST).map(r => ({ uri: r.uri, cid: r.cid, repo: r.repo, rkey: r.rkey, value: r.value, space: g.space, group: g, closeness: closeness({ viewer, author: r.repo, group: true }) }));
        attach(items, of(TAKE), of(DELIVERY));
        for (const it of items) it.profile = profs.get(it.repo) || null;
        // A group copy of someone's profile is fuller than their public one, so it wins everywhere.
        for (const v of visible) if (profs.has(v.repo)) v.profile = { ...(v.profile || {}), ...profs.get(v.repo) };
        visible.push(...items);
      } catch (e) {
        notes.push(e.name === 'NoSpaces' ? `Your account’s server doesn’t support private spaces yet, so ${g.name}’s private sidequests stay closed to you.` : `${g.name}’s private sidequests didn’t load.`);
        console.warn(e);
      }
    }
    await named(visible);
    visible.sort((a, b) => String(b.value?.createdAt).localeCompare(String(a.value?.createdAt)));
    return { items: visible, notes };
  }

  /** One sidequest by its URI, with its takes, deliveries and author. Null if it's gone. */
  async function sidequest(uri, { force } = {}){
    if (force) forget('all:' + TAKE, 'all:' + DELIVERY);
    const inSpace = splitSpaceUri(uri);
    if (inSpace) {
      const g = (await myGroups()).find(x => x.space === inSpace.space);
      if (!g) return null;
      if (force) forget('space:' + g.space);
      const { items } = await board();
      return items.find(i => i.uri === uri) || null;
    }
    const p = net.parseUri(uri);
    if (!p || p.collection !== SIDEQUEST) return null;
    const rec = await net.getRecordOrNull(p.repo, SIDEQUEST, p.rkey);
    if (!rec) return null;
    const [takes, deliveries, prof] = await Promise.all([everyone(TAKE).catch(() => []), everyone(DELIVERY).catch(() => []), publicProfile(p.repo).catch(() => null)]);
    const rel = viewer && viewer !== p.repo ? (await net.relationships(viewer, [p.repo]).catch(() => new Map())).get(p.repo) : null;
    const item = { ...rec, space: null, group: null, rel, closeness: closeness({ viewer, author: p.repo, rel }), profile: prof?.value || null };
    attach([item], takes, deliveries);
    await named([item]);
    return item;
  }

  /** Someone's profile: the public copy, made fuller by any group copy you can read. */
  async function profileOf(did, { force } = {}){
    if (force) forget('profile:' + did);
    const [pub, who] = await Promise.all([publicProfile(did).catch(() => null), people([did])]);
    let full = null, inGroups = [];
    for (const g of (await myGroups().catch(() => [])).filter(g => g.space)) {
      const rec = (await groupRecords(g).catch(() => [])).find(r => r.collection === PROFILE && r.repo === did && r.rkey === 'self');
      if (rec) { full = { ...(full || {}), ...rec.value }; inGroups.push(g); }
    }
    const merged = pub || full ? { ...(pub?.value || {}), ...(full || {}) } : null;
    const hidden = full ? R.PRIVATE_FIELDS.filter(k => full[k] !== undefined && pub?.value?.[k] === undefined) : [];
    return { person: who.get(did) || { did }, public: pub?.value || null, merged, hidden, groups: inGroups };
  }

  /* ---------- writes ---------- */
  /** Save your profile. `hidden`: fields kept out of the public copy. `share`: group DIDs to give the full copy to. */
  async function saveProfile(input, { hidden = [], share = [] } = {}){
    const now = await profileOf(viewer, { force: true });
    const full = R.profile(input, now.merged);
    await put(PROFILE, 'self', R.publicProfile(full, hidden));
    const gs = (await myGroups()).filter(g => g.space);
    for (const g of gs) {
      if (share.includes(g.did)) await spaces.put(g.space, PROFILE, 'self', full);
      else if (now.groups.some(x => x.did === g.did)) await spaces.del(g.space, PROFILE, 'self').catch(() => {});
      forget('space:' + g.space);
    }
    forget('profile:' + viewer);
    return full;
  }

  async function post(input, { group } = {}){
    const g = group ? (await myGroups()).find(x => x.did === group) : null;
    if (group && !g?.space) throw new SourceError('NoBoard', 'That group doesn’t have Rainshare yet.');
    const subject = input.subject ? await completeTangled(input.subject).catch(() => input.subject) : undefined;
    const record = R.sidequest({ ...input, subject, group: g ? g.did : undefined });
    const r = await into(g?.space).create(SIDEQUEST, record);
    remember(SIDEQUEST, { uri: r.uri, cid: r.cid, repo: viewer, rkey: String(r.uri || '').split('/').pop(), value: record, space: g?.space || null });
    forget('all:' + SIDEQUEST); if (g) forget('space:' + g.space);
    return { uri: r.uri, cid: r.cid, space: g?.space || null };
  }
  async function update(item, input){
    if (item.repo !== viewer) throw new SourceError('NotYours', 'Only the person who asked can change it.');
    const record = R.sidequest({ ...item.value, ...input, group: item.group?.did, subject: input.subject ?? item.value.subject }, item.value);
    if (input.state === 'open') delete record.state;
    const r = await into(item.space).put(SIDEQUEST, item.rkey, record);
    remember(SIDEQUEST, { uri: item.uri, cid: r?.cid || item.cid, repo: viewer, rkey: item.rkey, value: record, space: item.space || null });
    forget('all:' + SIDEQUEST); if (item.space) forget('space:' + item.space);
    return record;
  }
  async function remove(item){
    if (item.repo !== viewer) throw new SourceError('NotYours', 'Only the person who asked can delete it.');
    await into(item.space).del(SIDEQUEST, item.rkey);
    forgetRecord(item.uri);
    forget('all:' + SIDEQUEST); if (item.space) forget('space:' + item.space);
  }
  const mine = list => (list || []).filter(r => r.repo === viewer);
  async function takeOn(item, { setup, note } = {}){
    if (mine(item.takes).length) return mine(item.takes)[0];
    const record = R.take({ sidequest: item, setup, note });
    const r = await into(item.space).create(TAKE, record);
    const rec = { uri: r.uri, cid: r.cid, repo: viewer, rkey: String(r.uri || '').split('/').pop(), value: record, space: item.space || null };
    remember(TAKE, rec);
    forget('all:' + TAKE); if (item.space) forget('space:' + item.space);
    return rec;
  }
  async function drop(item){
    for (const t of mine(item.takes)) { await into(item.space).del(TAKE, t.rkey); forgetRecord(t.uri); }
    forget('all:' + TAKE); if (item.space) forget('space:' + item.space);
  }
  async function turnIn(item, input){
    const record = R.delivery({ ...input, sidequest: item, take: mine(item.takes)[0] });
    const r = await into(item.space).create(DELIVERY, record);
    const rec = { uri: r.uri, cid: r.cid, repo: viewer, rkey: String(r.uri || '').split('/').pop(), value: record, space: item.space || null };
    remember(DELIVERY, rec);
    forget('all:' + DELIVERY); if (item.space) forget('space:' + item.space);
    return rec;
  }

  return {
    viewer, signedIn: !!viewer, canPrivate: !!(spaces && groups),
    board, sidequest, profileOf, saveProfile, post, update, remove, take: takeOn, drop, turnIn,
    forget: () => forget(),
    groups: () => myGroups(),
    addToGroup: async did => { const space = await groups.add(did); forget('groups'); return space; },
    lists: () => viewer ? net.listsOf(viewer) : Promise.resolve([]),
    /** Roughly how many people each audience reaches: { following, followers, mutuals }, any of them null. */
    reach: () => viewer ? memo('reach', async () => {
      const c = await net.counts(viewer);
      const mutuals = c.following != null && c.following <= 600 ? await net.mutualCount(viewer).catch(() => null) : null;
      return { ...c, mutuals };
    }, 300e3) : Promise.resolve(null),
    tangledRepos: () => viewer ? tangledRepos(viewer) : Promise.resolve([]),
    tangledIssues
  };
}
