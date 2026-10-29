-- =====================================================================
-- Staging with bin/shelf location, who-did-what, and tighter staff rules.
-- Safe to run more than once. schema.sql includes this for fresh setups.
-- =====================================================================

alter table public.orders
  add column if not exists staged_location text,
  add column if not exists staged_at timestamptz,
  add column if not exists staged_by uuid references public.profiles (id) on delete set null,
  add column if not exists picked_up_by uuid references public.profiles (id) on delete set null;

-- Order status changes all go through here.
-- Staff can: stage (with a location), unstage, hand off (picked up), or mark not picked up.
-- Only the admin can cancel, reopen a cancelled/not-picked-up order, or undo a pickup.
drop function if exists public.set_order_status(uuid, public.order_status);
create or replace function public.set_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_location text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_old public.order_status;
  v_admin boolean := public.is_admin();
begin
  if not public.is_staff() then
    raise exception 'Only shop staff can update orders.';
  end if;

  select status into v_old from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;

  if not v_admin and not (
       (v_old = 'pending' and p_status in ('ready', 'no_show'))
    or (v_old = 'ready'   and p_status in ('picked_up', 'pending', 'no_show'))
  ) then
    raise exception 'Only the admin can make that change.';
  end if;

  update public.orders set
    status = p_status,
    staged_location = case
      when p_status = 'ready' then nullif(left(trim(coalesce(p_location, '')), 60), '')
      when p_status = 'picked_up' then staged_location
      else null end,
    staged_at = case
      when p_status = 'ready' then now()
      when p_status = 'picked_up' then staged_at
      else null end,
    staged_by = case
      when p_status = 'ready' then auth.uid()
      when p_status = 'picked_up' then staged_by
      else null end,
    picked_up_by = case when p_status = 'picked_up' then auth.uid() else null end
  where id = p_order_id;
end;
$$;

revoke execute on function public.set_order_status(uuid, public.order_status, text) from anon, public;
grant execute on function public.set_order_status(uuid, public.order_status, text) to authenticated;
