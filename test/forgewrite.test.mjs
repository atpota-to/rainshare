// Posting to knotless and Tangled as the signed-in person, against a made-up network shaped
// like the real ones (knotless.dev's API and record definitions; Tangled's API, its knot, and
// what its own web app sends).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED, FORGE_SCOPES } from '../core/ns.js';
import { parseSubject } from '../core/subjects.js';
import { forgeIssue, forgeComment, writableForge, ForgeError } from '../core/forgewrite.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const ME = 'did:plc:me';
/** A signed-in person's own server: remembers what it was asked, and answers writes and token requests. */
function agentOf({ refuse } = {}){
  const asked = [];
  return { did: ME, asked, async fetchHandler(path, init = {}){
    const u = new URL(path, 'https://pds.example'), method = u.pathname.split('/xrpc/')[1], body = init.body ? JSON.parse(init.body) : null;
    asked.push({ method, verb: init.method, params: Object.fromEntries(u.searchParams), body });
    if (refuse) return json({ error: 'ScopeMissingError', message: 'Missing required scope' }, 403);
    if (method === 'com.atproto.server.getServiceAuth') return json({ token: 'a.service.token' });
    if (method === 'com.atproto.repo.createRecord') return json({ uri: `at://${ME}/${body.collection}/3knew${asked.length}`, cid: 'bafynew' });
    return json({ error: 'MethodNotImplemented' }, 501);
  } };
}
/** The public network: knotless.dev, Tangled's API, and a knot. `knot` collects what was posted to it. */
function network({ capabilities = ['knot-social-writes'], knotHost = 'knot1.tangled.sh' } = {}){
  const knot = [], real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const u = new URL(String(input)), q = u.searchParams, method = u.pathname.split('/xrpc/')[1];
    if (u.host === 'knotless.dev' && method === 'dev.knotless.getRepo') return q.get('repo') === 'at://alice.test/dev.knotless.repo/proj' ? json({ uri: 'at://did:plc:alice/dev.knotless.repo/proj', key: '3mzcyhybrkclf', name: 'proj' }) : json({ error: 'NotFound' }, 404);
    if (u.host === 'api.tangled.org' && method === 'com.atproto.identity.resolveHandle') return json({ did: 'did:plc:tomas' });
    if (u.host === 'public.api.bsky.app' && method === 'com.atproto.identity.resolveHandle') return json({ did: 'did:plc:tomas' });
    if (u.host === 'api.tangled.org' && method === 'org.tangled.repo.getRepoByName') return json({ uri: 'at://did:plc:tidepool/org.tangled.repo.manifest/self', knot: knotHost, value: {} });
    if (u.host === 'api.tangled.org' && method === 'org.tangled.repo.getRepoByRepoDid') return json({ uri: 'at://did:plc:tidepool/org.tangled.repo.manifest/self', knot: knotHost, value: {} });
    if (u.host === 'api.tangled.org' && method === 'org.tangled.track.getTicketView') return json({ uri: q.get('uri'), cid: 'bafyticketnow', state: 'open', title: { text: 'Sync gives up' } });
    if (u.host === 'knot1.tangled.sh' && method === 'org.tangled.knot.describeKnot') return json({ did: 'did:web:knot1.tangled.sh', capabilities });
    if (u.host === 'knot1.tangled.sh' && method === 'com.atproto.repo.createRecord') {
      const body = JSON.parse(init.body); knot.push({ auth: init.headers.authorization, body });
      return json({ uri: `at://${body.repo}/${body.collection}/4750`, cid: 'bafyonknot', 'x-tngl-change': 'a'.repeat(40) });
    }
    return json({ error: 'NotFound' }, 404);
  };
  return { knot, restore(){ globalThis.fetch = real; } };
}

test('which forges Rainshare can post to, and what a sign-in has to allow for each', () => {
  assert.equal(writableForge(parseSubject('https://knotless.dev/alice.test/proj')), 'knotless');
  assert.equal(writableForge(parseSubject('https://tangled.org/tomas.example/tidepool/issues/27')), 'tangled');
  assert.equal(writableForge(parseSubject('https://github.com/o/r/issues/5')), null);
  assert.equal(writableForge(undefined), null);
  // Only what the writes need, and only to add: nothing is edited or deleted.
  assert.deepEqual(FORGE_SCOPES.knotless, ['repo:dev.knotless.issue?action=create', 'repo:dev.knotless.comment?action=create']);
  assert.deepEqual(FORGE_SCOPES.tangled, ['rpc:com.atproto.repo.createRecord?aud=*', 'repo:org.tangled.graph.attestation?action=create']);
});

