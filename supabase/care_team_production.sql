-- StudentHub Care Team production messaging
-- Safe migration: preserves an existing messages table and adds missing columns.

create extension if not exists pgcrypto;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);

alter table public.messages add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.messages add column if not exists content text;
alter table public.messages add column if not exists message text;
alter table public.messages add column if not exists created_at timestamptz default now();
alter table public.messages add column if not exists updated_at timestamptz default now();
alter table public.messages add column if not exists edited_at timestamptz;

update public.messages
set content = message
where content is null and message is not null;

update public.messages
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

create index if not exists messages_created_at_idx on public.messages(created_at);
create index if not exists messages_user_id_idx on public.messages(user_id);

alter table public.messages enable row level security;

drop policy if exists "Care Team messages are readable by authenticated users" on public.messages;
drop policy if exists "Users can send Care Team messages" on public.messages;
drop policy if exists "Users can edit their own Care Team messages" on public.messages;
drop policy if exists "Users can delete their own Care Team messages" on public.messages;

create policy "Care Team messages are readable by authenticated users"
on public.messages for select
to authenticated
using (true);

create policy "Users can send Care Team messages"
on public.messages for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can edit their own Care Team messages"
on public.messages for update
to authenticated
using (
  auth.uid() = user_id
  and created_at >= now() - interval '5 minutes'
)
with check (auth.uid() = user_id);

create policy "Users can delete their own Care Team messages"
on public.messages for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.pinned_messages (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(message_id)
);

alter table public.pinned_messages enable row level security;

drop policy if exists "Pinned messages are readable by authenticated users" on public.pinned_messages;
drop policy if exists "Authenticated users can pin messages" on public.pinned_messages;
drop policy if exists "Users can unpin messages" on public.pinned_messages;

create policy "Pinned messages are readable by authenticated users"
on public.pinned_messages for select
to authenticated
using (true);

create policy "Authenticated users can pin messages"
on public.pinned_messages for insert
to authenticated
with check (auth.uid() = pinned_by);

create policy "Users can unpin messages"
on public.pinned_messages for delete
to authenticated
using (auth.uid() = pinned_by);

create index if not exists pinned_messages_message_idx on public.pinned_messages(message_id);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null default '❤️',
  created_at timestamptz not null default now(),
  unique(message_id, user_id, reaction)
);

alter table public.message_reactions enable row level security;

drop policy if exists "Message reactions are readable by authenticated users" on public.message_reactions;
drop policy if exists "Users can add their own message reactions" on public.message_reactions;
drop policy if exists "Users can remove their own message reactions" on public.message_reactions;

create policy "Message reactions are readable by authenticated users"
on public.message_reactions for select
to authenticated
using (true);

create policy "Users can add their own message reactions"
on public.message_reactions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can remove their own message reactions"
on public.message_reactions for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists message_reactions_message_idx on public.message_reactions(message_id);
create index if not exists message_reactions_user_idx on public.message_reactions(user_id);

-- Keep message timestamps current when rows are updated.
create or replace function public.studenthub_messages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists studenthub_messages_updated_at on public.messages;
create trigger studenthub_messages_updated_at
before update on public.messages
for each row execute function public.studenthub_messages_updated_at();
