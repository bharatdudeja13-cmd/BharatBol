-- ============================================================
-- BharatBol — geography for evidence + stand↔ state tags
-- Run AFTER phase6_account_stands.sql.
--
-- Evidence: scope 'state' | 'national'. National clips appear on every
-- state tile; state-tagged only on that tile. Submit requires one or other.
--
-- Stands: every live stand is national (shows on every tile). Optional
-- stand_states tags mark "especially relevant in …" (multi-state OK).
-- ============================================================

begin;

-- ---------- feed_items.scope ----------
alter table public.feed_items
  add column if not exists scope text;

update public.feed_items
set scope = case when state is null then 'national' else 'state' end
where scope is null;

alter table public.feed_items
  alter column scope set default 'state';

alter table public.feed_items
  alter column scope set not null;

alter table public.feed_items
  drop constraint if exists feed_items_scope_check;

alter table public.feed_items
  add constraint feed_items_scope_check
  check (scope in ('state', 'national'));

alter table public.feed_items
  drop constraint if exists feed_items_scope_state_check;

alter table public.feed_items
  add constraint feed_items_scope_state_check
  check (
    (scope = 'national' and state is null)
    or (scope = 'state' and state is not null)
  );

create index if not exists feed_items_approved_scope_state_idx
  on public.feed_items (status, scope, state, approved_at desc);

-- ---------- stand_states (optional relevance tags) ----------
create table if not exists public.stand_states (
  stand_id uuid not null references public.stands (id) on delete cascade,
  state    text not null,
  primary key (stand_id, state)
);
create index if not exists stand_states_state_idx on public.stand_states (state);

alter table public.stand_states enable row level security;
drop policy if exists "stand_states public read" on public.stand_states;
create policy "stand_states public read" on public.stand_states
  for select using (true);
grant select on public.stand_states to anon, authenticated;
grant insert, update, delete on public.stand_states to authenticated;

-- Admins (sealed table) may tag stands and pin stand-of-the-day.
drop policy if exists "admins write stand_states" on public.stand_states;
create policy "admins write stand_states" on public.stand_states
  for all
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- Writes: service role / SQL only (admin UI uses service or elevated path later).

-- Today's featured stand pin (nullable single row).
create table if not exists public.stand_of_the_day (
  id         boolean primary key default true check (id),
  stand_id   uuid not null references public.stands (id) on delete cascade,
  pinned_on  date not null default (now() at time zone 'Asia/Kolkata')::date,
  updated_at timestamptz not null default now()
);
alter table public.stand_of_the_day enable row level security;
drop policy if exists "sotd public read" on public.stand_of_the_day;
create policy "sotd public read" on public.stand_of_the_day for select using (true);
grant select on public.stand_of_the_day to anon, authenticated;
grant insert, update, delete on public.stand_of_the_day to authenticated;

drop policy if exists "admins write sotd" on public.stand_of_the_day;
create policy "admins write sotd" on public.stand_of_the_day
  for all
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- Allow admins to insert/update live stands from the client.
drop policy if exists "admins write stands" on public.stands;
create policy "admins write stands" on public.stands
  for all
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));
grant insert, update on public.stands to authenticated;

-- ---------- PUBLIC AGGREGATES (security definer) ----------
-- phase6 used security_invoker views over stand_commitments / feed_item_reactions,
-- which only expose the caller's own rows under RLS — so anon saw totals of 0.
-- Recreate as security_invoker = false (definer) so everyone sees counts only,
-- never user_id. Rows themselves stay owner-RLS.
drop view if exists public.stand_counts;
create view public.stand_counts with (security_invoker = false) as
select
  stand_id,
  count(*)::bigint as total,
  count(*) filter (where stood_on = (now() at time zone 'Asia/Kolkata')::date)::bigint as today
from public.stand_commitments
group by stand_id;

drop view if exists public.state_breakdown;
create view public.state_breakdown with (security_invoker = false) as
select stand_id, state, count(*)::bigint as count
from public.stand_commitments
where state is not null
group by stand_id, state;

create or replace function public.get_national_total()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(count(*), 0)::bigint from public.stand_commitments;
$$;

drop view if exists public.feed_reaction_counts;
create view public.feed_reaction_counts with (security_invoker = false) as
select
  feed_item_id,
  count(*) filter (where value = 'up')::bigint as ups,
  count(*) filter (where value = 'down')::bigint as downs
from public.feed_item_reactions
group by feed_item_id;

grant select on public.stand_counts, public.state_breakdown, public.feed_reaction_counts to anon, authenticated;
grant execute on function public.get_national_total() to anon, authenticated;

commit;
