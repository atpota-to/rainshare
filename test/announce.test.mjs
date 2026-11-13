// Posting new asks to @rainshare.dev (api/_announce.js, api/announce.js), against a stand-in
// network: a relay, the PLC directory, one PDS that holds everyone's repo (the account's too),
// Bluesky's AppView, and the site's link preview pictures.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { announce, compose, isNew, askAt, linksIn, ACCOUNT, WINDOW, SETTLE } from '../api/_announce.js';
import handler, { allowed } from '../api/announce.js';
import { SEED, PROFILE, SITE } from '../core/ns.js';

const NOW = Date.parse('2026-11-13T16:00:00Z'), ago = ms => new Date(NOW - ms).toISOString();
const HOUR = 3600e3, DAY = 24 * HOUR;
const POST = 'app.bsky.feed.post', PDS = 'https://pds.test';
const ALICE = 'did:plc:alice', BOB = 'did:plc:bob', CAROL = 'did:plc:carol', DAVE = 'did:plc:dave', ERIN = 'did:plc:erin', FRANK = 'did:plc:frank';
const HANDLES = { [ALICE]: 'alice.test', [BOB]: 'bob.test', [CAROL]: 'carol.test', [DAVE]: 'dave.test', [ERIN]: 'erin.test', [FRANK]: 'frank.test', [ACCOUNT]: 'rainshare.dev' };
const NAMES = { [ALICE]: 'Alice', [BOB]: 'Bob', [CAROL]: 'Carol', [DAVE]: 'Dave', [ERIN]: 'Erin', [FRANK]: 'Frank' };
const A1 = '3n2aaaaaaaaa2', B1 = '3n2bbbbbbbbb2';   // record keys as atproto makes them (TIDs)
const anyone = { $type: `${SEED}#anyone` };
const ask = (title, createdAt, more = {}) => ({ $type: SEED, title, audience: anyone, createdAt, ...more });

let repos, asked, created, onCreate, og;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
beforeEach(() => {
  asked = []; created = []; onCreate = null;
  og = () => new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { headers: { 'content-type': 'image/png' } });
  repos = {
    [ALICE]: { [SEED]: {
      [A1]: ask('Fix the flaky test', ago(DAY), { subject: { $type: `${SEED}#githubIssue`, url: 'https://github.com/alice/app/issues/3', repo: 'alice/app', number: 3 }, stage: 'young', spec: 'The **login** test fails one run in five.\n\nMake it pass every time.' }),
      '3n1aaaaaaaaa2': ask('From last week', ago(5 * DAY)),
      '3n2ccccccccc2': ask('Done already', ago(DAY), { state: 'sprouted' }),
      '3n2ddddddddd2': ask('For mutuals', ago(DAY), { audience: { $type: `${SEED}#mutuals` } })
    } },
    [BOB]: {
      [SEED]: { [B1]: ask('A tiny weather app', ago(2 * HOUR)), '3n2eeeeeeeee2': ask('Only just asked', ago(5 * 60e3)) },
      [PROFILE]: { self: { $type: PROFILE, displayName: 'Bob the Builder' } }
    },
    [CAROL]: { [SEED]: { '3n2fffffffff2': ask('From someone the account blocks', ago(DAY)) } },
    [DAVE]: { [SEED]: { d1: ask('Posted by hand already', ago(DAY)) } },
    [ERIN]: { [SEED]: { '3n2ggggggggg2': ask('From someone who blocks the account', ago(DAY)) } },
    [FRANK]: { [SEED]: { f1: ask('Linked in a post’s text', ago(DAY)) } },
    [ACCOUNT]: {
      'app.bsky.graph.block': { '3m1block00002': { $type: 'app.bsky.graph.block', subject: CAROL, createdAt: ago(9 * DAY) } },
      [POST]: {
        '3n2hand000002': { $type: POST, text: 'Dave wants a hand with this one', createdAt: ago(HOUR), embed: { $type: 'app.bsky.embed.external', external: { uri: 'https://rainshare.vercel.app/seed/dave.test/d1', title: '', description: '' } } },
        '3n2hand000003': { $type: POST, text: 'And Frank’s: rainshare.dev/seed/did:plc:frank/f1.', createdAt: ago(HOUR) }
      }
    }
  };
});
const records = (did, collection) => Object.entries(repos[did]?.[collection] || {}).sort(([a], [b]) => b.localeCompare(a))
  .map(([rkey, value]) => ({ uri: `at://${did}/${collection}/${rkey}`, cid: 'bafy' + rkey, value }));

