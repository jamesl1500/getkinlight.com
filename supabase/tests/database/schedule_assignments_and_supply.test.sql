begin;

set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  format('public,%I', namespace.nspname),
  true
)
from pg_extension extension
join pg_namespace namespace on namespace.oid = extension.extnamespace
where extension.extname = 'pgtap';

select plan(25);

select has_table('public', 'schedule_task_assignments', 'schedule task assignments table exists');
select has_table('public', 'household_supply_items', 'household supply items table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.schedule_task_assignments'::regclass),
  'schedule task assignments has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.household_supply_items'::regclass),
  'household supply items has RLS enabled'
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000011', 'owner@kinlight.test'),
  ('00000000-0000-4000-8000-000000000012', 'caregiver@kinlight.test'),
  ('00000000-0000-4000-8000-000000000013', 'outsider@kinlight.test'),
  ('00000000-0000-4000-8000-000000000014', 'member@kinlight.test');

insert into public.households (id, name, created_by)
values (
  '10000000-0000-4000-8000-000000000011',
  'Assignments household',
  '00000000-0000-4000-8000-000000000011'
);

insert into public.household_members (household_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000012',
    'caregiver'
  ),
  (
    '10000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000014',
    'member'
  );

insert into public.household_events (id, household_id, title, starts_at, created_by)
values (
  '20000000-0000-4000-8000-000000000011',
  '10000000-0000-4000-8000-000000000011',
  'Physical therapy',
  now(),
  '00000000-0000-4000-8000-000000000011'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000013', true);
select throws_ok(
  $$
    insert into public.schedule_task_assignments (
      household_id, resource_type, resource_id, assigned_to, claimed_at, created_by
    ) values (
      '10000000-0000-4000-8000-000000000011',
      'event',
      '20000000-0000-4000-8000-000000000011',
      '00000000-0000-4000-8000-000000000013',
      now(),
      '00000000-0000-4000-8000-000000000013'
    )
  $$,
  '42501',
  null,
  'a non-member cannot claim a household schedule task'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
select lives_ok(
  $$
    insert into public.schedule_task_assignments (
      household_id, resource_type, resource_id, assigned_to, claimed_at, created_by
    ) values (
      '10000000-0000-4000-8000-000000000011',
      'event',
      '20000000-0000-4000-8000-000000000011',
      '00000000-0000-4000-8000-000000000011',
      now(),
      '00000000-0000-4000-8000-000000000011'
    )
  $$,
  'a household member can claim an unclaimed schedule task for themselves'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000014', true);
select throws_ok(
  $$
    insert into public.schedule_task_assignments (
      household_id, resource_type, resource_id, assigned_to, claimed_at, created_by
    ) values (
      '10000000-0000-4000-8000-000000000011',
      'event',
      '30000000-0000-4000-8000-000000000099',
      '00000000-0000-4000-8000-000000000012',
      now(),
      '00000000-0000-4000-8000-000000000014'
    )
  $$,
  '42501',
  null,
  'a plain member cannot assign a task to someone else'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
select lives_ok(
  $$
    insert into public.schedule_task_assignments (
      household_id, resource_type, resource_id, assigned_to, claimed_at, created_by
    ) values (
      '10000000-0000-4000-8000-000000000011',
      'event',
      '30000000-0000-4000-8000-000000000098',
      '00000000-0000-4000-8000-000000000014',
      now(),
      '00000000-0000-4000-8000-000000000011'
    )
  $$,
  'an owner can directly assign a task to another household member'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000012', true);
select lives_ok(
  $$
    update public.schedule_task_assignments
    set assigned_to = '00000000-0000-4000-8000-000000000012', claimed_at = now()
    where household_id = '10000000-0000-4000-8000-000000000011'
      and resource_type = 'event'
      and resource_id = '20000000-0000-4000-8000-000000000011'
  $$,
  'a caregiver can reassign a task already claimed by someone else'
);
select is(
  (
    select assigned_to
    from public.schedule_task_assignments
    where household_id = '10000000-0000-4000-8000-000000000011'
      and resource_type = 'event'
      and resource_id = '20000000-0000-4000-8000-000000000011'
  ),
  '00000000-0000-4000-8000-000000000012'::uuid,
  'the task is now assigned to the caregiver'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000014', true);
select lives_ok(
  $$
    update public.schedule_task_assignments
    set assigned_to = '00000000-0000-4000-8000-000000000014', claimed_at = now()
    where household_id = '10000000-0000-4000-8000-000000000011'
      and resource_type = 'event'
      and resource_id = '20000000-0000-4000-8000-000000000011'
  $$,
  'attempting to reassign a task assigned to someone else does not raise, but is filtered by RLS'
);
select is(
  (
    select assigned_to
    from public.schedule_task_assignments
    where household_id = '10000000-0000-4000-8000-000000000011'
      and resource_type = 'event'
      and resource_id = '20000000-0000-4000-8000-000000000011'
  ),
  '00000000-0000-4000-8000-000000000012'::uuid,
  'a plain member cannot reassign a task already claimed by someone else'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
select lives_ok(
  $$
    update public.schedule_task_assignments
    set assigned_to = null, claimed_at = null
    where household_id = '10000000-0000-4000-8000-000000000011'
      and resource_type = 'event'
      and resource_id = '20000000-0000-4000-8000-000000000011'
  $$,
  'an owner can unassign a task claimed by someone else'
);
select is(
  (
    select assigned_to
    from public.schedule_task_assignments
    where household_id = '10000000-0000-4000-8000-000000000011'
      and resource_type = 'event'
      and resource_id = '20000000-0000-4000-8000-000000000011'
  ),
  null::uuid,
  'the task is unassigned again'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000012', true);
select lives_ok(
  $$
    update public.schedule_task_assignments
    set assigned_to = '00000000-0000-4000-8000-000000000012', claimed_at = now()
    where household_id = '10000000-0000-4000-8000-000000000011'
      and resource_type = 'event'
      and resource_id = '20000000-0000-4000-8000-000000000011'
  $$,
  'a caregiver can claim a released task for themselves'
);
select is(
  (
    select assigned_to
    from public.schedule_task_assignments
    where household_id = '10000000-0000-4000-8000-000000000011'
      and resource_type = 'event'
      and resource_id = '20000000-0000-4000-8000-000000000011'
  ),
  '00000000-0000-4000-8000-000000000012'::uuid,
  'the task is claimed by the caregiver again'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000014', true);
select lives_ok(
  $$
    update public.schedule_task_assignments
    set assigned_to = null, claimed_at = null
    where household_id = '10000000-0000-4000-8000-000000000011'
      and resource_type = 'event'
      and resource_id = '20000000-0000-4000-8000-000000000011'
  $$,
  'attempting to release someone else''s claim does not raise, but is filtered by RLS'
);
select is(
  (
    select assigned_to
    from public.schedule_task_assignments
    where household_id = '10000000-0000-4000-8000-000000000011'
      and resource_type = 'event'
      and resource_id = '20000000-0000-4000-8000-000000000011'
  ),
  '00000000-0000-4000-8000-000000000012'::uuid,
  'a plain member cannot release someone else''s claim'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000013', true);
select is(
  (
    select count(*)
    from public.schedule_task_assignments
    where household_id = '10000000-0000-4000-8000-000000000011'
  ),
  0::bigint,
  'a non-member cannot read household schedule task assignments'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
select is(
  (
    select count(*)
    from public.schedule_task_assignments
    where household_id = '10000000-0000-4000-8000-000000000011'
  ),
  2::bigint,
  'a household member can read household schedule task assignments'
);

-- Supply list RLS

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000013', true);
select throws_ok(
  $$
    insert into public.household_supply_items (household_id, name, category)
    values ('10000000-0000-4000-8000-000000000011', 'Diapers (size 4)', 'diapers')
  $$,
  '42501',
  null,
  'a non-member cannot add a household supply item'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
select lives_ok(
  $$
    insert into public.household_supply_items (
      id, household_id, name, quantity, category, created_by
    ) values (
      '40000000-0000-4000-8000-000000000011',
      '10000000-0000-4000-8000-000000000011',
      'Diapers (size 4)',
      '1 pack',
      'diapers',
      '00000000-0000-4000-8000-000000000011'
    )
  $$,
  'a household member can add a supply item'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000013', true);
select is(
  (
    select count(*)
    from public.household_supply_items
    where household_id = '10000000-0000-4000-8000-000000000011'
  ),
  0::bigint,
  'a non-member cannot read household supply items'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000012', true);
select lives_ok(
  $$
    update public.household_supply_items
    set is_checked = true, checked_by = '00000000-0000-4000-8000-000000000012', checked_at = now()
    where id = '40000000-0000-4000-8000-000000000011'
  $$,
  'a different household member can check off a shared supply item'
);

select is(
  (
    select is_checked
    from public.household_supply_items
    where id = '40000000-0000-4000-8000-000000000011'
  ),
  true,
  'the supply item is marked checked'
);

select finish();
rollback;
