// Posting to the forges that live on atproto, as whoever is signed in: opening an issue or
// leaving a comment on knotless or Tangled. The two keep these in different places:
//
//   knotless  An issue or a comment is a record in its author's own account that names the
//             repo (dev.knotless.issue, dev.knotless.comment). Posting one is an ordinary
//             write to your own repo.
//   Tangled   They're kept with the repo, on the knot that hosts it. Your server vouches for
//             you with a token good for a minute (com.atproto.server.getServiceAuth), the
//             knot takes the write, and a record in your own account says it was you
//             (org.tangled.graph.attestation). It's what Tangled's own web app does.
//
// `agent` is { did, fetchHandler(path, init) }: requests to your own server, signed in. The
// sign-in has to allow these writes (FORGE_SCOPES in ./ns.js); one that doesn't is refused by
// your server, which comes back as a ForgeError named 'NotConnected'.
import { xrpc, getJSON, parseUri, isDid } from './net.js';
import { SEED } from './ns.js';
import { describeSubject, kindOf, repoPageOf, tangledRepoDid, tangledTicket, knotlessRepo, knotlessRef, knotlessIssueSubject, KNOTLESS, BOBBIN, TICKET } from './subjects.js';

export class ForgeError extends Error {
  constructor(name, message, forge){ super(message); this.name = name; this.forge = forge; }
}
export const FORGE_SAID = { knotless: 'knotless', tangled: 'Tangled' };

/** Which forge a subject is on, if it's one Rainshare can post to: 'knotless', 'tangled' or null. */
export const writableForge = subject => { const f = describeSubject(subject)?.forge; return f === 'knotless' || f === 'tangled' ? f : null; };

const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;
const clip = (s, max) => { const t = String(s || '').trim(), g = seg ? [...seg.segment(t)].map(x => x.segment) : [...t]; return g.length > max ? g.slice(0, max - 1).join('') + '…' : t; };

/* ---------- your own server ---------- */
async function own(agent, forge, path, init){
  if (!agent?.did) throw new ForgeError('NotSignedIn', 'Sign in first.', forge);
  const r = await agent.fetchHandler(path, init);
  if (r.ok) return r.json().catch(() => ({}));
  const body = await r.json().catch(() => ({})), said = `${body.error || ''} ${body.message || ''}`;
  if (r.status === 401 || r.status === 403 || /scope|permission|not allowed|forbidden/i.test(said)) throw new ForgeError('NotConnected', `Rainshare isn’t allowed to post on ${FORGE_SAID[forge]} for you yet.`, forge);
  throw new ForgeError(body.error || 'HTTP' + r.status, body.message || `Your server refused it (${r.status}).`, forge);
}
const create = (agent, forge, collection, record) => own(agent, forge, '/xrpc/com.atproto.repo.createRecord', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ repo: agent.did, collection, record, validate: false })
});

/* ---------- knotless ---------- */
// A record on knotless names its repo by the repo's own record and its key, which never change.
async function knotlessRepoRef(page){
  const at = knotlessRepo(page);
  if (!at) throw new ForgeError('NoRepo', 'That isn’t a knotless repo.', 'knotless');
  const r = await xrpc(KNOTLESS, 'dev.knotless.getRepo', { repo: at }).catch(() => null);
  if (!r?.uri || !r.key) throw new ForgeError('NoRepo', 'knotless couldn’t find that repo.', 'knotless');
  if (r.private) throw new ForgeError('Private', 'That repo is private. Rainshare only posts to public ones.', 'knotless');
  return { uri: r.uri, key: r.key };
}
async function knotlessIssue(agent, subject, { title, body }){
  const page = repoPageOf(subject), repo = await knotlessRepoRef(page);
  const text = String(body || '').trim().slice(0, 18000);
  const r = await create(agent, 'knotless', 'dev.knotless.issue', { $type: 'dev.knotless.issue', repo, title: clip(title, 300), ...(text ? { body: text } : {}), createdAt: new Date().toISOString() });
  return knotlessIssueSubject(page, r.uri);
}
async function knotlessComment(agent, subject, text){
  const ref = knotlessRef(subject.url) || { page: repoPageOf(subject), uri: subject.uri };
  if (!ref.uri || parseUri(ref.uri)?.collection !== 'dev.knotless.issue') throw new ForgeError('NoIssue', 'There’s no issue to comment on.', 'knotless');
  const repo = await knotlessRepoRef(ref.page);
  const r = await create(agent, 'knotless', 'dev.knotless.comment', { $type: 'dev.knotless.comment', repo, subject: ref.uri, body: text, createdAt: new Date().toISOString() });
  return { uri: r.uri, href: subject.url || null };
}

