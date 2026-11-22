// Asks that are open but probably done: a pull request for one was merged, or its issue was
// closed, and nobody has marked it done yet. The board asks the forge about every open ask so it
// can say so before anyone directs their agent at one, keeps what it heard for a while, and asks
// GitHub as little as it can. And Rainshare's own "are you sure?" in place of the browser's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED } from '../core/ns.js';
import { parseSubject } from '../core/subjects.js';
import { look, standing, carry, notesOf } from '../core/status.js';
import { confirmHtml } from '../ui/confirm.js';

const now = Date.parse('2026-11-21T12:00:00Z');
const seed = (subject, extra = {}) => ({
  uri: 'at://did:plc:ewan/dev.rainshare.seed/3kseedkey9', repo: 'did:plc:ewan', author: { handle: 'ewan.example', displayName: 'Ewan' },
  value: { title: 'Sync makes duplicates', subject }, ...extra
});
const kai = { repo: 'did:plc:kai', author: { handle: 'kai.example' } };
const delivery = (url, state) => ({ ...kai, uri: 'at://did:plc:kai/dev.rainshare.delivery/1', value: { url, createdAt: '2026-11-20T00:00:00Z' }, ...(state === undefined ? {} : { state }) });

test('an open ask whose pull request was merged, or whose issue was closed, is probably done', () => {
  const sub = parseSubject('https://github.com/ewan/pkgs/issues/98');
  const of = extra => standing(seed(sub, extra), { now });
  assert.equal(of({}).settled, false);
  assert.equal(of({ deliveries: [delivery('https://github.com/ewan/pkgs/pull/116', 'open')] }).settled, false);
  // turned in here and merged, or only mentioning it and merged, or the issue closed
  assert.equal(of({ deliveries: [delivery('https://github.com/ewan/pkgs/pull/116', 'merged')] }).settled, true);
  const stray = of({ linked: [{ url: 'https://github.com/ewan/pkgs/pull/116', number: 116, by: 'kai', state: 'merged' }] });
  assert.deepEqual([stray.verdict, stray.settled, stray.planter.do], ['merged', true, 'look']);
  assert.equal(of({ issue: { state: 'closed' } }).settled, true);
  // Done or closed isn't "probably": it's said outright, and it isn't on the open board.
  assert.equal(of({ value: { ...seed(sub).value, state: 'sprouted' }, deliveries: [delivery('https://github.com/ewan/pkgs/pull/116', 'merged')] }).settled, false);
  assert.equal(of({ value: { ...seed(sub).value, state: 'closed' }, issue: { state: 'closed' } }).settled, false);
});

test('what the forge said is kept small, and put back on a later copy of the ask for a while', () => {
  const sub = parseSubject('https://github.com/ewan/pkgs/issues/98');
  const looked = seed(sub, {
    lookedAt: now - 60e3,
    issue: { title: 'Sync makes duplicates', body: 'A long description…'.repeat(200), state: 'closed', url: 'https://github.com/ewan/pkgs/issues/98' },
    linked: [{ url: 'https://github.com/ewan/pkgs/pull/116', number: 116, title: 'Fix sync', by: 'kai', state: 'merged', extra: 'dropped' }],
    deliveries: [delivery('https://github.com/ewan/pkgs/pull/116', 'merged'), { ...delivery('https://github.com/ewan/pkgs/pull/117'), uri: 'at://did:plc:kai/dev.rainshare.delivery/2' }]
  });
  const notes = JSON.parse(JSON.stringify(notesOf(looked)));
  // The issue's body isn't kept, a pull request's unknown state isn't either, and nothing beyond what standing reads.
  assert.deepEqual(notes.issue, { title: 'Sync makes duplicates', state: 'closed', url: 'https://github.com/ewan/pkgs/issues/98' });
  assert.deepEqual(notes.linked, [{ url: 'https://github.com/ewan/pkgs/pull/116', number: 116, title: 'Fix sync', by: 'kai', state: 'merged' }]);
  assert.deepEqual(notes.deliveries, [{ uri: 'at://did:plc:kai/dev.rainshare.delivery/1', state: 'merged' }]);
  assert.equal(notesOf(seed(sub)), null);   // never asked
  // A board read again is new copies: within the half hour they're drawn knowing it, and after it they aren't.
  const later = carry(notes, seed(sub, { deliveries: [delivery('https://github.com/ewan/pkgs/pull/116')] }), { maxAge: 30 * 60e3, now });
  assert.deepEqual([later.issue.state, later.linked.length, later.deliveries[0].state, later.lookedAt], ['closed', 1, 'merged', now - 60e3]);
  assert.equal(standing(later, { now }).settled, true);
  assert.equal(carry(notes, seed(sub), { maxAge: 30 * 60e3, now: now + 31 * 60e3 }).issue, undefined);
});

