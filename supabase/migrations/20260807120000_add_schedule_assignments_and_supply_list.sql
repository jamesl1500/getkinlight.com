-- Task assignment/RSVP for schedule items, and a shared household supply list.

create table public.schedule_task_assignments (
	id uuid primary key default gen_random_uuid(),
	household_id uuid not null references public.households(id) on delete cascade,
	resource_type text not null,
	resource_id uuid not null,
	assigned_to uuid references auth.users(id) on delete set null,
	claimed_at timestamptz,
	created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now()),
	constraint schedule_task_assignments_resource_type_check
		check (resource_type in ('event', 'appointment', 'medication', 'meal')),
	constraint schedule_task_assignments_claimed_at_consistency
		check ((assigned_to is null) = (claimed_at is null)),
	constraint schedule_task_assignments_resource_key
		unique (household_id, resource_type, resource_id)
);

create index schedule_task_assignments_household_idx
	on public.schedule_task_assignments(household_id);
create index schedule_task_assignments_assigned_to_idx
	on public.schedule_task_assignments(assigned_to);

alter table public.schedule_task_assignments enable row level security;
revoke all on table public.schedule_task_assignments from anon, authenticated;
grant select, insert, update on table public.schedule_task_assignments to authenticated;
grant all on table public.schedule_task_assignments to service_role;

create policy "schedule_task_assignments_select_members" on public.schedule_task_assignments
for select to authenticated
using ((select private.is_household_member(household_id)));

create policy "schedule_task_assignments_insert_contributors" on public.schedule_task_assignments
for insert to authenticated
with check (
	(select private.can_contribute_to_household(household_id))
	and created_by = (select auth.uid())
	and (assigned_to is null or assigned_to = (select auth.uid()))
);

-- A member may only claim an unclaimed task for themselves, or release their own claim.
create policy "schedule_task_assignments_update_claim_or_release" on public.schedule_task_assignments
for update to authenticated
using (
	(select private.can_contribute_to_household(household_id))
	and (assigned_to is null or assigned_to = (select auth.uid()))
)
with check (
	(select private.can_contribute_to_household(household_id))
	and (assigned_to is null or assigned_to = (select auth.uid()))
);

create trigger schedule_task_assignments_set_updated_at
before update on public.schedule_task_assignments
for each row execute function public.set_current_timestamp_updated_at();

comment on table public.schedule_task_assignments is
	'Optional claim/unclaim assignment of a household member to a schedule item (event, appointment, medication, or meal reminder).';

create table public.household_supply_items (
	id uuid primary key default gen_random_uuid(),
	household_id uuid not null references public.households(id) on delete cascade,
	care_recipient_id uuid,
	name text not null,
	quantity text,
	category text not null default 'general',
	is_checked boolean not null default false,
	checked_by uuid references auth.users(id) on delete set null,
	checked_at timestamptz,
	created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now()),
	constraint household_supply_items_name_not_blank check (length(btrim(name)) > 0),
	constraint household_supply_items_category_check
		check (category in ('medication', 'diapers', 'groceries', 'hygiene', 'general', 'other')),
	constraint household_supply_items_checked_consistency
		check ((is_checked and checked_at is not null) or (not is_checked and checked_by is null and checked_at is null)),
	constraint household_supply_items_recipient_household_fkey
		foreign key (household_id, care_recipient_id)
		references public.care_recipients(household_id, id)
		on delete cascade
);

create index household_supply_items_household_idx
	on public.household_supply_items(household_id, is_checked, created_at desc);

alter table public.household_supply_items enable row level security;
revoke all on table public.household_supply_items from anon, authenticated;
grant select, insert, update, delete on table public.household_supply_items to authenticated;
grant all on table public.household_supply_items to service_role;

create policy "household_supply_items_select_members" on public.household_supply_items
for select to authenticated
using ((select private.is_household_member(household_id)));
create policy "household_supply_items_insert_contributors" on public.household_supply_items
for insert to authenticated
with check (
	(select private.can_contribute_to_household(household_id))
	and created_by = (select auth.uid())
);
create policy "household_supply_items_update_contributors" on public.household_supply_items
for update to authenticated
using ((select private.can_contribute_to_household(household_id)))
with check ((select private.can_contribute_to_household(household_id)));
create policy "household_supply_items_delete_creator_or_owner" on public.household_supply_items
for delete to authenticated
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)));

create trigger household_supply_items_set_updated_at
before update on public.household_supply_items
for each row execute function public.set_current_timestamp_updated_at();

comment on table public.household_supply_items is
	'Shared shopping/supply list items for a household, optionally tied to a care recipient.';

alter table public.household_activity
	drop constraint household_activity_type_check;
alter table public.household_activity
	add constraint household_activity_type_check check (activity_type in (
		'care-recipient-created', 'care-recipient-updated', 'check-in-created',
		'note-created', 'medication-created', 'medication-updated', 'event-created',
		'event-updated', 'appointment-created', 'meal-reminder-created',
		'household-updated', 'invitation-created', 'invitation-cancelled',
		'member-joined', 'member-role-updated', 'member-removed', 'message-created',
		'schedule-task-claimed', 'schedule-task-unclaimed',
		'supply-item-created', 'supply-item-checked'
	));

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
	elsif tg_table_name = 'schedule_task_assignments' then
		if new.assigned_to is not null then
			activity := 'schedule-task-claimed'; activity_title := 'Task claimed';
			activity_body := 'A family member claimed a schedule item.';
		else
			activity := 'schedule-task-unclaimed'; activity_title := 'Task released';
			activity_body := 'A family member released a claimed schedule item.';
		end if;
		resource_href := '/calendar';
	elsif tg_table_name = 'household_supply_items' then
		if tg_op = 'INSERT' then
			activity := 'supply-item-created'; activity_title := 'Supply item added';
			activity_body := record_data ->> 'name';
		else
			activity := 'supply-item-checked'; activity_title := 'Supply item checked off';
			activity_body := record_data ->> 'name';
		end if;
		resource_href := '/supply';
	else
		return case when tg_op = 'DELETE' then old else new end;
	end if;

	if not exists (
		select 1 from public.households existing where existing.id = household
	) then
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

create trigger schedule_task_assignments_record_activity
after insert or update of assigned_to on public.schedule_task_assignments
for each row execute function private.record_household_activity();

create trigger household_supply_items_insert_record_activity
after insert on public.household_supply_items
for each row execute function private.record_household_activity();

create trigger household_supply_items_checked_record_activity
after update of is_checked on public.household_supply_items
for each row when (new.is_checked) execute function private.record_household_activity();

do $$
begin
	if not exists (
		select 1 from pg_catalog.pg_publication_tables
		where pubname = 'supabase_realtime'
		and schemaname = 'public'
		and tablename = 'household_supply_items'
	) then
		alter publication supabase_realtime add table public.household_supply_items;
	end if;

	if not exists (
		select 1 from pg_catalog.pg_publication_tables
		where pubname = 'supabase_realtime'
		and schemaname = 'public'
		and tablename = 'schedule_task_assignments'
	) then
		alter publication supabase_realtime add table public.schedule_task_assignments;
	end if;
end;
$$;
