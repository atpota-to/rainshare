// Direct messages from @rainshare.dev (api/_messages.js), against a stand-in network: a relay,
// the PLC directory, one PDS holding everyone's repo, Bluesky's AppView, and Bluesky's chat
// service behind the account's PDS. The chat service's clock is the test's.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { message, compose, newsFor, standing, boundary, wants, PERIOD } from '../api/_messages.js';
import { ACCOUNT } from '../api/_announce.js';
import { run } from '../api/announce.js';
import * as R from '../core/records.js';
import { SEED, TAKE, DELIVERY, PROFILE, SITE } from '../core/ns.js';

const NOW = Date.parse('2026-11-14T16:05:00Z'), TO = Date.parse('2026-11-14T15:45:00Z');
const PDS = 'https://pds.test', CHAT = 'did:web:api.bsky.chat#bsky_chat';
const [ALICE, BOB, CAROL, JUN, KAI, DEE, EVE, FAY, GUS, MAL, SPAM, ZED] = ['alice', 'bob', 'carol', 'juniper', 'kai', 'dee', 'eve', 'fay', 'gus', 'mal', 'spam', 'zed'].map(n => 'did:plc:' + n);
const handleOf = did => did === ACCOUNT ? 'rainshare.dev' : did.slice(8) + '.test';
const nameOf = did => did === ACCOUNT ? '' : did[8].toUpperCase() + did.slice(9);
const anyone = { $type: `${SEED}#anyone` };
const uri = (did, c, rkey) => `at://${did}/${c}/${rkey}`;
const ref = (did, c, rkey) => ({ uri: uri(did, c, rkey), cid: 'bafy' + rkey });
const me = SITE + '/me', ours = (text, sentAt) => ({ id: 'm' + sentAt, rev: '1', text, sentAt, sender: { did: ACCOUNT }, facets: [{ index: { byteStart: 0, byteEnd: 1 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: me }] }] });
const theirs = (did, text, sentAt) => ({ id: 'm' + sentAt + did, rev: '1', text, sentAt, sender: { did } });

