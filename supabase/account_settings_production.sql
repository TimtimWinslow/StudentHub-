-- =========================================================
-- STUDENTHUB ACCOUNT & PRIVACY SETTINGS
-- Safe production migration
-- =========================================================

create table if not exists public.privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_online_status boolean not null default true,
  allow_messages boolean not null default true,
  show_profile_picture boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.privacy_settings
  add column if not exists show_online_status boolean not null default true;

alter table public.privacy_settings
  add column if not exists allow_messages boolean not null default true;

alter table public.privacy_settings
  add column if not exists show_profile_picture boolean not null default true;

alter table public.privacy_settings
  add column if not exists created_at timestamptz not null default now();

alter table public.privacy_settings
  add column if not exists updated_at timestamptz not null default now();

alter table public.privacy_settings enable row level security;

drop policy if exists "Users can view own privacy settings"
on public.privacy_settings;

drop policy if exists "Users can insert own privacy settings"
on public.privacy_settings;

drop policy if exists "Users can update own privacy settings"
on public.privacy_settings;

create policy "Users can view own privacy settings"
on public.privacy_settings
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own privacy settings"
on public.privacy_settings
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own privacy settings"
on public.privacy_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into public.privacy_settings (
  user_id,
  show_online_status,
  allow_messages,
  show_profile_picture
)
select
  id,
  true,
  true,
  true
from auth.users
on conflict (user_id) do nothing;

create index if not exists privacy_settings_user_id_idx
on public.privacy_settings(user_id);

create or replace function public.studenthub_privacy_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists studenthub_privacy_settings_updated_at
on public.privacy_settings;

create trigger studenthub_privacy_settings_updated_at
before update on public.privacy_settings
for each row
execute function public.studenthub_privacy_settings_updated_at();
