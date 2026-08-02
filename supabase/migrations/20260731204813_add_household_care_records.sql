create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter function public.set_current_timestamp_updated_at() set search_path = '';

do $$
begin
	if to_regprocedure('public.rls_auto_enable()') is not null then
		revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
	end if;
end;
$$;

create index if not exists households_created_by_idx on public.households(created_by);
create index if not exists household_invitations_invited_by_idx
	on public.household_invitations(invited_by);
create index if not exists household_invitations_accepted_by_idx
	on public.household_invitations(accepted_by);

create or replace function private.is_household_member(target_household_id uuid)
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
	);
$$;

create or replace function private.is_household_owner(target_household_id uuid)
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
			and member.role = 'owner'
	);
$$;

create or replace function private.can_contribute_to_household(target_household_id uuid)
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
			and member.role in ('owner', 'member', 'caregiver')
	);
$$;

revoke all on function private.is_household_member(uuid) from public, anon;
revoke all on function private.is_household_owner(uuid) from public, anon;
revoke all on function private.can_contribute_to_household(uuid) from public, anon;
grant execute on function private.is_household_member(uuid) to authenticated, service_role;
grant execute on function private.is_household_owner(uuid) to authenticated, service_role;
grant execute on function private.can_contribute_to_household(uuid) to authenticated, service_role;

drop policy if exists "households_select_members" on public.households;
create policy "households_select_members"
on public.households
for select
to authenticated
using ((select private.is_household_member(id)));

drop policy if exists "households_update_owner" on public.households;
create policy "households_update_owner"
on public.households
for update
to authenticated
using ((select private.is_household_owner(id)))
with check ((select private.is_household_owner(id)));

drop policy if exists "households_delete_owner" on public.households;
create policy "households_delete_owner"
on public.households
for delete
to authenticated
using ((select private.is_household_owner(id)));

drop policy if exists "household_members_select_household_members" on public.household_members;
create policy "household_members_select_household_members"
on public.household_members
for select
to authenticated
using ((select private.is_household_member(household_id)));

drop policy if exists "household_members_insert_owner" on public.household_members;
create policy "household_members_insert_owner"
on public.household_members
for insert
to authenticated
with check ((select private.is_household_owner(household_id)));

drop policy if exists "household_members_update_owner" on public.household_members;
create policy "household_members_update_owner"
on public.household_members
for update
to authenticated
using ((select private.is_household_owner(household_id)))
with check ((select private.is_household_owner(household_id)));

drop policy if exists "household_members_delete_owner" on public.household_members;
create policy "household_members_delete_owner"
on public.household_members
for delete
to authenticated
using ((select private.is_household_owner(household_id)));

drop policy if exists "household_invitations_select_members" on public.household_invitations;
create policy "household_invitations_select_members"
on public.household_invitations
for select
to authenticated
using ((select private.is_household_member(household_id)));

drop policy if exists "household_invitations_insert_owner" on public.household_invitations;
create policy "household_invitations_insert_owner"
on public.household_invitations
for insert
to authenticated
with check (
	(select private.is_household_owner(household_id))
	and invited_by = (select auth.uid())
);

drop policy if exists "household_invitations_update_owner" on public.household_invitations;
create policy "household_invitations_update_owner"
on public.household_invitations
for update
to authenticated
using ((select private.is_household_owner(household_id)))
with check ((select private.is_household_owner(household_id)));

drop policy if exists "household_invitations_delete_owner" on public.household_invitations;
create policy "household_invitations_delete_owner"
on public.household_invitations
for delete
to authenticated
using ((select private.is_household_owner(household_id)));

create table public.care_recipients (
	id uuid primary key default gen_random_uuid(),
	household_id uuid not null references public.households(id) on delete cascade,
	first_name text not null,
	last_name text not null,
	preferred_name text,
	date_of_birth date,
	relationship text,
	care_preferences text,
	is_active boolean not null default true,
	created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now()),
	constraint care_recipients_first_name_not_blank check (length(btrim(first_name)) > 0),
	constraint care_recipients_last_name_not_blank check (length(btrim(last_name)) > 0),
	constraint care_recipients_household_id_id_key unique (household_id, id)
);

create table public.household_events (
	id uuid primary key default gen_random_uuid(),
	household_id uuid not null references public.households(id) on delete cascade,
	care_recipient_id uuid,
	title text not null,
	description text,
	location text,
	starts_at timestamptz not null,
	ends_at timestamptz,
	is_all_day boolean not null default false,
	created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now()),
	constraint household_events_title_not_blank check (length(btrim(title)) > 0),
	constraint household_events_time_order check (ends_at is null or ends_at >= starts_at),
	constraint household_events_recipient_household_fkey
		foreign key (household_id, care_recipient_id)
		references public.care_recipients(household_id, id)
		on delete cascade
);

