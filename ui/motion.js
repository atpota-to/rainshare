// Motion that more than one screen uses: a dialog closing the way it opened, moving between a
// dialog's steps, the dark pill sliding to what was picked, a list showing what moved when it's
// redrawn, and counts rolling over. Each one is skipped for anyone who's asked for less motion,
// and each leaves the page exactly as it would have been without it: nothing waits on them.
//
// The curves are the ones the screens' CSS uses (--rs-ease, --rs-spring and --rs-ease-in in
// ./rainshare.css): arriving eases out, a press or a tick springs, and leaving eases in, a
// little faster than arriving.
export const EASE = 'cubic-bezier(.2,.8,.2,1)';
export const SPRING = 'cubic-bezier(.3,1.45,.5,1)';
export const EASE_IN = 'cubic-bezier(.4,0,1,1)';
// (The pill's own: it overshoots a touch less than a press does, so it settles rather than bounces.)
const GLIDE = 'cubic-bezier(.3,1.25,.4,1)';

/** Whoever's looking asked for less motion (or this isn't a browser). */
export const still = () => !globalThis.matchMedia || globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
const can = el => !!el?.animate && !still();

/* ---------- dialogs ---------- */

/**
 * Close a dialog the way it opened, played backwards and a little faster: the box sinks and
 * fades, and so does the dimmed page behind it. The dialog's CSS says how, under .rs-closing
 * (../src/signin.css for sign-in, ./rainshare.css for the rest). It's closed for real once the
 * box has finished, or after a moment if it never starts.
 */
export function closeSoftly(dlg, value){
  if (!dlg?.open || dlg.classList.contains('rs-closing')) return;
  const box = dlg.firstElementChild;
  if (!box || !can(box)) { dlg.close(value); return; }
  let wait = 0;
  const end = e => { if (e.target === box) done(); };
  // (Opened again before it had finished closing, the class is taken off, and it stays open.)
  const done = () => {
    clearTimeout(wait); box.removeEventListener('animationend', end); dlg.removeEventListener('close', done);
    const closing = dlg.classList.contains('rs-closing');
    dlg.classList.remove('rs-closing');
    if (closing && dlg.open) dlg.close(value);
  };
  box.addEventListener('animationend', end);
  dlg.addEventListener('close', done);
  wait = setTimeout(done, 450);
  dlg.classList.add('rs-closing');
}

/**
 * Put the next step of a dialog in its box. What was there slides out the way you're going and
 * fades, the new step slides in after it, and the box grows or shrinks to fit rather than
 * jumping. `dir` is 1 going on, -1 going back, 0 for the same step drawn again. The new step is
 * in the box straight away, so whatever's looked for in it next is found.
 */
