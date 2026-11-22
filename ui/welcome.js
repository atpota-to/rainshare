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
//
// Someone who was past it before it asked about messages (or made their profile on its own
// page, without it) is asked that on its own, on their next visit: see openMessages.
import { PLANS, UNPAID, HARNESSES, NOTIFY, HANDLE, MODERATOR, messagesOf } from '../core/ns.js';
import { esc, lit, ico, skyIco, lifeIco, face, nameOf, avatarFallback } from './bits.js';
import { closeSoftly, swapStep } from './motion.js';

const SEEN = did => 'rs:welcomed:' + did;
const seen = did => { try { return localStorage.getItem(SEEN(did)) === '1'; } catch (_) { return false; } };
const markSeen = did => { try { localStorage.setItem(SEEN(did), '1'); } catch (_) {} };
// Whether they've been asked about messages on this browser: in the welcome, or on its own.
// (Storage that can't be read counts as asked: it couldn't remember the answer, so they'd be
// asked on every visit. Settings has them all the same.)
const ASKED = did => 'rs:messages-asked:' + did;
const asked = did => { try { return localStorage.getItem(ASKED(did)) === '1'; } catch (_) { return true; } };
const markAsked = did => { try { localStorage.setItem(ASKED(did), '1'); } catch (_) {} };

/**
 * Whether to welcome whoever's signed in. `mine` is their profile as the source read it, and
 * `sub` the screen they're on: on their profile's own page, they're already setting it up.
 */
export function shouldWelcome({ source, mine, sub = '' }){
  if (!source?.signedIn || source.demo || !source.viewer) return false;
  if (!mine || mine.merged || mine.unread) return false;
  return sub !== 'me' && !seen(source.viewer);
}

/** The profile the welcome saves: the plans picked and any written in (commas between), and a setup for each thing they run. */
export const welcomeProfile = ({ plans = [], other = '', runs = [] } = {}) => ({ plans: [...plans, ...String(other).split(',').map(s => s.trim()).filter(Boolean)], setups: runs.map(harness => ({ harness, models: [] })) });
/** The messages the welcome starts with: every kind, ticked. */
export const welcomeMessages = () => Object.fromEntries(NOTIFY.map(([k]) => [k, true]));
/** Whether a choice of messages switches any on. (New asks of neither kind, projects or ideas, are none.) */
export const anyMessages = notify => { const m = messagesOf(notify); return m.updates || m.newAsks; };

/**
 * Whether to ask whoever's signed in about messages from @rainshare.dev, on their own. It's for
 * someone past the welcome (a profile, or the welcome seen on this browser) with none switched
 * on, once per account on a browser. Anyone with the welcome still to come is asked there.
 *   prefs        their settings as read, or null with none
 *   prefsUnread  their settings couldn't be read: they may well have messages on
 */
export function shouldAskMessages({ source, mine, prefs, prefsUnread = false, sub = '' }){
  const did = source?.viewer;
  if (!source?.signedIn || source.demo || !did || did === MODERATOR) return false;
  if (!mine || mine.unread || !(mine.merged || seen(did))) return false;
  if (prefsUnread || anyMessages(prefs?.notify)) return false;
  return sub !== 'settings' && !asked(did);
}

// The messages, as the welcome and openMessages both ask about them: a box for each, and how
// they reach you, since Bluesky only lets accounts you follow message you.
const messageBoxes = notify => NOTIFY.map(([k, l]) => `<label class="rs-check"><input type="checkbox" name="${k}"${notify[k] ? ' checked' : ''}> ${esc(l)}</label>`).join('');
const reachLine = canFollow => canFollow
  ? `Ticking either follows @${esc(HANDLE)} for you, since Bluesky only lets accounts you follow message you.`
  : `Bluesky only lets accounts you follow message you, so <a class="rs-link" href="https://bsky.app/profile/${esc(HANDLE)}" target="_blank" rel="noopener">follow @${esc(HANDLE)}</a> too.`;

