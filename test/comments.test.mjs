// Comments on a seed: the record, how they're put into threads, and the example circle's.
// (The real source, against a fake network, is in source.test.mjs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../core/records.js';
import { threads, commentCount } from '../core/comments.js';
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
