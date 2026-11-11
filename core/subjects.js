// Where the work is: a Tangled issue or repo, a GitHub issue or repo, or any git URL.
// Parsing what someone pasted, describing it, the URL to clone, and (where the forge has a
// public API) the issue's title and whether a pull request has landed.
import { SEED } from './ns.js';
import { getJSON, xrpc, parseUri, handleOf, resolveHandle } from './net.js';

export const BOBBIN = 'https://api.tangled.org'; // Tangled's public, read-only API
export const TANGLED = 'https://tangled.org';
// On Tangled an issue and a pull request are the same kind of record, kept in the repository's
// own account: a ticket. It's a pull request when it names a target branch. Its key is what
// the page address ends in, a number on older repos and a longer id on newer ones.
export const TICKET = 'org.tangled.track.ticket';
const KEY = '[A-Za-z0-9._:~-]+';
export const GITHUB_API = 'https://api.github.com';

const T = kind => `${SEED}#${kind}`;
export const kindOf = subject => String(subject?.$type || '').split('#')[1] || null;

// Subjects come from other people's records, so anything used as a link or pasted into a
// shell is checked first: http(s) only, and nothing a shell would read as more than a word.
export function safeHttp(raw){
  const s = String(raw ?? '');
  if (!s || /[\s'"`$\\<>]/.test(s)) return null;
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.href.replace(/\/$/, '') : null; } catch (_) { return null; }
}
export const REPO_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function url(raw){
  try { const u = new URL(String(raw).trim()); return /^https?:$/.test(u.protocol) ? u : null; } catch (_) { return null; }
}
const FORGES = { 'github.com': 'github', 'www.github.com': 'github', 'tangled.org': 'tangled', 'tangled.sh': 'tangled', 'gitlab.com': 'gitlab', 'codeberg.org': 'codeberg' };

/** What someone pasted, as a seed subject, or null if it isn't a link we understand. */
export function parseSubject(raw){
  const s = String(raw || '').trim();
  const at = parseUri(s);
  if (at && at.collection === TICKET) return { $type: T('tangledIssue'), uri: s, repo: at.repo };
  const u = url(s); if (!u) return null;
  const forge = FORGES[u.host] || 'other';
  const parts = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
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
  if (parts.length >= 1) return { $type: T('repo'), url: u.href.replace(/\/+$/, ''), forge, name: parts.slice(0, 2).join('/').replace(/\.git$/, '') };
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
  if (kind === 'repo') {
    const forge = ['github', 'tangled', 'gitlab', 'codeberg'].includes(subject.forge) ? subject.forge : 'other';
    return { forge, label: subject.name || subject.url, repo: forge !== 'github' || REPO_NAME.test(subject.name || '') ? subject.name : null, href: safeHttp(subject.url), issue: false };
  }
  return null;
}
export const FORGE_NAMES = { github: 'GitHub', tangled: 'Tangled', gitlab: 'GitLab', codeberg: 'Codeberg', other: 'Git' };

/** The URL git clones from, when we can tell. */
export function cloneUrlOf(subject){
  const kind = kindOf(subject);
  if (kind === 'githubIssue') return REPO_NAME.test(subject.repo || '') ? `https://github.com/${subject.repo}.git` : null;
  if (kind === 'tangledIssue') return safeHttp(subject.repoUrl);
  if (kind === 'repo') { const u = safeHttp(subject.url); return u && subject.forge === 'github' && !u.endsWith('.git') ? u + '.git' : u; }
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
  const owner = await resolveHandle(decodeURIComponent(m[1]));
  return parseUri((await xrpc(BOBBIN, 'org.tangled.repo.getRepoByName', { owner, name: decodeURIComponent(m[2]).replace(/\.git$/, '') })).uri)?.repo || null;
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

/* ---------- the issue itself: title, body and state, where a public API has them ---------- */
export async function subjectInfo(subject){
  const kind = kindOf(subject);
  try {
    if (kind === 'githubIssue') {
      const r = await getJSON(`${GITHUB_API}/repos/${subject.repo}/issues/${subject.number}`);
      return { title: r.title, body: r.body || '', state: r.state, url: r.html_url };
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
 * turns up. [{ url, number, title, by, state }], or null if it can't tell.
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

/** Whether a delivered pull request has landed: 'merged', 'open', 'closed', or null if we can't tell. */
export async function pullState({ url: link, pull } = {}){
  try {
    const m = String(link || '').match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
    if (m) { const r = await getJSON(`${GITHUB_API}/repos/${m[1]}/pulls/${m[2]}`); return r.merged_at ? 'merged' : r.state; }
    const uri = await tangledTicket(pull || link);
    if (uri) {
      const r = await xrpc(BOBBIN, 'org.tangled.track.getTicketView', { uri });
      return r.targetBranch ? tangledPullState(r.state) : null; // a ticket with no target branch is an issue
    }
  } catch (_) { /* unknown */ }
  return null;
}
