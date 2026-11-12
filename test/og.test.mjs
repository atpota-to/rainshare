// Link previews: the words for a page's tags and what its card shows (api/_og/describe.js),
// the tags written into the page (api/page.js), and the card's tree (api/_og/card.js).
// The two hosts the functions ask (Slingshot and Bluesky's AppView) are answered by a stub.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { describe, clean, HOME, canonical } from '../api/_og/describe.js';
import { cardFor } from '../api/_og/card.js';
import { withTags } from '../api/page.js';
import { SEED, PROFILE, SITE } from '../core/ns.js';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DID = 'did:plc:alice', HANDLE = 'alice.test';
let records, profile, asked;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
beforeEach(() => {
  asked = [];
  records = { [`${SEED}/3k1`]: { $type: SEED, title: 'Keep drafts out of the feed', spec: 'Right now drafts show up in the RSS feed. They shouldn’t.\n\nMore detail here.', audience: { $type: `${SEED}#anyone` }, createdAt: '2026-11-01T00:00:00Z' } };
  profile = { did: DID, handle: HANDLE, displayName: 'Alice', description: 'I make small tools.', avatar: 'https://cdn.bsky.app/img/avatar/plain/did:plc:alice/bafy' };
});
globalThis.fetch = async input => {
  const u = new URL(typeof input === 'string' ? input : input.url), q = u.searchParams;
  asked.push(u.host);
  if (u.host === 'slingshot.microcosm.blue' && u.pathname.endsWith('com.atproto.repo.getRecord')) {
    const repo = q.get('repo'), v = [DID, HANDLE].includes(repo) ? records[`${q.get('collection')}/${q.get('rkey')}`] : null;
    return v ? json({ uri: `at://${DID}/${q.get('collection')}/${q.get('rkey')}`, cid: 'bafy', value: v }) : json({ error: 'RecordNotFound' }, 400);
  }
  if (u.host === 'public.api.bsky.app' && u.pathname.endsWith('app.bsky.actor.getProfile')) return [DID, HANDLE].includes(q.get('actor')) && profile ? json(profile) : json({ error: 'NotFound' }, 400);
  throw new Error('a host the functions must never ask: ' + u.host);
};

test('an ask’s page says what it is and who’s asking, by handle or by DID', async () => {
  for (const who of [HANDLE, DID, '@' + HANDLE]) {
    const p = await describe({ kind: 'seed', who, rkey: '3k1' });
    assert.equal(p.kind, 'seed');
    assert.equal(p.title, 'Keep drafts out of the feed · Rainshare');
    assert.equal(p.heading, 'Keep drafts out of the feed');
    assert.match(p.description, /^Alice is asking for help with a project|^Alice is asking for help with an idea/);
    assert.match(p.description, /drafts show up in the RSS feed/);
    assert.equal(p.path, `/seed/${HANDLE}/3k1`);
    assert.equal(canonical(p), `${SITE}/seed/${HANDLE}/3k1`);
    assert.equal(p.image, `/api/og?kind=seed&who=${encodeURIComponent(DID)}&rkey=3k1`);
    assert.deepEqual([p.card.type, p.card.what, p.card.state, p.card.person.name, p.card.person.handle], ['seed', 'Idea', 'open', 'Alice', HANDLE]);
    assert.match(p.card.plant, /^seed(-\d+)?$/);
  }
  assert.deepEqual([...new Set(asked)].sort(), ['public.api.bsky.app', 'slingshot.microcosm.blue'], 'only the two fixed hosts are ever asked');
});

test('a Rainshare name wins over the Bluesky one, and a done ask says so', async () => {
  records[`${PROFILE}/self`] = { $type: PROFILE, displayName: 'Alice on Rainshare', plans: ['claude'] };
  records[`${SEED}/3k1`].state = 'sprouted';
  const p = await describe({ kind: 'seed', who: DID, rkey: '3k1' });
  assert.equal(p.card.person.name, 'Alice on Rainshare');
  assert.equal(p.card.state, 'done');
  assert.match(p.description, /done with help from someone else’s agent/);
  assert.match(p.card.plant, /^seedling(-\d+)?$/, 'drawn one stage on, as the app draws it');
});

