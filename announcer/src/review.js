// Asking the approver (APPROVER in ./posts.js: dame.is) before @rainshare.dev passes an ask on.
//
// Nothing new is posted (./posts.js) or sent in anyone's direct messages (./messages.js) until
// the approver has said yes to it, for the version of the ask that's there now. The queue is in
// the index (rainshare_review, ../../supabase/migrations/20261115210000_rainshare_index.sql): a
// row for every ask, which goes back to pending whenever the ask is edited.
//
// Each run, before the posts:
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
//   2. If nothing's waiting for an answer, the next ask that needs one is sent, oldest first:
//      its title, who asked, the start of what it says, what Rainshare's checks noticed, and how
//      many more are waiting. One at a time, so a reply is always about the last one sent.
//
// Asks that need an answer are the ones the account would pass on: on the board for everyone,
// asked in the last three days and at least a quarter of an hour ago, nobody on them, not hidden,
// not from anyone the account blocks or who blocks it, and not very likely a trick on helpers'
// agents (those never go out; the moderation page lists them). The approver's own asks, and the
// account's, need nobody's yes.
//
// The approver has to let @rainshare.dev message them on Bluesky. If it can't, the run says so,
// and nothing new goes out until it can.
import { SEED, TAKE, DELIVERY, MODERATION, SITE } from '../../core/ns.js';
import { askExcerpt } from '../../core/words.js';
import { concerns } from '../../core/scan.js';
import { moderationRecord, keyOf } from '../../core/moderation.js';
import { clean } from '../../api/_og/describe.js';
import { ACCOUNT, APPROVER, isNew, isHidden, free, blocked, whoAre, graphemes, bytes, reader, session } from './posts.js';
import { rich, person, shortLink } from './messages.js';

const MAX_GRAPHEMES = 1000, MAX_BYTES = 10000;
const fits = s => graphemes(s).length <= MAX_GRAPHEMES && bytes(s) <= MAX_BYTES;
export const GUIDELINES = SITE + '/guidelines';

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

/* ---------- writing to the approver ---------- */
const titleOf = s => clean(s?.value?.title, 120) || 'An ask with no title';
const pageOf = (s, who) => `${SITE}/seed/${who?.handle || s.repo}/${s.rkey}`;
const quoted = (r, s, who) => r.add('“').link(titleOf(s), pageOf(s, who)).add('”');
export const HELP = 'Reply YES, POST, SEND, NO or HIDE to the ask above.';
/** What the approver replied, as a word, for the journal. */
export const REPLY = { approved: 'YES', post_only: 'POST', send_only: 'SEND', declined: 'NO', hidden: 'HIDE' };

