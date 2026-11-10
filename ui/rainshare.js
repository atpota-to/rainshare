// Rainshare's screens, for any host: rainshare.dev (../src/main.js), or another site that
// wants Rainshare inside it. The host hands in a data source (source.js for real
// accounts, demo.js for the example circle) and a few hooks, and calls show(subpath)
// whenever the address changes:
//
//   ''                 the board: For you, Everyone, Yours. Short cards in a list, and the
//                      one you pick in full beside them (a sheet from the bottom on phones)
//   seed/<did>/<rkey>  a public seed (a handle works in place of the DID)
//   seed/s/<code>      a private one, in a group's space (its record URI, base64url)
//   new                plant a seed (./post.js)
//   me                 your profile: setups, budget, forecast, who you'd like to help first
//   u/<did>            someone's profile and their seeds
//   agents             the CLI and MCP server, for sending agents from a terminal
import { SEED, HARNESSES, MODELS, RUNS_ON, BUDGETS, FORECAST, CIRCUMSTANCES, PRIORITIES, VALUES, labelOf, audienceOf, modelName } from '../core/ns.js';
import { describeSubject, cloneUrlOf, kindOf, subjectInfo, pullState, safeHttp, FORGE_NAMES } from '../core/subjects.js';
import { audienceLine } from '../core/circle.js';
import { rank, fit, join, pretty } from '../core/rank.js';
import { whereText, shortWhere, jobText, jobShort, wantsText, onItText, takenShort, relationText, askExcerpt, stateText } from '../core/words.js';
import { renderMarkdown } from '../core/markdown.js';
import { brief, launchers, pageOf, sh, INSTALL, MCP_ADD, CLI_HOME } from '../core/brief.js';
import { strongRef, HARNESS_NAMES } from '../core/records.js';
import { resolveHandle, knownPerson } from '../core/net.js';
import { esc, unb64url, ago, until, nameOf, firstName, ico, skyIco, lifeIco, lifeOf, face, drops, pathOf } from './bits.js';
import { createPoster } from './post.js';

export { pathOf };

