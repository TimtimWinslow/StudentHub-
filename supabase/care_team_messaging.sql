-- =========================================================
-- STUDENTHUB — CARE TEAM GROUP + DIRECT MESSAGES
-- Safe migration: preserves existing messages.
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'group',
  name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations
  add column if not exists type text default 'group';

alter table public.conversations
  add column if not exists name text;

alter table public.conversations
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.conversations
  add column if not exists created_at timestamptz default now();

alter table public.conversations
  add column if not exists updated_at timestamptz default now();

alter table public.conversations
  drop constraint if exists conversations_type_check;

alter table public.conversations
  add constraint conversations_type_check
  check (type in ('group','direct'));

create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(conversation_id, user_id)
);

create index if not exists conversation_members_conversation_idx
on public.conversation_members(conversation_id);

create index if not exists conversation_members_user_idx
on public.conversation_members(user_id);

-- Add conversation ownership to messages.
alter table public.messages
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;

-- Create the class group.
insert into public.conversations (type, name)
select 'group', 'The Care Team'
where not exists (
  select 1 from public.conversations
  where type = 'group' and name = 'The Care Team'
);

-- Put existing Care Team messages into the group.
update public.messages
set conversation_id = (
  select id
  from public.conversations
  where type = 'group' and name = 'The Care Team'
  order by created_at
  limit 1
)
where conversation_id is null;

-- Add every current student to the group.
insert into public.conversation_members (conversation_id, user_id)
select c.id, u.id
from public.conversations c
cross join auth.users u
where c.type = 'group'
  and c.name = 'The Care Team'
on conflict (conversation_id, user_id) do nothing;

-- Future users are added to The Care Team when they first open it.
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;

drop policy if exists "Members can view conversations" on public.conversations;
create policy "Members can view conversations"
on public.conversations for select
to authenticated
using (
  (
    type = 'group'
    and name = 'The Care Team'
  )
  or exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversations.id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "Users can create conversations" on public.conversations;
create policy "Users can create conversations"
on public.conversations for insert
to authenticated
with check (auth.uid() = created_by);

drop policy if exists "Members can view conversation membership" on public.conversation_members;
create policy "Members can view conversation membership"
on public.conversation_members for select
to authenticated
using (true);

drop policy if exists "Users can join conversations" on public.conversation_members;
create policy "Users can join conversations"
on public.conversation_members for insert
to authenticated
with check (
  auth.uid() = user_id
  or exists (
    select 1 from public.conversations c
    where c.id = conversation_members.conversation_id
      and c.created_by = auth.uid()
  )
);

drop policy if exists "Users can leave conversations" on public.conversation_members;
create policy "Users can leave conversations"
on public.conversation_members for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists messages_conversation_idx
on public.messages(conversation_id, created_at);

-- Replace message policies so messages are visible only inside conversations
-- the signed-in user belongs to.
drop policy if exists "Care Team messages are readable by authenticated users" on public.messages;
drop policy if exists "Users can send Care Team messages" on public.messages;
drop policy if exists "Users can edit their own Care Team messages" on public.messages;
drop policy if exists "Users can delete their own Care Team messages" on public.messages;

create policy "Conversation members can read messages"
on public.messages for select
to authenticated
using (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

create policy "Conversation members can send messages"
on public.messages for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

create policy "Users can edit their own conversation messages"
on public.messages for update
to authenticated
using (
  auth.uid() = user_id
  and created_at >= now() - interval '5 minutes'
  and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
);

create policy "Users can delete their own conversation messages"
on public.messages for delete
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

-- Direct-message conversations can only be created by the signed-in user.
create unique index if not exists direct_conversation_pair_idx
on public.conversation_members (
  conversation_id,
  user_id
);

