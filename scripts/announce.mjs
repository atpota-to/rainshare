// One run of the announcer by hand (announcer/src/run.js): @rainshare.dev's post for the day,
// saying how many new asks there are, and the direct messages people have asked for. Without
// --post, it says what it would post and send, and posts and sends nothing. The service on the droplet (announcer/)
// does this by itself; this is for looking, or for a run while it's down.
//
//   npm run announce              what would go out now. Needs no password, though with one
//                                 it can read the account's conversations, and so knows what
//                                 each person has already been sent.
//   npm run announce -- --post    post and send, with RAINSHARE_BLUESKY_APP_PASSWORD
//
// What counts as new, and how it knows what's gone out already: announcer/src/posts.js and messages.js.
import { run } from '../announcer/src/run.js';

const out = await run({ post: process.argv.includes('--post') });
const failed = [out.posts.error, out.messages.error, out.posts.post?.error, ...(out.posts.takenDown || []).map(t => t.error), ...(out.messages.sent || []).map(s => s.error), out.messages.note].filter(Boolean);
if (failed.length) process.exitCode = 1;
