// "Turn it in", from the board, as a short dialog: the link to what your agent made, and a note
// if you'd like, without going to the ask's own page. Two steps:
//
//   link   the pull request's link (or, for an idea, where it lives), with a paste button at
//          the field's end, and "Add a note" for a
//          line to whoever asked. Where the pull request can be opened from a pushed branch
//          instead (Tangled and knotless), a line says that's on the ask's page, and goes there.
//   done   that it's with them now, and what happens next.
//
// The ask's own page keeps its form, with the rest (what did the work, a session link, opening
// the pull request from here).
import { esc, ico, pasteField, pasteInto, PASTE_REFUSED } from './bits.js';
import { closeSoftly, swapStep } from './motion.js';

/**
 * Open it.
 *   asker        what to call whoever asked ("Kai")
 *   idea         whether it's an idea (where it lives, not a pull request)
 *   placeholder  what the link looks like, on this forge
 *   branch       the forge's name when a pull request can be opened from a pushed branch, or null
 *   send         turns it in: ({ url, note }); throws to say it didn't
 *   toPage       goes to the ask's page, to open the pull request from a branch
 *   done         once it's closed: (whether it was turned in)
 *   error        what a failed send says, in plain words
 */
export function openTurnIn({ asker, idea, placeholder, branch = null, send, toPage = () => {}, done = () => {}, error = e => e?.message || 'Something went wrong. Try again in a moment.' }){
  if (document.querySelector('.rs-ti')) return;
  const st = { busy: false, note: false, sent: false };
  const dlg = document.createElement('dialog');
  dlg.className = 'rs-wl rs-ti';
  dlg.setAttribute('aria-labelledby', 'rsTiTitle');
  dlg.innerHTML = '<div class="rs rs-wl-box"></div>';
  const box = dlg.firstChild;
  document.body.append(dlg);

  const top = h => `<div class="rs-wl-top"><h2 id="rsTiTitle" tabindex="-1">${h}</h2><button class="rs-wl-x" type="button" data-ti="close" aria-label="Close">${ico('close')}</button></div>`;
  function paint(){
    box.innerHTML = `${top('Turn it in')}
      <form class="rs-form rs-ti-form" novalidate>
        <label>${idea ? `A link to where it lives, so ${esc(asker)} can look` : 'The link to the pull request your agent opened'}
          ${pasteField(`<input name="url" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${esc(placeholder)}" required>`)}</label>
        ${st.note ? `<label>A note for ${esc(asker)} <small>(optional)</small><input name="note" maxlength="300" autocomplete="off"></label>`
          : '<button class="rs-link rs-ti-more" type="button" data-ti="note">Add a note</button>'}
        <p class="rs-err" role="alert" hidden></p>
        <button class="rs-btn rs-primary" type="submit">Turn it in</button>
        ${branch ? `<p class="rs-ti-branch">Pushed a branch to ${esc(branch)} instead? <button class="rs-link" type="button" data-ti="page">Open the pull request from its page</button></p>` : ''}
      </form>`;
  }
  const say = msg => { const p = box.querySelector('.rs-err'); if (p) { p.textContent = msg; p.hidden = !msg; } };

  async function submit(form){
    if (st.busy) return;
    const v = Object.fromEntries(new FormData(form)), btn = form.querySelector('[type=submit]');
    if (!String(v.url || '').trim()) { form.elements.url.focus(); return; }
    st.busy = true; btn.disabled = true; say('');
    try { await send(v); }
    catch (e) { st.busy = false; btn.disabled = false; say(error(e)); return; }
    st.busy = false; st.sent = true;
    swapStep(box, `${top(`${ico('check')}Turned in`)}
      <p class="rs-sd-lede">It’s with ${esc(asker)} now. If it does the job, they’ll accept it, and it grows in your garden.</p>
      <button class="rs-btn rs-primary" type="button" data-ti="close">Done</button>`);
    box.querySelector('[data-ti="close"].rs-btn')?.focus();
  }

  dlg.addEventListener('submit', e => { e.preventDefault(); submit(e.target); });
  dlg.addEventListener('click', e => {
    if (st.busy) return;
    if (e.target === dlg) return closeSoftly(dlg);
    const ps = e.target.closest('[data-rs-paste]');
    if (ps) { pasteInto(ps).then(ok => say(ok ? '' : PASTE_REFUSED)); return; }
    const b = e.target.closest('[data-ti]'); if (!b) return;
    const act = b.dataset.ti;
    if (act === 'close') closeSoftly(dlg);
    else if (act === 'page') { closeSoftly(dlg); toPage(); }
    else if (act === 'note') {
      // (What's typed in the link stays.)
      const url = box.querySelector('[name=url]')?.value || '';
      st.note = true; paint();
      box.querySelector('[name=url]').value = url;
      box.querySelector('[name=note]')?.focus();
    }
  });
  dlg.addEventListener('cancel', e => { if (!e.cancelable) return; e.preventDefault(); if (!st.busy) closeSoftly(dlg); });
  dlg.addEventListener('close', () => { dlg.remove(); done(st.sent); });

  paint();
  dlg.showModal();
  box.querySelector('[name=url]')?.focus();
}
