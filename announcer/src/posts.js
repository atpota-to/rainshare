// Posts each new ask on the board to Rainshare's own Bluesky account, @rainshare.dev, once.
//
// The announcer service runs it (./index.js, on the droplet: see ../README.md) whenever something
// happens on the board, and `npm run announce` runs it by hand. Without
// RAINSHARE_BLUESKY_APP_PASSWORD, an app password for the account, it posts nothing.
//
// Which asks are new: open ones meant for everyone, asked in the last three days (WINDOW) and
// at least a quarter of an hour ago (SETTLE), so a title that's fixed straight after posting is
// fixed in the post too. A run posts the earliest asked first, at most MAX_POSTS of them, and
// leaves the rest for the next run.
//
// There's no database, so the account itself says what's been posted. An ask that one of its
// recent posts links to is left alone, whoever wrote the post. And each post takes the ask's own
// record key, so two runs at once can't post the same ask twice: the second is refused.
//
// Only an ask nobody's on yet is posted: as the board's "Nobody on it yet" has it, nobody has
// said they're on it (or their take has lapsed, ../core/takes.js), nothing's been turned in, and
// it isn't done or closed. Nothing is posted for anyone the account blocks, or anyone who blocks
// it, nor anything it has hidden (../core/moderation.js), nor an ask Rainshare's checks find very
// likely a trick on helpers' agents (../core/scan.js). To keep someone's asks off the account,
// block them from it.
//
// And nothing is posted until the approver has said yes to it, by direct message (./review.js),
// for the version of the ask that's there now: an edit asks them again. Without the review queue
// (the index, ./index-db.js), nothing new is posted at all. A post about an ask that's since been
// hidden is taken down.
//
// A post names who's asking (with a mention, so they hear about it) and gives the ask's title,
// with a card for its page: the same words as the page's own link preview
// (../../api/_og/describe.js), and its picture (../../api/og.js).
import { SEED, TAKE, DELIVERY, PROFILE, SITE, MODERATION, MODERATOR, audienceOf } from '../../core/ns.js';
import * as net from '../../core/net.js';
import { askExcerpt, aNoun, progressOf } from '../../core/words.js';
import { decisionsFrom, hiddenBy } from '../../core/moderation.js';
import { isDid } from '../../core/net.js';
import { concerns, alarming } from '../../core/scan.js';
import { clean } from '../../api/_og/describe.js';
import { OWNER } from '../../lexicons/compat.mjs';

// The brand account, which the lexicons belong to as well. Named by its DID, as there.
export const ACCOUNT = OWNER;
export const WINDOW = 3 * 24 * 3600e3, SETTLE = 15 * 60e3, MAX_POSTS = 5;
const POST = 'app.bsky.feed.post', BLOCK = 'app.bsky.graph.block';
// What a post may hold (app.bsky.feed.post), and how big a card's picture may be (app.bsky.embed.external).
const MAX_GRAPHEMES = 300, MAX_BYTES = 3000, MAX_THUMB = 1_000_000;
const TID = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;
// Bluesky's chat service, which the account's own server passes direct messages on to.
const CHAT = 'did:web:api.bsky.chat#bsky_chat';

/** Whether an ask is on the board for everyone: it has a title, it's open, and it's meant for anyone. */
export const forAll = v => typeof v?.title === 'string' && !!clean(v.title) && (!v.state || v.state === 'open') && audienceOf(v) === 'anyone';
/** Whether the account may pass an ask on: on the board for everyone, and not very likely a trick on helpers' agents. */
export const passable = v => forAll(v) && !alarming(concerns(v));
// Who says yes to an ask before the account passes it on (./review.js): dame.is, by DID, so a new
// handle changes nothing. RAINSHARE_APPROVER in the announcer's .env names someone else.
export const APPROVER = isDid(process.env.RAINSHARE_APPROVER) ? process.env.RAINSHARE_APPROVER : 'did:plc:gq4fo3u6tqzzdkjlwzpb23tj';
// The approver's answers that let the account pass an ask on, by way (./review.js): YES is both,
// POST only the account's post, SEND only the new asks in people's direct messages.
export const ALLOWS = { post: ['approved', 'post_only'], send: ['approved', 'send_only'] };
/**
 * Whether the account may pass an ask on `way` ('post' or 'send'): the approver said yes to it
 * that way, for the version of it that's there now (`reviews`, from read.reviews()). Without a
 * way, only a yes to both counts. The approver's own asks, and the account's, need nobody's yes.
 * With no queue to read (`reviews` null), nothing else is.
 */
