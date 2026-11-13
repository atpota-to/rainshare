// Where the work is: an issue or repo on Tangled, GitHub or knotless, or any git URL.
// Parsing what someone pasted, describing it, the URL to clone, and (where the forge has a
// public API) the issue's title and whether a pull request has landed.
import { SEED } from './ns.js';
import { getJSON, xrpc, parseUri, handleOf, resolveHandle, isDid } from './net.js';

export const BOBBIN = 'https://api.tangled.org'; // Tangled's public, read-only API
export const TANGLED = 'https://tangled.org';
// On Tangled an issue and a pull request are the same kind of record, kept in the repository's
// own account: a ticket. It's a pull request when it names a target branch. Its key is what
// the page address ends in, a number on older repos and a longer id on newer ones.
export const TICKET = 'org.tangled.track.ticket';
const KEY = '[A-Za-z0-9._:~-]+';
// knotless keeps a repo, its issues and its pulls as records in people's own accounts. An
// issue's or a pull's page address ends in whose account it's in and its key, and its API
// (knotless.dev/docs/reference/api) names a repo by its record: at://<owner>/dev.knotless.repo/<name>.
export const KNOTLESS = 'https://knotless.dev';
const K_REPO = 'dev.knotless.repo', K_ISSUE = 'dev.knotless.issue', K_PULL = 'dev.knotless.pull';
export const KNOTLESS_NAME = /^[A-Za-z0-9._:-]+\/[A-Za-z0-9._-]+$/;
export const GITHUB_API = 'https://api.github.com';

const T = kind => `${SEED}#${kind}`;
export const kindOf = subject => String(subject?.$type || '').split('#')[1] || null;

