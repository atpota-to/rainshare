// Posting to the forges that live on atproto, as whoever is signed in: opening an issue,
// leaving a comment, or opening a pull request from a branch that's been pushed, on knotless
// or Tangled. The two keep these in different places:
//
//   knotless  An issue, a comment or a pull is a record in its author's own account that
//             names the repo (dev.knotless.issue, .comment, .pull). Posting one is an
//             ordinary write to your own repo.
//   Tangled   They're kept with the repo, on the knot that hosts it. Your server gives a
//             token good for a minute that says the call is yours
//             (com.atproto.server.getServiceAuth), the knot takes the write, and a record in
//             your own account says it was you (org.tangled.graph.attestation). A pull
//             request is a ticket with a branch to merge into, and then its changes
//             (org.tangled.review.submitPatch). It's what Tangled's own web app does.
//
// `agent` is { did, fetchHandler(path, init) }: requests to your own server, signed in. The
// sign-in has to allow these writes (FORGE_SCOPES in ./ns.js); one that doesn't is refused by
// your server, which comes back as a ForgeError named 'NotConnected'.
import { xrpc, getJSON, parseUri, isDid, isHandle, handleOf } from './net.js';
import { SEED } from './ns.js';
import { describeSubject, kindOf, repoPageOf, tangledRepoDid, tangledTicket, knotlessRepo, knotlessRef, knotlessPage, knotlessIssueSubject, KNOTLESS, KNOTLESS_NAME, TANGLED, BOBBIN, TICKET } from './subjects.js';

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
async function knotlessRepoView(where){
  const at = parseUri(where)?.collection === 'dev.knotless.repo' ? String(where) : knotlessRepo(where);
  if (!at) throw new ForgeError('NoRepo', 'That isn’t a knotless repo.', 'knotless');
  const r = await xrpc(KNOTLESS, 'dev.knotless.getRepo', { repo: at }).catch(() => null);
  if (!r?.uri || !r.key) throw new ForgeError('NoRepo', 'knotless couldn’t find that repo.', 'knotless');
  if (r.private) throw new ForgeError('Private', 'That repo is private. Rainshare only posts to public ones.', 'knotless');
  return r;
}
const knotlessRepoRef = async where => { const r = await knotlessRepoView(where); return { uri: r.uri, key: r.key }; };
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
// A branch name: what git allows, less the characters that mean something in a link or a command.
const BRANCH = /^(?![-/.])(?!.*(?:\.\.|\/\/|@\{|\.lock$|[/.]$))[\p{L}\p{N}._/+@-]{1,244}$/u;
const branchNames = list => (list || []).map(b => b?.name).filter(n => BRANCH.test(n || ''));
// On the repo itself, the branch a pull request merges into is the last one anyone would bring in.
const baseLast = base => src => src.fork ? src : { ...src, branches: [...src.branches.filter(b => b !== base), ...src.branches.filter(b => b === base)] };
// A repo that asks its pulls to follow a template turns away one with none of its headings.
const headings = text => [...String(text || '').matchAll(/^#{1,6}[ \t]+(.+?)[ \t]*#*$/gm)].map(m => m[1].trim().toLowerCase());
/** The repos a pull into a knotless repo can come from, for whoever's looking: the repo itself, and their forks of it. */
async function knotlessChoices(subject, viewer){
  const page = repoPageOf(subject), repo = await knotlessRepoView(page);
  const cmp = await xrpc(KNOTLESS, 'dev.knotless.getCompare', { repo: repo.uri }).catch(() => null);
  const heads = (cmp?.heads || []).filter(h => isDid(h?.did) && KNOTLESS_NAME.test(`${h.did}/${h.name}`)).map(h => ({ ...h, handle: isHandle(h.handle) ? h.handle : null }));
  const own = h => h.did === repo.owner?.did && h.name === repo.name;
  const from = [heads.find(own) || { did: repo.owner?.did, handle: isHandle(repo.owner?.handle) ? repo.owner.handle : null, name: repo.name }, ...heads.filter(h => !own(h) && h.did === viewer)];
  const sources = await Promise.all(from.map(async (h, i) => {
    const id = `at://${h.did}/dev.knotless.repo/${h.name}`;
    const r = await xrpc(KNOTLESS, 'dev.knotless.listBranches', { repo: id, limit: 200 }).catch(() => null);
    return { id, label: `${h.handle || h.did}/${h.name}`, page: `${KNOTLESS}/${h.handle || h.did}/${h.name}`, fork: i > 0, branches: branchNames(r?.branches) };
  }));
  const base = BRANCH.test(repo.defaultBranch || '') ? repo.defaultBranch : sources[0].branches[0] || 'main';
  const t = await xrpc(KNOTLESS, 'dev.knotless.getTemplate', { repo: repo.uri, kind: 'pull', base }).catch(() => null);
  return { forge: 'knotless', page, base, bases: [base, ...sources[0].branches.filter(b => b !== base)], sources: sources.map(baseLast(base)), template: typeof t?.template === 'string' ? t.template.slice(0, 8000) : '' };
}
async function knotlessPull(agent, subject, { title, body, base, from, branch }){
  const page = repoPageOf(subject), target = await knotlessRepoView(page), repo = { uri: target.uri, key: target.key };
  const into = base || target.defaultBranch || 'main';
  const head = !from || from === repo.uri ? repo : await knotlessRepoRef(from);
  // knotless says what the branch would bring in. A branch it can't find, or one with nothing
  // the base doesn't have, isn't a pull request yet.
  const cmp = await xrpc(KNOTLESS, 'dev.knotless.getCompare', { repo: repo.uri, base: into, ...(head.uri === repo.uri ? {} : { head: head.uri }), branch }).catch(e => e);
  if (cmp instanceof Error) throw new ForgeError('NoBranch', cmp.name === 'NotFound' ? `knotless can’t find the branch “${branch}” there. Has it been pushed?` : 'knotless didn’t answer. Try again in a moment.', 'knotless');
  if (cmp.changes && !cmp.changes.commits?.length) throw new ForgeError('NothingNew', `“${branch}” has nothing that “${into}” doesn’t already have.`, 'knotless');
  const text = String(body || '').trim().slice(0, 18000);
  const t = await xrpc(KNOTLESS, 'dev.knotless.getTemplate', { repo: repo.uri, kind: 'pull', base: into }).catch(() => null), asked = headings(t?.template);
  if (asked.length && !headings(text).some(h => asked.includes(h))) throw new ForgeError('Template', 'This repo asks pull requests to follow its template. Keep at least one of its headings in the description.', 'knotless');
  const r = await create(agent, 'knotless', 'dev.knotless.pull', {
    $type: 'dev.knotless.pull', repo, base: into, head: { repo: head, branch }, title: clip(title, 300), ...(text ? { body: text } : {}), createdAt: new Date().toISOString()
  });
  return { uri: r.uri, url: knotlessPage(page, r.uri) };
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
  return { repoDid, knot: r.knot, page, base: BRANCH.test(r.defaultBranch || '') ? r.defaultBranch : null };
}
// One call to the knot, as you. Your server gives a token for this repo and this method, good
// for a minute. (The knot checks it against the repo, not against itself.)
async function knotCall(agent, { repoDid, knot }, lxm, input){
  const ask = new URLSearchParams({ aud: repoDid, lxm, exp: String(Math.floor(Date.now() / 1000) + 60) });
  const { token } = await own(agent, 'tangled', '/xrpc/com.atproto.server.getServiceAuth?' + ask, { method: 'GET' });
  if (!token) throw new ForgeError('NoToken', 'Your server didn’t give Rainshare a token for the post.', 'tangled');
  const res = await fetch(`https://${knot}/xrpc/${lxm}`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ repo: repoDid, ...input })
  });
  const saved = await res.json().catch(() => ({}));
  if (!res.ok) throw new ForgeError(saved.error || 'HTTP' + res.status, saved.message || `Tangled refused it (${res.status}).`, 'tangled');
  return saved;
}
const OID = /^([0-9a-f]{40}|[0-9a-f]{64})$/;
// The knot's word alone isn't tied to you: a record in your own account says the post was
// yours. If that part fails the post still stands, so it isn't a reason to post twice.
const attest = (agent, saved) => create(agent, 'tangled', 'org.tangled.graph.attestation', {
  $type: 'org.tangled.graph.attestation', subject: { uri: saved.uri, cid: saved.cid }, ...(OID.test(saved['x-tngl-change'] || '') ? { change: saved['x-tngl-change'] } : {}), createdAt: new Date().toISOString()
}).then(() => true, () => false);
async function knotCreate(agent, place, collection, record){
  const saved = await knotCall(agent, place, 'com.atproto.repo.createRecord', { collection, record });
  if (!saved.uri) throw new ForgeError('NoRecord', 'Tangled didn’t say where it put that.', 'tangled');
  return { uri: saved.uri, cid: saved.cid, attested: await attest(agent, saved) };
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
const tangledBranches = async repo => {
  const r = await xrpc(BOBBIN, 'org.tangled.temp.git.listBranches', { repo, limit: 100 }).catch(() => null);
  // The ones worked on last come first: the branch someone just pushed is usually the one they want.
  return branchNames([...(r?.branches || [])].sort((x, y) => (Date.parse(y?.committer?.when) || 0) - (Date.parse(x?.committer?.when) || 0)));
};
const tipOf = async (repo, branch) => { const r = await xrpc(BOBBIN, 'org.tangled.temp.git.getRef', { repo, ref: 'refs/heads/' + branch }).catch(() => null); return OID.test(r?.oid || '') ? r.oid : null; };
/** The repos a pull request into a Tangled repo can come from, for whoever's looking: the repo itself, and their forks of it. */
async function tangledChoices(subject, viewer){
  const place = await tangledPlace(subject);
  const mine = isDid(viewer) ? (await xrpc(BOBBIN, 'org.tangled.repo.listRepos', { subject: viewer, limit: 100 }).catch(() => null))?.items || [] : [];
  const forks = mine.filter(x => x?.value?.source?.did === place.repoDid && isDid(parseUri(x.uri)?.repo) && /^[A-Za-z0-9._-]{1,100}$/.test(x.value?.declaration?.name || ''));
  const handle = forks.length ? await handleOf(viewer).catch(() => null) : null;
  const label = page => String(page || '').replace(/^https:\/\/[^/]+\//, '');
  const sources = await Promise.all([
    { id: place.repoDid, label: label(place.page) || 'the repo', page: place.page, fork: false },
    ...forks.map(x => ({ id: parseUri(x.uri).repo, label: `${handle || viewer}/${x.value.declaration.name}`, page: `${TANGLED}/${handle || viewer}/${x.value.declaration.name}`, fork: true }))
  ].map(async src => ({ ...src, branches: await tangledBranches(src.id) })));
  const bases = sources[0].branches, base = place.base || bases[0] || 'main';
  return { forge: 'tangled', page: place.page, base, bases: [base, ...bases.filter(b => b !== base)], sources: sources.map(baseLast(base)), template: '' };
}
async function tangledPull(agent, subject, { title, body, base, from, branch }){
  const place = await tangledPlace(subject), source = from || place.repoDid, into = base || place.base || 'main';
  if (!isDid(source)) throw new ForgeError('NoRepo', 'That isn’t a Tangled repo to bring changes from.', 'tangled');
  // A pull request names two commits: where the branch is now, and where it left the branch
  // it's going into. Tangled's public index knows both, once the push has reached it.
  const [target, tip] = await Promise.all([tipOf(place.repoDid, into), tipOf(source, branch)]);
  if (!target) throw new ForgeError('NoBranch', `Tangled can’t find the branch “${into}” to merge into.`, 'tangled');
  if (!tip) throw new ForgeError('NoBranch', `Tangled can’t find the branch “${branch}” there. Has it been pushed? It can take a moment to show up.`, 'tangled');
  if (tip === target) throw new ForgeError('NothingNew', `“${branch}” has nothing that “${into}” doesn’t already have.`, 'tangled');
  const fork = await xrpc(BOBBIN, 'org.tangled.temp.git.getMergeBase', { repos: source === place.repoDid ? [source] : [source, place.repoDid], base: target, head: tip }).catch(() => null);
  if (!OID.test(fork?.commit || '')) throw new ForgeError('NoBase', `Tangled couldn’t work out where “${branch}” left “${into}”. Do they share any history?`, 'tangled');
  if (fork.commit === tip) throw new ForgeError('NothingNew', `“${branch}” has nothing that “${into}” doesn’t already have.`, 'tangled');
  const text = String(body || '').trim();
  const ticket = await knotCreate(agent, place, TICKET, {
    $type: TICKET, title: { $type: 'org.tangled.markup.markdown#inline', text: clip(title, 256) },
    ...(text ? { body: markdown(text) } : {}), state: 'open', targetBranch: into, createdAt: new Date().toISOString()
  });
  const rkey = parseUri(ticket.uri)?.rkey;
  try {
    const patch = await knotCall(agent, place, 'org.tangled.review.submitPatch', { patch: { ticket: rkey, base: { oid: fork.commit }, head: { oid: tip }, sourceRepo: source, sourceBranch: branch } });
    if (patch.uri && patch.cid) await attest(agent, patch);
  } catch (e) {
    // A pull request with no changes is no use to anyone: take it back rather than leave it on their repo.
    const gone = await knotCall(agent, place, 'com.atproto.repo.deleteRecord', { collection: TICKET, rkey, swapRecord: ticket.cid }).then(() => true, () => false);
    throw new ForgeError(e?.name === 'NotConnected' ? 'NotConnected' : 'PatchRefused', gone ? `Tangled didn’t take the changes: ${e?.message || 'no reason given'}` : `Tangled opened the pull request but didn’t take its changes (${e?.message || 'no reason given'}). It’s at ${place.page}/pulls/${rkey}: finish or close it there.`, 'tangled');
  }
  return { uri: ticket.uri, url: `${place.page}/pulls/${rkey}`, attested: ticket.attested };
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

/**
 * What a pull request for a subject's repo can be opened from, for a form to offer:
 * { forge, page, base, bases, sources: [{ id, label, page, fork, branches }], template }.
 * `sources` is the repo itself and then the viewer's forks of it; `base` is the branch a pull
 * request usually goes into; `template` is what the repo asks its description to follow.
 */
export async function pullChoices(subject, { viewer } = {}){
  const forge = writableForge(subject);
  if (!forge) throw new ForgeError('NoForge', 'Rainshare can open pull requests on knotless and Tangled only.', null);
  return forge === 'knotless' ? knotlessChoices(subject, viewer) : tangledChoices(subject, viewer);
}
const bare = x => String(x || '').trim().toLowerCase().replace(/^knotless:\/\//, '').replace(/^https?:\/\/[^/]+\//, '').replace(/^at:\/\//, '').replace(/\/dev\.knotless\.repo\//, '/').replace(/^@/, '').replace(/\.git$/, '').replace(/\/+$/, '');
/** The one of those that `from` names, however it's written: its address, its page, knotless://owner/name, owner/name. */
export const matchSource = (choices, from) => { const want = bare(from); return (want && (choices?.sources || []).find(x => [x.id, x.page, x.label].some(v => bare(v) === want))) || null; };
/**
 * Which of those a branch is most likely on: the one `from` names, else a fork that has the
 * branch, else anywhere that has it, else the viewer's fork, else the repo itself.
 */
export function pickSource(choices, { from, branch } = {}){
  const list = choices?.sources || [];
  return matchSource(choices, from)
    || (branch && (list.find(x => x.fork && x.branches.includes(branch)) || list.find(x => x.branches.includes(branch))))
    || list.find(x => x.fork) || list[0] || null;
}
/** A description to start a pull request from: the repo's template if it has one, what it settles, and where it came from. */
export function pullText({ template, issue, page, asker, model } = {}){
  const from = page ? `This came through Rainshare, where ${asker || 'someone'} asked for help with it: ${page}` : 'This came through Rainshare.';
  return [String(template || '').trim(), issue ? `Fixes ${issue}` : '', from + (model ? `\nDone with ${model}.` : '')].filter(Boolean).join('\n\n');
}
/**
 * Open a pull request on the repo a subject points at, from a branch that's already been
 * pushed: { title, body, branch, from, base }. `from` is the id of one of pullChoices'
 * sources (the repo itself when left out), and `base` the branch to merge into (the repo's
 * usual one when left out). Returns { uri, url }: its record, and its page.
 */
export async function forgePull(agent, subject, { title, body, branch, from, base } = {}){
  const forge = writableForge(subject);
  if (!forge) throw new ForgeError('NoForge', 'Rainshare can open pull requests on knotless and Tangled only.', null);
  if (!String(title || '').trim()) throw new ForgeError('NoTitle', 'A pull request needs a title.', forge);
  if (!String(branch || '').trim()) throw new ForgeError('NoBranch', 'Say which branch the changes are on.', forge);
  if (!BRANCH.test(branch)) throw new ForgeError('NoBranch', 'Rainshare can’t use that branch name: letters, numbers and . _ / + - only.', forge);
  if (base && !BRANCH.test(base)) throw new ForgeError('NoBranch', 'That isn’t a branch to merge into.', forge);
  if (String(body || '').length > 18000) throw new ForgeError('TooLong', 'That’s too long for a description.', forge);
  return forge === 'knotless' ? knotlessPull(agent, subject, { title, body, base, from, branch }) : tangledPull(agent, subject, { title, body, base, from, branch });
}
