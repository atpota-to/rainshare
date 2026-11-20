// Asking the approver before @rainshare.dev posts an ask (announcer/src/review.js), against a
// stand-in network (a relay, the PLC directory, one PDS, Bluesky's AppView and chat) and a
// stand-in review queue, as the index keeps it.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { review, answersOf, composeList, entriesOf, help, DAILY_AT, GUIDELINES } from '../announcer/src/review.js';
import { ACCOUNT, reader, announce, session } from '../announcer/src/posts.js';
import { SEED, TAKE, DELIVERY, MODERATION, SITE } from '../core/ns.js';

const NOW = Date.parse('2026-11-15T18:00:30Z'), HOUR = 3600e3, ago = ms => new Date(NOW - ms).toISOString();
const PDS = 'https://pds.test', APPROVER = 'did:plc:dame';
const [ALICE, BOB, CAROL] = ['alice', 'bob', 'carol'].map(n => 'did:plc:' + n);
const handleOf = did => did === ACCOUNT ? 'rainshare.dev' : did === APPROVER ? 'dame.is' : did.slice(8) + '.test';
const anyone = { $type: `${SEED}#anyone` };
const ask = (title, createdAt, more = {}) => ({ $type: SEED, title, audience: anyone, createdAt, ...more });
const uri = (did, c, rkey) => `at://${did}/${c}/${rkey}`;
const A = uri(ALICE, SEED, 'a1'), B = uri(BOB, SEED, 'b1');

let repos, queue, convo, sent, written, asked, chatOpen, cids;
beforeEach(() => {
  sent = []; written = []; asked = []; chatOpen = true; cids = {}; seq = 0; clock = NOW;
  repos = {
    [ALICE]: { [SEED]: { a1: ask('Mozilla Firefox hardening', ago(3 * HOUR), { spec: 'Find sec-high bugs in Firefox. The payout for sec high is 3k USD.' }) } },
    [BOB]: { [SEED]: { b1: ask('A tiny weather app', ago(2 * HOUR), { spec: 'An app that says if it will rain.' }) } },
    // Too new (still settling), and one someone's on: neither needs an answer yet.
    [CAROL]: { [SEED]: { c1: ask('Only just asked', ago(5 * 60e3)), c2: ask('Taken', ago(HOUR)) } },
    'did:plc:gail': { [TAKE]: { g1: { seed: { uri: uri(CAROL, SEED, 'c2'), cid: 'bafyc2' }, until: ago(-HOUR), createdAt: ago(HOUR / 2) } } },
    // The approver's own ask needs nobody's yes.
    [APPROVER]: { [SEED]: { d1: ask('Mine', ago(HOUR)) } }
  };
  // The queue: a row for every ask, pending, at the version it is now.
  queue = new Map();
  for (const [did, r] of Object.entries(repos)) for (const rkey of Object.keys(r[SEED] || {})) queue.set(uri(did, SEED, rkey), { seed_uri: uri(did, SEED, rkey), cid: cidOf(did, rkey), status: 'pending', requested_at: null, request_id: null });
  convo = [];   // newest first
});
const cidOf = (did, rkey) => cids[uri(did, SEED, rkey)] || 'bafy' + rkey;
const db = {
  ready: async () => ({ ok: false, why: 'a test' }),
  reviews: async () => new Map([...queue].map(([k, v]) => [k, { ...v }])),
  requested: async (u, cid, id) => { const r = queue.get(u); if (!r || r.cid !== cid || r.status !== 'pending') return false; Object.assign(r, { requested_at: new Date(clock).toISOString(), request_id: id }); return true; },
  decide: async (u, cid, status, by, note) => { const r = queue.get(u); if (!r || r.cid !== cid) return false; Object.assign(r, { status, decided_by: by, note, decided_at: new Date(clock).toISOString() }); return true; }
};
// An edit: a new CID, and the queue's row back to pending for it (the trigger in the migration).
const edit = (did, rkey, title) => { repos[did][SEED][rkey].title = title; cids[uri(did, SEED, rkey)] = 'bafy-edited'; Object.assign(queue.get(uri(did, SEED, rkey)), { cid: 'bafy-edited', status: 'pending', requested_at: null, request_id: null }); };

