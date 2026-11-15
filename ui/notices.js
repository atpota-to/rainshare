// The bell's panel, as markup: what each notice says, and the panel around them. The host's
// bar shows it (../src/main.js) and the notices come from ../core/notices.js. Each notice opens
// what it's about: an ask's page (at its comments, for a comment), or a release note on the
// What's new page. Everything someone else wrote is escaped, and a comment is shown as a line of
// plain words, never as markup.
import { esc, ago, nameOf, face, ico, pathOf } from './bits.js';

/** The count on the bell: "3", or "9+" past nine. Empty for none. */
export const countLabel = n => !n ? '' : n > 9 ? '9+' : String(n);
/** What the bell says to a screen reader. */
export const bellLabel = n => n ? `Notifications, ${n > 9 ? 'more than 9' : n} new` : 'Notifications';

const MAX_TITLE = 70;
const clip = s => { const c = [...String(s ?? '').replace(/\s+/g, ' ').trim()]; return c.length > MAX_TITLE ? c.slice(0, MAX_TITLE - 1).join('').trimEnd() + '…' : c.join(''); };
const ask = n => `“${esc(clip(n.seed?.value?.title) || 'Untitled')}”`;
// (A release note's day is midnight UTC, so it's said as a day, not as hours ago.)
const day = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** What a notice says, as markup: { html, more, path }. `more` is a second line (what a comment said); `path` is where it opens, under the app's base. */
export function noticeLine(n){
  const who = `<b>${esc(nameOf(n.person || { did: n.by }))}</b>`;
  const seedPath = n.seed ? pathOf(n.seed) : '';
  switch (n.kind) {
    case 'take': return { html: `${who} took on your ask ${ask(n)}.`, path: seedPath };
    case 'delivery': return { html: `${who} turned in work on your ask ${ask(n)}.`, path: seedPath };
    case 'done-yours': return { html: `${who} marked ${ask(n)} done with your work. It’s in your garden now.`, path: seedPath };
    case 'done': return { html: `${who} marked ${ask(n)} done, with someone else’s work.`, path: seedPath };
    case 'closed': return { html: `${who} closed ${ask(n)}.`, path: seedPath };
    case 'comment': return { html: `${who} commented on your ask ${ask(n)}.`, more: n.text, path: seedPath + '#comments' };
    case 'reply': return { html: `${who} replied to you on ${ask(n)}.`, more: n.text, path: seedPath + '#comments' };
    case 'asker': return { html: `${who} commented on ${ask(n)}, which you’re helping with.`, more: n.text, path: seedPath + '#comments' };
    case 'release': return { html: `<b>New on Rainshare:</b> ${esc(n.release.title)}`, more: n.release.summary, path: 'releases#' + encodeURIComponent(n.release.id) };
    default: return { html: '', path: '' };
  }
}

/**
 * The panel's insides. `href` turns a path under the app's base into a link; `fresh` is the
 * keys of the notices that are new to whoever's looking; `demo` says it's the example board's.
 */
export function noticePanel({ list = [], loading = false, error = false, demo = false } = {}, { href = p => '/' + p, fresh = new Set() } = {}){
  const rows = list.map(n => {
    const { html, more, path } = noticeLine(n);
    if (!html) return '';
    const isNew = fresh.has(n.key), pic = n.kind === 'release' ? `<span class="rd-notice-mark">${ico('drop')}</span>` : face(n.person || { did: n.by });
    const when = n.kind === 'release' ? day(n.at) : ago(new Date(n.at).toISOString());
    return `<li><a class="rd-notice${isNew ? ' rd-new' : ''}" href="${esc(href(path))}" data-nav>${pic}<span class="rd-notice-words">${isNew ? '<span class="rd-sr">New: </span>' : ''}<span>${html}</span>${more ? `<small class="rd-notice-said">${esc(more)}</small>` : ''}<small class="rd-notice-when">${esc(when)}</small></span>${isNew ? '<i class="rd-notice-dot" aria-hidden="true"></i>' : ''}</a></li>`;
  }).join('');
  // (Release notes alone don't make it busy: whether anything has happened on your asks is still said.)
  const quiet = error ? 'Your asks couldn’t be checked just now. The bell will try again in a few minutes.'
    : loading || list.some(n => n.kind !== 'release') ? '' : 'Nothing yet. When someone takes on one of your asks, turns in work or comments, or an ask you helped with is done, it’s here.';
  return `<div class="rd-bell-head"><h2 id="rdBellTitle">Notifications</h2>${demo ? '<small>On the example board</small>' : ''}</div>`
    + (rows ? `<ul class="rd-notices">${rows}</ul>` : '')
    + (loading ? `<p class="rd-bell-note" aria-live="polite"><span class="rd-bell-spin" aria-hidden="true"></span>Looking for anything new…</p>` : '')
    + (quiet ? `<p class="rd-bell-note">${esc(quiet)}</p>` : '')
    + `<div class="rd-bell-foot"><a href="${esc(href('releases'))}" data-nav>What’s new on Rainshare</a><a href="${esc(href('settings'))}" data-nav title="@rainshare.dev can message you on Bluesky when there’s news on your asks and your work. It’s in your settings.">Messages on Bluesky</a></div>`;
}
