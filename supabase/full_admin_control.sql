-- =========================================================
-- STUDENTHUB — FULL ADMIN CONTROL
-- Run once in Supabase SQL Editor.
-- =========================================================

-- Student account status controlled by administrators.
alter table public.profiles
  add column if not exists account_status text not null default 'active';

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active','suspended'));

-- Admins may manage student profiles/status.
drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles"
on public.profiles for all
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- Admin management.
drop policy if exists "Admins can manage admin users" on public.admin_users;
create policy "Admins can manage admin users"
on public.admin_users for all
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- Full Care Team moderation.
drop policy if exists "Admins can moderate messages" on public.messages;
create policy "Admins can moderate messages"
on public.messages for all
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

drop policy if exists "Admins can manage pinned messages" on public.pinned_messages;
create policy "Admins can manage pinned messages"
on public.pinned_messages for all
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

drop policy if exists "Admins can moderate reactions" on public.message_reactions;
create policy "Admins can moderate reactions"
on public.message_reactions for all
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- Admin moderation/content control for feed.
drop policy if exists "Admins can manage feed posts" on public.feed_posts;
create policy "Admins can manage feed posts"
on public.feed_posts for all
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

drop policy if exists "Admins can manage feed comments" on public.feed_comments;
create policy "Admins can manage feed comments"
on public.feed_comments for all
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

drop policy if exists "Admins can manage feed reactions" on public.feed_reactions;
create policy "Admins can manage feed reactions"
on public.feed_reactions for all
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- Admin content control for academic/planning data.
drop policy if exists "Admins can manage scores" on public.scores;
create policy "Admins can manage scores"
on public.scores for all
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

drop policy if exists "Admins can manage assignments" on public.assignments;
create policy "Admins can manage assignments"
on public.assignments for all
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

drop policy if exists "Admins can manage calendar events" on public.calendar_events;
create policy "Admins can manage calendar events"
on public.calendar_events for all
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- Admin can manage notifications after they are created.
drop policy if exists "Admins can manage notifications" on public.notifications;
create policy "Admins can manage notifications"
on public.notifications for all
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- Admins can manage conversation membership and group conversations.
drop policy if exists "Admins can manage conversations" on public.conversations;
create policy "Admins can manage conversations"
on public.conversations for all
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

drop policy if exists "Admins can manage conversation members" on public.conversation_members;
create policy "Admins can manage conversation members"
on public.conversation_members for all
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- Indexes.
create index if not exists profiles_account_status_idx
on public.profiles(account_status);