test('on knotless, an issue and a comment are records in your own account that name the repo', async () => {
  const net = network(), agent = agentOf();
  try {
    const repo = parseSubject('https://knotless.dev/alice.test/proj');
    const issue = await forgeIssue(agent, repo, { title: 'Dates are read as text', body: 'ISO 8601 dates come through as strings.' });
    const wrote = agent.asked[0];
    assert.equal(wrote.method, 'com.atproto.repo.createRecord');
    assert.deepEqual([wrote.body.repo, wrote.body.collection], [ME, 'dev.knotless.issue']);
    const { createdAt, ...rec } = wrote.body.record;
    assert.deepEqual(rec, { $type: 'dev.knotless.issue', repo: { uri: 'at://did:plc:alice/dev.knotless.repo/proj', key: '3mzcyhybrkclf' }, title: 'Dates are read as text', body: 'ISO 8601 dates come through as strings.' });
    assert.ok(!isNaN(Date.parse(createdAt)));
    // What comes back is a subject a seed can point at, the same as pasting the issue's link would give.
    assert.deepEqual(issue, parseSubject(`https://knotless.dev/alice.test/proj/issue/${ME}/3knew1`));
    // A comment names the repo and the issue.
    const said = await forgeComment(agent, issue, 'I’m having a go at this.');
    const c = agent.asked[1].body;
    assert.equal(c.collection, 'dev.knotless.comment');
    assert.deepEqual([c.record.repo, c.record.subject, c.record.body], [{ uri: 'at://did:plc:alice/dev.knotless.repo/proj', key: '3mzcyhybrkclf' }, `at://${ME}/dev.knotless.issue/3knew1`, 'I’m having a go at this.']);
    assert.equal(said.href, issue.url);
    // A blank body is left out, and a repo knotless doesn't know is refused before anything is written.
    await forgeIssue(agent, repo, { title: 'No body' });
    assert.equal('body' in agent.asked[2].body.record, false);
    await assert.rejects(forgeIssue(agent, parseSubject('https://knotless.dev/alice.test/other'), { title: 't' }), e => e instanceof ForgeError && e.name === 'NoRepo');
    assert.equal(agent.asked.length, 3);
  } finally { net.restore(); }
});

test('on Tangled, your server vouches for you to the repo’s knot, and your own account says it was you', async () => {
  const net = network(), agent = agentOf();
  try {
    const repo = { $type: SEED + '#repo', url: 'https://tangled.org/tomas.example/tidepool', forge: 'tangled', repoDid: 'did:plc:tidepool', name: 'tomas.example/tidepool' };
    const before = Math.floor(Date.now() / 1000);
    const issue = await forgeIssue(agent, repo, { title: 'Retry sync when the network drops', body: 'Three tries would do.' });
    // 1. a token from your own server, for this repo and this one method, good for about a minute
    const [token, attest] = agent.asked;
    assert.deepEqual([token.method, token.verb, token.params.aud, token.params.lxm], ['com.atproto.server.getServiceAuth', 'GET', 'did:plc:tidepool', 'com.atproto.repo.createRecord']);
    assert.ok(+token.params.exp >= before + 59 && +token.params.exp <= before + 62);
    // 2. the write, to the knot, as Tangled's own app sends it
    assert.equal(net.knot[0].auth, 'Bearer a.service.token');
    const { createdAt, ...rec } = net.knot[0].body.record;
    assert.deepEqual([net.knot[0].body.repo, net.knot[0].body.collection], ['did:plc:tidepool', 'org.tangled.track.ticket']);
    assert.deepEqual(rec, { $type: 'org.tangled.track.ticket', title: { $type: 'org.tangled.markup.markdown#inline', text: 'Retry sync when the network drops' }, body: { $type: 'org.tangled.markup.markdown', text: 'Three tries would do.' }, state: 'open' });
    // 3. a record in your own account saying the post was yours, naming the change the knot made
    assert.equal(attest.body.collection, 'org.tangled.graph.attestation');
    assert.deepEqual([attest.body.record.subject, attest.body.record.change], [{ uri: 'at://did:plc:tidepool/org.tangled.track.ticket/4750', cid: 'bafyonknot' }, 'a'.repeat(40)]);
    assert.deepEqual(issue, { $type: SEED + '#tangledIssue', uri: 'at://did:plc:tidepool/org.tangled.track.ticket/4750', cid: 'bafyonknot', repo: 'did:plc:tidepool', repoUrl: 'https://tangled.org/tomas.example/tidepool', url: 'https://tangled.org/tomas.example/tidepool/issues/4750' });
    // A comment names the issue as it is now.
    await forgeComment(agent, issue, 'Asked for a hand with this on Rainshare.');
    const c = net.knot[1].body;
    assert.equal(c.collection, 'org.tangled.feed.comment');
    assert.deepEqual([c.record.subject, c.record.body], [{ $type: 'com.atproto.repo.strongRef', uri: issue.uri, cid: 'bafyticketnow' }, { $type: 'org.tangled.markup.markdown', text: 'Asked for a hand with this on Rainshare.' }]);
    // An empty body is left out, as the knot refuses one.
    await forgeIssue(agent, repo, { title: 'No body', body: '  ' });
    assert.equal('body' in net.knot[2].body.record, false);
  } finally { net.restore(); }
});

