// The Terms of Service and the Privacy Policy (core/legal.js), and the note before someone's
// first job (ui/agree.js): what they hold, when it's asked for again, and that the Privacy
// Policy keeps up with what the code does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEGAL, TERMS, PRIVACY, LEGAL_VERSION, SAFETY, ASKING, OPERATOR, asMarkdown } from '../core/legal.js';
import { renderMarkdown } from '../core/markdown.js';
import { known, reroute } from '../core/route.js';
import { APPVIEW, RELAYS, PLC, CONSTELLATION } from '../core/net.js';
import { COLLECTIONS } from '../core/ns.js';
import { LEDGER } from '../core/agreement.js';

// This browser's storage (Node has none of its own).
const kept = new Map();
const storage = { getItem: k => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)), removeItem: k => kept.delete(k) };
globalThis.localStorage = storage;
const { agreement, hasAgreed, rememberAgreement, forgetAgreement, agreeHtml } = await import('../ui/agree.js');

test('both documents are whole: a date, a lead, a summary, and sections that say something', () => {
  assert.match(LEGAL_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(Object.keys(LEGAL), ['terms', 'privacy']);
  for (const doc of [TERMS, PRIVACY]) {
    assert.ok(doc.title && doc.lead.length > 100 && doc.short.length >= 3, doc.key);
    assert.match(doc.updated, /^\d{1,2} [A-Z][a-z]+ \d{4}$/);
    // The Terms' date is the version people agree to. The Privacy Policy is a notice with a date of its own.
    if (doc === TERMS) assert.equal(new Date(doc.updated + ' UTC').toISOString().slice(0, 10), LEGAL_VERSION, 'the date on the Terms is the version agreed to');
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
    /must not try to trick or misuse a helper’s agent/, /We can’t delete or change your records/, /“as is”/, /at least 18/, /MIT License/, /@rainshare\.dev/]) assert.match(all, says);
});

