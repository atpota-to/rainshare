-- From version 2026-11-16, people agree to Rainshare's Terms of Service alone. The Privacy
-- Policy is a notice that says what happens to data, and nobody is asked to agree to it
-- (core/legal.js, and the tick box in ui/agree.js).
--
-- What a row says was agreed to follows its version, not the day it was written. An older copy
-- of the site or the CLI can still note an older version after this runs, and the site can go
-- live a little before or after this does. So the database sets it, whatever the order.
alter table public.rainshare_terms_acceptance alter column document set default 'tos';

create or replace function public.rainshare_terms_document() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.document := case when new.policy_version >= '2026-11-16' then 'tos' else 'tos+privacy' end;
  return new;
end;
$$;

drop trigger if exists rainshare_terms_document on public.rainshare_terms_acceptance;
create trigger rainshare_terms_document before insert on public.rainshare_terms_acceptance
  for each row execute function public.rainshare_terms_document();

-- Rows already written, put right the same way.
update public.rainshare_terms_acceptance
  set document = case when policy_version >= '2026-11-16' then 'tos' else 'tos+privacy' end
  where document is distinct from case when policy_version >= '2026-11-16' then 'tos' else 'tos+privacy' end;

comment on column public.rainshare_terms_acceptance.document is 'What the account agreed to, set from the version when the row is written: tos+privacy for versions up to 2026-11-15, tos from 2026-11-16 on.';