export function createRainshare({ root, base = '/', host }){
  const S = {
    source: null, view: null, sub: '', tab: 'foryou',
    board: null, boardAt: 0, loading: false, error: null, shown: [], pick: null, sheet: false,
    mine: null, seed: null, seedErr: null, launch: null, pendingLaunch: null, other: null, form: null, drafts: {}, signin: null
  };
  const signedIn = () => !!S.source?.signedIn;
  const viewer = () => S.source?.viewer || null;
  const href = sub => sub ? base.replace(/\/$/, '') + '/' + sub : base;
  const go = (sub, o) => host.navigate(href(sub), o);
  const toast = m => host.toast(m);
  const title = t => host.onTitle?.(t);
  const me = () => ({ did: viewer(), profile: S.mine?.merged || {} });
  const self = () => S.source?.me || S.mine?.person || knownPerson(viewer()) || { did: viewer() };

  /* ---------- small pieces ---------- */
  const a = (sub, inner, cls = '') => `<a href="${esc(href(sub))}" data-rs-go="${esc(sub)}" class="${cls}">${inner}</a>`;
  const seg = (name, opts, value) => `<div class="rs-seg" role="group" data-rs-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${v === value}">${esc(l)}</button>`).join('')}</div>`;
  const toggles = (name, opts, values) => `<div class="rs-toggles" data-rs-toggles="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${(values || []).includes(v)}">${esc(l)}</button>`).join('')}</div>`;
  function plain(e){
    const say = {
      NotSignedIn: 'Sign in first.',
      ScopeMissingError: 'Your sign-in is from before Rainshare needed this. Sign out and in again.',
      NoSpaces: 'Your account’s server doesn’t support private spaces yet, so private seeds stay closed to you.',
      NoBoard: 'That group doesn’t have Rainshare yet.',
      NotYours: 'Only the person who asked can do that.',
      Timeout: 'The network took too long to answer. Try again.',
      Forbidden: 'Your role in that group doesn’t allow it.'
    }[e?.name];
    return esc(say || e?.message || 'Something went wrong. Try again in a moment.');
  }
  const plainText = e => { const d = document.createElement('div'); d.innerHTML = plain(e); return d.textContent; };
  function copy(text, what = 'Copied'){
    const done = () => toast(what);
    try { navigator.clipboard.writeText(text).then(done, () => toast('Select it and copy')); } catch (_) { toast('Select it and copy'); }
  }
  const forecastOf = p => p?.forecast?.level ? FORECAST.find(f => f[0] === p.forecast.level) : null;
  const isOpen = it => !it.value?.state || it.value.state === 'open';
  const myTake = it => (it.takes || []).find(t => t.repo === viewer());
  const mySetup = () => S.mine?.merged?.setups?.[0] || null;
  const fitBox = f => `<div class="rs-fitbox">${drops(f.level)}<p><b>${esc(f.label)} for you.</b> ${esc(f.why)}</p></div>`;
  function shareUrl(it){
    const page = pageOf(it), sq = it.value || {};
    if (it.space || it.example || !page) return null;
    return `https://bsky.app/intent/compose?text=${encodeURIComponent(it.repo === viewer() ? `Got spare agent usage? I planted a seed on Rainshare and would love a hand: “${sq.title}” ${page}` : `A friend’s seed on Rainshare could use some rain: “${sq.title}” ${page}`)}`;
  }
  // Public ones share on Bluesky; private and example ones copy their link (which only works
  // for people who can see them anyway).
  const shareBtn = (it, label = 'Share') => {
    const u = shareUrl(it);
    return u ? `<a class="rs-btn rs-quiet" href="${esc(u)}" target="_blank" rel="noopener">${label}</a>`
      : `<button class="rs-btn rs-quiet" type="button" data-rs-copy-text="${esc(location.origin + href(pathOf(it)))}">Copy link</button>`;
  };

  /* ---------- loading ---------- */
  async function loadBoard(force){
    if (!S.source) return;
    if (S.loading && !force) return S.loading;
    if (!force && S.board && Date.now() - S.boardAt < 60e3) return;
    S.error = null;
    S.loading = S.source.board({ force }).then(b => { S.board = b; S.boardAt = Date.now(); }, e => { S.error = e; console.warn('rainshare board', e); })
      .finally(() => { S.loading = null; if (S.view === 'board' || S.view === 'person') render(); });
    if (S.view === 'board') render();
    return S.loading;
  }
  async function loadMine(force){
    if (!signedIn()) { S.mine = null; return; }
    try { S.mine = await S.source.profileOf(viewer(), { force }); } catch (e) { console.warn('rainshare profile', e); S.mine = { merged: null, hidden: [], groups: [] }; }
  }

  /* ---------- the board: a list of short cards, and the one you pick beside them ---------- */
  function boardItems(){
    const all = S.board?.items || [], mineD = viewer();
    let items;
    if (S.tab === 'yours') items = all.filter(it => it.repo === mineD || (it.takes || []).some(t => t.repo === mineD) || (it.deliveries || []).some(d => d.repo === mineD));
    else if (S.tab === 'everyone') items = all.filter(it => isOpen(it) && !it.space && audienceOf(it.value) === 'anyone');
    else {
      const others = all.filter(it => isOpen(it) && it.repo !== mineD);
      return signedIn() ? rank(others, me()) : others;
    }
    return signedIn() ? items.map(it => ({ ...it, fit: it.repo === mineD || !isOpen(it) ? null : fit(it, me()) })) : items;
  }
  // One card: who, the title, and one quiet line (how well it suits you, or where and how big).
  function card(it, { nav = false } = {}){
    const sq = it.value || {}, p = it.author || {}, mine = it.repo === viewer(), on = !nav && it.uri === S.pick;
    const rel = mine ? '' : relationText(it, viewer());
    let line;
    if (!isOpen(it)) line = `<span class="rs-state${sq.state === 'sprouted' ? ' rs-ok' : ''}">${sq.state === 'sprouted' ? lifeIco('sprouted') : ''}${esc(stateText(sq))}</span>`;
    else if (mine) line = `<span>Yours${(it.deliveries || []).length ? ` · ${it.deliveries.length} turned in` : ''}</span>`;
    else if (it.fit) line = `${drops(it.fit.level)}<span class="rs-fit-l">${esc(it.fit.label)}</span>`;
    else line = `<span>${esc([shortWhere(sq), jobShort(sq)].filter(Boolean).join(' · '))}</span>`;
    const taken = isOpen(it) ? takenShort(it, viewer()) : '';
    return `<li><a class="rs-item${on ? ' on' : ''}" href="${esc(href(pathOf(it)))}" ${nav ? `data-rs-go="${esc(pathOf(it))}"` : `data-rs-pick="${esc(it.uri)}"`}${on ? ' aria-current="true"' : ''}>
      <span class="rs-item-top">${face(p, 'xs')}<span class="rs-item-who"><b>${esc(mine ? 'You' : nameOf(p))}</b>${rel ? `<span> · ${it.space ? ico('lock') : ''}${esc(rel)}</span>` : ''}</span><time>${esc(ago(sq.createdAt))}</time></span>
      <span class="rs-item-title">${esc(sq.title)}</span>
      <span class="rs-item-line">${line}${taken ? `<span class="rs-item-taken">${lifeIco(lifeOf(it))}${esc(taken)}</span>` : ''}</span>
    </a></li>`;
  }
  // Where, the job, what they'd like and who's on it, each as a plain line.
  function facts(it, extra = []){
    const sq = it.value || {}, d = describeSubject(sq.subject), mine = it.repo === viewer();
    const open = d?.href && !it.example ? ` · <a href="${esc(d.href)}" target="_blank" rel="noopener">open it</a>` : '';
    const rows = [
      ['Where', esc(whereText(sq)) + open],
      ['The job', esc(jobText(sq))],
      ['Would like', esc(wantsText(sq, mine ? null : S.mine?.merged))],
      ...extra,
      ['On it', esc(onItText(it, viewer()))]
    ];
    return `<dl class="rs-facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  }
  function detail(it){
    const sq = it.value || {}, p = it.author || {}, mine = it.repo === viewer(), open = isOpen(it), page = pathOf(it);
    const rel = mine ? 'yours' : relationText(it, viewer());
    const f = !mine && open && signedIn() ? it.fit || fit(it, me()) : null;
    let buttons;
    if (!open) buttons = a(page, sq.state === 'sprouted' ? 'See how it went' : 'Open it', 'rs-btn rs-quiet');
    else if (mine) buttons = a(page, 'Open it', 'rs-btn rs-primary') + shareBtn(it);
    else if (!signedIn()) buttons = (host.signIn ? '<button class="rs-btn rs-primary" type="button" data-rs-act="signin">Sign in to take it on</button>' : '') + shareBtn(it);
    else if (myTake(it)) buttons = a(page, 'You’re on it: turn it in', 'rs-btn rs-primary');
    else buttons = `<button class="rs-btn rs-primary" type="button" data-rs-take="${esc(it.uri)}">${ico('drop')}Send my agent</button>${shareBtn(it)}`;
    return `<article class="rs-detail">
      <div class="rs-detail-top">${a('u/' + it.repo, face(p) + `<b>${esc(mine ? 'You' : nameOf(p))}</b>`, 'rs-who')}<span class="rs-muted">${rel ? ' · ' + (it.space ? ico('lock') : '') + esc(rel) : ''} · ${esc(ago(sq.createdAt))}</span>
        <button class="rs-sheet-close" type="button" data-rs-close-sheet aria-label="Close">${ico('close')}</button></div>
      <h2 tabindex="-1">${esc(sq.title)}</h2>
      ${f ? fitBox(f) : !open ? `<p class="rs-state${sq.state === 'sprouted' ? ' rs-ok' : ''}">${sq.state === 'sprouted' ? `${lifeIco('sprouted')}Sprouted. Thanks, everyone.` : 'Closed.'}</p>` : !signedIn() ? `<p class="rs-muted">${esc(audienceLine(sq, { authorName: firstName(p), groupName: it.group?.name }))}.</p>` : ''}
      ${facts(it)}
      <div class="rs-ask"><span class="rs-label">The ask</span><p>${esc(askExcerpt(sq.spec) || 'No details beyond the title.')}</p>${a(page, 'Read all of it', 'rs-link')}</div>
      <div class="rs-row rs-detail-actions">${buttons}</div>
    </article>`;
  }
  // What's growing, at a glance: how many seeds are in the ground, being rained on, turned in and sprouted.
  function growing(){
    const all = S.board?.items || [], n = { seed: 0, rain: 0, up: 0, sprouted: 0 };
    for (const it of all) if (it.value?.state !== 'closed') n[lifeOf(it)]++;
    const said = { seed: 'in the ground', rain: 'being rained on', up: 'turned in', sprouted: 'sprouted' };
    const parts = Object.keys(n).filter(k => n[k]).map(k => `<li>${lifeIco(k)}<b>${n[k]}</b> ${said[k]}</li>`);
    return signedIn() && parts.length ? `<ul class="rs-growing" aria-label="Your circle’s seeds, by where they are">${parts.join('')}</ul>` : '';
  }
  function renderBoard(){
    const items = S.board ? boardItems() : [];
    S.shown = items;
    if (items.length && !items.some(i => i.uri === S.pick)) { S.pick = items[0].uri; S.sheet = false; }
    const sel = items.find(i => i.uri === S.pick);
    const fc = forecastOf(S.mine?.merged);
    const empty = {
      foryou: signedIn() ? 'Nothing from your circle yet. When people you follow plant seeds meant for you, they show up here. Plant one of your own to get it going.' : 'Nothing’s open to everyone right now. Sign in to see what your circle would like done.',
      everyone: 'Nobody has planted a seed open to everyone yet.',
      yours: 'Seeds you plant or take on show up here.'
    }[S.tab];
    const hint = {
      foryou: signedIn() ? 'The drops show how well each one suits you. Pick one to see the details beside the list.' : 'Open to everyone. Sign in to see your circle’s too, sorted for you.',
      everyone: 'Open to anyone who comes across them, newest first.',
      yours: 'What you’ve planted, and what you’ve taken on.'
    }[S.tab];
    const tabs = [['foryou', signedIn() ? 'For you' : 'Open'], ['everyone', 'Everyone'], ...(signedIn() ? [['yours', 'Yours']] : [])];
    return `
      <header class="rs-head">
        <div class="rs-brand">${host.brand !== 'rainshare' ? `<span class="rs-logo">${ico('drop')}</span>` : ''}<div>${
          // On rainshare.dev a signed-out board sits under the landing, which has the page's h1.
          host.brand !== 'rainshare' ? '<h1>Rainshare</h1><p>Your friends’ seeds, for whoever has rain to spare.</p>'
            : signedIn() ? '<h1>Your circle’s seeds</h1><p>Things your friends would like done, for whoever has rain to spare.</p>'
              : '<h2>Seeds anyone can water</h2><p>Things people would like done that anyone can take on. Sign in to see your own circle’s.</p>'
        }</div></div>
        <div class="rs-head-actions">
          ${signedIn() ? a('me', `${skyIco(fc?.[0])}${fc ? esc(fc[1]) : 'Your forecast'}`, 'rs-btn rs-quiet rs-fc' + (fc ? ' rs-fc-' + fc[0] : '')) : ''}
          ${signedIn() ? a('new', `${ico('plus')}Plant a seed`, 'rs-btn rs-primary') : host.signIn ? `<button class="rs-btn rs-primary" type="button" data-rs-act="signin">Sign in</button>` : ''}
        </div>
      </header>
      ${S.source?.demo ? `<p class="rs-note rs-demo">${ico('sky')}<span>This is an example circle: pretend friends, real ideas. Anything you do here stays in this browser.</span>${host.exitDemo ? `<button class="rs-link" type="button" data-rs-act="exit-demo">${host.exitDemo}</button>` : ''}</p>` : ''}
      ${signedIn() && S.mine && !S.mine.merged ? `<p class="rs-note">${ico('person')}<span>Tell your circle what you run and who you’d like to help, so the right seeds rise to the top.</span>${a('me', 'Set up your profile', 'rs-link')}</p>` : ''}
      ${growing()}
      <div class="rs-board-head">
        <nav class="rs-tabs" aria-label="Seeds">${tabs.map(([k, l]) => `<button type="button" data-rs-tab="${k}" aria-pressed="${S.tab === k}">${l}</button>`).join('')}
          <button type="button" class="rs-link rs-refresh" data-rs-act="refresh">${S.loading ? 'Checking…' : 'Refresh'}</button></nav>
        ${items.length ? `<p class="rs-muted">${esc(hint)}</p>` : ''}
      </div>
      ${S.error ? `<p class="rs-note rs-bad">${plain(S.error)}</p>` : ''}
      ${!S.board ? `<div class="rs-split"><ul class="rs-list">${'<li class="rs-ghost"><div></div></li>'.repeat(4)}</ul><div class="rs-side rs-ghost"><div></div></div></div><p class="rs-muted">Looking for seeds across the network…</p>`
        : items.length ? `<div class="rs-split${S.sheet ? ' rs-open' : ''}">
            <ul class="rs-list" aria-label="Seeds">${items.map(it => card(it)).join('')}</ul>
            <div class="rs-scrim" data-rs-close-sheet aria-hidden="true"></div>
            <aside class="rs-side" aria-label="The seed you picked">${sel ? detail(sel) : ''}</aside>
          </div>`
        : `<p class="rs-empty">${empty}</p>`}
      ${(S.board?.notes || []).map(n => `<p class="rs-note">${esc(n)}</p>`).join('')}
      <footer class="rs-foot">${a('agents', `${ico('term')}Send agents from your terminal`, 'rs-link')}<span class="rs-muted">Seeds are records in each person’s own account, on the open network.</span></footer>`;
  }
  // Picking a card fills the panel beside the list (or the sheet, on a phone) without
  // redrawing the list, so nothing else on the page moves.
  const narrow = () => !!globalThis.matchMedia?.('(max-width: 899px)').matches;
  function pick(uri){
    const it = S.shown.find(i => i.uri === uri), split = root.querySelector('.rs-split');
    S.pick = uri; S.sheet = true;
    if (!it || !split) return render();
    split.classList.add('rs-open');
    split.querySelectorAll('.rs-item').forEach(el => { const on = el.dataset.rsPick === uri; el.classList.toggle('on', on); if (on) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current'); });
    const side = split.querySelector('.rs-side');
    side.innerHTML = detail(it); side.scrollTop = 0;
    if (narrow()) side.querySelector('h2')?.focus({ preventScroll: true });
  }
  function closeSheet(){
    S.sheet = false;
    root.querySelector('.rs-split')?.classList.remove('rs-open');
    root.querySelector(`.rs-item[data-rs-pick="${CSS.escape(S.pick || '')}"]`)?.focus({ preventScroll: true });
  }
  async function takeIt(it, el){
    if (el) el.disabled = true;
    try {
      await S.source.take(it, { setup: mySetup() || undefined });
      const fresh = await S.source.seed(it.uri, { force: true }) || it;
      const l = pickLauncher(launchers(fresh));
      S.board = null; loadBoard();
      if (l) copy(l.command, `You’re on it. Copied the ${l.label} command: paste it in a terminal.`); else toast('You’re on it');
      return { fresh, launch: l?.id || 'none' };
    } catch (e) { console.warn('rainshare take', e); toast(plainText(e)); if (el) el.disabled = false; return null; }
  }
  // From the panel: take it on, then open its page with the commands to start an agent.
  async function takeFromPanel(uri, el){
    const it = S.shown.find(i => i.uri === uri); if (!it) return;
    const r = await takeIt(it, el); if (!r) return;
    S.seed = r.fresh; S.pendingLaunch = { uri, id: r.launch }; S.sheet = false;
    go(pathOf(it));
  }

  /* ---------- one seed, in full ---------- */
  async function loadSeed(sub){
    S.seedErr = null;
    let uri;
    const priv = sub.match(/^seed\/s\/([A-Za-z0-9_-]+)$/);
    if (priv) uri = unb64url(priv[1]);
    else {
      const m = sub.match(/^seed\/([^/]+)\/([^/]+)$/);
      if (m) {
        const who = decodeURIComponent(m[1]);
        const did = who.startsWith('did:') ? who : await resolveHandle(who).catch(() => null);
        uri = did ? `at://${did}/${SEED}/${m[2]}` : null;
      }
    }
    // Arriving from "Send my agent" on the board: the commands to start one are open.
    S.launch = S.pendingLaunch?.uri === uri ? S.pendingLaunch.id : null;
    S.pendingLaunch = null;
    if (!uri) { S.seed = null; S.seedErr = { message: 'That isn’t a seed link.' }; return; }
    const cached = S.seed?.uri === uri ? S.seed : S.board?.items.find(i => i.uri === uri);
    S.seed = cached || null;
    if (S.view === 'seed') render();
    try {
      const fresh = await S.source.seed(uri, { force: !!cached });
      if (fresh) S.seed = fresh; else if (!cached) S.seedErr = { message: 'This seed is gone, or it isn’t one you can see.' };
    } catch (e) { if (!cached) S.seedErr = e; console.warn('rainshare seed', e); }
    if (S.seed && !S.seed.example) enrich(S.seed);
  }
  // The issue's title and the pull requests' states, where a public API has them.
  async function enrich(item){
    const sub = item.value?.subject;
    if (sub && (kindOf(sub) === 'githubIssue' || kindOf(sub) === 'tangledIssue') && !item.issue) {
      item.issue = await subjectInfo(sub);
      if (S.seed === item && S.view === 'seed') render();
    }
    await Promise.all((item.deliveries || []).filter(d => d.state === undefined).map(async d => {
      d.state = await pullState({ url: d.value?.url, pull: d.value?.pull });
    }));
    if (S.seed === item && S.view === 'seed') render();
  }
  const setupText = s => s ? `${HARNESS_NAMES[s.harness] || s.harness}${s.models?.length ? ` (${join(s.models.map(modelName))})` : ''}` : '';
  // Someone's profile as a few plain lines.
  function profileCard(p, person, { compact } = {}){
    if (!p) return `<p class="rs-muted">${esc(nameOf(person))} hasn’t set up a Rainshare profile yet.</p>`;
    const fc = forecastOf(p);
    const rows = [
      ['AI budget', p.budget && labelOf(BUDGETS, p.budget)],
      ['About them', p.circumstances?.length && p.circumstances.map(c => labelOf(CIRCUMSTANCES, c)).join(', ')],
      ['Runs', (p.setups || []).map(s => setupText(s) + (s.plan ? ` (${s.plan})` : '')).join('; ')],
      ['Forecast', fc && `${fc[1]}: ${fc[2].toLowerCase()}${p.forecast.until ? `, until ${until(p.forecast.until)}` : ''}.${p.forecast.note ? ` “${p.forecast.note}”` : ''}`],
      ['Cares about', p.values?.length && join(p.values.map(pretty))],
      ...(compact ? [] : [
        ['Helps first', p.priorities?.length && p.priorities.map(v => labelOf(PRIORITIES, v)).join(', ')],
        ['Takes on', p.offering?.length && join(p.offering)]
      ])
    ].filter(r => r[1]);
    return `${p.bio ? `<p class="rs-bio">${esc(p.bio)}</p>` : ''}${rows.length ? `<dl class="rs-facts rs-facts-sm">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${k === 'Forecast' ? `<span class="rs-fc-${fc[0]}">${skyIco(fc[0])}</span>` : ''}${esc(v)}</dd>`).join('')}</dl>` : p.bio ? '' : '<p class="rs-muted">Nothing shared yet.</p>'}`;
  }
  function renderLaunch(it){
    const ls = launchers(it);
    return `<section class="rs-launch" id="rsLaunch" aria-label="Send your agent">
      <h3>${ico('term')}Send your agent</h3>
      <p class="rs-muted">Paste one into a terminal. Each one starts an agent with the brief below, which frames this as ${esc(firstName(it.author))}’s request rather than orders.</p>
      ${it.example ? '<p class="rs-note">This is an example seed, so these point at pretend repos. For a real one they’re ready to paste.</p>' : ''}
      <ol class="rs-launchers">${ls.map((l, i) => `<li data-rs-launch="${i}"${S.launch === l.id || (!ls.some(x => x.id === S.launch) && i === 0) ? ' class="on"' : ''}>
        <div class="rs-l-head"><b>${esc(l.label)}</b><button class="rs-btn rs-quiet rs-sm" type="button" data-rs-copy="${i}">${ico('copy')}Copy</button></div>
        <small>${esc(l.note)}</small><pre><code>${esc(l.command.length > 600 ? l.command.slice(0, 600) + '\n…' : l.command)}</code></pre></li>`).join('')}</ol>
      <details class="rs-brief"><summary>The brief your agent gets</summary><pre>${esc(brief(it))}</pre><button class="rs-btn rs-quiet rs-sm" type="button" data-rs-act="copy-brief">${ico('copy')}Copy the brief</button></details>
      ${a('agents', 'Set up the CLI and MCP server once', 'rs-link')}
    </section>`;
  }
  function renderSeed(){
    const back = a('', `${ico('back')}All seeds`, 'rs-back');
    if (S.seedErr) return `${back}<p class="rs-empty">${plain(S.seedErr)}</p>`;
    const it = S.seed;
    if (!it) return `${back}<div class="rs-seed rs-ghost"><div></div></div>`;
    const sq = it.value || {}, p = it.author || {}, mine = it.repo === viewer(), taken = myTake(it), d = describeSubject(sq.subject), clone = cloneUrlOf(sq.subject);
    const page = pageOf(it), open = isOpen(it), issue = it.issue;
    title(sq.title);
    const f = !mine && open && signedIn() && !taken ? fit(it, me()) : null;
    const where = !d ? 'No repo yet. A helper can start one, or suggest where it should live.'
      : `${esc(whereText(sq))}${issue?.title ? `<br><span class="rs-muted">“${esc(issue.title)}”${issue.state ? `, ${esc(issue.state)}` : ''}</span>` : ''}
        <span class="rs-row rs-where-links">${d.href && !it.example ? `<a class="rs-link" href="${esc(d.href)}" target="_blank" rel="noopener">Open on ${esc(FORGE_NAMES[d.forge] || 'the forge')}</a>` : ''}${clone ? `<button class="rs-link" type="button" data-rs-copy-text="${esc('git clone ' + sh(clone))}">Copy the clone command</button>` : ''}</span>`;
    const takes = (it.takes || []).map(t => `${t.repo === viewer() ? 'You' : nameOf(t.author)}${t.value?.setup ? ', with ' + setupText(t.value.setup) : ''}${t.value?.note ? `: “${t.value.note}”` : ''}`);
    const facts = [
      ['Where', where],
      ['The job', esc(jobText(sq))],
      ['Would like', esc(wantsText(sq, mine ? null : S.mine?.merged))],
      sq.tags?.length ? ['Tagged', esc(join(sq.tags))] : null,
      sq.values?.length ? ['Stands for', esc(join(sq.values.map(pretty)))] : null,
      ['Who it’s for', esc(audienceLine(sq, { authorName: mine ? 'you' : firstName(p), groupName: it.group?.name })) + (it.space ? '. Only the group’s members can read it.' : '.')],
      ['On it', esc(takes.length ? takes.join('; ') : 'Nobody yet')]
    ].filter(Boolean);
    const sprouted = new Set((sq.sproutedWith || []).map(r => r.uri));
    const deliveries = (it.deliveries || []).map(dl => {
      const v = dl.value || {}, setup = setupText(v.setup), url = safeHttp(v.url);
      const status = sprouted.has(dl.uri) ? `<span class="rs-status rs-ok">${lifeIco('sprouted')}Made it sprout</span>` : { merged: '<span class="rs-status rs-ok">Merged</span>', open: '<span class="rs-status">Open</span>', closed: '<span class="rs-status rs-dim">Closed</span>' }[dl.state] || '';
      const thank = mine && !it.example && dl.author?.handle ? `<a class="rs-link" target="_blank" rel="noopener" href="https://bsky.app/intent/compose?text=${encodeURIComponent(`Thank you @${dl.author.handle} for taking on my seed “${sq.title}”${setup ? ` (${setup})` : ''} ${url || page || ''}`)}">Thank them on Bluesky</a>` : '';
      const sprout = mine && open ? `<button class="rs-btn rs-quiet rs-sm" type="button" data-rs-sprout="${esc(dl.uri)}">${lifeIco('up')}This made it sprout</button>` : '';
      const shown = String(v.url || '').replace(/^https?:\/\//, '').slice(0, 70);
      return `<li>${face(dl.author)}<div><span><b>${esc(dl.repo === viewer() ? 'You' : nameOf(dl.author))}</b> turned it in${status ? ' · ' + status : ''}</span>
        <small>${setup ? esc(setup) + ' · ' : ''}${esc(ago(v.createdAt))}</small>
        ${v.note ? `<p>${esc(v.note)}</p>` : ''}
        <div class="rs-row">${url && !it.example ? `<a class="rs-link" href="${esc(url)}" target="_blank" rel="noopener nofollow">${ico('link')}${esc(shown)}</a>` : shown ? `<span class="rs-muted">${ico('link')} ${esc(shown)}</span>` : ''}${safeHttp(v.sessionUrl) && !it.example ? `<a class="rs-link" href="${esc(safeHttp(v.sessionUrl))}" target="_blank" rel="noopener nofollow">See the session</a>` : ''}${sprout}${thank}</div></div></li>`;
    }).join('');
    const setup = mySetup();
    let actions = '';
    if (mine) {
      actions = `<div class="rs-row">${open ? `<button class="rs-btn rs-quiet" type="button" data-rs-act="close">Close it</button>` : `<button class="rs-btn rs-quiet" type="button" data-rs-act="reopen">Reopen it</button>`}
        ${shareBtn(it, 'Share on Bluesky')}
        <button class="rs-link rs-danger" type="button" data-rs-act="delete">Delete</button></div>
        ${open && !(it.deliveries || []).length ? '<p class="rs-muted">When a helper turns it in, you can mark it sprouted here.</p>' : ''}`;
    } else if (!signedIn()) {
      actions = `<div class="rs-row">${host.signIn ? `<button class="rs-btn rs-primary" type="button" data-rs-act="signin">Sign in to take it on</button>` : ''}${shareBtn(it)}</div>`;
    } else if (!open) {
      actions = `<p class="rs-muted">${sq.state === 'sprouted' ? 'This one’s sprouted. Thanks, everyone.' : 'This one’s closed.'}</p>`;
    } else if (!taken) {
      const others = (it.takes || []).length && !sq.parallel;
      actions = `<div class="rs-row"><button class="rs-btn rs-primary rs-big" type="button" data-rs-act="take">${ico('drop')}Send my agent</button>${shareBtn(it)}</div>
        <p class="rs-muted">${others ? 'Someone’s already on it. You can still try, but check with them first. ' : ''}This tells ${esc(firstName(p))} you’re on it${setup ? ` with ${esc(setupText(setup))}` : ''}, and copies a command that starts your agent.</p>`;
    } else {
      const v = S.drafts.turnIn || {};
      actions = `<p class="rs-note rs-on">${ico('check')}<span>You’re on it${taken.value?.setup ? ` with ${esc(setupText(taken.value.setup))}` : ''}. When the pull request is up, turn it in.</span><button class="rs-link" type="button" data-rs-act="drop">Drop it</button></p>
        ${S.launch ? renderLaunch(it) : ''}
        <form class="rs-form rs-turnin" data-rs-form="turnin">
          <label>Pull request link<input name="url" type="url" placeholder="${d?.forge === 'tangled' ? 'https://tangled.org/…/pulls/…' : 'https://github.com/…/pull/…'}" value="${esc(v.url || '')}" required></label>
          <div class="rs-two"><label>What did the work<select name="harness">${HARNESSES.map(([k, l]) => `<option value="${k}"${(v.harness || taken.value?.setup?.harness || setup?.harness) === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
          <label>Model<input name="model" list="rsModels" value="${esc(v.model || taken.value?.setup?.models?.[0] || setup?.models?.[0] || '')}" placeholder="claude-opus-5-5"></label></div>
          <label>Session link <small>(optional, to show your working)</small><input name="sessionUrl" type="url" value="${esc(v.sessionUrl || '')}"></label>
          <label>A note <small>(optional)</small><input name="note" maxlength="300" value="${esc(v.note || '')}"></label>
          <div class="rs-row"><button class="rs-btn rs-primary" type="submit">Turn it in</button>${S.launch ? '' : '<button class="rs-link" type="button" data-rs-act="show-launch">Show the agent commands</button>'}</div>
        </form>`;
    }
    return `${back}
      <article class="rs-seed">
        <div class="rs-seed-main">
          <div class="rs-detail-top">${a('u/' + it.repo, face(p) + `<b>${esc(mine ? 'You' : nameOf(p))}</b>`, 'rs-who')}<span class="rs-muted">${mine ? '' : ' · ' + (it.space ? ico('lock') : '') + esc(relationText(it, viewer()) || 'open to everyone')} · ${esc(ago(sq.createdAt))}</span></div>
          <h1>${esc(sq.title)}</h1>
          ${!open ? `<p class="rs-state${sq.state === 'sprouted' ? ' rs-ok' : ''}">${sq.state === 'sprouted' ? `${lifeIco('sprouted')}Sprouted` : 'Closed'}</p>` : ''}
          ${f ? fitBox(f) : ''}
          <dl class="rs-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
          <section class="rs-ask-full"><h2>The ask</h2>
            <div class="rs-spec">${sq.spec ? renderMarkdown(sq.spec) : '<p class="rs-muted">No details beyond the title.</p>'}${safeHttp(sq.specUrl) ? `<p><a href="${esc(safeHttp(sq.specUrl))}" target="_blank" rel="noopener nofollow">The longer spec</a></p>` : ''}</div></section>
          <div class="rs-actions">${actions}</div>
          ${deliveries ? `<h2>Turned in</h2><ul class="rs-people rs-deliveries">${deliveries}</ul>` : ''}
        </div>
        <aside class="rs-seed-side">
          <div class="rs-panel"><h2>${esc(mine ? 'Your profile' : 'About ' + firstName(p))}</h2>${profileCard(it.profile, p, { compact: true })}${a('u/' + it.repo, mine ? 'See your profile' : 'See their profile', 'rs-link')}</div>
          <details class="rs-panel rs-hood"><summary>Under the hood</summary><dl>
            <dt>Record</dt><dd><code>${esc(it.uri)}</code></dd>
            <dt>Where it lives</dt><dd>${it.space ? `In ${esc(nameOf(p))}’s repo inside ${esc(it.group?.name || 'the group')}’s Rainshare space, readable only by members.` : `In ${esc(nameOf(p))}’s own repo, on their own server. Anyone can read it; apps show it to the people it’s meant for.`}</dd>
            <dt>Takes and deliveries</dt><dd>Each helper’s <code>dev.rainshare.take</code> and <code>dev.rainshare.delivery</code> records live in their own repo, pointing here.</dd>
          </dl></details>
        </aside>
      </article>`;
  }

  /* ---------- your profile ---------- */
  function renderMe(){
    if (!signedIn()) return `${a('', `${ico('back')}All seeds`, 'rs-back')}<p class="rs-empty">Sign in to set up your profile.</p>`;
    if (!S.mine) return `${a('', `${ico('back')}All seeds`, 'rs-back')}<p class="rs-muted">Loading your profile…</p>`;
    const p = S.form?.profile || structuredClone(S.mine.merged || {}), hidden = S.form?.hidden || (S.mine.merged ? S.mine.hidden : ['budget', 'circumstances']);
    const groups = S.form?.groups ?? null, share = S.form?.share || S.mine.groups.map(g => g.did);
    S.form = { profile: p, hidden, groups, share };
    const setups = p.setups?.length ? p.setups : [{ harness: 'claude-code', models: [] }];
    const fc = p.forecast || {};
    const visSel = field => `<select data-rs-vis="${field}" aria-label="Who sees this"><option value="public"${!hidden.includes(field) ? ' selected' : ''}>Everyone sees this</option><option value="private"${hidden.includes(field) ? ' selected' : ''}>Only my groups</option></select>`;
    const withBoard = (groups || []).filter(g => g.space);
    return `${a('', `${ico('back')}All seeds`, 'rs-back')}
      <form class="rs-form rs-me" data-rs-form="me">
        <h1>Your Rainshare profile</h1>
        <p class="rs-muted">What helpers and askers see. It lives in your own account as a <code>dev.rainshare.profile</code> record, and anything you mark “only my groups” goes only into your groups’ private spaces.</p>
        <label>About you<textarea name="bio" rows="2" maxlength="300" placeholder="What you’re building, what you’re into">${esc(p.bio || '')}</textarea></label>
        <fieldset><legend>Your setups</legend><p class="rs-muted">What you run, so people know what your agents can do.</p>
          <ol class="rs-setups">${setups.map((s, i) => `<li data-setup="${i}">
            <label>Harness<select name="harness">${HARNESSES.map(([k, l]) => `<option value="${k}"${s.harness === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
            <label>Models<input name="models" list="rsModels" value="${esc((s.models || []).join(', '))}" placeholder="claude-opus-5-5"></label>
            <label>Plan<input name="plan" maxlength="64" value="${esc(s.plan || '')}" placeholder="Claude Max 20x"></label>
            <label>Runs<select name="runsOn"><option value="">—</option>${RUNS_ON.map(([k, l]) => `<option value="${k}"${s.runsOn === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
            ${setups.length > 1 ? `<button class="rs-link" type="button" data-rs-remove-setup="${i}">Remove</button>` : ''}</li>`).join('')}</ol>
          ${setups.length < 6 ? `<button class="rs-link" type="button" data-rs-act="add-setup">${ico('plus')}Add another setup</button>` : ''}
        </fieldset>
        <fieldset><legend>Your forecast</legend><p class="rs-muted">How much spare usage you have right now. It rises to the top of your circle’s minds when it’s pouring.</p>
          ${seg('forecast', FORECAST.map(f => [f[0], f[1]]), fc.level || '')}
          <p class="rs-muted">${esc(FORECAST.find(f => f[0] === fc.level)?.[2] || 'Pick one when you have rain to spare.')}</p>
          <div class="rs-two"><label>Until <small>(often when your plan resets)</small><input name="until" type="date" value="${esc(fc.until ? fc.until.slice(0, 10) : '')}"></label>
          <label>With <small>(models)</small><input name="fcModels" list="rsModels" value="${esc((fc.models || []).join(', '))}"></label></div>
          <label>A note <small>(optional)</small><input name="fcNote" maxlength="300" value="${esc(fc.note || '')}" placeholder="Send me your gnarly ones"></label>
        </fieldset>
        <fieldset><legend>Your AI budget</legend><p class="rs-muted">Roughly what you spend on AI a month. Helpers who want to help people without big plans use this to find you.</p>
          ${seg('budget', BUDGETS.map(b => [b[0], b[1]]), p.budget || '')}
          <div class="rs-vis">${visSel('budget')}</div>
        </fieldset>
        <fieldset><legend>About your situation</legend><p class="rs-muted">Only if you’d like to share. Some helpers put students, people learning, or people on low incomes first.</p>
          ${toggles('circumstances', CIRCUMSTANCES, p.circumstances)}
          <div class="rs-vis">${visSel('circumstances')}</div>
        </fieldset>
        <fieldset><legend>What you care about</legend>
          ${toggles('values', [...new Set([...VALUES, ...(p.values || [])])].map(v => [v, v]), p.values)}
          <label>Add your own <small>(comma separated)</small><input name="moreValues" placeholder="birding, zines"></label>
        </fieldset>
        <fieldset><legend>Who you’d like to help first</legend><p class="rs-muted">When you have rain to spare, these rise to the top of your board.</p>
          ${toggles('priorities', PRIORITIES, p.priorities)}
        </fieldset>
        <label>Work you’re happy to take on <small>(comma separated)</small><input name="offering" value="${esc((p.offering || []).join(', '))}" placeholder="rust, css, docs, testing"></label>
        ${S.source.canPrivate ? `<fieldset><legend>Your groups</legend>
          ${groups === null ? '<p class="rs-muted">Finding your groups…</p>' : withBoard.length ? `<p class="rs-muted">Your full profile, including anything marked “only my groups”, goes into these groups’ private Rainshare spaces.</p>
            <div class="rs-toggles" data-rs-toggles="share">${withBoard.map(g => `<button type="button" data-v="${esc(g.did)}" aria-pressed="${share.includes(g.did)}">${ico('lock')}${esc(g.name)}</button>`).join('')}</div>`
            : '<p class="rs-muted">None of your groups has Rainshare yet, so anything marked “only my groups” stays unshared for now.</p>'}
        </fieldset>` : ''}
        <div class="rs-row rs-sticky"><button class="rs-btn rs-primary" type="submit">Save my profile</button>${S.source.demo && S.source.reset ? '<button class="rs-link" type="button" data-rs-act="reset-demo">Start the example over</button>' : ''}</div>
        <p class="rs-err" hidden></p>
      </form>`;
  }
  // Read the profile form back into S.form.profile (selects, inputs and toggles).
  function readMe(form){
    const p = S.form.profile, fd = new FormData(form);
    p.bio = fd.get('bio');
    p.setups = [...form.querySelectorAll('[data-setup]')].map(li => ({
      harness: li.querySelector('[name=harness]').value, models: li.querySelector('[name=models]').value.split(',').map(s => s.trim()).filter(Boolean),
      plan: li.querySelector('[name=plan]').value, runsOn: li.querySelector('[name=runsOn]').value || undefined
    }));
    const level = form.querySelector('[data-rs-seg="forecast"] [aria-pressed="true"]')?.dataset.v;
    p.forecast = level ? { level, until: fd.get('until') ? new Date(fd.get('until') + 'T23:59:00').toISOString() : undefined, models: String(fd.get('fcModels') || '').split(',').map(s => s.trim()).filter(Boolean), note: fd.get('fcNote') } : undefined;
    p.budget = form.querySelector('[data-rs-seg="budget"] [aria-pressed="true"]')?.dataset.v || undefined;
    const on = name => [...form.querySelectorAll(`[data-rs-toggles="${name}"] [aria-pressed="true"]`)].map(b => b.dataset.v);
    p.circumstances = on('circumstances');
    p.values = [...on('values'), ...String(fd.get('moreValues') || '').split(',').map(s => s.trim()).filter(Boolean)];
    p.priorities = on('priorities');
    p.offering = String(fd.get('offering') || '').split(',').map(s => s.trim()).filter(Boolean);
    S.form.hidden = [...form.querySelectorAll('[data-rs-vis]')].filter(s => s.value === 'private').map(s => s.dataset.rsVis);
    if (form.querySelector('[data-rs-toggles="share"]')) S.form.share = on('share');
  }

  /* ---------- someone's profile ---------- */
  async function loadPerson(sub){
    S.other = null;
    const who = decodeURIComponent(sub.slice(2));
    try {
      const did = who.startsWith('did:') ? who : await resolveHandle(who);
      S.other = await S.source.profileOf(did);
      S.other.did = did;
    } catch (e) { S.other = { error: e }; }
    if (S.view === 'person') render();
    loadBoard();
  }
  function renderPerson(){
    const o = S.other, back = a('', `${ico('back')}All seeds`, 'rs-back');
    if (!o) return `${back}<p class="rs-muted">Looking them up…</p>`;
    if (o.error) return `${back}<p class="rs-empty">We couldn’t find that person.</p>`;
    const p = o.person || {}, theirs = (S.board?.items || []).filter(it => it.repo === o.did);
    title(nameOf(p));
    return `${back}
      <section class="rs-person">
        <header>${face(p, 'lg')}<div><h1>${esc(nameOf(p))}</h1>${p.handle ? `<a class="rs-link" href="https://bsky.app/profile/${esc(p.handle)}" target="_blank" rel="noopener">@${esc(p.handle)}</a>` : ''}</div>${o.did === viewer() ? a('me', 'Edit', 'rs-btn rs-quiet rs-sm') : ''}</header>
        <div class="rs-panel">${profileCard(o.merged, p)}${o.groups?.length && o.did !== viewer() ? `<p class="rs-muted">${ico('lock')} Some of this is shared only with ${esc(o.groups.map(g => g.name).join(' and '))}.</p>` : ''}</div>
        <h2>${o.did === viewer() ? 'Your seeds' : 'Their seeds'}</h2>
        ${!S.board ? '<p class="rs-muted">Loading…</p>' : theirs.length ? `<ul class="rs-list">${theirs.map(it => card(it, { nav: true })).join('')}</ul>` : '<p class="rs-muted">None that you can see.</p>'}
      </section>`;
  }

  /* ---------- agents: the CLI and MCP server ---------- */
  function renderAgents(){
    const copyBtn = text => `<button class="rs-btn rs-quiet rs-sm" type="button" data-rs-copy-text="${esc(text)}">${ico('copy')}Copy</button>`;
    const block = cmd => `<div class="rs-cmd"><pre><code>${esc(cmd)}</code></pre>${copyBtn(cmd)}</div>`;
    const say = text => `<div class="rs-cmd rs-say"><p>“${esc(text)}”</p>${copyBtn(text)}</div>`;
    const json = JSON.stringify({ mcpServers: { rainshare: { command: 'node', args: [CLI_HOME.replace('~', '/Users/you'), 'mcp'], env: { RAINSHARE_HANDLE: 'you.bsky.social', RAINSHARE_APP_PASSWORD: 'xxxx-xxxx-xxxx-xxxx' } } } }, null, 2);
    title('Agents');
    // A host with its own tabs (rainshare.dev) doesn't need a way back to the board.
    return `${host.brand === 'rainshare' ? '' : a('', `${ico('back')}All seeds`, 'rs-back')}
      <div class="rs-agents">
        <header class="rs-agents-head">
          <h1>Send agents from your terminal</h1>
          <p>One small file is both a command-line tool and an MCP server. It reads your circle’s seeds and writes your takes and deliveries, so an agent can find a seed, take it on and turn it in. It needs Node 18 or later.</p>
        </header>
        <section class="rs-panel" aria-labelledby="rsSetup">
          <h2 id="rsSetup">Set up, once</h2>
          <ol class="rs-steps">
            <li><h3>Get the file</h3>${block(INSTALL)}</li>
            <li><h3>Sign in with an app password</h3>${block(`node ${CLI_HOME} login you.bsky.social`)}
              <p class="rs-muted">Make one in Bluesky under Settings, then Privacy and security, then App passwords (or wherever your server offers them). It’s kept in <code>~/.config/rainshare</code>, and you can revoke it any time.</p></li>
          </ol>
        </section>
        <div class="rs-agents-ways">
          <section class="rs-panel" aria-labelledby="rsWayCli">
            <h2 id="rsWayCli">${ico('term')}From a terminal</h2>
            <ol class="rs-steps">
              <li><h3>See what’s planted</h3>${block(`node ${CLI_HOME} board`)}</li>
              <li><h3>Take one on</h3>${block(`node ${CLI_HOME} run <seed>`)}
                <p class="rs-muted">This tells your friend you’re on it, clones the repo and starts your agent with the brief. <code>&lt;seed&gt;</code> is the seed’s link.</p></li>
              <li><h3>Turn it in</h3>${block(`node ${CLI_HOME} turn-in <seed> --url <pull request>`)}</li>
            </ol>
            <p class="rs-muted"><code>node ${CLI_HOME} help</code> lists the rest: planting a seed, setting your forecast and more.</p>
          </section>
          <section class="rs-panel" aria-labelledby="rsWayMcp">
            <h2 id="rsWayMcp">${ico('sky')}From inside your agent</h2>
            <ol class="rs-steps">
              <li><h3>Add Rainshare to it</h3><p class="rs-muted">In Claude Code:</p>${block(MCP_ADD)}
                <details class="rs-more"><summary>In another MCP client</summary>${block(json)}</details></li>
              <li><h3>Ask it</h3>${say('What seeds does my circle have that suit my setup?')}${say('Take on this Rainshare seed and turn it in when the PR is up.')}</li>
            </ol>
          </section>
        </div>
        <p class="rs-note">${ico('lock')}<span>For now the CLI and MCP server reach public seeds only. Private, group-only ones are taken on from here, in the app.</span></p>
      </div>`;
  }

  /* ---------- signing in (the host does the OAuth) ---------- */
  function signinForm(){
    const s = S.signin;
    return `<form class="rs-form rs-signin" data-rs-form="signin">
      <h2>Sign in with your handle</h2>
      <p class="rs-muted">The one you already use, like your Bluesky handle. Your own server signs you in, and everything you post stays in your account.</p>
      <div class="rs-row"><input name="handle" placeholder="you.bsky.social" autocomplete="username" autocapitalize="none" spellcheck="false" inputmode="url" required value="${esc(s.handle || '')}" aria-label="Your handle"><button class="rs-btn rs-primary" type="submit"${s.busy ? ' disabled' : ''}>${s.busy ? 'Off to your server…' : 'Sign in'}</button><button class="rs-link" type="button" data-rs-act="signin-cancel">Not now</button></div>
      ${s.error ? `<p class="rs-err">${esc(s.error)}</p>` : ''}
    </form>`;
  }
  async function submitSignin(form){
    const handle = String(new FormData(form).get('handle') || '').trim().replace(/^@/, '');
    if (!handle) return;
    S.signin = { handle, busy: true }; render();
    try { await host.signIn(handle, S.sub); }
    catch (e) { S.signin = { handle, error: e?.message || 'Your server didn’t let us start signing in. Try again in a moment.' }; render(); }
  }

  /* ---------- planting a seed (./post.js draws the steps) ---------- */
  const poster = createPoster({
    root, a, go, toast, title, plainText, self, viewer,
    source: () => S.source,
    render: () => render(),
    onPosted(){ S.board = null; loadBoard(true); }
  });
  const renderNew = () => signedIn() ? poster.view()
    : `${a('', `${ico('back')}All seeds`, 'rs-back')}<p class="rs-empty">Sign in to plant a seed.</p>${host.signIn ? '<button class="rs-btn rs-primary" type="button" data-rs-act="signin">Sign in</button>' : ''}`;

  /* ---------- render ---------- */
  const datalists = `<datalist id="rsModels">${MODELS.map(m => `<option value="${m}">`).join('')}</datalist><datalist id="rsValues">${VALUES.map(m => `<option value="${m}">`).join('')}</datalist>`;
  function render(){
    if (!S.source) { root.innerHTML = '<div class="rs"><p class="rs-muted">One moment…</p></div>'; return; }
    const body = { board: renderBoard, seed: renderSeed, new: renderNew, me: renderMe, person: renderPerson, agents: renderAgents }[S.view]?.() || renderBoard();
    // Redrawing keeps whichever field had focus, and where its cursor was.
    const focus = document.activeElement && root.contains(document.activeElement) ? document.activeElement : null;
    const keep = focus?.name ? { name: focus.name, pos: focus.selectionStart } : null;
    root.innerHTML = `<div class="rs rs-v-${S.view}">${S.signin ? signinForm() : ''}${body}${datalists}</div>`;
    if (keep) {
      const el = root.querySelector(`[name="${keep.name}"]`);
      if (el) { el.focus({ preventScroll: true }); try { if (keep.pos != null) el.setSelectionRange(keep.pos, keep.pos); } catch (_) {} }
    }
    if (S.view === 'board') title(null);
  }

  // Keep what someone typed in the turn-in and profile forms across re-renders.
  function stash(){
    const t = root.querySelector('[data-rs-form="turnin"]');
    if (t) S.drafts.turnIn = Object.fromEntries(new FormData(t));
    const m = root.querySelector('[data-rs-form="me"]');
    if (m && S.form?.profile) readMe(m);
  }
  const rerender = () => { stash(); render(); };

  /* ---------- actions ---------- */
  async function act(name, el){
    const it = S.seed;
    try {
      if (name === 'signin') { S.signin = S.signin || {}; S.sheet = false; render(); root.querySelector('[data-rs-form="signin"] input')?.focus(); window.scrollTo?.({ top: 0, behavior: 'smooth' }); return; }
      if (name === 'signin-cancel') { S.signin = null; render(); return; }
      if (name === 'exit-demo') return host.onExitDemo?.();
      if (name === 'refresh') { await loadBoard(true); return; }
      if (name === 'take') {
        const r = await takeIt(it, el); if (!r) return;
        S.seed = r.fresh; S.launch = r.launch;
        render();
        root.querySelector('#rsLaunch')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (name === 'show-launch') { S.launch = S.launch || pickLauncher(launchers(it))?.id || 'none'; rerender(); root.querySelector('#rsLaunch')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (name === 'copy-brief') return copy(brief(it), 'Copied the brief');
      if (name === 'drop') {
        if (!confirm('Drop this seed? Your take is deleted, so others can see it’s free.')) return;
        await S.source.drop(it); S.launch = null; toast('Dropped');
      }
      if (name === 'close' || name === 'reopen') { await S.source.update(it, { state: name === 'close' ? 'closed' : 'open' }); toast(name === 'close' ? 'Closed' : 'Reopened'); }
      if (name === 'delete') {
        if (!confirm('Delete this seed? This removes the record from your account.')) return;
        await S.source.remove(it); toast('Deleted'); S.board = null; go(''); return;
      }
      if (name === 'add-setup') { stash(); S.form.profile.setups = [...(S.form.profile.setups?.length ? S.form.profile.setups : [{ harness: 'claude-code', models: [] }]), { harness: 'codex', models: [] }]; render(); return; }
      if (name === 'reset-demo') { S.source.reset(); S.form = null; S.board = null; poster.reset(); await loadMine(true); toast('The example circle is back to how it started'); go(''); return; }
      if (it && ['drop', 'close', 'reopen'].includes(name)) { S.seed = await S.source.seed(it.uri, { force: true }) || it; S.board = null; loadBoard(); render(); }
    } catch (e) { console.warn('rainshare', name, e); toast(plainText(e)); if (el) el.disabled = false; }
  }
  function pickLauncher(ls){
    const h = mySetup()?.harness;
    return (h === 'codex' && ls.find(l => l.id === 'codex')) || (h && h !== 'claude-code' && ls.find(l => l.id === 'mcp')) || ls[0] || null;
  }
  async function sproutWith(uri){
    const it = S.seed, dl = (it.deliveries || []).find(d => d.uri === uri); if (!dl) return;
    try {
      await S.source.update(it, { state: 'sprouted', sproutedWith: [strongRef(dl)] });
      S.seed = await S.source.seed(it.uri, { force: true }) || it; S.board = null; loadBoard();
      toast('Sprouted. Thank them!'); render();
    } catch (e) { toast(plainText(e)); }
  }
  async function submitMe(form){
    readMe(form);
    const err = form.querySelector('.rs-err'), btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Saving…'; err.hidden = true;
    try {
      await S.source.saveProfile(S.form.profile, { hidden: S.form.hidden, share: S.form.share });
      await loadMine(true); S.form = null; S.board = null; loadBoard();
      toast('Saved. Your board is re-sorted for you.'); go('');
    } catch (e) { err.hidden = false; err.innerHTML = plain(e); btn.disabled = false; btn.textContent = 'Save my profile'; }
  }
  async function submitTurnIn(form){
    const v = Object.fromEntries(new FormData(form)), btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const pullAt = /^at:\/\//.test(v.url) ? v.url : undefined;
      await S.source.turnIn(S.seed, { url: pullAt ? undefined : v.url, pull: pullAt, sessionUrl: v.sessionUrl, note: v.note, setup: { harness: v.harness, models: v.model ? [v.model] : [] } });
      S.drafts.turnIn = null; S.launch = null;
      S.seed = await S.source.seed(S.seed.uri, { force: true }) || S.seed; S.board = null; loadBoard();
      toast('Turned in. Nice work.'); render();
    } catch (e) { toast(plainText(e)); btn.disabled = false; }
  }

  root.addEventListener('click', e => {
    const t = e.target, plainClick = !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0;
    const goEl = t.closest('[data-rs-go]');
    if (goEl && plainClick) { e.preventDefault(); stash(); go(goEl.dataset.rsGo); return; }
    const pk = t.closest('[data-rs-pick]'); if (pk) { if (plainClick) { e.preventDefault(); pick(pk.dataset.rsPick); } return; }
    if (t.closest('[data-rs-close-sheet]')) { closeSheet(); return; }
    const tk = t.closest('[data-rs-take]'); if (tk) { takeFromPanel(tk.dataset.rsTake, tk); return; }
    if (t.closest('.rs-post') && poster.click(t)) return;
    const tab = t.closest('[data-rs-tab]'); if (tab) { S.tab = tab.dataset.rsTab; S.sheet = false; render(); return; }
    const sg = t.closest('[data-rs-seg] button');
    if (sg && S.view === 'me') {
      const name = sg.closest('[data-rs-seg]').dataset.rsSeg, v = sg.dataset.v;
      stash();
      if (name === 'forecast') { const next = S.form.profile.forecast?.level === v ? undefined : v; S.form.profile.forecast = next ? { ...(S.form.profile.forecast || {}), level: next } : undefined; }
      if (name === 'budget') S.form.profile.budget = S.form.profile.budget === v ? undefined : v;
      render(); return;
    }
    const tgl = t.closest('[data-rs-toggles] button'); if (tgl) { tgl.setAttribute('aria-pressed', String(tgl.getAttribute('aria-pressed') !== 'true')); return; }
    const pl = t.closest('[data-rs-launch]');
    if (pl && !t.closest('button')) { const l = launchers(S.seed)[+pl.dataset.rsLaunch]; if (l) { S.launch = l.id; root.querySelectorAll('.rs-launchers li').forEach(li => li.classList.toggle('on', li === pl)); } return; }
    const cp = t.closest('[data-rs-copy]'); if (cp) { const l = launchers(S.seed)[+cp.dataset.rsCopy]; if (l) { S.launch = l.id; copy(l.command, `Copied the ${l.label} command`); root.querySelectorAll('.rs-launchers li').forEach((li, i) => li.classList.toggle('on', i === +cp.dataset.rsCopy)); } return; }
    const ct = t.closest('[data-rs-copy-text]'); if (ct) { copy(ct.dataset.rsCopyText, ct.dataset.rsCopyText.startsWith('git ') ? 'Copied the clone command' : 'Copied the link'); return; }
    const sp = t.closest('[data-rs-sprout]'); if (sp) { sproutWith(sp.dataset.rsSprout); return; }
    const rm = t.closest('[data-rs-remove-setup]'); if (rm) { stash(); S.form.profile.setups.splice(+rm.dataset.rsRemoveSetup, 1); render(); return; }
    const ac = t.closest('[data-rs-act]'); if (ac) { act(ac.dataset.rsAct, ac); }
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape' && S.sheet && narrow()) { closeSheet(); return; }
    // Up and down move through the board's list, and the panel follows.
    const item = e.target.closest?.('.rs-list [data-rs-pick]');
    if (item && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const all = [...root.querySelectorAll('.rs-list [data-rs-pick]')], next = all[all.indexOf(item) + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) { e.preventDefault(); next.focus(); if (!narrow()) pick(next.dataset.rsPick); }
    }
  });
  root.addEventListener('submit', e => {
    const f = e.target.closest('[data-rs-form]'); if (!f) return;
    e.preventDefault();
    if (f.dataset.rsForm === 'post') poster.submit();
    else if (f.dataset.rsForm === 'me') submitMe(f);
    else if (f.dataset.rsForm === 'turnin') submitTurnIn(f);
    else if (f.dataset.rsForm === 'signin') submitSignin(f);
  });
  root.addEventListener('input', e => { if (e.target.closest('[data-rs-form="post"]')) poster.typed(e.target); });
  root.addEventListener('change', e => { if (e.target.closest('[data-rs-form="post"]')) poster.changed(e.target); });

  /* ---------- entering a screen ---------- */
  async function show(sub = ''){
    sub = sub.replace(/^\/+|\/+$/g, '');
    if (!S.source) { S.sub = sub; render(); return; }
    if (sub !== S.sub && !(S.view === 'me' && sub === 'me')) S.form = null;
    S.sub = sub;
    if (!sub) { S.view = 'board'; render(); loadBoard(); }
    else if (sub === 'new') { S.view = 'new'; if (signedIn()) poster.enter(); else title('Plant a seed'); render(); }
    else if (sub === 'me') {
      S.view = 'me'; title('Your profile'); render();
      if (signedIn() && !S.mine) { await loadMine(); render(); }
      if (signedIn() && S.form && S.form.groups === null) { const g = await S.source.groups().catch(() => []); if (S.form) { S.form.groups = g; rerender(); } }
    }
    else if (sub === 'agents') { S.view = 'agents'; render(); }
    else if (/^u\//.test(sub)) { S.view = 'person'; render(); loadPerson(sub); }
    else if (/^seed\//.test(sub)) {
      S.view = 'seed'; render(); await loadSeed(sub);
      if (S.sub !== sub) return;
      render();
      if (S.launch) root.querySelector('#rsLaunch')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    else { S.view = 'board'; render(); loadBoard(); }
  }

  return {
    show,
    /** Hand in a (new) data source: on sign-in, sign-out, or switching to the example circle. */
    async setSource(source){
      Object.assign(S, { source, board: null, mine: null, seed: null, form: null, drafts: {}, tab: 'foryou', signin: null, pick: null, sheet: false });
      poster.reset();
      render();
      if (source?.signedIn) { await loadMine(); }
      show(S.sub);
    },
    refresh: () => loadBoard(true),
    get source(){ return S.source; }
  };
}
