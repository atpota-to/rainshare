// Posting to knotless and Tangled as the signed-in person, against a made-up network shaped
// like the real ones (knotless.dev's API and record definitions; Tangled's API, its knot, and
// what its own web app sends).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED, FORGE_SCOPES } from '../core/ns.js';
import { parseSubject } from '../core/subjects.js';
import { forgeIssue, forgeComment, forgePull, pullChoices, pickSource, pullText, writableForge, ForgeError } from '../core/forgewrite.js';

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
function network({ capabilities = ['knot-social-writes'], knotHost = 'knot1.tangled.sh', refusePatch = false, keepTicket = false, template = '' } = {}){
  const knot = [], bases = [], real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const u = new URL(String(input)), q = u.searchParams, method = u.pathname.split('/xrpc/')[1];
    if (u.host === 'knotless.dev' && method === 'dev.knotless.getRepo') {
      // The repo, by its page's name or its record's address, and your fork of it.
      if (['at://alice.test/dev.knotless.repo/proj', 'at://did:plc:alice/dev.knotless.repo/proj'].includes(q.get('repo'))) return json({ uri: 'at://did:plc:alice/dev.knotless.repo/proj', key: '3mzcyhybrkclf', name: 'proj', defaultBranch: 'main', owner: { did: 'did:plc:alice', handle: 'alice.test' } });
      if (q.get('repo') === `at://${ME}/dev.knotless.repo/proj`) return json({ uri: `at://${ME}/dev.knotless.repo/proj`, key: '3mzfork222222', name: 'proj', defaultBranch: 'main', owner: { did: ME, handle: 'me.test' } });
      return json({ error: 'NotFound' }, 404);
    }
    if (u.host === 'knotless.dev' && method === 'dev.knotless.getCompare') {
      const heads = [{ did: 'did:plc:alice', handle: 'alice.test', name: 'proj' }, { did: 'did:plc:stranger', handle: 'stranger.test', name: 'proj' }, { did: ME, handle: 'me.test', name: 'proj' }];
      if (!q.get('branch')) return json({ heads });
      if (q.get('branch') === 'gone') return json({ error: 'NotFound', message: 'git rev-parse: fatal: Needed a single revision' }, 404);
      return json({ heads, changes: { commits: q.get('branch') === 'stale' ? [] : [{ sha: 'c'.repeat(40) }], files: [], head: 'c'.repeat(40) } });
    }
    if (u.host === 'knotless.dev' && method === 'dev.knotless.listBranches') return json({ branches: q.get('repo').includes(ME) ? [{ name: 'main' }, { name: 'iso-dates' }] : [{ name: 'main' }, { name: 'release' }, { name: 'bad name' }] });
    if (u.host === 'knotless.dev' && method === 'dev.knotless.getTemplate') return json(template ? { template } : {});
    if (u.host === 'api.tangled.org' && method === 'com.atproto.identity.resolveHandle') return json({ did: 'did:plc:tomas' });
    if (u.host === 'public.api.bsky.app' && method === 'com.atproto.identity.resolveHandle') return json({ did: 'did:plc:tomas' });
    if (u.host === 'api.tangled.org' && method === 'org.tangled.repo.getRepoByName') return json({ uri: 'at://did:plc:tidepool/org.tangled.repo.manifest/self', knot: knotHost, value: {} });
    if (u.host === 'api.tangled.org' && method === 'org.tangled.repo.getRepoByRepoDid') return json({ uri: 'at://did:plc:tidepool/org.tangled.repo.manifest/self', knot: knotHost, defaultBranch: 'main', value: {} });
    // Git, as Tangled's public index reads it: the repo's branches and your fork's, where each is, and where two part.
    if (u.host === 'api.tangled.org' && method === 'org.tangled.repo.listRepos') return json({ items: [
      { uri: 'at://did:plc:myfork/org.tangled.repo.manifest/self', value: { declaration: { name: 'tidepool', owner: ME }, source: { did: 'did:plc:tidepool' } } },
      { uri: 'at://did:plc:mine/org.tangled.repo.manifest/self', value: { declaration: { name: 'something-else', owner: ME } } }] });
    if (u.host === 'api.tangled.org' && method === 'org.tangled.temp.git.listBranches') return json({ branches: q.get('repo') === 'did:plc:myfork'
      ? [{ name: 'main', oid: 'a'.repeat(40), committer: { when: '2026-11-01T10:00:00Z' } }, { name: 'retry-sync', oid: 'b'.repeat(40), committer: { when: '2026-11-11T10:00:00Z' } }]
      : [{ name: 'dev', oid: 'd'.repeat(40), committer: { when: '2026-11-10T10:00:00Z' } }, { name: 'main', oid: 'a'.repeat(40), committer: { when: '2026-11-01T10:00:00Z' } }] });
    if (u.host === 'api.tangled.org' && method === 'org.tangled.temp.git.getRef') {
      const oid = { 'did:plc:tidepool refs/heads/main': 'a'.repeat(40), 'did:plc:tidepool refs/heads/dev': 'd'.repeat(40), 'did:plc:myfork refs/heads/retry-sync': 'b'.repeat(40), 'did:plc:myfork refs/heads/main': 'a'.repeat(40), 'did:plc:myfork refs/heads/behind': 'e'.repeat(40) }[q.get('repo') + ' ' + q.get('ref')];
      return oid ? json({ name: q.get('ref'), oid }) : json({ error: 'RefNotFound', message: 'revision not found' }, 404);
    }
    if (u.host === 'api.tangled.org' && method === 'org.tangled.temp.git.getMergeBase') { bases.push({ repos: q.getAll('repos'), base: q.get('base'), head: q.get('head') }); return json({ commit: q.get('head') === 'e'.repeat(40) ? 'e'.repeat(40) : 'f'.repeat(40) }); }
    if (u.host === 'api.tangled.org' && method === 'org.tangled.track.getTicketView') return json({ uri: q.get('uri'), cid: 'bafyticketnow', state: 'open', title: { text: 'Sync gives up' } });
    if (u.host === 'knot1.tangled.sh' && method === 'org.tangled.knot.describeKnot') return json({ did: 'did:web:knot1.tangled.sh', capabilities });
    if (u.host === 'knot1.tangled.sh' && method === 'com.atproto.repo.createRecord') {
      const body = JSON.parse(init.body); knot.push({ auth: init.headers.authorization, body });
      return json({ uri: `at://${body.repo}/${body.collection}/4750`, cid: 'bafyonknot', 'x-tngl-change': 'a'.repeat(40) });
    }
    if (u.host === 'knot1.tangled.sh' && method === 'org.tangled.review.submitPatch') {
      const body = JSON.parse(init.body); knot.push({ auth: init.headers.authorization, method, body });
      return refusePatch ? json({ error: 'InvalidRequest', message: 'head is not reachable from the source repository' }, 400) : json({ uri: `at://${body.repo}/org.tangled.review.patch/bafypatch`, cid: 'bafypatch', 'x-tngl-change': 'b'.repeat(40) });
    }
    if (u.host === 'knot1.tangled.sh' && method === 'com.atproto.repo.deleteRecord') {
      const body = JSON.parse(init.body); knot.push({ auth: init.headers.authorization, method, body });
      return keepTicket ? json({ error: 'Forbidden' }, 403) : json({});
    }
    return json({ error: 'NotFound' }, 404);
  };
  return { knot, bases, restore(){ globalThis.fetch = real; } };
}

