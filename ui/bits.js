// Small pieces both of Rainshare's screen modules use: escaping, times, icons and faces.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const b64url = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = s => { try { return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))); } catch (_) { return ''; } };

/**
 * Text with the "ai" inside every "rain" lit, the way the wordmark's is. What's read aloud is
 * the plain sentence; the lit copy is for the eye only.
 */
export function lit(text){
  const safe = esc(text), marked = safe.replace(/\b([Rr])(ai)(n)/g, '$1<span class="rs-ai">$2</span>$3');
  return marked === safe ? safe : `<span class="rs-sr">${safe}</span><span aria-hidden="true">${marked}</span>`;
}

const HOUR = 3600e3;
export const ago = iso => { const d = Date.now() - Date.parse(iso); if (!(d >= 0)) return ''; if (d < 60e3) return 'just now'; if (d < HOUR) return Math.floor(d / 60e3) + 'm ago'; if (d < 24 * HOUR) return Math.floor(d / HOUR) + 'h ago'; if (d < 30 * 24 * HOUR) return Math.floor(d / (24 * HOUR)) + 'd ago'; return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
export const until = iso => { const t = Date.parse(iso); return t ? new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : ''; };
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };
export const nameOf = p => p?.displayName || (p?.handle ? '@' + p.handle : 'Someone');
export const firstName = p => String(p?.displayName || '').trim().split(/\s+/)[0] || (p?.handle ? '@' + p.handle : 'Someone');
export const people = n => n == null ? '' : n === 1 ? '1 person' : `${Number(n).toLocaleString('en')} people`;

/** A seed's own address under the app: public ones by repo and key, private ones by record URI. */
export const pathOf = item => item.space ? 'seed/s/' + b64url(item.uri) : `seed/${item.repo}/${item.rkey}`;

