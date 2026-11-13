// Publishes the dev.rainshare.* lexicons so anyone can look them up (atproto lexicon resolution):
//
//   1. each schema is a com.atproto.lexicon.schema record, keyed by its NSID, in the repo of the
//      account that owns them: the brand account, rainshare.dev
//   2. a DNS TXT record at _lexicon.rainshare.dev says  did=<that account's DID>
//
// This does 1, and checks 2 and says what to add if it's missing. It writes only the schemas that
// changed, and won't publish a change that would break records already written under the
// published one (compat.mjs) unless told to.
//
//   node lexicons/publish.mjs            publish (needs RAINSHARE_LEXICON_APP_PASSWORD)
//   node lexicons/publish.mjs --check    compare with what's published, and write nothing
//   node lexicons/publish.mjs --deploy   what Vercel's build runs: publish from a production build
//                                        that has the password, and only check from any other
//
//   RAINSHARE_LEXICON_ACCOUNT            the owner's handle or DID (rainshare.dev unless set)
//   RAINSHARE_LEXICON_APP_PASSWORD       an app password for it
//   RAINSHARE_LEXICON_ALLOW_BREAKING=1   publish a breaking change anyway: only while nobody has
//                                        written records under the published schema
import { readFile, readdir } from 'node:fs/promises';
import { resolveTxt } from 'node:dns/promises';
import { resolveHandle, pdsOf, xrpc, NetError } from '../core/net.js';
import { AUTHORITY, problems, breaking, same } from './compat.mjs';

const COLLECTION = 'com.atproto.lexicon.schema';
const env = process.env;
const mode = process.argv.includes('--deploy') ? 'deploy' : process.argv.includes('--check') ? 'check' : 'publish';
const account = env.RAINSHARE_LEXICON_ACCOUNT || AUTHORITY, password = env.RAINSHARE_LEXICON_APP_PASSWORD;
const production = env.VERCEL_ENV === 'production';
const write = mode === 'publish' || (mode === 'deploy' && production && !!password);
// A preview build only warns when the network lets it down; a build that publishes stops.
const lenient = mode === 'deploy' && !write;

const say = s => console.log('lexicons: ' + s);
const stop = s => { console.error('lexicons: ' + s); process.exit(1); };
const unsure = s => lenient ? (say(s + ' Nothing was checked against what\'s published.'), process.exit(0)) : stop(s);

async function post(base, nsid, body, token){
  const r = await fetch(`${base}/xrpc/${nsid}`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new NetError(data.error || 'HTTP' + r.status, data.message || `${r.status} from ${new URL(base).host}`, r.status);
  return data;
}

async function published(did, pds, nsid){
  try { return (await xrpc(pds, 'com.atproto.repo.getRecord', { repo: did, collection: COLLECTION, rkey: nsid })).value; }
  catch (e) { if (e.name === 'RecordNotFound') return null; throw e; }
}

async function checkDns(did){
  const name = '_lexicon.' + AUTHORITY, want = 'did=' + did;
  const add = `add this DNS record, or nobody can look the lexicons up:\n  ${name}  TXT  "${want}"`;
  try {
    const txt = (await resolveTxt(name)).map(parts => parts.join(''));
    if (txt.includes(want)) say(`${name} points at ${did}.`);
    else say(`${name} says ${txt.map(t => `"${t}"`).join(', ')}, not "${want}". Change it: ${add}`);
  } catch (e) {
    if (e.code === 'ENOTFOUND' || e.code === 'ENODATA') say(`there's no ${name} record yet. ${add[0].toUpperCase() + add.slice(1)}`);
    else say(`couldn't look up ${name} (${e.code || e.message}).`);
  }
}

// The files, and whether they're sound, before anything is asked of the network.
const dir = new URL('./dev/rainshare/', import.meta.url);
const files = [];
for (const name of (await readdir(dir)).filter(f => f.endsWith('.json')).sort()) {
  try { files.push({ name, doc: JSON.parse(await readFile(new URL(name, dir), 'utf8')) }); }
  catch (e) { stop(`${name} isn't valid JSON: ${e.message}`); }
}
const wrong = problems(files);
if (wrong.length) stop('the lexicons have problems:\n' + wrong.map(w => '  - ' + w).join('\n'));

if (mode === 'publish' && !password) stop('set RAINSHARE_LEXICON_APP_PASSWORD (and RAINSHARE_LEXICON_ACCOUNT, if the owner isn\'t rainshare.dev). Use --check to compare without publishing.');
if (mode === 'deploy' && !write) say(production
  ? 'this production build has no RAINSHARE_LEXICON_APP_PASSWORD, so it checks and doesn\'t publish.'
  : `checking only: this is a ${env.VERCEL_ENV || 'local'} build, and only production builds publish.`);

let did, pds;
try { did = await resolveHandle(account); pds = await pdsOf(did); }
catch (e) {
  unsure(`couldn't find the account ${account} (${e.message}).` + (account === AUTHORITY
    ? ` If the brand account doesn't have the handle ${AUTHORITY} yet, give it that handle (by DNS: the site answers every path itself, so the file method won't work), or set RAINSHARE_LEXICON_ACCOUNT to its handle or DID for now.`
    : ''));
}

// What has changed since the last publish, and whether any of it breaks the published schema.
const plan = [];
try {
  for (const { doc } of files) {
    const prev = await published(did, pds, doc.id);
    if (!prev) { plan.push({ doc, fresh: true, broken: [] }); continue; }
    const { $type, ...was } = prev;
    if (!same(was, doc)) plan.push({ doc, fresh: false, broken: breaking(was, doc) });
  }
} catch (e) { unsure(`couldn't read what's published in ${account}'s repo at ${pds} (${e.message}).`); }

const broken = plan.flatMap(p => p.broken);
if (broken.length) {
  const list = broken.map(b => '  - ' + b).join('\n');
  if (env.RAINSHARE_LEXICON_ALLOW_BREAKING !== '1') stop(`these changes would break records already written under the published lexicons:\n${list}\n`
    + 'Add a new optional field instead, or make the change under a new NSID. While nobody has written records under the published one, RAINSHARE_LEXICON_ALLOW_BREAKING=1 publishes it anyway.');
  say(`publishing changes that break the published lexicons, as RAINSHARE_LEXICON_ALLOW_BREAKING says to:\n${list}`);
}

if (!plan.length) say(`all ${files.length} are up to date in ${account}'s repo.`);
else if (!write) for (const { doc, fresh } of plan) say(`${doc.id} ${fresh ? 'isn\'t published yet' : 'has changed'}, and would be published.`);
else {
  try {
    const { accessJwt } = await post(pds, 'com.atproto.server.createSession', { identifier: did, password });
    for (const { doc, fresh } of plan) {
      await post(pds, 'com.atproto.repo.putRecord', { repo: did, collection: COLLECTION, rkey: doc.id, record: { $type: COLLECTION, ...doc } }, accessJwt);
      say(`published ${doc.id}${fresh ? ', for the first time' : ''}.`);
    }
  } catch (e) { stop(`publishing as ${account} at ${pds} failed: ${e.message}`); }
}

await checkDns(did);
