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

select plan(8);

insert into auth.users (id, email)
values
  ('90000000-0000-4000-8000-000000000001', 'solo-delete@kinlight.test'),
  ('90000000-0000-4000-8000-000000000002', 'leaving-owner@kinlight.test'),
  ('90000000-0000-4000-8000-000000000003', 'remaining-owner@kinlight.test'),
  ('90000000-0000-4000-8000-000000000004', 'blocked-owner@kinlight.test'),
  ('90000000-0000-4000-8000-000000000005', 'household-member@kinlight.test');

insert into public.households (id, name, created_by)
values
  (
    '91000000-0000-4000-8000-000000000001',
    'Solo household',
    '90000000-0000-4000-8000-000000000001'
  ),
  (
    '91000000-0000-4000-8000-000000000002',
    'Co-owned household',
    '90000000-0000-4000-8000-000000000002'
  ),
  (
    '91000000-0000-4000-8000-000000000003',
    'Blocked household',
    '90000000-0000-4000-8000-000000000004'
  );

insert into public.household_members (household_id, user_id, role)
values
  (
    '91000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000003',
    'owner'
  ),
  (
    '91000000-0000-4000-8000-000000000003',
    '90000000-0000-4000-8000-000000000005',
    'member'
  );

insert into public.care_recipients (
  id,
  household_id,
  first_name,
  last_name,
  created_by
) values (
  '92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  'Shared',
  'Recipient',
  '90000000-0000-4000-8000-000000000002'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$ select public.prepare_current_account_deletion() $$,
  'a sole owner can prepare account deletion'
);
select is(
  (select count(*) from public.households where id = '91000000-0000-4000-8000-000000000001'),
  0::bigint,
  'a one-person household is deleted'
);

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$ select public.prepare_current_account_deletion() $$,
  'an owner can leave a household with another owner'
);

set local role postgres;
select is(
  (select count(*) from public.households where id = '91000000-0000-4000-8000-000000000002'),
  1::bigint,
  'the co-owned household is preserved'
);
select is(
  (
    select count(*)
    from public.household_members
    where household_id = '91000000-0000-4000-8000-000000000002'
      and user_id = '90000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'the departing owner membership is removed'
);
select is(
  (select created_by from public.households where id = '91000000-0000-4000-8000-000000000002'),
  '90000000-0000-4000-8000-000000000003'::uuid,
  'household authorship is reassigned to the remaining owner'
);
select is(
  (select created_by from public.care_recipients where id = '92000000-0000-4000-8000-000000000001'),
  '90000000-0000-4000-8000-000000000003'::uuid,
  'care recipient authorship is reassigned to the remaining owner'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$ select public.prepare_current_account_deletion() $$,
  '23514',
  'Transfer ownership of every shared household before deleting your account.',
  'the final owner of a shared household cannot delete their account'
);

select * from finish();
rollback;