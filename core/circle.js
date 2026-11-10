// Who a seed is for, and how close its author is to you.
//
// A public seed says who it's meant for (`audience`): apps show it only to those people
// and only take help from them. It's a filter, not a lock: anything in a public repo can be
// read by anyone. A private seed lives in a group's space, which only members can read.
import { audienceOf } from './ns.js';

/**
 * How the viewer and the author are connected, from the viewer's side:
 * 'self', 'group' (a private seed in a group you're both in), 'mutual',
 * 'follows-you' (they follow you), 'you-follow' (you follow them), or null.
 */
export function closeness({ viewer, author, rel, group }){
  if (viewer && viewer === author) return 'self';
  if (group) return 'group';
  if (!rel) return null;
  if (rel.following && rel.followedBy) return 'mutual';
  if (rel.followedBy) return 'follows-you';
  if (rel.following) return 'you-follow';
  return null;
}
export const CLOSENESS = { self: 'You', group: 'Your group', mutual: 'Mutual', 'follows-you': 'Follows you', 'you-follow': 'You follow them' };

/**
 * Whether the viewer is someone this seed is meant for.
 *   rel      the relationship from the viewer's side: following (viewer follows author),
 *            followedBy (author follows viewer), blocking, blockedBy
 *   inList   whether the viewer is on the list a #list seed names
 */
export function meantFor(record, { viewer, author, rel, inList, group }){
  if (viewer && viewer === author) return true;
  if (rel?.blocking || rel?.blockedBy) return false;
  if (group) return true;
  const a = audienceOf(record);
  if (a === 'anyone') return true;
  if (!viewer) return false;
  if (a === 'following') return !!rel?.followedBy;
  if (a === 'followers') return !!rel?.following;
  if (a === 'mutuals') return !!(rel?.following && rel?.followedBy);
  if (a === 'list') return !!inList;
  return false;
}

/** Who a seed is for, said from the author's side. */
export function audienceLine(record, { authorName = 'them', groupName } = {}){
  const a = audienceOf(record);
  if (authorName === 'you') return { following: 'For people you follow', followers: 'For your followers', mutuals: 'For your mutuals', list: 'For people on one of your lists', group: groupName ? `Private to ${groupName}` : 'Private to a group' }[a] || 'Open to everyone';
  return {
    anyone: 'Open to everyone',
    following: `For people ${authorName} follows`,
    followers: `For ${authorName}’s followers`,
    mutuals: `For ${authorName}’s mutuals`,
    list: `For people on one of ${authorName}’s lists`,
    group: groupName ? `Private to ${groupName}` : 'Private to a group'
  }[a] || 'Open to everyone';
}
