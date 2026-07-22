-- ============================================================
-- BharatBol — content ingestion + issue feed
-- Run AFTER phase3_polls.sql. Design: docs/content-feed-design.md
--
-- PRIVACY SHAPE (deliberate and disclosed, and NOT the ballot model):
--   * feed_items has NO submitter column at all. The public feed can
--     never show, join to, or infer who submitted an item.
--   * submission_ledger links account -> submission for anti-abuse,
--     dedup and takedown only. RLS on, ZERO policies, ZERO grants:
--     reachable exclusively by the service role inside Edge Functions.
--   * admins is sealed the same way.
--   * Ballots stay cryptographically unlinkable; nothing here touches
--     that model. See §2 of the design doc for the honest asymmetry.
--
-- PUBLISHING RULE: only status='approved' is publicly readable, and
-- nothing reaches that status except through the admin-gated
-- feed-moderate function. There is no auto-approve path anywhere.
-- ============================================================

begin;

-- ---------- Admins (sealed) ----------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  added_at   timestamptz not null default now()
);
alter table public.admins enable row level security;
-- (no policies: service-role only)

-- ---------- Feed items ----------
create table public.feed_items (
  id            uuid primary key default gen_random_uuid(),
  url           text not null,
  -- Canonical form (host normalised, tracking params stripped) — the
  -- global dedup key: one feed item per underlying post, ever.
  url_canon     text not null unique,
  platform      text not null check (platform in ('youtube', 'x', 'instagram')),
  -- Public metadata from official oEmbed only. Never media bytes.
  title         text,
  author_name   text,
  thumbnail_url text,
  issue         text not null,
  state         text,
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected', 'needs_info', 're_review')),
  reject_reason text check (reject_reason in
                 ('doxxing','violence','targeting','sexual','minor','misinfo','offtopic','duplicate','other')),
  -- Set by the conservative keyword pre-screen: prioritises human review,
  -- never publishes or rejects on its own.
  flagged       boolean not null default false,
  reports       integer not null default 0,
  submitted_on  date not null default (now() at time zone 'Asia/Kolkata')::date,
  approved_at   timestamptz
);
create index feed_items_public_idx on public.feed_items (status, approved_at desc);
create index feed_items_issue_idx on public.feed_items (issue, state);

alter table public.feed_items enable row level security;
-- The ONLY public read: approved items. Pending/rejected/re_review are
-- invisible to everyone but the service role.
create policy "approved feed items are public"
  on public.feed_items for select using (status = 'approved');
-- (no insert/update/delete policies: writes only via Edge Functions)

-- ---------- Submission ledger (sealed: anti-abuse + takedown only) ----------
create table public.submission_ledger (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  feed_item_id  uuid references public.feed_items (id) on delete set null,
  url_canon     text not null,
  submitted_at  timestamptz not null default now()
);
create index submission_ledger_user_idx on public.submission_ledger (user_id, submitted_at desc);
alter table public.submission_ledger enable row level security;
-- (no policies, no grants: service-role only — never exposed to the app)

-- ---------- Reports (no account required; no identity stored) ----------
create table public.feed_reports (
  id           bigint generated always as identity primary key,
  feed_item_id uuid not null references public.feed_items (id) on delete cascade,
  reason       text not null check (reason in
                ('doxxing','violence','targeting','sexual','minor','misinfo','offtopic','copyright','other')),
  note         text,
  reported_on  date not null default (now() at time zone 'Asia/Kolkata')::date
);
alter table public.feed_reports enable row level security;
-- (no policies: written by the feed-report function, read by moderators)

grant select on public.feed_items to anon, authenticated;

-- ---------- Realtime ----------
-- Approved items appear live; nothing pending is ever published.
alter publication supabase_realtime add table public.feed_items;

commit;