let repos, convos, asked, sentMessages, chatError;
beforeEach(() => {
  asked = []; sentMessages = []; chatError = null;
  const ask = (title, createdAt, more = {}) => ({ $type: SEED, title, audience: anyone, createdAt, ...more });
  repos = {
    [ALICE]: {
      [SEED]: { a1: ask('Fix the flaky test', '2026-11-10T00:00:00Z', { subject: { $type: `${SEED}#githubIssue`, url: 'https://github.com/alice/app/issues/3', number: 3 } }) },
      [PROFILE]: { self: { $type: PROFILE, notify: { updates: true }, createdAt: '2026-11-01T00:00:00Z' } },
      'app.bsky.graph.block': { b1: { subject: MAL, createdAt: '2026-11-01T00:00:00Z' } }
    },
    [BOB]: {
      [SEED]: {
        b1: ask('Weather app', '2026-11-08T00:00:00Z', { state: 'sprouted', sproutedWith: [ref(JUN, DELIVERY, 'jb1')], updatedAt: '2026-11-14T11:00:00Z' }),
        b2: ask('Tiny timer', '2026-11-14T12:00:00Z')
      }
    },
    [CAROL]: {
      [SEED]: {
        c1: ask('Old tracker', '2026-11-05T00:00:00Z', { state: 'closed', updatedAt: '2026-11-13T20:00:00Z' }),
        m1: ask('For mutuals', '2026-11-14T13:00:00Z', { audience: { $type: `${SEED}#mutuals` } }),
        o1: ask('From the day before', '2026-11-13T12:00:00Z')
      }
    },
    [JUN]: {
      [SEED]: { j1: ask('My own new one', '2026-11-14T12:30:00Z') },
      [TAKE]: { ja1: { seed: ref(ALICE, SEED, 'a1'), createdAt: '2026-11-14T09:00:00Z' }, jc1: { seed: ref(CAROL, SEED, 'c1'), createdAt: '2026-11-09T00:00:00Z' } },
      [DELIVERY]: { ja1d: { seed: ref(ALICE, SEED, 'a1'), url: 'https://github.com/alice/app/pull/4', createdAt: '2026-11-14T10:00:00Z' }, jb1: { seed: ref(BOB, SEED, 'b1'), url: 'https://github.com/bob/weather/pull/1', createdAt: '2026-11-09T00:00:00Z' } },
      [PROFILE]: { self: { $type: PROFILE, notify: { updates: true, newAsks: true } } }
    },
    [KAI]: { [TAKE]: { ka1: { seed: ref(ALICE, SEED, 'a1'), createdAt: '2026-11-13T10:00:00Z' } }, [PROFILE]: { self: { notify: { newAsks: true } } } },
    [MAL]: { [TAKE]: { ma1: { seed: ref(ALICE, SEED, 'a1'), createdAt: '2026-11-14T08:00:00Z' } } },
    [GUS]: { [TAKE]: { ga1: { seed: ref(ALICE, SEED, 'a1'), createdAt: '2026-11-12T12:00:00Z' } }, [PROFILE]: { self: { displayName: 'Gus' } } },
    [ZED]: { [TAKE]: { za1: { seed: ref(ALICE, SEED, 'a1'), createdAt: '2026-11-14T15:50:00Z' } } },
    [SPAM]: { [SEED]: { s1: ask('Buy followers', '2026-11-14T13:30:00Z') } },
    [DEE]: { [PROFILE]: { self: { notify: { updates: true } } } },
    [EVE]: { [PROFILE]: { self: { notify: { updates: true } } } },
    [FAY]: { [PROFILE]: { self: { notify: { updates: true } } } },
    [ACCOUNT]: { 'app.bsky.graph.block': { x1: { subject: SPAM, createdAt: '2026-11-01T00:00:00Z' } } }
  };
  // The account's conversations, each newest first.
  convos = {
    [ALICE]: { id: 'c-alice', canChat: true, messages: [
      { ...theirs(ACCOUNT, 'Thanks for trying Rainshare! (sent by hand)', '2026-11-14T16:00:00Z') },
      theirs(ALICE, 'start', '2026-11-12T18:00:00Z'), theirs(ALICE, 'STOP.', '2026-11-12T17:00:00Z'),
      ours('News from Rainshare: …', '2026-11-12T16:01:00Z')
    ] },
    [DEE]: { id: 'c-dee', canChat: true, messages: [theirs(DEE, 'stop', '2026-11-13T20:00:00Z'), ours('News from Rainshare: …', '2026-11-13T16:01:00Z')] },
    [KAI]: { id: 'c-kai', canChat: true, messages: [ours('Okay, no more messages from Rainshare.', '2026-11-13T16:02:00Z'), theirs(KAI, 'Stop', '2026-11-13T09:00:00Z')] },
    [EVE]: { id: null, canChat: false, messages: [] },
    [FAY]: { id: 'c-fay', canChat: true, messages: [ours('News from Rainshare: …', '2026-11-14T16:01:00Z')] }
  };
});

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const records = (did, c) => Object.entries(repos[did]?.[c] || {}).sort(([a], [b]) => b.localeCompare(a)).map(([rkey, value]) => ({ uri: uri(did, c, rkey), cid: 'bafy' + rkey, value }));
globalThis.fetch = async (input, init = {}) => {
  const u = new URL(typeof input === 'string' ? input : input.url), q = u.searchParams, method = u.pathname.split('/').pop();
  asked.push(method);
  if (u.host === 'relay1.us-east.bsky.network') return json({ repos: Object.keys(repos).filter(d => repos[d][q.get('collection')]).map(did => ({ did })) });
  if (u.host === 'plc.directory') { const did = decodeURIComponent(u.pathname.slice(1)); return json({ id: did, alsoKnownAs: ['at://' + handleOf(did)], service: [{ id: '#atproto_pds', serviceEndpoint: PDS }] }); }
  if (u.host === 'public.api.bsky.app' && method === 'app.bsky.actor.getProfiles') return json({ profiles: q.getAll('actors').map(did => ({ did, handle: handleOf(did), displayName: nameOf(did) })) });
  if (u.host === 'public.api.bsky.app' && method === 'app.bsky.graph.getRelationships') return json({ relationships: q.getAll('others').map(did => ({ did })) });
  if (u.host !== 'pds.test') throw new Error('a host this shouldn’t ask: ' + u.href);
  if (method === 'com.atproto.repo.listRecords') return json({ records: records(q.get('repo'), q.get('collection')) });
  if (method === 'com.atproto.repo.getRecord') { const v = repos[q.get('repo')]?.[q.get('collection')]?.[q.get('rkey')]; return v ? json({ uri: uri(q.get('repo'), q.get('collection'), q.get('rkey')), value: v }) : json({ error: 'RecordNotFound' }, 400); }
  if (method === 'com.atproto.server.createSession') return JSON.parse(init.body).password === 'app-pass' ? json({ accessJwt: 'access' }) : json({ error: 'AuthenticationRequired', message: 'Invalid identifier or password' }, 401);
  if (init.headers?.authorization !== 'Bearer access') return json({ error: 'AuthenticationRequired' }, 401);
  if (method.startsWith('chat.')) {
    assert.equal(init.headers['atproto-proxy'], CHAT, 'chat goes through the account’s server to Bluesky’s chat service');
    if (chatError) return json(chatError, 400);
    const member = q.get('members'), c = convos[member];
    if (method === 'chat.bsky.convo.getConvoAvailability') return json({ canChat: c ? c.canChat : true, ...(c?.id ? { convo: { id: c.id } } : {}) });
    if (method === 'chat.bsky.convo.getConvoForMembers') {
      if (c && !c.canChat) return json({ error: 'NotFollowedBySender' }, 400);
      convos[member] ||= { id: 'c-' + member.slice(8), canChat: true, messages: [] };
      convos[member].id ||= 'c-' + member.slice(8);
      return json({ convo: { id: convos[member].id } });
    }
    const byId = id => Object.entries(convos).find(([, x]) => x.id === id);
    if (method === 'chat.bsky.convo.getMessages') return json({ messages: byId(q.get('convoId'))[1].messages });
    if (method === 'chat.bsky.convo.sendMessage') {
      const { convoId, message: m } = JSON.parse(init.body), [to, convo] = byId(convoId);
      const view = { id: 'new' + sentMessages.length, rev: '1', ...m, sender: { did: ACCOUNT }, sentAt: new Date(NOW + 1000).toISOString() };
      convo.messages.unshift(view); sentMessages.push({ to, ...m });
      return json(view);
    }
  }
  if (method === 'com.atproto.repo.createRecord') return json({ uri: uri(ACCOUNT, 'app.bsky.feed.post', 'p' + asked.length) });
  throw new Error('a call this shouldn’t make: ' + u.href);
};
const quiet = () => {};
const go = opts => message({ password: 'app-pass', now: NOW, log: quiet, ...opts });
const facetText = m => m.facets.map(f => Buffer.from(m.text).subarray(f.index.byteStart, f.index.byteEnd).toString());

