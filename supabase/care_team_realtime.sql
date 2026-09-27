/* =========================================================
   STUDENTHUB CARE TEAM REALTIME
   Enable Supabase Realtime for live chat, reactions,
   pins, and presence updates.
   ========================================================= */

alter publication supabase_realtime
  add table public.messages;

alter publication supabase_realtime
  add table public.message_reactions;

alter publication supabase_realtime
  add table public.pinned_messages;

alter publication supabase_realtime
  add table public.user_presence;

/* Send complete row data for UPDATE/DELETE events where supported. */
alter table public.messages replica identity full;
alter table public.message_reactions replica identity full;
alter table public.pinned_messages replica identity full;
alter table public.user_presence replica identity full;