test('the forge is asked as little as it can be: a pull request in the list isn’t asked about again, and asks on one repo share its list', async () => {
  const asked = [], real = globalThis.fetch;
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  globalThis.fetch = async input => {
    const u = new URL(String(input));
    asked.push(u.pathname);
    if (u.host !== 'api.github.com') return json({ error: 'NotFound' }, 404);
    if (u.pathname === '/repos/ewan/sharedrepo/pulls') return json([
      { number: 116, html_url: 'https://github.com/ewan/sharedrepo/pull/116', title: 'Fix duplicate records on sync', body: 'Fixes #98', state: 'closed', merged_at: '2026-11-21T09:00:00Z', user: { login: 'kai' } },
      { number: 115, html_url: 'https://github.com/ewan/sharedrepo/pull/115', title: 'Rocksky lexicons', body: 'Part of #88', state: 'open', merged_at: null, user: { login: 'sam' } }
    ]);
    if (u.pathname === '/repos/ewan/sharedrepo/issues/98') return json({ title: 'Sync makes duplicates', body: '…', state: 'closed', html_url: 'https://github.com/ewan/sharedrepo/issues/98' });
    if (u.pathname === '/repos/ewan/sharedrepo/issues/88') return json({ title: 'Rocksky', body: '…', state: 'open', html_url: 'https://github.com/ewan/sharedrepo/issues/88' });
    if (u.pathname === '/repos/ewan/sharedrepo/pulls/200') return json({ state: 'open', merged_at: null });
    return json({ message: 'Not Found' }, 404);
  };
  try {
    // Two asks for the same issue: one has the pull request turned in, the other has nothing.
    const turnedIn = seed(parseSubject('https://github.com/ewan/sharedrepo/issues/98'), { deliveries: [delivery('https://github.com/ewan/sharedrepo/pull/116')] });
    const twin = { ...seed(parseSubject('https://github.com/ewan/sharedrepo/issues/98')), uri: 'at://did:plc:ewan/dev.rainshare.seed/3kseedkey8' };
    // A third, on another issue, with a pull request turned in that isn't in the recent list.
    const other = { ...seed(parseSubject('https://github.com/ewan/sharedrepo/issues/88'), { deliveries: [{ ...delivery('https://github.com/ewan/sharedrepo/pull/200'), uri: 'at://did:plc:kai/dev.rainshare.delivery/3' }] }), uri: 'at://did:plc:ewan/dev.rainshare.seed/3kseedkey7' };
    await Promise.all([look(turnedIn), look(twin), look(other)]);
    assert.equal(asked.filter(p => p === '/repos/ewan/sharedrepo/pulls').length, 1, 'one list for the repository');
    assert.ok(!asked.includes('/repos/ewan/sharedrepo/pulls/116'), 'the merged one was in the list');
    assert.ok(asked.includes('/repos/ewan/sharedrepo/pulls/200'), 'the one that wasn’t is asked about');
    assert.equal(turnedIn.deliveries[0].state, 'merged');
    // Both asks for #98 come out probably done, including the one nobody turned anything in for.
    const a = standing(turnedIn, { now }), b = standing(twin, { now }), c = standing(other, { now });
    assert.deepEqual([a.verdict, a.settled], ['merged', true]);
    // (Whoever asked is told a pull request that mentions it was merged, and to mark it done if it did the job.)
    assert.deepEqual([b.verdict, b.settled, b.planter.do], ['merged', true, 'look']);
    assert.deepEqual([c.verdict, c.settled], ['turned-in', false]);
  } finally { globalThis.fetch = real; }
});

test('Rainshare’s own "are you sure?" says what each button does, escapes what it’s given, and is red only for what can’t be undone', () => {
  const plain = confirmHtml({ title: 'Unhide it?', text: 'It shows again for everyone.', yes: 'Unhide', no: 'Cancel' });
  assert.match(plain, /<h2 id="rsCfTitle" tabindex="-1">Unhide it\?<\/h2>/);
  assert.match(plain, /<p class="rs-cf-text" id="rsCfText">It shows again for everyone\.<\/p>/);
  assert.match(plain, /data-cf="no">Cancel<\/button><button class="rs-btn rs-primary" type="button" data-cf="yes">Unhide<\/button>/);
  assert.doesNotMatch(plain, /rs-cf-points|rs-cf-bad/);
  const bad = confirmHtml({ title: 'Delete <b>this</b>?', yes: 'Delete', no: 'Keep it', tone: 'danger', points: ['one "quoted"', '<script>'] });
  assert.match(bad, /Delete &lt;b&gt;this&lt;\/b&gt;\?/);
  assert.match(bad, /<li>one &quot;quoted&quot;<\/li><li>&lt;script&gt;<\/li>/);
  assert.match(bad, /class="rs-btn rs-primary rs-cf-bad" type="button" data-cf="yes">Delete</);
  assert.doesNotMatch(bad, /rs-cf-text/);   // no text, no empty paragraph
  // An unknown tone is the plain one.
  assert.doesNotMatch(confirmHtml({ title: 'x', tone: 'nonsense' }), /rs-cf-bad/);
});
