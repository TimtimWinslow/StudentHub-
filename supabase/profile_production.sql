-- =========================================================
-- STUDENTHUB PROFILE / NEW USER SETUP
-- Safe production migration
-- =========================================================

alter table public.profiles
  add column if not exists full_name text default '',
  add column if not exists bio text default '',
  add column if not exists avatar_url text;

-- Ensure new auth users automatically receive a profile row.
-- SECURITY DEFINER allows the trigger to write to profiles even when
-- profiles has RLS enabled.
create or replace function public.studenthub_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    display_name,
    full_name
  )
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      split_part(new.email, '@', 1),
      'Student'
    ),
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(new.email, '@', 1),
      'Student'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists studenthub_on_auth_user_created on auth.users;

create trigger studenthub_on_auth_user_created
after insert on auth.users
for each row
execute function public.studenthub_handle_new_user();

-- Create profiles for any existing auth users that somehow do not have one.
insert into public.profiles (id, display_name, full_name)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data->>'display_name', ''),
    nullif(u.raw_user_meta_data->>'full_name', ''),
    split_part(u.email, '@', 1),
    'Student'
  ),
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(u.raw_user_meta_data->>'display_name', ''),
    split_part(u.email, '@', 1),
    'Student'
  )
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
);

-- Public avatar bucket.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = true;

drop policy if exists "StudentHub avatars are publicly readable" on storage.objects;
drop policy if exists "Students can upload their own avatars" on storage.objects;
drop policy if exists "Students can update their own avatars" on storage.objects;
drop policy if exists "Students can delete their own avatars" on storage.objects;

create policy "StudentHub avatars are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

create policy "Students can upload their own avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Students can update their own avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Students can delete their own avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
