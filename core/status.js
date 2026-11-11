// Where a seed stands: is it still open, is anyone on it, has anything been turned in, and
// what does the forge say (is the issue still open, did a pull request land). Every way of
// working a seed asks the same question before starting and after finishing, so the answer is
// worked out once, here: the app's pages, the brief an agent is handed, the CLI's `check`
// and the MCP server's `rainshare_check` all read it.
//
//   look(item)       asks the forge what only it knows, and notes the answers on the item
//   carry(from, to)  takes those answers along to a fresher copy of the same seed
//   standing(item)   reads the item and says where it stands, in facts and plain sentences
import { HARNESSES, labelOf } from './ns.js';
import { describeSubject, kindOf, subjectInfo, pullState, linkedPulls, FORGE_NAMES } from './subjects.js';
import { parseUri } from './net.js';

const DAY = 86400e3;
/** "today", "yesterday", "6 days ago", "3 weeks ago": how long since a record was written. */
export function since(iso, now = Date.now()){
  const days = Math.floor((now - Date.parse(iso)) / DAY);
  if (!(days >= 0)) return '';
  return days < 1 ? 'today' : days === 1 ? 'yesterday' : days < 14 ? `${days} days ago` : days < 60 ? `${Math.floor(days / 7)} weeks ago` : `${Math.floor(days / 30)} months ago`;
}
const nameOf = rec => rec.author?.handle ? '@' + rec.author.handle : rec.author?.displayName || rec.repo || 'Someone';
const bare = link => String(link || '').replace(/\/+$/, '');

/**
 * Ask the forge what Rainshare's own records can't say: whether the issue is still open,
 * whether each pull request turned in has been merged, and whether any pull request there
 * mentions this work without having been turned in. Notes the answers on the item
 * (`issue`, each delivery's `state`, `linked`) and returns it. Things it can't find out are
 * left unknown rather than guessed. Example seeds point at pretend repos, so they're skipped.
 */
export async function look(item){
  if (!item || item.example) return item;
  const sub = item.value?.subject, kind = kindOf(sub);
  await Promise.all([
    (kind === 'githubIssue' || kind === 'tangledIssue') && !item.issue ? subjectInfo(sub).then(i => { if (i) item.issue = i; }, () => {}) : null,
    item.linked === undefined ? linkedPulls(sub, { rkey: parseUri(item.uri)?.rkey }).then(l => { item.linked = l; }, () => { item.linked = null; }) : null,
    ...(item.deliveries || []).filter(d => d.state === undefined).map(async d => { d.state = await pullState({ url: d.value?.url, pull: d.value?.pull }).catch(() => null); })
  ]);
  item.lookedAt = Date.now();
  return item;
}
/**
 * A seed read again a moment later is a new copy, without what `look` found out. This takes
 * those answers along to it, if they're recent, so the forge isn't asked twice in a minute
 * (GitHub lets a browser that isn't signed in ask 60 things an hour).
 */
export function carry(from, to, { maxAge = 90e3, now = Date.now() } = {}){
  if (!from || !to || from === to || from.uri !== to.uri || !(now - from.lookedAt < maxAge)) return to;
  if (from.issue && !to.issue) to.issue = from.issue;
  if (from.linked !== undefined && to.linked === undefined) to.linked = from.linked;
  for (const d of to.deliveries || []) { const was = (from.deliveries || []).find(x => x.uri === d.uri); if (was && was.state !== undefined && d.state === undefined) d.state = was.state; }
  to.lookedAt = from.lookedAt;
  return to;
}

/**
 * Where a seed stands, for someone thinking of working on it (`viewer` is their DID, if known;
 * `asker` is what to call the person who planted it, where a sentence names them):
 *
 *   state        'open', 'sprouted' or 'closed'
 *   issue        'open' or 'closed' on the forge, or null if it isn't an issue or isn't known
 *   takes        [{ who, mine, since, with }]
 *   deliveries   [{ uri, who, mine, link, state, accepted }]   state: 'open', 'merged', 'closed' or null
 *   linked       pull requests on the forge that mention it and weren't turned in here
 *   verdict      'clear', 'on-it', 'turned-in', 'merged', 'issue-closed', 'sprouted' or 'closed'
 *   clear        whether there's nothing in the way of starting
 *   lines        the facts, as plain sentences
 *   advice       one sentence on what to do about them (about their own work, if it's already theirs: `yours`)
 *   planter      for the person who planted it, the next thing worth doing, or null:
 *                { do: 'sprout', delivery } | { do: 'look' } | { do: 'close' } | { do: 'close-issue', href }, each with `text`
 *                ('look': a pull request nobody turned in was merged; 'close': the issue was closed on the forge)
 */
