// Asking the approver (APPROVER in ./posts.js: dame.is) before @rainshare.dev passes an ask on.
//
// Nothing new is posted (./posts.js) or sent in anyone's direct messages (./messages.js) until
// the approver has said yes to it, for the version of the ask that's there now. The queue is in
// the index (rainshare_review, ../../supabase/migrations/20261115210000_rainshare_index.sql): a
// row for every ask, which goes back to pending whenever the ask is edited.
//
// Each run, around the posts:
//   1. If the approver has been asked about an ask and has answered since, the answer is written
//      to the queue:
//        YES   it's posted and sent, from the next post on
//        POST  it's posted, and not sent
//        SEND  it's sent (in the day's new asks), and not posted
//        NO    it stays on the board, and isn't posted or sent
//        HIDE  it's hidden from Rainshare, as the moderation page hides things: a public
//              moderation record in the account's repo, with what follows HIDE as the note. If
//              it was posted, the post comes down (./posts.js).
//      Anything else gets a line saying what to reply, once.
//   2. The posts go (`posting`: ./run.js passes ./posts.js), and then the approver is told what
//      came of their answer: the post, with its link, and when the day's new asks go out. Or, if
//      it can't go out, why not: the account only passes on asks nobody's on yet, so a yes to one
//      someone has taken since is kept, and said to be held back. An ask they said yes to that's
//      posted in a later run (once a take on it lapses, say) gets its link then.
//   3. If nothing's waiting for an answer, the next ask that needs one is sent, oldest first:
//      its title, who asked, the start of what it says, what Rainshare's checks noticed, and how
//      many more are waiting. One at a time, so a reply is always about the last one sent. If
//      the last one stops needing an answer before it gets one (someone takes it), the next one
//      says so ("Never mind …") and is asked about instead.
//
// Asks that need an answer are the ones the account would pass on: on the board for everyone,
// asked in the last three days and at least a quarter of an hour ago, nobody on them, not hidden,
// not from anyone the account blocks or who blocks it, and not very likely a trick on helpers'
// agents (those never go out; the moderation page lists them). The approver's own asks, and the
// account's, need nobody's yes. Once asked about one, the approver has at least a day to answer
// (ANSWER, ./posts.js), and a yes gets it posted then, even past its three days.
//
// The approver has to let @rainshare.dev message them on Bluesky. If it can't, the run says so,
// and nothing new goes out until it can.
import { SEED, TAKE, DELIVERY, MODERATION, SITE, HANDLE } from '../../core/ns.js';
import { askExcerpt } from '../../core/words.js';
import { concerns } from '../../core/scan.js';
import { moderationRecord, keyOf } from '../../core/moderation.js';
import { clean } from '../../api/_og/describe.js';
import { ACCOUNT, APPROVER, ALLOWS, isNew, isHidden, passable, progressFor, blocked, whoAre, graphemes, bytes, reader, session } from './posts.js';
import { rich, person, shortLink, DAILY } from './messages.js';

const MAX_GRAPHEMES = 1000, MAX_BYTES = 10000;
const fits = s => graphemes(s).length <= MAX_GRAPHEMES && bytes(s) <= MAX_BYTES;
export const GUIDELINES = SITE + '/guidelines';
// How many posts of a run's are followed up one by one; the rest are counted.
const MAX_FOLLOW_UPS = 3;
const two = n => String(n).padStart(2, '0');
/** When the day's new asks go out (DAILY, ./messages.js): "15:45 UTC". */
export const DAILY_AT = `${two(Math.floor(DAILY / 3600e3))}:${two(Math.round(DAILY % 3600e3 / 60e3))} UTC`;
/** One of the account's posts (an at:// URI), as a link to it on Bluesky. */
export const postLink = uri => `https://bsky.app/profile/${HANDLE}/post/${String(uri).split('/').pop()}`;

