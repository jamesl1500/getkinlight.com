begin;

create extension if not exists pgcrypto;

-- Keep profile table compatible while ensuring auth linkage and sane defaults.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists profiles_set_updated_at on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

alter table public.profiles
  drop constraint if exists profiles_id_fkey,
  drop constraint if exists profiles_username_key,
  drop constraint if exists username_length,
  add column if not exists user_id uuid references auth.users(id),
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists avatar uuid,
  add column if not exists role text,
  add column if not exists is_admin boolean default false,
  alter column id set default gen_random_uuid(),
  alter column username drop not null,
  alter column created_at set default timezone('utc', now()),
  drop column if exists full_name,
  drop column if exists bio,
  drop column if exists avatar_url;

alter table public.profiles
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.profiles
set user_id = id,
    updated_at = coalesce(updated_at, timezone('utc', now()))
where user_id is null;

alter table public.profiles
  add constraint profiles_user_id_key unique (user_id);

create unique index if not exists profile_user_id_unique_idx on public.profiles(user_id) where user_id is not null;

-- Core family entity.
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member', 'caregiver')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, user_id)
);

create index if not exists household_members_user_id_idx on public.household_members(user_id);
create index if not exists household_members_household_id_idx on public.household_members(household_id);

-- Invite members before they sign in.
create table if not exists public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_email text not null,
  invite_token text not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists household_invitations_household_id_idx on public.household_invitations(household_id);
create index if not exists household_invitations_invited_email_idx on public.household_invitations(lower(invited_email));

-- Trigger helper for updated_at maintenance.
create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Profile bootstrap on first auth signup.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, username, first_name, last_name, role, is_admin)
  values (
    new.id,
    coalesce(new.email, 'user-' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    'member',
    false
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;

-- Triggers.
drop trigger if exists profile_set_updated_at on public.profiles;
create trigger profile_set_updated_at
before update on public.profiles
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists households_set_updated_at on public.households;
create trigger households_set_updated_at
before update on public.households
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists household_members_set_updated_at on public.household_members;
create trigger household_members_set_updated_at
before update on public.household_members
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists household_invitations_set_updated_at on public.household_invitations;
create trigger household_invitations_set_updated_at
before update on public.household_invitations
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- RLS and grants.
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.households from anon;
revoke all on table public.household_members from anon;
revoke all on table public.household_invitations from anon;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.households to authenticated;
grant select, insert, update, delete on table public.household_members to authenticated;
grant select, insert, update, delete on table public.household_invitations to authenticated;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.households to service_role;
grant select, insert, update, delete on table public.household_members to service_role;
grant select, insert, update, delete on table public.household_invitations to service_role;

-- Profile policies.
drop policy if exists "profile_select_own" on public.profiles;
create policy "profile_select_own"
on public.profiles
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "profile_insert_own" on public.profiles;
create policy "profile_insert_own"
on public.profiles
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "profile_update_own" on public.profiles;
create policy "profile_update_own"
on public.profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Household policies.
drop policy if exists "households_select_members" on public.households;
create policy "households_select_members"
on public.households
for select
to authenticated
using (
  exists (
    select 1 from public.household_members m
    where m.household_id = households.id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "households_insert_authenticated" on public.households;
create policy "households_insert_authenticated"
on public.households
for insert
to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "households_update_owner" on public.households;
create policy "households_update_owner"
on public.households
for update
to authenticated
using (
  exists (
    select 1 from public.household_members m
    where m.household_id = households.id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
)
with check (
  exists (
    select 1 from public.household_members m
    where m.household_id = households.id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
);

drop policy if exists "households_delete_owner" on public.households;
create policy "households_delete_owner"
on public.households
for delete
to authenticated
using (
  exists (
    select 1 from public.household_members m
    where m.household_id = households.id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
);

-- Household member policies.
drop policy if exists "household_members_select_household_members" on public.household_members;
create policy "household_members_select_household_members"
on public.household_members
for select
to authenticated
using (
  exists (
    select 1 from public.household_members m
    where m.household_id = household_members.household_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "household_members_insert_owner_or_self" on public.household_members;
create policy "household_members_insert_owner_or_self"
on public.household_members
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.household_members m
    where m.household_id = household_members.household_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
);

drop policy if exists "household_members_update_owner" on public.household_members;
create policy "household_members_update_owner"
on public.household_members
for update
to authenticated
using (
  exists (
    select 1 from public.household_members m
    where m.household_id = household_members.household_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
)
with check (
  exists (
    select 1 from public.household_members m
    where m.household_id = household_members.household_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
);

drop policy if exists "household_members_delete_owner" on public.household_members;
create policy "household_members_delete_owner"
on public.household_members
for delete
to authenticated
using (
  exists (
    select 1 from public.household_members m
    where m.household_id = household_members.household_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
);

-- Invitation policies.
drop policy if exists "household_invitations_select_members" on public.household_invitations;
create policy "household_invitations_select_members"
on public.household_invitations
for select
to authenticated
using (
  exists (
    select 1 from public.household_members m
    where m.household_id = household_invitations.household_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "household_invitations_insert_owner" on public.household_invitations;
create policy "household_invitations_insert_owner"
on public.household_invitations
for insert
to authenticated
with check (
  exists (
    select 1 from public.household_members m
    where m.household_id = household_invitations.household_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
  and invited_by = (select auth.uid())
);

drop policy if exists "household_invitations_update_owner" on public.household_invitations;
create policy "household_invitations_update_owner"
on public.household_invitations
for update
to authenticated
using (
  exists (
    select 1 from public.household_members m
    where m.household_id = household_invitations.household_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
)
with check (
  exists (
    select 1 from public.household_members m
    where m.household_id = household_invitations.household_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
);

drop policy if exists "household_invitations_delete_owner" on public.household_invitations;
create policy "household_invitations_delete_owner"
on public.household_invitations
for delete
to authenticated
using (
  exists (
    select 1 from public.household_members m
    where m.household_id = household_invitations.household_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
);

commit;;
