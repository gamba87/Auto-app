create extension if not exists pgcrypto;

create schema if not exists app_private;
revoke all on schema app_private from anon, authenticated;

create type public.app_role as enum ('cashier', 'manager', 'admin');
create type public.sale_status as enum ('draft', 'completed', 'cancelled', 'voided');
create type public.stock_movement_reason as enum ('manual_adjustment', 'sale', 'void', 'import');
create type public.outbox_status as enum ('pending', 'processing', 'completed', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role public.app_role not null default 'cashier',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_not_blank check (length(trim(name)) > 0)
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouses_code_not_blank check (length(trim(code)) > 0),
  constraint warehouses_name_not_blank check (length(trim(name)) > 0)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text,
  unit text not null default 'vnt.',
  vat_rate_bps integer not null default 2100,
  sale_price_cents integer not null,
  stock numeric(12,3) not null default 0,
  min_stock numeric(12,3) not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_sku_not_blank check (length(trim(sku)) > 0),
  constraint products_name_not_blank check (length(trim(name)) > 0),
  constraint products_unit_allowed check (unit in ('vnt.', 'kg', 'm')),
  constraint products_vat_rate_bps_valid check (vat_rate_bps between 0 and 10000),
  constraint products_sale_price_cents_valid check (sale_price_cents >= 0),
  constraint products_stock_valid check (stock >= 0),
  constraint products_min_stock_valid check (min_stock >= 0)
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text unique,
  status public.sale_status not null default 'draft',
  customer_id uuid references public.customers(id),
  cashier_id uuid not null references auth.users(id),
  subtotal_cents integer not null default 0,
  vat_cents integer not null default 0,
  total_cents integer not null default 0,
  fiscal_status text not null default 'not_sent',
  fiscal_receipt_id text,
  completed_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_amounts_valid check (
    subtotal_cents >= 0 and vat_cents >= 0 and total_cents >= 0
  ),
  constraint sales_fiscal_status_valid check (
    fiscal_status in ('not_sent', 'pending', 'sent', 'failed', 'not_connected')
  )
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(12,3) not null,
  unit_price_cents integer not null default 0,
  vat_rate_bps integer not null default 0,
  subtotal_cents integer not null default 0,
  vat_cents integer not null default 0,
  total_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sale_items_quantity_valid check (quantity > 0),
  constraint sale_items_amounts_valid check (
    unit_price_cents >= 0 and subtotal_cents >= 0 and vat_cents >= 0 and total_cents >= 0
  )
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  warehouse_id uuid references public.warehouses(id),
  sale_id uuid references public.sales(id),
  quantity_delta numeric(12,3) not null,
  reason public.stock_movement_reason not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint stock_movements_non_zero check (quantity_delta <> 0)
);

create table public.sale_voids (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null unique references public.sales(id) on delete cascade,
  reason text not null,
  voided_by uuid not null references auth.users(id),
  fiscal_status text not null default 'pending',
  fiscal_receipt_id text,
  created_at timestamptz not null default now(),
  constraint sale_voids_reason_not_blank check (length(trim(reason)) >= 5),
  constraint sale_voids_fiscal_status_valid check (
    fiscal_status in ('not_sent', 'pending', 'sent', 'failed', 'not_connected')
  )
);

create table public.integration_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  status public.outbox_status not null default 'pending',
  payload jsonb not null,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_outbox_attempts_valid check (attempts >= 0),
  constraint integration_outbox_event_not_blank check (length(trim(event_type)) > 0)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index products_active_idx on public.products(active);
create index products_sku_idx on public.products(sku);
create index warehouses_active_idx on public.warehouses(active);
create index sales_cashier_status_idx on public.sales(cashier_id, status);
create index sale_items_sale_id_idx on public.sale_items(sale_id);
create index stock_movements_product_created_idx on public.stock_movements(product_id, created_at desc);
create index stock_movements_warehouse_created_idx on public.stock_movements(warehouse_id, created_at desc);
create index sale_voids_sale_id_idx on public.sale_voids(sale_id);
create index integration_outbox_pending_idx
  on public.integration_outbox(available_at, created_at)
  where status = 'pending';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger warehouses_set_updated_at
before update on public.warehouses
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger sales_set_updated_at
before update on public.sales
for each row execute function public.set_updated_at();

create trigger sale_items_set_updated_at
before update on public.sale_items
for each row execute function public.set_updated_at();

create trigger integration_outbox_set_updated_at
before update on public.integration_outbox
for each row execute function public.set_updated_at();

