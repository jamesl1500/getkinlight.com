create or replace function public.prepare_current_account_deletion()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	current_user_id uuid := (select auth.uid());
	membership record;
	replacement_owner_id uuid;
	member_count integer;
	owner_count integer;
	deleted_households integer := 0;
	left_households integer := 0;
begin
	if current_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	perform set_config('kinlight.account_deletion', 'on', true);

	for membership in
		select member.household_id, member.role
		from public.household_members member
		where member.user_id = current_user_id
	loop
		select
			count(*),
			count(*) filter (where member.role = 'owner')
		into member_count, owner_count
		from public.household_members member
		where member.household_id = membership.household_id;

		if membership.role = 'owner' and owner_count = 1 and member_count > 1 then
			raise exception 'Transfer ownership of every shared household before deleting your account.'
				using errcode = '23514';
		end if;
	end loop;

	for membership in
		select member.household_id, member.role
		from public.household_members member
		where member.user_id = current_user_id
	loop
		select count(*) into member_count
		from public.household_members member
		where member.household_id = membership.household_id;

		if membership.role = 'owner' and member_count = 1 then
			delete from public.households
			where id = membership.household_id;
			deleted_households := deleted_households + 1;
			continue;
		end if;

		select member.user_id
		into replacement_owner_id
		from public.household_members member
		where member.household_id = membership.household_id
			and member.user_id <> current_user_id
			and member.role = 'owner'
		order by member.created_at
		limit 1;

		if replacement_owner_id is null then
			raise exception 'A replacement household owner is required.'
				using errcode = '23514';
		end if;

		update public.households
		set created_by = replacement_owner_id
		where id = membership.household_id
			and created_by = current_user_id;

		update public.household_invitations
		set invited_by = replacement_owner_id
		where household_id = membership.household_id
			and invited_by = current_user_id;

		update public.care_recipients
		set created_by = replacement_owner_id
		where household_id = membership.household_id
			and created_by = current_user_id;

		update public.household_events
		set created_by = replacement_owner_id
		where household_id = membership.household_id
			and created_by = current_user_id;

		update public.appointments
		set created_by = replacement_owner_id
		where household_id = membership.household_id
			and created_by = current_user_id;

		update public.medication_reminders
		set created_by = replacement_owner_id
		where household_id = membership.household_id
			and created_by = current_user_id;

		update public.eating_reminders
		set created_by = replacement_owner_id
		where household_id = membership.household_id
			and created_by = current_user_id;

		update public.household_check_ins
		set created_by = replacement_owner_id
		where household_id = membership.household_id
			and created_by = current_user_id;

		update public.household_notes
		set created_by = replacement_owner_id
		where household_id = membership.household_id
			and created_by = current_user_id;

		update public.household_messages
		set sender_id = replacement_owner_id
		where household_id = membership.household_id
			and sender_id = current_user_id;

		delete from public.household_members
		where household_id = membership.household_id
			and user_id = current_user_id;
		left_households := left_households + 1;
	end loop;

	delete from public.household_invitations
	where invited_by = current_user_id;

	delete from public.profiles
	where user_id = current_user_id;

	perform set_config('kinlight.account_deletion', 'off', true);

	return jsonb_build_object(
		'deletedHouseholds', deleted_households,
		'leftHouseholds', left_households
	);
end;
$$;

revoke all on function public.prepare_current_account_deletion() from public, anon;
grant execute on function public.prepare_current_account_deletion() to authenticated;
grant execute on function public.prepare_current_account_deletion() to service_role;