test('which forges Rainshare can post to, and what a sign-in has to allow for each', () => {
  assert.equal(writableForge(parseSubject('https://knotless.dev/alice.test/proj')), 'knotless');
  assert.equal(writableForge(parseSubject('https://tangled.org/tomas.example/tidepool/issues/27')), 'tangled');
  assert.equal(writableForge(parseSubject('https://github.com/o/r/issues/5')), null);
  assert.equal(writableForge(undefined), null);
  // On knotless, only what the writes need, and only to add: nothing of yours is edited or deleted.
  assert.deepEqual(FORGE_SCOPES.knotless, ['repo:dev.knotless.issue?action=create', 'repo:dev.knotless.comment?action=create', 'repo:dev.knotless.pull?action=create']);
  // On Tangled, three calls your server can say are yours (a record on the repo's host, a pull
  // request's changes, and taking a refused pull request back), the record that says a post
  // was yours, and your vouches, which are yours to give and to take back.
  assert.deepEqual(FORGE_SCOPES.tangled, ['rpc:com.atproto.repo.createRecord?aud=*', 'rpc:org.tangled.review.submitPatch?aud=*', 'rpc:com.atproto.repo.deleteRecord?aud=*', 'repo:org.tangled.graph.attestation?action=create', 'repo:org.tangled.graph.vouch']);
  // Each names one method or one kind of record: never every method, and never every record.
  for (const sc of Object.values(FORGE_SCOPES).flat()) assert.match(sc, /^(rpc|repo):[a-z]+(\.[A-Za-z]+){2,}(\?|$)/, sc);
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

test('a pull request on knotless is a record in your own account that names the repo, the branch and where it goes', async () => {
  const net = network(), agent = agentOf();
  try {
    const repo = parseSubject('https://knotless.dev/alice.test/proj');
    // What the form offers: the repo itself and your own fork of it (nobody else's), each with its branches.
    const ch = await pullChoices(repo, { viewer: ME });
    assert.deepEqual([ch.forge, ch.base, ch.bases], ['knotless', 'main', ['main', 'release']]);
    assert.deepEqual(ch.sources.map(x => [x.id, x.label, x.fork, x.branches]), [
      ['at://did:plc:alice/dev.knotless.repo/proj', 'alice.test/proj', false, ['release', 'main']],
      [`at://${ME}/dev.knotless.repo/proj`, 'me.test/proj', true, ['main', 'iso-dates']]]);
    // A branch is looked for on your fork first; a repo can be named any of the ways an agent might write it.
    assert.equal(pickSource(ch, { branch: 'iso-dates' }).label, 'me.test/proj');
    assert.equal(pickSource(ch, { branch: 'release' }).label, 'alice.test/proj');
    for (const from of ['knotless://me.test/proj', 'https://knotless.dev/me.test/proj', 'me.test/proj', `at://${ME}/dev.knotless.repo/proj`]) assert.equal(pickSource(ch, { from, branch: 'release' }).fork, true, from);
    assert.equal(pickSource(ch, {}).fork, true);

    const pr = await forgePull(agent, repo, { title: 'Read ISO 8601 dates', body: 'Fixes https://knotless.dev/alice.test/proj/issue/did:plc:alice/3kissue', branch: 'iso-dates', from: `at://${ME}/dev.knotless.repo/proj` });
    assert.equal(agent.asked.length, 1);
    const wrote = agent.asked[0].body, { createdAt, ...rec } = wrote.record;
    assert.deepEqual([wrote.repo, wrote.collection], [ME, 'dev.knotless.pull']);
    assert.deepEqual(rec, {
      $type: 'dev.knotless.pull', repo: { uri: 'at://did:plc:alice/dev.knotless.repo/proj', key: '3mzcyhybrkclf' }, base: 'main',
      head: { repo: { uri: `at://${ME}/dev.knotless.repo/proj`, key: '3mzfork222222' }, branch: 'iso-dates' },
      title: 'Read ISO 8601 dates', body: 'Fixes https://knotless.dev/alice.test/proj/issue/did:plc:alice/3kissue'
    });
    assert.ok(!isNaN(Date.parse(createdAt)));
    // What comes back is the pull's record and its page, which is what gets turned in.
    assert.deepEqual(pr, { uri: `at://${ME}/dev.knotless.pull/3knew1`, url: `https://knotless.dev/alice.test/proj/pull/${ME}/3knew1` });
    // From a branch on the repo itself, into a branch that's named.
    await forgePull(agent, repo, { title: 'Cut the release', branch: 'release', base: 'main' });
    assert.deepEqual(agent.asked[1].body.record.head, { repo: { uri: 'at://did:plc:alice/dev.knotless.repo/proj', key: '3mzcyhybrkclf' }, branch: 'release' });
    assert.equal('body' in agent.asked[1].body.record, false);
    // A branch that isn't there, or that brings nothing, is said so before anything is written.
    await assert.rejects(forgePull(agent, repo, { title: 't', branch: 'gone' }), e => e.name === 'NoBranch' && /pushed/.test(e.message));
    await assert.rejects(forgePull(agent, repo, { title: 't', branch: 'stale' }), e => e.name === 'NothingNew');
    await assert.rejects(forgePull(agent, repo, { title: 't', branch: 'x', from: 'at://did:plc:nobody/dev.knotless.repo/proj' }), e => e.name === 'NoRepo');
    assert.equal(agent.asked.length, 2);
  } finally { net.restore(); }
  // A repo that asks its pulls to follow a template gets one that does.
  const strict = network({ template: '## Why\n\n<!-- what this is for -->\n\n## What changed\n' }), a = agentOf();
  try {
    const repo = parseSubject('https://knotless.dev/alice.test/proj');
    assert.match((await pullChoices(repo, { viewer: ME })).template, /^## Why/);
    await assert.rejects(forgePull(a, repo, { title: 't', body: 'Just this.', branch: 'iso-dates' }), e => e.name === 'Template');
    await forgePull(a, repo, { title: 't', body: '## why\n\nDates were read as text.', branch: 'iso-dates' });
    assert.equal(a.asked.length, 1);
  } finally { strict.restore(); }
});

test('a pull request on Tangled is a ticket on the repo’s knot and then its changes, each said to be yours', async () => {
  const net = network(), agent = agentOf();
  try {
    const issue = parseSubject('https://tangled.org/tomas.example/tidepool/issues/27');
    const ch = await pullChoices(issue, { viewer: ME });
    assert.deepEqual([ch.forge, ch.base, ch.bases], ['tangled', 'main', ['main', 'dev']]);
    // The repo's own branches with the one to merge into last, then your fork's with the newest first.
    assert.deepEqual(ch.sources.map(x => [x.id, x.label, x.page, x.fork, x.branches]), [
      ['did:plc:tidepool', 'tomas.example/tidepool', 'https://tangled.org/tomas.example/tidepool', false, ['dev', 'main']],
      ['did:plc:myfork', `${ME}/tidepool`, `https://tangled.org/${ME}/tidepool`, true, ['retry-sync', 'main']]]);
    assert.equal(pickSource(ch, { branch: 'retry-sync' }).id, 'did:plc:myfork');
    assert.equal(pickSource(ch, { from: 'did:plc:tidepool', branch: 'retry-sync' }).id, 'did:plc:tidepool');

    const pr = await forgePull(agent, issue, { title: 'Retry sync when the network drops', body: 'Fixes https://tangled.org/tomas.example/tidepool/issues/27', branch: 'retry-sync', from: 'did:plc:myfork' });
    // Where the branch left main is asked of both repos, by the two commits.
    assert.deepEqual(net.bases, [{ repos: ['did:plc:myfork', 'did:plc:tidepool'], base: 'a'.repeat(40), head: 'b'.repeat(40) }]);
    // 1. the ticket: an issue's shape, with the branch it merges into
    const [ticket, patch] = net.knot, { createdAt, ...rec } = ticket.body.record;
    assert.deepEqual([ticket.body.repo, ticket.body.collection], ['did:plc:tidepool', 'org.tangled.track.ticket']);
    assert.deepEqual(rec, { $type: 'org.tangled.track.ticket', title: { $type: 'org.tangled.markup.markdown#inline', text: 'Retry sync when the network drops' }, body: { $type: 'org.tangled.markup.markdown', text: 'Fixes https://tangled.org/tomas.example/tidepool/issues/27' }, state: 'open', targetBranch: 'main' });
    // 2. its changes: the ticket, the two commits, and where the knot fetches them from
    assert.equal(patch.method, 'org.tangled.review.submitPatch');
    assert.deepEqual(patch.body, { repo: 'did:plc:tidepool', patch: { ticket: '4750', base: { oid: 'f'.repeat(40) }, head: { oid: 'b'.repeat(40) }, sourceRepo: 'did:plc:myfork', sourceBranch: 'retry-sync' } });
    // Your server is asked for a token for each call, by name, and for a record saying each was yours.
    assert.deepEqual(agent.asked.map(x => x.params.lxm || x.body?.collection), ['com.atproto.repo.createRecord', 'org.tangled.graph.attestation', 'org.tangled.review.submitPatch', 'org.tangled.graph.attestation']);
    assert.deepEqual(agent.asked.filter(x => x.params.lxm).map(x => x.params.aud), ['did:plc:tidepool', 'did:plc:tidepool']);
    assert.deepEqual(agent.asked[3].body.record.subject, { uri: 'at://did:plc:tidepool/org.tangled.review.patch/bafypatch', cid: 'bafypatch' });
    assert.deepEqual(pr, { uri: 'at://did:plc:tidepool/org.tangled.track.ticket/4750', url: 'https://tangled.org/tomas.example/tidepool/pulls/4750', attested: true });

    // From a branch on the repo itself, only that repo is asked about.
    await forgePull(agent, issue, { title: 'Dev into main', branch: 'dev' });
    assert.deepEqual(net.bases[1].repos, ['did:plc:tidepool']);
    assert.equal(net.knot[3].body.patch.sourceRepo, 'did:plc:tidepool');
    // Nothing is opened for a branch that isn't there, or that brings nothing new.
    const before = net.knot.length;
    await assert.rejects(forgePull(agent, issue, { title: 't', branch: 'nope', from: 'did:plc:myfork' }), e => e.name === 'NoBranch' && /pushed/.test(e.message));
    await assert.rejects(forgePull(agent, issue, { title: 't', branch: 'main', from: 'did:plc:myfork' }), e => e.name === 'NothingNew');
    await assert.rejects(forgePull(agent, issue, { title: 't', branch: 'behind', from: 'did:plc:myfork' }), e => e.name === 'NothingNew');
    await assert.rejects(forgePull(agent, issue, { title: 't', branch: 'retry-sync', base: 'gone', from: 'did:plc:myfork' }), e => e.name === 'NoBranch');
    await assert.rejects(forgePull(agent, issue, { title: 't', branch: 'retry-sync', from: 'https://evil.example' }), e => e.name === 'NoRepo');
    for (const branch of ['', '  ', '$(reboot)', 'a b', '../x', '-rf', 'x;y']) await assert.rejects(forgePull(agent, issue, { title: 't', branch }), e => e.name === 'NoBranch', branch);
    await assert.rejects(forgePull(agent, issue, { title: ' ', branch: 'retry-sync' }), e => e.name === 'NoTitle');
    await assert.rejects(forgePull(agent, parseSubject('https://github.com/o/r'), { title: 't', branch: 'x' }), e => e.name === 'NoForge');
    assert.equal(net.knot.length, before);
  } finally { net.restore(); }
});

test('a pull request whose changes Tangled refuses is taken back, not left on someone’s repo', async () => {
  const issue = parseSubject('https://tangled.org/tomas.example/tidepool/issues/27');
  let net = network({ refusePatch: true }), agent = agentOf();
  try {
    await assert.rejects(forgePull(agent, issue, { title: 'Retry sync', branch: 'retry-sync', from: 'did:plc:myfork' }), e => e.name === 'PatchRefused' && /head is not reachable/.test(e.message) && !/pulls\/4750/.test(e.message));
    assert.deepEqual(net.knot.map(x => x.method || 'createRecord'), ['createRecord', 'org.tangled.review.submitPatch', 'com.atproto.repo.deleteRecord']);
    // Taken back by its key, and only if it's still the one that was just written.
    assert.deepEqual(net.knot[2].body, { repo: 'did:plc:tidepool', collection: 'org.tangled.track.ticket', rkey: '4750', swapRecord: 'bafyonknot' });
    assert.equal(agent.asked.filter(x => x.params.lxm).pop().params.lxm, 'com.atproto.repo.deleteRecord');
  } finally { net.restore(); }
  // If it can't be taken back either, the person is told where it is.
  net = network({ refusePatch: true, keepTicket: true }); agent = agentOf();
  try {
    await assert.rejects(forgePull(agent, issue, { title: 'Retry sync', branch: 'retry-sync', from: 'did:plc:myfork' }), e => e.name === 'PatchRefused' && /https:\/\/tangled\.org\/tomas\.example\/tidepool\/pulls\/4750/.test(e.message));
  } finally { net.restore(); }
});

test('a description to start a pull request from', () => {
  assert.equal(pullText({ issue: 'https://knotless.dev/a/b/issue/did:plc:a/3k', page: 'https://rainshare.dev/seed/alice.test/3k', asker: '@alice.test', model: 'Opus' }),
    'Fixes https://knotless.dev/a/b/issue/did:plc:a/3k\n\nThis came through Rainshare, where @alice.test asked for help with it: https://rainshare.dev/seed/alice.test/3k\nDone with Opus.');
  assert.equal(pullText({ template: '## Why\n', page: 'https://rainshare.dev/seed/a/3k' }), '## Why\n\nThis came through Rainshare, where someone asked for help with it: https://rainshare.dev/seed/a/3k');
  assert.equal(pullText(), 'This came through Rainshare.');
});

test('sign-in asks for the forges up front, and for less only if a server refuses', async () => {
  const { ladder, DECLARED_SCOPE, BASIC_SCOPE, OWN, forgesIn, clientMetadata } = await import('../src/scope.js');
  const steps = ladder(), forge = Object.values(FORGE_SCOPES).flat(), tokens = s => s.split(' ');
  // The first thing asked for is everything: Rainshare's own records, by its permission set,
  // and both forges.
  assert.ok(tokens(steps[0]).includes(OWN.set));
  for (const sc of forge) assert.ok(tokens(steps[0]).includes(sc), sc);
  assert.deepEqual(forgesIn(steps[0]), ['knotless', 'tangled']);
  // A server that can't look the set up is asked for the same again, with the records by name,
  // before anything is left out.
  assert.equal(steps[1], steps[0].replace(OWN.set, OWN.named));
  assert.deepEqual(forgesIn(steps[1]), ['knotless', 'tangled']);
  for (let i = 0; i < steps.length; i += 2) {
    assert.ok(tokens(steps[i]).includes(OWN.set) && !tokens(steps[i]).some(t => t.startsWith('repo:dev.rainshare.')), steps[i]);
    assert.equal(steps[i + 1], steps[i].replace(OWN.set, OWN.named));
  }
  assert.equal(DECLARED_SCOPE, [...new Set(steps.flatMap(tokens))].join(' '));
  // The last is what any server grants: Rainshare alone, with nothing of the forges in it.
  assert.equal(steps.at(-1), BASIC_SCOPE);
  assert.ok(steps.length >= 2 && !tokens(steps.at(-1)).some(t => forge.includes(t)));
  assert.deepEqual(forgesIn(steps.at(-1)), []);
  // A hosted client can only ask for what its document declares, so every step is inside it.
  const declared = new Set(tokens(clientMetadata('https://rainshare.dev').scope));
  for (const step of steps) for (const t of tokens(step)) assert.ok(declared.has(t), t);
  // Adding one forge to a narrower sign-in asks for that one.
  assert.deepEqual(forgesIn(ladder(['knotless'])[0]), ['knotless']);
  // A forge counts as connected only when everything it needs was granted: a sign-in from
  // before pull requests, with issues and comments alone, is offered the rest.
  assert.deepEqual(forgesIn(BASIC_SCOPE + ' repo:dev.knotless.issue?action=create repo:dev.knotless.comment?action=create'), []);
  assert.deepEqual(forgesIn(BASIC_SCOPE + ' rpc:com.atproto.repo.createRecord?aud=* repo:org.tangled.graph.attestation?action=create'), []);
  assert.deepEqual(forgesIn(undefined), []);
});
