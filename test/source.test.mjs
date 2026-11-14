// The real data source (core/source.js) against a small fake network: PLC, a relay, one PDS
// for everyone, and Bluesky's AppView, all answered by a stubbed fetch.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SEED, TAKE, DELIVERY, PROFILE, COMMENT, MODERATION, MODERATOR } from '../core/ns.js';
import { createSource } from '../core/source.js';
import { keyOf } from '../core/moderation.js';
import { brief } from '../core/brief.js';
import { firstOf } from '../core/net.js';
import { FOLLOW, tieOf } from '../core/ties.js';
import { threads } from '../core/comments.js';

const PDS = 'https://pds.test';
const people = { me: 'did:plc:me', alice: 'did:plc:alice', bob: 'did:plc:bob', carol: 'did:plc:carol', dave: 'did:plc:dave', eve: 'did:plc:eve' };
// who follows whom: [follower, followed]
const follows = [['me', 'alice'], ['alice', 'me'], ['bob', 'me'], ['me', 'carol'], ['carol', 'dave'], ['alice', 'dave']];
let repos, n, lagging;
// Constellation, the index of who links to what: off (it throws, like a server that's down)
// unless a test turns it on. `asked` is every address the code under test fetched.
let index, asked;
// knotless's API: off when a test says so.
let knotlessDown = false;

