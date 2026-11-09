// The real data source (core/source.js) against a small fake network: PLC, a relay, one PDS
// for everyone, and Bluesky's AppView, all answered by a stubbed fetch.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SIDEQUEST, TAKE, DELIVERY, PROFILE } from '../core/ns.js';
import { createSource } from '../core/source.js';

const PDS = 'https://pds.test';
const people = { me: 'did:plc:me', alice: 'did:plc:alice', bob: 'did:plc:bob', carol: 'did:plc:carol', dave: 'did:plc:dave', eve: 'did:plc:eve' };
// who follows whom: [follower, followed]
const follows = [['me', 'alice'], ['alice', 'me'], ['bob', 'me'], ['me', 'carol']];
let repos, n, lagging;

const sq = (title, audience, extra = {}) => ({ $type: SIDEQUEST, title, audience: { $type: `${SIDEQUEST}#${audience}` }, createdAt: new Date(Date.now() - (n++) * 1000).toISOString(), ...extra });
function put(did, collection, rkey, value){ (repos[did] ||= {})[collection] ||= new Map(); repos[did][collection].set(rkey, { value, cid: 'bafy' + (n++) }); }
beforeEach(() => {
  repos = {}; n = 1; lagging = new Set();
  put(people.alice, SIDEQUEST, 'a1', sq('Alice, for mutuals', 'mutuals'));
  put(people.alice, PROFILE, 'self', { $type: PROFILE, budget: 'none', circumstances: ['student'], createdAt: new Date().toISOString() });
  put(people.bob, SIDEQUEST, 'b1', sq('Bob, for people he follows', 'following'));
  put(people.bob, SIDEQUEST, 'b2', sq('Bob, for mutuals', 'mutuals'));
  put(people.carol, SIDEQUEST, 'c1', sq('Carol, for mutuals', 'mutuals'));
  put(people.carol, SIDEQUEST, 'c2', sq('Carol, for her followers', 'followers'));
  put(people.dave, SIDEQUEST, 'd1', sq('Dave, for everyone', 'anyone'));
  put(people.dave, SIDEQUEST, 'd2', sq('Dave, closed', 'anyone', { state: 'closed' }));
  put(people.eve, SIDEQUEST, 'e1', sq('Eve, for everyone', 'anyone'));
  put(people.me, 'app.bsky.graph.block', 'x1', { subject: people.eve });
});

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const nameOf = did => Object.keys(people).find(k => people[k] === did);
globalThis.fetch = async (input, init = {}) => {
  const u = new URL(typeof input === 'string' ? input : input.url), q = u.searchParams, m = u.pathname.replace('/xrpc/', '');
  if (u.host === 'plc.directory') {
    const did = decodeURIComponent(u.pathname.slice(1));
    return json({ id: did, alsoKnownAs: [`at://${nameOf(did)}.test`], service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }] });
  }
  if (m === 'com.atproto.sync.listReposByCollection') {
    const c = q.get('collection');
    return json({ repos: Object.keys(repos).filter(d => repos[d][c]?.size && !lagging.has(d + ' ' + c)).map(did => ({ did })) });
  }
  if (u.origin === PDS && m === 'com.atproto.repo.listRecords') {
    const did = q.get('repo'), c = q.get('collection');
    return json({ records: [...(repos[did]?.[c] || new Map())].map(([rkey, r]) => ({ uri: `at://${did}/${c}/${rkey}`, cid: r.cid, value: r.value })) });
  }
  if (u.origin === PDS && m === 'com.atproto.repo.getRecord') {
    const r = repos[q.get('repo')]?.[q.get('collection')]?.get(q.get('rkey'));
    return r ? json({ uri: `at://${q.get('repo')}/${q.get('collection')}/${q.get('rkey')}`, cid: r.cid, value: r.value }) : json({ error: 'RecordNotFound' }, 400);
  }
  if (m === 'app.bsky.graph.getRelationships') {
    const actor = nameOf(q.get('actor'));
    return json({ relationships: q.getAll('others').map(did => ({ did, ...(follows.some(([a, b]) => a === actor && people[b] === did) ? { following: 'at://x' } : {}), ...(follows.some(([a, b]) => people[a] === did && b === actor) ? { followedBy: 'at://y' } : {}) })) });
  }
  if (m === 'app.bsky.actor.getProfile') {
    const who = nameOf(q.get('actor'));
    return json({ did: q.get('actor'), followsCount: follows.filter(([a]) => a === who).length, followersCount: follows.filter(([, b]) => b === who).length });
  }
  if (m === 'app.bsky.graph.getFollows') {
    const who = nameOf(q.get('actor'));
    return json({ follows: follows.filter(([a]) => a === who).map(([, b]) => ({ did: people[b] })) });
  }
  if (m === 'app.bsky.actor.getProfiles') return json({ profiles: q.getAll('actors').map(did => ({ did, handle: nameOf(did) + '.test', displayName: nameOf(did) })) });
  throw new Error('unexpected fetch ' + u.href);
};

