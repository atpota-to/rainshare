// "Direct my agent", as a short guided dialog. Nothing is written until its button is pressed, and
// you stay where you were the whole way through: there's no page to be taken to.
//
//   choose  under the heading, one line: your agent gets the ask as its asker wrote it, inside
//           Rainshare's safety rules (../core/brief.js). The ⓘ says what the rules ask of the
//           agent, that it may not follow them, and that they don't make the repo safe, so read
//           the ask and look the repo over first. Nothing here
//           claims more than that. Then a row of chips naming agents (the one your profile says
//           you run; on a phone, the Claude app for a GitHub repo, and the prompt itself; "Any
//           agent"; "More" for the rest), "Tell Kai I'm on it for a day", ticked to begin with
//           (other lengths behind "Change"), and one button that copies.
//   paste   what was copied, in a box with its own Copy (a browser can refuse to copy without
//           saying, Safari especially), and on a phone Share, which hands it to an app without
//           the clipboard; what to do with it, whether anyone's been told you're on it, and what
//           happens when the agent's done. "Done" closes it.
//
// The Claude app (or Claude Code on the web, on a computer) has a second step of its own: a link
// that opens a new session with the prompt and the repository filled in, and nothing sent until
// the person presses send there. A cloud session can push only where your GitHub account can, so
// it's opened on your fork: the step asks for your GitHub username once (kept in your settings),
// looks for your fork, and if there isn't one, offers GitHub's fork page first, and looks again
// when you come back.
//
// Someone who ticked "Skip this screen next time" (kept in dev.rainshare.preferences) goes
// straight to the second step: openPasted. They can change their answers on their profile, or
// with "Change" beside the button.
import { TAKE_DAYS, githubLogin } from '../core/ns.js';
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
/**
 * The ways shown at first (the one picked to begin with, any in `lead`, and the prompt), and the
 * rest, folded away.
 */
export function splitWays(ways, route, lead = []){
  const first = [...new Set([route, ...lead, 'brief'])].map(id => ways.find(w => w.id === id)).filter(Boolean);
  return { first, rest: ways.filter(w => !first.includes(w)) };
}
/**
 * What the second step says, for the way it went: { lede, next }. `way` is { id, note }, `asker`
 * what to call whoever asked. The prompt goes into an agent; a command goes into a terminal; the
 * CLI and the MCP server turn the work in themselves, so what happens next is theirs to say.
 */
export function pasteWords(way, asker){
  const lede = way.id === 'brief' ? 'Paste it into your agent: Claude Code, Codex, or another that can work on the repo.'
    : way.id === 'web' ? 'Open it in Claude, with the prompt and the repository filled in.'
      : `Paste it in a terminal. ${way.note || ''}`.trim();
  const next = way.id === 'cli' ? 'When your agent finishes, the CLI offers to turn the work in for you.'
    : way.id === 'mcp' ? 'Your agent turns it in itself, through Rainshare’s MCP server.'
      : `When it’s done, your agent gives you a link back to ${asker}’s ask. Open it to turn the work in.`;
  return { lede, next };
}
/**
 * Where Claude should be opened, for the Claude app's step: { repo, why }. `upstream` is the
 * ask's repository, `github` your username (or null), `fork` what was found: undefined while
 * looking, null for none, or the repository you can push to (your fork, or the repository itself
 * when it's yours). `why` is 'yours' (found), 'guess' (your fork's likely name, before it's been
 * found), or 'theirs' (no username: the ask's own repository, where you may not be able to push).
 */
