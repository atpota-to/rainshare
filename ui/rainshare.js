// Rainshare's screens, for any host: rainshare.dev (../src/main.js), or another site that
// wants Rainshare inside it. The host hands in a data source (source.js for real
// accounts, demo.js for the example circle) and a few hooks, and calls show(subpath)
// whenever the address changes:
//
//   '' or board        the board: what's open, best first for you, narrowed by who asked if you
//                      like. Short cards in a list, and the one you pick in full beside them (a
//                      sheet from the bottom on phones), with how you know whoever asked. What
//                      you've asked for that's still open is there too, after the rest; all
//                      of it, open or done, is on your own page (profile/<you>)
//   seed/<did>/<rkey>  a public seed (a handle works in place of the DID)
//   seed/s/<code>      a private one, in a group's space (its record URI, base64url)
//   new                plant a seed (./post.js)
//   me                 your profile: your AI plan, what you run, and who you are to helpers,
//                      with what you've helped with beside it
//   profile/<did>      someone's profile and their seeds (a handle works in place of the DID)
//   agents             the CLI and MCP server, for sending agents from a terminal
//   admin              @rainshare.dev's moderation page: what's hidden, what the checks flagged,
//                      and hiding something. To anyone else it's as if nothing were there.
//
// A host with a landing of its own at its base address, for people signed out (rainshare.dev,
// host.landing), shows the board under it there. The board's own address is then 'board', and
// every way back to the board leads there, to the board on its own.
import { SEED, PROFILE, STAGE, HANDLE, SITE, FEATURES, TAKE_DAYS, TAKE_DAYS_DEFAULT, ROUTES, PLANS, UNPAID, plansIn, HARNESSES, MODELS, RUNS_ON, FORECAST, CIRCUMSTANCES, PRIORITIES, VALUES, labelOf, modelName } from '../core/ns.js';
import { describeSubject, cloneUrlOf, safeHttp, pullState, FORGE_NAMES } from '../core/subjects.js';
import { look, carry, standing } from '../core/status.js';
import { newRepoPlaces, placesFor } from '../core/forges.js';
import { writableForge, pickSource, pullText, FORGE_SAID } from '../core/forgewrite.js';
import { wordOn, wordText } from '../core/vouch.js';
import { tieOf, tieLines, knownText, TIE_SHORT, FROM, fromMatches } from '../core/ties.js';
import { wateredText } from '../core/garden.js';
import { audienceLine } from '../core/circle.js';
import { rank, fit, join, pretty, wantPhrase } from '../core/rank.js';
import { whereText, jobAndNotes, modelsText, progressOf, progressShort, relationText, askExcerpt, askSizeText, stateText, pictureOf, nounOf, aNoun, whatItIs, planText } from '../core/words.js';
import { renderMarkdown } from '../core/markdown.js';
import { threads, talksOn } from '../core/comments.js';
import { brief, launchers, pageOf, readHandBack, readBranchBack, sh, INSTALL, MCP_ADD, CLI_HOME } from '../core/brief.js';
import { strongRef, HARNESS_NAMES, preferences as prefsRecord } from '../core/records.js';
import { activeTakes, lapsed, dueOf } from '../core/takes.js';
import { resolveHandle, knownPerson, parseUri, profiles, pool } from '../core/net.js';
import { concerns, alarming } from '../core/scan.js';
import { REASONS, reasonName, isAccount, kindOf as subjectKind } from '../core/moderation.js';
import { esc, lit, unb64url, ago, until, nameOf, firstName, ico, forgeIco, skyIco, lifeIco, face, drops, pathOf, plantPic, avatarFallback, tip, tipLink, toggleTip } from './bits.js';
import { createPoster } from './post.js';
import { openWelcome, shouldWelcome } from './welcome.js';
import { openSend, sendSummary, dayChoices } from './send.js';
import { headSk, boardSk, seedSk, personSk, gardenSk, meSk, listSk } from './skeleton.js';
import { known, reroute } from '../core/route.js';

export { pathOf };

