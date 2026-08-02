create table public.household_activity (
	id uuid primary key default gen_random_uuid(),
	household_id uuid not null references public.households(id) on delete cascade,
	actor_user_id uuid references auth.users(id) on delete set null,
	activity_type text not null,
	title text not null,
	body text not null,
	resource_type text,
	resource_id uuid,
	href text,
	created_at timestamptz not null default timezone('utc', now()),
	constraint household_activity_type_check check (activity_type in (
		'care-recipient-created', 'care-recipient-updated', 'check-in-created',
		'note-created', 'medication-created', 'medication-updated', 'event-created',
		'event-updated', 'appointment-created', 'meal-reminder-created',
		'household-updated', 'invitation-created', 'invitation-cancelled',
		'member-joined', 'member-role-updated', 'member-removed'
	)),
	constraint household_activity_title_not_blank check (length(btrim(title)) > 0),
	constraint household_activity_body_not_blank check (length(btrim(body)) > 0),
	constraint household_activity_href_internal check (href is null or href like '/%')
);

create table public.notification_reads (
	activity_id uuid not null references public.household_activity(id) on delete cascade,
	user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
	read_at timestamptz not null default timezone('utc', now()),
	primary key (activity_id, user_id)
);

create index household_activity_household_created_at_idx
	on public.household_activity(household_id, created_at desc);
create index household_activity_actor_user_id_idx
	on public.household_activity(actor_user_id);
create index notification_reads_user_read_at_idx
	on public.notification_reads(user_id, read_at desc);

alter table public.household_activity enable row level security;
alter table public.notification_reads enable row level security;

revoke all on table public.household_activity from anon, authenticated;
revoke all on table public.notification_reads from anon, authenticated;
grant select on table public.household_activity to authenticated;
grant select, insert, update on table public.notification_reads to authenticated;
grant all on table public.household_activity, public.notification_reads to service_role;

create policy "household_activity_select_members"
on public.household_activity for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "notification_reads_select_own"
on public.notification_reads for select to authenticated
using (user_id = (select auth.uid()));

create policy "notification_reads_insert_own_activity"
on public.notification_reads for insert to authenticated
with check (
	user_id = (select auth.uid())
	and exists (
		select 1
		from public.household_activity activity
		where activity.id = activity_id
		and (select private.is_household_member(activity.household_id))
	)
);

create policy "notification_reads_update_own"
on public.notification_reads for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function private.record_household_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	record_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
	household uuid := (record_data ->> 'household_id')::uuid;
	actor uuid := auth.uid();
	activity text;
	activity_title text;
	activity_body text;
	resource_href text;
begin
	if tg_table_name = 'care_recipients' then
		activity := case when tg_op = 'INSERT' then 'care-recipient-created' else 'care-recipient-updated' end;
		activity_title := case when tg_op = 'INSERT' then 'Care recipient added' else 'Care recipient updated' end;
		activity_body := coalesce(nullif(record_data ->> 'preferred_name', ''), record_data ->> 'first_name') ||
			case when tg_op = 'INSERT' then ' was added to the household.' else '''s care details were updated.' end;
		resource_href := '/care';
	elsif tg_table_name = 'household_check_ins' then
		activity := 'check-in-created'; activity_title := 'Check-in recorded';
		activity_body := 'A new family check-in was recorded.'; resource_href := '/care';
	elsif tg_table_name = 'household_notes' then
		activity := 'note-created'; activity_title := 'Care note added';
		activity_body := coalesce(nullif(record_data ->> 'title', ''), 'A new household care note was added.'); resource_href := '/care';
	elsif tg_table_name = 'medication_reminders' then
		activity := case when tg_op = 'INSERT' then 'medication-created' else 'medication-updated' end;
		activity_title := case when tg_op = 'INSERT' then 'Medication reminder added' else 'Medication reminder updated' end;
		activity_body := record_data ->> 'medication_name'; resource_href := '/care';
	elsif tg_table_name = 'household_events' then
		activity := case when tg_op = 'INSERT' then 'event-created' else 'event-updated' end;
		activity_title := case when tg_op = 'INSERT' then 'Family event added' else 'Family event updated' end;
		activity_body := record_data ->> 'title'; resource_href := '/calendar';
	elsif tg_table_name = 'appointments' then
		activity := 'appointment-created'; activity_title := 'Appointment added';
		activity_body := record_data ->> 'title'; resource_href := '/calendar';
	elsif tg_table_name = 'eating_reminders' then
		activity := 'meal-reminder-created'; activity_title := 'Meal reminder added';
		activity_body := record_data ->> 'title'; resource_href := '/calendar';
	elsif tg_table_name = 'households' then
		household := (record_data ->> 'id')::uuid;
		activity := 'household-updated'; activity_title := 'Household updated';
		activity_body := 'The household name was updated.'; resource_href := '/family';
	elsif tg_table_name = 'household_invitations' then
		activity := case when tg_op = 'INSERT' then 'invitation-created' else 'invitation-cancelled' end;
		activity_title := case when tg_op = 'INSERT' then 'Family invitation created' else 'Family invitation cancelled' end;
		activity_body := case when tg_op = 'INSERT' then 'A new family invitation is ready to share.' else 'A pending family invitation was cancelled.' end;
		resource_href := '/family';
	elsif tg_table_name = 'household_members' then
		activity := case when tg_op = 'INSERT' then 'member-joined' when tg_op = 'UPDATE' then 'member-role-updated' else 'member-removed' end;
		activity_title := case when tg_op = 'INSERT' then 'Family member joined' when tg_op = 'UPDATE' then 'Member role updated' else 'Family member removed' end;
		activity_body := case when tg_op = 'INSERT' then 'A family member joined the household.' when tg_op = 'UPDATE' then 'A family member''s household role changed.' else 'A family member was removed from the household.' end;
		resource_href := '/family';
	else
		return case when tg_op = 'DELETE' then old else new end;
	end if;

	insert into public.household_activity (
		household_id, actor_user_id, activity_type, title, body, resource_type, resource_id, href
	) values (
		household, actor, activity, activity_title, activity_body, tg_table_name,
		(record_data ->> 'id')::uuid, resource_href
	);

	return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.record_household_activity() from public, anon, authenticated;
grant execute on function private.record_household_activity() to service_role;

create trigger care_recipients_record_activity after insert or update on public.care_recipients
for each row execute function private.record_household_activity();
create trigger household_check_ins_record_activity after insert on public.household_check_ins
for each row execute function private.record_household_activity();
create trigger household_notes_record_activity after insert on public.household_notes
for each row execute function private.record_household_activity();
create trigger medication_reminders_record_activity after insert or update on public.medication_reminders
for each row execute function private.record_household_activity();
create trigger household_events_record_activity after insert or update on public.household_events
for each row execute function private.record_household_activity();
create trigger appointments_record_activity after insert on public.appointments
for each row execute function private.record_household_activity();
create trigger eating_reminders_record_activity after insert on public.eating_reminders
for each row execute function private.record_household_activity();
create trigger households_record_activity after update of name on public.households
for each row when (old.name is distinct from new.name) execute function private.record_household_activity();
create trigger household_invitations_record_activity after insert or delete on public.household_invitations
for each row execute function private.record_household_activity();
create trigger household_members_record_activity after insert or update of role or delete on public.household_members
for each row execute function private.record_household_activity();

do $$
begin
	if not exists (
		select 1 from pg_catalog.pg_publication_tables
		where pubname = 'supabase_realtime'
		and schemaname = 'public'
		and tablename = 'household_activity'
	) then
		alter publication supabase_realtime add table public.household_activity;
	end if;
end;
$$;