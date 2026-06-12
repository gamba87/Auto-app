begin;

create extension if not exists pgtap with schema extensions;
select plan(2);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
(
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'settings-cashier@example.test',
  'not-used',
  now(),
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000022',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'settings-admin@example.test',
  'not-used',
  now(),
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (id, display_name, role)
values
  ('00000000-0000-0000-0000-000000000021', 'Settings cashier', 'cashier'),
  ('00000000-0000-0000-0000-000000000022', 'Settings admin', 'admin')
on conflict (id) do update
set role = excluded.role;

insert into public.integration_outbox (
  id,
  event_type,
  aggregate_type,
  aggregate_id,
  payload
)
values (
  '00000000-0000-0000-0000-000000000301',
  'sale.voided',
  'sale',
  '00000000-0000-0000-0000-000000000302',
  '{"event":"sale.voided"}'::jsonb
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-0000-0000-000000000021',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'cashier')
  )::text,
  true
);

select is(
  (select count(*)::integer from public.integration_outbox),
  0,
  'cashier profile role cannot select integration outbox rows'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-0000-0000-000000000022',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'cashier')
  )::text,
  true
);

select is(
  (select count(*)::integer from public.integration_outbox),
  1,
  'admin profile role can select integration outbox rows'
);

select finish();

rollback;

