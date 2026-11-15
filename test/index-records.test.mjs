// What the index keeps of each record, and how a Jetstream event becomes a write
// (indexer/src/records.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMIT_TYPE, eventOf, MAX_RECORD_CHARS, MODERATOR, STREAM_COLLECTIONS, toRow } from '../indexer/src/records.js';
import { SEED, TAKE, DELIVERY, COMMENT, PROFILE, PREFERENCES, MODERATION } from '../core/ns.js';

const DID = 'did:plc:ziregtnnalb6cgpluksf735q';
const CID = 'bafyreibj7yxrokuyvlw44da7m2xlbkgzzwjkw32zug3bx4gieiokkrdn2u';
const RKEY = '3n2eam2npyi2n';
const ASK = `at://${DID}/${SEED}/${RKEY}`;
const row = (collection, record, extra = {}) => toRow({ did: DID, collection, rkey: RKEY, cid: CID, record, ...extra });
const seed = (extra = {}) => ({ $type: SEED, title: 'Fix the flaky test', audience: { $type: `${SEED}#anyone` }, createdAt: '2026-11-15T14:40:20.632Z', ...extra });
const take = (extra = {}) => ({ $type: TAKE, seed: { uri: ASK, cid: CID }, until: '2026-11-16T14:40:20Z', createdAt: '2026-11-15T15:00:00Z', ...extra });

test('Jetstream is asked for the whole lexicon by its wildcard', () => {
  assert.deepEqual(STREAM_COLLECTIONS, ['dev.rainshare.*']);
});

test('an ask is kept whole, and is about nothing else', () => {
  const r = row(SEED, seed({ spec: 'Make it pass every time.' }), { firstSeenAt: '2026-11-15T14:40:21.000000Z' });
  assert.deepEqual(r, {
    uri: ASK, did: DID, collection: SEED, rkey: RKEY, cid: CID, record: seed({ spec: 'Make it pass every time.' }),
    subject_uri: null, created_at: '2026-11-15T14:40:20.632Z', first_seen_at: '2026-11-15T14:40:21.000Z'
  });
  assert.equal(row(SEED, seed({ title: 3 })), null, 'an ask needs a title');
  assert.equal(row(SEED, seed({ createdAt: undefined })), null);
});

test('a take, a turn-in and a comment are about their ask', () => {
  assert.equal(row(TAKE, take()).subject_uri, ASK);
  assert.equal(row(DELIVERY, { $type: DELIVERY, seed: { uri: ASK, cid: CID }, url: 'https://github.com/a/b/pull/1', createdAt: '2026-11-15T16:00:00Z' }).subject_uri, ASK);
  assert.equal(row(COMMENT, { $type: COMMENT, seed: { uri: ASK, cid: CID }, text: 'On it', createdAt: '2026-11-15T16:00:00Z' }).subject_uri, ASK);
  assert.equal(row(TAKE, take({ seed: { uri: 'https://example.com' } })), null, 'not an at:// URI');
  assert.equal(row(TAKE, take({ seed: ASK })), null, 'not a ref');
  assert.equal(row(TAKE, take({ seed: undefined })), null);
});

test('a profile and settings only at self', () => {
  const prefs = { $type: PREFERENCES, notify: { updates: true }, createdAt: '2026-11-01T00:00:00Z' };
  assert.equal(row(PREFERENCES, prefs, { rkey: 'self' }).uri, `at://${DID}/${PREFERENCES}/self`);
  assert.equal(row(PREFERENCES, prefs), null);
  assert.ok(row(PROFILE, { $type: PROFILE, displayName: 'Noah', createdAt: '2026-11-01T00:00:00Z' }, { rkey: 'self' }));
});

test('moderation records count only from @rainshare.dev', () => {
  const hide = { $type: MODERATION, subject: ASK, action: 'hide', reason: 'guidelines', createdAt: '2026-11-15T17:00:00Z' };
  const key = ASK.slice(5).replace(/\//g, ':');
  const r = row(MODERATION, hide, { did: MODERATOR, rkey: key });
  assert.equal(r.subject_uri, ASK);
  assert.equal(row(MODERATION, hide, { rkey: key }), null, 'the same record in anyone else’s repo is nothing');
  assert.equal(row(MODERATION, { ...hide, subject: 'nope' }, { did: MODERATOR, rkey: key }), null);
  assert.equal(eventOf({ did: DID, collection: MODERATION, rkey: key, operation: 'create', cid: CID, record: hide }), null, 'and its events are ignored, not deletes');
});

test('nonsense is refused', () => {
  assert.equal(row(SEED, seed(), { did: 'not-a-did' }), null);
  assert.equal(row(SEED, seed(), { rkey: 'a/b' }), null);
  assert.equal(row(SEED, seed(), { cid: 'short' }), null);
  assert.equal(row('app.bsky.feed.post', { ...seed(), $type: 'app.bsky.feed.post' }), null, 'not a Rainshare collection');
  assert.equal(row('dev.rainshare.someday', { ...seed(), $type: 'dev.rainshare.someday' }), null, 'nor one the index doesn’t know yet');
  assert.equal(row(SEED, seed({ $type: TAKE })), null, '$type must be the collection');
  assert.equal(row(SEED, [seed()]), null);
  assert.equal(row(TAKE, take({ createdAt: 'yesterday' })).created_at, null, 'a date that doesn’t parse is kept as none');
  assert.equal(row(SEED, seed({ spec: 'x'.repeat(MAX_RECORD_CHARS) })), null, 'too big to keep');
  assert.ok(row(SEED, seed({ spec: 'x'.repeat(100_000) })), 'the longest spec the lexicon allows is fine');
  assert.equal(row(SEED, seed({ spec: 'a\u0000b' })), null, 'Postgres refuses a NUL');
  assert.equal(row(SEED, seed({ spec: 'lone \ud800 high' })), null);
  assert.ok(row(SEED, seed({ spec: 'a real pair 🌧️' })));
});

test('an event: create, update or delete, and junk becomes a delete', () => {
  const base = { $type: COMMIT_TYPE, did: DID, collection: SEED, rkey: RKEY, cid: CID, time: '2026-11-15T14:40:21Z' };
  assert.equal(eventOf({ ...base, operation: 'create', record: seed() }).row.first_seen_at, '2026-11-15T14:40:21.000Z');
  assert.equal(eventOf({ ...base, operation: 'update', record: seed() }).row.first_seen_at, null, 'only a create says when it was first seen');
  assert.deepEqual(eventOf({ ...base, operation: 'delete' }), { op: 'delete', uri: ASK });
  assert.deepEqual(eventOf({ ...base, operation: 'update', record: seed({ title: null }) }), { op: 'delete', uri: ASK }, 'edited into junk, it leaves');
  assert.equal(eventOf({ ...base, operation: 'create', record: seed(), $type: 'something#else' }), null);
  assert.equal(eventOf({ ...base, collection: 'app.bsky.feed.like', operation: 'create', record: {} }), null);
  assert.equal(eventOf(null), null);
});
