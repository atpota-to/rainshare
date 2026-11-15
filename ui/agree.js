// Before someone's first job, or their first ask: a short note on what to keep in mind, and
// agreeing to Rainshare's Terms of Service, with the Privacy Policy linked beside it (../core/legal.js).
//
// It opens the first time someone goes to work on someone else's ask ("Direct my agent", copying
// the brief, copying a command that starts an agent) or posts one of their own ("Ask for
// help"), whichever comes first: agreeing once covers both. It has two boxes: one for the
// Terms of Service, with the Privacy Policy linked beside it, and one saying that whether their
// AI provider allows how they use their plan here is theirs to check, and theirs to answer for
// (PROVIDER). Nothing goes ahead until both are ticked and "Agree and continue" is pressed. Closing it any other way (the ✕, "Not now",
// Escape, a click outside) leaves things as they were, and it's asked again next time.
//
// Agreeing is remembered on this browser, with the version agreed to. Signed in, it's written
// down where it lasts as well (../core/agreement.js): in the person's own settings, so another
// browser or the CLI knows, and in Rainshare's ledger. `logged` here is which accounts that's
// been done for. When the terms change in a way that matters (LEGAL_VERSION), it's asked once
// more. A browser that won't keep anything (a private window, blocked site data) is asked once
// a visit.
import { LEGAL_VERSION, SAFETY, ASKING, PROVIDER } from '../core/legal.js';
import { esc, ico } from './bits.js';

const KEY = 'rs:agreed';
let here = null;   // what was agreed to this visit, for a browser that keeps nothing

/** What was agreed to on this browser, if it's the terms as they are now: { version, at, logged }, or null. */
export function agreement(){
  let kept = null;
  try { kept = JSON.parse(localStorage.getItem(KEY)); } catch (_) { /* nothing kept, or nothing that can be read */ }
  return kept?.version === LEGAL_VERSION ? kept : here?.version === LEGAL_VERSION ? here : null;
}
export const hasAgreed = () => !!agreement();
/**
 * Remember that the terms as they are now were agreed to. `at` is when (now, unless it's being
 * copied from their account, or was a while ago), and `logged` the accounts it's since been
 * written down for.
 */
export function rememberAgreement({ at, logged } = {}){
  const list = [...new Set((Array.isArray(logged) ? logged : []).filter(x => typeof x === 'string'))].slice(0, 20);
  here = { version: LEGAL_VERSION, at: new Date(Date.parse(at) || Date.now()).toISOString(), ...(list.length ? { logged: list } : {}) };
  try { localStorage.setItem(KEY, JSON.stringify(here)); } catch (_) { /* this visit only */ }
  return here;
}
/** Forget it (for the tests, and for anyone who'd like to be asked again). */
export function forgetAgreement(){
  here = null;
  try { localStorage.removeItem(KEY); } catch (_) { /* nothing to forget */ }
}

// What the note says, by what's about to happen: helping, or asking.
const KINDS = {
  help: { title: 'Before you direct your agent', lead: 'You’re about to point your own agent at someone else’s request. Three things to keep in mind:', points: SAFETY, icons: ['info', 'shield', 'person'] },
  ask: { title: 'Before you ask for help', lead: 'Your ask will be public, and other people’s agents will read it. Three things to keep in mind:', points: ASKING, icons: ['shield', 'lock', 'check'] }
};
/** The dialog's insides. `href` gives the address of a page ('terms', 'privacy'); `kind` is 'help' or 'ask'. */
export function agreeHtml(href = sub => '/' + sub, kind = 'help'){
  const k = KINDS[kind] || KINDS.help;
  return `<div class="rs-wl-top"><p class="rs-wl-n">Before your first one</p><button class="rs-wl-x" type="button" data-ag="cancel" aria-label="Close">${ico('close')}</button></div>
    <h2 id="rsAgreeTitle" tabindex="-1">${esc(k.title)}</h2>
    <p class="rs-muted">${esc(k.lead)}</p>
    <ol class="rs-wl-story">${k.points.map(([point, why], i) => `<li><span class="rs-wl-ico">${ico(k.icons[i] || 'info')}</span><p><b>${esc(point)}</b>${esc(why)}</p></li>`).join('')}</ol>
    <label class="rs-agree-check"><input type="checkbox" name="agree"><span>I’m 18 or older, and I agree to Rainshare’s <a href="${esc(href('terms'))}" target="_blank" rel="noopener">Terms of Service</a>. Its <a href="${esc(href('privacy'))}" target="_blank" rel="noopener">Privacy Policy</a> says what happens to data.</span></label>
    <label class="rs-agree-check"><input type="checkbox" name="provider"><span>${esc(PROVIDER)}</span></label>
    <button class="rs-btn rs-primary" type="button" data-ag="go" disabled>Agree and continue</button>
    <div class="rs-wl-foot"><span class="rs-muted">Asked once, and again only if the terms change.</span><button class="rs-link" type="button" data-ag="cancel">Not now</button></div>`;
}

/**
 * Open the note. Resolves true once they've agreed (and it's remembered), false if they closed
 * it. The promise settles inside the click that agreed, so what follows (copying to the
 * clipboard, say) still counts as theirs to the browser.
 */
export function openAgree({ href, kind = 'help' } = {}){
  return new Promise(resolve => {
    if (document.querySelector('.rs-agree')) return resolve(false);
    const dlg = document.createElement('dialog');
    dlg.className = 'rs-wl rs-agree';
    dlg.setAttribute('aria-labelledby', 'rsAgreeTitle');
    dlg.innerHTML = `<div class="rs rs-wl-box">${agreeHtml(href, kind)}</div>`;
    document.body.append(dlg);
    const box = dlg.firstChild, go = box.querySelector('[data-ag="go"]'), ticks = [...box.querySelectorAll('.rs-agree-check input')];
    const ticked = () => ticks.every(t => t.checked);
    let agreed = false;
    for (const t of ticks) t.addEventListener('change', () => { go.disabled = !ticked(); });
    dlg.addEventListener('click', e => {
      // Outside the box is the same as "Not now".
      if (e.target === dlg) return dlg.close();
      const b = e.target.closest('[data-ag]'); if (!b) return;
      if (b.dataset.ag === 'cancel') return dlg.close();
      if (b.dataset.ag === 'go' && ticked()) { agreed = true; rememberAgreement(); dlg.close(); }
    });
    // (A dialog's close event comes a moment later: the answer is given here, inside the click.)
    const close = dlg.close.bind(dlg);
    dlg.close = () => { close(); dlg.remove(); resolve(agreed); };
    dlg.addEventListener('cancel', e => { e.preventDefault(); dlg.close(); });
    dlg.showModal();
    box.querySelector('h2').focus();
  });
}
