-- ============================================================
-- BharatBol — TEMPORARY account-linked stands + reactions
-- Run AFTER phase5_feed_reactions.sql.
--
-- GUARDRAIL FLAG: this overrides §1 unlinkable ballots by explicit
-- human request ("remove receipts; tie to login"). The database CAN
-- link user_id → stand / reaction. Public UI still does not publish
-- names on counts; supporter wall stays opt-in.
--
-- SEAM to restore blind ballots: stop writing stand_commitments,
-- revive ballot-cast / registrar-issue client path, point views
-- back at public.ballots (see docs/privacy-architecture.md).
-- ============================================================

begin;

-- ---------- Account-linked stand commitments ----------
create table if not exists public.stand_commitments (
  user_id   uuid not null references auth.users (id) on delete cascade,
  stand_id  uuid not null references public.stands (id) on delete cascade,
  state     text,
  stood_on  date not null default (now() at time zone 'Asia/Kolkata')::date,
  primary key (user_id, stand_id)
);
create index if not exists stand_commitments_stand_idx
  on public.stand_commitments (stand_id, stood_on);

alter table public.stand_commitments enable row level security;
drop policy if exists "commit as self" on public.stand_commitments;
drop policy if exists "see own commitments" on public.stand_commitments;
drop policy if exists "withdraw own commitment" on public.stand_commitments;
create policy "commit as self" on public.stand_commitments
  for insert with check (auth.uid() = user_id);
create policy "see own commitments" on public.stand_commitments
  for select using (auth.uid() = user_id);
create policy "withdraw own commitment" on public.stand_commitments
  for delete using (auth.uid() = user_id);
-- (no public select of user_id — counts come from views / pulse)

-- Public pulse for live counters — NO user_id (realtime-safe).
create table if not exists public.stand_pulse (
  id       bigint generated always as identity primary key,
  stand_id uuid not null references public.stands (id) on delete cascade,
  state    text,
  delta    smallint not null check (delta in (-1, 1)),
  at       timestamptz not null default now()
);
alter table public.stand_pulse enable row level security;
drop policy if exists "stand pulse is public" on public.stand_pulse;
create policy "stand pulse is public" on public.stand_pulse for select using (true);
grant select on public.stand_pulse to anon, authenticated;

create or replace function public.pulse_on_commitment()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.stand_pulse (stand_id, state, delta) values (new.stand_id, new.state, 1);
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.stand_pulse (stand_id, state, delta) values (old.stand_id, old.state, -1);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists stand_commitments_pulse on public.stand_commitments;
create trigger stand_commitments_pulse
after insert or delete on public.stand_commitments
for each row execute function public.pulse_on_commitment();

-- Point public aggregates at account-linked commitments.
create or replace view public.stand_counts with (security_invoker = on) as
select
  stand_id,
  count(*)::bigint as total,
  count(*) filter (where stood_on = (now() at time zone 'Asia/Kolkata')::date)::bigint as today
from public.stand_commitments
group by stand_id;

create or replace view public.state_breakdown with (security_invoker = on) as
select stand_id, state, count(*)::bigint as count
from public.stand_commitments
where state is not null
group by stand_id, state;

create or replace function public.get_national_total()
returns bigint
language sql security invoker stable
as $$
  select coalesce(count(*), 0)::bigint from public.stand_commitments;
$$;

alter table public.stand_pulse replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.stand_pulse;
exception when duplicate_object then null;
end $$;

-- ---------- Account-linked feed reactions ----------
create table if not exists public.feed_item_reactions (
  user_id      uuid not null references auth.users (id) on delete cascade,
  feed_item_id uuid not null references public.feed_items (id) on delete cascade,
  value        text not null check (value in ('up', 'down')),
  reacted_on   date not null default (now() at time zone 'Asia/Kolkata')::date,
  primary key (user_id, feed_item_id)
);
create index if not exists feed_item_reactions_item_idx
  on public.feed_item_reactions (feed_item_id, value);

alter table public.feed_item_reactions enable row level security;
drop policy if exists "react as self" on public.feed_item_reactions;
drop policy if exists "see own reactions" on public.feed_item_reactions;
drop policy if exists "update own reactions" on public.feed_item_reactions;
drop policy if exists "delete own reactions" on public.feed_item_reactions;
create policy "react as self" on public.feed_item_reactions
  for insert with check (auth.uid() = user_id);
create policy "see own reactions" on public.feed_item_reactions
  for select using (auth.uid() = user_id);
create policy "update own reactions" on public.feed_item_reactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own reactions" on public.feed_item_reactions
  for delete using (auth.uid() = user_id);

create or replace view public.feed_reaction_counts with (security_invoker = on) as
select
  feed_item_id,
  count(*) filter (where value = 'up')::bigint as ups,
  count(*) filter (where value = 'down')::bigint as downs
from public.feed_item_reactions
group by feed_item_id;

grant select on public.feed_reaction_counts to anon, authenticated;

-- Down-surge still priority-flags (informational; does not hide).
create or replace function public.flag_on_account_down_surge()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  downs bigint;
begin
  if new.value = 'down' then
    select count(*) into downs from public.feed_item_reactions
      where feed_item_id = new.feed_item_id and value = 'down';
    if downs >= 5 then
      update public.feed_items set flagged = true where id = new.feed_item_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists feed_item_reactions_down_surge on public.feed_item_reactions;
create trigger feed_item_reactions_down_surge
after insert or update on public.feed_item_reactions
for each row execute function public.flag_on_account_down_surge();

commit;
