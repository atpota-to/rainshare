// Rainshare's own "are you sure?": a small dialog in place of the browser's confirm(), dressed
// like the rest of the screens. It says what's about to happen, and its two buttons say what
// each one does ("Delete", "Keep it") rather than OK and Cancel.
//
// Escape, a click outside the box, and the quiet button all answer no. The promise
// settles inside the press that answered, as ./agree.js's does, so what follows (copying to the
// clipboard, say) still counts as the person's own doing to the browser. It can open over
// another dialog (the one for directing your agent), and puts focus back where it was after.
//
//   tone   'plain' (the accent), 'heed' (something's in the way, in the board's amber) or
//          'danger' (deleting, hiding or banning, in red, with the red button)
import { esc, ico } from './bits.js';
import { closeSoftly } from './motion.js';

const ICONS = { plain: 'info', heed: 'info', danger: 'bin' };
const toneOf = t => ICONS[t] ? t : 'plain';

/**
 * The dialog's insides. `title` is the question, `text` what happens either way, `points` a
 * list said under it, and `yes` and `no` the buttons. `icon` is one of ./bits.js's, if the
 * tone's own doesn't suit.
 */
export function confirmHtml({ title = '', text = '', points = [], yes = 'OK', no = 'Cancel', tone = 'plain', icon } = {}){
  const t = toneOf(tone);
  return `<div class="rs-cf-head"><span class="rs-cf-ico">${ico(icon || ICONS[t])}</span><h2 id="rsCfTitle" tabindex="-1">${esc(title)}</h2></div>
    ${text ? `<p class="rs-cf-text" id="rsCfText">${esc(text)}</p>` : ''}
    ${points.length ? `<ul class="rs-cf-points">${points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
    <div class="rs-cf-row"><button class="rs-btn rs-quiet" type="button" data-cf="no">${esc(no)}</button><button class="rs-btn rs-primary${t === 'danger' ? ' rs-cf-bad' : ''}" type="button" data-cf="yes">${esc(yes)}</button></div>`;
}

/**
 * Ask. Resolves true for the button that goes ahead, false for anything else. Only one is open
 * at a time: asking while one is up answers no straight away.
 */
export function confirmBox(opts = {}){
  return new Promise(resolve => {
    if (typeof document === 'undefined' || document.querySelector('.rs-cf')) return resolve(false);
    const tone = toneOf(opts.tone), was = document.activeElement;
    const dlg = document.createElement('dialog');
    dlg.className = `rs-wl rs-cf rs-cf-${tone}`;
    dlg.setAttribute('role', 'alertdialog');
    dlg.setAttribute('aria-labelledby', 'rsCfTitle');
    if (opts.text) dlg.setAttribute('aria-describedby', 'rsCfText');
    dlg.innerHTML = `<div class="rs rs-wl-box">${confirmHtml(opts)}</div>`;
    document.body.append(dlg);
    let answered = false;
    // (Answered here, inside the press: the dialog's close event comes a moment later.)
    const answer = yes => { if (answered) return; answered = true; resolve(yes); closeSoftly(dlg); };
    dlg.addEventListener('click', e => {
      if (e.target === dlg) return answer(false);
      const b = e.target.closest('[data-cf]');
      if (b) answer(b.dataset.cf === 'yes');
    });
    dlg.addEventListener('cancel', e => { e.preventDefault(); answer(false); });
    dlg.addEventListener('close', () => {
      answer(false); dlg.remove();
      if (was?.isConnected && typeof was.focus === 'function') was.focus({ preventScroll: true });
    });
    dlg.showModal();
    // What's being asked is read out with the dialog. Where going ahead can't be undone, or
    // something's in the way, focus starts on the button that doesn't go ahead.
    dlg.querySelector(tone === 'plain' ? '[data-cf="yes"]' : '[data-cf="no"]').focus();
  });
}
