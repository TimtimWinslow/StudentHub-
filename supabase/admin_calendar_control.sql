-- STUDENTHUB ADMIN CLASS-WIDE CALENDAR CONTROL
-- Run after full_admin_control.sql.
alter table public.calendar_events
  add column if not exists is_class_wide boolean not null default false;

drop policy if exists "Users can view their calendar events" on public.calendar_events;
create policy "Users can view their calendar events"
on public.calendar_events
for select
to authenticated
using (
  is_class_wide = true
  or auth.uid() = user_id
  or auth.uid() = created_by
);

drop policy if exists "Users can create their calendar events" on public.calendar_events;
create policy "Users can create their calendar events"
on public.calendar_events
for insert
to authenticated
with check (
  (is_class_wide = false and (auth.uid() = user_id or auth.uid() = created_by))
  or (
    is_class_wide = true
    and exists (
      select 1 from public.admin_users a
      where a.user_id = auth.uid() and a.active = true
    )
  )
);

drop policy if exists "Users can update their calendar events" on public.calendar_events;
create policy "Users can update their calendar events"
on public.calendar_events
for update
to authenticated
using (
  (is_class_wide = false and (auth.uid() = user_id or auth.uid() = created_by))
  or (
    is_class_wide = true
    and exists (
      select 1 from public.admin_users a
      where a.user_id = auth.uid() and a.active = true
    )
  )
)
with check (
  (is_class_wide = false and (auth.uid() = user_id or auth.uid() = created_by))
  or (
    is_class_wide = true
    and exists (
      select 1 from public.admin_users a
      where a.user_id = auth.uid() and a.active = true
    )
  )
);

drop policy if exists "Users can delete their calendar events" on public.calendar_events;
create policy "Users can delete their calendar events"
on public.calendar_events
for delete
to authenticated
using (
  (is_class_wide = false and (auth.uid() = user_id or auth.uid() = created_by))
  or (
    is_class_wide = true
    and exists (
      select 1 from public.admin_users a
      where a.user_id = auth.uid() and a.active = true
    )
  )
);

create index if not exists calendar_events_class_wide_idx
on public.calendar_events(is_class_wide, start_time);