// What Rainshare is, as briefly as it can be said, in the same three steps as the landing.
// [icon, the step, what it means for you]
const STORY = [
  [lifeIco('up'), 'People post ideas and projects they’d like help with.', 'You can post your own with “Ask for help”.'],
  [skyIco('showers'), 'Pick one and direct your agent, on your own plan.', 'It gets their ask in their own words, with safety rules from Rainshare around it. Read it before you start.'],
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
  const st = { step: 'story', plans: [], other: '', runs: [], notify: welcomeMessages(), busy: false };
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
      <fieldset><legend>Your AI plan</legend><p class="rs-muted">Any you pay for to code with. It shows beside your asks.</p>${chips('plans', PLANS, st.plans)}
        <label class="rs-inline">Or another <input name="otherPlan" maxlength="120" autocomplete="off" placeholder="Kimi Code" value="${esc(st.other)}"></label></fieldset>
      <fieldset><legend>What you run</legend><p class="rs-muted">So “Direct my agent” copies the right command.</p>${chips('runs', HARNESSES, st.runs)}</fieldset>
      <fieldset class="rs-wl-msgs"><legend>Messages from @${esc(HANDLE)}</legend>
        <p class="rs-muted">A direct message on Bluesky when there’s news. ${reachLine(canFollow)} You can change them in Settings.</p>
        ${messageBoxes(st.notify)}
      </fieldset>
      <p class="rs-err" role="alert" hidden></p>
      <button class="rs-btn rs-primary" type="button" data-wl="save">Save my profile</button>
      <div class="rs-wl-foot"><button class="rs-link" type="button" data-wl="back">${ico('back')}Back</button>${skip}</div>`, dir);
    box.querySelector('[data-rs-wl="plans"] button')?.focus();
  }
  const say = msg => { const p = box.querySelector('.rs-err'); if (p) { p.textContent = msg; p.hidden = !msg; } };

  async function submit(btn){
    if (st.busy) return;
    if (!st.plans.length && !st.other.trim() && !st.runs.length) return say('Pick your AI plan or what you run, or skip this for now.');
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
        if (unpaid) { st.other = ''; const o = box.querySelector('[name="otherPlan"]'); if (o) o.value = ''; }
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
  // A plan written in is kept as it's typed, and it's a paid one, so it clears "No AI plan" and "Free tiers only".
  dlg.addEventListener('input', e => {
    const t = e.target;
    if (t?.name !== 'otherPlan') return;
    st.other = t.value; say('');
    if (!t.value.trim() || !st.plans.some(v => UNPAID.includes(v))) return;
    st.plans = st.plans.filter(v => !UNPAID.includes(v));
    box.querySelectorAll('[data-rs-wl="plans"] button').forEach(x => x.setAttribute('aria-pressed', String(st.plans.includes(x.dataset.v))));
  });
  // The messages' boxes, kept as they're ticked, so going back to the story and on again keeps them.
  dlg.addEventListener('change', e => { const t = e.target; if (t?.type === 'checkbox' && t.closest('.rs-wl-msgs') && t.name in st.notify) st.notify[t.name] = t.checked; });
  // Escape, the ✕, "Skip for now" or a click outside: it's been seen, and won't come back on this
  // browser. Nor will the messages, on their own: it asked about them.
  dlg.addEventListener('cancel', e => { if (!e.cancelable) return; e.preventDefault(); if (!st.busy) closeSoftly(dlg); });
  dlg.addEventListener('close', () => { markSeen(did); markAsked(did); dlg.remove(); });

  paint();
  dlg.showModal();
  box.querySelector('[data-wl="next"]')?.focus();
}

/**
 * Ask about messages from @rainshare.dev on their own (see shouldAskMessages), with both kinds
 * ticked to begin with, as in the welcome. "Turn them on" saves what's ticked; "No thanks", the
 * ✕, Escape or a click outside switches nothing on. Either way it's not asked again on this browser.
 *   did        who's signed in
 *   save       switches on the messages picked ({ updates, newAsks }), following @rainshare.dev;
 *              throws to say they weren't saved
 *   saved      after they're saved, and the dialog has closed, with the messages picked
 *   error      what a failed save says, in plain words
 *   canFollow  whether this sign-in can follow @rainshare.dev for you; if not, it says to
 */
export function openMessages({ did, save, saved = () => {}, error = e => e?.message || 'Something went wrong. Try again in a moment.', canFollow = true }){
  if (!did || document.querySelector('dialog[open]')) return;
  const notify = welcomeMessages();
  let busy = false;
  const dlg = document.createElement('dialog');
  dlg.className = 'rs-wl rs-dm';
  dlg.setAttribute('aria-labelledby', 'rsDmTitle');
  dlg.innerHTML = `<div class="rs rs-wl-box">
    <div class="rs-wl-top"><p class="rs-wl-n">New</p><button class="rs-wl-x" type="button" data-dm="no" aria-label="Close">${ico('close')}</button></div>
    <h2 id="rsDmTitle" tabindex="-1">Messages from @${esc(HANDLE)}</h2>
    <p class="rs-muted">Rainshare’s Bluesky account can now send you a direct message when there’s news on your asks and your work, and once a day with new asks. Nothing’s sent until you turn them on.</p>
    <fieldset class="rs-wl-msgs"><legend>What you’d like</legend>
      ${messageBoxes(notify)}
      <p class="rs-muted">${reachLine(canFollow)}</p>
    </fieldset>
    <p class="rs-err" role="alert" hidden></p>
    <button class="rs-btn rs-primary" type="button" data-dm="save">Turn them on</button>
    <div class="rs-wl-foot"><span class="rs-muted">You can change them in Settings.</span><button class="rs-link" type="button" data-dm="no">No thanks</button></div>
  </div>`;
  const box = dlg.firstChild, go = box.querySelector('[data-dm="save"]');
  const say = msg => { const p = box.querySelector('.rs-err'); p.textContent = msg; p.hidden = !msg; };
  document.body.append(dlg);

  async function submit(){
    if (busy || !anyMessages(notify)) return;
    busy = true; go.disabled = true; go.textContent = 'Turning them on…'; say('');
    const picked = { ...notify };
    try { await save(picked); }
    catch (e) { busy = false; go.disabled = false; go.textContent = 'Turn them on'; say(error(e)); return; }
    closeSoftly(dlg);
    saved(picked);
  }
  dlg.addEventListener('click', e => {
    if (busy) return;
    // Outside the box is the same as "No thanks".
    if (e.target === dlg) return closeSoftly(dlg);
    const b = e.target.closest('[data-dm]'); if (!b) return;
    if (b.dataset.dm === 'no') closeSoftly(dlg);
    else if (b.dataset.dm === 'save') submit();
  });
  // With nothing ticked there's nothing to turn on: "No thanks" is the way out.
  dlg.addEventListener('change', e => {
    const t = e.target;
    if (t?.type !== 'checkbox' || !(t.name in notify)) return;
    notify[t.name] = t.checked; go.disabled = !anyMessages(notify); say('');
  });
  dlg.addEventListener('cancel', e => { if (!e.cancelable) return; e.preventDefault(); if (!busy) closeSoftly(dlg); });
  dlg.addEventListener('close', () => { markAsked(did); dlg.remove(); });

  dlg.showModal();
  box.querySelector('h2').focus();
}