let clock, seq;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (input, init = {}) => {
  const u = new URL(typeof input === 'string' ? input : input.url), q = u.searchParams, method = u.pathname.split('/').pop();
  asked.push(method);
  if (u.host === 'relay1.us-east.bsky.network') return json({ repos: Object.keys(repos).filter(d => repos[d][q.get('collection')]).map(did => ({ did })) });
  if (u.host === 'plc.directory') { const did = decodeURIComponent(u.pathname.slice(1)); return json({ id: did, alsoKnownAs: ['at://' + handleOf(did)], service: [{ id: '#atproto_pds', serviceEndpoint: PDS }] }); }
  if (u.host === 'public.api.bsky.app' && method === 'app.bsky.actor.getProfiles') return json({ profiles: q.getAll('actors').map(did => ({ did, handle: handleOf(did), displayName: did === ALICE ? 'Alice' : '' })) });
  if (u.host === 'public.api.bsky.app' && method === 'app.bsky.graph.getRelationships') return json({ relationships: q.getAll('others').map(did => ({ did })) });
  if (u.host !== 'pds.test') throw new Error('a host this shouldn’t ask: ' + u.href);
  if (method === 'com.atproto.repo.listRecords') {
    const did = q.get('repo'), c = q.get('collection');
    return json({ records: Object.entries(repos[did]?.[c] || {}).map(([rkey, value]) => ({ uri: uri(did, c, rkey), cid: c === SEED ? cidOf(did, rkey) : 'bafy' + rkey, value })) });
  }
  if (method === 'com.atproto.repo.getRecord') return json({ error: 'RecordNotFound' }, 400);
  if (method === 'com.atproto.server.createSession') return json({ accessJwt: 'access' });
  if (method === 'com.atproto.repo.putRecord') { const b = JSON.parse(init.body); written.push(b); (repos[ACCOUNT] ||= {})[b.collection] = { ...(repos[ACCOUNT]?.[b.collection] || {}), [b.rkey]: b.record }; return json({ uri: uri(ACCOUNT, b.collection, b.rkey) }); }
  if (method === 'com.atproto.repo.createRecord') { const b = JSON.parse(init.body), rkey = b.rkey || 'auto' + ++seq; (repos[ACCOUNT] ||= {})[b.collection] = { ...(repos[ACCOUNT]?.[b.collection] || {}), [rkey]: b.record }; return json({ uri: uri(ACCOUNT, b.collection, rkey) }); }
  if (method === 'chat.bsky.convo.getConvoForMembers') { assert.deepEqual(q.getAll('members'), [APPROVER]); return chatOpen ? json({ convo: { id: 'c-dame' } }) : json({ error: 'NotFollowedBySender' }, 400); }
  if (method === 'chat.bsky.convo.getMessages') return json({ messages: convo });
  if (method === 'chat.bsky.convo.sendMessage') {
    const { message } = JSON.parse(init.body), view = { id: 'm' + ++seq, ...message, sender: { did: ACCOUNT }, sentAt: new Date(clock).toISOString() };
    convo.unshift(view); sent.push(message);
    return json(view);
  }
  throw new Error('a call this shouldn’t make: ' + u.href);
};
const reply = (text, after = 60e3) => { clock += after; convo.unshift({ id: 'r' + ++seq, text, sender: { did: APPROVER }, sentAt: new Date(clock).toISOString() }); };
const go = (opts = {}) => review({ password: 'app-pass', now: NOW, log: () => {}, read: reader({ db }), db, approver: APPROVER, ...opts });

