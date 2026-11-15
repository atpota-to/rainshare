// One run: the approver's answers are taken and the next ask is put to them (./review.js), then
// @rainshare.dev posts the board's new asks they've said yes to (./posts.js), then sends the
// direct messages people have asked for (./messages.js). The announcer service (./index.js) calls
// this whenever something happens on the board, and `npm run announce` calls it by hand.
import { announce, reader, session } from './posts.js';
import { message } from './messages.js';
import { review } from './review.js';
import { indexDb } from './index-db.js';

/**
 * Review, post, then message, reading the network (or the index, while it's fresh) once for all
 * three. One going wrong doesn't stop the others: { review, posts, messages }, any of which may be
 * { error }. `as` is a session (./posts.js) to use, which the service keeps between runs so it
 * isn't signing in each time. `db` is the index (./index-db.js), or null without one.
 */
export async function run({ post = true, password = process.env.RAINSHARE_BLUESKY_APP_PASSWORD, now = Date.now(), log = console.log, as = session(password), db = indexDb(), read = reader({ db, log }) } = {}){
  const shared = { post, password, now, log, read, as, db };
  const step = (name, fn) => fn(shared).catch(e => { log(`The ${name} stopped: ${e?.stack || e}`); return { error: e?.message || String(e) }; });
  const reviewed = await step('review', review);
  const posts = await step('posts', announce);
  const messages = await step('messages', message);
  return { review: reviewed, posts, messages };
}
