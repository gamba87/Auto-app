begin;

create extension if not exists pgtap with schema extensions;
select plan(3);

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
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'stock-cashier@example.test',
  'not-used',
  now(),
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000042',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'stock-manager@example.test',
  'not-used',
  now(),
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (id, display_name, role)
values
  ('00000000-0000-0000-0000-000000000041', 'Stock cashier', 'cashier'),
  ('00000000-0000-0000-0000-000000000042', 'Stock manager', 'manager')
on conflict (id) do update
set role = excluded.role;

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
  '00000000-0000-0000-0000-000000000141',
  'STOCK-ACCESS-001',
  'Stock access product',
  2100,
  1000,
  5.000,
  1.000
);

insert into public.stock_movements (
  id,
  product_id,
  quantity_delta,
  reason,
  note,
  created_by
)
values (
  '00000000-0000-0000-0000-000000000241',
  '00000000-0000-0000-0000-000000000141',
  1.000,
  'import',
  'Stock route RLS test',
  '00000000-0000-0000-0000-000000000042'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-0000-0000-000000000041',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'cashier')
  )::text,
  true
);

select is(
  (select count(*)::integer from public.products where id = '00000000-0000-0000-0000-000000000141'),
  1,
  'cashier profile role can select product stock levels'
);

select is(
  (select count(*)::integer from public.stock_movements where product_id = '00000000-0000-0000-0000-000000000141'),
  0,
  'cashier profile role cannot select stock movement rows'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-0000-0000-000000000042',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'cashier')
  )::text,
  true
);

select is(
  (select count(*)::integer from public.stock_movements where product_id = '00000000-0000-0000-0000-000000000141'),
  1,
  'manager profile role can select stock movement rows'
);

select finish();

rollback;

