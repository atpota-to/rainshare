// "Send my agent": one short screen before anything is written, so pressing it never says
// you're on something you only meant to look at.
//
//   how     how the ask goes to your agent: the one your profile says you run (or the prompt to
//           paste, if it doesn't say), with the prompt beside it and every other way folded away
//   then    one of two buttons: say you're on it and copy it, or just copy it for now. Saying
//           you're on it is for a day, with the other lengths a press away.
//
// It says up front what the prompt is: the asker's own words, which Rainshare puts inside a
// few safety rules for the agent (../core/brief.js). It doesn't promise more than those rules
// do: whoever sends their agent should still read what was asked. Ticking "Next time, skip this" keeps these
// answers in your settings (dev.rainshare.preferences) and the button does the same thing
// from then on; nothing is kept otherwise. Nothing is written until a button is pressed, and
// closing it leaves everything as it was. Someone who said to skip it can change their answers
// on their profile, or with "Change" beside the button.
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
/** The ways shown at first (the one picked to begin with, and the prompt), and the rest, folded away. */
export function splitWays(ways, route){
  const first = [...new Set([route, 'brief'])].map(id => ways.find(w => w.id === id)).filter(Boolean);
  return { first, rest: ways.filter(w => !first.includes(w)) };
}

/**
 * Open it.
 *   title    the ask's title
 *   asker    what to call whoever asked ("Kai")
 *   ways     [{ id, name, note }]: how it can be sent
 *   answers  what's picked to begin with: { route, claim, days, askEachTime }
 *   send     does it, with the answers; throws to say it didn't. It's only closed once that's done.
 *   setup    opens the page for setting up the CLI and MCP server (the dialog closes first)
 *   error    what a failed send says, in plain words
 */
