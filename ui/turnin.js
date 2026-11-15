// "Turn it in", from the board, as a short dialog: the link to what your agent made, and a note
// if you'd like, without going to the ask's own page. Two steps:
//
//   link   the pull request's link (or, for an idea, where it lives), with a paste button at
//          the field's end, and "Add a note" for a
//          line to whoever asked. Where the pull request can be opened from a pushed branch
//          instead (Tangled and knotless), a line says that's on the ask's page, and goes there.
//          Over the field, the pull requests the forge has that mention the ask and weren't
//          turned in, yours first: a press fills the field in, so on a phone there's nothing to
//          copy from one app and paste in another. The one that's plainly yours is filled in already.
//   done   that it's with them now, and what happens next.
//
// The ask's own page keeps its form, with the rest (what did the work, a session link, opening
// the pull request from here).
import { esc, ico, pasteField, pasteInto, PASTE_REFUSED } from './bits.js';

const STATE = { open: 'Open', merged: 'Merged' };
/** The pull requests to offer, best first: yours, then open ones, then merged ones. Closed ones aren't offered. */
export function offerPulls(list){
  const rank = p => (p.yours ? 0 : 2) + (p.state === 'merged' ? 1 : 0);
  return (Array.isArray(list) ? list : []).filter(p => p?.url && p.state !== 'closed').sort((a, b) => rank(a) - rank(b)).slice(0, 4);
}
import { closeSoftly, swapStep } from './motion.js';

/**
 * Open it.
 *   asker        what to call whoever asked ("Kai")
 *   idea         whether it's an idea (where it lives, not a pull request)
 *   placeholder  what the link looks like, on this forge
 *   branch       the forge's name when a pull request can be opened from a pushed branch, or null
 *   forge        the forge's name ("GitHub"), for what's said while it's asked
 *   found        a promise of the pull requests there that mention the ask and weren't turned in
 *                here: [{ url, number, title, by, state, yours }] (null for none, or no forge)
 *   send         turns it in: ({ url, note }); throws to say it didn't
 *   toPage       goes to the ask's page, to open the pull request from a branch
 *   done         once it's closed: (whether it was turned in)
 *   error        what a failed send says, in plain words
 */
export function openTurnIn({ asker, idea, placeholder, branch = null, forge = '', found = null, send, toPage = () => {}, done = () => {}, error = e => e?.message || 'Something went wrong. Try again in a moment.' }){
  if (document.querySelector('.rs-ti')) return;
  const st = { busy: false, note: false, sent: false, pulls: found ? undefined : [], picked: null };
  const dlg = document.createElement('dialog');
  dlg.className = 'rs-wl rs-ti';
  dlg.setAttribute('aria-labelledby', 'rsTiTitle');
  dlg.innerHTML = '<div class="rs rs-wl-box"></div>';
  const box = dlg.firstChild;
  document.body.append(dlg);

  const top = h => `<div class="rs-wl-top"><h2 id="rsTiTitle" tabindex="-1">${h}</h2><button class="rs-wl-x" type="button" data-ti="close" aria-label="Close">${ico('close')}</button></div>`;
  // What the forge has: a line while it's asked, then a button for each one found.
  function offered(){
    if (st.pulls === undefined) return `<p class="rs-ti-look" role="status">Looking on ${esc(forge || 'the forge')} for your pull request…</p>`;
    if (!st.pulls.length) return '';
    const mine = st.pulls.filter(p => p.yours).length;
    return `<div class="rs-ti-found"><p>${mine === 1 && st.pulls.length === 1 ? `Yours, on ${esc(forge || 'the forge')}:` : `On ${esc(forge || 'the forge')}, mentioning this:`}</p>
      <ul>${st.pulls.map((p, i) => `<li><button type="button" class="rs-ti-pr" data-ti-pick="${i}" aria-pressed="${st.picked === p.url}">${ico('pull')}<span><b>${p.number ? `#${esc(p.number)} ` : ''}${esc(p.title || 'A pull request')}</b>
        <small>${esc([p.yours ? 'Yours' : p.by ? `By @${p.by}` : '', STATE[p.state] || ''].filter(Boolean).join(' · '))}</small></span></button></li>`).join('')}</ul></div>`;
  }
  function paint(){
    box.innerHTML = `${top('Turn it in')}
      <form class="rs-form rs-ti-form" novalidate>
        <div class="rs-ti-offer">${offered()}</div>
        <label>${idea ? `A link to where it lives, so ${esc(asker)} can look` : 'The link to the pull request your agent opened'}
          ${pasteField(`<input name="url" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${esc(placeholder)}" value="${esc(st.picked || '')}" required>`)}</label>
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
    // One the forge found: it goes in the field, and the button that turns it in is next.
    const pk = e.target.closest('[data-ti-pick]');
    if (pk) {
      const p = st.pulls?.[+pk.dataset.tiPick]; if (!p) return;
      st.picked = p.url;
      const input = box.querySelector('[name=url]'); if (input) input.value = p.url;
      box.querySelectorAll('[data-ti-pick]').forEach(b => b.setAttribute('aria-pressed', String(b === pk)));
      say(''); box.querySelector('[type=submit]')?.focus();
      return;
    }
    const b = e.target.closest('[data-ti]'); if (!b) return;
    const act = b.dataset.ti;
    if (act === 'close') closeSoftly(dlg);
    else if (act === 'page') { closeSoftly(dlg); toPage(); }
    else if (act === 'note') {
      // (What's typed in the link stays.)
      const url = box.querySelector('[name=url]')?.value || '';
      st.note = true; st.picked = url || null; paint();
      box.querySelector('[name=url]').value = url;
      box.querySelector('[name=note]')?.focus();
    }
  });
  dlg.addEventListener('cancel', e => { if (!e.cancelable) return; e.preventDefault(); if (!st.busy) closeSoftly(dlg); });
  dlg.addEventListener('close', () => { dlg.remove(); done(st.sent); });

  paint();
  dlg.showModal();
  box.querySelector('[name=url]')?.focus();
  // When the forge answers: what it has goes over the field, and the one that's plainly yours (if
  // just one is) is filled in, unless something's been typed or picked by then.
  found?.then(list => list, () => null).then(list => {
    if (!dlg.open || st.sent) return;
    st.pulls = offerPulls(list);
    const input = box.querySelector('[name=url]'), typed = input?.value.trim();
    const yours = st.pulls.filter(p => p.yours);
    if (!typed && yours.length === 1) st.picked = yours[0].url;
    const offer = box.querySelector('.rs-ti-offer');
    if (offer) offer.innerHTML = offered();
    if (input && !typed && st.picked) { input.value = st.picked; if (document.activeElement === input) box.querySelector('[type=submit]')?.focus(); }
  });
}
