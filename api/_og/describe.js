// What a link preview says about a page: the words for its tags (api/page.js) and what its
// card shows (api/og.js, ./card.js). One place, so the picture and the words always agree.
//
// Both functions run on a server, on whatever an address says, so nothing here follows the
// network wherever it points: only two fixed hosts are asked. Slingshot (microcosm.blue's
// cache of records) has the ask and the asker's Rainshare profile, and Bluesky's AppView has
// their name and picture. Nobody's own server is contacted, and no DID document is read.
// What comes back was written by strangers: it's cleaned and cut to length here, and escaped
// where it's used.
import { SEED, PROFILE, SITE, audienceOf } from '../../core/ns.js';
import { isDid, isHandle, isRkey, parseUri } from '../../core/net.js';
import { whatItIs, pictureOf, askExcerpt, planText, nounOf } from '../../core/words.js';
import { plantKind } from '../../ui/bits.js';

export const SLINGSHOT = 'https://slingshot.microcosm.blue', APPVIEW = 'https://public.api.bsky.app';
const AVATARS = 'https://cdn.bsky.app/img/';
const BUDGET = 2500;   // ms for everything a page needs looked up; past it, the page gets the home card

/** Text from the network, made safe to show: no control characters or marks that reorder text, one line, cut to length. */
export function clean(s, max = 200){
  const t = String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, ' ').replace(/\s+/g, ' ').trim();
  const chars = [...t];
  return chars.length > max ? chars.slice(0, max - 1).join('').trimEnd() + '…' : t;
}
const an = noun => (/^[aeiou]/i.test(noun) ? 'an ' : 'a ') + noun;

/** The home page's own words (index.html's), for every page there's nothing particular to say about. */
export const HOME = {
  kind: 'home', path: '/', title: 'Rainshare', heading: 'Rainshare',
  description: 'People post ideas and projects they want help with. Pick one and send your own AI agent to do the work, with what’s left on your plan before it resets.',
  social: 'Got rain to spare? Send your agent to help someone else.',
  alt: 'Rainshare. Got rain to spare? Send your agent to help someone else. Beside the words, a small garden where two clouds are raining on young plants.',
  image: '/og.jpg', card: null
};
// Pages that say the same thing to everyone.
const FIXED = {
  agents: { path: '/agents', heading: 'Send your agent', line: 'Paste a brief into any agent, or set up one small file and yours can find work, take it on and turn it in.', plant: 'established-7' },
  example: { path: '/example', heading: 'An example circle', line: 'Made-up people and their asks. Send an agent, ask for rain, mark something done. Nothing leaves your browser.', plant: 'young-4' }
};
const fixed = kind => {
  const f = FIXED[kind];
  return { kind, path: f.path, title: `${f.heading} · Rainshare`, heading: f.heading, description: f.line, social: f.line, alt: `${f.heading}, on Rainshare. ${f.line}`, image: `/api/og?kind=${kind}`, card: { type: 'page', heading: f.heading, line: f.line, plant: f.plant } };
};

async function getJson(url, signal){
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal });
    return r.ok ? await r.json() : null;
  } catch (_) { return null; }
}
const record = (repo, collection, rkey, signal) => getJson(`${SLINGSHOT}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(repo)}&collection=${collection}&rkey=${encodeURIComponent(rkey)}`, signal);
const who = raw => { const w = String(raw ?? '').trim().replace(/^@/, ''); return isDid(w) ? w : isHandle(w) ? w.toLowerCase() : null; };
// The record a cache hands back is believed only as far as it's the one that was asked for.
const valueAt = (rec, collection, rkey, did) => {
  const at = parseUri(rec?.uri), v = rec?.value;
  return at && isDid(at.repo) && at.collection === collection && at.rkey === rkey && (!did || at.repo === did) && v && typeof v === 'object' && !Array.isArray(v) ? { did: at.repo, value: v } : null;
};
// Someone as their Bluesky profile names them, unless their Rainshare profile gives a name or bio of its own.
function person(did, asked, bsky, own){
  const b = bsky && bsky.did === did ? bsky : null, mine = own?.value || null;
  const handle = isHandle(b?.handle) ? b.handle.toLowerCase() : isHandle(asked) ? asked : null;
  const avatar = typeof b?.avatar === 'string' && b.avatar.startsWith(AVATARS) ? b.avatar : null;
  return {
    did, handle, avatar,
    name: clean(mine?.displayName || b?.displayName || (handle ? '@' + handle : 'Someone'), 64),
    bio: clean(mine?.bio || b?.description || '', 220),
    plan: mine ? clean(planText(mine) || '', 60) : ''
  };
}

