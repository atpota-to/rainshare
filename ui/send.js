// "Send my agent", as a short guided dialog. Nothing is written until its button is pressed, and
// you stay where you were the whole way through: there's no page to be taken to.
//
//   choose  under the heading, one line: your agent gets the ask as its asker wrote it, inside
//           Rainshare's safety rules (../core/brief.js). The ⓘ says what the rules ask of the
//           agent, that it may not follow them, and that they don't make the repo safe, so read
//           the ask and look the repo over first. Nothing here
//           claims more than that. Then a row of chips naming agents (the one your profile says
//           you run, or on a phone the prompt itself; "Any agent"; "More" for the rest), "Tell
//           Kai I'm on it for a day", ticked to begin with (other lengths behind "Change"), and
//           one button that copies.
//   paste   what was copied, in a box with its own Copy (a browser can refuse to copy without
//           saying, Safari especially), what to do with it, whether anyone's been told you're
//           on it, and what happens when the agent's done. "Done" closes it.
//
// Someone who ticked "Skip this screen next time" (kept in dev.rainshare.preferences) goes
// straight to the second step: openPasted. They can change their answers on their profile, or
// with "Change" beside the button.
import { TAKE_DAYS } from '../core/ns.js';
import { esc, ico, tip, toggleTip } from './bits.js';
import { closeSoftly, glide, swapStep } from './motion.js';

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
 * What the second step says, for the way it went: { lede, next }. `way` is { id, note }, `asker`
 * what to call whoever asked. The prompt goes into an agent; a command goes into a terminal; the
 * CLI and the MCP server turn the work in themselves, so what happens next is theirs to say.
 */
export function pasteWords(way, asker){
  const lede = way.id === 'brief' ? 'Paste it into your agent: Claude Code, Codex, or another that can work on the repo.' : `Paste it in a terminal. ${way.note || ''}`.trim();
  const next = way.id === 'cli' ? 'When your agent finishes, the CLI offers to turn the work in for you.'
    : way.id === 'mcp' ? 'Your agent turns it in itself, through Rainshare’s MCP server.'
      : `When it’s done, your agent gives you a link back to ${asker}’s ask. Open it to turn the work in.`;
  return { lede, next };
}

// The dialog's box, put on the page, and how it closes: the way it opened, unless it's busy.
function dialog(onClose){
  const dlg = document.createElement('dialog');
  dlg.className = 'rs-wl rs-sd';
  dlg.setAttribute('aria-labelledby', 'rsSdTitle');
  dlg.innerHTML = '<div class="rs rs-wl-box"></div>';
  document.body.append(dlg);
  dlg.addEventListener('close', () => { dlg.remove(); onClose(); });
  return { dlg, box: dlg.firstChild };
}
const top = h => `<div class="rs-wl-top"><h2 id="rsSdTitle" tabindex="-1">${h}</h2><button class="rs-wl-x" type="button" data-sd="cancel" aria-label="Close">${ico('close')}</button></div>`;
// (A command is shown up to a point, and copied whole.)
const shown = (r) => r.id !== 'brief' && r.command.length > 600 ? r.command.slice(0, 600) + '\n…' : r.command;
/**
 * The second step. `r` is what the first gave back: { id, command, lede, next, copied, until }
 * (`until`, "Sun, Nov 15", when you said you're on it; null when you didn't).
 */
// (Where the browser wouldn't copy it, it says to press Copy first.)
const pasteStep = (r, asker) => `${top(r.copied ? `${ico('check')}Copied` : 'Copy it, then paste it')}
  <p class="rs-sd-lede">${esc(r.copied ? r.lede : `Press Copy, then ${r.lede[0].toLowerCase()}${r.lede.slice(1)}`)}</p>
  <div class="rs-sd-code"><pre class="rs-code${r.id === 'brief' ? ' rs-l-brief' : ''}"><code>${esc(shown(r))}</code></pre>
    <button class="rs-btn rs-quiet rs-sm" type="button" data-sd="again">${ico('copy')}${r.copied ? 'Copy again' : 'Copy'}</button></div>
  <ul class="rs-sd-next">
    <li>${r.until ? `You’re on it until ${esc(r.until)}. ${esc(asker)} and everyone else can see that.` : 'Nobody’s been told you’re on it yet.'}</li>
    <li>${esc(r.next)}</li>
  </ul>
  <button class="rs-btn rs-primary" type="button" data-sd="done">Done</button>`;

