// Direct messages from @rainshare.dev, to people who've asked for them in their Rainshare
// settings (`notify` in dev.rainshare.preferences, set beside their profile):
//
//   updates   news about their own asks (someone's on one, work's been turned in) and about
//             asks they've helped with (marked done with their work or someone else's, or closed)
//   newAsks   new asks on the board, from anyone
//
// Each person gets at most one message a day, from the daily run (api/announce.js), and only
// when there's something to say. It's sent with the same app password as the posts, which has
// to be allowed to send direct messages.
//
// What's been sent, with no database: each message covers whole periods, from one BOUNDARY to
// the next, so the last message the account sent someone says how far they've heard. The next
// one starts at the boundary before that message and stops at the boundary before now. A
// boundary falls a quarter of an hour before the daily run (16:00 UTC in vercel.json), so a run
// never straddles one, and what's only just been written waits a day rather than going out
// half done. Running more often (Vercel Pro), make PERIOD shorter to match.
//
// Nothing the account has hidden (../core/moderation.js) is in anyone's news, and it doesn't
// message an account it has hidden.
//
// Stopping, three ways, and any one does it:
//   - switch them off in their settings, beside their profile
//   - reply STOP to any message. Their latest STOP or START in the conversation is what
//     counts, and a STOP is answered once, to say it worked.
//   - Bluesky's own settings: leave the conversation, or stop letting @rainshare.dev message them
import { SEED, TAKE, DELIVERY, PREFERENCES, SITE } from '../core/ns.js';
import * as net from '../core/net.js';
import { aNoun } from '../core/words.js';
import { ACCOUNT, passable, isHidden, reader, session, blocked, whoAre, graphemes, bytes } from './_announce.js';
import { clean } from './_og/describe.js';

const HOUR = 3600e3, DAY = 24 * HOUR;
export const PERIOD = DAY, BOUNDARY = 15.75 * HOUR, LOOKBACK = 3 * DAY;
/** The latest boundary at or before `t`. */
export const boundary = t => Math.floor((t - BOUNDARY) / PERIOD) * PERIOD + BOUNDARY;
// What a message may hold (chat.bsky.convo.defs#messageInput), and how many of each kind of news it lists.
const MAX_GRAPHEMES = 1000, MAX_BYTES = 10000, MAX_UPDATES = 10, MAX_NEW = 5;
const STOP = /^\W*(stop|unsubscribe|opt out)\W*$/i, START = /^\W*(start|unstop|resume)\W*$/i;

/** What someone has asked for: { updates, newAsks }, each true or false. */
export const wants = profile => ({ updates: profile?.notify?.updates === true, newAsks: profile?.notify?.newAsks === true });

