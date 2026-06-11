create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create index if not exists audit_events_actor_id_idx on public.audit_events(actor_id);
create index if not exists customers_created_by_idx on public.customers(created_by);
create index if not exists products_created_by_idx on public.products(created_by);
create index if not exists sale_items_product_id_idx on public.sale_items(product_id);
create index if not exists sale_voids_voided_by_idx on public.sale_voids(voided_by);
create index if not exists sales_customer_id_idx on public.sales(customer_id);
create index if not exists stock_movements_created_by_idx on public.stock_movements(created_by);
create index if not exists stock_movements_sale_id_idx on public.stock_movements(sale_id);
create index if not exists warehouses_created_by_idx on public.warehouses(created_by);

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or app_private.has_any_role(array['admin']));

drop policy if exists "profiles_update_own_name" on public.profiles;
create policy "profiles_update_own_name"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

drop policy if exists "customers_insert_authenticated" on public.customers;
create policy "customers_insert_authenticated"
on public.customers for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "sales_select_owner_or_manager" on public.sales;
create policy "sales_select_owner_or_manager"
on public.sales for select to authenticated
using (cashier_id = (select auth.uid()) or app_private.has_any_role(array['manager', 'admin']));

drop policy if exists "sales_insert_own_draft" on public.sales;
create policy "sales_insert_own_draft"
on public.sales for insert to authenticated
with check (cashier_id = (select auth.uid()) and status = 'draft');

drop policy if exists "sale_items_select_owner_or_manager" on public.sale_items;
create policy "sale_items_select_owner_or_manager"
on public.sale_items for select to authenticated
using (
  exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and (s.cashier_id = (select auth.uid()) or app_private.has_any_role(array['manager', 'admin']))
  )
);

drop policy if exists "sale_items_insert_own_draft" on public.sale_items;
create policy "sale_items_insert_own_draft"
on public.sale_items for insert to authenticated
with check (
  exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and s.status = 'draft'
      and s.cashier_id = (select auth.uid())
  )
);

drop policy if exists "sale_items_update_own_draft" on public.sale_items;
create policy "sale_items_update_own_draft"
on public.sale_items for update to authenticated
using (
  exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and s.status = 'draft'
      and s.cashier_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and s.status = 'draft'
      and s.cashier_id = (select auth.uid())
  )
);

drop policy if exists "sale_items_delete_own_draft" on public.sale_items;
create policy "sale_items_delete_own_draft"
on public.sale_items for delete to authenticated
using (
  exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and s.status = 'draft'
      and s.cashier_id = (select auth.uid())
  )
);
