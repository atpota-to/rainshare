// The landing's garden, on the page: your cloud to take hold of, a label under each friend's
// plot, and a line under it all that says what's happening.
//
// The cloud is your AI plan. Drag it along the row (or pick a plot, by its label or anywhere
// on it) and it rains there: that's your agent, sent after a friend's idea or project. When
// the work's done the plant is a stage further on. Leave the cloud where it is and the plan
// resets all the same: what was left in it is gone, and a full one takes its place.
//
// The scene itself is three.js (./garden-scene.js), so it's fetched only when the landing is
// on screen. If the browser can't draw it, a flat drawing takes its place, with the same
// story set out under it in three short notes.
import { PLOTS, FRIEND, GARDEN_PATH } from './plots.js';

const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const SPARK = '<svg class="rd-spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.3 7.2 7.2 2.3-7.2 2.3-2.3 7.2-2.3-7.2L2.5 12l7.2-2.3z"/></svg>';
const HINT = 'Drag your cloud over a friend’s idea or project.';
const whose = p => `${p.name}’s ${p.noun}`;

/** Put the garden's labels in the landing's figure. What comes back is what ./landing.js drives a scene with. */
export function mount(figure){
  const view = $('#sceneView', figure), layer = $('.rd-pins', view), hint = $('#sceneHint', figure), note = $('#sceneNote', figure);
  const title = $('h2', note), text = $('p', note), link = $('a', note), again = $('#sceneAgain', figure);
  layer.innerHTML = PLOTS.map((p, i) => `<button type="button" class="rd-pin rd-plot${p.theirs ? ' theirs' : ''}" data-plot="${i}"><i style="--c:${esc(p.color)}">${esc(p.name[0])}</i><span>${esc(p.name)}</span>${SPARK}</button>`).join('')
    + `<span class="rd-pin rd-friend"><i style="--c:${esc(FRIEND.color)}">${esc(FRIEND.name[0])}</i><span>${esc(FRIEND.name)}’s plan</span></span>`
    + `<div class="rd-cloud" id="sceneCloud"><span class="rd-pin rd-plan"><svg class="rd-ring" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><circle class="left" cx="10" cy="10" r="7.5" pathLength="100"/></svg><span><b>Your AI plan</b><small>Resets in 2 days</small></span></span></div>`;
  const pins = $$('.rd-plot', layer), friendTag = $('.rd-friend', layer), cloud = $('#sceneCloud', layer), plan = $('.rd-plan', cloud), ring = $('.rd-ring', cloud), resets = $('small', cloud);

  // Under 880px the scene has the page's width to itself, and its line of words under it (./landing.css).
  const stacked = matchMedia('(max-width:880px)');
  stacked.addEventListener('change', () => scene?.setClose(stacked.matches));
  let scene = null, shown = -1, toastTimer = 0, doneTimer = 0;
  const state = PLOTS.map(() => 'open');            // 'open', 'rain' (your cloud's on it) or 'done'
  const label = (p, i) => state[i] === 'done' ? `${whose(p)}, done: ${p.title}` : p.theirs ? `${whose(p)}, with ${FRIEND.name}’s agent on it: ${p.title}` : `Send your cloud to ${whose(p)}: ${p.title}`;
  function mark(){
    pins.forEach((b, i) => { b.classList.toggle('on', state[i] === 'rain'); b.classList.toggle('done', state[i] === 'done'); b.setAttribute('aria-label', label(PLOTS[i], i)); });
  }

  /* the line under the scene: a hint, or what's happening on one plot, or all of it done */
  function say(i){
    shown = i; clearTimeout(toastTimer);
    hint.hidden = i >= 0 || i === -2; note.hidden = !hint.hidden; again.hidden = i !== -2;
    if (i === -1) { hint.textContent = HINT; return; }
    if (i === -2) {
      title.textContent = 'That’s a garden';
      text.textContent = 'Three things your friends wanted, done with rain you’d have lost.';
      link.textContent = 'See yours'; link.setAttribute('href', GARDEN_PATH);
      return;
    }
    const p = PLOTS[i], done = state[i] === 'done';
    title.textContent = p.title;
    text.textContent = p.theirs
      ? (done ? `Done. ${FRIEND.name}’s agent did it, on ${FRIEND.name}’s plan.` : `${FRIEND.name}’s agent is on it, on ${FRIEND.name}’s plan.`)
      : (done ? 'Done. It’s a stage further on, and in your garden.' : 'Your agent’s on it, on your plan. That’s the rain.');
    link.textContent = `See ${whose(p)}`; link.setAttribute('href', p.path);
  }
  // Something to say for a moment, before going back to what was there.
  function toast(words){
    const back = shown;
    hint.textContent = words; hint.hidden = false; note.hidden = true;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => say(back), 5200);
  }
  const allDone = () => state.every((s, i) => PLOTS[i].theirs || s === 'done');

  function onEvent(what, n){
    if (what === 'rain') { state[n] = 'rain'; say(n); }
    else if (what === 'dry') { state.forEach((s, i) => { if (s === 'rain') state[i] = 'open'; }); if (shown >= 0 && state[shown] === 'open' && !PLOTS[shown].theirs) say(-1); }
    else if (what === 'done') {
      state[n] = 'done';
      // The friend's plot being done doesn't interrupt what you're doing, unless it's what's being read.
      if (!PLOTS[n].theirs || shown === n) say(n);
      clearTimeout(doneTimer);
      if (allDone()) doneTimer = setTimeout(() => { if (allDone()) say(-2); }, 4200);
    }
    else if (what === 'reset') toast(n > .1 ? 'Your plan reset. The rain you didn’t use is gone.' : 'Your plan reset. There’s rain again.');
    mark();
  }

  // Each drawn frame: put the labels where their places in the scene are, and the handle over the cloud.
  // Nothing here may reach past the scene's edge: a label out there would make the page wider
  // (./landing.css clips the layer they're in, too).
  let ringAt = -1, wordsAt = '', size = '', planHalf = 0, planAt = 0;
  function onFrame(at){
    pins.forEach((b, i) => { b.style.transform = `translate(${at.plots[i * 2].toFixed(1)}px,${at.plots[i * 2 + 1].toFixed(1)}px) translateX(-50%)`; });
    friendTag.style.transform = `translate(${at.friend[0].toFixed(1)}px,${at.friend[1].toFixed(1)}px) translate(-50%,-100%)`;
    // the friend's name gives way while your cloud is passing in front of theirs
    const before = Math.abs(at.friend[0] - at.cloud[0]) < at.cloud[2] / 2 + 36 && Math.abs(at.friend[1] - 12 - at.cloud[1]) < at.cloud[3] / 2 + 14;
    friendTag.style.opacity = before ? '0' : at.friend[2].toFixed(2);
    friendTag.hidden = at.friend[2] <= 0;        // their cloud has gone, and its name with it
    cloud.style.transform = `translate(${at.cloud[0].toFixed(1)}px,${at.cloud[1].toFixed(1)}px)`;
    const box = `${Math.round(at.cloud[2])}px ${Math.round(at.cloud[3])}px`;
    if (box !== size) { size = box; cloud.style.width = Math.round(at.cloud[2]) + 'px'; cloud.style.height = Math.round(at.cloud[3]) + 'px'; }
    const left = Math.round(at.left * 100);
    if (left !== ringAt) { ringAt = left; ring.style.setProperty('--left', left); }
    const days = Math.ceil(at.left * 3), words = at.fresh ? 'Just reset' : days > 1 ? `Resets in ${days} days` : 'Resets tomorrow';
    if (words !== wordsAt) { wordsAt = words; resets.textContent = words; planHalf = plan.offsetWidth / 2; }
    // what the cloud is stays wholly in the scene, however near an edge the cloud itself is
    const shift = Math.round(Math.min(Math.max(at.cloud[0], planHalf + 6), at.width - planHalf - 6) - at.cloud[0]);
    if (shift !== planAt) { planAt = shift; plan.style.translate = 'calc(-50% + ' + shift + 'px) 0'; }
  }

  /* picking a plot: its label, or anywhere on it in the scene */
  function pick(i){
    if (!scene || i < 0) return;
    if (state[i] === 'open' && !PLOTS[i].theirs) scene.sendTo(i);
    else say(i);
  }
  pins.forEach((b, i) => b.addEventListener('click', e => { e.stopPropagation(); pick(i); }));
  const across = e => e.clientX - view.getBoundingClientRect().left;
  let dragged = false;
  view.addEventListener('click', e => {
    if (dragged) { dragged = false; return; }       // letting go of the cloud isn't a pick
    const r = view.getBoundingClientRect();
    if (scene) pick(scene.plotAt(e.clientX - r.left, e.clientY - r.top));
  });
  /* taking hold of the cloud */
  cloud.addEventListener('pointerdown', e => {
    if (!scene || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    cloud.setPointerCapture(e.pointerId); figure.classList.add('held'); dragged = false;
    scene.grab(across(e));
  });
  cloud.addEventListener('pointermove', e => { if (cloud.hasPointerCapture(e.pointerId)) { dragged = true; scene.dragTo(across(e)); } });
  const letGo = e => { if (!cloud.hasPointerCapture(e.pointerId)) return; cloud.releasePointerCapture(e.pointerId); figure.classList.remove('held'); scene.drop(); setTimeout(() => { dragged = false; }); };
  cloud.addEventListener('pointerup', letGo); cloud.addEventListener('pointercancel', letGo);
  cloud.addEventListener('click', e => e.stopPropagation());
  view.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !scene) return;
    const r = view.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    scene.setPointer(x / r.width * 2 - 1, y / r.height * 2 - 1);
    // a plot your cloud could go to shows it can be picked
    const i = e.target === view || e.target.tagName === 'CANVAS' ? scene.plotAt(x, y) : -1;
    view.style.cursor = i >= 0 && state[i] === 'open' && !PLOTS[i].theirs ? 'pointer' : '';
  });
  view.addEventListener('pointerleave', () => scene?.setPointer(0, 0));
  again.addEventListener('click', () => { clearTimeout(doneTimer); state.fill('open'); mark(); say(-1); scene?.again(); });
  mark();

  return {
    async load({ dark }){
      const { createGarden } = await import('./garden-scene.js');
      scene = createGarden($('canvas', view), { dark, close: stacked.matches, plots: PLOTS, onFrame, onEvent });
    },
    setRunning(on){ scene?.setRunning(on); },
    setDark(on){ scene?.setDark(on); },
    escape(){ if (shown !== -1 && shown !== -2) say(-1); }
  };
}
