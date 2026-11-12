// Signing in on rainshare.dev, a step at a time, so the page your server shows isn't a surprise:
//
//   who   your handle. Accounts that match are offered as you type (Bluesky's typeahead), and
//         a handle nobody offered is still taken as typed.
//   you   "Is this you?": the account's face and name, what Rainshare asks for (posting to
//         Tangled and knotless is yours to untick, and to add later where it's needed), and a
//         button that names the site you're about to be sent to: the one your account's own
//         server signs people in on.
//
// The landing's handle field is the first step, already on the page; anywhere else the dialog
// starts with it. Adding a forge to a sign-in you already have ("Connect Tangled") is the
// second step on its own. The signing in itself is your server's (./oauth.js).
import './signin.css';
import * as oauth from './oauth.js';
import { FORGES } from './scope.js';
import { GROUPS } from '../core/ns.js';
import { suggestPeople, profiles, isHandle, isDid, normalizeHandle } from '../core/net.js';
import { esc, face, ico, avatarFallback } from '../ui/bits.js';

// What's asked for, as it's said beside each tick box. Your server words the same list its own
// way on the page it shows.
const OWN = `Your asks, what you take on and your profile${GROUPS ? ', and your groups’ private asks' : ''}, kept in your own account.`;
const ASKS = {
  tangled: ['Tangled', 'Issues, comments, pull requests and vouches, only when you say so.'],
  knotless: ['knotless', 'Issues, comments and pull requests, only when you say so.']
};
const OFFERED = Object.keys(ASKS).filter(f => FORGES.includes(f));
const OUT = '<svg class="rs-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8.5 8.5M11 6H7.5A2.5 2.5 0 0 0 5 8.5v8A2.5 2.5 0 0 0 7.5 19h8a2.5 2.5 0 0 0 2.5-2.5V13"/></svg>';

// A forge someone unticked stays unticked the next time they sign in on this browser.
const SKIP = 'rs:signin-skip';
const skipped = () => { try { const v = JSON.parse(localStorage.getItem(SKIP)); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
const setSkipped = v => { try { v.length ? localStorage.setItem(SKIP, JSON.stringify(v)) : localStorage.removeItem(SKIP); } catch (_) {} };

/* ---------- accounts offered as a handle is typed ---------- */
let lists = 0;
// `anchor` is where the list goes. `overlay` says it floats over the page under the field (the
// landing), so it's put away when the field is left; in the dialog it's part of the layout, and
// stays, so nothing moves under a pointer on its way to the button.
function suggest(input, { anchor, overlay = false, pick }){
  const list = document.createElement('ul'), id = 'siList' + (++lists);
  list.className = 'si-list'; list.id = id; list.hidden = true;
  list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Accounts that match');
  anchor.append(list);
  avatarFallback(list);
  for (const [k, v] of Object.entries({ role: 'combobox', 'aria-autocomplete': 'list', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-controls': id })) input.setAttribute(k, v);
  let found = [], on = -1, asked = 0, timer = 0;
  const mark = i => {
    on = i;
    [...list.children].forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
    if (i >= 0) input.setAttribute('aria-activedescendant', `${id}-${i}`); else input.removeAttribute('aria-activedescendant');
  };
  const show = yes => { list.hidden = !yes; input.setAttribute('aria-expanded', String(yes)); if (!yes) mark(-1); };
  const draw = () => {
    list.innerHTML = found.map((p, i) => `<li role="option" id="${id}-${i}" data-i="${i}" aria-selected="false">${face(p)}<span class="si-who"><b>${esc(p.displayName || p.handle)}</b><span>@${esc(p.handle)}</span></span></li>`).join('');
    on = -1; show(found.length > 0);
  };
  const look = async () => {
    const n = ++asked;
    let got = [];
    try { got = await suggestPeople(input.value); } catch (_) { /* a whole handle, typed out, still works */ }
    if (n !== asked) return;
    found = got; draw();
  };
  const choose = i => { const p = found[i]; if (!p) return; clearTimeout(timer); asked++; input.value = p.handle; show(false); pick(p); };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    if (normalizeHandle(input.value).length < 2) { asked++; found = []; draw(); return; }
    timer = setTimeout(look, 140);
  });
  input.addEventListener('keydown', e => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && found.length) {
      e.preventDefault();
      if (list.hidden) show(true);
      // Round the list and back to what was typed, which is one more place to be.
      const n = found.length + 1;
      mark(((on + 1 + (e.key === 'ArrowDown' ? 1 : -1)) % n + n) % n - 1);
    } else if (e.key === 'Enter' && on >= 0 && !list.hidden) { e.preventDefault(); choose(on); }
    else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); e.stopPropagation(); show(false); }
  });
  if (overlay) input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) show(false); }, 160));
  // The field keeps the focus while an account is picked with a pointer.
  list.addEventListener('mousedown', e => e.preventDefault());
  list.addEventListener('pointermove', e => { const li = e.target.closest('li[data-i]'); if (li && +li.dataset.i !== on) mark(+li.dataset.i); });
  list.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) choose(+li.dataset.i); });
  return {
    /** The offered account with exactly this handle, if there is one. */
    known: handle => found.find(p => p.handle === handle) || null,
    any: () => found.length > 0,
    open: () => !list.hidden,
    close: () => show(false)
  };
}

