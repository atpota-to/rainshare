// Tangled's vouch network, read and added to from Rainshare. On Tangled anyone can vouch for
// someone, or denounce them, with a reason: a public record in their own account
// (org.tangled.graph.vouch), keyed by the DID of the person it's about. Tangled shows a mark
// beside someone only when the word comes from your own circle: you, or someone you vouched
// for. Rainshare shows the same beside the people who ask and the people who help, since
// "do people I trust know this person?" is worth knowing before you send an agent to their
// repo, or merge what theirs sent.
//
//   reading   needs no sign-in. The records are public, so a circle is worked out from them:
//             yours, and those of everyone you vouched for. (Tangled's own method for this,
//             org.tangled.graph.listNetworkVouches, answers only to a signed-in Tangled.)
//   writing   a vouch is a record in your own account, so it's an ordinary write, allowed by
//             the Tangled part of a sign-in (FORGE_SCOPES in ./ns.js). Rainshare only
//             vouches and takes a vouch back. Denouncing someone is done on Tangled.
//
// A vouch gates nothing, here or there. It's something to weigh.
import { listRecords, isDid, pool, parseUri, xrpc } from './net.js';
import { BOBBIN, TICKET, tangledTicket } from './subjects.js';

export const VOUCH = 'org.tangled.graph.vouch';
const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;
const clip = (s, max) => { const t = String(s || '').replace(/\s+/g, ' ').trim(), g = seg ? [...seg.segment(t)].map(x => x.segment) : [...t]; return g.length > max ? g.slice(0, max - 1).join('') + '…' : t; };

export class VouchError extends Error {
  constructor(name, message){ super(message); this.name = name; this.forge = 'tangled'; }
}

/** What one person has said about others: Map<did, { kind: 'vouch'|'denounce', reason, at, uri, cid }>. */
export async function vouchesBy(did, { max = 300 } = {}){
  const out = new Map();
  for (const r of await listRecords(did, VOUCH, { limit: 100, pages: Math.max(1, Math.ceil(max / 100)) })) {
    // The key says who it's about. Nobody vouches for themselves.
    if (!isDid(r.rkey) || r.rkey === did) continue;
    out.set(r.rkey, { kind: r.value.kind === 'denounce' ? 'denounce' : 'vouch', reason: typeof r.value.reason === 'string' ? clip(r.value.reason, 256) : '', at: typeof r.value.createdAt === 'string' ? r.value.createdAt : null, uri: r.uri, cid: r.cid });
  }
  return out;
}
/**
 * Someone's circle: what they've said, and what each person they vouched for has said.
 * Only a vouch brings someone into it; a denouncement doesn't. `reach` is how many of the
 * people they vouched for are asked, so a long list can't turn one page into hundreds of
 * requests.
 */
export async function circleOf(viewer, { reach = 40 } = {}){
  if (!isDid(viewer)) return { mine: new Map(), circle: [], partial: false };
  const mine = await vouchesBy(viewer);
  const trusted = [...mine].filter(([, v]) => v.kind === 'vouch').map(([did]) => did);
  const asked = trusted.slice(0, reach);
  const said = await pool(asked, 6, did => vouchesBy(did, { max: 200 }).catch(() => null));
  return { mine, circle: asked.flatMap((did, i) => said[i] ? [{ did, said: said[i] }] : []), partial: trusted.length > asked.length || said.some(x => !x) };
}
/**
 * The circle's word on one person, or null when it has none:
 * { kind: 'vouch'|'denounce'|'mixed', mine: { kind, reason, at } | null, by: [{ did, kind, reason, at }] }.
 * Your own word decides `kind` when you've given one.
 */
