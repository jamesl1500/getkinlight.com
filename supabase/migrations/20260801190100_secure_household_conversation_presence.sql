create policy "household_members_read_conversation_presence"
on realtime.messages
for select
to authenticated
using (
	realtime.messages.extension = 'presence'
	and exists (
		select 1
		from public.household_conversations conversation
		where conversation.id = case
			when (select realtime.topic()) ~ '^household-conversation:[0-9a-f-]{36}$'
			then split_part((select realtime.topic()), ':', 2)::uuid
			else null
		end
		and (select private.is_household_member(conversation.household_id))
	)
);

create policy "household_members_write_conversation_presence"
on realtime.messages
for insert
to authenticated
with check (
	realtime.messages.extension = 'presence'
	and exists (
		select 1
		from public.household_conversations conversation
		where conversation.id = case
			when (select realtime.topic()) ~ '^household-conversation:[0-9a-f-]{36}$'
			then split_part((select realtime.topic()), ':', 2)::uuid
			else null
		end
		and (select private.is_household_member(conversation.household_id))
	)
);