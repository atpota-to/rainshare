// The garden someone has watered: every seed and plant whose planter marked it sprouted with
// that person's work. It's worked out from records that already exist (the helper's delivery,
// and the planter's own record naming that delivery), so nobody can add to their own, and
// there's nothing to spend. It's a picture of what someone has helped with, shown on their
// profile; it isn't a score, and people aren't ranked by it.
import { stageOf, pictureOf } from './words.js';

/**
 * From seeds and plants that carry their deliveries, the ones `did` helped finish, newest
 * first: [{ uri, repo, rkey, space, author, title, stage, picture, at }]. `stage` is what it
 * was when they helped; `picture` is what it has grown into, which is what the garden shows.
 */
export function wateredBy(did, items){
  return (items || [])
    .filter(it => it?.value?.state === 'sprouted' && (it.value.sproutedWith || []).some(ref => (it.deliveries || []).some(d => d.uri === ref.uri && d.repo === did)))
    .map(it => ({ uri: it.uri, repo: it.repo, rkey: it.rkey, space: it.space || null, author: it.author || null, title: it.value.title, stage: stageOf(it.value), picture: pictureOf(it.value), at: it.value.updatedAt || it.value.createdAt || '' }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
/** "Nothing yet", "1 seed", "2 plants", "1 seed and 3 plants". */
export function wateredText(garden){
  const seeds = (garden || []).filter(g => g.stage === 'seed').length, plants = (garden || []).length - seeds;
  const say = (n, one) => n ? `${n} ${one}${n === 1 ? '' : 's'}` : '';
  return [say(seeds, 'seed'), say(plants, 'plant')].filter(Boolean).join(' and ') || 'Nothing yet';
}
