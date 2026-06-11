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
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'manager-adjust@example.test',
  'not-used',
  now(),
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'cashier-cancel@example.test',
  'not-used',
  now(),
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.products (
  id,
  sku,
  name,
  vat_rate_bps,
  sale_price_cents,
  stock,
  min_stock
)
values (
  '00000000-0000-0000-0000-000000000103',
  'TEST-003',
  'Adjustable product',
  2100,
  500,
  2.000,
  1.000
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-0000-0000-000000000003',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'manager')
  )::text,
  true
);

select public.adjust_stock(
  '00000000-0000-0000-0000-000000000103',
  3.000,
  'Opening count correction'
);

select is(
  (select stock from public.products where id = '00000000-0000-0000-0000-000000000103'),
  5.000::numeric,
  'adjust_stock applies manager stock changes'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-0000-0000-000000000004',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'cashier')
  )::text,
  true
);

insert into public.sales (id, cashier_id)
values (
  '00000000-0000-0000-0000-000000000204',
  '00000000-0000-0000-0000-000000000004'
);

select public.cancel_draft_sale('00000000-0000-0000-0000-000000000204');

select is(
  (select status::text from public.sales where id = '00000000-0000-0000-0000-000000000204'),
  'cancelled',
  'cancel_draft_sale cancels own draft sale'
);

select finish();

rollback;
