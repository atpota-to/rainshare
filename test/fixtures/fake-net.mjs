// A small made-up network, for running the real CLI in a test without the real one: loaded
// before the CLI with `node --import`. One helper (who's signed in), one asker with one ask,
// and Rainshare's ledger. What it's like is set by RAINSHARE_TEST_NET, as JSON:
//   { prefs }   the helper's settings record, if they have one
// Every request is added to the file named by RAINSHARE_TEST_LOG, a line each.
import { appendFileSync } from 'node:fs';

const world = JSON.parse(process.env.RAINSHARE_TEST_NET || '{}'), LOG = process.env.RAINSHARE_TEST_LOG;
export const HELPER = 'did:plc:helper', ASKER = 'did:plc:asker', PDS = 'https://pds.test', SEED_KEY = '3k2a4zxq5zs2a';
const NS = 'dev.rainshare';
const records = {
  [`${ASKER}/${NS}.seed/${SEED_KEY}`]: { $type: `${NS}.seed`, title: 'A seating chart that shuffles itself', spec: 'For a classroom.', audience: { $type: `${NS}.seed#anyone` }, createdAt: '2026-11-10T00:00:00.000Z' },
  ...(world.prefs ? { [`${HELPER}/${NS}.preferences/self`]: world.prefs } : {})
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let n = 0;

globalThis.fetch = async (input, init = {}) => {
  const u = new URL(typeof input === 'string' ? input : input.url ?? String(input)), q = u.searchParams, m = u.pathname.replace(/^.*\/xrpc\//, ''), method = init.method || 'GET';
  if (LOG) appendFileSync(LOG, `${method} ${u.host}${u.pathname} ${init.body ? String(init.body).slice(0, 300) : ''}\n`);
  if (u.host === 'plc.directory') { const did = decodeURIComponent(u.pathname.slice(1)); return json({ id: did, alsoKnownAs: [`at://${did.slice(8)}.test`], service: [{ id: '#atproto_pds', serviceEndpoint: PDS }] }); }
  if (u.pathname.endsWith('/functions/v1/rainshare-agree')) return json({ logged: true });
  if (u.origin === PDS && m === 'com.atproto.repo.getRecord') {
    const k = `${q.get('repo')}/${q.get('collection')}/${q.get('rkey')}`, v = records[k];
    return v ? json({ uri: 'at://' + k, cid: 'bafy' + k.length, value: v }) : json({ error: 'RecordNotFound' }, 400);
  }
  if (u.origin === PDS && m === 'com.atproto.repo.listRecords') {
    const pre = `${q.get('repo')}/${q.get('collection')}/`;
    return json({ records: Object.entries(records).filter(([k]) => k.startsWith(pre)).map(([k, value]) => ({ uri: 'at://' + k, cid: 'bafy' + k.length, value })) });
  }
  if (u.origin === PDS && (m === 'com.atproto.repo.createRecord' || m === 'com.atproto.repo.putRecord')) {
    const b = JSON.parse(init.body), rkey = b.rkey || 'w' + (++n), k = `${b.repo}/${b.collection}/${rkey}`;
    records[k] = b.record;
    return json({ uri: 'at://' + k, cid: 'bafy' + k.length });
  }
  if (u.origin === PDS && m === 'com.atproto.repo.deleteRecord') return json({});
  if (m === 'com.atproto.sync.listReposByCollection') return json({ repos: [...new Set(Object.keys(records).filter(k => k.includes(`/${q.get('collection')}/`)).map(k => k.split('/')[0]))].map(did => ({ did })) });
  if (m === 'blue.microcosm.links.getBacklinks') return json({ records: [], cursor: null });
  if (m === 'app.bsky.actor.getProfiles') return json({ profiles: q.getAll('actors').map(did => ({ did, handle: did.slice(8) + '.test', displayName: did.slice(8) })) });
  if (m === 'app.bsky.graph.getRelationships') return json({ relationships: q.getAll('others').map(did => ({ did })) });
  return json({ error: 'NotFound' }, 404);
};