export function swapStep(box, html, dir = 1){
  const live = can(box) && box.isConnected && box.closest('dialog')?.open && box.firstChild;
  if (!live) { box.innerHTML = html; return; }
  const h0 = box.getBoundingClientRect().height;
  for (const a of box.getAnimations()) if (a.id === 'rs-step') a.cancel();
  box.querySelectorAll(':scope > .rs-step-out').forEach(g => g.remove());
  const out = document.createElement('div');
  out.className = 'rs-step-out'; out.inert = true; out.setAttribute('aria-hidden', 'true');
  out.append(...box.childNodes);
  box.innerHTML = html;
  const h1 = box.getBoundingClientRect().height;
  box.append(out);
  const step = (el, kf, o) => { const a = el.animate(kf, o); a.id = 'rs-step'; return a; };
  const gone = () => out.remove();
  step(out, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-16 * dir}px)` }], { duration: 140, easing: EASE_IN, fill: 'forwards' }).finished.then(gone, gone);
  box.style.overflow = 'hidden';
  const open = () => { box.style.overflow = ''; };
  if (Math.abs(h1 - h0) > 1) step(box, [{ height: `${h0}px` }, { height: `${h1}px` }], { duration: 300, easing: EASE }).finished.then(open, open);
  else setTimeout(open, 360);
  for (const el of box.children) if (el !== out) step(el, [{ opacity: 0, transform: `translateX(${20 * dir}px)` }, { opacity: 1, transform: 'none' }], { duration: 280, delay: 60, easing: EASE, fill: 'backwards' });
}

/* ---------- what was picked ---------- */

/**
 * The picked one's look (the dark pill on the board's sort and filters, the tinted one in the
 * bar) moves from where the last one was to `to`, rather than jumping there. `from` is the one
 * picked before: the element itself where nothing's been redrawn, or where it was (a DOMRect)
 * when the row has been drawn again since. The words change colour along with it.
 */
export function glide(to, from){
  if (!can(to) || !from) return;
  // (Whatever fades their own background or colour in and out is held off while the pill does it.)
  const hold = [to, from instanceof Element ? from : null].filter(Boolean);
  hold.forEach(el => { el.style.transition = 'none'; });
  const group = to.parentElement;
  const r = to.getBoundingClientRect(), f = from instanceof Element ? from.getBoundingClientRect() : from;
  const letGo = () => hold.forEach(el => { el.style.transition = ''; });
  if (!r.width || !f?.width || (Math.abs(f.left - r.left) < 1 && Math.abs(f.top - r.top) < 1)) { letGo(); return; }
  const cs = getComputedStyle(to), g = group.getBoundingClientRect();
  const pill = document.createElement('span');
  pill.className = 'rs-glide'; pill.setAttribute('aria-hidden', 'true');
  Object.assign(pill.style, {
    left: `${r.left - g.left - group.clientLeft + group.scrollLeft}px`, top: `${r.top - g.top - group.clientTop + group.scrollTop}px`,
    width: `${r.width}px`, height: `${r.height}px`, background: cs.backgroundColor, boxShadow: cs.boxShadow, borderRadius: cs.borderRadius
  });
  group.prepend(pill);
  to.classList.add('rs-glide-to');
  const ms = 380, on = cs.color;
  const plain = [...group.children].find(x => x !== to && x !== pill && x.matches('a,button') && !x.matches('[aria-pressed="true"],[aria-current="true"]'));
  const off = plain ? getComputedStyle(plain).color : null;
  const a = pill.animate([{ transform: `translate(${f.left - r.left}px,${f.top - r.top}px)`, width: `${f.width}px` }, { transform: 'none', width: `${r.width}px` }], { duration: ms, easing: GLIDE });
  if (off) {
    to.animate([{ color: off }, { color: on }], { duration: ms * .7, easing: 'ease-out' });
    // (Redrawn, the one that was picked is a new element in the same place: its words start in the pill's colour too.)
    const left = !(from instanceof Element) && [...group.children].find(x => x !== to && x !== pill && Math.abs(x.getBoundingClientRect().left - f.left) < 2 && Math.abs(x.getBoundingClientRect().top - f.top) < 2);
    if (left) left.animate([{ color: on }, { color: off }], { duration: ms * .5, easing: 'ease-in' });
  }
  if (from instanceof Element) requestAnimationFrame(() => { if (from !== to) from.style.transition = ''; });
  const done = () => { pill.remove(); to.classList.remove('rs-glide-to'); void to.offsetWidth; letGo(); };
  a.finished.then(done, done);
}

/* ---------- a list drawn again ---------- */

/**
 * Before a redraw that only reorders or narrows what's there (sorting, filtering, folding the
 * filters out): where each thing that can move is (data-rs-flip, by its key), which choice in
 * each row is picked (data-rs-glide rows), and what each count says (data-rs-count). Hand it to
 * settle() after the redraw. Null for anyone who's asked for less motion.
 */
export function snapshot(root){
  if (still() || !root) return null;
  const flips = new Map(), pills = new Map(), counts = new Map(), vh = innerHeight;
  for (const el of root.querySelectorAll('[data-rs-flip]')) {
    const r = el.getBoundingClientRect();
    if (r.width && r.bottom > -vh && r.top < vh * 2) flips.set(el.dataset.rsFlip, { el, r });
  }
  for (const g of root.querySelectorAll('[data-rs-glide]')) { const on = g.querySelector(':scope > [aria-pressed="true"]'); if (on) pills.set(g.dataset.rsGlide, on.getBoundingClientRect()); }
  for (const c of root.querySelectorAll('[data-rs-count]')) counts.set(c.dataset.rsCount, c.textContent);
  return { flips, pills, counts };
}

/**
 * After the redraw: what stayed slides from where it was to where it is, what's gone stays a
 * moment where it stood and fades (as the placeholders do, .rs-sk-out), and what's new fades
 * in, or opens downward if it says so (data-rs-flip-in="open"). The picked pill slides and the
 * counts roll. `box` is where the ones that have gone are put while they fade: the screen's
 * outermost element, which they're positioned against.
 */
export function settle(root, snap, box = root?.firstElementChild){
  if (!snap || !box || still()) return;
  const base = box.getBoundingClientRect(), vh = innerHeight;
  const now = new Map([...root.querySelectorAll('[data-rs-flip]')].map(el => [el.dataset.rsFlip, el]));
  for (const [key, { el, r }] of snap.flips) {
    if (now.has(key) || r.bottom < 0 || r.top > vh) continue;
    el.classList.add('rs-flip-out'); el.inert = true; el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, { left: `${r.left - base.left}px`, top: `${r.top - base.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    box.append(el);
    const gone = () => el.remove();
    el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.97)' }], { duration: 200, easing: EASE_IN, fill: 'forwards' }).finished.then(gone, gone);
  }
  for (const [key, el] of now) {
    const was = snap.flips.get(key), r = el.getBoundingClientRect();
    if (!r.width || r.bottom < -vh || r.top > vh * 2) continue;
    if (was) {
      const dx = was.r.left - r.left, dy = was.r.top - r.top;
      if (Math.abs(dx) > .5 || Math.abs(dy) > .5) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 400, easing: EASE });
    } else if (r.bottom > 0 && r.top < vh) {
      if (el.dataset.rsFlipIn === 'open') el.animate([{ clipPath: 'inset(0 0 100% 0 round 18px)', opacity: 0 }, { clipPath: 'inset(0 0 0 0 round 18px)', opacity: 1 }], { duration: 400, easing: EASE });
      else el.animate([{ opacity: 0, transform: 'translateY(8px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 120, easing: EASE, fill: 'backwards' });
    }
  }
  for (const g of root.querySelectorAll('[data-rs-glide]')) {
    const on = g.querySelector(':scope > [aria-pressed="true"]'), was = snap.pills.get(g.dataset.rsGlide);
    if (on && was) glide(on, was);
  }
  for (const c of root.querySelectorAll('[data-rs-count]')) roll(c, snap.counts.get(c.dataset.rsCount));
}

/** A number that's just changed rolls in from above (going up) or below (going down). */
export function roll(el, was){
  if (!can(el) || was == null || was === el.textContent) return;
  const up = Number(el.textContent) > Number(was);
  el.animate([{ transform: `translateY(${up ? 60 : -60}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: EASE });
}

/* ---------- a tick ---------- */

/** The lines of an icon (a check, say) draw themselves in, as if by a pen. */
export function draw(svg, delay = 0){
  if (!can(svg)) return;
  for (const p of svg.querySelectorAll('path')) {
    p.setAttribute('pathLength', '1');
    p.style.strokeDasharray = '1';
    p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 360, delay, easing: EASE, fill: 'backwards' });
  }
}