// Subjects come from other people's records, so anything used as a link is checked first:
// http(s) only, with no spaces, quotes or angle brackets. A link can still carry characters a
// shell treats specially (& ; | ( ) ?), so anything bound for a command line goes through
// cloneUrlOf's stricter test, and is quoted as well.
export function safeHttp(raw){
  const s = String(raw ?? '');
  if (!s || /[\s'"`$\\<>]/.test(s)) return null;
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.href.replace(/\/$/, '') : null; } catch (_) { return null; }
}
// What git is pointed at: a host and a plain path, and nothing a shell would read as more than one word.
const CLONEABLE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?(\/[A-Za-z0-9._~%+@:\/-]*)?$/;
// A pasted page often carries more than git needs: a user name (Bitbucket's clone links), a query
// or fragment, or a GitLab page under /-/. That's dropped rather than the whole link refused.
const repoRoot = u => (u.origin + u.pathname.replace(/\/-\/.*$/, '')).replace(/\/+$/, '');
const cloneable = raw => {
  const u = safeHttp(raw); if (!u) return null;
  const root = repoRoot(new URL(u));
  return CLONEABLE.test(root) ? root : null;
};
// A path segment, decoded where it can be: a stray % in a pasted link isn't worth a crash.
const decode = s => { try { return decodeURIComponent(s); } catch (_) { return s; } };
export const REPO_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function url(raw){
  try { const u = new URL(String(raw).trim()); return /^https?:$/.test(u.protocol) ? u : null; } catch (_) { return null; }
}
const FORGES = { 'github.com': 'github', 'www.github.com': 'github', 'tangled.org': 'tangled', 'tangled.sh': 'tangled', 'knotless.dev': 'knotless', 'gitlab.com': 'gitlab', 'codeberg.org': 'codeberg' };

/** What someone pasted, as a seed subject, or null if it isn't a link we understand. */
export function parseSubject(raw){
  const s = String(raw || '').trim();
  const at = parseUri(s);
  if (at && at.collection === TICKET) return { $type: T('tangledIssue'), uri: s, repo: at.repo };
  const u = url(s); if (!u) return null;
  const forge = FORGES[u.host] || 'other';
  const parts = u.pathname.split('/').filter(Boolean).map(decode);
  if (forge === 'github' && parts.length >= 2) {
    const repo = `${parts[0]}/${parts[1].replace(/\.git$/, '')}`;
    if (parts[2] === 'issues' && /^\d+$/.test(parts[3] || '')) return { $type: T('githubIssue'), url: `https://github.com/${repo}/issues/${parts[3]}`, repo, number: +parts[3] };
    return { $type: T('repo'), url: `https://github.com/${repo}`, forge, name: repo };
  }
  if (forge === 'tangled' && parts.length >= 2) {
    const owner = parts[0].replace(/^@/, ''), name = parts[1];
    const repoUrl = `${TANGLED}/${owner}/${name}`;
    if (parts[2] === 'issues' && parts[3] !== 'new' && new RegExp(`^${KEY}$`).test(parts[3] || '')) return { $type: T('tangledIssue'), url: `${repoUrl}/issues/${parts[3]}`, repoUrl };
    return { $type: T('repo'), url: repoUrl, forge, name: `${owner}/${name}` };
  }
  // On knotless an owner is a handle or a DID, which is how its repos are told from its own pages.
  if (forge === 'knotless') {
    const owner = (parts[0] || '').replace(/^@/, ''), name = (parts[1] || '').replace(/\.git$/, '');
    if (!KNOTLESS_NAME.test(`${owner}/${name}`) || !/[.:]/.test(owner)) return null;
    const repoUrl = `${KNOTLESS}/${owner}/${name}`;
    if (parts[2] === 'issue' && /^did:[a-z]+:[A-Za-z0-9._:%-]+$/.test(parts[3] || '') && new RegExp(`^${KEY}$`).test(parts[4] || '')) return { $type: T('knotlessIssue'), url: `${repoUrl}/issue/${parts[3]}/${parts[4]}`, repoUrl, uri: `at://${parts[3]}/${K_ISSUE}/${parts[4]}` };
    return { $type: T('repo'), url: repoUrl, forge, name: `${owner}/${name}` };
  }
  if (parts.length >= 1) return { $type: T('repo'), url: repoRoot(u), forge, name: parts.slice(0, 2).join('/').replace(/\.git$/, '') };
  return null;
}

/** A plain description of a subject for the UI: which forge, a label, and a link. */
export function describeSubject(subject){
  const kind = kindOf(subject);
  if (kind === 'githubIssue') {
    const repo = REPO_NAME.test(subject.repo || '') ? subject.repo : null;
    return { forge: 'github', label: `${repo || 'GitHub'} #${parseInt(subject.number, 10) || ''}`.trim(), repo, href: safeHttp(subject.url), issue: true };
  }
  if (kind === 'tangledIssue') {
    const page = safeHttp(subject.repoUrl), repo = page ? page.replace(TANGLED + '/', '') : '';
    const n = (String(subject.url || '').match(/\/issues\/(\d+)(?:[/?#]|$)/) || [])[1];
    return { forge: 'tangled', label: repo ? `${repo}${n ? ' #' + n : ''}` : 'A Tangled issue', repo, href: safeHttp(subject.url) || page, issue: true };
  }
  if (kind === 'knotlessIssue') {
    const page = safeHttp(subject.repoUrl), repo = page ? page.replace(KNOTLESS + '/', '') : '';
    return { forge: 'knotless', label: repo || 'A knotless issue', repo, href: safeHttp(subject.url) || page, issue: true };
  }
  if (kind === 'repo') {
    const forge = ['github', 'tangled', 'knotless', 'gitlab', 'codeberg'].includes(subject.forge) ? subject.forge : 'other';
    return { forge, label: subject.name || subject.url, repo: forge !== 'github' || REPO_NAME.test(subject.name || '') ? subject.name : null, href: safeHttp(subject.url), issue: false };
  }
  return null;
}
export const FORGE_NAMES = { github: 'GitHub', tangled: 'Tangled', knotless: 'knotless', gitlab: 'GitLab', codeberg: 'Codeberg', other: 'Git' };
/** The repo's page on its forge, whichever kind of subject names it. */
export const repoPageOf = subject => safeHttp(kindOf(subject) === 'repo' ? subject.url : kindOf(subject) === 'githubIssue' ? (REPO_NAME.test(subject.repo || '') ? `https://github.com/${subject.repo}` : null) : subject?.repoUrl);

/** The URL git clones from, when we can tell. */
export function cloneUrlOf(subject){
  const kind = kindOf(subject);
  if (kind === 'githubIssue') return REPO_NAME.test(subject.repo || '') ? `https://github.com/${subject.repo}.git` : null;
  if (kind === 'tangledIssue' || kind === 'knotlessIssue') return cloneable(subject.repoUrl);
  if (kind === 'repo') { const u = cloneable(subject.url); return u && subject.forge === 'github' && !u.endsWith('.git') ? u + '.git' : u; }
  return null;
}

/* ---------- Tangled, through its public API ---------- */
// Method names and shapes are from tangled.org/docs/api/bobbin, checked against api.tangled.org.
const textOf = v => typeof v === 'string' ? v : v?.text || '';
/** Someone's Tangled repos: [{ uri, name, repoDid, url, description }]. */
export async function tangledRepos(did){
  const r = await xrpc(BOBBIN, 'org.tangled.repo.listRepos', { subject: did, limit: 100 });
  const handle = await handleOf(did).catch(() => null);
  return (r.items || []).map(x => ({ uri: x.uri, repoDid: parseUri(x.uri)?.repo, name: x.value?.declaration?.name, description: x.value?.description || '' }))
    .filter(x => x.repoDid && x.name).map(x => ({ ...x, url: `${TANGLED}/${handle || did}/${x.name}` }));
}
/** A Tangled repo's open issues: [{ uri, cid, title, body, createdAt }]. */
export async function tangledIssues(repoDid){
  const r = await xrpc(BOBBIN, 'org.tangled.repo.listIssues', { subject: repoDid, state: 'open', limit: 100 });
  return (r.items || []).map(x => ({ uri: x.uri, cid: x.cid, title: textOf(x.value?.title) || 'Untitled issue', body: textOf(x.value?.body), createdAt: x.value?.createdAt }));
}
/** The repo a Tangled repo DID names: its owner and name, its page, and the knot that hosts it. */
export async function tangledRepo(repoDid){
  const r = await xrpc(BOBBIN, 'org.tangled.repo.getRepoByRepoDid', { repoDid });
  const owner = r.value?.declaration?.owner, name = r.value?.declaration?.name, handle = owner ? await handleOf(owner).catch(() => null) : null;
  return { owner, name, knot: r.knot || null, url: owner && name ? `${TANGLED}/${handle || owner}/${name}` : null };
}
/** The DID of the repo at a tangled.org address (…/<owner>/<name>, with anything after it). */
export async function tangledRepoDid(page){
  const m = String(page || '').match(/^https:\/\/tangled\.(?:org|sh)\/@?([^/?#]+)\/([^/?#]+)/);
  if (!m) return null;
  const owner = await resolveHandle(decode(m[1]));
  return parseUri((await xrpc(BOBBIN, 'org.tangled.repo.getRepoByName', { owner, name: decode(m[2]).replace(/\.git$/, '') })).uri)?.repo || null;
}
/** The record behind a Tangled issue or pull request, from its page address or its own URI. */
export async function tangledTicket(link){
  const at = parseUri(link);
  if (at) return at.collection === TICKET ? String(link) : null;
  const m = String(link || '').match(new RegExp(`^https://tangled\\.(?:org|sh)/[^/?#]+/[^/?#]+/(?:issues|pulls)/(${KEY})`));
  const repoDid = m ? await tangledRepoDid(link) : null;
  return repoDid ? `at://${repoDid}/${TICKET}/${m[1]}` : null;
}
/**
 * Fill in what a Tangled issue subject leaves out, as far as the API can: the record behind a
 * pasted link, the repo it belongs to, the repo's page (which git clones from) and the issue's.
 */
export async function completeTangled(subject){
  if (kindOf(subject) !== 'tangledIssue') return subject;
  const out = { ...subject };
  if (!out.uri && out.url) { const uri = await tangledTicket(out.url).catch(() => null); if (uri) out.uri = uri; }
  const at = parseUri(out.uri);
  if (at?.collection === TICKET && !out.repo) out.repo = at.repo;
  if (out.repo && !out.repoUrl) { const r = await tangledRepo(out.repo).catch(() => null); if (r?.url) out.repoUrl = r.url; }
  if (out.repoUrl && !out.url && at?.collection === TICKET) out.url = `${out.repoUrl}/issues/${at.rkey}`;
  return out;
}

/* ---------- knotless, through its public API ---------- */
export const knotlessRepo = page => { const m = String(page || '').match(/^https:\/\/knotless\.dev\/@?([^/?#]+)\/([^/?#]+)/); return m ? `at://${decode(m[1])}/${K_REPO}/${decode(m[2]).replace(/\.git$/, '')}` : null; };
/** A knotless issue or pull, from its page address: the repo it's on and its own record. */
export function knotlessRef(link){
  const m = String(link || '').match(new RegExp(`^(https://knotless\\.dev/[^/?#]+/[^/?#]+)/(issue|pull)/(did(?::|%3A)[^/?#]+)/(${KEY})`, 'i'));
  return m ? { page: m[1], repo: knotlessRepo(m[1]), uri: `at://${decode(m[3])}/dev.knotless.${m[2].toLowerCase()}/${m[4]}` } : null;
}
export const knotlessPage = (page, uri) => { const at = parseUri(uri); return at && page ? `${page}/${at.collection === K_PULL ? 'pull' : 'issue'}/${at.repo}/${at.rkey}` : null; };
// One issue's thread answers two questions (is it open, and which pulls mention it), so the
// answer is kept for a moment rather than asked for twice.
// (`fresh` asks again regardless: what was said on it a moment ago may have changed.)
const threads = new Map();
function knotlessThread(repo, uri, { fresh = false } = {}){
  const key = repo + ' ' + uri, had = threads.get(key);
  if (had && !fresh && Date.now() - had.at < 20e3) return had.p;
  const p = xrpc(KNOTLESS, 'dev.knotless.getThread', { repo, uri, filesOnly: true });
  threads.set(key, { at: Date.now(), p }); p.catch(() => threads.delete(key));
  return p;
}
const knotlessState = t => ['open', 'merged', 'closed'].includes(t) ? t : null;
/** Someone's public knotless repos: [{ uri, name, url, description }]. */
export async function knotlessRepos(did){
  const r = await xrpc(KNOTLESS, 'dev.knotless.getActorRepos', { actor: did });
  return (r.repos || []).filter(x => x.uri && x.name && !x.private).map(x => ({ uri: x.uri, name: x.name, description: x.description || '', url: `${KNOTLESS}/${x.owner?.handle || x.owner?.did || did}/${x.name}` }));
}
/** A knotless repo's open issues: [{ uri, title, createdAt }]. `repo` is its record's URI. */
export async function knotlessIssues(repo){
  const r = await xrpc(KNOTLESS, 'dev.knotless.listItems', { repo, kind: 'issue', state: 'open', limit: 100 });
  return (r.items || []).map(x => ({ uri: x.uri, title: x.title || 'Untitled issue', body: '', createdAt: x.createdAt }));
}
/** The subject for an issue picked from one of those repos. */
export const knotlessIssueSubject = (repoUrl, uri) => ({ $type: T('knotlessIssue'), url: knotlessPage(repoUrl, uri), repoUrl, uri });

/* ---------- what's said on an issue, on knotless or Tangled ---------- */
// An ask on one of their issues talks there: its comments are the issue's (../core/comments.js).
//   knotless  Each comment is a record in its writer's own account, and the issue's thread
//             (the same answer that says whether it's open) lists them. An issue's comments
//             are one list: `reply` on knotless is for threads on a pull's lines.
//   Tangled   Comments are kept with the repo, in its account on its knot, and Tangled's API
//             lists an issue's. That list has no published definition, so each is taken
//             only as far as it's well formed. A comment can answer another (`replyTo`).
// Either way, a comment has to be on the issue that was asked about, and who wrote it is
// what the forge says: it isn't checked against the writer's own server.
/**
 * The comments on the issue a subject points at: { forge, items, more }, each item
 * { uri, cid, by, text, createdAt, replyTo }, oldest first, and `more` when the forge said
 * there were more than it listed. Null for a subject that isn't an issue on either forge.
 */
export async function issueComments(subject, { fresh = false, timeout = 6000 } = {}){
  const kind = kindOf(subject), when = v => typeof v === 'string' ? v : '';
  if (kind === 'knotlessIssue') {
    const ref = knotlessRef(subject.url) || (subject.uri && subject.repoUrl ? { repo: knotlessRepo(subject.repoUrl), uri: subject.uri } : null);
    if (!ref?.repo || parseUri(ref.uri)?.collection !== K_ISSUE) return null;
    const r = await knotlessThread(ref.repo, ref.uri, { fresh });
    const items = (Array.isArray(r?.comments) ? r.comments : []).flatMap(c => {
      const at = parseUri(c?.uri), by = isDid(c?.author?.did) ? c.author.did : null;
      // In the writer's own account, and nothing to do with a pull's lines or reviews.
      if (at?.collection !== 'dev.knotless.comment' || !by || at.repo !== by || typeof c.body !== 'string' || !c.body.trim() || c.line || c.verdict || c.reply) return [];
      return [{ uri: String(c.uri), cid: null, by, text: c.body, createdAt: when(c.createdAt), replyTo: null }];
    });
    return { forge: 'knotless', items, more: false };
  }
  if (kind === 'tangledIssue') {
    // The issue the page links to, as a comment written from here would be (./forgewrite.js).
    const uri = await tangledTicket(subject.url || subject.uri);
    if (!uri) return null;
    const home = parseUri(uri).repo;
    const r = await xrpc(BOBBIN, 'org.tangled.feed.listComments', { subject: uri }, { timeout });
    const list = Array.isArray(r?.items) ? r.items : [];
    const items = list.flatMap(c => {
      const at = parseUri(c?.uri), by = isDid(c?.editor) ? c.editor : null, text = typeof c?.body === 'string' ? c.body : c?.body?.text;
      // Kept with the repo, on this issue, by someone, saying something.
      if (at?.collection !== 'org.tangled.feed.comment' || at.repo !== home || c.subject?.uri !== uri || !by || typeof text !== 'string' || !text.trim()) return [];
      const to = parseUri(c.replyTo?.uri)?.collection === 'org.tangled.feed.comment' && typeof c.replyTo.cid === 'string' ? { uri: String(c.replyTo.uri), cid: c.replyTo.cid } : null;
      return [{ uri: String(c.uri), cid: typeof c.cid === 'string' ? c.cid : null, by, text, createdAt: when(c.createdAt), replyTo: to }];
    });
    return { forge: 'tangled', items, more: Number(r?.total) > list.length };
  }
  return null;
}

/* ---------- the issue itself: title, body and state, where a public API has them ---------- */
export async function subjectInfo(subject){
  const kind = kindOf(subject);
  try {
    if (kind === 'githubIssue') {
      const n = parseInt(subject.number, 10);
      if (!REPO_NAME.test(subject.repo || '') || !(n > 0)) return null;
      const r = await getJSON(`${GITHUB_API}/repos/${subject.repo}/issues/${n}`);
      return { title: r.title, body: r.body || '', state: r.state, url: r.html_url };
    }
    if (kind === 'knotlessIssue') {
      const ref = knotlessRef(subject.url) || (subject.uri && subject.repoUrl ? { repo: knotlessRepo(subject.repoUrl), uri: subject.uri } : null);
      if (!ref?.repo) return null;
      const r = await knotlessThread(ref.repo, ref.uri);
      return { title: r.item?.title || '', body: r.body || '', state: r.item?.state === 'open' ? 'open' : r.item?.state ? 'closed' : null, url: subject.url || null };
    }
    if (kind === 'tangledIssue') {
      const uri = await tangledTicket(subject.uri || subject.url);
      if (!uri) return null;
      const r = await xrpc(BOBBIN, 'org.tangled.track.getTicketView', { uri });
      return { title: textOf(r.title), body: textOf(r.body), state: r.state === 'open' ? 'open' : r.state ? 'closed' : null, url: subject.url || null };
    }
  } catch (_) { /* rate limits and private repos: the link still works */ }
  return null;
}

/**
 * Pull requests on the forge that point at this work, whether or not anyone turned them in
 * on Rainshare: ones that mention the issue (its number or its address), or the seed's own
 * link (the brief asks for that link in every pull request). On GitHub it looks through the
 * repo's 50 most recently updated; on Tangled, through the 50 newest and whatever search
 * turns up; knotless already keeps, for each issue, the pulls that name it.
 * [{ url, number, title, by, state }], or null if it can't tell.
 */
export async function linkedPulls(subject, { rkey } = {}){
  const d = describeSubject(subject), kind = kindOf(subject);
  try {
    if (d?.forge === 'github' && REPO_NAME.test(d.repo || '')) {
      const list = await getJSON(`${GITHUB_API}/repos/${d.repo}/pulls?state=all&sort=updated&direction=desc&per_page=50`);
      return pullsAbout(list, { repo: d.repo, number: kind === 'githubIssue' ? parseInt(subject.number, 10) : null, rkey });
    }
    if (d?.forge === 'tangled') {
      const page = safeHttp(kind === 'tangledIssue' ? subject.repoUrl : subject.url);
      const repoDid = subject.repo || subject.repoDid || (kind === 'tangledIssue' && parseUri(subject.uri)?.collection === TICKET ? parseUri(subject.uri).repo : null) || await tangledRepoDid(page);
      if (!repoDid || !page) return null;
      const issue = kind === 'tangledIssue' ? parseUri(subject.uri)?.rkey || (String(subject.url || '').match(new RegExp(`/issues/(${KEY})`)) || [])[1] : null;
      // Tangled's search reaches a repo's whole history, so it's asked for the issue's key and for
      // the seed's. The newest pull requests are read as well, in case search hasn't caught up.
      const found = q => xrpc(BOBBIN, 'org.tangled.search.query', { repo: repoDid, kind: 'pull', q, limit: 50 }).then(r => r.hits || [], () => []);
      const [recent, ...hits] = await Promise.all([xrpc(BOBBIN, 'org.tangled.repo.listPulls', { subject: repoDid, limit: 50 }).then(r => r.items || []), ...[issue, rkey].filter(Boolean).map(found)]);
      const seen = new Set();
      return tangledPullsAbout([...recent, ...hits.flat()].filter(x => x?.uri && !seen.has(x.uri) && seen.add(x.uri)), { page, issue, rkey });
    }
    if (d?.forge === 'knotless') {
      const page = repoPageOf(subject), repo = knotlessRepo(page);
      if (!repo) return null;
      const issue = kind === 'knotlessIssue' ? knotlessRef(subject.url)?.uri || subject.uri : null;
      let answered = false;
      const got = p => p.then(v => { answered = true; return v; }, () => []);
      const lists = await Promise.all([
        issue ? got(knotlessThread(repo, issue).then(r => (r.mentionedBy || []).map(m => m.item))) : [],
        ...(rkey ? ['open', 'closed'].map(state => got(xrpc(KNOTLESS, 'dev.knotless.listItems', { repo, kind: 'pull', state, q: rkey, limit: 50 }).then(r => r.items || []))) : [])
      ]);
      if (!answered && (issue || rkey)) return null;
      const seen = new Set();
      return lists.flat().filter(x => x?.uri && x.kind === 'pull' && !seen.has(x.uri) && seen.add(x.uri))
        .map(x => ({ url: knotlessPage(page, x.uri), number: null, title: x.title || '', by: x.author?.handle || null, state: knotlessState(x.state) }));
    }
  } catch (_) { /* unknown */ }
  return null;
}
const quoted = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const seedLink = rkey => rkey ? new RegExp(`/seed/[^\\s/]+/${quoted(rkey)}(?![A-Za-z0-9])`) : null;
const numbered = n => new RegExp(`(^|[^\\w/-])#${n}(?!\\d)`);
/** From a GitHub pull request list, the ones about an issue (by number or address) or a seed (by its link). */
export function pullsAbout(list, { repo, number, rkey } = {}){
  const byNumber = number ? numbered(number) : null, byAddress = number && repo ? new RegExp(`${quoted(repo)}/issues/${number}(?!\\d)`, 'i') : null;
  const bySeed = seedLink(rkey);
  return (Array.isArray(list) ? list : []).filter(pr => {
    const text = `${pr?.title || ''}\n${pr?.body || ''}`;
    return byNumber?.test(text) || byAddress?.test(text) || bySeed?.test(text);
  }).map(pr => ({ url: pr.html_url, number: pr.number, title: pr.title || '', by: pr.user?.login || null, state: pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open' }));
}
const tangledPullState = t => t === 'completed' ? 'merged' : t === 'closed' ? 'closed' : t === 'open' ? 'open' : null;
/** The same, from Tangled's list of a repo's pull requests. `page` is the repo's page and `issue` the issue's key. */
export function tangledPullsAbout(items, { page, issue, rkey } = {}){
  const byAddress = issue ? new RegExp(`/issues/${quoted(issue)}(?![A-Za-z0-9._:~-])`) : null, byNumber = /^\d+$/.test(issue || '') ? numbered(issue) : null;
  const bySeed = seedLink(rkey);
  return (Array.isArray(items) ? items : []).filter(x => {
    const text = `${textOf(x?.value?.title)}\n${textOf(x?.value?.body)}`;
    return byAddress?.test(text) || byNumber?.test(text) || bySeed?.test(text);
  }).map(x => {
    const key = parseUri(x.uri)?.rkey || '';
    return { url: `${page}/pulls/${key}`, number: /^\d+$/.test(key) ? +key : null, title: textOf(x.value?.title), by: null, state: tangledPullState(x.state || x.value?.state) };
  });
}

/**
 * Whether a delivered pull request has landed: 'merged', 'open', 'closed', or null if we can't
 * tell. `subject` is the seed's, which is how a pull turned in by its record alone is placed.
 */
export async function pullState({ url: link, pull, subject } = {}){
  try {
    const m = String(link || '').match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
    if (m) { const r = await getJSON(`${GITHUB_API}/repos/${m[1]}/pulls/${m[2]}`); return r.merged_at ? 'merged' : r.state; }
    const k = knotlessRef(link) || (parseUri(pull)?.collection === K_PULL && describeSubject(subject)?.forge === 'knotless' ? { repo: knotlessRepo(repoPageOf(subject)), uri: pull } : null);
    if (k?.repo) { const r = await knotlessThread(k.repo, k.uri); return r.item?.kind === 'pull' ? knotlessState(r.item.state) : null; }
    const uri = await tangledTicket(pull || link);
    if (uri) {
      const r = await xrpc(BOBBIN, 'org.tangled.track.getTicketView', { uri });
      return r.targetBranch ? tangledPullState(r.state) : null; // a ticket with no target branch is an issue
    }
  } catch (_) { /* unknown */ }
  return null;
}
/** A page to open for a delivered pull request: its link, or one worked out from its record and the seed's repo. */
export function pullPageOf({ url, pull } = {}, subject){
  const u = safeHttp(url); if (u) return u;
  const at = parseUri(pull), page = repoPageOf(subject), forge = describeSubject(subject)?.forge;
  if (!at || !page) return null;
  return at.collection === K_PULL && forge === 'knotless' ? `${page}/pull/${at.repo}/${at.rkey}` : at.collection === TICKET && forge === 'tangled' ? `${page}/pulls/${at.rkey}` : null;
}
/** A pull request's number, from its page (GitHub, Tangled, Codeberg, GitLab), or '' where the address doesn't carry one. */
export const pullNumber = link => (String(link || '').match(/^https?:\/\/[^?#]*\/(?:pull|pulls|merge_requests)\/(\d+)(?:[/?#]|$)/) || [])[1] || '';
/** One name for a pull request however it was written down (a page address, a record, a trailing slash), for telling two mentions of it apart. */
export function pullKey(link){
  const s = String(link || '').trim(), at = parseUri(s);
  if (at) return at.collection === K_PULL ? `knotless:${at.repo}/${at.rkey}` : at.collection === TICKET ? `tangled:${at.rkey}` : s;
  const g = s.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/i); if (g) return `github:${g[1].toLowerCase()}#${g[2]}`;
  const k = knotlessRef(s); if (k) { const p = parseUri(k.uri); return `knotless:${p.repo}/${p.rkey}`; }
  const t = s.match(new RegExp(`^https://tangled\\.(?:org|sh)/[^/?#]+/[^/?#]+/pulls/(${KEY})`)); if (t) return `tangled:${t[1]}`;   // a key is one of a kind within its repo
  return s.replace(/\/+$/, '');
}
