-- ============================================================
-- BharatBol — anonymous feed reactions (useful / not useful)
-- Run AFTER phase4_feed.sql. Design: docs/feed-reactions-design.md
--
-- Inherits §1 shape with a DISTINCT signed-message domain so stand
-- tokens cannot be replayed as reactions:
--   bharatbol:feedreact:v1:{feed_item_id}:{token}
-- The reaction value (up|down) is NOT in the signed message.
-- ============================================================

begin;

create table public.feed_reaction_issuance (
  user_id      uuid not null references auth.users (id) on delete cascade,
  feed_item_id uuid not null references public.feed_items (id) on delete cascade,
  issued_on    date not null default (now() at time zone 'Asia/Kolkata')::date,
  primary key (user_id, feed_item_id)
);
alter table public.feed_reaction_issuance enable row level security;
-- (no policies: service-role only)

create table public.feed_reactions (
  id           bigint generated always as identity primary key,
  feed_item_id uuid not null references public.feed_items (id) on delete cascade,
  nullifier    text not null unique check (nullifier ~ '^[0-9a-f]{64}$'),
  value        text not null check (value in ('up', 'down')),
  reacted_on   date not null default (now() at time zone 'Asia/Kolkata')::date
);
create index feed_reactions_item_idx on public.feed_reactions (feed_item_id, value);
alter table public.feed_reactions enable row level security;
create policy "feed reactions are public, read-only"
  on public.feed_reactions for select using (true);

create view public.feed_reaction_counts with (security_invoker = on) as
select
  feed_item_id,
  count(*) filter (where value = 'up')::bigint as ups,
  count(*) filter (where value = 'down')::bigint as downs
from public.feed_reactions
group by feed_item_id;

grant select on public.feed_reactions to anon, authenticated;
grant select on public.feed_reaction_counts to anon, authenticated;

-- Surges of "not useful" priority-flag the item for human look —
-- informational only; does NOT auto-hide (report path still does).
create or replace function public.flag_on_down_surge()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  downs bigint;
begin
  if new.value = 'down' then
    select count(*) into downs from public.feed_reactions
      where feed_item_id = new.feed_item_id and value = 'down';
    if downs >= 5 then
      update public.feed_items set flagged = true where id = new.feed_item_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger feed_reactions_down_surge
after insert on public.feed_reactions
for each row execute function public.flag_on_down_surge();

commit;
