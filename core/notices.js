// The bell in the bar: what's happened lately on your asks and your work, and what's new on
// Rainshare itself. Nothing is stored for it anywhere but this browser. It's worked out from
// what the site has already read, each time:
//
//   - the board (./source.js), which has every ask you can see with its takes and deliveries.
//     What's news there is ./news.js, the same as @rainshare.dev's direct messages say.
//   - comments on your asks, and on the asks you've commented on or are helping with, read
//     through Constellation as an ask's page reads them. Comments on a Tangled or knotless
//     issue are the forge's, and the forge tells people about those, so they aren't here.
//   - the release notes (./releases.js)
//
// What you've seen is kept in this browser (`seen`, below), by what each notice is about
// rather than by its time: a record can reach the network a minute or two after it was
// written, and by then you may have opened the bell. Whoever's blocked and whatever
// @rainshare.dev has hidden has already been left out by what's handed in.
import { updatesFor } from './news.js';
import { releasesBy, releasedAt, RELEASES } from './releases.js';
import { askExcerpt } from './words.js';
import { INVISIBLE } from './scan.js';
import { parseUri } from './net.js';

const MINUTE = 60e3, DAY = 24 * 60 * MINUTE;
// How far back the bell looks; the first time, how much of that counts as new; how many it
// lists; how far ahead of this browser's clock someone else's can be; how many seen notices
// are remembered (far more than there are in WINDOW).
export const WINDOW = 30 * DAY, FIRST_LOOK = 7 * DAY, MAX = 40, SKEW = 5 * MINUTE, KEEP = 500;

// A comment, as a line under a notice: plain words, with nothing a person can't see.
const UNSEEN = /[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g;
export const said = text => askExcerpt(String(text ?? '').replace(INVISIBLE, '').replace(UNSEEN, ' '), 140);

/**
 * Everything the bell has for `did`, newest first, at most MAX:
 *
 *   { key, kind, at, seed, by, person, url, text, release }
 *
 * kind:  from ./news.js: 'take', 'delivery', 'done-yours', 'done', 'closed'
 *        'comment'  someone commented on your ask
 *        'reply'    someone replied to a comment of yours
 *        'asker'    whoever asked commented on an ask you're on or turned work in on
 *        'release'  a release note (`release`, from ./releases.js)
 * key:   what it's about, for knowing whether it's been seen: the record's URI (an ask's, with
 *        when it changed, for done and closed), or the release note's id
 * person: whoever `by` is, as the board names them, if it does
 * text:  what a comment said, cut short (`said`)
 *
 * `items` are the board's; `comments` are any more read for the bell (./source.js commentsFor).
 * An item that came with its own comments (one in a group's space, or on the example board)
 * brings them along.
 */
export function noticesFor(did, { items = [], comments = [], releases = RELEASES, now = Date.now() } = {}){
  const from = now - WINDOW, to = now + SKEW, out = [];
  const inTime = t => t >= from && t < to;
  if (did) {
    const takes = items.flatMap(it => it.takes || []), deliveries = items.flatMap(it => it.deliveries || []);
    const known = new Set(), talk = [...items.flatMap(it => it.comments || []), ...comments].filter(c => c?.uri && !c.forge && !known.has(c.uri) && known.add(c.uri));
    const people = new Map();
    for (const r of [...items, ...takes, ...deliveries, ...talk]) if (r?.repo && r.author) people.set(r.repo, r.author);
    const bySeed = new Map(items.map(it => [it.uri, it]));
    for (const n of updatesFor(did, { seeds: items, takes, deliveries, from, to })) {
      const key = ['done', 'done-yours', 'closed'].includes(n.kind) ? `${n.kind}:${n.uri}@${n.seed.value?.updatedAt}` : `${n.kind}:${n.uri}`;
      out.push({ ...n, key, person: people.get(n.by) || null });
    }
    // Comments: on your asks, replying to you, and from whoever asked on the asks you're helping with.
    const helping = new Set([...takes, ...deliveries].filter(r => r.repo === did).map(r => r.value?.seed?.uri));
    const whose = new Map(talk.map(c => [c.uri, c.repo]));
    for (const c of talk) {
      const seed = bySeed.get(c.value?.seed?.uri), at = Date.parse(c.value?.createdAt), text = said(c.value?.text);
      if (c.repo === did || !seed || !inTime(at) || !text) continue;
      const parent = c.value?.parent?.uri, answers = parent ? whose.get(parent) || parseUri(parent)?.repo : null;
      const kind = answers === did ? 'reply' : seed.repo === did ? 'comment' : c.repo === seed.repo && helping.has(seed.uri) ? 'asker' : null;
      if (kind) out.push({ key: 'comment:' + c.uri, kind, at, seed, by: c.repo, person: people.get(c.repo) || null, text, uri: c.uri });
    }
  }
  for (const r of releasesBy(to, releases)) {
    const at = releasedAt(r);
    if (inTime(at)) out.push({ key: 'release:' + r.id, kind: 'release', at, release: r });
  }
  return out.sort((a, b) => b.at - a.at || String(a.key).localeCompare(String(b.key))).slice(0, MAX);
}

/* ---------- what's been seen ---------- */
// { since, keys }: anything from before `since` counts as seen, and so does anything whose key
// is in `keys`. The first time there's nothing kept, `since` is a week back, so what happened
// in the last week is new and anything older isn't. Opening the bell adds what's in it to `keys`.

/** What's kept, made safe to use whatever was found in storage. Null if there's nothing usable. */
export function seenFrom(raw){
  if (!raw || typeof raw !== 'object' || !Number.isFinite(Date.parse(raw.since))) return null;
  return { since: new Date(Date.parse(raw.since)).toISOString(), keys: (Array.isArray(raw.keys) ? raw.keys : []).filter(k => typeof k === 'string').slice(0, KEEP) };
}
/** Where someone starts, the first time. */
export const firstSeen = (now = Date.now()) => ({ since: new Date(now - FIRST_LOOK).toISOString(), keys: [] });
/** The keys of what in `list` is new to someone who has seen `seen`. */
export function freshIn(list, seen, now = Date.now()){
  const s = seenFrom(seen) || firstSeen(now), since = Date.parse(s.since), keys = new Set(s.keys);
  return new Set((list || []).filter(n => n.at >= since && !keys.has(n.key)).map(n => n.key));
}
/** What's seen once `list` has been looked at. */
export function markRead(list, seen, now = Date.now()){
  const s = seenFrom(seen) || firstSeen(now);
  return { since: s.since, keys: [...new Set([...(list || []).map(n => n.key), ...s.keys])].slice(0, KEEP) };
}
