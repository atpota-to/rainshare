// The welcome: two short steps for someone signing in for the first time, over whatever page
// they came back to.
//
//   story   what Rainshare is, in three plain steps
//   basics  your AI plan, and what you run: the two things the board sorts by and "Send my
//           agent" reads. Your name and picture are already there, from Bluesky. Under them,
//           messages from @rainshare.dev, both ticked to begin with: saving with either ticked
//           switches them on in your settings and follows @rainshare.dev for you, since
//           Bluesky only lets accounts you follow message you. Skipping switches nothing on.
//
// It's only for someone with no Rainshare profile (and only when their server said so: one
// that didn't answer isn't the same as no profile), and it's shown once per account on a
// browser. Skipping it, or closing it, is fine: the board still says "Set up your profile",
// and the rest of a profile (models, the work you take on, a name for Rainshare only) is on
// its own page. Saving writes a profile with just what was picked here.
import { PLANS, UNPAID, HARNESSES, NOTIFY, HANDLE } from '../core/ns.js';
import { esc, lit, ico, skyIco, lifeIco, face, nameOf, avatarFallback } from './bits.js';
import { closeSoftly, swapStep } from './motion.js';

const SEEN = did => 'rs:welcomed:' + did;
const seen = did => { try { return localStorage.getItem(SEEN(did)) === '1'; } catch (_) { return false; } };
const markSeen = did => { try { localStorage.setItem(SEEN(did), '1'); } catch (_) {} };

/**
 * Whether to welcome whoever's signed in. `mine` is their profile as the source read it, and
 * `sub` the screen they're on: on their profile's own page, they're already setting it up.
 */
export function shouldWelcome({ source, mine, sub = '' }){
  if (!source?.signedIn || source.demo || !source.viewer) return false;
  if (!mine || mine.merged || mine.unread) return false;
  return sub !== 'me' && !seen(source.viewer);
}

/** The profile the welcome saves: the plans picked, and a setup for each thing they run. */
export const welcomeProfile = ({ plans = [], runs = [] } = {}) => ({ plans: [...plans], setups: runs.map(harness => ({ harness, models: [] })) });
/** The messages the welcome starts with: every kind, ticked. */
export const welcomeMessages = () => Object.fromEntries(NOTIFY.map(([k]) => [k, true]));
/** Whether a choice of messages switches any on. */
export const anyMessages = notify => NOTIFY.some(([k]) => notify?.[k] === true);

// What Rainshare is, as briefly as it can be said, in the same three steps as the landing.
// [icon, the step, what it means for you]
const STORY = [
  [lifeIco('up'), 'People post ideas and projects they’d like help with.', 'You can post your own with “Ask for help”.'],
  [skyIco('showers'), 'Pick one and send your agent, on your own plan.', 'It gets their ask in their own words, with safety rules from Rainshare around it. Read it before you start.'],
  [lifeIco('sprouted'), 'Your agent opens a pull request. Paste its link back here.', 'If it does the job, they accept it, and it grows in your garden.']
];