const sq = (title, audience, extra = {}) => ({ $type: SEED, title, audience: { $type: `${SEED}#${audience}` }, createdAt: new Date(Date.now() - (n++) * 1000).toISOString(), ...extra });
function put(did, collection, rkey, value){ (repos[did] ||= {})[collection] ||= new Map(); repos[did][collection].set(rkey, { value, cid: 'bafy' + (n++) }); }
beforeEach(() => {
  repos = {}; n = 1; lagging = new Set(); index = null; asked = []; knotlessDown = false;
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
  // knotless: a repo, and an issue's thread, listing the comments everyone's written on it.
  if (u.host === 'knotless.dev') {
    if (knotlessDown) return json({ error: 'InternalServerError' }, 500);
    if (m === 'dev.knotless.getRepo') return json({ uri: `at://${people.dave}/dev.knotless.repo/proj`, key: '3mzkeykeykey2', name: 'proj', owner: { did: people.dave, handle: 'dave.test' } });
    if (m === 'dev.knotless.getThread') {
      const comments = Object.keys(repos).flatMap(did => [...(repos[did]['dev.knotless.comment'] || new Map())].filter(([, r]) => r.value.subject === q.get('uri'))
        .map(([rkey, r]) => ({ uri: `at://${did}/dev.knotless.comment/${rkey}`, author: { did, handle: nameOf(did) + '.test' }, body: r.value.body, html: '', createdAt: r.value.createdAt })));
      return json({ item: { uri: q.get('uri'), title: 'Flaky', state: 'open' }, comments, closes: [], checks: [], card: '' });
    }
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
  if (m === 'com.atproto.identity.resolveHandle') { const did = people[q.get('handle').replace(/\.test$/, '')]; return did ? json({ did }) : json({ error: 'HandleNotFound' }, 400); }
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
  // (The one listing is Rainshare's own moderation, from @rainshare.dev's repo alone.)
  assert.equal(asked.filter(a => a.includes('listRecords') && !a.includes(MODERATION)).length, 0);
  assert.ok(asked.filter(a => a.includes('listRecords')).every(a => a.includes('repo=' + encodeURIComponent(MODERATOR))));

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

  // After the board has read everyone's, a seed's page uses that, and asks the index only
  // about comments (which the board doesn't read).
  index = { extra: [] }; asked = [];
  const src = createSource();
  await src.board();
  asked = [];
  it = await src.seed(uri);
  assert.deepEqual(it.takes.map(t => t.repo).sort(), [people.alice, people.me].sort());
  assert.deepEqual(asked.filter(a => a.includes('constellation')).map(a => new URL(a).searchParams.get('source')), [COMMENT + ':seed.uri']);
});

test('comments: said on a seed and replied to, found through Constellation, and taken back only by whoever wrote them', async () => {
  index = { extra: [] };
  const uri = `at://${people.dave}/${SEED}/d1`;
  const me = createSource({ agent: agent(people.me) });
  let it = await me.seed(uri);
  assert.deepEqual(it.comments, []);
  const mine = await me.comment(it, { text: '  Does it need to work offline?  ' });
  assert.equal(mine.value.text, 'Does it need to work offline?');
  it = await me.seed(uri, { force: true });
  assert.deepEqual(it.comments.map(c => c.uri), [mine.uri]);
  assert.equal(it.comments[0].author.handle, 'me.test', 'and they’re named');
  // Dave, who asked, answers it. A reply has to be on the same seed, and say something.
  const dave = createSource({ agent: agent(people.dave) });
  const his = await dave.seed(uri);
  const answer = await dave.comment(his, { text: 'No, online is fine.', parent: his.comments[0] });
  assert.deepEqual(answer.value.parent, { uri: mine.uri, cid: mine.cid });
  await assert.rejects(dave.comment(await dave.seed(`at://${people.eve}/${SEED}/e1`), { text: 'Hm', parent: his.comments[0] }), /isn’t on this one/);
  await assert.rejects(dave.comment(his, { text: '   ' }), /Write something/);
  // Eve, whom I block, says something too: everyone else sees it, and I don't.
  const eve = createSource({ agent: agent(people.eve) });
  await eve.comment(await eve.seed(uri), { text: 'Look at my thing instead' });
  it = await me.seed(uri, { force: true });
  const t = threads(it.comments, uri);
  assert.deepEqual(t.map(x => x.repo), [people.me]);
  assert.deepEqual(t[0].replies.map(r => [r.repo, r.value.text]), [[people.dave, 'No, online is fine.']]);
  assert.equal((await createSource().seed(uri)).comments.length, 3);
  // Only whoever wrote one can delete it. Deleting mine leaves Dave's reply, as one to a comment that's gone.
  await assert.rejects(me.uncomment(it, it.comments.find(c => c.repo === people.dave)), /Only the person who wrote/);
  await me.uncomment(it, it.comments.find(c => c.repo === people.me));
  it = await me.seed(uri, { force: true });
  assert.deepEqual(threads(it.comments, uri).map(x => [x.repo, x.lost]), [[people.dave, true]]);
  // With the index down, they're found the long way, like takes and deliveries.
  index = null;
  assert.deepEqual((await createSource().seed(uri)).comments.map(c => c.repo).sort(), [people.dave, people.eve].sort());
});

test('an ask on a knotless issue talks on the issue: its comments are read from knotless, and yours are posted there', async () => {
  index = { extra: [] };
  const issue = `at://${people.dave}/dev.knotless.issue/3kiss`, at = new Date().toISOString();
  const subject = { $type: `${SEED}#knotlessIssue`, url: `https://knotless.dev/dave.test/proj/issue/${people.dave}/3kiss`, repoUrl: 'https://knotless.dev/dave.test/proj', uri: issue };
  put(people.dave, SEED, 'k1', sq('Dave, on knotless', 'anyone', { subject }));
  const uri = `at://${people.dave}/${SEED}/k1`;
  // Alice has already said something on the issue, and so has Eve, whom I block.
  put(people.alice, 'dev.knotless.comment', 'kc1', { $type: 'dev.knotless.comment', subject: issue, body: 'Is it the clock?', createdAt: at });
  put(people.eve, 'dev.knotless.comment', 'kc2', { $type: 'dev.knotless.comment', subject: issue, body: 'Look at my thing instead', createdAt: at });
  const me = createSource({ agent: agent(people.me) });
  let it = await me.seed(uri);
  assert.deepEqual(it.talk, { forge: 'knotless', read: true, more: false });
  assert.deepEqual(it.comments.map(c => [c.repo, c.forge, c.author.handle]), [[people.alice, 'knotless', 'alice.test']]);
  // Mine goes on the issue, as a knotless comment in my own account. Nothing of Rainshare's is written.
  const mine = await me.comment(it, { text: '  Looks like it.  ' });
  assert.equal(mine.forge, 'knotless');
  const [[, written]] = [...repos[people.me]['dev.knotless.comment']];
  assert.deepEqual([written.value.subject, written.value.body, written.value.repo.key], [issue, 'Looks like it.', '3mzkeykeykey2']);
  assert.equal(repos[people.me][COMMENT], undefined);
  it = await me.seed(uri, { force: true });
  assert.deepEqual(it.comments.map(c => c.repo), [people.alice, people.me]);
  // Replies and deleting are the forge's business.
  await assert.rejects(me.comment(it, { text: 'Hm', parent: it.comments[0] }), /can’t be replies/);
  await assert.rejects(me.uncomment(it, it.comments[1]), /Change or delete it there/);
  // When knotless doesn't answer it says so, and a comment written on Rainshare is still there.
  put(people.bob, COMMENT, 'r1', { $type: COMMENT, seed: { uri, cid: 'x' }, text: 'From before', createdAt: at });
  knotlessDown = true;
  it = await createSource().seed(uri, { force: true });
  assert.deepEqual(it.talk, { forge: 'knotless', read: false, more: false });
  assert.deepEqual(it.comments.map(c => [c.repo, c.forge]), [[people.bob, undefined]]);
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

// Rainshare's own moderation (core/moderation.js): records in @rainshare.dev's repo, and nobody else's.
const decide = (subject, { by = MODERATOR, key = keyOf(subject), reason = 'unsafe' } = {}) =>
  put(by, MODERATION, key, { $type: MODERATION, subject, action: 'hide', reason, createdAt: new Date().toISOString() });

test('what @rainshare.dev hides is gone for everyone else, and nobody else’s word counts', async () => {
  decide(`at://${people.dave}/${SEED}/d1`);
  // Someone else writing the same kind of record, in their own repo, changes nothing.
  decide(`at://${people.eve}`, { by: people.alice });
  let { items } = await createSource().board();
  assert.deepEqual(titles(items), ['Dave, closed', 'Eve, for everyone']);
  // A whole account: everything it asks for.
  decide(`at://${people.eve}`);
  ({ items } = await createSource().board());
  assert.deepEqual(titles(items), ['Dave, closed']);
  // Whoever asked still sees their own, marked, so they know.
  ({ items } = await createSource({ agent: agent(people.dave) }).board());
  assert.equal(items.find(i => i.rkey === 'd1')?.hidden?.reason, 'unsafe');
  assert.equal(items.find(i => i.rkey === 'd2').hidden, null);
  // Its page still reads it, marked, for the screens to keep back; its brief is a refusal.
  const it = await createSource().seed(`at://${people.dave}/${SEED}/d1`);
  assert.equal(it.hidden.subject, `at://${people.dave}/${SEED}/d1`);
  assert.match(brief(it), /^# Hidden by Rainshare/);
  // A profile from a hidden account says so.
  assert.equal((await createSource().profileOf(people.eve)).moderated.subject, `at://${people.eve}`);
  assert.equal((await createSource().profileOf(people.dave)).moderated, null);
});

test('takes, deliveries and comments Rainshare hid are left off an ask, as if blocked', async () => {
  const uri = `at://${people.dave}/${SEED}/d1`, at = (did, c, k) => `at://${did}/${c}/${k}`;
  put(people.alice, TAKE, 't1', { $type: TAKE, seed: { uri, cid: 'x' }, createdAt: new Date().toISOString() });
  put(people.carol, TAKE, 't2', { $type: TAKE, seed: { uri, cid: 'x' }, createdAt: new Date().toISOString() });
  put(people.carol, DELIVERY, 'x1', { $type: DELIVERY, seed: { uri, cid: 'x' }, url: 'https://github.com/o/r/pull/1', createdAt: new Date().toISOString() });
  put(people.bob, COMMENT, 'k1', { $type: COMMENT, seed: { uri, cid: 'x' }, text: 'Can I help?', createdAt: new Date().toISOString() });
  put(people.alice, COMMENT, 'k2', { $type: COMMENT, seed: { uri, cid: 'x' }, text: 'Buy my course', createdAt: new Date().toISOString() });
  decide(`at://${people.carol}`, { reason: 'spam' });
  decide(at(people.alice, COMMENT, 'k2'), { reason: 'spam' });
  const it = await createSource().seed(uri);
  assert.equal(it.hidden, null);
  assert.deepEqual(it.takes.map(t => t.repo), [people.alice]);
  assert.deepEqual(it.deliveries, []);
  assert.deepEqual(it.comments.map(c => c.value.text), ['Can I help?']);
  // The board agrees.
  const { items } = await createSource().board();
  assert.deepEqual(items.find(i => i.uri === uri).takes.map(t => t.repo), [people.alice]);
});

test('only @rainshare.dev’s sign-in can moderate, and a decision is a record keyed by what it’s about', async () => {
  assert.equal(createSource().moderation, null);
  assert.equal(createSource({ agent: agent(people.me) }).moderation, null);
  const mod = createSource({ agent: agent(MODERATOR) }).moderation, subject = `at://${people.dave}/${SEED}/d1`;
  assert.equal(await mod.subjectFrom('https://rainshare.dev/seed/dave.test/d1'), subject);
  await mod.hide(subject, { reason: 'spam', note: '  Ads for a course  ' });
  const key = `${people.dave}:${SEED}:d1`;
  assert.equal(keyOf(subject), key);
  assert.deepEqual({ ...repos[MODERATOR][MODERATION].get(key).value, createdAt: 'x' }, { $type: MODERATION, subject, action: 'hide', reason: 'spam', note: 'Ads for a course', createdAt: 'x' });
  assert.deepEqual((await mod.list()).map(d => [d.subject, d.reason]), [[subject, 'spam']]);
  assert.deepEqual(await createSource().board().then(b => titles(b.items)), ['Dave, closed', 'Eve, for everyone']);
  const about = await mod.about(subject);
  assert.deepEqual([about.kind, about.title, about.author.handle, about.unread], ['ask', 'Dave, for everyone', 'dave.test', false]);
  assert.equal((await mod.about(`at://${people.eve}`)).kind, 'account');
  // Hiding it again replaces the record; unhiding deletes every record about it, whatever its key.
  await mod.hide(subject, { reason: 'unsafe' });
  decide(subject, { key: 'stray', reason: 'other' });
  assert.equal(repos[MODERATOR][MODERATION].size, 2);
  await createSource({ agent: agent(MODERATOR) }).moderation.unhide(subject);
  assert.equal(repos[MODERATOR][MODERATION].size, 0);
  assert.deepEqual(await createSource().board().then(b => titles(b.items)), ['Dave, closed', 'Dave, for everyone', 'Eve, for everyone']);
});

test('if @rainshare.dev’s server doesn’t answer, the board still shows, and the moderation page says so', async () => {
  decide(`at://${people.dave}/${SEED}/d1`);
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => String(input.url || input).includes(encodeURIComponent(MODERATOR)) && String(input.url || input).includes('listRecords') ? json({ error: 'InternalServerError' }, 500) : real(input, init);
  try {
    assert.deepEqual(titles((await createSource().board()).items), ['Dave, closed', 'Dave, for everyone', 'Eve, for everyone']);
    await assert.rejects(createSource({ agent: agent(MODERATOR) }).moderation.list());
  } finally { globalThis.fetch = real; }
});

test('a garden and an activity list, read from the helper’s own account, keep to who each ask is for', async () => {
  const VOUCH = 'org.tangled.graph.vouch', when = d => `2026-11-${String(d).padStart(2, '0')}T12:00:00.000Z`;
  const ref = (did, coll, rkey) => ({ uri: `at://${did}/${coll}/${rkey}`, cid: repos[did][coll].get(rkey).cid });
  const b1 = ref(people.bob, SEED, 'b1'), b2 = ref(people.bob, SEED, 'b2'), d1 = ref(people.dave, SEED, 'd1');
  // Carol helps with both of Bob's: one is for people he follows (you), the other for his mutuals (not you).
  put(people.carol, TAKE, 'ct1', { $type: TAKE, seed: b1, createdAt: when(2) });
  put(people.carol, DELIVERY, 'cd1', { $type: DELIVERY, seed: b1, url: 'https://github.com/bob/r/pull/1', createdAt: when(3) });
  put(people.carol, DELIVERY, 'cd2', { $type: DELIVERY, seed: b2, url: 'https://github.com/bob/r/pull/2', createdAt: when(4) });
  put(people.carol, COMMENT, 'cc1', { $type: COMMENT, seed: d1, text: 'Is this still wanted?', createdAt: when(5) });
  put(people.carol, VOUCH, people.alice, { kind: 'vouch', reason: 'Kind and careful.', createdAt: when(6) });
  put(people.carol, VOUCH, people.dave, { kind: 'denounce', reason: 'Not listed.', createdAt: when(7) });
  for (const [rkey, dl, thanks] of [['b1', 'cd1', 'Thank you, Carol!'], ['b2', 'cd2', 'Not for your eyes.']]) {
    const v = repos[people.bob][SEED].get(rkey).value;
    put(people.bob, SEED, rkey, { ...v, state: 'sprouted', sproutedWith: [ref(people.carol, DELIVERY, dl)], thanks, updatedAt: when(8) });
  }
  const src = createSource({ agent: agent(people.me) });
  const garden = await src.gardenOf(people.carol);
  assert.deepEqual(garden.map(g => [g.rkey, g.shared, g.thanks, g.link]).sort(), [
    ['b1', true, 'Thank you, Carol!', 'https://github.com/bob/r/pull/1'],
    ['b2', false, 'Not for your eyes.', 'https://github.com/bob/r/pull/2']   // counted, but the screens don't name it
  ]);
  assert.equal(garden.find(g => g.rkey === 'b1').author.handle, 'bob.test');
  // Carol herself sees both as hers to name.
  assert.ok((await createSource({ agent: agent(people.carol) }).gardenOf(people.carol)).every(g => g.shared));
  const stories = await src.activityOf(people.carol);
  assert.deepEqual(stories.map(s => [s.kind, s.seed?.rkey || s.person.handle]).sort(), [
    ['asked', 'c2'],               // her own ask for her followers (you follow her); c1, for her mutuals, isn't shown to you
    ['helped', 'b1'],              // b2 isn't for you, so it's left out
    ['talked', 'd1'],
    ['vouched', 'alice.test']      // and the denouncement isn't listed
  ]);
  assert.deepEqual(stories.find(s => s.kind === 'helped').steps.map(x => x.what), ['took', 'turned-in', 'accepted']);
});

test('buds: a pull request turned in on an open ask, which GitHub says was merged, on the ask’s own repo', async () => {
  const subject = { $type: `${SEED}#githubIssue`, url: 'https://github.com/bob/r/issues/1', repo: 'bob/r', number: 1 };
  put(people.bob, SEED, 'b3', sq('Bob, on GitHub', 'following', { subject, stage: 'young' }));
  put(people.bob, SEED, 'b4', sq('Bob, elsewhere', 'following', { subject }));
  const b3 = { uri: `at://${people.bob}/${SEED}/b3`, cid: repos[people.bob][SEED].get('b3').cid }, b4 = { uri: `at://${people.bob}/${SEED}/b4`, cid: repos[people.bob][SEED].get('b4').cid };
  put(people.carol, DELIVERY, 'cd3', { $type: DELIVERY, seed: b3, url: 'https://github.com/bob/r/pull/7', createdAt: new Date().toISOString() });
  put(people.carol, DELIVERY, 'cd4', { $type: DELIVERY, seed: b4, url: 'https://github.com/carol/other/pull/1', createdAt: new Date().toISOString() });
  const real = globalThis.fetch, github = [];
  globalThis.fetch = async (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input.url);
    if (u.host === 'api.github.com') { github.push(u.pathname); return json({ state: 'closed', merged_at: '2026-11-10T00:00:00Z' }); }
    return real(input, init);
  };
  try {
    const buds = await createSource({ agent: agent(people.me) }).buddingOf(people.carol);
    assert.deepEqual(buds.map(b => [b.rkey, b.budding, b.author.handle]), [['b3', true, 'bob.test']]);
    assert.deepEqual(github, ['/repos/bob/r/pulls/7'], 'a pull request on another repo isn’t even asked about');
  } finally { globalThis.fetch = real; }
});
