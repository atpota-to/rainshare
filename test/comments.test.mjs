// Comments on a seed: the record, how they're put into threads, and the example circle's.
// (The real source, against a fake network, is in source.test.mjs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../core/records.js';
import { threads, commentCount, talksOn, fromForge } from '../core/comments.js';
import { issueComments, parseSubject } from '../core/subjects.js';
import { createDemoSource } from '../core/demo.js';
import { COMMENT } from '../core/ns.js';

const seed = { uri: 'at://did:plc:asker/dev.rainshare.seed/3k1', cid: 'bafyseed' };
const other = 'at://did:plc:asker/dev.rainshare.seed/3k2';
const at = n => new Date(Date.UTC(2026, 10, 1, 0, n)).toISOString();
const uriOf = (by, rkey) => `at://did:plc:${by}/${COMMENT}/${rkey}`;
/** A comment record as the source hands it over: `parent` is the rkey of the one it answers. */
const said = (rkey, by, n, text, { parent, parentBy = by, on = seed.uri } = {}) => ({
  uri: uriOf(by, rkey), cid: 'bafy' + rkey, repo: `did:plc:${by}`, rkey,
  value: { $type: COMMENT, seed: { uri: on, cid: 'x' }, text, createdAt: at(n), ...(parent ? { parent: { uri: uriOf(parentBy, parent), cid: 'x' } } : {}) }
});

test('a comment needs a seed and something to say, and a reply has to be on the same seed', () => {
  const c = R.comment({ seed, text: '  Does it need to work offline?  ' });
  assert.equal(c.$type, COMMENT);
  assert.deepEqual(c.seed, { uri: seed.uri, cid: seed.cid });
  assert.equal(c.text, 'Does it need to work offline?');
  assert.equal(c.parent, undefined);
  assert.ok(!isNaN(Date.parse(c.createdAt)));
  assert.equal([...new Intl.Segmenter().segment(R.comment({ seed, text: '🌧'.repeat(4000) }).text)].length, 3000, 'clipped to the lexicon’s limit');
  assert.throws(() => R.comment({ seed, text: '   ' }), /Write something/);
  assert.throws(() => R.comment({ seed: { uri: seed.uri }, text: 'hi' }), /can’t be found/);
  const first = { uri: uriOf('kai', 'c1'), cid: 'bafyc1', value: { seed: { uri: seed.uri } } };
  assert.deepEqual(R.comment({ seed, parent: first, text: 'Yes' }).parent, { uri: first.uri, cid: first.cid });
  assert.throws(() => R.comment({ seed, parent: { ...first, value: { seed: { uri: other } } }, text: 'Yes' }), /isn’t on this one/);
  assert.throws(() => R.comment({ seed, parent: { uri: first.uri, value: first.value }, text: 'Yes' }), /isn’t on this one/);
});

test('threads: replies, however deep, sit under the comment that started them, oldest first', () => {
  const list = [
    said('d', 'kai', 40, 'A second question'),
    said('c', 'kai', 30, 'Thanks!', { parent: 'b', parentBy: 'asker' }),
    said('a', 'kai', 10, 'Past shifts too?'),
    said('b', 'asker', 20, 'Only upcoming ones.', { parent: 'a', parentBy: 'kai' }),
    said('e', 'sam', 50, 'Agreed', { parent: 'gone' }),            // its comment was deleted
    said('f', 'sam', 60, 'On another one', { on: other }),          // about another seed
    said('g', 'sam', 70, '   '),                                    // nothing to show
    { uri: uriOf('sam', 'h'), repo: 'did:plc:sam', value: null }    // not a comment at all
  ];
  const t = threads(list, seed.uri);
  assert.deepEqual(t.map(x => x.rkey), ['a', 'd', 'e']);
  assert.deepEqual(t[0].replies.map(r => r.rkey), ['b', 'c']);
  assert.equal(t[0].replies[0].to, null, 'a reply to the first comment needs no “to”');
  assert.equal(t[0].replies[1].to.rkey, 'b', 'a reply to a reply says whose');
  assert.deepEqual(t.map(x => x.lost), [false, false, true]);
  assert.equal(commentCount(list, seed.uri), 5);
  assert.deepEqual(threads(null, seed.uri), []);
});

test('threads: a comment can only answer one that came before it, so no records make a loop', () => {
  // Two that each claim to answer the other, and one that answers a comment written after it.
  const list = [
    said('x', 'eve', 10, 'X', { parent: 'y' }),
    said('y', 'eve', 20, 'Y', { parent: 'x' }),
    said('z', 'eve', 5, 'Z', { parent: 'y' }),
    said('self', 'eve', 30, 'Me', { parent: 'self' })
  ];
  const t = threads(list, seed.uri);
  assert.deepEqual(t.map(x => [x.rkey, x.lost, x.replies.map(r => r.rkey)]), [['z', true, []], ['x', true, ['y']], ['self', true, []]]);
});

