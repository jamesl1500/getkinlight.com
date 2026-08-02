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

select plan(33);

select has_table('public', 'care_recipients', 'care recipients table exists');
select has_table('public', 'household_events', 'household events table exists');
select has_table('public', 'appointments', 'appointments table exists');
select has_table('public', 'medication_reminders', 'medication reminders table exists');
select has_table('public', 'eating_reminders', 'eating reminders table exists');
select has_table('public', 'household_check_ins', 'household check-ins table exists');
select has_table('public', 'household_notes', 'household notes table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.care_recipients'::regclass),
  'care recipients has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.household_events'::regclass),
  'household events has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.appointments'::regclass),
  'appointments has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.medication_reminders'::regclass),
  'medication reminders has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.eating_reminders'::regclass),
  'eating reminders has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.household_check_ins'::regclass),
  'household check-ins has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.household_notes'::regclass),
  'household notes has RLS enabled'
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000001', 'owner@kinlight.test'),
  ('00000000-0000-4000-8000-000000000002', 'outsider@kinlight.test'),
  ('00000000-0000-4000-8000-000000000003', 'invitee@kinlight.test');

insert into public.households (id, name, created_by)
values (
  '10000000-0000-4000-8000-000000000001',
  'Test household',
  '00000000-0000-4000-8000-000000000001'
);

insert into public.household_invitations (
  household_id,
  invited_email,
  invite_token,
  invited_by,
  expires_at,
  role
) values (
  '10000000-0000-4000-8000-000000000001',
  'invitee@kinlight.test',
  'valid-family-invitation',
  '00000000-0000-4000-8000-000000000001',
  now() + interval '7 days',
  'caregiver'
);

select is(
  has_function_privilege('anon', 'public.get_household_member_directory(uuid)', 'execute'),
  false,
  'anonymous users cannot execute the household member directory'
);

select is(
  has_function_privilege('anon', 'public.accept_household_invitation(text)', 'execute'),
  false,
  'anonymous users cannot accept household invitations'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.get_household_member_directory('10000000-0000-4000-8000-000000000001')),
  1::bigint,
  'a household member can read its member directory'
);

select lives_ok(
  $$
    insert into public.care_recipients (
      id,
      household_id,
      first_name,
      last_name
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'Jamie',
      'Kinlight'
    )
  $$,
  'a household owner can add a care recipient'
);

select lives_ok(
  $$
    insert into public.household_notes (
      household_id,
      care_recipient_id,
      body
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'A private test note.'
    )
  $$,
  'a household owner can add a recipient note'
);

select lives_ok(
  $$
    insert into public.household_events (household_id, title, starts_at)
    values ('10000000-0000-4000-8000-000000000001', 'Household event', now())
  $$,
  'a household event does not require a care recipient'
);

select lives_ok(
  $$
    insert into public.appointments (household_id, title, starts_at)
    values ('10000000-0000-4000-8000-000000000001', 'Household appointment', now())
  $$,
  'an appointment does not require a care recipient'
);

select lives_ok(
  $$
    insert into public.medication_reminders (
      household_id,
      medication_name,
      reminder_times
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'Household medication',
      array['09:00'::time]
    )
  $$,
  'a medication reminder does not require a care recipient'
);

select lives_ok(
  $$
    insert into public.eating_reminders (
      household_id,
      title,
      reminder_times
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'Household meal',
      array['12:00'::time]
    )
  $$,
  'an eating reminder does not require a care recipient'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

select is(
  (select count(*) from public.get_household_member_directory('10000000-0000-4000-8000-000000000001')),
  0::bigint,
  'a non-member cannot read the household member directory'
);

select throws_ok(
  $$ select public.accept_household_invitation('valid-family-invitation') $$,
  '42501',
  'This invitation is invalid, expired, or belongs to another account.',
  'an invitation cannot be accepted by a different email address'
);

select is(
  (
    select count(*)
    from public.care_recipients
    where household_id = '10000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'a non-member cannot read household care recipients'
);

select throws_ok(
  $$
    insert into public.care_recipients (
      household_id,
      first_name,
      last_name
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'Blocked',
      'Person'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "care_recipients"',
  'a non-member cannot add a household care recipient'
);

select lives_ok(
  $$
    insert into public.households (id, name, created_by)
    values (
      '10000000-0000-4000-8000-000000000002',
      'New household',
      '00000000-0000-4000-8000-000000000002'
    )
  $$,
  'an authenticated user without a household can create one'
);

select is(
  (
    select role
    from public.household_members
    where household_id = '10000000-0000-4000-8000-000000000002'
      and user_id = '00000000-0000-4000-8000-000000000002'
  ),
  'owner',
  'a household creator is automatically added as its owner'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);

select is(
  public.accept_household_invitation('valid-family-invitation'),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'the invited account can accept a valid household invitation'
);

select is(
  (
    select role
    from public.household_members
    where household_id = '10000000-0000-4000-8000-000000000001'
      and user_id = '00000000-0000-4000-8000-000000000003'
  ),
  'caregiver',
  'an accepted invitation applies its assigned household role'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

select throws_ok(
  $$
    update public.household_members
    set role = 'member'
    where household_id = '10000000-0000-4000-8000-000000000001'
      and user_id = '00000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'A household must have at least one owner.',
  'the final household owner cannot be demoted'
);

select throws_ok(
  $$
    delete from public.household_members
    where household_id = '10000000-0000-4000-8000-000000000001'
      and user_id = '00000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'A household must have at least one owner.',
  'the final household owner cannot be removed'
);

select * from finish();

rollback;