-- The review queue goes. @rainshare.dev no longer asks anyone before it posts: once a day it posts
-- how many new asks there are on the board, naming none of them (../../announcer/src/posts.js),
-- so nothing reads or writes rainshare_review any more. This drops it, with the answers it held:
-- who said yes or no to which ask, and the notes kept with a hide. The hides themselves are public
-- moderation records in @rainshare.dev's repo, and stay.
--
-- Applies after 20261115230000_rainshare_review_post_or_send.sql, once the announcer that no
-- longer reads the queue is live (an older one finds no queue, says so, and posts nothing new).
-- The Privacy Policy (../../core/legal.js) says the notes are deleted, so apply it with that
-- change.

drop trigger if exists rainshare_review_enqueue on public.rainshare_records;
drop function if exists public.rainshare_review_enqueue();
drop function if exists public.rainshare_reviews(timestamptz);
drop function if exists public.rainshare_review_requested(text, text, text);
drop function if exists public.rainshare_review_decide(text, text, text, text, text);
drop table if exists public.rainshare_review;

comment on table public.rainshare_index_excluded is 'Accounts whose dev.rainshare.* records rainshare_records never keeps: adding a DID deletes its rows there, and a trigger on rainshare_records skips anything written from it afterwards. Service role only: RLS enabled with no policies. See indexer/README.md in atpota-to/rainshare.';
