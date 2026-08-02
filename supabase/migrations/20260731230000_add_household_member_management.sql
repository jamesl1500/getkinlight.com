alter table public.household_invitations
add column role text not null default 'member'
check (role in ('member', 'caregiver'));

create unique index household_invitations_pending_email_idx
on public.household_invitations (household_id, lower(invited_email))
where accepted_at is null;

create or replace function public.get_household_member_directory(target_household_id uuid)
returns table (
	member_id uuid,
	user_id uuid,
	role text,
	first_name text,
	last_name text,
	username text,
	email text,
	joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
	select
		member.id,
		member.user_id,
		member.role,
		profile.first_name,
		profile.last_name,
		profile.username,
		auth_user.email::text,
		member.created_at
	from public.household_members member
	left join public.profiles profile on profile.user_id = member.user_id
	left join auth.users auth_user on auth_user.id = member.user_id
	where member.household_id = target_household_id
		and exists (
			select 1
			from public.household_members caller
			where caller.household_id = target_household_id
				and caller.user_id = (select auth.uid())
		)
	order by
		case member.role when 'owner' then 0 when 'caregiver' then 1 else 2 end,
		coalesce(profile.first_name, auth_user.email);
$$;

revoke all on function public.get_household_member_directory(uuid) from public, anon;
grant execute on function public.get_household_member_directory(uuid) to authenticated, service_role;

create or replace function public.accept_household_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	invitation public.household_invitations%rowtype;
	current_user_id uuid := (select auth.uid());
	current_email text;
begin
	if current_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	select auth_user.email::text
	into current_email
	from auth.users auth_user
	where auth_user.id = current_user_id;

	select invite.*
	into invitation
	from public.household_invitations invite
	where invite.invite_token = invitation_token
		and invite.accepted_at is null
		and invite.expires_at > timezone('utc', now())
	for update;

	if invitation.id is null or lower(invitation.invited_email) <> lower(current_email) then
		raise exception 'This invitation is invalid, expired, or belongs to another account.' using errcode = '42501';
	end if;

	insert into public.household_members (household_id, user_id, role)
	values (invitation.household_id, current_user_id, invitation.role)
	on conflict (household_id, user_id) do nothing;

	update public.household_invitations
	set accepted_by = current_user_id,
		accepted_at = timezone('utc', now())
	where id = invitation.id;

	return invitation.household_id;
end;
$$;

revoke all on function public.accept_household_invitation(text) from public, anon;
grant execute on function public.accept_household_invitation(text) to authenticated, service_role;

create or replace function private.protect_last_household_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if old.role = 'owner'
		and (tg_op = 'DELETE' or new.role <> 'owner')
		and exists (select 1 from public.households household where household.id = old.household_id)
		and not exists (
			select 1
			from public.household_members member
			where member.household_id = old.household_id
				and member.id <> old.id
				and member.role = 'owner'
		)
	then
		raise exception 'A household must have at least one owner.' using errcode = '23514';
	end if;

	return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.protect_last_household_owner() from public, anon, authenticated;
grant execute on function private.protect_last_household_owner() to service_role;

create trigger household_members_protect_last_owner
before update of role or delete on public.household_members
for each row execute function private.protect_last_household_owner();