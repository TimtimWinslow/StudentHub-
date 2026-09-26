-- =========================================================
-- STUDENTHUB — CALENDAR PRODUCTION MIGRATION
-- Upgrades the existing calendar_events table safely.
-- =========================================================

alter table public.calendar_events
  add column if not exists user_id uuid
  references auth.users(id)
  on delete cascade;

alter table public.calendar_events
  add column if not exists location text;

alter table public.calendar_events
  add column if not exists event_type text
  default 'class';

alter table public.calendar_events
  add column if not exists end_time timestamptz;

alter table public.calendar_events
  add column if not exists all_day boolean
  not null default false;

alter table public.calendar_events
  drop constraint if exists calendar_events_event_type_check;

alter table public.calendar_events
  add constraint calendar_events_event_type_check
  check (
    event_type in (
      'class',
      'test',
      'clinical',
      'assignment',
      'study',
      'personal',
      'other'
    )
  );

alter table public.calendar_events
  enable row level security;

drop policy if exists "Users can view their calendar events"
on public.calendar_events;

create policy "Users can view their calendar events"
on public.calendar_events
for select
using (
  auth.uid() = user_id
  or auth.uid() = created_by
);

drop policy if exists "Users can create their calendar events"
on public.calendar_events;

create policy "Users can create their calendar events"
on public.calendar_events
for insert
with check (
  auth.uid() = user_id
  or auth.uid() = created_by
);

drop policy if exists "Users can update their calendar events"
on public.calendar_events;

create policy "Users can update their calendar events"
on public.calendar_events
for update
using (
  auth.uid() = user_id
  or auth.uid() = created_by
)
with check (
  auth.uid() = user_id
  or auth.uid() = created_by
);

drop policy if exists "Users can delete their calendar events"
on public.calendar_events;

create policy "Users can delete their calendar events"
on public.calendar_events
for delete
using (
  auth.uid() = user_id
  or auth.uid() = created_by
);

create index if not exists calendar_events_user_start_idx
on public.calendar_events (user_id, start_time);

create index if not exists calendar_events_start_idx
on public.calendar_events (start_time);
