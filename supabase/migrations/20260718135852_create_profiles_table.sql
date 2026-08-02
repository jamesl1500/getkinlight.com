create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_length check (char_length(username) >= 3)
);

comment on table public.profiles is 'Public-facing profile data for each authenticated user, one row per auth.users id.';

alter table public.profiles enable row level security;

create policy "Users can view own profile"
on public.profiles for select
to authenticated
using ( (select auth.uid()) = id );

create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check ( (select auth.uid()) = id );

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ( (select auth.uid()) = id )
with check ( (select auth.uid()) = id );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
;
