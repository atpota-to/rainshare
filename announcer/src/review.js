// Asking the approver (APPROVER in ./posts.js: dame.is) before @rainshare.dev posts an ask.
//
// Nothing new is posted (./posts.js) until the approver has said yes to it, for the version of
// the ask that's there now. (The day's direct message about new asks, ./messages.js, only counts
// them, so it doesn't wait for anyone.) The queue is in the index (rainshare_review,
// ../../supabase/migrations/20261115210000_rainshare_index.sql): a row for every ask, which goes
// back to pending whenever the ask is edited.
//
// The approver gets one list: every ask waiting for their answer, oldest first, numbered, each
// written as @rainshare.dev would post it, with its title linked to the ask's page. Under it is
// what the day's direct message about new asks says so far. A new list goes out when an ask
// they haven't been shown (as it is now) needs an answer, and after they answer, if any are still
// waiting, so an ask from a list they missed is in the next one. Each run:
//   1. Their replies since the account last wrote to them are read against the latest list:
//        YES          post them all              YES 1 3   post those two
//        NO           post none of them          NO 2      don't post that one
//        HIDE 2 why   hide it, as the moderation page does: a public moderation record in the
//                     account's repo, with what follows as the note. If it was posted, the post
//                     comes down (./posts.js).
//      With one ask in the list, YES, NO or HIDE alone is about that one. NO leaves an ask on the
//      board. A NO can be changed to a YES later; a YES stands, and HIDE takes the post down. An
//      answer is for the version of the ask they were shown: one edited since is in the next list
//      as it is now. A reply that isn't an answer gets a line saying what to reply, once.
//   2. The posts go (`posting`: ./run.js passes ./posts.js), and then the approver is told what
//      came of each answer: the post, with its link, or why it isn't going out (someone took it
//      while they were deciding, say: the yes is kept). An ask they said yes to that's posted in
//      a later run gets its link then.
//   3. The new list, if one's due, in the same message when it fits. Asks in the last list that
//      don't need an answer any more (someone took one) are said to be off it.
//
// The run knows which number is which ask from the list itself: each title links to its ask's
// page by the asker's DID, and nothing else the account sends the approver links to an ask. Lists
// from before they were numbered asked about one ask, the one the queue says that message asked.
//
// Asks that need an answer are the ones the account would post: on the board for everyone,
// asked in the last three days and at least a quarter of an hour ago, nobody on them, not hidden,
// not from anyone the account blocks or who blocks it, and not very likely a trick on helpers'
// agents (those never go out; the moderation page lists them). The approver's own asks, and the
// account's, need nobody's yes. Once shown one, the approver has at least a day to answer
// (ANSWER, ./posts.js), and a yes gets it posted then, even past its three days.
//
// The approver has to let @rainshare.dev message them on Bluesky. If it can't, the run says so,
// and nothing new is posted until it can.
import { SEED, TAKE, DELIVERY, MODERATION, SITE, HANDLE } from '../../core/ns.js';
import { concerns } from '../../core/scan.js';
import { moderationRecord, keyOf } from '../../core/moderation.js';
import { clean } from '../../api/_og/describe.js';
import { ACCOUNT, APPROVER, ALLOWS, isNew, isHidden, passable, progressFor, blocked, whoAre, graphemes, bytes, reader, session, askAt, compose as composePost } from './posts.js';
import { rich, person, shortLink, DAILY, boundary, newOnBoard, counted, isOurs } from './messages.js';

