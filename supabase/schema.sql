-- ============================================================
-- BharatBol — schema, RLS, public views, RPCs, triggers, seed data
-- Run this once in the Supabase SQL editor (or `supabase db push`).
--
-- THE PROMISE: prove how many, never show who.
--   * stand_joins (the dedup table) holds user_id and is NEVER
--     publicly selectable, and is never joined into a public view.
--   * Everything public reads from wall_events, which carries no
--     user_id — only stand_id, an optional first name, and state.
-- ============================================================

-- ---------- Tables ----------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  first_name   text not null default '',
  state        text,
  show_on_wall boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.stands (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  title_hi       text,
  description    text not null,
  description_hi text,
  category       text not null default 'national',
  status         text not null default 'live',
  created_at     timestamptz not null default now()
);

create table public.stand_joins (
  id         uuid primary key default gen_random_uuid(),
  stand_id   uuid not null references public.stands (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  state      text,
  created_at timestamptz not null default now(),
  unique (stand_id, user_id)          -- one stand per account, enforced by the DB
);

-- Public, privacy-safe mirror of joins. No user_id column exists here.
-- join_id lets a deleted account (or withdrawn stand) cascade out of the
-- public record, keeping counts honest.
create table public.wall_events (
  id         bigint generated always as identity primary key,
  join_id    uuid not null unique references public.stand_joins (id) on delete cascade,
  stand_id   uuid not null references public.stands (id) on delete cascade,
  first_name text,                     -- null = citizen opted out of the wall
  state      text,
  created_at timestamptz not null default now()
);

create index stand_joins_stand_idx on public.stand_joins (stand_id);
create index wall_events_stand_created_idx on public.wall_events (stand_id, created_at desc);
create index wall_events_created_idx on public.wall_events (created_at desc);

-- ---------- Row Level Security ----------

alter table public.profiles    enable row level security;
alter table public.stands      enable row level security;
alter table public.stand_joins enable row level security;
alter table public.wall_events enable row level security;

-- profiles: a user sees and edits only their own row.
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- stands: anyone (signed in or not) can read live stands. No public writes.
create policy "live stands are public" on public.stands for select using (status = 'live');

-- stand_joins: users may insert only their own row, see only their own rows,
-- and withdraw (delete) only their own rows. NO public select — user_id never leaves.
create policy "join as self"     on public.stand_joins for insert with check (auth.uid() = user_id);
create policy "see own joins"    on public.stand_joins for select using (auth.uid() = user_id);
create policy "withdraw own"     on public.stand_joins for delete using (auth.uid() = user_id);

-- wall_events: world-readable, written only by the triggers below.
create policy "wall is public" on public.wall_events for select using (true);

-- ---------- Triggers keep wall_events in sync ----------

-- On join: publish an anonymous-by-default event (name only if opted in).
create or replace function public.publish_wall_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  p record;
begin
  select first_name, state, show_on_wall into p from public.profiles where id = new.user_id;
  insert into public.wall_events (join_id, stand_id, first_name, state, created_at)
  values (
    new.id,
    new.stand_id,
    case when coalesce(p.show_on_wall, false) and coalesce(p.first_name, '') <> '' then p.first_name end,
    coalesce(new.state, p.state),
    new.created_at
  );
  return new;
end;
$$;

create trigger stand_joins_publish
after insert on public.stand_joins
for each row execute function public.publish_wall_event();

-- On profile edit: retroactively honour name changes and wall opt-out (DPDP spirit).
create or replace function public.sync_wall_events()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.wall_events w
  set first_name = case when new.show_on_wall and coalesce(new.first_name, '') <> '' then new.first_name end,
      state      = new.state
  from public.stand_joins j
  where w.join_id = j.id and j.user_id = new.id;
  return new;
end;
$$;

create trigger profiles_sync_wall
after update on public.profiles
for each row execute function public.sync_wall_events();

-- ---------- Public read models (no user_id anywhere) ----------

-- Per-stand totals with today's momentum (midnight, Indian Standard Time).
create view public.stand_counts with (security_invoker = on) as
select
  stand_id,
  count(*)::bigint as total,
  count(*) filter (
    where created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')
  )::bigint as today
from public.wall_events
group by stand_id;

-- State-wise breakdown per stand (for the tilegram map).
create view public.state_breakdown with (security_invoker = on) as
select stand_id, state, count(*)::bigint as count
from public.wall_events
where state is not null
group by stand_id, state;

-- The supporter wall: first name + state only, opt-in only.
create view public.wall with (security_invoker = on) as
select stand_id, first_name, state, created_at
from public.wall_events
where first_name is not null;

grant select on public.stand_counts, public.state_breakdown, public.wall to anon, authenticated;

-- National total = distinct citizens standing (across all stands).
-- SECURITY DEFINER so it can count the private table without exposing rows.
create or replace function public.get_national_total()
returns bigint
language sql security definer set search_path = public
stable
as $$
  select count(distinct user_id) from public.stand_joins;
$$;

grant execute on function public.get_national_total() to anon, authenticated;

-- ---------- Data rights: full erasure ----------
-- Deletes the auth user; profiles, stand_joins and wall_events cascade away.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- Realtime ----------
-- Clients subscribe to wall_events inserts to bump counters and the wall live.
alter publication supabase_realtime add table public.wall_events;

-- ---------- Seed: five neutral, issue-framed, cross-partisan stands ----------

insert into public.stands (title, title_hi, description, description_hi, category) values
(
  'An independent re-audit of the 2026 NEET & CBSE examinations',
  '2026 NEET और CBSE परीक्षाओं का स्वतंत्र पुनः-ऑडिट',
  'A neutral, independent audit of this year''s NEET and CBSE examination processes, with the findings published for everyone to read. This is not against any person or institution — it is for restoring every student''s confidence in the system.',
  'इस वर्ष की NEET और CBSE परीक्षा प्रक्रियाओं का एक तटस्थ, स्वतंत्र ऑडिट, जिसके निष्कर्ष सबके लिए प्रकाशित हों। यह किसी व्यक्ति या संस्था के विरुद्ध नहीं है — यह हर विद्यार्थी का भरोसा लौटाने के लिए है।',
  'education'
),
(
  'Publish examination-body audit reports publicly',
  'परीक्षा संस्थाओं की ऑडिट रिपोर्ट सार्वजनिक हों',
  'Every audit report of every public examination body should be published openly, as a matter of routine. Transparency is not an accusation — it is how trust is built.',
  'हर सार्वजनिक परीक्षा संस्था की हर ऑडिट रिपोर्ट नियमित रूप से सार्वजनिक की जाए। पारदर्शिता कोई आरोप नहीं है — यही भरोसे की नींव है।',
  'transparency'
),
(
  'A fixed timeline to fill vacant public teaching posts',
  'रिक्त सरकारी शिक्षक पदों को भरने की निश्चित समय-सीमा',
  'Lakhs of sanctioned teaching posts lie vacant across India. A clear, published timeline to fill them — with progress reported openly — would serve every child, in every state.',
  'भारत भर में लाखों स्वीकृत शिक्षक पद रिक्त हैं। इन्हें भरने की स्पष्ट, प्रकाशित समय-सीमा — और प्रगति की खुली रिपोर्टिंग — हर राज्य के हर बच्चे के हित में है।',
  'education'
),
(
  'Stronger safeguards for the integrity of every vote',
  'हर वोट की विश्वसनीयता के लिए मज़बूत सुरक्षा उपाय',
  'Whatever party we each support, all of us depend on every vote being counted correctly. Stronger, verifiable safeguards and open processes protect everyone equally.',
  'हम चाहे किसी भी दल का समर्थन करें, हम सब इस बात पर निर्भर हैं कि हर वोट सही गिना जाए। मज़बूत, सत्यापन-योग्य सुरक्षा उपाय और खुली प्रक्रियाएँ सबकी समान रूप से रक्षा करती हैं।',
  'democracy'
),
(
  'Faster, transparent action on youth unemployment',
  'युवा बेरोज़गारी पर तेज़ और पारदर्शी कार्रवाई',
  'Regular, honest publication of employment data and a transparent, time-bound plan for youth employment — an issue that touches every family, across every party line.',
  'रोज़गार के आँकड़ों का नियमित, ईमानदार प्रकाशन और युवा रोज़गार के लिए पारदर्शी, समयबद्ध योजना — एक ऐसा मुद्दा जो हर दल-रेखा के पार, हर परिवार को छूता है।',
  'employment'
);
