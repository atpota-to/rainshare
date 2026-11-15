-- Rainshare's ledger of who has agreed to its Terms of Service and Privacy Policy.
--
-- One row per account and version. It's written only by the rainshare-agree Edge Function
-- (supabase/functions/rainshare-agree), which reads the account's own settings record from the
-- account's host before noting anything, so a row is always something the account itself said.
-- It follows public.anisota_terms_acceptance (the same company's ledger for Anisota) in its
-- names. It keeps no IP address or browser details: what it has instead is the record's CID and
-- `proof`, the record with the commit its host signed over it.
create table if not exists public.rainshare_terms_acceptance (
  id uuid primary key default gen_random_uuid(),
  did text not null check (did ~ '^did:(plc|web):[A-Za-z0-9._:%-]{1,240}$'),
  policy_version text not null check (policy_version ~ '^\d{4}-\d{2}-\d{2}$'),
  document text not null default 'tos+privacy',
  accepted_at timestamptz not null,
  via text not null default 'web' check (via in ('web', 'cli')),
  record_uri text not null,
  record_cid text,
  proof text,
  logged_at timestamptz not null default now(),
  constraint rainshare_terms_acceptance_once unique (did, policy_version)
);

comment on table public.rainshare_terms_acceptance is 'Who agreed to Rainshare''s terms, which version and when: one row per account and version, written by the rainshare-agree Edge Function after it has read the account''s own dev.rainshare.preferences record from the account''s host. Service-role only: RLS enabled with no policies.';
comment on column public.rainshare_terms_acceptance.accepted_at is 'When the account''s own record says it agreed (terms.agreedAt).';
comment on column public.rainshare_terms_acceptance.via is 'Where they agreed, as the caller said: web or cli.';
comment on column public.rainshare_terms_acceptance.record_cid is 'The CID of the settings record as it was read.';
comment on column public.rainshare_terms_acceptance.proof is 'Base64 of com.atproto.sync.getRecord for that record: a CAR holding the record and the commit its host signed, so the row can be checked after the record is gone. Null if the host wouldn''t give one.';
comment on column public.rainshare_terms_acceptance.logged_at is 'When this row was written.';

-- Nobody but the service role: no policies, and nothing granted to the public roles.
alter table public.rainshare_terms_acceptance enable row level security;
revoke all on table public.rainshare_terms_acceptance from anon, authenticated;