async function seedPage(rawWho, rkey, signal){
  const asked = who(rawWho);
  if (!asked || !isRkey(rkey)) return null;
  const [rec, bsky, own] = await Promise.all([record(asked, SEED, rkey, signal), getJson(`${APPVIEW}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(asked)}`, signal), record(asked, PROFILE, 'self', signal)]);
  const got = valueAt(rec, SEED, rkey, isDid(asked) ? asked : null), sq = got?.value;
  if (!got || typeof sq.title !== 'string' || !clean(sq.title)) return null;
  // An ask that's for some people only is shown only to them in the app, so a preview doesn't say what it is.
  if (audienceOf(sq) !== 'anyone') return null;
  const p = person(got.did, asked, bsky, valueAt(own, PROFILE, 'self', got.did)), uri = `at://${got.did}/${SEED}/${rkey}`;
  const heading = clean(sq.title, 120), what = whatItIs(sq), excerpt = clean(askExcerpt(typeof sq.spec === 'string' ? sq.spec : ''), 200);
  const state = sq.state === 'sprouted' ? 'done' : sq.state === 'closed' ? 'closed' : 'open', stage = pictureOf(sq), kind = plantKind(uri);
  const asks = state === 'open' ? `${p.name} is asking for help with ${an(nounOf(sq))} on Rainshare.` : state === 'done' ? `${an(nounOf(sq)).replace(/^a/, 'A')} of ${p.name}’s on Rainshare, done with help from someone else’s agent.` : `${an(nounOf(sq)).replace(/^a/, 'A')} of ${p.name}’s on Rainshare.`;
  return {
    kind: 'seed', path: `/seed/${p.handle || got.did}/${rkey}`, title: `${heading} · Rainshare`, heading,
    description: clean(`${asks} ${excerpt}`, 280), social: clean(excerpt || asks, 200),
    alt: clean(`${heading}. ${what.name}: ${what.note} ${asks}`, 400),
    image: `/api/og?kind=seed&who=${encodeURIComponent(got.did)}&rkey=${encodeURIComponent(rkey)}`,
    card: { type: 'seed', heading, what: what.name, note: what.note, state, plant: `${stage}${kind ? '-' + kind : ''}`, person: p }
  };
}
async function personPage(rawWho, signal){
  const asked = who(rawWho);
  if (!asked) return null;
  const [bsky, own] = await Promise.all([getJson(`${APPVIEW}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(asked)}`, signal), record(asked, PROFILE, 'self', signal)]);
  const did = isDid(bsky?.did) && (!isDid(asked) || bsky.did === asked) ? bsky.did : null;
  if (!did) return null;
  const p = person(did, asked, bsky, valueAt(own, PROFILE, 'self', did));
  const line = p.bio || `${p.name}’s ideas and projects on Rainshare, and what they’ve helped with.`;
  return {
    kind: 'person', path: `/u/${p.handle || did}`, title: `${p.name} · Rainshare`, heading: p.name,
    description: clean(`${p.name} on Rainshare. ${line}`, 280), social: line,
    alt: clean(`${p.name}${p.handle ? ` (@${p.handle})` : ''} on Rainshare. ${p.bio}${p.plan ? ` AI plan: ${p.plan}.` : ''}`, 400),
    image: `/api/og?kind=person&who=${encodeURIComponent(did)}`,
    card: { type: 'person', person: p }
  };
}

/**
 * What to say about the page a request is for. `q` is the query the rewrites in vercel.json
 * hand over: { kind: 'seed' | 'person' | 'agents' | 'example', who, rkey }. Anything that isn't
 * valid, can't be found or takes too long gets the home page's words: never an error.
 */
export async function describe(q = {}, { budget = BUDGET } = {}){
  const kind = String(q.kind || '');
  try {
    if (kind in FIXED) return fixed(kind);
    const signal = AbortSignal.timeout(budget);
    const page = kind === 'seed' ? await seedPage(q.who, q.rkey, signal) : kind === 'person' ? await personPage(q.who, signal) : null;
    return page || HOME;
  } catch (_) { return HOME; }
}

/** The address a page is known by (SITE in core/ns.js), for og:url. */
export const canonical = page => SITE + (page.path === '/' ? '/' : page.path);