// What a reply's first word means. Anything after HIDE is the reason, kept with the record.
const WORDS = {
  approved: ['yes', 'y', 'yep', 'yeah', 'yup', 'ok', 'okay', 'approve', 'approved', 'both', '👍', '✅'],
  post_only: ['post', 'post-only', 'postonly'],
  send_only: ['send', 'send-only', 'sendonly', 'dm', 'dms'],
  declined: ['no', 'n', 'nope', 'decline', 'declined', 'skip', 'pass', '👎'],
  hidden: ['hide', 'hidden']
};
/** What a reply says: { status: 'approved' | 'post_only' | 'send_only' | 'declined' | 'hidden', note } or {} for anything else. */
export function answerOf(text){
  const m = String(text ?? '').trim().match(/^(\S+)\s*([\s\S]*)$/);
  if (!m) return {};
  const word = m[1].toLowerCase().replace(/️/g, '').replace(/^[^\p{L}\p{N}\p{Extended_Pictographic}]+|[^\p{L}\p{N}\p{Extended_Pictographic}]+$/gu, '');
  for (const [status, words] of Object.entries(WORDS)) {
    if (words.includes(word)) return { status, note: status === 'hidden' ? clean(m[2].replace(/^[\s:.,;!-]+/, ''), 300) : '' };
  }
  return {};
}

/**
 * Why the account can't pass an ask on now, whatever the approver says, or null when it can:
 * { why, by }. `why` is 'hidden', 'blocked' (the account blocks whoever asked, or they block
 * it), 'on-it' or 'turned-in' (with `by`, the helper's DID), 'done', 'closed', or 'shut' (not
 * open to everyone on the board any more). `blocks` is who the account won't deal with.
 */
export function heldBack(s, { takes = [], deliveries = [], hidden = new Map(), blocks = new Set(), now = Date.now() } = {}){
  if (isHidden(hidden, s)) return { why: 'hidden', by: null };
  if (blocks.has(s.repo)) return { why: 'blocked', by: null };
  const { key, helpers } = progressFor(s, { takes, deliveries, hidden, blocks, now });
  if (key === 'on-it') return { why: key, by: helpers.find(h => h.took && !h.lapsed)?.did || null };
  if (key === 'turned-in') return { why: key, by: helpers.find(h => h.turnedIn)?.did || null };
  if (key !== 'open') return { why: key, by: null };
  return passable(s.value) ? null : { why: 'shut', by: null };
}

/* ---------- writing to the approver ---------- */
const titleOf = s => clean(s?.value?.title, 120) || 'An ask with no title';
const pageOf = (s, who) => `${SITE}/seed/${who?.handle || s.repo}/${s.rkey}`;
const quoted = (r, s, who) => r.add('“').link(titleOf(s), pageOf(s, who)).add('”');
const linked = (r, uri) => r.link(shortLink(postLink(uri)), postLink(uri));
export const HELP = 'Reply YES, POST, SEND, NO or HIDE to the ask above.';
/** What the approver replied, as a word, for the journal. */
export const REPLY = { approved: 'YES', post_only: 'POST', send_only: 'SEND', declined: 'NO', hidden: 'HIDE' };
const NOT_OPEN = { hidden: 'it’s hidden', blocked: '@rainshare.dev blocks whoever asked it, or they block it', done: 'it’s been marked done', closed: 'it’s been closed', shut: 'it isn’t open to everyone on the board any more' };

/** Why an ask is held back (heldBack), as words: "Juniper (@juniper.example) is on it". `people` names the helper. */
export function because(r, { why, by }, people = new Map()){
  if (why === 'on-it') return person(r, by && people.get(by)).add(' is on it');
  if (why === 'turned-in') return person(r, by && people.get(by)).add(' has turned in work on it');
  return r.add(NOT_OPEN[why] || NOT_OPEN.shut);
}

/**
 * What's said about an answer, once the posts have gone. `held` is why the ask can't go out
 * (heldBack), if it can't, and `post` what came of posting it this run ({ uri, error }, from
 * ./posts.js), if it was. `who` names the asker; `people` everyone else.
 */
