// Direct messages from @rainshare.dev, to people who've asked for them in their Rainshare
// settings (`notify` in dev.rainshare.preferences, set on the site's Settings page, /settings):
//
//   updates   news about their own asks (someone's on one, work's been turned in) and about
//             asks they've helped with (marked done with their work or someone else's, or closed)
//   newAsks   how many new asks there are on the board, of the kinds they picked, from whoever
//             they picked:
//     projects  asks with a repo or an issue. Counted unless they've said not.
//     ideas     asks with no repo yet. Only counted once they've said so: off for everyone to
//               begin with, including whoever had new asks on before there was a choice.
//     from      anyone (the default), or only people they know, as the board's "Who asked"
//               has it (../../core/ties.js): mutuals, people they follow, people who follow
//               them (a follow on Bluesky or Tangled counts), or people their Tangled circle
//               vouched for (../../core/vouch.js). Who they know is read from the network,
//               where it's all public, as the site reads it for the board, and only on a run
//               with a count due for them and an ask it could count.
//
// The announcer service (./index.js) runs this a minute or two after anything happens on the
// board. Each run sends each person one message at most, and only when there's something to
// say: their updates since the last one, so they hear within a couple of minutes, and once a
// day, after DAILY, how many new asks there are on the board. That's only a count, with a link to
// the board: no titles, and nobody's name. It's sent with the same app password as the posts,
// which has to be allowed to send direct messages.
//
// What's been sent, with no database: each message covers whole periods, from one boundary to
// the next, so what the account last sent someone says how far they've heard. Updates go by
// minutes (EVERY), and new asks by days (from DAILY to DAILY). The next message starts at the
// boundary before the last one and stops at the boundary before now. The service runs this half
// a minute past a boundary, and a run stops sending before the next boundary (GUARD), so no
// message is sent in the period after the one its run began in; whoever it didn't reach hears
// next run. A run that starts too near a boundary (one run by hand, say) leaves the messages to
// the next. A first message catches up on the day before.
//
// Nothing the account has hidden (../core/moderation.js) is in anyone's news, and it doesn't
// message an account it has hidden. The day's new asks are the ones on the board, open to
// everyone, that nobody's on yet, counted for the day they were asked. The count names no ask
// and nobody, and the board shows them all anyway. @rainshare.dev's post for the day
// (./posts.js) counts the same asks.
//
// Stopping, three ways, and any one does it:
//   - switch them off in their settings (/settings)
//   - reply STOP to any message. Their latest STOP or START in the conversation is what
//     counts, and a STOP is answered once, to say it worked.
//   - Bluesky's own settings: leave the conversation, or stop letting @rainshare.dev message them
import { SEED, TAKE, DELIVERY, PREFERENCES, SITE, ASKS_FROM, messagesOf } from '../../core/ns.js';
import * as net from '../../core/net.js';
import { updatesFor } from '../../core/news.js';
import { nounOf } from '../../core/words.js';
import { fromMatches, tangledFollowsOf } from '../../core/ties.js';
import { circleOf, wordOn } from '../../core/vouch.js';
import { ACCOUNT, passable, free, isHidden, reader, session, blocked, whoAre, graphemes, bytes } from './posts.js';
import { clean } from '../../api/_og/describe.js';

const MINUTE = 60e3, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
// Updates by the minute; new asks by the day, from 15:45 UTC; nothing older than LOOKBACK.
// GUARD: how near the next boundary a run stops sending, so that nothing it sends lands after it.
export const EVERY = MINUTE, DAILY = 15.75 * HOUR, LOOKBACK = 3 * DAY, GUARD = 15e3;
/** The latest boundary at or before `t`: by minutes, or with `day`, by days from DAILY. */
export const boundary = (t, day = false) => day ? Math.floor((t - DAILY) / DAY) * DAY + DAILY : Math.floor(t / EVERY) * EVERY;
// What a message may hold (chat.bsky.convo.defs#messageInput), and how many updates it lists.
const MAX_GRAPHEMES = 1000, MAX_BYTES = 10000, MAX_UPDATES = 10;
const STOP = /^\W*(stop|unsubscribe|opt out)\W*$/i, START = /^\W*(start|unstop|resume)\W*$/i;