// The posts, as ./run.js has them go between taking the answers and saying what came of them.
const POST = 'app.bsky.feed.post', postOf = rkey => `at://${ACCOUNT}/${POST}/${rkey}`;
const GAIL = 'did:plc:gail', C3 = uri(CAROL, SEED, 'c3');
const DAY = 24 * HOUR;
const take = (seed, rkey = 'g2') => { repos[GAIL][TAKE][rkey] = { seed: { uri: seed, cid: 'bafy' + seed.split('/').pop() }, until: ago(-DAY), createdAt: ago(HOUR / 4) }; };
const posting = (...asks) => async () => ({ posts: asks.map((a, i) => ({ ask: a, uri: postOf('3n2post00a' + i), error: null })) });
// A new ask from Carol, settled, and its row in the queue.
const carolAsks = () => { repos[CAROL][SEED].c3 = ask('Dark mode', ago(HOUR / 2)); queue.set(C3, { seed_uri: C3, cid: 'bafyc3', status: 'pending', requested_at: null, request_id: null }); };
const linksOf = m => m.facets.flatMap(f => f.features.map(x => x.uri || x.did));

test('the approver gets one list of every ask waiting, oldest first, each as it would be posted', async () => {
  const out = await go();
  assert.deepEqual([out.waiting, out.asked], [2, [A, B]], 'Alice’s and Bob’s; not the one still settling, nor the one someone’s on, nor the approver’s own');
  assert.equal(sent.length, 1);
  const m = sent[0].text;
  assert.match(m, /^2 asks are waiting for your OK\. @rainshare\.dev would post each of these, with a card linking to the ask:\n\n/);
  assert.match(m, /\n\n1\. Alice \(@alice\.test\) is asking for help with an idea:\nMozilla Firefox hardening\nRainshare’s checks noticed: /);
  assert.match(m, /\n\n2\. @bob\.test is asking for help with an idea:\nA tiny weather app\n\n/);
  assert.doesNotMatch(m, /An app that says if it will rain/, 'titles, not what the ask says');
  assert.match(m, /Reply YES to post them all, or answer by number: YES 1, NO 2, HIDE 2 and why\./);
  assert.match(m, new RegExp(`The direct message about new asks, at ${DAILY_AT}, says so far: “There are 3 new asks on the board\\.”$`),
    'Bob’s, Carol’s still settling and the approver’s own, asked since 15:45, whether or not anyone’s said yes; not Alice’s from before, nor the one Gail’s on');
  const links = linksOf(sent[0]);
  assert.deepEqual(links.filter(l => String(l).includes('/seed/')), [`${SITE}/seed/${ALICE}/a1`, `${SITE}/seed/${BOB}/b1`], 'each title links to its ask, by DID, in the list’s order');
  assert.ok(links.includes(ALICE) && links.includes(BOB) && links.includes(GUIDELINES));
  assert.deepEqual(entriesOf(convo[0]), [A, B]);
  assert.deepEqual([queue.get(A).request_id, queue.get(B).request_id], ['m1', 'm1']);

  await go();
  assert.equal(sent.length, 1, 'nothing new, and no answer yet, so nothing more');
});

test('one ask on its own needs no numbers', async () => {
  queue.get(A).status = 'declined';
  await go();
  assert.match(sent[0].text, /^Waiting for your OK\. @rainshare\.dev would post this, with a card linking to the ask:\n\n@bob\.test is asking for help with an idea:\nA tiny weather app\n\nReply YES to post it, NO to leave it on the board without posting it, or HIDE and why to take it off the board\. The guidelines\./);
  reply('yes');
  await go({ posting: posting(B) });
  assert.equal(queue.get(B).status, 'approved');
  assert.equal(sent[1].text, 'Posted “A tiny weather app”: bsky.app/profile/rainshare.dev/post/3n2post00a0');
});