const MAX_GRAPHEMES = 1000, MAX_BYTES = 10000, DAY = 24 * 3600e3;
const fits = s => graphemes(s).length <= MAX_GRAPHEMES && bytes(s) <= MAX_BYTES;
export const GUIDELINES = SITE + '/guidelines';
// How many posts of a run's are followed up one by one; the rest are counted.
const MAX_FOLLOW_UPS = 3;
const two = n => String(n).padStart(2, '0');
/** When the day's new asks go out (DAILY, ./messages.js): "15:45 UTC". */
export const DAILY_AT = `${two(Math.floor(DAILY / 3600e3))}:${two(Math.round(DAILY % 3600e3 / 60e3))} UTC`;
/** One of the account's posts (an at:// URI), as a link to it on Bluesky. */
export const postLink = uri => `https://bsky.app/profile/${HANDLE}/post/${String(uri).split('/').pop()}`;

/* ---------- reading a reply ---------- */
// The words for each answer. POST and BOTH are a yes: they meant yes before there was only posting to say yes to.
const WORDS = {
  approved: ['yes', 'y', 'yep', 'yeah', 'yup', 'ok', 'okay', 'approve', 'approved', 'post', 'both', '👍', '✅'],
  declined: ['no', 'n', 'nope', 'decline', 'declined', 'skip', 'pass', '👎'],
  hidden: ['hide', 'hidden']
};
/** What the approver replied, as a word, for the journal and the messages. */
export const REPLY = { approved: 'YES', post_only: 'YES', send_only: 'NO', declined: 'NO', hidden: 'HIDE' };
const word = w => w.toLowerCase().replace(/️/g, '').replace(/^[^\p{L}\p{N}\p{Extended_Pictographic}]+|[^\p{L}\p{N}\p{Extended_Pictographic}]+$/gu, '');
const statusOf = w => Object.keys(WORDS).find(k => WORDS[k].includes(word(w))) || null;
const FILLER = new Set(['and', '&', 'to', '+']);
// "2", "#2", "2.", "1-3", "1,3": the numbers a word gives, or null when it isn't only numbers.
function numbersIn(w){
  const out = [];
  for (const part of w.split(',').filter(Boolean)) {
    const m = part.match(/^#?(\d{1,3})(?:[-–](\d{1,3}))?[.:;)]*$/);
    if (!m) return null;
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    out.push(...(b >= a && b - a < 50 ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]));
  }
  return out.length ? out : w === ',' ? [] : null;
}
/**
 * The answers in a reply: [{ status: 'approved' | 'declined' | 'hidden', numbers, note }], or []
 * when it isn't one. Each line can hold answers: YES, NO or HIDE (or a word like them), then the
 * numbers it's about, if any ("1 3", "1, 3", "1-3", "1 and 3"), then another word and its numbers,
 * and so on. After HIDE, whatever follows the numbers is the reason, kept with the record. A line
 * with anything else in it ("ok thanks") isn't an answer, so chat isn't taken for a yes to them all.
 */
export function answersOf(text){
  const out = [];
  for (const line of String(text ?? '').split('\n')) {
    const words = line.trim().split(/\s+/).filter(Boolean), found = [];
    let at = 0;
    while (at < words.length) {
      const status = statusOf(words[at]);
      if (!status) break;
      const a = { status, numbers: [], note: '' };
      for (at++; at < words.length; at++) {
        const n = numbersIn(words[at]);
        if (n) a.numbers.push(...n);
        else if (!FILLER.has(words[at].toLowerCase())) break;
      }
      if (status === 'hidden') { a.note = clean(words.slice(at).join(' ').replace(/^[\s:.,;!–-]+/, ''), 300); at = words.length; }
      found.push(a);
    }
    if (found.length && at >= words.length) out.push(...found);
  }
  return out;
}