globalThis.fetch = async (input, init = {}) => {
  const u = new URL(typeof input === 'string' ? input : input.url), q = u.searchParams, method = u.pathname.split('/').pop();
  asked.push(u.host + (u.host === 'pds.test' ? ' ' + method : ''));
  if (u.host === 'relay1.us-east.bsky.network' && method === 'com.atproto.sync.listReposByCollection')
    return json({ repos: Object.keys(repos).filter(d => repos[d][q.get('collection')]).map(did => ({ did })) });
  if (u.host === 'plc.directory') {
    const did = decodeURIComponent(u.pathname.slice(1));
    return json({ id: did, alsoKnownAs: ['at://' + HANDLES[did]], service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }] });
  }
  if (u.host === 'public.api.bsky.app' && method === 'app.bsky.actor.getProfiles')
    return json({ profiles: q.getAll('actors').map(did => ({ did, handle: HANDLES[did], displayName: NAMES[did] || '' })) });
  if (u.host === 'public.api.bsky.app' && method === 'app.bsky.graph.getRelationships')
    return json({ relationships: q.getAll('others').map(did => ({ did, ...(did === ERIN ? { blockedBy: `at://${ERIN}/app.bsky.graph.block/x` } : {}) })) });
  if (u.host === 'pds.test' && method === 'com.atproto.repo.listRecords') return json({ records: records(q.get('repo'), q.get('collection')) });
  if (u.host === 'pds.test' && method === 'com.atproto.repo.getRecord') {
    const v = repos[q.get('repo')]?.[q.get('collection')]?.[q.get('rkey')];
    return v ? json({ uri: `at://${q.get('repo')}/${q.get('collection')}/${q.get('rkey')}`, value: v }) : json({ error: 'RecordNotFound' }, 400);
  }
  if (u.host === 'pds.test' && method === 'com.atproto.server.createSession') {
    const body = JSON.parse(init.body);
    return body.identifier === ACCOUNT && body.password === 'app-pass' ? json({ did: ACCOUNT, accessJwt: 'access' }) : json({ error: 'AuthenticationRequired', message: 'Invalid identifier or password' }, 401);
  }
  if (u.host === 'pds.test' && init.headers?.authorization !== 'Bearer access') return json({ error: 'AuthenticationRequired' }, 401);
  if (u.host === 'pds.test' && method === 'com.atproto.repo.uploadBlob') {
    assert.ok(init.body instanceof Uint8Array);
    return json({ blob: { $type: 'blob', ref: { $link: 'bafkthumb' }, mimeType: init.headers['content-type'], size: init.body.byteLength } });
  }
  if (u.host === 'pds.test' && method === 'com.atproto.repo.createRecord') {
    const body = JSON.parse(init.body), rkey = body.rkey || '3n2auto' + String(created.length).padStart(6, '0');
    const refused = onCreate?.(body);
    if (refused) return refused;
    const mine = (repos[ACCOUNT][body.collection] ||= {});
    if (mine[rkey]) return json({ error: 'InvalidRequest', message: 'Record already exists' }, 400);
    mine[rkey] = body.record; created.push({ rkey, ...body });
    return json({ uri: `at://${ACCOUNT}/${body.collection}/${rkey}`, cid: 'bafynew' });
  }
  if (u.origin === SITE && u.pathname === '/api/og') return og(u);
  throw new Error('a host this shouldn’t ask: ' + u.href);
};
const quiet = () => {};
const run = opts => announce({ password: 'app-pass', now: NOW, log: quiet, ...opts });

test('each new ask is posted once, the earliest first, naming who’s asking, with a card for its page', async () => {
  const out = await run();
  assert.deepEqual(created.map(c => c.rkey), [A1, B1], 'the ask’s own record key, so no other run can post it too');
  assert.deepEqual([out.found, out.skipped, out.later], [6, 4, 0], 'Carol’s and Erin’s are blocked; Dave’s and Frank’s were posted by hand');

  const [a, b] = created.map(c => c.record);
  assert.equal(a.text, 'Alice (@alice.test) is asking for help with a project:\n\nFix the flaky test');
  assert.deepEqual(a.facets, [{ index: { byteStart: 7, byteEnd: 18 }, features: [{ $type: 'app.bsky.richtext.facet#mention', did: ALICE }] }]);
  assert.deepEqual(a.embed, { $type: 'app.bsky.embed.external', external: {
    uri: `${SITE}/seed/alice.test/${A1}`, title: 'Fix the flaky test', description: 'The login test fails one run in five. Make it pass every time.',
    thumb: { $type: 'blob', ref: { $link: 'bafkthumb' }, mimeType: 'image/png', size: 4 } } });
  assert.deepEqual(a.langs, ['en']);
  assert.ok(!Number.isNaN(Date.parse(a.createdAt)));

  assert.equal(b.text, 'Bob the Builder (@bob.test) is asking for help with an idea:\n\nA tiny weather app', 'a Rainshare name wins over the Bluesky one');
  assert.equal(b.embed.external.description, 'Bob the Builder is asking for help with an idea on Rainshare.', 'with no spec, the card says who’s asking');
  assert.deepEqual(out.posts.map(p => [p.ask, p.uri, p.error]), [[`at://${ALICE}/${SEED}/${A1}`, `at://${ACCOUNT}/${POST}/${A1}`, null], [`at://${BOB}/${SEED}/${B1}`, `at://${ACCOUNT}/${POST}/${B1}`, null]]);

  created = [];
  const again = await run();
  assert.deepEqual([created.length, again.found, again.skipped, again.posts.length], [0, 6, 6, 0], 'the next run finds them posted');
});

