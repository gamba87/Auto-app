begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

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
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'cashier@example.test',
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
  '00000000-0000-0000-0000-000000000101',
  'TEST-001',
  'Test product',
  2100,
  1210,
  5.000,
  1.000
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-0000-0000-000000000001',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'cashier')
  )::text,
  true
);

insert into public.sales (id, cashier_id)
values (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000001'
);

insert into public.sale_items (sale_id, product_id, quantity)
values (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  2.000
);

select public.complete_sale('00000000-0000-0000-0000-000000000201');

select is(
  (select status::text from public.sales where id = '00000000-0000-0000-0000-000000000201'),
  'completed',
  'complete_sale marks the sale completed'
);

select is(
  (select stock from public.products where id = '00000000-0000-0000-0000-000000000101'),
  3.000::numeric,
  'complete_sale decrements product stock'
);

select is(
  (select total_cents from public.sales where id = '00000000-0000-0000-0000-000000000201'),
  2420,
  'complete_sale calculates gross total in cents'
);

select is(
  (select vat_cents from public.sales where id = '00000000-0000-0000-0000-000000000201'),
  420,
  'complete_sale calculates VAT from VAT-inclusive gross'
);

select is(
  (select count(*)::integer from public.integration_outbox where aggregate_id = '00000000-0000-0000-0000-000000000201'),
  1,
  'complete_sale creates a fiscal outbox event'
);

select finish();

rollback;
