// Addresses the app doesn't have, and what each was probably meant to be (core/route.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { known, reroute, closeTo, editDistance } from '../core/route.js';

test('the addresses the app has', () => {
  for (const sub of ['', 'new', 'me', 'agents', 'u/did:plc:abc', 'u/someone.example', 'seed/someone.example/3k1', 'seed/did:plc:abc/3k1', 'seed/s/YXQ6Ly9z']) assert.ok(known(sub), sub);
  for (const sub of ['nope', 'seed', 'seed/someone.example', 'u', 'u/a/b', 'seed/a/b/c', 'New', 'agents/x', 'seed/s/not valid!']) assert.ok(!known(sub), sub);
});

test('a link that was cut short, or picked something up on the way, still arrives', () => {
  const cases = {
    // the full stop that ended the sentence a link was in, and other things that ride along
    'seed/someone.example/3k1.': 'seed/someone.example/3k1',
    'seed/someone.example/3k1).': 'seed/someone.example/3k1',
    'seed/someone.example/3k1/': 'seed/someone.example/3k1',
    'Seed/Someone.Example/3k1': 'seed/someone.example/3k1',
    'u/someone.example,': 'u/someone.example',
    'u/@someone.example': 'u/someone.example',
    'AGENTS': 'agents',
    'agents/': 'agents',
    // an ask's link without its key leads to whoever asked
    'seed/someone.example': 'u/someone.example',
    // other ways of saying the same thing
    'someone.example/3k1': 'seed/someone.example/3k1',
    'u/someone.example/3k1': 'seed/someone.example/3k1',
    'ask/did:plc:abc/3k1': 'seed/did:plc:abc/3k1',
    'at://did:plc:abc/dev.rainshare.seed/3k1': 'seed/did:plc:abc/3k1',
    'profile/someone.example': 'u/someone.example',
    '@someone.example': 'u/someone.example',
    'someone.example': 'u/someone.example',
    'did:plc:abc': 'u/did:plc:abc',
    'ask': 'new', 'post': 'new', 'profile': 'me', 'settings': 'me', 'cli': 'agents', 'mcp': 'agents', 'board': '', 'home': '',
    // a slip of the keys
    'agnets': 'agents', 'agent': 'agents', 'agentss': 'agents', 'nwe': 'new', 'baord': '', 'sede/someone.example/3k1': 'seed/someone.example/3k1'
  };
  for (const [typed, meant] of Object.entries(cases)) assert.equal(reroute(typed), meant, typed);
});

test('where there’s no telling, it says so instead of guessing', () => {
  for (const typed of ['nope', 'wp-admin', 'x/y/z/w', 'seed/not a handle/3k1/extra', 'about/us', '.env', 'a']) assert.equal(reroute(typed), null, typed);
  // what comes back is only ever a word from the lists or a DID, a handle or a record key: nothing typed is passed along
  for (const typed of ['<script>alert(1)</script>', 'javascript:alert(1)', '//evil.example/x', 'seed/"><img src=x>/3k1', '%00', '%E0%A4%A']) {
    const to = reroute(typed);
    assert.ok(to === null || /^(u\/[a-z0-9.:%_-]+|seed\/[a-z0-9.:%_-]+\/[A-Za-z0-9._:~-]+|new|me|agents|)$/.test(to), `${typed} -> ${to}`);
  }
});

test('how close two words are', () => {
  assert.equal(editDistance('agents', 'agnets'), 1);   // two letters swapped count once
  assert.equal(editDistance('agents', 'agent'), 1);
  assert.equal(editDistance('new', 'me'), 2);
  assert.ok(closeTo('exmaple', 'example') && closeTo('exampel', 'example') && closeTo('Exampl', 'example'));
  assert.ok(!closeTo('example', 'example') && !closeTo('me', 'new') && !closeTo('men', 'me') && !closeTo('exams', 'example') && !closeTo('ex', 'example'));
});