create or replace function app_private.current_app_role()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'cashier');
$$;

create or replace function app_private.has_any_role(p_roles text[])
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.current_app_role() = any(p_roles);
$$;

create or replace function app_private.assert_authenticated()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
end;
$$;

create or replace function app_private.assert_role(p_roles text[])
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  perform app_private.assert_authenticated();

  if not app_private.has_any_role(p_roles) then
    raise exception 'Insufficient permissions' using errcode = '42501';
  end if;
end;
$$;

grant usage on schema app_private to authenticated;
grant execute on all functions in schema app_private to authenticated;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.warehouses enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.sale_voids enable row level security;
alter table public.integration_outbox enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles_select_own_or_admin"
on public.profiles for select to authenticated
using (id = auth.uid() or app_private.has_any_role(array['admin']));

create policy "profiles_update_own_name"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check (id = auth.uid());

create policy "customers_select_authenticated"
on public.customers for select to authenticated
using (true);

create policy "customers_insert_authenticated"
on public.customers for insert to authenticated
with check (created_by = auth.uid());

create policy "customers_update_manager"
on public.customers for update to authenticated
using (app_private.has_any_role(array['manager', 'admin']))
with check (app_private.has_any_role(array['manager', 'admin']));

create policy "warehouses_select_authenticated"
on public.warehouses for select to authenticated
using (true);

create policy "warehouses_insert_manager"
on public.warehouses for insert to authenticated
with check (app_private.has_any_role(array['manager', 'admin']));

create policy "warehouses_update_manager"
on public.warehouses for update to authenticated
using (app_private.has_any_role(array['manager', 'admin']))
with check (app_private.has_any_role(array['manager', 'admin']));

create policy "products_select_authenticated"
on public.products for select to authenticated
using (true);

create policy "products_insert_manager"
on public.products for insert to authenticated
with check (app_private.has_any_role(array['manager', 'admin']));

create policy "products_update_manager"
on public.products for update to authenticated
using (app_private.has_any_role(array['manager', 'admin']))
with check (app_private.has_any_role(array['manager', 'admin']));

create policy "sales_select_owner_or_manager"
on public.sales for select to authenticated
using (cashier_id = auth.uid() or app_private.has_any_role(array['manager', 'admin']));

create policy "sales_insert_own_draft"
on public.sales for insert to authenticated
with check (cashier_id = auth.uid() and status = 'draft');

create policy "sale_items_select_owner_or_manager"
on public.sale_items for select to authenticated
using (
  exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and (s.cashier_id = auth.uid() or app_private.has_any_role(array['manager', 'admin']))
  )
);

create policy "sale_items_insert_own_draft"
on public.sale_items for insert to authenticated
with check (
  exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and s.status = 'draft'
      and s.cashier_id = auth.uid()
  )
);

create policy "sale_items_update_own_draft"
on public.sale_items for update to authenticated
using (
  exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and s.status = 'draft'
      and s.cashier_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and s.status = 'draft'
      and s.cashier_id = auth.uid()
  )
);

create policy "sale_items_delete_own_draft"
on public.sale_items for delete to authenticated
using (
  exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and s.status = 'draft'
      and s.cashier_id = auth.uid()
  )
);

create policy "stock_movements_select_manager"
on public.stock_movements for select to authenticated
using (app_private.has_any_role(array['manager', 'admin']));

create policy "sale_voids_select_manager"
on public.sale_voids for select to authenticated
using (app_private.has_any_role(array['manager', 'admin']));

create policy "integration_outbox_select_admin"
on public.integration_outbox for select to authenticated
using (app_private.has_any_role(array['admin']));

create policy "audit_events_select_admin"
on public.audit_events for select to authenticated
using (app_private.has_any_role(array['admin']));

grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, display_name) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert on public.warehouses to authenticated;
grant update (code, name, address, active) on public.warehouses to authenticated;
grant select, insert on public.products to authenticated;
grant update (
  sku,
  name,
  description,
  unit,
  vat_rate_bps,
  sale_price_cents,
  min_stock,
  active
) on public.products to authenticated;
grant select, insert on public.sales to authenticated;
grant select, insert, delete on public.sale_items to authenticated;
grant update (quantity) on public.sale_items to authenticated;
grant select on public.stock_movements to authenticated;
grant select on public.sale_voids to authenticated;
grant select on public.integration_outbox to authenticated;
grant select on public.audit_events to authenticated;

