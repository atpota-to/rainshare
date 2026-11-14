// Rainshare's own moderation. @rainshare.dev (MODERATOR in ./ns.js) keeps a
// dev.rainshare.moderation record for each thing it has decided not to show: one record (an
// ask, a take, a delivery, a comment, Rainshare's own or one on a forge's issue), or a whole
// account. Every app reads them from that one repo and leaves out what they name: the board,
// an ask's page and its comments (./source.js), the brief (./brief.js), the CLI and MCP
// server, and link previews (../api/_og/describe.js).
//
// Nothing about this needs a server of Rainshare's own, or a password check. Anyone can write
// a record of this type into their own repo, but only the one in MODERATOR's repo is read,
// so the moderation page (../ui/rainshare.js) only has to be shown to that account: anyone
// else who found their way to it would only be writing to their own repo, which nobody reads.
//
// A record's key is made from its subject (keyOf), so there's one per thing: hiding it again
// replaces it, and deleting it takes the decision back. A link preview looks one up by that
// key alone, as it can't list a repo.
import { MODERATION, MODERATOR, SEED, PROFILE } from './ns.js';
import { isDid, isHandle, isRkey, parseUri, normalizeHandle } from './net.js';
import { clip } from './records.js';

export const ACTIONS = ['hide'];
// [value, what it's called, what it means]
export const REASONS = [
  ['unsafe', 'Unsafe for agents', 'It tries to misuse a helper’s agent: instructions hidden from people, reaching for secrets, or running code from somewhere else.'],
  ['harmful', 'Asks for harm', 'It asks for something AI plans’ usage policies rule out, like malware, phishing or attacks on others.'],
  ['spam', 'Spam or a scam', 'Advertising, scams, or the same thing posted over and over.'],
  ['abuse', 'Abuse', 'Harassment, hate or threats.'],
  ['other', 'Something else', 'Said in the note.']
];
const reasonOf = r => REASONS.some(x => x[0] === r) ? r : 'other';
export const reasonName = r => (REASONS.find(x => x[0] === r) || REASONS.at(-1))[1];

const NSID = /^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z0-9-]+){2,}$/;
/**
 * What a decision is about, in the one form it's kept: at://<did> for an account, or
 * at://<did>/<collection>/<rkey> for a record. Null for anything else.
 */