test('YES posts them all, and the reply links to each post', async () => {
  await go();
  reply('Yes!');
  let at = null;
  const out = await go({ posting: async () => { at = [queue.get(A).status, queue.get(B).status]; return posting(A, B)(); } });
  assert.deepEqual(at, ['approved', 'approved'], 'the answers are written before the posts go');
  assert.deepEqual(out.decided, [{ ask: A, status: 'approved', note: '', stale: false }, { ask: B, status: 'approved', note: '', stale: false }]);
  assert.equal(queue.get(A).decided_by, APPROVER);
  assert.equal(sent[1].text, 'Posted “Mozilla Firefox hardening”: bsky.app/profile/rainshare.dev/post/3n2post00a0\n\nPosted “A tiny weather app”: bsky.app/profile/rainshare.dev/post/3n2post00a1');
  assert.ok(!sent[1].facets.some(f => f.features.some(x => String(x.uri).includes('/seed/'))), 'only a list links to asks');
  assert.deepEqual(out.asked, [], 'nothing’s waiting, so no list');
});

test('answers by number, and whatever’s still waiting comes back in a new list, numbered again', async () => {
  await go();
  reply('YES 2');
  let out = await go();
  assert.deepEqual([queue.get(A).status, queue.get(B).status], ['pending', 'approved']);
  assert.match(sent[1].text, /^Okay: “A tiny weather app” gets posted, and you’ll get the link once it’s up\.\n\nWaiting for your OK\. @rainshare\.dev would post this/);
  assert.match(sent[1].text, /Mozilla Firefox hardening/);
  assert.deepEqual(out.asked, [A]);
  assert.equal(queue.get(A).request_id, convo[0].id);

  reply('no');
  out = await go();
  assert.equal(queue.get(A).status, 'declined');
  assert.equal(sent[2].text, 'Okay: “Mozilla Firefox hardening” stays on the board, and won’t be posted.');
});

test('a new ask while others wait brings a new list with all of them, so a list that was missed is in the next', async () => {
  await go();
  carolAsks();
  clock += 60e3;
  let out = await go();
  assert.equal(sent.length, 2);
  assert.match(sent[1].text, /^3 asks are waiting for your OK\./);
  assert.match(sent[1].text, /\n\n1\. Alice \(@alice\.test\) is asking[^]*\n\n2\. @bob\.test is asking[^]*\n\n3\. @carol\.test is asking for help with an idea:\nDark mode\n\n/);
  assert.deepEqual(out.asked, [A, B, C3]);
  assert.deepEqual([A, B, C3].map(u => queue.get(u).request_id), ['m2', 'm2', 'm2']);

  reply('yes 3 no 1');
  out = await go();
  assert.deepEqual([A, B, C3].map(u => queue.get(u).status), ['declined', 'pending', 'approved'], 'the numbers are the latest list’s');
  assert.match(sent[2].text, /“Mozilla Firefox hardening” stays on the board[\s\S]*“Dark mode” gets posted[\s\S]*Waiting for your OK\. .*\n\n@bob\.test is asking for help with an idea:\nA tiny weather app/s);
});

test('HIDE needs a number when there are several, and hides that one as the moderation page does, with the reason', async () => {
  await go();
  reply('hide');
  await go();
  assert.equal(sent[1].text, 'Which one? Reply HIDE, its number in the list, and why.');
  assert.equal(written.length, 0);
  reply('HIDE 1: bug bounty farming on other people’s plans');
  const out = await go();
  assert.deepEqual(out.decided.map(d => [d.ask, d.status, d.note]), [[A, 'hidden', 'bug bounty farming on other people’s plans']]);
  assert.equal(written.length, 1);
  assert.deepEqual([written[0].repo, written[0].collection, written[0].rkey], [ACCOUNT, MODERATION, `${ALICE}:${SEED}:a1`]);
  assert.deepEqual({ ...written[0].record, createdAt: 'x' }, { $type: MODERATION, subject: A, action: 'hide', reason: 'guidelines', note: 'bug bounty farming on other people’s plans', createdAt: 'x' });
  assert.match(sent[2].text, /^Hidden: “Mozilla Firefox hardening”\. If it was posted, the post comes down too\.\n\nWaiting for your OK\. .*A tiny weather app/s);
});