/** What's said about an answer, before the next ask. */
export function acked(r, { status, stale }, s, who){
  if (stale) { r.add('It changed after you were asked about '); quoted(r, s, who); return r.add(', so you’ll be asked about the new version.'); }
  if (status === 'approved') { r.add('Okay: '); quoted(r, s, who); return r.add(' goes out.'); }
  if (status === 'post_only') { r.add('Okay: '); quoted(r, s, who); return r.add(' gets posted, and not sent to anyone.'); }
  if (status === 'send_only') { r.add('Okay: '); quoted(r, s, who); return r.add(' goes in the day’s new asks, and isn’t posted.'); }
  if (status === 'declined') { r.add('Okay: '); quoted(r, s, who); return r.add(' stays on the board, and won’t be posted or sent.'); }
  r.add('Hidden: '); quoted(r, s, who); return r.add('. If it was posted, the post comes down too.');
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

/**
 * Take the approver's answer, if there's one, and ask about the next ask, if nothing's waiting
 * for an answer. With `post: false`, only say what would be written and sent.
 *
 * { dryRun, waiting, decided: [{ ask, status, note, stale }], asked, note }: `waiting` is how many
 * asks need an answer, `asked` the one the approver was just asked about.
 */
export async function review({ post = true, password = process.env.RAINSHARE_BLUESKY_APP_PASSWORD, now = Date.now(), log = console.log, read = reader(), as = session(password), db = null, approver = APPROVER } = {}){
  const out = { dryRun: !post, waiting: 0, decided: [], asked: null, note: null };
  const reviews = read.reviews ? await read.reviews() : null;
  if (!reviews) {
    out.note = db ? 'The review queue couldn’t be read, so nothing new goes out this run.' : 'There’s no review queue (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY aren’t set), so nothing new is posted or sent.';
    log(out.note); return out;
  }
  if (post && !db) { out.note = 'The review queue can be read but not written: nothing is decided this run.'; log(out.note); return out; }
  const [seeds, takes, deliveries, hidden] = await Promise.all([read(SEED), read(TAKE), read(DELIVERY), read.hidden()]);
  const bySeed = new Map(seeds.map(s => [s.uri, s]));
  const recent = seeds.filter(s => isNew(s.value, now) && !isHidden(hidden, s) && s.repo !== ACCOUNT && s.repo !== approver);
  const blocks = await blocked([...new Set(recent.map(s => s.repo))]);
  // Asks that need an answer, oldest first: those the account would pass on, unanswered for the version there now.
  const answered = s => { const r = reviews.get(s.uri); return !!r && r.cid === s.cid && r.status !== 'pending'; };
  const needed = recent.filter(s => !blocks.has(s.repo) && free(s, { takes, deliveries, hidden, blocks, now }) && !answered(s))
    .sort((a, b) => Date.parse(a.value.createdAt) - Date.parse(b.value.createdAt));
  // Only an ask the queue has a row for, at that version, can be asked about: the index may not have caught up.
  const askable = needed.filter(s => reviews.get(s.uri)?.cid === s.cid);
  out.waiting = needed.length;
  // The last ask the approver was asked about and hasn't answered, if it's still there as it was.
  const outstanding = [...reviews.values()].filter(r => r.status === 'pending' && r.requested_at && bySeed.get(r.seed_uri)?.cid === r.cid)
    .sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at))[0] || null;
  if (!askable.length && !outstanding) { if (needed.length) log(`${needed.length} waiting for review, not in the queue yet.`); return out; }

  if (!password) {
    const next = askable[0];
    if (next) { out.asked = next.uri; log(`Would ask the approver about ${next.uri} (“${titleOf(next)}”), with ${askable.length - 1} more waiting. (Without the password, their answers can’t be read.)`); }
    return out;
  }
  await as.signIn();
  let chat;
  try { chat = await chatWith(as, approver); }
  catch (e) {
    out.note = `Couldn’t open a conversation with the approver (${e.message}). They need to let @rainshare.dev message them on Bluesky. Until then nothing new goes out.`;
    log(out.note); return out;
  }
  const said = [], named = new Set([...askable.slice(0, 1), ...(outstanding ? [bySeed.get(outstanding.seed_uri)] : [])].map(s => s.repo));
  const who = await whoAre([...named]);
  let waitingOn = outstanding, done = null;

  if (outstanding) {
    const s = bySeed.get(outstanding.seed_uri), mine = m => m?.sender?.did === approver;
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
      said.push(r => acked(r, d, s, who.get(s.repo)));
      waitingOn = null; done = s.uri;
    } else if (since.length && mine(chat.messages[0])) {
      // They wrote, and it wasn't an answer: say what to reply, once (after this, the last word is the account's).
      said.push(r => r.add(HELP));
    }
  }
  // Still waiting on an answer about an ask that still needs one: nothing new is asked.
  const next = waitingOn && needed.some(s => s.uri === waitingOn.seed_uri) ? null : askable.find(s => s.uri !== done) || null;
  if (!next && !said.length) { if (waitingOn) log(`Waiting on the approver’s answer about ${waitingOn.seed_uri}; ${needed.length} waiting in all.`); return out; }

  if (next && !who.has(next.repo)) for (const [k, v] of await whoAre([next.repo])) who.set(k, v);
  const message = next ? composeRequest(next, who.get(next.repo), { before: said, more: askable.filter(s => s.uri !== next.uri && s.uri !== done).length })
    : (() => { const r = rich(); said.forEach((line, i) => { if (i) r.add('\n\n'); line(r); }); return r.build(); })();
  if (!post) { log(`\nWould message the approver:\n  ${message.text.replace(/\n/g, '\n  ')}`); if (next) out.asked = next.uri; return out; }
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
