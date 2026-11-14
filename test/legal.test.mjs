// The Terms of Service and the Privacy Policy (core/legal.js), and the note before someone's
// first job (ui/agree.js): what they hold, when it's asked for again, and that the Privacy
// Policy keeps up with what the code does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEGAL, TERMS, PRIVACY, LEGAL_VERSION, SAFETY, asMarkdown } from '../core/legal.js';
import { renderMarkdown } from '../core/markdown.js';
import { known, reroute } from '../core/route.js';
import { APPVIEW, RELAYS, PLC, CONSTELLATION } from '../core/net.js';
import { COLLECTIONS } from '../core/ns.js';

// This browser's storage (Node has none of its own).
const kept = new Map();
const storage = { getItem: k => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)), removeItem: k => kept.delete(k) };
globalThis.localStorage = storage;
const { agreement, hasAgreed, recordAgreement, forgetAgreement, agreeHtml } = await import('../ui/agree.js');

test('both documents are whole: a date, a lead, a summary, and sections that say something', () => {
  assert.match(LEGAL_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(Object.keys(LEGAL), ['terms', 'privacy']);
  for (const doc of [TERMS, PRIVACY]) {
    assert.ok(doc.title && doc.lead.length > 100 && doc.short.length >= 3, doc.key);
    assert.match(doc.updated, /^\d{1,2} [A-Z][a-z]+ \d{4}$/);
    assert.equal(new Date(doc.updated + ' UTC').toISOString().slice(0, 10), LEGAL_VERSION, 'the date shown is the version agreed to');
    assert.ok(doc.sections.length >= 8, doc.key);
    assert.equal(doc.sections.at(-1)[0], 'Contact');
    for (const [h, md] of doc.sections) {
      const html = renderMarkdown(md.trim());
      assert.ok(h && html.length > 40, `${doc.key}: ${h}`);
      // Each paragraph is on a line of its own: a stray line break would show as one.
      assert.doesNotMatch(html, /<br>/, `${doc.key}: ${h}`);
      for (const [, href] of html.matchAll(/href="([^"]+)"/g)) assert.match(href, /^https:\/\//, href);
    }
    // As one piece of Markdown, for the CLI: every section, numbered.
    const md = asMarkdown(doc);
    assert.match(md, new RegExp(`^# ${doc.title}\\n\\nLast changed ${doc.updated}\\.`));
    assert.equal((md.match(/^## \d+\. /gm) || []).length, doc.sections.length);
  }
});

test('the terms say what matters here: public records, your own agent, no money, no tricks, moderation', () => {
  const all = asMarkdown(TERMS);
  for (const says of [/public record in your own account/, /You run your own agent, signed in as you/, /at your own risk/, /no credits, tips or payments/,
    /must not try to trick or misuse a helper’s agent/, /We can’t delete or change your records/, /“as is”/, /at least 13/, /MIT License/, /@rainshare\.dev/]) assert.match(all, says);
});

test('the Privacy Policy names every service the code asks, and everything kept in the browser', () => {
  const all = asMarkdown(PRIVACY);
  // The hosts in core/net.js, the forges, the link previews' cache, and the site's own host.
  assert.ok([APPVIEW, ...RELAYS].every(u => /bsky/.test(u)) && /Bluesky’s relays and public API/.test(all));
  assert.ok(PLC.includes('plc.directory') && /PLC directory/.test(all));
  assert.ok(CONSTELLATION.includes('constellation.microcosm.blue') && /Constellation, run by microcosm\.blue/.test(all));
  for (const name of ['GitHub', 'Tangled', 'knotless', 'Slingshot', 'Vercel Web Analytics', 'session.json']) assert.ok(all.includes(name), name);
  // What a page view counts is its path alone: the page says so, and src/main.js does it.
  assert.match(all, /without anything after a `\?` or `#`/);
  assert.match(readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), /inject\(\{ beforeSend\(e\)\{[^\n]*u\.origin \+ u\.pathname/);
  // Every key the site keeps in the browser. A new one belongs in the policy's list too, then here.
  const KEYS = ['rs:accept-vouch', 'rs:agreed', 'rs:kept', 'rs:mode', 'rs:prefs:', 'rs:signin', 'rs:signin-skip', 'rs:stage-seen:', 'rs:welcomed:'];
  const found = new Set();
  for (const dir of ['../ui/', '../src/', '../core/', '../public/']) for (const f of readdirSync(new URL(dir, import.meta.url)).filter(f => f.endsWith('.js')))
    for (const [, k] of readFileSync(new URL(dir + f, import.meta.url), 'utf8').matchAll(/['"`](rs:[a-z:-]+)['"`]/g)) if (k !== 'rs:') found.add(k);
  assert.deepEqual([...found].sort(), KEYS);
  for (const says of [/sets no cookies/, /day or night/, /agreed to the terms/, /forges you chose not to connect/, /vouch for someone/, /example board/, /a copy of your settings for “Send my agent”/]) assert.match(all, says);
  // Every kind of record Rainshare writes to someone's account is one the policy says is public.
  const said = { profile: /your Rainshare profile/, seed: /your asks/, take: /your agent is working on an ask/, delivery: /the work you turn in/, comment: /your comments/, preferences: /your settings for “Send my agent”/ };
  assert.deepEqual(COLLECTIONS.map(c => c.split('.').pop()).sort(), Object.keys(said).sort(), 'a new kind of record belongs in the policy’s list, then here');
  for (const [kind, says] of Object.entries(said)) assert.match(all, says, kind);
});

test('agreeing is remembered with the version agreed to, and asked again when the terms change', () => {
  kept.clear(); forgetAgreement();
  assert.equal(hasAgreed(), false);
  const a = recordAgreement();
  assert.equal(a.version, LEGAL_VERSION);
  assert.ok(hasAgreed());
  assert.deepEqual(JSON.parse(kept.get('rs:agreed')), a);
  // Older terms were agreed to: it's asked again.
  forgetAgreement();
  kept.set('rs:agreed', JSON.stringify({ version: '2020-01-01', at: 'x' }));
  assert.equal(agreement(), null);
  // Something else under the key, or nothing readable, isn't an agreement.
  for (const junk of ['1', 'null', '{', '"2026"']) { kept.set('rs:agreed', junk); assert.equal(hasAgreed(), false, junk); }
  // A browser that keeps nothing is asked once a visit.
  kept.clear();
  globalThis.localStorage = { getItem(){ throw new Error('blocked'); }, setItem(){ throw new Error('blocked'); }, removeItem(){ throw new Error('blocked'); } };
  try {
    assert.equal(hasAgreed(), false);
    recordAgreement();
    assert.ok(hasAgreed());
    forgetAgreement();
    assert.equal(hasAgreed(), false);
  } finally { globalThis.localStorage = storage; }
});

test('the note before a first job: three points, both documents linked, and nothing to press until the box is ticked', () => {
  assert.equal(SAFETY.length, 3);
  const html = agreeHtml(sub => '/base/' + sub);
  for (const [point, why] of SAFETY) assert.ok(html.includes(point) && html.includes(why), point);
  assert.match(html, /<input type="checkbox" name="agree">/);
  assert.match(html, /<a href="\/base\/terms" target="_blank" rel="noopener">Terms of Service<\/a> and <a href="\/base\/privacy" target="_blank" rel="noopener">Privacy Policy<\/a>/);
  assert.match(html, /<button class="rs-btn rs-primary" type="button" data-ag="go" disabled>Agree and continue<\/button>/);
  assert.match(html, /data-ag="cancel">Not now</);
});

test('the two pages have addresses, and the words people reach for lead to them', () => {
  assert.ok(known('terms') && known('privacy'));
  assert.deepEqual(['tos', 'Terms.', 'legal', 'terms-of-service', 'privacy-policy', 'Privacy'].map(reroute), ['terms', 'terms', 'terms', 'terms', 'privacy', 'privacy']);
});