create or replace function app_private.adjust_stock_impl(
  p_product_id uuid,
  p_qty numeric,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_product public.products%rowtype;
  v_next_stock numeric(12,3);
begin
  perform app_private.assert_role(array['manager', 'admin']);

  if p_qty = 0 then
    raise exception 'Quantity change cannot be zero' using errcode = '22023';
  end if;

  select *
  into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  v_next_stock := v_product.stock + p_qty;

  if v_next_stock < 0 then
    raise exception 'Stock cannot be negative' using errcode = '22023';
  end if;

  update public.products
  set stock = v_next_stock
  where id = p_product_id;

  insert into public.stock_movements (
    product_id,
    quantity_delta,
    reason,
    note,
    created_by
  )
  values (
    p_product_id,
    p_qty,
    'manual_adjustment',
    p_note,
    auth.uid()
  );

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'stock.adjusted',
    'product',
    p_product_id,
    jsonb_build_object('quantityDelta', p_qty, 'note', p_note)
  );
end;
$$;

create or replace function public.adjust_stock(
  p_product_id uuid,
  p_qty numeric,
  p_note text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.adjust_stock_impl(p_product_id, p_qty, p_note);
$$;

create or replace function app_private.complete_sale_impl(p_sale_id uuid)
returns table (
  sale_id uuid,
  sale_number text,
  total_cents integer,
  fiscal_status text
)
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_sale public.sales%rowtype;
  v_line record;
  v_user_id uuid := auth.uid();
  v_sale_number text;
  v_gross_cents integer;
  v_vat_cents integer;
  v_net_cents integer;
  v_subtotal_cents integer := 0;
  v_total_vat_cents integer := 0;
  v_total_cents integer := 0;
  v_item_count integer := 0;
begin
  perform app_private.assert_authenticated();

  select *
  into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;

  if v_sale.status <> 'draft' then
    raise exception 'Only draft sales can be completed' using errcode = '22023';
  end if;

  if v_sale.cashier_id <> v_user_id
     and not app_private.has_any_role(array['manager', 'admin']) then
    raise exception 'Cannot complete another cashier sale' using errcode = '42501';
  end if;

  v_sale_number := coalesce(
    v_sale.sale_number,
    'S-' || to_char(now() at time zone 'Europe/Vilnius', 'YYYYMMDD') || '-' ||
    upper(substring(replace(p_sale_id::text, '-', '') from 1 for 8))
  );

  for v_line in
    select
      si.id as sale_item_id,
      si.product_id,
      si.quantity,
      p.name as product_name,
      p.stock,
      p.sale_price_cents,
      p.vat_rate_bps
    from public.sale_items si
    join public.products p on p.id = si.product_id
    where si.sale_id = p_sale_id
    for update of si, p
  loop
    v_item_count := v_item_count + 1;

    if v_line.quantity <= 0 then
      raise exception 'Sale item quantity must be positive' using errcode = '22023';
    end if;

    if v_line.stock < v_line.quantity then
      raise exception 'Insufficient stock for %', v_line.product_name using errcode = '22023';
    end if;

    v_gross_cents := round(v_line.sale_price_cents * v_line.quantity)::integer;
    v_vat_cents := round(
      (v_gross_cents::numeric * v_line.vat_rate_bps::numeric) /
      (10000 + v_line.vat_rate_bps)
    )::integer;
    v_net_cents := v_gross_cents - v_vat_cents;

    update public.sale_items
    set
      unit_price_cents = v_line.sale_price_cents,
      vat_rate_bps = v_line.vat_rate_bps,
      subtotal_cents = v_net_cents,
      vat_cents = v_vat_cents,
      total_cents = v_gross_cents
    where id = v_line.sale_item_id;

    update public.products
    set stock = stock - v_line.quantity
    where id = v_line.product_id;

    insert into public.stock_movements (
      product_id,
      sale_id,
      quantity_delta,
      reason,
      note,
      created_by
    )
    values (
      v_line.product_id,
      p_sale_id,
      -v_line.quantity,
      'sale',
      v_sale_number,
      v_user_id
    );

    v_subtotal_cents := v_subtotal_cents + v_net_cents;
    v_total_vat_cents := v_total_vat_cents + v_vat_cents;
    v_total_cents := v_total_cents + v_gross_cents;
  end loop;

  if v_item_count = 0 then
    raise exception 'Sale must contain at least one item' using errcode = '22023';
  end if;

  update public.sales
  set
    sale_number = v_sale_number,
    status = 'completed',
    subtotal_cents = v_subtotal_cents,
    vat_cents = v_total_vat_cents,
    total_cents = v_total_cents,
    fiscal_status = 'pending',
    completed_at = now()
  where id = p_sale_id;

  insert into public.integration_outbox (
    event_type,
    aggregate_type,
    aggregate_id,
    payload
  )
  values (
    'sale.completed',
    'sale',
    p_sale_id,
    jsonb_build_object(
      'event', 'sale.completed',
      'saleId', p_sale_id,
      'saleNumber', v_sale_number,
      'totalCents', v_total_cents
    )
  );

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_user_id,
    'sale.completed',
    'sale',
    p_sale_id,
    jsonb_build_object('saleNumber', v_sale_number, 'totalCents', v_total_cents)
  );

  return query
  select p_sale_id, v_sale_number, v_total_cents, 'pending'::text;
