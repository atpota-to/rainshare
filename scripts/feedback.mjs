#!/usr/bin/env node
// Rainshare's feedback board, from a terminal: for the maintainer, and for the routine that
// turns planned posts into draft pull requests (.claude/skills/feedback/SKILL.md). The board is
// on userinput.app, and ../core/feedback.js reads it. No dependencies; Node 18 or later.
//
//   node scripts/feedback.mjs board [--state planned] [--json]   what's on the board, by status
//   node scripts/feedback.mjs planned [--json]                   briefs for what's planned and safe to hand over
//   node scripts/feedback.mjs show <post> [--json]               one post, and where it stands
//   node scripts/feedback.mjs status <post> <state> [--note …]   mark a post (as the board's owner or a moderator)
//   node scripts/feedback.mjs whoami                             who a status would be written as, and whether it counts
//
// <post> is its userinput.app link or its at:// address. --space <at://…> reads another board
// instead of Rainshare's (to try this out on a board of your own).
//
// Reading needs no sign-in. Writing a status signs in with an app password from
// RAINSHARE_HANDLE and RAINSHARE_APP_PASSWORD, the same as Rainshare's CLI. The account must own
// the board or be one of its moderators, or userinput.app (and this) won't count what it writes.
import { readBoard, findSpace, readModerators, readPost, postRef, forAgents, feedbackBrief, statusRecord, stateWord, groupOf, GROUPS, STATES, STATUS, SPACE, OWNER } from '../core/feedback.js';
import { printable } from '../core/brief.js';
import { resolveHandle, pdsOf, parseUri, isDid, isRkey } from '../core/net.js';

class Stop extends Error {}
const out = s => process.stdout.write(printable(s) + '\n');
const json = v => process.stdout.write(JSON.stringify(v, null, 2) + '\n');

function parseArgs(argv){
  const pos = [], opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a.startsWith('--')) { const k = a.slice(2); opts[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
    else pos.push(a);
  }
  return { pos, opts };
}

async function spaceFrom(opts){
  if (opts.space) {
    const at = parseUri(opts.space);
    if (!at || at.collection !== SPACE || !isDid(at.repo) || !isRkey(at.rkey)) throw new Stop('--space takes a board’s at:// address: at://<did>/app.userinput.space/<key>');
    const s = await findSpace({ owner: at.repo, rkey: at.rkey });
    if (!s) throw new Stop('There’s no board at ' + opts.space);
    return s;
  }
  const s = await findSpace();
  if (!s) throw new Stop(`@rainshare.dev (${OWNER}) hasn’t made a board on userinput.app yet. Make one there, signed in as that account.`);
  return s;
}
async function postFrom(ref, opts){
  const r = postRef(ref);
  if (!r) throw new Stop('Give a post as its userinput.app link (https://userinput.app/d/<did>/<key>) or its at:// address.');
  const space = await spaceFrom(opts), mods = await readModerators(space);
  const item = await readPost(space, mods, r);
  if (!item) throw new Stop('That post isn’t on the board, or it’s been deleted.');
  return { space, mods, item };
}

// What's shown of a post: its words as they are now (with edits), for people reading the board.
const line = it => `${it.votes}▲ ${it.live.title.replace(/\s+/g, ' ').slice(0, 100)}${it.replies ? ` (${it.replies} ${it.replies === 1 ? 'reply' : 'replies'})` : ''}\n    ${it.link}`;
const view = it => ({ uri: it.uri, cid: it.cid, link: it.link, author: it.repo, createdAt: it.createdAt, title: printable(it.live.title), body: printable(it.live.body), tags: it.live.tags, edits: it.edits, votes: it.votes, replies: it.replies, status: it.status ? { ...it.status, note: printable(it.status.note) } : null });

async function board(opts){
  const b = await readBoard({ space: await spaceFrom(opts) });
  const items = opts.state ? b.items.filter(it => (it.status?.state || 'new') === opts.state) : b.items;
  if (opts.json) return json({ space: b.space, moderators: b.moderators, items: items.map(view) });
  out(`${b.space.name || 'Feedback'}: ${b.space.link}`);
  for (const [key, heading] of GROUPS) {
    const here = items.filter(it => groupOf(it) === key);
    if (!here.length) continue;
    out(`\n${heading} (${here.length})`);
    for (const it of here) out('  ' + line(it) + (it.status?.note ? `\n    Note: ${it.status.note.replace(/\s+/g, ' ').slice(0, 200)}` : ''));
  }
}

