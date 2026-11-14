// Rainshare's ledger of who agreed to its terms (supabase/functions/rainshare-agree): it only
// notes what an account's own record says, read from the account's own host.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, publicHttps, base64, CORS } from '../supabase/functions/rainshare-agree/handler.js';
import { agreementNow, agreedIn, tellLedger, recordAgreement, LEDGER } from '../core/agreement.js';
import { LEGAL_VERSION } from '../core/legal.js';
import * as R from '../core/records.js';
import { PREFERENCES } from '../core/ns.js';

const DID = 'did:plc:alice', PDS = 'https://pds.example.com', SB = 'https://ledger.supabase.test', KEY = 'service-key';
const NOW = Date.parse('2026-11-14T19:00:00Z'), AGREED = '2026-11-14T18:30:00.000Z';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// A small network: the PLC directory, one host, and the ledger's table. `w` is the world as it stands.
function world(over = {}){
  const w = {
    docs: { [DID]: { id: DID, service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }] } },
    record: { uri: `at://${DID}/${PREFERENCES}/self`, cid: 'bafyrecord', value: { $type: PREFERENCES, terms: { version: LEGAL_VERSION, agreedAt: AGREED }, createdAt: AGREED } },
    proof: new Uint8Array([1, 2, 3, 250, 251, 252]), rows: [], asked: [], insert: 201, ...over
  };
  w.fetch = async (input, init = {}) => {
    const u = new URL(String(input)); w.asked.push(`${init.method || 'GET'} ${u.origin}${u.pathname}`);
    if (u.origin === SB) {
      assert.equal(init.headers.apikey, KEY); assert.equal(init.headers.authorization, 'Bearer ' + KEY);
      if ((init.method || 'GET') === 'GET') return json(w.rows.filter(r => 'eq.' + r.did === u.searchParams.get('did') && 'eq.' + r.policy_version === u.searchParams.get('policy_version')).map(() => ({ id: 'x' })));
      if (w.insert !== 201) return json({ message: 'no' }, w.insert);
      assert.equal(u.searchParams.get('on_conflict'), 'did,policy_version'); assert.match(init.headers.prefer, /ignore-duplicates/);
      w.rows.push(JSON.parse(init.body)); return new Response(null, { status: 201 });
    }
    assert.equal(init.redirect, 'error', 'a host can’t send the function somewhere else');
    if (u.origin === 'https://plc.directory') { const d = w.docs[decodeURIComponent(u.pathname.slice(1))]; return d ? json(d) : json({}, 404); }
    if (u.origin === PDS && u.pathname.endsWith('com.atproto.repo.getRecord')) return w.record ? json(w.record) : json({ error: 'RecordNotFound' }, 400);
    if (u.origin === PDS && u.pathname.endsWith('com.atproto.sync.getRecord')) return w.proof ? new Response(w.proof, { headers: { 'content-type': 'application/vnd.ipld.car' } }) : json({}, 400);
    throw new Error('a host the function shouldn’t ask: ' + u.href);
  };
  w.handle = createHandler({ fetch: w.fetch, supabaseUrl: SB, serviceKey: KEY, now: () => NOW });
  w.post = body => w.handle(new Request('https://x.test/rainshare-agree', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));
  return w;
}
const said = async r => [r.status, await r.json()];

test('the ledger notes what an account’s own record says, with the copy its host signed', async () => {
  const w = world();
  assert.deepEqual(await said(await w.post({ did: DID, version: LEGAL_VERSION, via: 'cli' })), [200, { logged: true }]);
  assert.deepEqual(w.rows, [{ did: DID, policy_version: LEGAL_VERSION, accepted_at: AGREED, via: 'cli', record_uri: `at://${DID}/${PREFERENCES}/self`, record_cid: 'bafyrecord', proof: base64(w.proof) }]);
  assert.equal(atob(w.rows[0].proof).length, 6);
  // Told again, it's already there: nobody else is asked, and there's still one row.
  w.asked = [];
  assert.deepEqual(await said(await w.post({ did: DID, version: LEGAL_VERSION })), [200, { logged: true, already: true }]);
  assert.deepEqual(w.asked, [`GET ${SB}/rest/v1/rainshare_terms_acceptance`]);
  assert.equal(w.rows.length, 1);
});

