-- Allow household owners/caregivers to assign schedule tasks to other members,
-- not only claim tasks for themselves.

create or replace function private.can_assign_household_tasks(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.household_members member
		where member.household_id = target_household_id
			and member.user_id = (select auth.uid())
			and member.role in ('owner', 'caregiver')
	);
$$;

create or replace function private.is_household_member_user(
	target_household_id uuid,
	target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.household_members member
		where member.household_id = target_household_id
			and member.user_id = target_user_id
	);
$$;

revoke all on function private.can_assign_household_tasks(uuid) from public, anon;
revoke all on function private.is_household_member_user(uuid, uuid) from public, anon;
grant execute on function private.can_assign_household_tasks(uuid) to authenticated, service_role;
grant execute on function private.is_household_member_user(uuid, uuid) to authenticated, service_role;

drop policy if exists "schedule_task_assignments_insert_contributors" on public.schedule_task_assignments;
create policy "schedule_task_assignments_insert_contributors" on public.schedule_task_assignments
for insert to authenticated
with check (
	(select private.can_contribute_to_household(household_id))
	and created_by = (select auth.uid())
	and (
		assigned_to is null
		or assigned_to = (select auth.uid())
		or (
			(select private.can_assign_household_tasks(household_id))
			and (select private.is_household_member_user(household_id, assigned_to))
		)
	)
);

drop policy if exists "schedule_task_assignments_update_claim_or_release" on public.schedule_task_assignments;
create policy "schedule_task_assignments_update_claim_or_release" on public.schedule_task_assignments
for update to authenticated
using (
	(select private.can_contribute_to_household(household_id))
	and (
		assigned_to is null
		or assigned_to = (select auth.uid())
		or (select private.can_assign_household_tasks(household_id))
	)
)
with check (
	(select private.can_contribute_to_household(household_id))
	and (
		assigned_to is null
		or assigned_to = (select auth.uid())
		or (
			(select private.can_assign_household_tasks(household_id))
			and (select private.is_household_member_user(household_id, assigned_to))
		)
	)
);

comment on policy "schedule_task_assignments_update_claim_or_release" on public.schedule_task_assignments is
	'Members may claim/release their own task; owners and caregivers may additionally assign or reassign any household member.';
