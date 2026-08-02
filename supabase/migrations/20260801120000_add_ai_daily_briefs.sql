create table if not exists public.ai_daily_briefs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  brief_date date not null,
  content jsonb not null,
  model text not null,
  generated_by uuid not null references auth.users(id) on delete cascade,
  generated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, brief_date)
);

create index if not exists ai_daily_briefs_household_date_idx
on public.ai_daily_briefs (household_id, brief_date desc);

alter table public.ai_daily_briefs enable row level security;

revoke all on table public.ai_daily_briefs from public, anon, authenticated;
grant select, insert, update on table public.ai_daily_briefs to authenticated;
grant select, insert, update, delete on table public.ai_daily_briefs to service_role;

drop policy if exists "ai_daily_briefs_select_members" on public.ai_daily_briefs;
create policy "ai_daily_briefs_select_members"
on public.ai_daily_briefs
for select
to authenticated
using ((select private.is_household_member(household_id)));

drop policy if exists "ai_daily_briefs_insert_members" on public.ai_daily_briefs;
create policy "ai_daily_briefs_insert_members"
on public.ai_daily_briefs
for insert
to authenticated
with check (
  (select private.is_household_member(household_id))
  and generated_by = (select auth.uid())
);

drop policy if exists "ai_daily_briefs_update_members" on public.ai_daily_briefs;
create policy "ai_daily_briefs_update_members"
on public.ai_daily_briefs
for update
to authenticated
using ((select private.is_household_member(household_id)))
with check (
  (select private.is_household_member(household_id))
  and generated_by = (select auth.uid())
);
