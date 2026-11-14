// Asking for rain, in short steps with a preview beside them of how it will look: what it is
// (an idea, or a project and where it lives), what you'd like done (with how, folded away
// under "More options"), and, when it's on (FEATURES.audience in ../core/ns.js), who it's
// for. Then a confirmation that says who can see it and what happens next.
//
// rainshare.js owns the screen and hands in what this needs as `ui`; this keeps the draft
// (so it survives leaving and coming back) and draws the steps.
import { SEED, STAGE, STAGES, FAMILIES, LEVELS, GROUPS, FEATURES } from '../core/ns.js';
import { parseSubject, describeSubject, kindOf, subjectInfo, knotlessIssueSubject, safeHttp } from '../core/subjects.js';
import { newRepoPlaces } from '../core/forges.js';
import { specFromIssue } from '../core/records.js';
import { writableForge, FORGE_SAID } from '../core/forgewrite.js';
import { whereText, shortWhere, jobAndNotes, jobShort, modelsText, wantsShort, askExcerpt, askSizeText, stageOf, aNoun } from '../core/words.js';
import { join, wantPhrase } from '../core/rank.js';
import { pageOf } from '../core/brief.js';
import { esc, ago, ico, forgeIco, face, people, pathOf, plantPic, tip } from './bits.js';