end;
$$;

create or replace function public.complete_sale(p_sale_id uuid)
returns table (
  sale_id uuid,
  sale_number text,
  total_cents integer,
  fiscal_status text
)
language sql
security invoker
set search_path = ''
as $$
  select * from app_private.complete_sale_impl(p_sale_id);
$$;

create or replace function app_private.cancel_draft_sale_impl(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_sale public.sales%rowtype;
begin
  perform app_private.assert_authenticated();

  select *
  into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;

  if v_sale.status <> 'draft' then
    raise exception 'Only draft sales can be cancelled' using errcode = '22023';
  end if;

  if v_sale.cashier_id <> auth.uid()
     and not app_private.has_any_role(array['manager', 'admin']) then
    raise exception 'Cannot cancel another cashier sale' using errcode = '42501';
  end if;

  update public.sales
  set status = 'cancelled'
  where id = p_sale_id;

  insert into public.audit_events (actor_id, action, entity_type, entity_id)
  values (auth.uid(), 'sale.cancelled', 'sale', p_sale_id);
end;
$$;

create or replace function public.cancel_draft_sale(p_sale_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.cancel_draft_sale_impl(p_sale_id);
$$;

create or replace function app_private.void_completed_sale_impl(
  p_sale_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_sale public.sales%rowtype;
  v_line record;
begin
  perform app_private.assert_role(array['manager', 'admin']);

  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Void reason must be at least 5 characters' using errcode = '22023';
  end if;

  select *
  into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;

  if v_sale.status <> 'completed' then
    raise exception 'Only completed sales can be voided' using errcode = '22023';
  end if;

  for v_line in
    select si.product_id, si.quantity
    from public.sale_items si
    join public.products p on p.id = si.product_id
    where si.sale_id = p_sale_id
    for update of p
  loop
    update public.products
    set stock = stock + v_line.quantity
    where id = v_line.product_id;

    insert into public.stock_movements (
      product_id,
      sale_id,
      quantity_delta,
      reason,
      note,
      created_by
    )
    values (
      v_line.product_id,
      p_sale_id,
      v_line.quantity,
      'void',
      p_reason,
      auth.uid()
    );
  end loop;

  update public.sales
  set
    status = 'voided',
    voided_at = now(),
    void_reason = p_reason,
    fiscal_status = 'pending'
  where id = p_sale_id;

  insert into public.sale_voids (
    sale_id,
    reason,
    voided_by,
    fiscal_status
  )
  values (
    p_sale_id,
    p_reason,
    auth.uid(),
    'pending'
  );

  insert into public.integration_outbox (
    event_type,
    aggregate_type,
    aggregate_id,
    payload
  )
  values (
    'sale.voided',
    'sale',
    p_sale_id,
    jsonb_build_object(
      'event', 'sale.voided',
      'saleId', p_sale_id,
      'saleNumber', v_sale.sale_number,
      'totalCents', v_sale.total_cents
    )
  );

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'sale.voided',
    'sale',
    p_sale_id,
    jsonb_build_object('reason', p_reason)
  );
end;
$$;

create or replace function public.void_completed_sale(
  p_sale_id uuid,
  p_reason text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.void_completed_sale_impl(p_sale_id, p_reason);
$$;

grant execute on function public.adjust_stock(uuid, numeric, text) to authenticated;
grant execute on function public.complete_sale(uuid) to authenticated;
grant execute on function public.cancel_draft_sale(uuid) to authenticated;
grant execute on function public.void_completed_sale(uuid, text) to authenticated;

grant execute on all functions in schema app_private to authenticated;
