create or replace function private.protect_care_record_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if new.household_id is distinct from old.household_id then
		raise exception 'household_id cannot be changed' using errcode = '42501';
	end if;

	if new.created_by is distinct from old.created_by
		and not (
			current_user = 'postgres'
			and current_setting('kinlight.account_deletion', true) = 'on'
		)
	then
		raise exception 'created_by cannot be changed' using errcode = '42501';
	end if;

	return new;
end;
$$;

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