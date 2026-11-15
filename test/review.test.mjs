// Asking the approver before @rainshare.dev passes an ask on (announcer/src/review.js), against a
// stand-in network (a relay, the PLC directory, one PDS, Bluesky's AppView and chat) and a
// stand-in review queue, as the index keeps it.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { review, answerOf, composeRequest, HELP } from '../announcer/src/review.js';
import { ACCOUNT, reader } from '../announcer/src/posts.js';
import { SEED, TAKE, MODERATION, SITE } from '../core/ns.js';

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

test('the approver is asked about one ask at a time, the oldest first, and nothing more until they answer', async () => {
  const out = await go();
  assert.deepEqual([out.waiting, out.asked], [2, A], 'Alice’s and Bob’s; not the one still settling, nor the one someone’s on, nor the approver’s own');
  assert.equal(sent.length, 1);
  const m = sent[0].text;
  assert.match(m, /^Waiting for your OK before @rainshare\.dev posts it or sends it to anyone:\n\n“Mozilla Firefox hardening” from Alice \(@alice\.test\)/);
  assert.match(m, /Find sec-high bugs in Firefox/);
  assert.match(m, /Reply YES to post it and send it out, NO to leave it on the board without passing it on, or HIDE to hide it/);
  assert.match(m, /1 more is waiting\.$/);
  const links = sent[0].facets.flatMap(f => f.features.map(x => x.uri || x.did));
  assert.ok(links.includes(`${SITE}/seed/alice.test/a1`) && links.includes(ALICE) && links.includes(`${SITE}/guidelines`));
  assert.equal(queue.get(A).request_id, 'm1');

  await go();
  assert.equal(sent.length, 1, 'no answer yet, so nothing more');
});

test('YES goes out, and the next ask comes in the same message', async () => {
  await go();
  reply('Yes!');
  const out = await go();
  assert.deepEqual(out.decided, [{ ask: A, status: 'approved', note: '', stale: false }]);
  assert.equal(queue.get(A).status, 'approved');
  assert.equal(queue.get(A).decided_by, APPROVER);
  assert.match(sent[1].text, /^Okay: “Mozilla Firefox hardening” goes out\.\n\nWaiting for your OK before .*\n\n“A tiny weather app” from @bob\.test/s);
  assert.equal(queue.get(B).request_id, convo[0].id);
  assert.doesNotMatch(sent[1].text, /more (is|are) waiting/, 'nothing else is');
});

test('HIDE hides it as the moderation page does, with the rest of the reply as the reason', async () => {
  await go();
  reply('hide: bug bounty farming on other people’s plans');
  const out = await go();
  assert.deepEqual(out.decided.map(d => [d.status, d.note]), [['hidden', 'bug bounty farming on other people’s plans']]);
  assert.equal(written.length, 1);
  assert.deepEqual([written[0].repo, written[0].collection, written[0].rkey], [ACCOUNT, MODERATION, `${ALICE}:${SEED}:a1`]);
  assert.deepEqual({ ...written[0].record, createdAt: 'x' }, { $type: MODERATION, subject: A, action: 'hide', reason: 'guidelines', note: 'bug bounty farming on other people’s plans', createdAt: 'x' });
  assert.match(sent[1].text, /^Hidden: “Mozilla Firefox hardening”\. If it was posted, the post comes down too\./);
});

test('NO keeps it on the board and never passes it on', async () => {
  await go();
  reply('no');
  await go();
  assert.equal(queue.get(A).status, 'declined');
  assert.match(sent[1].text, /^Okay: “Mozilla Firefox hardening” stays on the board, and won’t be posted or sent\./);
});

test('a reply that isn’t an answer gets told what to say, once', async () => {
  await go();
  reply('what is this?');
  await go();
  assert.deepEqual(sent.map(m => m.text).slice(1), [HELP]);
  await go();
  assert.equal(sent.length, 2, 'not again until they write again');
  reply('ok');
  await go();
  assert.equal(queue.get(A).status, 'approved');
});

test('an ask edited after the approver was asked is asked about again, and an old yes doesn’t count', async () => {
  await go();
  edit(ALICE, 'a1', 'Mozilla Firefox hardening (edited)');
  reply('yes');
  const out = await go();
  assert.equal(queue.get(A).status, 'pending', 'the yes was to the version before the edit');
  assert.equal(out.asked, A, 'so it’s asked about again, as it is now');
  assert.match(sent[1].text, /“Mozilla Firefox hardening \(edited\)”/);
  assert.equal(queue.get(A).cid, 'bafy-edited');
});

test('a dry run reads and says, and writes and sends nothing', async () => {
  const lines = [];
  await go();
  reply('yes');
  const out = await go({ post: false, log: s => lines.push(s) });
  assert.deepEqual([sent.length, queue.get(A).status, written.length], [1, 'pending', 0]);
  assert.equal(out.decided[0].status, 'approved');
  assert.match(lines.join('\n'), /Would take the approver’s YES/);
  assert.match(lines.join('\n'), /Would message the approver:\n {2}Okay: “Mozilla Firefox hardening” goes out\./);
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
  for (const t of ['yes', 'YES', 'Yes!', ' y ', 'ok', 'Okay.', '👍', '👍️', 'approve']) assert.equal(answerOf(t).status, 'approved', t);
  for (const t of ['no', 'No.', 'nope', 'skip', '👎']) assert.equal(answerOf(t).status, 'declined', t);
  assert.deepEqual(answerOf('HIDE - against the guidelines'), { status: 'hidden', note: 'against the guidelines' });
  assert.deepEqual(answerOf('hide'), { status: 'hidden', note: '' });
  for (const t of ['', 'what?', 'yesterday', 'not sure', 'hidey ho']) assert.deepEqual(answerOf(t), {}, t);
});

test('a request fits in a message, however long the ask', () => {
  const s = { uri: A, repo: ALICE, rkey: 'a1', value: ask('T'.repeat(1200), ago(HOUR), { spec: 'word '.repeat(20000) }) };
  const m = composeRequest(s, { did: ALICE, handle: 'a'.repeat(60) + '.test', name: 'N'.repeat(64) }, { before: [r => r.add(HELP)], more: 12 });
  assert.ok([...new Intl.Segmenter().segment(m.text)].length <= 1000);
  assert.match(m.text, /12 more are waiting\.$/);
});
