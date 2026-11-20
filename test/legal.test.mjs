// The Terms of Service and the Privacy Policy (core/legal.js), and the note before someone's
// first job (ui/agree.js): what they hold, when it's asked for again, and that the Privacy
// Policy keeps up with what the code does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEGAL, TERMS, PRIVACY, LEGAL_VERSION, SAFETY, ASKING, PROVIDER, OPERATOR, asMarkdown } from '../core/legal.js';
import { renderMarkdown } from '../core/markdown.js';
import { known, reroute } from '../core/route.js';
import { APPVIEW, RELAYS, PLC, CONSTELLATION } from '../core/net.js';
import { COLLECTIONS, MODERATOR } from '../core/ns.js';
import { LEDGER } from '../core/agreement.js';
import { COLLECTIONS as INDEXED } from '../indexer/src/records.js';
import { FLUSH_MS } from '../indexer/src/indexer.js';
import { GONE_ERRORS } from '../indexer/src/backfill.js';
import { loadConfig } from '../indexer/src/config.js';
import { FRESH } from '../announcer/src/index-db.js';

// This browser's storage (Node has none of its own).
const kept = new Map();
const storage = { getItem: k => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)), removeItem: k => kept.delete(k) };
globalThis.localStorage = storage;
const { agreement, hasAgreed, rememberAgreement, forgetAgreement, agreeHtml } = await import('../ui/agree.js');

