create or replace function app_private.apply_stock_movement_to_product()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_next_stock numeric(12,3);
begin
  if tg_op = 'INSERT' then
    update public.products
    set stock = stock + new.quantity_delta
    where id = new.product_id
    returning stock into v_next_stock;

    if not found then
      raise exception 'Product not found' using errcode = 'P0002';
    end if;

    if v_next_stock < 0 then
      raise exception 'Stock cannot be negative' using errcode = '22023';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.product_id = new.product_id
       and old.quantity_delta = new.quantity_delta then
      return new;
    end if;

    if old.product_id = new.product_id then
      update public.products
      set stock = stock - old.quantity_delta + new.quantity_delta
      where id = new.product_id
      returning stock into v_next_stock;

      if not found then
        raise exception 'Product not found' using errcode = 'P0002';
      end if;

      if v_next_stock < 0 then
        raise exception 'Stock cannot be negative' using errcode = '22023';
      end if;

      return new;
    end if;

    update public.products
    set stock = stock - old.quantity_delta
    where id = old.product_id
    returning stock into v_next_stock;

    if not found then
      raise exception 'Product not found' using errcode = 'P0002';
    end if;

    if v_next_stock < 0 then
      raise exception 'Stock cannot be negative' using errcode = '22023';
    end if;

    update public.products
    set stock = stock + new.quantity_delta
    where id = new.product_id
    returning stock into v_next_stock;

    if not found then
      raise exception 'Product not found' using errcode = 'P0002';
    end if;

    if v_next_stock < 0 then
      raise exception 'Stock cannot be negative' using errcode = '22023';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.products
    set stock = stock - old.quantity_delta
    where id = old.product_id
    returning stock into v_next_stock;

    if not found then
      raise exception 'Product not found' using errcode = 'P0002';
    end if;

    if v_next_stock < 0 then
      raise exception 'Stock cannot be negative' using errcode = '22023';
    end if;

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists stock_movements_apply_to_product_stock
on public.stock_movements;

create trigger stock_movements_apply_to_product_stock
after insert or update or delete on public.stock_movements
for each row execute function app_private.apply_stock_movement_to_product();

create or replace function app_private.record_stock_movement(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_sale_id uuid,
  p_qty numeric,
  p_reason public.stock_movement_reason,
  p_note text,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_movement_id uuid;
begin
  insert into public.stock_movements (
    product_id,
    warehouse_id,
    sale_id,
    quantity_delta,
    reason,
    note,
    created_by
  )
  values (
    p_product_id,
    p_warehouse_id,
    p_sale_id,
    p_qty,
    p_reason,
    p_note,
    p_created_by
  )
  returning id into v_movement_id;

  return v_movement_id;
end;
$$;

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

  perform app_private.record_stock_movement(
    p_product_id,
    null,
    null,
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

    perform app_private.record_stock_movement(
      v_line.product_id,
      null,
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
    for update of si, p
  loop
    perform app_private.record_stock_movement(
      v_line.product_id,
      null,
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