const ICON = {
  drop: '<path d="M12 3.2c3.2 4.1 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 2.8-6.5 6-10.6z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  out: '<path d="M13.5 5H19v5.5M19 5l-8 8"/><path d="M17 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9M4.5 12a7.5 7.5 0 0 1 13.2-4.9"/><path d="M18 3.5v3.8h-3.8M6 20.5v-3.8h3.8"/>',
  term: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M7 10l3 2.5L7 15M12.5 15H17"/>',
  person: '<circle cx="12" cy="9" r="3.5"/><path d="M5.5 19.5a7 7 0 0 1 13 0"/>',
  sky: '<path d="M7 18h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2M12 7.9v.1"/>',
  hat: '<path d="M3.5 17h17"/><path d="M6.5 17v-5.5a5.5 5.5 0 0 1 11 0V17"/><path d="M6.5 13.5h11"/>',
  pull: '<circle cx="7" cy="6" r="2.2"/><circle cx="7" cy="18" r="2.2"/><circle cx="17" cy="18" r="2.2"/><path d="M7 8.2v7.6M11 6h3a3 3 0 0 1 3 3v6.8M13.2 3.8L11 6l2.2 2.2"/>'
};
// The weather and the life of a seed, in the same pictures as the landing's scene: a forecast
// is a sky (clear, then a cloud with more and more rain), and a seed is in the ground, being
// rained on, up, or sprouted.
const CLOUD = '<path d="M7 13.5h9.5a3.5 3.5 0 0 0 .5-6.96A4.8 4.8 0 0 0 7.3 6 3.8 3.8 0 0 0 7 13.5z"/>';
const SKY = {
  dry: '<circle cx="12" cy="12" r="3.6"/><path d="M12 3.6v2M12 18.4v2M3.6 12h2M18.4 12h2M6.1 6.1l1.4 1.4M16.5 16.5l1.4 1.4M6.1 17.9l1.4-1.4M16.5 7.5l1.4-1.4"/>',
  drizzle: CLOUD + '<path d="M12 16.8l-.8 2.4"/>',
  showers: CLOUD + '<path d="M9.5 16.8l-.8 2.4M14.5 16.8l-.8 2.4"/>',
  downpour: CLOUD + '<path d="M8 16.6l-1.2 3.8M12 16.6l-1.2 3.8M16 16.6l-1.2 3.8"/>'
};
/** A forecast's sky: dry, drizzle, showers or downpour. */
export const skyIco = level => `<svg class="rs-i rs-sky" viewBox="0 0 24 24" aria-hidden="true">${SKY[level] || SKY.dry}</svg>`;
const GROUND = '<path d="M4 19.5h16"/>';
const LIFE = {
  seed: GROUND + '<path d="M12 19.5c-2 0-3.2-1.2-3.2-2.7 0-1.4 1.3-2.6 3.2-2.6s3.2 1.2 3.2 2.6c0 1.5-1.2 2.7-3.2 2.7z"/>',
  rain: GROUND + '<path d="M12 19.5c-1.6 0-2.6-1-2.6-2.2s1-2.1 2.6-2.1 2.6.9 2.6 2.1-1 2.2-2.6 2.2z"/><path d="M8 5l-.9 3M12.4 4l-.9 3M16.8 5l-.9 3M10 9.6l-.6 2M14.6 9.6l-.6 2"/>',
  up: GROUND + '<path d="M12 19.5v-7"/><path d="M12 14c0-2.6-1.8-4.2-4.6-4.2 0 2.7 1.8 4.2 4.6 4.2zM12 12.5c0-2.6 1.8-4.2 4.6-4.2 0 2.7-1.8 4.2-4.6 4.2z"/>',
  sprouted: GROUND + '<path d="M12 19.5V11"/><path d="M12 16c0-2.3-1.6-3.7-4.1-3.7 0 2.4 1.6 3.7 4.1 3.7zM12 14.5c0-2.3 1.6-3.7 4.1-3.7 0 2.4-1.6 3.7-4.1 3.7z"/><path class="rs-bud" d="M12 2.8l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>'
};
/** Where a seed is in its life: 'seed' (in the ground), 'rain' (someone's on it), 'up' (turned in), 'sprouted'. */
export const lifeOf = item => item?.value?.state === 'sprouted' ? 'sprouted' : (item?.deliveries || []).length ? 'up' : (item?.takes || []).length ? 'rain' : 'seed';
export const lifeIco = k => `<svg class="rs-i rs-life rs-life-${k}" viewBox="0 0 24 24" aria-hidden="true">${LIFE[k] || LIFE.seed}</svg>`;
export const ico = (k, cls = '') => `<svg class="rs-i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
const FORGE_ICON = {
  github: '<path d="M12 2.8a9.3 9.3 0 0 0-2.9 18.1c.5.1.6-.2.6-.4v-1.6c-2.6.6-3.1-1.1-3.1-1.1-.4-1.1-1-1.4-1-1.4-.9-.6 0-.6 0-.6 1 .1 1.5 1 1.5 1 .8 1.4 2.2 1 2.7.8.1-.6.3-1 .6-1.2-2-.2-4.2-1-4.2-4.6 0-1 .4-1.9 1-2.5-.1-.3-.4-1.2.1-2.5 0 0 .8-.2 2.6 1a8.9 8.9 0 0 1 4.7 0c1.8-1.2 2.6-1 2.6-1 .5 1.3.2 2.2.1 2.5.6.7 1 1.5 1 2.5 0 3.6-2.2 4.4-4.3 4.6.3.3.6.9.6 1.7v2.6c0 .2.2.5.6.4A9.3 9.3 0 0 0 12 2.8z"/>',
  tangled: '<path d="M6 7c3 0 3 10 6 10s3-10 6-10"/><path d="M6 17c3 0 3-10 6-10s3 10 6 10"/>',
  knotless: '<path d="M4 13c2.4-4.5 5.6-4.5 8 0s5.6 4.5 8 0"/>',
  other: '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="8" r="2.2"/><path d="M6 8.2v7.6M18 10.2c0 4-6 3-12 6"/>'
};
// The four plants (../src/plants). Each seed or plant grows its own kind of plant, picked by its
// record's address (`key`), so it's drawn the same wherever it shows, by anyone, and stays the
// same kind as it grows from seed to flower. There are pictures of PLANT_KINDS kinds of each
// stage: kind 0 at <base><stage>.webp, the rest at <base><stage>-<kind>.webp (`npm run plants`
// takes them). With `live`, a canvas sits over the picture for the host to draw the turning
// model of the same kind on, where it can.
export const PLANT_KINDS = 12;
export function plantKind(key){
  if (!key) return 0;
  let h = 0x811c9dc5;
  for (const c of String(key)) h = Math.imul(h ^ c.codePointAt(0), 0x01000193);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;   // stirred, so keys that differ only at the end still land apart
  return (h >>> 0) % PLANT_KINDS;
}
export const plantFile = (stage, kind = 0) => `${stage}${kind ? '-' + kind : ''}.webp`;
let plantBase = '/plants/';
export const setPlantBase = base => { plantBase = base; };
export const plantPic = (stage, px = 40, { live = false, cls = '', key = '' } = {}) => {
  const kind = plantKind(key);
  return `<span class="rs-plant${cls ? ' ' + cls : ''}" style="--rs-plant:${px}px">${live ? `<canvas data-rs-plant="${esc(stage)}" data-rs-kind="${kind}" aria-hidden="true"></canvas>` : ''}<img src="${esc(plantBase + plantFile(stage, kind))}" width="${px}" height="${px}" alt="" decoding="async"></span>`;
};
export const forgeIco = f => `<svg class="rs-i rs-forge" viewBox="0 0 24 24" aria-hidden="true">${FORGE_ICON[f] || FORGE_ICON.other}</svg>`;

const initialOf = p => [...String(p?.displayName || p?.handle || '?').replace(/^@/, '').trim()][0]?.toUpperCase() || '?';
// An avatar that doesn't load gives way to the person's initial (see avatarFallback).
export function face(p, cls = ''){
  const c = /^(#[0-9a-f]{3,8}|hsl\([\d.% ]+\))$/i.test(p?.color || '') ? p.color : `hsl(${hue(p?.did || p?.handle || '')} 70% 78%)`;
  const img = /^https:\/\//.test(p?.avatar || '') ? `<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer" loading="lazy" data-rs-initial="${esc(initialOf(p))}">` : `<span>${esc(initialOf(p))}</span>`;
  return `<span class="rs-face ${cls}" style="--c:${esc(c)}">${img}</span>`;
}
/** Listen once, on a container, for avatars that fail to load. Errors don't bubble, so this listens on the way down. */
export function avatarFallback(root){
  root.addEventListener('error', e => {
    const img = e.target;
    if (img?.tagName === 'IMG' && img.dataset.rsInitial) { const s = document.createElement('span'); s.textContent = img.dataset.rsInitial; img.replaceWith(s); }
  }, true);
}
/** How well a seed suits you, as one to three filled drops. */
export const drops = level => `<span class="rs-drops" aria-hidden="true">${[1, 2, 3].map(n => `<svg viewBox="0 0 24 24"${n <= level ? ' class="on"' : ''}>${ICON.drop}</svg>`).join('')}</span>`;

