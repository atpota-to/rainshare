// The announcer service's own parts (announcer/src/): when it runs (runner.js), what it hears
// from Jetstream (jetstream.js) and its inbox (inbox.js), and the one Bluesky session it keeps
// (session in posts.js). Timers, sockets and the network are stand-ins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner, OFFSET } from '../announcer/src/runner.js';
import { watch, subscribeUrl } from '../announcer/src/jetstream.js';
import { createInbox } from '../announcer/src/inbox.js';
import { session, ACCOUNT, SIGN_IN_PAUSE } from '../announcer/src/posts.js';

// A clock and timers that only move when told to.
function fakeTime(start){
  let now = start, seq = 0;
  const timers = new Map();
  const t = {
    now: () => now,
    setTimer: (fn, ms) => { const id = ++seq; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimer: id => { timers.delete(id); },
    pending: () => [...timers.values()].map(x => x.at).sort((a, b) => a - b),
    // Move to `to`, firing every timer due on the way, in order.
    async advance(to){
      for (;;) {
        const next = [...timers.entries()].filter(([, x]) => x.at <= to).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]); now = next[1].at;
        next[1].fn();                                   // as a real timer does: not waited for
        await new Promise(r => setImmediate(r));
      }
      now = to;
    }
  };
  return t;
}
const T0 = Date.parse('2026-11-14T16:00:10Z');

test('things that happen in the same minute share a run, half a minute after it ends', async () => {
  const time = fakeTime(T0), runs = [];
  const r = createRunner({ run: () => { runs.push(time.now()); }, clock: time.now, setTimer: time.setTimer, clearTimer: time.clearTimer });
  assert.equal(r.request(), Date.parse('2026-11-14T16:01:30Z'));
  await time.advance(Date.parse('2026-11-14T16:00:50Z'));
  r.request();
  assert.deepEqual(r.pending(), [Date.parse('2026-11-14T16:01:30Z')]);
  await time.advance(Date.parse('2026-11-14T16:05:00Z'));
  assert.deepEqual(runs, [Date.parse('2026-11-14T16:01:30Z')]);
  assert.equal(OFFSET, 30e3);
});

test('a run asked for at a time is on the first run time from then, and keeps its place behind earlier ones', async () => {
  const time = fakeTime(T0), runs = [];
  const r = createRunner({ run: () => { runs.push(new Date(time.now()).toISOString()); }, clock: time.now, setTimer: time.setTimer, clearTimer: time.clearTimer });
  r.request(Date.parse('2026-11-14T16:15:05Z'));
  r.request();
  await time.advance(Date.parse('2026-11-14T16:20:00Z'));
  assert.deepEqual(runs, ['2026-11-14T16:01:30.000Z', '2026-11-14T16:15:30.000Z']);
});

test('one run at a time: a run asked for during one comes after it, and one that fails doesn’t stop the next', async () => {
  const time = fakeTime(T0), log = [];
  let release, calls = 0;
  const r = createRunner({
    run: () => { calls++; if (calls === 1) return new Promise(res => { release = res; }); if (calls === 2) throw new Error('boom'); },
    clock: time.now, setTimer: time.setTimer, clearTimer: time.clearTimer, log: s => log.push(s)
  });
  r.request();
  await time.advance(Date.parse('2026-11-14T16:01:30Z'));
  assert.equal(r.busy(), true);
  await time.advance(Date.parse('2026-11-14T16:03:00Z'));
  r.request();                                   // during the first run, which is still going
  await time.advance(Date.parse('2026-11-14T16:04:40Z'));
  assert.equal(calls, 1, 'nothing starts while a run is going');
  release(); await r.idle(); await new Promise(res => setImmediate(res));
  await time.advance(Date.parse('2026-11-14T16:05:00Z'));
  assert.equal(calls, 2, 'the one asked for during it runs once it ends');
  assert.match(log.join('\n'), /boom/);
  r.request();
  await time.advance(Date.parse('2026-11-14T16:07:00Z'));
  assert.equal(calls, 3);
  r.stop(); r.request();
  await time.advance(Date.parse('2026-11-14T16:10:00Z'));
  assert.equal(calls, 3, 'nothing after stop');
});

