begin;

with warehouse as (
  insert into public.warehouses (
    id,
    code,
    name,
    address,
    active
  )
  values (
    '00000000-0000-4000-8000-000000000001',
    'MAIN',
    'Pagrindinis sandėlis',
    'Demo warehouse',
    true
  )
  on conflict (code) do update
  set
    name = excluded.name,
    address = excluded.address,
    active = excluded.active
  returning id
),
products_seed as (
  insert into public.products (
    id,
    sku,
    name,
    description,
    unit,
    vat_rate_bps,
    sale_price_cents,
    stock,
    min_stock,
    active
  )
  values
    (
      '10000000-0000-4000-8000-000000000001',
      'BATH-SHOWER-001',
      'AquaFlow shower head',
      'Chrome finish bathroom shower head for development testing.',
      'vnt.',
      2100,
      2499,
      24.000,
      5.000,
      true
    ),
    (
      '10000000-0000-4000-8000-000000000002',
      'BATH-MIXER-002',
      'Nordic basin mixer',
      'Single lever basin mixer with ceramic cartridge.',
      'vnt.',
      2100,
      8999,
      12.000,
      3.000,
      true
    ),
    (
      '10000000-0000-4000-8000-000000000003',
      'BATH-SINK-003',
      'White ceramic wash basin',
      'Countertop ceramic basin for bathroom displays.',
      'vnt.',
      2100,
      12900,
      8.000,
      2.000,
      true
    ),
    (
      '10000000-0000-4000-8000-000000000004',
      'BATH-SEAT-004',
      'Soft-close toilet seat',
      'Universal white soft-close toilet seat.',
      'vnt.',
      2100,
      3299,
      18.000,
      4.000,
      true
    ),
    (
      '10000000-0000-4000-8000-000000000005',
      'BATH-RAIL-005',
      'Matte towel rail',
      'Wall-mounted matte black towel rail.',
      'vnt.',
      2100,
      4599,
      15.000,
      4.000,
      true
    )
  on conflict (sku) do update
  set
    name = excluded.name,
    description = excluded.description,
    unit = excluded.unit,
    vat_rate_bps = excluded.vat_rate_bps,
    sale_price_cents = excluded.sale_price_cents,
    stock = excluded.stock,
    min_stock = excluded.min_stock,
    active = excluded.active
  returning id, sku, stock
)
insert into public.stock_movements (
  id,
  product_id,
  warehouse_id,
  quantity_delta,
  reason,
  note
)
select
  case products_seed.sku
    when 'BATH-SHOWER-001' then '20000000-0000-4000-8000-000000000001'::uuid
    when 'BATH-MIXER-002' then '20000000-0000-4000-8000-000000000002'::uuid
    when 'BATH-SINK-003' then '20000000-0000-4000-8000-000000000003'::uuid
    when 'BATH-SEAT-004' then '20000000-0000-4000-8000-000000000004'::uuid
    when 'BATH-RAIL-005' then '20000000-0000-4000-8000-000000000005'::uuid
  end,
  products_seed.id,
  warehouse.id,
  products_seed.stock,
  'import',
  'Development seed opening balance'
from products_seed
cross join warehouse
on conflict (id) do update
set
  product_id = excluded.product_id,
  warehouse_id = excluded.warehouse_id,
  quantity_delta = excluded.quantity_delta,
  reason = excluded.reason,
  note = excluded.note;

insert into public.customers (
  id,
  name,
  email,
  phone
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    'UAB Demo Vonios',
    'pirkimai@demo-vonios.example',
    '+37060000001'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'MB Testinis Klientas',
    'info@testinis-klientas.example',
    '+37060000002'
  )
on conflict (id) do update
set
  name = excluded.name,
  email = excluded.email,
  phone = excluded.phone;

commit;