test('the example circle has comments to read, and yours to write, answer and take back', async () => {
  const mem = new Map(), store = { get: k => mem.get(k) ?? null, set: (k, v) => mem.set(k, v) };
  const src = createDemoSource({ store, groups: false });
  const { items } = await src.board();
  const amara = items.find(i => i.rkey === '3sq-amara');
  const t = threads(amara.comments, amara.uri);
  assert.equal(t.length, 1);
  assert.equal(t[0].author.handle, 'kai.example');
  assert.equal(t[0].replies[0].repo, amara.repo, 'the person who asked answers');
  // Someone's reply on one of your own is there to answer.
  const yours = items.find(i => i.rkey === '3sq-you');
  assert.equal(yours.comments[0].author.handle, 'juniper.example');
  const reply = await src.comment(yours, { text: 'That size is perfect, thank you!', parent: yours.comments[0] });
  const again = await src.seed(yours.uri);
  assert.deepEqual(threads(again.comments, yours.uri)[0].replies.map(r => r.uri), [reply.uri]);
  // It's kept in this browser, and it's yours to delete. Nobody else's is.
  assert.equal((await createDemoSource({ store, groups: false }).seed(yours.uri)).comments.length, 2);
  await assert.rejects(src.uncomment(again, again.comments[0]), /Only the person who wrote/);
  await src.uncomment(again, again.comments.find(c => c.uri === reply.uri));
  assert.equal((await src.seed(yours.uri)).comments.length, 1);
  await src.comment(yours, { text: 'One more thing' });
  src.reset();
  assert.equal((await src.seed(yours.uri)).comments.length, 1, 'starting over clears what you said');
});

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
/** Tangled's API and knotless's, answering for one issue each, with `items` and `comments` as given. */
function forges({ tangled = [], total, knotless = [] } = {}){
  const real = globalThis.fetch, asked = [];
  globalThis.fetch = async input => {
    const u = new URL(String(input)), q = u.searchParams, m = u.pathname.split('/xrpc/')[1];
    asked.push(m + ' ' + u.search);
    if (u.host === 'api.tangled.org' && m === 'org.tangled.feed.listComments') return json({ items: tangled, total: total ?? tangled.length });
    if (u.host === 'knotless.dev' && m === 'dev.knotless.getThread') return json({ item: { uri: q.get('uri'), title: 'Flaky test', state: 'open' }, comments: knotless, closes: [], checks: [], card: '' });
    return json({ error: 'NotFound' }, 404);
  };
  return { asked, restore(){ globalThis.fetch = real; } };
}
const TICKET_URI = 'at://did:plc:tidepool/org.tangled.track.ticket/27';
const tc = (rkey, by, text, extra = {}) => ({ uri: `at://did:plc:tidepool/org.tangled.feed.comment/${rkey}`, cid: 'bafy' + rkey, editor: by, body: { $type: 'org.tangled.markup.markdown', text }, subject: { uri: TICKET_URI, cid: 'x' }, createdAt: '2026-11-0' + rkey.slice(-1) + 'T00:00:00Z', ...extra });

test('which asks talk on their issue: one on a Tangled or knotless issue, unless it’s kept private', () => {
  const on = subject => talksOn({ value: { subject } });
  assert.equal(on(parseSubject('https://tangled.org/tomas.example/tidepool/issues/27')), 'tangled');
  assert.equal(on(parseSubject('https://knotless.dev/alice.test/proj/issue/did:plc:alice/3kiss')), 'knotless');
  assert.equal(on(parseSubject('https://tangled.org/tomas.example/tidepool')), null, 'a repo has no issue to talk on');
  assert.equal(on(parseSubject('https://github.com/o/r/issues/5')), null, 'GitHub’s comments aren’t Rainshare’s to write');
  assert.equal(on(undefined), null, 'nor has an idea');
  assert.equal(talksOn({ space: 'at://did:plc:g/space/x/y', value: { subject: parseSubject('https://tangled.org/tomas.example/tidepool/issues/27') } }), null);
});

