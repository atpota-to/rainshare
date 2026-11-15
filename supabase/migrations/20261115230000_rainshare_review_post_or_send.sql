-- The approver can say yes to one way of passing an ask on: POST (only posted by @rainshare.dev)
-- or SEND (only in the new-asks direct messages), as well as YES (both). See
-- ../../announcer/src/review.js. Applies after 20261115210000_rainshare_index.sql.

alter table public.rainshare_review drop constraint if exists rainshare_review_status_check;
alter table public.rainshare_review add constraint rainshare_review_status_check
  check (status in ('pending', 'approved', 'post_only', 'send_only', 'declined', 'hidden'));
comment on column public.rainshare_review.status is 'pending: not asked or not answered. approved: may be posted and sent. post_only: may be posted, not sent. send_only: may be sent, not posted. declined: stays on the board, never passed on. hidden: hidden from Rainshare (a moderation record in @rainshare.dev''s repo says so).';

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
  if p_status not in ('approved', 'post_only', 'send_only', 'declined', 'hidden') then raise exception 'not a decision: %', p_status; end if;
  update public.rainshare_review set status = p_status, decided_at = now(), decided_by = p_by, note = left(p_note, 600)
  where seed_uri = p_uri and cid = p_cid;
  get diagnostics n = row_count;
  return n > 0;
end
$$;

-- create or replace keeps the function's grants, but say them again so this file stands alone.
revoke execute on function public.rainshare_review_decide(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.rainshare_review_decide(text, text, text, text, text) to service_role;
