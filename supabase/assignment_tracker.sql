-- StudentHub Assignment Tracker
-- Run this once in the Supabase SQL editor.

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  priority text not null default 'normal'
    check (priority in ('low','normal','high')),
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assignments enable row level security;

drop policy if exists "Users can view their assignments" on public.assignments;
create policy "Users can view their assignments"
on public.assignments for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their assignments" on public.assignments;
create policy "Users can create their assignments"
on public.assignments for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their assignments" on public.assignments;
create policy "Users can update their assignments"
on public.assignments for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their assignments" on public.assignments;
create policy "Users can delete their assignments"
on public.assignments for delete
using (auth.uid() = user_id);

create index if not exists assignments_user_due_idx
on public.assignments(user_id, due_date);


-- Upgrade existing StudentHub assignment tables to support class-linked assignments.
-- Safe to run even if the table already exists.
alter table public.assignments
  add column if not exists class_id uuid references public.classes(id) on delete cascade;

create index if not exists assignments_class_due_idx
  on public.assignments(class_id, due_date);

-- Existing deployments may already have class_id as NOT NULL.
-- New saves now always provide the active class ID from the app.
