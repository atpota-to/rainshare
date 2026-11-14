// "Send my agent": two short questions before anything is written, so pressing it never says
// you're on something you only meant to look at.
//
//   how     how the ask goes to your agent: the brief to paste, or a command that starts one
//   claim   whether to tell whoever asked that you're on it, and for how long; and whether to
//           remember these answers (your settings, dev.rainshare.preferences) and skip the
//           questions next time
//
// Nothing is written until the last button is pressed. Closing it, at either step, leaves
// everything as it was. Someone who said to skip the questions can change their answers on
// their profile, or with "Change" beside the button.
import { TAKE_DAYS } from '../core/ns.js';
import { esc, ico } from './bits.js';

/** The choices of how long, with `days` among them even if it isn't one of the usual ones. */
export const dayChoices = days => TAKE_DAYS.some(([d]) => d === days) || !(days >= 1) ? TAKE_DAYS
  : [...TAKE_DAYS, [days, `${days} days`]].sort((a, b) => a[0] - b[0]);
/** "Claude Code, and says you’re on it for 3 days": what the button does when the questions are skipped. */
export function sendSummary({ route, claim, days }, names){
  const how = names[route] || names.brief;
  if (!claim) return `${how}, without saying you’re on it`;
  const span = (TAKE_DAYS.find(([d]) => d === days)?.[1] || `${days} days`).toLowerCase();
  return `${how}, and says you’re on it for ${span}`;
}

/**
 * Open it.
 *   title    the ask's title
 *   asker    what to call whoever asked ("Kai")
 *   ways     [{ id, name, note }]: how it can be sent
 *   answers  what's picked to begin with: { route, claim, days, remember, askEachTime }
 *   send     does it, with the answers; throws to say it didn't. It's only closed once that's done.
 *   error    what a failed send says, in plain words
 */
