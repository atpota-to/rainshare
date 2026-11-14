// The garden someone has watered: every seed and plant whose planter marked it sprouted with
// that person's work. It's worked out from records that already exist (the helper's delivery,
// and the planter's own record naming that delivery), so nobody can add to their own, and
// there's nothing to spend. It's a picture of what someone has helped with, shown on their
// profile; it isn't a score, and people aren't ranked by it.
//
// Beside it can grow buds: work the forge says was merged, on an ask that's still open because
// whoever asked hasn't accepted it yet. Only the forge vouches for those, so they're drawn
// apart, say who they're waiting on, and aren't counted.
import { stageOf, pictureOf } from './words.js';
import { pullPageOf, repoPageOf, describeSubject } from './subjects.js';

const accepted = it => new Set((it?.value?.sproutedWith || []).map(r => r?.uri).filter(Boolean));
const theirs = (it, did) => (it?.deliveries || []).filter(d => d?.repo === did);
const newest = (a, b) => String(b.at).localeCompare(String(a.at));
const isOpen = it => !it?.value?.state || it.value.state === 'open';
const text = (s, max) => typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '';

// One plant, with what's worth saying beside it: whose ask it was, when, the work itself and
// what it was done with, and what whoever asked said when they accepted it. `shared` is false
// for an ask that isn't meant for whoever's looking: the plant shows, its name doesn't.
function plot(it, d, extra){
  const sq = it.value || {};
  return {
    uri: it.uri, repo: it.repo, rkey: it.rkey, space: it.space || null, author: it.author || null,
    title: sq.title, stage: stageOf(sq), picture: pictureOf(sq), idea: !describeSubject(sq.subject),
    delivery: d.uri, link: pullPageOf(d.value || {}, sq.subject) || null, setup: d.value?.setup || null,
    shared: it.shared !== false, ...extra
  };
}

/**
 * From seeds and plants that carry their deliveries, the ones `did` helped finish, newest
 * first: [{ uri, repo, rkey, space, author, title, stage, picture, idea, at, delivery, link,
 * setup, thanks, shared }]. `stage` is what it was when they helped; `picture` is what it has
 * grown into, which is what the garden shows. `at` is when it was accepted, as near as the
 * record says; `thanks` is what whoever asked said then, if anything.
 */
export function wateredBy(did, items){
  return (items || []).filter(it => it?.value?.state === 'sprouted').flatMap(it => {
    const ok = accepted(it), d = theirs(it, did).filter(x => ok.has(x.uri)).sort((a, b) => String(b.value?.createdAt || '').localeCompare(String(a.value?.createdAt || '')))[0];
    return d ? [plot(it, d, { at: it.value.updatedAt || it.value.createdAt || '', thanks: text(it.value.thanks, 600) })] : [];
  }).sort(newest);
}

/** Whether a pull request's page is on the ask's own repo. One elsewhere proves nothing about this ask. */
export function onRepo(link, subject){
  const page = repoPageOf(subject), l = String(link || '').toLowerCase();
  return !!page && !!l && l.startsWith(page.toLowerCase().replace(/\/+$/, '') + '/');
}

/**
 * The buds: asks still open, where `did` turned in a pull request on the ask's own repo that the
 * forge says was merged (each delivery's `state`, as ./status.js finds it out), and whoever
 * asked hasn't accepted it. Newest first, shaped like the garden's plants, with `budding` set,
 * `picture` what the ask is now (it hasn't grown yet), and `at` when the work was turned in.
 */
export function budsOf(did, items){
  return (items || []).filter(isOpen).flatMap(it => {
    const ok = accepted(it), d = theirs(it, did).filter(x => x.state === 'merged' && !ok.has(x.uri) && onRepo(pullPageOf(x.value || {}, it.value?.subject), it.value?.subject))
      .sort((a, b) => String(b.value?.createdAt || '').localeCompare(String(a.value?.createdAt || '')))[0];
    return d ? [plot(it, d, { at: d.value?.createdAt || '', budding: true, picture: pictureOf({ ...it.value, state: undefined }), thanks: '' })] : [];
  }).sort(newest);
}

/** "Nothing yet", "1 idea", "2 projects", "1 idea and 3 projects". */
export function wateredText(garden){
  const ideas = (garden || []).filter(g => g.stage === 'seed').length, projects = (garden || []).length - ideas;
  const say = (n, one) => n ? `${n} ${one}${n === 1 ? '' : 's'}` : '';
  return [say(ideas, 'idea'), say(projects, 'project')].filter(Boolean).join(' and ') || 'Nothing yet';
}
