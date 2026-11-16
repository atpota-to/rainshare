// The bell in the bar (core/notices.js, ui/notices.js): what's news on your asks and your work,
// what's new on Rainshare (core/releases.js), and what counts as new to whoever's looking.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED, TAKE, DELIVERY, COMMENT } from '../core/ns.js';
import { noticesFor, freshIn, markRead, seenFrom, firstSeen, said, WINDOW, FIRST_LOOK, SKEW, MAX } from '../core/notices.js';
import { updatesFor } from '../core/news.js';
import { RELEASES, releasesBy, releasedAt } from '../core/releases.js';
import { renderMarkdown } from '../core/markdown.js';
import { noticePanel, noticeLine, countLabel, bellLabel } from '../ui/notices.js';
import { newsFor } from '../announcer/src/messages.js';
import { createDemoSource } from '../core/demo.js';

const NOW = Date.parse('2026-11-15T12:00:00Z'), HOUR = 3600e3, DAY = 24 * HOUR;
const ME = 'did:plc:me', ADA = 'did:plc:ada', BO = 'did:plc:bo', CY = 'did:plc:cy';
const when = ago => new Date(NOW - ago).toISOString();
const person = did => ({ did, handle: did.slice(8) + '.test', displayName: did[8].toUpperCase() + did.slice(9) });
const ask = (by, rkey, value = {}) => ({ uri: `at://${by}/${SEED}/${rkey}`, cid: 'bafy' + rkey, repo: by, rkey, author: person(by), value: { title: 'Ask ' + rkey, createdAt: when(20 * DAY), ...value }, takes: [], deliveries: [] });
const rec = (by, coll, rkey, seed, ago, value = {}) => ({ uri: `at://${by}/${coll}/${rkey}`, cid: 'bafy' + rkey, repo: by, rkey, author: person(by), value: { seed: { uri: seed.uri, cid: seed.cid }, createdAt: when(ago), ...value } });
const kinds = list => list.map(n => [n.kind, n.by || n.release?.id]);
const none = { releases: [] };

test('what happened on your asks is news, and what you did yourself isn’t', () => {
  const mine = ask(ME, 'm1'), theirs = ask(ADA, 'a1');
  mine.takes = [rec(ADA, TAKE, 't1', mine, 3 * HOUR), rec(ME, TAKE, 't2', mine, 2 * HOUR)];
  mine.deliveries = [rec(BO, DELIVERY, 'd1', mine, HOUR, { url: 'https://github.com/me/app/pull/2' })];
  theirs.takes = [rec(BO, TAKE, 't3', theirs, HOUR)];
  const list = noticesFor(ME, { items: [mine, theirs], now: NOW, ...none });
  assert.deepEqual(kinds(list), [['delivery', BO], ['take', ADA]], 'newest first; not your own take, nor someone else’s ask');
  assert.equal(list[0].person.displayName, 'Bo', 'named as the board names them');
  assert.equal(list[0].url, 'https://github.com/me/app/pull/2');
});

test('someone who turned in work is on it, so that’s said once', () => {
  const mine = ask(ME, 'm1');
  mine.takes = [rec(ADA, TAKE, 't1', mine, 3 * DAY)];
  mine.deliveries = [rec(ADA, DELIVERY, 'd1', mine, DAY)];
  assert.deepEqual(kinds(noticesFor(ME, { items: [mine], now: NOW, ...none })), [['delivery', ADA]]);
});

test('an ask you were on is news when it’s done, with your work or not, or closed', () => {
  const a = ask(ADA, 'a1', { state: 'sprouted', updatedAt: when(DAY) }), b = ask(BO, 'b1', { state: 'sprouted', updatedAt: when(2 * DAY) }), c = ask(CY, 'c1', { state: 'closed', updatedAt: when(3 * DAY) });
  const d = rec(ME, DELIVERY, 'd1', a, 2 * DAY);
  a.deliveries = [d]; a.value.sproutedWith = [{ uri: d.uri, cid: d.cid }];
  b.takes = [rec(ME, TAKE, 't1', b, 4 * DAY)];
  c.takes = [rec(ME, TAKE, 't2', c, 4 * DAY)];
  const list = noticesFor(ME, { items: [a, b, c], now: NOW, ...none });
  assert.deepEqual(kinds(list), [['done-yours', ADA], ['done', BO], ['closed', CY]]);
  // Marked done again later (reopened, then done) is news again: the key carries when it changed.
  const again = noticesFor(ME, { items: [{ ...a, value: { ...a.value, updatedAt: when(HOUR) } }], now: NOW, ...none });
  assert.notEqual(again[0].key, list[0].key);
});