test('what can’t or shouldn’t be shown gets the home page’s words, never an error', async () => {
  const home = async q => assert.equal(await describe(q), HOME, JSON.stringify(q));
  await home({});
  await home({ kind: 'nope' });
  await home({ kind: 'seed', who: HANDLE, rkey: 'missing' });
  await home({ kind: 'seed', who: 'not a handle', rkey: '3k1' });
  await home({ kind: 'seed', who: '../../etc/passwd', rkey: '3k1' });
  await home({ kind: 'seed', who: 'https://evil.example', rkey: '3k1' });
  await home({ kind: 'seed', who: HANDLE, rkey: '../x' });
  await home({ kind: 'person', who: 'nobody.test' });
  // An ask that's only for some people is shown only to them in the app: its preview says nothing about it.
  records[`${SEED}/3k1`].audience = { $type: `${SEED}#mutuals` };
  await home({ kind: 'seed', who: HANDLE, rkey: '3k1' });
  // A cache that answers with someone else's record isn't believed.
  records[`${SEED}/3k1`].audience = { $type: `${SEED}#anyone` };
  const real = globalThis.fetch;
  globalThis.fetch = async input => { const r = await real(input); if (!String(input).includes('getRecord')) return r; const b = await r.json(); return json({ ...b, uri: String(b.uri || '').replace(DID, 'did:plc:mallory') }, r.status); };
  try { await home({ kind: 'seed', who: DID, rkey: '3k1' }); } finally { globalThis.fetch = real; }
  // The network not answering in time.
  globalThis.fetch = () => new Promise((_, no) => setTimeout(() => no(new Error('slow')), 50));
  try { assert.equal(await describe({ kind: 'seed', who: HANDLE, rkey: '3k1' }, { budget: 10 }), HOME); } finally { globalThis.fetch = real; }
});

test('a person’s page, and the pages that say the same to everyone', async () => {
  const p = await describe({ kind: 'person', who: HANDLE });
  assert.deepEqual([p.kind, p.title, p.path, p.card.person.bio], ['person', 'Alice · Rainshare', `/u/${HANDLE}`, 'I make small tools.']);
  assert.equal(p.card.person.avatar, profile.avatar);
  profile.avatar = 'https://evil.example/a.jpg';
  assert.equal((await describe({ kind: 'person', who: HANDLE })).card.person.avatar, null, 'a picture from anywhere but Bluesky’s image host is left out');
  for (const kind of ['agents', 'example']) {
    const f = await describe({ kind });
    assert.equal(f.kind, kind); assert.match(f.title, / · Rainshare$/); assert.equal(f.image, `/api/og?kind=${kind}`); assert.equal(f.card.type, 'page');
  }
});

