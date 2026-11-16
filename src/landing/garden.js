// The landing's garden, on the page: your cloud to take hold of, a label under each person's
// plot, and a line under it all that says what's happening.
//
// The cloud is your AI plan. Drag it along the row (or pick a plot, by its label or anywhere
// on it) and it rains there: that's your agent, sent to work on someone's idea or project. When
// the work's done the plant is a stage further on. Leave the cloud where it is and the plan
// resets all the same: what was left in it is gone, and a full one takes its place.
//
// The scene is the landing's whole backdrop (./landing.css): its sky runs behind the bar and
// the pitch, and the figure is the part of it kept clear for the garden. This file tells the
// scene where that is. As the page is scrolled the garden doesn't keep up with it: it sinks
// into the meadow left between it and the line of words under it, the hills behind it sink
// less, and the sky not at all. On a touchscreen the whole backdrop sinks together instead,
// so it can keep up with a finger (see scroll(), below).
//
// The scene itself is three.js (./garden-scene.js), so it's fetched only when the landing is
// on screen. Until it's there, a still of it is (./still/, taken by scripts/still.mjs), scaled
// and moved to just where the scene will draw the garden, with the scene fading in over it.
// If the browser can't draw the scene, the still stays, with its labels where they'd be but
// nothing to take hold of, and the story set out under it in three short notes.
import { PLOTS, FRIEND } from './plots.js';
import { fit } from './fit.js';
import { STILLS } from './still/still.js';
import { isNight } from '../mode.js';

const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const SPARK = '<svg class="rd-spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.3 7.2 7.2 2.3-7.2 2.3-2.3 7.2-2.3-7.2L2.5 12l7.2-2.3z"/></svg>';
const HINT = 'Drag your cloud over someone’s idea or project.';
const whose = p => `${p.name}’s ${p.noun}`;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const SPILL = 150;      // how far under the landing the backdrop runs, fading out as it goes
const SINK = .4;        // how far the garden sinks for each pixel scrolled, once the whole of it has been seen
// The stills, for each framing (`close` is under the pitch), by day and by night.
const PICTURES = {
  wide: { day: new URL('./still/wide-day.webp', import.meta.url).href, night: new URL('./still/wide-night.webp', import.meta.url).href },
  close: { day: new URL('./still/close-day.webp', import.meta.url).href, night: new URL('./still/close-night.webp', import.meta.url).href }
};

