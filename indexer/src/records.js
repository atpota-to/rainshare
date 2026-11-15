// records.js
// What the index keeps: every dev.rainshare.* record on the network, as a rainshare_records row,
// and a Jetstream v2 event as what to do with it.
//
// Every collection in the lexicon is kept (../../core/ns.js): asks (seed), takes, turn-ins
// (delivery), comments, profiles and settings (preferences). Moderation records are kept only
// from @rainshare.dev's own repo (MODERATOR), since only that repo's count; the same record in
// anyone else's repo is nothing to the index.
//
// The checks are cheap shape checks, enough that every row is safe to store and to join on:
// a take's, a turn-in's or a comment's ask (`subject_uri`), and what a moderation record is
// about. The apps still read each record as they always have. A record that fails them isn't
// kept: a create or an update that fails becomes a delete of that URI, so a record edited into
// junk leaves the index.
//
// Two things Postgres refuses would otherwise jam the stream: a NUL (\u0000) anywhere in a jsonb
// string, and a lone UTF-16 surrogate. A record carrying either is junk too.
//
// Written after atpota-to/atpota.to's garden/src/records.js, which does the same for the garden.
import { NS, SEED, TAKE, DELIVERY, COMMENT, PROFILE, PREFERENCES, MODERATION, MODERATOR } from '../../core/ns.js';

/** What reconcile lists from every repo that has any. (Moderation only from MODERATOR's.) */
export const RECONCILED = [SEED, TAKE, DELIVERY, COMMENT, PROFILE, PREFERENCES];
/** Everything the index holds. */
export const COLLECTIONS = [...RECONCILED, MODERATION];
/** What Jetstream v2 is asked for: the whole lexicon, by its wildcard. */
export const STREAM_COLLECTIONS = [NS + '.*'];
export const COMMIT_TYPE = 'network.bsky.jetstream.subscribeEvents#commit';
export { MODERATOR };

export const DID_RE = /^did:[a-z]+:[A-Za-z0-9._:%-]{1,2000}$/;
export const RKEY_RE = /^[A-Za-z0-9._:~-]{1,512}$/;
export const CID_RE = /^[a-zA-Z0-9]{8,200}$/;
// An ask's spec can be 100,000 characters (lexicons/dev/rainshare/seed.json), and the rest of it
// comes on top.
export const MAX_RECORD_CHARS = 120_000;

const UNSTORABLE = /\\u0000|\\ud[89ab][0-9a-f]{2}(?!\\ud[c-f][0-9a-f]{2})|(?<!\\ud[89ab][0-9a-f]{2})\\ud[c-f][0-9a-f]{2}/i;
const AT_URI = /^at:\/\/[^/\s]+(\/[^/\s]+\/[^/\s]+)?$/;

export const uriOf = (did, collection, rkey) => `at://${did}/${collection}/${rkey}`;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isRef = (v) => isObject(v) && typeof v.uri === 'string' && AT_URI.test(v.uri) && v.uri.length <= 8192;

/** An ISO time Postgres will take (years 0001 to 9999), or null. */
export function isoOrNull(value) {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const iso = new Date(ms).toISOString();
  return /^(?!0000)\d{4}-/.test(iso) ? iso : null;
}

/**
 * What a record is about: a take's, a turn-in's or a comment's ask, a moderation record's
 * subject (null for an ask, a profile or settings); undefined when its shape is wrong.
 */
function subjectOf(collection, r) {
  if (collection === SEED) return typeof r.title === 'string' && typeof r.createdAt === 'string' ? null : undefined;
  if (collection === TAKE || collection === DELIVERY || collection === COMMENT) return isRef(r.seed) ? r.seed.uri : undefined;
  if (collection === MODERATION) return typeof r.subject === 'string' && AT_URI.test(r.subject) && typeof r.action === 'string' ? r.subject : undefined;
  if (collection === PROFILE || collection === PREFERENCES) return null;
  return undefined;
}

/** True when did, collection and rkey make a URI the index can hold. */
export function isAddress(did, collection, rkey) {
  return typeof did === 'string' && DID_RE.test(did) && COLLECTIONS.includes(collection) && typeof rkey === 'string' && RKEY_RE.test(rkey)
    && (collection !== MODERATION || did === MODERATOR);
}

/**
 * A rainshare_records row, or null when the record isn't one the index keeps.
 * `firstSeenAt` is when Jetstream relayed its creation (null from a reconcile or an update).
 */
export function toRow({ did, collection, rkey, cid, record, firstSeenAt = null }) {
  if (!isAddress(did, collection, rkey)) return null;
  // A profile and settings live at "self", and only there (lexicons/dev/rainshare/*.json).
  if ((collection === PROFILE || collection === PREFERENCES) && rkey !== 'self') return null;
  if (typeof cid !== 'string' || !CID_RE.test(cid)) return null;
  if (!isObject(record) || record.$type !== collection) return null;
  let json;
  try {
    json = JSON.stringify(record);
  } catch {
    return null;
  }
  if (json.length > MAX_RECORD_CHARS || UNSTORABLE.test(json)) return null;
  const subject = subjectOf(collection, record);
  if (subject === undefined) return null;
  return {
    uri: uriOf(did, collection, rkey),
    did,
    collection,
    rkey,
    cid,
    record,
    subject_uri: subject,
    created_at: isoOrNull(record.createdAt),
    first_seen_at: isoOrNull(firstSeenAt),
  };
}

/**
 * A Jetstream v2 payload (the `payload` of a {"$type":"message"} envelope) as
 * { op: 'upsert', row } | { op: 'delete', uri }, or null when it isn't a commit the index keeps.
 */
export function eventOf(payload) {
  if (!isObject(payload)) return null;
  if (payload.$type !== undefined && payload.$type !== COMMIT_TYPE) return null;
  const { did, collection, rkey, operation } = payload;
  if (!isAddress(did, collection, rkey)) return null;
  const uri = uriOf(did, collection, rkey);
  if (operation === 'delete') return { op: 'delete', uri };
  if (operation !== 'create' && operation !== 'update') return null;
  const row = toRow({ did, collection, rkey, cid: payload.cid, record: payload.record, firstSeenAt: operation === 'create' ? payload.time : null });
  return row ? { op: 'upsert', row } : { op: 'delete', uri };
}