test('both documents say who runs Rainshare, and the terms say how a dispute goes', () => {
  assert.deepEqual(OPERATOR, { name: 'atpotato, LLC', kind: 'a Delaware limited liability company', address: '8595 Pelham Road, Suite 400 #747, Greenville, SC 29615, USA', email: 'contact@atpota.to' });
  const terms = asMarkdown(TERMS), privacy = asMarkdown(PRIVACY);
  for (const doc of [terms, privacy]) assert.match(doc, /operated by (\*\*)?atpotato, LLC(\*\*)?, a Delaware limited liability company/);
  // Up front, before the sections: how a dispute goes. One at a time, in court, with no jury.
  assert.match(TERMS.lead, /disputes with us are settled one at a time, in small-claims court or the courts in Delaware, with no jury/);
  assert.ok(TERMS.short.some(x => /one at a time, in small-claims court or in Delaware’s courts, with no jury/.test(x)));
  const section = name => TERMS.sections.find(([h]) => h === name)[1];
  // Who may use it.
  assert.match(section('Who runs Rainshare, and who can use it'), /at least 18 years old, or the age of majority where you live/);
  // The cap, a claim, a dispute, and whose law.
  assert.match(section('Limits on our responsibility'), /indirect, incidental, special, consequential, punitive or exemplary damages[\s\S]*the greater of what you paid us in the twelve months before the claim, or fifty US dollars \(US\$50\)/);
  assert.match(section('If something you do leads to a claim'), /defend, indemnify and hold harmless atpotato, LLC/);
  const disputes = section('Disputes');
  assert.match(disputes, /write to us at contact@atpota\.to and try to settle it informally for at least thirty \(30\) days/);
  // There's no arbitration: small claims where they qualify, the courts in Delaware for the rest.
  assert.match(disputes, /small-claims court if it qualifies[\s\S]*goes to the courts named under “Governing law”, and nowhere else/);
  assert.match(disputes, /each side gives up the right to a jury trial/);
  for (const doc of [terms, privacy]) assert.doesNotMatch(doc, /arbitrat/i);
  assert.match(disputes, /not to bring or join a class, consolidated or representative action/);
  assert.match(section('Governing law'), /laws of the State of Delaware[\s\S]*state and federal courts located in Delaware[\s\S]*mandatory consumer-protection laws of the place you live/);
  assert.match(section('Moderation'), /copyright agent: atpotato, LLC, 8595 Pelham Road[\s\S]*we’ll hide what you named[\s\S]*accounts that infringe repeatedly, when the circumstances call for it/);
  // The Privacy Policy: who to write to, the rights anyone can ask for, and Europe’s.
  assert.match(privacy, /\*\*Data controller:\*\* atpotato, LLC, 8595 Pelham Road, Suite 400 #747, Greenville, SC 29615, USA/);
  assert.match(privacy, /Wherever you live, you can ask to see the personal data we hold about you[\s\S]*Europe, the UK and Switzerland[\s\S]*no office in Europe, so write to us directly/);
  assert.match(privacy, /isn’t directed to anyone under 18/);
  // People agree to the Terms. The Privacy Policy is a notice, and each document says so.
  assert.match(terms, /it isn’t part of this agreement/);
  assert.match(privacy, /This policy is a notice: you aren’t asked to agree to it/);
  // Nothing half-written goes out: no placeholder, and no name left as code.
  for (const doc of [terms, privacy]) assert.doesNotMatch(doc, /\$\{|\[phone/);
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
  // What @rainshare.dev does (announcer/, a server of ours at DigitalOcean that listens to Jetstream):
  // the policy says both halves, where it runs, and what it listens to.
  assert.ok(existsSync(new URL('../announcer/src/posts.js', import.meta.url)) && existsSync(new URL('../announcer/src/messages.js', import.meta.url)));
  assert.match(readFileSync(new URL('../announcer/src/index.js', import.meta.url), 'utf8'), /wss:\/\/jetstream\.us-east\.bsky\.network/);
  for (const says of [/posted once on Bluesky by @rainshare\.dev, with its title and a mention of whoever asked/, /nobody has taken up yet/, /block it on Bluesky/,
    /only when there’s news\. News about your asks and what you’ve helped with comes within a minute or two\. New asks come once a day/,
    /reads that conversation to see what it last sent you, and whether you replied STOP or START/, /whether you’ve asked for direct messages from @rainshare\.dev/,
    /listens to Bluesky’s Jetstream/, /a small server of ours at DigitalOcean/, /its log of what it posted and whom it messaged/]) assert.match(all, says);
  // The one record Rainshare keeps in a database of its own: its note of who agreed (core/agreement.js, supabase/). The
  // policy says where it is and what's in it, column for column, and what isn't.
  assert.match(new URL(LEDGER).host, /\.supabase\.co$/);
  const ledger = readFileSync(new URL('../supabase/migrations/20261114190000_rainshare_terms_acceptance.sql', import.meta.url), 'utf8');
  const columns = [...ledger.matchAll(/^  ([a-z_]+) (?:uuid|text|timestamptz)/gm)].map(m => m[1]);
  assert.deepEqual(columns, ['id', 'did', 'policy_version', 'document', 'accepted_at', 'via', 'record_uri', 'record_cid', 'proof', 'logged_at'], 'a new column belongs in the policy, then here');
  for (const says of [/Supabase, where our note that you agreed to the terms is kept/, /your account’s ID \(its DID\), the version, when you agreed, whether that was on the site or with the CLI, and a copy of the record as your host signed it/,
    /holds no IP address and nothing about your browser/, /a database at Supabase that isn’t open to the public/, /Our own note that you agreed to the terms stays when you delete your record of it/, /that you agreed to Rainshare’s terms, which version, and when/]) assert.match(all, says);
  assert.match(PRIVACY.lead, /The one record we keep in a database of our own is a note that you agreed to the terms/);
  // Every key the site keeps in the browser. A new one belongs in the policy's list too, then here.
  const KEYS = ['rs:accept-vouch', 'rs:agreed', 'rs:garden-seen:', 'rs:kept', 'rs:mode', 'rs:prefs:', 'rs:signin', 'rs:signin-skip', 'rs:stage-seen:', 'rs:waiting-later', 'rs:welcomed:'];
  const found = new Set();
  for (const dir of ['../ui/', '../src/', '../core/', '../public/']) for (const f of readdirSync(new URL(dir, import.meta.url)).filter(f => f.endsWith('.js')))
    for (const [, k] of readFileSync(new URL(dir + f, import.meta.url), 'utf8').matchAll(/['"`](rs:[a-z:-]+)['"`]/g)) if (k !== 'rs:') found.add(k);
  assert.deepEqual([...found].sort(), KEYS);
  for (const says of [/sets no cookies/, /day or night/, /agreed to the terms/, /forges you chose not to connect/, /vouch for someone/, /example board/, /a copy of your settings for “Send my agent”/, /which plants in your garden you’ve already seen/, /notes and reminders you’ve dismissed/]) assert.match(all, says);
  // Every kind of record Rainshare writes to someone's account is one the policy says is public.
  const said = { profile: /your Rainshare profile/, seed: /your asks/, take: /your agent is working on an ask/, delivery: /the work you turn in/, comment: /your comments/, preferences: /your settings for “Send my agent”/ };
  assert.deepEqual(COLLECTIONS.map(c => c.split('.').pop()).sort(), Object.keys(said).sort(), 'a new kind of record belongs in the policy’s list, then here');
  for (const [kind, says] of Object.entries(said)) assert.match(all, says, kind);
});

test('agreeing is remembered with the version agreed to, and asked again when the terms change', () => {
  kept.clear(); forgetAgreement();
  assert.equal(hasAgreed(), false);
  const a = rememberAgreement();
  assert.equal(a.version, LEGAL_VERSION);
  assert.ok(hasAgreed());
  assert.deepEqual(JSON.parse(kept.get('rs:agreed')), a);
  // When it was agreed to, and which accounts it's since been written down for, are kept with it.
  assert.deepEqual(rememberAgreement({ at: '2026-11-14T10:00:00Z', logged: ['did:plc:a', 'did:plc:a', 7] }), { version: LEGAL_VERSION, at: '2026-11-14T10:00:00.000Z', logged: ['did:plc:a'] });
  assert.deepEqual(agreement().logged, ['did:plc:a']);
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
    rememberAgreement();
    assert.ok(hasAgreed());
    forgetAgreement();
    assert.equal(hasAgreed(), false);
  } finally { globalThis.localStorage = storage; }
});

test('the note before a first job or a first ask: three points, both documents linked, and nothing to press until the box is ticked', () => {
  assert.equal(SAFETY.length, 3); assert.equal(ASKING.length, 3);
  // Before a first ask, it says what an asker should keep in mind, with the same box to tick.
  const asking = agreeHtml(sub => '/' + sub, 'ask');
  assert.match(asking, /Before you ask for help/);
  for (const [point, why] of ASKING) assert.ok(asking.includes(point) && asking.includes(why), point);
  assert.match(asking, /<input type="checkbox" name="agree">[\s\S]*data-ag="go" disabled>Agree and continue/);
  const html = agreeHtml(sub => '/base/' + sub);
  assert.match(html, /Before you send your agent/);
  for (const [point, why] of SAFETY) assert.ok(html.includes(point) && html.includes(why), point);
  assert.match(html, /<input type="checkbox" name="agree">/);
  // The box is for the Terms, and for saying you're an adult. The policy is linked as something to read.
  assert.match(html, /I’m 18 or older, and I agree to Rainshare’s <a href="\/base\/terms" target="_blank" rel="noopener">Terms of Service<\/a>\. Its <a href="\/base\/privacy" target="_blank" rel="noopener">Privacy Policy<\/a> says what happens to data\./);
  assert.match(html, /<button class="rs-btn rs-primary" type="button" data-ag="go" disabled>Agree and continue<\/button>/);
  assert.match(html, /data-ag="cancel">Not now</);
  // Signing in says so too, just above the button, on both steps that send you to a host.
  const signin = readFileSync(new URL('../src/signin.js', import.meta.url), 'utf8');
  assert.match(signin, /By continuing you agree to Rainshare’s <a href="\/terms" target="_blank" rel="noopener">Terms of Service<\/a>\. Its <a href="\/privacy"/);
  assert.equal((signin.match(/TERMS_NOTE\}\n\s+<button class="si-go"/g) || []).length, 2);
});

test('the two pages have addresses, and the words people reach for lead to them', () => {
  assert.ok(known('terms') && known('privacy'));
  assert.deepEqual(['tos', 'Terms.', 'legal', 'terms-of-service', 'privacy-policy', 'Privacy'].map(reroute), ['terms', 'terms', 'terms', 'terms', 'privacy', 'privacy']);
});
