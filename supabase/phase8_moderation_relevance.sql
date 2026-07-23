-- ============================================================
-- BharatBol — moderation relevance (Task 5)
-- Run AFTER phase7_geography.sql. Safe to re-run.
--
-- Relevance to the tagged civic issue is now an explicit approval
-- criterion. This migration adds a 'personal' reject reason for content
-- centred on a private individual / personal-lifestyle / appearance, so
-- moderators can reject it distinctly from 'offtopic' (not a civic issue
-- at all). No table shape changes; only the allowed reason set widens.
-- ============================================================

begin;

alter table public.feed_items
  drop constraint if exists feed_items_reject_reason_check;

alter table public.feed_items
  add constraint feed_items_reject_reason_check
  check (reject_reason in (
    'doxxing','violence','targeting','sexual','minor','misinfo',
    'offtopic','personal','duplicate','other'
  ));

commit;