// One handle field, wherever it is: accounts are offered as it's typed, and what's typed is
// checked before it's taken. `then(who, person)` gets a handle or a DID, and the account itself
// when it was one of those offered.
function handleField(form, { err, anchor, overlay, then }){
  const input = form.elements.handle;
  const say = msg => { err.textContent = msg; err.hidden = !msg; };
  const offer = suggest(input, { anchor, overlay, pick: p => { say(''); then(p.handle, p); } });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const typed = normalizeHandle(input.value);
    if (!typed) { input.focus(); return; }
    if (!isHandle(typed) && !isDid(typed)) {
      say(offer.any() ? 'Pick your account from the list, or type your whole handle, like you.bsky.social.' : 'Type your whole handle, like you.bsky.social.');
      input.focus();
      return;
    }
    say(''); offer.close();
    then(typed, offer.known(typed));
  });
  input.addEventListener('focus', oauth.warm, { once: true });
  return offer;
}

/* ---------- the dialog ---------- */
let dlg = null, box = null, st = null;

function ensure(){
  if (dlg) return;
  dlg = document.createElement('dialog');
  dlg.className = 'si';
  dlg.setAttribute('aria-labelledby', 'siTitle');
  dlg.innerHTML = '<div class="si-box"></div>';
  box = dlg.firstChild;
  document.body.append(dlg);
  avatarFallback(dlg);
  // Outside the box closes it, when the press started out there too (not a drag out of a field).
  let downOn = null;
  dlg.addEventListener('mousedown', e => { downOn = e.target; });
  dlg.addEventListener('click', e => {
    if ((e.target === dlg && downOn === dlg) || e.target.closest('[data-si-close]')) return dlg.close();
    if (e.target.closest('[data-si-back]')) return ask();
    if (e.target.closest('[data-si-go]')) return go();
  });
  // What's ticked stays ticked, and what isn't stays out, through "Not you?" and back.
  dlg.addEventListener('change', e => { if (st && e.target.name === 'forge') st.want[e.target.checked ? 'add' : 'delete'](e.target.value); });
  // Escape puts the list of accounts away first, and closes the dialog the next time.
  dlg.addEventListener('cancel', e => { if (st?.offer?.open()) { e.preventDefault(); st.offer.close(); } });
  dlg.addEventListener('close', () => { st = null; box.innerHTML = ''; });
  // Back from your server with the browser's Back button: the button is yours to press again.
  addEventListener('pageshow', e => { if (e.persisted && st?.busy) { st.busy = false; paintGo(); } });
}
const head = title => `<header class="si-head"><h2 id="siTitle">${esc(title)}</h2><button class="si-x" type="button" data-si-close aria-label="Close">${ico('close')}</button></header>`;
const say = msg => { const p = box.querySelector('.si-err'); if (p) { p.textContent = msg; p.hidden = !msg; } };
const invalid = h => !isHandle(h) || /\.invalid$/.test(h);
function card(p){
  const handle = invalid(p.handle) ? null : p.handle;
  return `${face({ ...p, handle })}<span class="si-who"><b>${esc(p.displayName || handle || 'Your account')}</b><span>${esc(handle ? '@' + handle : p.did || '')}</span></span>`;
}

/**
 * Open the sign-in dialog.
 *   handle, person  who's signing in, when that's known: it starts at "Is this you?"
 *   to              the path to come back to
 *   forges          which forges start ticked: all of them, less any unticked last time
 *   adding          a forge being added to the sign-in `person` already has
 */
export function openSignIn({ handle = '', person = null, to = '/', forges = null, adding = null } = {}){
  ensure();
  const out = skipped();
  st = { to, adding, want: new Set(forges || FORGES.filter(f => !out.includes(f))), turn: 0, who: null, person: null, did: null, host: null, busy: false, failed: false, offer: null };
  const who = person?.did || normalizeHandle(handle);
  if (who) confirm(who, person); else ask();
  if (!dlg.open) dlg.showModal();
  focusStep();
}
const focusStep = () => (box.querySelector('input[name="handle"]') || box.querySelector('[data-si-go]'))?.focus();

// The first step: who's signing in.
function ask(msg = '', typed = ''){
  Object.assign(st, { turn: st.turn + 1, did: null, host: null, busy: false, failed: false });
  box.innerHTML = `<form class="si-step" novalidate>
      ${head('Sign in to Rainshare')}
      <p class="si-lede">Use your handle from Bluesky, Tangled or any Atmosphere app.</p>
      <input class="si-input" name="handle" placeholder="you.bsky.social" value="${esc(typed)}" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="url" enterkeyhint="go" aria-label="Your handle">
      <div class="si-offer"></div>
      <p class="si-err" role="alert"${msg ? '' : ' hidden'}>${esc(msg)}</p>
      <button class="si-go" type="submit">Continue</button>
      <p class="si-small">Rainshare never sees your password.</p>
    </form>`;
  const form = box.firstElementChild;
  st.offer = handleField(form, { err: form.querySelector('.si-err'), anchor: form.querySelector('.si-offer'), then: confirm });
  focusStep();
  form.elements.handle.select();
}

