// Finding where an account signs in, before anyone is sent there (src/lookup.js, used by
// whereTo in src/oauth.js and the dialog in src/signin.js). An account that isn't there is
// said to be so; a server that's out for a moment isn't taken for one, so the dialog can go on
// without the name of where it's sending you rather than stop.
//
// The failures here are the sign-in library's own: its identity resolver, run against a
// network made up for each test, and wrapped as its OAuth resolver wraps what it throws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AtprotoIdentityResolver } from '@atproto-labs/identity-resolver';
import { XrpcHandleResolver } from '@atproto-labs/handle-resolver';
import { DidResolverCommon } from '@atproto-labs/did-resolver';
import { OAuthResolverError } from '@atproto/oauth-client';
import { noSuchAccount, within, handleLookup } from '../src/lookup.js';

const DID = 'did:plc:abcdefghijklmnopqrstuvwx', HANDLE = 'someone.example.com';
const doc = (handle = HANDLE) => ({
  '@context': ['https://www.w3.org/ns/did/v1'], id: DID, alsoKnownAs: [`at://${handle}`],
  service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example.com' }]
});
const json = (body, status = 200, type = 'application/json') => new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
// What the sign-in library's resolveIdentity does with `who`, on a made-up network: `handles`
// answers resolveHandle, `plc` answers for the DID.
async function resolve(who, { handles = () => json({ did: DID }), plc = () => json(doc()), own = true } = {}){
  const fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    return url.pathname.startsWith('/xrpc/') ? handles(url) : plc(url);
  };
  // (Rainshare's own handle lookup, as src/oauth.js gives the library, or the library's.)
  const handleResolver = own ? handleLookup('https://handles.example.com', fetch) : new XrpcHandleResolver('https://handles.example.com', { fetch });
  const identity = new AtprotoIdentityResolver(new DidResolverCommon({ fetch, plcDirectoryUrl: 'https://plc.example.com' }), handleResolver);
  try { return await identity.resolve(who); }
  catch (cause) { throw OAuthResolverError.from(cause, `Failed to resolve identity: ${who}`); }
}
const failure = async (who, net) => { try { await resolve(who, net); } catch (e) { return e; } assert.fail('it resolved'); };
const down = () => { throw new TypeError('fetch failed'); };

test('the made-up network resolves an account that is there', async () => {
  assert.equal((await resolve(HANDLE)).did, DID);
  assert.equal((await resolve(DID)).handle, HANDLE);
  assert.equal((await resolve(HANDLE, { own: false })).did, DID, 'with the library’s own handle lookup too');
});

test('an account that isn’t there is said to be missing', async () => {
  const nobody = () => json({ error: 'InvalidRequest', message: 'Unable to resolve handle' }, 400);
  assert.ok(noSuchAccount(await failure(HANDLE, { handles: nobody })), 'a handle nothing answers to');
  // bsky.social's way of saying it about one of its own handles, which the library's lookup doesn't know
  const notFound = () => json({ error: 'HandleNotFound', message: 'Unable to resolve handle' }, 400);
  assert.ok(noSuchAccount(await failure(HANDLE, { handles: notFound })), 'a handle bsky.social says is nobody’s');
  assert.equal(noSuchAccount(await failure(HANDLE, { handles: notFound, own: false })), false, '(which the library alone would take for a server out of order)');
  assert.ok(noSuchAccount(await failure(HANDLE, { plc: () => json(doc('someone.else.example')) })), 'a handle its account doesn’t list');
  assert.ok(noSuchAccount(await failure(HANDLE, { plc: () => json({ message: 'DID not registered' }, 404) })), 'a handle whose DID the directory doesn’t have');
  assert.ok(noSuchAccount(await failure(DID, { plc: () => json({ message: 'DID not registered' }, 404) })), 'a DID the directory doesn’t have');
});

test('a server that’s out for a moment isn’t taken for a missing account', async () => {
  assert.equal(noSuchAccount(await failure(HANDLE, { handles: down })), false, 'the handle resolver unreachable');
  assert.equal(noSuchAccount(await failure(HANDLE, { handles: () => json({ error: 'InternalServerError' }, 500) })), false, 'the handle resolver failing');
  assert.equal(noSuchAccount(await failure(HANDLE, { handles: () => new Response('<html>Bad Gateway</html>', { status: 502 }) })), false, 'the handle resolver behind a broken proxy');
  assert.equal(noSuchAccount(await failure(HANDLE, { handles: () => json({ did: 'not a did' }) })), false, 'the handle resolver answering nonsense');
  assert.equal(noSuchAccount(await failure(HANDLE, { plc: down })), false, 'the directory unreachable');
  assert.equal(noSuchAccount(await failure(HANDLE, { plc: () => json({ message: 'Bad Gateway' }, 502) })), false, 'the directory failing');
  assert.equal(noSuchAccount(await failure(DID, { plc: () => json({ message: 'Service Unavailable' }, 503) })), false, 'the directory failing, for a DID');
  assert.equal(noSuchAccount(Object.assign(new Error('No answer'), { name: 'TimeoutError' })), false, 'no answer in time');
  assert.equal(noSuchAccount(null), false);
});

test('a wait for where an account signs in has an end', async () => {
  assert.equal(await within(Promise.resolve('here'), 50), 'here');
  await assert.rejects(within(Promise.reject(new Error('refused')), 50), /refused/);
  await assert.rejects(within(new Promise(() => {}), 20), e => e.name === 'TimeoutError');
});