export function subjectOf(s){
  const m = String(s ?? '').match(/^at:\/\/([^/]+)(?:\/([^/]+)\/([^/]+))?$/);
  if (!m || !isDid(m[1])) return null;
  if (!m[2]) return `at://${m[1]}`;
  return NSID.test(m[2]) && isRkey(m[3]) ? `at://${m[1]}/${m[2]}/${m[3]}` : null;
}
export const isAccount = subject => /^at:\/\/[^/]+$/.test(String(subject || ''));
/** The record key for a decision about `subject`: its at:// address with the at:// taken off and each / made a :. */
export function keyOf(subject){
  const s = subjectOf(subject);
  if (!s) return null;
  const k = s.slice(5).replace(/\//g, ':').replace(/%/g, '~');
  return isRkey(k) ? k : null;
}

/**
 * The decisions in MODERATOR's records (from listRecords), as a Map by subject:
 * { subject, action, reason, note, createdAt, uri, rkeys }. A record with an action this
 * doesn't know, or a subject it can't read, is left out. (`rkeys`: every record about it, so
 * taking the decision back deletes them all.)
 */
export function decisionsFrom(records){
  const out = new Map();
  for (const r of records || []) {
    const v = r?.value, subject = subjectOf(v?.subject);
    if (!subject || !ACTIONS.includes(v.action) || !isRkey(r.rkey)) continue;
    const was = out.get(subject);
    out.set(subject, {
      subject, action: v.action, reason: reasonOf(v.reason), note: typeof v.note === 'string' ? v.note.slice(0, 600) : '',
      createdAt: typeof v.createdAt === 'string' ? v.createdAt : '', uri: r.uri, rkeys: [...(was?.rkeys || []), r.rkey]
    });
  }
  return out;
}

/**
 * Why something is hidden: the decision about the record at `uri`, or about the account that
 * wrote it (`repo`, or the account in `uri`). Null when it isn't.
 */
export function hiddenBy(decisions, uri, repo){
  if (!decisions?.size) return null;
  const did = repo || parseUri(uri)?.repo;
  return (uri && decisions.get(uri)) || (did && decisions.get('at://' + did)) || null;
}

/** A moderation record, ready to write. */
export function moderationRecord({ subject, action = 'hide', reason, note } = {}){
  const s = subjectOf(subject);
  if (!s) throw new Error('That isn’t something Rainshare can hide.');
  if (!ACTIONS.includes(action)) throw new Error('Rainshare doesn’t know how to do that.');
  const said = clip(note || '', 300);
  return { $type: MODERATION, subject: s, action, reason: reasonOf(reason), ...(said ? { note: said } : {}), createdAt: new Date().toISOString() };
}

/**
 * What a link or address someone pasted refers to, as a subject: an ask's page (…/seed/<who>/<key>),
 * someone's page (…/profile/<who>, or theirs on Bluesky), an at:// address (a record, or an
 * account), a handle or a DID. Throws, saying why, for anything else. `resolve` turns a handle
 * into a DID.
 */
export async function subjectFrom(input, { resolve } = {}){
  const raw = String(input ?? '').trim().replace(/[\s.,;:!?)\]>'"]+$/, '');
  if (!raw) throw new Error('Paste a link, an at:// address or a handle.');
  const did = async who => {
    let w = who; try { w = decodeURIComponent(who); } catch (_) { /* as typed */ }
    w = normalizeHandle(w);
    if (isDid(w)) return w;
    if (!isHandle(w)) throw new Error(`“${who}” isn’t a handle or a DID.`);
    const d = await (resolve ? resolve(w) : Promise.reject(new Error('no resolver'))).catch(() => null);
    if (!isDid(d)) throw new Error(`Nobody answers to @${w}.`);
    return d;
  };
  if (raw.startsWith('at://')) {
    const p = raw.match(/^at:\/\/([^/]+)(\/.*)?$/), who = await did(p[1]);
    const s = subjectOf(`at://${who}${p[2] || ''}`);
    if (!s) throw new Error('That at:// address isn’t one Rainshare can read.');
    return s;
  }
  let path = raw;
  // (A link pasted without its https:// is still a link: rainshare.dev/seed/…)
  const link = /^https?:\/\//i.test(raw) ? raw : /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(raw) ? 'https://' + raw : null;
  try { if (link) path = new URL(link).pathname; } catch (_) { /* as typed */ }
  path = path.replace(/^\/+|\/+$/g, '');
  if (/^seed\/s\//.test(path)) throw new Error('That one’s private, in a group: only its group sees it, and moderation is for what’s public.');
  let m = path.match(/^seed\/([^/]+)\/([^/]+)$/);
  if (m) { if (!isRkey(m[2])) throw new Error('That ask’s link has been cut short.'); return `at://${await did(m[1])}/${SEED}/${m[2]}`; }
  m = path.match(/^(?:profile|u)\/([^/]+)$/);
  if (m) return `at://${await did(m[1])}`;
  if (!path.includes('/')) return `at://${await did(path)}`;
  throw new Error('That isn’t a link to an ask or a person. Paste one from Rainshare, or an at:// address.');
}

/** What kind of thing a subject is, in a word or two: 'account', 'ask', 'comment', 'take', 'delivery', 'profile' or 'record'. */
export function kindOf(subject){
  if (isAccount(subject)) return 'account';
  const c = parseUri(subject)?.collection || '';
  return c === SEED ? 'ask' : c === PROFILE ? 'profile' : /\.comment$/.test(c) ? 'comment' : /\.take$/.test(c) ? 'take' : /\.delivery$/.test(c) ? 'delivery' : 'record';
}

export { MODERATION, MODERATOR };
