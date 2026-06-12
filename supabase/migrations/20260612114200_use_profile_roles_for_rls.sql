create or replace function app_private.current_app_role()
returns text
language plpgsql
stable
security definer
set search_path = public, app_private
as $$
declare
  v_profile_role public.app_role;
begin
  if auth.uid() is not null then
    select p.role
    into v_profile_role
    from public.profiles p
    where p.id = auth.uid();

    if v_profile_role is not null then
      return v_profile_role::text;
    end if;
  end if;

  return coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'cashier');
end;
$$;

grant execute on function app_private.current_app_role() to authenticated;