// A WebSocket stand-in: each one made is kept, to open, send to, fail or close by hand.
function fakeSockets(){
  const made = [];
  class FakeSocket {
    constructor(url){ this.url = url; made.push(this); }
    open(){ this.onopen?.(); }
    send(payload){ this.onmessage?.({ data: JSON.stringify({ $type: 'message', payload }) }); }
    fail(){ this.onerror?.(new Event('error')); }
    close(){ this.closed = true; this.onclose?.({ code: 1000 }); }
  }
  return { made, FakeSocket };
}

test('Jetstream: the collections are asked for one by one, and only their commits come through', () => {
  assert.equal(subscribeUrl('wss://js.example', ['dev.rainshare.seed', 'dev.rainshare.take']),
    'wss://js.example/xrpc/network.bsky.jetstream.subscribeEvents?collections=dev.rainshare.seed&collections=dev.rainshare.take&kinds=commit');
  const time = fakeTime(T0), { made, FakeSocket } = fakeSockets(), events = [], states = [];
  const w = watch({ hosts: ['wss://a.example'], collections: ['dev.rainshare.seed'], onEvent: e => events.push(e), onState: s => states.push(s.connected), WebSocketImpl: FakeSocket, setTimer: time.setTimer, clearTimer: time.clearTimer });
  made[0].open();
  made[0].send({ collection: 'dev.rainshare.seed', operation: 'create', did: 'did:plc:a', rkey: '1' });
  made[0].send({ collection: 'app.bsky.feed.like', operation: 'create' });
  made[0].onmessage({ data: 'not json' });
  assert.deepEqual(events.map(e => e.rkey), ['1']);
  assert.deepEqual(states, [true]);
  w.close();
});

test('Jetstream: a host that won’t open is skipped for the next, one that drops is tried again, and it waits longer each time', async () => {
  const time = fakeTime(T0), { made, FakeSocket } = fakeSockets();
  const w = watch({ hosts: ['wss://a.example', 'wss://b.example'], collections: ['dev.rainshare.seed'], onEvent: () => {}, WebSocketImpl: FakeSocket, setTimer: time.setTimer, clearTimer: time.clearTimer });
  made[0].fail();                                                  // a.example won't open
  assert.deepEqual(time.pending().map(t => t - T0), [1000]);
  await time.advance(T0 + 1000);
  assert.match(made[1].url, /^wss:\/\/b\.example/);
  made[1].open(); made[1].close();                                  // b.example opened, then dropped
  await time.advance(T0 + 1000 + 1000);
  assert.match(made[2].url, /^wss:\/\/b\.example/, 'tried again');
  made[2].fail(); made[2].onclose?.({ code: 1006 });               // error and close both: one retry
  assert.equal(time.pending().length, 1);
  w.close();
  await time.advance(T0 + 60e3);
  assert.equal(made.length, 3, 'nothing after close');
});

test('Jetstream: a connection that has been quiet too long is replaced', async () => {
  const time = fakeTime(T0), { made, FakeSocket } = fakeSockets();
  const w = watch({ hosts: ['wss://a.example'], collections: ['dev.rainshare.seed'], onEvent: () => {}, WebSocketImpl: FakeSocket, setTimer: time.setTimer, clearTimer: time.clearTimer, quiet: 60e3 });
  made[0].open();
  await time.advance(T0 + 30e3);
  made[0].send({ collection: 'dev.rainshare.seed' });             // something heard: the wait starts again
  await time.advance(T0 + 80e3);
  assert.equal(made.length, 1);
  await time.advance(T0 + 95e3);
  assert.equal(made.length, 2, 'a new connection after a minute of nothing');
  w.close();
});

