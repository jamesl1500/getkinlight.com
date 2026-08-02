begin;

create or replace function public.handle_household_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (household_id, user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_household_created() from public, anon, authenticated;

drop trigger if exists on_household_created_add_owner on public.households;
create trigger on_household_created_add_owner
after insert on public.households
for each row execute function public.handle_household_created();

drop policy if exists "household_members_insert_owner_or_self" on public.household_members;
create policy "household_members_insert_owner"
on public.household_members
for insert
to authenticated
with check (
  exists (
    select 1 from public.household_members m
    where m.household_id = household_members.household_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
);

commit;;