/**
 * Why the account can't post an ask now, whatever the approver says, or null when it can:
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
const titleOf = s => clean(s?.value?.title, 80) || 'An ask with no title';
// An ask's title in what's said about it. Not a link: only the list links to asks.
const quoted = (r, s) => r.add(`“${titleOf(s)}”`);
// An ask's page by its asker's DID, so a list's links say which ask each number is.
const pageOf = s => `${SITE}/seed/${s.repo}/${s.rkey}`;
const linked = (r, uri) => r.link(shortLink(postLink(uri)), postLink(uri));
/** What to reply, for a list of `n` asks. */
export const help = n => n === 1
  ? 'Reply YES to post it, NO to leave it on the board without posting it, or HIDE and why to take it off the board.'
  : `Reply YES to post them all, or answer by number: ${n === 2 ? 'YES 1, NO 2' : 'YES 1 3, NO 2'}, HIDE 2 and why. NO leaves an ask on the board without posting it, and HIDE takes it off.`;
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
 * ./posts.js), if it was. `people` names helpers.
 */
export function acked(r, { status, stale, held = null, post = null }, s, people = new Map()){
  if (stale) { quoted(r, s); return r.add(' changed after you were shown it, so it’s waiting for an answer about the new version.'); }
  if (status === 'declined') { r.add('Okay: '); quoted(r, s); return r.add(' stays on the board, and won’t be posted.'); }
  if (status === 'hidden') { r.add('Hidden: '); quoted(r, s); return r.add('. If it was posted, the post comes down too.'); }
  // A yes: kept, whatever happens next.
  if (held) {
    const helped = held.why === 'on-it' || held.why === 'turned-in';
    r.add('Okay, but '); quoted(r, s); r.add(held.why === 'on-it' ? ' isn’t going out for now: ' : ' isn’t going out: ');
    because(r, held, people);
    return r.add(helped ? '. Rainshare only posts asks nobody’s on yet.' : '.');
  }
  if (post?.uri) { r.add('Posted '); quoted(r, s); r.add(': '); return linked(r, post.uri); }
  r.add('Okay: '); quoted(r, s);
  if (post?.error) return r.add(` gets posted, but posting it didn’t work (${clean(post.error, 120)}). The next run tries again, and you’ll get the link once it’s up.`);
  return r.add(' gets posted, and you’ll get the link once it’s up.');
}
/** What's said about the account's posts, this run, of asks the approver said yes to before: [{ s, uri }]. */
export function followUps(r, posted){
  for (const [i, { s, uri }] of posted.slice(0, MAX_FOLLOW_UPS).entries()) { if (i) r.add('\n'); r.add('Posted '); quoted(r, s); r.add(': '); linked(r, uri); }
  const more = posted.length - MAX_FOLLOW_UPS;
  if (more > 0) r.add(`\nAnd ${more} more you said yes to ${more === 1 ? 'is' : 'are'} posted.`);
  return r;
}

// An ask as @rainshare.dev would post it (compose, ./posts.js), with its title linked to its page.
// The words are the post's own, with one line break before the title where the post has two.
function preview(r, s, who){
  const p = composePost(s, who || { did: s.repo, handle: null, name: '' });
  const cut = p.text.indexOf('\n\n'), head = new TextEncoder().encode(cut < 0 ? '' : p.text.slice(0, cut)), title = cut < 0 ? p.text : p.text.slice(cut + 2);
  const text = (from, to) => new TextDecoder().decode(head.slice(from, to));
  let at = 0;
  for (const f of p.facets) {
    if (f.index.byteEnd > head.length) continue;
    r.add(text(at, f.index.byteStart)).add(text(f.index.byteStart, f.index.byteEnd), f.features[0]);
    at = f.index.byteEnd;
  }
  if (head.length) r.add(text(at) + '\n');
  return r.link(title, pageOf(s));
}

/**
 * The list of asks waiting for the approver's answer, oldest first: { message: { text, facets },
 * shown }, with `shown` the asks in it, in its order. As many as fit are shown, and the rest
 * counted, for a later list. `who` names the askers, and `daily` is how many new asks the day's
 * direct message counts so far. `before` is what's said first (answers taken, posts): if the list
 * doesn't fit after it with even one ask, it's null, and the two go as messages of their own.
 */