// What the routine works from: every planned post, most votes first, with the brief for each one it can take.
async function planned(opts){
  const b = await readBoard({ space: await spaceFrom(opts) });
  const list = b.items.filter(it => it.status?.state === 'planned').map(it => {
    const f = forAgents(it);
    return { uri: it.uri, link: it.link, votes: it.votes, plannedAt: it.status.createdAt, ok: f.ok, why: f.why, flags: f.flags, brief: feedbackBrief(it) };
  });
  if (opts.json) return json(list);
  if (!list.length) return out('Nothing on the board is planned.');
  for (const p of list) {
    if (!p.ok) { out(`Skipped ${p.link}: ${p.why}\n`); continue; }
    out(`---\n${p.brief}`);
  }
}

async function show(ref, opts){
  const { item } = await postFrom(ref, opts);
  const f = forAgents(item);
  if (opts.json) return json({ ...view(item), routine: { ok: f.ok, why: f.why, flags: f.flags } });
  out(`${item.live.title}\n${item.link}\n\nStatus: ${item.status ? stateWord(item.status.state) : 'New'}${item.status?.note ? `\nNote: ${item.status.note}` : ''}\nVotes: ${item.votes}  Replies: ${item.replies}${item.edits ? `  Edited ${item.edits} time${item.edits === 1 ? '' : 's'}` : ''}\n\n${item.live.body}\n\nThe routine ${f.ok ? 'can take it.' : 'won’t take it: ' + f.why.replace(/^./, c => c.toLowerCase())}`);
}

/* ---------- writing a status, signed in with an app password ---------- */
async function post(url, body, token){
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Stop(data.message || data.error || `${r.status} from ${new URL(url).host}`);
  return data;
}
async function signIn(){
  const handle = process.env.RAINSHARE_HANDLE, password = process.env.RAINSHARE_APP_PASSWORD;
  if (!handle || !password) throw new Stop('Writing a status needs RAINSHARE_HANDLE and RAINSHARE_APP_PASSWORD: an app password for @rainshare.dev, or for an account it’s made a moderator of the board.');
  const did = await resolveHandle(handle).catch(() => { throw new Stop(`Couldn’t find ${handle}.`); });
  const pds = await pdsOf(did);
  const s = await post(`${pds}/xrpc/com.atproto.server.createSession`, { identifier: did, password });
  return { did: s.did, handle: s.handle, pds, token: s.accessJwt };
}

async function whoami(opts){
  const s = await signIn(), space = await spaceFrom(opts), mods = await readModerators(space);
  out(`@${s.handle} (${s.did})\n${mods.has(s.did) ? (s.did === space.repo ? 'Owns the board.' : 'A moderator of the board.') : 'Not the board’s owner or a moderator: a status it writes won’t count.'}`);
}

async function setStatus(ref, state, opts){
  if (!STATES.some(x => x[0] === state)) throw new Stop(`Not a status: ${state}. One of: ${STATES.map(x => x[0]).join(', ')}`);
  const note = typeof opts.note === 'string' ? opts.note : '';
  const s = await signIn();
  const { mods, item } = await postFrom(ref, opts);
  if (!mods.has(s.did)) throw new Stop(`@${s.handle} doesn’t own the board and isn’t one of its moderators, so userinput.app wouldn’t count a status from it. The owner can make it a moderator on userinput.app.`);
  if (item.status?.state === state && (item.status.note || '') === note.trim()) return out(`Already ${stateWord(state).toLowerCase()}: ${item.link}`);
  const record = statusRecord(item, state, note);
  const r = await post(`${s.pds}/xrpc/com.atproto.repo.createRecord`, { repo: s.did, collection: STATUS, record }, s.token);
  if (opts.json) return json({ uri: r.uri, cid: r.cid, record });
  out(`${stateWord(state)}: ${item.link}`);
}

const HELP = `Rainshare's feedback board, on userinput.app

  board [--state <state>] [--json]   what's on the board, by status
  planned [--json]                   briefs for the planned posts the routine can take
  show <post> [--json]               one post, and where it stands
  status <post> <state> [--note …]   mark a post: ${STATES.map(x => x[0]).join(', ')}
  whoami                             who a status would be written as

<post> is a userinput.app link or an at:// address. --space <at://…> reads another board.
Writing a status needs RAINSHARE_HANDLE and RAINSHARE_APP_PASSWORD.`;

async function main(){
  const { pos: [cmd, ...pos], opts } = parseArgs(process.argv.slice(2));
  switch (cmd) {
    case 'board': case 'list': return board(opts);
    case 'planned': return planned(opts);
    case 'show': return show(pos[0], opts);
    case 'status': return setStatus(pos[0], pos[1], opts);
    case 'whoami': return whoami(opts);
    case undefined: case 'help': case '--help': case '-h': return out(HELP);
    default: throw new Stop(`Not a command: ${cmd}\n\n${HELP}`);
  }
}
main().catch(e => {
  process.stderr.write(printable(e instanceof Stop ? e.message : (e?.stack || String(e))) + '\n');
  process.exit(1);
});
