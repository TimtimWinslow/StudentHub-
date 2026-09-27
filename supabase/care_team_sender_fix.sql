-- STUDENTHUB CARE TEAM sender_id compatibility fix
-- Fixes schemas that require sender_id while StudentHub internally uses user_id.

alter table public.messages
  add column if not exists sender_id uuid references auth.users(id) on delete cascade;

update public.messages
set sender_id = user_id
where sender_id is null
  and user_id is not null;

-- Keep both legacy/new sender fields synchronized.
create or replace function public.studenthub_sync_message_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null and new.sender_id is not null then
    new.user_id := new.sender_id;
  elsif new.sender_id is null and new.user_id is not null then
    new.sender_id := new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists studenthub_sync_message_sender on public.messages;
create trigger studenthub_sync_message_sender
before insert or update on public.messages
for each row
execute function public.studenthub_sync_message_sender();

create index if not exists messages_sender_id_idx
on public.messages(sender_id);

-- Make the message ownership fields agree with the signed-in sender.
drop policy if exists "Conversation members can send messages" on public.messages;
create policy "Conversation members can send messages"
on public.messages for insert
to authenticated
with check (
  auth.uid() = user_id
  and auth.uid() = sender_id
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);