export function openSend({ title, asker, ways, answers, send, setup = null, error = e => e?.message || 'Something went wrong. Try again in a moment.' }){
  if (document.querySelector('.rs-sd')) return;
  const st = { busy: false, moreDays: false, moreWays: false, skip: false, ...answers };
  if (!ways.some(w => w.id === st.route)) st.route = ways[0]?.id;
  const { first, rest } = splitWays(ways, st.route);
  const dlg = document.createElement('dialog');
  dlg.className = 'rs-wl rs-sd';
  dlg.setAttribute('aria-labelledby', 'rsSdTitle');
  dlg.innerHTML = '<div class="rs rs-wl-box"></div>';
  const box = dlg.firstChild;
  document.body.append(dlg);

  const choice = w => `<label class="rs-sd-way"><input type="radio" name="sdRoute" value="${esc(w.id)}"${w.id === st.route ? ' checked' : ''}><span><b>${esc(w.name)}</b><small>${esc(w.note)}</small></span></label>`;
  // What the first button copies: the prompt itself, or a command that starts an agent with it.
  const what = () => st.route === 'brief' ? 'the prompt' : 'the command';
  const daysSaid = () => (TAKE_DAYS.find(([d]) => d === st.days)?.[1] || `${st.days} days`).toLowerCase();

  function paint(){
    const days = dayChoices(st.days);
    box.innerHTML = `<div class="rs-wl-top"><h2 id="rsSdTitle" tabindex="-1">Send your agent</h2><button class="rs-wl-x" type="button" data-sd="cancel" aria-label="Close">${ico('close')}</button></div>
      <p class="rs-sd-what">${esc(title)}</p>
      <p class="rs-sd-intro">The prompt is ${esc(asker)}’s ask, in their own words. Rainshare wraps it in safety rules for your agent: stay in the repo, leave secrets alone, and check with you before anything risky. They can’t catch everything, so read the ask before you start.</p>
      <fieldset class="rs-sd-how"><legend>Send it with</legend>
        <div class="rs-sd-ways">${first.map(choice).join('')}</div>
        ${rest.length ? `<details class="rs-sd-more"${st.moreWays || rest.some(w => w.id === st.route) ? ' open' : ''}><summary>Other ways: ${esc(rest.map(w => w.name).join(', '))}</summary>
          <div class="rs-sd-ways">${rest.map(choice).join('')}</div>
          ${setup ? '<button class="rs-link" type="button" data-sd="setup">Set up the CLI or MCP server</button>' : ''}
        </details>` : ''}
      </fieldset>
      <div class="rs-sd-go">
        <button class="rs-btn rs-primary" type="button" data-sd="claim">I’m on it, copy ${what()}</button>
        <p class="rs-sd-days-line">Tells ${esc(asker)} and everyone else, so nobody does it twice. You’ll have ${esc(daysSaid())} to turn it in. <button class="rs-link" type="button" data-sd="days" aria-expanded="${st.moreDays}" aria-controls="rsSdDays">Change</button></p>
        <div class="rs-sd-days" id="rsSdDays"${st.moreDays ? '' : ' hidden'}>
          <div class="rs-toggles" role="group" aria-label="I’ll turn it in within">${days.map(([d, l]) => `<button type="button" data-sd-days="${d}" aria-pressed="${d === st.days}">${esc(l)}</button>`).join('')}</div>
          <small>If nothing’s turned in by then, it shows as free again for someone else. You can give yourself more time from its page.</small>
        </div>
        <button class="rs-btn rs-quiet" type="button" data-sd="copy">Just copy it for now</button>
      </div>
      <p class="rs-err" role="alert" hidden></p>
      <div class="rs-wl-foot">
        <label class="rs-check"><input type="checkbox" name="sdSkip"${st.skip ? ' checked' : ''}> Next time, skip this and do the same</label>
        <button class="rs-link" type="button" data-sd="cancel">Cancel</button>
      </div>`;
  }
  const say = msg => { const p = box.querySelector('.rs-err'); if (p) { p.textContent = msg; p.hidden = !msg; } };

  async function submit(btn, claim){
    if (st.busy) return;
    const was = btn.textContent;
    st.busy = true; btn.disabled = true; btn.textContent = claim ? 'Sending…' : 'Copying…'; say('');
    try { await send({ route: st.route, claim, days: st.days, remember: st.skip, askEachTime: !st.skip }); }
    catch (e) { st.busy = false; btn.disabled = false; btn.textContent = was; say(error(e)); return; }
    st.busy = false;
    dlg.close();
  }

  dlg.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'sdRoute') { st.route = t.value; box.querySelector('[data-sd="claim"]').textContent = `I’m on it, copy ${what()}`; }
    if (t.name === 'sdSkip') st.skip = t.checked;
  });
  dlg.addEventListener('click', e => {
    if (st.busy) return;
    // Outside the box is the same as Cancel.
    if (e.target === dlg) return dlg.close();
    const d = e.target.closest('[data-sd-days]');
    if (d) { st.days = +d.dataset.sdDays; paint(); box.querySelector(`[data-sd-days="${st.days}"]`)?.focus(); return; }
    const b = e.target.closest('[data-sd]'); if (!b) return;
    const act = b.dataset.sd;
    if (act === 'cancel') dlg.close();
    else if (act === 'days') { st.moreDays = !st.moreDays; paint(); box.querySelector('[data-sd="days"]')?.focus(); }
    else if (act === 'setup') { dlg.close(); setup?.(); }
    else if (act === 'claim') submit(b, true);
    else if (act === 'copy') submit(b, false);
  });
  // (Other ways stay unfolded through a redraw, once they've been opened.)
  dlg.addEventListener('toggle', e => { if (e.target.classList?.contains('rs-sd-more')) st.moreWays = e.target.open; }, true);
  dlg.addEventListener('cancel', e => { if (st.busy) e.preventDefault(); });
  dlg.addEventListener('close', () => dlg.remove());

  paint();
  dlg.showModal();
  box.querySelector('[data-sd="claim"]')?.focus();
}
