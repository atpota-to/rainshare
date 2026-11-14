// One run: @rainshare.dev posts the board's new asks (./posts.js), then sends the direct messages
// people have asked for (./messages.js). The announcer service (./index.js) calls this whenever
// something happens on the board, and `npm run announce` calls it by hand.
import { announce, reader, session } from './posts.js';
import { message } from './messages.js';

/**
 * Post, then message, reading the network once for both. One going wrong doesn't stop the other:
 * { posts, messages }, either of which may be { error }. `as` is a session (./posts.js) to use,
 * which the service keeps between runs so it isn't signing in each time.
 */
export async function run({ post = true, password = process.env.RAINSHARE_BLUESKY_APP_PASSWORD, now = Date.now(), log = console.log, as = session(password) } = {}){
  const shared = { post, password, now, log, read: reader(), as };
  const step = (name, fn) => fn(shared).catch(e => { log(`The ${name} stopped: ${e?.stack || e}`); return { error: e?.message || String(e) }; });
  const posts = await step('posts', announce);
  const messages = await step('messages', message);
  return { posts, messages };
}
