// Rainshare's feedback page: its board on userinput.app, here. People post bugs, requests and
// ideas, vote for what they'd like next, and reply, all on this page. What they write is
// userinput.app's own records, in their own accounts (../core/feedback.js), so it shows on
// userinput.app too, and what's done there shows here.
//
//   feedback                 the board: what's pinned, then each post by where it stands, most
//                            voted first, with a vote button beside each, and "Post feedback"
//   feedback/<did>/<rkey>    one post: what it says, where it stands, and its replies
//
// The board's moderators (its owner, @rainshare.dev, and whoever it appoints) set a post's
// status, hide posts and replies, ban people, and pin and lock posts, from the post's page, and
// see what's hidden so they can undo it. The owner appoints moderators and changes the board's
// name, description and categories, from "Run the board" on the board.
//
// rainshare.js owns the screen and hands in what this needs as `ui`; this keeps the board, the
// post on screen and what's being written, and draws them.
import { BOARD_MODERATORS, HANDLE } from '../core/ns.js';
import { readBoard, readThread, groupOf, stateWord, postRef, STATES, ROLES, GROUPS } from '../core/feedback.js';
import { knownPerson, profiles, resolveHandle, isDid } from '../core/net.js';
import { askExcerpt } from '../core/words.js';
import { renderMarkdown } from '../core/markdown.js';
import { esc, ago, ico, face, tip, nameOf } from './bits.js';
import { confirmBox } from './confirm.js';
import { listSk, seedSk } from './skeleton.js';

const UP = '<svg class="rs-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14.5l6-6 6 6"/></svg>';
const PIN_ICO = '<svg class="rs-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v6"/></svg>';
// How long the board is kept before it's read again, on coming back to it.
const KEEP = 60e3;
const subOf = it => `feedback/${it.repo}/${it.rkey}`;
const votesSaid = n => n === 1 ? '1 vote' : `${n} votes`;
const repliesSaid = n => n === 1 ? '1 reply' : `${n} replies`;
// A post's address from a link to it here, on userinput.app, or its at:// address.
const refFrom = s => {
  const t = String(s || '').trim(), here = t.match(/(?:^|\/)feedback\/(did:[a-z]+:[A-Za-z0-9._:%-]+)\/([A-Za-z0-9._:~-]+)\/?$/);
  return here ? { repo: here[1], rkey: here[2] } : postRef(t);
};

