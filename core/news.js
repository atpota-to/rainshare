// What's news to someone about their own asks and their work: someone's on one of their asks,
// someone's turned work in on one, or an ask they were on was marked done or closed. Two things
// say it, and this is what keeps them saying the same thing:
//
//   - @rainshare.dev's direct messages (../announcer/src/messages.js), for whoever asked for them
//   - the bell in the bar (./notices.js), for whoever's signed in
//
// It reads only records: seeds, takes and deliveries, as the board has them. Who's blocked and
// what's been hidden is left out by whoever calls it, since each reads those its own way.

const within = (t, from, to) => { const x = Date.parse(t); return x >= from && x < to; };

/**
 * `did`'s updates from `from` up to `to` (ms), in no particular order:
 *
 *   { kind, seed, by, url, at, uri }
 *
 * kind:  'take' (someone's on your ask), 'delivery' (someone turned in work on it, with `url`
 *        when it's a link), 'done-yours' (an ask you turned in on was marked done with your
 *        work), 'done' (with someone else's), 'closed'
 * by:    whose doing it was (the helper, or for the last three, whoever asked)
 * uri:   the record it's about: the take or delivery, or the seed for the last three
 *
 * Someone who's turned in work on an ask is on it, so a take by the same person on the same
 * ask in the same time isn't said as well. `theirBlocks` is who `did` blocks: their doings
 * aren't news to them.
 */
export function updatesFor(did, { seeds = [], takes = [], deliveries = [], from, to, theirBlocks = new Set() }){
  const updates = [], bySeed = new Map(seeds.map(s => [s.uri, s])), at = x => Date.parse(x.value?.createdAt);
  const onMine = list => list.filter(x => bySeed.get(x.value?.seed?.uri)?.repo === did && x.repo !== did && !theirBlocks.has(x.repo) && within(x.value?.createdAt, from, to));
  const turnedIn = onMine(deliveries);
  for (const d of turnedIn) updates.push({ kind: 'delivery', seed: bySeed.get(d.value.seed.uri), by: d.repo, url: /^https?:\/\//.test(d.value?.url || '') ? d.value.url : null, at: at(d), uri: d.uri });
  for (const t of onMine(takes)) if (!turnedIn.some(d => d.repo === t.repo && d.value.seed.uri === t.value.seed.uri)) updates.push({ kind: 'take', seed: bySeed.get(t.value.seed.uri), by: t.repo, at: at(t), uri: t.uri });
  // Asks they've been on that were marked done or closed in the time.
  const mine = list => list.filter(x => x.repo === did);
  for (const uri of new Set([...mine(takes), ...mine(deliveries)].map(x => x.value?.seed?.uri))) {
    const sq = bySeed.get(uri), state = sq?.value?.state;
    if (!sq || sq.repo === did || theirBlocks.has(sq.repo) || !['sprouted', 'closed'].includes(state) || !within(sq.value.updatedAt, from, to)) continue;
    const theirs = new Set(mine(deliveries).map(d => d.uri)), withTheirs = (sq.value.sproutedWith || []).some(ref => theirs.has(ref?.uri));
    updates.push({ kind: state === 'closed' ? 'closed' : withTheirs ? 'done-yours' : 'done', seed: sq, by: sq.repo, at: Date.parse(sq.value.updatedAt), uri: sq.uri });
  }
  return updates;
}