test('comments: on your asks, replying to you, and from whoever asked on one you’re helping with', () => {
  const mine = ask(ME, 'm1'), helping = ask(ADA, 'a1'), other = ask(BO, 'b1');
  helping.takes = [rec(ME, TAKE, 't1', helping, 5 * DAY)];
  const c = (by, rkey, seed, ago, more = {}) => rec(by, COMMENT, rkey, seed, ago, { text: `Comment ${rkey}`, ...more });
  const myQuestion = c(ME, 'q', other, 6 * HOUR);
  const comments = [
    c(ADA, 'c1', mine, HOUR),                                        // on your ask
    c(ME, 'c2', mine, 2 * HOUR),                                     // yours: not news
    c(ADA, 'c3', helping, 3 * HOUR),                                 // the asker, on one you're on
    c(CY, 'c4', helping, 4 * HOUR),                                  // someone else on it: not yours to hear
    myQuestion,
    c(BO, 'c5', other, 5 * HOUR, { parent: { uri: myQuestion.uri, cid: myQuestion.cid } }),  // an answer to you
    c(CY, 'c6', other, 5 * HOUR),                                    // talk on someone else's ask
    { ...c(ADA, 'c7', mine, HOUR), forge: 'tangled' },               // the forge's own: the forge tells you
    c(ADA, 'c8', mine, HOUR, { text: '   ' })                        // nothing said
  ];
  const list = noticesFor(ME, { items: [mine, helping, other], comments, now: NOW, ...none });
  assert.deepEqual(list.map(n => [n.kind, n.uri.split('/').pop()]), [['comment', 'c1'], ['asker', 'c3'], ['reply', 'c5']]);
  assert.equal(list[0].text, 'Comment c1');
  // A comment handed in twice (on the item and read again for the bell) is one notice.
  mine.comments = [comments[0]];
  assert.equal(noticesFor(ME, { items: [mine], comments: [comments[0]], now: NOW, ...none }).length, 1);
});

test('a comment is shown as plain words, with nothing in it a person can’t see', () => {
  assert.equal(said('**Bold** and `code` [a link](https://x.test)'), 'Bold and code a link');
  assert.equal(said('Hi‮there​!'), 'Hi there!');
  assert.ok(said('word '.repeat(80)).length <= 141);
});

test('only the last month, and nothing from further ahead than a clock can drift', () => {
  const mine = ask(ME, 'm1');
  mine.takes = [rec(ADA, TAKE, 'old', mine, WINDOW + HOUR), rec(BO, TAKE, 'soon', mine, -SKEW / 2), rec(CY, TAKE, 'later', mine, -2 * SKEW)];
  assert.deepEqual(kinds(noticesFor(ME, { items: [mine], now: NOW, ...none })), [['take', BO]]);
});

test('at most MAX, the newest', () => {
  const mine = ask(ME, 'm1');
  mine.takes = Array.from({ length: MAX + 10 }, (_, i) => rec(`did:plc:p${i}`, TAKE, 't' + i, mine, (i + 1) * HOUR));
  const list = noticesFor(ME, { items: [mine], now: NOW, ...none });
  assert.equal(list.length, MAX);
  assert.equal(list[0].by, 'did:plc:p0');
});

test('signed out, there’s only what’s new on Rainshare', () => {
  const releases = [{ id: 'a', date: '2026-11-14', title: 'A', summary: 'A.' }, { id: 'b', date: '2026-11-20', title: 'Later', summary: 'Not yet.' }, { id: 'c', date: '2026-09-01', title: 'Old', summary: 'Long ago.' }];
  const list = noticesFor(null, { items: [ask(ADA, 'a1')], releases, now: NOW });
  assert.deepEqual(kinds(list), [['release', 'a']], 'not one dated after today, nor one from before the last month');
});

test('the bell and the direct messages say the same things', () => {
  const mine = ask(ME, 'm1', { audience: { $type: `${SEED}#anyone` } }), theirs = ask(ADA, 'a1', { state: 'sprouted', updatedAt: when(HOUR) });
  mine.takes = [rec(ADA, TAKE, 't1', mine, 3 * HOUR), rec(BO, TAKE, 't2', mine, 2 * HOUR)];
  mine.deliveries = [rec(ADA, DELIVERY, 'd1', mine, HOUR)];
  theirs.takes = [rec(ME, TAKE, 't3', theirs, DAY)];
  const items = [mine, theirs], from = NOW - DAY * 2, to = NOW;
  const takes = items.flatMap(i => i.takes), deliveries = items.flatMap(i => i.deliveries);
  const dm = newsFor({ did: ME, updates: true }, { seeds: items, takes, deliveries, from, to, now: NOW }).updates.map(n => [n.kind, n.by]).sort();
  assert.deepEqual(dm, [['delivery', ADA], ['done', ADA], ['take', BO]], 'something to compare');
  const bell = noticesFor(ME, { items, now: NOW, ...none }).map(n => [n.kind, n.by]).sort();
  assert.deepEqual(bell, dm);
  assert.deepEqual(updatesFor(ME, { seeds: items, takes, deliveries, from, to }).map(n => [n.kind, n.by]).sort(), dm);
});

