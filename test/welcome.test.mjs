// The welcome (../ui/welcome.js): who it's for, what it saves, and the one thing it has to be
// sure of first, that someone really has no profile (and not that their server didn't answer).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldWelcome, welcomeProfile } from '../ui/welcome.js';
import * as R from '../core/records.js';
import { createSource } from '../core/source.js';

// This browser's storage, for the welcome's "seen it" (Node has none of its own).
const kept = new Map();
globalThis.localStorage = { getItem: k => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)), removeItem: k => kept.delete(k) };

test('the welcome is for someone signed in whose server says they have no profile, once', () => {
  kept.clear();
  const source = { signedIn: true, viewer: 'did:plc:newcomer1' }, none = { merged: null, unread: false };
  assert.equal(shouldWelcome({ source, mine: none, sub: '' }), true);
  assert.equal(shouldWelcome({ source, mine: none, sub: 'seed/did:plc:x/3kabc' }), true, 'over whatever page they came back to');
  assert.equal(shouldWelcome({ source, mine: { merged: { plans: ['claude'] } } }), false, 'they have a profile');
  assert.equal(shouldWelcome({ source, mine: { merged: null, unread: true } }), false, 'their server didn’t answer: they may well have one');
  assert.equal(shouldWelcome({ source, mine: null }), false, 'not read yet');
  assert.equal(shouldWelcome({ source, mine: none, sub: 'me' }), false, 'already on their profile');
  assert.equal(shouldWelcome({ source: { ...source, demo: true }, mine: none }), false, 'the example circle');
  assert.equal(shouldWelcome({ source: { signedIn: false, viewer: null }, mine: none }), false, 'signed out');
  assert.equal(shouldWelcome({ source: null, mine: none }), false);
  // Once it's been seen (skipped, closed or saved) on this browser, it's not shown to them again. Someone else still gets it.
  localStorage.setItem('rs:welcomed:did:plc:newcomer1', '1');
  assert.equal(shouldWelcome({ source, mine: none }), false);
  assert.equal(shouldWelcome({ source: { signedIn: true, viewer: 'did:plc:newcomer2' }, mine: none }), true);
  // Storage that can't be read (private windows, blocked site data) still lets it show.
  const was = globalThis.localStorage;
  globalThis.localStorage = { getItem(){ throw new Error('blocked'); } };
  try { assert.equal(shouldWelcome({ source, mine: none }), true); } finally { globalThis.localStorage = was; }
});

test('the welcome saves a profile with the plans picked and a setup for each thing they run', () => {
  assert.deepEqual(welcomeProfile({ plans: ['claude', 'cursor'], runs: ['claude-code', 'codex'] }), {
    plans: ['claude', 'cursor'], setups: [{ harness: 'claude-code', models: [] }, { harness: 'codex', models: [] }]
  });
  // As the record it becomes: the same two things, and nothing it wasn't told.
  const rec = R.profile(welcomeProfile({ plans: ['chatgpt'], runs: ['opencode'] }));
  assert.deepEqual(rec.plans, ['chatgpt']);
  assert.deepEqual(rec.setups, [{ harness: 'opencode' }]);
  for (const k of ['displayName', 'bio', 'offering', 'budget', 'forecast']) assert.equal(rec[k], undefined, k);
  // Only a plan, or only what they run, is a profile too.
  assert.deepEqual(R.profile(welcomeProfile({ plans: ['none'] })).plans, ['none']);
  assert.equal(R.profile(welcomeProfile({ plans: ['none'] })).setups, undefined);
  assert.deepEqual(R.profile(welcomeProfile({ runs: ['aider'] })).setups, [{ harness: 'aider' }]);
  // It doesn't hold on to what it was handed.
  const picked = { plans: ['gemini'], runs: [] }, p = welcomeProfile(picked);
  picked.plans.push('zai');
  assert.deepEqual(p.plans, ['gemini']);
});

test('a profile that isn’t there and one that couldn’t be read are told apart', async () => {
  const DID = 'did:plc:welcomeread1', PDS = 'https://pds.welcome.test';
  let answer = 'missing';
  const real = globalThis.fetch;
  globalThis.fetch = async input => {
    const u = new URL(String(input)), method = u.pathname.split('/xrpc/')[1];
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (u.host === 'plc.directory') return json({ id: DID, alsoKnownAs: ['at://newcomer.example'], service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }] });
    if (method === 'app.bsky.actor.getProfiles') return json({ profiles: [{ did: DID, handle: 'newcomer.example', displayName: 'New Comer' }] });
    if (u.origin === PDS && method === 'com.atproto.repo.getRecord') {
      if (answer === 'missing') return json({ error: 'RecordNotFound', message: 'Could not locate record' }, 400);
      if (answer === 'down') return json({ error: 'InternalServerError' }, 502);
      return json({ uri: `at://${DID}/dev.rainshare.profile/self`, cid: 'bafyprofile', value: { $type: 'dev.rainshare.profile', plans: ['claude'] } });
    }
    return json({ error: 'NotFound' }, 404);
  };
  try {
    const none = await createSource().profileOf(DID);
    assert.equal(none.merged, null);
    assert.equal(none.unread, false, 'their server said there’s none');
    assert.equal(none.bluesky.displayName, 'New Comer');
    answer = 'down';
    const down = await createSource().profileOf(DID);
    assert.equal(down.merged, null);
    assert.equal(down.unread, true, 'their server didn’t answer');
    answer = 'there';
    const there = await createSource().profileOf(DID);
    assert.deepEqual(there.merged.plans, ['claude']);
    assert.equal(there.unread, false);
  } finally { globalThis.fetch = real; }
});
