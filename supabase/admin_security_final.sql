-- STUDENTHUB FINAL ADMIN SECURITY HARDENING
-- Run after full_admin_control.sql.
-- Fixes recursive admin_users RLS and centralizes the admin check.

create schema if not exists private;

create or replace function private.studenthub_is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and active = true
  );
$$;

revoke all on function private.studenthub_is_admin() from public;
grant execute on function private.studenthub_is_admin() to authenticated;

-- admin_users must use the helper rather than querying itself through RLS.
drop policy if exists "Admins can view own admin record" on public.admin_users;
drop policy if exists "Admins can manage admin users" on public.admin_users;

create policy "Admins can view admin users"
on public.admin_users for select
to authenticated
using ((select private.studenthub_is_admin()));

create policy "Admins can insert admin users"
on public.admin_users for insert
to authenticated
with check ((select private.studenthub_is_admin()));

create policy "Admins can update admin users"
on public.admin_users for update
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

create policy "Admins can delete admin users"
on public.admin_users for delete
to authenticated
using ((select private.studenthub_is_admin()));

-- Replace broad admin policies that previously queried admin_users directly.
-- Multiple policies are intentionally allowed: regular-user policies continue
-- to grant each user their normal access, while these grant admin access.
drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles"
on public.profiles for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can moderate messages" on public.messages;
create policy "Admins can moderate messages"
on public.messages for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can manage pinned messages" on public.pinned_messages;
create policy "Admins can manage pinned messages"
on public.pinned_messages for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can moderate reactions" on public.message_reactions;
create policy "Admins can moderate reactions"
on public.message_reactions for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can manage feed posts" on public.feed_posts;
create policy "Admins can manage feed posts"
on public.feed_posts for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can manage feed comments" on public.feed_comments;
create policy "Admins can manage feed comments"
on public.feed_comments for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can manage feed reactions" on public.feed_reactions;
create policy "Admins can manage feed reactions"
on public.feed_reactions for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can manage scores" on public.scores;
create policy "Admins can manage scores"
on public.scores for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can manage assignments" on public.assignments;
create policy "Admins can manage assignments"
on public.assignments for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can manage calendar events" on public.calendar_events;
create policy "Admins can manage calendar events"
on public.calendar_events for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can manage notifications" on public.notifications;
create policy "Admins can manage notifications"
on public.notifications for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can manage conversations" on public.conversations;
create policy "Admins can manage conversations"
on public.conversations for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can manage conversation members" on public.conversation_members;
create policy "Admins can manage conversation members"
on public.conversation_members for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

-- Existing class/chapter/enrollment policies also use the admin role.
drop policy if exists "Admins can manage classes" on public.classes;
create policy "Admins can manage classes"
on public.classes for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can manage chapters" on public.chapters;
create policy "Admins can manage chapters"
on public.chapters for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can manage enrollments" on public.enrollments;
create policy "Admins can manage enrollments"
on public.enrollments for all
to authenticated
using ((select private.studenthub_is_admin()))
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can write audit log" on public.admin_audit_log;
create policy "Admins can write audit log"
on public.admin_audit_log for insert
to authenticated
with check ((select private.studenthub_is_admin()));

drop policy if exists "Admins can view audit log" on public.admin_audit_log;
create policy "Admins can view audit log"
on public.admin_audit_log for select
to authenticated
using ((select private.studenthub_is_admin()));

-- Indexes used by the admin dashboard.
create index if not exists profiles_account_status_idx
on public.profiles(account_status);

create index if not exists scores_user_test_date_idx
on public.scores(user_id,test_date desc);

create index if not exists assignments_user_due_idx
on public.assignments(user_id,due_date);

create index if not exists calendar_events_start_idx
on public.calendar_events(start_time);
