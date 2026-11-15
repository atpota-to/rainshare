-- From version 2026-11-16, people agree to Rainshare's Terms of Service alone. The Privacy
-- Policy is a notice that says what happens to data, and nobody is asked to agree to it
-- (core/legal.js, and the tick box in ui/agree.js). Rows written from here on say so. Earlier
-- rows keep 'tos+privacy', which is what those accounts were asked to agree to at the time.
alter table public.rainshare_terms_acceptance alter column document set default 'tos';

comment on column public.rainshare_terms_acceptance.document is 'What the account agreed to: tos+privacy for versions up to 2026-11-15, tos from 2026-11-16 on.';
