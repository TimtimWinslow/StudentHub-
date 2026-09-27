-- =========================================================
-- STUDENTHUB — CARE TEAM FINALIZATION
-- Unread/read receipts, notification triggers, and message reports.
-- Safe migration.
-- =========================================================

create table if not exists public.message_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.message_reads enable row level security;

drop policy if exists "Users can view their message reads" on public.message_reads;
create policy "Users can view their message reads"
on public.message_reads for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can upsert their message reads" on public.message_reads;
create policy "Users can upsert their message reads"
on public.message_reads for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their message reads" on public.message_reads;
create policy "Users can update their message reads"
on public.message_reads for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists message_reads_user_idx
on public.message_reads(user_id, updated_at desc);

-- =========================================================
-- MESSAGE REPORTS
-- =========================================================

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'open',
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.message_reports
  drop constraint if exists message_reports_status_check;

alter table public.message_reports
  add constraint message_reports_status_check
  check (status in ('open','reviewed','dismissed','actioned'));

alter table public.message_reports enable row level security;

drop policy if exists "Users can create message reports" on public.message_reports;
create policy "Users can create message reports"
on public.message_reports for insert to authenticated
with check (auth.uid() = reporter_id);

drop policy if exists "Users can view their own message reports" on public.message_reports;
create policy "Users can view their own message reports"
on public.message_reports for select to authenticated
using (
  auth.uid() = reporter_id
  or exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

drop policy if exists "Admins can manage message reports" on public.message_reports;
create policy "Admins can manage message reports"
on public.message_reports for all to authenticated
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

create index if not exists message_reports_status_idx
on public.message_reports(status, created_at desc);

create index if not exists message_reports_message_idx
on public.message_reports(message_id);

-- =========================================================
-- CARE TEAM NOTIFICATIONS
-- =========================================================

create or replace function public.studenthub_notify_message_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member record;
  sender_name text;
begin
  select coalesce(p.display_name, p.full_name, 'A classmate')
    into sender_name
  from public.profiles p
  where p.id = new.sender_id;

  for member in
    select cm.user_id
    from public.conversation_members cm
    where cm.conversation_id = new.conversation_id
      and cm.user_id <> new.sender_id
  loop
    if exists (
      select 1 from public.notification_preferences np
      where np.user_id = member.user_id
        and np.messages = true
    ) or not exists (
      select 1 from public.notification_preferences np
      where np.user_id = member.user_id
    ) then
      insert into public.notifications
        (user_id, title, message, notification_type, link, metadata)
      values
        (
          member.user_id,
          case
            when new.reply_to_message_id is not null then sender_name || ' replied to a message'
            else sender_name || ' sent a message'
          end,
          left(coalesce(new.content, new.message, ''), 180),
          case
            when new.reply_to_message_id is not null then 'message_reply'
            else 'message'
          end,
          'care-team',
          jsonb_build_object(
            'conversation_id', new.conversation_id,
            'message_id', new.id,
            'reply_to_message_id', new.reply_to_message_id
          )
        );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists studenthub_notify_message_recipients on public.messages;
create trigger studenthub_notify_message_recipients
after insert on public.messages
for each row execute function public.studenthub_notify_message_recipients();

create or replace function public.studenthub_notify_message_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  actor_name text;
begin
  select m.user_id into recipient
  from public.messages m
  where m.id = new.message_id;

  if recipient is null or recipient = new.user_id then
    return new;
  end if;

  select coalesce(p.display_name, p.full_name, 'A classmate')
    into actor_name
  from public.profiles p
  where p.id = new.user_id;

  if exists (
    select 1 from public.notification_preferences np
    where np.user_id = recipient
    and np.messages = true
  ) or not exists (
    select 1 from public.notification_preferences np
    where np.user_id = recipient
  ) then
    insert into public.notifications
      (user_id, title, message, notification_type, link, metadata)
    values
      (
        recipient,
        actor_name || ' reacted to your message',
        new.reaction,
        'message_reaction',
        'care-team',
        jsonb_build_object('message_id', new.message_id, 'reaction', new.reaction)
      );
  end if;

  return new;
end;
$$;

drop trigger if exists studenthub_notify_message_reaction on public.message_reactions;
create trigger studenthub_notify_message_reaction
after insert on public.message_reactions
for each row execute function public.studenthub_notify_message_reaction();

-- Admins need report visibility/control through the existing admin system.
drop policy if exists "Admins can manage message reports" on public.message_reports;
create policy "Admins can manage message reports"
on public.message_reports for all to authenticated
using (
  exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.active = true)
)
with check (
  exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.active = true)
);
