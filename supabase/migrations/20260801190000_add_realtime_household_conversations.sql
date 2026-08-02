create table public.household_conversations (
	id uuid primary key default gen_random_uuid(),
	household_id uuid not null references public.households(id) on delete cascade,
	title text not null default 'Household',
	is_default boolean not null default true,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now()),
	constraint household_conversations_title_not_blank check (length(btrim(title)) > 0),
	constraint household_conversations_household_id_id_key unique (household_id, id)
);

create unique index household_conversations_one_default_idx
	on public.household_conversations(household_id)
	where is_default;

create table public.household_messages (
	id uuid primary key default gen_random_uuid(),
	conversation_id uuid not null,
	household_id uuid not null,
	sender_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
	body text not null,
	created_at timestamptz not null default timezone('utc', now()),
	edited_at timestamptz,
	constraint household_messages_body_not_blank check (length(btrim(body)) between 1 and 4000),
	constraint household_messages_conversation_fkey
		foreign key (household_id, conversation_id)
		references public.household_conversations(household_id, id)
		on delete cascade
);

create index household_messages_conversation_created_at_idx
	on public.household_messages(conversation_id, created_at desc);
create index household_messages_household_created_at_idx
	on public.household_messages(household_id, created_at desc);
create index household_messages_sender_id_idx
	on public.household_messages(sender_id);

alter table public.household_conversations enable row level security;
alter table public.household_messages enable row level security;

revoke all on table public.household_conversations from anon, authenticated;
revoke all on table public.household_messages from anon, authenticated;
grant select on table public.household_conversations to authenticated;
grant select, insert on table public.household_messages to authenticated;
grant all on table public.household_conversations, public.household_messages to service_role;

create policy "household_conversations_select_members"
on public.household_conversations for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "household_messages_select_members"
on public.household_messages for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "household_messages_insert_members"
on public.household_messages for insert to authenticated
with check (
	sender_id = (select auth.uid())
	and (select private.is_household_member(household_id))
);

create or replace function private.create_default_household_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.household_conversations (household_id, title, is_default)
	values (new.id, 'Household', true)
	on conflict do nothing;
	return new;
end;
$$;

create or replace function private.after_household_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	update public.household_conversations
	set updated_at = new.created_at
	where id = new.conversation_id and household_id = new.household_id;

	insert into public.household_activity (
		household_id, actor_user_id, activity_type, title, body, resource_type, resource_id, href
	) values (
		new.household_id,
		new.sender_id,
		'message-created',
		'New household message',
		'A new message was shared in the household conversation.',
		'household_messages',
		new.id,
		'/conversations'
	);

	return new;
end;
$$;

revoke all on function private.create_default_household_conversation() from public, anon, authenticated;
revoke all on function private.after_household_message_insert() from public, anon, authenticated;

create trigger households_create_default_conversation
after insert on public.households
for each row execute function private.create_default_household_conversation();

create trigger household_messages_after_insert
after insert on public.household_messages
for each row execute function private.after_household_message_insert();

insert into public.household_conversations (household_id, title, is_default)
select household.id, 'Household', true
from public.households household
where not exists (
	select 1
	from public.household_conversations conversation
	where conversation.household_id = household.id and conversation.is_default
);

alter table public.household_activity
	drop constraint household_activity_type_check;
alter table public.household_activity
	add constraint household_activity_type_check check (activity_type in (
		'care-recipient-created', 'care-recipient-updated', 'check-in-created',
		'note-created', 'medication-created', 'medication-updated', 'event-created',
		'event-updated', 'appointment-created', 'meal-reminder-created',
		'household-updated', 'invitation-created', 'invitation-cancelled',
		'member-joined', 'member-role-updated', 'member-removed', 'message-created'
	));

do $$
begin
	if not exists (
		select 1 from pg_catalog.pg_publication_tables
		where pubname = 'supabase_realtime'
		and schemaname = 'public'
		and tablename = 'household_messages'
	) then
		alter publication supabase_realtime add table public.household_messages;
	end if;
end;
$$;