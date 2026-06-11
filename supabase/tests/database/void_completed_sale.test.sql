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
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'manager@example.test',
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
  '00000000-0000-0000-0000-000000000102',
  'TEST-002',
  'Voidable product',
  2100,
  1000,
  4.000,
  1.000
);

insert into public.sales (
  id,
  sale_number,
  status,
  cashier_id,
  subtotal_cents,
  vat_cents,
  total_cents,
  completed_at
)
values (
  '00000000-0000-0000-0000-000000000202',
  'S-TEST-VOID',
  'completed',
  '00000000-0000-0000-0000-000000000002',
  826,
  174,
  1000,
  now()
);

insert into public.sale_items (
  sale_id,
  product_id,
  quantity,
  unit_price_cents,
  vat_rate_bps,
  subtotal_cents,
  vat_cents,
  total_cents
)
values (
  '00000000-0000-0000-0000-000000000202',
  '00000000-0000-0000-0000-000000000102',
  1.000,
  1000,
  2100,
  826,
  174,
  1000
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-0000-0000-000000000002',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'manager')
  )::text,
  true
);

select public.void_completed_sale(
  '00000000-0000-0000-0000-000000000202',
  'Customer return'
);

select is(
  (select status::text from public.sales where id = '00000000-0000-0000-0000-000000000202'),
  'voided',
  'void_completed_sale marks the sale voided'
);

select is(
  (select stock from public.products where id = '00000000-0000-0000-0000-000000000102'),
  5.000::numeric,
  'void_completed_sale returns stock'
);

select is(
  (select count(*)::integer from public.sale_voids where sale_id = '00000000-0000-0000-0000-000000000202'),
  1,
  'void_completed_sale creates a sale_voids record'
);

select finish();

rollback;