/* ---------- writing a message ---------- */
// Text in pieces, some of them links or mentions, put together with the byte offsets Bluesky's facets need.
function rich(){
  const parts = [];
  const self = {
    add(text, feature){ parts.push({ text: String(text), feature }); return self; },
    link: (text, uri) => self.add(text, uri ? { $type: 'app.bsky.richtext.facet#link', uri } : null),
    get text(){ return parts.map(p => p.text).join(''); },
    build(){
      let at = 0;
      const facets = [];
      for (const p of parts) {
        const n = bytes(p.text);
        if (p.feature && n) facets.push({ index: { byteStart: at, byteEnd: at + n }, features: [p.feature] });
        at += n;
      }
      return { text: self.text, facets };
    }
  };
  return self;
}
const fits = s => graphemes(s).length <= MAX_GRAPHEMES && bytes(s) <= MAX_BYTES;
const title = sq => clean(sq?.value?.title, 80);
const pageOf = (sq, who) => `${SITE}/seed/${who.get(sq.repo)?.handle || sq.repo}/${sq.rkey}`;
// Someone, as a message names them: "Juniper (@juniper.example)", with the handle a mention.
function person(r, p){
  const at = p?.handle ? '@' + p.handle : '', name = p?.name && p.name !== at ? p.name : '';
  if (!at) return r.add(name || 'Someone');
  if (name) r.add(name + ' (');
  r.add(at, { $type: 'app.bsky.richtext.facet#mention', did: p.did });
  return name ? r.add(')') : r;
}
const shortLink = u => u.replace(/^https?:\/\//, '').replace(/\/$/, '');
// The last line of every message the run sends, and how it knows them again: a link to the profile page.
const footer = (r, start) => r.add(`\n\nReply ${start ? 'START to have them again' : 'STOP to stop these'}, or choose what you get at `).link(shortLink(SITE + '/me'), SITE + '/me').add('.');
const isOurs = m => m?.sender?.did === ACCOUNT && (m.facets || []).some(f => (f?.features || []).some(x => /^https?:\/\/[^/]+\/me$/.test(String(x?.uri || ''))));

/** One line of news, written into `r`. */
function line(r, n, who){
  const ask = () => r.add('“').link(title(n.seed), pageOf(n.seed, who)).add('”');
  r.add('\n• ');
  if (n.kind === 'take') { person(r, who.get(n.by)); r.add(' is on your ask '); ask(); return r.add('.'); }
  if (n.kind === 'delivery') {
    person(r, who.get(n.by)); r.add(' turned in work on your ask '); ask();
    return n.url ? r.add(': ').link(shortLink(n.url), n.url) : r.add('.');
  }
  if (n.kind === 'new') { ask(); r.add(`: ${aNoun(n.seed.value)} from `); return person(r, who.get(n.by)); }
  person(r, who.get(n.by));
  if (n.kind === 'closed') { r.add(' closed '); ask(); return r.add('.'); }
  r.add(' marked '); ask();
  return r.add(n.kind === 'done-yours' ? ' done with your work. It’s in your garden now.' : ' done, with someone else’s work.');
}

/**
 * A message with someone's news: { text, facets }, or null when there's none. `updates` and
 * `fresh` are lists of news ({ kind, seed, by, url }); `who` names everyone in them. As much is
 * listed as fits in a message, and the rest is counted.
 */
export function compose({ updates = [], fresh = [] }, who){
  if (!updates.length && !fresh.length) return null;
  const r = rich();
  // Each line goes in only if the message would still fit with the lines after it counted and the footer on.
  const room = extra => fits(r.text + extra + '\n• and 99 more on the board.' + '\n\nReply STOP to stop these, or choose what you get at ' + shortLink(SITE + '/me') + '.');
  const list = (news, max, more) => {
    let shown = 0;
    for (const n of news.slice(0, max)) {
      const trial = line(rich(), n, who).text;
      if (!room(trial)) break;
      line(r, n, who); shown++;
    }
    if (news.length > shown) more(news.length - shown);
  };
  if (updates.length) {
    r.add('News from Rainshare:');
    list(updates, MAX_UPDATES, n => r.add(`\n• and ${n} more.`));
  }
  if (fresh.length) {
    r.add(updates.length ? '\n\nNew asks:' : 'New asks on Rainshare:');
    list(fresh, MAX_NEW, n => r.add(`\n• and ${n} more on `).link('the board', SITE + '/board').add('.'));
  }
  return footer(r).build();
}
/** What a STOP is answered with. */
export const stopped = () => footer(rich().add('Okay, no more messages from Rainshare.'), true).build();

/* ---------- whose news is what ---------- */
const within = (t, from, to) => { const x = Date.parse(t); return x >= from && x < to; };
/**
 * Someone's news from `from` up to `to`: { updates, fresh }, each oldest first. `theirBlocks` is
 * who they block, whose doings aren't news to them; `ourBlocks` is who the account blocks,
 * whose asks it doesn't pass on; `hidden` is what it has hidden (decisions from
 * ../core/moderation.js), which is nobody's news.
 */
export function newsFor(r, { seeds, takes, deliveries, from, to, theirBlocks = new Set(), ourBlocks = new Set(), hidden = new Map() }){
  const shown = list => list.filter(x => !isHidden(hidden, x));
  [seeds, takes, deliveries] = [shown(seeds), shown(takes), shown(deliveries)];
  const updates = [], bySeed = new Map(seeds.map(s => [s.uri, s])), at = x => Date.parse(x.value?.createdAt);
  if (r.updates) {
    const onMine = list => list.filter(x => bySeed.get(x.value?.seed?.uri)?.repo === r.did && x.repo !== r.did && !theirBlocks.has(x.repo) && within(x.value?.createdAt, from, to));
    const turnedIn = onMine(deliveries);
    for (const d of turnedIn) updates.push({ kind: 'delivery', seed: bySeed.get(d.value.seed.uri), by: d.repo, url: /^https?:\/\//.test(d.value?.url || '') ? d.value.url : null, at: at(d) });
    // Someone who's turned in work is on it, so that's said once.
    for (const t of onMine(takes)) if (!turnedIn.some(d => d.repo === t.repo && d.value.seed.uri === t.value.seed.uri)) updates.push({ kind: 'take', seed: bySeed.get(t.value.seed.uri), by: t.repo, at: at(t) });
    // Asks they've been on that were marked done or closed in the time.
    const mine = list => list.filter(x => x.repo === r.did);
    for (const uri of new Set([...mine(takes), ...mine(deliveries)].map(x => x.value?.seed?.uri))) {
      const sq = bySeed.get(uri), state = sq?.value?.state;
      if (!sq || sq.repo === r.did || theirBlocks.has(sq.repo) || !['sprouted', 'closed'].includes(state) || !within(sq.value.updatedAt, from, to)) continue;
      const theirs = new Set(mine(deliveries).map(d => d.uri)), withTheirs = (sq.value.sproutedWith || []).some(ref => theirs.has(ref?.uri));
      updates.push({ kind: state === 'closed' ? 'closed' : withTheirs ? 'done-yours' : 'done', seed: sq, by: sq.repo, at: Date.parse(sq.value.updatedAt) });
    }
  }
  const fresh = !r.newAsks ? [] : seeds.filter(s => s.repo !== r.did && !theirBlocks.has(s.repo) && !ourBlocks.has(s.repo) && passable(s.value) && within(s.value.createdAt, from, to))
    .map(s => ({ kind: 'new', seed: s, by: s.repo, at: at(s) }));
  const order = (a, b) => a.at - b.at;
  return { updates: updates.sort(order), fresh: fresh.sort(order) };
}

/* ---------- the conversation ---------- */
// The account can't send direct messages: the app password wasn't allowed to.
const noChat = e => /scope|not allowed|privileged/i.test(`${e?.name} ${e?.message}`);
/**
 * Where things stand with someone, from the account's conversation with them:
 * { canChat, convoId, last, said, acked }. `last` is when the run last sent them a message (ms),
 * `said` is their latest STOP or START ('stop', 'start' or null), and `acked` whether the run has
 * sent anything since a STOP.
 */
export async function standing(as, did){
  const none = { canChat: false, convoId: null, last: null, said: null, acked: false };
  let a;
  try { a = await as.get('chat.bsky.convo.getConvoAvailability', { members: [did] }, { chat: true }); }
  catch (e) {
    if (noChat(e)) throw e;
    // Asking for the conversation itself says the same, by failing when they can't be messaged.
    try { a = { canChat: true, convo: (await as.get('chat.bsky.convo.getConvoForMembers', { members: [did] }, { chat: true })).convo }; }
    catch (e2) { if (noChat(e2)) throw e2; return none; }
  }
  const convoId = a?.convo?.id || null;
  if (!a?.canChat && !convoId) return none;
  const messages = convoId ? (await as.get('chat.bsky.convo.getMessages', { convoId, limit: 100 }, { chat: true })).messages || [] : [];
  // Newest first.
  const ours = messages.findIndex(isOurs);
  const cmd = messages.findIndex(m => m?.sender?.did === did && (STOP.test(m.text || '') || START.test(m.text || '')));
  const said = cmd < 0 ? null : STOP.test(messages[cmd].text) ? 'stop' : 'start';
  return { canChat: !!a.canChat, convoId, last: ours < 0 ? null : Date.parse(messages[ours].sentAt), said, acked: said === 'stop' && ours >= 0 && ours < cmd };
}
async function send(as, did, convoId, message){
  const id = convoId || (await as.get('chat.bsky.convo.getConvoForMembers', { members: [did] }, { chat: true })).convo?.id;
  if (!id) throw new Error('Bluesky didn’t open a conversation');
  return as.post('chat.bsky.convo.sendMessage', { convoId: id, message }, { chat: true });
}

/**
 * Send each person who's asked for messages their news, or with `post: false`, only say what
 * would be sent. A dry run with the password reads the conversations to know what's been sent;
 * without it, it shows a day's news for everyone. `log` is told each step in a line.
 *
 * { setUp, dryRun, asked, sent: [{ to, text, error }], skipped: [{ to, why }], note }: `asked`
 * is how many people have asked for messages.
 */
export async function message({ post = true, password = process.env.RAINSHARE_BLUESKY_APP_PASSWORD, now = Date.now(), log = console.log, read = reader(), as = session(password) } = {}){
  const out = { setUp: !!password, dryRun: !post, asked: 0, sent: [], skipped: [], note: null };
  if (post && !password) { log('No messages were sent: RAINSHARE_BLUESKY_APP_PASSWORD isn\'t set.'); return out; }
  const people = (await read(PREFERENCES)).filter(p => p.rkey === 'self' && p.repo !== ACCOUNT).map(p => ({ did: p.repo, ...wants(p.value) })).filter(p => p.updates || p.newAsks);
  out.asked = people.length;
  if (!people.length) { log('Nobody has asked for messages yet.'); return out; }

  const to = boundary(now);
  const [seeds, takes, deliveries, hidden] = await Promise.all([read(SEED), read(TAKE).catch(() => []), read(DELIVERY).catch(() => []), read.hidden()]);
  // Who the account won't deal with: those it blocks or who block it, among the people asking and anyone whose new ask it could pass on.
  const askers = seeds.filter(s => passable(s.value) && within(s.value.createdAt, to - LOOKBACK, to)).map(s => s.repo);
  const ourBlocks = await blocked([...new Set([...people.map(p => p.did), ...askers])]);
  const skip = (p, why) => { out.skipped.push({ to: p.did, why }); log(`Not messaging ${p.did}: ${why}`); };
  if (password) await as.signIn();

  // One at a time, so a password that can't send messages is found out once, not once a person.
  const ready = [];
  for (const p of people) {
    if (ourBlocks.has(p.did)) { skip(p, 'the account blocks them, or they block it.'); continue; }
    if (isHidden(hidden, { repo: p.did })) { skip(p, 'the account has hidden them.'); continue; }
    let st = { canChat: true, convoId: null, last: null, said: null, acked: false };
    if (password) {
      try { st = await standing(as, p.did); }
      catch (e) {
        if (!noChat(e)) { skip(p, `couldn't read the conversation (${e.message}).`); continue; }
        out.note = 'The app password can’t send direct messages. Make a new one with “Allow access to your direct messages” ticked, and set it as RAINSHARE_BLUESKY_APP_PASSWORD.';
        log(out.note); return out;
      }
    }
    if (!st.canChat) { skip(p, `Bluesky won't let the account message them. They'd need to follow @rainshare.dev, or let anyone message them.`); continue; }
    if (st.said === 'stop') {
      if (!st.acked) ready.push({ p, st, message: stopped(), stop: true });
      else skip(p, 'they replied STOP.');
      continue;
    }
    if (st.last != null && st.last >= to) { skip(p, 'they’ve had today’s message.'); continue; }
    const from = st.last == null ? to - PERIOD : Math.max(boundary(st.last), to - LOOKBACK);
    ready.push({ p, st, from });
  }
  if (!password && post === false) log('Without the password, the conversations can’t be read, so this is the last day’s news for everyone who’s asked.');

  // What each of them has to hear, and everyone it names.
  const theirBlocks = new Map(await Promise.all(ready.filter(x => !x.stop).map(async x => [x.p.did, await net.blocksOf(x.p.did)])));
  for (const x of ready) if (!x.stop) x.news = newsFor(x.p, { seeds, takes, deliveries, from: x.from, to, theirBlocks: theirBlocks.get(x.p.did), ourBlocks, hidden });
  const named = [...new Set(ready.flatMap(x => [x.p.did, ...(x.news ? [...x.news.updates, ...x.news.fresh].flatMap(n => [n.by, n.seed.repo]) : [])]))];
  const who = await whoAre(named);
  for (const x of ready) if (!x.stop) x.message = compose(x.news, who);

  for (const x of ready) {
    const at = who.get(x.p.did)?.handle ? '@' + who.get(x.p.did).handle : x.p.did;
    if (!x.message) { log(`Nothing new for ${at}.`); continue; }
    const sent = { to: x.p.did, text: x.message.text, error: null };
    out.sent.push(sent);
    if (!post) { log(`\nWould message ${at}:\n  ${x.message.text.replace(/\n/g, '\n  ')}`); continue; }
    try { await send(as, x.p.did, x.st.convoId, x.message); log(`Messaged ${at}${x.stop ? ', to say they won’t hear from it again' : ''}.`); }
    catch (e) { sent.error = e.message; log(`Couldn't message ${at}: ${e.message}`); }
  }
  return out;
}