export function openSend({ title, asker, ways, answers, send, error = e => e?.message || 'Something went wrong. Try again in a moment.' }){
  if (document.querySelector('.rs-sd')) return;
  const st = { step: 'how', busy: false, ...answers };
  if (!ways.some(w => w.id === st.route)) st.route = ways[0]?.id;
  const dlg = document.createElement('dialog');
  dlg.className = 'rs-wl rs-sd';
  dlg.setAttribute('aria-labelledby', 'rsSdTitle');
  dlg.innerHTML = '<div class="rs rs-wl-box"></div>';
  const box = dlg.firstChild;
  document.body.append(dlg);

  const top = (n, h) => `<div class="rs-wl-top"><p class="rs-wl-n">${n} of 2</p><button class="rs-wl-x" type="button" data-sd="cancel" aria-label="Close">${ico('close')}</button></div>
    <h2 id="rsSdTitle" tabindex="-1">${h}</h2>`;
  const choice = (name, value, on, label, note) => `<label class="rs-sd-way"><input type="radio" name="${name}" value="${esc(value)}"${on ? ' checked' : ''}><span><b>${esc(label)}</b><small>${esc(note)}</small></span></label>`;

  function paint(){
    if (st.step === 'how') {
      box.innerHTML = `${top(1, 'How do you want to send it?')}
        <p class="rs-sd-what">${esc(title)}</p>
        <div class="rs-sd-ways" role="radiogroup" aria-label="How to send it">${ways.map(w => choice('sdRoute', w.id, w.id === st.route, w.name, w.note)).join('')}</div>
        <button class="rs-btn rs-primary" type="button" data-sd="next">Next</button>
        <div class="rs-wl-foot"><span class="rs-muted">Nothing’s been written yet.</span><button class="rs-link" type="button" data-sd="cancel">Cancel</button></div>`;
      (box.querySelector('[name=sdRoute]:checked') || box.querySelector('[name=sdRoute]'))?.focus();
      return;
    }
    const days = dayChoices(st.days);
    box.innerHTML = `${top(2, `Tell ${esc(asker)} you’re on it?`)}
      <div class="rs-sd-ways" role="radiogroup" aria-label="Whether to say you’re on it">
        ${choice('sdClaim', 'yes', st.claim, 'Yes, I’m on it', 'Everyone sees you’re on it, so nobody does it twice.')}
        <div class="rs-sd-days"${st.claim ? '' : ' hidden'}>
          <p id="rsSdDays">I’ll turn it in within</p>
          <div class="rs-toggles" role="group" aria-labelledby="rsSdDays">${days.map(([d, l]) => `<button type="button" data-sd-days="${d}" aria-pressed="${d === st.days}">${esc(l)}</button>`).join('')}</div>
          <small>If nothing’s turned in by then, it shows as free again for someone else. You can give yourself more time from its page.</small>
        </div>
        ${choice('sdClaim', 'no', !st.claim, 'Not yet, just copy it', 'Nothing’s written. If you start on it, say so from its page.')}
      </div>
      <div class="rs-sd-keep">
        <label class="rs-check"><input type="checkbox" name="sdRemember"${st.remember ? ' checked' : ''}> Remember these answers</label>
        <label class="rs-check"><input type="checkbox" name="sdSkip"${!st.askEachTime ? ' checked' : ''}${st.remember ? '' : ' disabled'}> Next time, skip these questions</label>
        <small class="rs-muted">You can change them on your profile.</small>
      </div>
      <p class="rs-err" role="alert" hidden></p>
      <button class="rs-btn rs-primary" type="button" data-sd="send">${st.claim ? 'Send my agent' : 'Copy it'}</button>
      <div class="rs-wl-foot"><button class="rs-link" type="button" data-sd="back">${ico('back')}Back</button><button class="rs-link" type="button" data-sd="cancel">Cancel</button></div>`;
    (box.querySelector('[name=sdClaim]:checked') || box.querySelector('[name=sdClaim]'))?.focus();
  }
  const say = msg => { const p = box.querySelector('.rs-err'); if (p) { p.textContent = msg; p.hidden = !msg; } };

  async function submit(btn){
    if (st.busy) return;
    st.busy = true; btn.disabled = true; btn.textContent = st.claim ? 'Sending…' : 'Copying…'; say('');
    try { await send({ route: st.route, claim: st.claim, days: st.days, remember: st.remember, askEachTime: !st.remember || st.askEachTime }); }
    catch (e) { st.busy = false; btn.disabled = false; btn.textContent = st.claim ? 'Send my agent' : 'Copy it'; say(error(e)); return; }
    st.busy = false;
    dlg.close();
  }

  dlg.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'sdRoute') st.route = t.value;
    if (t.name === 'sdClaim') {
      st.claim = t.value === 'yes';
      box.querySelector('.rs-sd-days').hidden = !st.claim;
      box.querySelector('[data-sd="send"]').textContent = st.claim ? 'Send my agent' : 'Copy it';
    }
    if (t.name === 'sdRemember') { st.remember = t.checked; const skip = box.querySelector('[name=sdSkip]'); skip.disabled = !t.checked; if (!t.checked) { skip.checked = false; st.askEachTime = true; } }
    if (t.name === 'sdSkip') st.askEachTime = !t.checked;
  });
  dlg.addEventListener('click', e => {
    if (st.busy) return;
    // Outside the box is the same as Cancel.
    if (e.target === dlg) return dlg.close();
    const d = e.target.closest('[data-sd-days]');
    if (d) { st.days = +d.dataset.sdDays; box.querySelectorAll('[data-sd-days]').forEach(b => b.setAttribute('aria-pressed', String(b === d))); return; }
    const b = e.target.closest('[data-sd]'); if (!b) return;
    const act = b.dataset.sd;
    if (act === 'cancel') dlg.close();
    else if (act === 'next') { st.step = 'claim'; paint(); }
    else if (act === 'back') { st.step = 'how'; paint(); }
    else if (act === 'send') submit(b);
  });
  dlg.addEventListener('cancel', e => { if (st.busy) e.preventDefault(); });
  dlg.addEventListener('close', () => dlg.remove());

  paint();
  dlg.showModal();
  (box.querySelector('[name=sdRoute]:checked') || box.querySelector('[name=sdRoute]'))?.focus();
}
