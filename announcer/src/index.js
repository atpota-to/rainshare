// The announcer: @rainshare.dev's posts and messages, as a service that stays up. It runs on the
// droplet (../README.md says how it's set up, and ../../droplet/ how it's deployed).
//
// It listens to Jetstream (./jetstream.js) for Rainshare's own records, so when someone asks,
// says they're on something, turns work in, marks an ask done or changes their settings, a run
// (./run.js) follows within a minute or two: a post for each new ask nobody's on (./posts.js),
// and the messages people asked for (./messages.js). It also runs:
//   - when a new ask has settled (SETTLE, ./posts.js), since that's when it can be posted
//   - when someone writes to the account (./inbox.js), so a STOP is answered quickly
//   - every SWEEP_MINUTES, for whatever the rest missed (a dropped connection, a restart) and
//     whatever only time brings (a take lapsing, the day's new asks after 15:45 UTC)
// It keeps one Bluesky session for as long as it's up (./posts.js), rather than signing in
// each run: an account can only sign in 300 times a day.
//
// Settings, from the environment (the systemd unit reads .env in the working directory):
//   MODE=dry                    the default: every run says what it would post and send, and
//                               does neither. MODE=live posts and sends.
//   RAINSHARE_BLUESKY_APP_PASSWORD   an app password for @rainshare.dev, with direct messages allowed
//   RAINSHARE_SITE              where the site is, for links (https://rainshare.dev)
//   PORT                        for GET /health, on 127.0.0.1 only (8792)
//   SWEEP_MINUTES               15
//   INBOX_SECONDS               how often to look for replies (60)
//   JETSTREAM_HOSTS             comma-separated (us-east, then us-west)
// and a file named KILL in the working directory makes every run a dry one, at once, with no
// restart: `touch KILL` to go quiet, `rm KILL` to carry on.
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { SEED, TAKE, DELIVERY, PREFERENCES } from '../../core/ns.js';
import { run } from './run.js';
import { session, ACCOUNT, SETTLE } from './posts.js';
import { createRunner } from './runner.js';
import { watch } from './jetstream.js';
import { createInbox } from './inbox.js';

const env = process.env;
const config = {
  mode: env.MODE === 'live' ? 'live' : 'dry',
  password: env.RAINSHARE_BLUESKY_APP_PASSWORD || '',
  port: Number(env.PORT) || 8792,
  sweepMs: Math.max(1, Number(env.SWEEP_MINUTES) || 15) * 60e3,
  inboxMs: Math.max(30, Number(env.INBOX_SECONDS) || 60) * 1e3,
  hosts: (env.JETSTREAM_HOSTS || 'wss://jetstream.us-east.bsky.network,wss://jetstream.us-west.bsky.network').split(',').map(s => s.trim()).filter(Boolean),
  kill: env.KILL_FILE || 'KILL'
};
// What's worth a run: asks, takes, turn-ins, and people's settings. (What @rainshare.dev hides
// takes effect at the next run anyway, and profiles change nothing here.)
const WATCH = [SEED, TAKE, DELIVERY, PREFERENCES];

const log = (...a) => console.log(...a);
const status = { ok: true, mode: config.mode, startedAt: new Date().toISOString(), jetstream: { connected: false, host: null }, lastEvent: null, lastRun: null, runs: 0 };
const as = session(config.password);

const counted = r => r?.error ? { error: r.error } : {
  ...('posts' in (r || {}) ? { posted: r.posts.filter(p => p.uri).length, failed: r.posts.filter(p => p.error).length, waiting: r.later } : {}),
  ...('sent' in (r || {}) ? { sent: r.sent.filter(s => !s.error).length, failed: r.sent.filter(s => s.error).length, asked: r.asked } : {}),
  ...(r?.note ? { note: r.note } : {})
};
async function once(){
  const killed = existsSync(config.kill), post = config.mode === 'live' && !killed && !!config.password, at = Date.now();
  if (config.mode === 'live' && killed) log('KILL is there, so this run posts and sends nothing.');
  const out = await run({ post, password: config.password, now: at, as, log });
  status.runs++;
  status.lastRun = { at: new Date(at).toISOString(), seconds: (Date.now() - at) / 1000, live: post, killed, posts: counted(out.posts), messages: counted(out.messages) };
  log(`Run done in ${status.lastRun.seconds}s: ${JSON.stringify({ posts: status.lastRun.posts, messages: status.lastRun.messages })}`);
}

const runner = createRunner({ run: once, log });
const jet = watch({
  hosts: config.hosts, collections: WATCH, log,
  onState: s => { status.jetstream = s; },
  onEvent: e => {
    status.lastEvent = { at: new Date().toISOString(), collection: e.collection, operation: e.operation };
    runner.request();
    // A new ask can be posted once it has settled: a run then, too.
    const asked = Date.parse(e.record?.createdAt), now = Date.now();
    if (e.collection === SEED && e.operation === 'create' && asked > now - SETTLE && asked < now + 60e3) runner.request(asked + SETTLE + 5e3);
  }
});
const inbox = config.password ? createInbox({ as, account: ACCOUNT, onReply: () => runner.request() }) : null;
const looking = inbox && setInterval(() => inbox.check().catch(e => log(`Couldn't look for replies: ${e?.message || e}`)), config.inboxMs);
const sweeping = setInterval(() => runner.request(), config.sweepMs);
runner.request();

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ...status, killed: existsSync(config.kill), pending: runner.pending().map(t => new Date(t).toISOString()) }));
  } else { res.writeHead(404); res.end(); }
}).listen(config.port, '127.0.0.1', () => log(`Announcer up (${config.mode}${config.password ? '' : ', no password, so nothing is posted or sent'}), health on 127.0.0.1:${config.port}.`));

process.on('unhandledRejection', e => log(`Unhandled: ${e?.stack || e}`));
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => {
  if (stopping) return;
  stopping = true;
  log(`${signal}: finishing the run in progress, if there is one, then stopping.`);
  runner.stop(); jet.close(); clearInterval(sweeping); if (looking) clearInterval(looking); server.close();
  await Promise.race([runner.idle(), new Promise(r => setTimeout(r, 20e3))]);
  process.exit(0);
});
