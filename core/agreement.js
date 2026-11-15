// Agreeing to Rainshare's terms (./legal.js), and where that's written down. The site
// (../ui/agree.js, ../ui/rainshare.js) and the CLI share this.
//
// Someone who agrees while signed in has it recorded twice:
//
//   in their account   `terms` in their settings record (dev.rainshare.preferences): the
//                      version and when. It's theirs, it's public like the rest, it follows
//                      them to another browser or the CLI, and only they could have written it.
//   by Rainshare       a row in a ledger Rainshare keeps (LEDGER, a small function beside a
//                      table at Supabase: ../supabase/functions/rainshare-agree). The function
//                      takes nobody's word for it: told that an account agreed, it reads that
//                      account's settings from the account's own host, and only notes what it
//                      finds there, with the copy their host signed. So nobody can put an
//                      account in the ledger but the account itself, and the note outlasts
//                      the record if it's ever deleted.
//
// The ledger is told after the record is written, and telling it again is harmless. If it can't
// be reached, the agreement still stands (the record is in the account), and it's told the next
// time: nothing about using Rainshare waits on it.
import { LEGAL_VERSION } from './legal.js';

export const LEDGER = 'https://zdzjtziydmwkxbzlkwxv.supabase.co/functions/v1/rainshare-agree';

/** The agreement as it's written into someone's settings: the terms as they are now, agreed to at `at`. */
export const agreementNow = (at = Date.now()) => ({ version: LEGAL_VERSION, agreedAt: new Date(at).toISOString() });

/** What someone's settings say they agreed to, if it's the terms as they are now: { version, agreedAt }, or null. */
export const agreedIn = prefs => prefs?.terms?.version === LEGAL_VERSION && typeof prefs.terms.agreedAt === 'string' ? prefs.terms : null;

/**
 * Tell the ledger that `did` has agreed (its settings record says so by now). `via` is where:
 * 'web' or 'cli'. True once it's noted, false if it wasn't this time. It never throws: the
 * agreement doesn't depend on it.
 */
export async function tellLedger({ did, via = 'web', version = LEGAL_VERSION } = {}, { url = LEDGER, timeout = 12000 } = {}){
  if (!did || !url) return false;
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ did, version, via }), signal: AbortSignal.timeout(timeout) });
    return r.ok && (await r.json().catch(() => null))?.logged === true;
  } catch (_) { return false; }
}

/**
 * Record an agreement for whoever `source` is signed in as: in their settings, then in the
 * ledger. `at` is when they agreed (now, unless it was a while ago and is only now being
 * written down). Says what got done: { saved, logged }. Throws only if `must` and the record
 * couldn't be written.
 */
export async function recordAgreement(source, { at = Date.now(), via = 'web', ledger = true, must = false } = {}){
  const did = source?.viewer;
  if (!did || !source.savePreferences) return { saved: false, logged: false };
  let saved = !!agreedIn(await source.preferences?.().catch(() => null));
  if (!saved) {
    try { await source.savePreferences({ terms: agreementNow(at) }); saved = true; }
    catch (e) { if (must) throw e; }
  }
  return { saved, logged: saved && ledger ? await tellLedger({ did, via }) : false };
}
