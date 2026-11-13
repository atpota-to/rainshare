// Rainshare over atproto: the board, a seed, profiles, and the writes, for whoever is
// signed in (or nobody). The same code runs in the browser (an OAuth session) and in the
// CLI and MCP server (an app password session): both hand in an `agent` with the person's
// DID and a fetchHandler that reaches their own PDS.
//
//   public    records in each person's repo. Which repos have any comes from a relay
//             (listReposByCollection); the records come from each person's own PDS; who
//             they're for is checked against the Bluesky graph (getRelationships, lists).
//   private   records in a group's Rainshare space, through `spaces` and `groups`, which
//             the site supplies (src/spaces.js and the group host). Members only.
import { PROFILE, SEED, TAKE, DELIVERY, COMMENT } from './ns.js';
import * as net from './net.js';
import * as R from './records.js';
import { closeness, meantFor } from './circle.js';
import { completeTangled, tangledRepos, tangledIssues, knotlessRepos, knotlessIssues } from './subjects.js';
import { wateredBy } from './garden.js';
import { forgeIssue, forgeComment, forgePull, pullChoices } from './forgewrite.js';
import { circleOf, vouchFor, unvouch, evidenceFor } from './vouch.js';
import { tangledFollowsOf, followsOnTangled, knownFollowers } from './ties.js';

const TTL = 60e3;
/** A record URI inside a space: the space, then repo/collection/rkey. */
export function splitSpaceUri(uri){
  const m = String(uri || '').match(/^(at:\/\/.+)\/(did:[^/]+)\/([^/]+)\/([^/]+)$/);
  return m && /\/space\//.test(m[1]) ? { space: m[1], repo: m[2], collection: m[3], rkey: m[4] } : null;
}

/**
 * Someone as Rainshare shows them: their Bluesky profile, with the name from their Rainshare
 * profile if it gives one. (Their bio is the Rainshare one if there is one, else Bluesky's; the
 * screens pick between `profile.bio` and `description`.)
 */
