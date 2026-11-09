// Small pieces both of Rainshare's screen modules use: escaping, times, icons and faces.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const b64url = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = s => { try { return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))); } catch (_) { return ''; } };

const HOUR = 3600e3;
export const ago = iso => { const d = Date.now() - Date.parse(iso); if (!(d >= 0)) return ''; if (d < 60e3) return 'just now'; if (d < HOUR) return Math.floor(d / 60e3) + 'm ago'; if (d < 24 * HOUR) return Math.floor(d / HOUR) + 'h ago'; if (d < 30 * 24 * HOUR) return Math.floor(d / (24 * HOUR)) + 'd ago'; return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
export const until = iso => { const t = Date.parse(iso); return t ? new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : ''; };
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };
export const nameOf = p => p?.displayName || (p?.handle ? '@' + p.handle : 'Someone');
export const firstName = p => String(p?.displayName || '').trim().split(/\s+/)[0] || (p?.handle ? '@' + p.handle : 'Someone');
export const people = n => n == null ? '' : n === 1 ? '1 person' : `${Number(n).toLocaleString('en')} people`;

/** A sidequest's own address under the app: public ones by repo and key, private ones by record URI. */
export const pathOf = item => item.space ? 'q/s/' + b64url(item.uri) : `q/${item.repo}/${item.rkey}`;

const ICON = {
  drop: '<path d="M12 3.2c3.2 4.1 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 2.8-6.5 6-10.6z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  term: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M7 10l3 2.5L7 15M12.5 15H17"/>',
  person: '<circle cx="12" cy="9" r="3.5"/><path d="M5.5 19.5a7 7 0 0 1 13 0"/>',
  sky: '<path d="M7 18h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18z"/>'
};
export const ico = (k, cls = '') => `<svg class="rs-i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
const FORGE_ICON = {
  github: '<path d="M12 2.8a9.3 9.3 0 0 0-2.9 18.1c.5.1.6-.2.6-.4v-1.6c-2.6.6-3.1-1.1-3.1-1.1-.4-1.1-1-1.4-1-1.4-.9-.6 0-.6 0-.6 1 .1 1.5 1 1.5 1 .8 1.4 2.2 1 2.7.8.1-.6.3-1 .6-1.2-2-.2-4.2-1-4.2-4.6 0-1 .4-1.9 1-2.5-.1-.3-.4-1.2.1-2.5 0 0 .8-.2 2.6 1a8.9 8.9 0 0 1 4.7 0c1.8-1.2 2.6-1 2.6-1 .5 1.3.2 2.2.1 2.5.6.7 1 1.5 1 2.5 0 3.6-2.2 4.4-4.3 4.6.3.3.6.9.6 1.7v2.6c0 .2.2.5.6.4A9.3 9.3 0 0 0 12 2.8z"/>',
  tangled: '<path d="M6 7c3 0 3 10 6 10s3-10 6-10"/><path d="M6 17c3 0 3-10 6-10s3 10 6 10"/>',
  other: '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="8" r="2.2"/><path d="M6 8.2v7.6M18 10.2c0 4-6 3-12 6"/>'
};
export const forgeIco = f => `<svg class="rs-i rs-forge" viewBox="0 0 24 24" aria-hidden="true">${FORGE_ICON[f] || FORGE_ICON.other}</svg>`;

export function face(p, cls = ''){
  const c = p?.color || `hsl(${hue(p?.did || p?.handle || '')} 70% 78%)`;
  const img = p?.avatar ? `<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()">` : `<span>${esc((p?.displayName || p?.handle || '?').replace(/^@/, '')[0]?.toUpperCase() || '?')}</span>`;
  return `<span class="rs-face ${cls}" style="--c:${c}">${img}</span>`;
}
/** How well a sidequest suits you, as one to three filled drops. */
export const drops = level => `<span class="rs-drops" aria-hidden="true">${[1, 2, 3].map(n => `<svg viewBox="0 0 24 24"${n <= level ? ' class="on"' : ''}>${ICON.drop}</svg>`).join('')}</span>`;