export function composeList(asks, who, { daily = 0, before = [] } = {}){
  const build = n => {
    const r = rich(), shown = asks.slice(0, n), numbered = n > 1;
    for (const line of before) { line(r); r.add('\n\n'); }
    r.add(asks.length === 1 ? 'Waiting for your OK. @rainshare.dev would post this, with a card linking to the ask:'
      : `${asks.length} asks are waiting for your OK. @rainshare.dev would post each of these, with a card linking to the ask:`);
    shown.forEach((s, i) => {
      r.add('\n\n' + (numbered ? `${i + 1}. ` : ''));
      preview(r, s, who.get(s.repo));
      const flags = concerns(s.value).map(c => c.said);
      if (flags.length) r.add('\n' + clean(`Rainshare’s checks noticed: ${flags.join(' ')}`, 200));
    });
    if (asks.length > n) r.add(`\n\nAnd ${asks.length - n} more after ${n === 1 ? 'this one' : 'these'}.`);
    r.add('\n\n' + help(n) + ' ').link('The guidelines', GUIDELINES).add('.');
    r.add(`\n\nThe direct message about new asks, at ${DAILY_AT}, `);
    if (daily) counted(r.add('says so far: “'), daily).add('”'); else r.add('has none to count so far.');
    return { message: r.build(), shown };
  };
  for (let n = asks.length; n >= 1; n--) { const b = build(n); if (fits(b.message.text)) return b; }
  return before.length ? null : build(1);
}

/* ---------- a run ---------- */
async function chatWith(as, did){
  const convo = (await as.get('chat.bsky.convo.getConvoForMembers', { members: [did] }, { chat: true })).convo;
  if (!convo?.id) throw new Error('Bluesky didn’t open a conversation');
  const messages = (await as.get('chat.bsky.convo.getMessages', { convoId: convo.id, limit: 100 }, { chat: true })).messages || [];
  return { id: convo.id, messages };   // newest first
}
const links = m => (m?.facets || []).flatMap(f => f?.features || []).map(x => x?.uri).filter(u => typeof u === 'string');
// A list from the account: every one links to the guidelines, and nothing else it sends the approver does.
const isList = m => m?.sender?.did === ACCOUNT && links(m).includes(GUIDELINES);
/**
 * The asks a list is about, as at:// URIs in its order: number 1 first. Each title in it links to
 * its ask's page by DID. A list from before they were numbered linked by handle and asked about
 * one ask: the one whose row in the queue (`reviews`) has that message's ID.
 */
export function entriesOf(m, reviews = new Map()){
  const uris = [];
  for (const u of links(m)) {
    const [who, rkey] = (askAt(u) || '').split(' ');
    const ask = who?.startsWith('did:') && rkey ? `at://${who}/${SEED}/${rkey}` : null;
    if (ask && !uris.includes(ask)) uris.push(ask);
  }
  return uris.length ? uris : [...reviews.values()].filter(r => r.request_id && r.request_id === m?.id).map(r => r.seed_uri).slice(0, 1);
}

/**
 * Take the approver's answers, if there are any, let the posts go (`posting()`, which gives what
 * ./posts.js does), then tell the approver what came of them and send a new list, if one's due.
 * With `post: false`, only say what would be written and sent.
 *
 * { dryRun, waiting, decided: [{ ask, status, note, stale }], followedUp, asked, note }: `waiting`
 * is how many asks need an answer, `followedUp` the asks said yes to before whose posts the
 * approver was sent, and `asked` the asks in the list just sent.
 */
