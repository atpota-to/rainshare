// How you and someone else are connected, said from your side: who follows whom on Bluesky
// and on Tangled, and which of the people you follow on Bluesky follow them. (What your
// Tangled circle has vouched is in ./vouch.js.) It's shown beside the people who ask and the
// people who help, as something to weigh before you send an agent to their repo or merge what
// theirs sent, and it can narrow the board to people you know. None of it changes who an ask
// is for, or who can take it on: that's the ask's own audience (./circle.js).
//
//   Bluesky   app.bsky.graph.getRelationships on the public AppView, as for audiences.
//             "Followed by people you follow" asks it about the people you follow, 30 at a
//             time, from the ones you followed most recently, so a long follow list is checked
//             only in part (and that's said) rather than with a call for every few people.
//   Tangled   a follow is a public record in the follower's own account,
//             org.tangled.graph.follow, keyed by the DID of who they follow (as a vouch is).
//             So your follows are one listing of your records, and whether someone follows you
//             is one read of theirs. Follows from before Tangled's relaunch
//             (sh.tangled.graph.follow, keyed by time) aren't read.
//
// Following is cheap: anyone can follow you. A follow you made, and the people you follow
// following them, say more than a follow back.
import { listRecords, getRecordOrNull, relationships, isDid } from './net.js';

export const FOLLOW = 'org.tangled.graph.follow';

/** Who someone follows on Tangled: a Set of DIDs, from the keys of their follow records. */
export async function tangledFollowsOf(did, { pages = 10 } = {}){
  const recs = await listRecords(did, FOLLOW, { limit: 100, pages });
  return new Set(recs.map(r => r.rkey).filter(k => isDid(k) && k !== did));
}
/** Whether `did` follows `subject` on Tangled: one read of their record about them. */
export async function followsOnTangled(did, subject){
  if (!isDid(did) || !isDid(subject) || did === subject) return false;
  return !!(await getRecordOrNull(did, FOLLOW, subject));
}
/**
 * Which of `follows` (the people `viewer` follows on Bluesky, most recent first) follow `did`
 * there. Since only the first few get named, the ones who follow `viewer` back come first:
 * they're likelier to be people the viewer actually knows.
 */
export async function knownFollowers(did, follows, { viewer } = {}){
  const rel = await relationships(did, follows);
  const known = follows.filter(d => d !== did && rel.get(d)?.followedBy);
  if (!viewer || known.length <= 2) return known;
  const back = await relationships(viewer, known.slice(0, 90)).catch(() => null);
  return back ? [...known.filter(d => back.get(d)?.followedBy), ...known.filter(d => !back.get(d)?.followedBy)] : known;
}

/*
 * Ties, as the data source hands them over, for one other person:
 *   { bsky: { following, followedBy } | null, tangled: { following, followedBy } | null }
 * following: you follow them. followedBy: they follow you. A network that couldn't be read is
 * null, and on Tangled either half can be null by itself (their server didn't answer).
 */

/** Across both networks: 'mutual', 'follows-you', 'you-follow' or null. A follow on either counts. */
export function tieOf(t){
  const you = !!(t?.bsky?.following || t?.tangled?.following), them = !!(t?.bsky?.followedBy || t?.tangled?.followedBy);
  return you && them ? 'mutual' : them ? 'follows-you' : you ? 'you-follow' : null;
}
/** A tie in a word or two, for beside a name. */
export const TIE_SHORT = { mutual: 'mutual', 'follows-you': 'follows you', 'you-follow': 'you follow them' };

const list = (xs, word = 'and') => xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ${word} ${xs[xs.length - 1]}` : xs[0] || '';
/**
 * The ties as plain sentences about `name` (their first name), one for each way they're
 * connected: "You follow each other on Bluesky." "Juniper follows you on Tangled." If neither
 * network has any, one sentence says so. A network that couldn't be read says nothing.
 */
export function tieLines(t, name = 'Someone'){
  const by = new Map();
  for (const [net, x] of [['Bluesky', t?.bsky], ['Tangled', t?.tangled]]) {
    if (!x) continue;
    const k = x.following && x.followedBy ? 'each' : x.followedBy ? 'them' : x.following ? 'you' : 'none';
    by.set(k, [...(by.get(k) || []), net]);
  }
  const say = { each: on => `You follow each other on ${list(on)}.`, them: on => `${name} follows you on ${list(on)}.`, you: on => `You follow ${name} on ${list(on)}.` };
  const out = ['each', 'them', 'you'].filter(k => by.has(k)).map(k => say[k](by.get(k)));
  return out.length ? out : by.has('none') ? [`You don’t follow each other on ${list(by.get('none'), 'or')}.`] : [];
}
/**
 * Who you follow that follows them, as a sentence: "Followed by Kai Nakamura and Priya Shah,
 * who you follow on Bluesky." `known` is { people, count, partial }, as knownFollowers in the
 * data source gives it; `name` names one of the people. Nothing is said when it couldn't be
 * read, or when only part of your follow list was checked and none of them follow them.
 */
export function knownText(known, them = 'them', name = p => p?.displayName || (p?.handle ? '@' + p.handle : 'someone')){
  if (!known) return '';
  const n = known.count || 0, named = (known.people || []).slice(0, 2).map(name), more = known.partial ? ' There may be more.' : '';
  if (!n) return known.partial ? '' : `Nobody you follow on Bluesky follows ${them}.`;
  if (n > named.length) return `Followed by ${named.join(', ')}${named.length ? ' and ' : ''}${n - named.length} ${named.length ? (n - named.length === 1 ? 'other' : 'others') : (n === 1 ? 'person' : 'people')} you follow on Bluesky.${more}`;
  return `Followed by ${list(named)}, who you follow on Bluesky.${more}`;
}

/** The ways to narrow a board by who asked, and how each is said. */
export const FROM = [['anyone', 'Anyone'], ['mutuals', 'Mutuals'], ['following', 'You follow'], ['followers', 'Follow you'], ['vouched', 'Vouched for']];
export const FROM_KEYS = FROM.map(([k]) => k);
/**
 * Whether someone is one of those. `t` is their ties; `word` is your Tangled circle's word on
 * them (wordOn in ./vouch.js): "vouched for" means a vouch from you, or from people you vouch
 * for with nobody there denouncing them.
 */
export function fromMatches(from, t, word){
  if (!from || from === 'anyone') return true;
  if (from === 'vouched') return word?.kind === 'vouch';
  const tie = tieOf(t);
  if (from === 'mutuals') return tie === 'mutual';
  if (from === 'following') return tie === 'mutual' || tie === 'you-follow';
  if (from === 'followers') return tie === 'mutual' || tie === 'follows-you';
  return false;
}
