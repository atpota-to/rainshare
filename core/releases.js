// What's new on Rainshare: the release notes, newest first. Each one is on the What's new page
// (/releases, in the footer), and in the bell in the bar, where it's marked new for anyone who
// hasn't opened the bell since it went out (./notices.js).
//
// Every note goes into everyone's bell, so ask the maintainer before adding one, and show them
// the wording. If you can't ask (a routine running on its own), leave it out and suggest one in
// the pull request instead.
//
// Most changes don't need one. Write one when people can do something new or something works
// differently. Changes to the terms, privacy policy or guidelines don't get one.
//
// Keep it short and plain: say what changed and where to find it. One sentence is usually
// enough. To add one, put it at the top of the list:
//
//   id       a short name, in lowercase words joined by dashes. It's how the bell knows who's
//            seen it, so never change or reuse one once it's out.
//   date     the day it goes out, as YYYY-MM-DD. One dated after today stays out of sight
//            until that day, so a note can be written ahead of what it's about.
//   title    what changed, in a few words
//   summary  one sentence, for the bell and the page
//   text     (optional) a sentence or two more, in Markdown (./markdown.js), for the page only
//
// The bell only lists notes from the last 30 days; the page has them all. `npm test` checks
// the list (test/notices.test.mjs).
export const RELEASES = [
  {
    id: 'feedback-here',
    date: '2026-11-15',
    title: 'Feedback on Rainshare',
    summary: 'Post bugs and ideas, vote on them and reply on the Feedback page, linked in the footer.',
    text: 'It’s the same board as Rainshare’s on userinput.app, so posts show in both places. You’ll be asked to sign in again once before you can post.'
  },
  {
    id: 'notifications',
    date: '2026-11-15',
    title: 'Notifications',
    summary: 'The bell in the bar shows when someone starts on your ask, turns in work or comments, and when an ask you worked on is done.',
    text: 'To get these as Bluesky messages too, turn on messages from @rainshare.dev in Settings.'
  }
];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** When a note went out (ms, midnight UTC on its day), or NaN if its date isn't a day. */
export const releasedAt = r => DAY_RE.test(String(r?.date || '')) ? Date.parse(r.date + 'T00:00:00Z') : NaN;
/** The notes that are out by `now`, newest first. */
export const releasesBy = (now = Date.now(), list = RELEASES) => list.filter(r => releasedAt(r) <= now).sort((a, b) => releasedAt(b) - releasedAt(a));
