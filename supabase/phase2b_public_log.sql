-- ============================================================
-- BharatBol §2 — tamper-evident public ballot log
-- Run AFTER phase2_privacy.sql.
--
-- ballot_log is the append-only, anonymous event log the Merkle
-- checkpoints and the public recount are computed from:
--   * one 'cast' event per ballot inserted, one 'withdraw' per delete,
--     mirrored by in-database triggers (atomic with the mutation)
--   * NO user identity by construction (same columns as ballots),
--     and NO foreign keys — the log must outlive everything it records
--   * append-only enforced by a trigger that rejects UPDATE/DELETE.
--     A privileged operator could still drop that trigger — which is
--     precisely what the externally committed Merkle checkpoints are
--     designed to catch. Tamper-EVIDENT, not tamper-proof; we say so.
--
-- Recount invariant: replaying this log (casts − withdraws) MUST equal
-- stand_counts at any moment; scripts/recount.mjs checks exactly that.
-- ============================================================

begin;

create table public.ballot_log (
  seq       bigint generated always as identity primary key,
  event     text not null check (event in ('cast', 'withdraw')),
  stand_id  uuid not null,   -- no FK on purpose: log entries are never cascaded away
  nullifier text not null check (nullifier ~ '^[0-9a-f]{64}$'),
  state     text,
  event_on  date not null default (now() at time zone 'Asia/Kolkata')::date
);

create index ballot_log_nullifier_idx on public.ballot_log (nullifier);

alter table public.ballot_log enable row level security;
create policy "log is public, read-only" on public.ballot_log for select using (true);
-- (no insert/update/delete policies: writes happen only via the
--  security-definer triggers below)

-- Append-only, enforced in-database for every role the API can assume.
create or replace function public.ballot_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ballot_log is append-only';
end;
$$;

create trigger ballot_log_no_rewrite
before update or delete on public.ballot_log
for each row execute function public.ballot_log_immutable();

-- Mirror every ballot mutation as a log event.
create or replace function public.log_ballot_cast()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.ballot_log (event, stand_id, nullifier, state, event_on)
  values ('cast', new.stand_id, new.nullifier, new.state, new.joined_on);
  return new;
end;
$$;

create trigger ballots_log_cast
after insert on public.ballots
for each row execute function public.log_ballot_cast();

create or replace function public.log_ballot_withdraw()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.ballot_log (event, stand_id, nullifier, state, event_on)
  values ('withdraw', old.stand_id, old.nullifier, old.state,
          (now() at time zone 'Asia/Kolkata')::date);
  return old;
end;
$$;

create trigger ballots_log_withdraw
after delete on public.ballots
for each row execute function public.log_ballot_withdraw();

-- Backfill ballots cast before this migration (no-op on fresh installs).
insert into public.ballot_log (event, stand_id, nullifier, state, event_on)
select 'cast', stand_id, nullifier, state, joined_on
from public.ballots
where not exists (select 1 from public.ballot_log)
order by id;

grant select on public.ballot_log to anon, authenticated;

commit;
