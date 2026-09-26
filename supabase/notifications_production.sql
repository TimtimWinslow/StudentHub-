-- =========================================================
-- STUDENTHUB — NOTIFICATIONS PRODUCTION MIGRATION
-- =========================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Notification',
  message text,
  body text,
  notification_type text not null default 'general',
  link text,
  metadata jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.notifications
  add column if not exists title text default 'Notification';

alter table public.notifications
  add column if not exists message text;

alter table public.notifications
  add column if not exists body text;

alter table public.notifications
  add column if not exists notification_type text default 'general';

alter table public.notifications
  add column if not exists link text;

alter table public.notifications
  add column if not exists metadata jsonb default '{}'::jsonb;

alter table public.notifications
  add column if not exists read boolean default false;

alter table public.notifications
  add column if not exists created_at timestamptz default now();

alter table public.notifications enable row level security;

drop policy if exists "Users can view their notifications" on public.notifications;
create policy "Users can view their notifications"
on public.notifications
for select
using (auth.uid() = user_id);

drop policy if exists "Users can update their notifications" on public.notifications;
create policy "Users can update their notifications"
on public.notifications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their notifications" on public.notifications;
create policy "Users can delete their notifications"
on public.notifications
for delete
using (auth.uid() = user_id);

create index if not exists notifications_user_created_idx
on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
on public.notifications (user_id, read);


-- =========================================================
-- NOTIFICATION PREFERENCES
-- =========================================================

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  messages boolean not null default true,
  feed_activity boolean not null default true,
  calendar boolean not null default true,
  study_reminders boolean not null default true,
  academic_updates boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences
  enable row level security;

drop policy if exists "Users can view their notification preferences" on public.notification_preferences;
create policy "Users can view their notification preferences"
on public.notification_preferences
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their notification preferences" on public.notification_preferences;
create policy "Users can create their notification preferences"
on public.notification_preferences
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their notification preferences" on public.notification_preferences;
create policy "Users can update their notification preferences"
on public.notification_preferences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into public.notification_preferences (user_id)
select id
from auth.users
where not exists (
  select 1
  from public.notification_preferences np
  where np.user_id = auth.users.id
)
on conflict (user_id) do nothing;
