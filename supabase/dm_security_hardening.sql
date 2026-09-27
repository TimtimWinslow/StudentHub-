-- =========================================================
-- STUDENTHUB — DIRECT MESSAGE SECURITY HARDENING
-- Run this AFTER care_team_messaging.sql.
-- =========================================================

-- Security-definer helper avoids recursive RLS checks while determining
-- whether the signed-in user belongs to a conversation.
create or replace function public.studenthub_is_conversation_member(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = p_user_id
  );
$$;

revoke all on function public.studenthub_is_conversation_member(uuid, uuid)
from public;

grant execute on function public.studenthub_is_conversation_member(uuid, uuid)
to authenticated;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- =========================================================
-- CONVERSATIONS
-- =========================================================

drop policy if exists "Members can view conversations"
on public.conversations;

create policy "Users can view their conversations"
on public.conversations
for select
to authenticated
using (
  (
    type = 'group'
    and name = 'The Care Team'
  )
  or created_by = auth.uid()
  or public.studenthub_is_conversation_member(id, auth.uid())
);

drop policy if exists "Users can create conversations"
on public.conversations;

create policy "Users can create direct conversations"
on public.conversations
for insert
to authenticated
with check (
  type = 'direct'
  and created_by = auth.uid()
);

-- =========================================================
-- CONVERSATION MEMBERS
-- =========================================================

drop policy if exists "Members can view conversation membership"
on public.conversation_members;

create policy "Users can view allowed conversation members"
on public.conversation_members
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.conversations c
    where c.id = conversation_members.conversation_id
      and c.type = 'group'
      and c.name = 'The Care Team'
  )
  or public.studenthub_is_conversation_member(
    conversation_members.conversation_id,
    auth.uid()
  )
  or exists (
    select 1
    from public.conversations c
    where c.id = conversation_members.conversation_id
      and c.created_by = auth.uid()
  )
);

drop policy if exists "Users can join conversations"
on public.conversation_members;

create policy "Users can add conversation members"
on public.conversation_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.conversations c
    where c.id = conversation_members.conversation_id
      and c.created_by = auth.uid()
  )
);

drop policy if exists "Users can leave conversations"
on public.conversation_members;

create policy "Users can remove their own membership"
on public.conversation_members
for delete
to authenticated
using (
  user_id = auth.uid()
);

-- =========================================================
-- MESSAGES
-- =========================================================

drop policy if exists "Conversation members can read messages"
on public.messages;

create policy "Conversation members can read messages"
on public.messages
for select
to authenticated
using (
  public.studenthub_is_conversation_member(
    messages.conversation_id,
    auth.uid()
  )
);

drop policy if exists "Conversation members can send messages"
on public.messages;

create policy "Conversation members can send messages"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.studenthub_is_conversation_member(
    messages.conversation_id,
    auth.uid()
  )
);

drop policy if exists "Users can edit their own conversation messages"
on public.messages;

create policy "Users can edit their own conversation messages"
on public.messages
for update
to authenticated
using (
  auth.uid() = user_id
  and created_at >= now() - interval '5 minutes'
  and public.studenthub_is_conversation_member(
    messages.conversation_id,
    auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and public.studenthub_is_conversation_member(
    messages.conversation_id,
    auth.uid()
  )
);

drop policy if exists "Users can delete their own conversation messages"
on public.messages;

create policy "Users can delete their own conversation messages"
on public.messages
for delete
to authenticated
using (
  auth.uid() = user_id
  and public.studenthub_is_conversation_member(
    messages.conversation_id,
    auth.uid()
  )
);

-- Helpful indexes for the security checks.
create index if not exists conversation_members_conversation_user_idx
on public.conversation_members(conversation_id, user_id);

create index if not exists conversations_created_by_idx
on public.conversations(created_by);

-- =========================================================
-- RESULT
-- =========================================================
-- Direct-message membership is no longer globally readable.
-- A user can only see:
--   • their own membership rows
--   • members of The Care Team
--   • members of conversations they belong to
--   • members of conversations they created
-- Messages are limited to conversations the signed-in user belongs to.