test('the inbox asks for a run when someone has written since the last look, and not for the account’s own', async () => {
  let convos = [], heard = 0;
  const as = { get: async (nsid, p, o) => { assert.equal(nsid, 'chat.bsky.convo.listConvos'); assert.equal(o.chat, true); return { convos }; } };
  const inbox = createInbox({ as, account: ACCOUNT, onReply: () => heard++, clock: () => Date.parse('2026-11-14T16:00:00Z') });
  convos = [{ lastMessage: { sender: { did: 'did:plc:alice' }, sentAt: '2026-11-14T15:59:00Z' } }, { lastMessage: { sender: { did: ACCOUNT }, sentAt: '2026-11-14T16:01:00Z' } }];
  assert.equal(await inbox.check(), false, 'from before it started, and its own');
  convos.push({ lastMessage: { sender: { did: 'did:plc:bob' }, sentAt: '2026-11-14T16:02:00Z' } });
  assert.equal(await inbox.check(), true);
  assert.equal(await inbox.check(), false, 'and only once');
  assert.equal(heard, 1);
});

// The account's server, for the session's tests. It hands out access and refresh tokens; `expire()`
// makes the access token it gave last no good, as time would, while its refresh token still works.
function fakeServer(){
  const calls = [];
  let password = 'right', n = 0, access = null, refresh = null, refreshes = 0;
  const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
  const issue = () => { n++; access = 'a' + n; refresh = 'r' + n; return json({ accessJwt: access, refreshJwt: refresh }); };
  globalThis.fetch = async (input, init = {}) => {
    const u = new URL(String(input)), nsid = u.pathname.split('/').pop(), auth = init.headers?.authorization;
    calls.push(nsid);
    if (u.host === 'plc.directory') return json({ id: ACCOUNT, service: [{ id: '#atproto_pds', serviceEndpoint: 'https://pds.test' }] });
    if (nsid === 'com.atproto.server.createSession') return JSON.parse(init.body).password === password ? issue() : json({ error: 'AuthenticationRequired', message: 'Invalid identifier or password' }, 401);
    if (nsid === 'com.atproto.server.refreshSession') { refreshes++; return auth === 'Bearer ' + refresh ? issue() : json({ error: 'ExpiredToken' }, 400); }
    if (nsid === 'chat.test.scoped') return json({ error: 'InvalidToken', message: 'Bad token scope' }, 400);
    return auth === 'Bearer ' + access ? json({ ok: true, token: auth }) : json({ error: 'ExpiredToken', message: 'Token has expired' }, 400);
  };
  return { calls, expire: () => { access = 'expired'; }, setPassword: p => { password = p; }, refreshes: () => refreshes, signIns: () => calls.filter(c => c === 'com.atproto.server.createSession').length };
}

test('the session is renewed when its token expires, once for every call that found it so, and never signed in again', async () => {
  const server = fakeServer(), as = session('right');
  assert.deepEqual(await as.get('app.test.ping'), { ok: true, token: 'Bearer a1' });
  server.expire();
  const [x, y] = await Promise.all([as.get('app.test.ping'), as.post('app.test.ping', {})]);
  assert.deepEqual([x.token, y.token], ['Bearer a2', 'Bearer a2'], 'both made again with the renewed token');
  assert.deepEqual([server.refreshes(), server.signIns()], [1, 1], 'one renewal for both, and the one sign-in from the start');
});

test('a sign-in that fails isn’t tried again for half an hour, and a missing permission isn’t taken for an expired token', async () => {
  const server = fakeServer();
  server.setPassword('other');
  let now = Date.parse('2026-11-14T16:00:00Z');
  const as = session('right', { clock: () => now });
  await assert.rejects(as.signIn(), /Invalid identifier or password/);
  await assert.rejects(as.signIn(), /Invalid identifier or password/);
  assert.equal(server.signIns(), 1, 'tried once, not on every run');
  now += SIGN_IN_PAUSE + 1;
  server.setPassword('right');
  await as.signIn();
  assert.equal(server.signIns(), 2, 'and again after the pause');
  await assert.rejects(as.get('chat.test.scoped', {}, { chat: true }), /Bad token scope/);
  assert.equal(server.refreshes(), 0, 'no renewal for a missing permission');
});
