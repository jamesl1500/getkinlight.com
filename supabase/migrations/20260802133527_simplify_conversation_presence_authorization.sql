create or replace function private.can_access_conversation_topic(target_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.household_conversations conversation
		join public.household_members member
			on member.household_id = conversation.household_id
		where target_topic ~ '^household-conversation:[0-9a-f-]{36}$'
			and conversation.id = split_part(target_topic, ':', 2)::uuid
			and member.user_id = (select auth.uid())
	);
$$;

revoke all on function private.can_access_conversation_topic(text) from public, anon;
grant execute on function private.can_access_conversation_topic(text) to authenticated, service_role;

drop policy if exists "household_members_read_conversation_presence" on realtime.messages;
create policy "household_members_read_conversation_presence"
on realtime.messages
for select
to authenticated
using (
	realtime.messages.extension = 'presence'
	and (select private.can_access_conversation_topic((select realtime.topic())))
);

drop policy if exists "household_members_write_conversation_presence" on realtime.messages;
create policy "household_members_write_conversation_presence"
on realtime.messages
for insert
to authenticated
with check (
	realtime.messages.extension = 'presence'
	and (select private.can_access_conversation_topic((select realtime.topic())))
);
