begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

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
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'void-roundtrip-manager@example.test',
  'not-used',
  now(),
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'void-roundtrip-admin@example.test',
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
  '00000000-0000-0000-0000-000000000112',
  'TEST-VOID-ROUNDTRIP',
  'Roundtrip void product',
  2100,
  1000,
  10.000,
  1.000
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-0000-0000-000000000012',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'manager')
  )::text,
  true
);

insert into public.sales (
  id,
  cashier_id
)
values (
  '00000000-0000-0000-0000-000000000212',
  '00000000-0000-0000-0000-000000000012'
);

insert into public.sale_items (
  sale_id,
  product_id,
  quantity
)
values (
  '00000000-0000-0000-0000-000000000212',
  '00000000-0000-0000-0000-000000000112',
  2.000
);

select public.complete_sale('00000000-0000-0000-0000-000000000212');

select is(
  (select stock from public.products where id = '00000000-0000-0000-0000-000000000112'),
  8.000::numeric,
  'complete_sale decrements stock through the sale movement'
);

select is(
  (
    select count(*)::integer
    from public.stock_movements
    where sale_id = '00000000-0000-0000-0000-000000000212'
      and reason = 'sale'
  ),
  1,
  'complete_sale creates exactly one sale stock movement'
);

select is(
  (
    select quantity_delta
    from public.stock_movements
    where sale_id = '00000000-0000-0000-0000-000000000212'
      and reason = 'sale'
  ),
  -2.000::numeric,
  'sale movement records the original negative quantity'
);

select public.void_completed_sale(
  '00000000-0000-0000-0000-000000000212',
  'Customer return'
);

select is(
  (select status::text from public.sales where id = '00000000-0000-0000-0000-000000000212'),
  'voided',
  'void_completed_sale marks the sale voided'
);

select is(
  (select stock from public.products where id = '00000000-0000-0000-0000-000000000112'),
  10.000::numeric,
  'void_completed_sale restores stock through the void movement'
);

select is(
  (
    select count(*)::integer
    from public.stock_movements
    where sale_id = '00000000-0000-0000-0000-000000000212'
      and reason = 'sale'
      and quantity_delta = -2.000
  ),
  1,
  'void keeps the original sale movement unchanged'
);

select is(
  (
    select count(*)::integer
    from public.stock_movements
    where sale_id = '00000000-0000-0000-0000-000000000212'
      and reason = 'void'
      and quantity_delta = 2.000
  ),
  1,
  'void creates one positive reversal movement'
);

select is(
  (
    select count(*)::integer
    from public.stock_movements
    where sale_id = '00000000-0000-0000-0000-000000000212'
  ),
  2,
  'void leaves a two-row movement ledger'
);

select is(
  (
    select count(*)::integer
    from public.sale_items
    where sale_id = '00000000-0000-0000-0000-000000000212'
  ),
  1,
  'void does not delete sale items'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-0000-0000-000000000013',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin')
  )::text,
  true
);

select is(
  (
    select count(*)::integer
    from public.integration_outbox
    where aggregate_id = '00000000-0000-0000-0000-000000000212'
      and event_type = 'sale.voided'
  ),
  1,
  'void creates one lower-case sale.voided fiscal outbox event'
);

select finish();

rollback;
