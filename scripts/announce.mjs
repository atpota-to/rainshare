// Posts the board's new asks to @rainshare.dev, as the daily run on Vercel does
// (api/announce.js), or without --post, says what it would post and posts nothing.
//
//   npm run announce              what would be posted now. Needs no password.
//   npm run announce -- --post    post it, with RAINSHARE_BLUESKY_APP_PASSWORD
//
// Which asks count as new, and how it knows what's been posted already: api/_announce.js.
import { announce } from '../api/_announce.js';

const post = process.argv.includes('--post');
try {
  const out = await announce({ post });
  if (out.posts.some(p => p.error)) process.exitCode = 1;
} catch (e) {
  console.error(`Stopped: ${e?.message || e}`);
  process.exit(1);
}
