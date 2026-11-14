// The daily run by hand (api/announce.js): @rainshare.dev posts the board's new asks and sends
// the direct messages people have asked for. Without --post, it says what it would post and
// send, and posts and sends nothing.
//
//   npm run announce              what would go out now. Needs no password, though with one
//                                 it can read the account's conversations, and so knows what
//                                 each person has already been sent.
//   npm run announce -- --post    post and send, with RAINSHARE_BLUESKY_APP_PASSWORD
//
// What counts as new, and how it knows what's gone out already: api/_announce.js and api/_messages.js.
import { run } from '../api/announce.js';

const out = await run({ post: process.argv.includes('--post') });
const failed = [out.posts.error, out.messages.error, ...(out.posts.posts || []).map(p => p.error), ...(out.messages.sent || []).map(s => s.error), out.messages.note].filter(Boolean);
if (failed.length) process.exitCode = 1;