export function acked(r, { status, stale, held = null, post = null }, s, who, people = new Map()){
  if (stale) { r.add('It changed after you were asked about '); quoted(r, s, who); return r.add(', so you’ll be asked about the new version.'); }
  if (status === 'declined') { r.add('Okay: '); quoted(r, s, who); return r.add(' stays on the board, and won’t be posted or sent.'); }
  if (status === 'hidden') { r.add('Hidden: '); quoted(r, s, who); return r.add('. If it was posted, the post comes down too.'); }
  // A yes, one way or both: kept, whatever happens next.
  if (held) {
    const helped = held.why === 'on-it' || held.why === 'turned-in';
    r.add('Okay, but '); quoted(r, s, who); r.add(held.why === 'on-it' ? ' isn’t going out for now: ' : ' isn’t going out: ');
    because(r, held, people);
    return r.add(helped ? '. Rainshare only passes on asks nobody’s on yet.' : '.');
  }
  const sent = ALLOWS.send.includes(status), dms = `the new asks people get by direct message at ${DAILY_AT}`;
  if (status === 'send_only') { r.add('Okay: '); quoted(r, s, who); return r.add(` goes in ${dms}, and isn’t posted.`); }
  if (post?.uri) { r.add('Posted '); quoted(r, s, who); r.add(sent ? `, and it goes in ${dms}: ` : ', and it isn’t sent to anyone: '); return linked(r, post.uri); }
  r.add('Okay: '); quoted(r, s, who);
  if (post?.error) return r.add(` goes out, but posting it didn’t work (${clean(post.error, 120)}). The next run tries again, and you’ll get the link once it’s up.`);
  return r.add(sent ? ' goes out.' : ' gets posted, and not sent to anyone.');
}
/** What's said about the account's posts, this run, of asks the approver said yes to before: [{ s, uri }]. */
export function followUps(r, posted, who){
  for (const [i, { s, uri }] of posted.slice(0, MAX_FOLLOW_UPS).entries()) { if (i) r.add('\n'); r.add('Posted '); quoted(r, s, who.get(s.repo)); r.add(': '); linked(r, uri); }
  const more = posted.length - MAX_FOLLOW_UPS;
  if (more > 0) r.add(`\nAnd ${more} more you said yes to ${more === 1 ? 'is' : 'are'} posted.`);
  return r;
}

/**
 * The message asking about an ask: { text, facets }. `before` is what's said first (an answer
 * taken, or what to reply), and `more` how many others are waiting after this one.
 */
export function composeRequest(s, who, { before = [], more = 0 } = {}){
  const flags = concerns(s.value).map(c => c.said);
  const build = excerptMax => {
    const r = rich();
    for (const line of before) { line(r); r.add('\n\n'); }
    r.add('Waiting for your OK before @rainshare.dev posts it or sends it to anyone:\n\n');
    quoted(r, s, who); r.add(' from '); person(r, who);
    const said = clean(askExcerpt(typeof s.value?.spec === 'string' ? s.value.spec : '', excerptMax), excerptMax + 1);
    if (said && excerptMax > 0) r.add('\n\n' + said);
    r.add(flags.length ? `\n\nRainshare’s checks noticed: ${flags.join(' ')}` : '\n\nRainshare’s checks noticed nothing.');
    r.add('\n\nReply YES to post it and send it out, POST to only post it, SEND to only send it, NO to leave it on the board without passing it on, or HIDE to hide it (anything after HIDE is kept as the reason). ');
    r.link('The guidelines', GUIDELINES).add('.');
    if (more) r.add(` ${more} more ${more === 1 ? 'is' : 'are'} waiting.`);
    return r;
  };
  for (const max of [400, 250, 120, 0]) { const r = build(max); if (fits(r.text) || !max) return r.build(); }
}

/* ---------- a run ---------- */
async function chatWith(as, did){
  const convo = (await as.get('chat.bsky.convo.getConvoForMembers', { members: [did] }, { chat: true })).convo;
  if (!convo?.id) throw new Error('Bluesky didn’t open a conversation');
  const messages = (await as.get('chat.bsky.convo.getMessages', { convoId: convo.id, limit: 100 }, { chat: true })).messages || [];
  return { id: convo.id, messages };   // newest first
}
// A message from the account asking about an ask: every one links to the guidelines, and nothing else it sends the approver does.
const asking = m => m?.sender?.did === ACCOUNT && (m.facets || []).some(f => (f?.features || []).some(x => x?.uri === GUIDELINES));

/**
 * Take the approver's answer, if there's one, let the posts go (`posting()`, which gives what
 * ./posts.js does), then tell the approver what came of it and ask about the next ask, if nothing's
 * waiting for an answer. With `post: false`, only say what would be written and sent.
 *
 * { dryRun, waiting, decided: [{ ask, status, note, stale }], followedUp, asked, note }: `waiting`
 * is how many asks need an answer, `followedUp` the asks said yes to before whose posts the
 * approver was sent, and `asked` the one they were just asked about.
 */
