// The real data source (core/source.js) against a small fake network: PLC, a relay, one PDS
// for everyone, and Bluesky's AppView, all answered by a stubbed fetch.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SEED, TAKE, DELIVERY, PROFILE } from '../core/ns.js';
import { createSource } from '../core/source.js';
import { firstOf } from '../core/net.js';
import { FOLLOW, tieOf } from '../core/ties.js';

const PDS = 'https://pds.test';
const people = { me: 'did:plc:me', alice: 'did:plc:alice', bob: 'did:plc:bob', carol: 'did:plc:carol', dave: 'did:plc:dave', eve: 'did:plc:eve' };
// who follows whom: [follower, followed]
const follows = [['me', 'alice'], ['alice', 'me'], ['bob', 'me'], ['me', 'carol'], ['carol', 'dave'], ['alice', 'dave']];
let repos, n, lagging;
// Constellation, the index of who links to what: off (it throws, like a server that's down)
// unless a test turns it on. `asked` is every address the code under test fetched.
let index, asked;

const sq = (title, audience, extra = {}) => ({ $type: SEED, title, audience: { $type: `${SEED}#${audience}` }, createdAt: new Date(Date.now() - (n++) * 1000).toISOString(), ...extra });
function put(did, collection, rkey, value){ (repos[did] ||= {})[collection] ||= new Map(); repos[did][collection].set(rkey, { value, cid: 'bafy' + (n++) }); }
beforeEach(() => {
  repos = {}; n = 1; lagging = new Set(); index = null; asked = [];
  put(people.alice, SEED, 'a1', sq('Alice, for mutuals', 'mutuals'));
  put(people.alice, PROFILE, 'self', { $type: PROFILE, budget: 'none', circumstances: ['student'], createdAt: new Date().toISOString() });
  put(people.bob, SEED, 'b1', sq('Bob, for people he follows', 'following'));
  put(people.bob, SEED, 'b2', sq('Bob, for mutuals', 'mutuals'));
  put(people.carol, SEED, 'c1', sq('Carol, for mutuals', 'mutuals'));
  put(people.carol, SEED, 'c2', sq('Carol, for her followers', 'followers'));
  put(people.dave, SEED, 'd1', sq('Dave, for everyone', 'anyone'));
  put(people.dave, SEED, 'd2', sq('Dave, closed', 'anyone', { state: 'closed' }));
  put(people.eve, SEED, 'e1', sq('Eve, for everyone', 'anyone'));
  put(people.me, 'app.bsky.graph.block', 'x1', { subject: people.eve });
});

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const nameOf = did => Object.keys(people).find(k => people[k] === did);
globalThis.fetch = async (input, init = {}) => {
  const u = new URL(typeof input === 'string' ? input : input.url), q = u.searchParams, m = u.pathname.replace('/xrpc/', '');
  asked.push(u.href);
  if (u.host === 'constellation.microcosm.blue') {
    if (!index) throw new Error('constellation is down');
    const [collection, path] = q.get('source').split(':'), subject = q.get('subject');
    if (m !== 'blue.microcosm.links.getBacklinks' || path !== 'seed.uri') return json({ error: 'InvalidRequest' }, 400);
    const records = Object.keys(repos).flatMap(did => [...(repos[did][collection] || new Map())].filter(([, r]) => r.value?.seed?.uri === subject).map(([rkey]) => ({ did, collection, rkey })));
    return json({ total: records.length + index.extra.length, records: [...records, ...index.extra], cursor: null });
  }
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

test('taking on, turning in and sprouting, even while the relay lags', async () => {
  const src = createSource({ agent: agent(people.me) });
  // The relay hasn't noticed the helper's first take or delivery yet.
  lagging.add(people.me + ' ' + TAKE); lagging.add(people.me + ' ' + DELIVERY);
  let it = await src.seed(`at://${people.alice}/${SEED}/a1`);
  assert.equal(it.takes.length, 0);
  await src.take(it, { setup: { harness: 'claude-code', models: ['claude-opus-5-5'] } });
  it = await src.seed(it.uri, { force: true });
  assert.equal(it.takes.length, 1);
  assert.equal(it.takes[0].value.setup.harness, 'claude-code');
  assert.equal((await src.take(it)).uri, it.takes[0].uri, 'taking twice keeps the one take');
  await src.turnIn(it, { url: 'https://github.com/o/r/pull/9', setup: { harness: 'claude-code' } });
  it = await src.seed(it.uri, { force: true });
  assert.equal(it.deliveries.length, 1);
  assert.equal(it.deliveries[0].value.take.uri, it.takes[0].uri);
  await assert.rejects(src.update(it, { state: 'sprouted' }), /Only the person who asked/);
  // Alice marks it sprouted with the delivery.
  const alice = createSource({ agent: agent(people.alice) });
  const hers = await alice.seed(it.uri);
  await alice.update(hers, { state: 'sprouted', sproutedWith: [{ uri: it.deliveries[0].uri, cid: it.deliveries[0].cid }] });
  const after = await src.seed(it.uri, { force: true });
  assert.equal(after.value.state, 'sprouted');
  assert.equal(after.value.title, 'Alice, for mutuals');
  // Dropping deletes the take.
  await src.drop(after);
  assert.equal((await src.seed(it.uri, { force: true })).takes.length, 0);
});

test('someone you block can’t keep a seed looking taken', async () => {
  // Eve, whom I block, says she's on Dave's seed and turns something in.
  const eve = createSource({ agent: agent(people.eve) });
  const d1 = await eve.seed(`at://${people.dave}/${SEED}/d1`);
  await eve.take(d1);
  await eve.turnIn(d1, { url: 'https://github.com/o/r/pull/1' });
  const seen = await eve.seed(d1.uri, { force: true });
  assert.equal(seen.takes.length, 1, 'everyone else still sees it');
  const mine = createSource({ agent: agent(people.me) });
  const it = await mine.seed(d1.uri);
  assert.equal(it.takes.length, 0);
  assert.equal(it.deliveries.length, 0);
  const onBoard = (await mine.board()).items.find(i => i.uri === d1.uri);
  assert.equal(onBoard.takes.length, 0);
});

test('posting, closing and deleting your own', async () => {
  const src = createSource({ agent: agent(people.me) });
  lagging.add(people.me + ' ' + SEED);
  const r = await src.plant({ title: 'Mine', audience: 'mutuals', subject: { $type: `${SEED}#repo`, url: 'https://codeberg.org/me/thing', forge: 'codeberg' } });
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

test('ties: who follows whom on Bluesky and on Tangled, beside askers, helpers and profiles', async () => {
  // On Tangled: you and Dave follow each other, you follow Bob, and Alice follows you.
  const tf = (by, of) => put(people[by], FOLLOW, people[of], { $type: FOLLOW, createdAt: new Date().toISOString() });
  tf('me', 'dave'); tf('dave', 'me'); tf('me', 'bob'); tf('alice', 'me');
  const src = createSource({ agent: agent(people.me) });
  const { items } = await src.board();
  const of = who => items.find(i => i.repo === people[who]).ties;
  assert.deepEqual(of('alice'), { bsky: { following: true, followedBy: true }, tangled: { following: false, followedBy: true } });
  assert.deepEqual(of('dave'), { bsky: { following: false, followedBy: false }, tangled: { following: true, followedBy: true } });
  // Bob follows you on Bluesky and you follow him on Tangled: mutual, across the two.
  assert.equal(tieOf(of('bob')), 'mutual');
  assert.equal(tieOf(of('carol')), 'you-follow');
  // Your own asks have none.
  await src.plant({ title: 'Mine', audience: 'anyone' });
  assert.equal((await src.board({ force: true })).items.find(i => i.repo === people.me).ties, null);

  // On an ask's page, the people who helped carry theirs too.
  const dave = createSource({ agent: agent(people.dave) });
  let d1 = await dave.seed(`at://${people.dave}/${SEED}/d1`);
  assert.equal(tieOf(d1.ties), null, 'Dave and Dave have no ties');
  await src.take(await src.seed(d1.uri), { setup: { harness: 'claude-code' } });
  d1 = await dave.seed(d1.uri, { force: true });
  assert.deepEqual(d1.takes[0].ties, { bsky: { following: false, followedBy: false }, tangled: { following: true, followedBy: true } });

  // A profile says the same.
  assert.equal(tieOf((await src.profileOf(people.dave)).ties), 'mutual');
  assert.equal((await src.profileOf(people.me)).ties, null);

  // Who you follow on Bluesky that follows them: Alice and Carol follow Dave.
  const k = await src.knownFollowers(people.dave);
  assert.deepEqual(k.people.map(p => p.did), [people.alice, people.carol]);
  assert.equal(k.count, 2);
  assert.equal(k.partial, false);
  assert.equal(await src.knownFollowers(people.me), null);
  assert.equal(await createSource().knownFollowers(people.dave), null);
});

test('names come from Bluesky, unless someone’s Rainshare profile gives one of its own', async () => {
  put(people.alice, PROFILE, 'self', { $type: PROFILE, displayName: 'Alice at Rainshare', createdAt: new Date().toISOString() });
  const src = createSource({ agent: agent(people.me) });
  const { items } = await src.board();
  assert.equal(items.find(i => i.repo === people.alice).author.displayName, 'Alice at Rainshare');
  assert.equal(items.find(i => i.repo === people.dave).author.displayName, 'dave', 'nothing on Rainshare: the Bluesky name');
  // Helpers too, on an ask's page.
  const alice = createSource({ agent: agent(people.alice) });
  await alice.take(await alice.seed(`at://${people.dave}/${SEED}/d1`), { setup: { harness: 'claude-code' } });
  const d1 = await src.seed(`at://${people.dave}/${SEED}/d1`, { force: true });
  assert.equal(d1.takes[0].author.displayName, 'Alice at Rainshare');
  // A profile has both: how Rainshare shows them, and their Bluesky profile (for the form's hints).
  const prof = await src.profileOf(people.alice);
  assert.equal(prof.person.displayName, 'Alice at Rainshare');
  assert.equal(prof.bluesky.displayName, 'alice');
});

test('one seed’s helpers come from Constellation, read from their own servers, and the long way if it’s down', async () => {
  const uri = `at://${people.dave}/${SEED}/d1`, other = `at://${people.eve}/${SEED}/e1`;
  put(people.alice, TAKE, 't1', { $type: TAKE, seed: { uri, cid: 'x' }, createdAt: new Date().toISOString() });
  put(people.bob, TAKE, 't2', { $type: TAKE, seed: { uri: other, cid: 'x' }, createdAt: new Date().toISOString() });
  put(people.carol, DELIVERY, 'x1', { $type: DELIVERY, seed: { uri, cid: 'x' }, url: 'https://github.com/o/r/pull/1', createdAt: new Date().toISOString() });
  const scans = () => asked.filter(a => a.includes('listReposByCollection') && (a.includes(TAKE) || a.includes(DELIVERY))).length;

  // With the index answering: nobody's takes are listed, only the ones that point here are read.
  // It names one that points somewhere else and one that isn't there: neither is believed.
  index = { extra: [{ did: people.bob, collection: TAKE, rkey: 't2' }, { did: people.bob, collection: TAKE, rkey: 'gone' }, { did: 'not a did', collection: TAKE, rkey: 't1' }] };
  let it = await createSource().seed(uri);
  assert.deepEqual(it.takes.map(t => t.repo), [people.alice]);
  assert.deepEqual(it.deliveries.map(d => d.repo), [people.carol]);
  assert.equal(it.takes[0].author.handle, 'alice.test', 'and they’re named');
  assert.equal(scans(), 0, 'no relay was asked who has takes or deliveries');
  assert.equal(asked.filter(a => a.includes('listRecords')).length, 0);

  // Your own take shows at once, before the index or its server's listing has heard of it.
  const me = createSource({ agent: agent(people.me) });
  await me.take(await me.seed(uri));
  const [key, held] = [...repos[people.me][TAKE]][0];
  repos[people.me][TAKE].delete(key);
  it = await me.seed(uri, { force: true });
  assert.ok(it.takes.some(t => t.repo === people.me));
  repos[people.me][TAKE].set(key, held);

  // With the index down, everyone's are read the long way, and the answer is the same.
  index = null; asked = [];
  it = await createSource().seed(uri);
  assert.deepEqual(it.takes.map(t => t.repo).sort(), [people.alice, people.me].sort());
  assert.deepEqual(it.deliveries.map(d => d.repo), [people.carol]);
  assert.ok(scans() >= 2, 'the relay was asked instead');

  // After the board has read everyone's, a seed's page uses that and asks the index nothing.
  index = { extra: [] }; asked = [];
  const src = createSource();
  await src.board();
  asked = [];
  it = await src.seed(uri);
  assert.deepEqual(it.takes.map(t => t.repo).sort(), [people.alice, people.me].sort());
  assert.equal(asked.filter(a => a.includes('constellation')).length, 0);
});

test('a slow or failing relay gets company: the next is asked, and the first answer wins', async () => {
  const later = (ms, v, fail) => () => new Promise((ok, no) => setTimeout(() => fail ? no(new Error(v)) : ok(v), ms));
  let started = 0;
  const counted = way => () => { started++; return way(); };
  assert.equal(await firstOf([counted(later(5, 'first')), counted(later(1, 'second'))], 50), 'first');
  assert.equal(started, 1, 'a quick answer means the second is never asked');
  assert.equal(await firstOf([later(200, 'slow'), later(5, 'second')], 20), 'second', 'a slow first is overtaken');
  assert.equal(await firstOf([later(40, 'slow but first'), later(100, 'second')], 10), 'slow but first', 'and still wins if it answers first');
  assert.equal(await firstOf([later(1, 'down', true), later(5, 'second')], 5000), 'second', 'a failure moves on at once, without waiting');
  await assert.rejects(firstOf([later(1, 'a', true), later(1, 'b', true)], 10), /b/);
});