/** Put the garden's labels in the landing's figure. What comes back is what ./landing.js drives a scene with. */
export function mount(figure){
  const view = $('#sceneView', figure), canvas = $('canvas', view), layer = $('.rd-pins', view), hint = $('#sceneHint', figure), note = $('#sceneNote', figure);
  const title = $('h2', note), text = $('p', note), again = $('#sceneAgain', figure);
  const still = $('.rd-still', view), picture = $('img', still);
  layer.innerHTML = PLOTS.map((p, i) => `<button type="button" class="rd-pin rd-plot${p.theirs ? ' theirs' : ''}" data-plot="${i}"><i style="--c:${esc(p.color)}">${esc(p.name[0])}</i><span>${esc(p.name)}</span>${SPARK}</button>`).join('')
    + `<span class="rd-pin rd-friend"><i style="--c:${esc(FRIEND.color)}">${esc(FRIEND.name[0])}</i><span>${esc(FRIEND.name)}’s plan</span></span>`
    + `<div class="rd-cloud" id="sceneCloud"><span class="rd-pin rd-plan"><svg class="rd-ring" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><circle class="left" cx="10" cy="10" r="7.5" pathLength="100"/></svg><span><b>Your AI plan</b><small>Resets in 2 days</small></span></span></div>`;
  const pins = $$('.rd-plot', layer), friendTag = $('.rd-friend', layer), cloud = $('#sceneCloud', layer), plan = $('.rd-plan', cloud), ring = $('.rd-ring', cloud), resets = $('small', cloud);

  let scene = null, shown = -1, toastTimer = 0, doneTimer = 0, dark = isNight();

  /* where the garden goes in the backdrop, and how far it has sunk */
  // Under 880px the pitch is over the garden, not beside it, and the garden has the window's width (./landing.css).
  const stacked = matchMedia('(max-width:880px)'), calm = matchMedia('(prefers-reduced-motion: reduce)'), touch = matchMedia('(pointer:coarse)');
  const land = figure.parentElement, base = $('.rd-base', figure), bar = $('.rd-bar'), pitch = $('.rd-pitch', land), signIn = $('.rd-ctas', land);
  let frame = null, sunk = 0, deep = 0, stood = 0;
  function layout(){
    const f = figure.getBoundingClientRect();
    if (!f.width) return;
    // the landing fills what the bar leaves of the first screenful
    land.style.setProperty('--rd-bar', (bar?.offsetHeight || 76) + 'px');
    const at = view.getBoundingClientRect(), close = stacked.matches;
    figure.style.setProperty('--sky-h', Math.round(land.getBoundingClientRect().bottom - at.top + SPILL) + 'px');
    // Beside the pitch, the garden reaches a little under it on the left and out toward the
    // window's edge on the right. Under it, it has the window's whole width.
    // (Further out on a wider window, so the garden grows with it.)
    const x0 = close ? 0 : f.left - at.left - 40, x1 = close ? at.width : Math.min(at.width - 24, f.right - at.left + 130 + Math.max(0, at.width - 1440) * .4);
    // the line under the garden is as wide as the garden is (and the still's notes as wide as the column)
    figure.style.setProperty('--out-l', Math.round(f.left - at.left - x0) + 'px');
    figure.style.setProperty('--out-r', Math.round(x1 - (f.right - at.left)) + 'px');
    figure.style.setProperty('--in-l', Math.round(f.left - land.getBoundingClientRect().left) + 'px');
    // Between the garden and that line the figure leaves a stretch of meadow (its gap): the
    // garden can sink as far as that.
    const room = parseFloat(getComputedStyle(figure).rowGap) || 0;
    deep = Math.max(0, room - 8);
    // How far the page is scrolled when the garden starts and stops sinking, for the stylesheet
    // to sink it by on a touchscreen (see scroll()).
    const from = Math.max(0, base.getBoundingClientRect().top + scrollY - innerHeight + 52);
    figure.style.setProperty('--sink', deep + 'px');
    figure.style.setProperty('--sink-from', Math.round(from) + 'px');
    figure.style.setProperty('--sink-to', Math.round(from + deep / SINK) + 'px');
    frame = { x: x0, y: f.top - at.top, w: x1 - x0, h: base.getBoundingClientRect().top - room - f.top, close };
    scene?.setFrame(frame);
    // The still, scaled about the point the camera looks at, and moved to where the scene draws it.
    const fitted = fit(frame), s = STILLS[close ? 'close' : 'wide'], k = fitted.unit / s.unit;
    picture.style.width = s.w * k + 'px';
    picture.style.left = fitted.midX - s.midX * k + 'px';
    picture.style.top = fitted.midY - s.midY * k + 'px';
    if (!scene) { look(); hold(); }
    // Beside the garden, the pitch stands on its horizon: the heading and what's under it in
    // the sky, and its two buttons on the line of the far woods. It's moved from where the page's
    // layout centres it, as far as the landing has room for.
    // (The horizon is known from the frame alone, so this doesn't wait for the scene.)
    let to = 0;
    if (!close && pitch && signIn) {
      const p = pitch.getBoundingClientRect(), l = land.getBoundingClientRect(), up = l.top - (p.top - stood), down = Math.max(up, l.bottom - 22 - (p.bottom - stood));
      to = Math.round(clamp(fitted.horizon + at.top - 6 - (signIn.getBoundingClientRect().top - stood), up, down));
    }
    if (to !== stood) { stood = to; land.style.setProperty('--stand', to + 'px'); }
    scroll();
  }
  // Nothing sinks until the hint under the garden is on screen, so on a phone, where the
  // garden starts below the first screenful, the whole of it is seen first. Its labels go
  // down with it, so it can be played with all the way. Anyone who's asked for less motion
  // gets a garden that scrolls away like the rest of the page.
  //
  // Here the camera rises to sink it, once each frame is drawn. That's only smooth where the
  // page waits for the frame before it moves. A touchscreen doesn't: the page goes with the
  // finger whether or not the frame is ready. A late frame leaves the garden carried up with
  // the page, and it drops back when the frame comes, so it judders. So on a touchscreen the
  // camera stays put, and ./landing.css sinks the whole picture with an animation that the
  // browser runs in step with the scrolling. Where a browser can't do that, the garden
  // doesn't sink there at all.
  function scroll(){
    if (!frame || land.hidden) return;      // (on another page there's no garden to sink)
    const to = calm.matches || touch.matches ? 0 : clamp(SINK * clamp(innerHeight - 52 - base.getBoundingClientRect().top, 0, scrollY), 0, deep);
    if (to === sunk) return;
    sunk = to;
    if (scene) scene.setLift(to);
    // (With no scene there's no camera to rise: the still sinks whole, sky and all, as it does on a touchscreen.)
    else { picture.style.translate = to ? `0 ${to}px` : ''; hold(); }
  }
  // The still for the framing, by day or by night. (The one showing stays until the other has come.)
  function look(){
    const src = PICTURES[frame?.close ? 'close' : 'wide'][dark ? 'night' : 'day'];
    if (picture.getAttribute('src') !== src) picture.src = src;
  }
  picture.addEventListener('load', () => still.classList.add('in'));
  // With no scene to say where its labels are, they go where they are on the still.
  function hold(){
    if (scene || !frame) return;
    const s = STILLS[frame.close ? 'close' : 'wide'], f = fit(frame), k = f.unit / s.unit;
    const x = v => f.midX + (v - s.midX) * k, y = v => f.midY + (v - s.midY) * k + sunk;
    onFrame({
      plots: s.plots.map((v, i) => i % 2 ? y(v) : x(v)), cloud: [x(s.cloud[0]), y(s.cloud[1]), s.cloud[2] * k, s.cloud[3] * k],
      friend: [x(s.friend[0]), y(s.friend[1]), 1], width: view.clientWidth, left: s.left, fresh: false
    });
  }
  const sized = new ResizeObserver(layout);
  for (const el of [land, figure, base, bar, pitch]) if (el) sized.observe(el);
  stacked.addEventListener('change', layout); calm.addEventListener('change', scroll); touch.addEventListener('change', scroll);
  addEventListener('scroll', scroll, { passive: true });

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
      title.textContent = 'Three done';
      text.textContent = 'Each is a plant in your garden now, grown with rain you’d have lost at the reset.';
      return;
    }
    const p = PLOTS[i], done = state[i] === 'done';
    title.textContent = p.title;
    text.textContent = p.theirs
      ? (done ? `Done. ${FRIEND.name}’s agent did it, on ${FRIEND.name}’s plan.` : `${FRIEND.name}’s agent is on it, on ${FRIEND.name}’s plan.`)
      : (done ? 'Done. It’s grown a stage, and it’s in your garden.' : 'Your agent’s on it, on your plan. That’s the rain.');
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
    else if (what === 'reset') toast(n > .1 ? 'Your plan reset. The rain you didn’t use is gone.' : 'Your plan reset. The cloud is full again.');
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
  // (Measured from the canvas, not the view it's in: on a touchscreen it's moved down in it as it sinks.)
  const across = e => e.clientX - canvas.getBoundingClientRect().left;
  let dragged = false;
  view.addEventListener('click', e => {
    if (dragged) { dragged = false; return; }       // letting go of the cloud isn't a pick
    const r = canvas.getBoundingClientRect();
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
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    // a plot your cloud could go to shows it can be picked
    const i = e.target === view || e.target.tagName === 'CANVAS' ? scene.plotAt(x, y) : -1;
    view.style.cursor = i >= 0 && state[i] === 'open' && !PLOTS[i].theirs ? 'pointer' : '';
  });
  // The backdrop gives a little to the pointer, wherever on the page it is.
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') scene?.setPointer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => scene?.setPointer(0, 0));
  again.addEventListener('click', () => { clearTimeout(doneTimer); state.fill('open'); mark(); say(-1); scene?.again(); });
  mark();

  return {
    async load({ dark: night }){
      dark = night;
      // (Marked, so ./landing.js can tell a file that didn't come from a browser that can't draw it.)
      const { createGarden } = await import('./garden-scene.js').catch(e => { throw Object.assign(new Error('The garden’s scene couldn’t be fetched', { cause: e }), { missing: true }); });
      layout();
      scene = createGarden(canvas, { dark, frame, plots: PLOTS, onFrame, onEvent });
      scene.setLift(sunk);
    },
    setRunning(on){ scene?.setRunning(on); },
    setDark(on){ dark = on; scene ? scene.setDark(on) : look(); },
    // The scene can't be drawn: the still stays, and its labels are only labels.
    flat(){ layer.inert = true; hold(); },
    escape(){ if (shown !== -1 && shown !== -2) say(-1); }
  };
}