test('a dry run says what it would post and posts nothing, with no password', async () => {
  const lines = [];
  const out = await announce({ post: false, password: '', now: NOW, log: s => lines.push(s) });
  assert.equal(out.dryRun, true);
  assert.deepEqual(out.posts.map(p => [p.text.split('\n')[0], p.link, p.uri]), [
    ['Alice (@alice.test) is asking for help with a project:', `${SITE}/seed/alice.test/${A1}`, null],
    ['Bob the Builder (@bob.test) is asking for help with an idea:', `${SITE}/seed/bob.test/${B1}`, null]
  ]);
  assert.equal(created.length, 0);
  assert.ok(!asked.some(h => /createSession|uploadBlob|createRecord/.test(h)), 'it never signs in');
  assert.match(lines.join('\n'), /Would post, for .*\n {2}Alice \(@alice\.test\)/);
});

test('without the app password it does nothing at all, and says why', async () => {
  const lines = [];
  const out = await announce({ password: '', now: NOW, log: s => lines.push(s) });
  assert.deepEqual([out.setUp, out.posts.length], [false, 0]);
  assert.deepEqual(asked, [], 'not even the board is read');
  assert.match(lines[0], /RAINSHARE_BLUESKY_APP_PASSWORD isn't set/);
});

test('a run posts a few at most, and leaves the rest for the next', async () => {
  const first = await run({ max: 1 });
  assert.deepEqual([created.map(c => c.rkey), first.later], [[A1], 1]);
  const second = await run({ max: 1 });
  assert.deepEqual([created.map(c => c.rkey), second.later], [[A1, B1], 0]);
});

test('an ask another run has just posted counts as posted, and one post failing doesn’t stop the rest', async () => {
  onCreate = body => {
    // Another run got to Alice's first, between this one reading the account's posts and posting.
    if (body.rkey === A1) { repos[ACCOUNT][POST][A1] = { ...body.record }; return json({ error: 'InvalidRequest', message: 'Record already exists' }, 400); }
  };
  let out = await run();
  assert.deepEqual(out.posts.map(p => [p.uri, p.error]), [[`at://${ACCOUNT}/${POST}/${A1}`, null], [`at://${ACCOUNT}/${POST}/${B1}`, null]]);

  // Now one that fails outright: reported, and the other still goes.
  delete repos[ACCOUNT][POST][A1]; delete repos[ACCOUNT][POST][B1]; created = [];
  onCreate = body => body.rkey === A1 ? json({ error: 'InternalServerError', message: 'Try again' }, 500) : null;
  out = await run();
  assert.deepEqual(out.posts.map(p => [p.uri, p.error]), [[null, 'Try again'], [`at://${ACCOUNT}/${POST}/${B1}`, null]]);
});

test('a post goes without a picture rather than fail when the preview can’t be had', async () => {
  og = () => new Response(null, { status: 302, headers: { location: '/og.jpg' } });
  await run();
  assert.equal(created.length, 2);
  assert.ok(created.every(c => !('thumb' in c.record.embed.external)));
  og = () => new Response(new Uint8Array(1_000_001), { headers: { 'content-type': 'image/png' } });
  delete repos[ACCOUNT][POST][A1]; delete repos[ACCOUNT][POST][B1]; created = [];
  await run();
  assert.equal(created.length, 2);
  assert.ok(created.every(c => !('thumb' in c.record.embed.external)), 'nor one too big for Bluesky');
});

test('a wrong password stops the run before anything is posted', async () => {
  await assert.rejects(run({ password: 'wrong' }), /Invalid identifier or password/);
  assert.equal(created.length, 0);
});

test('what counts as new: open, for everyone, asked in the window and not just now', () => {
  const at = (ms, more) => isNew(ask('Something', ago(ms), more), NOW);
  assert.equal(at(HOUR), true);
  assert.equal(at(SETTLE), true);
  assert.equal(at(SETTLE - 1), false, 'given a few minutes, in case it’s changed straight away');
  assert.equal(at(WINDOW - 1), true);
  assert.equal(at(WINDOW), false);
  assert.equal(at(HOUR, { state: 'open' }), true);
  assert.equal(at(HOUR, { state: 'closed' }), false);
  assert.equal(at(HOUR, { audience: undefined }), true, 'an ask that doesn’t say is for everyone');
  assert.equal(at(HOUR, { audience: { $type: `${SEED}#followers` } }), false);
  assert.equal(at(HOUR, { title: '  ' }), false);
  assert.equal(isNew({ title: 'No date', audience: anyone }, NOW), false);
});

test('a post fits, with the mention on the handle whatever comes before it', () => {
  const bytes = s => Buffer.from(s, 'utf8');
  const mentioned = p => bytes(p.text).subarray(p.facets[0].index.byteStart, p.facets[0].index.byteEnd).toString();
  const item = (title, more) => ({ uri: `at://${ALICE}/${SEED}/${A1}`, repo: ALICE, rkey: A1, value: ask(title, ago(HOUR), more) });

  const p = compose(item('Make it rain 🌧️'), { did: ALICE, handle: 'zoe.test', name: 'Zoë 🌧️ Ünal' });
  assert.equal(p.text, 'Zoë 🌧️ Ünal (@zoe.test) is asking for help with an idea:\n\nMake it rain 🌧️');
  assert.equal(mentioned(p), '@zoe.test');

  const handle = 'a'.repeat(60) + '.' + 'b'.repeat(60) + '.' + 'c'.repeat(60) + '.test', long = compose(item('word '.repeat(30).trim()), { did: ALICE, handle, name: 'N'.repeat(64) });
  const graphemes = s => [...new Intl.Segmenter().segment(s)].length;
  assert.ok(graphemes(long.text) <= 300, `${graphemes(long.text)} graphemes`);
  assert.ok(long.text.endsWith('…'));
  assert.equal(mentioned(long), '@' + handle);

  assert.equal(compose(item('Hi'), { did: ALICE, handle: 'alice.test', name: '' }).text, '@alice.test is asking for help with an idea:\n\nHi');
  const nobody = compose(item('Hi'), { did: ALICE, handle: null, name: '' });
  assert.deepEqual([nobody.text, nobody.facets, nobody.card.uri], ['Someone is asking for help with an idea:\n\nHi', [], `${SITE}/seed/${ALICE}/${A1}`]);
});

test('a post’s links are read wherever they are, and matched to an ask by path', () => {
  assert.deepEqual(linksIn({
    text: 'See rainshare.dev/seed/alice.test/3k1.',
    facets: [{ features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://rainshare.dev/seed/did:plc:bob/3k2' }, { $type: 'app.bsky.richtext.facet#mention', did: BOB }] }],
    embed: { $type: 'app.bsky.embed.recordWithMedia', media: { external: { uri: 'https://example.com/seed/@Carol.Test/3k3?pr=1' } } }
  }).map(askAt), ['carol.test 3k3', 'did:plc:bob 3k2', 'alice.test 3k1'], 'the card, then the text’s links, then what’s written out');
  assert.equal(askAt('https://rainshare.dev/seed/s/abc123'), null, 'a share code isn’t an ask');
  assert.equal(askAt('https://rainshare.dev/profile/alice.test'), null);
});

test('the daily call needs CRON_SECRET, and ?dry=1 posts nothing', async () => {
  const req = (authorization, query = {}) => ({ headers: authorization ? { authorization } : {}, query });
  assert.equal(allowed(req('Bearer s3cret'), ''), false, 'with no secret set, nothing gets in');
  assert.equal(allowed(req('Bearer nope'), 's3cret'), false);
  assert.equal(allowed(req('Bearer s3cret'), 's3cret'), true);

  const call = async (r, env) => {
    const before = { ...process.env };
    Object.assign(process.env, env);
    const res = { headers: {}, setHeader(k, v){ this.headers[k.toLowerCase()] = v; }, end(b){ this.body = JSON.parse(b); } };
    try { await handler(r, res); } finally { for (const k of Object.keys(env)) if (k in before) process.env[k] = before[k]; else delete process.env[k]; }
    return res;
  };
  const env = { CRON_SECRET: 's3cret', RAINSHARE_BLUESKY_APP_PASSWORD: 'app-pass' };
  assert.equal((await call(req('Bearer nope'), env)).statusCode, 401);
  assert.equal((await call(req('Bearer s3cret'), { RAINSHARE_BLUESKY_APP_PASSWORD: 'app-pass' })).statusCode, 401, 'switched off without CRON_SECRET');
  assert.equal(asked.length, 0, 'and nothing was read');

  const dry = await call(req('Bearer s3cret', { dry: '1' }), env);
  assert.deepEqual([dry.statusCode, dry.headers['cache-control'], dry.body.dryRun, created.length], [200, 'no-store', true, 0]);
});
