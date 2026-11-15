-- Rainshare's index, and the review queue that decides what @rainshare.dev passes on.
--
-- rainshare_records: every dev.rainshare.* record on the network, as its repo has it, kept by
-- rainshare-index on the droplet (indexer/). It's the same design as the garden's index in this
-- project (public.garden_records, atpota-to/atpota.to garden/): the droplet writes with the
-- service role through rainshare_apply; anyone may read, as the records are public atproto data.
-- Moderation records are only kept from @rainshare.dev's own repo.
--
-- rainshare_review: one row per ask, saying whether @rainshare.dev may post it and send it in
-- people's direct messages. A row is made (or put back to pending) by a trigger whenever an ask
-- is indexed with a CID the row doesn't already have, so an approval holds for that exact version
-- of the ask: an edit asks again. The announcer (announcer/src/review.js) asks the approver by
-- direct message and writes the answer here. Service role only: nobody else can read or write it.

-- ---------- the records ----------

create table if not exists public.rainshare_records (
  uri            text        primary key,
  did            text        not null,
  collection     text        not null check (collection in (
                   'dev.rainshare.seed', 'dev.rainshare.take', 'dev.rainshare.delivery', 'dev.rainshare.comment',
                   'dev.rainshare.profile', 'dev.rainshare.preferences', 'dev.rainshare.moderation')),
  rkey           text        not null,
  cid            text        not null,
  record         jsonb       not null,
  -- what it's about: a take's, a turn-in's or a comment's ask, a moderation record's subject
  subject_uri    text,
  -- the record's own createdAt, as written (null when it has none that parses)
  created_at     timestamptz,
  -- when Jetstream relayed its creation; null for a record a reconcile found
  first_seen_at  timestamptz,
  indexed_at     timestamptz not null default now(),
  check (uri = 'at://' || did || '/' || collection || '/' || rkey),
  -- only @rainshare.dev's moderation records count (core/ns.js MODERATOR)
  check (collection <> 'dev.rainshare.moderation' or did = 'did:plc:cmkittusvczhnei4gjt3asiv')
);
create index if not exists rainshare_records_recent on public.rainshare_records (collection, created_at desc);
create index if not exists rainshare_records_subject on public.rainshare_records (collection, subject_uri);
create index if not exists rainshare_records_did on public.rainshare_records (did, collection);
comment on table public.rainshare_records is 'Every dev.rainshare.* record (seed, take, delivery, comment, profile, preferences, and moderation from @rainshare.dev only), as its repo has it. Written by rainshare-index on the droplet (service role). Public read. See indexer/README.md in atpota-to/rainshare.';

-- ---------- how fresh the index is ----------

create table if not exists public.rainshare_status (
  id             smallint    primary key default 1 check (id = 1),
  -- the indexer was connected to Jetstream and had applied everything it received
  heartbeat_at   timestamptz,
  -- the newest event it applied (Jetstream's time)
  stream_at      timestamptz,
  -- the last full pass over every repo with Rainshare records finished
  backfilled_at  timestamptz
);
comment on table public.rainshare_status is 'rainshare-index''s heartbeat: readers use the index only while this is fresh and backfilled_at is set. Public read.';

-- ---------- the review queue ----------

create table if not exists public.rainshare_review (
  seed_uri      text        primary key references public.rainshare_records (uri) on delete cascade,
  -- the version of the ask this row is about: an approval holds for this CID only
  cid           text        not null,
  status        text        not null default 'pending' check (status in ('pending', 'approved', 'declined', 'hidden')),
  -- when the approver was asked about this version, and the direct message that asked
  requested_at  timestamptz,
  request_id    text,
  decided_at    timestamptz,
  -- who answered (a DID)
  decided_by    text,
  note          text        check (char_length(note) <= 600),
  queued_at     timestamptz not null default now()
);
create index if not exists rainshare_review_pending on public.rainshare_review (status, queued_at);
comment on table public.rainshare_review is 'Whether @rainshare.dev may pass each ask on (post it, and send it in people''s direct messages): pending until the approver answers, for the version of the ask in cid. An edit puts it back to pending. Written by the trigger on rainshare_records and by the announcer. Service role only: RLS enabled with no policies.';
comment on column public.rainshare_review.status is 'pending: not asked or not answered. approved: may be posted and sent. declined: stays on the board, never passed on. hidden: hidden from Rainshare (a moderation record in @rainshare.dev''s repo says so).';

alter table public.rainshare_records enable row level security;
alter table public.rainshare_status enable row level security;
alter table public.rainshare_review enable row level security;
drop policy if exists "anyone can read" on public.rainshare_records;
drop policy if exists "anyone can read" on public.rainshare_status;
create policy "anyone can read" on public.rainshare_records for select using (true);
create policy "anyone can read" on public.rainshare_status for select using (true);
grant select on table public.rainshare_records, public.rainshare_status to anon, authenticated;
-- The queue: nobody but the service role.
revoke all on table public.rainshare_review from anon, authenticated;

-- A new ask, or a new version of one, waits for review. The same version seen again (a
-- reconcile, a replayed event) changes nothing.
create or replace function public.rainshare_review_enqueue()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.collection = 'dev.rainshare.seed' then
    insert into public.rainshare_review (seed_uri, cid) values (new.uri, new.cid)
    on conflict (seed_uri) do update set
      cid = excluded.cid, status = 'pending', requested_at = null, request_id = null,
      decided_at = null, decided_by = null, note = null, queued_at = now()
    where public.rainshare_review.cid is distinct from excluded.cid;
  end if;
  return new;
end
$$;
drop trigger if exists rainshare_review_enqueue on public.rainshare_records;
create trigger rainshare_review_enqueue after insert or update of cid on public.rainshare_records
  for each row execute function public.rainshare_review_enqueue();

-- ---------- writing (the droplet) ----------

-- Applies a batch: deletes first, then upserts, so a URI should be in one or the other, and in
-- the upserts once (the indexer keeps each URI's last event). A record seen again keeps the time
-- Jetstream first relayed it.
create or replace function public.rainshare_apply(p_upserts jsonb default '[]'::jsonb, p_deletes text[] default '{}')
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  gone integer := 0;
  kept integer := 0;
begin
  if cardinality(p_deletes) > 0 then
    delete from public.rainshare_records where uri = any (p_deletes);
    get diagnostics gone = row_count;
  end if;
  insert into public.rainshare_records (uri, did, collection, rkey, cid, record, subject_uri, created_at, first_seen_at)
  select r.uri, r.did, r.collection, r.rkey, r.cid, r.record, r.subject_uri, r.created_at, r.first_seen_at
  from jsonb_to_recordset(coalesce(p_upserts, '[]'::jsonb))
    as r(uri text, did text, collection text, rkey text, cid text, record jsonb, subject_uri text, created_at timestamptz, first_seen_at timestamptz)
  on conflict (uri) do update set
    cid = excluded.cid,
    record = excluded.record,
    subject_uri = excluded.subject_uri,
    created_at = excluded.created_at,
    first_seen_at = coalesce(public.rainshare_records.first_seen_at, excluded.first_seen_at),
    indexed_at = now();
  get diagnostics kept = row_count;
  return gone + kept;
end
$$;

-- Every record in a repo, for a reconcile to compare against what the repo lists.
create or replace function public.rainshare_repo_uris(p_did text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('uri', r.uri, 'collection', r.collection) order by r.uri), '[]'::jsonb)
  from public.rainshare_records r
  where r.did = p_did;
$$;

-- Every repo the index has records from.
create or replace function public.rainshare_repos()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(d.did order by d.did), '[]'::jsonb)
  from (select distinct r.did from public.rainshare_records r) d;
