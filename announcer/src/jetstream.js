// Rainshare's own records as they're written, from Jetstream: only the collections asked for, so
// it's a trickle. They're only a nudge to run (./runner.js), and every run reads what it needs
// from the network itself, so nothing here has to be exact: no cursor is kept, and an event
// missed while the connection is down is caught by the next sweep (./index.js).
//
// Jetstream v2, as atpota-to/atpota.to's mentions/src/jetstream.js found it on 2026-09-18:
//   wss://<host>/xrpc/network.bsky.jetstream.subscribeEvents?collections=…&kinds=commit
// with the collection given once per value (collections=a&collections=b; a comma-separated list
// is refused), and each event as { $type: 'message', payload: { did, collection, rkey,
// operation, record, seq, time, … } }. A failed upgrade fires `error` and, in Node, not always
// `close`, so both end an attempt, once.
export const PATH = '/xrpc/network.bsky.jetstream.subscribeEvents';
const QUIET = 30 * 60e3;   // reconnect after this long with nothing, in case the connection died unseen

/** The address to subscribe at. */
export function subscribeUrl(host, collections){
  const u = new URL(PATH, host.replace(/^ws/, 'http'));
  u.protocol = host.startsWith('wss') ? 'wss:' : 'ws:';
  for (const c of collections) u.searchParams.append('collections', c);
  u.searchParams.set('kinds', 'commit');
  return u.toString();
}

/**
 * Watch `collections` on Jetstream, trying each of `hosts` in turn. `onEvent(payload)` for each
 * commit; `onState({ connected, host })` as the connection comes and goes.
 */
export function watch({ hosts, collections, onEvent, onState = () => {}, log = () => {}, WebSocketImpl = globalThis.WebSocket, setTimer = setTimeout, clearTimer = clearTimeout, quiet = QUIET }){
  let i = 0, ws = null, closed = false, backoff = 1000, retry = null, idle = null, settleCurrent = null;
  // Nothing for `quiet`: end this connection and make another, in case it died without saying.
  const rest = () => {
    clearTimer(idle);
    idle = setTimer(() => { log('Jetstream has been quiet a while; reconnecting.'); try { ws?.close(); } catch (_) { /* gone */ } settleCurrent?.(); }, quiet);
  };

  function connect(){
    if (closed) return;
    const host = hosts[i % hosts.length];
    let sock;
    try { sock = new WebSocketImpl(subscribeUrl(host, collections)); }
    catch (e) { log(`Jetstream: couldn't open ${host}: ${e?.message || e}`); i++; schedule(); return; }
    ws = sock;
    let opened = false, settled = false;
    const settle = () => {
      if (settled || ws !== sock || closed) return;
      settled = true; settleCurrent = null; clearTimer(idle);
      onState({ connected: false, host });
      // A host that wouldn't open is skipped for the next; one that dropped is tried again.
      if (!opened) i++;
      schedule();
    };
    settleCurrent = settle;
    sock.onopen = () => {
      if (ws !== sock) return;
      opened = true; backoff = 1000;
      onState({ connected: true, host });
      log(`Jetstream: connected to ${host}.`);
      rest();
    };
    sock.onmessage = m => {
      if (ws !== sock) return;
      rest();
      let e;
      try { e = JSON.parse(typeof m.data === 'string' ? m.data : Buffer.from(m.data).toString('utf8')); } catch (_) { return; }
      const p = e?.payload ?? e;
      if (typeof p?.collection !== 'string' || !collections.includes(p.collection)) return;
      try { onEvent(p); } catch (err) { log(`Jetstream: an event's handler threw: ${err?.stack || err}`); }
    };
    sock.onerror = settle;
    sock.onclose = settle;
  }
  function schedule(){
    if (closed) return;
    clearTimer(retry);
    retry = setTimer(connect, backoff);
    backoff = Math.min(backoff * 2, 60e3);
  }
  connect();
  return {
    close(){ closed = true; clearTimer(retry); clearTimer(idle); try { ws?.close(); } catch (_) { /* gone */ } }
  };
}
