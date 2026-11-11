// Where things get made on each forge. Rainshare doesn't write to a forge itself, so when a
// seed needs something made there (a repo for an idea, a fork, a look at the open pull
// requests) it sends the person to the right page, with as much filled in as that forge
// allows, and tells an agent the command where the forge has one.
import { describeSubject, repoPageOf } from './subjects.js';

const query = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString();
/** A repo name made from a seed's title: "A seating chart, shuffled!" becomes "a-seating-chart-shuffled". */
export const repoNameFor = title => String(title || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'new-project';

/**
 * Places to start a new repo, for an idea with nowhere to live yet:
 * [{ forge, name, href, command, note }]. `href` is the page a person opens; `command` is
 * what an agent runs, where there is one (`<handle>` is for whoever's account it goes in).
 */
export function newRepoPlaces({ title, about } = {}){
  const name = repoNameFor(title), description = String(about || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return [
    { forge: 'tangled', name: 'Tangled', href: 'https://tangled.org/repo/new', command: `git push git@tangled.org:<handle>/${name} main`, note: 'Make the repo on that page first, then push to it.' },
    { forge: 'knotless', name: 'knotless', href: 'https://knotless.dev/start', command: `git push knotless://<handle>/${name} main`, note: 'The first push makes the repo. It needs the knotless CLI.' },
    { forge: 'github', name: 'GitHub', href: `https://github.com/new?${query({ name, description })}`, command: `gh repo create ${name} --public --source . --push`, note: 'It needs the GitHub CLI.' },
    { forge: 'codeberg', name: 'Codeberg', href: 'https://codeberg.org/repo/create' },
    { forge: 'gitlab', name: 'GitLab', href: 'https://gitlab.com/projects/new' }
  ];
}

/**
 * Pages on the forge a seed's subject lives on, each a link or absent:
 * { repo, issue, pulls, fork, newPull, newIssue }.
 */
export function placesFor(subject){
  const d = describeSubject(subject), page = repoPageOf(subject);
  if (!d || !page) return {};
  const issue = d.issue ? d.href : null;
  return {
    github: { repo: page, issue, pulls: `${page}/pulls`, fork: `${page}/fork`, newPull: `${page}/compare`, newIssue: `${page}/issues/new` },
    tangled: { repo: page, issue, pulls: `${page}/pulls`, fork: `${page}/fork`, newPull: `${page}/pulls/new`, newIssue: `${page}/issues/new` },
    knotless: { repo: page, issue, pulls: `${page}/pulls` },
    codeberg: { repo: page, pulls: `${page}/pulls`, fork: `${page}/fork`, newIssue: `${page}/issues/new` },
    gitlab: { repo: page, pulls: `${page}/-/merge_requests`, fork: `${page}/-/forks/new`, newIssue: `${page}/-/issues/new` }
  }[d.forge] || { repo: page };
}