test('it takes nobody’s word for it: no record, another version, or another account’s record, and nothing is noted', async () => {
  for (const [what, over] of [
    ['no record', { record: null }],
    ['no terms in it', { record: { uri: `at://${DID}/${PREFERENCES}/self`, cid: 'x', value: { send: { route: 'brief' } } } }],
    ['an older version', { record: { uri: `at://${DID}/${PREFERENCES}/self`, cid: 'x', value: { terms: { version: '2020-01-01', agreedAt: AGREED } } } }],
    ['someone else’s record handed back', { record: { uri: `at://did:plc:mallory/${PREFERENCES}/self`, cid: 'x', value: { terms: { version: LEGAL_VERSION, agreedAt: AGREED } } } }]
  ]) {
    const w = world(over);
    assert.deepEqual(await said(await w.post({ did: DID, version: LEGAL_VERSION })), [409, { logged: false, reason: 'record' }], what);
    assert.deepEqual(w.rows, [], what);
  }
});

test('it only asks an account’s host if that’s a public https host, named in the account’s own document', async () => {
  for (const [what, docs] of [
    ['plain http', { [DID]: { id: DID, service: [{ id: '#atproto_pds', serviceEndpoint: 'http://pds.example.com' }] } }],
    ['an address', { [DID]: { id: DID, service: [{ id: '#atproto_pds', serviceEndpoint: 'https://169.254.169.254' }] } }],
    ['this machine', { [DID]: { id: DID, service: [{ id: '#atproto_pds', serviceEndpoint: 'https://localhost:8443' }] } }],
    ['a document for another account', { [DID]: { id: 'did:plc:mallory', service: [{ id: '#atproto_pds', serviceEndpoint: PDS }] } }],
    ['no document', {}]
  ]) {
    const w = world({ docs });
    assert.deepEqual(await said(await w.post({ did: DID, version: LEGAL_VERSION })), [422, { logged: false, reason: 'host' }], what);
    assert.ok(!w.asked.some(a => a.includes('getRecord')), what);
  }
  assert.equal(publicHttps('https://pds.example.com/xrpc'), 'https://pds.example.com');
  assert.equal(publicHttps('https://morel.us-east.host.bsky.network'), 'https://morel.us-east.host.bsky.network');
  for (const bad of ['http://pds.example.com', 'https://user:pw@pds.example.com', 'https://10.0.0.1', 'https://[::1]', 'https://localhost', 'https://pds.internal', 'https://intranet', 'ftp://pds.example.com', 'not a url', '']) assert.equal(publicHttps(bad), null, bad);
});

test('what it’s sent is checked before anyone is asked anything', async () => {
  const w = world();
  for (const bad of ['not json', { did: 'alice.test', version: LEGAL_VERSION }, { did: DID, version: 'latest' }, { did: DID }, { did: `${DID};drop`, version: LEGAL_VERSION }, { did: 7, version: LEGAL_VERSION }, null])
    assert.equal((await w.post(bad)).status, 400, JSON.stringify(bad));
  assert.equal((await w.post({ did: DID, version: LEGAL_VERSION, pad: 'x'.repeat(3000) })).status, 413);
  assert.deepEqual(w.asked, []);
  assert.equal((await w.handle(new Request('https://x.test/', { method: 'GET' }))).status, 405);
  // A browser's check before it posts from another origin.
  const pre = await w.handle(new Request('https://x.test/', { method: 'OPTIONS' }));
  assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), '*'); assert.equal(CORS['access-control-allow-methods'], 'POST, OPTIONS');
  // Not set up: it says so rather than pretending.
  assert.equal((await createHandler({ fetch: w.fetch })(new Request('https://x.test/', { method: 'POST', body: '{}' }))).status, 500);
});