test('a Tangled issue’s comments are read from its API, and only the ones that are what they say', async () => {
  const net = forges({ total: 9, tangled: [
    tc('c1', 'did:plc:juniper', 'Never-synced peers too?'),
    tc('c2', 'did:plc:tomas', 'Yes, with null.', { replyTo: { uri: 'at://did:plc:tidepool/org.tangled.feed.comment/c1', cid: 'bafyc1' } }),
    tc('c3', 'did:plc:sam', 'On another issue', { subject: { uri: 'at://did:plc:tidepool/org.tangled.track.ticket/28' } }),
    tc('c4', 'did:plc:sam', 'Claims to be kept elsewhere', { uri: 'at://did:plc:sam/org.tangled.feed.comment/c4' }),
    tc('c5', 'not a did', 'Nobody wrote this'),
    tc('c6', 'did:plc:sam', '   '),
    { ...tc('c7', 'did:plc:sam', 'x'), uri: 'at://did:plc:tidepool/app.bsky.feed.post/c7' },
    tc('c8', 'did:plc:sam', 'A plain string body', { body: 'A plain string body' })
  ] });
  try {
    const seed = 'at://did:plc:tomas/dev.rainshare.seed/3k1', r = await issueComments(parseSubject(TICKET_URI));
    assert.equal(r.forge, 'tangled');
    assert.deepEqual(r.items.map(c => [c.uri.split('/').pop(), c.by]), [['c1', 'did:plc:juniper'], ['c2', 'did:plc:tomas'], ['c8', 'did:plc:sam']]);
    assert.equal(r.more, true, 'Tangled said there were more than it listed');
    assert.deepEqual(r.items[1].replyTo, { uri: 'at://did:plc:tidepool/org.tangled.feed.comment/c1', cid: 'bafyc1' });
    // Shaped like Rainshare's own, they thread the same.
    const t = threads(r.items.map(c => fromForge(c, seed, 'tangled')), seed);
    assert.deepEqual(t.map(x => [x.repo, x.forge, x.replies.map(y => y.repo)]), [['did:plc:juniper', 'tangled', ['did:plc:tomas']], ['did:plc:sam', 'tangled', []]]);
    assert.ok(net.asked.every(a => a.includes('subject=' + encodeURIComponent(TICKET_URI))));
  } finally { net.restore(); }
});

test('a knotless issue’s comments come with its thread: written in each writer’s own account, and never replies', async () => {
  const kc = (rkey, by, body, extra = {}) => ({ uri: `at://${by}/dev.knotless.comment/${rkey}`, author: { did: by, handle: by.split(':').pop() + '.test' }, body, html: '', createdAt: `2026-11-0${rkey.slice(-1)}T00:00:00Z`, ...extra });
  const net = forges({ knotless: [
    kc('k1', 'did:plc:priya', 'Fails every time with TZ=Pacific/Kiritimati.'),
    kc('k2', 'did:plc:kai', 'That’s the one.'),
    { ...kc('k3', 'did:plc:eve', 'Says it’s Kai’s'), author: { did: 'did:plc:kai', handle: 'kai.test' } },
    kc('k4', 'did:plc:sam', 'A comment on a pull’s lines', { line: { path: 'a.go', line: 3 } }),
    kc('k5', 'did:plc:sam', 'Approved', { verdict: 'approve' }),
    { ...kc('k6', 'did:plc:sam', 'x'), body: undefined }
  ] });
  try {
    const r = await issueComments(parseSubject('https://knotless.dev/alice.test/proj/issue/did:plc:alice/3kiss'), { fresh: true });
    assert.deepEqual([r.forge, r.more], ['knotless', false]);
    assert.deepEqual(r.items.map(c => [c.by, c.replyTo]), [['did:plc:priya', null], ['did:plc:kai', null]]);
    assert.equal(await issueComments(parseSubject('https://github.com/o/r/issues/5')), null);
  } finally { net.restore(); }
});

test('the example circle’s Tangled and knotless asks talk on their issues, as the real ones would', async () => {
  const src = createDemoSource({ groups: false });
  const { items } = await src.board();
  const tomas = items.find(i => i.rkey === '3sq-tomas'), kai = items.find(i => i.rkey === '3sq-kai');
  assert.deepEqual([tomas.talk.forge, kai.talk.forge], ['tangled', 'knotless']);
  const t = threads(tomas.comments, tomas.uri);
  assert.deepEqual(t.map(x => [x.forge, x.replies.map(r => r.forge)]), [['tangled', ['tangled']]]);
  // Yours goes on the issue: a reply on Tangled, and only a plain comment on knotless.
  const reply = await src.comment(tomas, { text: 'Got it', parent: tomas.comments[0] });
  assert.deepEqual([reply.forge, reply.value.parent.uri], ['tangled', tomas.comments[0].uri]);
  await assert.rejects(src.comment(kai, { text: 'Hm', parent: kai.comments[0] }), /can’t be replies/);
  const plain = await src.comment(kai, { text: 'I’ll pass a clock in.' });
  assert.match(plain.uri, /\/dev\.knotless\.comment\//);
  // It's the forge's to change or delete.
  await assert.rejects(src.uncomment(kai, plain), /Change or delete it there/);
  assert.equal(items.find(i => i.rkey === '3sq-amara').talk, null, 'a GitHub one talks on Rainshare');
});
