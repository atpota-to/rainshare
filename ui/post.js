// Asking for rain, in three short steps with a preview beside them of how it will look:
// what it is (an idea, or a project and where it lives), what you'd like done (with how,
// folded away under "More options"), and who it's for. Then a confirmation that says who
// can see it and what happens next.
//
// rainshare.js owns the screen and hands in what this needs as `ui`; this keeps the draft
// (so it survives leaving and coming back) and draws the steps.
import { SEED, STAGES, MODEL_PICKS, GROUPS, modelName } from '../core/ns.js';
import { parseSubject, describeSubject, kindOf, subjectInfo, knotlessIssueSubject } from '../core/subjects.js';
import { newRepoPlaces } from '../core/forges.js';
import { whereText, shortWhere, jobText, jobShort, wantsText, wantsShort, askExcerpt, stageOf, aNoun } from '../core/words.js';
import { join } from '../core/rank.js';
import { pageOf } from '../core/brief.js';
import { esc, ago, ico, forgeIco, face, people, pathOf, plantPic } from './bits.js';

const STEPS = ['What', 'Details', 'Who'];
// A project says how far along it is (and is drawn as a plant that far grown).
const PLANT_STAGES = STAGES.filter(([k]) => k !== 'seed');
const KINDS = [
  ['tangled', 'A Tangled issue', 'Pick from your Tangled repos'],
  ['knotless', 'A knotless issue', 'Pick from your knotless repos'],
  ['github', 'A GitHub issue', 'Paste its link'],
  ['repo', 'Any git repo', 'Codeberg, GitLab, your own server']
];
const TEST_PICKS = [['required', 'Required'], ['welcome', 'Welcome'], ['none', 'Not needed']];
const SIZE_PICKS = [['tiny', 'Tiny', 'minutes'], ['small', 'Small', 'an evening'], ['medium', 'Medium', 'a weekend'], ['large', 'Large', 'longer']];
// Everyone first: it's where an ask is most likely to find someone with rain to spare.
const AUDIENCE_PICKS = [
  ['anyone', 'Everyone', 'Anyone on Rainshare'],
  ['mutuals', 'Mutuals', 'People you follow who follow you back'],
  ['following', 'People I follow', 'Anyone you follow on Bluesky'],
  ['followers', 'My followers', 'Anyone who follows you on Bluesky'],
  ['list', 'A Bluesky list', 'People on one of your lists']
];
const FOR = { mutuals: 'your mutuals', following: 'people you follow', followers: 'your followers', list: 'the people on your list', anyone: 'everyone' };
const TESTS_SAID = { required: 'tests required', welcome: 'tests welcome', none: 'no tests needed' };
const HINTS = {
  1: 'Pointing at an issue lets a helper’s agent read the whole conversation on it, not just your summary.',
  2: 'A helper’s agent gets your words as your request, not as orders, so plain and specific beats long.'
};
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const members = n => n === 1 ? '1 member' : `${Number(n).toLocaleString('en')} members`;
const list = s => String(s || '').split(',').map(x => x.trim().replace(/^#/, '')).filter(Boolean);

const fresh = () => ({
  step: 1, reached: 1, done: null, busy: false, err: '',
  stage: null,       // what's being planted: 'seed' (an idea), or a plant: 'seedling', 'young' or 'established'
  kind: null, link: '', subject: null, info: null, prefilled: false,
  repos: null, repo: null, issues: null,
  title: '', spec: '', specUrl: '',
  more: false,       // whether "More options" (models, tests, size, tags…) is open
  models: [], otherModel: '', tests: 'welcome', size: 'small', maxDiffLines: '', tags: '', values: '', notes: '',
  vis: 'public', audience: 'anyone', list: null, group: null, parallel: false,
  owner: 'helper',   // for an idea: whoever builds it keeps it ('helper'), or it's started for you ('requester')
  lists: null, groups: null, reach: null,
  bsky: true, bskyText: null
});

export function createPoster(ui){
  let P = fresh();
  const src = () => ui.source();

  /* ---------- loading what the steps offer ---------- */
  async function loadBits(){
    const s = src(), mine = P;
    P.lists = P.groups = undefined;
    const [lists, groups, reach] = await Promise.all([
      s.lists().catch(() => []),
      s.canPrivate ? s.groups().catch(() => []) : [],
      s.reach ? s.reach().catch(() => null) : null
    ]);
    if (P !== mine) return;
    Object.assign(P, { lists, groups, reach });
    if (!P.list && lists[0]) P.list = lists[0].uri;
    if (!P.group) P.group = groups.find(g => g.space)?.did || null;
    if (P.step >= 3) ui.render();
  }
  // Tangled and knotless can both list your repos and their open issues, so both are picked
  // from the same way. What differs is what each calls a repo, and the subject it makes.
  const PICKERS = {
    tangled: { name: 'Tangled', sample: 'https://tangled.org/you/repo/issues/12', id: r => r.repoDid, repos: () => src().tangledRepos(), issues: id => src().tangledIssues(id),
      repo: r => ({ $type: `${SEED}#repo`, url: r.url, forge: 'tangled', repoDid: r.repoDid, name: r.url.replace('https://tangled.org/', '') }),
      issue: (r, i, id) => ({ $type: `${SEED}#tangledIssue`, uri: i.uri, cid: i.cid, repo: id, ...(r?.url ? { repoUrl: r.url } : {}) }) },
    knotless: { name: 'knotless', sample: 'https://knotless.dev/you.bsky.social/repo/issue/…', id: r => r.uri, repos: () => src().knotlessRepos(), issues: id => src().knotlessIssues(id),
      repo: r => ({ $type: `${SEED}#repo`, url: r.url, forge: 'knotless', name: r.url.replace('https://knotless.dev/', '') }),
      issue: (r, i) => knotlessIssueSubject(r.url, i.uri) }
  };
  const picker = () => PICKERS[P.kind] || null;
  const repoOf = id => Array.isArray(P.repos) ? P.repos.find(r => picker()?.id(r) === id) : null;
  async function loadRepos(){
    const mine = P, pk = picker(); if (!pk) return;
    Object.assign(P, { repos: 'loading', reposOf: P.kind, repo: null, issues: null }); ui.render();
    const kind = P.kind; let got;
    try { got = await pk.repos(); } catch (e) { got = { error: e }; }
    if (P !== mine || P.reposOf !== kind || P.kind !== kind) return;   // they've moved on to another forge
    P.repos = got;
    if (Array.isArray(P.repos) && P.repos.length === 1 && !P.subject) return loadIssues(pk.id(P.repos[0]));
    ui.render();
  }
  async function loadIssues(id){
    const mine = P, pk = picker(), repo = repoOf(id); if (!pk) return;
    Object.assign(P, { repo: id, issues: 'loading', subject: repo ? pk.repo(repo) : null, whole: true, info: null, link: '' });
    ui.render();
    try { P.issues = await pk.issues(id); } catch (e) { P.issues = { error: e }; }
    if (P === mine) ui.render();
  }
  function pickIssue(uri){
    const pk = picker(), repo = repoOf(P.repo), issue = Array.isArray(P.issues) ? P.issues.find(i => i.uri === uri) : null;
    P.subject = issue ? pk.issue(repo, issue, P.repo) : repo ? pk.repo(repo) : null;
    P.whole = !issue;
    P.info = issue ? { title: issue.title, body: issue.body } : null;
    P.link = '';
  }
  // A pasted link: what it points at shows under the field as you type, and a GitHub issue's
  // title is looked up so the next step can start from it.
  let infoTimer;
  function setLink(value){
    P.link = value; P.subject = parseSubject(value); P.info = null;
    if (P.subject) P.repo = null;
    clearTimeout(infoTimer);
    const sub = P.subject;
    if (sub && /Issue$/.test(kindOf(sub) || '')) infoTimer = setTimeout(async () => {
      const info = await subjectInfo(sub);
      if (P.subject === sub && info) { P.info = info; paint(); }
    }, 350);
    paint();
  }

  /* ---------- the draft, as a record and in words ---------- */
  const subjectNow = () => P.kind === 'idea' ? null : P.subject;
  const groupNow = () => (P.groups || []).find(g => g.did === P.group && g.space) || null;
  const listNow = () => (P.lists || []).find(l => l.uri === P.list) || null;
  function input(){
    return {
      title: P.title, subject: subjectNow(), stage: P.stage || undefined, owner: P.kind === 'idea' ? P.owner : undefined, spec: P.spec, specUrl: P.specUrl, tags: P.tags, values: P.values, size: P.size, parallel: P.parallel,
      wants: P.kind === 'idea' && P.owner === 'helper' ? { notes: P.notes.trim() }
        : { models: [...new Set([...P.models, ...list(P.otherModel)])], tests: P.tests, maxDiffLines: parseInt(P.maxDiffLines, 10) || undefined, notes: P.notes.trim() },
      audience: P.audience, list: P.audience === 'list' ? P.list : undefined
    };
  }
  const countFor = aud => aud === 'list' ? listNow()?.count ?? null : aud === 'anyone' ? null : P.reach?.[aud] ?? null;
  function whoFor(){
    if (P.vis === 'group') { const g = groupNow(); return g ? `private to ${g.name}` : 'private to a group'; }
    return P.audience === 'anyone' ? 'open to everyone' : 'for ' + FOR[P.audience];
  }
  function reachText(){
    if (P.vis === 'group') { const g = groupNow(); return !g ? 'Pick a group that has Rainshare.' : g.memberCount ? `The ${members(g.memberCount)} of ${g.name} could see it.` : `${g.name}’s members could see it.`; }
    if (P.audience === 'anyone') return 'Anyone who comes to Rainshare could see it and take it on.';
    const n = countFor(P.audience);
    return `${cap(FOR[P.audience])}${n != null ? `, about ${people(n)},` : ''} could see it when they come to Rainshare. A Bluesky post is how they’ll know it’s there.`;
  }
  function doneText(){
    const g = P.done?.group;
    if (g) return g.memberCount ? `The ${members(g.memberCount)} of ${g.name} can see it on their board now, and nobody else.` : `${g.name}’s members can see it on their board now, and nobody else.`;
    if (P.audience === 'anyone') return 'Anyone who comes to Rainshare can see it now and take it on.';
    const n = countFor(P.audience);
    return `${cap(FOR[P.audience])}${n != null ? ` (about ${people(n)})` : ''} can see it whenever they come to Rainshare.`;
  }
  function whereLong(sq){
    if (P.kind === 'idea' || !sq.subject) return sq.owner === 'helper' ? 'Nowhere yet. It’s an idea for someone else to run with: whoever builds it keeps it, in their own repo.'
      : 'Nowhere yet. It’s just an idea, so a helper can start a repo for you or suggest where it should live.';
    const t = P.info?.title, d = describeSubject(sq.subject);
    if (t && kindOf(sq.subject) === 'githubIssue') return `GitHub issue #${sq.subject.number} “${t}” in ${d.repo || d.label}`;
    if (t && kindOf(sq.subject) === 'tangledIssue') return `Tangled issue “${t}”${d.repo ? ' in ' + d.repo : ''}`;
    if (t && kindOf(sq.subject) === 'knotlessIssue') return `knotless issue “${t}”${d.repo ? ' in ' + d.repo : ''}`;
    return whereText(sq);
  }
  function howText(sq){
    const w = sq.wants || {}, names = (w.models || []).map(modelName);
    const first = [sq.size ? `a ${sq.size} job` : '', TESTS_SAID[w.tests] || '', names.length ? `ideally with ${join(names, 'or')}` : ''].filter(Boolean).join(', ');
    const out = [first ? cap(first) + '.' : ''];
    if (w.maxDiffLines) out.push(`Under about ${w.maxDiffLines} lines.`);
    if (w.notes) out.push(w.notes.replace(/([^.!?])$/, '$1.'));
    if (list(sq.tags).length) out.push(`Tagged ${join(list(sq.tags))}.`);
    if (list(sq.values).length) out.push(`It stands for ${join(list(sq.values))}.`);
    return out.filter(Boolean).join(' ') || 'Whatever a helper thinks best.';
  }
  function whoText(){
    const one = P.parallel ? 'More than one helper can try at once.' : 'One helper at a time.';
    if (P.vis === 'group') { const g = groupNow(); return `${g ? `Only ${g.name}’s ${g.memberCount ? members(g.memberCount) : 'members'}` : 'A group'}, privately. ${one}`; }
    if (P.audience === 'anyone') return `Everyone. ${one}`;
    if (P.audience === 'list') { const l = listNow(); return `${l ? `People on “${l.name}”, ${people(l.count)}` : 'People on one of your lists'}. ${one}`; }
    const n = countFor(P.audience);
    if (n == null) return `${cap(FOR[P.audience])}. ${one}`;
    return `${P.audience === 'following' ? `The ${people(n)} you follow` : `${cap(FOR[P.audience])}, about ${people(n)}`}. ${one}`;
  }
  const bskyDefault = () => P.kind === 'idea' && P.owner === 'helper' ? `I’d love to see someone build this: “${P.title.trim()}”. It’s yours to run with, if you have agent usage to spare.`
    : `Got spare agent usage? I’d love a hand with this: “${P.title.trim()}”.${P.size ? ` It’s a ${P.size} one${P.tests === 'required' ? ' with tests' : ''}.` : ''}`;
  const bskyText = () => (P.bskyText ?? bskyDefault()).trim();

  /* ---------- moving between steps ---------- */
  function problem(step){
    if (step === 1) {
      if (!P.stage) return 'Pick one: an idea or a project.';
      if (P.stage === 'seed') return '';
      if (!P.kind || P.kind === 'idea') return 'Pick where it lives.';
      if (P.link.trim() && !P.subject) return 'That link isn’t one we understand. Paste the issue’s or the repo’s address.';
      if (!P.subject) return { tangled: 'Pick one of your repos, or paste a Tangled link.', knotless: 'Pick one of your repos, or paste a knotless link.', github: 'Paste the issue’s link, or the repo’s.', repo: 'Paste where to clone it from.' }[P.kind];
    }
    if (step === 2 && !P.title.trim()) return 'Give it a short title.';
    if (step === 3 && P.vis === 'group' && !groupNow()) return 'Pick a group that has Rainshare, or make it public.';
    if (step === 3 && P.vis === 'public' && P.audience === 'list' && !P.list) return 'Pick the list it’s for, or another audience.';
    return '';
  }
  function prefill(){
    if (P.info?.title && !P.title.trim()) { P.title = P.info.title.slice(0, 120); P.prefilled = true; }
    if (P.info?.body && !P.spec.trim()) { P.spec = P.info.body.slice(0, 4000); P.prefilled = true; }
  }
  function goStep(n){
    for (let s = P.step; s < n; s++) {
      const e = problem(s);
      if (e) { P.err = e; P.step = s; ui.render(); ui.root.querySelector('.rs-post .rs-err')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
      if (s === 1) prefill();
    }
    P.err = ''; P.step = n; P.reached = Math.max(P.reached, n);
    ui.render(); arrive();
  }
  // After a step changes: its heading takes focus (for screen readers), and the top of the
  // wizard comes into view if it had scrolled away.
  function arrive(){
    const h = ui.root.querySelector('.rs-post h1');
    if (!h) return;
    h.focus({ preventScroll: true });
    if (h.closest('.rs-post').getBoundingClientRect().top < 0) h.closest('.rs-post').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  async function post(){
    for (const s of [1, 2, 3]) { const e = problem(s); if (e) { P.err = e; P.step = s; ui.render(); return; } }
    P.busy = true; P.err = ''; ui.render();
    try {
      const g = P.vis === 'group' ? groupNow() : null;
      const r = await src().plant(input(), { group: g?.did });
      const item = { uri: r.uri, space: r.space || null, repo: ui.viewer(), rkey: String(r.uri).split('/').pop(), author: ui.self() };
      P.done = { path: pathOf(item), page: item.space ? null : pageOf(item), group: g };
      P.busy = false;
      ui.onPosted(r);
      ui.render(); arrive();
    } catch (e) { P.busy = false; P.err = ui.plainText(e); ui.render(); }
  }
  async function addGroup(did, btn){
    btn.disabled = true; btn.textContent = 'Adding…';
    try { await src().addToGroup(did); P.groups = await src().groups(); P.group = did; ui.toast('Rainshare is in the group now'); ui.render(); }
    catch (e) { ui.toast(ui.plainText(e)); btn.disabled = false; btn.textContent = 'Add it'; }
  }

  /* ---------- drawing ---------- */
  const tile = (attr, v, on, title, note, extra = '') => `<button type="button" class="rs-tile" ${attr}="${esc(v)}" role="radio" aria-checked="${on}"${extra}><b>${esc(title)}</b>${note ? `<small>${esc(note)}</small>` : ''}</button>`;
  const row = (attr, v, on, title, note, aside = '') => `<button type="button" class="rs-option" ${attr}="${esc(v)}" role="radio" aria-checked="${on}"><span class="rs-radio" aria-hidden="true"></span><span class="rs-option-text"><b>${esc(title)}</b>${note ? `<small>${esc(note)}</small>` : ''}</span>${aside ? `<span class="rs-option-aside">${esc(aside)}</span>` : ''}</button>`;
  const found = () => {
    if (P.kind === 'idea' || !P.link.trim()) return '';
    const d = P.subject && describeSubject(P.subject);
    if (!d) return '<span class="rs-unknown">That doesn’t look like a link we know. Paste the issue’s or the repo’s address.</span>';
    if (P.info?.title) return `${forgeIco(d.forge)}<span><b>Found it:</b> ${esc(P.info.title)} · ${kindOf(P.subject) === 'githubIssue' ? `issue #${esc(P.subject.number)}` : 'issue'}${P.info.state ? ' · ' + esc(P.info.state) : ''}</span>`;
    return `${forgeIco(d.forge)}<span>${esc(whereText({ subject: P.subject }))}</span>`;
  };
  function stepWhere(){
    let more = '';
    if (picker()) {
      const pk = picker(), r = P.reposOf === P.kind ? P.repos : null;
      more = `<div class="rs-pick">
        ${r === null || r === 'loading' ? `<p class="rs-muted">Finding your ${pk.name} repos…</p>`
          : r.error ? `<p class="rs-muted">Couldn’t reach ${pk.name} just now. Paste a link instead.</p>`
          : !r.length ? `<p class="rs-muted">No ${pk.name} repos on this account. Paste a link instead.</p>`
          : `<label>Your repo<select data-rs-repo><option value="">Choose a repo…</option>${r.map(x => `<option value="${esc(pk.id(x))}"${P.repo === pk.id(x) ? ' selected' : ''}>${esc(x.name)}${x.description ? ' · ' + esc(x.description.slice(0, 60)) : ''}</option>`).join('')}</select></label>`}
        ${P.issues === 'loading' ? '<p class="rs-muted">Loading its open issues…</p>'
          : P.issues?.error ? '<p class="rs-muted">Couldn’t load its issues. It’ll point at the repo, or paste an issue’s link.</p>'
          : Array.isArray(P.issues) && P.repo ? `<div class="rs-field" role="radiogroup" aria-label="Which issue?"><span>Which issue?</span><div class="rs-options">
            ${P.issues.map(i => row('data-rs-issue', i.uri, P.subject?.uri === i.uri, i.title, i.createdAt ? 'opened ' + ago(i.createdAt) : '')).join('')}
            ${row('data-rs-issue', '', kindOf(P.subject) === 'repo' && !!P.whole, P.issues.length ? 'None of these' : 'No open issues', 'Point at the whole repo')}</div></div>` : ''}
        <label>Or paste a ${pk.name} link<input name="link" inputmode="url" autocomplete="off" placeholder="${esc(pk.sample)}" value="${esc(P.link)}"></label>
      </div>`;
    } else if (P.kind === 'github') {
      more = `<label>The issue’s link <small>or the repo’s</small><input name="link" inputmode="url" autocomplete="off" placeholder="https://github.com/you/repo/issues/12" value="${esc(P.link)}"></label>`;
    } else if (P.kind === 'repo') {
      more = `<label>Where to clone it from<input name="link" inputmode="url" autocomplete="off" placeholder="https://codeberg.org/you/repo" value="${esc(P.link)}"></label>`;
    } else if (P.kind === 'idea') {
      // Whose it'll be decides what a helper does first, so it's asked here rather than left to be worked out.
      more = `<div class="rs-field" role="radiogroup" aria-label="Whose will it be?"><span>Whose will it be?</span><div class="rs-options">
          ${row('data-rs-owner', 'helper', P.owner === 'helper', 'Someone else can run with it', 'Whoever builds it keeps it, in their own repo. You’d just like it to exist.')}
          ${row('data-rs-owner', 'requester', P.owner === 'requester', 'Start it for me', 'A helper sets up the repo and hands it over, or builds it where you say.')}</div></div>
        <p class="rs-muted">${P.owner === 'helper' ? 'You don’t need to be a developer for this one. Say what it should do in the next step, in your own words.'
          : `Or make the empty repo yourself first and point at it: ${newRepoPlaces({ title: P.title }).map(p => `<a href="${esc(p.href)}" target="_blank" rel="noopener">${esc(p.name)}</a>`).join(', ')}.`}</p>`;
    }
    // First what it is: an idea, or a project someone already has. Then, for a project, where
    // it lives and how far along it is. The pictures are the seed and the plant it'd be.
    const plant = !!P.stage && P.stage !== 'seed';
    const stageTile = (v, pic, on, t, n) => `<button type="button" class="rs-tile rs-stage" data-rs-stage="${v}" role="radio" aria-checked="${on}">${plantPic(pic, 84)}<b>${esc(t)}</b><small>${esc(n)}</small></button>`;
    return `<h1 tabindex="-1">What would you like a hand with?</h1>
      <p class="rs-lede">An idea that nothing’s been built for yet, or a project you already have, however far along.</p>
      <div class="rs-tiles rs-stages rs-stages-2" role="radiogroup" aria-label="An idea or a project">
        ${stageTile('seed', 'seed', P.stage === 'seed', 'An idea', 'Nothing’s been built yet.')}
        ${stageTile('plant', plant ? P.stage : 'young', plant, 'A project', 'Something you already have.')}
      </div>
      ${plant ? `<div class="rs-field"><span>Where does it live?</span>
        <div class="rs-tiles" role="radiogroup" aria-label="Where does it live?">${KINDS.map(([k, t, n]) => tile('data-rs-kind', k, P.kind === k, t, n)).join('')}</div></div>` : ''}
      ${more}
      <p class="rs-found" data-rs-found aria-live="polite">${found()}</p>
      ${plant ? `<div class="rs-field" role="radiogroup" aria-label="How far along is it?"><span>How far along is it?</span><div class="rs-options">
        ${PLANT_STAGES.map(([k, t, n]) => row('data-rs-stage', k, P.stage === k, t, n)).join('')}</div></div>` : ''}`;
  }
  // How it should be done: all optional, so it's folded away under the description.
  const moreOptions = (summary, body) => `<details class="rs-more rs-options-more" data-rs-more${P.more ? ' open' : ''}>
      <summary>${summary} <small>optional</small></summary><div class="rs-more-body">${body}</div></details>`;
  function stepWhat(){
    if (P.kind === 'idea') return `<h1 tabindex="-1">What’s the idea?</h1>
      <p class="rs-lede">Say it the way you would to a friend. Plain words are fine.</p>
      <label>A short title<input name="title" maxlength="120" required autocomplete="off" placeholder="A seating chart that shuffles itself" value="${esc(P.title)}"></label>
      <label>What should it do? <small>Who it’s for, what it should do, and anything it shouldn’t.</small>
        <textarea name="spec" rows="10" maxlength="10000" placeholder="I’d love a little tool that… It should… It doesn’t need to…">${esc(P.spec)}</textarea></label>
      <label>Written up somewhere already? <small>Optional: a link to notes or a sketch</small><input name="specUrl" type="url" inputmode="url" placeholder="https://…" value="${esc(P.specUrl)}"></label>
      ${howFields()}`;
    return `<h1 tabindex="-1">What would you like done?</h1>
      <p class="rs-lede">Say it the way you would to a friend.${P.prefilled ? ' We’ve started you off from the issue.' : ''}</p>
      <label>A short title<input name="title" maxlength="120" required autocomplete="off" placeholder="Keep drafts out of the RSS feed" value="${esc(P.title)}"></label>
      <label>What does done look like? <small>What’s wrong, what done looks like, and anything to avoid. Markdown works.</small>
        <textarea name="spec" rows="10" maxlength="10000" placeholder="Right now… It’d be great if… Please don’t…">${esc(P.spec)}</textarea></label>
      <label>A longer spec somewhere? <small>Optional, like a SPEC.md in the repo</small><input name="specUrl" type="url" inputmode="url" placeholder="https://…/SPEC.md" value="${esc(P.specUrl)}"></label>
      ${howFields()}`;
  }
  function howFields(){
    const custom = P.models.filter(m => !MODEL_PICKS.includes(m));
    // An idea given away is the builder's to build their way: only what helps someone find it and size it up is asked.
    if (P.kind === 'idea' && P.owner === 'helper') return moreOptions('More: how big it feels, tags', `
      <p class="rs-muted">It’s theirs to build, so how they build it is up to them. These help the right person find it.</p>
      <fieldset><legend>How big does it feel?</legend><div class="rs-options" role="radiogroup" aria-label="How big does it feel?">${SIZE_PICKS.map(([k, l, n]) => row('data-rs-size', k, P.size === k, l, '', n)).join('')}</div></fieldset>
      <div class="rs-two">
        <label>Tags <small>so the right person finds it</small><input name="tags" autocomplete="off" placeholder="teaching, printing" value="${esc(P.tags)}"></label>
        <label>What it stands for <small>optional</small><input name="values" list="rsValues" autocomplete="off" placeholder="education, accessibility" value="${esc(P.values)}"></label>
      </div>
      <label>Anything else?<input name="notes" maxlength="1000" autocomplete="off" placeholder="It should work on a phone." value="${esc(P.notes)}"></label>`);
    return moreOptions('More options: models, tests, size, tags', `
      <p class="rs-muted">These help the right helpers find it, and their agents get them in the brief.</p>
      <fieldset><legend>Which models would you like?</legend>
        <div class="rs-toggles" data-rs-models>
          <button type="button" data-rs-model="" aria-pressed="${!P.models.length}">Any model</button>
          ${[...MODEL_PICKS, ...custom].map(m => `<button type="button" data-rs-model="${esc(m)}" aria-pressed="${P.models.includes(m)}">${esc(modelName(m))}</button>`).join('')}
        </div>
        <label class="rs-inline">Or name another <input name="otherModel" list="rsModels" autocomplete="off" placeholder="qwen3-coder" value="${esc(P.otherModel)}"></label>
        <small>Helpers who run one of these will see it as a better fit.</small>
      </fieldset>
      <div class="rs-two">
        <fieldset><legend>Tests</legend><div class="rs-options" role="radiogroup" aria-label="Tests">${TEST_PICKS.map(([k, l]) => row('data-rs-tests', k, P.tests === k, l)).join('')}</div></fieldset>
        <fieldset><legend>How big is it?</legend><div class="rs-options" role="radiogroup" aria-label="How big is it?">${SIZE_PICKS.map(([k, l, n]) => row('data-rs-size', k, P.size === k, l, '', n)).join('')}</div></fieldset>
      </div>
      <div class="rs-two">
        <label>Keep the change under <small>lines, optional</small><input name="maxDiffLines" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="200" value="${esc(P.maxDiffLines)}"></label>
        <label>Tags <small>so helpers can find it</small><input name="tags" autocomplete="off" placeholder="go, rss" value="${esc(P.tags)}"></label>
      </div>
      <div class="rs-two">
        <label>What it stands for <small>optional</small><input name="values" list="rsValues" autocomplete="off" placeholder="accessibility, climate" value="${esc(P.values)}"></label>
        <label>Anything else?<input name="notes" maxlength="1000" autocomplete="off" placeholder="No new dependencies, please." value="${esc(P.notes)}"></label>
      </div>`);
  }
  function stepWho(){
    const pub = P.vis === 'public';
    let body;
    if (P.vis === 'group') {
      const gs = P.groups, withBoard = (gs || []).filter(g => g.space), without = (gs || []).filter(g => !g.space);
      body = `${gs == null ? '<p class="rs-muted">Finding your groups…</p>' : !gs.length ? '<p class="rs-muted">You’re not in any groups yet.</p>' : ''}
        ${withBoard.length ? `<div class="rs-options" role="radiogroup" aria-label="Which group">${withBoard.map(g => row('data-rs-group', g.did, P.group === g.did, g.name, '', g.memberCount ? members(g.memberCount) : '')).join('')}</div>` : ''}
        ${without.map(g => `<div class="rs-addrow"><span>${esc(g.name)} doesn’t have Rainshare yet</span>${g.canAdd ? `<button class="rs-btn rs-quiet rs-sm" type="button" data-rs-add-group="${esc(g.did)}">Add it</button>` : '<small>An admin can add it</small>'}</div>`).join('')}
        <p class="rs-muted">Only the group’s members can read it. It stays in your own account, inside the group’s private Rainshare space.</p>`;
    } else {
      const lists = P.lists;
      body = `<div class="rs-options" role="radiogroup" aria-label="Who it’s for">${AUDIENCE_PICKS.map(([k, t, n]) => row('data-rs-aud', k, P.audience === k, t, k === 'list' && listNow() ? listNow().name : n, people(countFor(k)))).join('')}</div>
        ${P.audience === 'list' ? (lists == null ? '<p class="rs-muted">Finding your lists…</p>' : lists.length ? `<label>Which list<select name="list">${lists.map(l => `<option value="${esc(l.uri)}"${P.list === l.uri ? ' selected' : ''}>${esc(l.name)} (${people(l.count)})</option>`).join('')}</select></label>` : '<p class="rs-muted">You don’t have any Bluesky lists yet. Make one at bsky.app, then come back.</p>') : ''}
        ${P.audience !== 'anyone' ? '<p class="rs-muted">Rainshare shows it only to them and only offers it to them, but it’s still a public record that anyone could look up.</p>' : ''}
        ${GROUPS ? '' : `<div class="rs-option rs-soon" aria-disabled="true"><span class="rs-option-text"><b>${ico('lock')}Private, in a group</b><small>Only its members could see it. Coming once group spaces leave alpha.</small></span><span class="rs-option-aside">Soon</span></div>`}`;
    }
    // Groups are coming (GROUPS in ../core/ns.js): until then there's nothing to choose between.
    const vis = GROUPS ? `<div class="rs-tiles rs-tiles-2" role="radiogroup" aria-label="Public or private">
        ${tile('data-rs-vis', 'public', P.vis === 'public', 'Public, for my circle', 'Uses who you follow on Bluesky')}
        ${tile('data-rs-vis', 'group', P.vis === 'group', 'Private, in a group', src().canPrivate ? 'Only its members can read it' : 'Needs groups, which this app can’t reach here', src().canPrivate ? '' : ' disabled')}
      </div>` : '';
    return `<h1 tabindex="-1">Who’s it for?</h1>
      <p class="rs-lede">Only the people you pick see it on their board and can take it on.</p>
      ${vis}
      ${body}
      <label class="rs-check"><input type="checkbox" name="parallel"${P.parallel ? ' checked' : ''}> More than one helper can try at once</label>
      ${pub ? `<div class="rs-bsky-opt">
        <label class="rs-check"><input type="checkbox" name="bsky"${P.bsky ? ' checked' : ''}> Also post it on Bluesky, so ${P.audience === 'anyone' ? 'people' : FOR[P.audience]} notice</label>
        ${P.bsky ? `<textarea name="bskyText" rows="3" maxlength="230" aria-label="Your Bluesky post">${esc(bskyText())}</textarea><small>The link to it goes on the end. Bluesky opens with this ready, and you post it there.</small>` : ''}
      </div>` : ''}
      <p class="rs-muted">${pub ? 'It’s saved as a record in your own account.' : `It’s saved in your own account, inside ${esc(groupNow()?.name || 'the group')}’s private Rainshare space.`} You can close it, reopen it or delete it whenever you like.</p>`;
  }

  // The preview beside the steps: the card as the board will show it, then (on the last
  // step) the details a helper sees when they open it, and who could see it.
  function side(){
    const sq = input(), me = ui.self();
    const line = P.step < 2 ? (!P.stage ? 'An idea or a project' : P.stage !== 'seed' && !sq.subject ? 'Where it lives goes here' : whereText(sq))
      : [shortWhere(sq), jobShort(sq), wantsShort(sq)].filter(Boolean).join(' · ');
    const card = `<div class="rs-mini${P.stage ? ' rs-mini-pic' : ''}">
      <div class="rs-mini-top">${face(me, 'xs')}<b>You</b><span>· ${esc(P.step >= 3 ? whoFor() : 'just now')}</span></div>
      <b class="rs-mini-title">${esc(sq.title.trim() || 'Your title goes here')}</b>
      <span class="rs-mini-line">${esc(line)}</span>${P.stage ? plantPic(P.stage, 96, { live: true }) : ''}</div>`;
    if (P.step === 3) return `<span class="rs-side-label">What a helper sees when they open it</span>
      <div class="rs-mini rs-mini-open">
        <div class="rs-mini-top">${face(me, 'xs')}<b>You</b><span>· ${esc(whoFor())} · just now</span></div>
        <b class="rs-mini-title">${esc(sq.title.trim() || 'Your title goes here')}</b>
        <span class="rs-mini-fit">Each helper sees how well it suits them here, from their own profile and yours.</span>
        <dl class="rs-facts rs-facts-sm"><dt>Where</dt><dd>${esc(whereText(sq))}</dd><dt>The job</dt><dd>${esc(jobText(sq))}</dd><dt>Would like</dt><dd>${esc(wantsText(sq))}</dd></dl>
      </div>
      <p class="rs-muted">${esc(reachText())}</p>`;
    return `<span class="rs-side-label">How it will look on the board</span>${card}<p class="rs-muted">${esc(P.step === 1 && P.kind === 'idea' ? 'An idea needs no repo, and you don’t need to be a developer to share one.' : HINTS[P.step])}</p>`;
  }
  // Typing only repaints the preview and the line under the link, so fields keep their focus.
  function paint(){
    const s = ui.root.querySelector('.rs-post-side'); if (s) { s.innerHTML = side(); ui.live?.(); }
    const f = ui.root.querySelector('[data-rs-found]'); if (f) f.innerHTML = found();
  }

  function done(){
    const d = P.done, sq = input(), pub = !d.group;
    const intent = pub && P.bsky && d.page ? `https://bsky.app/intent/compose?text=${encodeURIComponent(`${bskyText()} ${d.page}`)}` : null;
    return `<section class="rs-post-done" aria-live="polite">
      <span class="rs-done-mark">${ico('check')}</span>
      <h1 tabindex="-1">It’s on the board.</h1>
      <p class="rs-lede">${esc(doneText())}</p>
      <div class="rs-mini">
        <div class="rs-mini-top">${face(ui.self(), 'xs')}<b>You</b><span>· ${esc(whoFor())} · just now</span></div>
        <b class="rs-mini-title">${esc(sq.title)}</b>
        <span class="rs-mini-line">${esc([shortWhere(sq), jobShort(sq), wantsShort(sq)].filter(Boolean).join(' · '))}</span>
      </div>
      ${pub && P.bsky ? `<div class="rs-bsky">
        <b>Tell your circle on Bluesky</b>
        <p>${esc(bskyText())} <span class="rs-muted">${esc(d.page || '')}</span></p>
        ${src().demo ? '<small>This is the example circle, so nothing goes to Bluesky.</small>' : intent ? `<a class="rs-btn rs-primary" href="${esc(intent)}" target="_blank" rel="noopener">${ico('sky')}Post it on Bluesky</a>` : ''}
      </div>` : ''}
      <div class="rs-next"><h2>What happens next</h2><ol>
        <li><b>A friend sends their agent.</b> <span>You’ll see who’s on it, and what they’re running.</span></li>
        ${P.kind === 'idea' ? '<li><b>They turn in what they built.</b> <span>A link to it shows up on its page, with the model that did the work.</span></li>'
          : '<li><b>They turn in a pull request.</b> <span>It shows up on its page, with the model that did the work.</span></li>'}
        <li><b>You mark it done.</b> <span>And thank them on Bluesky, if you like.</span></li>
      </ol></div>
      <div class="rs-row">${ui.a(d.path, 'See its page', 'rs-btn rs-primary')}<button class="rs-btn rs-quiet" type="button" data-rs-again>Ask about something else</button></div>
    </section>`;
  }

  function view(){
    ui.title('Ask for rain');
    if (P.done) return `<div class="rs-post">${done()}</div>`;
    const body = [, stepWhere, stepWhat, stepWho][P.step]();
    const next = { 1: P.stage === 'seed' ? 'Next: the idea' : 'Next: what you’d like done', 2: 'Next: who it’s for', 3: P.busy ? 'Asking…' : 'Ask for rain' }[P.step];
    return `<div class="rs-post">
      <header class="rs-post-head"><span>Ask for rain</span><button class="rs-link" type="button" data-rs-post-cancel>Cancel</button></header>
      <ol class="rs-stepper" aria-label="Steps">${STEPS.map((l, i) => {
        const n = i + 1, state = n < P.step ? 'done' : n === P.step ? 'on' : '';
        return `<li class="${state}"><button type="button" data-rs-step="${n}"${n > P.reached ? ' disabled' : ''}${n === P.step ? ' aria-current="step"' : ''}><span class="rs-step-n" aria-hidden="true">${n < P.step ? ico('check') : n}</span><span>${l}</span></button></li>`;
      }).join('')}</ol>
      <div class="rs-post-body">
        <form class="rs-form rs-post-main" data-rs-form="post" novalidate>
          ${body}
          <p class="rs-err" role="alert"${P.err ? '' : ' hidden'}>${esc(P.err)}</p>
          <div class="rs-post-nav">${P.step > 1 ? '<button class="rs-btn rs-quiet" type="button" data-rs-back>Back</button>' : ''}<button class="rs-btn rs-primary" type="submit"${P.busy ? ' disabled' : ''}>${next}</button></div>
        </form>
        <aside class="rs-post-side" aria-label="Preview">${side()}</aside>
      </div>
    </div>`;
  }

  /* ---------- events (rainshare.js passes on the ones inside the wizard) ---------- */
  function click(t){
    const pick = (sel, fn) => { const el = t.closest(sel); if (el && !el.disabled) { fn(el); return true; } return false; };
    // Opening or closing "More options": the browser does it; this remembers it for the next redraw.
    const sum = t.closest('[data-rs-more] > summary');
    if (sum) { P.more = !sum.parentElement.open; return true; }
    return pick('[data-rs-step]', el => goStep(+el.dataset.rsStep))
      || pick('[data-rs-back]', () => { P.err = ''; P.step = Math.max(1, P.step - 1); ui.render(); arrive(); })
      || pick('[data-rs-kind]', el => {
        const k = el.dataset.rsKind; if (P.kind === k) return;
        Object.assign(P, { kind: k, err: '', link: '', subject: null, info: null, repo: null, issues: null, parallel: k === 'idea' && P.owner === 'helper' });
        if (picker() && (P.reposOf !== k || P.repos === null || P.repos?.error)) return loadRepos();
        if (picker() && Array.isArray(P.repos) && P.repos.length === 1) return loadIssues(picker().id(P.repos[0]));
        ui.render(); ui.root.querySelector('.rs-post [name="link"]')?.focus();
      })
      // A seed has nowhere to live yet; a plant keeps whatever repo was already picked for it.
      || pick('[data-rs-stage]', el => {
        const v = el.dataset.rsStage, st = v === 'plant' ? (P.stage && P.stage !== 'seed' ? P.stage : 'young') : v;
        if (P.stage === st) return;
        const was = P.stage; P.stage = st; P.err = '';
        if (st === 'seed') Object.assign(P, { kind: 'idea', link: '', subject: null, info: null, repo: null, issues: null, parallel: P.owner === 'helper' });
        else if (was === 'seed' || P.kind === 'idea') Object.assign(P, { kind: null, parallel: false });
        ui.render();
      })
      || pick('[data-rs-issue]', el => { pickIssue(el.dataset.rsIssue); P.err = ''; ui.render(); })
      // An idea given away can be built by more than one person; one started for you is one job.
      || pick('[data-rs-owner]', el => { P.owner = el.dataset.rsOwner; P.parallel = P.owner === 'helper'; P.err = ''; ui.render(); })
      || pick('[data-rs-model]', el => { const m = el.dataset.rsModel; P.models = !m ? [] : P.models.includes(m) ? P.models.filter(x => x !== m) : [...P.models, m]; ui.render(); })
      || pick('[data-rs-tests]', el => { P.tests = el.dataset.rsTests; ui.render(); })
      || pick('[data-rs-size]', el => { P.size = el.dataset.rsSize; ui.render(); })
      || pick('[data-rs-vis]', el => { P.vis = el.dataset.rsVis; P.err = ''; ui.render(); })
      || pick('[data-rs-aud]', el => { P.audience = el.dataset.rsAud; P.err = ''; ui.render(); })
      || pick('[data-rs-group]', el => { P.group = el.dataset.rsGroup; P.err = ''; ui.render(); })
      || pick('[data-rs-add-group]', el => addGroup(el.dataset.rsAddGroup, el))
      || pick('[data-rs-again]', () => { P = fresh(); loadBits(); ui.render(); arrive(); })
      || pick('[data-rs-post-cancel]', () => { P = fresh(); ui.go(''); });
  }
  const TEXT = ['title', 'spec', 'specUrl', 'otherModel', 'maxDiffLines', 'tags', 'values', 'notes', 'bskyText'];
  function typed(el){
    if (el.name === 'link') { setLink(el.value); return true; }
    if (TEXT.includes(el.name)) { P[el.name] = el.value; paint(); return true; }
    return false;
  }
  function changed(el){
    if (el.matches('[data-rs-repo]')) { if (el.value) loadIssues(el.value); return true; }
    if (el.name === 'list') { P.list = el.value; ui.render(); return true; }
    if (el.name === 'parallel') { P.parallel = el.checked; paint(); return true; }
    if (el.name === 'bsky') { P.bsky = el.checked; ui.render(); return true; }
    return typed(el);
  }

  return {
    view, click, typed, changed,
    submit(){ if (P.busy) return; if (P.step < STEPS.length) goStep(P.step + 1); else post(); },
    /** Coming to the wizard: a finished one starts over; a draft is kept. */
    enter(){ if (P.done) P = fresh(); if (P.groups === null) loadBits(); },
    reset(){ P = fresh(); }
  };
}