/*
 * A little ⓘ that says more when it's pressed: the why and the how, kept off the page until
 * someone asks. `html` is already escaped, and holds only inline things (text, links, <b>,
 * <code>, and <span class="rs-tip-p"> for a paragraph), since a tip can sit inside a line of text.
 * tipLink is the same, opened by a few words rather than the icon.
 */
const tipBox = html => `<span class="rs-tipbox" hidden>${html}</span>`;
const ICO_INFO = `<svg class="rs-i" viewBox="0 0 24 24" aria-hidden="true">${ICON.info}</svg>`;
export const tip = (html, label = 'More about this') => `<span class="rs-tipwrap"><button type="button" class="rs-tip" data-rs-tip aria-expanded="false" aria-label="${esc(label)}">${ICO_INFO}</button>${tipBox(html)}</span>`;
export const tipLink = (text, html) => `<span class="rs-tipwrap"><button type="button" class="rs-link rs-tip-link" data-rs-tip aria-expanded="false">${esc(text)}</button>${tipBox(html)}</span>`;
let openTip = null;
function closeTip(){
  if (!openTip) return;
  openTip.box.hidden = true; openTip.btn.setAttribute('aria-expanded', 'false'); openTip = null;
}
/** Open (or close) the tip whose button this is: under it, or over it if there's no room below, and always inside the window. */
export function toggleTip(btn){
  const box = btn.nextElementSibling;
  if (openTip?.btn === btn) return closeTip();
  closeTip();
  if (!box?.classList.contains('rs-tipbox')) return;
  // The window's width is read before the tip shows, and the tip starts at its left edge, so
  // at no moment does it reach past the right one (a phone would widen the page to fit it).
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight, pad = 16;
  const w = btn.parentElement.getBoundingClientRect(), b = btn.getBoundingClientRect();
  Object.assign(box.style, { left: `${pad - w.left}px`, top: '', bottom: '' });
  box.hidden = false; btn.setAttribute('aria-expanded', 'true');
  openTip = { btn, box };
  const r = box.getBoundingClientRect();
  const left = Math.min(Math.max(b.left + b.width / 2 - r.width / 2, pad), Math.max(pad, vw - pad - r.width));
  box.style.left = `${left - w.left}px`;
  if (b.bottom + 8 + r.height > vh - pad && b.top - 8 - r.height > pad) Object.assign(box.style, { top: 'auto', bottom: 'calc(100% + 6px)' });
}
if (typeof document !== 'undefined') {
  // Anywhere else closes it (a click on its own button is that button's to toggle), and so does Escape.
  document.addEventListener('click', e => { if (openTip && !openTip.btn.parentElement.contains(e.target)) closeTip(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openTip) { const b = openTip.btn; closeTip(); e.stopPropagation(); b.focus(); } }, true);
  addEventListener('resize', closeTip);
}
