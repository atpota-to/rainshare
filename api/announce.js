// /api/announce: posts the board's new asks to @rainshare.dev (./_announce.js). Vercel's cron
// calls it once a day (vercel.json), on production only, with CRON_SECRET as its bearer token.
// Any request without that token is turned away, so nobody else can set it off.
//
// With ?dry=1 it says what it would post, as JSON, and posts nothing:
//   curl -H "Authorization: Bearer $CRON_SECRET" "https://rainshare.dev/api/announce?dry=1"
import { timingSafeEqual } from 'node:crypto';
import { announce } from './_announce.js';

/** Whether a request carries CRON_SECRET. Without one set, nothing does. */
export function allowed(req, secret = process.env.CRON_SECRET){
  if (!secret) return false;
  const got = Buffer.from(String(req.headers?.authorization || '')), want = Buffer.from('Bearer ' + secret);
  return got.length === want.length && timingSafeEqual(got, want);
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
  try { send(res, 200, await announce({ post: !dry })); }
  catch (e) {
    console.error('announce', e);
    send(res, 502, { error: e?.message || String(e) });
  }
}
