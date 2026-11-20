// @rainshare.dev's post about new asks: one a day, after 15:45 UTC (DAILY, ./messages.js), saying
// how many there are on the board, tagging a few of the people who asked, and asking whoever
// reads it to help, with a card for the board (compose). No titles. The asks it counts are the
// ones the day's direct message counts (newOnBoard, ./messages.js): asked from one 15:45 UTC to
// the next, on the board for everyone, nobody on them, not hidden, not very likely a trick on
// helpers' agents, and not from anyone the account blocks or who blocks it. A day with none gets
// no post. Nobody reads the asks first, so hiding an ask (or its asker) on the moderation page
// takes down a post that tagged them, and the next post for that day leaves them out.
//
// The announcer service runs it (./index.js, on the droplet: see ../README.md) whenever something
// happens on the board, and `npm run announce` runs it by hand. Without
// RAINSHARE_BLUESKY_APP_PASSWORD, an app password for the account, it posts nothing.
//
// There's no database, so the account itself says what's been posted: the day's post takes a
// record key made from the day's 15:45 UTC (tidAt), so a run can see whether it's up, and two runs
// at once can't post it twice: the second is refused. A run that comes after a whole day missed
// posts the latest day's only.
//
// Before 20 November 2026 the account posted each ask on its own, naming who asked, once a person
// had said yes to it. A post of those about an ask that's since been hidden (or whose asker has)
// is still taken down. This file also has what the direct messages (./messages.js) share with the
// post: reading the board, the account's session, its blocks, and who's on what.
import { SEED, TAKE, DELIVERY, PROFILE, SITE, MODERATION, MODERATOR, audienceOf } from '../../core/ns.js';
import * as net from '../../core/net.js';
import { progressOf } from '../../core/words.js';
import { decisionsFrom, hiddenBy } from '../../core/moderation.js';
import { isDid } from '../../core/net.js';
import { concerns, alarming } from '../../core/scan.js';
import { clean, describe } from '../../api/_og/describe.js';
import { OWNER } from '../../lexicons/compat.mjs';
import { rich, newOnBoard, boundary } from './messages.js';

// The brand account, which the lexicons belong to as well. Named by its DID, as there.
export const ACCOUNT = OWNER;
const DAY = 24 * 3600e3;
const POST = 'app.bsky.feed.post', BLOCK = 'app.bsky.graph.block';
// How big a card's picture may be (app.bsky.embed.external).
const MAX_THUMB = 1_000_000;
// Bluesky's chat service, which the account's own server passes direct messages on to.
const CHAT = 'did:web:api.bsky.chat#bsky_chat';

/** Whether an ask is on the board for everyone: it has a title, it's open, and it's meant for anyone. */
export const forAll = v => typeof v?.title === 'string' && !!clean(v.title) && (!v.state || v.state === 'open') && audienceOf(v) === 'anyone';
/** Whether the account may pass an ask on: on the board for everyone, and not very likely a trick on helpers' agents. */
export const passable = v => forAll(v) && !alarming(concerns(v));

/**
 * Every public record of a collection, across everyone who has any, read the first time it's
 * asked for and kept for the rest of the run: the post and the messages read the same asks. From
 * the index (`db`, ./index-db.js) while it's fresh, and otherwise from every repo that has any.
 */
export function reader({ db = null, log = () => {} } = {}){
  const got = new Map();
  let source;
  /** 'index' or 'network': where this run reads records from, decided once. */
  const from = () => source ||= !db ? Promise.resolve('network') : db.ready().then(
    s => { if (!s.ok) log(`The index isn’t fresh (${s.why}), so this run reads every repo instead.`); return s.ok ? 'index' : 'network'; },
    e => { log(`The index couldn’t be read (${e.message}), so this run reads every repo instead.`); return 'network'; });
  const network = collection => net.reposWith(collection)
    .then(dids => net.pool(dids, 6, d => net.listRecords(d, collection, { pages: 2 }).catch(() => [])))
    .then(lists => lists.flat());
  const read = collection => {
    if (!got.has(collection)) got.set(collection, from().then(s => s === 'index' ? db.list(collection) : network(collection)));
    return got.get(collection);
  };
  read.source = from;
  // What the account has hidden, from its own repo, always: it's one read, and it's what
  // matters most. If that can't be read, nothing goes out, rather than something it hid.
  let hidden;
  read.hidden = () => hidden ||= net.listRecords(MODERATOR, MODERATION, { pages: 10 }).then(decisionsFrom);
  return read;
}
/** Whether a record (or its whole account) is hidden, by the decisions from read.hidden(). */
export const isHidden = (decisions, rec) => !!hiddenBy(decisions, rec?.uri, rec?.repo);

