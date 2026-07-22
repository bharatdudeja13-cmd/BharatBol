-- ============================================================
-- BharatBol Phase 2 — DRAFT privacy-hardening migration (§1)
-- Run AFTER schema.sql. Status: awaiting review — not yet wired
-- to the UI. See docs/privacy-architecture.md for the full design.
--
-- WHAT CHANGES: the account-linked join pathway (stand_joins →
-- wall_events) is removed entirely. In its place:
--
--   REGISTRAR side (account-linked, reveals no preference):
--     token_issuance — records only that an account has been
--     issued blind tokens. Tokens are issued for ALL live stands
--     in one batch at sign-in, so a row here says nothing about
--     what anyone supports.
--
--   BALLOT side (anonymous, the public record):
--     ballots — one row per stand taken. No user_id column, no
--     FK to auth.users, date-only timestamps. The unique
--     nullifier (hash of a blind-signed token) enforces
--     one-ballot-per-account-per-stand without knowing the account.
--
--   WALL side (voluntary public identity, user-controlled):
--     wall_entries — created only when a citizen opts in to being
--     named. User-linked ON PURPOSE so it stays editable and
--     erasable (DPDP); mirrored to wall_feed (no user_id) for
--     public reads + realtime.
--
-- Ballot writes happen ONLY through Edge Functions holding the
-- service role: registrar-issue, ballot-cast, ballot-withdraw.
-- ============================================================

begin;

-- ---------- 1. Remove the Phase-1 linked pathway ----------
drop view if exists public.stand_counts;
drop view if exists public.state_breakdown;
drop view if exists public.wall;
drop trigger if exists stand_joins_publish on public.stand_joins;
drop trigger if exists profiles_sync_wall on public.profiles;
drop function if exists public.publish_wall_event();
drop function if exists public.sync_wall_events();
drop table if exists public.wall_events;
drop table if exists public.stand_joins;

-- ---------- 2. Registrar: token issuance ledger ----------
-- One row per (account, stand) = "a blind token was issued".
-- Because issuance is batched over ALL live stands at sign-in,
-- this table's contents are uniform across users and reveal no
-- preference. RLS is enabled with NO policies: only the registrar
-- Edge Function (service role) can read or write it.
create table public.token_issuance (
  user_id   uuid not null references auth.users (id) on delete cascade,
  stand_id  uuid not null references public.stands (id) on delete cascade,
  issued_on date not null default (now() at time zone 'Asia/Kolkata')::date,
  primary key (user_id, stand_id)
);
alter table public.token_issuance enable row level security;
-- (no policies: deny-all except service role)

-- ---------- 3. Ballot store: the anonymous public record ----------
-- THE table public counts read from. Constraints that keep the
-- promise, enforced by the schema itself:
--   * no user_id column exists; no FK to auth.users
--   * nullifier = sha256(token) is UNIQUE → a token spends once
--   * joined_on is a DATE (IST) — no fine-grained timing to
--     correlate against registrar or platform logs
create table public.ballots (
  id        bigint generated always as identity primary key,
  stand_id  uuid not null references public.stands (id) on delete cascade,
  nullifier text not null unique
            check (nullifier ~ '^[0-9a-f]{64}$'),
  state     text,
  joined_on date not null default (now() at time zone 'Asia/Kolkata')::date
);
create index ballots_stand_idx on public.ballots (stand_id, joined_on);
-- Realtime DELETE events must carry stand_id/state so live counters can
-- decrement on withdrawal. Every column here is public anyway.
alter table public.ballots replica identity full;
alter table public.ballots enable row level security;
create policy "ballots are public, read-only"
  on public.ballots for select using (true);
-- (no insert/update/delete policies: writes only via ballot-cast /
--  ballot-withdraw Edge Functions after verifying the blind signature)

