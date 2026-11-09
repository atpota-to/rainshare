// Publish the dev.rainshare.* schemas so anyone can resolve them (atproto lexicon resolution):
//
//   1. a DNS TXT record at _lexicon.rainshare.dev saying  did=<the publishing account's DID>
//   2. each schema as a com.atproto.lexicon.schema record in that account's repo, keyed by its NSID
//
// This does step 2 and prints step 1. Run it as the account that will own the schemas:
//   RAINSHARE_HANDLE=you.bsky.social RAINSHARE_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx node lexicons/publish.mjs
import { readFile, readdir } from 'node:fs/promises';
import { resolveHandle, pdsOf } from '../core/net.js';

const dir = new URL('./dev/rainshare/', import.meta.url);
const { RAINSHARE_HANDLE: handle, RAINSHARE_APP_PASSWORD: password } = process.env;
if (!handle || !password) { console.error('Set RAINSHARE_HANDLE and RAINSHARE_APP_PASSWORD.'); process.exit(1); }

const call = async (url, body, token) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || data.error || r.status);
  return data;
};
const did = await resolveHandle(handle), pds = await pdsOf(did);
const { accessJwt } = await call(`${pds}/xrpc/com.atproto.server.createSession`, { identifier: did, password });
for (const f of (await readdir(dir)).filter(f => f.endsWith('.json')).sort()) {
  const doc = JSON.parse(await readFile(new URL(f, dir), 'utf8'));
  await call(`${pds}/xrpc/com.atproto.repo.putRecord`, { repo: did, collection: 'com.atproto.lexicon.schema', rkey: doc.id, record: { $type: 'com.atproto.lexicon.schema', ...doc } }, accessJwt);
  console.log('published', doc.id);
}
console.log(`\nNow add this DNS record, if it isn't there yet:\n  _lexicon.rainshare.dev  TXT  "did=${did}"`);
