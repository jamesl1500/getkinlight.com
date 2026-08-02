create table public.household_member_presence (
	household_id uuid not null references public.households(id) on delete cascade,
	user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
	display_name text not null,
	is_typing boolean not null default false,
	online_at timestamptz not null default timezone('utc', now()),
	primary key (household_id, user_id),
	constraint household_member_presence_display_name_not_blank
		check (length(btrim(display_name)) between 1 and 160)
);

create index household_member_presence_online_at_idx
	on public.household_member_presence(household_id, online_at desc);

alter table public.household_member_presence enable row level security;

revoke all on table public.household_member_presence from anon, authenticated;
grant select, insert, update, delete on table public.household_member_presence to authenticated;
grant all on table public.household_member_presence to service_role;

create policy "household_member_presence_select_members"
on public.household_member_presence for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "household_member_presence_insert_own"
on public.household_member_presence for insert to authenticated
with check (
	user_id = (select auth.uid())
	and (select private.is_household_member(household_id))
);

create policy "household_member_presence_update_own"
on public.household_member_presence for update to authenticated
using (user_id = (select auth.uid()))
with check (
	user_id = (select auth.uid())
	and (select private.is_household_member(household_id))
);

create policy "household_member_presence_delete_own"
on public.household_member_presence for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "household_members_read_conversation_presence" on realtime.messages;
drop policy if exists "household_members_write_conversation_presence" on realtime.messages;

drop function if exists private.can_access_conversation_topic(text);
drop function if exists private.can_access_household_conversation_topic(text);

do $$
begin
	if not exists (
		select 1
		from pg_catalog.pg_publication_tables
		where pubname = 'supabase_realtime'
			and schemaname = 'public'
			and tablename = 'household_member_presence'
	) then
		alter publication supabase_realtime add table public.household_member_presence;
	end if;
end;
$$;
