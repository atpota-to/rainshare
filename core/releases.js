// What's new on Rainshare: the release notes, newest first. Each one is on the What's new page
// (/releases, in the footer), and in the bell in the bar, where it's marked new for anyone who
// hasn't opened the bell since it went out (./notices.js).
//
// Not every change needs one. Write one when something people use has changed and they'd want
// to know: a new thing they can do, something that works differently now, or something they
// should check. To add one, put it at the top of the list:
//
//   id       a short name, in lowercase words joined by dashes. It's how the bell knows who's
//            seen it, so never change or reuse one once it's out.
//   date     the day it goes out, as YYYY-MM-DD. One dated after today stays out of sight
//            until that day, so a note can be written ahead of what it's about.
//   title    what changed, in a few words
//   summary  one sentence, for the bell
//   text     (optional) the rest, in Markdown (./markdown.js), for the page
//
// The bell only lists notes from the last 30 days; the page has them all. `npm test` checks
// the list (test/notices.test.mjs).
export const RELEASES = [
  {
    id: 'feedback-here',
    date: '2026-11-15',
    title: 'Feedback, right here',
    summary: 'Post bugs and ideas, vote for what you’d like next, and reply, on Rainshare’s own feedback page. Sign in again once to switch it on.',
    text: `**Feedback** (in the footer, and the menu under your face) is where to say what’s broken or what you’d like Rainshare to do. Now you can do all of it there:

- post a bug, a request, a question or an idea, with a category
- vote for the posts you want most, and take a vote back
- reply to a post, or to someone’s reply
- change or delete what you’ve posted

It’s Rainshare’s board on userinput.app, and what you write is kept in your own account, as userinput.app’s own records, so it shows there too, and what’s posted there shows here. Each post says where it stands (planned, in progress, done), with a note from the moderators when there is one.

Rainshare asks for a little more when you sign in now, so your sign-in needs refreshing once: you’ll be asked to **sign in again**, and you come straight back, still signed in. If you put it off, it’s in the menu under your face.`
  },
  {
    id: 'notifications',
    date: '2026-11-15',
    title: 'A bell for what’s happened',
    summary: 'The bell in the bar says when someone’s on your ask, turns in work, comments or replies, or when an ask you helped with is done.',
    text: `Signed in, there’s a bell beside your face in the bar. Its number is how much has happened since you last opened it:

- someone said they’re on one of your asks, or turned in work on it
- an ask you were on was marked done, with your work or someone else’s, or was closed
- someone commented on one of your asks, or replied to a comment of yours
- whoever asked commented on an ask you’re on

Notes like this one are in it too, when something on Rainshare changes. They’re all on this page.

Comments on a Tangled or knotless issue stay with the issue, so the forge tells you about those. What you’ve seen is kept in this browser, so another browser or device starts afresh. To hear about your asks and your work on Bluesky as well, turn on messages from @rainshare.dev in your settings.`
  }
];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** When a note went out (ms, midnight UTC on its day), or NaN if its date isn't a day. */
export const releasedAt = r => DAY_RE.test(String(r?.date || '')) ? Date.parse(r.date + 'T00:00:00Z') : NaN;
/** The notes that are out by `now`, newest first. */
export const releasesBy = (now = Date.now(), list = RELEASES) => list.filter(r => releasedAt(r) <= now).sort((a, b) => releasedAt(b) - releasedAt(a));