/* ---------- Tangled ---------- */
// Where a write is sent comes from the repo's own records, which anyone can write. So a knot
// has to be a public domain name: not an address on someone's own network, and no port.
const KNOT_HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
/** Where a Tangled repo's issues and comments are written: its DID, the knot hosting it, and its page. */
async function tangledPlace(subject){
  // An issue's own address says which repo it's in, and that's believed over anything else a
  // record says about itself.
  const page = repoPageOf(subject), at = parseUri(subject?.uri);
  const repoDid = (at?.collection === TICKET ? at.repo : null) || subject?.repo || subject?.repoDid || await tangledRepoDid(page).catch(() => null);
  if (!isDid(repoDid)) throw new ForgeError('NoRepo', 'Tangled couldn’t find that repo.', 'tangled');
  const r = await xrpc(BOBBIN, 'org.tangled.repo.getRepoByRepoDid', { repoDid }).catch(() => null);
  if (!r?.knot || !KNOT_HOST.test(r.knot)) throw new ForgeError('NoRepo', 'Tangled couldn’t say where that repo is hosted.', 'tangled');
  // An older knot keeps issues elsewhere, and says so by leaving this out of what it can do.
  const can = await getJSON(`https://${r.knot}/xrpc/org.tangled.knot.describeKnot`, { timeout: 8000 }).catch(() => null);
  if (Array.isArray(can?.capabilities) && !can.capabilities.includes('knot-social-writes')) throw new ForgeError('OldKnot', 'That repo’s host doesn’t take issues and comments from other apps yet. Open it on Tangled instead.', 'tangled');
  return { repoDid, knot: r.knot, page };
}
async function knotCreate(agent, { repoDid, knot }, collection, record){
  // Your server vouches for this one call: a token for this repo and this method, good for a minute.
  // (The knot checks it against the repo, not against itself.)
  const ask = new URLSearchParams({ aud: repoDid, lxm: 'com.atproto.repo.createRecord', exp: String(Math.floor(Date.now() / 1000) + 60) });
  const { token } = await own(agent, 'tangled', '/xrpc/com.atproto.server.getServiceAuth?' + ask, { method: 'GET' });
  if (!token) throw new ForgeError('NoToken', 'Your server didn’t vouch for the post.', 'tangled');
  const res = await fetch(`https://${knot}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ repo: repoDid, collection, record })
  });
  const saved = await res.json().catch(() => ({}));
  if (!res.ok || !saved.uri) throw new ForgeError(saved.error || 'HTTP' + res.status, saved.message || `Tangled refused it (${res.status}).`, 'tangled');
  // The knot's word alone isn't tied to you: a record in your own account says the post was
  // yours. If that part fails the post still stands, so it isn't a reason to post twice.
  const change = /^([0-9a-f]{40}|[0-9a-f]{64})$/.test(saved['x-tngl-change'] || '') ? saved['x-tngl-change'] : undefined;
  const attested = await create(agent, 'tangled', 'org.tangled.graph.attestation', { $type: 'org.tangled.graph.attestation', subject: { uri: saved.uri, cid: saved.cid }, ...(change ? { change } : {}), createdAt: new Date().toISOString() }).then(() => true, () => false);
  return { uri: saved.uri, cid: saved.cid, attested };
}
const markdown = text => ({ $type: 'org.tangled.markup.markdown', text });
async function tangledIssue(agent, subject, { title, body }){
  const place = await tangledPlace(subject), text = String(body || '').trim();
  const saved = await knotCreate(agent, place, TICKET, {
    $type: TICKET, title: { $type: 'org.tangled.markup.markdown#inline', text: clip(title, 256) },
    ...(text ? { body: markdown(text) } : {}),               // the knot refuses an empty body, so a blank one is left out
    state: 'open', createdAt: new Date().toISOString()
  });
  return { $type: `${SEED}#tangledIssue`, uri: saved.uri, cid: saved.cid, repo: place.repoDid, repoUrl: place.page, url: `${place.page}/issues/${parseUri(saved.uri)?.rkey}` };
}
async function tangledComment(agent, subject, text){
  // The comment goes on the issue the page shows a link to, whatever else the record names.
  const uri = await tangledTicket(subject.url || subject.uri).catch(() => null);
  if (!uri) throw new ForgeError('NoIssue', 'There’s no issue to comment on.', 'tangled');
  // A comment has to name the issue as it is now, or the knot refuses it.
  const now = await xrpc(BOBBIN, 'org.tangled.track.getTicketView', { uri }).catch(() => null);
  if (!now?.cid) throw new ForgeError('NoIssue', 'Tangled couldn’t find that issue.', 'tangled');
  const place = await tangledPlace({ ...subject, uri });
  const saved = await knotCreate(agent, place, 'org.tangled.feed.comment', {
    $type: 'org.tangled.feed.comment', subject: { $type: 'com.atproto.repo.strongRef', uri, cid: now.cid }, body: markdown(text), createdAt: new Date().toISOString()
  });
  return { uri: saved.uri, href: subject.url || null, attested: saved.attested };
}

/* ---------- either ---------- */
/**
 * Open an issue on the repo a subject points at, from a title and a Markdown body. Returns the
 * subject for the new issue, to point a seed at.
 */
export async function forgeIssue(agent, subject, { title, body } = {}){
  const forge = writableForge(subject);
  if (!forge) throw new ForgeError('NoForge', 'Rainshare can open issues on knotless and Tangled only.', null);
  if (!String(title || '').trim()) throw new ForgeError('NoTitle', 'An issue needs a title.', forge);
  return forge === 'knotless' ? knotlessIssue(agent, subject, { title, body }) : tangledIssue(agent, subject, { title, body });
}
/** Comment on the issue a subject points at. Returns { uri, href }: the comment, and the page it shows on. */
export async function forgeComment(agent, subject, text){
  const forge = writableForge(subject), said = String(text || '').trim();
  if (!forge || !/Issue$/.test(kindOf(subject) || '')) throw new ForgeError('NoIssue', 'There’s no issue on knotless or Tangled to comment on.', forge);
  if (!said) throw new ForgeError('Empty', 'Say something first.', forge);
  if (said.length > 18000) throw new ForgeError('TooLong', 'That’s too long for a comment.', forge);
  return forge === 'knotless' ? knotlessComment(agent, subject, said) : tangledComment(agent, subject, said);
}