export async function review({ post = true, password = process.env.RAINSHARE_BLUESKY_APP_PASSWORD, now = Date.now(), log = console.log, read = reader(), as = session(password), db = null, approver = APPROVER, posting = null } = {}){
  const out = { dryRun: !post, waiting: 0, decided: [], followedUp: [], asked: [], note: null };
  const reviews = read.reviews ? await read.reviews() : null;
  if (!reviews) {
    out.note = db ? 'The review queue couldn’t be read, so nothing new is posted this run.' : 'There’s no review queue (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY aren’t set), so nothing new is posted.';
    log(out.note); return out;
  }
  if (post && !db) { out.note = 'The review queue can be read but not written: nothing is decided this run.'; log(out.note); return out; }
  const [seeds, takes, deliveries, hidden] = await Promise.all([read(SEED), read(TAKE), read(DELIVERY), read.hidden()]);
  const bySeed = new Map(seeds.map(s => [s.uri, s])), today = boundary(now, true), asked = s => Date.parse(s.value?.createdAt);
  const recent = seeds.filter(s => isNew(s.value, now) && !isHidden(hidden, s) && s.repo !== ACCOUNT && s.repo !== approver);
  // Everyone whose ask could be in a list, or in today's count of new asks.
  const shownBefore = [...reviews.values()].filter(r => r.request_id).map(r => bySeed.get(r.seed_uri)).filter(Boolean);
  const todays = seeds.filter(s => passable(s.value) && asked(s) >= today);
  const blocks = await blocked([...new Set([...recent, ...shownBefore, ...todays].map(s => s.repo))]);
  const ctx = { takes, deliveries, hidden, blocks, now };
  // Asks that need an answer, oldest first: those the account would post, unanswered for the version there now.
  const answered = s => { const r = reviews.get(s.uri); return !!r && r.cid === s.cid && r.status !== 'pending'; };
  const needed = recent.filter(s => !heldBack(s, ctx) && !answered(s)).sort((a, b) => asked(a) - asked(b));
  // Only an ask the queue has a row for, at that version, can be put to them: the index may not have caught up.
  const askable = needed.filter(s => reviews.get(s.uri)?.cid === s.cid);
  out.waiting = needed.length;
  // What the day's direct message about new asks counts so far (./messages.js), for most people: theirs leaves out their own.
  const daily = newOnBoard(seeds, { takes, deliveries, from: today, to: today + DAY, hidden, blocks, now }).length;
  if (!askable.length && !shownBefore.length && !posting) { if (needed.length) log(`${needed.length} waiting for review, not in the queue yet.`); return out; }

  if (!password) {
    if (askable.length) { out.asked = askable.map(s => s.uri); log(`Would show the approver ${askable.length} ${askable.length === 1 ? 'ask' : 'asks'} waiting for an answer: ${askable.map(s => `“${titleOf(s)}”`).join(', ')}. (Without the password, their answers can’t be read.)`); }
    return out;
  }
  let chat = null;
  const open = async () => {
    if (chat) return chat;
    await as.signIn();
    try { return chat = await chatWith(as, approver); }
    catch (e) { out.note = `Couldn’t open a conversation with the approver (${e.message}). They need to let @rainshare.dev message them on Bluesky. Until then nothing new is posted.`; log(out.note); return null; }
  };
  if ((askable.length || shownBefore.length) && !(await open())) return out;

  // The latest list, and what the approver has said since the account last wrote to them (its
  // own news for them, ./messages.js, doesn't count: it may come between a list and its answer).
  const messages = chat?.messages || [];
  const list = messages.find(isList) || null, entries = list ? entriesOf(list, reviews) : [];
  const lastOurs = messages.findIndex(m => m?.sender?.did === ACCOUNT && !isOurs(m));
  const replies = list ? (lastOurs < 0 ? messages : messages.slice(0, lastOurs)).filter(m => m?.sender?.did === approver).reverse() : [];
  // Whether an ask is in the latest list as it is now.
  const listedNow = s => { const r = s && reviews.get(s.uri); return !!list && !!r && r.request_id === list.id && r.cid === s.cid; };

  // Each answer, by the ask it's about: the latest answer for each counts. `said` holds what's said
  // once the posts have gone, in order.
  const said = [], answers = new Map(), notes = new Set();
  // A YES or NO with no numbers is about the asks in the list still waiting, or if none are, all of them.
  const numbers = entries.map((_, i) => i + 1), waitingIn = numbers.filter(n => { const s = bySeed.get(entries[n - 1]); return listedNow(s) && reviews.get(s.uri).status === 'pending'; });
  let heard = false;
  for (const m of replies) {
    for (const a of answersOf(m.text)) {
      heard = true;
      const all = !a.numbers.length && waitingIn.length > 0;
      if (!a.numbers.length && a.status === 'hidden' && entries.length > 1) { notes.add('Which one? Reply HIDE, its number in the list, and why.'); continue; }
      for (const n of a.numbers.length ? a.numbers : all ? waitingIn : numbers) {
        if (!entries[n - 1]) notes.add(`There’s no ${n} in the list.`);
        else answers.set(entries[n - 1], { ...a, n, all });
      }
    }
  }
  if (replies.length && !heard) said.push(r => r.add(help(entries.length)));

  // In the list's order, whatever order they were given in.
  const taken = [];
  for (const [uri, a] of [...answers].sort((x, y) => x[1].n - y[1].n)) {
    const s = bySeed.get(uri), row = reviews.get(uri);
    if (!s || !row) { if (!a.all) notes.add(`${a.n} isn’t on the board any more.`); continue; }
    if (!listedNow(s)) { taken.push({ s, d: { ask: uri, status: a.status, note: a.note, stale: true } }); continue; }
    // One already answered: a NO can become a YES, and anything can be hidden. A YES stands.
    if (row.status === 'hidden' || (a.all && row.status !== 'pending')) continue;
    const yes = ALLOWS.post.includes(row.status);
    if (row.status !== 'pending' && a.status !== 'hidden' && (yes || a.status === 'declined')) {
      notes.add(`“${titleOf(s)}” already has your ${REPLY[row.status]}.${yes && a.status === 'declined' ? ` If it’s posted, HIDE ${a.n} and why takes the post down.` : ''}`);
      continue;
    }
    const d = { ask: uri, status: a.status, note: a.note, stale: false };
    if (!post) log(`Would take the approver’s ${REPLY[a.status]} for ${uri}${a.note ? ` (“${a.note}”)` : ''}.`);
    else {
      try {
        if (a.status === 'hidden') {
          const record = moderationRecord({ subject: uri, reason: 'guidelines', note: a.note });
          await as.post('com.atproto.repo.putRecord', { repo: ACCOUNT, collection: MODERATION, rkey: keyOf(uri), record });
          hidden.set(uri, { subject: uri, action: 'hide', reason: 'guidelines', note: a.note, createdAt: record.createdAt, uri: null, rkeys: [keyOf(uri)] });
        }
        d.stale = !(await db.decide(uri, s.cid, a.status, approver, a.note));
        log(d.stale ? `${uri} changed after the approver was shown it: they’ll be asked again.` : `The approver said ${a.status} to ${uri}.`);
      } catch (e) { out.note = `Couldn’t take the approver’s answer about ${uri} (${e.message}). The next run tries again.`; log(out.note); return out; }
    }
    // (A dry run keeps it here too, so what it says it would send is what a live run would.)
    if (!d.stale) reviews.set(uri, { ...row, status: a.status, decided_at: new Date(now).toISOString(), decided_by: approver, note: a.note || null });
    out.decided.push(d);
    taken.push({ s, d, held: !d.stale && ALLOWS.post.includes(d.status) ? heldBack(s, ctx) : null });
  }

  // The posts, so what's said next can link to them.
  const posted = posting ? await posting() : null;
  const posts = Array.isArray(posted?.posts) ? posted.posts : [];
  const who = new Map();
  for (const { s, d, held } of taken) {
    const p = posts.find(x => x.ask === s.uri) || null;
    said.push(r => acked(r, { ...d, held, post: p && { uri: p.uri, error: p.error } }, s, who));
  }
  // Asks said yes to before, posted this run: the approver hears when they're up.
  const later = posts.filter(p => p.uri && !taken.some(t => t.s.uri === p.ask) && bySeed.has(p.ask) && ALLOWS.post.includes(reviews.get(p.ask)?.status) && ![ACCOUNT, approver].includes(bySeed.get(p.ask).repo))
    .map(p => ({ s: bySeed.get(p.ask), uri: p.uri }));
  if (later.length) { out.followedUp = later.map(x => x.s.uri); said.push(r => followUps(r, later)); }
  for (const n of notes) said.push(r => r.add(n));

  // Still waiting, after the answers. A new list goes when they've answered and some are, or when
  // it would show one they haven't been shown as it is now.
  const still = askable.filter(s => reviews.get(s.uri)?.status === 'pending' && reviews.get(s.uri)?.cid === s.cid && !isHidden(hidden, s));
  const names = [...still, ...taken.map(t => t.s), ...later.map(x => x.s)].map(s => s.repo);
  for (const t of taken) if (t.held?.by) names.push(t.held.by);
  // Asks from the last list that don't need an answer any more: said when a new list goes.
  const gone = list ? entries.map(u => bySeed.get(u)).filter(s => s && listedNow(s) && reviews.get(s.uri)?.status === 'pending' && !still.includes(s) && !answers.has(s.uri))
    .map(s => ({ s, held: heldBack(s, ctx) })).filter(g => g.held) : [];
  for (const g of gone) if (g.held.by) names.push(g.held.by);
  for (const [k, v] of await whoAre([...new Set(names)])) who.set(k, v);
  const first = still.length ? composeList(still, who, { daily }) : null;
  const due = !!first && (taken.length > 0 || first.shown.some(s => !listedNow(s)));
  if (due) for (const g of gone) said.push(r => { r.add('Off the list: '); quoted(r, g.s); r.add(', as '); return because(r, g.held, who).add('.'); });

  // What's said, as a message of its own: as many lines as fit, and the rest counted.
  const joined = lines => {
    const r = rich();
    let n = 0;
    for (const line of lines) {
      const trial = rich(); line(trial);
      if (!fits(r.text + '\n\n' + trial.text + '\n\nAnd 99 more answers taken.')) break;
      if (n++) r.add('\n\n');
      line(r);
    }
    if (lines.length > n) r.add(`${n ? '\n\n' : ''}And ${lines.length - n} more answers taken.`);
    return { message: r.build(), shown: [] };
  };
  const sending = [];
  if (due) {
    const together = said.length ? composeList(still, who, { daily, before: said }) : first;
    if (together) sending.push(together); else sending.push(joined(said), first);
  } else if (said.length) sending.push(joined(said));
  if (!sending.length) { if (still.length) log(`Waiting on the approver’s answer about ${still.length} ${still.length === 1 ? 'ask' : 'asks'}; ${needed.length} waiting in all.`); return out; }

  if (!post) {
    for (const x of sending) { log(`\nWould message the approver:\n  ${x.message.text.replace(/\n/g, '\n  ')}`); if (x.shown.length) out.asked = x.shown.map(s => s.uri); }
    return out;
  }
  if (!(await open())) return out;
  for (const x of sending) {
    try {
      const sent = await as.post('chat.bsky.convo.sendMessage', { convoId: chat.id, message: x.message }, { chat: true });
      if (!x.shown.length) continue;
      out.asked = x.shown.map(s => s.uri);
      for (const s of x.shown) if (!(await db.requested(s.uri, s.cid, sent?.id))) log(`${s.uri} changed as the approver was shown it: they’ll be asked again.`);
      log(`Showed the approver ${x.shown.length} ${x.shown.length === 1 ? 'ask' : 'asks'} waiting for an answer.`);
    } catch (e) { out.note = `Couldn’t message the approver (${e.message}).`; log(out.note); return out; }
  }
  return out;
}
