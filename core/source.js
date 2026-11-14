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
import { PROFILE, SEED, TAKE, DELIVERY, COMMENT, PREFERENCES, MODERATION, MODERATOR } from './ns.js';
import { decisionsFrom, hiddenBy, keyOf, moderationRecord, subjectFrom, subjectOf, kindOf as subjectKind } from './moderation.js';
import * as net from './net.js';
import * as R from './records.js';
import { closeness, meantFor } from './circle.js';
import { completeTangled, tangledRepos, tangledIssues, knotlessRepos, knotlessIssues, issueComments, pullState, pullPageOf, describeSubject, TICKET } from './subjects.js';
import { talksOn, fromForge } from './comments.js';
import { wateredBy, budsOf, onRepo } from './garden.js';
import { activityOf } from './activity.js';
import { forgeIssue, forgeComment, forgePull, pullChoices, FORGE_SAID } from './forgewrite.js';
import { circleOf, vouchFor, unvouch, evidenceFor, vouchesBy } from './vouch.js';
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
  // The same for comments posted to an issue on Tangled or knotless, by the ask they're on:
  // the forge's list can take a moment to show one.
  const posted = new Map();
  const withPosted = (uri, list) => { const have = new Set(list.map(c => c.uri)); return [...list, ...(posted.get(uri) || []).filter(c => !have.has(c.uri))]; };
  // (Anything written can change someone's garden, its buds or what their activity says, so
  // those are read again next time rather than kept.)
  const forgetPeople = () => { for (const k of [...cache.keys()]) if (/^(garden|buds|activity):/.test(k)) cache.delete(k); };
  const remember = (collection, rec) => { if (rec.uri) { gone.delete(rec.uri); recent.set(rec.uri, { collection, ...rec }); forgetPeople(); } };
  const forgetRecord = uri => { recent.delete(uri); gone.add(uri); forgetPeople(); };
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
  // (A Rainshare profile Rainshare has hidden, a name or a bio that's abuse, is shown to nobody
  // but its owner: everyone else sees them as Bluesky has them.)
  const publicProfile = did => memo('profile:' + did, async () => {
    const [rec, mod] = await Promise.all([net.getRecordOrNull(did, PROFILE, 'self'), did === viewer ? null : decisions()]);
    return rec && hiddenBy(mod, rec.uri, did) ? null : rec;
  });
  // Who you block on Bluesky. Their seeds are left out, and so are their takes and deliveries,
  // so nobody you've blocked can mark something as taken to keep others off it.
  const myBlocks = () => viewer ? memo('blocks', () => net.blocksOf(viewer), 300e3).catch(() => new Set()) : Promise.resolve(new Set());
  // What @rainshare.dev has hidden (./moderation.js), read from that one account's own repo and
  // nowhere else. Its seeds, takes, deliveries and comments are left out for everyone, as if
  // blocked, except that whoever asked still sees their own ask, marked hidden, so they know.
  // If the account's server doesn't answer, nothing is hidden this time round: the board
  // shouldn't go dark because one server did, and it's asked again a minute later.
  const readDecisions = () => memo('moderation', () => net.listRecords(MODERATOR, MODERATION, { pages: 10 }).then(decisionsFrom), 60e3);
  const decisions = () => readDecisions().catch(e => { console.warn('rainshare moderation', e); return new Map(); });

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

  // What points at each seed, leaving out anyone you block and anything Rainshare has hidden.
  // Comments are only read for one seed's page, so an item from the board has none attached
  // (rather than an empty list).
  function attach(items, takes, deliveries, blocked = new Set(), comments = null, hidden = null){
    const by = (list, uri) => list.filter(r => r.value?.seed?.uri === uri && !blocked.has(r.repo) && !hiddenBy(hidden, r.uri, r.repo));
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
    const notes = [], modded = decisions();
    const [sqs, takes, deliveries] = await Promise.all([everyone(SEED), everyone(TAKE).catch(() => []), everyone(DELIVERY).catch(() => [])])
      .catch(e => { notes.push('The network didn’t answer, so public asks are missing. Try again in a moment.'); console.warn(e); return [[], [], []]; });
    const mod = await modded;
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
      const hidden = hiddenBy(mod, r.uri, r.repo);
      if (hidden && r.repo !== viewer) continue;
      const rel = rels.get(r.repo), aud = r.value?.audience?.$type || '';
      const inList = aud.endsWith('#list') && viewer ? (await net.listMembers(r.value.audience.list).catch(() => new Set())).has(viewer) : false;
      if (!meantFor(r.value, { viewer, author: r.repo, rel, inList })) continue;
      visible.push({ ...r, space: null, group: null, closeness: closeness({ viewer, author: r.repo, rel }), rel, hidden });
    }
    attach(visible, takes, deliveries, blocked, null, mod);
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
    // An ask on an issue on Tangled or knotless talks there, so the issue's comments are read
    // too. Rainshare's own on it are still shown: written before, or from somewhere else.
    const forge = talksOn({ value: rec.value });
    const onIssue = forge ? issueComments(rec.value.subject, { fresh: !!force }).catch(e => { console.warn('rainshare issue comments', e); return null; }) : null;
    const [takes, deliveries, comments, issue, prof, blocked, mod] = await Promise.all([pointingAt(uri, TAKE).catch(() => []), pointingAt(uri, DELIVERY).catch(() => []), pointingAt(uri, COMMENT).catch(() => []), onIssue, publicProfile(p.repo).catch(() => null), myBlocks(), decisions()]);
    const rel = viewer && viewer !== p.repo ? (await net.relationships(viewer, [p.repo]).catch(() => new Map())).get(p.repo) : null;
    // A hidden ask still comes back, marked, so its page can say so (and show it to whoever
    // asked, and to @rainshare.dev): what it says is for the screens to keep back.
    const item = { ...rec, space: null, group: null, rel, closeness: closeness({ viewer, author: p.repo, rel }), profile: prof?.value || null, hidden: hiddenBy(mod, uri, p.repo) };
    const fromIssue = forge ? withPosted(uri, (issue?.items || []).map(c => fromForge(c, uri, forge))) : [];
    attach([item], takes, deliveries, blocked, [...comments, ...fromIssue], mod);
    // Where its comments are kept, and whether the forge answered: { forge, read, more }.
    item.talk = forge ? { forge, read: !!issue, more: !!issue?.more } : null;
    // How you know whoever asked, and each person on it or who turned something in.
    const helpers = [...item.takes, ...item.deliveries];
    const [ties] = await Promise.all([viewer ? tiesOf([p.repo, ...helpers.map(r => r.repo)]).catch(() => new Map()) : new Map(), named([item])]);
    item.ties = ties.get(p.repo) || null;
    for (const r of helpers) r.ties = ties.get(r.repo) || null;
    return item;
  }

  /* ---------- what one person has done: their garden, its buds, their activity ---------- */
  // Each is read from their own account: one listing per kind of record (yours with what you've
  // just written laid over it), and then the asks those point at, each from its own author's
  // server. Public ones only: what's in a group's space stays there.
  const recordsOf = (did, collection) => memo(`of:${collection}:${did}`, () => net.listRecords(did, collection, { pages: 2 }).catch(() => []))
    .then(list => did === viewer ? layered(collection, list).filter(r => r.repo === did && !r.space) : list);
  const askRecord = uri => memo('ask:' + uri, async () => {
    const p = net.parseUri(uri);
    return p?.collection === SEED ? net.getRecordOrNull(p.repo, SEED, p.rkey).catch(() => null) : null;
  });
  /**
   * The asks some records point at (`seed.uri`), the most recently pointed at first and no more
   * than `max` of them, as items: { uri, repo, rkey, value, space: null }. What's gone, what
   * Rainshare has hidden, and asks from people you block are left out.
   */
  async function asksBehind(recs, { max = 80, mod, blocked } = {}){
    const uris = [...new Set([...recs].sort((a, b) => String(b.value?.createdAt || '').localeCompare(String(a.value?.createdAt || ''))).map(r => r.value?.seed?.uri).filter(u => net.parseUri(u)?.collection === SEED))].slice(0, max);
    const found = await net.pool(uris, 6, async uri => {
      const p = net.parseUri(uri), rec = (recent.get(uri)?.collection === SEED && !gone.has(uri)) ? recent.get(uri) : await askRecord(uri);
      return rec && !gone.has(uri) ? { uri, cid: rec.cid || null, repo: p.repo, rkey: p.rkey, value: rec.value, space: null } : null;
    });
    return found.filter(it => it && !hiddenBy(mod, it.uri, it.repo) && !blocked?.has(it.repo));
  }
  /**
   * Marks each ask `shared`: whether it's meant for whoever's looking, by its audience, as the
   * board decides it. (`also`: someone who counts as meant for it anyway, such as the helper
   * looking at their own garden.) Bluesky not answering leaves only what's open to everyone.
   */
  async function markShared(items, { also } = {}){
    const authors = [...new Set(items.map(it => it.repo))].filter(d => d !== viewer);
    const rels = viewer && authors.length ? await net.relationships(viewer, authors).catch(() => new Map()) : new Map();
    for (const it of items) {
      const aud = it.value?.audience?.$type || '';
      const inList = viewer && aud.endsWith('#list') ? (await net.listMembers(it.value.audience.list).catch(() => new Set())).has(viewer) : false;
      it.shared = (!!also && also === viewer) || meantFor(it.value, { viewer, author: it.repo, rel: rels.get(it.repo), inList });
    }
    return items;
  }
  // People as Rainshare shows them: their Bluesky profile, with their Rainshare name if they gave one.
  async function whoAre(dids){
    const list = [...new Set(dids)].filter(net.isDid);
    const [who, profs] = await Promise.all([people(list).catch(() => new Map()), Promise.all(list.map(d => publicProfile(d).then(r => r?.value || null, () => null)))]);
    return new Map(list.map((d, i) => [d, shown(who.get(d) || net.knownPerson(d) || { did: d }, profs[i])]));
  }
  // What someone has watered: their own deliveries say which seeds and plants they worked on,
  // and each of those says whether its planter marked it sprouted with that work.
  const gardenOf = did => memo('garden:' + did, async () => {
    const [dels, mod, blocked] = await Promise.all([recordsOf(did, DELIVERY), decisions(), myBlocks()]);
    const items = await asksBehind(dels.filter(d => !hiddenBy(mod, d.uri, did)), { mod, blocked });
    for (const it of items) it.deliveries = dels.filter(d => d.value?.seed?.uri === it.uri);
    const garden = wateredBy(did, await markShared(items.filter(it => it.value?.state === 'sprouted'), { also: did }));
    const names = await whoAre(garden.map(g => g.repo));
    return garden.map(g => ({ ...g, author: names.get(g.repo) || { did: g.repo } }));
  });
  /**
   * Their buds (./garden.js): pull requests they turned in on asks that are still open, which the
   * forge says were merged. The forge is asked about the few turned in most recently (GitHub
   * answers a browser that isn't signed in 60 times an hour), and its answers kept a while. On
   * Tangled, where a pull request names its author, one that isn't theirs doesn't count.
   */
  const pullOf = d => memo('pull:' + d.uri, () => pullState({ url: d.value?.url, pull: d.value?.pull, subject: d.subject }), 10 * 60e3);
  const buddingOf = did => memo('buds:' + did, async () => {
    const [dels, mod, blocked] = await Promise.all([recordsOf(did, DELIVERY), decisions(), myBlocks()]);
    const items = (await asksBehind(dels.filter(d => !hiddenBy(mod, d.uri, did)), { max: 12, mod, blocked })).filter(it => !it.value?.state || it.value.state === 'open');
    const asked = [];
    for (const it of items) {
      it.deliveries = dels.filter(d => d.value?.seed?.uri === it.uri).map(d => ({ ...d }));
      const d = it.deliveries.sort((a, b) => String(b.value?.createdAt || '').localeCompare(String(a.value?.createdAt || '')))[0];
      if (d && onRepo(pullPageOf(d.value || {}, it.value?.subject), it.value?.subject) && asked.length < 6) asked.push({ d, it });
    }
    await net.pool(asked, 3, async ({ d, it }) => {
      d.state = await pullOf({ ...d, subject: it.value?.subject }).catch(() => null);
      if (d.state === 'merged' && describeSubject(it.value?.subject)?.forge === 'tangled') {
        const ev = await evidenceFor(d).catch(() => []);
        if (!ev.some(r => net.parseUri(r.uri)?.collection === TICKET)) d.state = null;
      }
    });
    const buds = budsOf(did, await markShared(items, { also: did }));
    const names = await whoAre(buds.map(g => g.repo));
    return buds.map(g => ({ ...g, author: names.get(g.repo) || { did: g.repo } }));
  }, 10 * 60e3);
  /**
   * What they've been doing (./activity.js), ask by ask: what they asked for, took on, turned
   * in and commented on, and who they vouched for on Tangled. Asks that aren't meant for whoever's
   * looking are left out, as on the board. Comments on a Tangled or knotless issue are the
   * forge's, kept with the issue, so they aren't among them.
   */
  const activityFor = did => memo('activity:' + did, async () => {
    const [asks, takes, dels, comms, said, mod, blocked] = await Promise.all([
      recordsOf(did, SEED), recordsOf(did, TAKE), recordsOf(did, DELIVERY), recordsOf(did, COMMENT),
      vouchesBy(did, { max: 200 }).catch(() => new Map()), decisions(), myBlocks()
    ]);
    if (hiddenBy(mod, null, did)) return [];
    const ok = r => !hiddenBy(mod, r.uri, did);
    const own = asks.filter(ok).map(r => ({ uri: r.uri, cid: r.cid, repo: did, rkey: r.rkey, value: r.value, space: null }));
    const pointing = [...takes, ...dels, ...comms].filter(ok), ownUris = new Set(own.map(r => r.uri));
    const others = await asksBehind(pointing.filter(r => !ownUris.has(r.value?.seed?.uri)), { max: 60, mod, blocked });
    const shownAsks = (await markShared([...own, ...others])).filter(it => it.shared);
    const vouches = [...said].filter(([d, v]) => v.kind === 'vouch' && !blocked.has(d) && !hiddenBy(mod, null, d)).map(([d, v]) => ({ did: d, kind: v.kind, reason: v.reason, at: v.at }));
    const names = await whoAre([...shownAsks.map(it => it.repo), ...vouches.map(v => v.did), ...shownAsks.flatMap(it => (it.value?.sproutedWith || []).map(r => net.parseUri(r?.uri)?.repo))]);
    for (const it of shownAsks) it.author = names.get(it.repo) || { did: it.repo };
    const stories = activityOf(did, { asks: own, takes, deliveries: dels.filter(ok), comments: comms.filter(ok), vouches: vouches.map(v => ({ ...v, person: names.get(v.did) || { did: v.did } })), seeds: new Map(shownAsks.map(it => [it.uri, it])) });
    for (const s of stories) for (const st of s.steps) if (st.with) st.people = st.with.map(d => names.get(d) || { did: d });
    return stories;
  });

  /** Someone's profile: the public copy, made fuller by any group copy you can read. */
  async function profileOf(did, { force } = {}){
    if (force) forget('profile:' + did);
    // `unread`: their server didn't answer, so whether they have a profile isn't known (which
    // isn't the same as not having one: see the welcome, ../ui/welcome.js).
    let unread = false;
    const [pub, who, ties, mod] = await Promise.all([publicProfile(did).catch(() => { unread = true; return null; }), people([did]), tiesOf([did]).catch(() => new Map()), decisions()]);
    let full = null, inGroups = [];
    for (const g of (await myGroups().catch(() => [])).filter(g => g.space)) {
      const rec = (await groupRecords(g).catch(() => [])).find(r => r.collection === PROFILE && r.repo === did && r.rkey === 'self');
      if (rec) { full = { ...(full || {}), ...rec.value }; inGroups.push(g); }
    }
    const merged = pub || full ? { ...(pub?.value || {}), ...(full || {}) } : null;
    const hidden = full ? R.PRIVATE_FIELDS.filter(k => full[k] !== undefined && pub?.value?.[k] === undefined) : [];
    // `bluesky` is them as their Bluesky profile has them; `person` is how Rainshare shows them.
    const bluesky = who.get(did) || { did };
    // `moderated`: Rainshare has hidden everything this account writes (or its Rainshare profile).
    const moderated = hiddenBy(mod, null, did) || mod.get(net.recordUri(did, PROFILE, 'self')) || null;
    return { person: shown(bluesky, merged), bluesky, public: pub?.value || null, merged, hidden, groups: inGroups, ties: ties.get(did) || null, unread, moderated };
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
  /* ---------- your settings ---------- */
  // One record, dev.rainshare.preferences/self. Null when there isn't one (or it can't be read).
  async function preferences(){
    if (!viewer) return null;
    return (await net.getRecordOrNull(viewer, PREFERENCES, 'self').catch(() => null))?.value || null;
  }
  async function savePreferences(input){
    if (!viewer) throw new SourceError('NotSignedIn', 'Sign in first.');
    const record = R.preferences(input, await preferences());
    await put(PREFERENCES, 'self', record);
    return record;
  }

  // `days`: how long you give yourself to turn it in (the take's `until`: ./takes.js).
  async function takeOn(item, { setup, note, days } = {}){
    if (mine(item.takes).length) return mine(item.takes)[0];
    const record = R.take({ seed: item, setup, note, days });
    const r = await into(item.space).create(TAKE, record);
    const rec = { uri: r.uri, cid: r.cid, repo: viewer, rkey: String(r.uri || '').split('/').pop(), value: record, space: item.space || null };
    remember(TAKE, rec);
    forget('all:' + TAKE); if (item.space) forget('space:' + item.space);
    return rec;
  }
  // More time: your take on it, written again with a later day.
  async function moreTime(item, days){
    const t = mine(item.takes)[0];
    if (!t) throw new SourceError('NotOnIt', 'You aren’t on this one.');
    const record = R.moreTime(t.value, days), r = await into(item.space).put(TAKE, t.rkey, record);
    const rec = { ...t, cid: r?.cid || t.cid, value: record };
    remember(TAKE, rec);
    forget('all:' + TAKE, `to:${TAKE}:${item.uri}`); if (item.space) forget('space:' + item.space);
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
  // On an ask on a Tangled or knotless issue, it's said on the issue, as a comment there.
  async function comment(item, { text, parent } = {}){
    const forge = talksOn(item);
    if (forge) {
      if (parent && parent.forge !== forge) throw new SourceError('NotThere', 'That comment is only on Rainshare, so a reply to it can’t go on the issue.');
      const said = String(text || '').trim(), replyTo = parent ? { uri: parent.uri, cid: parent.cid } : null;
      const r = await forgeComment(agent, item.value.subject, said, replyTo ? { replyTo } : {});
      const rec = { ...fromForge({ uri: r.uri, cid: r.cid, by: viewer, text: said, createdAt: new Date().toISOString(), replyTo }, item.uri, forge), attested: r.attested };
      posted.set(item.uri, [...(posted.get(item.uri) || []), rec]);
      return rec;
    }
    const record = R.comment({ seed: item, parent, text });
    const r = await into(item.space).create(COMMENT, record);
    const rec = { uri: r.uri, cid: r.cid, repo: viewer, rkey: String(r.uri || '').split('/').pop(), value: record, space: item.space || null };
    remember(COMMENT, rec);
    forget('all:' + COMMENT, `to:${COMMENT}:${item.uri}`); if (item.space) forget('space:' + item.space);
    return rec;
  }
  // Taking one of your own comments back. Replies to it stay, as replies to one that's gone.
  async function uncomment(item, c){
    if (c?.forge) throw new SourceError('OnForge', `It’s on ${FORGE_SAID[c.forge]}. Change or delete it there.`);
    if (!c || c.repo !== viewer) throw new SourceError('NotYourComment', 'Only the person who wrote a comment can delete it.');
    await into(item.space).del(COMMENT, c.rkey);
    forgetRecord(c.uri);
    forget('all:' + COMMENT, `to:${COMMENT}:${item.uri}`); if (item.space) forget('space:' + item.space);
  }

  /* ---------- moderating, as @rainshare.dev ---------- */
  // Only that account's records count (./moderation.js), so only its sign-in gets these. A
  // decision is a record keyed by what it's about: hiding something again replaces it, and
  // unhiding deletes it. What it's about is read again for the page (`about`), never trusted
  // from the decision itself.
  const moderator = viewer === MODERATOR;
  async function hide(subject, { reason, note } = {}){
    const record = moderationRecord({ subject, reason, note }), key = keyOf(record.subject);
    if (!key) throw new SourceError('BadSubject', 'That can’t be hidden: its address is too long to name.');
    await put(MODERATION, key, record);
    // (Everything read before is read again: profiles and gardens are kept with what was hidden then.)
    forget();
    return record;
  }
  async function unhide(subject){
    const s = subjectOf(subject), d = (await readDecisions()).get(s);
    for (const k of d?.rkeys?.length ? d.rkeys : [keyOf(s)].filter(Boolean)) await del(MODERATION, k);
    forget();
  }
  /** Every decision, newest first. Unlike the board, this says so when the account's server didn't answer. */
  const listDecisions = async () => [...(await readDecisions()).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  /** What a subject is, read from where it lives: { kind, author, title, text, unread }. */
  async function about(subject){
    const s = subjectOf(subject), p = net.parseUri(s), did = p?.repo || String(s || '').slice(5);
    const [who, rec] = await Promise.all([
      people([did]).then(m => m.get(did) || { did }, () => ({ did })),
      p ? net.getRecordOrNull(p.repo, p.collection, p.rkey).catch(() => undefined) : null
    ]);
    const v = rec?.value || {}, words = [v.text, v.body, v.spec, v.bio, v.note].find(x => typeof x === 'string' && x.trim()) || '';
    return { subject: s, kind: subjectKind(s), author: who, title: typeof v.title === 'string' ? v.title : typeof v.displayName === 'string' ? v.displayName : '', text: words, unread: !!p && !rec, gone: rec === null };
  }

  return {
    viewer, signedIn: !!viewer, canPrivate: !!(spaces && groups),
    // The moderation page's: null for everyone but @rainshare.dev.
    moderation: moderator ? {
      list: listDecisions, hide, unhide, about,
      subjectFrom: input => subjectFrom(input, { resolve: net.resolveHandle })
    } : null,
    board, seed, profileOf, saveProfile, preferences, savePreferences, plant, update, remove, take: takeOn, moreTime, drop, turnIn, comment, uncomment,
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
    gardenOf, buddingOf, activityOf: activityFor,
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
