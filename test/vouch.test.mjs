// Tangled's vouch network, read from public records and added to as the signed-in person,
// against a made-up network: a directory of accounts, and each account's own server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORGE_SCOPES } from '../core/ns.js';
import { VOUCH, vouchesBy, circleOf, wordOn, wordText, vouchFor, unvouch, evidenceFor } from '../core/vouch.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const did = n => 'did:plc:' + n;
const ME = did('me');
const rec = (by, about, value) => ({ uri: `at://${by}/${VOUCH}/${about}`, cid: 'bafy' + about.slice(8), value: { $type: VOUCH, createdAt: '2026-11-01T10:00:00Z', ...value } });
/** Who has said what. Each account's records are on its own server, found through the directory. */
function network(said){
  const real = globalThis.fetch, asked = [];
  globalThis.fetch = async input => {
    const u = new URL(String(input)), q = u.searchParams;
    if (u.host === 'plc.directory') return json({ id: decodeURIComponent(u.pathname.slice(1)), service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example' }] });
    if (u.host === 'pds.example' && u.pathname.endsWith('com.atproto.repo.listRecords')) {
      asked.push(q.get('repo'));
      if (q.get('repo') === did('down')) return json({ error: 'InternalServerError' }, 500);
      return json({ records: q.get('collection') === VOUCH ? said[q.get('repo')] || [] : [] });
    }
    // Two pull requests on Tangled: one by Kai, and one by somebody else.
    if (u.host === 'api.tangled.org' && u.pathname.endsWith('org.tangled.track.getTicketView')) return json({ uri: q.get('uri'), cid: 'bafyticketnow', state: 'merged', targetBranch: 'main', author: { did: q.get('uri').endsWith('/4750') ? did('kai') : did('someone-else') } });
    return json({ error: 'NotFound' }, 404);
  };
  return { asked, restore(){ globalThis.fetch = real; } };
}
function agentOf({ refuse } = {}){
  const asked = [];
  return { did: ME, asked, async fetchHandler(path, init = {}){
    asked.push({ method: path.split('/xrpc/')[1], body: JSON.parse(init.body) });
    return refuse ? json({ error: 'ScopeMissingError', message: 'Missing required scope' }, 403) : json({ uri: `at://${ME}/${VOUCH}/x`, cid: 'bafyvouch' });
  } };
}

test('a circle is you and the people you vouched for, read from everyone’s public records', async () => {
  const net = network({
    [ME]: [rec(ME, did('priya'), { kind: 'vouch', reason: 'reviews my patches' }), rec(ME, did('tomas'), {}), rec(ME, did('spam'), { kind: 'denounce', reason: 'slop' }), rec(ME, did('down'), { kind: 'vouch' }),
      rec(ME, ME, { kind: 'vouch' }), { uri: `at://${ME}/${VOUCH}/not-a-did`, cid: 'b', value: { kind: 'vouch' } }, { uri: `at://${did('other')}/${VOUCH}/${did('kai')}`, cid: 'b', value: { kind: 'vouch' } }],
    [did('priya')]: [rec(did('priya'), did('kai'), { kind: 'vouch', reason: 'careful work' }), rec(did('priya'), did('mo'), { kind: 'denounce' }), rec(did('priya'), did('priya'), { kind: 'vouch' })],
    [did('tomas')]: [rec(did('tomas'), did('kai'), { kind: 'vouch' }), rec(did('tomas'), did('mo'), { kind: 'vouch' }), rec(did('tomas'), ME, { kind: 'vouch' })],
    // Someone you denounced has a say about nobody: what they've said is never read.
    [did('spam')]: [rec(did('spam'), did('kai'), { kind: 'denounce', reason: 'lies' })]
  });
  try {
    // One account's word: who it's about is the record's key; a missing kind is a vouch; junk is dropped.
    const mine = await vouchesBy(ME);
    assert.deepEqual([...mine.keys()], [did('priya'), did('tomas'), did('spam'), did('down')]);
    assert.deepEqual(mine.get(did('priya')), { kind: 'vouch', reason: 'reviews my patches', at: '2026-11-01T10:00:00Z', uri: `at://${ME}/${VOUCH}/${did('priya')}`, cid: 'bafypriya' });
    assert.equal(mine.get(did('tomas')).kind, 'vouch');

    net.asked.length = 0;
    const c = await circleOf(ME);
    // Asked: you, and the three you vouched for. Not the one you denounced.
    assert.deepEqual(net.asked.sort(), [did('down'), ME, did('priya'), did('tomas')].sort());
    assert.deepEqual(c.circle.map(x => x.did), [did('priya'), did('tomas')]);
    assert.equal(c.partial, true);                       // one of them couldn't be read, and that's said
    // Your own word comes first.
    assert.deepEqual(wordOn(c, did('priya')), { kind: 'vouch', mine: mine.get(did('priya')), by: [] });
    assert.equal(wordOn(c, did('spam')).kind, 'denounce');
    // Someone you've said nothing about, known to two people you vouch for.
    const kai = wordOn(c, did('kai'));
    assert.deepEqual([kai.kind, kai.mine, kai.by.map(b => [b.did, b.kind, b.reason])], ['vouch', null, [[did('priya'), 'vouch', 'careful work'], [did('tomas'), 'vouch', '']]]);
    assert.equal(wordOn(c, did('mo')).kind, 'mixed');    // your circle disagrees, and both are shown
    assert.equal(wordOn(c, did('nobody')), null);
    assert.equal(wordOn(c, ME).by.length, 1);            // what your circle says about you
    assert.equal(wordOn(null, did('kai')), null);
    const name = d => '@' + d.slice(8);
    assert.equal(wordText(kai, name), '@priya and @tomas, who you vouch for, vouch for them on Tangled.');
    assert.equal(wordText(wordOn(c, did('mo')), name), '@tomas, who you vouch for, vouches for them on Tangled. @priya, who you vouch for, has denounced them on Tangled.');
    assert.equal(wordText(wordOn(c, did('priya')), name), 'You vouch for them on Tangled.');
    assert.equal(wordText(null), '');
    // A long list of vouches doesn't become a long list of requests.
    net.asked.length = 0;
    assert.equal((await circleOf(ME, { reach: 1 })).circle.length, 1);
    assert.equal(net.asked.length, 2);
    // Signed out, there's no circle to speak of, and nothing is asked.
    net.asked.length = 0;
    assert.deepEqual([(await circleOf(null)).circle.length, net.asked.length], [0, 0]);
  } finally { net.restore(); }
});

test('a vouch is a record in your own account, keyed by who it’s about, and can be taken back', async () => {
  const net = network({}), agent = agentOf();
  try {
    const delivery = { uri: `at://${did('kai')}/dev.rainshare.delivery/3kdel`, cid: 'bafydelivery', repo: did('kai'), value: { pull: 'at://did:plc:tidepool/org.tangled.track.ticket/4750' } };
    // What a vouch points at: the pull request on Tangled as it is now (what Tangled itself attaches), and the delivery.
    const evidence = await evidenceFor(delivery);
    assert.deepEqual(evidence, [{ uri: 'at://did:plc:tidepool/org.tangled.track.ticket/4750', cid: 'bafyticketnow' }, { uri: delivery.uri, cid: 'bafydelivery' }]);
    assert.deepEqual(await evidenceFor({ uri: delivery.uri, cid: 'bafydelivery', value: { url: 'https://github.com/o/r/pull/3' } }), [{ uri: delivery.uri, cid: 'bafydelivery' }]);
    // A delivery that points at somebody else's pull request doesn't get it attached.
    assert.deepEqual(await evidenceFor({ ...delivery, value: { pull: 'at://did:plc:tidepool/org.tangled.track.ticket/9999' } }), [{ uri: delivery.uri, cid: 'bafydelivery' }]);
    assert.deepEqual(await evidenceFor({ value: {} }), []);

    const made = await vouchFor(agent, did('kai'), { reason: '  Helped with “Retry sync”\nthrough Rainshare.  ', evidence });
    const { method, body } = agent.asked[0], { createdAt, ...record } = body.record;
    assert.equal(method, 'com.atproto.repo.putRecord');
    assert.deepEqual([body.repo, body.collection, body.rkey], [ME, VOUCH, did('kai')]);
    assert.deepEqual(record, { $type: VOUCH, kind: 'vouch', reason: 'Helped with “Retry sync” through Rainshare.', evidences: evidence });
    assert.ok(!isNaN(Date.parse(createdAt)));
    assert.equal(made.kind, 'vouch');
    // No reason and nothing to point at: the record carries neither.
    await vouchFor(agent, did('priya'));
    assert.deepEqual(Object.keys(agent.asked[1].body.record).sort(), ['$type', 'createdAt', 'kind']);
    // A long reason is cut to what Tangled allows; evidence that isn't a record is dropped.
    await vouchFor(agent, did('priya'), { reason: 'x'.repeat(400), evidence: [{ uri: 'https://example.com', cid: 'b' }, { uri: delivery.uri }, ...Array(12).fill({ uri: delivery.uri, cid: 'bafydelivery' })] });
    assert.equal([...agent.asked[2].body.record.reason].length, 256);
    assert.equal(agent.asked[2].body.record.evidences.length, 10);
    // Rainshare only ever vouches: there's no way to write a denouncement from here.
    assert.ok(agent.asked.every(x => x.method !== 'com.atproto.repo.putRecord' || x.body.record.kind === 'vouch'));
    // Taking it back deletes that one record.
    await unvouch(agent, did('kai'));
    assert.deepEqual(agent.asked[3], { method: 'com.atproto.repo.deleteRecord', body: { repo: ME, collection: VOUCH, rkey: did('kai') } });
    // Not yourself, not a non-person, not signed out.
    await assert.rejects(vouchFor(agent, ME), e => e.name === 'Yourself');
    await assert.rejects(vouchFor(agent, 'kai.example'), e => e.name === 'NoOne');
    await assert.rejects(vouchFor({ did: null }, did('kai')), e => e.name === 'NotSignedIn');
    assert.equal(agent.asked.length, 4);
    // A sign-in that doesn't allow it is told so, the same way a post to Tangled is.
    await assert.rejects(vouchFor(agentOf({ refuse: true }), did('kai')), e => e.name === 'NotConnected' && e.forge === 'tangled');
    assert.ok(FORGE_SCOPES.tangled.includes('repo:' + VOUCH));
  } finally { net.restore(); }
});
