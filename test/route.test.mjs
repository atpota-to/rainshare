// Addresses the app doesn't have, and what each was probably meant to be (core/route.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { known, reroute, closeTo, editDistance } from '../core/route.js';

test('the addresses the app has', () => {
  for (const sub of ['', 'board', 'new', 'me', 'agents', 'profile/did:plc:abc', 'profile/someone.example', 'seed/someone.example/3k1', 'seed/did:plc:abc/3k1', 'seed/s/YXQ6Ly9z']) assert.ok(known(sub), sub);
  for (const sub of ['nope', 'seed', 'seed/someone.example', 'profile/a/b', 'u', 'u/did:plc:abc', 'u/a/b', 'seed/a/b/c', 'New', 'Board', 'board/x', 'agents/x', 'seed/s/not valid!']) assert.ok(!known(sub), sub);
});

test('a link that was cut short, or picked something up on the way, still arrives', () => {
  const cases = {
    // the full stop that ended the sentence a link was in, and other things that ride along
    'seed/someone.example/3k1.': 'seed/someone.example/3k1',
    'seed/someone.example/3k1).': 'seed/someone.example/3k1',
    'seed/someone.example/3k1/': 'seed/someone.example/3k1',
    'Seed/Someone.Example/3k1': 'seed/someone.example/3k1',
    'profile/someone.example,': 'profile/someone.example',
    'profile/@someone.example': 'profile/someone.example',
    'Profile/Someone.Example': 'profile/someone.example',
    'AGENTS': 'agents',
    'agents/': 'agents',
    // an ask's link without its key leads to whoever asked
    'seed/someone.example': 'profile/someone.example',
    // other ways of saying the same thing
    'someone.example/3k1': 'seed/someone.example/3k1',
    'profile/someone.example/3k1': 'seed/someone.example/3k1',
    'u/someone.example/3k1': 'seed/someone.example/3k1',
    'ask/did:plc:abc/3k1': 'seed/did:plc:abc/3k1',
    'at://did:plc:abc/dev.rainshare.seed/3k1': 'seed/did:plc:abc/3k1',
    '@someone.example': 'profile/someone.example',
    'someone.example': 'profile/someone.example',
    'did:plc:abc': 'profile/did:plc:abc',
    // a profile's old address, from before it was /profile/
    'u/did:plc:abc': 'profile/did:plc:abc',
    'u/someone.example': 'profile/someone.example',
    'u/someone.example,': 'profile/someone.example',
    'u/@someone.example': 'profile/someone.example',
    'user/someone.example': 'profile/someone.example',
    'u/did:example:kai': 'profile/did:example:kai',
    'ask': 'new', 'post': 'new', 'profile': 'me', 'settings': 'me', 'cli': 'agents', 'mcp': 'agents', 'home': '', 'index.html': '',
    // the board has an address of its own, and the other words for it lead there
    'Board': 'board', 'board/': 'board', 'board.': 'board', 'feed': 'board', 'circle': 'board', 'boards': 'board',
    // a slip of the keys
    'agnets': 'agents', 'agent': 'agents', 'agentss': 'agents', 'nwe': 'new', 'baord': 'board', 'bord': 'board', 'sede/someone.example/3k1': 'seed/someone.example/3k1'
  };
  for (const [typed, meant] of Object.entries(cases)) assert.equal(reroute(typed), meant, typed);
});

test('where there’s no telling, it says so instead of guessing', () => {
  for (const typed of ['nope', 'wp-admin', 'x/y/z/w', 'seed/not a handle/3k1/extra', 'about/us', '.env', 'a']) assert.equal(reroute(typed), null, typed);
  // what comes back is only ever a word from the lists or a DID, a handle or a record key: nothing typed is passed along
  for (const typed of ['<script>alert(1)</script>', 'javascript:alert(1)', '//evil.example/x', 'seed/"><img src=x>/3k1', '%00', '%E0%A4%A']) {
    const to = reroute(typed);
    assert.ok(to === null || /^(profile\/[a-z0-9.:%_-]+|seed\/[a-z0-9.:%_-]+\/[A-Za-z0-9._:~-]+|board|new|me|agents|)$/.test(to), `${typed} -> ${to}`);
  }
});

test('how close two words are', () => {
  assert.equal(editDistance('agents', 'agnets'), 1);   // two letters swapped count once
  assert.equal(editDistance('agents', 'agent'), 1);
  assert.equal(editDistance('new', 'me'), 2);
  assert.ok(closeTo('exmaple', 'example') && closeTo('exampel', 'example') && closeTo('Exampl', 'example'));
  assert.ok(!closeTo('example', 'example') && !closeTo('me', 'new') && !closeTo('men', 'me') && !closeTo('exams', 'example') && !closeTo('ex', 'example'));
});

test('the server sends a profile’s old address to its new one, and dresses the new one for sharing', async () => {
  const { readFile } = await import('node:fs/promises');
  const v = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  for (const r of v.redirects) assert.notEqual(r.source, r.destination, `${r.source} leads to itself`);
  assert.ok(v.redirects.some(r => r.source === '/u/:who' && r.destination === '/profile/:who' && r.permanent));
  assert.ok(v.rewrites.some(r => r.source === '/profile/:who' && r.destination === '/api/page?kind=person&who=:who'));
  assert.ok(!v.rewrites.some(r => r.source.startsWith('/u/')), 'the old address is redirected, not served');
});