export function shown(person, profile){
  const name = typeof profile?.displayName === 'string' ? profile.displayName.replace(/\s+/g, ' ').trim().slice(0, 64) : '';
  return name ? { ...person, displayName: name } : person;
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
  const layered = (collection, list) => {
    const seen = new Set(list.map(r => r.uri));
    const mine = [...recent.values()].filter(r => r.collection === collection && !r.space && !seen.has(r.uri));
    return [...list.map(r => recent.get(r.uri)?.collection === collection && recent.get(r.uri).cid !== r.cid ? { ...r, ...recent.get(r.uri) } : r), ...mine].filter(r => !gone.has(r.uri));
  };
  const everyone = collection => memo('all:' + collection, async () => {
    const dids = await net.reposWith(collection);
    const lists = await net.pool(dids, 6, d => net.listRecords(d, collection, { pages: 2 }).catch(() => []));
    return lists.flat();
  }).then(list => layered(collection, list));
  // The takes, deliveries or comments that point at one seed. Reading everyone's to find them,
  // as the board does for takes and deliveries, asks every server that holds any. For one seed's page, Constellation (an index
  // of who links to what) names just the records that point at it, and each of those is read
  // from its owner's own server. What the board read a moment ago is used if it's there, and if
  // Constellation doesn't answer it's the long way round.
  const warm = key => { const hit = cache.get(key); return !!hit && Date.now() - hit.at < TTL; };
  const pointingAt = (uri, collection) => warm('all:' + collection) ? everyone(collection) : memo(`to:${collection}:${uri}`, async () => {
    const refs = await net.backlinks(uri, collection, 'seed.uri');
    const recs = await net.pool(refs, 6, r => net.getRecordOrNull(r.repo, collection, r.rkey).catch(() => null));
    return recs.filter(r => r?.value?.seed?.uri === uri);
  }).then(list => layered(collection, list), () => everyone(collection));
  const people = dids => net.profiles(dids);
  const publicProfile = did => memo('profile:' + did, () => net.getRecordOrNull(did, PROFILE, 'self'));
  // Who you block on Bluesky. Their seeds are left out, and so are their takes and deliveries,
  // so nobody you've blocked can mark something as taken to keep others off it.
  const myBlocks = () => viewer ? memo('blocks', () => net.blocksOf(viewer), 300e3).catch(() => new Set()) : Promise.resolve(new Set());

  // How you and others are connected on Bluesky and on Tangled (./ties.js): beside people, and
  // for narrowing the board. Who you follow on Tangled is one listing of your records; whether
  // someone follows you there is one read of theirs. Both are kept a few minutes.
  // A slow server isn't waited on for long: what it hasn't said by then is left unknown, and
  // its answer is kept for next time.
  const within = (p, ms) => { let t; return Promise.race([p, new Promise(r => { t = setTimeout(() => r(null), ms); })]).finally(() => clearTimeout(t)); };
  const myTangled = () => viewer ? within(memo('tangled-follows', () => tangledFollowsOf(viewer), 5 * 60e3).catch(() => null), 8000) : Promise.resolve(null);
  const followsMe = did => within(memo('tangled-back:' + did, () => followsOnTangled(did, viewer), 5 * 60e3).catch(() => null), 6000);
  /** Map<did, { bsky, tangled }> for each of `dids` but you, with null for a network that didn't answer. */
  async function tiesOf(dids){
    const out = new Map(), todo = [...new Set(dids)].filter(d => viewer && d !== viewer && net.isDid(d));
    if (!todo.length) return out;
    // All at once, as their profiles are read: one slow server holds up nobody else's answer.
    const [bsky, mine, back] = await Promise.all([net.relationships(viewer, todo).catch(() => null), myTangled(), Promise.all(todo.map(followsMe))]);
    todo.forEach((d, i) => {
      const r = bsky?.get(d), them = back[i] ?? null;
      out.set(d, {
        bsky: bsky ? { following: !!r?.following, followedBy: !!r?.followedBy } : null,
        tangled: mine || them !== null ? { following: mine ? mine.has(d) : null, followedBy: them } : null
      });
    });
    return out;
  }

  // Your groups that have Rainshare, and what's in each one's space.
  const myGroups = () => memo('groups', async () => {
    if (!viewer || !groups) return [];
    const gs = await groups.mine();
    return Promise.all(gs.map(async g => ({ ...g, ...(await groups.board(g.did).catch(e => ({ space: null, error: e }))) })));
  });
  const groupRecords = g => memo('space:' + g.space, async () => {
    const { records } = await spaces.read(g.space, [SEED, TAKE, DELIVERY, COMMENT, PROFILE]);
    return records;
  }, 20e3);

  // What points at each seed, leaving out anyone you block. Comments are only read for one
  // seed's page, so an item from the board has none attached (rather than an empty list).
  function attach(items, takes, deliveries, blocked = new Set(), comments = null){
    const by = (list, uri) => list.filter(r => r.value?.seed?.uri === uri && !blocked.has(r.repo));
    for (const it of items) {
      it.takes = by(takes, it.uri); it.deliveries = by(deliveries, it.uri);
      if (comments) it.comments = by(comments, it.uri);
    }
    return items;
  }
  // Everyone is named as their Bluesky profile names them, unless their Rainshare profile gives
  // a name of its own (`displayName`), for Rainshare only.
  async function named(items){
    const others = it => [...(it.takes || []), ...(it.deliveries || []), ...(it.comments || [])];
    const dids = [...new Set(items.flatMap(it => [it.repo, ...others(it).map(r => r.repo)]))];
    const [who, profs] = await Promise.all([people(dids), Promise.all(dids.map(d => publicProfile(d).then(r => r?.value || null, () => null)))]);
    const own = new Map(dids.map((d, i) => [d, profs[i]]));
    // A group copy of someone's profile is fuller than the public one, so its name wins.
    for (const it of items) if (it.profile) own.set(it.repo, { ...(own.get(it.repo) || {}), ...it.profile });
    const as = d => shown(who.get(d) || { did: d }, own.get(d));
    for (const it of items) {
      it.author = as(it.repo);
      for (const r of others(it)) r.author = as(r.repo);
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
    const [sqs, takes, deliveries] = await Promise.all([everyone(SEED), everyone(TAKE).catch(() => []), everyone(DELIVERY).catch(() => [])])
      .catch(e => { notes.push('The network didn’t answer, so public asks are missing. Try again in a moment.'); console.warn(e); return [[], [], []]; });
    const authors = [...new Set(sqs.map(r => r.repo))];
    let rels = new Map(), blocked = new Set();
    if (viewer) {
      [rels, blocked] = await Promise.all([
        net.relationships(viewer, authors).catch(() => { notes.push('Bluesky didn’t say who you follow, so only asks open to everyone are showing.'); return new Map(); }),
        myBlocks()
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
    attach(visible, takes, deliveries, blocked);
    // How you know each person who asked, read while their profiles are.
    const tied = viewer ? tiesOf(visible.map(v => v.repo)).catch(() => new Map()) : null;
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
        const items = of(SEED).map(r => ({ uri: r.uri, cid: r.cid, repo: r.repo, rkey: r.rkey, value: r.value, space: g.space, group: g, closeness: closeness({ viewer, author: r.repo, group: true }) }));
        attach(items, of(TAKE), of(DELIVERY), undefined, of(COMMENT));
        for (const it of items) it.profile = profs.get(it.repo) || null;
        // A group copy of someone's profile is fuller than their public one, so it wins everywhere.
        for (const v of visible) if (profs.has(v.repo)) v.profile = { ...(v.profile || {}), ...profs.get(v.repo) };
        visible.push(...items);
      } catch (e) {
        notes.push(e.name === 'NoSpaces' ? `Your account’s server doesn’t support private spaces yet, so ${g.name}’s private asks stay closed to you.` : `${g.name}’s private asks didn’t load.`);
        console.warn(e);
      }
    }
    await named(visible);
    if (tied) {
      const ties = await tied, rest = await tiesOf(visible.map(v => v.repo).filter(d => !ties.has(d))).catch(() => new Map());
      for (const v of visible) v.ties = ties.get(v.repo) || rest.get(v.repo) || null;
    }
    visible.sort((a, b) => String(b.value?.createdAt).localeCompare(String(a.value?.createdAt)));
    return { items: visible, notes };
  }

  /** One seed by its URI, with its takes, deliveries, comments and author. Null if it's gone. */
  async function seed(uri, { force } = {}){
    if (force) forget('all:' + TAKE, 'all:' + DELIVERY, 'all:' + COMMENT, `to:${TAKE}:${uri}`, `to:${DELIVERY}:${uri}`, `to:${COMMENT}:${uri}`);
    const inSpace = splitSpaceUri(uri);
    if (inSpace) {
      const g = (await myGroups()).find(x => x.space === inSpace.space);
      if (!g) return null;
      if (force) forget('space:' + g.space);
      const { items } = await board();
      return items.find(i => i.uri === uri) || null;
    }
    const p = net.parseUri(uri);
    if (!p || p.collection !== SEED) return null;
    const rec = await net.getRecordOrNull(p.repo, SEED, p.rkey);
    if (!rec) return null;
    const [takes, deliveries, comments, prof, blocked] = await Promise.all([pointingAt(uri, TAKE).catch(() => []), pointingAt(uri, DELIVERY).catch(() => []), pointingAt(uri, COMMENT).catch(() => []), publicProfile(p.repo).catch(() => null), myBlocks()]);
    const rel = viewer && viewer !== p.repo ? (await net.relationships(viewer, [p.repo]).catch(() => new Map())).get(p.repo) : null;
    const item = { ...rec, space: null, group: null, rel, closeness: closeness({ viewer, author: p.repo, rel }), profile: prof?.value || null };
    attach([item], takes, deliveries, blocked, comments);
    // How you know whoever asked, and each person on it or who turned something in.
    const helpers = [...item.takes, ...item.deliveries];
    const [ties] = await Promise.all([viewer ? tiesOf([p.repo, ...helpers.map(r => r.repo)]).catch(() => new Map()) : new Map(), named([item])]);
    item.ties = ties.get(p.repo) || null;
    for (const r of helpers) r.ties = ties.get(r.repo) || null;
    return item;
  }

  /** Someone's profile: the public copy, made fuller by any group copy you can read. */
  // What someone has watered: their own deliveries say which seeds and plants they worked on,
  // and each of those says whether its planter marked it sprouted with that work. Public ones only.
  const gardenOf = did => memo('garden:' + did, async () => {
    const mine = await net.listRecords(did, DELIVERY, { pages: 2 }).catch(() => []), on = new Map();
    for (const d of mine) { const u = d.value?.seed?.uri, p = net.parseUri(u); if (p?.collection === SEED) on.set(u, [...(on.get(u) || []), { uri: d.uri, repo: did }]); }
    const found = await net.pool([...on.keys()].slice(0, 80), 6, async u => {
      const p = net.parseUri(u), rec = await net.getRecordOrNull(p.repo, SEED, p.rkey).catch(() => null);
      return rec ? { uri: u, repo: p.repo, rkey: p.rkey, value: rec.value, deliveries: on.get(u) } : null;
    });
    const garden = wateredBy(did, found.filter(Boolean)), people = await net.profiles(garden.map(g => g.repo)).catch(() => new Map());
    return garden.map(g => ({ ...g, author: people.get(g.repo) || net.knownPerson(g.repo) || { did: g.repo } }));
  });
  async function profileOf(did, { force } = {}){
    if (force) forget('profile:' + did);
    // `unread`: their server didn't answer, so whether they have a profile isn't known (which
    // isn't the same as not having one: see the welcome, ../ui/welcome.js).
    let unread = false;
    const [pub, who, ties] = await Promise.all([publicProfile(did).catch(() => { unread = true; return null; }), people([did]), tiesOf([did]).catch(() => new Map())]);
    let full = null, inGroups = [];
    for (const g of (await myGroups().catch(() => [])).filter(g => g.space)) {
      const rec = (await groupRecords(g).catch(() => [])).find(r => r.collection === PROFILE && r.repo === did && r.rkey === 'self');
      if (rec) { full = { ...(full || {}), ...rec.value }; inGroups.push(g); }
    }
    const merged = pub || full ? { ...(pub?.value || {}), ...(full || {}) } : null;
    const hidden = full ? R.PRIVATE_FIELDS.filter(k => full[k] !== undefined && pub?.value?.[k] === undefined) : [];
    // `bluesky` is them as their Bluesky profile has them; `person` is how Rainshare shows them.
    const bluesky = who.get(did) || { did };
    return { person: shown(bluesky, merged), bluesky, public: pub?.value || null, merged, hidden, groups: inGroups, ties: ties.get(did) || null, unread };
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

  async function plant(input, { group } = {}){
    const g = group ? (await myGroups()).find(x => x.did === group) : null;
    if (group && !g?.space) throw new SourceError('NoBoard', 'That group doesn’t have Rainshare yet.');
    const subject = input.subject ? await completeTangled(input.subject).catch(() => input.subject) : undefined;
    const record = R.seed({ ...input, subject, group: g ? g.did : undefined });
    const r = await into(g?.space).create(SEED, record);
    remember(SEED, { uri: r.uri, cid: r.cid, repo: viewer, rkey: String(r.uri || '').split('/').pop(), value: record, space: g?.space || null });
    forget('all:' + SEED); if (g) forget('space:' + g.space);
    return { uri: r.uri, cid: r.cid, space: g?.space || null };
  }
  async function update(item, input){
    if (item.repo !== viewer) throw new SourceError('NotYours', 'Only the person who asked can change it.');
    const record = R.seed({ ...item.value, ...input, group: item.group?.did, subject: input.subject ?? item.value.subject }, item.value);
    if (input.state === 'open') delete record.state;
    const r = await into(item.space).put(SEED, item.rkey, record);
    remember(SEED, { uri: item.uri, cid: r?.cid || item.cid, repo: viewer, rkey: item.rkey, value: record, space: item.space || null });
    forget('all:' + SEED); if (item.space) forget('space:' + item.space);
    return record;
  }
  async function remove(item){
    if (item.repo !== viewer) throw new SourceError('NotYours', 'Only the person who asked can delete it.');
    await into(item.space).del(SEED, item.rkey);
    forgetRecord(item.uri);
    forget('all:' + SEED); if (item.space) forget('space:' + item.space);
  }
  const mine = list => (list || []).filter(r => r.repo === viewer);
  async function takeOn(item, { setup, note } = {}){
    if (mine(item.takes).length) return mine(item.takes)[0];
    const record = R.take({ seed: item, setup, note });
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
    const record = R.delivery({ ...input, seed: item, take: mine(item.takes)[0] });
    const r = await into(item.space).create(DELIVERY, record);
    const rec = { uri: r.uri, cid: r.cid, repo: viewer, rkey: String(r.uri || '').split('/').pop(), value: record, space: item.space || null };
    remember(DELIVERY, rec);
    forget('all:' + DELIVERY); if (item.space) forget('space:' + item.space);
    return rec;
  }

  // Saying something on a seed, or replying to a comment on it. Anyone who can see it can.
  async function comment(item, { text, parent } = {}){
    const record = R.comment({ seed: item, parent, text });
    const r = await into(item.space).create(COMMENT, record);
    const rec = { uri: r.uri, cid: r.cid, repo: viewer, rkey: String(r.uri || '').split('/').pop(), value: record, space: item.space || null };
    remember(COMMENT, rec);
    forget('all:' + COMMENT, `to:${COMMENT}:${item.uri}`); if (item.space) forget('space:' + item.space);
    return rec;
  }
  // Taking one of your own comments back. Replies to it stay, as replies to one that's gone.
  async function uncomment(item, c){
    if (!c || c.repo !== viewer) throw new SourceError('NotYourComment', 'Only the person who wrote a comment can delete it.');
    await into(item.space).del(COMMENT, c.rkey);
    forgetRecord(c.uri);
    forget('all:' + COMMENT, `to:${COMMENT}:${item.uri}`); if (item.space) forget('space:' + item.space);
  }

  return {
    viewer, signedIn: !!viewer, canPrivate: !!(spaces && groups),
    board, seed, profileOf, saveProfile, plant, update, remove, take: takeOn, drop, turnIn, comment, uncomment,
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
    tangledIssues,
    knotlessRepos: () => viewer ? knotlessRepos(viewer) : Promise.resolve([]),
    knotlessIssues,
    gardenOf,
    // Posting to knotless or Tangled as you: an issue on a repo, a comment on an issue, or a
    // pull request from a branch that's been pushed (./forgewrite.js).
    forgeIssue: (subject, input) => forgeIssue(agent, subject, input),
    forgeComment: (subject, text) => forgeComment(agent, subject, text),
    forgePull: (subject, input) => forgePull(agent, subject, input),
    pullChoices: subject => pullChoices(subject, { viewer }),
    // Tangled's vouch network (./vouch.js): what you and the people you vouch for have said
    // about others, and vouching for someone yourself. Read once and kept a few minutes.
    vouchCircle: () => viewer ? memo('vouches', () => circleOf(viewer), 5 * 60e3) : Promise.resolve(null),
    // Which of the people you follow on Bluesky follow someone (./ties.js): { people, count,
    // partial }, the first few named, or null when Bluesky didn't say. Past your 1,000 most
    // recent follows it's `partial`, rather than a call for every 30 more.
    knownFollowers: did => viewer && net.isDid(did) && did !== viewer ? memo('known:' + did, async () => {
      const mine = await memo('bsky-follows', () => net.followsOf(viewer, { max: 1000 }), 5 * 60e3);
      const dids = await knownFollowers(did, mine.dids, { viewer }), who = await net.profiles(dids.slice(0, 6)).catch(() => new Map());
      return { people: dids.slice(0, 6).map(d => who.get(d) || { did: d }), count: dids.length, partial: mine.partial };
    }, 5 * 60e3).catch(() => null) : Promise.resolve(null),
    vouchFor: async (did, input) => { const r = await vouchFor(agent, did, input); forget('vouches'); return r; },
    unvouch: async did => { await unvouch(agent, did); forget('vouches'); },
    evidenceFor
  };
}
