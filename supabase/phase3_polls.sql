-- ============================================================
-- BharatBol Job 3 — Polls ("where do you stand?")
-- DRAFT — awaiting review; UI and Edge Function wiring paused.
-- Run AFTER phase2b_public_log.sql.
--
-- Polls inherit the §1 anonymous-token architecture wholesale:
--
--   * At sign-in the registrar blind-signs one token per (account, poll)
--     for EVERY live poll in the same batch as stands — the issuance
--     ledger stays uniform and carries no preference signal.
--   * The signed message is bharatbol:pollballot:v1:{poll_id}:{token}.
--     The CHOSEN OPTION IS NOT IN THE SIGNED MESSAGE — tokens are issued
--     before any choice exists. The option travels only in the anonymous
--     cast request and is stored in the anonymous row.
--   * nullifier = sha256(message) is UNIQUE → one response per account
--     per poll, whichever option. Changing your answer = withdraw
--     (delete by nullifier, using the client-held receipt) + re-cast the
--     same token with a different option.
--   * poll_ballots has NO user column and NO FK to auth.users; the §1
--     unlinkability gate is extended to cover it.
--   * Every mutation is mirrored into an append-only anonymous poll_log
--     (same pattern as ballot_log) so the Merkle/recount spine covers
--     polls too.
--
-- Guardrails: seed polls are issue-framed and neutral, never about a
-- named individual; every option set includes an "Unsure / need more
-- info" (or "Prefer not to say") choice; results carry the same
-- "verified engaged citizens — not a census" label in the UI.
-- ============================================================

begin;

-- ---------- Polls ----------
create table public.polls (
  id         uuid primary key default gen_random_uuid(),
  question    text not null,
  question_hi text,
  -- Array of options: [{ "en": "...", "hi": "..." }, ...]; index = option_index.
  options    jsonb not null check (jsonb_array_length(options) between 2 and 6),
  category   text not null default 'national',
  status     text not null default 'live',
  created_at timestamptz not null default now()
);
alter table public.polls enable row level security;
create policy "live polls are public" on public.polls for select using (status = 'live');

-- ---------- Registrar side (sealed, uniform, no preference signal) ----------
create table public.poll_token_issuance (
  user_id   uuid not null references auth.users (id) on delete cascade,
  poll_id   uuid not null references public.polls (id) on delete cascade,
  issued_on date not null default (now() at time zone 'Asia/Kolkata')::date,
  primary key (user_id, poll_id)
);
alter table public.poll_token_issuance enable row level security;
-- (no policies: deny-all except service role — same as token_issuance)

-- ---------- Ballot side (anonymous, the public record) ----------
create table public.poll_ballots (
  id           bigint generated always as identity primary key,
  poll_id      uuid not null references public.polls (id) on delete cascade,
  nullifier    text not null unique check (nullifier ~ '^[0-9a-f]{64}$'),
  option_index smallint not null check (option_index >= 0),
  state        text,
  voted_on     date not null default (now() at time zone 'Asia/Kolkata')::date
);
create index poll_ballots_poll_idx on public.poll_ballots (poll_id, option_index);
alter table public.poll_ballots replica identity full;
alter table public.poll_ballots enable row level security;
create policy "poll ballots are public, read-only"
  on public.poll_ballots for select using (true);
-- (writes only via the poll-cast / poll-withdraw Edge Functions, which
--  verify the registrar's blind signature and validate option_index
--  against jsonb_array_length(polls.options))

-- ---------- Public read model ----------
create view public.poll_counts with (security_invoker = on) as
select
  poll_id,
  option_index,
  count(*)::bigint as total,
  count(*) filter (where voted_on = (now() at time zone 'Asia/Kolkata')::date)::bigint as today
from public.poll_ballots
group by poll_id, option_index;

grant select on public.poll_counts to anon, authenticated;

-- ---------- Append-only anonymous poll log (Merkle/recount spine) ----------
create table public.poll_log (
  seq          bigint generated always as identity primary key,
  event        text not null check (event in ('cast', 'withdraw')),
  poll_id      uuid not null,   -- no FK on purpose: the log outlives everything
  nullifier    text not null check (nullifier ~ '^[0-9a-f]{64}$'),
  option_index smallint not null,
  state        text,
  event_on     date not null default (now() at time zone 'Asia/Kolkata')::date
);
alter table public.poll_log enable row level security;
create policy "poll log is public, read-only" on public.poll_log for select using (true);

create trigger poll_log_no_rewrite
before update or delete on public.poll_log
for each row execute function public.ballot_log_immutable();

create or replace function public.log_poll_cast()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.poll_log (event, poll_id, nullifier, option_index, state, event_on)
  values ('cast', new.poll_id, new.nullifier, new.option_index, new.state, new.voted_on);
  return new;
end;
$$;

create trigger poll_ballots_log_cast
after insert on public.poll_ballots
for each row execute function public.log_poll_cast();

create or replace function public.log_poll_withdraw()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.poll_log (event, poll_id, nullifier, option_index, state, event_on)
  values ('withdraw', old.poll_id, old.nullifier, old.option_index, old.state,
          (now() at time zone 'Asia/Kolkata')::date);
  return old;
end;
$$;

create trigger poll_ballots_log_withdraw
after delete on public.poll_ballots
for each row execute function public.log_poll_withdraw();

grant select on public.poll_log to anon, authenticated;

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.poll_ballots;

-- ---------- Seed: neutral, issue-framed, always a third option ----------
insert into public.polls (question, question_hi, options, category) values
(
  'Should audit reports of public examination bodies be published by default?',
  'क्या सार्वजनिक परीक्षा संस्थाओं की ऑडिट रिपोर्ट स्वतः सार्वजनिक होनी चाहिए?',
  '[{"en":"Agree","hi":"सहमत"},{"en":"Disagree","hi":"असहमत"},{"en":"Unsure / need more info","hi":"अनिश्चित / और जानकारी चाहिए"}]',
  'transparency'
),
(
  'How confident are you in the integrity of this year''s public examinations?',
  'इस वर्ष की सार्वजनिक परीक्षाओं की विश्वसनीयता पर आपको कितना भरोसा है?',
  '[{"en":"Confident","hi":"भरोसा है"},{"en":"Not confident","hi":"भरोसा नहीं है"},{"en":"Unsure / need more info","hi":"अनिश्चित / और जानकारी चाहिए"}]',
  'education'
),
(
  'Has youth unemployment directly affected your household?',
  'क्या युवा बेरोज़गारी ने आपके परिवार को सीधे प्रभावित किया है?',
  '[{"en":"Yes","hi":"हाँ"},{"en":"No","hi":"नहीं"},{"en":"Prefer not to say","hi":"नहीं बताना चाहूँगा/चाहूँगी"}]',
  'employment'
);

commit;
