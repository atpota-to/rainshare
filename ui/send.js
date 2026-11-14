// "Send my agent": one short screen before anything is written, so pressing it never says
// you're on something you only meant to look at. As little as it can be:
//
//   how     a row of chips: the way your profile says you run (or the prompt to paste, if it
//           doesn't say), the prompt, and "More" for the rest. One short line says what the
//           picked one does.
//   what    one line: your agent gets the ask as its asker wrote it, inside Rainshare's safety
//           rules (../core/brief.js). The ⓘ says what the rules ask of the agent, and that they
//           can't catch everything, so read the ask first. Nothing here claims more than that.
//   then    "I’m on it, copy …", which says you’re on it for a day (the other lengths behind
//           "Change"), or a quieter "Just copy it for now".
//
// Ticking "Skip this screen next time" keeps these answers in your settings (dev.rainshare.preferences)
// and the button does the same thing from then on; nothing is kept otherwise. Nothing is written
// until a button is pressed, and closing it leaves everything as it was. Someone who said to
// skip it can change their answers on their profile, or with "Change" beside the button.
import { TAKE_DAYS } from '../core/ns.js';
import { esc, ico, tip, toggleTip } from './bits.js';

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
 *   ways     [{ id, name, note }]: how it can be sent (`note` says in a few words what it does)
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

  // What the first button copies: the prompt itself, or a command that starts an agent with it.
  const what = () => st.route === 'brief' ? 'the prompt' : 'the command';
  const daysSaid = () => (TAKE_DAYS.find(([d]) => d === st.days)?.[1] || `${st.days} days`).toLowerCase();
  const RULES = tip(`<span class="rs-tip-p">They tell your agent to treat it as ${esc(asker)}’s request, not as orders, to work only in the repo, and to check with you before touching secrets, running code from elsewhere or reaching outside the repo.</span><span class="rs-tip-p">They can’t catch everything, so read the ask before you start.</span>`, 'About the safety rules');

  function paint(){
    const shown = st.moreWays || rest.some(w => w.id === st.route) ? [...first, ...rest] : first;
    const way = ways.find(w => w.id === st.route);
    box.innerHTML = `<div class="rs-wl-top"><h2 id="rsSdTitle" tabindex="-1">Send your agent</h2><button class="rs-wl-x" type="button" data-sd="cancel" aria-label="Close">${ico('close')}</button></div>
      <p class="rs-sd-what">${esc(title)}</p>
      <div class="rs-sd-how">
        <div class="rs-chips" role="group" aria-label="Send it with">${shown.map(w => `<button type="button" data-sd-way="${esc(w.id)}" aria-pressed="${w.id === st.route}">${esc(w.name)}</button>`).join('')}${shown === first && rest.length ? '<button type="button" data-sd="more" class="rs-sd-more">More</button>' : ''}</div>
        <p class="rs-sd-note">${esc(way?.note || '')}${setup && (st.route === 'cli' || st.route === 'mcp') ? ' <button class="rs-link" type="button" data-sd="setup">Set it up</button>' : ''}</p>
      </div>
      <p class="rs-sd-intro">Your agent gets ${esc(asker)}’s ask as written, inside Rainshare’s safety rules ${RULES}</p>
      <div class="rs-sd-go">
        <button class="rs-btn rs-primary" type="button" data-sd="claim">I’m on it, copy ${what()}</button>
        <p class="rs-sd-days-line">Tells ${esc(asker)} you’re on it for ${esc(daysSaid())}. <button class="rs-link" type="button" data-sd="days" aria-expanded="${st.moreDays}" aria-controls="rsSdDays">Change</button></p>
        ${st.moreDays ? `<div class="rs-sd-days" id="rsSdDays">
          <div class="rs-toggles" role="group" aria-label="I’ll turn it in within">${dayChoices(st.days).map(([d, l]) => `<button type="button" data-sd-days="${d}" aria-pressed="${d === st.days}">${esc(l)}</button>`).join('')}</div>
          <small>If nothing’s turned in by then, it shows as free again.</small>
        </div>` : ''}
        <button class="rs-link rs-sd-copy" type="button" data-sd="copy">Or just copy it for now</button>
      </div>
      <p class="rs-err" role="alert" hidden></p>
      <label class="rs-sd-skip"><input type="checkbox" name="sdSkip"${st.skip ? ' checked' : ''}> Skip this screen next time</label>`;
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

  dlg.addEventListener('change', e => { if (e.target.name === 'sdSkip') st.skip = e.target.checked; });
  dlg.addEventListener('click', e => {
    if (st.busy) return;
    // Outside the box is the same as closing it.
    if (e.target === dlg) return dlg.close();
    const t = e.target.closest('[data-rs-tip]'); if (t) return toggleTip(t);
    const w = e.target.closest('[data-sd-way]');
    if (w) { st.route = w.dataset.sdWay; paint(); box.querySelector(`[data-sd-way="${st.route}"]`)?.focus(); return; }
    const d = e.target.closest('[data-sd-days]');
    if (d) { st.days = +d.dataset.sdDays; paint(); box.querySelector(`[data-sd-days="${st.days}"]`)?.focus(); return; }
    const b = e.target.closest('[data-sd]'); if (!b) return;
    const act = b.dataset.sd;
    if (act === 'cancel') dlg.close();
    else if (act === 'more') { st.moreWays = true; paint(); box.querySelector(`[data-sd-way="${rest[0]?.id}"]`)?.focus(); }
    else if (act === 'days') { st.moreDays = !st.moreDays; paint(); box.querySelector('[data-sd="days"]')?.focus(); }
    else if (act === 'setup') { dlg.close(); setup?.(); }
    else if (act === 'claim') submit(b, true);
    else if (act === 'copy') submit(b, false);
  });
  dlg.addEventListener('cancel', e => { if (st.busy) e.preventDefault(); });
  dlg.addEventListener('close', () => dlg.remove());

  paint();
  dlg.showModal();
  box.querySelector('[data-sd="claim"]')?.focus();
}