/** What someone has asked for: { updates, newAsks, projects, ideas, from } (messagesOf, ../../core/ns.js). */
export const wants = profile => messagesOf(profile?.notify);

/* ---------- writing a message ---------- */
// Text in pieces, some of them links or mentions, put together with the byte offsets Bluesky's facets need.
export function rich(){
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
export function person(r, p){
  const at = p?.handle ? '@' + p.handle : '', name = p?.name && p.name !== at ? p.name : '';
  if (!at) return r.add(name || 'Someone');
  if (name) r.add(name + ' (');
  r.add(at, { $type: 'app.bsky.richtext.facet#mention', did: p.did });
  return name ? r.add(')') : r;
}
export const shortLink = u => u.replace(/^https?:\/\//, '').replace(/\/$/, '');
// The last line of every message the run sends, and how it knows them again: a link to the
// settings page. One that counts the day's new asks also links to the board, and that link is how
// a run knows someone has had them, so it has to stay. (Messages from before settings had a page
// of their own linked to the profile page, /me, and count too: the last one someone was sent
// still says how far they've heard. So do the ones from before new asks were only counted, which
// listed them under a heading linked to the board.)
const footer = (r, start) => r.add(`\n\nReply ${start ? 'START to have them again' : 'STOP to stop these'}, or choose what you get at `).link(shortLink(SITE + '/settings'), SITE + '/settings').add('.');
const links = (m, path) => (m?.facets || []).some(f => (f?.features || []).some(x => new RegExp(`^https?://[^/]+${path}$`).test(String(x?.uri || ''))));
/** Whether a message in a conversation is one of these, from the account: news, or the answer to a STOP. */
export const isOurs = m => m?.sender?.did === ACCOUNT && (links(m, '/settings') || links(m, '/me'));
const hasNewAsks = m => isOurs(m) && links(m, '/board');

/** One line of news, written into `r`. */
function line(r, n, who){
  const ask = () => r.add('“').link(title(n.seed), pageOf(n.seed, who)).add('”');
  r.add('\n• ');
  if (n.kind === 'take') { person(r, who.get(n.by)); r.add(' is on your ask '); ask(); return r.add('.'); }
  if (n.kind === 'delivery') {
    person(r, who.get(n.by)); r.add(' turned in work on your ask '); ask();
    return n.url ? r.add(': ').link(shortLink(n.url), n.url) : r.add('.');
  }
  person(r, who.get(n.by));
  if (n.kind === 'closed') { r.add(' closed '); ask(); return r.add('.'); }
  r.add(' marked '); ask();
  return r.add(n.kind === 'done-yours' ? ' done with your work. It’s in your garden now.' : ' done, with someone else’s work.');
}

/**
 * What the new asks counted are called, for one and for more, by what someone picked (`what`,
 * as wants has it): ['a new ask on the board', 'new asks on the board'], 'project' or 'idea'
 * in place of 'ask' when only one kind is counted, and who they're from when that's narrowed:
 * ['a new idea on the board from someone you follow', 'new ideas on the board from people you
 * follow']. With `what` left out, every kind, from anyone.
 */
export function askWords({ projects = true, ideas = true, from = 'anyone' } = {}){
  const [one, more] = projects && !ideas ? ['project', 'projects'] : ideas && !projects ? ['idea', 'ideas'] : ['ask', 'asks'];
  const [, , byOne, byMore] = ASKS_FROM.find(([k]) => k === from) || ASKS_FROM[0];
  return [`a new ${one} on the board${byOne ? ' from ' + byOne : ''}`, `new ${more} on the board${byMore ? ' from ' + byMore : ''}`];
}
/** How many new asks there are, written into `r`: "There are 5 new asks on the board: rainshare.dev/board." `what` says which (askWords). */
export function counted(r, n, what){
  const [one, more] = askWords(what);
  return r.add(n === 1 ? `There’s ${one}: ` : `There are ${n} ${more}: `).link(shortLink(SITE + '/board'), SITE + '/board').add('.');
}

/**
 * A message with someone's news: { text, facets }, or null when there's none. `updates` and
 * `fresh` are lists of news ({ kind, seed, by, url }); `who` names everyone in the updates. As
 * many updates are listed as fit in a message, and the rest are counted. The new asks are only
 * counted, and called what `what` says they are (askWords).
 */
export function compose({ updates = [], fresh = [], what }, who){
  if (!updates.length && !fresh.length) return null;
  const r = rich();
  // How it ends: how many new asks there are, if there are any, and the way to stop these.
  const end = x => footer(fresh.length ? counted(updates.length ? x.add('\n\n') : x, fresh.length, what) : x);
  if (updates.length) {
    r.add('Updates from Rainshare:');
    // Each update goes in only if the message would still fit with the rest counted and its end on.
    const rest = '\n• and 99 more.' + end(rich()).text;
    let shown = 0;
    for (const n of updates.slice(0, MAX_UPDATES)) {
      if (!fits(r.text + line(rich(), n, who).text + rest)) break;
      line(r, n, who); shown++;
    }
    if (updates.length > shown) r.add(`\n• and ${updates.length - shown} more.`);
  }
  return end(r).build();
}
/** What a STOP is answered with. */
export const stopped = () => footer(rich().add('Okay, no more messages from Rainshare.'), true).build();

/* ---------- whose news is what ---------- */
const inside = (x, from, to) => x >= from && x < to;
const askedAt = s => Date.parse(s?.value?.createdAt);
/**
 * The new asks the day's message counts, asked from `from` up to `to`: on the board for everyone
 * and not very likely a trick (`passable`, ./posts.js), not hidden, nobody on them as of `now`
 * (`free`), and not from anyone in `blocks` or from `except` (whoever the message is for).
 */
export function newOnBoard(seeds, { takes = [], deliveries = [], from, to, hidden = new Map(), blocks = new Set(), except = null, now = Date.now() }){
  const shown = list => list.filter(x => !isHidden(hidden, x));
  [takes, deliveries] = [shown(takes), shown(deliveries)];
  return shown(seeds).filter(s => s.repo !== except && !blocks.has(s.repo) && passable(s.value) && inside(askedAt(s), from, to) && free(s, { takes, deliveries, blocks, now }));
}
/**
 * Whether a new ask `s` is one `r` asked to hear about: of a kind they picked (projects unless
 * they've said not, ideas only once they've said so), and from someone they know as they
 * picked. `ties` is how they're tied to whoever asked, by DID ({ bsky, tangled }, as tieOf in
 * ../../core/ties.js reads them), and `circle` their Tangled circle (circleOf,
 * ../../core/vouch.js). Narrowed to people they know, an ask from someone whose ties weren't
 * read isn't counted.
 */
export function wanted(r, s, { ties = null, circle = null } = {}){
  const kind = nounOf(s?.value) === 'idea' ? r.ideas === true : r.projects !== false;
  const from = r.from || 'anyone';
  return kind && (from === 'anyone' || fromMatches(from, ties?.get(s.repo), from === 'vouched' ? wordOn(circle, s.repo) : null));
}
/**
 * Someone's news from `from` up to `to`: { updates, fresh }, each oldest first. `theirBlocks` is
 * who they block, whose doings aren't news to them; `ourBlocks` is who the account blocks,
 * whose asks it doesn't pass on; `hidden` is what it has hidden (decisions from
 * ../core/moderation.js), which is nobody's news. The new asks are newOnBoard's, of the kinds
 * they picked and from whoever they picked (wanted: `ties` and `circle` are its).
 */
export function newsFor(r, { seeds, takes, deliveries, from, to, theirBlocks = new Set(), ourBlocks = new Set(), hidden = new Map(), ties = null, circle = null, now = Date.now() }){
  const shown = list => list.filter(x => !isHidden(hidden, x));
  // (What's news about their own asks and their work is ../../core/news.js, so the bell in the
  // site's bar says the same things.)
  const updates = r.updates ? updatesFor(r.did, { seeds: shown(seeds), takes: shown(takes), deliveries: shown(deliveries), from, to, theirBlocks }) : [];
  const blocks = new Set([...theirBlocks, ...ourBlocks]);
  const fresh = !r.newAsks ? [] : newOnBoard(seeds, { takes, deliveries, from, to, hidden, blocks, except: r.did, now })
    .filter(s => wanted(r, s, { ties, circle }))
    .map(s => ({ kind: 'new', seed: s, by: s.repo, at: askedAt(s) }));
  const order = (a, b) => a.at - b.at;
  return { updates: updates.sort(order), fresh: fresh.sort(order) };
}

/* ---------- who knows whom ---------- */
/**
 * Who people know, for the ones who only want new asks from people they know, read from the
 * network as the board reads it, and kept for the run: someone's Tangled follows are read once,
 * however many people's counts they're in. `of(did, askers, { circle })` says how `did` is tied
 * to each of `askers`, and with `circle`, their Tangled circle: { ties, circle }, as wanted
 * takes them. It's null when Bluesky couldn't say, since that's most of it; a Tangled account
 * that can't be read counts as no follow, and a circle that can't be read as no vouches.
 */
export function acquaintances(){
  const tangled = new Map();
  const followsOf = did => {
    if (!tangled.has(did)) tangled.set(did, tangledFollowsOf(did).catch(() => null));
    return tangled.get(did);
  };
  return {
    async of(did, askers, { circle = false } = {}){
      const [bsky, mine, theirs, words] = await Promise.all([
        net.relationships(did, askers).catch(() => null),
        followsOf(did),
        Promise.all(askers.map(followsOf)),
        circle ? circleOf(did).catch(() => null) : null
      ]);
      if (!bsky) return null;
      const ties = new Map(askers.map((a, i) => [a, {
        bsky: { following: !!bsky.get(a)?.following, followedBy: !!bsky.get(a)?.followedBy },
        tangled: { following: mine ? mine.has(a) : null, followedBy: theirs[i] ? theirs[i].has(did) : null }
      }]));
      return { ties, circle: words };
    }
  };
}

/* ---------- the conversation ---------- */
// The account can't send direct messages: the app password wasn't allowed to.
const noChat = e => /scope|not allowed|privileged/i.test(`${e?.name} ${e?.message}`);
/**
 * Where things stand with someone, from the account's conversation with them:
 * { canChat, convoId, last, lastNew, said, acked }. `last` is when the run last sent them a
 * message (ms), and `lastNew` the last one with the day's new asks in it. `said` is their latest
 * STOP or START ('stop', 'start' or null), and `acked` whether the run has sent anything since a STOP.
 */
export async function standing(as, did){
  const none = { canChat: false, convoId: null, last: null, lastNew: null, said: null, acked: false };
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
  const ours = messages.findIndex(isOurs), withNew = messages.find(hasNewAsks);
  const cmd = messages.findIndex(m => m?.sender?.did === did && (STOP.test(m.text || '') || START.test(m.text || '')));
  const said = cmd < 0 ? null : STOP.test(messages[cmd].text) ? 'stop' : 'start';
  return { canChat: !!a.canChat, convoId, last: ours < 0 ? null : Date.parse(messages[ours].sentAt), lastNew: withNew ? Date.parse(withNew.sentAt) : null, said, acked: said === 'stop' && ours >= 0 && ours < cmd };
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

  // A run this near the next boundary could still be sending after it, and the next run would
  // take that message for one that covered its minute. It leaves the messages to that run.
  if (boundary(now + GUARD) !== boundary(now)) { out.note = 'Too near the next minute to send messages: the next run will.'; log(out.note); return out; }
  const to = boundary(now), today = boundary(now, true);
  // All of these are needed to know what's news and what's free: if any can't be read, nothing is sent this run.
  const [seeds, takes, deliveries, hidden] = await Promise.all([read(SEED), read(TAKE), read(DELIVERY), read.hidden()]);
  // Who the account won't deal with: those it blocks or who block it, among the people asking and anyone whose new ask it could pass on.
  const askers = seeds.filter(s => passable(s.value) && inside(askedAt(s), today - LOOKBACK, today)).map(s => s.repo);
  const ourBlocks = await blocked([...new Set([...people.map(p => p.did), ...askers])]);
  const skip = (p, why) => { out.skipped.push({ to: p.did, why }); log(`Not messaging ${p.did}: ${why}`); };
  if (password) await as.signIn();

  // One at a time, so a password that can't send messages is found out once, not once a person.
  const ready = [];
  for (const p of people) {
    if (ourBlocks.has(p.did)) { skip(p, 'the account blocks them, or they block it.'); continue; }
    if (isHidden(hidden, { repo: p.did })) { skip(p, 'the account has hidden them.'); continue; }
    let st = { canChat: true, convoId: null, last: null, lastNew: null, said: null, acked: false };
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
    if (st.last != null && st.last >= to) { skip(p, 'they’ve had this minute’s message.'); continue; }
    // Updates since the minute their last message went out in; the day's new asks if they haven't had them.
    const from = st.last == null ? to - DAY : Math.max(boundary(st.last), to - LOOKBACK);
    const daily = p.newAsks && (st.lastNew == null || st.lastNew < today) ? { from: st.lastNew == null ? today - DAY : Math.max(boundary(st.lastNew, true), today - LOOKBACK), to: today } : null;
    ready.push({ p, st, from, daily });
  }
  if (!password && post === false) log('Without the password, the conversations can’t be read, so this is a day’s news for everyone who’s asked.');

  // What each of them has to hear, and everyone their updates name (the new asks name nobody).
  const theirBlocks = new Map(await Promise.all(ready.filter(x => !x.stop).map(async x => [x.p.did, await net.blocksOf(x.p.did)])));
  const graph = acquaintances();
  await net.pool(ready.filter(x => !x.stop), 4, async x => {
    const common = { seeds, takes, deliveries, theirBlocks: theirBlocks.get(x.p.did), ourBlocks, hidden, now };
    let fresh = x.daily ? newsFor({ ...x.p, updates: false, from: 'anyone' }, { ...common, ...x.daily }).fresh : [];
    // Only from people they know: who they know is read now, about the people whose asks could
    // count. If Bluesky can't say, the day's count waits for a run where it can.
    if (fresh.length && x.p.from !== 'anyone') {
      const known = await graph.of(x.p.did, [...new Set(fresh.map(n => n.by))], { circle: x.p.from === 'vouched' });
      if (known) fresh = fresh.filter(n => wanted(x.p, n.seed, known));
      else { fresh = []; log(`Leaving the day’s new asks for ${x.p.did} to the next run: Bluesky didn’t say who they know.`); }
    }
    x.news = {
      updates: newsFor({ ...x.p, newAsks: false }, { ...common, from: x.from, to }).updates,
      fresh,
      what: { projects: x.p.projects, ideas: x.p.ideas, from: x.p.from }
    };
  });
  const named = [...new Set(ready.flatMap(x => [x.p.did, ...(x.news ? x.news.updates.flatMap(n => [n.by, n.seed.repo]) : [])]))];
  const who = await whoAre(named);
  for (const x of ready) if (!x.stop) x.message = compose(x.news, who);

  // Nothing is sent after the boundary that ends this run's period (less GUARD): the next run
  // would take it for one sent in its own. Whoever isn't reached by then hears from that run.
  const started = Date.now(), budget = to + EVERY - GUARD - now;
  for (const x of ready) {
    const at = who.get(x.p.did)?.handle ? '@' + who.get(x.p.did).handle : x.p.did;
    if (!x.message) { log(`Nothing new for ${at}.`); continue; }
    if (post && Date.now() - started > budget) { out.note = 'Out of time for this minute: the rest go next run.'; log(out.note); break; }
    const sent = { to: x.p.did, text: x.message.text, error: null };
    out.sent.push(sent);
    if (!post) { log(`\nWould message ${at}:\n  ${x.message.text.replace(/\n/g, '\n  ')}`); continue; }
    try { await send(as, x.p.did, x.st.convoId, x.message); log(`Messaged ${at}${x.stop ? ', to say they won’t hear from it again' : ''}.`); }
    catch (e) { sent.error = e.message; log(`Couldn't message ${at}: ${e.message}`); }
  }
  return out;
}