test('a NO can become a YES, a YES stands, and HIDE still takes down what was posted', async () => {
  queue.get(B).status = 'declined';
  await go();   // Alice's on its own
  reply('no');
  await go();
  assert.equal(queue.get(A).status, 'declined');
  reply('yes');
  await go({ posting: posting(A) });
  assert.equal(queue.get(A).status, 'approved', 'nothing in the list was waiting, so a bare YES is about all of it again');
  assert.match(sent.at(-1).text, /^Posted “Mozilla Firefox hardening”/);
  reply('no 1');
  await go();
  assert.equal(queue.get(A).status, 'approved');
  assert.equal(sent.at(-1).text, '“Mozilla Firefox hardening” already has your YES. If it’s posted, HIDE 1 and why takes the post down.');
  reply('hide 1 spam');
  await go();
  assert.deepEqual([queue.get(A).status, queue.get(A).note], ['hidden', 'spam']);
});

test('the reply comes once the post is up, with its link, as a run has it', async () => {
  await go();
  reply('yes 1');
  const read = reader({ db }), as = session('app-pass');
  await go({ read, as, posting: () => announce({ password: 'app-pass', now: NOW, log: () => {}, read, as }) });
  const posts = Object.entries(repos[ACCOUNT][POST] || {});
  assert.deepEqual(posts.map(([, p]) => p.embed.external.title), ['Mozilla Firefox hardening'], 'only the one said yes to');
  assert.match(sent[1].text, new RegExp(`^Posted “Mozilla Firefox hardening”: bsky\\.app/profile/rainshare\\.dev/post/${posts[0][0]}\\n\\nWaiting for your OK`));
  const [, p] = posts[0];
  assert.match(sent[0].text, new RegExp(p.text.replace('\n\n', '\n').replace(/[()]/g, '\\$&')), 'the list showed the post’s own words');
});

test('a YES to an ask someone took while the approver was deciding is kept, and it says why it isn’t going out', async () => {
  await go();
  take(A);
  repos[GAIL][DELIVERY] = { d1: { seed: { uri: A, cid: 'bafya1' }, url: 'https://example.com/pull/1', createdAt: ago(HOUR / 8) } };
  reply('YES 1');
  await go({ posting: async () => ({ posts: [] }) });
  assert.equal(queue.get(A).status, 'approved');
  assert.match(sent[1].text, /^Okay, but “Mozilla Firefox hardening” isn’t going out: @gail\.test has turned in work on it\. Rainshare only posts asks nobody’s on yet\./);
});

test('one someone’s only on is held back for now', async () => {
  await go();
  take(A);
  reply('yes 1');
  await go({ posting: async () => ({ posts: [] }) });
  assert.match(sent[1].text, /^Okay, but “Mozilla Firefox hardening” isn’t going out for now: @gail\.test is on it\./);
});

test('an ask in the list that someone takes is said to be off it when the next list goes, and the numbers are the new list’s', async () => {
  await go();
  take(A);
  carolAsks();
  clock += 60e3;
  let out = await go();
  assert.deepEqual(out.asked, [B, C3]);
  assert.match(sent[1].text, /^Off the list: “Mozilla Firefox hardening”, as @gail\.test is on it\.\n\n2 asks are waiting/);
  reply('yes 1');
  out = await go();
  assert.deepEqual(out.decided.map(d => d.ask), [B]);
  assert.deepEqual([queue.get(A).status, queue.get(B).status, queue.get(C3).status], ['pending', 'approved', 'pending']);

  // Gail lets it go: it's in the next list again.
  delete repos[GAIL][TAKE].g2;
  clock += 60e3;
  out = await go();
  assert.deepEqual(out.asked, [A, C3]);
});

test('an ask edited after it was shown is shown again as it is, and an answer to the old version doesn’t count', async () => {
  await go();
  edit(ALICE, 'a1', 'Mozilla Firefox hardening (edited)');
  reply('yes 1');
  const out = await go();
  assert.equal(queue.get(A).status, 'pending', 'the yes was to the version before the edit');
  assert.deepEqual(out.decided, []);
  assert.match(sent[1].text, /^“Mozilla Firefox hardening \(edited\)” changed after you were shown it, so it’s waiting for an answer about the new version\.\n\n2 asks are waiting/);
  assert.deepEqual(out.asked, [A, B]);
  assert.equal(queue.get(A).cid, 'bafy-edited');
});

