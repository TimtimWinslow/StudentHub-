-- StudentHub messaging persistence + Care Team access fix
-- Run this in Supabase SQL Editor after reviewing it. It preserves existing rows.
-- The Care Team group is discoverable by authenticated users; private conversations
-- and their messages remain restricted to conversation members.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.studenthub_is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
  );
$$;

revoke all on function private.studenthub_is_conversation_member(uuid) from public;
grant execute on function private.studenthub_is_conversation_member(uuid) to authenticated;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Conversation discovery: users can see their own conversations, conversations
-- they belong to, and the one class-wide Care Team group.
drop policy if exists "Members can view conversations" on public.conversations;
drop policy if exists "Users can view their conversations" on public.conversations;
drop policy if exists "Users can view their conversations and Care Team" on public.conversations;
create policy "Users can view their conversations and Care Team"
on public.conversations
for select
to authenticated
using (
  created_by = auth.uid()
  or private.studenthub_is_conversation_member(id)
  or (type = 'group' and name = 'The Care Team')
);

-- Members may see the membership list for conversations they belong to.
drop policy if exists "Members can view conversation membership" on public.conversation_members;
drop policy if exists "Conversation members can view membership" on public.conversation_members;
drop policy if exists "Users can view allowed conversation members" on public.conversation_members;
create policy "Conversation members can view membership"
on public.conversation_members
for select
to authenticated
using (private.studenthub_is_conversation_member(conversation_id));

-- Let a student join only the Care Team group. Conversation creators may add
-- members to a direct conversation they created.
drop policy if exists "Users can join conversations" on public.conversation_members;
drop policy if exists "Conversation creators can add members" on public.conversation_members;
drop policy if exists "Users can add conversation members" on public.conversation_members;
create policy "Conversation creators can add members"
on public.conversation_members
for insert
to authenticated
with check (
  (
    auth.uid() = user_id
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_members.conversation_id
        and c.type = 'group'
        and c.name = 'The Care Team'
    )
  )
  or exists (
    select 1
    from public.conversations c
    where c.id = conversation_members.conversation_id
      and c.created_by = auth.uid()
  )
);

-- Message reads and sends are authorized only for conversation members.
drop policy if exists "Care Team messages are readable by authenticated users" on public.messages;
drop policy if exists "Conversation members can read messages" on public.messages;
create policy "Conversation members can read messages"
on public.messages
for select
to authenticated
using (private.studenthub_is_conversation_member(conversation_id));

drop policy if exists "Users can send Care Team messages" on public.messages;
drop policy if exists "Conversation members can send messages" on public.messages;
create policy "Conversation members can send messages"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (sender_id is null or sender_id = auth.uid())
  and private.studenthub_is_conversation_member(conversation_id)
);

create index if not exists conversation_members_conversation_user_idx
on public.conversation_members(conversation_id, user_id);

create index if not exists messages_conversation_created_at_idx
on public.messages(conversation_id, created_at);