-- ---------- 4. Wall: voluntary public identity ----------
-- Opting into the wall is the ONE place a citizen chooses to tie
-- their account to a stand — the price of retroactive control
-- (edit name, opt out later, cascade on erasure). The join count
-- never depends on this table; it is publicity, not counting.
create table public.wall_entries (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  stand_id   uuid not null references public.stands (id) on delete cascade,
  first_name text not null,
  state      text,
  created_at timestamptz not null default now(),
  unique (user_id, stand_id)
);
alter table public.wall_entries enable row level security;
create policy "own wall entries select" on public.wall_entries for select using (auth.uid() = user_id);
create policy "own wall entries insert" on public.wall_entries for insert with check (auth.uid() = user_id);
create policy "own wall entries update" on public.wall_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own wall entries delete" on public.wall_entries for delete using (auth.uid() = user_id);

-- Public mirror with NO user_id — safe for anonymous realtime.
create table public.wall_feed (
  id         bigint generated always as identity primary key,
  entry_id   bigint not null unique references public.wall_entries (id) on delete cascade,
  stand_id   uuid not null references public.stands (id) on delete cascade,
  first_name text not null,
  state      text,
  created_at timestamptz not null default now()
);
create index wall_feed_stand_created_idx on public.wall_feed (stand_id, created_at desc);
alter table public.wall_feed enable row level security;
create policy "wall feed is public" on public.wall_feed for select using (true);

create or replace function public.mirror_wall_entry()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.wall_feed (entry_id, stand_id, first_name, state, created_at)
    values (new.id, new.stand_id, new.first_name, new.state, new.created_at);
  elsif tg_op = 'UPDATE' then
    update public.wall_feed
    set first_name = new.first_name, state = new.state
    where entry_id = new.id;
  end if;
  return new;
end;
$$;

create trigger wall_entries_mirror
after insert or update on public.wall_entries
for each row execute function public.mirror_wall_entry();

-- Profile edits keep the public wall in sync (name change / opt-out).
create or replace function public.sync_wall_from_profile()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.show_on_wall = false then
    delete from public.wall_entries where user_id = new.id;
  else
    update public.wall_entries
    set first_name = new.first_name, state = new.state
    where user_id = new.id;
  end if;
  return new;
end;
$$;

create trigger profiles_sync_wall
after update on public.profiles
for each row execute function public.sync_wall_from_profile();

-- ---------- 5. Public read models (rebuilt over ballots) ----------
create view public.stand_counts with (security_invoker = on) as
select
  stand_id,
  count(*)::bigint as total,
  count(*) filter (where joined_on = (now() at time zone 'Asia/Kolkata')::date)::bigint as today
from public.ballots
group by stand_id;

create view public.state_breakdown with (security_invoker = on) as
select stand_id, state, count(*)::bigint as count
from public.ballots
where state is not null
group by stand_id, state;

create view public.wall with (security_invoker = on) as
select stand_id, first_name, state, created_at
from public.wall_feed;

grant select on public.stand_counts, public.state_breakdown, public.wall to anon, authenticated;

-- HONESTY NOTE — metric change: ballots for different stands are
-- cryptographically unlinkable, so "distinct citizens across all
-- stands" is no longer computable by anyone, including us. The
-- national headline becomes total stands taken, labelled as such.
create or replace function public.get_national_total()
returns bigint
language sql security invoker stable
as $$
  select coalesce(count(*), 0)::bigint from public.ballots;
$$;
grant execute on function public.get_national_total() to anon, authenticated;

-- ---------- 6. Realtime ----------
-- (wall_events left the publication automatically when it was dropped)
alter publication supabase_realtime add table public.ballots;
alter publication supabase_realtime add table public.wall_feed;

-- ---------- 7. Erasure (unchanged entry point) ----------
-- delete_my_account() still deletes auth.users → cascades:
-- profiles, token_issuance, wall_entries (→ wall_feed).
-- Anonymous ballots are NOT deleted by account erasure — they are
-- not linkable to the account (that is the whole point). The app
-- withdraws all ballots first using the client-held receipts, so
-- normal erasure still decrements every count.

commit;
