// Rainshare's ledger of who has agreed to its terms: the function that writes it.
//
// Told that an account agreed ({ did, version, via }), it takes nobody's word for it. It finds
// the account's own host, reads the account's settings record there
// (dev.rainshare.preferences/self), and only if that record says the same (terms.version) does
// it note it, in public.rainshare_terms_acceptance: the account, the version, when the record
// says they agreed, where from, and the record's address and CID. With it goes the record as
// its host serves it for syncing (com.atproto.sync.getRecord): the record together with the
// commit the host signed over it, so the note can still be checked if the record is deleted.
//
// So anyone can call this, and it's safe that they can: the only way to get an account into
// the ledger is to be that account and write the record. Asking twice is harmless (one row per
// account and version).
//
// It only ever asks public https hosts, by name, for a few small things, and waits a few
// seconds at most. Nothing here is specific to Deno: ../../../test/ledger.test.mjs runs it in Node.
const COLLECTION = 'dev.rainshare.preferences', RKEY = 'self', TABLE = 'rainshare_terms_acceptance';
const DID = /^did:(plc|web):[A-Za-z0-9._:%-]{1,240}$/, VERSION = /^\d{4}-\d{2}-\d{2}$/;
const TIMEOUT = 6000, MAX_JSON = 256 * 1024, MAX_PROOF = 200 * 1024;

export const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });

/** The origin of a public https host named by a domain: no addresses, nothing local, no sign-in in the link. Null otherwise. */
export function publicHttps(raw){
  try {
    const u = new URL(String(raw));
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    const h = u.hostname.toLowerCase();
    if (h.length > 253 || !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/.test(h)) return null;
    if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|test|invalid|example|onion)$/.test(h)) return null;
    return u.origin;
  } catch (_) { return null; }
}

/** As base64. */
export function base64(bytes){
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function createHandler({ fetch = globalThis.fetch, supabaseUrl, serviceKey, now = () => Date.now() } = {}){
  // A small answer from a host that's asked nicely once: never followed elsewhere, never waited on for long, never more than `max` bytes.
  async function get(url, max){
    const r = await fetch(url, { headers: { accept: '*/*' }, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return null;
    if (Number(r.headers.get('content-length') || 0) > max) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    return bytes.length <= max ? bytes : null;
  }
  const getJson = async url => { const b = await get(url, MAX_JSON); try { return b ? JSON.parse(new TextDecoder().decode(b)) : null; } catch (_) { return null; } };

  // Where an account lives: its DID document says, and the document has to be that account's.
  async function hostOf(did){
    let doc = null;
    if (did.startsWith('did:plc:')) doc = await getJson(`https://plc.directory/${did}`);
    else {
      // atproto's did:web is a bare host name, never a path (and a port is only for development).
      const at = /^did:web:[a-z0-9.-]+$/i.test(did) ? publicHttps('https://' + did.slice(8)) : null;
      doc = at ? await getJson(`${at}/.well-known/did.json`) : null;
    }
    if (!doc || doc.id !== did || !Array.isArray(doc.service)) return null;
    const s = doc.service.find(x => x && (x.id === '#atproto_pds' || x.id === did + '#atproto_pds'));
    return publicHttps(s?.serviceEndpoint);
  }

  // The ledger itself, through Supabase's own API, as the service role.
  const db = (path, init = {}) => fetch(`${supabaseUrl}/rest/v1/${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT),
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json', ...(init.headers || {}) } });

  return async function handle(req){
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method !== 'POST') return json({ logged: false, reason: 'method' }, 405);
    if (!supabaseUrl || !serviceKey) return json({ logged: false, reason: 'setup' }, 500);
    let body;
    try { const text = await req.text(); if (text.length > 2000) return json({ logged: false, reason: 'request' }, 413); body = JSON.parse(text); }
    catch (_) { return json({ logged: false, reason: 'request' }, 400); }
    const did = typeof body?.did === 'string' ? body.did : '', version = typeof body?.version === 'string' ? body.version : '', via = body?.via === 'cli' ? 'cli' : 'web';
    if (!DID.test(did) || !VERSION.test(version)) return json({ logged: false, reason: 'request' }, 400);
    try {
      // Already noted: nothing more to ask anyone.
      const seen = await db(`${TABLE}?select=id&did=eq.${encodeURIComponent(did)}&policy_version=eq.${encodeURIComponent(version)}&limit=1`);
      if (seen.ok && (await seen.json().catch(() => [])).length) return json({ logged: true, already: true });

      const host = await hostOf(did).catch(() => null);
      if (!host) return json({ logged: false, reason: 'host' }, 422);
      const q = `collection=${COLLECTION}&rkey=${RKEY}`, uri = `at://${did}/${COLLECTION}/${RKEY}`;
      const rec = await getJson(`${host}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&${q}`).catch(() => null);
      const terms = rec?.value?.terms;
      // What the account itself says, at the address that was asked for.
      if (!rec || rec.uri !== uri || !terms || terms.version !== version) return json({ logged: false, reason: 'record' }, 409);
      // When they say they agreed, unless that can't be read or hasn't happened yet.
      const said = Date.parse(terms.agreedAt), t = now(), accepted = said > 0 && said <= t + 5 * 60e3 ? said : t;
      // The record with its host's signed commit, if the host will give it and it's a sensible size.
      const proof = await get(`${host}/xrpc/com.atproto.sync.getRecord?did=${encodeURIComponent(did)}&${q}`, MAX_PROOF).catch(() => null);

      const row = { did, policy_version: version, accepted_at: new Date(accepted).toISOString(), via, record_uri: uri, record_cid: typeof rec.cid === 'string' ? rec.cid.slice(0, 200) : null, proof: proof?.length ? base64(proof) : null };
      const put = await db(`${TABLE}?on_conflict=did,policy_version`, { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(row) });
      if (!put.ok) { console.error('rainshare-agree: the ledger refused a row', put.status, await put.text().catch(() => '')); return json({ logged: false, reason: 'ledger' }, 502); }
      return json({ logged: true });
    } catch (e) {
      console.error('rainshare-agree', e?.message || e);
      return json({ logged: false, reason: 'trouble' }, 502);
    }
  };
}
