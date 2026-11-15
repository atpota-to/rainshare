# The index

Rainshare's AppView: every `dev.rainshare.*` record on the network, kept in Supabase so that
whatever needs Rainshare's records reads one database instead of every repo. Today that's the
announcer ([`../announcer/`](../announcer)) and its review queue. The site still reads the network.

It's atpota-to/atpota.to's garden index (`garden/`), which has run on the same droplet since
October, adapted to Rainshare's lexicon: the Jetstream connection, the batcher, the reconcile, the
state file and the health check are that code with names changed. It holds no atproto credential
and never writes to the network. Its only secret is the Supabase service key.

## What it keeps

`rainshare_records`, one row per record: asks (`seed`), takes, turn-ins (`delivery`), comments,
profiles and settings (`preferences`), and moderation records from @rainshare.dev's own repo only.
Each row has the record as its repo has it, its CID, what it's about (`subject_uri`: a take's,
turn-in's or comment's ask, or a moderation record's subject), its `createdAt`, and when Jetstream
first relayed it. Anyone can read them with the publishable key: they're public atproto records.

`rainshare_review`, the review queue: a row per ask saying whether @rainshare.dev may pass it on.
A trigger makes the row when an ask is first indexed, and puts it back to pending whenever the ask
is indexed with a new CID, so an approval holds for one version of an ask. Only the service role
can read or write it. The announcer asks the approver and writes their answers
([`../announcer/src/review.js`](../announcer/src/review.js)).

`rainshare_status`, its heartbeat: the announcer reads the records only while `heartbeat_at` is
a few minutes old and `backfilled_at` is set, and reads every repo otherwise.

The schema, functions and grants are
[`../supabase/migrations/20261115210000_rainshare_index.sql`](../supabase/migrations/20261115210000_rainshare_index.sql),
with the approver's POST and SEND added by
[`../supabase/migrations/20261115230000_rainshare_review_post_or_send.sql`](../supabase/migrations/20261115230000_rainshare_review_post_or_send.sql),
in the Supabase project `atpota.to` (zdzjtziydmwkxbzlkwxv), beside the terms ledger and the
garden's index.

## How it works

- **The stream.** One Jetstream v2 connection, filtered to `dev.rainshare.*`, with a cursor per
  host saved to `state.json` once the events up to it are in Supabase. A record that fails the
  shape checks (`src/records.js`) is deleted from the index, so a record edited into junk leaves.
- **Batches.** Events wait a second, keyed by URI so the last one wins, then go to
  `rainshare_apply` 500 at a time. A row Supabase refuses three times running is retried alone and
  dropped if it's still refused, so it can't jam the stream; the next reconcile puts it back.
- **Recycling.** Rainshare is quiet for hours at a time, so instead of a silence watchdog the
  connection is closed and reopened from the saved cursor every 15 minutes.
- **Reconcile** (`src/backfill.js`). Every repo with Rainshare records, from the relay's
  `listReposByCollection` and from the index itself, plus @rainshare.dev's: listed from its own
  PDS and compared with the index, so a record deleted while the service was down leaves too. On
  start if the last was more than six hours ago, every six hours, and whenever a connection opens
  without a cursor.

## Running it

On the droplet it's the `rainshare-index` unit, from `/root/rainshare-live/current` (the code) in
`/root/rainshare-index` (its `.env` and `state.json`). [`.env.example`](.env.example) lists the
settings. [`../droplet/README.md`](../droplet/README.md) has the one-time setup.

```bash
journalctl -u rainshare-index -f -o cat          # one JSON line per event; "stats" every 5 minutes
curl -s http://127.0.0.1:8793/healthz            # 200 while connected and writing its heartbeat
```

A reconcile by hand, safe while the service runs (it writes `backfilled_at` but not
`state.json`, and exits 1 if any repo couldn't be listed):

```bash
cd /root/rainshare-index && /opt/node22/bin/node --env-file=.env /root/rainshare-live/current/indexer/src/backfill-once.js
```

A restart costs nothing: it resumes from the saved cursor.

## Tests

`npm test` here runs `../test/index-*.test.mjs`: no network, no secrets, Node 22. The droplet
runs them on every deploy before switching.
