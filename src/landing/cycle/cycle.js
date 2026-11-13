// The water cycle: the landing's scene until the garden (../garden.js) took its place. It's
// kept, whole, in case it's wanted back: set SCENE in ../landing.js to 'cycle', or add
// ?scene=cycle to the address to look at it. Nobody downloads any of this folder otherwise.
//
// Picking a part (its pin, or anywhere near it in the scene) flies the camera in and shows a
// short note: what that part stands for in Rainshare, and a link to the screen in the example
// circle where it happens. "Next" walks round the cycle; "Whole view" backs out.
import './cycle.css';

const NAMES = ['Evaporation', 'Condensation', 'Precipitation', 'Collection'];
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];

// What index.html had in the figure while this was the landing's scene.
const MARKUP = `
  <figcaption class="rd-sr">An animated view of a coast, showing the water cycle. Mist rises off the sea, gathers into clouds that drift inland, falls as rain on what’s planted beside a river, and runs back to the sea. Four buttons look closer at each part and say what it stands for.</figcaption>
  <div class="rd-view" id="sceneView">
    <svg class="rd-still" viewBox="0 0 400 340" aria-hidden="true">
      <circle class="s-sun" cx="92" cy="74" r="20"/>
      <path class="s-cloud" d="M196 132a22 22 0 0 1 2-44 30 30 0 0 1 56-8 25 25 0 0 1 28 52z"/>
      <path class="s-rain" d="M214 148l-5 18M236 148l-5 18M258 148l-5 18M225 174l-4 14M247 174l-4 14"/>
      <path class="s-far" d="M170 262c30-34 52-62 84-86 20 18 34 30 50 52 14-12 26-20 40-30 14 20 26 40 36 64z"/>
      <path class="s-hill" d="M150 266c40-30 78-46 118-52 44 8 82 26 112 52z"/>
      <path class="s-sea" d="M20 250c26-6 44 6 70 0s44-6 70 0 36 4 50 0v16H20z"/>
      <path class="s-vapour" d="M62 226c-7-11 7-17 0-28M96 226c-7-11 7-17 0-28M130 226c-7-11 7-17 0-28"/>
    </svg>
    <canvas aria-hidden="true"></canvas>
    <div class="rd-pins">
      <button type="button" class="rd-pin" aria-expanded="false" aria-controls="note0"><i></i><span>Evaporation</span></button>
      <button type="button" class="rd-pin" aria-expanded="false" aria-controls="note1"><i></i><span>Condensation</span></button>
      <button type="button" class="rd-pin" aria-expanded="false" aria-controls="note2"><i></i><span>Precipitation</span></button>
      <button type="button" class="rd-pin" aria-expanded="false" aria-controls="note3"><i></i><span>Collection</span></button>
    </div>
    <button type="button" class="rd-pause" id="scenePause" aria-pressed="false" aria-label="Pause the animation">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-pause" d="M8.5 6v12M15.5 6v12"/><path class="i-play" d="M8 5.5v13l11-6.5z"/></svg>
    </button>
  </div>
  <!-- What each part stands for, and the screen in the example circle where it happens -->
  <div class="rd-notes" aria-live="polite">
    <p class="rd-hint" id="sceneHint">Pick a part of the cycle to look closer.</p>
    <article class="rd-note" id="note0" hidden>
      <h2>Evaporation</h2>
      <p>Some of your plan goes unused before it resets. That’s time your agent could spend on a friend’s project.</p>
      <a href="/example/profile/did:example:kai" data-nav>See someone’s AI plan</a>
    </article>
    <article class="rd-note" id="note1" hidden>
      <h2>Condensation</h2>
      <p>Say which AI plan you have and what you run. It gathers with the people you already follow.</p>
      <a href="/example" data-nav>See a circle</a>
    </article>
    <article class="rd-note" id="note2" hidden>
      <h2>Precipitation</h2>
      <p>Pick a friend’s idea or project and send your agent after it. That’s the rain.</p>
      <a href="/example/seed/did:example:mo/3sq-mo-idea" data-nav>See an idea</a>
    </article>
    <article class="rd-note" id="note3" hidden>
      <h2>Collection</h2>
      <p>A pull request comes back and the work is done. It grows in your garden, and next reset it all goes round again.</p>
      <a href="/example/seed/did:example:sam/3sq-sam" data-nav>See one that’s done</a>
    </article>
    <div class="rd-tour" id="sceneTour" hidden>
      <button type="button" id="tourNext">Next: <span>Condensation</span></button>
      <button type="button" id="tourOut">Whole view</button>
    </div>
  </div>`;

/** Put the water cycle in the landing's figure. What comes back is what ../landing.js drives a scene with. */
export function mount(figure){
  figure.classList.remove('rd-garden'); figure.classList.add('rd-cycle');
  figure.innerHTML = MARKUP;
  const view = $('#sceneView', figure), hint = $('#sceneHint', figure), tour = $('#sceneTour', figure), next = $('#tourNext', figure);
  const pins = $$('.rd-pin', figure), notes = $$('.rd-note', figure);
  let scene = null, focus = -1;

  /** Look closer at one part of the cycle, or back out to the whole of it (-1). */
  function setFocus(i){
    focus = i;
    figure.classList.toggle('close', i >= 0);
    pins.forEach((p, k) => { p.classList.toggle('on', k === i); p.setAttribute('aria-expanded', String(k === i)); });
    notes.forEach((n, k) => { n.hidden = k !== i; });
    hint.hidden = i >= 0; tour.hidden = i < 0;
    if (i >= 0) $('span', next).textContent = NAMES[(i + 1) % 4];
    scene?.focus(i);
  }
  // Each drawn frame: put the pins where their places in the scene are. One that would hang
  // off the right of the scene turns to face left; one that's out of view is hidden.
  function onFrame({ pins: at }){
    const w = view.clientWidth;
    pins.forEach((p, k) => {
      const x = at[k * 2], y = at[k * 2 + 1], seen = x === x, flip = x > w * .56;
      p.style.visibility = seen ? '' : 'hidden';
      if (!seen) return;
      p.classList.toggle('flip', flip);
      p.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)${flip ? ' translateX(calc(28px - 100%))' : ''}`;
    });
  }

  pins.forEach((p, k) => p.addEventListener('click', e => { e.stopPropagation(); setFocus(k === focus ? -1 : k); }));
  // Anywhere else in the scene: the part nearest the tap. Tapping the part you're at, or
  // nothing in particular, backs out.
  view.addEventListener('click', e => {
    if (!scene) return;
    const r = view.getBoundingClientRect(), k = scene.stageAt(e.clientX - r.left, e.clientY - r.top);
    setFocus(k === focus ? -1 : k);
  });
  next.addEventListener('click', () => setFocus((focus + 1) % 4));
  $('#tourOut', figure).addEventListener('click', () => { setFocus(-1); });
  view.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = view.getBoundingClientRect();
    scene?.setPointer((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1);
  });
  view.addEventListener('pointerleave', () => scene?.setPointer(0, 0));

  return {
    async load({ dark }){
      const { createWaterCycle } = await import('./scene.js');
      scene = createWaterCycle($('canvas', view), { dark, onFrame });
      scene.focus(focus);
    },
    setRunning(on){ scene?.setRunning(on); },
    setDark(on){ scene?.setDark(on); },
    escape(){ if (focus >= 0) setFocus(-1); }
  };
}
