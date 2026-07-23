-- Short, stable public IDs for stand URLs and cards.
-- Run once after phase8. UUID `stands.id` remains the relational key used by
-- commitments, ledger entries and all foreign keys.

begin;

alter table public.stands add column if not exists public_id text;

-- md5 is built into PostgreSQL. The 11-character value is deterministic for
-- existing rows, stable on rerun, and does not expose the UUID in a public URL.
update public.stands
set public_id = 's' || substr(md5(id::text), 1, 10)
where public_id is null;

-- Future stands need the same identifier before the NOT NULL constraint is
-- enforced. A trigger keeps SQL-editor and admin inserts consistent.
create or replace function public.assign_stand_public_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.public_id is null or new.public_id = '' then
    new.public_id := 's' || substr(md5(new.id::text), 1, 10);
  end if;
  return new;
end;
$$;

drop trigger if exists stands_assign_public_id on public.stands;
create trigger stands_assign_public_id
before insert on public.stands
for each row execute function public.assign_stand_public_id();

create unique index if not exists stands_public_id_unique on public.stands (public_id);

alter table public.stands alter column public_id set not null;
alter table public.stands drop constraint if exists stands_public_id_format;
alter table public.stands add constraint stands_public_id_format
  check (public_id ~ '^s[0-9a-f]{10}$');

commit;
