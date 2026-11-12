// The logo, moving: the drawing in ./drop.js, on a small canvas, a frame at a time.
//
//   mountLogo(canvas, { touch })   draw it there and keep it moving; returns a function that takes it down
//
// It's drawn at the size it's shown, about thirty times a second, and holds still when it's
// off screen, when the tab is hidden, and for anyone who has asked their system for less
// motion (they get the still pose). It follows light and dark as day and night. Pointing at
// `touch` (the link the logo is in) gives the drop a wobble and sets the spark turning.
import { drawLogo, LOOKS, FRAMES } from './drop.js';

const GAP = 1000 / 31;             // between frames, in milliseconds
const MOST = 144;                  // the most pixels across it's ever drawn at

export function mountLogo(canvas, { touch = canvas, frame = FRAMES.mark } = {}){
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const calm = matchMedia('(prefers-reduced-motion: reduce)'), night = matchMedia('(prefers-color-scheme: dark)');
  let picture = null, ratio = 0, raf = 0, last = -1, time = 0, nudged = -Infinity, seen = true, gone = false;

  function fit(){
    ratio = window.devicePixelRatio || 1;
    const n = Math.min(MOST, Math.max(24, Math.round((canvas.clientWidth || 32) * ratio)));
    if (!picture || n !== canvas.width) { canvas.width = canvas.height = n; picture = ctx.createImageData(n, n); }
  }
  function paint(){
    drawLogo(picture.data, canvas.width, { t: time, look: night.matches ? LOOKS.night : LOOKS.day, frame, nudge: time - nudged });
    ctx.putImageData(picture, 0, 0);
  }
  function step(now){
    raf = requestAnimationFrame(step);
    if (last < 0) last = now - GAP;
    if (now - last < GAP - 2) return;
    time += Math.min(.1, (now - last) / 1000); last = now;
    if ((window.devicePixelRatio || 1) !== ratio) fit();
    paint();
  }
  // Moving only while there's someone to see it, and they haven't asked for stillness.
  function sync(){
    const run = !gone && seen && !document.hidden && !calm.matches;
    if (run && !raf) { last = -1; raf = requestAnimationFrame(step); }
    if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  const still = () => { if (calm.matches) { time = 0; nudged = -Infinity; } fit(); paint(); sync(); };
  const nudge = () => { if (!calm.matches && time - nudged > .9) nudged = time; };

  fit(); paint();                   // straight away, in the pose the still picture is in
  canvas.dataset.live = '1';
  const watch = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => { seen = es.some(e => e.isIntersecting); sync(); }) : null;
  const size = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { fit(); paint(); }) : null;
  watch?.observe(canvas); size?.observe(canvas);
  document.addEventListener('visibilitychange', sync);
  calm.addEventListener('change', still); night.addEventListener('change', still);
  touch.addEventListener('pointerenter', nudge);
  sync();

  return () => {
    gone = true; sync();
    watch?.disconnect(); size?.disconnect();
    document.removeEventListener('visibilitychange', sync);
    calm.removeEventListener('change', still); night.removeEventListener('change', still);
    touch.removeEventListener('pointerenter', nudge);
    delete canvas.dataset.live;
  };
}
