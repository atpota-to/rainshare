// How you and others are connected (core/ties.js): follows on Tangled read from public
// records, who you follow on Bluesky that follows them, and how it's all said and filtered,
// against a made-up network: a directory of accounts, their servers, and Bluesky's AppView.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOLLOW, tangledFollowsOf, followsOnTangled, knownFollowers, tieOf, tieLines, knownText, fromMatches, FROM_KEYS } from '../core/ties.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const did = n => 'did:plc:' + n;
const ME = did('me');
const follow = (by, of) => ({ uri: `at://${by}/${FOLLOW}/${of}`, cid: 'bafy' + of.slice(8), value: { $type: FOLLOW, createdAt: '2026-11-01T10:00:00Z' } });
/** `tangled`: each account's follow records. `bsky`: [follower, followed] pairs. */
function network({ tangled = {}, bsky = [] }){
  const real = globalThis.fetch, asked = [];
  globalThis.fetch = async input => {
    const u = new URL(String(input)), q = u.searchParams, m = u.pathname.replace('/xrpc/', '');
    if (u.host === 'plc.directory') return json({ id: decodeURIComponent(u.pathname.slice(1)), service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example' }] });
    if (u.host === 'pds.example') {
      asked.push(m + ' ' + q.get('repo'));
      if (q.get('repo') === did('down')) return json({ error: 'InternalServerError' }, 500);
      const recs = q.get('collection') === FOLLOW ? tangled[q.get('repo')] || [] : [];
      if (m === 'com.atproto.repo.listRecords') return json({ records: recs });
      if (m === 'com.atproto.repo.getRecord') { const r = recs.find(x => x.uri.endsWith('/' + q.get('rkey'))); return r ? json(r) : json({ error: 'RecordNotFound' }, 400); }
    }
    if (m === 'app.bsky.graph.getRelationships') {
      asked.push(m);
      const actor = q.get('actor');
      return json({ relationships: q.getAll('others').map(o => ({ did: o, ...(bsky.some(([a, b]) => a === actor && b === o) ? { following: 'at://x' } : {}), ...(bsky.some(([a, b]) => a === o && b === actor) ? { followedBy: 'at://y' } : {}) })) });
    }
    return json({ error: 'NotFound' }, 404);
  };
  return { asked, restore(){ globalThis.fetch = real; } };
}

test('Tangled follows are read from the keys of public records, and junk is left out', async () => {
  const net = network({ tangled: {
    [ME]: [follow(ME, did('kai')), follow(ME, did('priya')), follow(ME, ME), { uri: `at://${ME}/${FOLLOW}/3lkr3chqrby22`, cid: 'b', value: { subject: did('old') } }, { uri: `at://${did('other')}/${FOLLOW}/${did('mo')}`, cid: 'b', value: {} }],
    [did('kai')]: [follow(did('kai'), ME)]
  } });
  try {
    // Who it's about is the key: not yourself, not a key that isn't a DID, not a record that says it's someone else's.
    assert.deepEqual([...await tangledFollowsOf(ME)], [did('kai'), did('priya')]);
    // Whether someone follows you is one read of their record about you.
    net.asked.length = 0;
    assert.equal(await followsOnTangled(did('kai'), ME), true);
    assert.deepEqual(net.asked, ['com.atproto.repo.getRecord ' + did('kai')]);
    assert.equal(await followsOnTangled(did('priya'), ME), false);
    assert.equal(await followsOnTangled(ME, ME), false);
    // A server that doesn't answer isn't taken as "no".
    await assert.rejects(followsOnTangled(did('down'), ME));
  } finally { net.restore(); }
});

test('who you follow on Bluesky that follows them, in the order you followed them', async () => {
  const mine = [did('kai'), did('priya'), did('sam'), did('juniper')];
  const net = network({ bsky: [[did('priya'), did('amara')], [did('juniper'), did('amara')], [did('amara'), did('kai')]] });
  try {
    assert.deepEqual(await knownFollowers(did('amara'), mine), [did('priya'), did('juniper')]);
    // They're never counted as following themselves.
    assert.deepEqual(await knownFollowers(did('kai'), mine), []);
    // Asked 30 at a time: 70 people you follow is three calls.
    net.asked.length = 0;
    await knownFollowers(did('amara'), Array.from({ length: 70 }, (_, i) => did('p' + i)));
    assert.equal(net.asked.filter(a => a === 'app.bsky.graph.getRelationships').length, 3);
  } finally { net.restore(); }
  // Told whose follows they are, the ones who follow that person back are named first.
  const net2 = network({ bsky: [[did('priya'), did('amara')], [did('sam'), did('amara')], [did('juniper'), did('amara')], [did('juniper'), ME]] });
  try { assert.deepEqual(await knownFollowers(did('amara'), mine, { viewer: ME }), [did('juniper'), did('priya'), did('sam')]); } finally { net2.restore(); }
});

// Ties from words: 'you' (you follow them), 'them' (they follow you), both, '' (neither), or null (couldn't be read).
const side = x => x == null ? null : { following: x.includes('you'), followedBy: x.includes('them') };
const T = (bsky, tangled) => ({ bsky: side(bsky), tangled: side(tangled) });

test('a tie across Bluesky and Tangled: a follow on either counts', () => {
  assert.equal(tieOf(T('you them', '')), 'mutual');
  assert.equal(tieOf(T('you', 'them')), 'mutual');
  assert.equal(tieOf(T('', 'them')), 'follows-you');
  assert.equal(tieOf(T('you', null)), 'you-follow');
  assert.equal(tieOf(T('', '')), null);
  assert.equal(tieOf(null), null);
  // Tangled's half that didn't answer is just unknown.
  assert.equal(tieOf({ bsky: null, tangled: { following: true, followedBy: null } }), 'you-follow');
});

test('ties said plainly, one sentence per way you’re connected', () => {
  assert.deepEqual(tieLines(T('you them', 'you them'), 'Priya'), ['You follow each other on Bluesky and Tangled.']);
  assert.deepEqual(tieLines(T('them', 'you them'), 'Tomás'), ['You follow each other on Tangled.', 'Tomás follows you on Bluesky.']);
  assert.deepEqual(tieLines(T('you them', 'you'), 'Kai'), ['You follow each other on Bluesky.', 'You follow Kai on Tangled.']);
  // Nothing either way is said once; a network with nothing isn't mentioned beside one with something.
  assert.deepEqual(tieLines(T('', ''), 'Amara'), ['You don’t follow each other on Bluesky or Tangled.']);
  assert.deepEqual(tieLines(T('them', ''), 'Sam'), ['Sam follows you on Bluesky.']);
  // What couldn't be read says nothing.
  assert.deepEqual(tieLines(T(null, ''), 'Mo'), ['You don’t follow each other on Tangled.']);
  assert.deepEqual(tieLines(null, 'Mo'), []);
});

test('who you follow that follows them, said plainly', () => {
  const p = n => ({ displayName: n });
  assert.equal(knownText({ people: [p('Kai Nakamura')], count: 1 }, 'Amara'), 'Followed by Kai Nakamura, who you follow on Bluesky.');
  assert.equal(knownText({ people: [p('Kai'), p('Priya')], count: 2 }, 'Amara'), 'Followed by Kai and Priya, who you follow on Bluesky.');
  assert.equal(knownText({ people: [p('Kai'), p('Priya'), p('Sam')], count: 3 }, 'Amara'), 'Followed by Kai, Priya and 1 other you follow on Bluesky.');
  assert.equal(knownText({ people: [p('Kai'), p('Priya')], count: 12 }, 'Amara'), 'Followed by Kai, Priya and 10 others you follow on Bluesky.');
  assert.equal(knownText({ people: [{ handle: 'kai.test' }], count: 1, partial: true }, 'Amara'), 'Followed by @kai.test, who you follow on Bluesky. There may be more.');
  assert.equal(knownText({ people: [], count: 4 }, 'Amara'), 'Followed by 4 people you follow on Bluesky.');
  assert.equal(knownText({ people: [], count: 0 }, 'Amara'), 'Nobody you follow on Bluesky follows Amara.');
  // Only part of your follows were checked, so "nobody" can't be said.
  assert.equal(knownText({ people: [], count: 0, partial: true }, 'Amara'), '');
  assert.equal(knownText(null, 'Amara'), '');
});

test('narrowing the board to who asked', () => {
  const vouch = { kind: 'vouch' };
  assert.deepEqual(FROM_KEYS, ['anyone', 'mutuals', 'following', 'followers', 'vouched']);
  const who = { mutual: T('you them', ''), crossed: T('you', 'them'), fan: T('them', ''), followed: T('', 'you'), stranger: T('', ''), unknown: null };
  const keep = from => Object.keys(who).filter(k => fromMatches(from, who[k], null));
  assert.deepEqual(keep('anyone'), Object.keys(who));
  assert.deepEqual(keep('mutuals'), ['mutual', 'crossed']);
  assert.deepEqual(keep('following'), ['mutual', 'crossed', 'followed']);
  assert.deepEqual(keep('followers'), ['mutual', 'crossed', 'fan']);
  // Vouched for: a vouch from your circle, whatever the follows say. Mixed word or a denouncement doesn't count.
  assert.equal(fromMatches('vouched', null, vouch), true);
  assert.equal(fromMatches('vouched', who.mutual, { kind: 'mixed' }), false);
  assert.equal(fromMatches('vouched', who.mutual, { kind: 'denounce' }), false);
  assert.equal(fromMatches('vouched', who.mutual, null), false);
  assert.equal(fromMatches('nonsense', who.mutual, vouch), false);
});

test('beside a name, a follow on Tangled counts as much as one on Bluesky', async () => {
  const { relationText } = await import('../core/words.js');
  const seed = audience => ({ repo: did('tomas'), value: { audience: { $type: `dev.rainshare.seed#${audience}` } } });
  assert.equal(relationText({ ...seed('following'), closeness: 'follows-you', ties: T('them', 'you them') }, ME), 'mutual');
  assert.equal(relationText({ ...seed('anyone'), closeness: null, ties: T('', 'them') }, ME), 'follows you');
  assert.equal(relationText({ ...seed('anyone'), closeness: null, ties: T('', '') }, ME), 'open to everyone');
  // Without ties (an older source, or a network that didn't answer), Bluesky's word stands.
  assert.equal(relationText({ ...seed('mutuals'), closeness: 'mutual' }, ME), 'mutual');
});
