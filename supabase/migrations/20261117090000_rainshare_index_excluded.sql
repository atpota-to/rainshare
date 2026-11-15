-- Accounts whose records the index doesn't keep (indexer/README.md, "Leaving an account out").
--
-- Someone can ask for their records to be kept out of Rainshare's copy while they stay in their
-- own account: an objection to the copy, a request to delete what we hold, a child's account.
-- Deleting the rows alone doesn't last, since the stream and the six-hourly reconcile copy them
-- again. So the account's DID goes on this list, and the database itself does the rest:
--
--   - adding a DID deletes every row it has in rainshare_records (and, by the cascade, the
--     review notes for its asks), in the same transaction
--   - from then on a row from that DID is never written, whoever tries: a trigger on
--     rainshare_records skips it. So the indexer needs no list of its own, and nothing it does
--     (a stream event, a reconcile, a retry) can put one back
--   - removing a DID lets its records back in, at the next reconcile or the next time one changes
--
-- Service role only, like the review queue: the list says who asked to be left out.
-- Applies after 20261115210000_rainshare_index.sql.

create table if not exists public.rainshare_index_excluded (
  -- (a length check beside the pattern: Postgres takes no repetition count above 255)
  did       text        primary key check (did ~ '^did:[a-z]+:[A-Za-z0-9._:%-]+$' and char_length(did) <= 2048),
  -- why, in a few words: how they asked. Ours to read, never shown.
  reason    text        check (char_length(reason) <= 300),
  added_at  timestamptz not null default now(),
  -- @rainshare.dev's own decisions are what the apps hide by (core/ns.js MODERATOR): never left out
  check (did <> 'did:plc:cmkittusvczhnei4gjt3asiv')
);
comment on table public.rainshare_index_excluded is 'Accounts whose dev.rainshare.* records rainshare_records never keeps: adding a DID deletes its rows there (and the review notes for its asks), and a trigger on rainshare_records skips anything written from it afterwards. Service role only: RLS enabled with no policies. See indexer/README.md in atpota-to/rainshare.';
comment on column public.rainshare_index_excluded.reason is 'Why, in a few words (how they asked). Never shown to anyone.';

-- Nobody but the service role: no policies, and nothing granted to the public roles.
alter table public.rainshare_index_excluded enable row level security;
revoke all on table public.rainshare_index_excluded from anon, authenticated;
grant select, insert, update, delete on table public.rainshare_index_excluded to service_role;

-- A row from an account on the list is skipped: not written, and not an error, so the rest of
-- a batch goes through (rainshare_apply counts only what was kept).
create or replace function public.rainshare_skip_excluded()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (select 1 from public.rainshare_index_excluded x where x.did = new.did) then
    return null;
  end if;
  return new;
end
$$;
drop trigger if exists rainshare_skip_excluded on public.rainshare_records;
create trigger rainshare_skip_excluded before insert or update on public.rainshare_records
  for each row execute function public.rainshare_skip_excluded();

-- Adding an account deletes what the index has of it. The lock waits for a batch that's being
-- written as this runs, and holds the next one back until this commits, so a row written at the
-- same moment can't slip past both this delete and the trigger above.
create or replace function public.rainshare_excluded_forget()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  lock table public.rainshare_records in share row exclusive mode;
  delete from public.rainshare_records where did = new.did;
  return new;
end
$$;
drop trigger if exists rainshare_excluded_forget on public.rainshare_index_excluded;
create trigger rainshare_excluded_forget after insert or update of did on public.rainshare_index_excluded
  for each row execute function public.rainshare_excluded_forget();

-- Only ever run as triggers.
revoke execute on function public.rainshare_skip_excluded() from public, anon, authenticated;
revoke execute on function public.rainshare_excluded_forget() from public, anon, authenticated;