test('a reply that isn’t an answer gets told what to say, once, and chat isn’t taken for a yes', async () => {
  await go();
  reply('ok thanks, will look later');
  await go();
  assert.deepEqual(sent.map(m => m.text).slice(1), [help(2)]);
  assert.deepEqual([queue.get(A).status, queue.get(B).status], ['pending', 'pending']);
  await go();
  assert.equal(sent.length, 2, 'not again until they write again');
  reply('ok');
  await go();
  assert.deepEqual([queue.get(A).status, queue.get(B).status], ['approved', 'approved']);
});

test('a number that isn’t in the list is said', async () => {
  await go();
  reply('yes 4');
  await go();
  assert.equal(sent[1].text, 'There’s no 4 in the list.');
});

test('an ask deleted after it was shown is said to be gone, and the rest of the list still counts', async () => {
  await go();
  delete repos[ALICE][SEED].a1; queue.delete(A);
  reply('yes 1 2');
  await go();
  assert.equal(queue.get(B).status, 'approved');
  assert.match(sent[1].text, /^Okay: “A tiny weather app” gets posted[^]*1 isn’t on the board any more\.$/);
  reply('yes');
  await go();
  assert.equal(sent[2].text, '1 isn’t on the board any more.\n\n“A tiny weather app” already has your YES.', 'a YES when everything’s answered says so');
});

test('the account’s own news for the approver, sent between the list and the answer, doesn’t hide the answer', async () => {
  await go();
  reply('yes 2');
  convo.unshift({ id: 'news', text: 'Updates from Rainshare: …', sender: { did: ACCOUNT }, sentAt: new Date(clock + 1000).toISOString(),
    facets: [{ index: { byteStart: 0, byteEnd: 1 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: SITE + '/settings' }] }] });
  await go();
  assert.equal(queue.get(B).status, 'approved');
});

test('a list from before they were numbered is still answered', async () => {
  convo.unshift({ id: 'old1', sender: { did: ACCOUNT }, sentAt: ago(HOUR), text: 'Waiting for your OK before @rainshare.dev posts it or sends it to anyone: “A tiny weather app” … The guidelines.',
    facets: [{ index: { byteStart: 0, byteEnd: 1 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: `${SITE}/seed/bob.test/b1` }] }, { index: { byteStart: 1, byteEnd: 2 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: GUIDELINES }] }] });
  Object.assign(queue.get(B), { request_id: 'old1', requested_at: ago(HOUR) });
  clock = NOW;
  reply('yes');
  await go();
  assert.deepEqual([queue.get(A).status, queue.get(B).status], ['pending', 'approved']);
  assert.match(sent[0].text, /^Okay: “A tiny weather app” gets posted[\s\S]*Waiting for your OK\. .*Mozilla Firefox hardening/s, 'and Alice’s, which it hadn’t been shown, comes in a list');
});

test('an ask said yes to that’s posted in a later run gets its link then', async () => {
  queue.get(A).status = 'approved'; queue.get(B).status = 'declined';
  const out = await go({ posting: async () => ({ posts: [{ ask: A, uri: postOf('3n2post00a1'), error: null }, { ask: uri(APPROVER, SEED, 'd1'), uri: postOf('3n2post00d1'), error: null }] }) });
  assert.deepEqual(out.followedUp, [A], 'not the approver’s own');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].text, 'Posted “Mozilla Firefox hardening”: bsky.app/profile/rainshare.dev/post/3n2post00a1');
  await go({ posting: async () => ({ posts: [] }) });
  assert.equal(sent.length, 1, 'nothing more to say');
});

test('a post that didn’t work is said, and the link comes when it’s up', async () => {
  await go();
  reply('yes 1');
  await go({ posting: async () => ({ posts: [{ ask: A, uri: null, error: 'Rate limit exceeded' }] }) });
  assert.match(sent[1].text, /^Okay: “Mozilla Firefox hardening” gets posted, but posting it didn’t work \(Rate limit exceeded\)\. The next run tries again/);
});