export function cleared(ask, reviews, way = null, approver = APPROVER){
  if (ask?.repo === ACCOUNT || ask?.repo === approver) return true;
  const r = reviews?.get(ask?.uri);
  return !!r && (ALLOWS[way] || ['approved']).includes(r.status) && !!ask.cid && r.cid === ask.cid;
}
/** Whether the approver has answered about the version of an ask that's there now, whatever they said. */
export function decided(ask, reviews){
  const r = reviews?.get(ask?.uri);
  return !!r && r.status !== 'pending' && !!ask?.cid && r.cid === ask.cid;
}
/** When an ask was passed on: when it was asked, or when it was said yes to, if that was later (ms). */
export function clearedAt(ask, reviews){
  const asked = Date.parse(ask?.value?.createdAt), r = reviews?.get(ask?.uri), yes = [...ALLOWS.post, ...ALLOWS.send].includes(r?.status) ? Date.parse(r.decided_at) : NaN;
  return Number.isFinite(yes) && !(yes <= asked) ? yes : asked;
}
/** Whether an ask is one to post about at `now`: passable, and asked between WINDOW and SETTLE ago. */
export function isNew(v, now){
  const at = Date.parse(v?.createdAt);
  return passable(v) && at > now - WINDOW && at <= now - SETTLE;
}

/**
 * Every public record of a collection, across everyone who has any, read the first time it's
 * asked for and kept for the rest of the run: the review, the posts and the messages read the
 * same asks. From the index (`db`, ./index-db.js) while it's fresh, and otherwise from every
 * repo that has any.
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
  // The review queue (./review.js), for asks from the last few days. Null when there's none to
  // read, and then nothing new is passed on.
  let reviews;
  read.reviews = () => reviews ||= !db ? Promise.resolve(null)
    : db.reviews(Date.now() - WINDOW - 24 * 3600e3).catch(e => { log(`The review queue couldn’t be read (${e.message}), so nothing new is passed on this run.`); return null; });
  return read;
}
/** Whether a record (or its whole account) is hidden, by the decisions from read.hidden(). */
export const isHidden = (decisions, rec) => !!hiddenBy(decisions, rec?.uri, rec?.repo);

/** The new asks on the board, the earliest asked first. */
async function newAsks(now, read){
  const [seeds, hidden] = await Promise.all([read(SEED), read.hidden()]);
  return seeds.filter(r => isNew(r.value, now) && !isHidden(hidden, r)).sort((a, b) => Date.parse(a.value.createdAt) - Date.parse(b.value.createdAt));
}

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
// What the account has posted about lately: the asks its last 300 posts link to, those posts' own keys, and the posts.
async function postedAlready(){
  const posts = await net.listRecords(ACCOUNT, POST, { pages: 3 });
  return { links: new Set(posts.flatMap(p => linksIn(p.value).map(askAt).filter(Boolean))), keys: new Set(posts.map(p => p.rkey)), posts };
}
/**
 * The account's posts about asks that have since been hidden (or whose asker has): [{ rkey, ask }].
 * Only its own posts about an ask, as compose() writes them (a card for the ask's page, and a
 * mention of who's asking), never anything written by hand.
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
const posted = (ask, who, done) => done.keys.has(ask.rkey) || done.links.has(`${ask.repo.toLowerCase()} ${ask.rkey}`) || (!!who?.handle && done.links.has(`${who.handle} ${ask.rkey}`));

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

// Those of `asks` that haven't been posted and whose askers aren't blocked, each with `who` asked.
async function unposted(asks, { read, now }){
  if (!asks.length) return Object.assign([], { done: await postedAlready(), hidden: await read.hidden() });
  const authors = [...new Set(asks.map(a => a.repo))];
  // Takes and turn-ins are read whole: if they can't be, nothing is posted, rather than an ask someone's on.
  const [done, blocks, who, takes, deliveries, hidden] = await Promise.all([postedAlready(), blocked(authors), whoAre(authors), read(TAKE), read(DELIVERY), read.hidden()]);
  const todo = asks.filter(a => !blocks.has(a.repo) && !posted(a, who.get(a.repo), done) && free(a, { takes, deliveries, hidden, blocks, now }))
    .map(a => ({ ...a, who: who.get(a.repo) }));
  return Object.assign(todo, { done, hidden });
}
/**
 * Whether nobody's on an ask: what the board calls "Nobody on it yet" (progressOf in
 * ../core/words.js). Nobody holds it with a take that hasn't lapsed, nothing's been turned in,
 * and it isn't done or closed. As on the board, a take or turn-in that's hidden, or from someone
 * in `blocks`, doesn't count, so nobody can keep an ask off the account by saying they're on it.
 */