/** Every link in a post: its card's, the links in its text, and any written out in full. */
export const linksIn = post => [
  post?.embed?.external?.uri, post?.embed?.media?.external?.uri,
  ...(Array.isArray(post?.facets) ? post.facets : []).flatMap(f => Array.isArray(f?.features) ? f.features.map(x => x?.uri) : []),
  ...(String(post?.text || '').match(/\S+\/seed\/\S+/g) || [])
].filter(u => typeof u === 'string');
/** The ask a link is to, as "<who> <rkey>" (who being a DID or a handle), by its path whatever the host. */
export function askAt(link){
  const m = String(link).match(/\/seed\/([^/?#\s]+)\/([^/?#\s]+)/);
  if (!m || m[1] === 's') return null;
  try { return decodeURIComponent(m[1]).replace(/^@/, '').toLowerCase() + ' ' + decodeURIComponent(m[2]).replace(/[.,;:!?)\]]+$/, ''); }
  catch (_) { return null; }
}
/**
 * The account's posts about asks that have since been hidden (or whose asker has): [{ rkey, ask }].
 * Only its own posts about one ask, as it wrote them before 20 November 2026 (a card for the ask's
 * page, and a mention of who's asking), never anything written by hand.
 */
export function hiddenPosts(posts, hidden){
  if (!hidden?.size) return [];
  return (posts || []).flatMap(p => {
    const v = p?.value, card = v?.embed?.external?.uri, at = card && askAt(card);
    if (!at || !/ is asking for help with /.test(String(v?.text || ''))) return [];
    const did = (v.facets || []).flatMap(f => f?.features || []).find(x => x?.$type === 'app.bsky.richtext.facet#mention' && isDid(x.did))?.did;
    if (!did) return [];
    const ask = `at://${did}/${SEED}/${at.split(' ')[1]}`;
    return hiddenBy(hidden, ask, did) ? [{ rkey: p.rkey, ask }] : [];
  });
}

// Who the account blocks, from its own records, and who among `dids` blocks it, as far as Bluesky says.
export async function blocked(dids){
  const [mine, rel] = await Promise.all([net.listRecords(ACCOUNT, BLOCK, { pages: 10 }), net.relationships(ACCOUNT, dids).catch(() => new Map())]);
  const out = new Set(mine.map(r => r.value?.subject).filter(net.isDid));
  for (const [did, r] of rel) if (r.blocking || r.blockedBy) out.add(did);
  return out;
}

// Each person as the board names them: their Rainshare name if they gave one, else their Bluesky name.
export async function whoAre(dids){
  const [bsky, own] = await Promise.all([net.profiles(dids), Promise.all(dids.map(d => net.getRecordOrNull(d, PROFILE, 'self').catch(() => null)))]);
  return new Map(dids.map((did, i) => {
    const b = bsky.get(did) || {};
    return [did, { did, handle: net.isHandle(b.handle) ? b.handle.toLowerCase() : null, name: clean(own[i]?.value?.displayName || b.displayName || '', 64) }];
  }));
}

/**
 * Whether nobody's on an ask: what the board calls "Nobody on it yet" (progressOf in
 * ../core/words.js). Nobody holds it with a take that hasn't lapsed, nothing's been turned in,
 * and it isn't done or closed. As on the board, a take or turn-in that's hidden, or from someone
 * in `blocks`, doesn't count, so nobody can keep an ask out of the count by saying they're on it.
 */
export const free = (ask, opts) => progressFor(ask, opts).key === 'open';
/** How far an ask has got (progressOf, ../core/words.js), counting takes and turn-ins as free() does: { key, helpers, … }. */
export function progressFor(ask, { takes = [], deliveries = [], hidden = new Map(), blocks = new Set(), now = Date.now() } = {}){
  const on = list => list.filter(r => r.value?.seed?.uri === ask.uri && !isHidden(hidden, r) && !blocks.has(r.repo));
  return progressOf({ ...ask, takes: on(takes), deliveries: on(deliveries) }, null, now);
}

const segmenter = typeof Intl?.Segmenter === 'function' ? new Intl.Segmenter() : null;
export const graphemes = s => segmenter ? Array.from(segmenter.segment(s), x => x.segment) : [...s];
export const bytes = s => new TextEncoder().encode(s).length;

// Record keys (TIDs): microseconds since 1970 and a clock ID, in sortable base32.
const S32 = '234567abcdefghijklmnopqrstuvwxyz';
/** The record key for a moment (ms): the day's post takes its day's 15:45 UTC. */
export function tidAt(ms, clockId = 0){
  let n = (BigInt(Math.floor(ms)) * 1000n) << 10n | BigInt(clockId), s = '';
  for (let i = 0; i < 13; i++) { s = S32[Number(n & 31n)] + s; n >>= 5n; }
  return s;
}

/** The moment a record key stands for (ms), or NaN when it isn't a TID. */
export function timeOfTid(rkey){
  if (typeof rkey !== 'string' || !/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/.test(rkey)) return NaN;
  let n = 0n;
  for (const c of rkey) n = n * 32n + BigInt(S32.indexOf(c));
  return Number((n >> 10n) / 1000n);
}

// How many of the people who asked the day's post tags, and what it may hold (app.bsky.feed.post).
export const MAX_TAGS = 3;
const MAX_GRAPHEMES = 300, MAX_BYTES = 3000;
const fits = t => graphemes(t).length <= MAX_GRAPHEMES && bytes(t) <= MAX_BYTES;
// What the post asks of whoever reads it, a different one each day in turn, so the account doesn't
// say the same thing every day. Each is given whether there's one ask.
export const NUDGES = [
  one => `Your AI plan resets whether you use it all or not. Got rain to spare? Point your agent at ${one ? 'it' : 'one'}.`,
  one => `Usage left on your plan before it resets? Pick ${one ? 'it' : 'one'} up and let your agent do the work.`,
  one => `The AI plan you already pay for could get ${one ? 'it' : 'one of these'} done before it resets.`
];

/**
 * The day's post about `asks`, the new asks it counts, oldest first, for the day ending at `day`
 * (its 15:45 UTC): { text, facets, card: { uri, title, description, image }, tagged }. It says how
 * many there are, with "the board" linked, tags up to MAX_TAGS of the people who asked (the first
 * to ask, each once, if Bluesky knows their handle), and asks for help (NUDGES). No titles. Fewer
 * are tagged if that's what it takes to fit. `who` names the askers (whoAre). The card is the
 * board's, as the site's own link preview has it (../../api/_og/describe.js):
 *
 *   5 new asks on the board, from @alice.example, @bob.example, @kai.example and 2 others.
 *
 *   Usage left on your plan before it resets? Pick one up and let your agent do the work.
 */
export async function compose(asks, who = new Map(), day = 0){
  const n = asks.length, people = [...new Set(asks.map(s => s.repo))];
  const taggable = people.filter(d => who.get(d)?.handle);
  const nudge = NUDGES[Math.floor(day / DAY) % NUDGES.length](n === 1);
  const build = k => {
    const tags = taggable.slice(0, k), others = people.length - tags.length, r = rich();
    r.add(n === 1 ? 'A new ask on ' : `${n} new asks on `).link('the board', SITE + '/board');
    if (tags.length) {
      r.add(', from ');
      const parts = tags.map(d => () => r.add('@' + who.get(d).handle, { $type: 'app.bsky.richtext.facet#mention', did: d }));
      if (others) parts.push(() => r.add(`${others} ${others === 1 ? 'other' : 'others'}`));
      parts.forEach((part, i) => { if (i) r.add(i === parts.length - 1 ? ' and ' : ', '); part(); });
    }
    r.add('.\n\n' + nudge);
    return { ...r.build(), tagged: tags };
  };
  let made = build(0);
  for (let k = Math.min(MAX_TAGS, taggable.length); k > 0; k--) { const b = build(k); if (fits(b.text)) { made = b; break; } }
  const page = await describe({ kind: 'board' });
  return { ...made, card: { uri: SITE + '/board', title: page.heading, description: page.description, image: SITE + page.image } };
}
/**
 * The account's posts for a day that tag someone who's been hidden since, or whose asks that day
 * all have: [{ rkey, ask }], `ask` being what's hidden (an ask, or their account). Only a day's
 * post as announce() makes it: its record key is its day's 15:45 UTC, and its card is the board's.
 * Taken down, it's made again without them if it's still that day.
 */
export function taggedHidden(posts, { seeds = [], hidden }){
  if (!hidden?.size) return [];
  return (posts || []).flatMap(p => {
    const at = timeOfTid(p?.rkey), v = p?.value;
    if (!Number.isFinite(at) || p.rkey !== tidAt(boundary(at, true)) || !/\/board\/?$/.test(String(v?.embed?.external?.uri || ''))) return [];
    for (const did of (v.facets || []).flatMap(f => f?.features || []).filter(x => x?.$type === 'app.bsky.richtext.facet#mention' && isDid(x.did)).map(x => x.did)) {
      if (hiddenBy(hidden, null, did)) return [{ rkey: p.rkey, ask: 'at://' + did }];
      // Their asks from that day that it could have counted (not one for mutuals, say, nor one that's closed).
      const theirs = seeds.filter(s => s.repo === did && passable(s.value) && Date.parse(s.value?.createdAt) >= at - DAY && Date.parse(s.value?.createdAt) < at);
      if (theirs.length && theirs.every(s => isHidden(hidden, s))) return [{ rkey: p.rkey, ask: theirs[0].uri }];
    }
    return [];
  });
}

// One call to a server: a query with `params`, or a procedure with `body` (JSON, or bytes of `type`).
async function call(base, nsid, { params, body, type, token, proxy } = {}){
  const query = params ? '?' + new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map(x => [k, String(x)]))) : '';
  const r = await fetch(`${base}/xrpc/${nsid}${query}`, {
    method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(15000),
    headers: {
      ...(body !== undefined ? { 'content-type': type || 'application/json' } : {}),
      ...(token ? { authorization: 'Bearer ' + token } : {}), ...(proxy ? { 'atproto-proxy': proxy } : {})
    },
    body: body === undefined ? undefined : type ? body : JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new net.NetError(data.error || 'HTTP' + r.status, data.message || `${r.status} from ${new URL(base).host}`, r.status);
  return data;
}
// Bluesky lets an account sign in 30 times in 5 minutes and 300 times a day, and past that
// nobody can sign in to it until the day is out, its owner included. So a session is kept and
// renewed, and a sign-in that fails isn't tried again for SIGN_IN_PAUSE: a wrong password tried
// on every run would use them all up.
export const SIGN_IN_PAUSE = 30 * 60e3;
const expired = e => e?.name === 'ExpiredToken' || (e?.name === 'InvalidToken' && !/scope/i.test(e?.message || ''));
/**
 * Signed in as the account with its app password, on the first call that needs it, and kept for
 * as long as this lives: { signIn(), get(nsid, params, { chat }), post(nsid, body, { type, chat }) }.
 * A call whose token has expired renews the session (refreshSession, which doesn't count as a
 * sign-in) and is made again. `chat` sends the call on to Bluesky's chat service, which the app
 * password has to be allowed (its "direct messages" box ticked).
 */
export function session(password, { clock = Date.now } = {}){
  let current = null, signing = null, renewing = null, failed = null;
  const signIn = async () => {
    if (current) return current;
    if (failed && clock() - failed.at < SIGN_IN_PAUSE) throw failed.error;
    return signing ||= (async () => {
      try {
        const pds = await net.pdsOf(ACCOUNT), s = await call(pds, 'com.atproto.server.createSession', { body: { identifier: ACCOUNT, password } });
        failed = null;
        return current = { pds, access: s.accessJwt, refresh: s.refreshJwt };
      } catch (e) { failed = { at: clock(), error: e }; throw e; }
      finally { signing = null; }
    })();
  };
  // Renew the session that `stale` was from, once however many calls find it expired at the same time.
  const renew = stale => current && current.access !== stale ? Promise.resolve() : renewing ||= (async () => {
    try {
      const s = await call(current.pds, 'com.atproto.server.refreshSession', { body: {}, token: current.refresh });
      current = { ...current, access: s.accessJwt, refresh: s.refreshJwt };
    } catch (_) { current = null; await signIn(); }
  })().finally(() => { renewing = null; });
  const as = async (nsid, opts) => {
    const { pds, access } = await signIn(), proxy = opts.chat ? CHAT : undefined;
    try { return await call(pds, nsid, { ...opts, token: access, proxy }); }
    catch (e) {
      if (!expired(e)) throw e;
      await renew(access);
      return call(current.pds, nsid, { ...opts, token: current.access, proxy });
    }
  };
  return {
    signIn: () => signIn().then(() => {}),
    get: (nsid, params, { chat } = {}) => as(nsid, { params, chat }),
    post: (nsid, body, { type, chat } = {}) => as(nsid, { body, type, chat })
  };
}
// The page's link preview picture, uploaded for its card. A post goes without one rather than wait or fail.
async function thumbnail(url, upload){
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'manual' });
    const type = String(r.headers.get('content-type') || '').split(';')[0].trim();
    if (!r.ok || !/^image\/(png|jpeg)$/.test(type)) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    return buf.byteLength && buf.byteLength <= MAX_THUMB ? await upload(buf, type) : null;
  } catch (_) { return null; }
}