// The second step: the account, what's asked for, and where it's about to send you.
function confirm(who, person = null){
  Object.assign(st, { turn: st.turn + 1, who, person, did: null, host: null, busy: false, failed: false, offer: null });
  const adding = st.adding;
  box.innerHTML = `<div class="si-step">
      ${head(adding ? `Connect ${ASKS[adding]?.[0] || adding}` : 'Is this you?')}
      <div class="si-card">${card(person || (isDid(who) ? { did: who } : { handle: who }))}</div>
      <fieldset class="si-asks">
        <legend>What Rainshare asks for</legend>
        <label class="si-ask"><input type="checkbox" checked disabled><span><b>Your Rainshare records <i>(required)</i></b><small>${esc(OWN)}</small></span></label>
        ${OFFERED.map(f => `<label class="si-ask"><input type="checkbox" name="forge" value="${f}"${st.want.has(f) ? ' checked' : ''}><span><b>Post to ${esc(ASKS[f][0])}</b><small>${esc(ASKS[f][1])}</small></span></label>`).join('')}
      </fieldset>
      <p class="si-err" role="alert" hidden></p>
      <button class="si-go" type="button" data-si-go></button>
      <p class="si-next" aria-live="polite"></p>
      <p class="si-foot">${adding ? '<button class="si-link" type="button" data-si-close>Not now</button>' : '<button class="si-link" type="button" data-si-back>Not you?</button>'}<span>Rainshare never sees your password.</span></p>
    </div>`;
  paintGo();
  focusStep();
  find(st.turn);
}
// The button says where it leads once that's known, and the line under it says what happens there.
function paintGo(){
  const b = box.querySelector('[data-si-go]'), next = box.querySelector('.si-next');
  if (!b || !st) return;
  const host = st.host, wait = st.busy || (!host && !st.failed);
  b.setAttribute('aria-disabled', String(wait));
  b.innerHTML = st.failed ? 'Try again' : !host ? 'Finding where you sign in…' : st.busy ? `Opening ${esc(host)}…` : `<span>Continue at ${esc(host)}</span>${OUT}`;
  next.innerHTML = !host ? '' : st.adding ? `You’ll approve this at <b>${esc(host)}</b>, where your account lives, then come back to what you wrote.`
    : `You’ll sign in at <b>${esc(host)}</b>, where your account lives, then come straight back.`;
}
async function find(turn){
  const mine = st, live = () => st === mine && st.turn === turn;
  try {
    const at = await oauth.whereTo(mine.who);
    if (!live()) return;
    mine.did = at.did; mine.host = at.host;
    paintGo();
    // The account is the one the network has for what was typed, whatever was offered for it.
    let p = mine.person?.did === at.did ? mine.person : null;
    if (!p) { p = (await profiles([at.did]).catch(() => new Map())).get(at.did) || { did: at.did }; if (!live()) return; }
    const shown = { ...p, handle: at.handle || p.handle };
    if (p !== mine.person || shown.handle !== p.handle) box.querySelector('.si-card').innerHTML = card(shown);
  } catch (e) {
    if (!live()) return;
    console.warn('sign-in', e);
    if (e?.name === 'NoSuchAccount' && !mine.adding) return ask(`We couldn’t find ${isDid(mine.who) ? 'that account' : '@' + mine.who}. Check the spelling.`, mine.who);
    mine.failed = true;
    say('We couldn’t reach the server that signs this account in. Try again in a moment.');
    paintGo();
  }
}
async function go(){
  const mine = st;
  if (!mine || mine.busy) return;
  if (mine.failed) { mine.failed = false; say(''); paintGo(); return find(++mine.turn); }
  if (!mine.host) return;
  const forges = [...box.querySelectorAll('input[name="forge"]:checked')].map(i => i.value);
  setSkipped(FORGES.filter(f => !forges.includes(f)));
  mine.busy = true; say(''); paintGo();
  try { await oauth.signIn(mine.did, mine.to, { forges }); }
  catch (e) {
    if (st !== mine) return;
    mine.busy = false; paintGo();
    // Coming back with the browser's Back button ends the wait, and nothing went wrong.
    if (/navigated back/i.test(String(e?.message))) return;
    console.warn('sign-in', e);
    say(`${mine.host} didn’t let us start signing in. Try again in a moment.`);
  }
}

/** The landing's own handle field: the first step, already on the page. */
export function landingSignIn(form, err){
  handleField(form, { err, anchor: form, overlay: true, then: (who, person) => openSignIn({ handle: who, person, to: '/' }) });
}