create table public.appointments (
	id uuid primary key default gen_random_uuid(),
	household_id uuid not null references public.households(id) on delete cascade,
	care_recipient_id uuid not null,
	title text not null,
	provider_name text,
	specialty text,
	location text,
	starts_at timestamptz not null,
	ends_at timestamptz,
	status text not null default 'scheduled',
	preparation_notes text,
	transportation_notes text,
	created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now()),
	constraint appointments_title_not_blank check (length(btrim(title)) > 0),
	constraint appointments_time_order check (ends_at is null or ends_at >= starts_at),
	constraint appointments_status_check
		check (status in ('scheduled', 'completed', 'cancelled', 'rescheduled', 'missed')),
	constraint appointments_recipient_household_fkey
		foreign key (household_id, care_recipient_id)
		references public.care_recipients(household_id, id)
		on delete cascade
);

create table public.medication_reminders (
	id uuid primary key default gen_random_uuid(),
	household_id uuid not null references public.households(id) on delete cascade,
	care_recipient_id uuid not null,
	medication_name text not null,
	dosage text,
	instructions text,
	starts_on date not null default current_date,
	ends_on date,
	reminder_times time[] not null,
	days_of_week smallint[] not null default '{}'::smallint[],
	timezone text not null default 'UTC',
	is_active boolean not null default true,
	created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now()),
	constraint medication_reminders_name_not_blank check (length(btrim(medication_name)) > 0),
	constraint medication_reminders_time_required check (cardinality(reminder_times) > 0),
	constraint medication_reminders_date_order check (ends_on is null or ends_on >= starts_on),
	constraint medication_reminders_days_check
		check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
	constraint medication_reminders_timezone_not_blank check (length(btrim(timezone)) > 0),
	constraint medication_reminders_recipient_household_fkey
		foreign key (household_id, care_recipient_id)
		references public.care_recipients(household_id, id)
		on delete cascade
);

create table public.eating_reminders (
	id uuid primary key default gen_random_uuid(),
	household_id uuid not null references public.households(id) on delete cascade,
	care_recipient_id uuid not null,
	title text not null,
	meal_type text not null default 'meal',
	instructions text,
	starts_on date not null default current_date,
	ends_on date,
	reminder_times time[] not null,
	days_of_week smallint[] not null default '{}'::smallint[],
	timezone text not null default 'UTC',
	is_active boolean not null default true,
	created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now()),
	constraint eating_reminders_title_not_blank check (length(btrim(title)) > 0),
	constraint eating_reminders_meal_type_check
		check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'hydration', 'meal', 'other')),
	constraint eating_reminders_time_required check (cardinality(reminder_times) > 0),
	constraint eating_reminders_date_order check (ends_on is null or ends_on >= starts_on),
	constraint eating_reminders_days_check
		check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
	constraint eating_reminders_timezone_not_blank check (length(btrim(timezone)) > 0),
	constraint eating_reminders_recipient_household_fkey
		foreign key (household_id, care_recipient_id)
		references public.care_recipients(household_id, id)
		on delete cascade
);

create table public.household_check_ins (
	id uuid primary key default gen_random_uuid(),
	household_id uuid not null references public.households(id) on delete cascade,
	care_recipient_id uuid not null,
	status text not null default 'okay',
	mood smallint,
	summary text,
	occurred_at timestamptz not null default timezone('utc', now()),
	created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now()),
	constraint household_check_ins_status_check
		check (status in ('doing_well', 'okay', 'needs_attention', 'urgent')),
	constraint household_check_ins_mood_check check (mood is null or mood between 1 and 5),
	constraint household_check_ins_summary_not_blank
		check (summary is null or length(btrim(summary)) > 0),
	constraint household_check_ins_recipient_household_fkey
		foreign key (household_id, care_recipient_id)
		references public.care_recipients(household_id, id)
		on delete cascade
);

create table public.household_notes (
	id uuid primary key default gen_random_uuid(),
	household_id uuid not null references public.households(id) on delete cascade,
	care_recipient_id uuid,
	title text,
	body text not null,
	is_pinned boolean not null default false,
	created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
	created_at timestamptz not null default timezone('utc', now()),
	updated_at timestamptz not null default timezone('utc', now()),
	constraint household_notes_title_not_blank check (title is null or length(btrim(title)) > 0),
	constraint household_notes_body_not_blank check (length(btrim(body)) > 0),
	constraint household_notes_recipient_household_fkey
		foreign key (household_id, care_recipient_id)
		references public.care_recipients(household_id, id)
		on delete cascade
);

create index care_recipients_household_active_idx
	on public.care_recipients(household_id, is_active);
create index care_recipients_created_by_idx on public.care_recipients(created_by);
create index household_events_household_starts_at_idx
	on public.household_events(household_id, starts_at);