test('the first time, the last week is new and anything older isn’t; opening the bell sees it all', () => {
  const list = [{ key: 'a', at: NOW - HOUR }, { key: 'b', at: NOW - FIRST_LOOK + HOUR }, { key: 'c', at: NOW - FIRST_LOOK - HOUR }];
  assert.deepEqual([...freshIn(list, null, NOW)], ['a', 'b']);
  const seen = markRead(list, null, NOW);
  assert.equal(freshIn(list, seen, NOW).size, 0);
  // Something written before the bell was opened that only reached the network afterwards is still new.
  const late = [{ key: 'late', at: NOW - 2 * HOUR }, ...list];
  assert.deepEqual([...freshIn(late, seen, NOW + HOUR)], ['late']);
  // Where someone started stays put, so what's new doesn't drift with the clock.
  assert.equal(markRead(late, seen, NOW + 30 * DAY).since, seen.since);
  assert.equal(firstSeen(NOW).since, new Date(NOW - FIRST_LOOK).toISOString());
});

test('whatever was kept in the browser, what’s seen is read safely', () => {
  for (const junk of [null, 'x', 42, [], {}, { since: 'not a day' }, { since: null, keys: ['a'] }]) assert.equal(seenFrom(junk), null, JSON.stringify(junk));
  assert.deepEqual(seenFrom({ since: '2026-11-01T00:00:00Z', keys: ['a', 3, null, 'b'] }), { since: '2026-11-01T00:00:00.000Z', keys: ['a', 'b'] });
  assert.equal(seenFrom({ since: '2026-11-01T00:00:00Z', keys: Array.from({ length: 900 }, (_, i) => 'k' + i) }).keys.length, 500);
});

test('the release notes: each with its own name and a real day, newest first, and Markdown that renders', () => {
  const ids = RELEASES.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length, 'every id is its own');
  for (const r of RELEASES) {
    assert.match(r.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, r.id);
    assert.ok(Number.isFinite(releasedAt(r)) && new Date(releasedAt(r)).toISOString().slice(0, 10) === r.date, `${r.id}: ${r.date} is a day`);
    assert.ok(typeof r.title === 'string' && r.title.trim() && r.title.length <= 80, `${r.id}: a short title`);
    assert.ok(typeof r.summary === 'string' && r.summary.trim() && r.summary.length <= 160, `${r.id}: a one-sentence summary`);
    if (r.text != null) assert.ok(typeof r.text === 'string' && r.text.length <= 300 && renderMarkdown(r.text).includes('<p>'), `${r.id}: a sentence or two of Markdown`);
  }
  assert.deepEqual(ids, [...RELEASES].sort((a, b) => releasedAt(b) - releasedAt(a)).map(r => r.id), 'the newest goes at the top');
  assert.deepEqual(releasesBy(Date.parse('2000-01-01')), [], 'none is out before its day');
});

test('the panel: links go where each notice is about, and nothing anyone wrote becomes markup', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const seed = { ...ask(ADA, 'a1'), value: { title: evil } };
  const list = [
    { key: 'comment:x', kind: 'comment', at: NOW - HOUR, seed, by: ADA, person: { did: ADA, displayName: evil }, text: evil },
    { key: 'release:notifications', kind: 'release', at: NOW - DAY, release: RELEASES.find(r => r.id === 'notifications') }
  ];
  const html = noticePanel({ list }, { href: p => '/example/' + p, fresh: new Set(['comment:x']) });
  assert.ok(!html.includes('<img'), 'escaped');
  assert.ok(html.includes(`href="/example/seed/${ADA}/a1#comments"`), 'a comment opens its ask at the comments');
  assert.ok(html.includes('href="/example/releases#notifications"'), 'a note opens its place on What’s new');
  assert.equal((html.match(/rd-new/g) || []).length, 1, 'only what’s new is lit');
  assert.match(noticePanel({ list: [] }), /Nothing yet/);
  assert.match(noticePanel({ list: [list[1]] }), /Nothing yet/, 'release notes alone still say nothing’s happened on your asks');
  assert.doesNotMatch(noticePanel({ list: [], loading: true }), /Nothing yet/);
  assert.match(noticePanel({ list: [], loading: true }), /Looking/);
  assert.match(noticePanel({ list: [], error: true }), /couldn’t be checked/);
  for (const kind of ['take', 'delivery', 'done-yours', 'done', 'closed', 'comment', 'reply', 'asker']) assert.ok(noticeLine({ kind, seed, by: ADA }).html, kind);
});

test('the count on the bell', () => {
  assert.deepEqual([0, 1, 9, 10, 99].map(countLabel), ['', '1', '9', '9+', '9+']);
  assert.equal(bellLabel(0), 'Notifications');
  assert.equal(bellLabel(3), 'Notifications, 3 new');
  assert.equal(bellLabel(12), 'Notifications, more than 9 new');
});

test('the example board’s bell has something on it', async () => {
  const src = createDemoSource({ groups: false });
  const list = noticesFor(src.viewer, { items: (await src.board()).items, ...none });
  const got = new Set(list.map(n => n.kind));
  for (const k of ['delivery', 'comment', 'done-yours']) assert.ok(got.has(k), k);
  assert.ok(list.every(n => n.by !== src.viewer), 'nothing of your own');
});