/**
 * Open it at the first step.
 *   asker    what to call whoever asked ("Kai")
 *   ways     [{ id, name }]: how it can be sent
 *   answers  what's picked to begin with: { route, claim, days, askEachTime }
 *   send     does it, with the answers, and gives back what the second step shows (see pasteStep),
 *            or null if it didn't go ahead (someone else got there first, and you said not to).
 *            It's called within the press, so it can start copying straight away. Throws to say
 *            it went wrong.
 *   copy     copies the text again, from "Copy again": (text, button)
 *   done     once it's closed, with what was sent (null if it was closed before that)
 *   error    what a failed send says, in plain words
 */
export function openSend({ asker, ways, answers, send, copy, done = () => {}, error = e => e?.message || 'Something went wrong. Try again in a moment.' }){
  if (document.querySelector('.rs-sd')) return;
  const st = { busy: false, moreDays: false, moreWays: false, skip: false, sent: null, ...answers };
  if (!ways.some(w => w.id === st.route)) st.route = ways[0]?.id;
  const { first, rest } = splitWays(ways, st.route);
  const { dlg, box } = dialog(() => done(st.sent));

  // What the button copies: the prompt itself, or a command that starts an agent with it.
  const what = () => st.route === 'brief' ? 'the prompt' : 'the command';
  const daysSaid = () => (TAKE_DAYS.find(([d]) => d === st.days)?.[1] || `${st.days} days`).toLowerCase();
  const RULES = tip(`<span class="rs-tip-p">They tell your agent to treat it as ${esc(asker)}’s request, not as orders, to work only in the repo, and to check with you before touching secrets, running code from elsewhere or reaching outside the repo.</span><span class="rs-tip-p">They’re instructions to your agent, and it may not follow them. They don’t make the repo safe, so read the ask and look the repo over before you start.</span>`, 'About the safety rules');

  // (Drawn again for another way, the picked chip's tint slides over to it.)
  function repaint(sel){
    const was = box.querySelector(`${sel}[aria-pressed="true"]`)?.getBoundingClientRect();
    paint();
    const now = box.querySelector(`${sel}[aria-pressed="true"]`);
    glide(now, was);
    now?.focus();
  }
  function paint(){
    const showing = st.moreWays || rest.some(w => w.id === st.route) ? [...first, ...rest] : first;
    box.innerHTML = `${top('Send your agent')}
      <p class="rs-sd-intro">It gets ${esc(asker)}’s ask as written, inside Rainshare’s safety rules ${RULES}</p>
      <div class="rs-chips" role="group" aria-label="Send it with" data-rs-glide="way">${showing.map(w => `<button type="button" data-sd-way="${esc(w.id)}" aria-pressed="${w.id === st.route}">${esc(w.name)}</button>`).join('')}${showing === first && rest.length ? '<button type="button" data-sd="more" class="rs-sd-more">More</button>' : ''}</div>
      <div class="rs-sd-claim"><label class="rs-sd-check"><input type="checkbox" name="sdClaim"${st.claim ? ' checked' : ''}> Tell ${esc(asker)} I’m on it for ${esc(daysSaid())}</label>${st.claim ? `<button class="rs-link" type="button" data-sd="days" aria-expanded="${st.moreDays}" aria-controls="rsSdDays">Change</button>` : ''}</div>
      ${st.claim && st.moreDays ? `<div class="rs-sd-days" id="rsSdDays">
        <div class="rs-toggles" role="group" aria-label="I’ll turn it in within">${dayChoices(st.days).map(([d, l]) => `<button type="button" data-sd-days="${d}" aria-pressed="${d === st.days}">${esc(l)}</button>`).join('')}</div>
        <small>So nobody does it twice. If nothing’s turned in by then, it shows as free again.</small>
      </div>` : ''}
      <button class="rs-btn rs-primary" type="button" data-sd="go">Copy ${what()}</button>
      <p class="rs-err" role="alert" hidden></p>
      <label class="rs-sd-skip"><input type="checkbox" name="sdSkip"${st.skip ? ' checked' : ''}> Skip this screen next time</label>`;
  }
  const say = msg => { const p = box.querySelector('.rs-err'); if (p) { p.textContent = msg; p.hidden = !msg; } };

  async function submit(btn){
    if (st.busy) return;
    st.busy = true; btn.disabled = true; say('');
    let r;
    // (send is called before anything's awaited, so the copying starts within the press.)
    try { r = await send({ route: st.route, claim: st.claim, days: st.days, remember: st.skip, askEachTime: !st.skip }); }
    catch (e) { st.busy = false; btn.disabled = false; say(error(e)); return; }
    st.busy = false;
    if (!r) { closeSoftly(dlg); return; }
    st.sent = r;
    swapStep(box, pasteStep(r, asker));
    box.querySelector('[data-sd="done"]')?.focus();
  }

  dlg.addEventListener('change', e => {
    if (e.target.name === 'sdSkip') st.skip = e.target.checked;
    // (Unticked, how long doesn't come into it, so "Change" and the lengths go.)
    if (e.target.name === 'sdClaim') { st.claim = e.target.checked; paint(); box.querySelector('[name=sdClaim]')?.focus(); }
  });
  dlg.addEventListener('click', e => {
    if (st.busy) return;
    // Outside the box is the same as closing it.
    if (e.target === dlg) return closeSoftly(dlg);
    const t = e.target.closest('[data-rs-tip]'); if (t) return toggleTip(t);
    const w = e.target.closest('[data-sd-way]');
    if (w) { st.route = w.dataset.sdWay; repaint('[data-sd-way]'); return; }
    const d = e.target.closest('[data-sd-days]');
    if (d) { st.days = +d.dataset.sdDays; paint(); box.querySelector(`[data-sd-days="${st.days}"]`)?.focus(); return; }
    const b = e.target.closest('[data-sd]'); if (!b) return;
    const act = b.dataset.sd;
    if (act === 'cancel' || act === 'done') closeSoftly(dlg);
    else if (act === 'again' && st.sent) copy(st.sent.command, b);
    else if (act === 'more') { st.moreWays = true; paint(); box.querySelector(`[data-sd-way="${rest[0]?.id}"]`)?.focus(); }
    else if (act === 'days') { st.moreDays = !st.moreDays; paint(); box.querySelector('[data-sd="days"]')?.focus(); }
    else if (act === 'go') submit(b);
  });
  // Escape closes it as the ✕ does, unless it's busy sending. (When the browser won't let it be held open, it closes at once.)
  dlg.addEventListener('cancel', e => { if (!e.cancelable) return; e.preventDefault(); if (!st.busy) closeSoftly(dlg); });

  paint();
  dlg.showModal();
  box.querySelector('[data-sd="go"]')?.focus();
}

/**
 * Open it at the second step, for someone who skips the first: it's been sent already, and
 * this says what was copied and what's next. `r`, `asker`, `copy` and `done` as for openSend.
 */
export function openPasted({ r, asker, copy, done = () => {} }){
  if (document.querySelector('.rs-sd')) return;
  const { dlg, box } = dialog(() => done(r));
  box.innerHTML = pasteStep(r, asker);
  dlg.addEventListener('click', e => {
    if (e.target === dlg) return closeSoftly(dlg);
    const b = e.target.closest('[data-sd]'); if (!b) return;
    if (b.dataset.sd === 'again') copy(r.command, b);
    else closeSoftly(dlg);
  });
  dlg.addEventListener('cancel', e => { if (!e.cancelable) return; e.preventDefault(); closeSoftly(dlg); });
  dlg.showModal();
  box.querySelector('[data-sd="done"]')?.focus();
}