create index household_events_recipient_idx
	on public.household_events(household_id, care_recipient_id);
create index household_events_created_by_idx on public.household_events(created_by);
create index appointments_household_starts_at_idx
	on public.appointments(household_id, starts_at);
create index appointments_recipient_idx on public.appointments(household_id, care_recipient_id);
create index appointments_created_by_idx on public.appointments(created_by);
create index medication_reminders_active_idx
	on public.medication_reminders(household_id, care_recipient_id, starts_on)
	where is_active;
create index medication_reminders_created_by_idx on public.medication_reminders(created_by);
create index eating_reminders_active_idx
	on public.eating_reminders(household_id, care_recipient_id, starts_on)
	where is_active;
create index eating_reminders_created_by_idx on public.eating_reminders(created_by);
create index household_check_ins_recipient_occurred_at_idx
	on public.household_check_ins(household_id, care_recipient_id, occurred_at desc);
create index household_check_ins_created_by_idx on public.household_check_ins(created_by);
create index household_notes_household_created_at_idx
	on public.household_notes(household_id, created_at desc);
create index household_notes_recipient_idx on public.household_notes(household_id, care_recipient_id);
create index household_notes_created_by_idx on public.household_notes(created_by);
create index household_notes_pinned_idx on public.household_notes(household_id) where is_pinned;

create or replace function private.protect_care_record_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if new.household_id is distinct from old.household_id then
		raise exception 'household_id cannot be changed' using errcode = '42501';
	end if;

	if new.created_by is distinct from old.created_by then
		raise exception 'created_by cannot be changed' using errcode = '42501';
	end if;

	return new;
end;
$$;

revoke all on function private.protect_care_record_ownership() from public, anon;
grant execute on function private.protect_care_record_ownership() to authenticated, service_role;

create trigger care_recipients_protect_ownership
before update on public.care_recipients
for each row execute function private.protect_care_record_ownership();
create trigger household_events_protect_ownership
before update on public.household_events
for each row execute function private.protect_care_record_ownership();
create trigger appointments_protect_ownership
before update on public.appointments
for each row execute function private.protect_care_record_ownership();
create trigger medication_reminders_protect_ownership
before update on public.medication_reminders
for each row execute function private.protect_care_record_ownership();
create trigger eating_reminders_protect_ownership
before update on public.eating_reminders
for each row execute function private.protect_care_record_ownership();
create trigger household_check_ins_protect_ownership
before update on public.household_check_ins
for each row execute function private.protect_care_record_ownership();
create trigger household_notes_protect_ownership
before update on public.household_notes
for each row execute function private.protect_care_record_ownership();

create trigger care_recipients_set_updated_at
before update on public.care_recipients
for each row execute function public.set_current_timestamp_updated_at();
create trigger household_events_set_updated_at
before update on public.household_events
for each row execute function public.set_current_timestamp_updated_at();
create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_current_timestamp_updated_at();
create trigger medication_reminders_set_updated_at
before update on public.medication_reminders
for each row execute function public.set_current_timestamp_updated_at();
create trigger eating_reminders_set_updated_at
before update on public.eating_reminders
for each row execute function public.set_current_timestamp_updated_at();
create trigger household_check_ins_set_updated_at
before update on public.household_check_ins
for each row execute function public.set_current_timestamp_updated_at();
create trigger household_notes_set_updated_at
before update on public.household_notes
for each row execute function public.set_current_timestamp_updated_at();

alter table public.care_recipients enable row level security;
alter table public.household_events enable row level security;
alter table public.appointments enable row level security;
alter table public.medication_reminders enable row level security;
alter table public.eating_reminders enable row level security;
alter table public.household_check_ins enable row level security;
alter table public.household_notes enable row level security;

revoke all on table public.care_recipients from anon;
revoke all on table public.household_events from anon;
revoke all on table public.appointments from anon;
revoke all on table public.medication_reminders from anon;
revoke all on table public.eating_reminders from anon;
revoke all on table public.household_check_ins from anon;
revoke all on table public.household_notes from anon;

grant select, insert, update, delete on table public.care_recipients to authenticated, service_role;
grant select, insert, update, delete on table public.household_events to authenticated, service_role;
grant select, insert, update, delete on table public.appointments to authenticated, service_role;
grant select, insert, update, delete on table public.medication_reminders to authenticated, service_role;
grant select, insert, update, delete on table public.eating_reminders to authenticated, service_role;
grant select, insert, update, delete on table public.household_check_ins to authenticated, service_role;
grant select, insert, update, delete on table public.household_notes to authenticated, service_role;

