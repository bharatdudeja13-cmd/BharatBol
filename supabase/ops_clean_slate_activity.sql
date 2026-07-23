-- ============================================================
-- BharatBol — clean-slate wipe of USER ACTIVITY (not stand catalog)
-- Run in Supabase SQL Editor as postgres / service role.
-- Project: byfwdrazysblopnlahmx
--
-- CLEARS: evidence (feed_items + reactions/reports), stand commitments,
--         wall entries, stand pulse history.
-- KEEPS:  stands definitions, stand_states tags, stand_of_the_day,
--         auth.users / profiles (so you can still sign in).
--
-- Safe to re-run. Does NOT drop tables.
-- ============================================================

begin;

-- Evidence reactions / reports first (FK → feed_items)
delete from public.feed_item_reactions;
delete from public.feed_reactions;
delete from public.feed_reaction_issuance;
delete from public.feed_reports;
delete from public.feed_items;

-- User stands (commitments) + public pulse log
delete from public.stand_commitments;
delete from public.stand_pulse;

-- Opt-in wall (names)
delete from public.wall_feed;
delete from public.wall_entries;

-- Legacy blind-ballot tables if still present
do $$
begin
  if to_regclass('public.ballots') is not null then
    execute 'delete from public.ballots';
  end if;
  if to_regclass('public.token_issuance') is not null then
    execute 'delete from public.token_issuance';
  end if;
  if to_regclass('public.stand_joins') is not null then
    execute 'delete from public.stand_joins';
  end if;
  if to_regclass('public.wall_events') is not null then
    execute 'delete from public.wall_events';
  end if;
end $$;

commit;

-- Sanity (should all be 0)
select
  (select count(*) from public.feed_items) as feed_items,
  (select count(*) from public.stand_commitments) as commitments,
  (select count(*) from public.stands where status = 'live') as live_stands_kept;
