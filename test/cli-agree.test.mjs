// The CLI's agree step (cli/rainshare.mjs), run for real against a made-up network
// (./fixtures/fake-net.mjs): a first job or ask needs the terms agreed to, an agent can't do
// that for its user, and having agreed anywhere as the account counts here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LEGAL_VERSION } from '../core/legal.js';
import { agreementNow, LEDGER } from '../core/agreement.js';
import { PREFERENCES } from '../core/ns.js';

const CLI = fileURLToPath(new URL('../cli/rainshare.mjs', import.meta.url)), NET = new URL('./fixtures/fake-net.mjs', import.meta.url).href;
const HELPER = 'did:plc:helper', ASK = 'at://did:plc:asker/dev.rainshare.seed/3k2a4zxq5zs2a';

// Somewhere to keep a sign-in (and what's been agreed to), as the CLI would have left it.
function home({ agreed } = {}){
  const dir = mkdtempSync(join(tmpdir(), 'rainshare-agree-')), cfg = join(dir, 'rainshare');
  mkdirSync(cfg);
  writeFileSync(join(cfg, 'session.json'), JSON.stringify({ did: HELPER, handle: 'helper.test', pds: 'https://pds.test', accessJwt: 'a', refreshJwt: 'r' }));
  if (agreed) writeFileSync(join(cfg, 'agreed.json'), JSON.stringify({ [HELPER]: agreed }));
  return { dir, agreedFile: join(cfg, 'agreed.json'), log: join(dir, 'net.log') };
}
const envFor = (h, world = {}) => { const e = { ...process.env, XDG_CONFIG_HOME: h.dir, RAINSHARE_TEST_NET: JSON.stringify(world), RAINSHARE_TEST_LOG: h.log }; delete e.RAINSHARE_HANDLE; delete e.RAINSHARE_APP_PASSWORD; return e; };
const asked = h => existsSync(h.log) ? readFileSync(h.log, 'utf8') : '';

/** Run the CLI once, with nobody at the keyboard: { code, out, err }. */
function run(args, h, world){
  return new Promise(res => {
    const child = spawn(process.execPath, ['--import', NET, CLI, ...args], { env: envFor(h, world), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { err += d; });
    child.on('close', code => res({ code, out, err }));
  });
}
/** Call one MCP tool on the CLI's server: the text it answers with, and whether it's an error. */
async function tool(name, args, h, world){
  const child = spawn(process.execPath, ['--import', NET, CLI, 'mcp'], { env: envFor(h, world), stdio: ['pipe', 'pipe', 'pipe'] });
  const waiting = new Map(); let buf = '', id = 0;
  child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); waiting.get(m.id)?.(m); } });
  const call = (method, params) => new Promise(res => { const k = ++id; waiting.set(k, res); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: k, method, params }) + '\n'); });
  try {
    const init = await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
    const r = await call('tools/call', { name, arguments: args });
    return { text: r.result.content[0].text, isError: !!r.result.isError, instructions: init.result.instructions };
  } finally { child.kill(); }
}

test('an agent can’t take a job, turn one in or ask until its user has agreed, and is told what they need to do', async () => {
  const h = home();
  for (const [name, args] of [['rainshare_take', { ref: ASK }], ['rainshare_turn_in', { ref: ASK, url: 'https://github.com/o/r/pull/1' }], ['rainshare_open_pr', { ref: ASK, branch: 'fix' }], ['rainshare_ask', { title: 'An idea' }]]) {
    const r = await tool(name, args, h);
    assert.equal(r.isError, true, name);
    assert.match(r.text, /Your user hasn’t agreed to Rainshare’s terms yet[\s\S]*agree` in a terminal[\s\S]*Don’t agree for them\./, name);
    assert.match(r.instructions, /Never agree for them, and don’t run that command yourself/);
  }
  // Nothing was written anywhere, and the ledger wasn't told.
  assert.doesNotMatch(asked(h), /createRecord|putRecord|rainshare-agree/);
  assert.equal(existsSync(h.agreedFile), false);
  // Reading is as it was: no agreement needed to look.
  const look = await tool('rainshare_show', { ref: ASK }, h);
  assert.equal(look.isError, false);
  assert.match(look.text, /A seating chart that shuffles itself/);
});

test('from a script, the CLI says to agree first, and `agree` itself is only for a person in a terminal', async () => {
  const h = home();
  const take = await run(['take', ASK], h);
  assert.notEqual(take.code, 0);
  assert.match(take.err, /Before your first job or ask, agree to Rainshare’s terms: run `[^`]*agree` in a terminal/);
  const agree = await run(['agree'], h);
  assert.notEqual(agree.code, 0);
  assert.match(agree.err, /Agreeing is for a person to do, in a terminal/);
  assert.doesNotMatch(asked(h), /createRecord|putRecord|rainshare-agree/);
  // Checking what's set up says so too.
  assert.match((await run(['doctor'], h)).out, /✗ Not agreed to Rainshare’s terms yet/);
});

test('having agreed here before, or anywhere as the account, is enough: the job goes ahead', async () => {
  // Here before, and the ledger has it.
  let h = home({ agreed: { version: LEGAL_VERSION, at: '2026-11-14T18:00:00.000Z', logged: true } });
  let r = await tool('rainshare_take', { ref: ASK }, h);
  assert.equal(r.isError, false, r.text);
  assert.match(r.text, /^You’re on it: A seating chart that shuffles itself/);
  assert.match(asked(h), /POST pds\.test\/xrpc\/com\.atproto\.repo\.createRecord [^\n]*dev\.rainshare\.take/);
  assert.doesNotMatch(asked(h), /rainshare-agree/);

  // On the site, or on another machine: their settings say so, and now this machine knows.
  h = home();
  const prefs = { $type: PREFERENCES, terms: agreementNow(Date.parse('2026-11-14T17:00:00Z')), createdAt: '2026-11-14T17:00:00.000Z' };
  r = await tool('rainshare_take', { ref: ASK }, h, { prefs });
  assert.equal(r.isError, false, r.text);
  assert.deepEqual(JSON.parse(readFileSync(h.agreedFile, 'utf8'))[HELPER], { version: LEGAL_VERSION, at: '2026-11-14T17:00:00.000Z' });
  assert.match((await run(['doctor'], h, { prefs })).out, /✓ Agreed to Rainshare’s terms/);

  // Agreed here, but the ledger didn't answer then: it's told now, and that's remembered.
  h = home({ agreed: { version: LEGAL_VERSION, at: '2026-11-14T18:00:00.000Z', logged: false } });
  r = await tool('rainshare_take', { ref: ASK }, h);
  assert.equal(r.isError, false, r.text);
  assert.match(asked(h), new RegExp(`POST ${new URL(LEDGER).host}/functions/v1/rainshare-agree \\{"did":"did:plc:helper","version":"${LEGAL_VERSION}","via":"cli"\\}`));
  assert.equal(JSON.parse(readFileSync(h.agreedFile, 'utf8'))[HELPER].logged, true);

  // Older terms agreed to, here or in their settings: not enough.
  h = home({ agreed: { version: '2020-01-01', at: 'x', logged: true } });
  r = await tool('rainshare_take', { ref: ASK }, h, { prefs: { $type: PREFERENCES, terms: { version: '2020-01-01', agreedAt: '2020-01-01T00:00:00.000Z' } } });
  assert.equal(r.isError, true);
  assert.match(r.text, /hasn’t agreed to Rainshare’s terms yet/);
});
