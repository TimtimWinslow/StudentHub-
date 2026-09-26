-- =========================================================
-- STUDENTHUB PROFILE / AVATAR SETUP
-- Safe production migration: adds profile bio and avatar storage.
-- =========================================================

alter table public.profiles
  add column if not exists bio text default '',
  add column if not exists avatar_url text;

-- Public avatar bucket so profile photos can render in feeds,
-- messages, presence, and the profile page.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = true;

-- Replace only these StudentHub avatar policies if they already exist.
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