test('what strangers wrote can’t break out of the page’s tags', async () => {
  records[`${SEED}/3k1`].title = 'Nice"><script>alert(1)</script><meta content="';
  records[`${SEED}/3k1`].spec = '</title><script>alert(2)</script> &amp; "quotes" \u202e reversed \u0000 nul';
  profile.displayName = '"><img src=x onerror=alert(3)>';
  const page = await describe({ kind: 'seed', who: HANDLE, rkey: '3k1' });
  const html = `<!doctype html><html><head><title>Rainshare</title>
<meta name="description" content="old">
<meta property="og:title" content="Rainshare">
<meta property="og:description" content="old">
<meta property="og:url" content="${SITE}/">
<meta property="og:image" content="${SITE}/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:alt" content="old alt">
</head><body><div id="circle"></div><script type="module" src="/assets/index-abc.js"></script></body></html>`;
  const out = withTags(html, page, 'https://preview.example');
  assert.ok(!/<script>alert|<img src=x|onerror=alert\(3\)>/.test(out.replace('<script type="module" src="/assets/index-abc.js"></script>', '')), 'nothing written by a stranger is markup');
  assert.equal((out.match(/<script/g) || []).length, 1, 'the only script is the app’s own');
  assert.equal((out.match(/<meta /g) || []).length, 7, 'and no tag was added or closed early');
  assert.match(out, /<title>Nice&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;&lt;meta content=&quot; · Rainshare<\/title>/);
  assert.match(out, /<meta property="og:image" content="https:\/\/preview\.example\/api\/og\?kind=seed&amp;who=did%3Aplc%3Aalice&amp;rkey=3k1">/);
  assert.match(out, new RegExp(`<meta property="og:url" content="${SITE.replace(/[.]/g, '\\.')}/seed/alice\\.test/3k1">`));
  assert.ok(!/[\u0000\u202e]/.test(out), 'control characters and marks that reorder text are gone');
  assert.ok(out.includes('<div id="circle"></div><script type="module" src="/assets/index-abc.js"></script></body>'), 'the body is untouched');
  // A replacement that contains "$&" or "$1" is written as it is, not read as a pattern.
  records[`${SEED}/3k1`].title = 'Costs $1 and $& more';
  assert.match(withTags(html, await describe({ kind: 'seed', who: HANDLE, rkey: '3k1' }), 'https://x.example'), /<title>Costs \$1 and \$&amp; more · Rainshare<\/title>/);
  // The home page's own tags are left as the build wrote them.
  assert.equal(withTags(html, HOME, 'https://x.example').match(/og:image" content="([^"]*)"/)[1], `${SITE}/og.jpg`);
});

test('text from the network is cleaned and cut to length', () => {
  assert.equal(clean('  a\n\n b\tc  '), 'a b c');
  assert.equal(clean('x'.repeat(50), 10), 'x'.repeat(9) + '…');
  assert.equal([...clean('🦀'.repeat(30), 10)].length, 10, 'by characters, not halves of them');
  assert.equal(clean(null), ''); assert.equal(clean(undefined), ''); assert.equal(clean(42), '42');
});

test('every kind of card is drawn as a tree the renderer takes', () => {
  const person = { did: DID, name: 'Alice', handle: HANDLE, bio: 'I make small tools.', plan: 'Claude' };
  const boxes = (node, out = []) => { if (node && typeof node === 'object' && node.type) { out.push(node); const k = node.props?.children; (Array.isArray(k) ? k : [k]).forEach(c => boxes(c, out)); } return out; };
  for (const card of [
    { type: 'seed', heading: 'A title', what: 'Idea', note: 'Nothing’s been built yet.', state: 'open', plant: 'seed', person },
    { type: 'seed', heading: 'T'.repeat(120), what: 'Project', note: 'x', state: 'done', plant: 'young-3', person: { did: DID, name: 'N'.repeat(64) } },
    { type: 'person', person }, { type: 'person', person: { did: DID, name: '@' + HANDLE } },
    { type: 'page', heading: 'Send your agent', line: 'A line.', plant: 'established-7' }
  ]) {
    const tree = cardFor(card, {});
    assert.ok(tree, card.type);
    // Satori's rule: a box with more than one child lays them out with flex.
    for (const b of boxes(tree)) if (b.type === 'div' && Array.isArray(b.props.children)) assert.equal(b.props.style.display, 'flex', JSON.stringify(b.props.style));
  }
  assert.equal(cardFor(null), null); assert.equal(cardFor({ type: 'nope' }), null);
});

test('every plant picture has its copy for the cards', () => {
  const names = (dir, ext) => readdirSync(fileURLToPath(new URL(dir, import.meta.url))).filter(f => f.endsWith(ext)).map(f => f.slice(0, -ext.length)).sort();
  assert.deepEqual(names('../api/_og/plants/', '.jpg'), names('../public/plants/', '.webp'), 'run npm run plants:og after taking new pictures');
  // …and the logo on a card is the site's own picture of it.
  const bytes = f => readFileSync(fileURLToPath(new URL(f, import.meta.url)));
  assert.ok(bytes('../api/_og/logo.png').equals(bytes('../public/logo.png')), 'run npm run logo after changing the logo');
});