test('each person who asked hears their own news, once a day', async () => {
  const out = await go();
  assert.equal(out.asked, 6, 'everyone with notify on, and not Gus, who didn’t ask');
  assert.deepEqual(sentMessages.map(m => m.to).sort(), [ALICE, DEE, JUN].sort());

  const alice = sentMessages.find(m => m.to === ALICE);
  assert.equal(alice.text, [
    'News from Rainshare:',
    '• Kai (@kai.test) is on your ask “Fix the flaky test”.',
    '• Juniper (@juniper.test) turned in work on your ask “Fix the flaky test”: github.com/alice/app/pull/4',
    '', `Reply STOP to stop these, or choose what you get at ${SITE.replace('https://', '')}/me.`
  ].join('\n'), 'since her last message two days ago (a run was missed), and not Mal, whom she blocks, nor anything before then or since the boundary');
  assert.deepEqual(facetText(alice), ['@kai.test', 'Fix the flaky test', '@juniper.test', 'Fix the flaky test', 'github.com/alice/app/pull/4', `${SITE.replace('https://', '')}/me`]);
  assert.deepEqual(alice.facets.map(f => f.features[0].did || f.features[0].uri), [KAI, `${SITE}/seed/alice.test/a1`, JUN, `${SITE}/seed/alice.test/a1`, 'https://github.com/alice/app/pull/4', `${SITE}/me`]);

  const jun = sentMessages.find(m => m.to === JUN);
  assert.equal(jun.text, [
    'News from Rainshare:',
    '• Carol (@carol.test) closed “Old tracker”.',
    '• Bob (@bob.test) marked “Weather app” done with your work. It’s in your garden now.',
    '', 'New asks:',
    '• “Tiny timer”: an idea from Bob (@bob.test)',
    '', `Reply STOP to stop these, or choose what you get at ${SITE.replace('https://', '')}/me.`
  ].join('\n'), 'not their own ask, one for mutuals, one from someone the account blocks, nor one from before their day');

  assert.match(sentMessages.find(m => m.to === DEE).text, /^Okay, no more messages from Rainshare\.\n\nReply START to have them again/, 'a STOP is answered once');
  assert.deepEqual(out.skipped.map(s => s.to).sort(), [EVE, FAY, KAI].sort());
  assert.match(out.skipped.find(s => s.to === EVE).why, /follow @rainshare\.dev/);

  sentMessages = [];
  const again = await go();
  assert.deepEqual(sentMessages, [], 'the next run, the same day, sends nothing');
  assert.equal(again.skipped.length, 6);
});

