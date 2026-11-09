// Posting a sidequest, in five short steps with a preview beside them of how it will look:
// where the work is, what you'd like done, how, who it's for, and a last look. Then a
// confirmation that says who can see it and what happens next.
//
// rainshare.js owns the screen and hands in what this needs as `ui`; this keeps the draft
// (so it survives leaving and coming back) and draws the steps.
import { SIDEQUEST, MODEL_PICKS, modelName } from '../core/ns.js';
import { parseSubject, describeSubject, kindOf, subjectInfo } from '../core/subjects.js';
import { whereText, shortWhere, jobText, jobShort, wantsText, wantsShort, askExcerpt } from '../core/words.js';
import { join } from '../core/rank.js';
import { pageOf } from '../core/brief.js';
import { esc, ago, ico, forgeIco, face, people, pathOf } from './bits.js';

const STEPS = ['Where', 'What', 'How', 'Who', 'Look it over'];
const KINDS = [
  ['tangled', 'A Tangled issue', 'Pick from your Tangled repos'],
  ['github', 'A GitHub issue', 'Paste its link'],
  ['repo', 'Any git repo', 'Codeberg, GitLab, your own server'],
  ['idea', 'Nowhere yet', 'Just an idea for now']
];
const TEST_PICKS = [['required', 'Required'], ['welcome', 'Welcome'], ['none', 'Not needed']];
const SIZE_PICKS = [['tiny', 'Tiny', 'minutes'], ['small', 'Small', 'an evening'], ['medium', 'Medium', 'a weekend'], ['large', 'Large', 'longer']];
const AUDIENCE_PICKS = [
  ['mutuals', 'Mutuals', 'People you follow who follow you back'],
  ['following', 'People I follow', 'Anyone you follow on Bluesky'],
  ['followers', 'My followers', 'Anyone can follow you, so this is the widest circle'],
  ['list', 'A Bluesky list', 'People on one of your lists'],
  ['anyone', 'Everyone', 'Anyone who comes across it']
];
const FOR = { mutuals: 'your mutuals', following: 'people you follow', followers: 'your followers', list: 'the people on your list', anyone: 'everyone' };
const TESTS_SAID = { required: 'tests required', welcome: 'tests welcome', none: 'no tests needed' };
const HINTS = {
  1: 'Pointing at an issue lets a helper’s agent read the whole conversation on it, not just your summary.',
  2: 'A helper’s agent gets your words as your request, not as orders, so plain and specific beats long.',
  3: 'The board keeps this to one quiet line. The rest shows in the details beside it.'
};
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const members = n => n === 1 ? '1 member' : `${Number(n).toLocaleString('en')} members`;
const list = s => String(s || '').split(',').map(x => x.trim().replace(/^#/, '')).filter(Boolean);

const fresh = () => ({
  step: 1, reached: 1, done: null, busy: false, err: '',
  kind: null, link: '', subject: null, info: null, prefilled: false,
  repos: null, repo: null, issues: null,
  title: '', spec: '', specUrl: '',
  models: [], otherModel: '', tests: 'welcome', size: 'small', maxDiffLines: '', tags: '', values: '', notes: '',
  vis: 'public', audience: 'mutuals', list: null, group: null, parallel: false,
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
    if (P.step >= 4) ui.render();
  }
  const repoOf = did => Array.isArray(P.repos) ? P.repos.find(r => r.repoDid === did) : null;
  const repoSubject = r => ({ $type: `${SIDEQUEST}#repo`, url: r.url, forge: 'tangled', repoDid: r.repoDid, name: r.url.replace('https://tangled.org/', '') });
  async function loadRepos(){
    const mine = P; P.repos = 'loading'; ui.render();
    try { P.repos = await src().tangledRepos(); } catch (e) { P.repos = { error: e }; }
    if (P !== mine) return;
    if (Array.isArray(P.repos) && P.repos.length === 1 && !P.subject) return loadIssues(P.repos[0].repoDid);
    ui.render();
  }
  async function loadIssues(repoDid){
    const mine = P, repo = repoOf(repoDid);
    Object.assign(P, { repo: repoDid, issues: 'loading', subject: repo ? repoSubject(repo) : null, info: null, link: '' });
    ui.render();
    try { P.issues = await src().tangledIssues(repoDid); } catch (e) { P.issues = { error: e }; }
    if (P === mine) ui.render();
  }
  function pickIssue(uri){
    const repo = repoOf(P.repo), issue = Array.isArray(P.issues) ? P.issues.find(i => i.uri === uri) : null;
    P.subject = issue ? { $type: `${SIDEQUEST}#tangledIssue`, uri: issue.uri, cid: issue.cid, repo: P.repo, ...(repo?.url ? { repoUrl: repo.url } : {}) } : repo ? repoSubject(repo) : null;
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
    if (sub && kindOf(sub) === 'githubIssue') infoTimer = setTimeout(async () => {
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
      title: P.title, subject: subjectNow(), spec: P.spec, specUrl: P.specUrl, tags: P.tags, values: P.values, size: P.size, parallel: P.parallel,
      wants: { models: [...new Set([...P.models, ...list(P.otherModel)])], tests: P.tests, maxDiffLines: parseInt(P.maxDiffLines, 10) || undefined, notes: P.notes.trim() },
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
    if (P.audience === 'anyone') return 'Anyone on Rainshare could see it.';
    const n = countFor(P.audience);
    return n != null ? `About ${people(n)} could see it on their board.` : `${cap(FOR[P.audience])} could see it on their board.`;
  }
  function doneText(){
    const g = P.done?.group;
    if (g) return g.memberCount ? `The ${members(g.memberCount)} of ${g.name} can see it on their board now, and nobody else.` : `${g.name}’s members can see it on their board now, and nobody else.`;
    if (P.audience === 'anyone') return 'Anyone on Rainshare can see it now.';
    const n = countFor(P.audience), of = { mutuals: 'of your mutuals', following: 'people you follow', followers: 'of your followers', list: 'people on your list' }[P.audience];
    return n != null ? `About ${Number(n).toLocaleString('en')} ${of} can see it on their board now.` : `${cap(FOR[P.audience])} can see it on their board now.`;
  }
  function whereLong(sq){
    if (P.kind === 'idea' || !sq.subject) return 'Nowhere yet. It’s just an idea, so a helper can start a repo for you or suggest where it should live.';
    const t = P.info?.title, d = describeSubject(sq.subject);
    if (t && kindOf(sq.subject) === 'githubIssue') return `GitHub issue #${sq.subject.number} “${t}” in ${d.repo || d.label}`;
    if (t && kindOf(sq.subject) === 'tangledIssue') return `Tangled issue “${t}”${d.repo ? ' in ' + d.repo : ''}`;
    return whereText(sq);
  }
  function howText(sq){
    const w = sq.wants, names = w.models.map(modelName);
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
  const bskyDefault = () => `Got spare agent usage? I’d love a hand with this: “${P.title.trim()}”.${P.size ? ` It’s a ${P.size} one${P.tests === 'required' ? ' with tests' : ''}.` : ''}`;
  const bskyText = () => (P.bskyText ?? bskyDefault()).trim();

  /* ---------- moving between steps ---------- */
  function problem(step){
    if (step === 1) {
      if (!P.kind) return 'Pick where the work is, or “Nowhere yet”.';
      if (P.kind === 'idea') return '';
      if (P.link.trim() && !P.subject) return 'That link isn’t one we understand. Paste the issue’s or the repo’s address.';
      if (!P.subject) return { tangled: 'Pick one of your repos, or paste a Tangled link.', github: 'Paste the issue’s link, or the repo’s.', repo: 'Paste where to clone it from.' }[P.kind];
    }
    if (step === 2 && !P.title.trim()) return 'Give it a short title.';
    if (step === 4 && P.vis === 'group' && !groupNow()) return 'Pick a group that has Rainshare, or make it public.';
    if (step === 4 && P.vis === 'public' && P.audience === 'list' && !P.list) return 'Pick the list it’s for, or another audience.';
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
    for (const s of [1, 2, 4]) { const e = problem(s); if (e) { P.err = e; P.step = s; ui.render(); return; } }
    P.busy = true; P.err = ''; ui.render();
    try {
      const g = P.vis === 'group' ? groupNow() : null;
      const r = await src().post(input(), { group: g?.did });
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
    if (P.kind === 'tangled') {
      const r = P.repos;
      more = `<div class="rs-pick">
        ${r === null || r === 'loading' ? '<p class="rs-muted">Finding your Tangled repos…</p>'
          : r.error ? '<p class="rs-muted">Couldn’t reach Tangled just now. Paste a link instead.</p>'
          : !r.length ? '<p class="rs-muted">No Tangled repos on this account. Paste a link instead.</p>'
          : `<label>Your repo<select data-rs-repo><option value="">Choose a repo…</option>${r.map(x => `<option value="${esc(x.repoDid)}"${P.repo === x.repoDid ? ' selected' : ''}>${esc(x.name)}${x.description ? ' · ' + esc(x.description.slice(0, 60)) : ''}</option>`).join('')}</select></label>`}
        ${P.issues === 'loading' ? '<p class="rs-muted">Loading its open issues…</p>'
          : P.issues?.error ? '<p class="rs-muted">Couldn’t load its issues. It’ll point at the repo, or paste an issue’s link.</p>'
          : Array.isArray(P.issues) && P.repo ? `<div class="rs-field" role="radiogroup" aria-label="Which issue?"><span>Which issue?</span><div class="rs-options">
            ${P.issues.map(i => row('data-rs-issue', i.uri, P.subject?.uri === i.uri, i.title, i.createdAt ? 'opened ' + ago(i.createdAt) : '')).join('')}
            ${row('data-rs-issue', '', kindOf(P.subject) === 'repo' && P.subject?.repoDid === P.repo, P.issues.length ? 'None of these' : 'No open issues', 'Point at the whole repo')}</div></div>` : ''}
        <label>Or paste a Tangled link<input name="link" inputmode="url" autocomplete="off" placeholder="https://tangled.org/you/repo/issues/12" value="${esc(P.link)}"></label>
      </div>`;
    } else if (P.kind === 'github') {
      more = `<label>The issue’s link <small>or the repo’s</small><input name="link" inputmode="url" autocomplete="off" placeholder="https://github.com/you/repo/issues/12" value="${esc(P.link)}"></label>`;
    } else if (P.kind === 'repo') {
      more = `<label>Where to clone it from<input name="link" inputmode="url" autocomplete="off" placeholder="https://codeberg.org/you/repo" value="${esc(P.link)}"></label>`;
    } else if (P.kind === 'idea') {
      more = '<p class="rs-muted">That’s fine. Describe it in the next step, and a helper can start a repo for you or suggest where it should live.</p>';
    }
    return `<h1 tabindex="-1">Where’s the work?</h1>
      <p class="rs-lede">Point at the issue or the repo. Rainshare brings in its title and details, so you write less.</p>
      <div class="rs-tiles" role="radiogroup" aria-label="Where’s the work?">${KINDS.map(([k, t, n]) => tile('data-rs-kind', k, P.kind === k, t, n)).join('')}</div>
      ${more}
      <p class="rs-found" data-rs-found aria-live="polite">${found()}</p>`;
  }
  function stepWhat(){
    return `<h1 tabindex="-1">What would you like done?</h1>
      <p class="rs-lede">Say it the way you would to a friend.${P.prefilled ? ' We’ve started you off from the issue.' : ''}</p>
      <label>A short title<input name="title" maxlength="120" required autocomplete="off" placeholder="Keep drafts out of the RSS feed" value="${esc(P.title)}"></label>
      <label>What does done look like? <small>What’s wrong, what done looks like, and anything to avoid. Markdown works.</small>
        <textarea name="spec" rows="10" maxlength="10000" placeholder="Right now… It’d be great if… Please don’t…">${esc(P.spec)}</textarea></label>
      <label>A longer spec somewhere? <small>Optional, like a SPEC.md in the repo</small><input name="specUrl" type="url" inputmode="url" placeholder="https://…/SPEC.md" value="${esc(P.specUrl)}"></label>`;
  }
  function stepHow(){
    const custom = P.models.filter(m => !MODEL_PICKS.includes(m));
    return `<h1 tabindex="-1">How should it be done?</h1>
      <p class="rs-lede">All optional. These help the right helpers find it, and their agents get them in the brief.</p>
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
      </div>`;
  }
  function stepWho(){
    const s = src(), canPrivate = !!s.canPrivate;
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
        <p class="rs-muted">Public sidequests are records anyone could look up. This says who it’s meant for: Rainshare shows it only to them and only offers it to them. For something truly private, post it in a group.</p>`;
    }
    return `<h1 tabindex="-1">Who’s it for?</h1>
      <p class="rs-lede">Only the people you pick see it on their board and can take it on.</p>
      <div class="rs-tiles rs-tiles-2" role="radiogroup" aria-label="Public or private">
        ${tile('data-rs-vis', 'public', P.vis === 'public', 'Public, for my circle', 'Uses who you follow on Bluesky')}
        ${tile('data-rs-vis', 'group', P.vis === 'group', 'Private, in a group', canPrivate ? 'Only its members can read it' : 'Needs groups, which this app can’t reach here', canPrivate ? '' : ' disabled')}
      </div>
      ${body}
      <label class="rs-check"><input type="checkbox" name="parallel"${P.parallel ? ' checked' : ''}> More than one helper can try at once</label>`;
  }
  function stepLook(){
    const sq = input(), pub = P.vis === 'public';
    const rowOf = (n, label, html) => `<div><dt>${label}</dt><dd>${html}</dd><button class="rs-link" type="button" data-rs-step="${n}" aria-label="Edit ${label.toLowerCase()}">Edit</button></div>`;
    return `<h1 tabindex="-1">Look it over</h1>
      <p class="rs-lede">This is everything a helper and their agent will get.</p>
      <dl class="rs-review">
        ${rowOf(1, 'Where', esc(whereLong(sq)))}
        ${rowOf(2, 'What', `<b>${esc(sq.title)}</b>${sq.spec ? `<br>${esc(askExcerpt(sq.spec, 360))}` : '<br><span class="rs-muted">No details beyond the title.</span>'}${sq.specUrl ? '<br><span class="rs-muted">And a longer spec, linked.</span>' : ''}`)}
        ${rowOf(3, 'How', esc(howText(sq)))}
        ${rowOf(4, 'Who', esc(whoText()))}
      </dl>
      ${pub ? `<div class="rs-bsky-opt">
        <label class="rs-check"><input type="checkbox" name="bsky"${P.bsky ? ' checked' : ''}> Also post it on Bluesky, so ${P.audience === 'anyone' ? 'people' : FOR[P.audience]} notice</label>
        ${P.bsky ? `<textarea name="bskyText" rows="3" maxlength="230" aria-label="Your Bluesky post">${esc(bskyText())}</textarea><small>The link to it goes on the end. Bluesky opens with this ready, and you post it there.</small>` : ''}
      </div>` : ''}
      <p class="rs-muted">${pub ? 'It’s saved as a record in your own account.' : `It’s saved in your own account, inside ${esc(groupNow()?.name || 'the group')}’s private Rainshare space.`} You can close it, reopen it or delete it whenever you like.</p>`;
  }

  // The preview beside the steps: the card as the board will show it, then (on the last
  // step) the details a helper sees when they open it.
  function side(){
    const sq = input(), me = ui.self();
    const line = P.step < 3 ? (P.kind === 'idea' || !sq.subject ? (P.kind ? 'An idea, no repo yet' : 'Where it is goes here') : whereText(sq))
      : [P.kind === 'idea' || !sq.subject ? 'An idea' : shortWhere(sq), jobShort(sq), wantsShort(sq)].filter(Boolean).join(' · ');
    const card = `<div class="rs-mini">
      <div class="rs-mini-top">${face(me, 'xs')}<b>You</b><span>· ${esc(P.step >= 4 ? whoFor() : 'just now')}</span></div>
      <b class="rs-mini-title">${esc(sq.title.trim() || 'Your title goes here')}</b>
      <span class="rs-mini-line">${esc(line)}</span></div>`;
    if (P.step === 5) return `<span class="rs-side-label">What a helper sees when they open it</span>
      <div class="rs-mini rs-mini-open">
        <div class="rs-mini-top">${face(me, 'xs')}<b>You</b><span>· ${esc(whoFor())} · just now</span></div>
        <b class="rs-mini-title">${esc(sq.title.trim() || 'Your title goes here')}</b>
        <span class="rs-mini-fit">Each helper sees how well it suits them here, from their own profile and yours.</span>
        <dl class="rs-facts rs-facts-sm"><dt>Where</dt><dd>${esc(P.kind === 'idea' || !sq.subject ? 'No repo yet' : whereText(sq))}</dd><dt>The job</dt><dd>${esc(jobText(sq))}</dd><dt>Would like</dt><dd>${esc(wantsText(sq))}</dd></dl>
      </div>`;
    return `<span class="rs-side-label">How your circle will see it</span>${card}<p class="rs-muted">${esc(P.step === 4 ? reachText() : HINTS[P.step])}</p>`;
  }
  // Typing only repaints the preview and the line under the link, so fields keep their focus.
  function paint(){
    const s = ui.root.querySelector('.rs-post-side'); if (s) s.innerHTML = side();
    const f = ui.root.querySelector('[data-rs-found]'); if (f) f.innerHTML = found();
  }

  function done(){
    const d = P.done, sq = input(), pub = !d.group;
    const intent = pub && P.bsky && d.page ? `https://bsky.app/intent/compose?text=${encodeURIComponent(`${bskyText()} ${d.page}`)}` : null;
    return `<section class="rs-post-done" aria-live="polite">
      <span class="rs-done-mark">${ico('check')}</span>
      <h1 tabindex="-1">It’s out there.</h1>
      <p class="rs-lede">${esc(doneText())}</p>
      <div class="rs-mini">
        <div class="rs-mini-top">${face(ui.self(), 'xs')}<b>You</b><span>· ${esc(whoFor())} · just now</span></div>
        <b class="rs-mini-title">${esc(sq.title)}</b>
        <span class="rs-mini-line">${esc([P.kind === 'idea' || !sq.subject ? 'An idea' : shortWhere(sq), jobShort(sq), wantsShort(sq)].filter(Boolean).join(' · '))}</span>
      </div>
      ${pub && P.bsky ? `<div class="rs-bsky">
        <b>Tell your circle on Bluesky</b>
        <p>${esc(bskyText())} <span class="rs-muted">${esc(d.page || '')}</span></p>
        ${src().demo ? '<small>This is the example circle, so nothing goes to Bluesky.</small>' : intent ? `<a class="rs-btn rs-primary" href="${esc(intent)}" target="_blank" rel="noopener">${ico('sky')}Post it on Bluesky</a>` : ''}
      </div>` : ''}
      <div class="rs-next"><h2>What happens next</h2><ol>
        <li><b>A friend sends their agent.</b> <span>You’ll see who’s on it, and what they’re running.</span></li>
        <li><b>They turn in a pull request.</b> <span>It shows up on your sidequest, with the model that did the work.</span></li>
        <li><b>You mark it cleared.</b> <span>And thank them on Bluesky, if you like.</span></li>
      </ol></div>
      <div class="rs-row">${ui.a(d.path, 'See your sidequest', 'rs-btn rs-primary')}<button class="rs-btn rs-quiet" type="button" data-rs-again>Post another</button></div>
    </section>`;
  }

  function view(){
    ui.title('Post a sidequest');
    if (P.done) return `<div class="rs-post">${done()}</div>`;
    const body = [, stepWhere, stepWhat, stepHow, stepWho, stepLook][P.step]();
    const next = { 1: 'Next: what you’d like done', 2: 'Next: how it should be done', 3: 'Next: who it’s for', 4: 'Next: look it over', 5: P.busy ? 'Posting…' : 'Post it' }[P.step];
    return `<div class="rs-post">
      <header class="rs-post-head"><span>Post a sidequest</span><button class="rs-link" type="button" data-rs-post-cancel>Cancel</button></header>
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
    return pick('[data-rs-step]', el => goStep(+el.dataset.rsStep))
      || pick('[data-rs-back]', () => { P.err = ''; P.step = Math.max(1, P.step - 1); ui.render(); arrive(); })
      || pick('[data-rs-kind]', el => {
        const k = el.dataset.rsKind; if (P.kind === k) return;
        Object.assign(P, { kind: k, err: '', link: '', subject: null, info: null, repo: null, issues: null });
        if (k === 'tangled' && (P.repos === null || P.repos?.error)) return loadRepos();
        if (k === 'tangled' && Array.isArray(P.repos) && P.repos.length === 1) return loadIssues(P.repos[0].repoDid);
        ui.render(); ui.root.querySelector('.rs-post [name="link"]')?.focus();
      })
      || pick('[data-rs-issue]', el => { pickIssue(el.dataset.rsIssue); P.err = ''; ui.render(); })
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
    submit(){ if (P.busy) return; if (P.step < 5) goStep(P.step + 1); else post(); },
    /** Coming to the wizard: a finished one starts over; a draft is kept. */
    enter(){ if (P.done) P = fresh(); if (P.groups === null) loadBits(); },
    reset(){ P = fresh(); }
  };
}