export function free(ask, { takes = [], deliveries = [], hidden = new Map(), blocks = new Set(), now = Date.now() } = {}){
  const on = list => list.filter(r => r.value?.seed?.uri === ask.uri && !isHidden(hidden, r) && !blocks.has(r.repo));
  return progressOf({ ...ask, takes: on(takes), deliveries: on(deliveries) }, null, now).key === 'open';
}

const segmenter = typeof Intl?.Segmenter === 'function' ? new Intl.Segmenter() : null;
export const graphemes = s => segmenter ? Array.from(segmenter.segment(s), x => x.segment) : [...s];
export const bytes = s => new TextEncoder().encode(s).length;
const fits = s => graphemes(s).length <= MAX_GRAPHEMES && bytes(s) <= MAX_BYTES;

/**
 * What to post about an ask, given who asked ({ did, handle, name }):
 * { text, facets, card: { uri, title, description, image } }. The text names them, with a
 * mention, and gives the title, cut short if that's what it takes to fit in a post:
 *
 *   Alice (@alice.example) is asking for help with a project:
 *
 *   Keep drafts out of the feed
 */
export function compose(ask, who){
  const v = ask.value, at = who.handle ? '@' + who.handle : '';
  const opening = name => at ? (name ? `${name} (${at})` : at) : name || 'Someone';
  const rest = ` is asking for help with ${aNoun(v)}:\n\n`;
  // A name that leaves no room for the title is left out: the mention says who it is.
  const name = who.name && who.name !== at && fits(opening(who.name) + rest + '…') ? who.name : '';
  const start = opening(name) + rest;
  let title = graphemes(clean(v.title, 120)), text = start + title.join('');
  while (!fits(text) && title.length) { title = title.slice(0, -1); text = start + title.join('').trimEnd() + '…'; }
  const before = name ? name + ' (' : '';
  const facets = at ? [{ index: { byteStart: bytes(before), byteEnd: bytes(before + at) }, features: [{ $type: 'app.bsky.richtext.facet#mention', did: who.did }] }] : [];
  const excerpt = clean(askExcerpt(typeof v.spec === 'string' ? v.spec : ''), 200);
  return {
    text, facets,
    card: {
      uri: `${SITE}/seed/${who.handle || ask.repo}/${ask.rkey}`,
      title: clean(v.title, 120),
      description: excerpt || `${who.name || at || 'Someone'} is asking for help with ${aNoun(v)} on Rainshare.`,
      image: `${SITE}/api/og?kind=seed&who=${encodeURIComponent(ask.repo)}&rkey=${encodeURIComponent(ask.rkey)}`
    }
  };
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
 * Post the board's new asks to the account, or with `post: false`, only say what would be
 * posted (which needs no password). `log` is told each step in a line.
 *
 * { setUp, dryRun, found, skipped, waiting, posts: [{ ask, text, link, uri, error }], later, takenDown }:
 * `found` is how many asks were new, `skipped` how many of them were posted already, blocked or
 * taken up, `waiting` how many are waiting for the approver's answer (./review.js), `later` how many
 * are left for the next run, and `takenDown` the posts about asks hidden since: [{ ask, uri, error }].
 */
export async function announce({ post = true, password = process.env.RAINSHARE_BLUESKY_APP_PASSWORD, now = Date.now(), max = MAX_POSTS, log = console.log, read = reader(), as = session(password) } = {}){
  if (post && !password) {
    log(`RAINSHARE_BLUESKY_APP_PASSWORD isn't set, so nothing was posted. Set it to an app password for ${ACCOUNT} (@rainshare.dev) to post new asks there.`);
    return { setUp: false, dryRun: false, found: 0, skipped: 0, waiting: 0, posts: [], later: 0, takenDown: [] };
  }
  const asks = await newAsks(now, read), todo = await unposted(asks, { read, now }), reviews = read.reviews ? await read.reviews() : null;
  // Ready: the approver said YES or POST. Waiting: they haven't answered yet. The rest (NO, SEND) aren't posted.
  const ready = todo.filter(a => cleared(a, reviews, 'post')), waiting = todo.filter(a => !cleared(a, reviews, 'post') && !decided(a, reviews)).length;
  const posts = ready.slice(0, max).map(a => ({ ask: a.uri, rkey: a.rkey, ...compose(a, a.who), uri: null, error: null }));
  const down = hiddenPosts(todo.done.posts, todo.hidden).map(d => ({ ...d, uri: net.recordUri(ACCOUNT, POST, d.rkey), error: null }));
  const result = () => ({ setUp: !!password, dryRun: !post, found: asks.length, skipped: asks.length - todo.length, waiting,
    posts: posts.map(({ ask, text, card, uri, error }) => ({ ask, text, link: card.uri, uri, error })), later: ready.length - posts.length,
    takenDown: down.map(({ ask, uri, error }) => ({ ask, uri, error })) });
  log(`${asks.length} new ${asks.length === 1 ? 'ask' : 'asks'}, ${asks.length - todo.length} posted already, blocked or with someone on them, ${waiting} waiting for review${reviews ? '' : ' (there’s no review queue to read)'}, ${posts.length} to post${ready.length > posts.length ? `, ${ready.length - posts.length} left for next time` : ''}.`);
  if (!post) {
    for (const p of posts) log(`\nWould post, for ${p.ask}:\n  ${p.text.replace(/\n/g, '\n  ')}\n  [${p.card.title}](${p.card.uri})`);
    for (const d of down) log(`Would take down ${d.uri}: ${d.ask} is hidden.`);
    return result();
  }
  if (!posts.length && !down.length) return result();

  await as.signIn();   // a wrong password stops the run here, before anything is posted
  for (const d of down) {
    try { await as.post('com.atproto.repo.deleteRecord', { repo: ACCOUNT, collection: POST, rkey: d.rkey }); log(`Took down ${d.uri}: ${d.ask} is hidden.`); }
    catch (e) { d.error = e.message; log(`Couldn't take down ${d.uri}: ${e.message}`); }
  }
  const upload = async (body, type) => (await as.post('com.atproto.repo.uploadBlob', body, { type })).blob || null;
  const thumbs = await Promise.all(posts.map(p => thumbnail(p.card.image, upload)));
  for (const [i, p] of posts.entries()) {
    const rkey = TID.test(p.rkey) ? p.rkey : undefined;
    const record = {
      $type: POST, text: p.text, ...(p.facets.length ? { facets: p.facets } : {}), langs: ['en'],
      embed: { $type: 'app.bsky.embed.external', external: { uri: p.card.uri, title: p.card.title, description: p.card.description, ...(thumbs[i] ? { thumb: thumbs[i] } : {}) } },
      createdAt: new Date().toISOString()
    };
    try {
      p.uri = (await as.post('com.atproto.repo.createRecord', { repo: ACCOUNT, collection: POST, ...(rkey ? { rkey } : {}), record })).uri || null;
      log(`Posted ${p.ask} as ${p.uri}.`);
    } catch (e) {
      // Refused because another run has just posted it: that's done, not failed.
      if (rkey && await net.getRecordOrNull(ACCOUNT, POST, rkey).catch(() => null)) { p.uri = net.recordUri(ACCOUNT, POST, rkey); log(`${p.ask} was posted by another run, as ${p.uri}.`); }
      else { p.error = e.message; log(`Couldn't post ${p.ask}: ${e.message}`); }
    }
  }
  return result();
}
