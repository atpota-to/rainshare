// When to run (./run.js). Something happening on the board asks for a run soon; an ask that's
// still settling asks for one when it has. Runs happen one at a time, half a minute past a minute
// (OFFSET), because the messages count in whole minutes (./messages.js): a run then has the
// minute before it complete, and the rest of its own to finish in. Asks for a run that land on
// the same moment share it, and one asked for while a run is going happens after it.
export const OFFSET = 30e3;

export function createRunner({ run, every = 60e3, offset = OFFSET, clock = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, log = () => {} }){
  const due = new Set();
  let timer = null, timerAt = null, running = null, stopped = false;
  /** The first run time at or after `t`. */
  const slot = t => Math.ceil((t - offset) / every) * every + offset;
  /** The first run time after the minute `t` is in has ended, so a run then counts what happened at `t`. */
  const after = t => Math.floor(t / every) * every + every + offset;

  function arm(){
    if (stopped || running) return;
    const next = due.size ? Math.min(...due) : null;
    if (next === timerAt) return;
    clearTimer(timer);
    timer = null; timerAt = next;
    if (next != null) timer = setTimer(fire, Math.max(0, next - clock()));
  }
  function fire(){
    timer = null; timerAt = null;
    if (stopped || running) return;
    const t = clock();
    for (const d of due) if (d <= t) due.delete(d);
    running = Promise.resolve().then(run).catch(e => log(`A run failed: ${e?.stack || e}`)).finally(() => { running = null; arm(); });
    return running;
  }
  return {
    /** Ask for a run: soon after now, or with `at`, at the first run time from then. The time it's set for. */
    request(at){
      const t = at == null ? after(clock()) : slot(at);
      due.add(t); arm();
      return t;
    },
    /** The run times asked for, earliest first. */
    pending: () => [...due].sort((a, b) => a - b),
    busy: () => !!running,
    /** Wait for the run in progress, if there is one. */
    idle: () => running || Promise.resolve(),
    stop(){ stopped = true; clearTimer(timer); timer = null; timerAt = null; }
  };
}
