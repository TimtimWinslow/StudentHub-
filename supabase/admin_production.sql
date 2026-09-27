-- STUDENTHUB ADMIN PRODUCTION
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists "Admins can view own admin record" on public.admin_users;
create policy "Admins can view own admin record"
on public.admin_users for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can view audit log" on public.admin_audit_log;
create policy "Admins can view audit log"
on public.admin_audit_log for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.active = true));

drop policy if exists "Admins can write audit log" on public.admin_audit_log;
create policy "Admins can write audit log"
on public.admin_audit_log for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.active = true));

drop policy if exists "Admins can manage classes" on public.classes;
create policy "Admins can manage classes"
on public.classes for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.active = true));

drop policy if exists "Admins can manage chapters" on public.chapters;
create policy "Admins can manage chapters"
on public.chapters for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.active = true));

drop policy if exists "Admins can create notifications" on public.notifications;
create policy "Admins can create notifications"
on public.notifications for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.active = true));

create index if not exists admin_audit_log_created_at_idx
on public.admin_audit_log(created_at desc);

create index if not exists admin_audit_log_admin_user_idx
on public.admin_audit_log(admin_user_id);