export function createFeedback(ui){
  const { a, go, toast, title, plainText, render, viewer, source, host } = ui;
  // The example board is made up, and nothing done there leaves the browser: there, the real
  // board is shown as it is to someone signed out.
  const signedIn = () => ui.signedIn() && !source()?.demo;
  const fresh = () => ({
    board: null, at: 0, loading: false, error: null,
    thread: null,      // the post on screen: { key, data, loading, error }
    compose: false,    // whether "Post feedback" is open
    draft: null,       // what's being posted: { title, body, tags }
    editing: null,     // the post or reply being edited: its address
    editDraft: null,   // what it's being changed to
    replyTo: null,     // the reply a reply is being written to (its address), or null for the post
    replies: {},       // what's been typed in each reply box, by what it answers ('post' for the post)
    statusDraft: null, // the status form, as left
    running: false,    // whether "Run the board" is open
    boardDraft: null,  // the board form, as left
    busy: null,        // what's being written, so its button waits
    lit: null          // a post or reply just written, lit for a moment: its address
  });
  let F = fresh();
  const src = () => source();
  const w = () => src()?.feedback || null;
  const local = () => w()?.local || null;
  const board = () => F.board;
  const mods = () => new Set(F.board?.moderators || []);
  const isMod = () => signedIn() && mods().has(viewer());
  const isOwner = () => signedIn() && F.board?.space.repo === viewer();
  // One of the accounts whose sign-in asks to run the board, who the owner hasn't appointed yet.
  const notYet = () => signedIn() && !isMod() && BOARD_MODERATORS.some(([did]) => did === viewer());
  const canWrite = () => signedIn() && !!w() && (host.canFeedback?.() ?? true);
  const canRun = () => isMod() && !!w() && (host.canRunBoard?.() ?? true);
  // What everyone else sees: nothing hidden, and nothing from someone banned.
  const shows = it => isMod() || (!it.hidden && !it.banned);
  // A reply, the same, and nothing written after the post was closed to replies.
  const showsReply = r => isMod() || (!r.hidden && !r.banned && !r.late);
  const person = did => knownPerson(did) || { did };

  /* ---------- reading ---------- */
  // Everything on the board is read, what's hidden included, and what each person sees is
  // decided as it's drawn (`shows`): the moderators see it, marked, so they can undo it.
  async function load(again = false){
    // (Asked to read it again while it's being read: once that's done, it's read once more, so
    // what was just written is in it.)
    if (F.loading) { if (!again) return F.loading; await F.loading; }
    if (!again && F.board && !F.error && Date.now() - F.at < KEEP) return;
    const mine = F;
    F.loading = (async () => {
      F.error = null;
      if (onScreen()) render();
      try {
        const b = await readBoard({ viewer: viewer(), local: local(), all: true });
        if (F !== mine) return;
        Object.assign(F, { board: b, at: Date.now(), error: null });
        if (b) await names(b.items.map(i => i.repo).concat(b.members.map(m => m.did), b.bans.map(x => x.subject)));
      } catch (e) {
        console.warn('rainshare feedback', e);
        if (F === mine) F.error = e;
      } finally {
        if (F === mine) { F.loading = false; if (onScreen()) render(); }
      }
    })();
    return F.loading;
  }
  const names = dids => profiles([...new Set(dids.filter(isDid))]).catch(() => null);
  // One post and its replies. The board is read first, if it hasn't been: it says who moderates.
  async function loadThread(ref, again = false){
    const key = ref.repo + '/' + ref.rkey;
    if (!again && F.thread?.key === key && (F.thread.loading || F.thread.data)) return;
    const mine = F;
    F.thread = { key, data: F.thread?.key === key ? F.thread.data : null, loading: true, error: null };
    render();
    try {
      if (!F.board) await load();
      if (F !== mine) return;
      if (!F.board) throw F.error || new Error('The board couldn’t be read just now.');
      const data = await readThread(F.board, ref, { viewer: viewer(), local: local(), all: true });
      if (F !== mine || F.thread?.key !== key) return;
      F.thread = { key, data, loading: false, error: null };
      // (The board shows it as it is now, too.)
      if (data) patch(data.post);
      render();
      if (data) { await names([data.post.repo, ...data.replies.map(r => r.repo)]); if (F.thread?.key === key) render(); }
    } catch (e) {
      console.warn('rainshare feedback post', e);
      if (F === mine && F.thread?.key === key) { F.thread = { key, data: null, loading: false, error: e }; render(); }
    }
  }
  const onScreen = () => /^feedback(\/|$)/.test(ui.sub());
  // A post as it now stands, in the board's list as well.
  function patch(post){
    const items = F.board?.items;
    if (!items) return;
    const i = items.findIndex(x => x.uri === post.uri);
    const kept = { pinned: post.pinned, hidden: post.hidden, banned: post.banned };
    if (i >= 0) items[i] = { ...items[i], ...post, ...kept, replies: Math.max(post.replies || 0, F.thread?.data?.post?.uri === post.uri ? F.thread.data.replies.length : 0) };
  }

  /* ---------- the board ---------- */
  function listView(){
    title('Feedback');
    const b = F.board;
    const how = tip(`@${esc(HANDLE)} marks each post as it moves along: planned, in progress, done or closed. Posts marked planned can be handed to a Claude Code routine that drafts the change as a pull request on GitHub, and a person reads every one before it’s merged.`, 'What happens to a post');
    const start = !b ? '' : canWrite() ? `<button class="rs-btn rs-primary" type="button" data-fb="compose" aria-expanded="${F.compose}">${ico('plus')}Post feedback</button>`
      : signedIn() ? `<button class="rs-btn rs-primary" type="button" data-fb="again">${ico('refresh')}Sign in again to post</button>`
      : host.signIn ? `<button class="rs-btn rs-primary" type="button" data-rs-act="signin">Sign in to post</button>` : '';
    const there = b ? `<a class="rs-link" href="${esc(b.space.link)}" target="_blank" rel="noopener">On userinput.app${ico('out')}</a>` : '';
    const head = `<header class="rs-agents-head">
        <h1>Feedback</h1>
        <p>Found a bug, or want Rainshare to do something it doesn’t yet? Post it here, and vote for what you’d like next. What you post is kept in your own account, as a post on Rainshare’s board on userinput.app, so it shows there too.</p>
        ${b ? `<div class="rs-row">${start}${how}${there}</div>` : ''}
        ${b && signedIn() && !canWrite() ? `<p class="rs-muted">Your sign-in is from before Rainshare could post here for you. Signing in again takes a moment, and brings you back.</p>` : ''}
      </header>`;
    let body;
    if (!b && (F.loading || !F.at) && !F.error) body = listSk(4, 'feedback');
    else if (!b && F.error) body = `<div class="rs-empty rs-need"><p>The board couldn’t be read just now.</p><div class="rs-row"><button class="rs-btn rs-quiet" type="button" data-rs-act="feedback-again">${ico('refresh')}Try again</button></div></div>`;
    else if (!b) body = `<div class="rs-empty rs-need"><p>Rainshare’s feedback board isn’t open yet. Until it is, open an issue where its code lives.</p><div class="rs-row"><a class="rs-btn rs-quiet" href="https://github.com/atpota-to/rainshare/issues" target="_blank" rel="noopener">GitHub</a><a class="rs-btn rs-quiet" href="https://tangled.org/atpota.to/rainshare/issues" target="_blank" rel="noopener">Tangled</a></div></div>`;
    else body = groups(b);
    return `<div class="rs-agents rs-fb">${head}${b && F.compose && canWrite() ? composeForm(b) : ''}${b ? runNote() + (isOwner() || canRun() ? runPanel(b) : '') : ''}${body}</div>`;
  }
  // The posts, by where each stands: what's pinned first, then in progress, planned, new, the
  // backlog, and done and closed folded away. A moderator sees what's hidden at the end, folded.
  function groups(b){
    const tagNames = new Map(b.space.tags.map(t => [t.value, t.label]));
    const on = b.items.filter(it => !it.hidden && !it.banned), off = isMod() ? b.items.filter(it => it.hidden || it.banned) : [];
    if (!on.length && !off.length) return `<div class="rs-empty"><p>Nothing’s been posted yet.${canWrite() ? ' Be the first.' : ''}</p></div>`;
    const pinned = on.filter(it => it.pinned);
    const sections = [
      pinned.length ? section('pinned', 'Pinned', pinned, { tagNames, states: 2 }) : '',
      ...GROUPS.map(([key, heading, states]) => {
        const items = on.filter(it => !it.pinned && groupOf(it) === key);
        return items.length ? section(key, heading, items, { tagNames, states: states.length, fold: key === 'done' || key === 'closed' }) : '';
      }),
      off.length ? section('hidden', 'Hidden from everyone else', off, { tagNames, states: 2, fold: true }) : ''
    ];
    return `<div class="rs-fb-groups">${sections.join('')}</div>`;
  }
  function section(key, heading, items, { tagNames, states, fold = false }){
    const h = `<h2>${esc(heading)} <span>${items.length}</span></h2>`, list = `<ul class="rs-list">${items.map(it => itemLi(it, { tagNames, states })).join('')}</ul>`;
    return fold ? `<details class="rs-fb-group"${ui.opened('fb-' + key) ? ' open' : ''} data-rs-fold="fb-${key}"><summary>${h}</summary>${list}</details>` : `<section class="rs-fb-group">${h}${list}</section>`;
  }
  const voteBtn = (it, big = false) => {
    const n = it.votes || 0, mark = it.voted ? 'Take back your vote' : 'Vote for this';
    return `<button type="button" class="rs-fb-votes${big ? ' rs-fb-big' : ''}" data-fb-vote="${esc(it.uri)}" aria-pressed="${!!it.voted}" aria-label="${esc(`${mark}: ${votesSaid(n)}`)}" title="${esc(mark)}"${F.busy === 'vote:' + it.uri ? ' disabled' : ''}><span aria-hidden="true">${UP}${n}</span></button>`;
  };
  function itemLi(it, { tagNames, states }){
    const p = person(it.repo), live = it.live, ex = askExcerpt(live.body, 180);
    // A group with more than one state in it (new and under review; declined, duplicate, closed) says which.
    const state = states > 1 && it.status ? `<span class="rs-state">${esc(stateWord(it.status.state))}</span>` : '';
    const tags = live.tags.map(t => `<span class="rs-fb-tag">${esc(tagNames.get(t) || t)}</span>`).join('');
    const marks = [
      it.lock ? `<span class="rs-fb-mark">${ico('lock')}Closed to replies</span>` : '',
      it.hidden ? `<span class="rs-fb-mark rs-bad">Hidden</span>` : '',
      it.banned ? `<span class="rs-fb-mark rs-bad">From someone banned</span>` : ''
    ].join('');
    const replies = it.replies ? `<span>${repliesSaid(it.replies)}</span>` : '';
    const note = it.status?.note ? `<span class="rs-fb-note">${ico('drop')}<span>${esc(askExcerpt(it.status.note, 240))}</span></span>` : '';
    return `<li class="rs-fb-li${F.lit === it.uri ? ' rs-fresh' : ''}"><a class="rs-item rs-fb-item" href="${esc(ui.href(subOf(it)))}" data-rs-go="${esc(subOf(it))}">
      <span class="rs-item-top">${face(p, 'xs')}<span class="rs-item-who"><b>${esc(it.repo === viewer() ? 'You' : nameOf(p))}</b></span><time>${esc(ago(it.createdAt))}</time></span>
      <span class="rs-item-main">
        <span class="rs-item-title">${it.pinned ? `<span class="rs-fb-pin" title="Pinned">${PIN_ICO}<span class="rs-sr">Pinned: </span></span>` : ''}${esc(live.title)}</span>
        ${ex ? `<span class="rs-item-ask">${esc(ex)}</span>` : ''}
        ${note}
        ${state || tags || replies || marks ? `<span class="rs-item-line">${state}${tags}${replies}${marks}</span>` : ''}
      </span>
    </a>${voteBtn(it)}</li>`;
  }
  // The categories, as buttons to press, for posting and for changing a post.
  const tagPicker = (b, on) => b.space.tags.length ? `<fieldset class="rs-fb-tags"><legend>Category <small>pick any that fit</small></legend>
      <div class="rs-toggles" data-rs-toggles="fb-tags">${b.space.tags.map(t => `<button type="button" data-v="${esc(t.value)}" aria-pressed="${(on || []).includes(t.value)}">${esc(t.label)}</button>`).join('')}</div></fieldset>` : '';
  function composeForm(b){
    const d = F.draft || {};
    return `<form class="rs-form rs-fb-compose" data-rs-form="fb-post">
        <h2>Post feedback</h2>
        <label>Title <small>what it’s about, in a line</small><input name="title" maxlength="300" required autocomplete="off" value="${esc(d.title || '')}" placeholder="The board forgets my filter"></label>
        <label>More about it <small>(optional) what happened, or what you’d like, and why</small><textarea name="body" rows="5" maxlength="10000">${esc(d.body || '')}</textarea></label>
        ${tagPicker(b, d.tags)}
        <p class="rs-muted">It’s public, and kept in your own account as a post on Rainshare’s board on userinput.app. You can change it or delete it later.</p>
        <div class="rs-row"><button class="rs-btn rs-primary" type="submit"${F.busy === 'post' ? ' disabled' : ''}>${F.busy === 'post' ? 'Posting…' : 'Post it'}</button><button class="rs-link" type="button" data-fb="compose-cancel">Cancel</button></div>
      </form>`;
  }

  /* ---------- running the board ---------- */
  // Said to a moderator whose sign-in can't write the board's records yet, and to one of
  // BOARD_MODERATORS the owner hasn't appointed.
  function runNote(){
    if (notYet()) return `<p class="rs-note">${ico('info')}<span>You can help run this board once @${esc(HANDLE)} makes you a moderator of it. Sign in as @${esc(HANDLE)}, open “Run the board” here, and add yourself.</span></p>`;
    if (isMod() && !canRun()) return `<p class="rs-note">${ico('info')}<span>You moderate this board, but your sign-in is from before Rainshare could do that for you.</span><button class="rs-btn rs-quiet rs-sm" type="button" data-fb="again">Sign in again</button></p>`;
    return '';
  }
  function runPanel(b){
    const open = F.running;
    const btn = `<button class="rs-btn rs-quiet rs-sm" type="button" data-fb="run" aria-expanded="${open}">${ico('shield')}Run the board</button>`;
    if (!open) return `<div class="rs-row rs-fb-run">${btn}<span class="rs-muted">${isOwner() ? 'Moderators, bans, and the board’s name and categories.' : 'Who’s banned.'}</span></div>`;
    return `<div class="rs-row rs-fb-run">${btn}</div><section class="rs-panel rs-fb-admin" aria-label="Running the board">
        ${isOwner() ? modsPart(b) : ''}
        ${bansPart(b)}
        ${isOwner() ? boardForm(b) : ''}
      </section>`;
  }
  function modsPart(b){
    const appointed = new Set(b.members.map(m => m.did));
    const suggest = BOARD_MODERATORS.filter(([did]) => did !== b.space.repo && !appointed.has(did));
    return `<div class="rs-fb-part"><div class="rs-hrow"><h2>Moderators</h2>${tip('Moderators can set a post’s status, hide posts and replies, ban people, and pin and lock posts. Each is an app.userinput.member record in this account, and only this account’s count. Taking someone off deletes it.')}</div>
      <ul class="rs-fb-people">
        <li>${face(person(b.space.repo), 'xs')}<b>${esc(nameOf(person(b.space.repo)))}</b><span class="rs-muted">Owner</span></li>
        ${b.members.map(m => `<li>${face(person(m.did), 'xs')}<b>${esc(nameOf(person(m.did)))}</b><span class="rs-muted">${esc((ROLES.find(r => r[0] === m.role) || [, m.role])[1])}</span><button class="rs-link rs-danger" type="button" data-fb-unmod="${esc(m.uri)}">Take off</button></li>`).join('')}
      </ul>
      ${suggest.length ? `<div class="rs-row">${suggest.map(([did, handle]) => `<button class="rs-btn rs-quiet rs-sm" type="button" data-fb-addmod="${esc(did)}">${ico('plus')}Make @${esc(handle)} a moderator</button>`).join('')}</div>` : ''}
      <form class="rs-form rs-fb-inline" data-rs-form="fb-addmod">
        <label class="rs-inline">Add someone <input name="who" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="handle.bsky.social" required>
          <select name="role" aria-label="Role">${ROLES.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
          <button class="rs-btn rs-quiet rs-sm" type="submit">Add</button></label>
      </form></div>`;
  }
  function bansPart(b){
    return `<div class="rs-fb-part"><div class="rs-hrow"><h2>Banned</h2>${tip('Someone banned can’t post on this board, and what they’ve posted is hidden from everyone but its moderators. Ban someone from one of their posts or replies. Only whoever banned someone can unban them.')}</div>
      ${b.bans.length ? `<ul class="rs-fb-people">${b.bans.map(x => `<li>${face(person(x.subject), 'xs')}<b>${esc(nameOf(person(x.subject)))}</b><span class="rs-muted">${esc(ago(x.createdAt))}${x.repo === viewer() ? '' : ` by ${esc(nameOf(person(x.repo)))}`}</span>${x.repo === viewer() ? `<button class="rs-link" type="button" data-fb-unban="${esc(x.subject)}">Unban</button>` : ''}</li>`).join('')}</ul>` : '<p class="rs-muted">Nobody.</p>'}</div>`;
  }
  function boardForm(b){
    const d = F.boardDraft || { name: b.space.name, description: b.space.description, tags: b.space.tags };
    const rows = [...d.tags, { value: '', label: '' }, { value: '', label: '' }];
    return `<form class="rs-form rs-fb-boardform" data-rs-form="fb-board">
        <div class="rs-hrow"><h2>The board</h2>${tip('It’s the app.userinput.space record in this account: what userinput.app shows too. A category keeps its value when it’s renamed, so posts filed under it stay there. Clear a category’s name to take it away.')}</div>
        <label>Name<input name="name" maxlength="100" required value="${esc(d.name)}"></label>
        <label>What it’s for <small>(optional)</small><textarea name="description" rows="3" maxlength="1500">${esc(d.description || '')}</textarea></label>
        <fieldset><legend>Categories</legend>
          <div class="rs-fb-cats">${rows.map((t, i) => `<input type="hidden" name="tag-value" value="${esc(t.value)}"><input name="tag-label" maxlength="64" value="${esc(t.label)}" aria-label="Category ${i + 1}"${t.value ? '' : ' placeholder="A new category"'}>`).join('')}</div>
        </fieldset>
        <div class="rs-row"><button class="rs-btn rs-primary rs-sm" type="submit"${F.busy === 'board' ? ' disabled' : ''}>Save the board</button></div>
      </form>`;
  }

  /* ---------- one post ---------- */
  function postView(sub){
    const [, repo, rkey] = sub.split('/'), key = repo + '/' + rkey, th = F.thread?.key === key ? F.thread : null;
    const back = a('feedback', `${ico('back')}All feedback`, 'rs-back');
    if (!th || (th.loading && !th.data)) { title('Feedback'); return `<div class="rs-fb rs-fb-post">${back}${seedSk()}</div>`; }
    if (th.error && !th.data) return `<div class="rs-fb rs-fb-post">${back}<div class="rs-empty rs-need"><p>This post couldn’t be read just now.</p><div class="rs-row"><button class="rs-btn rs-quiet" type="button" data-fb="thread-again">${ico('refresh')}Try again</button></div></div></div>`;
    if (!th.data) { title('Not on the board'); return `<div class="rs-fb rs-fb-post">${back}<div class="rs-empty rs-need"><p>There’s no post on Rainshare’s feedback board at this address. It may have been deleted.</p><div class="rs-row">${a('feedback', 'See all feedback', 'rs-btn rs-primary')}</div></div></div>`; }
    const { post, threads } = th.data, b = F.board;
    if (!shows(post)) { title('Hidden'); return `<div class="rs-fb rs-fb-post">${back}<div class="rs-empty rs-need"><p>The board’s moderators have hidden this post, so it isn’t shown here.</p></div></div>`; }
    title(post.live.title);
    const p = person(post.repo), mine = post.repo === viewer(), tagNames = new Map((b?.space.tags || []).map(t => [t.value, t.label]));
    const tags = post.live.tags.map(t => `<span class="rs-fb-tag">${esc(tagNames.get(t) || t)}</span>`).join('');
    const st = post.status ? `<span class="rs-fb-status rs-fb-st-${esc(post.status.state)}">${esc(stateWord(post.status.state))}</span>` : `<span class="rs-fb-status">New</span>`;
    const tools = [
      mine && canWrite() ? `<button class="rs-link" type="button" data-fb-edit="${esc(post.uri)}">Edit</button>` : '',
      mine && canWrite() ? `<button class="rs-link rs-danger" type="button" data-fb-delete="${esc(post.uri)}">Delete</button>` : '',
      `<a class="rs-link" href="${esc(post.link)}" target="_blank" rel="noopener">On userinput.app${ico('out')}</a>`
    ].join('');
    const flags = [
      post.hidden ? `<p class="rs-note rs-bad">${ico('shield')}<span><b>Hidden</b> from everyone but the board’s moderators.</span></p>` : '',
      post.banned ? `<p class="rs-note rs-bad">${ico('shield')}<span><b>From someone banned</b>, so it’s hidden from everyone but the board’s moderators.</span></p>` : ''
    ].join('');
    const body = F.editing === post.uri ? editForm(post, b) : `
        <h1 class="rs-fb-title">${post.pinned ? `<span class="rs-fb-pin" title="Pinned">${PIN_ICO}<span class="rs-sr">Pinned: </span></span>` : ''}${esc(post.live.title)}</h1>
        ${post.live.body ? `<div class="rs-spec">${renderMarkdown(post.live.body)}</div>` : ''}
        ${images(post)}`;
    return `<div class="rs-fb rs-fb-post">${back}
      <article class="rs-panel rs-fb-main">
        <div class="rs-fb-by">${face(p)}<span>${a('profile/' + post.repo, `<b>${esc(mine ? 'You' : nameOf(p))}</b>`, 'rs-who')}<small>${esc(ago(post.createdAt))}${post.edits ? ' · edited' : ''}</small></span>${voteBtn(post, true)}</div>
        <div class="rs-row rs-fb-where">${st}${tags}</div>
        ${post.status?.note ? `<p class="rs-fb-note">${ico('drop')}<span><b>From the moderators:</b> ${esc(post.status.note)}</span></p>` : ''}
        ${flags}
        ${body}
        ${F.editing === post.uri ? '' : `<div class="rs-row">${tools}</div>`}
      </article>
      ${isMod() ? modPanel(post) : notYet() ? runNote() : ''}
      ${talk(post, threads)}
    </div>`;
  }
  // Pictures someone attached on userinput.app, from Bluesky's image service.
  const images = post => {
    const list = (Array.isArray(post.value?.images) ? post.value.images : []).map(i => ({ cid: i?.image?.ref?.$link || i?.image?.cid, alt: typeof i?.alt === 'string' ? i.alt : '' })).filter(i => typeof i.cid === 'string' && /^[a-z0-9]+$/i.test(i.cid)).slice(0, 4);
    return list.length ? `<div class="rs-fb-pics">${list.map(i => `<img src="https://cdn.bsky.app/img/feed_thumbnail/plain/${esc(post.repo)}/${esc(i.cid)}@jpeg" alt="${esc(i.alt)}" loading="lazy">`).join('')}</div>` : '';
  };
  function editForm(it, b){
    const d = F.editDraft?.uri === it.uri ? F.editDraft : { title: it.live.title, body: it.live.body, tags: it.live.tags }, reply = !it.live.title;
    return `<form class="rs-form rs-fb-edit" data-rs-form="fb-edit"><input type="hidden" name="uri" value="${esc(it.uri)}">
        ${reply ? '' : `<label>Title<input name="title" maxlength="300" required value="${esc(d.title)}"></label>`}
        <label>${reply ? 'Your reply' : 'More about it'}<textarea name="body" rows="${reply ? 3 : 5}" maxlength="10000"${reply ? ' required' : ''}>${esc(d.body)}</textarea></label>
        ${reply || !b ? '' : tagPicker(b, d.tags)}
        <p class="rs-muted">The change is a new record beside the old one, and userinput.app keeps both, as its history.</p>
        <div class="rs-row"><button class="rs-btn rs-primary rs-sm" type="submit"${F.busy === 'edit' ? ' disabled' : ''}>Save</button><button class="rs-link" type="button" data-fb="edit-cancel">Cancel</button></div>
      </form>`;
  }
  // The moderators' tools for a post: its status, and pinning, locking, hiding and banning.
  function modPanel(post){
    if (!canRun()) return runNote();
    const s = F.statusDraft?.uri === post.uri ? F.statusDraft : { state: post.status?.state || 'open', note: post.status?.note || '' };
    const own = recs => (recs || []).some(r => r.repo === viewer());
    const btn = (what, label, cls = '') => `<button class="rs-btn rs-quiet rs-sm${cls}" type="button" data-fb-mod="${what}">${label}</button>`;
    return `<section class="rs-panel rs-fb-mod" aria-labelledby="fbModH"><div class="rs-hrow"><h2 id="fbModH">Moderate</h2>${tip('A status, a pin, a lock, a hide and a ban are each a record in your own account, and they count because the board’s owner made you a moderator. Only whoever made one can undo it.')}</div>
      <form class="rs-form rs-fb-statusform" data-rs-form="fb-status"><input type="hidden" name="uri" value="${esc(post.uri)}">
        <label>Status<select name="state">${STATES.map(([v, l]) => `<option value="${v}"${v === s.state ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label>A note <small>(optional) shown with the status: what’s planned, or why</small><textarea name="note" rows="2" maxlength="1500">${esc(s.note)}</textarea></label>
        <label class="rs-fb-dup"${s.state === 'duplicate' ? '' : ' hidden'}>Duplicate of <small>a link to the other post, here or on userinput.app</small><input name="dup" autocomplete="off" value="${esc(s.dup || '')}"></label>
        <div class="rs-row"><button class="rs-btn rs-primary rs-sm" type="submit"${F.busy === 'status' ? ' disabled' : ''}>Set the status</button>${post.status ? `<span class="rs-muted">Now ${esc(stateWord(post.status.state).toLowerCase())}, set by ${esc(post.status.by === viewer() ? 'you' : nameOf(person(post.status.by)))} ${esc(ago(post.status.createdAt))}</span>` : ''}</div>
      </form>
      <div class="rs-row">
        ${post.pinned ? (own(post.pinned) ? btn('unpin', 'Unpin') : `<span class="rs-muted">Pinned by ${esc(nameOf(person(post.pinned[0].repo)))}</span>`) : btn('pin', `${PIN_ICO}Pin to the top`)}
        ${post.lock ? (post.lock.repo === viewer() ? btn('unlock', 'Open to replies again') : `<span class="rs-muted">Closed by ${esc(nameOf(person(post.lock.repo)))}</span>`) : btn('lock', `${ico('lock')}Close to replies`)}
        ${!post.hidden ? btn('hide', 'Hide it') : own(post.hidden) ? btn('unhide', 'Unhide it') : `<span class="rs-muted">Hidden by ${esc(nameOf(person(post.hidden[0].repo)))}</span>`}
        ${mods().has(post.repo) ? '' : post.banned ? (own(F.board?.bans.filter(x => x.subject === post.repo)) ? `<button class="rs-btn rs-quiet rs-sm" type="button" data-fb-unban="${esc(post.repo)}">Unban ${esc(nameOf(person(post.repo)))}</button>` : '') : `<button class="rs-btn rs-quiet rs-sm rs-danger" type="button" data-fb-ban="${esc(post.repo)}">Ban ${esc(nameOf(person(post.repo)))}</button>`}
      </div>
    </section>`;
  }

  /* ---------- replies ---------- */
  function talk(post, threads){
    const list = threads.filter(t => showsReply(t) || t.replies.some(showsReply));
    const count = th => (showsReply(th) ? 1 : 0) + th.replies.filter(showsReply).length, n = list.reduce((s, t) => s + count(t), 0);
    const locked = !!post.lock, root = F.replyTo === null;
    const items = list.map(t => {
      const here = F.replyTo && (F.replyTo === t.uri || t.replies.some(r => r.uri === F.replyTo));
      const rs = t.replies.filter(showsReply);
      return `<li class="rs-thread"><ol class="rs-people rs-comment-list">${showsReply(t) ? replyLi(t, post) : `<li class="rs-comment rs-muted">A reply that isn’t shown.</li>`}</ol>
        ${rs.length ? `<ol class="rs-people rs-comment-list rs-replies">${rs.map(r => replyLi(r, post, true)).join('')}</ol>` : ''}
        ${here ? `<div class="rs-replyform">${replyForm(post, F.replyTo)}</div>` : ''}</li>`;
    }).join('');
    const write = locked ? `<p class="rs-note">${ico('lock')}<span>The moderators have closed this to new replies.</span></p>`
      : canWrite() ? (root ? replyForm(post, null) : '')
      : signedIn() ? `<div class="rs-row"><button class="rs-btn rs-quiet rs-sm" type="button" data-fb="again">Sign in again to reply</button></div>`
      : host.signIn ? `<div class="rs-row"><button class="rs-btn rs-quiet rs-sm" type="button" data-rs-act="signin">Sign in to reply</button></div>` : '';
    return `<section class="rs-talk" id="replies" aria-labelledby="fbTalkH"><div class="rs-hrow"><h2 id="fbTalkH">Replies${n ? ` <span class="rs-count">${n}</span>` : ''}</h2>${tip('Each reply is a record in its writer’s own account, pointing at this post, the same as on userinput.app. Only whoever wrote one can change or delete it.')}</div>
      ${items ? `<ol class="rs-comments">${items}</ol>` : '<p class="rs-muted">Nobody’s replied yet.</p>'}
      ${write}</section>`;
  }
  function replyLi(r, post, under = false){
    const p = person(r.repo), mine = r.repo === viewer(), role = r.repo === post.repo ? 'Posted this' : mods().has(r.repo) ? 'Moderator' : '';
    const to = under && r.to ? ` <span class="rs-muted">to ${esc(r.to.repo === viewer() ? 'you' : nameOf(person(r.to.repo)))}</span>` : '';
    const ban = isMod() && canRun() && !mine && !mods().has(r.repo);
    const tools = [
      canWrite() && !post.lock ? `<button class="rs-link" type="button" data-fb-reply="${esc(r.uri)}">Reply</button>` : '',
      mine && canWrite() ? `<button class="rs-link" type="button" data-fb-edit="${esc(r.uri)}">Edit</button>` : '',
      mine && canWrite() ? `<button class="rs-link rs-danger" type="button" data-fb-delete="${esc(r.uri)}">Delete</button>` : '',
      isMod() && canRun() && !mine ? (r.hidden ? (r.hidden.some(h => h.repo === viewer()) ? `<button class="rs-link" type="button" data-fb-unhide="${esc(r.uri)}">Unhide</button>` : '') : `<button class="rs-link rs-danger" type="button" data-fb-hide="${esc(r.uri)}">Hide</button>`) : '',
      ban && !r.banned ? `<button class="rs-link rs-danger" type="button" data-fb-ban="${esc(r.repo)}">Ban</button>` : ''
    ].join('');
    const notes = [ago(r.createdAt), r.edits ? 'edited' : '', !under && r.lost ? 'in reply to one that isn’t here' : '', r.hidden ? 'hidden' : '', r.banned ? 'from someone banned' : '', r.late ? 'after it was closed' : ''].filter(Boolean).join(' · ');
    return `<li class="rs-comment${F.lit === r.uri ? ' rs-fresh' : ''}" id="r-${esc(r.rkey)}">${face(p)}<div>
        <span>${a('profile/' + r.repo, `<b>${esc(mine ? 'You' : nameOf(p))}</b>`, 'rs-who')}${role ? `<span class="rs-role">${esc(role)}</span>` : ''}${to}</span>
        <small>${esc(notes)}</small>
        ${F.editing === r.uri ? editForm(r, null) : `<div class="rs-spec rs-comment-text">${renderMarkdown(r.live.body)}</div>${tools ? `<div class="rs-row">${tools}</div>` : ''}`}
      </div></li>`;
  }
  function replyForm(post, parent){
    const k = parent || 'post', text = F.replies[k] || '', to = parent && F.thread?.data?.replies.find(r => r.uri === parent);
    const label = !to ? 'Add a reply' : to.repo === viewer() ? 'Your reply' : `Your reply to ${esc(nameOf(person(to.repo)))}`;
    return `<form class="rs-form rs-commentform" data-rs-form="fb-reply">${parent ? `<input type="hidden" name="parent" value="${esc(parent)}">` : ''}
        <label>${label} <small>(public, from your account)</small><textarea name="body" rows="${parent ? 3 : 2}" maxlength="10000" required>${esc(text)}</textarea></label>
        <div class="rs-row"><button class="rs-btn rs-primary rs-sm" type="submit"${F.busy === 'reply' ? ' disabled' : ''}>Reply</button>${parent ? '<button class="rs-link" type="button" data-fb="reply-cancel">Cancel</button>' : ''}</div>
      </form>`;
  }

  /* ---------- writing ---------- */
  // Each write is followed by reading again what it changed, with what was just written laid
  // over it (../core/feedback.js, createLocal), so it shows at once.
  async function writing(what, fn, done){
    if (F.busy) return;
    F.busy = what; render();
    try { const r = await fn(); F.busy = null; await done?.(r); }
    catch (e) {
      console.warn('rainshare feedback', what, e);
      F.busy = null;
      toast(e?.name === 'ScopeMissingError' ? 'Your sign-in is from before Rainshare could do this. Sign in again.' : plainText(e));
      if (e?.name === 'ScopeMissingError') host.refreshSignIn?.();
    }
    render();
  }
  const lit = uri => { F.lit = uri; setTimeout(() => { if (F.lit === uri) { F.lit = null; } }, 2500); };
  // (The board first: a post's page takes what's pinned, hidden and banned from it.)
  const again = async () => {
    await load(true);
    const ref = F.thread?.key?.split('/');
    if (ref && onScreen() && ui.sub() !== 'feedback') await loadThread({ repo: ref[0], rkey: ref[1] }, true);
  };
  const item = uri => (F.thread?.data?.post?.uri === uri && F.thread.data.post) || F.board?.items.find(i => i.uri === uri) || F.thread?.data?.replies.find(r => r.uri === uri) || null;
  const pressed = form => [...form.querySelectorAll('[data-rs-toggles="fb-tags"] [aria-pressed="true"]')].map(b => b.dataset.v);

  async function vote(uri){
    const it = item(uri);
    if (!it) return;
    if (!signedIn()) return host.signIn?.(ui.sub());
    if (!canWrite()) return host.refreshSignIn?.();
    // (Shown at once; put back if it doesn't go through.)
    const was = { voted: it.voted, votes: it.votes };
    await writing('vote:' + uri, async () => {
      if (it.voted) await w().unvote(it); else await w().vote(it);
      const on = !was.voted, n = Math.max(0, (was.votes || 0) + (on ? 1 : -1));
      for (const x of [F.board?.items.find(i => i.uri === uri), F.thread?.data?.post?.uri === uri ? F.thread.data.post : null]) if (x) Object.assign(x, { voted: on, votes: n, myVote: null });
    });
  }
  function submit(form){
    const kind = form.dataset.rsForm, fd = new FormData(form);
    if (kind === 'fb-post') {
      const input = { title: String(fd.get('title') || ''), body: String(fd.get('body') || ''), tags: pressed(form) };
      F.draft = input;
      return writing('post', () => w().post(F.board.space, input), async rec => {
        F.draft = null; F.compose = false; toast('Posted. Thanks!');
        lit(rec.uri); F.at = 0; go(`feedback/${rec.repo}/${rec.rkey}`);
      });
    }
    if (kind === 'fb-reply') {
      const post = F.thread?.data?.post, parentUri = String(fd.get('parent') || ''), parent = parentUri ? F.thread.data.replies.find(r => r.uri === parentUri) : null, body = String(fd.get('body') || '');
      if (!post) return;
      if (parentUri && !parent) { toast('That reply has gone.'); F.replyTo = null; render(); return; }
      F.replies[parentUri || 'post'] = body;
      return writing('reply', () => w().reply(post, { body, parent }), async rec => {
        F.replies[parentUri || 'post'] = ''; F.replyTo = null; lit(rec.uri); toast('Replied');
        await again();
        root().querySelector('#r-' + CSS.escape(rec.rkey))?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
    if (kind === 'fb-edit') {
      const it = item(String(fd.get('uri') || ''));
      if (!it) return;
      const input = { title: String(fd.get('title') || ''), body: String(fd.get('body') || ''), tags: pressed(form) };
      F.editDraft = { uri: it.uri, ...input };
      return writing('edit', () => w().edit(it, input, F.board?.space), async () => { F.editing = null; F.editDraft = null; toast('Saved'); await again(); });
    }
    if (kind === 'fb-status') {
      const it = item(String(fd.get('uri') || '')), state = String(fd.get('state') || ''), note = String(fd.get('note') || ''), dupAt = String(fd.get('dup') || '').trim();
      if (!it) return;
      F.statusDraft = { uri: it.uri, state, note, dup: dupAt };
      const dupRef = state === 'duplicate' && dupAt ? refFrom(dupAt) : null;
      if (state === 'duplicate' && dupAt && !dupRef) { toast('That isn’t a link to a post on the board.'); return; }
      const dup = dupRef ? F.board?.items.find(i => i.repo === dupRef.repo && i.rkey === dupRef.rkey) : null;
      if (dupRef && !dup) { toast('That post isn’t on this board.'); return; }
      return writing('status', () => w().status(it, state, note, { duplicateOf: dup }), async () => { F.statusDraft = null; toast(`Marked ${stateWord(state).toLowerCase()}`); await again(); });
    }
    if (kind === 'fb-addmod') {
      const who = String(fd.get('who') || ''), role = String(fd.get('role') || 'moderator');
      return writing('addmod', async () => w().addModerator(F.board.space, isDid(who.trim()) ? who.trim() : await resolveHandle(who), role), async () => { toast('Added'); form.reset(); await load(true); });
    }
    if (kind === 'fb-board') {
      const labels = fd.getAll('tag-label').map(String), values = fd.getAll('tag-value').map(String);
      const input = { name: String(fd.get('name') || ''), description: String(fd.get('description') || ''), tags: labels.map((label, i) => ({ value: values[i] || '', label })) };
      F.boardDraft = { ...input, tags: input.tags.filter(t => t.label.trim()) };
      return writing('board', () => w().saveBoard(F.board.space, input), async () => { F.boardDraft = null; toast('The board’s saved'); await load(true); });
    }
  }
  async function moderate(what, uri){
    const post = F.thread?.data?.post;
    if (!post || post.uri !== uri && !['ban', 'unban'].includes(what)) return;
    const b = F.board;
    const say = { pin: 'Pinned', unpin: 'Unpinned', lock: 'Closed to new replies', unlock: 'Open to replies again', hide: 'Hidden', unhide: 'Unhidden' }[what];
    if (what === 'hide' && !await confirmBox({ title: 'Hide this post?', text: 'It’s hidden from everyone but the board’s moderators, here and on userinput.app.', yes: 'Hide it', no: 'Cancel', tone: 'danger', icon: 'shield' })) return;
    await writing('mod', () => ({
      pin: () => w().pin(b.space, post), unpin: () => w().unpin(post.pinned),
      lock: () => w().lock(post), unlock: () => w().unlock(post.lock),
      hide: () => w().hide(b.space, post), unhide: () => w().unhide(post.hidden)
    })[what](), async () => { toast(say); await again(); });
  }
  async function hideReply(uri, on){
    const r = F.thread?.data?.replies.find(x => x.uri === uri);
    if (!r) return;
    if (on && !await confirmBox({ title: 'Hide this reply?', text: 'It’s hidden from everyone but the board’s moderators, here and on userinput.app.', yes: 'Hide it', no: 'Cancel', tone: 'danger', icon: 'shield' })) return;
    await writing('mod', () => on ? w().hide(F.board.space, r) : w().unhide(r.hidden), async () => { toast(on ? 'Hidden' : 'Unhidden'); await again(); });
  }
  async function ban(did, on){
    const who = nameOf(person(did));
    if (on && !await confirmBox({ title: `Ban ${who} from the board?`, text: 'They can’t post here, and what they’ve posted is hidden from everyone but its moderators.', yes: 'Ban', no: 'Cancel', tone: 'danger', icon: 'shield' })) return;
    await writing('mod', () => on ? w().ban(F.board.space, did) : w().unban(F.board.bans.filter(x => x.subject === did)), async () => { toast(on ? `${who} is banned` : `${who} is unbanned`); await again(); });
  }
  async function remove(uri){
    const it = item(uri);
    if (!it) return;
    const post = !!it.live?.title;
    if (!await confirmBox({ title: post ? 'Delete this post?' : 'Delete this reply?', text: post ? 'It’s removed from your account, and from the board.' : 'It’s removed from your account.', yes: 'Delete', no: 'Keep it', tone: 'danger' })) return;
    await writing('delete', () => w().remove(it), async () => {
      toast('Deleted');
      if (post) { F.at = 0; F.thread = null; go('feedback'); load(true); } else await again();
    });
  }

  // Keep what's been typed across redraws.
  function stash(){
    const r = root();
    const pf = r.querySelector('[data-rs-form="fb-post"]');
    if (pf) { const fd = new FormData(pf); F.draft = { title: String(fd.get('title') || ''), body: String(fd.get('body') || ''), tags: pressed(pf) }; }
    const rf = r.querySelector('[data-rs-form="fb-reply"]');
    if (rf) { const fd = new FormData(rf); F.replies[String(fd.get('parent') || '') || 'post'] = String(fd.get('body') || ''); }
    const ef = r.querySelector('[data-rs-form="fb-edit"]');
    if (ef) { const fd = new FormData(ef); F.editDraft = { uri: String(fd.get('uri') || ''), title: String(fd.get('title') || ''), body: String(fd.get('body') || ''), tags: pressed(ef) }; }
    const sf = r.querySelector('[data-rs-form="fb-status"]');
    if (sf) { const fd = new FormData(sf); F.statusDraft = { uri: String(fd.get('uri') || ''), state: String(fd.get('state') || ''), note: String(fd.get('note') || ''), dup: String(fd.get('dup') || '') }; }
    const bf = r.querySelector('[data-rs-form="fb-board"]');
    if (bf) { const fd = new FormData(bf), labels = fd.getAll('tag-label').map(String), values = fd.getAll('tag-value').map(String); F.boardDraft = { name: String(fd.get('name') || ''), description: String(fd.get('description') || ''), tags: labels.map((label, i) => ({ value: values[i] || '', label })).filter(t => t.label.trim() || t.value) }; }
  }
  const root = () => ui.root;
  const refocus = sel => root().querySelector(sel)?.focus();

  /** A press on the feedback screens: true if it was this module's. */
  function click(t){
    const b = t.closest('[data-fb]');
    if (b) {
      const k = b.dataset.fb;
      if (k === 'compose') { stash(); F.compose = !F.compose; render(); if (F.compose) refocus('[data-rs-form="fb-post"] [name=title]'); return true; }
      if (k === 'compose-cancel') { F.compose = false; F.draft = null; render(); refocus('[data-fb="compose"]'); return true; }
      if (k === 'again') { host.refreshSignIn?.(); return true; }
      if (k === 'run') { stash(); F.running = !F.running; render(); refocus('[data-fb="run"]'); return true; }
      if (k === 'edit-cancel') { const u = F.editing; F.editing = null; F.editDraft = null; render(); refocus(`[data-fb-edit="${CSS.escape(u || '')}"]`); return true; }
      if (k === 'reply-cancel') { stash(); F.replyTo = null; render(); return true; }
      if (k === 'thread-again') { const [repo, rkey] = (F.thread?.key || '').split('/'); if (repo) loadThread({ repo, rkey }, true); return true; }
    }
    const v = t.closest('[data-fb-vote]'); if (v) { vote(v.dataset.fbVote); return true; }
    const e = t.closest('[data-fb-edit]'); if (e) { stash(); F.editing = e.dataset.fbEdit; F.editDraft = null; render(); refocus('[data-rs-form="fb-edit"] input:not([type=hidden]), [data-rs-form="fb-edit"] textarea'); return true; }
    const d = t.closest('[data-fb-delete]'); if (d) { remove(d.dataset.fbDelete); return true; }
    const rp = t.closest('[data-fb-reply]'); if (rp) { stash(); F.replyTo = rp.dataset.fbReply; render(); refocus('.rs-replyform textarea'); return true; }
    const m = t.closest('[data-fb-mod]'); if (m) { stash(); moderate(m.dataset.fbMod, F.thread?.data?.post?.uri); return true; }
    const h = t.closest('[data-fb-hide]'); if (h) { stash(); hideReply(h.dataset.fbHide, true); return true; }
    const uh = t.closest('[data-fb-unhide]'); if (uh) { stash(); hideReply(uh.dataset.fbUnhide, false); return true; }
    const bn = t.closest('[data-fb-ban]'); if (bn) { stash(); ban(bn.dataset.fbBan, true); return true; }
    const ub = t.closest('[data-fb-unban]'); if (ub) { stash(); ban(ub.dataset.fbUnban, false); return true; }
    const am = t.closest('[data-fb-addmod]'); if (am) { stash(); writing('addmod', () => w().addModerator(F.board.space, am.dataset.fbAddmod, 'moderator'), async () => { toast('Added'); await load(true); }); return true; }
    const um = t.closest('[data-fb-unmod]');
    if (um) {
      const m2 = F.board?.members.find(x => x.uri === um.dataset.fbUnmod);
      if (m2) confirmBox({ title: `Take ${nameOf(person(m2.did))} off the board’s moderators?`, text: 'What they’ve already done stays.', yes: 'Take them off', no: 'Cancel', tone: 'danger' })
        .then(yes => yes && writing('addmod', () => w().removeModerator(m2), async () => { toast('Taken off'); await load(true); }));
      return true;
    }
    return false;
  }
  // Choosing "Duplicate" asks which post it duplicates.
  function changed(t){
    if (t.name === 'state' && t.closest('[data-rs-form="fb-status"]')) { const dup = t.form.querySelector('.rs-fb-dup'); if (dup) dup.hidden = t.value !== 'duplicate'; return true; }
    return false;
  }

  return {
    /** The screen for `sub`: the board, or one post on it. */
    view: sub => sub === 'feedback' ? listView() : postView(sub),
    /** Entering `sub`: what it shows is read, or read again if it's been a minute. */
    enter(sub){
      if (sub === 'feedback') { F.editing = null; load(); return; }
      const [, repo, rkey] = sub.split('/');
      if (F.thread?.key !== repo + '/' + rkey) { F.editing = null; F.replyTo = null; F.statusDraft = null; }
      loadThread({ repo, rkey });
    },
    again: () => load(true),
    click, submit, changed, stash,
    reset(){ F = fresh(); }
  };
}

