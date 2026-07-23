-- Adds public provenance fields to stands. Run after phase9.
-- These fields hold public evidence only. Do not place non-public material,
-- personal data, or unverified claims here.

begin;

alter table public.stands add column if not exists source_label text;
alter table public.stands add column if not exists source_url text;
alter table public.stands add column if not exists source_published_on date;

alter table public.stands drop constraint if exists stands_source_url_https;
alter table public.stands add constraint stands_source_url_https
  check (source_url is null or source_url ~ '^https://');

commit;