test('a dry run sends nothing, and without the password it shows a day’s news for everyone', async () => {
  let out = await go({ post: false });
  assert.deepEqual([sentMessages.length, out.sent.length, out.dryRun], [0, 3, true]);
  assert.ok(!asked.includes('chat.bsky.convo.sendMessage') && !asked.includes('chat.bsky.convo.getConvoForMembers'), 'it only reads');

  asked = [];
  out = await message({ post: false, password: '', now: NOW, log: quiet });
  assert.ok(!asked.some(m => m.startsWith('chat.') || m === 'com.atproto.server.createSession'), 'it never signs in');
  assert.ok(out.sent.some(s => s.to === ALICE && !/Kai/.test(s.text)), 'with nothing read, Alice’s news is the last day’s, so Kai’s take from the day before isn’t in it');
});

test('an app password that can’t send messages is said once, and the posts go ahead', async () => {
  chatError = { error: 'InvalidToken', message: 'Bad token scope' };
  const lines = [], out = await run({ password: 'app-pass', log: s => lines.push(s) });
  assert.match(out.messages.note, /Allow access to your direct messages/);
  assert.deepEqual(out.messages.sent, []);
  assert.equal(asked.filter(m => m === 'chat.bsky.convo.getConvoAvailability').length, 1, 'found out on the first person, not every one');
  assert.equal(asked.filter(m => m === 'com.atproto.server.createSession').length, 1, 'one sign-in for the posts and the messages');
  assert.ok(!out.posts.error);
});

test('no messages without the password, and nobody asked, nothing read', async () => {
  let out = await message({ password: '', now: NOW, log: quiet });
  assert.deepEqual([out.setUp, out.sent.length, asked.length], [false, 0, 0]);
  for (const d of Object.keys(repos)) delete repos[d][PROFILE];
  out = await go();
  assert.equal(out.asked, 0);
  assert.ok(!asked.includes('com.atproto.server.createSession'));
});