export function webTarget(upstream, github, fork){
  if (fork) return { repo: fork, why: 'yours' };
  const login = githubLogin(github);
  if (!login) return { repo: upstream, why: 'theirs' };
  return { repo: `${login}/${String(upstream).split('/')[1]}`, why: 'guess' };
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
const shown = (r) => r.id !== 'brief' && r.id !== 'web' && r.command.length > 600 ? r.command.slice(0, 600) + '\n…' : r.command;

/**
 * The second step, put in `box`: what was sent, and for the Claude app, the way there. `r` is what
 * the first step gave back: { id, command, lede, next, copied, until } (`until`, "Sun, Nov 15",
 * when you said you're on it; null when you didn't), and for the Claude app, `web`:
 *   repo    the ask's GitHub repository ("owner/name")
 *   github  your GitHub username, if your settings have it
 *   prompt  (github) => the prompt, made again with your username in it
 *   link    ({ repo, prompt }) => { href, filled }: the link that opens Claude (../core/brief.js)
 *   fork    (github) => where you can push: your fork, or null (../core/subjects.js forkOf)
 *   save    (github) => keeps your username in your settings
 * `share` hands text to the phone's share sheet (null where there isn't one). Gives back
 * { first, click, submit, stop }: what to focus first; the dialog passes its clicks and submits
 * on, and calls stop on closing.
 */
function secondStep(box, r, { asker, copy, share }){
  const w = r.web ? { gh: githubLogin(r.web.github), fork: undefined, failed: false, editing: false, saving: false, err: '' } : null;
  let asked = 0;
  // Looking for your fork (again, after you've been to GitHub to make one).
  async function look(){
    if (!w?.gh) return;
    const n = ++asked;
    w.failed = false;
    try { const f = await r.web.fork(w.gh); if (n === asked) w.fork = f || null; }
    catch (_) { if (n === asked) { w.fork = null; w.failed = true; } }
    if (n === asked && box.isConnected) paint();
  }
  const webLink = () => { const t = webTarget(r.web.repo, w.gh, w.fork); return { ...t, ...r.web.link({ repo: t.repo, prompt: r.command }) }; };
  const shareBtn = share ? `<button class="rs-btn rs-quiet rs-sm" type="button" data-sd="share">${ico('share')}Share</button>` : '';
  const codeBox = () => `<div class="rs-sd-code"><pre class="rs-code${r.id === 'brief' || r.id === 'web' ? ' rs-l-brief' : ''}"><code>${esc(shown(r))}</code></pre>
    <div class="rs-row">${`<button class="rs-btn rs-quiet rs-sm" type="button" data-sd="again">${ico('copy')}${r.copied ? 'Copy again' : 'Copy'}</button>`}${shareBtn}</div></div>`;
  const nextList = () => `<ul class="rs-sd-next">
    <li>${r.until ? `You’re on it until ${esc(r.until)}. ${esc(asker)} and everyone else can see that.` : 'Nobody’s been told you’re on it yet.'}</li>
    <li>${esc(r.next)}</li>
  </ul>`;

  // Every way but the Claude app: what was copied, with its own Copy, and what to do with it.
  const plain = () => `${top(r.copied ? `${ico('check')}Copied` : 'Copy it, then paste it')}
    <p class="rs-sd-lede">${esc(r.copied ? r.lede : `Press Copy, then ${r.lede[0].toLowerCase()}${r.lede.slice(1)}`)}</p>
    ${codeBox()}
    ${nextList()}
    <button class="rs-btn rs-primary" type="button" data-sd="done">Done</button>`;

  // The Claude app: who you are on GitHub, then your fork (or making one), then the link.
  function webPart(){
    const repo = esc(r.web.repo), L = webLink(), open = label => `<a class="rs-btn rs-primary" href="${esc(L.href)}" target="_blank" rel="noopener" data-sd-open>${ico('out')}${esc(label)}</a>`;
    const who = `<p class="rs-sd-small">As <b>@${esc(w.gh)}</b> on GitHub. <button class="rs-link" type="button" data-sd="gh-change">Change</button></p>`;
    if (!w.gh || w.editing) return `<form class="rs-sd-gh" data-sd-form="gh" novalidate>
        <label for="rsSdGh">Your GitHub username</label>
        <div class="rs-row"><input id="rsSdGh" name="gh" value="${esc(w.gh || '')}" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="octocat" required><button class="rs-btn rs-quiet" type="submit"${w.saving ? ' disabled' : ''}>${w.saving ? 'Saving…' : 'Save'}</button></div>
        <p class="rs-err" role="alert"${w.err ? '' : ' hidden'}>${esc(w.err)}</p>
        <p class="rs-sd-small">Claude can only push to a repository you can write to, so it works in your fork of ${repo}. Your username is kept in your settings.</p>
      </form>
      ${w.editing ? '<button class="rs-link rs-sd-alt" type="button" data-sd="gh-keep">Keep the one I had</button>'
        : `<a class="rs-link rs-sd-alt" href="${esc(L.href)}" target="_blank" rel="noopener" data-sd-open>Open ${repo} itself instead</a>`}`;
    if (w.fork === undefined) return `<p class="rs-sd-small" role="status">Looking for your fork of ${repo} on GitHub…</p>${who}`;
    if (w.fork) return `${open('Open in Claude')}
      <p class="rs-sd-small">${w.fork.toLowerCase() === r.web.repo.toLowerCase() ? `On ${repo}, which is yours.` : `On your fork, ${esc(w.fork)}.`} <button class="rs-link" type="button" data-sd="gh-change">Not you?</button></p>`;
    return `<ol class="rs-sd-steps">
        <li><span>${w.failed ? `Couldn’t ask GitHub whether you’ve forked ${repo}. If you haven’t, fork it first.` : `Fork ${repo} on GitHub, then come back here.`}</span>
          <a class="rs-btn rs-quiet" href="https://github.com/${esc(r.web.repo)}/fork" target="_blank" rel="noopener" data-sd-fork>Fork it on GitHub</a></li>
        <li><span>Then open your fork in Claude.</span>${open('Open your fork in Claude')}</li>
      </ol>${who}`;
  }
  const web = () => {
    const L = w.gh && !w.editing && w.fork !== undefined ? webLink() : null, filled = L ? L.filled : true;
    return `${top('Open it in Claude')}
    <p class="rs-sd-lede">${filled ? 'Claude opens with the prompt and the repository filled in. Nothing starts until you press send there.'
      : `The prompt’s too long to go in the link${r.copied ? ', so it’s copied' : ''}: ${r.copied ? 'paste' : 'copy it, then paste'} it into Claude once it opens.`}</p>
    <div class="rs-sd-web">${webPart()}</div>
    <details class="rs-sd-prompt"${filled ? '' : ' open'}><summary>The prompt${r.copied ? ' (copied as well)' : ''}</summary>${codeBox()}</details>
    ${nextList()}
    <button class="rs-btn rs-quiet rs-sd-done" type="button" data-sd="done">Done</button>`;
  };

  // The first time, it slides in over the first step (./motion.js); after that it's drawn again in
  // place, keeping the focus where it was and the prompt open or folded as it was.
  function paint(first = false){
    if (first) return swapStep(box, w ? web() : plain());
    const had = document.activeElement && box.contains(document.activeElement) ? document.activeElement : null;
    const was = had?.matches('[data-sd], [data-sd-open], [data-sd-fork], input') ? (had.dataset.sd ? `[data-sd="${had.dataset.sd}"]` : had.matches('input') ? 'input' : had.matches('[data-sd-fork]') ? '[data-sd-fork]' : '[data-sd-open]') : null;
    const open = box.querySelector('.rs-sd-prompt')?.open, leaving = box.querySelector(':scope > .rs-step-out');
    box.innerHTML = w ? web() : plain();
    if (leaving) box.append(leaving);
    if (open != null && box.querySelector('.rs-sd-prompt')) box.querySelector('.rs-sd-prompt').open = open;
    if (was) box.querySelector(was)?.focus();
  }

  async function saveGh(form){
    const login = githubLogin(form.elements.gh.value);
    if (!login) { w.err = 'That isn’t a GitHub username: letters, numbers and hyphens, up to 39.'; paint(); box.querySelector('input')?.focus(); return; }
    w.saving = true; w.err = ''; paint();
    try { await r.web.save(login); } catch (_) { /* kept for this time, all the same */ }
    w.saving = false; w.editing = false; w.gh = login; w.fork = undefined;
    // The prompt says who you are on GitHub, so it's made again with your username in it.
    r.command = r.web.prompt(login);
    paint();
    look().then(() => (box.querySelector('[data-sd-open]') || box.querySelector('[data-sd-fork]'))?.focus());
  }
  // Back from GitHub (a fork made in another tab): look for it again.
  const back = () => { if (document.visibilityState === 'visible' && w?.gh && !w.fork && !w.editing) look(); };
  if (w) document.addEventListener('visibilitychange', back);

  paint(true);
  if (w?.gh) look();
  return {
    first: () => (w && !w.gh ? box.querySelector('input') : box.querySelector('[data-sd-open]') || box.querySelector('[data-sd="done"]')),
    click(e){
      const o = e.target.closest('[data-sd-open]');
      // (Copied again as it opens, in case the app opens without the prompt filled in.)
      if (o) { try { navigator.clipboard?.writeText(r.command).catch(() => {}); } catch (_) {} return true; }
      if (e.target.closest('[data-sd-fork]')) return true;
      const b = e.target.closest('[data-sd]'); if (!b) return false;
      const act = b.dataset.sd;
      if (act === 'again') { copy(r.command, b); return true; }
      if (act === 'share') { share(r.command).then(s => { if (s === 'failed') copy(r.command, null); }); return true; }
      if (act === 'gh-change') { w.editing = true; paint(); box.querySelector('input')?.focus(); return true; }
      if (act === 'gh-keep') { w.editing = false; w.err = ''; paint(); box.querySelector('[data-sd-open]')?.focus(); return true; }
      return false;
    },
    submit(e){
      const f = e.target.closest('[data-sd-form="gh"]'); if (!f) return false;
      e.preventDefault(); if (!w.saving) saveGh(f); return true;
    },
    stop(){ document.removeEventListener('visibilitychange', back); asked++; }
  };
}

/**
 * Open it at the first step.
 *   asker    what to call whoever asked ("Kai")
 *   ways     [{ id, name }]: how it can be sent
 *   lead     ids of ways to show at first, beside the one picked and the prompt (on a phone, the Claude app)
 *   answers  what's picked to begin with: { route, claim, days, askEachTime }
 *   send     does it, with the answers, and gives back what the second step shows (see secondStep),
 *            or null if it didn't go ahead (someone else got there first, and you said not to).
 *            It's called within the press, so it can start copying straight away. Throws to say
 *            it went wrong.
 *   copy     copies the text again, from "Copy again": (text, button), or after the share sheet failed: (text, null)
 *   share    hands the text to the phone's share sheet, or null where there isn't one
 *   done     once it's closed, with what was sent (null if it was closed before that)
 *   error    what a failed send says, in plain words
 */
export function openSend({ asker, ways, lead = [], answers, send, copy, share = null, done = () => {}, error = e => e?.message || 'Something went wrong. Try again in a moment.' }){
  if (document.querySelector('.rs-sd')) return;
  const st = { busy: false, moreDays: false, moreWays: false, skip: false, sent: null, second: null, ...answers };
  if (!ways.some(w => w.id === st.route)) st.route = ways[0]?.id;
  const { first, rest } = splitWays(ways, st.route, lead);
  const { dlg, box } = dialog(() => { st.second?.stop(); done(st.sent); });

  // What the button does: copies the prompt, or a command that starts an agent with it, or gets
  // the Claude app's link ready.
  const go = () => st.route === 'web' ? 'Next: open Claude' : st.route === 'brief' ? 'Copy the prompt' : 'Copy the command';
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
    box.innerHTML = `${top('Direct your agent')}
      <p class="rs-sd-intro">It gets ${esc(asker)}’s ask as written, inside Rainshare’s safety rules ${RULES}</p>
      <div class="rs-chips" role="group" aria-label="Hand it over with" data-rs-glide="way">${showing.map(w => `<button type="button" data-sd-way="${esc(w.id)}" aria-pressed="${w.id === st.route}">${esc(w.name)}</button>`).join('')}${showing === first && rest.length ? '<button type="button" data-sd="more" class="rs-sd-more">More</button>' : ''}</div>
      <div class="rs-sd-claim"><label class="rs-sd-check"><input type="checkbox" name="sdClaim"${st.claim ? ' checked' : ''}> Tell ${esc(asker)} I’m on it for ${esc(daysSaid())}</label>${st.claim ? `<button class="rs-link" type="button" data-sd="days" aria-expanded="${st.moreDays}" aria-controls="rsSdDays">Change</button>` : ''}</div>
      ${st.claim && st.moreDays ? `<div class="rs-sd-days" id="rsSdDays">
        <div class="rs-toggles" role="group" aria-label="I’ll turn it in within">${dayChoices(st.days).map(([d, l]) => `<button type="button" data-sd-days="${d}" aria-pressed="${d === st.days}">${esc(l)}</button>`).join('')}</div>
        <small>So nobody does it twice. If nothing’s turned in by then, it shows as free again.</small>
      </div>` : ''}
      <button class="rs-btn rs-primary" type="button" data-sd="go">${go()}</button>
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
    st.second = secondStep(box, r, { asker, copy, share });
    st.second.first()?.focus();
  }

  dlg.addEventListener('change', e => {
    if (st.sent) return;
    if (e.target.name === 'sdSkip') st.skip = e.target.checked;
    // (Unticked, how long doesn't come into it, so "Change" and the lengths go.)
    if (e.target.name === 'sdClaim') { st.claim = e.target.checked; paint(); box.querySelector('[name=sdClaim]')?.focus(); }
  });
  dlg.addEventListener('submit', e => { if (st.second?.submit(e)) return; e.preventDefault(); });
  dlg.addEventListener('click', e => {
    if (st.busy) return;
    // Outside the box is the same as closing it.
    if (e.target === dlg) return closeSoftly(dlg);
    const t = e.target.closest('[data-rs-tip]'); if (t) return toggleTip(t);
    if (st.second?.click(e)) return;
    const w = e.target.closest('[data-sd-way]');
    if (w) { st.route = w.dataset.sdWay; repaint('[data-sd-way]'); return; }
    const d = e.target.closest('[data-sd-days]');
    if (d) { st.days = +d.dataset.sdDays; paint(); box.querySelector(`[data-sd-days="${st.days}"]`)?.focus(); return; }
    const b = e.target.closest('[data-sd]'); if (!b) return;
    const act = b.dataset.sd;
    if (act === 'cancel' || act === 'done') closeSoftly(dlg);
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
 * this says what was copied and what's next. `r`, `asker`, `copy`, `share` and `done` as for openSend.
 */
export function openPasted({ r, asker, copy, share = null, done = () => {} }){
  if (document.querySelector('.rs-sd')) return;
  let second = null;
  const { dlg, box } = dialog(() => { second?.stop(); done(r); });
  second = secondStep(box, r, { asker, copy, share });
  dlg.addEventListener('submit', e => { if (!second.submit(e)) e.preventDefault(); });
  dlg.addEventListener('click', e => {
    if (e.target === dlg) return closeSoftly(dlg);
    if (second.click(e)) return;
    const b = e.target.closest('[data-sd]'); if (!b) return;
    if (b.dataset.sd === 'cancel' || b.dataset.sd === 'done') closeSoftly(dlg);
  });
  dlg.addEventListener('cancel', e => { if (!e.cancelable) return; e.preventDefault(); closeSoftly(dlg); });
  dlg.showModal();
  second.first()?.focus();
}
