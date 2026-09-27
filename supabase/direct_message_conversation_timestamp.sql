-- =========================================================
-- STUDENTHUB — DIRECT MESSAGE CONVERSATION TIMESTAMPS
-- Keeps private conversations active/recent after a message is sent.
-- =========================================================

create or replace function public.studenthub_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists studenthub_touch_conversation_on_message
on public.messages;

create trigger studenthub_touch_conversation_on_message
after insert or update on public.messages
for each row
when (new.conversation_id is not null)
execute function public.studenthub_touch_conversation();