test('a STOP or START is the latest one they sent, whatever came after it', async () => {
  const as = { get: async (nsid, p) => nsid.endsWith('getConvoAvailability') ? { canChat: true, convo: { id: 'c' } } : { messages: p.convoId && msgs } };
  let msgs = [theirs(ALICE, 'thanks!', '3'), theirs(ALICE, 'Stop!', '2'), ours('News', '2026-11-13T16:01:00Z')];
  assert.deepEqual(await standing(as, ALICE), { canChat: true, convoId: 'c', last: Date.parse('2026-11-13T16:01:00Z'), said: 'stop', acked: false });
  msgs = [ours('Okay', '2026-11-13T16:01:00Z'), theirs(ALICE, 'unsubscribe', '2')];
  assert.equal((await standing(as, ALICE)).acked, true);
  msgs = [theirs(ALICE, 'please stop sending these', '2')];
  assert.equal((await standing(as, ALICE)).said, null, 'only the word on its own');
  msgs = [theirs(BOB, 'stop', '2')];
  assert.equal((await standing(as, ALICE)).said, null, 'only what they said, in their conversation');
});

test('a message fits, however much there is, and says how many more', () => {
  const who = new Map([[ALICE, { did: ALICE, handle: 'a'.repeat(60) + '.test', name: 'N'.repeat(64) }]]);
  const seed = { uri: uri(ALICE, SEED, 'x'), repo: ALICE, rkey: 'x', value: { title: 'T'.repeat(120) } };
  const many = n => Array.from({ length: n }, (_, i) => ({ kind: 'take', seed, by: ALICE, at: i }));
  const m = compose({ updates: many(12), fresh: many(8).map(x => ({ ...x, kind: 'new' })) }, who);
  const count = [...new Intl.Segmenter().segment(m.text)].length;
  assert.ok(count <= 1000, `${count} graphemes`);
  assert.match(m.text, /• and \d+ more\./);
  assert.match(m.text, /• and \d+ more on the board\./);
  assert.ok(m.text.endsWith('/me.'), 'the way to stop them is always there');
  for (const f of m.facets) assert.ok(f.index.byteEnd <= Buffer.byteLength(m.text) && f.index.byteStart < f.index.byteEnd);
  assert.equal(compose({ updates: [], fresh: [] }, who), null, 'no news, no message');
});

test('news is only what happened in its time, to the person it’s about', () => {
  const seeds = [{ uri: uri(ALICE, SEED, 'a'), repo: ALICE, rkey: 'a', value: { title: 'A', audience: anyone, createdAt: '2026-11-01T00:00:00Z' } }];
  const take = (by, createdAt) => ({ uri: uri(by, TAKE, 't' + createdAt), repo: by, value: { seed: { uri: seeds[0].uri }, createdAt } });
  const takes = [take(BOB, '2026-11-14T10:00:00Z'), take(ALICE, '2026-11-14T10:00:00Z'), take(CAROL, '2026-11-14T15:45:00Z')];
  const n = newsFor({ did: ALICE, updates: true }, { seeds, takes, deliveries: [], from: TO - PERIOD, to: TO });
  assert.deepEqual(n.updates.map(x => [x.kind, x.by]), [['take', BOB]], 'not her own take, nor one at the boundary, which is the next day’s');
  assert.deepEqual(newsFor({ did: ALICE, updates: false, newAsks: true }, { seeds, takes, deliveries: [], from: TO - PERIOD, to: TO }), { updates: [], fresh: [] });
});

test('the days begin a quarter of an hour before the daily run', () => {
  assert.equal(boundary(NOW), TO);
  assert.equal(boundary(TO), TO);
  assert.equal(boundary(TO - 1), TO - PERIOD);
});

test('a profile keeps the messages someone asked for, and drops what’s switched off', () => {
  assert.deepEqual(R.profile({ notify: { updates: true, newAsks: false } }).notify, { updates: true });
  assert.equal(R.profile({ notify: { updates: false, newAsks: false } }).notify, undefined);
  assert.equal(R.profile({ notify: { updates: 'yes' } }).notify, undefined, 'only true counts');
  assert.deepEqual(wants({ notify: { newAsks: true } }), { updates: false, newAsks: true });
  assert.deepEqual(wants(null), { updates: false, newAsks: false });
});