test('both documents are whole: a date, a lead, a summary, and sections that say something', () => {
  assert.match(LEGAL_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(Object.keys(LEGAL), ['terms', 'privacy', 'guidelines']);
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
  // And first of all, what Rainshare is and isn't: volunteers' own agents and pull requests, not shared access to anyone's AI plan.
  assert.match(TERMS.lead, /^Rainshare is a board where people ask for help with their ideas and public projects, and volunteers give it for free\./);
  assert.match(TERMS.lead, /isn’t a way to share, lend, sell or route access to an AI plan: it never sees anyone’s AI login, no request to an AI model passes through it, and nobody pays or is paid/);
  // Both documents name Rainshare's own domain, whatever address this build is served from.
  for (const doc of [TERMS, PRIVACY]) assert.match(doc.lead, /Rainshare’s site at rainshare\.dev \(and any other address we serve it from\)/);
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
  // What can be hidden: what breaks the terms, what goes against the community guidelines, and what puts people at
  // risk. Going against the guidelines is no breach of the terms by itself, so the guidelines can change on their own.
  assert.match(section('Moderation'), /when we think it breaks these terms, goes against our \[community guidelines\]\(https:\/\/[^)\s]+\/guidelines\) or puts people at risk/);
  assert.match(section('Moderation'), /they can change without a new date on these terms\. Going against them means that what you posted can be hidden, or that @rainshare\.dev won’t pass it on\. It isn’t a breach of these terms unless these terms rule the same thing out/);
  // A new line in the Terms is a new version, and every version from 2026-11-16 on is the Terms alone: the ledger's
  // cutoff (supabase/migrations/…_rainshare_terms_document.sql) stays where it is.
  assert.ok(LEGAL_VERSION >= '2026-11-17');
  assert.equal((readFileSync(new URL('../supabase/migrations/20261116090000_rainshare_terms_document.sql', import.meta.url), 'utf8').match(/policy_version >= '2026-11-16'/g) || []).length, 3);
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
  for (const says of [/Once a day, after 15:45 UTC, @rainshare\.dev posts on Bluesky how many new asks there are on the board/, /nobody has taken up yet/, /any ask from an account that blocks @rainshare\.dev/,
    /only when there’s news\. News about your asks and what you’ve helped with comes within a minute or two\. Once a day, it can tell you how many new asks are on the board/,
    /reads that conversation to see what it last sent you, and whether you replied STOP or START/, /whether you’ve asked for direct messages from @rainshare\.dev/,
    /listens to Bluesky’s Jetstream/, /a small server of ours at DigitalOcean/, /its log of what it posted and whom it messaged/]) assert.match(all, says);
  // Rainshare's note of who agreed (core/agreement.js, supabase/): one of the two things it keeps in a database of
  // its own (the index is the other, checked in the next test). The policy says where it is
  // and what's in it, column for column, and what isn't.
  assert.match(new URL(LEDGER).host, /\.supabase\.co$/);
  const ledger = readFileSync(new URL('../supabase/migrations/20261114190000_rainshare_terms_acceptance.sql', import.meta.url), 'utf8');
  const columns = [...ledger.matchAll(/^  ([a-z_]+) (?:uuid|text|timestamptz)/gm)].map(m => m[1]);
  assert.deepEqual(columns, ['id', 'did', 'policy_version', 'document', 'accepted_at', 'via', 'record_uri', 'record_cid', 'proof', 'logged_at'], 'a new column belongs in the policy, then here');
  for (const says of [/Supabase, where our note that you agreed to the terms is kept/, /your account’s ID \(its DID\), the version, when you agreed, whether that was on the site or with the CLI, and a copy of the record as your host signed it/,
    /holds no IP address and nothing about your browser/, /in the same database at Supabase, in a part of it that isn’t open to the public/, /Our own note that you agreed to the terms stays when you delete your record of it/, /that you agreed to Rainshare’s terms, which version, and when/]) assert.match(all, says);
  // Two things in all, said up front. The copy is of public records, and the lead doesn't make light of holding it.
  assert.match(PRIVACY.lead, /We keep two things in a database of our own: a copy of the Rainshare records in people’s accounts, and a note that you agreed to the terms/);
  assert.match(PRIVACY.lead, /already public in the accounts they’re in\. Our copy is still a copy that we hold/);
  assert.doesNotMatch(all, /keeps almost nothing|The one record/);
  // Every key the site keeps in the browser. A new one belongs in the policy's list too, then here.
  const KEYS = ['rs:accept-vouch', 'rs:agreed', 'rs:board-seen:', 'rs:board-sort', 'rs:garden-seen:', 'rs:kept', 'rs:messages-asked:', 'rs:mode', 'rs:notices-seen:', 'rs:prefs:', 'rs:signin', 'rs:signin-again', 'rs:signin-skip', 'rs:stage-seen:', 'rs:up-later', 'rs:waiting-later', 'rs:welcomed:'];
  const found = new Set();
  for (const dir of ['../ui/', '../src/', '../core/', '../public/']) for (const f of readdirSync(new URL(dir, import.meta.url)).filter(f => f.endsWith('.js')))
    for (const [, k] of readFileSync(new URL(dir + f, import.meta.url), 'utf8').matchAll(/['"`](rs:[a-z:-]+)['"`]/g)) if (k !== 'rs:') found.add(k);
  assert.deepEqual([...found].sort(), KEYS);
  for (const says of [/sets no cookies/, /day or night/, /agreed to the terms/, /forges you chose not to connect/, /vouch for someone/, /example board/, /a copy of your settings for “Direct my agent”/, /which plants in your garden you’ve already seen/, /which asks were on the board when you last looked/, /how you last sorted the board/, /which notifications in the bell you’ve already seen/, /notes and reminders you’ve dismissed/,
    /your GitHub username if you give it/, /whether that account has forked an ask’s repository/, /puts its prompt in the link to claude\.ai/]) assert.match(all, says);
  // Every kind of record Rainshare writes to someone's account is one the policy says is public.
  const said = { profile: /your Rainshare profile/, seed: /your asks/, take: /your agent is working on an ask/, delivery: /the work you turn in/, comment: /your comments/, preferences: /your settings for “Direct my agent”/ };
  assert.deepEqual(COLLECTIONS.map(c => c.split('.').pop()).sort(), Object.keys(said).sort(), 'a new kind of record belongs in the policy’s list, then here');
  for (const [kind, says] of Object.entries(said)) assert.match(all, says, kind);
});

test('the Privacy Policy says what the index keeps, who can read it, and when a copy goes, and that the review queue is gone', () => {
  const all = asMarkdown(PRIVACY);
  const section = name => PRIVACY.sections.find(([h]) => h === name)[1];
  const collected = section('What we collect'), sends = section('What @rainshare.dev posts and sends'), deleting = section('Deleting, and how long things last'), rights = section('Your rights');
  const sql = readFileSync(new URL('../supabase/migrations/20261115210000_rainshare_index.sql', import.meta.url), 'utf8');
  const later = readFileSync(new URL('../supabase/migrations/20261115230000_rainshare_review_post_or_send.sql', import.meta.url), 'utf8');
  const columnsOf = (table, from = sql) => [...from.match(new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`))[1].matchAll(/^  ([a-z_]+)\s+(?:text|jsonb|timestamptz)\b/gm)].map(m => m[1]);

  // The copy (indexer/, rainshare_records): which kinds of record, and what a row holds, column for column.
  const kinds = { seed: /asks,/, take: /notes that someone’s agent is working on an ask/, delivery: /work turned in/, comment: /comments,/, profile: /Rainshare profiles and settings/, preferences: /Rainshare profiles and settings/, moderation: /@rainshare\.dev’s own decisions to hide things/ };
  assert.deepEqual(INDEXED.map(c => c.split('.').pop()).sort(), Object.keys(kinds).sort(), 'a new kind of record in the index belongs in the policy, then here');
  for (const [kind, says] of Object.entries(kinds)) assert.match(collected, says, kind);
  assert.deepEqual(columnsOf('rainshare_records'), ['uri', 'did', 'collection', 'rkey', 'cid', 'record', 'subject_uri', 'created_at', 'first_seen_at', 'indexed_at'], 'a new column belongs in the policy, then here');
  assert.match(collected, /Each row holds one record whole, as your host has it, including anything in it that the site doesn’t show/);
  assert.match(collected, /the record’s address and the ID of the account it’s in \(its DID\), the ID of that version of the record \(its CID\), what the record is about if it’s about something \(an ask, or the thing a decision hides\), the date written in the record, when Jetstream first carried it, and when we last wrote the row/);
  assert.match(collected, /It holds no IP address and nothing about your browser/);
  assert.match(collected, /whoever wrote them and whichever app they used/);
  // Anyone can read it, and the policy says so without making light of holding it.
  assert.match(sql, /create policy "anyone can read" on public\.rainshare_records for select using \(true\)/);
  assert.match(collected, /These records are already public in the accounts they’re in, and our copy is open as well: the database lets anyone read it\. It’s still a copy that we hold/);
  // Where it's kept, and what keeps it: the server at DigitalOcean, from Jetstream, checked against every host.
  assert.match(collected, /in a database of ours at Supabase/);
  assert.match(collected, /The same server keeps our copy of Rainshare’s records up to date\. That copy is in our database at Supabase, not on the server/);
  assert.match(collected, /which asks were put to our reviewer and what they answered/);
  assert.doesNotMatch(all, /keeps no copy of the board/);
  assert.match(collected, /\[Supabase’s privacy policy\]\(https:\/\/supabase\.com\/privacy\)/);

  // Who reads it: the announcer, while it's fresh (announcer/src/index-db.js). The site and the CLI don't, so the
  // list of servers a browser asks is as it was. When one of them reads the index, that list says so, then here.
  assert.equal(FRESH, 5 * 60e3);
  assert.match(sends, /it reads the board, from our copy while that’s up to date and from the network otherwise/);
  assert.match(collected, /The site and the CLI still read the network/);
  const sources = dir => readdirSync(new URL(dir, import.meta.url), { withFileTypes: true }).flatMap(f => f.isDirectory() ? sources(dir + f.name + '/') : /\.m?js$/.test(f.name) ? [dir + f.name] : []);
  for (const f of ['../ui/', '../src/', '../core/', '../cli/', '../api/', '../public/'].flatMap(sources))
    assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), 'utf8'), /rainshare_(records|list|status|review)|\/rest\/v1\//, `${f} reads the index: the policy’s list of servers says so first`);
  assert.match(section('What your browser asks other servers'), /Supabase, where our note that you agreed to the terms is kept\. It’s asked when you agree, and again the next time you sign in if the note wasn’t made then\n/);

  // The review queue is gone (supabase/migrations/…_rainshare_review_drop.sql): @rainshare.dev's post only counts new
  // asks (announcer/src/posts.js), so nobody reads them first, and no note is kept for each ask any more.
  const dropped = readFileSync(new URL('../supabase/migrations/20261120090000_rainshare_review_drop.sql', import.meta.url), 'utf8');
  for (const what of ['trigger if exists rainshare_review_enqueue', 'function if exists public.rainshare_reviews(', 'function if exists public.rainshare_review_requested(', 'function if exists public.rainshare_review_decide(', 'table if exists public.rainshare_review;'])
    assert.ok(dropped.includes('drop ' + what), what);
  assert.doesNotMatch(all, /holds a note for each ask|review notes?\b|may pass it on/);
  assert.match(sends, /We kept the reviewer’s answers in a note for each ask in our database, and those notes are deleted/);
  assert.match(sends, /Once a day, after 15:45 UTC, @rainshare\.dev posts on Bluesky how many new asks there are on the board/);
  assert.match(sends, /It names no ask and nobody who asked, so nobody on our side reads the asks before they’re counted/);
  assert.match(sends, /We don’t count anything we’ve hidden, any ask our checks find very likely to be a trick, or any ask from an account that blocks @rainshare\.dev or that it blocks/);
  assert.match(sends, /Once a day, it can tell you how many new asks are on the board: only the number, with no titles or names/);
  assert.match(sends, /If we hide an ask that was posted, the server deletes the post/);
  assert.match(sends, /The messages between @rainshare\.dev and the reviewer are kept by Bluesky’s chat service/);
  // Nothing there says an ask is safe.
  assert.doesNotMatch(sends, /\bsafe\b/);
  assert.match(asMarkdown(TERMS), /An ask with no flag isn’t a safe ask/);

  // When a copy goes: with the stream, within seconds; at the six-hourly check otherwise; and the note with its ask.
  assert.equal(FLUSH_MS, 1000);
  assert.match(deleting, /When you delete one, Jetstream carries the delete and our copy is deleted, normally within a few seconds/);
  assert.match(sql, /on conflict \(uri\) do update set\s+cid = excluded\.cid,\s+record = excluded\.record/);
  assert.match(deleting, /our copy is replaced with the new version, and we keep no earlier ones/);
  assert.equal(loadConfig({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }).reconcileHours, 6);
  for (const part of [collected, deleting]) assert.match(part, /every six hours/);
  assert.match(deleting, /compares our copy with what each account’s host lists, and deletes any row whose record is gone/);
  assert.deepEqual(GONE_ERRORS, ['RepoNotFound', 'RepoDeactivated', 'RepoTakendown', 'RepoSuspended']);
  assert.match(deleting, /deleted, deactivated, suspended or taken down, that check deletes our copies of all its Rainshare records/);
  assert.match(deleting, /nothing of that account’s is deleted at that check, and the next one tries again/);
  assert.match(deleting, /stay in that conversation at Bluesky, and the server’s log keeps its lines about it until they’re cleared/);
  assert.match(deleting, /Supabase also backs up our database, so a row we’ve deleted can stay in a backup until that backup expires/);
  assert.match(section('Moderation'), /Our own copy of the decision \(see “A copy of Rainshare’s records”\) is deleted when the decision is/);

  // What we hold, for anyone who asks, and the basis for each in Europe: both under legitimate interests.
  assert.match(rights, /What we hold ourselves is our copy of your Rainshare records, our note that you agreed to the terms/);
  assert.match(rights, /what it sent the reviewer about your asks before 20 November 2026, the log on its server/);
  assert.match(rights, /To have our copies deleted, delete the records, or ask us to leave your account out of the copy: we then delete what the copy has of yours and keep it from being copied again/);
  assert.match(rights, /and your account’s ID on the list that keeps your records out of our copy, if you’ve asked for that/);
  assert.match(rights, /For our copy of your records, stopping means leaving your account out of it/);
  assert.doesNotMatch(all, /wouldn’t last/);
  assert.match(rights, /For the rest we rely on our legitimate interests:[\s\S]*\n- keeping a copy of Rainshare’s public records, so @rainshare\.dev’s server can read the board from one place[^\n]*\n- keeping the list of accounts that asked to be left out of our copy, so that their records stay out\n/);

  // Being left out of the copy (supabase/migrations/…_rainshare_index_excluded.sql): a list of accounts, by DID, that
  // the database itself keeps out. The policy says what the list holds, column for column, and what it does.
  const out = readFileSync(new URL('../supabase/migrations/20261117090000_rainshare_index_excluded.sql', import.meta.url), 'utf8');
  assert.deepEqual(columnsOf('rainshare_index_excluded', out), ['did', 'reason', 'added_at'], 'a new column belongs in the policy, then here');
  assert.match(collected, /\*\*Being left out of the copy\.\*\* You can ask us to keep your records out of our copy while they stay in your account: write to contact@atpota\.to\. We put the account’s ID on a list, with a few words on how you asked and the date/);
  // Adding an account deletes its rows (and, by the cascade above, the review notes for its asks), and a trigger skips the rest.
  assert.match(out, /create trigger rainshare_excluded_forget after insert or update of did on public\.rainshare_index_excluded/);
  assert.match(out, /lock table public\.rainshare_records in share row exclusive mode;\s+delete from public\.rainshare_records where did = new\.did;/);
  assert.match(out, /create trigger rainshare_skip_excluded before insert or update on public\.rainshare_records/);
  assert.match(out, /if exists \(select 1 from public\.rainshare_index_excluded x where x\.did = new\.did\) then\s+return null;/);
  assert.match(collected, /The database then deletes every row it has from that account, and refuses any record from it from then on/);
  // Only the service role reads the list, and @rainshare.dev's own account can't be put on it. (No repetition count
  // above 255 in the pattern: Postgres refuses one, and every insert with it.)
  assert.match(out, /revoke all on table public\.rainshare_index_excluded from anon, authenticated/);
  assert.ok(out.includes(`check (did <> '${MODERATOR}')`));
  for (const [, n] of out.matchAll(/\{\d+,(\d+)\}/g)) assert.ok(+n <= 255, `{…,${n}} in a pattern`);
  assert.match(collected, /The list is in the same database, and only we and Supabase can read it/);
  // What it means for them: the site works as before, and @rainshare.dev's server no longer sees their records.
  assert.match(collected, /The site reads the network, so Rainshare goes on working for you as before/);
  assert.match(collected, /your asks aren’t counted in its post or its messages, and the direct messages you switched on stop\. Ask, and we’ll take your account off the list/);
  assert.match(PRIVACY.lead, /If you ask us to keep your records out of that copy, your account’s ID goes on a list there that keeps them out/);
  assert.match(deleting, /To have our copies deleted while your records stay in your account, ask us to leave your account out of the copy/);
  assert.match(section('Children'), /and leave their account out of our copy of Rainshare’s records, as quickly as we can/);

  // In short, and in the document's own voice: no em dashes.
  assert.ok(PRIVACY.short.some(x => /keeps a copy of your Rainshare records in a database of its own, and anyone can read that copy\. When you delete a record, our copy of it is deleted too, and you can ask us to keep your records out of it/.test(x)));
  assert.ok(PRIVACY.short.some(x => /The same database holds a note that you agreed to the terms\. That isn’t open to the public/.test(x)));
  assert.ok(PRIVACY.short.some(x => /posts once a day on Bluesky to say how many new asks there are, without naming any/.test(x)));
  for (const doc of [TERMS, PRIVACY]) assert.doesNotMatch(asMarkdown(doc), /—/, `${doc.key}: no em dashes`);
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
  assert.match(html, /Before you direct your agent/);
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
  // A second box, in both: what their AI provider allows is theirs to check, and theirs to answer for.
  for (const h of [html, asking]) {
    assert.ok(h.includes(`<input type="checkbox" name="provider"><span>${PROVIDER}</span>`));
    assert.ok(h.indexOf('name="provider"') < h.indexOf('data-ag="go"'));
  }
  assert.match(PROVIDER, /up to me to check/);
  assert.match(PROVIDER, /my responsibility, not Rainshare’s/);
  // And the terms say the same, in the section on helping.
  const helping = TERMS.sections.find(([h]) => /^Helping/.test(h))[1];
  assert.match(helping, /Your provider decides for itself what its terms allow/);
  assert.match(helping, /we aren’t responsible for it/);
});

test('the two pages have addresses, and the words people reach for lead to them', () => {
  assert.ok(known('terms') && known('privacy'));
  assert.deepEqual(['tos', 'Terms.', 'legal', 'terms-of-service', 'privacy-policy', 'Privacy'].map(reroute), ['terms', 'terms', 'terms', 'terms', 'privacy', 'privacy']);
});

test('the community guidelines: whole, linked where an ask is written, and plain', () => {
  const g = LEGAL.guidelines;
  assert.equal(g.key, 'guidelines');
  assert.ok(g.title && g.lead.length > 100 && g.short.length >= 3);
  assert.match(g.updated, /^\d{1,2} [A-Z][a-z]+ \d{4}$/);
  for (const [h, md] of g.sections) {
    const html = renderMarkdown(md.trim());
    assert.ok(h && html.length > 40, h);
    assert.doesNotMatch(html, /<br>/, h);
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) assert.match(href, /^https:\/\//, href);
  }
  const all = [g.lead, ...g.short, ...g.sections.flat()].join('\n');
  assert.doesNotMatch(all, /\u2014/, 'no em dashes');
  assert.match(all, /bug bounties/i);
  assert.match(all, /security holes in software that isn’t yours/);
});

