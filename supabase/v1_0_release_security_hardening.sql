-- StudentHub v1.0.0 release security hardening
-- Apply AFTER care_team_messaging.sql, care_team_production.sql, and admin_security_final.sql.
-- Restricts direct-message metadata and message-related rows to conversation members.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Older deployments may have a messages table created before sender_id was introduced.
alter table public.messages
  add column if not exists sender_id uuid references auth.users(id) on delete cascade;

update public.messages
set sender_id = user_id
where sender_id is null and user_id is not null;

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

alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.pinned_messages enable row level security;
alter table public.message_reactions enable row level security;

-- Membership rows for a private conversation are visible only to that conversation's members.
drop policy if exists "Members can view conversation membership" on public.conversation_members;
drop policy if exists "Conversation members can view membership" on public.conversation_members;
create policy "Conversation members can view membership"
on public.conversation_members
for select
to authenticated
using (private.studenthub_is_conversation_member(conversation_id));

-- Users may join the Care Team group themselves. Only the creator may add members to a conversation they created.
drop policy if exists "Users can join conversations" on public.conversation_members;
drop policy if exists "Conversation creators can add members" on public.conversation_members;
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

-- Recreate message policies with membership checks on both old and new rows.
drop policy if exists "Care Team messages are readable by authenticated users" on public.messages;
drop policy if exists "Conversation members can read messages" on public.messages;
drop policy if exists "Users can send Care Team messages" on public.messages;
drop policy if exists "Conversation members can send messages" on public.messages;
drop policy if exists "Users can edit their own Care Team messages" on public.messages;
drop policy if exists "Users can edit their own conversation messages" on public.messages;
drop policy if exists "Users can delete their own Care Team messages" on public.messages;
drop policy if exists "Users can delete their own conversation messages" on public.messages;

create policy "Conversation members can read messages"
on public.messages
for select
to authenticated
using (private.studenthub_is_conversation_member(conversation_id));

create policy "Conversation members can send messages"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (sender_id is null or sender_id = auth.uid())
  and private.studenthub_is_conversation_member(conversation_id)
);

create policy "Users can edit their own conversation messages"
on public.messages
for update
to authenticated
using (
  auth.uid() = user_id
  and created_at >= now() - interval '5 minutes'
  and private.studenthub_is_conversation_member(conversation_id)
)
with check (
  auth.uid() = user_id
  and (sender_id is null or sender_id = auth.uid())
  and private.studenthub_is_conversation_member(conversation_id)
);

create policy "Users can delete their own conversation messages"
on public.messages
for delete
to authenticated
using (
  auth.uid() = user_id
  and private.studenthub_is_conversation_member(conversation_id)
);

-- Pinned-message and reaction rows are also scoped to messages in accessible conversations.
drop policy if exists "Pinned messages are readable by authenticated users" on public.pinned_messages;
drop policy if exists "Conversation members can read pinned messages" on public.pinned_messages;
create policy "Conversation members can read pinned messages"
on public.pinned_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    where m.id = pinned_messages.message_id
      and private.studenthub_is_conversation_member(m.conversation_id)
  )
);

drop policy if exists "Authenticated users can pin messages" on public.pinned_messages;
drop policy if exists "Conversation members can pin messages" on public.pinned_messages;
create policy "Conversation members can pin messages"
on public.pinned_messages
for insert
to authenticated
with check (
  auth.uid() = pinned_by
  and exists (
    select 1
    from public.messages m
    where m.id = pinned_messages.message_id
      and private.studenthub_is_conversation_member(m.conversation_id)
  )
);

drop policy if exists "Users can unpin messages" on public.pinned_messages;
drop policy if exists "Conversation members can unpin messages" on public.pinned_messages;
create policy "Conversation members can unpin messages"
on public.pinned_messages
for delete
to authenticated
using (
  auth.uid() = pinned_by
  and exists (
    select 1
    from public.messages m
    where m.id = pinned_messages.message_id
      and private.studenthub_is_conversation_member(m.conversation_id)
  )
);

drop policy if exists "Message reactions are readable by authenticated users" on public.message_reactions;
drop policy if exists "Conversation members can read message reactions" on public.message_reactions;
create policy "Conversation members can read message reactions"
on public.message_reactions
for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    where m.id = message_reactions.message_id
      and private.studenthub_is_conversation_member(m.conversation_id)
  )
);

drop policy if exists "Users can add their own message reactions" on public.message_reactions;
drop policy if exists "Conversation members can add message reactions" on public.message_reactions;
create policy "Conversation members can add message reactions"
on public.message_reactions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.messages m
    where m.id = message_reactions.message_id
      and private.studenthub_is_conversation_member(m.conversation_id)
  )
);

drop policy if exists "Users can remove their own message reactions" on public.message_reactions;
drop policy if exists "Conversation members can remove message reactions" on public.message_reactions;
create policy "Conversation members can remove message reactions"
on public.message_reactions
for delete
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.messages m
    where m.id = message_reactions.message_id
      and private.studenthub_is_conversation_member(m.conversation_id)
  )
);