// "Who's it for?" is set aside for now: without it every ask is open to everyone, and its last
// few choices (more than one helper, a Bluesky post) close the Details step instead.
const STEPS = FEATURES.audience ? ['What', 'Details', 'Who'] : ['What', 'Details'];
const LAST = STEPS.length;
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
  1: 'Pointing at an issue lets a helper’s agent read the whole conversation on it.',
  2: 'A helper’s agent reads this as a request from you. Short and specific works best.'
};
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const members = n => n === 1 ? '1 member' : `${Number(n).toLocaleString('en')} members`;
const list = s => String(s || '').split(',').map(x => x.trim().replace(/^#/, '')).filter(Boolean);

const fresh = () => ({
  step: 1, reached: 1, done: null, busy: false, err: '',
  stage: null,       // what's being planted: 'seed' (an idea), or a plant: 'seedling', 'young' or 'established'
  kind: null, link: '', subject: null, info: null, prefilled: false,
  openIssue: false,  // for a repo on knotless or Tangled with no issue picked: open one there, from this ask
  repos: null, repo: null, issues: null,
  title: '', spec: '', specUrl: '',
  more: false,       // whether "More options" (models, tests, size, tags…) is open
  families: [], otherFamily: '', level: '',   // which models: families, and a level ('' for any)
  tests: 'welcome', size: 'small', maxDiffLines: '', tags: '', values: '', notes: '',
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
      FEATURES.audience ? s.lists().catch(() => []) : [],
      s.canPrivate ? s.groups().catch(() => []) : [],
      FEATURES.audience && s.reach ? s.reach().catch(() => null) : null
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
    // A field says it changed again when it loses focus, which pressing Next does. The same
    // link is nothing new, and looking it up afresh would drop what was just found.
    if (value === P.link) return;
    P.link = value; P.subject = parseSubject(value); P.info = null;
    if (P.subject) P.repo = null;
    clearTimeout(infoTimer);
    const sub = P.subject;
    if (sub && /Issue$/.test(kindOf(sub) || '')) infoTimer = setTimeout(async () => {
      const info = await subjectInfo(sub);
      if (P.subject !== sub || !info) return;
      P.info = info;
      // Next was pressed before the issue answered: the step it starts off still starts from it.
      if (P.step === 2 && !P.title.trim() && !P.spec.trim()) { prefill(); ui.render(); } else paint();
    }, 350);
    paint();
  }

  /* ---------- the draft, as a record and in words ---------- */
  const subjectNow = () => P.kind === 'idea' ? null : P.subject;
  const groupNow = () => (P.groups || []).find(g => g.did === P.group && g.space) || null;
  const listNow = () => (P.lists || []).find(l => l.uri === P.list) || null;
  function input(){
    return {
      title: P.title, subject: subjectNow(), stage: P.stage || undefined, owner: P.kind === 'idea' ? P.owner : undefined, spec: P.spec, specUrl: P.specUrl, tags: P.tags, values: FEATURES.seedValues ? P.values : undefined, size: P.size, parallel: P.parallel,
      wants: P.kind === 'idea' && P.owner === 'helper' ? { notes: P.notes.trim() }
        : { families: [...new Set([...P.families, ...list(P.otherFamily)])], level: P.level || undefined, tests: P.tests, maxDiffLines: parseInt(P.maxDiffLines, 10) || undefined, notes: P.notes.trim() },
      ...(FEATURES.audience ? { audience: P.audience, list: P.audience === 'list' ? P.list : undefined } : { audience: 'anyone' })
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
    const w = sq.wants || {}, want = wantPhrase(sq);
    const first = [sq.size ? `a ${sq.size} job` : '', TESTS_SAID[w.tests] || '', want ? `ideally with ${want}` : ''].filter(Boolean).join(', ');
    const out = [first ? cap(first) + '.' : ''];
    if (w.maxDiffLines) out.push(`Under about ${w.maxDiffLines} lines.`);
    if (w.notes) out.push(w.notes.replace(/([^.!?])$/, '$1.'));
    if (list(sq.tags).length) out.push(`Tagged ${join(list(sq.tags))}.`);
    if (FEATURES.seedValues && list(sq.values).length) out.push(`It stands for ${join(list(sq.values))}.`);
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
  // The title in quotes once there is one (the post can be on the same step as the title).
  const quoted = () => P.title.trim() ? `: “${P.title.trim()}”.` : '.';
  const bskyDefault = () => P.kind === 'idea' && P.owner === 'helper' ? `Got rain to spare? I’d like to see this built${quoted()} Whoever builds it keeps it.`
    : `Got rain to spare? I’m asking for help with this${quoted()}${P.size ? ` It’s a ${P.size} job${P.tests === 'required' ? ', with tests' : ''}.` : ''}`;
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
    if (P.info?.body && !P.spec.trim()) { P.spec = specFromIssue(P.info.body, safeHttp(describeSubject(P.subject)?.href)); P.prefilled = true; }
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
    for (let s = 1; s <= LAST; s++) { const e = problem(s); if (e) { P.err = e; P.step = s; ui.render(); return; } }
    P.busy = true; P.err = ''; ui.render();
    try {
      const g = P.vis === 'group' ? groupNow() : null;
      // The issue goes up first, so the ask can point at it. If something after this fails, the
      // ask keeps pointing at the issue that's now there, and trying again doesn't open a second.
      let opened = null;
      if (P.openIssue && offerOn()) {
        const draft = input();
        opened = await src().forgeIssue(draft.subject, { title: draft.title, body: draft.spec });
        Object.assign(P, { subject: opened, whole: false, openIssue: false, link: '' });
      }
      const r = await src().plant(input(), { group: g?.did });
      const item = { uri: r.uri, space: r.space || null, repo: ui.viewer(), rkey: String(r.uri).split('/').pop(), author: ui.self() };
      // The example circle's asks live in this browser, so they have no page anyone else could open.
      P.done = { path: pathOf(item), page: item.space || src().demo ? null : pageOf(item), group: g, issue: opened ? { href: opened.url, forge: FORGE_SAID[writableForge(opened)] } : null };
      // The new issue says where the ask is, so people who find it there can pick it up here.
      if (opened && P.done.page) src().forgeComment(opened, `I’ve posted this on Rainshare, for anyone who’d like to send their agent to work on it: ${P.done.page}`).catch(e => console.warn('rainshare issue note', e));
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
  // A repo on knotless or Tangled with no issue picked: Rainshare can open one there for you,
  // from the title and details you're about to write, so helpers have a thread to work in.
  const offerOn = () => kindOf(P.subject) === 'repo' && P.kind !== 'idea' ? writableForge(P.subject) : null;
  function issueOffer(){
    const forge = offerOn(); if (!forge) return '';
    const name = FORGE_SAID[forge];
    if ((ui.forges?.() || []).includes(forge)) return `<label class="rs-check"><input type="checkbox" name="openIssue"${P.openIssue ? ' checked' : ''}> Open an issue for it on ${esc(name)} too, from what you write next</label>`;
    return ui.connectForge ? `<p class="rs-muted"><button class="rs-link" type="button" data-rs-connect-forge="${forge}">Connect ${esc(name)}</button> to open an issue for it there too. ${tip(`Your sign-in doesn’t let Rainshare post on ${esc(name)} for you yet. Connecting it brings you back to start this step again.`)}</p>` : '';
  }
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
        ${P.owner === 'helper' ? '' : `<p class="rs-muted">Or make the empty repo yourself first and point at it: ${newRepoPlaces({ title: P.title }).map(p => `<a href="${esc(p.href)}" target="_blank" rel="noopener">${esc(p.name)}</a>`).join(', ')}.</p>`}`;
    }
    // First what it is: an idea, or a project someone already has. Then, for a project, where
    // it lives and how far along it is. The pictures are the seed and the plant it'd be.
    const plant = !!P.stage && P.stage !== 'seed';
    const stageTile = (v, pic, on, t, n) => `<button type="button" class="rs-tile rs-stage" data-rs-stage="${v}" role="radio" aria-checked="${on}">${plantPic(pic, 84)}<b>${esc(t)}</b><small>${esc(n)}</small></button>`;
    return `<h1 tabindex="-1">What do you want help with?</h1>
      <div class="rs-tiles rs-stages rs-stages-2" role="radiogroup" aria-label="An idea or a project">
        ${stageTile('seed', 'seed', P.stage === 'seed', 'An idea', 'Nothing’s been built yet.')}
        ${stageTile('plant', plant ? P.stage : 'young', plant, 'A project', 'Something you already have.')}
      </div>
      ${plant ? `<div class="rs-field"><span>Where does it live?</span>
        <div class="rs-tiles" role="radiogroup" aria-label="Where does it live?">${KINDS.map(([k, t, n]) => tile('data-rs-kind', k, P.kind === k, t, n)).join('')}</div></div>` : ''}
      ${more}
      <p class="rs-found" data-rs-found aria-live="polite">${found()}</p>
      <div data-rs-issue-offer>${issueOffer()}</div>
      ${plant ? `<div class="rs-field" role="radiogroup" aria-label="How far along is the project as a whole?"><span>How far along is the project as a whole?</span><div class="rs-options">
        ${PLANT_STAGES.map(([k, t, n]) => row('data-rs-stage', k, P.stage === k, t, n)).join('')}</div></div>` : ''}`;
  }
  // How it should be done: all optional, so it waits behind a button under the description.
  // (The fields are there all along, hidden, so what's in them is kept either way.)
  const moreOptions = (label, body) => `${P.more ? '' : `<button class="rs-link" type="button" data-rs-more-open>${ico('plus')}${label}</button>`}
      <div class="rs-more-body rs-options-more" data-rs-more${P.more ? '' : ' hidden'}>${body}</div>`;
  function stepWhat(){
    if (P.kind === 'idea') return `<h1 tabindex="-1">What’s the idea?</h1>
      <label>A short title<input name="title" maxlength="120" required autocomplete="off" placeholder="A seating chart that shuffles itself" value="${esc(P.title)}"></label>
      <label>What should it do? <small>Plain words are fine.</small>
        <textarea name="spec" rows="8" maxlength="10000" placeholder="A little tool that… It’s for… It should… It doesn’t need to…">${esc(P.spec)}</textarea></label>
      <div data-rs-size-note aria-live="polite" data-was="${esc(sizeNote())}">${sizeNote()}</div>
      <label>Written up somewhere already? <small>Optional: a link to notes or a sketch</small><input name="specUrl" type="url" inputmode="url" placeholder="https://…" value="${esc(P.specUrl)}"></label>
      ${howFields()}${LAST === 2 ? lastChoices() : ''}`;
    return `<h1 tabindex="-1">What would you like done?</h1>
      ${P.prefilled ? '<p class="rs-lede">We’ve started you off from the issue. Change anything you like.</p>' : ''}
      <label>A short title<input name="title" maxlength="120" required autocomplete="off" placeholder="Keep drafts out of the RSS feed" value="${esc(P.title)}"></label>
      <label>What does done look like? <small>Markdown works.</small>
        <textarea name="spec" rows="8" maxlength="10000" placeholder="Right now… It should… Please don’t…">${esc(P.spec)}</textarea></label>
      <div data-rs-size-note aria-live="polite" data-was="${esc(sizeNote())}">${sizeNote()}</div>
      <label>A longer spec somewhere? <small>Optional, like a SPEC.md in the repo</small><input name="specUrl" type="url" inputmode="url" placeholder="https://…/SPEC.md" value="${esc(P.specUrl)}"></label>
      ${howFields()}${LAST === 2 ? lastChoices() : ''}`;
  }
  // A very long ask is often a plan rather than one piece of work: whoever takes it on may only
  // finish part. Said while it's being written, from the words themselves.
  function sizeNote(){
    const size = askSizeText(P.spec);
    if (!size) return '';
    const issue = P.kind !== 'idea' && /Issue$/.test(kindOf(P.subject) || '');
    return `<p class="rs-note">${ico('info')}<span>${esc(size)}. A helper is more likely to finish something they can do in a sitting or two. If this is a bigger plan, you could ask for the first piece now and post the rest later${issue ? ', or split the issue up' : ''}.${issue ? ' A pull request that does only part of it will say “Part of” the issue rather than closing it.' : ''}</span></p>`;
  }
  function howFields(){
    // An idea given away is the builder's to build their way: only what helps someone find it and size it up is asked.
    if (P.kind === 'idea' && P.owner === 'helper') return moreOptions('Add how big it feels, and tags', `
      <fieldset><legend>How big does it feel?</legend><div class="rs-options" role="radiogroup" aria-label="How big does it feel?">${SIZE_PICKS.map(([k, l, n]) => row('data-rs-size', k, P.size === k, l, '', n)).join('')}</div></fieldset>
      <div class="rs-two">
        <label>Tags <small>so the right person finds it</small><input name="tags" autocomplete="off" placeholder="teaching, printing" value="${esc(P.tags)}"></label>
        ${FEATURES.seedValues ? `<label>What it stands for <small>optional</small><input name="values" list="rsValues" autocomplete="off" placeholder="education, accessibility" value="${esc(P.values)}"></label>` : ''}
      </div>
      <label>Anything else?<input name="notes" maxlength="1000" autocomplete="off" placeholder="It should work on a phone." value="${esc(P.notes)}"></label>`);
    // Which models: a family (or any), and how capable (or any level). Not model names: those
    // change every few months, and a helper knows which of theirs fit.
    const custom = P.families.filter(f => !FAMILIES.some(([k]) => k === f));
    const lv = LEVELS.find(l => l[0] === P.level);
    return `<fieldset><legend>Which models would you prefer? ${tip('Frontier is the most capable model a family has, mid-tier a step below, and small is quick and light. Helpers whose plan or setup reaches one of these families see it as a better fit, and their agents get it in the brief.')}</legend>
        <div class="rs-toggles" data-rs-families aria-label="Model family">
          <button type="button" data-rs-family="" aria-pressed="${!P.families.length}">Any model</button>
          ${[...FAMILIES, ...custom.map(f => [f, f])].map(([k, l]) => `<button type="button" data-rs-family="${esc(k)}" aria-pressed="${P.families.includes(k)}">${esc(l)}</button>`).join('')}
        </div>
        <label class="rs-inline">Or another <input name="otherFamily" autocomplete="off" placeholder="Llama" value="${esc(P.otherFamily)}"></label>
        <div class="rs-toggles" data-rs-levels aria-label="How capable">
          <button type="button" data-rs-level="" aria-pressed="${!P.level}">Any level</button>
          ${LEVELS.map(([k, l]) => `<button type="button" data-rs-level="${k}" aria-pressed="${P.level === k}">${esc(l)}</button>`).join('')}
        </div>
        ${lv ? `<small>${esc(lv[1])}: ${esc(lv[2])}.</small>` : ''}
      </fieldset>
      ${moreOptions('Add tests, size and tags', `
      <div class="rs-two">
        <fieldset><legend>Tests</legend><div class="rs-options" role="radiogroup" aria-label="Tests">${TEST_PICKS.map(([k, l]) => row('data-rs-tests', k, P.tests === k, l)).join('')}</div></fieldset>
        <fieldset><legend>How big is it?</legend><div class="rs-options" role="radiogroup" aria-label="How big is it?">${SIZE_PICKS.map(([k, l, n]) => row('data-rs-size', k, P.size === k, l, '', n)).join('')}</div></fieldset>
      </div>
      <div class="rs-two">
        <label>Keep the change under <small>lines, optional</small><input name="maxDiffLines" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="200" value="${esc(P.maxDiffLines)}"></label>
        <label>Tags <small>so helpers can find it</small><input name="tags" autocomplete="off" placeholder="go, rss" value="${esc(P.tags)}"></label>
      </div>
      ${FEATURES.seedValues ? `<div class="rs-two">
        <label>What it stands for <small>optional</small><input name="values" list="rsValues" autocomplete="off" placeholder="accessibility, climate" value="${esc(P.values)}"></label>
        <label>Anything else?<input name="notes" maxlength="1000" autocomplete="off" placeholder="No new dependencies, please." value="${esc(P.notes)}"></label>
      </div>` : `<label>Anything else?<input name="notes" maxlength="1000" autocomplete="off" placeholder="No new dependencies, please." value="${esc(P.notes)}"></label>`}`)}`;
  }
  function stepWho(){
    const pub = P.vis === 'public';
    let body;
    if (P.vis === 'group') {
      const gs = P.groups, withBoard = (gs || []).filter(g => g.space), without = (gs || []).filter(g => !g.space);
      body = `${gs == null ? '<p class="rs-muted">Finding your groups…</p>' : !gs.length ? '<p class="rs-muted">You’re not in any groups yet.</p>' : ''}
        ${withBoard.length ? `<div class="rs-options" role="radiogroup" aria-label="Which group">${withBoard.map(g => row('data-rs-group', g.did, P.group === g.did, g.name, '', g.memberCount ? members(g.memberCount) : '')).join('')}</div>` : ''}
        ${without.map(g => `<div class="rs-addrow"><span>${esc(g.name)} doesn’t have Rainshare yet</span>${g.canAdd ? `<button class="rs-btn rs-quiet rs-sm" type="button" data-rs-add-group="${esc(g.did)}">Add it</button>` : '<small>An admin can add it</small>'}</div>`).join('')}
        <p class="rs-muted">Only the group’s members can read it.</p>`;
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
      ${lastChoices()}`;
  }
  // The last few choices, and what happens to it: at the end of whichever step is last.
  function lastChoices(){
    const pub = P.vis === 'public';
    return `<label class="rs-check"><input type="checkbox" name="parallel"${P.parallel ? ' checked' : ''}> More than one helper can try at once</label>
      ${pub ? `<div class="rs-bsky-opt">
        <label class="rs-check"><input type="checkbox" name="bsky"${P.bsky ? ' checked' : ''}> Also post it on Bluesky, so ${P.audience === 'anyone' ? 'people' : FOR[P.audience]} notice</label>
        ${P.bsky ? `<textarea name="bskyText" rows="3" maxlength="230" aria-label="Your Bluesky post">${esc(bskyText())}</textarea><small>Bluesky opens with this ready, and the link on the end. You post it there.</small>` : ''}
      </div>` : ''}
      <p class="rs-muted">You can close or delete it any time. ${tip(`${pub ? `It’s saved in your own account${FEATURES.audience ? '' : ', open to everyone on Rainshare'}` : `It’s saved in your own account, inside ${esc(groupNow()?.name || 'the group')}’s private Rainshare space`}. Rainshare is in early ${STAGE}, so things may change or break.`)}</p>`;
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
        <dl class="rs-facts rs-facts-sm"><dt>Where</dt><dd>${esc(whereText(sq))}</dd><dt>The job</dt><dd>${esc(jobAndNotes(sq))}</dd><dt>Models</dt><dd>${esc(modelsText(sq))}</dd></dl>
      </div>
      <p class="rs-muted">${esc(reachText())}</p>`;
    // A hint for the step, once there's something for it to be about.
    const hint = P.step > 1 ? HINTS[P.step] : !P.stage ? '' : P.kind === 'idea' ? 'An idea doesn’t need a repo yet. Whoever picks it up starts one.' : HINTS[1];
    return `<span class="rs-side-label">How it will look on the board</span>${card}${hint ? `<p class="rs-muted">${esc(hint)}</p>` : ''}`;
  }
  // Typing only repaints the preview and the line under the link, so fields keep their focus.
  function paint(){
    const s = ui.root.querySelector('.rs-post-side'); if (s) { s.innerHTML = side(); ui.live?.(); }
    const f = ui.root.querySelector('[data-rs-found]'); if (f) f.innerHTML = found();
    const o = ui.root.querySelector('[data-rs-issue-offer]'); if (o) o.innerHTML = issueOffer();
    // Only redrawn when it changes, so a screen reader hears it once, not at every keystroke.
    const z = ui.root.querySelector('[data-rs-size-note]'); if (z) { const h = sizeNote(); if (z.dataset.was !== h) { z.innerHTML = h; z.dataset.was = h; } }
    // The Bluesky post follows the title until it's been edited (it's on the same step as the title when that's the last).
    const b = ui.root.querySelector('.rs-post [name="bskyText"]'); if (b && P.bskyText == null && document.activeElement !== b) b.value = bskyText();
  }

  function done(){
    const d = P.done, sq = input(), pub = !d.group;
    const intent = pub && P.bsky && d.page ? `https://bsky.app/intent/compose?text=${encodeURIComponent(`${bskyText()} ${d.page}`)}` : null;
    return `<section class="rs-post-done" aria-live="polite">
      <span class="rs-done-mark">${ico('check')}</span>
      <h1 tabindex="-1">It’s on the board.</h1>
      <p class="rs-lede">${esc(doneText())}${d.issue ? ` An issue is open for it on ${esc(d.issue.forge)}${d.issue.href && !src().demo ? `: <a href="${esc(d.issue.href)}" target="_blank" rel="noopener">see it there</a>` : ''}.` : ''}</p>
      <div class="rs-mini">
        <div class="rs-mini-top">${face(ui.self(), 'xs')}<b>You</b><span>· ${esc(whoFor())} · just now</span></div>
        <b class="rs-mini-title">${esc(sq.title)}</b>
        <span class="rs-mini-line">${esc([shortWhere(sq), jobShort(sq), wantsShort(sq)].filter(Boolean).join(' · '))}</span>
      </div>
      ${pub && P.bsky ? `<div class="rs-bsky">
        <b>Tell people on Bluesky</b>
        <p>${esc(bskyText())} <span class="rs-muted">${esc(d.page || '')}</span></p>
        ${src().demo ? '<small>This is the example circle, so nothing goes to Bluesky.</small>' : intent ? `<a class="rs-btn rs-primary" href="${esc(intent)}" target="_blank" rel="noopener">${ico('sky')}Post it on Bluesky</a>` : ''}
      </div>` : ''}
      <div class="rs-next"><h2>What happens next</h2><ol>
        <li><b>Someone sends their agent.</b> <span>You’ll see who’s on it, and what they’re running.</span></li>
        ${P.kind === 'idea' ? '<li><b>They turn in what they built.</b> <span>A link to it shows up on its page, with the model that did the work.</span></li>'
          : '<li><b>They turn in a pull request.</b> <span>It shows up on its page, with the model that did the work.</span></li>'}
        <li><b>You mark it done.</b> <span>And thank them on Bluesky, if you like.</span></li>
      </ol></div>
      <div class="rs-row">${ui.a(d.path, 'See its page', 'rs-btn rs-primary')}<button class="rs-btn rs-quiet" type="button" data-rs-again>Ask for something else</button></div>
    </section>`;
  }

  function view(){
    ui.title('Ask for rain');
    if (P.done) return `<div class="rs-post">${done()}</div>`;
    const body = [, stepWhere, stepWhat, stepWho][P.step]();
    const next = P.step === LAST ? (P.busy ? 'Asking…' : 'Ask for rain') : { 1: P.stage === 'seed' ? 'Next: the idea' : 'Next: what you’d like done', 2: 'Next: who it’s for' }[P.step];
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
    // "Add tests, size and tags": the fields come out, and stay out on the next redraw.
    const mo = t.closest('[data-rs-more-open]');
    if (mo) { P.more = true; const box = ui.root.querySelector('[data-rs-more]'); if (box) { box.hidden = false; mo.remove(); box.querySelector('button, input')?.focus(); } return true; }
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
      || pick('[data-rs-family]', el => { const f = el.dataset.rsFamily; P.families = !f ? [] : P.families.includes(f) ? P.families.filter(x => x !== f) : [...P.families, f]; ui.render(); })
      || pick('[data-rs-level]', el => { P.level = el.dataset.rsLevel; ui.render(); })
      || pick('[data-rs-tests]', el => { P.tests = el.dataset.rsTests; ui.render(); })
      || pick('[data-rs-size]', el => { P.size = el.dataset.rsSize; ui.render(); })
      || pick('[data-rs-vis]', el => { P.vis = el.dataset.rsVis; P.err = ''; ui.render(); })
      || pick('[data-rs-aud]', el => { P.audience = el.dataset.rsAud; P.err = ''; ui.render(); })
      || pick('[data-rs-group]', el => { P.group = el.dataset.rsGroup; P.err = ''; ui.render(); })
      || pick('[data-rs-add-group]', el => addGroup(el.dataset.rsAddGroup, el))
      || pick('[data-rs-again]', () => { P = fresh(); loadBits(); ui.render(); arrive(); })
      || pick('[data-rs-connect-forge]', el => { ui.connectForge?.(el.dataset.rsConnectForge); })
      || pick('[data-rs-post-cancel]', () => { P = fresh(); ui.go(ui.board || ''); });
  }
  const TEXT = ['title', 'spec', 'specUrl', 'otherFamily', 'maxDiffLines', 'tags', 'values', 'notes', 'bskyText'];
  function typed(el){
    if (el.name === 'link') { setLink(el.value); return true; }
    if (TEXT.includes(el.name)) { P[el.name] = el.value; paint(); return true; }
    return false;
  }
  function changed(el){
    if (el.matches('[data-rs-repo]')) { if (el.value) loadIssues(el.value); return true; }
    if (el.name === 'list') { P.list = el.value; ui.render(); return true; }
    if (el.name === 'parallel') { P.parallel = el.checked; paint(); return true; }
    if (el.name === 'openIssue') { P.openIssue = el.checked; return true; }
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