export async function review({ post = true, password = process.env.RAINSHARE_BLUESKY_APP_PASSWORD, now = Date.now(), log = console.log, read = reader(), as = session(password), db = null, approver = APPROVER, posting = null } = {}){
  const out = { dryRun: !post, waiting: 0, decided: [], followedUp: [], asked: null, note: null };
  const reviews = read.reviews ? await read.reviews() : null;
  if (!reviews) {
    out.note = db ? 'The review queue couldn’t be read, so nothing new goes out this run.' : 'There’s no review queue (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY aren’t set), so nothing new is posted or sent.';
    log(out.note); return out;
  }
  if (post && !db) { out.note = 'The review queue can be read but not written: nothing is decided this run.'; log(out.note); return out; }
  const [seeds, takes, deliveries, hidden] = await Promise.all([read(SEED), read(TAKE), read(DELIVERY), read.hidden()]);
  const bySeed = new Map(seeds.map(s => [s.uri, s]));
  // The last ask the approver was asked about, if they haven't answered and it's still there as
  // it was. Only the last: an earlier one they weren't answered about is asked about again, if
  // it still needs it, rather than taking a reply meant for a later one.
  const last = [...reviews.values()].filter(r => r.requested_at).sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at))[0];
  let outstanding = last?.status === 'pending' && bySeed.get(last.seed_uri)?.cid === last.cid ? last : null;
  const lastAsk = outstanding && bySeed.get(outstanding.seed_uri);
  const recent = seeds.filter(s => isNew(s.value, now) && !isHidden(hidden, s) && s.repo !== ACCOUNT && s.repo !== approver);
  const blocks = await blocked([...new Set([...recent, ...(lastAsk ? [lastAsk] : [])].map(s => s.repo))]);
  const ctx = { takes, deliveries, hidden, blocks, now };
  // Asks that need an answer, oldest first: those the account would pass on, unanswered for the version there now.
  const answered = s => { const r = reviews.get(s.uri); return !!r && r.cid === s.cid && r.status !== 'pending'; };
  const needed = recent.filter(s => !heldBack(s, ctx) && !answered(s)).sort((a, b) => Date.parse(a.value.createdAt) - Date.parse(b.value.createdAt));
  // Only an ask the queue has a row for, at that version, can be asked about: the index may not have caught up.
  const askable = needed.filter(s => reviews.get(s.uri)?.cid === s.cid);
  out.waiting = needed.length;
  if (!askable.length && !outstanding && !posting) { if (needed.length) log(`${needed.length} waiting for review, not in the queue yet.`); return out; }

  if (!password) {
    const next = askable[0];
    if (next) { out.asked = next.uri; log(`Would ask the approver about ${next.uri} (“${titleOf(next)}”), with ${askable.length - 1} more waiting. (Without the password, their answers can’t be read.)`); }
    return out;
  }
  let chat = null;
  const open = async () => {
    if (chat) return chat;
    await as.signIn();
    try { return chat = await chatWith(as, approver); }
    catch (e) { out.note = `Couldn’t open a conversation with the approver (${e.message}). They need to let @rainshare.dev message them on Bluesky. Until then nothing new goes out.`; log(out.note); return null; }
  };
  const said = [], who = new Map();
  let waitingOn = null, done = null, taken = null;

  if (outstanding || askable.length) {
    if (!(await open())) return out;
    // Asked about since, by an ask that's left the queue's requests (edited since, say)? Then there's no answer to take.
    const newest = chat.messages.find(asking);
    if (outstanding?.request_id && newest && newest.id !== outstanding.request_id) outstanding = null;
    waitingOn = outstanding;
  }
  if (outstanding) {
    const s = lastAsk, mine = m => m?.sender?.did === approver;
    const i = outstanding.request_id ? chat.messages.findIndex(m => m?.id === outstanding.request_id) : -1;
    const since = (i >= 0 ? chat.messages.slice(0, i) : chat.messages.filter(m => Date.parse(m?.sentAt) > Date.parse(outstanding.requested_at))).filter(mine).reverse();
    const answer = since.map(m => answerOf(m.text)).find(a => a.status);
    if (answer) {
      const d = { ask: s.uri, status: answer.status, note: answer.note, stale: false };
      if (!post) log(`Would take the approver’s ${REPLY[answer.status]} for ${s.uri}${answer.note ? ` (“${answer.note}”)` : ''}.`);
      else {
        try {
          if (answer.status === 'hidden') {
            const record = moderationRecord({ subject: s.uri, reason: 'guidelines', note: answer.note });
            await as.post('com.atproto.repo.putRecord', { repo: ACCOUNT, collection: MODERATION, rkey: keyOf(s.uri), record });
            hidden.set(s.uri, { subject: s.uri, action: 'hide', reason: 'guidelines', note: answer.note, createdAt: record.createdAt, uri: null, rkeys: [keyOf(s.uri)] });
          }
          d.stale = !(await db.decide(s.uri, s.cid, answer.status, approver, answer.note));
          if (!d.stale) reviews.set(s.uri, { ...outstanding, status: answer.status, decided_at: new Date(now).toISOString(), decided_by: approver, note: answer.note || null });
          log(d.stale ? `${s.uri} changed after the approver was asked: they’ll be asked again.` : `The approver said ${answer.status} to ${s.uri}.`);
        } catch (e) { out.note = `Couldn’t take the approver’s answer about ${s.uri} (${e.message}). The next run tries again.`; log(out.note); return out; }
      }
      out.decided.push(d);
      // Said once the posts have gone, so it can say what came of it.
      taken = { d, s, held: ALLOWS.post.includes(d.status) || ALLOWS.send.includes(d.status) ? heldBack(s, ctx) : null };
      waitingOn = null; done = s.uri;
    } else if (since.length && mine(chat.messages[0])) {
      // They wrote, and it wasn't an answer: say what to reply, once (after this, the last word is the account's).
      said.push(r => r.add(HELP));
    }
  }

  // The posts, so what's said next can link to them.
  const posted = posting ? await posting() : null;
  const posts = Array.isArray(posted?.posts) ? posted.posts : [];
  if (taken) {
    const { d, s, held } = taken, p = posts.find(x => x.ask === s.uri) || null;
    said.unshift(r => acked(r, { ...d, held, post: p && { uri: p.uri, error: p.error } }, s, who.get(s.repo), who));
  }
  // Asks said yes to before, posted this run: the approver hears when they're up.
  const later = posts.filter(p => p.uri && p.ask !== done && bySeed.has(p.ask) && ALLOWS.post.includes(reviews.get(p.ask)?.status) && ![ACCOUNT, approver].includes(bySeed.get(p.ask).repo))
    .map(p => ({ s: bySeed.get(p.ask), uri: p.uri }));
  if (later.length) { out.followedUp = later.map(x => x.s.uri); said.splice(taken ? 1 : 0, 0, r => followUps(r, later, who)); }

  // Still waiting on an answer about an ask that still needs one: nothing new is asked.
  const stuck = waitingOn && heldBack(lastAsk, ctx);
  const next = waitingOn && !stuck ? null : askable.find(s => s.uri !== done) || null;
  // Moving on from one that doesn't need an answer any more, it says why.
  if (next && stuck) said.push(r => { r.add('Never mind '); quoted(r, lastAsk, who.get(lastAsk.repo)); r.add(': '); return because(r, stuck, who).add('.'); });
  if (!next && !said.length) { if (waitingOn) log(`Waiting on the approver’s answer about ${waitingOn.seed_uri}; ${needed.length} waiting in all.`); return out; }

  const names = [next, taken?.s, stuck && lastAsk, ...later.map(x => x.s)].filter(Boolean).map(s => s.repo);
  for (const h of [taken?.held, stuck]) if (h?.by) names.push(h.by);
  for (const [k, v] of await whoAre([...new Set(names)])) who.set(k, v);
  const message = next ? composeRequest(next, who.get(next.repo), { before: said, more: askable.filter(s => s.uri !== next.uri && s.uri !== done).length })
    : (() => { const r = rich(); said.forEach((line, i) => { if (i) r.add('\n\n'); line(r); }); return r.build(); })();
  if (!post) { log(`\nWould message the approver:\n  ${message.text.replace(/\n/g, '\n  ')}`); if (next) out.asked = next.uri; return out; }
  if (!(await open())) return out;
  try {
    const sent = await as.post('chat.bsky.convo.sendMessage', { convoId: chat.id, message }, { chat: true });
    if (next) {
      out.asked = next.uri;
      if (!(await db.requested(next.uri, next.cid, sent?.id))) log(`${next.uri} changed as the approver was asked about it: they’ll be asked again.`);
      log(`Asked the approver about ${next.uri}.`);
    }
  } catch (e) { out.note = `Couldn’t message the approver (${e.message}).`; log(out.note); }
  return out;
}