export function standing(item, { viewer, now = Date.now(), asker = 'the person who planted it' } = {}){
  const sq = item?.value || {}, d = describeSubject(sq.subject), forge = d ? FORGE_NAMES[d.forge] || 'the forge' : 'the forge';
  const state = sq.state === 'sprouted' || sq.state === 'closed' ? sq.state : 'open';
  const who = rec => viewer && rec.repo === viewer ? 'You' : nameOf(rec);
  const accepted = new Set((sq.sproutedWith || []).map(r => r.uri));
  const takes = (item?.takes || []).map(t => ({ who: who(t), mine: !!viewer && t.repo === viewer, since: since(t.value?.createdAt, now), with: t.value?.setup?.harness ? labelOf(HARNESSES, t.value.setup.harness) : '' }));
  const deliveries = (item?.deliveries || []).map(dl => ({ uri: dl.uri, who: who(dl), mine: !!viewer && dl.repo === viewer, link: dl.value?.url || dl.value?.pull || '', state: dl.state || null, accepted: accepted.has(dl.uri) }));
  const turnedIn = new Set(deliveries.map(x => bare(x.link)));
  const linked = (item?.linked || []).filter(p => !turnedIn.has(bare(p.url)));
  const issue = item?.issue?.state === 'open' || item?.issue?.state === 'closed' ? item.issue.state : null;

  const others = takes.filter(t => !t.mine);
  const merged = [...deliveries, ...linked].some(x => x.state === 'merged');
  const waiting = [...deliveries.filter(x => !x.mine), ...linked].filter(x => x.state !== 'merged' && x.state !== 'closed');
  const verdict = state !== 'open' ? state : merged ? 'merged' : issue === 'closed' ? 'issue-closed' : waiting.length ? 'turned-in' : others.length && !sq.parallel ? 'on-it' : 'clear';

  const lines = [state === 'sprouted' ? 'It has sprouted: the work is done.' : state === 'closed' ? `It’s closed: ${asker} isn’t looking for help with it now.` : 'It’s open.'];
  if (issue) lines.push(`The issue is ${issue === 'open' ? 'still open' : 'closed'} on ${forge}.`);
  if (state === 'open' && !takes.length) lines.push('Nobody has taken it on yet.');
  if (state === 'open') for (const t of takes) lines.push(`${t.who} took it on${t.since ? ' ' + t.since : ''}${t.with ? `, with ${t.with}` : ''}.`);
  for (const dl of deliveries) lines.push(`${dl.who} turned in ${dl.link || 'a pull request'}${dl.state ? ` (${dl.state})` : ''}${dl.accepted ? ', and it made the seed sprout' : ''}.`);
  for (const p of linked) lines.push(`On ${forge}, pull request${p.number ? ' #' + p.number : ''}${p.by ? ` by @${p.by}` : ''} mentions it${p.state ? ` (${p.state})` : ''} and hasn’t been turned in on Rainshare: ${p.url}`);
  if (state === 'open' && sq.parallel && others.length) lines.push('More than one helper is welcome on this one.');

  const advice = {
    clear: 'It’s clear to start.',
    'on-it': `${others.map(t => t.who).join(' and ')} ${others.length > 1 ? 'are' : 'is'} already on it. Check with them, or with your user, before starting, so it isn’t done twice.`,
    'turned-in': 'There’s already a pull request for it. Read that first: a second one is only worth making if the first has stalled or missed the point.',
    merged: `A pull request for it has been merged, so there’s probably nothing left to do. It’s waiting for ${asker} to mark it sprouted.`,
    'issue-closed': `The issue has been closed on ${forge}. Ask before doing anything: it may be finished, or no longer wanted.`,
    sprouted: 'It’s done. There’s nothing to do here.',
    closed: 'It’s closed. There’s nothing to do here unless it’s reopened.'
  }[verdict];

  // If it's already theirs, what they're told is about their own work, not about starting.
  const own = deliveries.filter(x => x.mine);
  const yours = state !== 'open' ? null
    : own.some(x => x.state === 'merged') ? `Your pull request has been merged. It’s waiting for ${asker} to mark it sprouted: nothing more is needed from you.`
      : own.length && own.every(x => x.state === 'closed') ? 'Your pull request was closed without being merged. Ask what was missing, or drop the seed so someone else can pick it up.'
        : own.length ? `You’ve turned it in. It’s with ${asker} now: nothing more is needed unless they ask.`
          : takes.some(t => t.mine) && verdict === 'clear' ? 'You’re on it. When the pull request is up, turn it in.' : null;

  const landed = deliveries.find(x => x.state === 'merged' && !x.accepted);
  const planter = state === 'open'
    ? landed ? { do: 'sprout', delivery: landed.uri, text: `${landed.who === 'You' ? 'Your' : landed.who + '’s'} pull request has been merged. If that did it, mark it sprouted.` }
      : linked.some(p => p.state === 'merged') ? { do: 'look', text: `A pull request that mentions this was merged on ${forge}, though nobody turned it in here. If it did the job, mark this sprouted.` }
        : issue === 'closed' ? { do: 'close', text: `The issue is closed on ${forge}. If the work is done, mark this sprouted. If it’s no longer wanted, close it.` } : null
    : state === 'sprouted' && issue === 'open' ? { do: 'close-issue', href: d?.href || null, text: `The issue is still open on ${forge}. Close it there if it’s done.` } : null;

  return { state, issue, takes, deliveries, linked, verdict, clear: verdict === 'clear', lines, advice: yours || advice, yours: !!yours, planter };
}