test('nothing is posted without your say-so, or where it can’t be', async () => {
  // A sign-in that doesn't allow it is told so by your server, before anything reaches a forge.
  let net = network(); const narrow = agentOf({ refuse: true });
  try {
    await assert.rejects(forgeIssue(narrow, parseSubject('https://knotless.dev/alice.test/proj'), { title: 't' }), e => e.name === 'NotConnected' && e.forge === 'knotless');
    await assert.rejects(forgeComment(narrow, parseSubject('https://tangled.org/tomas.example/tidepool/issues/27'), 'hello'), e => e.name === 'NotConnected' && e.forge === 'tangled');
    assert.equal(net.knot.length, 0);
    // Signed out, the wrong kind of place, or nothing to say.
    await assert.rejects(forgeIssue({ did: null }, parseSubject('https://knotless.dev/alice.test/proj'), { title: 't' }), e => e.name === 'NotSignedIn');
    await assert.rejects(forgeIssue(agentOf(), parseSubject('https://github.com/o/r'), { title: 't' }), e => e.name === 'NoForge');
    await assert.rejects(forgeIssue(agentOf(), parseSubject('https://knotless.dev/alice.test/proj'), { title: ' ' }), e => e.name === 'NoTitle');
    await assert.rejects(forgeComment(agentOf(), parseSubject('https://knotless.dev/alice.test/proj'), 'hello'), e => e.name === 'NoIssue');   // a repo isn't an issue
    await assert.rejects(forgeComment(agentOf(), parseSubject('https://tangled.org/tomas.example/tidepool/issues/27'), '  '), e => e.name === 'Empty');
  } finally { net.restore(); }
  // A repo can say it's hosted anywhere. Somewhere that isn't a public domain name is never sent a thing.
  for (const knotHost of ['localhost:8080', '10.0.0.7', '[::1]', 'knot.example.org:8443', 'evil.example/x', 'knot1.tangled.sh@evil.example']) {
    net = network({ knotHost }); const a = agentOf();
    try {
      await assert.rejects(forgeComment(a, parseSubject('https://tangled.org/tomas.example/tidepool/issues/27'), 'hello'), e => e.name === 'NoRepo', knotHost);
      assert.deepEqual([a.asked.length, net.knot.length], [0, 0], knotHost);
    } finally { net.restore(); }
  }
  // A record can name one issue's page and another issue's address. The comment goes where the page link goes.
  net = network(); const careful = agentOf();
  try {
    await forgeComment(careful, { $type: SEED + '#tangledIssue', url: 'https://tangled.org/tomas.example/tidepool/issues/27', repoUrl: 'https://tangled.org/tomas.example/tidepool', uri: 'at://did:plc:elsewhere/org.tangled.track.ticket/9', repo: 'did:plc:elsewhere' }, 'hello');
    assert.equal(net.knot[0].body.record.subject.uri, 'at://did:plc:tidepool/org.tangled.track.ticket/27');
    assert.equal(net.knot[0].body.repo, 'did:plc:tidepool'); assert.equal(careful.asked[0].params.aud, 'did:plc:tidepool');
  } finally { net.restore(); }
  // A knot that doesn't take posts from apps is left alone, and no token is asked for.
  net = network({ capabilities: ['tangled1.0'] }); const agent = agentOf();
  try {
    await assert.rejects(forgeComment(agent, parseSubject('https://tangled.org/tomas.example/tidepool/issues/27'), 'hello'), e => e.name === 'OldKnot');
    assert.deepEqual([agent.asked.length, net.knot.length], [0, 0]);
  } finally { net.restore(); }
});
