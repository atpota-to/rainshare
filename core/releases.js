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
import { SITE } from './ns.js';

export const RELEASES = [
  {
    id: 'terms-guidelines-privacy-copy',
    date: '2026-11-15',
    title: 'The terms point to the guidelines, and the Privacy Policy covers our copy',
    summary: 'The Terms now say an ask that goes against the community guidelines can be hidden, so you’ll be asked to agree once more. The Privacy Policy says what Rainshare keeps, and how to be left out.',
    text: `Two documents changed.

**The Terms of Service** have one new thing in them, under Moderation: an ask that goes against the [community guidelines](${SITE}/guidelines) can be hidden, as one that breaks the terms or puts people at risk already could. Going against the guidelines isn’t a breach of the terms by itself. Because the terms changed, Rainshare asks you to agree once more, before your next job or ask.

**The Privacy Policy** now covers two things Rainshare keeps in a database of its own, beside the note that you agreed to the terms:

- a copy of every Rainshare record: asks, who’s working on what, work turned in, comments, profiles and settings. These are the public records that are in your own account, and anyone can read our copy as well. When you delete a record, our copy is deleted too, normally within a few seconds. You can also ask us to keep your records out of the copy while they stay in your account.
- a note for each ask of whether @rainshare.dev may post it or send it to anyone. It isn’t open to the public, and it’s deleted when our copy of the ask is.

The [Privacy Policy](${SITE}/privacy) says what’s in each, who can read them and when they go.`
  },
  {
    id: 'community-guidelines',
    date: '2026-11-15',
    title: 'Community guidelines',
    summary: 'There are now community guidelines for what to ask for, and a person reads each new ask before @rainshare.dev shares it.',
    text: `The [community guidelines](${SITE}/guidelines) say what kinds of asks fit Rainshare. Most of it is what the terms already said. Two things are new and spelled out:

- no paid work passed on to helpers, such as bug bounties or client work
- no hunting for security holes in software that isn’t yours

A person now reads every new ask before @rainshare.dev posts it on Bluesky or sends it in anyone’s messages. Your ask is on the board straight away, as before. If you edit it, it’s read again.`
  },
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
