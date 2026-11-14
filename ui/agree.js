// Before someone's first job: a short note on staying safe, and agreeing to Rainshare's Terms
// of Service and Privacy Policy (../core/legal.js).
//
// It opens the first time someone goes to work on someone else's ask, whichever way they do it:
// "Send my agent", copying the brief, or copying a command that starts an agent. Nothing goes
// ahead until the box is ticked and "Agree and continue" is pressed. Closing it any other way
// (the ✕, "Not now", Escape, a click outside) leaves things as they were, and it's asked again
// next time.
//
// Agreeing is remembered on this browser, with the version agreed to. When the terms change in
// a way that matters (LEGAL_VERSION), it's asked once more. A browser that won't keep anything
// (a private window, blocked site data) is asked once a visit.
import { LEGAL_VERSION, SAFETY } from '../core/legal.js';
import { esc, ico } from './bits.js';

const KEY = 'rs:agreed';
let here = null;   // what was agreed to this visit, for a browser that keeps nothing

/** What was agreed to on this browser, if it's the terms as they are now: { version, at }, or null. */
export function agreement(){
  let kept = null;
  try { kept = JSON.parse(localStorage.getItem(KEY)); } catch (_) { /* nothing kept, or nothing that can be read */ }
  return kept?.version === LEGAL_VERSION ? kept : here?.version === LEGAL_VERSION ? here : null;
}
export const hasAgreed = () => !!agreement();
/** Remember that the terms as they are now were agreed to, just now. */
export function recordAgreement(){
  here = { version: LEGAL_VERSION, at: new Date().toISOString() };
  try { localStorage.setItem(KEY, JSON.stringify(here)); } catch (_) { /* this visit only */ }
  return here;
}
/** Forget it (for the tests, and for anyone who'd like to be asked again). */
export function forgetAgreement(){
  here = null;
  try { localStorage.removeItem(KEY); } catch (_) { /* nothing to forget */ }
}

const ICONS = ['info', 'shield', 'person'];
/** The dialog's insides. `href` gives the address of a page ('terms', 'privacy'). */
export const agreeHtml = (href = sub => '/' + sub) => `<div class="rs-wl-top"><p class="rs-wl-n">Before your first one</p><button class="rs-wl-x" type="button" data-ag="cancel" aria-label="Close">${ico('close')}</button></div>
    <h2 id="rsAgreeTitle" tabindex="-1">Before you send your agent</h2>
    <p class="rs-muted">You’re about to point your own agent at someone else’s request. Three things to keep in mind:</p>
    <ol class="rs-wl-story">${SAFETY.map(([point, why], i) => `<li><span class="rs-wl-ico">${ico(ICONS[i] || 'info')}</span><p><b>${esc(point)}</b>${esc(why)}</p></li>`).join('')}</ol>
    <label class="rs-agree-check"><input type="checkbox" name="agree"><span>I agree to Rainshare’s <a href="${esc(href('terms'))}" target="_blank" rel="noopener">Terms of Service</a> and <a href="${esc(href('privacy'))}" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>
    <button class="rs-btn rs-primary" type="button" data-ag="go" disabled>Agree and continue</button>
    <div class="rs-wl-foot"><span class="rs-muted">You’ll only be asked once on this browser.</span><button class="rs-link" type="button" data-ag="cancel">Not now</button></div>`;

/**
 * Open the note. Resolves true once they've agreed (and it's remembered), false if they closed
 * it. The promise settles inside the click that agreed, so what follows (copying to the
 * clipboard, say) still counts as theirs to the browser.
 */
export function openAgree({ href } = {}){
  return new Promise(resolve => {
    if (document.querySelector('.rs-agree')) return resolve(false);
    const dlg = document.createElement('dialog');
    dlg.className = 'rs-wl rs-agree';
    dlg.setAttribute('aria-labelledby', 'rsAgreeTitle');
    dlg.innerHTML = `<div class="rs rs-wl-box">${agreeHtml(href)}</div>`;
    document.body.append(dlg);
    const box = dlg.firstChild, tick = box.querySelector('input[name="agree"]'), go = box.querySelector('[data-ag="go"]');
    let agreed = false;
    tick.addEventListener('change', () => { go.disabled = !tick.checked; });
    dlg.addEventListener('click', e => {
      // Outside the box is the same as "Not now".
      if (e.target === dlg) return dlg.close();
      const b = e.target.closest('[data-ag]'); if (!b) return;
      if (b.dataset.ag === 'cancel') return dlg.close();
      if (b.dataset.ag === 'go' && tick.checked) { agreed = true; recordAgreement(); dlg.close(); }
    });
    // (A dialog's close event comes a moment later: the answer is given here, inside the click.)
    const close = dlg.close.bind(dlg);
    dlg.close = () => { close(); dlg.remove(); resolve(agreed); };
    dlg.addEventListener('cancel', e => { e.preventDefault(); dlg.close(); });
    dlg.showModal();
    box.querySelector('h2').focus();
  });
}