export function wordOn(circle, did){
  if (!circle || typeof did !== 'string' || !did.startsWith('did:')) return null;
  const mine = circle.mine.get(did) || null;
  const by = circle.circle.flatMap(c => { const v = c.did !== did && c.said.get(did); return v ? [{ did: c.did, kind: v.kind, reason: v.reason, at: v.at }] : []; });
  if (!mine && !by.length) return null;
  const kinds = new Set(by.map(b => b.kind));
  return { kind: mine ? mine.kind : kinds.size > 1 ? 'mixed' : by[0].kind, mine, by };
}
/** That word as a sentence, given a way to name people. `whose` is how the reader is addressed. */
export function wordText(word, name = did => did){
  if (!word) return '';
  const list = xs => xs.length > 3 ? `${xs.slice(0, 2).join(', ')} and ${xs.length - 2} others` : xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] || '';
  const who = kind => word.by.filter(b => b.kind === kind).map(b => name(b.did));
  const parts = [];
  if (word.mine) parts.push(word.mine.kind === 'vouch' ? 'You vouch for them on Tangled' : 'You’ve denounced them on Tangled');
  const v = who('vouch'), d = who('denounce');
  if (v.length) parts.push(`${list(v)}, who you vouch for, ${v.length > 1 ? 'vouch' : 'vouches'} for them on Tangled`);
  if (d.length) parts.push(`${list(d)}, who you vouch for, ${d.length > 1 ? 'have' : 'has'} denounced them on Tangled`);
  return parts.join('. ') + '.';
}

/* ---------- vouching ---------- */
const own = async (agent, method, body) => {
  if (!agent?.did) throw new VouchError('NotSignedIn', 'Sign in first.');
  const r = await agent.fetchHandler('/xrpc/com.atproto.repo.' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (r.ok) return r.json().catch(() => ({}));
  const said = await r.json().catch(() => ({})), text = `${said.error || ''} ${said.message || ''}`;
  if (r.status === 401 || r.status === 403 || /scope|permission|not allowed|forbidden/i.test(text)) throw new VouchError('NotConnected', 'Rainshare isn’t allowed to vouch on Tangled for you yet.');
  throw new VouchError(said.error || 'HTTP' + r.status, said.message || `Your server refused it (${r.status}).`);
};
const ref = x => x && parseUri(x.uri) && typeof x.cid === 'string' && x.cid ? { uri: x.uri, cid: x.cid } : null;
/**
 * What a vouch can point at to show why: the pull request that was turned in, if it's on
 * Tangled (which is what Tangled attaches when you vouch from a pull request), and the
 * Rainshare delivery itself. A delivery is written by the person being vouched for, so the
 * pull request only counts if Tangled says it's theirs: nobody gets vouched for on the
 * strength of someone else's work.
 */
export async function evidenceFor(delivery){
  const out = [], v = delivery?.value || {};
  const ticket = await tangledTicket(v.pull || v.url).catch(() => null);
  if (ticket && parseUri(ticket)?.collection === TICKET) {
    const now = await xrpc(BOBBIN, 'org.tangled.track.getTicketView', { uri: ticket }).catch(() => null);
    if (now?.author?.did === delivery.repo && now.targetBranch && ref({ uri: ticket, cid: now.cid })) out.push({ uri: ticket, cid: now.cid });
  }
  if (ref(delivery)) out.push({ uri: delivery.uri, cid: delivery.cid });
  return out;
}
/** Vouch for someone, as the signed-in person: a record in their own account, keyed by who it's about. */
export async function vouchFor(agent, did, { reason, evidence = [] } = {}){
  if (!isDid(did)) throw new VouchError('NoOne', 'There’s nobody there to vouch for.');
  if (did === agent?.did) throw new VouchError('Yourself', 'You can’t vouch for yourself.');
  const why = clip(reason, 256), refs = evidence.map(ref).filter(Boolean).slice(0, 10);
  const record = { $type: VOUCH, kind: 'vouch', ...(why ? { reason: why } : {}), ...(refs.length ? { evidences: refs } : {}), createdAt: new Date().toISOString() };
  const r = await own(agent, 'putRecord', { repo: agent.did, collection: VOUCH, rkey: did, record, validate: false });
  return { uri: r.uri || `at://${agent.did}/${VOUCH}/${did}`, cid: r.cid || null, kind: 'vouch', reason: why, at: record.createdAt };
}
/** Take a vouch back: the record is deleted. */
export async function unvouch(agent, did){
  if (!isDid(did)) throw new VouchError('NoOne', 'There’s nobody there.');
  await own(agent, 'deleteRecord', { repo: agent?.did, collection: VOUCH, rkey: did });
}