const chips = (name, opts, on) => `<div class="rs-toggles" data-rs-wl="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${on.includes(v)}">${esc(l)}</button>`).join('')}</div>`;

/**
 * Open the welcome.
 *   person     who's signed in, as Bluesky has them (their face and name)
 *   save       writes the profile (see welcomeProfile), then the messages picked ({ updates,
 *              newAsks }); throws to say the profile wasn't written
 *   saved      after it's written, and the dialog has closed, with the messages picked
 *   error      what a failed save says, in plain words
 *   canFollow  whether this sign-in can follow @rainshare.dev for you; if not, it says to
 */
export function openWelcome({ person, save, saved = () => {}, error = e => e?.message || 'Something went wrong. Try again in a moment.', canFollow = true }){
  const did = person?.did;
  if (!did || document.querySelector('.rs-wl')) return;
  const st = { step: 'story', plans: [], runs: [], notify: welcomeMessages(), busy: false };
  const dlg = document.createElement('dialog');
  dlg.className = 'rs-wl';
  dlg.setAttribute('aria-labelledby', 'rsWlTitle');
  dlg.innerHTML = '<div class="rs rs-wl-box"></div>';
  const box = dlg.firstChild;
  document.body.append(dlg);
  avatarFallback(dlg);

  const top = (n, title) => `<div class="rs-wl-top"><p class="rs-wl-n">${n} of 2</p><button class="rs-wl-x" type="button" data-wl="skip" aria-label="Close">${ico('close')}</button></div>
    <h2 id="rsWlTitle" tabindex="-1">${title}</h2>`;
  const skip = '<button class="rs-link" type="button" data-wl="skip">Skip for now</button>';

  // (`dir`: 1 going on to the profile, -1 back to the story; the box slides between them.)
  function paint(dir = 0){
    if (st.step === 'story') {
      swapStep(box, `${top(1, lit('Welcome to Rainshare'))}
        <ol class="rs-wl-story">${STORY.map(([i, line, more]) => `<li><span class="rs-wl-ico">${i}</span><p><b>${lit(line)}</b>${lit(more)}</p></li>`).join('')}</ol>
        <button class="rs-btn rs-primary" type="button" data-wl="next">Set up your profile</button>
        <div class="rs-wl-foot"><span class="rs-muted">It takes a minute.</span>${skip}</div>`, dir);
      box.querySelector('[data-wl="next"]').focus();
      return;
    }
    swapStep(box, `${top(2, 'What do you code with?')}
      <div class="rs-wl-you">${face(person)}<span><b>${esc(nameOf(person))}</b><small>Your name and picture come from Bluesky.</small></span></div>
      <fieldset><legend>Your AI plan</legend><p class="rs-muted">Any you pay for to code with. It shows beside your asks.</p>${chips('plans', PLANS, st.plans)}</fieldset>
      <fieldset><legend>What you run</legend><p class="rs-muted">So “Send my agent” copies the right command.</p>${chips('runs', HARNESSES, st.runs)}</fieldset>
      <fieldset class="rs-wl-msgs"><legend>Messages from @${esc(HANDLE)}</legend>
        <p class="rs-muted">A direct message on Bluesky when there’s news. ${canFollow ? `Ticking either follows @${esc(HANDLE)} for you, since Bluesky only lets accounts you follow message you.` : `Bluesky only lets accounts you follow message you, so <a class="rs-link" href="https://bsky.app/profile/${esc(HANDLE)}" target="_blank" rel="noopener">follow @${esc(HANDLE)}</a> too.`} You can change them in Settings.</p>
        ${NOTIFY.map(([k, l]) => `<label class="rs-check"><input type="checkbox" name="${k}"${st.notify[k] ? ' checked' : ''}> ${esc(l)}</label>`).join('')}
      </fieldset>
      <p class="rs-err" role="alert" hidden></p>
      <button class="rs-btn rs-primary" type="button" data-wl="save">Save my profile</button>
      <div class="rs-wl-foot"><button class="rs-link" type="button" data-wl="back">${ico('back')}Back</button>${skip}</div>`, dir);
    box.querySelector('[data-rs-wl="plans"] button')?.focus();
  }
  const say = msg => { const p = box.querySelector('.rs-err'); if (p) { p.textContent = msg; p.hidden = !msg; } };

  async function submit(btn){
    if (st.busy) return;
    if (!st.plans.length && !st.runs.length) return say('Pick your AI plan or what you run, or skip this for now.');
    st.busy = true; btn.disabled = true; btn.textContent = 'Saving…'; say('');
    const notify = { ...st.notify };
    try { await save(welcomeProfile(st), notify); }
    catch (e) { st.busy = false; btn.disabled = false; btn.textContent = 'Save my profile'; say(error(e)); return; }
    closeSoftly(dlg);
    saved(notify);
  }

  dlg.addEventListener('click', e => {
    if (st.busy) return;
    // Outside the box is the same as "Skip for now".
    if (e.target === dlg) return closeSoftly(dlg);
    const b = e.target.closest('button'); if (!b) return;
    const group = b.closest('[data-rs-wl]');
    if (group) {
      const on = b.getAttribute('aria-pressed') !== 'true', list = st[group.dataset.rsWl];
      b.setAttribute('aria-pressed', String(on));
      if (on) list.push(b.dataset.v); else list.splice(list.indexOf(b.dataset.v), 1);
      // "No AI plan" and "Free tiers only" stand alone, and a paid plan clears them (as on your profile).
      if (on && group.dataset.rsWl === 'plans') {
        const unpaid = UNPAID.includes(b.dataset.v);
        st.plans = st.plans.filter(v => v === b.dataset.v || (!unpaid && !UNPAID.includes(v)));
        group.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(st.plans.includes(x.dataset.v))));
      }
      say('');
      return;
    }
    const act = b.dataset.wl;
    if (act === 'skip') closeSoftly(dlg);
    else if (act === 'next') { st.step = 'basics'; paint(1); }
    else if (act === 'back') { st.step = 'story'; paint(-1); }
    else if (act === 'save') submit(b);
  });
  // The messages' boxes, kept as they're ticked, so going back to the story and on again keeps them.
  dlg.addEventListener('change', e => { const t = e.target; if (t?.type === 'checkbox' && t.closest('.rs-wl-msgs') && t.name in st.notify) st.notify[t.name] = t.checked; });
  // Escape, the ✕, "Skip for now" or a click outside: it's been seen, and won't come back on this browser.
  dlg.addEventListener('cancel', e => { if (!e.cancelable) return; e.preventDefault(); if (!st.busy) closeSoftly(dlg); });
  dlg.addEventListener('close', () => { markSeen(did); dlg.remove(); });

  paint();
  dlg.showModal();
  box.querySelector('[data-wl="next"]')?.focus();
}