$$;

-- ---------- reading ----------

-- Every record of a collection, as the apps read them from repos: { uri, cid, did, rkey, record },
-- newest first, `p_limit` at most. With `p_since`, only those created since (or with no date).
create or replace function public.rainshare_list(p_collection text, p_since timestamptz default null, p_limit integer default 5000)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('uri', t.uri, 'cid', t.cid, 'did', t.did, 'rkey', t.rkey, 'record', t.record) order by t.created_at desc nulls last, t.uri), '[]'::jsonb)
  from (
    select r.uri, r.cid, r.did, r.rkey, r.record, r.created_at
    from public.rainshare_records r
    where r.collection = p_collection and (p_since is null or r.created_at is null or r.created_at >= p_since)
    order by r.created_at desc nulls last, r.uri
    limit greatest(1, least(p_limit, 20000))
  ) t;
$$;

-- ---------- the review queue (the announcer, with the service role) ----------

-- The queue's rows for asks created since `p_since`: { seed_uri, cid, status, requested_at,
-- request_id, decided_at, decided_by, note, queued_at }.
create or replace function public.rainshare_reviews(p_since timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(v) order by v.queued_at), '[]'::jsonb)
  from public.rainshare_review v
  join public.rainshare_records r on r.uri = v.seed_uri
  where r.created_at is null or r.created_at >= p_since;
$$;

-- The approver has been asked about this version of the ask. False if it's changed since, or
-- been decided.
create or replace function public.rainshare_review_requested(p_uri text, p_cid text, p_request_id text default null)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare n integer;
begin
  update public.rainshare_review set requested_at = now(), request_id = p_request_id
  where seed_uri = p_uri and cid = p_cid and status = 'pending';
  get diagnostics n = row_count;
  return n > 0;
end
$$;

-- The approver's answer about this version of the ask. False if the ask has changed since they
-- were asked (it's pending again, for the new version), or isn't in the queue.
create or replace function public.rainshare_review_decide(p_uri text, p_cid text, p_status text, p_by text, p_note text default null)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare n integer;
begin
  if p_status not in ('approved', 'declined', 'hidden') then raise exception 'not a decision: %', p_status; end if;
  update public.rainshare_review set status = p_status, decided_at = now(), decided_by = p_by, note = left(p_note, 600)
  where seed_uri = p_uri and cid = p_cid;
  get diagnostics n = row_count;
  return n > 0;
end
$$;

-- Writing, and the queue, are the droplet's alone. Reading the records is anyone's.
revoke execute on function public.rainshare_apply(jsonb, text[]) from public, anon, authenticated;
revoke execute on function public.rainshare_repo_uris(text) from public, anon, authenticated;
revoke execute on function public.rainshare_repos() from public, anon, authenticated;
revoke execute on function public.rainshare_reviews(timestamptz) from public, anon, authenticated;
revoke execute on function public.rainshare_review_requested(text, text, text) from public, anon, authenticated;
revoke execute on function public.rainshare_review_decide(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.rainshare_review_enqueue() from public, anon, authenticated;
grant execute on function public.rainshare_list(text, timestamptz, integer) to anon, authenticated;
grant execute on function public.rainshare_apply(jsonb, text[]) to service_role;
grant execute on function public.rainshare_repo_uris(text) to service_role;
grant execute on function public.rainshare_repos() to service_role;
grant execute on function public.rainshare_reviews(timestamptz) to service_role;
grant execute on function public.rainshare_review_requested(text, text, text) to service_role;
grant execute on function public.rainshare_review_decide(text, text, text, text, text) to service_role;
grant execute on function public.rainshare_list(text, timestamptz, integer) to service_role;