// What the signed-in person's own PDS does with their writes.
const agent = did => ({
  did,
  async fetchHandler(path, init){
    const body = JSON.parse(init.body), method = path.split('.').pop();
    if (method === 'createRecord') { const rkey = 'w' + (n++); put(did, body.collection, rkey, body.record); return json({ uri: `at://${did}/${body.collection}/${rkey}`, cid: repos[did][body.collection].get(rkey).cid }); }
    if (method === 'putRecord') { put(did, body.collection, body.rkey, body.record); return json({ uri: `at://${did}/${body.collection}/${body.rkey}`, cid: repos[did][body.collection].get(body.rkey).cid }); }
    if (method === 'deleteRecord') { repos[did]?.[body.collection]?.delete(body.rkey); return json({}); }
    return json({ error: 'NotFound' }, 404);
  }
});
const titles = items => items.map(i => i.value.title).sort();

test('signed out, only what is open to everyone shows', async () => {
  const { items } = await createSource().board();
  assert.deepEqual(titles(items), ['Dave, closed', 'Dave, for everyone', 'Eve, for everyone']);
});

test('signed in, each audience is respected, and blocks hide people', async () => {
  const { items, notes } = await createSource({ agent: agent(people.me) }).board();
  assert.deepEqual(notes, []);
  assert.deepEqual(titles(items), ['Alice, for mutuals', 'Bob, for people he follows', 'Carol, for her followers', 'Dave, closed', 'Dave, for everyone']);
  const alice = items.find(i => i.repo === people.alice);
  assert.equal(alice.closeness, 'mutual');
  assert.equal(alice.profile.budget, 'none');
  assert.equal(alice.author.handle, 'alice.test');
  assert.equal(items.find(i => i.rkey === 'b1').closeness, 'follows-you');
  assert.equal(items.find(i => i.rkey === 'c2').closeness, 'you-follow');
});

test('taking on, turning in and clearing, even while the relay lags', async () => {
  const src = createSource({ agent: agent(people.me) });
  // The relay hasn't noticed the helper's first take or delivery yet.
  lagging.add(people.me + ' ' + TAKE); lagging.add(people.me + ' ' + DELIVERY);
  let it = await src.sidequest(`at://${people.alice}/${SIDEQUEST}/a1`);
  assert.equal(it.takes.length, 0);
  await src.take(it, { setup: { harness: 'claude-code', models: ['claude-opus-5-5'] } });
  it = await src.sidequest(it.uri, { force: true });
  assert.equal(it.takes.length, 1);
  assert.equal(it.takes[0].value.setup.harness, 'claude-code');
  assert.equal((await src.take(it)).uri, it.takes[0].uri, 'taking twice keeps the one take');
  await src.turnIn(it, { url: 'https://github.com/o/r/pull/9', setup: { harness: 'claude-code' } });
  it = await src.sidequest(it.uri, { force: true });
  assert.equal(it.deliveries.length, 1);
  assert.equal(it.deliveries[0].value.take.uri, it.takes[0].uri);
  await assert.rejects(src.update(it, { state: 'cleared' }), /Only the person who asked/);
  // Alice marks it cleared with the delivery.
  const alice = createSource({ agent: agent(people.alice) });
  const hers = await alice.sidequest(it.uri);
  await alice.update(hers, { state: 'cleared', clearedWith: [{ uri: it.deliveries[0].uri, cid: it.deliveries[0].cid }] });
  const after = await src.sidequest(it.uri, { force: true });
  assert.equal(after.value.state, 'cleared');
  assert.equal(after.value.title, 'Alice, for mutuals');
  // Dropping deletes the take.
  await src.drop(after);
  assert.equal((await src.sidequest(it.uri, { force: true })).takes.length, 0);
});

test('posting, closing and deleting your own', async () => {
  const src = createSource({ agent: agent(people.me) });
  lagging.add(people.me + ' ' + SIDEQUEST);
  const r = await src.post({ title: 'Mine', audience: 'mutuals', subject: { $type: `${SIDEQUEST}#repo`, url: 'https://codeberg.org/me/thing', forge: 'codeberg' } });
  let mine = (await src.board()).items.find(i => i.uri === r.uri);
  assert.ok(mine, 'shows up before the relay lists the repo');
  assert.equal(mine.closeness, 'self');
  await src.update(mine, { state: 'closed' });
  mine = (await src.board({ force: true })).items.find(i => i.uri === r.uri);
  assert.equal(mine.value.state, 'closed');
  await src.remove(mine);
  assert.equal((await src.board({ force: true })).items.some(i => i.uri === r.uri), false);
});

test('profiles: the public copy leaves private fields out', async () => {
  const src = createSource({ agent: agent(people.me) });
  await src.saveProfile({ budget: 'low', circumstances: ['learning'], values: ['climate'], setups: [{ harness: 'codex', models: ['gpt-5-codex'] }] }, { hidden: ['budget', 'circumstances'] });
  const pub = repos[people.me][PROFILE].get('self').value;
  assert.equal(pub.budget, undefined); assert.equal(pub.circumstances, undefined);
  assert.deepEqual(pub.values, ['climate']);
  const p = await src.profileOf(people.me, { force: true });
  assert.equal(p.merged.setups[0].harness, 'codex');
});

test('reach: how many people each audience could show it to', async () => {
  // me follows alice and carol; alice and bob follow me; alice is the one mutual.
  assert.deepEqual(await createSource({ agent: agent(people.me) }).reach(), { following: 2, followers: 2, mutuals: 1 });
  assert.equal(await createSource().reach(), null);
});