export function createRainshare({ root, base = '/', host }){
  const S = {
    source: null, view: null, sub: '',
    board: null, boardAt: 0, loading: false, error: null, shown: [], pick: null, sheet: false,
    mine: null, prefs: null, prefsLocal: false, garden: null, seed: null, seedErr: null, unlinked: null, launch: null, pendingLaunch: null, handBack: null, handKind: null, again: null, other: null, form: null, drafts: {},
    pull: null,          // the pull request form for the ask on screen: { uri, loading, choices, error }
    circle: undefined,   // your Tangled vouch circle (../core/vouch.js): undefined until asked for, null if there's none to show
    vouching: null,      // who a vouch is being written for: { did, evidence }
    accepting: null,     // the delivery whose Accept form is open, on an ask of your own
    from: 'anyone',      // whose asks the board shows (FROM in ../core/ties.js): anyone, mutuals, people you follow, …
    sort: null,          // how the board is sorted: 'fit' (best for you, signed in) or 'new' (newest first); null for the usual one
    show: 'all',         // which open asks the board shows: 'all', or 'free' (nobody's on it yet)
    known: {},           // by DID: which of the people you follow on Bluesky follow them ('loading' while asked)
    reply: null,         // the comment a reply is being written to: its URI, while the reply form is open
    toTalk: null,        // the ask whose page is being opened scrolled to its comments (from "Comments" on the board)
    admin: null,         // the moderation page, for @rainshare.dev: { list, about, error, loading }
    found: null,         // what was looked up there to hide: { subject, about, error }
    modding: null,       // what a hide form is open for: { subject, reason, note }
    open: {}   // which optional parts are showing (the turn-in's details, the comment form…), so a redraw leaves them be
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
  // Where the links to the board lead, and whether it's sitting under the host's landing now.
  const BOARD_AT = host.landing ? 'board' : '';
  const isBoard = sub => !sub || sub === 'board';
  const underLanding = () => !!host.landing && !signedIn() && !S.sub;
  const back = () => a(BOARD_AT, `${ico('back')}Back to the board`, 'rs-back');
  // Nothing's at an address, or what was there is gone: said plainly, with the ways on from it.
  const nothingHere = (what, more = '') => `${back()}<div class="rs-empty rs-need"><p>${what}</p><div class="rs-row">${a(BOARD_AT, 'Go to the board', 'rs-btn rs-primary')}${more}</div></div>`;
  // Someone who followed a link here from somewhere else hasn't seen the landing. Signed out,
  // an ask's page and a person's page say in a line what this place is, with the way to the rest.
  // (Before the page knows who's looking, the host says whether there's a sign-in to wait for.)
  const newHere = (more = '') => (S.source ? signedIn() || S.source.demo : !host.visitor) ? '' : `<aside class="rs-note rs-newhere">${ico('drop')}<span><b>${lit('New to Rainshare?')}</b> People post ideas and projects they want help with, and others send their own AI agent to do the work, on their own plan.${more ? ' ' + esc(more) : ''}</span>${host.brand === 'rainshare' ? a('', 'How it works', 'rs-link') : ''}</aside>`;
  // A screen that's only for someone signed in says so once, with the way in beside it.
  const needSignIn = what => `${back()}<div class="rs-empty rs-need"><p>${what}</p>${host.signIn ? '<button class="rs-btn rs-primary" type="button" data-rs-act="signin">Sign in</button>' : ''}</div>`;
  const seg = (name, opts, value) => `<div class="rs-seg" role="group" data-rs-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${v === value}">${esc(l)}</button>`).join('')}</div>`;
  const toggles = (name, opts, values) => `<div class="rs-toggles" data-rs-toggles="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${(values || []).includes(v)}">${esc(l)}</button>`).join('')}</div>`;
  function plain(e){
    const say = {
      NotSignedIn: 'Sign in first.',
      ScopeMissingError: 'Your sign-in is from before Rainshare needed this. Sign out and in again.',
      NoSpaces: 'Your account’s server doesn’t support private spaces yet, so private ones stay closed to you.',
      NoBoard: 'That group doesn’t have Rainshare yet.',
      NotYours: 'Only the person who asked can do that.',
      Timeout: 'The network took too long to answer. Try again.',
      Forbidden: 'Your role in that group doesn’t allow it.'
    }[e?.name];
    return esc(say || e?.message || 'Something went wrong. Try again in a moment.');
  }
  const plainText = e => { const d = document.createElement('div'); d.innerHTML = plain(e); return d.textContent; };
  const decode = s => { try { return decodeURIComponent(s); } catch (_) { return s; } };
  // Browsers can refuse to copy once a moment has passed since the click (Safari, after the
  // network has been asked something), so whoever calls this can say what to do instead.
  function copy(text, what = 'Copied', instead = 'Couldn’t copy it. Select it and copy it yourself.'){
    const done = () => toast(what);
    try { navigator.clipboard.writeText(text).then(done, () => toast(instead)); } catch (_) { toast(instead); }
  }
  // The whole seed as Markdown (the brief an agent gets), for pasting into any agent's session.
  const mdBtn = (it, cls = 'rs-quiet') => `<button class="rs-btn ${cls}" type="button" data-rs-md="${esc(it.uri)}">${ico('copy')}Copy as Markdown</button>`;
  // A forecast that ran out (its "until" has passed) isn't shown as if it were still true.
  // (Older CLIs saved a bare date as midnight UTC, so that's read as the end of that date.)
  const endsAt = until => { const t = Date.parse(until); return /T00:00(:00(\.0+)?)?Z$/.test(String(until)) ? t + 86400e3 : t; };
  const forecastOf = p => p?.forecast?.level && !(endsAt(p.forecast.until) < Date.now()) ? FORECAST.find(f => f[0] === p.forecast.level) : null;
  const isOpen = it => !it.value?.state || it.value.state === 'open';
  // The note that Rainshare is early, shown on the board until it's dismissed (in this browser only).
  const STAGE_SEEN = 'rs:stage-seen:' + STAGE;
  let stageDismissed = false;
  const stageSeen = () => { if (stageDismissed) return true; try { return localStorage.getItem(STAGE_SEEN) === '1'; } catch (_) { return false; } };
  const myTake = it => (it.takes || []).find(t => t.repo === viewer());
  const mySetup = () => S.mine?.merged?.setups?.[0] || null;
  // Where a seed stands for whoever's looking (../core/status.js), and the brief made for them.
  const stand = it => standing(it, { viewer: viewer(), asker: firstName(it.author) });
  const briefFor = it => brief(it, { viewer: viewer() });
  // What's in the way of starting on one, said to a person rather than to an agent.
  function heed(it, st){
    const who = firstName(it.author), forge = FORGE_NAMES[describeSubject(it.value?.subject)?.forge] || 'the forge';
    const others = (it.takes || []).filter(t => t.repo !== viewer()).map(t => nameOf(t.author));
    return {
      'on-it': `${join(others)} ${others.length > 1 ? 'are' : 'is'} already on it. Check with them before you send your agent, so it isn’t done twice.`,
      'turned-in': st.idea ? 'Someone has already built a version of this. Look at theirs first. Another only helps if it’s different.'
        : 'There’s already a pull request for this. Look it over first. A second one only helps if that one has stalled.',
      merged: `A pull request for this has been merged, so it’s probably done. It’s waiting for ${who} to accept it.`,
      'issue-closed': `The issue has been closed on ${forge}. Ask ${who} before starting: it may be done, or no longer wanted.`
    }[st.verdict] || '';
  }
  const heedNote = (it, st) => st && !st.clear && heed(it, st) ? `<p class="rs-note rs-heed">${ico('person')}<span>${esc(heed(it, st))}</span></p>` : '';
  // What Rainshare's checks found in an ask (../core/scan.js), said to whoever's deciding whether
  // to send their agent, with the words that set each one off. Whoever asked sees it too, so an
  // honest ask that trips one can be reworded.
  function cautionNote(it){
    const list = concerns(it?.value);
    if (!list.length) return '';
    const mine = it.repo === viewer();
    const head = mine ? 'Rainshare’s checks flagged something in your ask.' : 'Have a look before you send your agent.';
    const lead = mine ? 'Helpers see a note like this one, and their agents are told about it in the brief. If it’s a false alarm, rewording what’s quoted usually clears it.'
      : 'Rainshare’s checks found something in this ask that’s often used to misuse an agent. They’re rough: they miss some tricks, and an honest ask can trip one. Your agent is told about it in its brief as well.';
    return `<div class="rs-note rs-caution${alarming(list) ? ' rs-alarm' : ''}">${ico('shield')}<div><p><b>${esc(head)}</b> ${esc(lead)}</p>
      <ul>${list.map(c => `<li>${esc(c.said)}${c.quote ? ` <span class="rs-muted">Found: <code>${esc(c.quote)}</code></span>` : ''}</li>`).join('')}</ul></div></div>`;
  }

  /* ---------- moderation (../core/moderation.js), for @rainshare.dev ---------- */
  const moderating = () => !!S.source?.moderation;
  const reasonLine = d => [reasonName(d.reason), d.note].filter(Boolean).join(': ');
  // Hiding something: why (a reason, and a note that's public), and a button. It opens where its
  // button was pressed, and one at a time.
  function hideForm(subject, what){
    const m = S.modding?.subject === subject ? S.modding : null;
    if (!m) return '';
    const pick = m.reason || (subjectKind(subject) === 'comment' ? 'abuse' : 'unsafe');
    return `<form class="rs-form rs-hideform" data-rs-form="hide"><input type="hidden" name="subject" value="${esc(subject)}">
      <p><b>Hide ${esc(what)}</b> for everyone: from the board, its page and comments, the CLI and MCP server, and link previews.${isAccount(subject) ? ' Everything this account writes on Rainshare goes, now and later.' : ''}</p>
      <fieldset class="rs-reasons"><legend>Why</legend><div class="rs-reason-list">${REASONS.map(([v, l, d]) => `<label class="rs-reason"><input type="radio" name="reason" value="${v}"${pick === v ? ' checked' : ''}><span><b>${esc(l)}</b><small>${esc(d)}</small></span></label>`).join('')}</div></fieldset>
      <label>A note <small>(optional, and public, like the rest of the record)</small><input name="note" maxlength="300" value="${esc(m.note || '')}" autocomplete="off"></label>
      <div class="rs-row"><button class="rs-btn rs-primary rs-hide-btn" type="submit">${ico('shield')}Hide it</button><button class="rs-link" type="button" data-rs-act="mod-cancel">Cancel</button></div>
    </form>`;
  }
  const hideBtn = (subject, label, reason) => `<button class="rs-btn rs-quiet rs-sm" type="button" data-rs-mod="${esc(subject)}"${reason ? ` data-rs-reason="${esc(reason)}"` : ''}>${ico('shield')}${esc(label)}</button>`;
  const unhideBtn = subject => `<button class="rs-btn rs-quiet rs-sm" type="button" data-rs-unhide="${esc(subject)}">Unhide</button>`;
  // What's said where something is hidden: to whoever it's about, to @rainshare.dev, and on an
  // ask's page that someone else followed a link to.
  function hiddenNote(d, { whose, what }){
    const why = esc(reasonLine(d));
    if (moderating()) return `<div class="rs-note rs-bad rs-hidden-note">${ico('shield')}<span><b>Hidden by Rainshare</b> ${esc(ago(d.createdAt))}. ${why}.</span>${unhideBtn(d.subject)}</div>`;
    if (whose === 'yours') return `<p class="rs-note rs-bad rs-hidden-note">${ico('shield')}<span><b>Rainshare has hidden ${esc(what)}</b> from everyone else. ${why}. If you think that’s a mistake, say so to @rainshare.dev on Bluesky.</span></p>`;
    return `<p class="rs-note rs-bad rs-hidden-note">${ico('shield')}<span>Rainshare has hidden ${esc(what)}. ${why}.</span></p>`;
  }
  const fitBox = f => `<div class="rs-fitbox">${drops(f.level)}<p><b>${esc(f.label)} for you.</b> ${esc(f.why)}</p></div>`;
  function shareUrl(it){
    const page = pageOf(it), sq = it.value || {};
    if (it.space || it.example || !page) return null;
    return `https://bsky.app/intent/compose?text=${encodeURIComponent(it.repo === viewer() ? `Got rain to spare? I’m asking for help with ${aNoun(sq)} on @${HANDLE}: “${sq.title}” ${page}` : `Got rain to spare? Someone on @${HANDLE} is asking for help with ${aNoun(sq)}: “${sq.title}” ${page}`)}`;
  }
  // Thanking whoever helped, on Bluesky: it names them and Rainshare, and links to the ask
  // here, whose preview shows the garden, rather than to the pull request.
  function thankUrl(it, h){
    const sq = it.value || {}, page = pageOf(it), handle = h?.author?.handle, setup = setupText(h?.setup);
    if (!handle || !page || it.example) return null;
    return `https://bsky.app/intent/compose?text=${encodeURIComponent(`Thank you @${handle} for ${setup ? `sending ${setup} to help` : 'helping'} with my ${nounOf(sq)} “${sq.title}” on @${HANDLE} ${page}`)}`;
  }
  // Public ones share on Bluesky; private and example ones copy their link (which only works
  // for people who can see them anyway).
  const shareBtn = (it, label = 'Share', cls = 'rs-btn rs-quiet') => {
    const u = shareUrl(it);
    return u ? `<a class="${cls}" href="${esc(u)}" target="_blank" rel="noopener">${label}</a>`
      : `<button class="${cls}" type="button" data-rs-copy-text="${esc(location.origin + href(pathOf(it)))}">Copy link</button>`;
  };
  // What the person who asked can do with their ask that isn't the next step, kept under ⋯ in
  // its top corner: share it (unless nobody's on it yet, when that's the next step, in the card),
  // a note to paste on an issue Rainshare can't comment on, closing or reopening it, deleting it.
  function ownerMenu(it, { open, d }){
    const sq = it.value || {}, page = pageOf(it), fresh = open && !activeTakes(it).length && !(it.deliveries || []).length;
    const tell = open && page && d?.issue && !it.example && !writableForge(sq.subject)
      ? `<button type="button" data-rs-copy-text="${esc(`I’ve posted this on Rainshare, for anyone who’d like to send their agent to work on it: ${page}`)}" data-rs-copied="Copied. Paste it as a comment on the issue.">Copy a note for the issue</button>` : '';
    const items = [
      fresh ? '' : shareBtn(it, 'Share on Bluesky', ''),
      tell,
      open ? '<button type="button" data-rs-act="close">Close it</button>' : '<button type="button" data-rs-act="reopen">Reopen it</button>',
      '<button type="button" class="rs-danger" data-rs-act="delete">Delete</button>'
    ].filter(Boolean);
    return `<details class="rs-more"><summary aria-label="More for this ${esc(nounOf(sq))}" title="More">${ico('more')}</summary><div class="rs-menu">${items.join('')}</div></details>`;
  }

  /* ---------- loading ---------- */
  // A board on screen is redrawn only if what came back differs from what's showing, so a
  // look across the network in the background moves nothing on the page.
  const boardSig = b => JSON.stringify([b?.notes, (b?.items || []).map(it => [it.uri, it.cid, it.value, it.author, it.profile, it.rel, it.ties, it.hidden, (it.takes || []).map(t => t.uri), (it.deliveries || []).map(d => d.uri)])]);
  // (After you write something, the board is marked out of date rather than thrown away, so the
  // names on the page you're on stay known until the new one arrives.)
  async function loadBoard(force){
    if (!S.source) return;
    if (S.loading && !force) return S.loading;
    if (!force && S.board && Date.now() - S.boardAt < 60e3) return;
    const was = S.board ? boardSig(S.board) : null, erred = !!S.error;
    S.error = null;
    S.loading = S.source.board({ force }).then(b => { S.board = b; S.boardAt = Date.now(); }, e => { S.error = e; console.warn('rainshare board', e); })
      .finally(() => {
        S.loading = null;
        if ((S.view === 'board' || S.view === 'person' || S.view === 'admin') && (S.error || erred || boardSig(S.board) !== was)) render();
        // The host hears what's open on the board (null if it couldn't be read): rainshare.dev's
        // landing points down to it with the faces of whoever's asking.
        host.onBoard?.(S.board ? boardItems() : null);
      });
    if (S.view === 'board' && (!S.board || erred)) render();
    return S.loading;
  }
  // There's no button to check again: coming back to the board, or to its browser tab, does it
  // (at most once a minute).
  globalThis.document?.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.view === 'board' && !root.closest('[hidden]')) loadBoard();
  });
  // What you've watered: worked out once you're known, and again after you turn something in.
  function loadGarden(){
    if (!signedIn() || !S.source.gardenOf) { S.garden = null; return; }
    S.source.gardenOf(viewer()).then(g => { S.garden = g; }, e => { console.warn('rainshare garden', e); S.garden = []; }).then(() => { if (S.view === 'board' || S.view === 'me') rerender(); });
  }
  // A garden, drawn: a line saying what's in it, and a plant for each one, which opens it.
  function gardenBlock(garden, whose){
    if (!garden) return gardenSk();
    const yours = whose === 'You';
    return `<div class="rs-panel">
      ${garden.length ? `<p>${esc(whose)}${yours ? '’ve' : ' has'} helped with ${esc(wateredText(garden))}.</p>
      <ul class="rs-garden">${garden.map(g => `<li><a href="${esc(href(pathOf(g)))}" data-rs-go="${esc(pathOf(g))}" title="${esc(g.title)}" aria-label="${esc(`${g.title}: ${nameOf(g.author)}’s ${g.stage === 'seed' ? 'idea' : 'project'}`)}">${plantPic(g.picture || g.stage, 76, { key: g.uri })}</a></li>`).join('')}</ul>`
        : `<p class="rs-muted">${yours ? 'Nothing yet. What gets done with your help grows here.' : `${esc(whose)} hasn’t helped with anything yet.`}</p>`}
    </div>`;
  }
  async function loadMine(force){
    if (!signedIn()) { S.mine = null; S.prefs = null; return; }
    await Promise.all([
      S.source.profileOf(viewer(), { force }).then(m => { S.mine = m; }, e => { console.warn('rainshare profile', e); S.mine = { merged: null, hidden: [], groups: [], unread: true }; }),
      loadPrefs()
    ]);
  }
  /* ---------- your settings: how "Send my agent" works for you (./send.js) ---------- */
  // Kept in your account (dev.rainshare.preferences), and in this browser as well: a sign-in
  // from before Rainshare had settings isn't allowed to write them to your account, and they
  // work here all the same. Whichever copy was saved last is the one used.
  const PREFS_KEY = () => 'rs:prefs:' + viewer();
  const localPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY()) || 'null'); } catch (_) { return null; } };
  const savedAt = r => String(r?.updatedAt || r?.createdAt || '');
  async function loadPrefs(){
    if (!signedIn()) { S.prefs = null; return; }
    const local = localPrefs(), rec = S.source.preferences ? await S.source.preferences().catch(() => null) : null;
    S.prefs = rec && savedAt(rec) >= savedAt(local) ? rec : local;
    S.prefsLocal = !!local && S.prefs === local && savedAt(local) > savedAt(rec);
  }
  /** Save how you send your agent. Says 'saved', or 'local' when only this browser could keep it. */
  async function savePrefs(send){
    const next = prefsRecord({ send }, S.prefs);
    S.prefs = next;
    try { localStorage.setItem(PREFS_KEY(), JSON.stringify(next)); } catch (_) {}
    try { await S.source.savePreferences?.({ send: next.send }); S.prefsLocal = false; return 'saved'; }
    catch (e) { console.warn('rainshare preferences', e); S.prefsLocal = true; return 'local'; }
  }
  // What "Send my agent" starts with on an ask: your settings, where they suit it. Before
  // there are any, the command for what your profile says you run, and saying you're on it for a day.
  function sendStart(it){
    const p = S.prefs?.send || {}, ls = ways(it);
    const route = ls.some(w => w.id === p.route) ? p.route : pickLauncher(launchers(it, { viewer: viewer() }))?.id || 'brief';
    return { route, claim: p.claim ?? true, days: p.days || TAKE_DAYS_DEFAULT, askEachTime: p.askEachTime ?? true, remember: true };
  }
  const daysOf = () => S.prefs?.send?.days || TAKE_DAYS_DEFAULT;
  // "3 more days", "A week more": the button that gives you more time, by your settings.
  const moreLabel = () => { const d = daysOf(); return d === 1 ? 'A day more' : d === 7 ? 'A week more' : d === 14 ? '2 weeks more' : `${d} more days`; };
  // A take's day, in words ("Tue, Nov 18"), or '' when it hasn't one.
  const dayOf = ms => ms === ms && ms > 0 ? until(new Date(ms).toISOString()) : '';
  // The first time someone signs in, and has no profile yet: what Rainshare is, and the two
  // things to say about yourself (./welcome.js). It's over whatever page they came back to.
  function welcome(){
    if (!shouldWelcome({ source: S.source, mine: S.mine, sub: S.sub })) return;
    const source = S.source;
    openWelcome({
      person: S.mine.bluesky?.did ? S.mine.bluesky : self(),
      save: p => source.saveProfile(p),
      async saved(){
        toast('Saved. Your board is sorted to suit you.');
        if (S.source !== source) return;
        await loadMine(true); rerender();
      },
      error: plainText
    });
  }

  /* ---------- the board: a list of short cards, and the one you pick beside them ---------- */
  // Everything still open. Signed in, it's sorted best first for you unless you'd rather have
  // the newest first: best first, what someone else asked for comes first, ranked, then what
  // you asked for yourself, newest first, marked as yours, so the one picked to begin with is
  // one you could help with; newest first, it's all by date. Signed out, it's newest first.
  // (What's done is on the page of whoever asked, and all of yours on your own page, which the
  // board's quiet button leads to.)
  const newest = (a, b) => String(b.value?.createdAt).localeCompare(String(a.value?.createdAt));
  const sortBy = () => signedIn() && S.sort !== 'new' ? 'fit' : 'new';
  function boardItems(){
    // (What Rainshare has hidden is never on the board. Whoever asked sees it on their own page.)
    const open = (S.board?.items || []).filter(it => isOpen(it) && !it.hidden);
    if (!signedIn()) return open.sort(newest);
    const mine = open.filter(it => it.repo === viewer()).sort(newest), ranked = [...rank(open.filter(it => it.repo !== viewer()), me()), ...mine];
    return sortBy() === 'new' ? ranked.sort(newest) : ranked;
  }
  // Narrowed to who asked, if you chose to. (Anything but "anyone" is about someone else, so
  // what you asked for is left out of it.)
  const fromWho = (k, it) => it.repo !== viewer() && fromMatches(k, it.ties, word(it.repo));
  const narrowFrom = items => !signedIn() || S.from === 'anyone' ? items : items.filter(it => fromWho(S.from, it));
  // What each choice means, said when you rest on it.
  const FROM_HINT = {
    mutuals: 'Only people you follow who follow you back, on Bluesky or Tangled.',
    following: 'Only people you follow, on Bluesky or Tangled.',
    followers: 'Only people who follow you, on Bluesky or Tangled.',
    vouched: 'Only people you, or someone you vouch for, vouched for on Tangled.'
  };
  const circleWaiting = () => S.circle === undefined || S.circle === 'loading';
  function fromRow(all){
    const opts = FROM.filter(([k]) => k !== 'vouched' || S.source?.vouchCircle);
    return `<div class="rs-from" role="group" aria-label="Who asked">${opts.map(([k, l]) => {
      const n = k === 'anyone' ? all.length : k === 'vouched' && circleWaiting() ? null : all.filter(it => fromWho(k, it)).length;
      return `<button type="button" data-rs-from="${k}" aria-pressed="${S.from === k}"${FROM_HINT[k] ? ` title="${esc(FROM_HINT[k])}"` : ''}${n === 0 && S.from !== k ? ' class="rs-from-none"' : ''}>${esc(l)}${n == null ? '' : `<span class="rs-from-n">${n}</span>`}</button>`;
    }).join('')}</div>`;
  }
  function fromEmpty(){
    const said = {
      mutuals: 'None of your mutuals have asked for rain here yet.',
      following: 'Nobody you follow has asked for rain here yet.',
      followers: 'Nobody who follows you has asked for rain here yet.',
      vouched: circleWaiting() ? 'Looking at your Tangled circle…' : S.circle ? 'Nobody your Tangled circle vouched for has asked for rain here yet.' : 'Your Tangled circle couldn’t be read just now.'
    }[S.from];
    return `<p class="rs-empty">${esc(said)} <button class="rs-link" type="button" data-rs-from="anyone">Show everyone’s</button></p>`;
  }
  // Narrowed to where they stand, if you chose to: nobody's on it yet (nobody's said they're on
  // it, and nothing's been turned in), someone's on it, or something's been turned in (a pull
  // request, or for an idea, what someone built), which is waiting to be looked at.
  const SHOW = [['all', 'Everything open'], ['free', 'Nobody on it yet'], ['on-it', 'In progress'], ['turned-in', 'Turned in']];
  const SHOW_HINT = {
    free: 'Nobody’s said they’re on it, and nothing’s been turned in.',
    'on-it': 'Someone’s said they’re on it, and nothing’s been turned in yet.',
    'turned-in': 'There’s a pull request for it, or for an idea, something someone built.'
  };
  const standsAs = it => { const k = progressOf(it, viewer()).key; return k === 'open' ? 'free' : k; };
  const shows = (k, it) => k === 'all' || standsAs(it) === k;
  const narrowShow = items => items.filter(it => shows(S.show, it));
  const showRow = items => `<div class="rs-from" role="group" aria-label="Which ones">${SHOW.map(([k, l]) => {
    const n = items.filter(it => shows(k, it)).length;
    return `<button type="button" data-rs-show="${k}" aria-pressed="${S.show === k}"${SHOW_HINT[k] ? ` title="${esc(SHOW_HINT[k])}"` : ''}${n === 0 && S.show !== k ? ' class="rs-from-none"' : ''}>${esc(l)}<span class="rs-from-n">${n}</span></button>`;
  }).join('')}</div>`;
  const showEmpty = () => `<p class="rs-empty">${esc({ free: 'Someone’s on each of these already.', 'on-it': 'Nobody’s in the middle of any of these right now.', 'turned-in': 'Nothing’s been turned in for any of these yet.' }[S.show] || '')} <button class="rs-link" type="button" data-rs-show="all">Show everything open</button></p>`;
  // Once nothing someone else asked for is free (each has someone on it or something turned in,
  // or there's nothing at all), the top of the list offers to tell people on Bluesky that you've
  // got usage to spare, naming the paid plans your profile says you have (signed out, or with
  // none, just "AI"). Under it, a dashed rule, and under that what's already being helped with.
  const allTaken = all => !!S.board && !S.error && !all.some(it => it.repo !== viewer() && standsAs(it) === 'free');
  // (Bluesky's butterfly, filled, as the footer on rainshare.dev draws it.)
  const BSKY = '<svg class="rs-i rs-bsky-i" viewBox="0 0 600 530" aria-hidden="true"><path d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z"/></svg>';
  function spareUrl(){
    const paid = plansIn(S.mine?.merged).filter(p => !UNPAID.includes(p)).map(p => labelOf(PLANS, p));
    const which = !paid.length ? 'AI' : paid.length === 1 ? paid[0] : `${paid.slice(0, -1).join(', ')} and ${paid.at(-1)}`;
    return `https://bsky.app/intent/compose?text=${encodeURIComponent(`I’ve got ${which} usage to spare. Post an idea or a project you’d like help with on @${HANDLE} and I’ll send my agent. ${SITE}`)}`;
  }
  const spareCard = inList => {
    const body = `<a class="rs-item rs-spare" href="${esc(spareUrl())}" target="_blank" rel="noopener">
        <span class="rs-item-main">
          <span class="rs-item-title">Got rain to spare?</span>
          <span class="rs-item-ask">Let people know on Bluesky, and they can post something here for your agent.</span>
          <span class="rs-item-line"><span class="rs-spare-go">${BSKY}Post on Bluesky${ico('out')}</span></span>
        </span>
        <span class="rs-spare-pic" aria-hidden="true">${ico('drop')}</span>
      </a>`;
    const rule = '<div class="rs-spare-rule" role="separator"><span>Someone’s already on each of these</span></div>';
    return inList ? `<li class="rs-spare-li">${body}${rule}</li>` : `<div class="rs-spare-alone">${body}</div>`;
  };
  // Over the list: how it's sorted, and a button that folds out what narrows it (who asked,
  // and whether anyone's on it). Whatever is narrowing it shows beside the button while it's
  // folded away, each a press from undone.
  function tools(all, byFrom){
    const fromLabel = (FROM.find(([k]) => k === S.from) || [])[1], showLabel = (SHOW.find(([k]) => k === S.show) || SHOW[0])[1];
    const on = [
      signedIn() && S.from !== 'anyone' && fromLabel ? `<button type="button" data-rs-from="anyone" aria-label="${esc(`Stop showing only ${fromLabel.toLowerCase()}`)}">${esc(fromLabel)}${ico('close')}</button>` : '',
      S.show !== 'all' ? `<button type="button" data-rs-show="all" aria-label="${esc(`Stop showing only ${showLabel.toLowerCase()}`)}">${esc(showLabel)}${ico('close')}</button>` : ''
    ].filter(Boolean);
    const open = !!S.open.filters;
    return `<div class="rs-tools">
        ${signedIn() ? `<div class="rs-from rs-sort" role="group" aria-label="Sort">${[['fit', 'Best for you'], ['new', 'Newest']].map(([k, l]) => `<button type="button" data-rs-sort="${k}" aria-pressed="${sortBy() === k}">${l}</button>`).join('')}</div>` : ''}
        <div class="rs-filter-bar">
          ${on.length && !open ? `<div class="rs-from rs-filter-on">${on.join('')}</div>` : ''}
          <button type="button" class="rs-filter-btn" data-rs-act="filters" aria-expanded="${open}" aria-controls="rsFilters">${ico('filter')}Filter${on.length ? `<span class="rs-from-n">${on.length}</span>` : ''}</button>
        </div>
      </div>
      ${open ? `<div class="rs-filters" id="rsFilters">
        ${signedIn() ? `<div class="rs-filter-row"><span class="rs-from-l">Who asked</span>${fromRow(all)}</div>` : ''}
        <div class="rs-filter-row"><span class="rs-from-l">Show</span>${showRow(byFrom)}</div>
      </div>` : ''}`;
  }
  // One card: who and when across the top, then beside its plant the title, the start of the ask
  // in their own words, a quiet line (how well it suits you, or that it's yours or done) and where
  // it stands. Where the work is and how big a job it is are in its details, and so is who it's
  // open to unless you know them.
  function card(it, { nav = false } = {}){
    const sq = it.value || {}, p = it.author || {}, mine = it.repo === viewer(), on = !nav && it.uri === S.pick;
    const rel = mine ? '' : relationText(it, viewer(), { audience: false }), ask = askExcerpt(sq.spec, 180);
    let line = '';
    if (it.hidden) line = `<span class="rs-state rs-hidden-state">${ico('shield')}Hidden by Rainshare</span>`;
    else if (!isOpen(it)) line = `<span class="rs-state${sq.state === 'sprouted' ? ' rs-ok' : ''}">${sq.state === 'sprouted' ? lifeIco('sprouted') : ''}${esc(stateText(sq))}</span>`;
    else if (mine) line = '<span>Yours</span>';
    else if (it.fit) line = `${drops(it.fit.level)}<span class="rs-fit-l">${esc(it.fit.label)}</span>`;
    const pr = progressOf(it, viewer()), short = progressShort(it, viewer());
    const who = pr.helpers.filter(h => pr.key === 'done' ? h.didIt : pr.key === 'turned-in' ? h.turnedIn : true).slice(0, 3);
    // (What's been turned in, a pull request or what someone built, is a chip of its own, so it stands out down the list.)
    const faces = who.length ? `<span class="rs-faces" aria-hidden="true">${who.map(h => face(h.author, 'sm')).join('')}</span>` : '';
    const taken = !short ? '' : pr.key === 'turned-in' ? `<span class="rs-item-taken rs-turned-in">${faces}<span class="rs-chip">${ico(pr.idea ? 'link' : 'pull')}${esc(short)}</span></span>`
      : `<span class="rs-item-taken rs-${pr.key}">${faces}${esc(short)}</span>`;
    return `<li><a class="rs-item${on ? ' on' : ''}" href="${esc(href(pathOf(it)))}" ${nav ? `data-rs-go="${esc(pathOf(it))}"` : `data-rs-pick="${esc(it.uri)}"`}${on ? ' aria-current="true"' : ''}>
      <span class="rs-item-top">${face(p, 'xs')}<span class="rs-item-who"><b>${esc(mine ? 'You' : nameOf(p))}</b>${mine ? '' : hat(it.repo)}${rel ? `<span> · ${it.space ? ico('lock') : ''}${esc(rel)}</span>` : ''}</span><time>${esc(ago(sq.createdAt))}</time></span>
      <span class="rs-item-main">
        <span class="rs-item-title">${esc(sq.title)}</span>
        ${ask ? `<span class="rs-item-ask">${esc(ask)}</span>` : ''}
        ${line || taken ? `<span class="rs-item-line">${line}${taken}</span>` : ''}
      </span>
      ${plantPic(pictureOf(sq), 52, { key: it.uri })}
    </a></li>`;
  }
  // Where it stands, in a word that's coloured to match (open, in progress, turned in, done,
  // closed), and a row for each person on it or who turned something in: their face, name and
  // handle, what they did and when, each a press from their profile. A take only says someone
  // started, so the row says when, rather than claiming they're at it this minute.
  const PROGRESS_LIFE = { open: 'seed', 'on-it': 'rain', 'turned-in': 'up', done: 'sprouted', closed: 'seed' };
  // (`own` is the asker on the ask's own page, where the Accept buttons the note points at are.)
  function progressNote(it, key, { own, idea } = {}){
    const mine = it.repo === viewer(), who = firstName(it.author), merged = (it.deliveries || []).some(d => d.state === 'merged');
    if (key === 'open') return (it.takes || []).length ? 'Free again: nobody’s on it now.' : 'Nobody’s on it yet.';
    if (key === 'turned-in' && !mine) return merged ? `Merged. Waiting for ${who} to accept it.` : `Waiting for ${who} to look it over.`;
    if (key === 'turned-in' && own) return idea ? 'Look it over, and accept it if it’s what you had in mind.' : merged ? 'It’s been merged. If it did the job, accept it.' : 'Look it over, and accept it if it does the job.';
    if (key === 'closed') return mine ? 'You’re not looking for help with it now.' : `${who} isn’t looking for help with it now.`;
    return '';
  }
  // What someone turned in, under their row: the pull request (or, for an idea, where what they
  // built lives), opened on its own page, with what the forge says about it once it's been asked.
  const PULL_STATE = { open: ['Open', ''], merged: ['Merged', ' rs-ok'], closed: ['Closed', ' rs-dim'] };
  function pullLink(pl, { idea, forge, example, mine }){
    const label = idea ? (mine ? 'What you built' : 'What they built') : `Pull request${pl.number ? ' #' + pl.number : ''}${forge ? ' on ' + forge : ''}`;
    const st = PULL_STATE[pl.state], inner = `${ico(idea ? 'link' : 'pull')}<span class="rs-helper-pull-l">${esc(label)}</span>${st ? `<span class="rs-status${st[1]}">${st[0]}</span>` : ''}`;
    // (The example's pull requests are made up, so they aren't links.)
    return pl.link && !example ? `<a class="rs-helper-pull" href="${esc(pl.link)}" target="_blank" rel="noopener nofollow">${inner}${ico('out', 'rs-helper-out')}</a>` : `<span class="rs-helper-pull">${inner}</span>`;
  }
  // On the ask's own page (`full`), what the helper said with it and their agent's session come
  // under it. For the person who asked, while it's open, so does Accept, or the form it opens.
  function pullItem(pl, h, ctx){
    const more = ctx.full && (pl.note || (pl.session && !ctx.example))
      ? `<div class="rs-helper-more">${pl.note ? `<p>“${esc(pl.note)}”</p>` : ''}${pl.session && !ctx.example ? `<a class="rs-link" href="${esc(pl.session)}" target="_blank" rel="noopener nofollow">See the session${ico('out')}</a>` : ''}</div>` : '';
    const accept = !ctx.own || pl.didIt ? ''
      : S.accepting === pl.uri ? acceptForm(pl, h, ctx)
        : `<div class="rs-helper-act"><button class="rs-btn ${ctx.lead === pl.uri ? 'rs-primary' : 'rs-quiet'} rs-sm" type="button" data-rs-accept="${esc(pl.uri)}">${ico('check')}Accept</button></div>`;
    return pullLink(pl, { ...ctx, mine: h.mine }) + more + accept;
  }
  function helperRow(h, ctx){
    const p = h.author || {}, handle = !h.mine && p.displayName && p.handle ? '@' + p.handle : '';
    // A take whose day has passed with nothing turned in is someone who went quiet (../core/takes.js).
    const took = h.lapsed ? `Went quiet${h.due ? `: said by ${dayOf(h.due)}` : ''}` : h.took ? `Took it on ${ago(h.took)}${h.due ? `, until ${dayOf(h.due)}` : ''}` : 'On it';
    const what = [ctx.tie?.(h.did), h.didIt ? 'Did it' : h.turnedIn ? `Turned it in ${ago(h.turnedIn)}` : took, setupText(h.setup)].filter(Boolean).join(' · ');
    return `<li class="rs-helper">${a('profile/' + h.did, `${face(p)}<span class="rs-helper-text"><span class="rs-helper-name"><b>${esc(h.mine ? 'You' : nameOf(p))}</b>${hat(h.did)}${handle ? `<span class="rs-helper-handle">${esc(handle)}</span>` : ''}</span><small${h.didIt ? ' class="rs-ok"' : ''}>${esc(what)}</small>${h.note ? `<small class="rs-helper-note">“${esc(h.note)}”</small>` : ''}</span>${ico('next', 'rs-helper-go')}`, 'rs-helper-who')}${
      h.pulls.map(pl => pullItem(pl, h, ctx)).join('')}</li>`;
  }
  // Accepting what someone turned in marks the ask done with it, which puts it in their garden.
  // Vouching for them on Tangled can go along in the same press. The box starts unticked, and
  // after that is left as it was last time, in this browser.
  const ACCEPT_VOUCH = 'rs:accept-vouch';
  const vouchWanted = () => { try { return localStorage.getItem(ACCEPT_VOUCH) === '1'; } catch (_) { return false; } };
  const canVouch = did => !!S.source?.vouchFor && did !== viewer() && S.circle !== 'loading' && !word(did)?.mine;
  function acceptForm(pl, h, { idea }){
    const sq = S.seed?.value || {}, first = firstName(h.author);
    const vouch = !h.mine && canVouch(h.did) && connected('tangled'), on = vouch && vouchWanted();
    const what = idea ? (h.mine ? 'what you built' : `what ${first} built`) : h.mine ? 'your pull request' : `${first}’s pull request`;
    return `<form class="rs-form rs-accept" data-rs-form="accept">
      <input type="hidden" name="uri" value="${esc(pl.uri)}">
      <p><b>Accept ${esc(what)}?</b> Your ${esc(nounOf(sq))} is marked done, and it grows in ${h.mine ? 'your' : esc(first) + '’s'} garden.</p>
      ${vouch ? `<label class="rs-check"><input type="checkbox" name="vouch"${on ? ' checked' : ''}> Vouch for ${esc(first)} on Tangled too</label>
        <label class="rs-accept-why"${on ? '' : ' hidden'}>Why you vouch for them <small>(optional, public)</small><input name="reason" maxlength="256" value="${esc(`Helped with “${sq.title}” through Rainshare.`)}"></label>` : ''}
      <div class="rs-row"><button class="rs-btn rs-primary rs-sm" type="submit">${ico('check')}Accept</button><button class="rs-link" type="button" data-rs-act="accept-cancel">Cancel</button></div>
    </form>`;
  }
  // Once it's done, the person who asked can thank whoever did it, vouch for them if they
  // haven't, and close the issue on the forge if it's still open there.
  function followUps(it, pr, st){
    const sq = it.value || {}, forge = FORGE_NAMES[describeSubject(sq.subject)?.forge] || 'the forge', items = [];
    for (const h of pr.helpers.filter(x => x.didIt && !x.mine)) {
      const first = firstName(h.author), thank = thankUrl(it, h);
      if (thank) items.push(`<a class="rs-btn rs-quiet rs-sm" href="${esc(thank)}" target="_blank" rel="noopener">Thank ${esc(first)} on Bluesky${ico('out')}</a>`);
      if (canVouch(h.did) && S.vouching?.did !== h.did) items.push(`<button class="rs-btn rs-quiet rs-sm" type="button" data-rs-vouch="${esc(h.did)}" data-rs-evidence="${esc(h.pulls.find(x => x.didIt)?.uri || '')}">${ico('hat')}Vouch for ${esc(first)}</button>`);
    }
    if (st.planter?.do === 'close-issue' && safeHttp(st.planter.href) && !it.example) items.push(`<a class="rs-btn rs-quiet rs-sm" href="${esc(safeHttp(st.planter.href))}" target="_blank" rel="noopener">Close the issue on ${esc(forge)}${ico('out')}</a>`);
    const vouching = S.vouching && pr.helpers.find(h => h.did === S.vouching.did && h.didIt);
    const form = vouching ? vouchForm(vouching.did, vouching.author, { evidence: S.vouching.evidence, reason: `Helped with “${sq.title}” through Rainshare.` }) : '';
    return items.length || form ? `<div class="rs-follow">${items.length ? `<div class="rs-row">${items.join('')}</div>` : ''}${form}</div>` : '';
  }
  // Where it stands and who's helping. On the ask's own page (`full`), it's also where whoever
  // asked does what comes next (`own`, from standing): share it while nobody's on it, accept what
  // comes in, and follow up once it's done.
  function progressBlock(it, { full = false, own = null } = {}){
    const pr = progressOf(it, viewer()), open = isOpen(it), mineOpen = !!own && open;
    const note = progressNote(it, pr.key, { own: mineOpen, idea: pr.idea });
    const lead = mineOpen ? (own.planter?.do === 'sprout' ? own.planter.delivery : pr.pulls.find(x => !x.didIt)?.uri) : null;
    // (On its own page, each helper's row also says how you know them.)
    const tie = full ? did => tieWord([...(it.deliveries || []), ...(it.takes || [])].find(r => r.repo === did && r.ties)) : null;
    const ctx = { idea: pr.idea, forge: FORGE_NAMES[describeSubject(it.value?.subject)?.forge] || '', example: !!it.example, full, own: mineOpen, lead, tie };
    // Nothing turned in, but the issue was closed, or a pull request nobody turned in was merged:
    // it may be done anyway, with nobody to accept it from.
    const pl = mineOpen ? own.planter : null, alone = pl && (pl.do === 'look' || pl.do === 'close');
    const next = alone ? `<p class="rs-note">${lifeIco('up')}<span>${esc(pl.text)}</span>${pr.pulls.length ? '' : '<button class="rs-btn rs-primary rs-sm" type="button" data-rs-act="sprout">Mark it done</button>'}</p>` : '';
    const share = mineOpen && pr.key === 'open' ? `<div class="rs-row">${shareBtn(it, 'Share on Bluesky')}</div>` : '';
    return `<div class="rs-progress${own ? ' rs-progress-own' : ''}" data-rs-progress="${esc(it.uri)}">
      <p class="rs-progress-head"><span class="rs-pill rs-pill-${pr.key}">${lifeIco(PROGRESS_LIFE[pr.key])}${esc(pr.label)}</span>${note ? `<span class="rs-muted">${esc(note)}</span>` : ''}</p>
      ${share}${next}
      ${pr.helpers.length ? `<ul class="rs-helpers" aria-label="Who’s helping">${pr.helpers.map(h => helperRow(h, ctx)).join('')}</ul>` : ''}
      ${own && it.value?.state === 'sprouted' ? followUps(it, pr, own) : ''}
    </div>`;
  }
  // Picked on the board, an ask's pull requests are asked after (open, merged or closed), once
  // each, and the block over its details fills in when the forge answers. (Its own page asks
  // the forge for more than this: look, in ../core/status.js.)
  const asking = new WeakSet();
  function lookPulls(it){
    if (!it || it.example) return;
    const todo = (it.deliveries || []).filter(d => d.state === undefined && !asking.has(d));
    if (!todo.length) return;
    todo.forEach(d => asking.add(d));
    Promise.all(todo.map(d => pullState({ url: d.value?.url, pull: d.value?.pull, subject: it.value?.subject }).then(st => { d.state = st; }))).then(() => {
      const el = root.querySelector(`.rs-side [data-rs-progress="${CSS.escape(it.uri)}"]`);
      if (el) el.outerHTML = progressBlock(it);
    });
  }
  // Where, the job and what they'd like, each as a plain line. (Who's on it is over them: progressBlock.)
  function facts(it, extra = []){
    const sq = it.value || {}, d = describeSubject(sq.subject), mine = it.repo === viewer();
    const open = d?.href && !it.example ? ` · <a href="${esc(d.href)}" target="_blank" rel="noopener">open it</a>` : '';
    const rows = [
      ['Where', esc(whereText(sq)) + open],
      ['The job', esc(jobAndNotes(sq))],
      ['Models', esc(modelsText(sq, mine ? null : S.mine?.merged))],
      ...extra
    ];
    return `<dl class="rs-facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  }
  // The way from the panel (or the sheet) to the comments, which are only on the ask's own page:
  // it opens there, scrolled to them. (How many there are is only known once the page has been read.)
  function toTalk(it, page){
    const n = it.comments ? threads(it.comments, it.uri).reduce((k, t) => k + 1 + t.replies.length, 0) : null;
    return `<a href="${esc(href(page))}#comments" data-rs-go="${esc(page)}" data-rs-to="comments" class="rs-link">Comments${n ? ` <span class="rs-count">${n}</span>` : ''}</a>`;
  }
  function detail(it){
    const sq = it.value || {}, p = it.author || {}, mine = it.repo === viewer(), open = isOpen(it), page = pathOf(it);
    lookPulls(it);
    const rel = mine ? 'yours' : relationText(it, viewer());
    const f = !mine && open && signedIn() ? it.fit || fit(it, me()) : null;
    let buttons;
    if (!open) buttons = a(page, sq.state === 'sprouted' ? 'See how it went' : 'Open it', 'rs-btn rs-quiet');
    else if (mine) buttons = a(page, 'Open it', 'rs-btn rs-primary') + mdBtn(it) + shareBtn(it);
    else if (!signedIn()) buttons = (host.signIn ? '<button class="rs-btn rs-primary" type="button" data-rs-act="signin">Sign in to take it on</button>' : '') + mdBtn(it) + shareBtn(it);
    else if (myTake(it)) buttons = a(page, 'You’re on it: turn it in', 'rs-btn rs-primary') + mdBtn(it);
    else buttons = `<button class="rs-btn rs-primary" type="button" data-rs-take="${esc(it.uri)}">${ico('drop')}Send my agent</button>${mdBtn(it)}${shareBtn(it)}`;
    const hint = open && !mine && signedIn() && !myTake(it) ? sendHint(it) : '';
    const st = open && !mine && !myTake(it) ? stand(it) : null;
    return `<article class="rs-detail">
      <div class="rs-detail-top">${a('profile/' + it.repo, face(p) + `<b>${esc(mine ? 'You' : nameOf(p))}</b>`, 'rs-who')}${hat(it.repo)}<span class="rs-muted">${rel ? ' · ' + (it.space ? ico('lock') : '') + esc(rel) : ''} · ${esc(ago(sq.createdAt))}</span>
        <span class="rs-detail-tools">${a(page, `${ico('expand')}<span>Full page</span>`, 'rs-detail-page')}<button class="rs-sheet-close" type="button" data-rs-close-sheet aria-label="Close">${ico('close')}</button></span></div>
      <div class="rs-seed-head"><div class="rs-seed-title"><h2 tabindex="-1">${esc(sq.title)}</h2><p class="rs-muted"><span class="rs-stage-name">${esc(whatItIs(sq).name)}</span> · ${esc(whatItIs(sq).note)}</p></div>${plantPic(pictureOf(sq), 88, { key: it.uri })}</div>
      ${progressBlock(it)}
      ${f ? fitBox(f)
        // Signed out, who it's for is said once: beside the name when it's everyone, here when it's narrower.
        : open && !signedIn() && !rel ? `<p class="rs-muted">${esc(audienceLine(sq, { authorName: firstName(p), groupName: it.group?.name }))}.</p>` : ''}
      ${facts(it, [
        !mine && planText(it.profile) ? ['Their AI plan', esc(planText(it.profile))] : null,
        signedIn() && !mine ? ['You and them', tiesList(it.repo, it.ties, p)] : null
      ].filter(Boolean))}
      <div class="rs-ask"><span class="rs-label">The ask</span><p>${esc(askExcerpt(sq.spec) || 'No details beyond the title.')}</p><span class="rs-row">${a(page, 'Read all of it', 'rs-link')}${toTalk(it, page)}${askSizeText(sq.spec) ? `<small class="rs-muted">${esc(askSizeText(sq.spec))}</small>` : ''}</span></div>
      ${open ? cautionNote(it) : ''}
      ${heedNote(it, st)}
      <div class="rs-row rs-detail-actions">${buttons}</div>${hint}
    </article>`;
  }
  function renderBoard(){
    const all = S.board ? boardItems() : [], byFrom = narrowFrom(all), items = narrowShow(byFrom);
    S.shown = items;
    if (items.length && !items.some(i => i.uri === S.pick)) { S.pick = items[0].uri; S.sheet = false; }
    const sel = items.find(i => i.uri === S.pick), spare = allTaken(all);
    const fc = forecastOf(S.mine?.merged);
    const empty = signedIn() ? 'Nothing here yet. When someone in your circle asks for rain, it shows up here.' : 'Nothing’s open to everyone yet. Sign in and ask for rain to post the first one.';
    // Beside "Ask for rain", the way to your own page: led by your garden once there's one,
    // else by what you've asked for.
    const asked = signedIn() && S.board ? S.board.items.filter(it => it.repo === viewer()).length : 0;
    const yours = !signedIn() || !S.garden ? ''
      : S.garden.length ? a('profile/' + viewer(), `${plantPic(S.garden[0].picture || S.garden[0].stage, 26, { key: S.garden[0].uri })}Helped with ${S.garden.length}`, 'rs-btn rs-quiet rs-watered-btn')
        : asked ? a('profile/' + viewer(), `${ico('person')}Your asks <span class="rs-from-n">${asked}</span>`, 'rs-btn rs-quiet') : '';
    return `
      <header class="rs-head">
        <div class="rs-brand">${host.brand !== 'rainshare' ? `<span class="rs-logo">${ico('drop')}</span>` : ''}<div>${
          host.brand !== 'rainshare' ? `<h1>Rainshare</h1><p>${lit('Got rain to spare? Pick an idea or a project and send your agent.')}</p>`
            : signedIn() ? `<h1>Ideas and projects you can help with</h1><p>${lit('Got rain to spare? Pick one and send your agent.')}</p>`
              // Under the landing, which has the page's h1 and says what Rainshare is.
              : underLanding() ? '<h2>Ideas and projects anyone can help with</h2><p>Sign in to see the ones from people you follow too, sorted by how well each suits you.</p>'
                // On its own, for someone who may have come straight here: the way to what Rainshare is.
                : `<h1>Ideas and projects anyone can help with</h1><p>Sign in to see the ones from people you follow too, sorted by how well each suits you. ${host.landing ? a('', 'How Rainshare works', 'rs-link') : ''}</p>`
        }</div></div>
        <div class="rs-head-actions">
          ${yours}
          ${signedIn() && FEATURES.forecast ? a('me', `${skyIco(fc?.[0])}${fc ? esc(fc[1]) : 'Your forecast'}`, 'rs-btn rs-quiet rs-fc' + (fc ? ' rs-fc-' + fc[0] : '')) : ''}
          ${signedIn() ? a('new', `${ico('plus')}Ask for rain`, 'rs-btn rs-primary')
            // (rainshare.dev's bar has its own "Sign in", and the landing its own form.)
            : host.signIn && host.brand !== 'rainshare' ? `<button class="rs-btn rs-primary" type="button" data-rs-act="signin">Sign in</button>` : ''}
        </div>
      </header>
      ${signedIn() && !S.source?.demo && !stageSeen() ? `<p class="rs-note rs-stage-note">${ico('info')}<span>Rainshare is in early ${esc(STAGE)}, so things may change or break. What you post stays in your own account.</span><button class="rs-link" type="button" data-rs-act="stage-seen">Got it</button></p>` : ''}
      ${signedIn() && S.mine && !S.mine.merged ? `<p class="rs-note">${ico('person')}<span>${FEATURES.priorities ? 'Say what you run and who you’d like to help, and your board is sorted to match.' : 'Say which AI plan you have and what you run. People see who they’d be helping, and your board is sorted by what suits you.'}</span>${a('me', 'Set up your profile', 'rs-link')}</p>` : ''}
      ${S.board && all.length ? tools(all, byFrom) : ''}
      ${S.error ? `<p class="rs-note rs-bad">${plain(S.error)}</p>` : ''}
      ${!S.board ? boardSk({ fit: signedIn() })
        : items.length ? `<div class="rs-split${S.sheet ? ' rs-open' : ''}">
            <ul class="rs-list" aria-label="Ideas and projects">${spare ? spareCard(true) : ''}${items.map(it => card(it)).join('')}</ul>
            <div class="rs-scrim" data-rs-close-sheet aria-hidden="true"></div>
            <aside class="rs-side" aria-label="The one you picked">${sel ? detail(sel) : ''}</aside>
          </div>`
        : (byFrom.length ? showEmpty() : all.length ? fromEmpty() : `<p class="rs-empty">${empty}</p>`) + (spare ? spareCard(false) : '')}
      ${(S.board?.notes || []).map(n => `<p class="rs-note">${esc(n)}</p>`).join('')}
      ${
        // rainshare.dev has Agents in its own bar, and says where records live in its footer.
        host.brand === 'rainshare' ? '' : `<footer class="rs-foot">${a('agents', `${ico('term')}Send agents from your terminal`, 'rs-link')}<span class="rs-muted">Every ask is a record in the account of whoever posted it.</span></footer>`}`;
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
  // Sending your agent asks first how, and whether to say you're on it (./send.js), unless
  // your settings say to skip the questions. What Rainshare's checks found that's very likely a
  // trick is said once more before any of that, since the agent is handed the ask either way.
  async function sendAgent(it, el, { panel = false, ask = false } = {}){
    if (!it) return;
    const flags = concerns(it.value);
    if (alarming(flags) && !confirm(`Rainshare’s checks flagged this ask:\n\n${flags.map(f => '• ' + f.said).join('\n')}\n\nYour agent will be told too. Send it anyway?`)) return;
    const start = sendStart(it);
    const send = async answers => {
      if (answers.remember) await savePrefs({ route: answers.route, claim: answers.claim, days: answers.days, askEachTime: answers.askEachTime });
      const r = answers.claim ? await claim(it, el, answers) : { fresh: it, launch: copyWay(it, answers.route, false) };
      if (!r) return;
      // On the board, it goes on to the ask's own page, with the commands open there.
      if (panel) { S.seed = r.fresh; S.pendingLaunch = { uri: it.uri, id: r.launch }; S.sheet = false; go(pathOf(it)); return; }
      S.seed = r.fresh; S.launch = r.launch;
      render();
      root.querySelector('#rsLaunch')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    if (start.askEachTime || ask) return openSend({ title: it.value?.title || '', asker: firstName(it.author), ways: ways(it).map(w => ({ id: w.id, name: WAY_NAME[w.id] || w.label, note: w.note })), answers: start, send, error: plainText });
    try { await send(start); } catch (e) { console.warn('rainshare send', e); toast(plainText(e)); if (el) el.disabled = false; }
  }
  // The way picked, copied for pasting. `claimed`: whether the take was just written.
  function copyWay(it, route, claimed){
    const ls = ways(it), w = ls.find(x => x.id === route) || ls[0];
    if (claimed) copy(w.command, `You’re on it. ${w.copied}`, `You’re on it. Press Copy beside the ${w.id === 'brief' ? 'brief' : 'command'} to copy it.`);
    else copy(w.command, `${w.copied} Nobody’s been told you’re on it.`, `Press Copy beside the ${w.id === 'brief' ? 'brief' : 'command'} to copy it.`);
    return w.id;
  }
  // Saying you're on it looks first: at the seed as it is this minute, and at the forge. If
  // that turns up something the screen wasn't already saying (someone took it a moment ago, a
  // pull request is up, the issue was closed), it asks before writing anything. Null if it
  // didn't go ahead; throws if something went wrong.
  async function claim(it, el, { route = null, days = daysOf() } = {}){
    if (el) el.disabled = true;
    try {
      const shown = stand(it).verdict;
      const now = carry(it, await S.source.seed(it.uri, { force: true }).catch(() => null) || it);
      await Promise.race([look(now), new Promise(r => setTimeout(r, 4000))]);
      const st = stand(now);
      if (!st.clear && st.verdict !== shown && !confirm(`${heed(now, st) || st.advice}\n\nSend your agent anyway?`)) {
        if (S.seed?.uri === now.uri) { S.seed = now; render(); }
        if (el) el.disabled = false;
        return null;
      }
      await S.source.take(now, { setup: mySetup() || undefined, days });
      const fresh = carry(now, await S.source.seed(it.uri, { force: true }) || now);
      S.boardAt = 0; loadBoard();
      return { fresh, launch: route ? copyWay(fresh, route, true) : null };
    } catch (e) { if (el) el.disabled = false; throw e; }
  }
  // Under "Send my agent", when the questions are skipped: what it'll do, and the way to change that.
  const sendHint = it => {
    const st = sendStart(it);
    return st.askEachTime ? '' : `<p class="rs-muted rs-send-hint">${esc(sendSummary(st, WAY_NAME))}. <button class="rs-link" type="button" data-rs-act="send-ask" data-rs-uri="${esc(it.uri)}">Change</button></p>`;
  };

  /* ---------- one seed, in full ---------- */
  async function loadSeed(sub){
    S.seedErr = null;
    let uri;
    const priv = sub.match(/^seed\/s\/([A-Za-z0-9_-]+)$/);
    if (priv) uri = unb64url(priv[1]);
    else {
      const m = sub.match(/^seed\/([^/]+)\/([^/]+)$/);
      if (m) {
        const who = decode(m[1]);
        const did = who.startsWith('did:') ? who : await resolveHandle(who).catch(() => null);
        uri = did ? `at://${did}/${SEED}/${m[2]}` : null;
      }
    }
    // Arriving by the link an agent hands back: the pull request is waiting in the turn-in form,
    // or the branch it pushed is waiting in the form that opens the pull request from here.
    const back = uri && typeof location !== 'undefined' ? readHandBack(location.search) : null;
    const pushed = uri && !back && typeof location !== 'undefined' ? readBranchBack(location.search) : null;
    S.handBack = back || pushed ? uri : null; S.handKind = back ? 'pull' : pushed ? 'branch' : null;
    if (back) S.drafts.turnIn = back;
    // (A page can be entered more than once as the site starts up: what's been written since isn't thrown away.)
    if (pushed && !(S.drafts.pull?.uri === uri && S.drafts.pull.asked === pushed.branch)) {
      S.drafts.turnIn = { model: pushed.model, harness: pushed.harness, sessionUrl: pushed.sessionUrl };
      S.drafts.pull = { uri, asked: pushed.branch, branch: pushed.branch, from: pushed.from || undefined, ...(pushed.title ? { title: pushed.title } : {}) };
      S.open.pull = true;
    }
    // Arriving from "Send my agent" on the board: the commands to start one are open.
    S.launch = S.pendingLaunch?.uri === uri ? S.pendingLaunch.id : null;
    S.pendingLaunch = null;
    if (!uri) { S.seed = null; S.seedErr = { message: 'That link doesn’t lead to anything on Rainshare.' }; return; }
    // What was being written when you went off to connect a forge is waiting where you left it.
    const kept = takeKept();
    if (kept?.uri === uri) {
      if (kept.comment?.text) S.drafts.comment = kept.comment;
      if (kept.reply?.parent) { S.drafts.reply = kept.reply; S.reply = kept.reply.parent; }
      if (kept.pull) { S.drafts.pull = kept.pull; S.open.pull = true; }
      if (kept.vouching) S.vouching = kept.vouching;
    }
    if (S.pull?.uri !== uri) S.pull = null;
    const cached = S.seed?.uri === uri ? S.seed : S.board?.items.find(i => i.uri === uri);
    S.seed = cached || null;
    if (S.view === 'seed') render();
    try {
      const fresh = await S.source.seed(uri, { force: !!cached });
      if (fresh) S.seed = carry(cached, fresh); else if (!cached) S.seedErr = { message: 'It’s gone, or it isn’t one you can see.', who: parseUri(uri)?.repo };
    } catch (e) { if (!cached) S.seedErr = e; console.warn('rainshare seed', e); }
    seen(S.seed);
    if (S.seed && S.open.pull) loadPull(S.seed);
  }
  // What the forge knows: whether the issue is still open, whether the pull requests turned in
  // have landed, and whether one is up there that nobody turned in. The page fills in when it answers.
  function seen(item){
    if (!item || item.example) return;
    look(item).then(() => { if (S.seed === item && S.view === 'seed') rerender(); }, () => {});
  }
  // A seed read again after something changed keeps what the forge said a moment ago.
  async function reread(it){
    const fresh = carry(it, await S.source.seed(it.uri, { force: true }) || it);
    seen(fresh);
    return fresh;
  }
  const setupText = s => s ? `${HARNESS_NAMES[s.harness] || s.harness}${s.models?.length ? ` (${join(s.models.map(modelName))})` : ''}` : '';
  // Someone's profile as a few plain lines.
  function profileCard(p, person, { compact } = {}){
    // The bio is their Rainshare one if they wrote one, and their Bluesky profile's otherwise.
    const bio = p?.bio || person?.description || '';
    if (!p) return `${bio ? `<p class="rs-bio">${esc(bio)}</p>` : ''}<p class="rs-muted">${esc(nameOf(person))} hasn’t set up a Rainshare profile yet.</p>`;
    const fc = forecastOf(p);
    const rows = [
      ['AI plan', planText(p)],
      FEATURES.circumstances && ['About them', p.circumstances?.length && p.circumstances.map(c => labelOf(CIRCUMSTANCES, c)).join(', ')],
      ['Runs', (p.setups || []).map(s => setupText(s)).join('; ')],
      FEATURES.forecast && ['Forecast', fc && `${fc[1]}: ${fc[2].toLowerCase()}${p.forecast.until ? `, until ${until(p.forecast.until)}` : ''}.${p.forecast.note ? ` “${p.forecast.note}”` : ''}`],
      FEATURES.values && ['Cares about', p.values?.length && join(p.values.map(pretty))],
      ...(compact ? [] : [
        FEATURES.priorities && ['Helps first', p.priorities?.length && p.priorities.map(v => labelOf(PRIORITIES, v)).join(', ')],
        ['Takes on', p.offering?.length && join(p.offering)]
      ])
    ].filter(r => r && r[1]);
    return `${bio ? `<p class="rs-bio">${esc(bio)}</p>` : ''}${rows.length ? `<dl class="rs-facts rs-facts-sm">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${k === 'Forecast' ? `<span class="rs-fc-${fc[0]}">${skyIco(fc[0])}</span>` : ''}${esc(v)}</dd>`).join('')}</dl>` : bio ? '' : '<p class="rs-muted">Nothing shared yet.</p>'}`;
  }
  // Every way to hand a seed to an agent: the brief, to paste into one, and then the commands
  // that start one from a terminal.
  const ways = it => [
    { id: 'brief', label: 'Any agent, by pasting', note: 'Nothing to install. Paste the brief into Claude Code, Codex or a chat window that can reach the repo.', command: briefFor(it), copied: 'Copied the brief. Paste it into your agent.' },
    ...launchers(it, { viewer: viewer() }).map(l => ({ ...l, copied: `Copied the ${l.label} command. Paste it in a terminal.` }))
  ];
  // Each way by a word or two, to pick between.
  const WAY_NAME = { brief: 'Paste a brief', claude: 'Claude Code', cloud: 'Claude Code, cloud', codex: 'Codex', cli: 'Rainshare CLI', mcp: 'MCP' };
  // The way that suits them (the one just copied) showing, and the others a press away.
  function renderLaunch(it){
    const ls = ways(it), on = Math.max(0, ls.findIndex(l => l.id === S.launch)), l = ls[on];
    return `<section class="rs-launch" id="rsLaunch" aria-labelledby="rsLaunchH">
      <div class="rs-hrow"><h3 id="rsLaunchH">Send your agent</h3>${tip(`When the work’s done, your agent hands you a link back to this page, and that turns it in. ${a('agents', 'Set up the CLI or MCP server', 'rs-link')} and it can do that part itself.`)}</div>
      ${wantPhrase(it.value) ? `<p class="rs-muted rs-l-want">${esc(firstName(it.author || {}))} would prefer ${esc(wantPhrase(it.value))}. Pick the model before you start the session.</p>` : ''}
      <div class="rs-chips" role="group" aria-label="How to send it">${ls.map((x, i) => `<button type="button" data-rs-launch="${i}" aria-pressed="${i === on}">${esc(WAY_NAME[x.id] || x.label)}</button>`).join('')}</div>
      <div class="rs-l-head"><small>${esc(l.note)}</small><button class="rs-btn rs-quiet rs-sm" type="button" data-rs-copy="${on}">${ico('copy')}Copy</button></div>
      <pre class="rs-code${l.id === 'brief' ? ' rs-l-brief' : ''}"><code>${esc(l.id !== 'brief' && l.command.length > 600 ? l.command.slice(0, 600) + '\n…' : l.command)}</code></pre>
    </section>`;
  }
  // Posting to knotless or Tangled as you is asked for at sign-in. A sign-in from before that,
  // or a server that granted less, can add a forge: what's typed is kept while your server asks.
  const KEPT = 'rs:kept';
  const takeKept = () => { try { const k = JSON.parse(sessionStorage.getItem(KEPT) || 'null'); sessionStorage.removeItem(KEPT); return k; } catch (_) { return null; } };
  const connected = forge => (host.forges?.() || []).includes(forge) && S.unlinked !== forge;
  const connectNote = (forge, what) => host.connectForge
    ? `<p class="rs-note">${ico('lock')}<span>Connect ${esc(FORGE_SAID[forge])} to ${what} there from here.${tip(`Your sign-in doesn’t let Rainshare ${what} on ${esc(FORGE_SAID[forge])} for you yet. Your server shows exactly what’s being added, and brings you back here with this still written.`)}</span><button class="rs-btn rs-primary rs-sm" type="button" data-rs-act="connect-forge" data-rs-forge="${forge}">Connect ${esc(FORGE_SAID[forge])}</button></p>`
    : `<p class="rs-muted">Posting to ${esc(FORGE_SAID[forge])} isn’t set up here.</p>`;
  /* ---------- Tangled's vouch network (../core/vouch.js) ---------- */
  // Beside the people who ask and the people who help: whether you, or someone you vouch for
  // on Tangled, has vouched for them or denounced them. It's read once per sign-in, the first
  // time a page that shows people is opened, and again after you vouch.
  const whoIs = did => knownPerson(did) || [S.seed, ...(S.board?.items || [])].flatMap(it => it ? [it, ...(it.takes || []), ...(it.deliveries || []), ...(it.comments || [])] : []).find(r => r.repo === did && r.author)?.author || (did === S.other?.did ? S.other.person : null) || { did };
  function loadCircle(force){
    if (!signedIn() || !S.source.vouchCircle || (S.circle !== undefined && !force)) return;
    if (!S.circle) S.circle = 'loading';
    S.source.vouchCircle().then(c => {
      S.circle = c || null;
      const redraw = () => { if (S.view === 'seed' || S.view === 'person' || S.view === 'board') rerender(); };
      // Whoever's word it is gets named: anyone not known yet is looked up.
      const unknown = [...new Set((c?.circle || []).map(x => x.did))].filter(d => !whoIs(d).handle && !whoIs(d).displayName);
      // (In the example circle, everyone there is to know comes with the board.)
      if (unknown.length) (S.source.demo ? Promise.resolve(loadBoard()) : profiles(unknown.slice(0, 50))).then(redraw, redraw); else redraw();
    }, e => { S.circle = null; console.warn('rainshare vouches', e); });
  }
  const word = did => S.circle && S.circle !== 'loading' && did !== viewer() ? wordOn(S.circle, did) : null;
  const wordSaid = w => wordText(w, d => nameOf(whoIs(d)));
  // The mark beside a name. Tangled calls it a hat: green for a vouch, red for a denouncement.
  const hat = did => { const w = word(did); return w ? `<span class="rs-hat rs-hat-${w.kind}" role="img" aria-label="${esc(wordSaid(w))}" title="${esc(wordSaid(w))}">${ico('hat')}</span>` : ''; };
  const wordLine = did => { const w = word(did); return w ? `<p class="rs-vouch-said rs-hat-${w.kind}">${ico('hat')}<span>${esc(wordSaid(w))}</span></p>` : ''; };
  /* ---------- how you know someone (../core/ties.js) ---------- */
  // Who follows whom on Bluesky and on Tangled comes with the person; which of the people you
  // follow on Bluesky follow them is asked for the first time they're shown, and fills in when
  // it answers, without redrawing the rest of the page.
  function loadKnown(did){
    if (!signedIn() || !S.source.knownFollowers || !did || did === viewer() || S.known[did] !== undefined) return;
    S.known[did] = 'loading';
    const src = S.source;
    src.knownFollowers(did).catch(() => null).then(k => {
      if (S.source !== src) return;
      S.known[did] = k || null;
      root.querySelectorAll(`[data-rs-known="${CSS.escape(did)}"]`).forEach(el => { el.innerHTML = knownInner(did); });
    });
  }
  function knownInner(did){
    const k = S.known[did];
    if (k === undefined || k === 'loading') return '<span class="rs-muted">Looking at who you follow…</span>';
    const text = knownText(k, firstName(whoIs(did)), nameOf);
    return text ? `${k.people?.length ? `<span class="rs-faces" aria-hidden="true">${k.people.slice(0, 3).map(x => face(x, 'sm')).join('')}</span>` : ico('person')}<span>${esc(text)}</span>` : '';
  }
  // The lot, as short lines: follows each way, who you follow that follows them, and (unless
  // it's said elsewhere on the page) your Tangled circle's word on them.
  function tiesList(did, ties, p, { vouch = true } = {}){
    if (!signedIn() || !did || did === viewer()) return '';
    loadKnown(did);
    const w = vouch ? word(did) : null;
    return `<ul class="rs-ties">${tieLines(ties, firstName(p)).map(l => `<li>${ico('person')}<span>${esc(l)}</span></li>`).join('')}${
      S.source.knownFollowers ? `<li data-rs-known="${esc(did)}">${knownInner(did)}</li>` : ''}${
      w ? `<li class="rs-vouch-said rs-hat-${w.kind}">${ico('hat')}<span>${esc(wordSaid(w))}</span></li>` : ''}</ul>`;
  }
  // A tie in a word, first among a helper's details: "Mutual · Turned it in 6d ago · Claude Code".
  const tieWord = r => { const t = r && r.repo !== viewer() && TIE_SHORT[tieOf(r.ties)]; return t ? t[0].toUpperCase() + t.slice(1) : ''; };
  // Vouching is a public record in your own account, so the form says so. `evidence` is the
  // delivery it's for, when it's written beside one.
  function vouchForm(did, p, { evidence, reason = '' } = {}){
    return `<form class="rs-form rs-vouchform" data-rs-form="vouch">
      <input type="hidden" name="did" value="${esc(did)}">${evidence ? `<input type="hidden" name="evidence" value="${esc(evidence)}">` : ''}
      <label>Why you vouch for ${esc(firstName(p))} <small>(optional, public)</small><input name="reason" maxlength="256" value="${esc(S.vouching?.reason ?? reason)}"></label>
      ${connected('tangled') ? '<div class="rs-row"><button class="rs-btn rs-primary rs-sm" type="submit">Vouch on Tangled</button><button class="rs-link" type="button" data-rs-act="vouch-cancel">Not now</button></div>' : connectNote('tangled', 'vouch')}
    </form>`;
  }
  // On someone's profile: what your circle has said about them and why, and your own vouch to give or take back.
  function vouchBlock(did, p){
    if (!signedIn() || !S.source.vouchCircle || did === viewer()) return '';
    const w = word(did), first = firstName(p), writing = S.vouching?.did === did && !S.vouching.evidence;
    const why = w ? [w.mine?.reason ? ['You', w.mine] : null, ...w.by.filter(b => b.reason).map(b => [nameOf(whoIs(b.did)), b])].filter(Boolean) : [];
    const page = p?.handle || /^did:(plc|web):/.test(did) ? `https://tangled.org/${p?.handle || did}` : null;
    return `<div class="rs-hrow"><h2>On Tangled</h2>${tip(`Vouches come from Tangled: you see your own, and those of the people you vouch for there. They’re something to weigh, and don’t unlock or hide anything. <a class="rs-link" href="https://tangled.org/docs/guides/vouching/" target="_blank" rel="noopener">How vouching works</a>`, 'About vouches')}</div><div class="rs-panel rs-vouch">
      ${S.circle === 'loading' || S.circle === undefined ? '<p class="rs-muted">Looking at your Tangled circle…</p>'
        : w ? `${wordLine(did)}${why.length ? `<ul class="rs-vouch-why">${why.map(([n, b]) => `<li><b>${esc(n)}</b>${b.kind === 'denounce' ? ' (denounced)' : ''}: “${esc(b.reason)}”</li>`).join('')}</ul>` : ''}`
          : `<p>${S.circle ? `Nobody in your Tangled circle has vouched for ${esc(first)} or denounced them.` : 'Your Tangled circle couldn’t be read just now.'}</p>`}
      ${S.circle?.partial ? '<p class="rs-muted">Not everyone you vouch for could be asked, so there may be more than this.</p>' : ''}
      ${w?.mine?.kind === 'vouch' ? `<div class="rs-row"><button class="rs-link" type="button" data-rs-unvouch="${esc(did)}">Take back your vouch</button></div>`
        : w?.mine?.kind === 'denounce' ? (page && !S.source.demo ? `<div class="rs-row"><a class="rs-link" href="${esc(page)}" target="_blank" rel="noopener">Change it on Tangled</a></div>` : '')
          : writing ? vouchForm(did, p)
            : S.source.vouchFor ? `<div class="rs-row"><button class="rs-btn rs-quiet rs-sm" type="button" data-rs-vouch="${esc(did)}">${ico('hat')}Vouch for ${esc(first)}</button></div>` : ''}
    </div>`;
  }
  async function submitVouch(form){
    const v = Object.fromEntries(new FormData(form)), btn = form.querySelector('[type=submit]');
    if (btn) btn.disabled = true;
    try {
      // Vouched from a delivery, the vouch points at it (and at its pull request, if that's on Tangled).
      const dl = v.evidence ? (S.seed?.deliveries || []).find(d => d.uri === v.evidence) : null;
      const evidence = dl && S.source.evidenceFor ? await S.source.evidenceFor(dl).catch(() => []) : [];
      await S.source.vouchFor(v.did, { reason: v.reason, evidence });
      S.vouching = null; toast('Vouched for them on Tangled.'); loadCircle(true); rerender();
    } catch (e) {
      if (e?.name === 'NotConnected') S.unlinked = 'tangled';
      toast(plainText(e)); rerender();
    }
  }
  async function takeBackVouch(did){
    if (!confirm('Take back your vouch? The record is deleted from your account.')) return;
    try { await S.source.unvouch(did); toast('Vouch taken back.'); loadCircle(true); }
    catch (e) { if (e?.name === 'NotConnected') S.unlinked = 'tangled'; toast(plainText(e)); rerender(); }
  }

  /* ---------- opening the pull request from here (knotless and Tangled) ---------- */
  // Once a branch is pushed, the pull request can be opened from the ask's page, as you, and
  // turned in with the same press. The form is filled from what the forge says about the repo
  // (its branches, your forks of it, its template) and from the link an agent handed back.
  async function loadPull(it, force){
    if (!writableForge(it?.value?.subject) || !S.source?.pullChoices || !signedIn() || (!force && S.pull?.uri === it.uri)) return;
    const mine = S.pull = { uri: it.uri, loading: true };
    if (S.view === 'seed') rerender();
    try { mine.choices = await S.source.pullChoices(it.value.subject); } catch (e) { mine.error = e; console.warn('rainshare pull', e); }
    mine.loading = false;
    if (S.pull === mine && S.seed?.uri === it.uri && S.view === 'seed') rerender();
  }
  const workModel = it => S.drafts.turnIn?.model || myTake(it)?.value?.setup?.models?.[0] || mySetup()?.models?.[0] || '';
  function pullBox(it, { d, page }){
    const sq = it.value || {}, forge = writableForge(sq.subject);
    if (!forge || !signedIn() || !S.source?.forgePull) return '';
    const name = FORGE_SAID[forge], st = S.pull?.uri === it.uri ? S.pull : null, ch = st?.choices, kept = S.drafts.pull?.uri === it.uri ? S.drafts.pull : {};
    let inner;
    if (!st || st.loading) inner = `<p class="rs-muted">Looking at the repo’s branches on ${esc(name)}…</p>`;
    else if (!ch) inner = `<p class="rs-note">${ico('info')}<span>${esc(name)} didn’t say which branches the repo has${st.error?.message ? `: ${esc(st.error.message)}` : '.'}</span><button class="rs-btn rs-quiet rs-sm" type="button" data-rs-act="pull-retry">Try again</button></p>`;
    else {
      const src = ch.sources.find(x => x.id === kept.from) || pickSource(ch, { from: kept.from, branch: kept.branch }) || ch.sources[0];
      // The branch an agent named may not have reached the forge's index yet: it's still offered, and said to be missing.
      const missing = kept.asked && !ch.sources.some(x => x.branches.includes(kept.asked));
      const names = [...(missing ? [kept.asked] : []), ...src.branches];
      const branch = names.includes(kept.branch) ? kept.branch : names[0] || '';
      const base = ch.bases.includes(kept.base) ? kept.base : ch.base;
      const opt = (v, label, on) => `<option value="${esc(v)}"${on ? ' selected' : ''}>${esc(label)}</option>`;
      const body = kept.body ?? pullText({ template: ch.template, issue: d?.issue ? safeHttp(d.href) : null, page, asker: it.author?.handle ? '@' + it.author.handle : firstName(it.author), model: workModel(it) ? modelName(workModel(it)) : '' });
      inner = `<form class="rs-form" data-rs-form="pull">
        ${missing ? `<p class="rs-note">${ico('info')}<span>${esc(name)} doesn’t show a branch called “${esc(kept.asked)}” yet. If it was only just pushed, give it a moment.</span><button class="rs-btn rs-quiet rs-sm" type="button" data-rs-act="pull-retry">Look again</button></p>` : ''}
        <div class="rs-two">
          ${ch.sources.length > 1 ? `<label>Pushed to<select name="from">${ch.sources.map(x => opt(x.id, x.fork ? `${x.label} (your fork)` : x.label, x.id === src.id)).join('')}</select></label>` : `<input type="hidden" name="from" value="${esc(src.id)}">`}
          <label>Branch${names.length ? `<select name="branch" required>${names.map(b => opt(b, missing && b === kept.asked ? `${b} (not seen yet)` : b, b === branch)).join('')}</select>` : `<input name="branch" required autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(kept.branch || '')}">`}</label>
          <label>Merge into${ch.bases.length ? `<select name="base">${ch.bases.map(b => opt(b, b, b === base)).join('')}</select>` : `<input name="base" autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(base)}">`}</label>
        </div>
        <label>Title<input name="title" maxlength="256" required value="${esc(kept.title ?? sq.title ?? '')}"></label>
        <label>Description <small>(Markdown${ch.template ? ', starting from the repo’s template' : ''})</small><textarea name="body" rows="6" maxlength="18000">${esc(body)}</textarea></label>
        ${connected(forge) ? '<div class="rs-row"><button class="rs-btn rs-primary" type="submit">Open the pull request and turn it in</button></div>' : connectNote(forge, 'open pull requests')}
      </form>`;
    }
    return `<div class="rs-pull">${inner}</div>`;
  }
  async function submitPull(form){
    const it = S.seed, forge = writableForge(it?.value?.subject), v = Object.fromEntries(new FormData(form)), btn = form.querySelector('[type=submit]');
    if (!it || !forge) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Opening it…'; }
    let pr;
    try { pr = await S.source.forgePull(it.value.subject, { title: v.title, body: v.body, branch: String(v.branch || '').trim(), from: v.from || undefined, base: String(v.base || '').trim() || undefined }); }
    catch (e) {
      // Your server said this sign-in doesn't allow it: offer to connect, with the form kept.
      if (e?.name === 'NotConnected') S.unlinked = forge;
      toast(plainText(e)); rerender(); return;
    }
    // It's open. Turning it in is the other half: if that fails the pull request still stands,
    // so its address goes into the turn-in form rather than being lost.
    const t = S.drafts.turnIn || {}, taken = myTake(it), model = t.model || workModel(it);
    const setup = { harness: t.harness || taken?.value?.setup?.harness || mySetup()?.harness, models: model ? [model] : [] };
    S.drafts.pull = null; S.open.pull = false; S.pull = null;
    try {
      if (!taken) { await S.source.take(S.seed, { setup }); S.seed = carry(S.seed, await S.source.seed(S.seed.uri, { force: true }) || S.seed); }
      await S.source.turnIn(S.seed, { url: pr.url || undefined, pull: pr.uri, sessionUrl: t.sessionUrl, note: t.note, setup });
      S.drafts.turnIn = null; S.launch = null; S.again = null;
      if (S.handBack) { S.handBack = S.handKind = null; try { history.replaceState(history.state, '', location.pathname); } catch (_) {} }
      const who = firstName(S.seed.author);
      S.seed = await reread(S.seed); S.boardAt = 0; loadBoard();
      toast(pr.attested === false ? `Opened on ${FORGE_SAID[forge]} and turned in. It may show as unverified there for a while.` : `Opened on ${FORGE_SAID[forge]} and turned in. It’s with ${who} now.`);
    } catch (e) {
      console.warn('rainshare turn-in', e);
      S.drafts.turnIn = { ...t, url: pr.url || pr.uri }; S.handBack = S.again = S.seed.uri; S.handKind = 'pull';
      toast(`The pull request is open on ${FORGE_SAID[forge]}. Turning it in didn’t work: press “Turn it in” to try again.`);
    }
    render();
  }

  /* ---------- comments (../core/comments.js) ---------- */
  // What people say on an ask: a question before starting, the answer, how it's going. On an
  // ask on a Tangled or knotless issue they're the issue's own comments, read from the forge,
  // and one written here is posted there, as you (`it.talk` says whether the forge answered).
  // Otherwise each is a record in its writer's own repo that points here. Either way they're
  // shown as their writers' words, apart from the ask itself. Replies sit under the comment
  // that started the thread, and a reply is written at the foot of the thread it's in.
  // (knotless keeps an issue's comments as one list, so there's nothing to reply to there.)
  const commentKey = c => 'rsc-' + String(c.rkey || c.uri.split('/').pop()).replace(/[^A-Za-z0-9_-]/g, '');
  function roleOf(c, it){
    if (c.repo === it.repo) return 'Asked this';
    if ((it.deliveries || []).some(d => d.repo === c.repo)) return 'Turned it in';
    return activeTakes(it).some(t => t.repo === c.repo) ? 'On it' : '';
  }
  // Whether a comment can be answered here: on the issue, only one of Tangled's.
  const canReply = (c, forge) => signedIn() && (forge ? forge === 'tangled' && c.forge === 'tangled' : !c.forge);
  function commentLi(c, it, { reply = false, forge = null } = {}){
    const v = c.value || {}, role = roleOf(c, it), mine = c.repo === viewer();
    const to = reply && c.to ? ` <span class="rs-muted">to ${esc(c.to.repo === viewer() ? 'you' : nameOf(c.to.author))}</span>` : '';
    const tools = [
      canReply(c, forge) ? `<button class="rs-link" type="button" data-rs-reply="${esc(c.uri)}">Reply</button>` : '',
      // One on the forge is the forge's to change or delete: the tip says so.
      mine && !c.forge ? `<button class="rs-link rs-danger" type="button" data-rs-uncomment="${esc(c.uri)}">Delete</button>` : '',
      // @rainshare.dev can hide anyone else's, here or on the issue.
      moderating() && !mine && !it.space ? `<button class="rs-link rs-danger" type="button" data-rs-mod="${esc(c.uri)}">Hide</button>` : ''
    ].join('');
    const notes = [ago(v.createdAt), forge && !c.forge ? 'only on Rainshare' : '', !reply && c.lost ? 'in reply to a comment that isn’t here' : ''].filter(Boolean).join(' · ');
    return `<li class="rs-comment" id="${esc(commentKey(c))}">${face(c.author)}<div>
        <span>${a('profile/' + c.repo, `<b>${esc(mine ? 'You' : nameOf(c.author))}</b>`, 'rs-who')}${hat(c.repo)}${role ? `<span class="rs-role">${esc(role)}</span>` : ''}${to}</span>
        <small>${esc(notes)}</small>
        <div class="rs-spec rs-comment-text">${renderMarkdown(v.text)}</div>
        ${tools ? `<div class="rs-row">${tools}</div>` : ''}
        ${moderating() ? hideForm(c.uri, 'this comment') : ''}
      </div></li>`;
  }
  // On an issue, what the old "Comment on the issue" box offered: a note that links here.
  function noteFor(it){
    const page = pageOf(it);
    // (Once you've said it, there's no need to again.)
    if (!page || (it.comments || []).some(c => c.repo === viewer() && String(c.value?.text || '').includes(page))) return null;
    if (it.repo === viewer() && isOpen(it)) return ['Add a note that links here', `I’ve posted this on Rainshare, for anyone who’d like to send their agent to work on it: ${page}`];
    return myTake(it) && isOpen(it) ? ['Say you’re working on it', `I’m working on this, through Rainshare: ${page}`] : null;
  }
  const commentForm = (kind, it, { parent, to, forge } = {}) => {
    const d = S.drafts[kind], text = d?.uri === it.uri && (kind === 'comment' || d.parent === parent) ? d.text : '';
    const name = forge && FORGE_SAID[forge], label = kind === 'reply' ? (to.repo === viewer() ? 'Your reply' : `Your reply to ${esc(nameOf(to.author))}`) : 'Add a comment';
    const hint = kind === 'comment' ? (it.repo === viewer() ? 'Answer a question, or say what’s changed' : `Ask ${esc(firstName(it.author))} something, or say how it’s going`) : '';
    const note = kind === 'comment' && forge && !text ? noteFor(it) : null;
    const cancel = kind === 'reply' ? '<button class="rs-link" type="button" data-rs-act="reply-cancel">Cancel</button>' : '';
    // On an issue, it's posted on the forge as you: that needs a sign-in that allows it.
    const send = forge && !connected(forge) ? connectNote(forge, 'comment') + (cancel ? `<div class="rs-row">${cancel}</div>` : '')
      : `<div class="rs-row"><button class="rs-btn rs-primary rs-sm" type="submit">${kind === 'reply' ? 'Reply' : 'Comment'}${forge ? ` on ${esc(name)}` : ''}</button>${cancel}${note ? `<button class="rs-link" type="button" data-rs-fill="${esc(note[1])}">${esc(note[0])}</button>` : ''}</div>`;
    return `<form class="rs-form rs-commentform" data-rs-form="${kind}">${parent ? `<input type="hidden" name="parent" value="${esc(parent)}">` : ''}
        <label>${label} <small>(public, ${forge ? `on ${esc(name)} as you` : 'from your account'})</small><textarea name="${kind}" rows="${kind === 'reply' ? 3 : 2}" maxlength="3000" required${hint ? ` placeholder="${hint}…"` : ''}>${esc(text)}</textarea></label>
        ${send}
      </form>`;
  };
  function talkBox(it){
    const all = it.comments, list = all ? threads(all, it.uri) : null, forge = talksOn(it), name = forge && FORGE_SAID[forge];
    const replyTo = S.reply && (all || []).find(c => c.uri === S.reply);
    const href = forge && !it.example ? safeHttp(describeSubject(it.value?.subject)?.href) : null;
    const issue = href ? `<a class="rs-link" href="${esc(href)}" target="_blank" rel="noopener">the issue on ${esc(name)}</a>` : `the issue on ${esc(name)}`;
    const where = !forge ? '' : `<p class="rs-talk-where">${forgeIco(forge)}<span>${it.talk && !it.talk.read ? `${esc(name)} didn’t answer, so the comments on ${issue} aren’t showing.`
      : `These are the comments on ${issue}.${it.talk?.more ? ` There are more there than ${esc(name)} listed.` : ''} What you write here is posted there.`}</span></p>`;
    const body = !list ? '<p class="rs-muted">Loading comments…</p>'
      : !list.length ? (forge && it.talk && !it.talk.read ? '' : `<p class="rs-muted">${forge ? 'Nobody’s commented on the issue yet.' : it.repo === viewer() ? 'Nobody’s said anything yet. Questions from people thinking of helping show up here.' : 'Nobody’s said anything yet.'}</p>`)
        : `<ol class="rs-comments">${list.map(t => {
          const here = replyTo && (replyTo.uri === t.uri || t.replies.some(r => r.uri === replyTo.uri));
          return `<li class="rs-thread"><ol class="rs-people rs-comment-list">${commentLi(t, it, { forge })}</ol>
            ${t.replies.length ? `<ol class="rs-people rs-comment-list rs-replies">${t.replies.map(r => commentLi(r, it, { reply: true, forge })).join('')}</ol>` : ''}
            ${here ? `<div class="rs-replyform">${commentForm('reply', it, { parent: replyTo.uri, to: replyTo, forge })}</div>` : ''}</li>`;
        }).join('')}</ol>`;
    const write = !list ? '' : signedIn() ? commentForm('comment', it, { forge })
      : host.signIn ? `<div class="rs-row"><button class="rs-btn rs-quiet rs-sm" type="button" data-rs-act="signin">Sign in to comment</button></div>` : '';
    const about = forge
      ? `These are the comments on the issue, read from ${esc(name)}. One you write here is posted on the issue, as you, where anyone can read it, and it’s changed or deleted there. Who wrote each one is what ${esc(name)} says. You won’t see comments from people you block on Bluesky.`
      : 'Each comment is a record in its writer’s own account, pointing at this ask. Anyone who can see the ask can read them. Only whoever wrote one can delete it, and you won’t see comments from people you block on Bluesky.';
    return `<section class="rs-talk" id="comments" aria-labelledby="rsTalkH"><div class="rs-hrow"><h2 id="rsTalkH">Comments${list?.length ? ` <span class="rs-count">${list.reduce((n, t) => n + 1 + t.replies.length, 0)}</span>` : ''}</h2>${tip(about)}</div>${where}${body}${write}</section>`;
  }
  async function submitComment(form){
    // (What's in the other form is kept: posting this one redraws the page.)
    stash();
    const kind = form.dataset.rsForm, it = S.seed, fd = new FormData(form), text = String(fd.get(kind) || '').trim(), btn = form.querySelector('[type=submit]');
    if (!it || !text) return;
    const forge = talksOn(it), parentUri = kind === 'reply' ? String(fd.get('parent') || '') : '';
    const parent = parentUri ? (it.comments || []).find(c => c.uri === parentUri) : null;
    if (parentUri && !parent) { toast('That comment has gone.'); S.reply = null; rerender(); return; }
    if (btn) btn.disabled = true;
    try {
      const c = await S.source.comment(it, { text, parent });
      S.drafts[kind] = null; if (kind === 'reply') S.reply = null;
      S.seed = await reread(it);
      toast(!forge ? (parent ? 'Replied' : 'Posted') : c?.attested === false ? `Posted on ${FORGE_SAID[forge]}. It may show as unverified there for a while.` : `Posted on ${FORGE_SAID[forge]}`);
      render();
      root.querySelector('#' + commentKey(c))?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
      // Your server said this sign-in doesn't allow it: offer to connect, with what you wrote kept.
      if (e?.name === 'NotConnected') { S.unlinked = e.forge || forge; rerender(); }
      toast(plainText(e)); if (btn) btn.disabled = false;
    }
  }
  async function uncomment(uri, el){
    const it = S.seed, c = (it?.comments || []).find(x => x.uri === uri);
    if (!c || !confirm('Delete your comment? This removes the record from your account. Any replies to it stay.')) return;
    if (el) el.disabled = true;
    try { await S.source.uncomment(it, c); S.seed = await reread(it); toast('Deleted'); render(); }
    catch (e) { toast(plainText(e)); if (el) el.disabled = false; }
  }

  // Turning it in: the pull request's link (or, for an idea, where it lives). On knotless and
  // Tangled the pull request can instead be opened from here, from a branch that's pushed.
  function turnInBox(it, { v, d, page, st, taken, setup }){
    const sq = it.value || {}, forge = !st.idea && writableForge(sq.subject) && signedIn() && S.source?.forgePull ? writableForge(sq.subject) : null;
    const opening = !!forge && !!S.open.pull, more = !!(S.open['turnin-more'] || v.sessionUrl || v.note);
    const modes = forge ? `<div class="rs-hrow">${seg('turn', [['link', 'Paste its link'], ['open', 'Open it from here']], opening ? 'open' : 'link')}${tip(`From a branch that’s already pushed: Rainshare opens the pull request on ${esc(FORGE_SAID[forge])} as you, where anyone can read it, and turns it in here.`, 'About opening it from here')}</div>` : '';
    const showWays = S.launch ? '' : '<button class="rs-link" type="button" data-rs-act="show-launch">Show the commands</button>';
    return `<section class="rs-turn" aria-labelledby="rsTurnH"><h3 id="rsTurnH">Turn it in</h3>${modes}
      ${opening ? pullBox(it, { d, page }) + (showWays ? `<div class="rs-row">${showWays}</div>` : '') : `<form class="rs-form rs-turnin" data-rs-form="turnin">
        <label>${st.idea ? 'Where it lives <small>(a link)</small>' : 'Pull request link'}<input name="url" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" pattern="\\s*(https?://|at://)\\S+\\s*" title="${st.idea ? 'A link to where it lives' : 'A link to the pull request, or its at:// address'}" placeholder="${st.idea ? 'https://…' : { tangled: 'https://tangled.org/…/pulls/…', knotless: 'at://…/dev.knotless.pull/… or its page' }[d?.forge] || 'https://github.com/…/pull/…'}" value="${esc(v.url || '')}" required></label>
        <div class="rs-more-body"${more ? '' : ' hidden'} data-rs-turnin-more>
          <div class="rs-two"><label>What did the work<select name="harness">${HARNESSES.map(([k, l]) => `<option value="${k}"${(v.harness || taken?.value?.setup?.harness || setup?.harness) === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
          <label>Model<input name="model" list="rsModels" value="${esc(v.model || taken?.value?.setup?.models?.[0] || setup?.models?.[0] || '')}" placeholder="claude-opus-5-5"></label></div>
          <label>Session link <small>(optional)</small><input name="sessionUrl" type="url" value="${esc(v.sessionUrl || '')}"></label>
          <label>A note <small>(optional)</small><input name="note" maxlength="300" value="${esc(v.note || '')}"></label>
        </div>
        <div class="rs-row"><button class="rs-btn rs-primary" type="submit">Turn it in</button>${more ? '' : `<button class="rs-link" type="button" data-rs-act="turnin-more">${ico('plus')}Add a note or details</button>`}${showWays}</div>
      </form>`}
    </section>`;
  }

  // The ask in full. A long one starts folded to its first few lines, with its size beside the
  // button that unfolds it: the whole text stays on the page, for screen readers and find-in-page.
  function askBody(sq, uri){
    const spec = `<div class="rs-spec">${sq.spec ? renderMarkdown(sq.spec) : '<p class="rs-muted">No details beyond the title.</p>'}${safeHttp(sq.specUrl) ? `<p><a href="${esc(safeHttp(sq.specUrl))}" target="_blank" rel="noopener nofollow">The longer spec</a></p>` : ''}</div>`;
    const size = askSizeText(sq.spec);
    if (!size) return spec;
    const open = S.open.ask === uri;
    return `<div class="rs-clamp" id="rsAskBody"${open ? '' : ' data-rs-folded'}>${spec}</div>
      <div class="rs-row rs-clamp-row"><button class="rs-btn rs-quiet rs-sm" type="button" data-rs-act="ask-fold" aria-expanded="${open}" aria-controls="rsAskBody">${open ? 'Show less' : 'Show more'}</button><small class="rs-muted">${esc(size)}</small></div>`;
  }
  function renderSeed(){
    if (S.seedErr) { title('Nothing here'); return nothingHere(plain(S.seedErr), S.seedErr.who ? a('profile/' + S.seedErr.who, 'See who asked', 'rs-btn rs-quiet') : ''); }
    const it = S.seed;
    if (!it) return newHere() + back() + seedSk();
    const sq = it.value || {}, p = it.author || {}, mine = it.repo === viewer(), taken = myTake(it), d = describeSubject(sq.subject), clone = cloneUrlOf(sq.subject);
    const page = pageOf(it), open = isOpen(it), issue = it.issue, st = stand(it), forge = FORGE_NAMES[d?.forge] || 'the forge';
    // Hidden by Rainshare (../core/moderation.js): only whoever asked, and @rainshare.dev, see what it says.
    const hid = it.hidden || null;
    if (hid && !mine && !moderating()) { title('Hidden'); return nothingHere(`Rainshare has hidden this ${esc(nounOf(sq))}, so it isn’t shown here. ${esc(reasonLine(hid))}.`); }
    const hidWhat = hid && isAccount(hid.subject) ? (mine ? 'everything you post here' : 'everything this account posts') : `this ${nounOf(sq)}`;
    title(sq.title);
    const f = !mine && open && signedIn() && !taken ? fit(it, me()) : null;
    // An idea has nowhere to live yet. Whose it'll be is said plainly, and whoever picks it up
    // is a click from the page that makes a repo, on whichever forge they use.
    const pulls = d && !it.example ? safeHttp(placesFor(sq.subject).pulls) : null;
    const startOn = `<span class="rs-row rs-where-links"><span class="rs-muted">Start a repo on</span>${newRepoPlaces({ title: sq.title, about: askExcerpt(sq.spec) }).map(pl => `<a class="rs-link" href="${esc(pl.href)}" target="_blank" rel="noopener">${esc(pl.name)}</a>`).join('')}</span>`;
    const where = !d ? `${sq.owner === 'helper' ? `No repo yet. Whoever builds it keeps it${mine ? '' : ', in a repo of their own'}.`
        : sq.owner === 'requester' ? `No repo yet. ${mine ? 'You’d' : esc(firstName(p)) + ' would'} like one started${mine ? '' : ' for them'}: ${mine ? 'a helper will ask where it should live' : 'ask where it should live'}.`
          : 'No repo yet. A helper can start one, or suggest where it should live.'}${open ? startOn : ''}`
      : `${esc(whereText(sq))}${issue?.title ? `<br><span class="rs-muted">“${esc(issue.title)}”${issue.state ? `, ${esc(issue.state)}` : ''}</span>` : ''}
        <span class="rs-row rs-where-links">${d.href && !it.example ? `<a class="rs-link" href="${esc(d.href)}" target="_blank" rel="noopener">Open on ${esc(FORGE_NAMES[d.forge] || 'the forge')}</a>` : ''}${pulls ? `<a class="rs-link" href="${esc(pulls)}" target="_blank" rel="noopener">Its pull requests</a>` : ''}${clone ? `<button class="rs-link" type="button" data-rs-copy-text="${esc('git clone ' + sh(clone))}">Copy the clone command</button>` : ''}</span>`;
    const facts = [
      ['Where', where],
      ['The job', esc(jobAndNotes(sq))],
      ['Models', esc(modelsText(sq, mine ? null : S.mine?.merged))],
      sq.tags?.length ? ['Tagged', esc(join(sq.tags))] : null,
      FEATURES.seedValues && sq.values?.length ? ['Stands for', esc(join(sq.values.map(pretty)))] : null,
      FEATURES.audience || it.space ? ['Who it’s for', esc(audienceLine(sq, { authorName: mine ? 'you' : firstName(p), groupName: it.group?.name })) + (it.space ? '. Only the group’s members can read it.' : '.')] : null
    ].filter(Boolean);
    // Pull requests on the forge that mention this and weren't turned in here. A helper whose
    // agent opened one can turn it in from the list.
    const canClaim = open && !mine && signedIn();
    const linked = st.linked.map(pr => `<li><div><span><a class="rs-link" href="${esc(safeHttp(pr.url) || '')}" target="_blank" rel="noopener nofollow">${ico('link')}${pr.number ? `#${esc(pr.number)} ` : ''}${esc(pr.title || 'A pull request')}</a></span>
      <small>${esc([pr.by && `By @${pr.by}`, { merged: 'Merged', open: 'Open', closed: 'Closed without merging' }[pr.state], 'mentions this, but hasn’t been turned in here'].filter(Boolean).join(' · '))}</small>
      ${canClaim && pr.state !== 'closed' ? `<div class="rs-row"><button class="rs-btn rs-quiet rs-sm" type="button" data-rs-claim="${esc(pr.url)}">It’s mine: turn it in</button></div>` : ''}</div></li>`).join('');
    const setup = mySetup();
    // An agent handed back a pull request for this one (see readHandBack): it goes straight to the turn-in form.
    // ...or a branch it pushed, where the pull request can be opened from here (see readBranchBack).
    const branchBack = S.handKind === 'branch' && !!writableForge(sq.subject);
    const handed = open && !mine && S.handBack === it.uri && (S.handKind !== 'branch' || branchBack);
    let actions = '';
    if (mine) {
      // Whoever asked does what's next in the card at the top (progressBlock). The rest is under ⋯.
    } else if (hid) {
      // Nothing to take on: it's hidden.
    } else if (!signedIn()) {
      actions = `${handed ? `<p class="rs-note">${lifeIco('up')}<span>${branchBack ? 'A branch is ready. Sign in and the pull request will be waiting, written out for you to look over.' : `${st.idea ? 'It’s' : 'A pull request is'} ready to turn in. Sign in and it’ll be waiting in the form.`}</span></p>` : open ? heedNote(it, st) : ''}
        <div class="rs-row">${host.signIn ? `<button class="rs-btn rs-primary" type="button" data-rs-act="signin">${handed ? (branchBack ? 'Sign in to open the pull request' : 'Sign in to turn it in') : 'Sign in to take it on'}</button>` : ''}${shareBtn(it)}</div>`;
    } else if (!open) {
      actions = `<p class="rs-muted">${sq.state === 'sprouted' ? 'It’s done, so there’s nothing left to take on.' : 'It’s closed, so there’s nothing to take on.'}</p>`;
    } else if (!taken && !handed) {
      // Copied without saying you're on it (./send.js): the commands are open, and saying so is a press away.
      const copied = S.launch ? `<p class="rs-note">${ico('info')}<span>Nobody’s been told you’re on it. If you start, say so, so nobody does it twice.</span><button class="rs-btn rs-primary rs-sm" type="button" data-rs-act="claim">I’m on it</button></p>${renderLaunch(it)}` : '';
      actions = `${heedNote(it, st)}${copied}<div class="rs-row"><button class="rs-btn ${st.clear && !S.launch ? 'rs-primary rs-big' : 'rs-quiet'}" type="button" data-rs-act="take">${ico('drop')}${st.clear ? 'Send my agent' : 'Send my agent anyway'}</button>${shareBtn(it)}</div>${sendHint(it)}`;
    } else {
      const v = S.drafts.turnIn || {};
      // Once it's turned in, the form steps aside: what's left is the planter's to do.
      const sent = (it.deliveries || []).some(dl => dl.repo === viewer()), form = !sent || handed || S.again === it.uri;
      const dropBtn = taken ? '<button class="rs-link" type="button" data-rs-act="drop">Drop it</button>' : '';
      actions = `${sent ? `<p class="rs-note${st.deliveries.some(x => x.mine && x.state !== 'closed') ? ' rs-on' : ''}">${ico('check')}<span>${esc(st.yours ? st.advice : 'You’ve turned it in.')}</span>${dropBtn}</p>`
        // Your take holds it until the day you gave (../core/takes.js). Once that's passed, it shows as free again, and you can take more time.
        : taken && lapsed(taken, it) ? `<p class="rs-note rs-heed">${ico('info')}<span>${taken.value?.until ? `You said you’d turn it in by ${esc(dayOf(dueOf(taken)))}` : 'It’s been over a week'}, so it shows as free again. Still on it?</span><button class="rs-btn rs-primary rs-sm" type="button" data-rs-act="more-time">${esc(moreLabel())}</button>${dropBtn}</p>${heedNote(it, st)}`
        : taken ? `<p class="rs-note rs-on">${ico('check')}<span>You’re on it${taken.value?.setup ? ` with ${esc(setupText(taken.value.setup))}` : ''}${taken.value?.until ? `, until ${esc(dayOf(dueOf(taken)))}` : ''}. ${st.idea ? 'When there’s something to show, turn in where it lives.' : 'When the pull request is up, turn it in.'}</span><button class="rs-link" type="button" data-rs-act="more-time">More time</button>${dropBtn}</p>${heedNote(it, st)}`
          : branchBack ? `<p class="rs-note rs-on">${lifeIco('up')}<span>A branch is ready. Look over the pull request below and send it: that opens it on ${esc(forge)}, turns it in, and tells ${esc(firstName(p))} you took this on.</span></p>`
            : `<p class="rs-note rs-on">${lifeIco('up')}<span>${st.idea ? 'It’s' : 'A pull request is'} ready to turn in. Look it over and send it. That also tells ${esc(firstName(p))} you took this on.</span></p>`}
        ${S.launch ? renderLaunch(it) : ''}
        ${!form ? '<div class="rs-row"><button class="rs-link" type="button" data-rs-act="again">Turn in another pull request</button></div>' : turnInBox(it, { v, d, page, st, taken, setup })}`;
    }
    return `${newHere(open && !mine ? `This one is ${firstName(p)}’s.` : '')}${back()}
      <article class="rs-seed">
        <div class="rs-seed-main">
          ${hid ? hiddenNote(hid, { whose: mine ? 'yours' : null, what: hidWhat }) : ''}
          <div class="rs-seed-head">
            <div class="rs-detail-top">${a('profile/' + it.repo, face(p) + `<b>${esc(mine ? 'You' : nameOf(p))}</b>`, 'rs-who')}${hat(it.repo)}<span class="rs-muted">${mine ? '' : ' · ' + (it.space ? ico('lock') : '') + esc(relationText(it, viewer()) || 'open to everyone')} · ${esc(ago(sq.createdAt))}</span>${mine ? ownerMenu(it, { open, d }) : ''}</div>
            <div class="rs-seed-title"><h1>${esc(sq.title)}</h1>
              <p class="rs-muted"><span class="rs-stage-name">${esc(whatItIs(sq).name)}</span> · ${esc(whatItIs(sq).note)}</p></div>
            ${plantPic(pictureOf(sq), 128, { live: true, key: it.uri })}
          </div>
          ${progressBlock(it, { full: true, own: mine ? st : null })}
          ${f ? fitBox(f) : ''}
          <dl class="rs-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
          <section class="rs-ask-full"><div class="rs-ask-head"><h2>The ask</h2>${hid ? '' : mdBtn(it, 'rs-quiet rs-sm')}</div>
            ${askBody(sq, it.uri)}</section>
          ${open && !hid ? cautionNote(it) : ''}
          ${actions ? `<div class="rs-actions">${actions}</div>` : ''}
          ${linked ? `<h2>Also on ${esc(forge)}</h2><ul class="rs-people rs-deliveries rs-linked">${linked}</ul>` : ''}
          ${talkBox(it)}
        </div>
        <aside class="rs-seed-side">
          ${moderating() && !hid && !it.example && !it.space ? `<div class="rs-panel rs-mod-panel"><h2>${ico('shield')}Moderation</h2>
            <div class="rs-row">${hideBtn(it.uri, 'Hide this ' + nounOf(sq))}${mine ? '' : hideBtn('at://' + it.repo, 'Hide everything from them', 'spam')}</div>
            ${hideForm(it.uri, 'this ' + nounOf(sq))}${hideForm('at://' + it.repo, 'everything from ' + nameOf(p))}</div>` : ''}
          <div class="rs-panel${mine ? ' rs-own-panel' : ''}"><h2>${esc(mine ? 'Your profile' : 'About ' + firstName(p))}</h2>${mine ? '' : tiesList(it.repo, it.ties, p)}${profileCard(it.profile, p, { compact: true })}${a('profile/' + it.repo, mine ? 'See your profile' : 'See their profile', 'rs-link')}</div>
          <p class="rs-hood">${tipLink('The records behind this', `<span class="rs-tip-p">${it.space ? `It’s a record in ${esc(nameOf(p))}’s repo, inside ${esc(it.group?.name || 'the group')}’s Rainshare space, readable only by members.` : `It’s a record in ${esc(nameOf(p))}’s own repo, on their own server. Anyone can read it; apps show it to the people it’s meant for.`}</span><span class="rs-tip-p"><code>${esc(it.uri)}</code></span><span class="rs-tip-p">Each helper’s take and delivery records, and everyone’s comments, live in their own repo, pointing here.</span>`)}</p>
        </aside>
      </article>`;
  }

  /* ---------- your profile ---------- */
  function renderMe(){
    if (!signedIn()) return needSignIn('Sign in to set up your profile.');
    if (!S.mine) return back() + meSk();
    // "Only my groups" exists only where there are groups to share with (GROUPS in ../core/ns.js).
    const priv = !!S.source.canPrivate;
    const p = S.form?.profile || structuredClone(S.mine.merged || {}), hidden = !priv ? [] : S.form?.hidden || (S.mine.merged ? S.mine.hidden : ['budget', 'circumstances']);
    const groups = S.form?.groups ?? null, share = S.form?.share || S.mine.groups.map(g => g.did);
    S.form = { ...S.form, profile: p, hidden, groups, share };
    const setups = p.setups?.length ? p.setups : [{ harness: 'claude-code', models: [] }];
    const fc = p.forecast || {}, raining = !!fc.level && fc.level !== 'dry';
    // An older profile has no plans: what it said with its budget starts them off, and a plan it typed is shown.
    const typedPlans = [...new Set((p.setups || []).map(x => x.plan).filter(Boolean))];
    const bsky = S.mine.bluesky || S.mine.person || {};
    // "Help the right people find you" folds away your situation, values and who you'd help first: only while one of them is on.
    const folded = FEATURES.circumstances || FEATURES.values || FEATURES.priorities;
    const plansNow = plansIn(p).length ? plansIn(p) : { none: ['none'], free: ['free'] }[p.budget] || [];
    const visSel = field => !priv ? '' : `<div class="rs-vis"><select data-rs-vis="${field}" aria-label="Who sees this"><option value="public"${!hidden.includes(field) ? ' selected' : ''}>Everyone sees this</option><option value="private"${hidden.includes(field) ? ' selected' : ''}>Only my groups</option></select></div>`;
    const withBoard = (groups || []).filter(g => g.space);
    return `${back()}
      <div class="rs-me-wrap">
      <form class="rs-form rs-me" data-rs-form="me">
        <div class="rs-hrow"><h1>Your profile</h1>${tip('What people see about you. All of it is optional, and it’s saved in your own account.', 'About your profile')}</div>
        <fieldset><legend>You ${tip('Your name, picture and bio come from your Bluesky profile. Fill these in only if you’d like Rainshare to show something different.')}</legend>
          <label>Name <small>(optional)</small><input name="displayName" maxlength="64" autocomplete="off" placeholder="${esc(bsky.displayName || (bsky.handle ? '@' + bsky.handle : 'Your name'))}" value="${esc(p.displayName || '')}"></label>
          <label>About you <small>(optional)</small><textarea name="bio" rows="2" maxlength="300" placeholder="${esc(bsky.description || 'What you’re building, what you’re into')}">${esc(p.bio || '')}</textarea></label>
        </fieldset>
        <fieldset><legend>Your AI plan ${tip('What you pay for to code with AI, if anything. It’s the first thing people see about you, on your profile and beside your asks. Pick as many as you have.')}</legend>
          ${toggles('plans', PLANS, plansNow)}
          ${!p.plans?.length && typedPlans.length ? `<p class="rs-muted">You’d written “${esc(typedPlans.join('”, “'))}”. Pick the closest.</p>` : ''}
        </fieldset>
        <fieldset><legend>What you run ${tip('So people know what your agent can do, and “Send my agent” copies the right command.')}</legend>
          <ol class="rs-setups">${setups.map((s, i) => `<li data-setup="${i}">
            <label>Harness<select name="harness">${HARNESSES.map(([k, l]) => `<option value="${k}"${s.harness === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
            <label>Models<input name="models" list="rsModels" value="${esc((s.models || []).join(', '))}" placeholder="claude-opus-5-5"></label>
            <label>Runs<select name="runsOn"><option value="">—</option>${RUNS_ON.map(([k, l]) => `<option value="${k}"${s.runsOn === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
            ${setups.length > 1 ? `<button class="rs-link" type="button" data-rs-remove-setup="${i}">Remove</button>` : ''}</li>`).join('')}</ol>
          ${setups.length < 6 ? `<button class="rs-link" type="button" data-rs-act="add-setup">${ico('plus')}Add another setup</button>` : ''}
        </fieldset>
        ${!FEATURES.forecast ? '' : `<fieldset><legend>Your forecast ${tip('How much your agent has to spare right now, so people know when to ask.')}</legend>
          ${seg('forecast', FORECAST.map(f => [f[0], f[1]]), fc.level || '')}
          <p class="rs-muted">${esc(FORECAST.find(f => f[0] === fc.level)?.[2] || 'Pick one when you have rain to spare.')}</p>
          ${raining ? `<div class="rs-two"><label>Until <small>(often when your plan resets)</small><input name="until" type="date" value="${esc(fc.until ? fc.until.slice(0, 10) : '')}"></label>
          <label>With <small>(models)</small><input name="fcModels" list="rsModels" value="${esc((fc.models || []).join(', '))}"></label></div>
          <label>A note <small>(optional)</small><input name="fcNote" maxlength="300" value="${esc(fc.note || '')}" placeholder="Send me your gnarly ones"></label>` : ''}
        </fieldset>`}
        ${folded ? `
        ${S.open['me-more'] ? '' : `<button class="rs-link" type="button" data-rs-act="me-more">${ico('plus')}Help the right people find you</button>`}
          <div class="rs-more-body"${S.open['me-more'] ? '' : ' hidden'} data-rs-me-more>
            <div class="rs-hrow"><h2>Help the right people find you</h2>${tip(`${FEATURES.priorities ? 'Some helpers look first for students, people without big AI plans, or projects they care about.' : 'So whoever looks at your asks knows who they’d be helping.'} ${priv ? 'Anything marked “only my groups” goes only into your groups’ private spaces.' : 'Everyone can see what you share here.'}`)}</div>
            ${FEATURES.circumstances ? `<fieldset><legend>About your situation <small>(optional)</small></legend>
              ${toggles('circumstances', CIRCUMSTANCES, p.circumstances)}
              ${visSel('circumstances')}
            </fieldset>` : ''}
            ${FEATURES.values ? `<fieldset><legend>What you care about</legend>
              ${toggles('values', [...new Set([...VALUES, ...(p.values || [])])].map(v => [v, v]), p.values)}
              <label>Add your own <small>(comma separated)</small><input name="moreValues" placeholder="birding, zines"></label>
            </fieldset>` : ''}
            ${FEATURES.priorities ? `<fieldset><legend>Who you’d like to help first ${tip('When you have rain to spare, these rise to the top of your board.')}</legend>
              ${toggles('priorities', PRIORITIES, p.priorities)}
            </fieldset>` : ''}
            <label>Work you’re happy to take on <small>(comma separated)</small><input name="offering" value="${esc((p.offering || []).join(', '))}" placeholder="rust, css, docs, testing"></label>
          </div>
        ` : `<label>Work you’re happy to take on <small>(comma separated)</small><input name="offering" value="${esc((p.offering || []).join(', '))}" placeholder="rust, css, docs, testing"></label>`}
        ${priv ? `<fieldset><legend>Your groups</legend>
          ${groups === null ? '<p class="rs-muted">Finding your groups…</p>' : withBoard.length ? `<p class="rs-muted">Your full profile, including anything marked “only my groups”, goes into these groups’ private Rainshare spaces.</p>
            <div class="rs-toggles" data-rs-toggles="share">${withBoard.map(g => `<button type="button" data-v="${esc(g.did)}" aria-pressed="${share.includes(g.did)}">${ico('lock')}${esc(g.name)}</button>`).join('')}</div>`
            : '<p class="rs-muted">None of your groups has Rainshare yet, so anything marked “only my groups” stays unshared for now.</p>'}
        </fieldset>` : ''}
        <div class="rs-row rs-sticky"><button class="rs-btn rs-primary" type="submit">Save my profile</button>${S.source.demo && S.source.reset ? '<button class="rs-link" type="button" data-rs-act="reset-demo">Start the example over</button>' : ''}</div>
        <p class="rs-err" hidden></p>
      </form>
      <aside class="rs-me-side">
        ${sendSettings()}
        ${S.source.gardenOf ? `<section class="rs-mygarden"><h2>What you’ve helped with</h2>${gardenBlock(S.garden, 'You')}</section>` : ''}
        ${a('profile/' + viewer(), 'See your profile as others do', 'rs-link')}
      </aside>
      </div>`;
  }
  // Your settings for "Send my agent" (./send.js), beside your profile: they aren't about you, so they're saved on their own.
  function sendSettings(){
    const p = { route: 'brief', claim: true, days: TAKE_DAYS_DEFAULT, askEachTime: true, ...(S.prefs?.send || {}) };
    if (!S.prefs?.send?.route) p.route = { 'claude-code': 'claude', codex: 'codex' }[mySetup()?.harness] || 'brief';
    return `<section class="rs-panel rs-mysend"><div class="rs-hrow"><h2>When you send your agent</h2>${tip('What “Send my agent” starts with. Where a way doesn’t suit an ask (the cloud needs a GitHub repo, say), the brief is used instead.')}</div>
      <form class="rs-prefs" data-rs-form="prefs">
        <label>Send it as<select name="route">${ROUTES.map(([k, l]) => `<option value="${k}"${p.route === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label class="rs-check"><input type="checkbox" name="claim"${p.claim ? ' checked' : ''}> Say I’m on it</label>
        <label>Turned in within<select name="days">${dayChoices(p.days).map(([d, l]) => `<option value="${d}"${p.days === d ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label class="rs-check"><input type="checkbox" name="ask"${p.askEachTime ? ' checked' : ''}> Ask me each time</label>
        ${S.prefsLocal ? `<p class="rs-muted">${ico('lock')} Saved in this browser only, because your sign-in is from before Rainshare had settings. Sign out and in again to keep them in your account.</p>` : ''}
        <button class="rs-btn rs-quiet rs-sm" type="submit">Save</button>
      </form>
    </section>`;
  }
  async function submitPrefs(form){
    const fd = new FormData(form), btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    const r = await savePrefs({ route: String(fd.get('route') || 'brief'), claim: !!fd.get('claim'), days: +fd.get('days') || TAKE_DAYS_DEFAULT, askEachTime: !!fd.get('ask') });
    toast(r === 'saved' ? 'Saved' : 'Saved in this browser');
    rerender();
  }
  // Read the profile form back into S.form.profile (selects, inputs and toggles).
  function readMe(form){
    const p = S.form.profile, fd = new FormData(form), shows = sel => !!form.querySelector(sel);
    const on = name => [...form.querySelectorAll(`[data-rs-toggles="${name}"] [aria-pressed="true"]`)].map(b => b.dataset.v);
    p.bio = fd.get('bio');
    p.displayName = fd.get('displayName') ?? p.displayName;
    if (shows('[data-rs-toggles="plans"]')) p.plans = on('plans');
    // A plan typed into a setup before there were plans to pick stays in the record.
    const before = p.setups || [];
    p.setups = [...form.querySelectorAll('[data-setup]')].map((li, i) => ({
      harness: li.querySelector('[name=harness]').value, models: li.querySelector('[name=models]').value.split(',').map(s => s.trim()).filter(Boolean),
      plan: li.querySelector('[name=plan]')?.value ?? before[i]?.plan, runsOn: li.querySelector('[name=runsOn]').value || undefined
    }));
    if (shows('[data-rs-seg="forecast"]')) readForecast(form, p, fd);
    if (shows('[data-rs-seg="budget"]')) p.budget = form.querySelector('[data-rs-seg="budget"] [aria-pressed="true"]')?.dataset.v || undefined;
    if (shows('[data-rs-toggles="circumstances"]')) p.circumstances = on('circumstances');
    if (shows('[data-rs-toggles="values"]')) p.values = [...on('values'), ...String(fd.get('moreValues') || '').split(',').map(s => s.trim()).filter(Boolean)];
    if (shows('[data-rs-toggles="priorities"]')) p.priorities = on('priorities');
    p.offering = String(fd.get('offering') || '').split(',').map(s => s.trim()).filter(Boolean);
    S.form.hidden = [...form.querySelectorAll('[data-rs-vis]')].filter(s => s.value === 'private').map(s => s.dataset.rsVis);
    if (form.querySelector('[data-rs-toggles="share"]')) S.form.share = on('share');
  }
  function readForecast(form, p, fd){
    const level = form.querySelector('[data-rs-seg="forecast"] [aria-pressed="true"]')?.dataset.v;
    // Until, with and the note show only once it's raining; off screen, they keep what they had.
    const was = p.forecast || {}, shown = !!form.querySelector('[name="fcModels"]');
    p.forecast = level ? !shown ? { ...was, level } : { level, until: fd.get('until') ? new Date(fd.get('until') + 'T23:59:00').toISOString() : undefined, models: String(fd.get('fcModels') || '').split(',').map(s => s.trim()).filter(Boolean), note: fd.get('fcNote') } : undefined;
  }

  /* ---------- someone's profile ---------- */
  async function loadPerson(sub){
    S.other = null;
    const who = decode(sub.slice('profile/'.length));
    try {
      const did = who.startsWith('did:') ? who : await resolveHandle(who);
      S.other = await S.source.profileOf(did);
      S.other.did = did;
      // A vouch that was being written when you went off to connect Tangled is waiting where you left it.
      const kept = takeKept(); if (kept?.vouching?.did === did) S.vouching = kept.vouching;
      const person = S.other;
      S.source.gardenOf?.(did).then(g => { person.garden = g; if (S.other === person && S.view === 'person') render(); }, () => { person.garden = []; });
    } catch (e) {
      // A handle that picked up a full stop or a capital on the way here is looked up again without it.
      const meant = reroute(sub);
      if (meant && meant !== sub && known(meant) && S.sub === sub) return go(meant, { replace: true });
      S.other = { error: e };
    }
    if (S.view === 'person') render();
    loadBoard();
  }
  function renderPerson(){
    const o = S.other;
    if (!o) return newHere() + back() + personSk();
    if (o.error) title('Nothing here');
    if (o.error) return nothingHere('We couldn’t find that person. The link may have been cut short, or their handle has changed.');
    const p = o.person || {}, theirs = (S.board?.items || []).filter(it => it.repo === o.did);
    // What they've said they're on, or turned something in for, that's still open: someone else's asks.
    const helping = (S.board?.items || []).filter(it => isOpen(it) && it.repo !== o.did && [...activeTakes(it), ...(it.deliveries || [])].some(r => r.repo === o.did));
    title(nameOf(p));
    // Hidden by Rainshare: an account, everything it writes; or just its Rainshare name and bio.
    const mod = o.moderated, self = o.did === viewer(), whole = !!mod && isAccount(mod.subject);
    const hidWhat = !mod ? '' : whole ? (self ? 'everything you post here' : 'everything this account posts here') : (self ? 'your Rainshare name and bio' : 'this account’s Rainshare name and bio');
    if (whole && !self && !moderating()) return `${back()}<section class="rs-person"><header>${face(p, 'lg')}<div><h1>${esc(nameOf(p))}</h1></div></header>${hiddenNote(mod, { what: hidWhat })}</section>`;
    const modPanel = moderating() && !mod && !self ? `<div class="rs-panel rs-mod-panel"><h2>${ico('shield')}Moderation</h2>
      <div class="rs-row">${hideBtn('at://' + o.did, 'Hide everything from them', 'spam')}${o.public ? hideBtn(`at://${o.did}/${PROFILE}/self`, 'Hide their Rainshare name and bio', 'abuse') : ''}</div>
      ${hideForm('at://' + o.did, 'everything from ' + nameOf(p))}${hideForm(`at://${o.did}/${PROFILE}/self`, 'their Rainshare name and bio')}</div>` : '';
    return `${newHere()}${back()}
      <section class="rs-person">
        <header>${face(p, 'lg')}<div><h1>${esc(nameOf(p))}${hat(o.did)}</h1>${p.handle ? `<a class="rs-link" href="https://bsky.app/profile/${esc(p.handle)}" target="_blank" rel="noopener">@${esc(p.handle)}</a>` : ''}</div>${o.did === viewer() ? a('me', 'Edit', 'rs-btn rs-quiet rs-sm') : ''}</header>
        ${mod && (self || moderating()) ? hiddenNote(mod, { whose: self ? 'yours' : null, what: hidWhat }) : ''}
        ${modPanel}
        <div class="rs-panel">${profileCard(o.merged, p)}${o.groups?.length && o.did !== viewer() ? `<p class="rs-muted">${ico('lock')} Some of this is shared only with ${esc(o.groups.map(g => g.name).join(' and '))}.</p>` : ''}</div>
        ${signedIn() && o.did !== viewer() ? `<h2>You and ${esc(firstName(p))}</h2><div class="rs-panel">${tiesList(o.did, o.ties, p, { vouch: false })}</div>` : ''}
        ${vouchBlock(o.did, p)}
        ${helping.length ? `<h2>${o.did === viewer() ? 'What you’re helping with now' : `What ${esc(firstName(p))}’s helping with now`}</h2><ul class="rs-list">${helping.map(it => card(it, { nav: true })).join('')}</ul>` : ''}
        ${S.source.gardenOf ? `<h2>${o.did === viewer() ? 'What you’ve helped with' : `What ${esc(firstName(p))} has helped with`}</h2>${gardenBlock(o.garden, o.did === viewer() ? 'You' : firstName(p))}` : ''}
        <h2>${o.did === viewer() ? 'Your ideas and projects' : `${esc(firstName(p))}’s ideas and projects`}</h2>
        ${!S.board ? listSk(2, 'theirs') : theirs.length ? `<ul class="rs-list">${theirs.map(it => card(it, { nav: true })).join('')}</ul>` : '<p class="rs-muted">None that you can see.</p>'}
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
    return `${host.brand === 'rainshare' ? '' : back()}
      <div class="rs-agents">
        <header class="rs-agents-head">
          <h1>Send your agent</h1>
          <p>Paste a brief into any agent, with nothing to install. Or set up one small file, and your agent can find work, take it on and turn it in itself.</p>
        </header>
        <section class="rs-panel" aria-labelledby="rsQuick">
          <h2 id="rsQuick">${ico('copy')}With nothing set up</h2>
          <ol class="rs-steps">
            <li><h3>Press Send my agent ${tip('It asks how to hand it over (a command for Claude Code or Codex, or a brief for any agent) and whether to say you’re on it yet. It can remember your answers and stop asking: see your profile.')}</h3><p class="rs-muted">Pick how to send it, and whether to tell whoever asked that you’re on it, and for how long.</p></li>
            <li><h3>Paste it</h3><p class="rs-muted">In a terminal, or into any agent that can reach the repo.</p></li>
            <li><h3>Open the link it hands back ${tip(`<span class="rs-tip-p">On GitHub the agent opens the pull request itself. On knotless it can too, if the knotless CLI or its MCP server is set up.</span><span class="rs-tip-p">On Tangled the agent pushes a branch, and Rainshare opens the pull request as you: the agent does that itself if Rainshare’s CLI or MCP server is signed in beside it. Otherwise the link it hands back carries the branch, with the pull request written out for you to look over.</span>`, 'How the pull request gets opened')}</h3><p class="rs-muted">It turns the work in. Whoever asked marks it done once it’s merged.</p></li>
          </ol>
        </section>
        <h2 class="rs-agents-or">Or let your agent do the Rainshare side too</h2>
        <section class="rs-panel" aria-labelledby="rsSetup">
          <h2 id="rsSetup">Set up, once</h2>
          <p class="rs-muted">One file, both a CLI and an MCP server. It needs Node 18 or later.</p>
          <ol class="rs-steps">
            <li><h3>Get the file</h3>${block(INSTALL)}</li>
            <li><h3>Sign in with an app password ${tip('Make one in Bluesky under Settings, Privacy and security, App passwords (or wherever your server offers them). It’s kept in <code>~/.config/rainshare</code>, and you can revoke it any time.', 'About app passwords')}</h3>${block(`node ${CLI_HOME} login you.bsky.social`)}</li>
          </ol>
        </section>
        <div class="rs-agents-ways">
          <section class="rs-panel" aria-labelledby="rsWayCli">
            <h2 id="rsWayCli">${ico('term')}From a terminal</h2>
            <ol class="rs-steps">
              <li><h3>See what needs rain</h3>${block(`node ${CLI_HOME} board`)}</li>
              <li><h3>See where one stands ${tip('Who’s on it, what’s been turned in, and what the forge says about its issue and pull requests. No sign-in needed. <code>&lt;link&gt;</code> is its link on Rainshare.')}</h3>${block(`node ${CLI_HOME} check <link>`)}</li>
              <li><h3>Take one on ${tip('Checks first, and stops if someone got there before you. Otherwise it tells whoever asked that you’re on it, clones the repo, starts your agent with the brief, and offers to turn in the pull request when it’s up.')}</h3>${block(`node ${CLI_HOME} run <link>`)}</li>
              <li><h3>Or turn one in yourself</h3>${block(`node ${CLI_HOME} turn-in <link> --url <pull request>`)}</li>
              <li><h3>On Tangled and knotless, open the pull request too ${tip('From a branch already pushed to the repo or your fork. It opens the pull request as you, and turns it in.')}</h3>${block(`node ${CLI_HOME} open-pr <link> --branch <pushed branch>`)}</li>
            </ol>
            <p class="rs-muted"><code>node ${CLI_HOME} doctor</code> says what’s set up and what’s missing. <code>node ${CLI_HOME} help</code> lists the rest: asking for rain yourself${FEATURES.forecast ? ', closing one out, setting your forecast' : ' and closing one out'}.</p>
          </section>
          <section class="rs-panel" aria-labelledby="rsWayMcp">
            <h2 id="rsWayMcp">${ico('sky')}From inside your agent</h2>
            <ol class="rs-steps">
              <li><h3>Add Rainshare to it</h3>${seg('mcp', [['claude', 'Claude Code'], ['other', 'Another MCP client']], S.open.mcp ? 'other' : 'claude')}${block(S.open.mcp ? json : MCP_ADD)}</li>
              <li><h3>Ask it</h3>${say('What in my circle needs rain that suits my setup?')}${say('Take this one on from Rainshare and turn it in when the PR is up.')}${say('Has anything of mine had a pull request merged? Close out what’s done.')}</li>
            </ol>
          </section>
        </div>
        ${S.source?.canPrivate ? `<p class="rs-note">${ico('lock')}<span>For now the CLI and MCP server reach public ones only. Private, group-only ones are taken on from here, in the app.</span></p>` : ''}
        <section class="rs-panel rs-faq" aria-labelledby="rsAllowed">
          <h2 id="rsAllowed">Is this allowed by my AI plan?</h2>
          <p class="rs-muted">We think so, but read your plan’s terms to be sure. What the big plans rule out is sharing your account or reselling access to it (<a href="https://www.anthropic.com/legal/consumer-terms" target="_blank" rel="noopener">Anthropic</a>, <a href="https://openai.com/policies/row-terms-of-use/" target="_blank" rel="noopener">OpenAI</a>). Rainshare does neither. You run your own agent, signed in as you, and Rainshare never sees your AI sign-in. The other person gets the work: a pull request, or a repo for an idea. Nobody is paid, and you start each job yourself.</p>
          <p class="rs-muted">Your plan’s usage policy covers everything your agent does, whoever asked for it. Take on only what you’d be comfortable asking it to do for yourself.</p>
        </section>
      </div>`;
  }

  /* ---------- moderation: @rainshare.dev's page ---------- */
  // What's been hidden, read from the account's own repo, and what each decision is about, read
  // from where that lives (and filled in as it answers).
  async function loadAdmin(){
    if (!moderating()) return;
    const source = S.source, about = S.admin?.about || new Map();
    S.admin = { ...(S.admin || {}), about, loading: true, error: null };
    loadBoard();
    try {
      const list = await source.moderation.list();
      if (S.source !== source) return;
      S.admin = { list, about, loading: false, error: null };
      if (S.view === 'admin') render();
      await pool(list.filter(d => !about.has(d.subject)), 6, async d => { about.set(d.subject, await source.moderation.about(d.subject).catch(() => ({ unread: true }))); });
    } catch (e) { console.warn('rainshare moderation', e); if (S.source === source) S.admin = { list: null, about, loading: false, error: e }; }
    if (S.view === 'admin') render();
  }
  // One thing, as the moderation page shows it: who, and what it says or is called.
  function aboutLine(subject, ab){
    const kind = subjectKind(subject), p = ab?.author || { did: parseUri(subject)?.repo || subject.slice(5) }, at = parseUri(subject);
    const who = a('profile/' + p.did, `${face(p, 'xs')}<b>${esc(nameOf(p))}</b>`, 'rs-who');
    const word = { account: 'Everything from', ask: 'An ask by', comment: 'A comment by', take: 'A take by', delivery: 'Work turned in by', profile: 'The Rainshare name and bio of' }[kind] || 'A record by';
    const said = ab?.title || ab?.text ? `<p class="rs-modtext">${ab.title ? `<b>${esc(ab.title)}</b> ` : ''}${esc(askExcerpt(ab.text || '', 220))}</p>` : '';
    const link = kind === 'ask' && at ? a(`seed/${at.repo}/${at.rkey}`, 'Open it', 'rs-link') : '';
    return `<div class="rs-modwhat"><span>${esc(word)}</span>${who}${link}</div>${!ab ? '<p class="rs-muted">Looking it up…</p>' : said || (kind === 'account' ? '' : `<p class="rs-muted">${ab.gone ? 'It’s been deleted.' : 'It couldn’t be read just now.'} <code>${esc(subject)}</code></p>`)}`;
  }
  function renderAdmin(){
    if (!moderating()) return renderLost();
    title('Moderation');
    const ad = S.admin || {}, f = S.found, decided = new Map((ad.list || []).map(d => [d.subject, d]));
    // Open asks on the board that the checks flagged, the likeliest tricks first, then the newest.
    const flagged = (S.board?.items || []).filter(it => isOpen(it) && !it.hidden && !it.space)
      .map(it => ({ it, flags: concerns(it.value) })).filter(x => x.flags.length)
      .sort((x, y) => Number(alarming(y.flags)) - Number(alarming(x.flags)) || newest(x.it, y.it));
    const can = host.canModerate ? host.canModerate() : true;
    const found = !f ? '' : f.error ? `<p class="rs-err">${plain(f.error)}</p>`
      : `<div class="rs-moditem">${aboutLine(f.subject, f.about)}${decided.has(f.subject) ? `<div class="rs-row"><span class="rs-muted">Already hidden: ${esc(reasonLine(decided.get(f.subject)))}.</span>${unhideBtn(f.subject)}</div>`
        : f.about ? hideForm(f.subject, { account: 'everything from ' + nameOf(f.about.author), ask: 'this ask', comment: 'this comment' }[subjectKind(f.subject)] || 'this') : ''}</div>`;
    return `<div class="rs-admin">
      <header class="rs-admin-head"><h1>Moderation</h1>
        <p class="rs-muted">What you hide here is hidden for everyone: on the board, on its page and in its comments, from the CLI and the MCP server, and in link previews. Each decision is a public record in @${esc(HANDLE)}’s own repo, and only that repo’s count. Unhiding deletes the record.</p></header>
      ${can ? '' : `<p class="rs-note rs-bad">${ico('info')}<span>This sign-in is from before Rainshare asked to write moderation records, so hiding won’t work yet. Sign out and in again.</span></p>`}
      <section class="rs-panel" aria-labelledby="rsFindH"><h2 id="rsFindH">Hide something</h2>
        <form class="rs-form rs-hideform rs-findform" data-rs-form="hide-find">
          <label>A link or an address <small>an ask’s or a person’s page, an at:// address (a comment’s, say), or a handle</small><input name="what" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="https://rainshare.dev/seed/…" value="${esc(f?.input || '')}" required></label>
          <div class="rs-row"><button class="rs-btn rs-quiet" type="submit">Look it up</button></div>
        </form>
        ${found}
      </section>
      <section aria-labelledby="rsFlagH"><div class="rs-hrow"><h2 id="rsFlagH">Needs a look${flagged.length ? ` <span class="rs-count">${flagged.length}</span>` : ''}</h2>${tip('Open asks on the board that Rainshare’s checks flagged (core/scan.js), the likeliest tricks first. The checks are rough: they miss some tricks, and an honest ask can trip one, so read each before hiding it. Comments aren’t checked.')}</div>
        ${!S.board ? listSk(2, 'flagged') : !flagged.length ? '<p class="rs-muted">Nothing open on the board trips the checks right now.</p>'
          : `<ul class="rs-modlist">${flagged.map(({ it, flags }) => `<li class="rs-panel rs-moditem">
            <div class="rs-modwhat">${a(pathOf(it), `<b>${esc(it.value?.title)}</b>`, 'rs-link')}<span class="rs-muted">by ${esc(nameOf(it.author))} · ${esc(ago(it.value?.createdAt))}</span></div>
            <ul class="rs-flags">${flags.map(c => `<li><b>${c.level === 'high' ? 'Likely a trick' : 'Worth a look'}.</b> ${esc(c.said)} <span class="rs-muted">Found: <code>${esc(c.quote)}</code></span></li>`).join('')}</ul>
            <div class="rs-row">${hideBtn(it.uri, 'Hide this ask', flags.some(c => c.id === 'harmful') && !alarming(flags) ? 'harmful' : 'unsafe')}${hideBtn('at://' + it.repo, 'Hide everything from them', 'unsafe')}</div>
            ${S.found?.subject === it.uri ? '' : hideForm(it.uri, 'this ask')}${S.found?.subject === 'at://' + it.repo ? '' : hideForm('at://' + it.repo, 'everything from ' + nameOf(it.author))}
          </li>`).join('')}</ul>`}
      </section>
      <section aria-labelledby="rsHiddenH"><h2 id="rsHiddenH">Hidden${ad.list?.length ? ` <span class="rs-count">${ad.list.length}</span>` : ''}</h2>
        ${ad.error ? `<p class="rs-note rs-bad">${ico('info')}<span>@${esc(HANDLE)}’s server didn’t answer, so what’s hidden can’t be listed. (The board goes on hiding it.) ${plain(ad.error)}</span><button class="rs-link" type="button" data-rs-act="admin-retry">Try again</button></p>`
          : !ad.list ? listSk(2, 'hidden') : !ad.list.length ? '<p class="rs-muted">Nothing’s hidden.</p>'
          : `<ul class="rs-modlist">${ad.list.map(d => `<li class="rs-panel rs-moditem">${aboutLine(d.subject, ad.about?.get(d.subject))}
              <div class="rs-row"><span class="rs-muted">${esc(reasonLine(d))} · ${esc(ago(d.createdAt))}</span>${unhideBtn(d.subject)}</div></li>`).join('')}</ul>`}
      </section>
    </div>`;
  }
  // Looking up what was pasted, so what's about to be hidden is seen first.
  async function submitFind(form){
    const input = String(new FormData(form).get('what') || '').trim(), btn = form.querySelector('[type=submit]');
    if (!input || !moderating()) return;
    btn.disabled = true;
    S.found = { input }; S.modding = null;
    try {
      const subject = await S.source.moderation.subjectFrom(input);
      S.found = { input, subject, about: null };
      S.modding = { subject };
      render();
      const ab = await S.source.moderation.about(subject);
      if (S.found?.subject === subject) S.found.about = ab;
    } catch (e) { S.found = { input, error: e }; }
    render();
    root.querySelector('.rs-findform ~ .rs-moditem input[name="reason"]:checked')?.focus();
  }
  async function submitHide(form){
    const fd = new FormData(form), subject = String(fd.get('subject') || ''), btn = form.querySelector('[type=submit]');
    if (!moderating() || !subject) return;
    btn.disabled = true;
    try {
      await S.source.moderation.hide(subject, { reason: String(fd.get('reason') || ''), note: String(fd.get('note') || '') });
      S.modding = null; if (S.found?.subject === subject) S.found = null;
      toast('Hidden, for everyone.');
      await afterModeration();
    } catch (e) { toast(plainText(e)); btn.disabled = false; }
  }
  async function unhide(subject, el){
    if (!moderating() || !confirm('Unhide it? It shows again for everyone, as it did before.')) return;
    if (el) el.disabled = true;
    try { await S.source.moderation.unhide(subject); toast('Unhidden'); await afterModeration(); }
    catch (e) { toast(plainText(e)); if (el) el.disabled = false; }
  }
  // After a decision, everything on screen is read again with it.
  async function afterModeration(){
    S.board = null; S.boardAt = 0; loadBoard(true);
    if (S.view === 'seed' && S.seed) S.seed = await reread(S.seed).catch(() => S.seed);
    if (S.view === 'person' && S.sub) await loadPerson(S.sub);
    if (S.view === 'admin') await loadAdmin();
    render();
  }

  // Plants marked to turn are handed to the host, which draws the 3D model of the same kind over
  // each picture if it can (../src/plants/live.js). Each redraw takes the old ones down first.
  let turning = [];
  function livePlants(){
    turning.forEach(off => { try { off(); } catch (_) {} }); turning = [];
    if (!host.plant3d) return;
    root.querySelectorAll('canvas[data-rs-plant]').forEach(c => { try { const off = host.plant3d(c, c.dataset.rsPlant, Number(c.dataset.rsKind) || 0); if (off) turning.push(off); } catch (_) {} });
  }

  /* ---------- asking for rain on a seed or a plant (./post.js draws the steps) ---------- */
  const poster = createPoster({
    root, a, go, board: BOARD_AT, toast, title, plainText, self, viewer, live: () => livePlants(),
    forges: () => host.forges?.() || [], connectForge: host.connectForge ? forge => host.connectForge(forge, S.sub) : null,
    source: () => S.source,
    render: () => render(),
    onPosted(){ S.board = null; loadBoard(true); }
  });
  const renderNew = () => signedIn() ? poster.view()
    : needSignIn('Sign in to ask for rain.');

  /* ---------- render ---------- */
  const datalists = `<datalist id="rsModels">${MODELS.map(m => `<option value="${m}">`).join('')}</datalist><datalist id="rsValues">${VALUES.map(m => `<option value="${m}">`).join('')}</datalist>`;
  // A screen that was waiting, and now isn't: its placeholders dissolve where they stood, and
  // what took their place rises in under them. Only the part that arrived (each region of
  // placeholders is named: see ./skeleton.js), and only as it arrives. A page is often drawn
  // again a moment later (the forge answers, someone's name comes in), so what's under way is
  // carried over to the new drawing and picks up where it was, rather than starting again or
  // being cut off. Anyone who's asked for less motion gets the plain swap.
  const still = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const RISE = 900, FADE = 320;
  let lastView = null, rising = new Map(), fading = [];   // region -> when it arrived; placeholders on their way out
  function paint(html, view){
    const now = Date.now();
    if (lastView !== view) { rising = new Map(); fading = []; }
    const was = lastView === view && !still() ? [...root.querySelectorAll('[data-rs-sk]')].map(el => ({ el, key: el.dataset.rsSk, at: el.getBoundingClientRect() })) : [];
    root.innerHTML = html;
    lastView = view;
    const box = root.firstElementChild;
    if (!box) return;
    if (was.length) {
      const waiting = new Set([...root.querySelectorAll('[data-rs-sk]')].map(el => el.dataset.rsSk));
      const arrived = was.filter(w => !waiting.has(w.key) && w.at.width && w.at.height), base = box.getBoundingClientRect();
      for (const w of arrived) rising.set(w.key, now);
      for (const { el, at } of arrived.filter(w => !arrived.some(o => o !== w && o.el.contains(w.el)))) {
        el.removeAttribute('data-rs-sk'); el.setAttribute('aria-hidden', 'true'); el.classList.add('rs-sk-out');
        Object.assign(el.style, { left: `${at.left - base.left}px`, top: `${at.top - base.top}px`, width: `${at.width}px`, height: `${at.height}px` });
        fading.push({ el, at: now });
        setTimeout(() => { el.remove(); fading = fading.filter(f => f.el !== el); }, FADE);
      }
    }
    for (const [key, at] of rising) if (now - at > RISE) rising.delete(key);
    if (rising.size) {
      box.dataset.rsIn = [...rising.keys()].join(' ');
      for (const [key, at] of rising) box.style.setProperty(`--rs-at-${key}`, `${at - now}ms`);
    }
    for (const f of fading) { f.el.style.animationDelay = `${f.at - now}ms`; box.appendChild(f.el); }
  }
  // Before it's known who's looking, the address already says which screen is coming.
  const viewOf = sub => isBoard(sub) ? 'board' : /^seed\//.test(sub) ? 'seed' : /^profile\//.test(sub) ? 'person' : sub;
  const ahead = sub => ({ board: () => headSk() + boardSk(), seed: () => newHere() + back() + seedSk(), person: () => newHere() + back() + personSk() })[viewOf(sub)]?.() || '';
  const renderLost = () => { title('Nothing here'); return nothingHere('There’s nothing at this address. The link may have been cut short, or what it led to has been deleted.'); };
  function render(){
    // (Until a screen has been entered with someone to show it to, the address says what to hold its place with.)
    if (!S.source || !S.view) { paint(`<div class="rs">${ahead(S.sub)}</div>`, viewOf(S.sub)); return; }
    const body = { board: renderBoard, seed: renderSeed, new: renderNew, me: renderMe, person: renderPerson, agents: renderAgents, admin: renderAdmin, lost: renderLost }[S.view]?.() || renderBoard();
    // Redrawing keeps whichever field had focus, and where its cursor was.
    const focus = document.activeElement && root.contains(document.activeElement) ? document.activeElement : null;
    const keep = focus?.name ? { name: focus.name, pos: focus.selectionStart } : null;
    const demo = S.source.demo ? `<p class="rs-note rs-demo">${ico('sky')}<span>An example circle with made-up people. Nothing you do here leaves this browser.</span>${host.exitDemo ? `<button class="rs-link" type="button" data-rs-act="exit-demo">${host.exitDemo}</button>` : ''}</p>` : '';
    paint(`<div class="rs rs-v-${S.view}">${demo}${body}${datalists}</div>`, S.view);
    if (keep) {
      const el = root.querySelector(`[name="${keep.name}"]`);
      if (el) { el.focus({ preventScroll: true }); try { if (keep.pos != null) el.setSelectionRange(keep.pos, keep.pos); } catch (_) {} }
    }
    if (S.view === 'board') title(S.sub ? 'The board' : null);
    livePlants();
  }

  // Keep what someone typed in the turn-in and profile forms across re-renders.
  function stash(){
    const t = root.querySelector('[data-rs-form="turnin"]');
    if (t) S.drafts.turnIn = Object.fromEntries(new FormData(t));
    for (const kind of ['comment', 'reply']) {
      const f = root.querySelector(`[data-rs-form="${kind}"]`);
      if (f && S.seed) { const fd = new FormData(f); S.drafts[kind] = { uri: S.seed.uri, parent: String(fd.get('parent') || '') || undefined, text: String(fd.get(kind) || '') }; }
    }
    const pr = root.querySelector('[data-rs-form="pull"]');
    if (pr && S.seed) S.drafts.pull = { uri: S.seed.uri, asked: S.drafts.pull?.uri === S.seed.uri ? S.drafts.pull.asked : undefined, ...Object.fromEntries(new FormData(pr)) };
    const vf = root.querySelector('[data-rs-form="vouch"]');
    if (vf && S.vouching) S.vouching.reason = String(new FormData(vf).get('reason') || '');
    const m = root.querySelector('[data-rs-form="me"]');
    if (m && S.form?.profile) readMe(m);
    const hf = root.querySelector('[data-rs-form="hide"]');
    if (hf && S.modding) { const fd = new FormData(hf); S.modding = { ...S.modding, reason: String(fd.get('reason') || '') || undefined, note: String(fd.get('note') || '') }; }
  }
  const rerender = () => { stash(); render(); };

  /* ---------- actions ---------- */
  async function act(name, el){
    const it = S.seed;
    try {
      // Signing in is the host's: it asks who you are and sends you to your server, over this screen.
      if (name === 'signin') { host.signIn?.(S.sub); return; }
      if (name === 'filters') { S.open.filters = !S.open.filters; render(); root.querySelector('[data-rs-act="filters"]')?.focus(); return; }
      if (name === 'exit-demo') return host.onExitDemo?.();
      if (name === 'stage-seen') { stageDismissed = true; try { localStorage.setItem(STAGE_SEEN, '1'); } catch (_) {} root.querySelector('.rs-stage-note')?.remove(); return; }
      if (name === 'take') return sendAgent(it, el);
      // "Change", beside "Send my agent" when its questions are skipped: they're asked this once.
      if (name === 'send-ask') { const one = S.view === 'seed' ? it : S.shown.find(i => i.uri === el.dataset.rsUri); return sendAgent(one, null, { ask: true, panel: S.view !== 'seed' }); }
      // Copied without saying so, and now starting on it.
      if (name === 'claim') {
        const r = await claim(it, el); if (!r) return;
        S.seed = r.fresh; toast(`You’re on it, until ${dayOf(dueOf(myTake(r.fresh))) || 'the day you said'}.`); render(); return;
      }
      if (name === 'more-time') {
        await S.source.moreTime(it, daysOf());
        S.seed = await reread(it); S.boardAt = 0; loadBoard();
        toast(`You have until ${dayOf(dueOf(myTake(S.seed))) || 'later'} now.`); render(); return;
      }
      if (name === 'show-launch') { S.launch = S.launch || pickLauncher(launchers(it, { viewer: viewer() }))?.id || 'brief'; rerender(); root.querySelector('#rsLaunch')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (name === 'connect-forge') {
        stash();
        try { sessionStorage.setItem(KEPT, JSON.stringify({ uri: S.view === 'seed' ? it?.uri : null, comment: S.drafts.comment || null, reply: S.reply ? S.drafts.reply || null : null, pull: S.drafts.pull || null, vouching: S.vouching })); } catch (_) {}
        await host.connectForge?.(el.dataset.rsForge, S.sub);
        return;
      }
      if (name === 'pull-retry') { stash(); await loadPull(it, true); return; }
      if (name === 'me-more') { S.open['me-more'] = true; const more = root.querySelector('[data-rs-me-more]'); if (more) { more.hidden = false; el.remove(); } return; }
      if (name === 'ask-fold') {
        // Folded and unfolded in place. Folding keeps the button where it was on screen, so a
        // reader near the end of a long ask isn't thrown back up to its start.
        const body = root.querySelector('#rsAskBody'); if (!body) return;
        const before = el.getBoundingClientRect().top, open = body.hasAttribute('data-rs-folded');
        body.toggleAttribute('data-rs-folded', !open); S.open.ask = open ? it?.uri : null;
        el.setAttribute('aria-expanded', String(open)); el.textContent = open ? 'Show less' : 'Show more';
        if (!open) window.scrollBy(0, el.getBoundingClientRect().top - before);
        return;
      }
      if (name === 'turnin-more') { S.open['turnin-more'] = true; const more = root.querySelector('[data-rs-turnin-more]'); if (more) { more.hidden = false; el.remove(); more.querySelector('select')?.focus(); } return; }
      if (name === 'vouch-cancel') { S.vouching = null; rerender(); return; }
      if (name === 'accept-cancel') { S.accepting = null; rerender(); root.querySelector('[data-rs-accept]')?.focus(); return; }
      if (name === 'mod-cancel') { S.modding = null; if (S.found && !S.found.error) S.found = null; rerender(); return; }
      if (name === 'admin-retry') { loadAdmin(); return; }
      if (name === 'reply-cancel') { stash(); S.reply = null; S.drafts.reply = null; render(); return; }
      if (name === 'again') { S.again = it.uri; render(); root.querySelector('[data-rs-form="turnin"] input')?.focus(); return; }
      if (name === 'sprout') { await S.source.update(it, { state: 'sprouted' }); S.seed = await reread(it); S.boardAt = 0; loadBoard(); toast('Marked done'); render(); return; }
      if (name === 'drop') {
        if (!confirm(`Drop this ${nounOf(it.value)}? Your take is deleted, so others can see it’s free.`)) return;
        await S.source.drop(it); S.launch = null; toast('Dropped');
      }
      if (name === 'close' || name === 'reopen') { await S.source.update(it, { state: name === 'close' ? 'closed' : 'open' }); toast(name === 'close' ? 'Closed' : 'Reopened'); }
      if (name === 'delete') {
        if (!confirm(`Delete this ${nounOf(it.value)}? This removes the record from your account.`)) return;
        await S.source.remove(it); toast('Deleted'); S.board = null; go(BOARD_AT); return;
      }
      if (name === 'add-setup') { stash(); S.form.profile.setups = [...(S.form.profile.setups?.length ? S.form.profile.setups : [{ harness: 'claude-code', models: [] }]), { harness: 'codex', models: [] }]; render(); return; }
      if (name === 'reset-demo') { S.source.reset(); S.form = null; S.board = null; poster.reset(); await loadMine(true); toast('The example circle is back to how it started'); go(BOARD_AT); return; }
      if (it && ['drop', 'close', 'reopen'].includes(name)) { S.seed = await reread(it); S.boardAt = 0; loadBoard(); render(); }
    } catch (e) { console.warn('rainshare', name, e); toast(plainText(e)); if (el) el.disabled = false; }
  }
  // The command that suits what they run. For anything else, and for a seed with no repo to
  // clone, there isn't one: the brief is what gets copied, to paste into whatever they use.
  function pickLauncher(ls){
    const want = { 'claude-code': 'claude', codex: 'codex' }[mySetup()?.harness];
    return ls.find(l => l.id === want) || null;
  }
  // Accepting marks the ask done with what they turned in. A vouch, if it was asked for, goes
  // after that: if the vouch fails, the ask is still done, and it can be tried again from the card.
  async function submitAccept(form){
    const v = Object.fromEntries(new FormData(form)), btn = form.querySelector('[type=submit]');
    const it = S.seed, dl = (it?.deliveries || []).find(d => d.uri === v.uri); if (!dl) return;
    const vouch = !!v.vouch, first = dl.repo === viewer() ? null : firstName(dl.author);
    if (form.querySelector('[name=vouch]')) { try { localStorage.setItem(ACCEPT_VOUCH, vouch ? '1' : '0'); } catch (_) {} }
    if (btn) btn.disabled = true;
    try { await S.source.update(it, { state: 'sprouted', sproutedWith: [strongRef(dl)] }); }
    catch (e) { toast(plainText(e)); if (btn) btn.disabled = false; return; }
    let said = first ? `Done. It’s in ${first}’s garden.` : 'Done. It’s in your garden.';
    if (vouch && first) {
      try {
        const evidence = S.source.evidenceFor ? await S.source.evidenceFor(dl).catch(() => []) : [];
        await S.source.vouchFor(dl.repo, { reason: v.reason, evidence });
        said = `Done, and you vouched for ${first}. It’s in their garden.`; loadCircle(true);
      } catch (e) {
        if (e?.name === 'NotConnected') S.unlinked = 'tangled';
        said = `Done. It’s in ${first}’s garden, but the vouch didn’t go through: ${plainText(e)}`;
      }
    }
    S.accepting = null; S.seed = await reread(it); S.boardAt = 0; loadBoard();
    toast(said); render();
  }
  async function submitMe(form){
    readMe(form);
    const err = form.querySelector('.rs-err'), btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Saving…'; err.hidden = true;
    try {
      await S.source.saveProfile(S.form.profile, { hidden: S.form.hidden, share: S.form.share });
      await loadMine(true); S.form = null; S.boardAt = 0; loadBoard();
      toast('Saved. Your board is re-sorted for you.'); go(BOARD_AT);
    } catch (e) { err.hidden = false; err.innerHTML = plain(e); btn.disabled = false; btn.textContent = 'Save my profile'; }
  }
  async function submitTurnIn(form){
    const v = Object.fromEntries(new FormData(form)), btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      v.url = String(v.url || '').trim();
      const pullAt = /^at:\/\//.test(v.url) ? v.url : undefined, setup = { harness: v.harness, models: v.model ? [v.model] : [] };
      if (!(pullAt ? parseUri(pullAt) : safeHttp(v.url))) throw new Error(stand(S.seed).idea ? 'That doesn’t look like a link. Paste the address where it lives.' : 'That doesn’t look like a link to a pull request. Paste its address.');
      // Turning in something you hadn't said you were on (an agent handed it back): say so first, so the two records agree.
      if (!myTake(S.seed)) { await S.source.take(S.seed, { setup, days: daysOf() }); S.seed = carry(S.seed, await S.source.seed(S.seed.uri, { force: true }) || S.seed); }
      await S.source.turnIn(S.seed, { url: pullAt ? undefined : v.url, pull: pullAt, sessionUrl: v.sessionUrl, note: v.note, setup });
      S.drafts.turnIn = null; S.launch = null; S.again = null;
      if (S.handBack) { S.handBack = null; try { history.replaceState(history.state, '', location.pathname); } catch (_) {} }
      const who = firstName(S.seed.author);
      S.seed = await reread(S.seed); S.boardAt = 0; loadBoard();
      toast(`Turned in. It’s with ${who} now.`); render();
    } catch (e) { toast(plainText(e)); btn.disabled = false; }
  }

  avatarFallback(root);
  root.addEventListener('click', e => {
    const t = e.target, plainClick = !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0;
    const tb = t.closest('[data-rs-tip]'); if (tb) { toggleTip(tb); return; }
    const goEl = t.closest('[data-rs-go]');
    if (goEl && plainClick) { e.preventDefault(); stash(); S.toTalk = goEl.dataset.rsTo === 'comments' ? goEl.dataset.rsGo : null; go(goEl.dataset.rsGo); return; }
    const pk = t.closest('[data-rs-pick]'); if (pk) { if (plainClick) { e.preventDefault(); pick(pk.dataset.rsPick); } return; }
    if (t.closest('[data-rs-close-sheet]')) { closeSheet(); return; }
    const tk = t.closest('[data-rs-take]'); if (tk) { sendAgent(S.shown.find(i => i.uri === tk.dataset.rsTake), tk, { panel: true }); return; }
    if (t.closest('.rs-post') && poster.click(t)) return;
    // Sorting and narrowing the board. (The control pressed keeps the focus, or the Filter
    // button does when what was pressed has gone.)
    const refocus = sel => (root.querySelector(sel) || root.querySelector('[data-rs-act="filters"]'))?.focus();
    const fr = t.closest('[data-rs-from]'); if (fr) { S.from = fr.dataset.rsFrom; S.sheet = false; render(); refocus(`.rs-filters [data-rs-from="${S.from}"]`); return; }
    const so = t.closest('[data-rs-sort]'); if (so) { S.sort = so.dataset.rsSort; S.sheet = false; render(); refocus(`[data-rs-sort="${S.sort}"]`); return; }
    const sh = t.closest('[data-rs-show]'); if (sh) { S.show = sh.dataset.rsShow; S.sheet = false; render(); refocus(`.rs-filters [data-rs-show="${S.show}"]`); return; }
    const sg = t.closest('[data-rs-seg] button');
    // Turning it in by its link, or opening the pull request from here (which asks the forge about the repo the first time).
    if (sg && sg.closest('[data-rs-seg="mcp"]')) { S.open.mcp = sg.dataset.v === 'other'; render(); root.querySelector('[data-rs-seg="mcp"] [aria-pressed="true"]')?.focus(); return; }
    if (sg && sg.closest('[data-rs-seg="turn"]')) { stash(); S.open.pull = sg.dataset.v === 'open'; if (S.open.pull && S.seed) loadPull(S.seed); render(); root.querySelector('[data-rs-seg="turn"] [aria-pressed="true"]')?.focus(); return; }
    if (sg && S.view === 'me') {
      const name = sg.closest('[data-rs-seg]').dataset.rsSeg, v = sg.dataset.v;
      stash();
      if (name === 'forecast') { const next = S.form.profile.forecast?.level === v ? undefined : v; S.form.profile.forecast = next ? { ...(S.form.profile.forecast || {}), level: next } : undefined; }
      if (name === 'budget') S.form.profile.budget = S.form.profile.budget === v ? undefined : v;
      render(); return;
    }
    const tgl = t.closest('[data-rs-toggles] button');
    if (tgl) {
      const now = tgl.getAttribute('aria-pressed') !== 'true';
      tgl.setAttribute('aria-pressed', String(now));
      // Plans: "No AI plan" and "Free tiers only" stand alone, and a paid plan clears them.
      if (now && tgl.closest('[data-rs-toggles="plans"]')) {
        const unpaid = UNPAID.includes(tgl.dataset.v);
        tgl.parentElement.querySelectorAll('button').forEach(b => { if (b !== tgl && (unpaid || UNPAID.includes(b.dataset.v))) b.setAttribute('aria-pressed', 'false'); });
      }
      return;
    }
    // Another way to send it: only its part of the page is redrawn.
    const pl = t.closest('[data-rs-launch]');
    if (pl) { const l = ways(S.seed)[+pl.dataset.rsLaunch], box = root.querySelector('#rsLaunch'); if (l && box) { S.launch = l.id; box.outerHTML = renderLaunch(S.seed); root.querySelector(`#rsLaunch [data-rs-launch="${pl.dataset.rsLaunch}"]`)?.focus(); } return; }
    const cp = t.closest('[data-rs-copy]'); if (cp) { const l = ways(S.seed)[+cp.dataset.rsCopy]; if (l) { S.launch = l.id; copy(l.command, l.copied); } return; }
    const md = t.closest('[data-rs-md]');
    if (md) {
      const it = S.seed?.uri === md.dataset.rsMd ? S.seed : S.shown.find(i => i.uri === md.dataset.rsMd) || S.board?.items.find(i => i.uri === md.dataset.rsMd);
      // Copying is free; starting on it is worth saying, so two people don't do the same work.
      const free = it && signedIn() && isOpen(it) && it.repo !== viewer() && !myTake(it);
      if (it) copy(briefFor(it), free ? 'Copied. Paste it into your agent. If you start on it, press “Send my agent” so nobody doubles up.' : 'Copied as Markdown. Paste it into your agent.');
      return;
    }
    const ct = t.closest('[data-rs-copy-text]'); if (ct) { copy(ct.dataset.rsCopyText, ct.dataset.rsCopied || (ct.dataset.rsCopyText.startsWith('git ') ? 'Copied the clone command' : 'Copied the link')); return; }
    // A pull request found on the forge, claimed by the person whose agent opened it.
    const cl = t.closest('[data-rs-claim]');
    if (cl && S.seed) { stash(); S.drafts.turnIn = { ...(S.drafts.turnIn || {}), url: cl.dataset.rsClaim }; S.handBack = S.again = S.seed.uri; render(); root.querySelector('[data-rs-form="turnin"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const acc = t.closest('[data-rs-accept]'); if (acc) { stash(); S.accepting = acc.dataset.rsAccept; render(); root.querySelector('[data-rs-form="accept"] [type=submit]')?.focus(); return; }
    const vo = t.closest('[data-rs-vouch]'); if (vo) { stash(); S.vouching = { did: vo.dataset.rsVouch, evidence: vo.dataset.rsEvidence || null }; render(); root.querySelector('[data-rs-form="vouch"] [name=reason]')?.focus(); return; }
    const uv = t.closest('[data-rs-unvouch]'); if (uv) { takeBackVouch(uv.dataset.rsUnvouch); return; }
    // Replying opens a form at the foot of the comment's thread; deleting is for your own.
    const rp = t.closest('[data-rs-reply]');
    if (rp) { stash(); S.reply = rp.dataset.rsReply; render(); root.querySelector('[data-rs-form="reply"] textarea')?.focus(); return; }
    const uc = t.closest('[data-rs-uncomment]'); if (uc) { uncomment(uc.dataset.rsUncomment, uc); return; }
    // Moderating: a hide form opens where its button was pressed; unhiding asks first.
    const md2 = t.closest('[data-rs-mod]');
    if (md2 && moderating()) { stash(); S.modding = { subject: md2.dataset.rsMod, reason: md2.dataset.rsReason || undefined }; render(); root.querySelector('[data-rs-form="hide"] input[name="reason"]:checked')?.focus(); return; }
    const uh = t.closest('[data-rs-unhide]'); if (uh) { unhide(uh.dataset.rsUnhide, uh); return; }
    const fl = t.closest('[data-rs-fill]');
    if (fl) { const box = fl.closest('form')?.querySelector('textarea'); if (box) { box.value = box.value.trim() ? box.value.trimEnd() + '\n\n' + fl.dataset.rsFill : fl.dataset.rsFill; box.focus(); fl.remove(); } return; }
    const rm = t.closest('[data-rs-remove-setup]'); if (rm) { stash(); S.form.profile.setups.splice(+rm.dataset.rsRemoveSetup, 1); render(); return; }
    const ac = t.closest('[data-rs-act]'); if (ac) { act(ac.dataset.rsAct, ac); }
  });
  root.addEventListener('keydown', e => {
    const menu = e.key === 'Escape' && root.querySelector('details.rs-more[open]');
    if (menu) { menu.open = false; menu.querySelector('summary')?.focus(); return; }
    if (e.key === 'Escape' && S.sheet && narrow()) { closeSheet(); return; }
    // Up and down move through the board's list, and the panel follows.
    const item = e.target.closest?.('.rs-list [data-rs-pick]');
    if (item && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const all = [...root.querySelectorAll('.rs-list [data-rs-pick]')], next = all[all.indexOf(item) + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) { e.preventDefault(); next.focus(); if (!narrow()) pick(next.dataset.rsPick); }
    }
  });
  document.addEventListener('click', e => {
    const t = e.target, inMenu = t.closest?.('details.rs-more');
    for (const d of root.querySelectorAll('details.rs-more[open]')) if (d !== inMenu || t.closest('.rs-menu')) d.open = false;
  });
  root.addEventListener('submit', e => {
    const f = e.target.closest('[data-rs-form]'); if (!f) return;
    e.preventDefault();
    if (f.dataset.rsForm === 'post') poster.submit();
    else if (f.dataset.rsForm === 'me') submitMe(f);
    else if (f.dataset.rsForm === 'prefs') submitPrefs(f);
    else if (f.dataset.rsForm === 'turnin') submitTurnIn(f);
    else if (f.dataset.rsForm === 'pull') submitPull(f);
    else if (f.dataset.rsForm === 'vouch') submitVouch(f);
    else if (f.dataset.rsForm === 'accept') submitAccept(f);
    else if (f.dataset.rsForm === 'comment' || f.dataset.rsForm === 'reply') submitComment(f);
    else if (f.dataset.rsForm === 'hide') submitHide(f);
    else if (f.dataset.rsForm === 'hide-find') submitFind(f);
  });
  root.addEventListener('input', e => { if (e.target.closest('[data-rs-form="post"]')) poster.typed(e.target); });
  root.addEventListener('change', e => {
    if (e.target.closest('[data-rs-form="post"]')) poster.changed(e.target);
    // Choosing where a branch was pushed changes which branches there are to choose from.
    else if (e.target.name === 'from' && e.target.closest('[data-rs-form="pull"]')) rerender();
    // Vouching as you accept asks why, but only once it's ticked.
    else if (e.target.name === 'vouch' && e.target.closest('[data-rs-form="accept"]')) {
      const why = e.target.closest('form').querySelector('.rs-accept-why'); if (why) why.hidden = !e.target.checked;
    }
  });

  /* ---------- entering a screen ---------- */
  async function show(sub = ''){
    sub = sub.replace(/^\/+|\/+$/g, '');
    if (!S.source) { S.sub = sub; render(); return; }
    if (sub !== S.sub && !(S.view === 'me' && sub === 'me')) S.form = null;
    if (sub !== S.sub) { S.vouching = null; S.accepting = null; S.reply = null; S.modding = null; }
    S.sub = sub;
    // Not an address Rainshare has. If it's clear what was meant (../core/route.js), go there; if not, say so.
    if (!known(sub)) {
      const meant = reroute(sub);
      if (meant != null && meant !== sub && known(meant)) return go(meant, { replace: true });
      S.view = 'lost'; render(); return;
    }
    if (isBoard(sub)) { S.view = 'board'; render(); loadBoard(); loadCircle(); }
    else if (sub === 'new') { S.view = 'new'; if (signedIn()) poster.enter(); else title('Ask for rain'); render(); }
    else if (sub === 'me') {
      S.view = 'me'; title('Your profile'); render();
      if (signedIn() && !S.mine) { await loadMine(); render(); }
      if (signedIn() && S.form && S.form.groups === null) { const g = await S.source.groups().catch(() => []); if (S.form) { S.form.groups = g; rerender(); } }
    }
    else if (sub === 'agents') { S.view = 'agents'; render(); }
    else if (sub === 'admin') { S.view = 'admin'; render(); loadAdmin(); }
    else if (/^profile\//.test(sub)) { S.view = 'person'; render(); loadCircle(); loadPerson(sub); }
    else if (/^seed\//.test(sub)) {
      S.view = 'seed'; render(); loadCircle(); await loadSeed(sub);
      if (S.sub !== sub) return;
      // A link that picked up a full stop or a capital on the way here is tried again without it.
      if (S.seedErr && !S.seed) { const meant = reroute(sub); if (meant && meant !== sub && known(meant)) return go(meant, { replace: true }); }
      render();
      // Come from "Comments" on the board, or by a link to them: they're scrolled to.
      const toTalk = S.toTalk === sub || (typeof location !== 'undefined' && location.hash === '#comments');
      S.toTalk = null;
      if (S.launch) root.querySelector('#rsLaunch')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (toTalk) root.querySelector('#comments')?.scrollIntoView({ block: 'start' });
    }
  }

  return {
    show,
    /** Hand in a (new) data source: on sign-in, sign-out, or switching to the example circle. */
    async setSource(source){
      Object.assign(S, { source, board: null, mine: null, garden: null, unlinked: null, seed: null, form: null, drafts: {}, pick: null, sheet: false, pull: null, circle: undefined, vouching: null, accepting: null, reply: null, from: 'anyone', sort: null, show: 'all', known: {}, admin: null, found: null, modding: null });
      poster.reset();
      render();
      if (source?.signedIn) { await loadMine(); loadGarden(); welcome(); }
      show(S.sub);
    },
    refresh: () => loadBoard(true),
    get source(){ return S.source; }
  };
}