test('a time that hasn’t happened yet, a host with no proof to give, and a ledger that refuses', async () => {
  // Their record says they agreed tomorrow: the ledger says now. And where it was done is 'web' unless it's the CLI.
  let w = world({ record: { uri: `at://${DID}/${PREFERENCES}/self`, cid: 'c', value: { terms: { version: LEGAL_VERSION, agreedAt: '2026-11-15T19:00:00Z' } } } });
  await w.post({ did: DID, version: LEGAL_VERSION, via: 'somewhere' });
  assert.deepEqual([w.rows[0].accepted_at, w.rows[0].via], [new Date(NOW).toISOString(), 'web']);
  // No proof, or one too big to keep: it's noted without.
  for (const proof of [null, new Uint8Array(200 * 1024 + 1)]) {
    w = world({ proof });
    assert.deepEqual(await said(await w.post({ did: DID, version: LEGAL_VERSION })), [200, { logged: true }]);
    assert.equal(w.rows[0].proof, null);
  }
  w = world({ insert: 500 });
  assert.deepEqual(await said(await w.post({ did: DID, version: LEGAL_VERSION })), [502, { logged: false, reason: 'ledger' }]);
});

test('an agreement in someone’s settings: written whole, kept through other changes, and read only if it’s the terms as they are now', () => {
  const t = agreementNow(NOW);
  assert.deepEqual(t, { version: LEGAL_VERSION, agreedAt: '2026-11-14T19:00:00.000Z' });
  const rec = R.preferences({ terms: t });
  assert.deepEqual(rec.terms, t);
  assert.deepEqual(agreedIn(rec), t);
  // Changing how "Send my agent" works, or which messages are wanted, leaves it be.
  assert.deepEqual(R.preferences({ send: { route: 'brief' }, notify: { updates: true } }, rec).terms, t);
  // Something that isn't one is left out, and doesn't knock out one that's there.
  assert.equal(R.preferences({ terms: { version: 'v2', agreedAt: 'x' } }).terms, undefined);
  assert.deepEqual(R.preferences({ terms: { version: '2026-11-14' } }, rec).terms, t);
  // Older terms, or none: not agreed.
  for (const prefs of [null, {}, { terms: { version: '2020-01-01', agreedAt: 'x' } }, { terms: { version: LEGAL_VERSION } }]) assert.equal(agreedIn(prefs), null);
});

test('recording an agreement: the settings first, then the ledger, and the ledger is never waited on to go ahead', async () => {
  const real = globalThis.fetch, calls = [];
  let answer = () => json({ logged: true });
  globalThis.fetch = async (url, init) => { calls.push([String(url), JSON.parse(init.body)]); return answer(); };
  try {
    let prefs = null;
    const source = { viewer: DID, preferences: async () => prefs, savePreferences: async input => { prefs = R.preferences(input, prefs); return prefs; } };
    assert.deepEqual(await recordAgreement(source, { at: NOW, via: 'cli' }), { saved: true, logged: true });
    assert.deepEqual(prefs.terms, agreementNow(NOW));
    assert.deepEqual(calls, [[LEDGER, { did: DID, version: LEGAL_VERSION, via: 'cli' }]]);
    // Already in their settings: it isn't written again, and the ledger is told again (which is harmless).
    const was = prefs;
    assert.deepEqual(await recordAgreement(source, { at: NOW + 1000 }), { saved: true, logged: true });
    assert.equal(prefs, was);
    // The ledger is down, or says no: the agreement stands, and it's known the ledger hasn't got it.
    answer = () => json({ logged: false, reason: 'record' }, 409);
    assert.deepEqual(await recordAgreement(source), { saved: true, logged: false });
    answer = () => { throw new Error('offline'); };
    assert.equal(await tellLedger({ did: DID }), false);
    // Their host won't take the record (a sign-in from before): nothing is told to the ledger, and nothing throws unless asked to.
    const calls2 = calls.length, refusing = { viewer: DID, preferences: async () => null, savePreferences: async () => { throw new Error('ScopeMissing'); } };
    assert.deepEqual(await recordAgreement(refusing), { saved: false, logged: false });
    assert.equal(calls.length, calls2);
    await assert.rejects(recordAgreement(refusing, { must: true }), /ScopeMissing/);
    // Nobody signed in: nothing to record.
    assert.deepEqual(await recordAgreement({ viewer: null }), { saved: false, logged: false });
  } finally { globalThis.fetch = real; }
});