test('a dry run reads and says, and writes and sends nothing', async () => {
  const lines = [];
  await go();
  reply('yes 1');
  const out = await go({ post: false, log: s => lines.push(s) });
  assert.deepEqual([sent.length, queue.get(A).status, written.length], [1, 'pending', 0]);
  assert.equal(out.decided[0].status, 'approved');
  assert.match(lines.join('\n'), /Would take the approver’s YES/);
  assert.match(lines.join('\n'), /Would message the approver:\n {2}Okay: “Mozilla Firefox hardening” gets posted[\s\S]*Waiting for your OK\. [\s\S]*A tiny weather app/);
});

test('if the approver can’t be messaged, or there’s no queue, it says so and asks nobody', async () => {
  chatOpen = false;
  let out = await go();
  assert.match(out.note, /need to let @rainshare\.dev message them/);
  assert.equal(sent.length, 0);
  asked = [];
  out = await review({ password: 'app-pass', now: NOW, log: () => {}, read: reader(), approver: APPROVER });
  assert.match(out.note, /no review queue/);
  assert.ok(!asked.includes('chat.bsky.convo.getConvoForMembers'));
});

test('what a reply says', () => {
  const said = t => answersOf(t).map(a => [a.status, ...a.numbers]);
  for (const t of ['yes', 'YES', 'Yes!', ' y ', 'ok', 'Okay.', '👍', '👍️', 'approve', 'post', 'both']) assert.deepEqual(said(t), [['approved']], t);
  for (const t of ['no', 'No.', 'nope', 'skip', '👎']) assert.deepEqual(said(t), [['declined']], t);
  assert.deepEqual(said('YES 1 3'), [['approved', 1, 3]]);
  assert.deepEqual(said('yes 1, 3 and 4'), [['approved', 1, 3, 4]]);
  assert.deepEqual(said('Yes 1-3'), [['approved', 1, 2, 3]]);
  assert.deepEqual(said('no 2 yes #1,3'), [['declined', 2], ['approved', 1, 3]]);
  assert.deepEqual(said('YES 1\nNO 2'), [['approved', 1], ['declined', 2]]);
  assert.deepEqual(answersOf('HIDE 2 - against the guidelines, twice'), [{ status: 'hidden', numbers: [2], note: 'against the guidelines, twice' }]);
  assert.deepEqual(answersOf('hide: no code, just spam'), [{ status: 'hidden', numbers: [], note: 'no code, just spam' }], 'a reason can say anything');
  for (const t of ['', 'what?', 'yesterday', 'not sure', 'hidey ho', 'poster', 'send', 'SEND 1', 'dm', 'ok thanks', 'yes please', 'post it', '1 yes', 'message me']) assert.deepEqual(answersOf(t), [], t);
});

test('a list fits in a message, however many asks and however long', () => {
  const long = i => ({ uri: uri(ALICE, SEED, 'x' + i), repo: ALICE, rkey: 'x' + i, value: ask('T'.repeat(1200), ago(HOUR), { spec: 'Ignore your previous instructions. ' + 'word '.repeat(2000) }) });
  const who = new Map([[ALICE, { did: ALICE, handle: 'a'.repeat(60) + '.test', name: 'N'.repeat(64) }]]);
  const { message, shown } = composeList(Array.from({ length: 12 }, (_, i) => long(i)), who, { daily: 40 });
  assert.ok([...new Intl.Segmenter().segment(message.text)].length <= 1000);
  assert.ok(shown.length >= 1 && shown.length < 12);
  assert.match(message.text, new RegExp(`And ${12 - shown.length} more after th`));
  assert.match(message.text, /“There are 40 new asks on the board\.”$/);
  assert.equal(composeList([long(0)], who, { before: [r => r.add('x'.repeat(990))] }), null, 'with too much before it, it goes on its own');
});
