alter table public.sales
add column if not exists cancelled_at timestamptz,
add column if not exists cancel_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_cancel_reason_valid'
      and conrelid = 'public.sales'::regclass
  ) then
    alter table public.sales
    add constraint sales_cancel_reason_valid
    check (cancel_reason is null or length(trim(cancel_reason)) >= 5);
  end if;
end;
$$;

drop function if exists public.cancel_draft_sale(uuid);
drop function if exists app_private.cancel_draft_sale_impl(uuid);

create or replace function app_private.cancel_draft_sale_impl(
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
  v_reason text := trim(coalesce(p_reason, ''));
begin
  perform app_private.assert_authenticated();

  if length(v_reason) < 5 then
    raise exception 'Cancel reason must be at least 5 characters' using errcode = '22023';
  end if;

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
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancel_reason = v_reason
  where id = p_sale_id;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'sale.cancelled',
    'sale',
    p_sale_id,
    jsonb_build_object('reason', v_reason)
  );
end;
$$;

create or replace function public.cancel_draft_sale(
  p_sale_id uuid,
  p_reason text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.cancel_draft_sale_impl(p_sale_id, p_reason);
$$;

grant execute on function public.cancel_draft_sale(uuid, text) to authenticated;
grant execute on function app_private.cancel_draft_sale_impl(uuid, text) to authenticated;

