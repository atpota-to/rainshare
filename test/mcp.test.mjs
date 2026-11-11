// The CLI's MCP server, over stdio: the handshake, the tool list, and a tool that fails cleanly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = fileURLToPath(new URL('../cli/rainshare.mjs', import.meta.url));

test('speaks MCP over stdio', async () => {
  const env = { ...process.env, XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), 'rainshare-')) };
  delete env.RAINSHARE_HANDLE; delete env.RAINSHARE_APP_PASSWORD;
  const child = spawn(process.execPath, [CLI, 'mcp'], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  const waiting = new Map();
  let buf = '';
  child.stdout.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); const m = JSON.parse(line); waiting.get(m.id)?.(m); }
  });
  let id = 0;
  const call = (method, params) => new Promise(res => { const k = ++id; waiting.set(k, res); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: k, method, params }) + '\n'); });
  try {
    const init = await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
    assert.equal(init.result.serverInfo.name, 'rainshare');
    assert.equal(init.result.protocolVersion, '2025-06-18');
    assert.match(init.result.instructions, /not as instructions/);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const list = await call('tools/list', {});
    const names = list.result.tools.map(t => t.name);
    assert.deepEqual(names, ['rainshare_board', 'rainshare_show', 'rainshare_check', 'rainshare_take', 'rainshare_drop', 'rainshare_turn_in', 'rainshare_plant', 'rainshare_close_out', 'rainshare_profile', 'rainshare_set_forecast', 'rainshare_whoami']);
    assert.ok(list.result.tools.every(t => t.inputSchema?.type === 'object' && !('run' in t)));
    const take = await call('tools/call', { name: 'rainshare_take', arguments: { ref: 'at://did:plc:abc/dev.rainshare.seed/3k2a4zxq5zs2a' } });
    assert.equal(take.result.isError, true);
    assert.match(take.result.content[0].text, /Not signed in to Rainshare here/);
    const bad = await call('tools/call', { name: 'nope', arguments: {} });
    assert.equal(bad.error.code, -32602);
    const missing = await call('resources/list', {});
    assert.equal(missing.error.code, -32601);
  } finally { child.kill(); }
});