create policy "care_recipients_select_members" on public.care_recipients
for select to authenticated
using ((select private.is_household_member(household_id)));
create policy "care_recipients_insert_contributors" on public.care_recipients
for insert to authenticated
with check (
	(select private.can_contribute_to_household(household_id))
	and created_by = (select auth.uid())
);
create policy "care_recipients_update_contributors" on public.care_recipients
for update to authenticated
using ((select private.can_contribute_to_household(household_id)))
with check ((select private.can_contribute_to_household(household_id)));
create policy "care_recipients_delete_creator_or_owner" on public.care_recipients
for delete to authenticated
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)));

create policy "household_events_select_members" on public.household_events
for select to authenticated
using ((select private.is_household_member(household_id)));
create policy "household_events_insert_contributors" on public.household_events
for insert to authenticated
with check (
	(select private.can_contribute_to_household(household_id))
	and created_by = (select auth.uid())
);
create policy "household_events_update_contributors" on public.household_events
for update to authenticated
using ((select private.can_contribute_to_household(household_id)))
with check ((select private.can_contribute_to_household(household_id)));
create policy "household_events_delete_creator_or_owner" on public.household_events
for delete to authenticated
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)));

create policy "appointments_select_members" on public.appointments
for select to authenticated
using ((select private.is_household_member(household_id)));
create policy "appointments_insert_contributors" on public.appointments
for insert to authenticated
with check (
	(select private.can_contribute_to_household(household_id))
	and created_by = (select auth.uid())
);
create policy "appointments_update_contributors" on public.appointments
for update to authenticated
using ((select private.can_contribute_to_household(household_id)))
with check ((select private.can_contribute_to_household(household_id)));
create policy "appointments_delete_creator_or_owner" on public.appointments
for delete to authenticated
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)));

create policy "medication_reminders_select_members" on public.medication_reminders
for select to authenticated
using ((select private.is_household_member(household_id)));
create policy "medication_reminders_insert_contributors" on public.medication_reminders
for insert to authenticated
with check (
	(select private.can_contribute_to_household(household_id))
	and created_by = (select auth.uid())
);
create policy "medication_reminders_update_contributors" on public.medication_reminders
for update to authenticated
using ((select private.can_contribute_to_household(household_id)))
with check ((select private.can_contribute_to_household(household_id)));
create policy "medication_reminders_delete_creator_or_owner" on public.medication_reminders
for delete to authenticated
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)));

create policy "eating_reminders_select_members" on public.eating_reminders
for select to authenticated
using ((select private.is_household_member(household_id)));
create policy "eating_reminders_insert_contributors" on public.eating_reminders
for insert to authenticated
with check (
	(select private.can_contribute_to_household(household_id))
	and created_by = (select auth.uid())
);
create policy "eating_reminders_update_contributors" on public.eating_reminders
for update to authenticated
using ((select private.can_contribute_to_household(household_id)))
with check ((select private.can_contribute_to_household(household_id)));
create policy "eating_reminders_delete_creator_or_owner" on public.eating_reminders
for delete to authenticated
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)));

create policy "household_check_ins_select_members" on public.household_check_ins
for select to authenticated
using ((select private.is_household_member(household_id)));
create policy "household_check_ins_insert_contributors" on public.household_check_ins
for insert to authenticated
with check (
	(select private.can_contribute_to_household(household_id))
	and created_by = (select auth.uid())
);
create policy "household_check_ins_update_contributors" on public.household_check_ins
for update to authenticated
using ((select private.can_contribute_to_household(household_id)))
with check ((select private.can_contribute_to_household(household_id)));
create policy "household_check_ins_delete_creator_or_owner" on public.household_check_ins
for delete to authenticated
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)));

create policy "household_notes_select_members" on public.household_notes
for select to authenticated
using ((select private.is_household_member(household_id)));
create policy "household_notes_insert_contributors" on public.household_notes
for insert to authenticated
with check (
	(select private.can_contribute_to_household(household_id))
	and created_by = (select auth.uid())
);
create policy "household_notes_update_contributors" on public.household_notes
for update to authenticated
using ((select private.can_contribute_to_household(household_id)))
with check ((select private.can_contribute_to_household(household_id)));
create policy "household_notes_delete_creator_or_owner" on public.household_notes
for delete to authenticated
using (created_by = (select auth.uid()) or (select private.is_household_owner(household_id)));

comment on table public.care_recipients is
	'People receiving care in a household; they do not need an authenticated account.';
comment on table public.household_events is 'Shared household calendar events, optionally scoped to a care recipient.';
comment on table public.appointments is 'Appointments for a care recipient.';
comment on table public.medication_reminders is 'Recurring medication reminder definitions for a care recipient.';
comment on table public.eating_reminders is 'Recurring meal, snack, and hydration reminder definitions for a care recipient.';
comment on table public.household_check_ins is 'Timestamped family check-ins for a care recipient.';
comment on table public.household_notes is 'Collaborative household notes, optionally scoped to a care recipient.';
