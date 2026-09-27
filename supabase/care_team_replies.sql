-- =========================================================
-- STUDENTHUB — CARE TEAM MESSAGE REPLIES
-- Adds optional reply/quote support to existing messages.
-- Safe migration: preserves existing messages.
-- =========================================================

alter table public.messages
  add column if not exists reply_to_message_id uuid
  references public.messages(id)
  on delete set null;

create index if not exists messages_reply_to_idx
on public.messages(reply_to_message_id);
