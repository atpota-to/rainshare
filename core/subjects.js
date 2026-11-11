// Where the work is: a Tangled issue or repo, a GitHub issue or repo, or any git URL.
// Parsing what someone pasted, describing it, the URL to clone, and (where the forge has a
// public API) the issue's title and whether a pull request has landed.
import { SEED } from './ns.js';
import { getJSON, xrpc, parseUri, handleOf } from './net.js';

export const BOBBIN = 'https://api.tangled.org'; // Tangled's public, read-only API
export const TANGLED = 'https://tangled.org';
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
  if (at && at.collection === 'sh.tangled.repo.issue') return { $type: T('tangledIssue'), uri: s };
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
    if (parts[2] === 'issues' && /^\d+$/.test(parts[3] || '')) return { $type: T('tangledIssue'), url: `${repoUrl}/issues/${parts[3]}`, repoUrl };
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
    const n = (String(subject.url || '').match(/\/issues\/(\d+)/) || [])[1];
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
/** Someone's Tangled repos: [{ uri, name, repoDid, url }]. */
export async function tangledRepos(did){
  const r = await xrpc(BOBBIN, 'sh.tangled.repo.listRepos', { subject: did, limit: 100 });
  const handle = await handleOf(did).catch(() => null);
  return (r.items || []).filter(x => x.value?.repoDid && x.value?.name).map(x => ({
    uri: x.uri, name: x.value.name, repoDid: x.value.repoDid, description: x.value.description || '',
    url: `${TANGLED}/${handle || did}/${x.value.name}`
  }));
}
/** A Tangled repo's open issues: [{ uri, cid, title, body, createdAt }]. */
export async function tangledIssues(repoDid){
  const r = await xrpc(BOBBIN, 'sh.tangled.repo.listIssues', { subject: repoDid, state: 'open', limit: 100 });
  return (r.items || []).map(x => ({ uri: x.uri, cid: x.cid, title: x.value?.title || 'Untitled issue', body: x.value?.body || '', createdAt: x.value?.createdAt }));
}
/** The repo a Tangled repo DID names: its owner and name, and its page. */
export async function tangledRepo(repoDid){
  const r = await xrpc(BOBBIN, 'sh.tangled.repo.getRepoByRepoDid', { repoDid });
  const owner = parseUri(r.uri)?.repo, handle = owner ? await handleOf(owner).catch(() => null) : null;
  return { owner, name: r.value?.name, url: owner && r.value?.name ? `${TANGLED}/${handle || owner}/${r.value.name}` : null };
}
/** Fill in a Tangled issue subject's repo page from its repo DID, so it can be cloned. */
export async function completeTangled(subject){
  if (kindOf(subject) !== 'tangledIssue' || subject.repoUrl) return subject;
  let repo = subject.repo;
  if (!repo && subject.uri) repo = (await xrpc(BOBBIN, 'sh.tangled.repo.getIssue', { issue: subject.uri }).catch(() => null))?.value?.repo;
  if (!repo) return subject;
  const r = await tangledRepo(repo).catch(() => null);
  return { ...subject, repo, ...(r?.url ? { repoUrl: r.url } : {}) };
}

/* ---------- the issue itself: title, body and state, where a public API has them ---------- */
export async function subjectInfo(subject){
  const kind = kindOf(subject);
  try {
    if (kind === 'githubIssue') {
      const r = await getJSON(`${GITHUB_API}/repos/${subject.repo}/issues/${subject.number}`);
      return { title: r.title, body: r.body || '', state: r.state, url: r.html_url };
    }
    if (kind === 'tangledIssue' && subject.uri) {
      const r = await xrpc(BOBBIN, 'sh.tangled.repo.getIssue', { issue: subject.uri });
      // Tangled's API lists a repo's open issues: one that's among them is open, and one that
      // isn't is closed, as long as the list wasn't cut short.
      const repo = subject.repo || r.value?.repo, open = repo ? await tangledIssues(repo).catch(() => null) : null;
      const state = !open ? null : open.some(x => x.uri === subject.uri) ? 'open' : open.length < 100 ? 'closed' : null;
      return { title: r.value?.title, body: r.value?.body || '', state, url: subject.url || null };
    }
  } catch (_) { /* rate limits and private repos: the link still works */ }
  return null;
}

/**
 * Pull requests on the forge that point at this work, whether or not anyone turned them in
 * on Rainshare: ones that mention the issue's number or address, or the seed's own link (the
 * brief asks for that link in every pull request). GitHub only for now. Looks through the
 * repo's 50 most recently updated. [{ url, number, title, by, state }], or null if it can't tell.
 */
export async function linkedPulls(subject, { rkey } = {}){
  const d = describeSubject(subject);
  if (d?.forge !== 'github' || !REPO_NAME.test(d.repo || '')) return null;
  try {
    const list = await getJSON(`${GITHUB_API}/repos/${d.repo}/pulls?state=all&sort=updated&direction=desc&per_page=50`);
    return pullsAbout(list, { repo: d.repo, number: kindOf(subject) === 'githubIssue' ? parseInt(subject.number, 10) : null, rkey });
  } catch (_) { return null; }
}
/** From a GitHub pull request list, the ones about an issue (by number or address) or a seed (by its link). */
export function pullsAbout(list, { repo, number, rkey } = {}){
  const quoted = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byNumber = number ? new RegExp(`(^|[^\\w/-])#${number}(?!\\d)`) : null, byAddress = number && repo ? new RegExp(`${quoted(repo)}/issues/${number}(?!\\d)`, 'i') : null;
  const bySeed = rkey ? new RegExp(`/seed/[^\\s/]+/${quoted(rkey)}(?![A-Za-z0-9])`) : null;
  return (Array.isArray(list) ? list : []).filter(pr => {
    const text = `${pr?.title || ''}\n${pr?.body || ''}`;
    return byNumber?.test(text) || byAddress?.test(text) || bySeed?.test(text);
  }).map(pr => ({ url: pr.html_url, number: pr.number, title: pr.title || '', by: pr.user?.login || null, state: pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open' }));
}

/** Whether a delivered pull request has landed: 'merged', 'open', 'closed', or null if we can't tell. */
export async function pullState({ url: link, pull } = {}){
  try {
    const m = String(link || '').match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
    if (m) { const r = await getJSON(`${GITHUB_API}/repos/${m[1]}/pulls/${m[2]}`); return r.merged_at ? 'merged' : r.state; }
    if (pull) {
      const rec = await xrpc(BOBBIN, 'sh.tangled.repo.getPull', { pull });
      const repoDid = rec.value?.target?.repo, author = parseUri(pull)?.repo;
      if (!repoDid) return null;
      const r = await xrpc(BOBBIN, 'sh.tangled.repo.listPulls', { subject: repoDid, author, limit: 100 });
      return (r.items || []).find(x => x.uri === pull)?.state || null;
    }
  } catch (_) { /* unknown */ }
  return null;
}