/**
 * The day's post, once 15:45 UTC has gone, or with `post: false`, only what it would say (which
 * needs no password). `log` is told each step in a line.
 *
 * { setUp, dryRun, day, count, post: { text, link, uri, error } | null, takenDown }: `day` is the
 * day's 15:45 UTC that the post is for (ISO), `count` how many new asks it counts, `post` the post
 * if this run made it (or would have), and `takenDown` the posts about asks hidden since:
 * [{ ask, uri, error }].
 */
export async function announce({ post = true, password = process.env.RAINSHARE_BLUESKY_APP_PASSWORD, now = Date.now(), log = console.log, read = reader(), as = session(password) } = {}){
  if (post && !password) {
    log(`RAINSHARE_BLUESKY_APP_PASSWORD isn't set, so nothing was posted. Set it to an app password for ${ACCOUNT} (@rainshare.dev) to post there.`);
    return { setUp: false, dryRun: false, day: null, count: 0, post: null, takenDown: [] };
  }
  const day = boundary(now, true), from = day - DAY, rkey = tidAt(day), asked = s => Date.parse(s.value?.createdAt);
  // Takes and turn-ins are read whole: if they can't be, nothing is posted, rather than a count with an ask someone's on.
  const [seeds, takes, deliveries, hidden, mine] = await Promise.all([read(SEED), read(TAKE), read(DELIVERY), read.hidden(), net.listRecords(ACCOUNT, POST, { pages: 3 })]);
  const blocks = await blocked([...new Set(seeds.filter(s => passable(s.value) && asked(s) >= from && asked(s) < day).map(s => s.repo))]);
  const asks = newOnBoard(seeds, { takes, deliveries, from, to: day, hidden, blocks, now }).sort((a, b) => asked(a) - asked(b)), count = asks.length;
  // Posts about asks hidden since: the old ones about one ask, and a day's that tags someone hidden.
  const down = [...hiddenPosts(mine, hidden), ...taggedHidden(mine, { seeds, hidden })].map(d => ({ ...d, uri: net.recordUri(ACCOUNT, POST, d.rkey), error: null }));
  const up = mine.some(x => x.rkey === rkey && !down.some(d => d.rkey === x.rkey));
  const p = !up && count ? { ...(await compose(asks, await whoAre([...new Set(asks.map(s => s.repo))]), day)), uri: null, error: null } : null;
  const result = () => ({ setUp: !!password, dryRun: !post, day: new Date(day).toISOString(), count,
    post: p && { text: p.text, link: p.card.uri, tagged: p.tagged, uri: p.uri, error: p.error }, takenDown: down.map(({ ask, uri, error }) => ({ ask, uri, error })) });
  const when = new Date(day).toISOString().slice(0, 10);
  log(up ? `The post for ${when} is up already.` : count ? `${count} new ${count === 1 ? 'ask' : 'asks'} on the board for ${when}.` : `No new asks on the board for ${when}, so no post.`);
  if (!post) {
    if (p) log(`\nWould post, for ${when}:\n  ${p.text.replace(/\n/g, '\n  ')}\n  [${p.card.title}](${p.card.uri})`);
    for (const d of down) log(`Would take down ${d.uri}: ${d.ask} is hidden.`);
    return result();
  }
  if (!p && !down.length) return result();

  await as.signIn();   // a wrong password stops the run here, before anything is posted
  for (const d of down) {
    try { await as.post('com.atproto.repo.deleteRecord', { repo: ACCOUNT, collection: POST, rkey: d.rkey }); log(`Took down ${d.uri}: ${d.ask} is hidden.`); }
    catch (e) { d.error = e.message; log(`Couldn't take down ${d.uri}: ${e.message}`); }
  }
  if (!p) return result();
  const upload = async (body, type) => (await as.post('com.atproto.repo.uploadBlob', body, { type })).blob || null;
  const thumb = await thumbnail(p.card.image, upload);
  const record = {
    $type: POST, text: p.text, facets: p.facets, langs: ['en'],
    embed: { $type: 'app.bsky.embed.external', external: { uri: p.card.uri, title: p.card.title, description: p.card.description, ...(thumb ? { thumb } : {}) } },
    createdAt: new Date().toISOString()
  };
  try {
    p.uri = (await as.post('com.atproto.repo.createRecord', { repo: ACCOUNT, collection: POST, rkey, record })).uri || null;
    log(`Posted the count for ${when} as ${p.uri}.`);
  } catch (e) {
    // Refused because another run has just posted it: that's done, not failed.
    if (await net.getRecordOrNull(ACCOUNT, POST, rkey).catch(() => null)) { p.uri = net.recordUri(ACCOUNT, POST, rkey); log(`The post for ${when} was made by another run, as ${p.uri}.`); }
    else { p.error = e.message; log(`Couldn't post the count for ${when}: ${e.message}`); }
  }
  return result();
}
