// /api/announce: the daily run. @rainshare.dev posts the board's new asks (./_announce.js), then
// sends the direct messages people have asked for (./_messages.js). Vercel's cron calls it once
// a day (vercel.json), on production only, with CRON_SECRET as its bearer token. Any request
// without that token is turned away, so nobody else can set it off.
//
// With ?dry=1 it says what it would post and send, as JSON, and posts and sends nothing:
//   curl -H "Authorization: Bearer $CRON_SECRET" "https://rainshare.dev/api/announce?dry=1"
import { timingSafeEqual } from 'node:crypto';
import { announce, reader, session } from './_announce.js';
import { message } from './_messages.js';

/** Whether a request carries CRON_SECRET. Without one set, nothing does. */
export function allowed(req, secret = process.env.CRON_SECRET){
  if (!secret) return false;
  const got = Buffer.from(String(req.headers?.authorization || '')), want = Buffer.from('Bearer ' + secret);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Post, then message, reading the network and signing in once for both. One going wrong
 * doesn't stop the other: { posts, messages }, either of which may be { error }.
 */
export async function run({ post = true, password = process.env.RAINSHARE_BLUESKY_APP_PASSWORD, log = console.log } = {}){
  const shared = { post, password, log, read: reader(), as: session(password) };
  const step = (name, fn) => fn(shared).catch(e => { log(`The ${name} stopped: ${e?.stack || e}`); return { error: e?.message || String(e) }; });
  const posts = await step('posts', announce);
  const messages = await step('messages', message);
  return { posts, messages };
}

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body, null, 2));
};

export default async function handler(req, res){
  if (!allowed(req)) return send(res, 401, { error: process.env.CRON_SECRET ? 'Unauthorized' : 'CRON_SECRET isn’t set, so this is switched off.' });
  const dry = /^(1|true|yes)$/i.test(String(req.query?.dry || ''));
  const out = await run({ post: !dry });
  send(res, out.posts.error && out.messages.error ? 502 : 200, out);
}
