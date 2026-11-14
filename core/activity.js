// What someone has been doing on Rainshare, told ask by ask. Everything Rainshare writes is a
// record in its writer's own account, so this is read from theirs: the asks they posted, what
// they took on and turned in, what they commented, and who they vouched for on Tangled. Each
// ask is one story ("took it on, turned in a pull request, Juniper accepted it") rather than a
// line per record, since a take, a day added to it, a turn-in and three comments are one thing
// that happened.
//
// It says what happened and leaves out what didn't. A take that lapsed is still "took it on",
// with no mark for having gone quiet: that's said on the ask itself, where it matters to whoever
// asked, and a list of someone's lapses on their own page would read as a score. Comments are
// counted, not quoted. Denouncing someone on Tangled isn't listed: Rainshare only ever vouches.
import { describeSubject, pullPageOf } from './subjects.js';
import { stageOf, pictureOf } from './words.js';
import { parseUri } from './net.js';

const at = r => String(r?.value?.createdAt || '');
const later = (a, b) => (String(a) > String(b) ? a : b);
const seedOf = r => r?.value?.seed?.uri;

/** The ways to narrow it, and the tag each story carries for them. */
export const ACTIVITY_KINDS = [['all', 'Everything'], ['asks', 'Asks'], ['helping', 'Helping'], ['comments', 'Comments'], ['vouches', 'Vouches']];

/**
 * Stories, newest first. `asks` are their own seeds; `takes`, `deliveries` and `comments` their
 * records pointing at seeds; `vouches` [{ did, kind, reason, at, person }]; `seeds` a Map of
 * every seed those point at that can be shown (uri → { uri, repo, rkey, value, author, space }).
 * Anything pointing at a seed that isn't in `seeds` is left out: it's gone, hidden, or not for
 * whoever's looking.
 *
 *   { key, kind, seed, mine, steps: [{ what, at, … }], comments, at, tags }
 *
 * kind:  'asked' (their own ask), 'helped' (their work was accepted), 'turned-in', 'took',
 *        'talked' (only comments) or 'vouched' (with `person` and `reason` instead of a seed)
 * what:  'asked', 'took', 'turned-in' (with `link`, `idea`), 'accepted' (with `by`),
 *        'done' (their own ask, with `with`: whose work it was done with), 'closed'
 */
export function activityOf(did, { asks = [], takes = [], deliveries = [], comments = [], vouches = [], seeds = new Map() } = {}){
  const stories = new Map();
  const story = seed => {
    let s = stories.get(seed.uri);
    if (!s) stories.set(seed.uri, s = { key: seed.uri, seed, mine: seed.repo === did, steps: [], comments: 0, commentedAt: '', took: false, turnedIn: false, accepted: false });
    return s;
  };
  for (const a of asks) {
    const seed = seeds.get(a.uri); if (!seed) continue;
    const s = story(seed), v = seed.value || {};
    s.steps.push({ what: 'asked', at: at(seed) });
    const when = String(v.updatedAt || v.createdAt || '');
    if (v.state === 'sprouted') s.steps.push({ what: 'done', at: when, with: [...new Set((v.sproutedWith || []).map(r => parseUri(r?.uri)?.repo).filter(Boolean))] });
    else if (v.state === 'closed') s.steps.push({ what: 'closed', at: when });
  }
  // Taking an ask on, dropping it and taking it on again is still taking it on, once.
  for (const t of [...takes].sort((a, b) => at(a).localeCompare(at(b)))) {
    const seed = seeds.get(seedOf(t)); if (!seed) continue;
    const s = story(seed);
    if (!s.took) { s.took = true; s.steps.push({ what: 'took', at: at(t) }); }
  }
  for (const d of deliveries) {
    const seed = seeds.get(seedOf(d)); if (!seed) continue;
    const s = story(seed), v = seed.value || {};
    s.turnedIn = true;
    s.steps.push({ what: 'turned-in', at: at(d), link: pullPageOf(d.value || {}, v.subject) || null, idea: !describeSubject(v.subject) });
    if (v.state === 'sprouted' && (v.sproutedWith || []).some(r => r?.uri === d.uri) && !s.accepted) {
      s.accepted = true;
      if (!s.mine) s.steps.push({ what: 'accepted', at: String(v.updatedAt || v.createdAt || ''), by: seed.repo });
    }
  }
  for (const c of comments) {
    const seed = seeds.get(seedOf(c)); if (!seed) continue;
    const s = story(seed);
    s.comments++; s.commentedAt = later(s.commentedAt, at(c));
  }
  const out = [...stories.values()].map(s => {
    s.steps.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const kind = s.mine ? 'asked' : s.accepted ? 'helped' : s.turnedIn ? 'turned-in' : s.took ? 'took' : 'talked';
    const tags = new Set(['all']);
    if (s.mine) tags.add('asks');
    if (s.took || s.turnedIn) tags.add('helping');
    if (s.comments) tags.add('comments');
    const when = s.steps.reduce((m, x) => later(m, x.at), s.commentedAt);
    const { took, turnedIn, accepted, commentedAt, ...rest } = s;
    return { ...rest, kind, at: when, tags, stage: stageOf(s.seed.value), picture: pictureOf(s.seed.value) };
  });
  for (const v of vouches) {
    if (v?.kind !== 'vouch' || !v.did) continue;
    out.push({ key: 'vouch:' + v.did, kind: 'vouched', person: v.person || { did: v.did }, reason: v.reason || '', at: String(v.at || ''), steps: [], comments: 0, tags: new Set(['all', 'vouches']) });
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** How many stories carry each tag: { all, asks, helping, comments, vouches }. */
export function activityCounts(stories){
  const n = Object.fromEntries(ACTIVITY_KINDS.map(([k]) => [k, 0]));
  for (const s of stories || []) for (const t of s.tags) if (t in n) n[t]++;
  return n;
}
