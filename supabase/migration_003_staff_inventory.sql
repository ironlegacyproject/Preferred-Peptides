-- =====================================================================
-- Office staff accounts + inventory with reorder points.
-- Safe to run more than once. schema.sql already includes this file's
-- contents for fresh setups; run this file on its own only if you set up
-- the database before staff and inventory were added.
-- =====================================================================

-- ---------- Office staff ---------------------------------------------

alter table public.profiles add column if not exists is_staff boolean not null default false;

-- Staff or admin.
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select is_staff or is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Staff can see orders, their items, and who placed them.
drop policy if exists "profiles: read own or admin" on public.profiles;
drop policy if exists "profiles: read own or staff" on public.profiles;
create policy "profiles: read own or staff" on public.profiles
  for select using (id = auth.uid() or public.is_staff());

drop policy if exists "orders: read own or admin" on public.orders;
drop policy if exists "orders: read own or staff" on public.orders;
create policy "orders: read own or staff" on public.orders
  for select using (user_id = auth.uid() or public.is_staff());

drop policy if exists "order_items: read own or admin" on public.order_items;
drop policy if exists "order_items: read own or staff" on public.order_items;
create policy "order_items: read own or staff" on public.order_items
  for select using (
    public.is_staff()
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- Staff change order status only through this function (they can't edit anything else).
create or replace function public.set_order_status(p_order_id uuid, p_status public.order_status)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Only shop staff can update orders.';
  end if;
  update public.orders set status = p_status where id = p_order_id;
  if not found then
    raise exception 'Order not found.';
  end if;
end;
$$;

-- Admin turns staff access on or off by email. The person must have signed up first.
create or replace function public.set_staff(p_email text, p_is_staff boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the admin can manage staff.';
  end if;
  update public.profiles set is_staff = p_is_staff where lower(email) = lower(trim(p_email));
  if not found then
    raise exception 'No account uses that email. Ask them to sign up on the site first, then try again.';
  end if;
end;
$$;

revoke execute on function public.set_order_status(uuid, public.order_status) from anon, public;
revoke execute on function public.set_staff(text, boolean) from anon, public;
grant execute on function public.set_order_status(uuid, public.order_status) to authenticated;
grant execute on function public.set_staff(text, boolean) to authenticated;

-- ---------- Inventory -------------------------------------------------

create table if not exists public.inventory (
  product_id     uuid primary key references public.products (id) on delete cascade,
  on_hand        integer not null default 0,
  reorder_point  integer not null default 0 check (reorder_point >= 0),   -- 0 = no reminder
  reorder_qty    integer not null default 0 check (reorder_qty >= 0),
  last_counted_at timestamptz,
  updated_at     timestamptz not null default now()
);

-- Every change to on-hand, so you can see where stock went.
create table if not exists public.inventory_moves (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references public.products (id) on delete cascade,
  change      integer not null,
  on_hand_after integer not null,
  reason      text not null check (reason in ('count', 'received', 'picked_up', 'pickup_undone', 'adjust')),
  order_id    uuid references public.orders (id) on delete set null,
  note        text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists inventory_moves_product_idx on public.inventory_moves (product_id, created_at desc);

-- Give every product an inventory row, now and whenever one is added.
insert into public.inventory (product_id)
  select id from public.products on conflict (product_id) do nothing;

create or replace function public.add_inventory_row()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.inventory (product_id) values (new.id) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists products_inventory_row on public.products;
create trigger products_inventory_row after insert on public.products
  for each row execute function public.add_inventory_row();

-- Internal helper: change on-hand and log it.
create or replace function public.move_stock(p_product uuid, p_change integer, p_reason text, p_order uuid, p_note text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_after integer;
begin
  insert into public.inventory (product_id) values (p_product) on conflict do nothing;
  update public.inventory
     set on_hand = on_hand + p_change, updated_at = now(),
         last_counted_at = case when p_reason = 'count' then now() else last_counted_at end
   where product_id = p_product
   returning on_hand into v_after;
  insert into public.inventory_moves (product_id, change, on_hand_after, reason, order_id, note, created_by)
  values (p_product, p_change, v_after, p_reason, p_order, nullif(trim(coalesce(p_note, '')), ''), auth.uid());
  return v_after;
end; $$;
revoke execute on function public.move_stock(uuid, integer, text, uuid, text) from anon, authenticated, public;

-- Picking up an order takes its items out of stock. Undoing a pickup puts them back.
create or replace function public.stock_on_pickup()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  if new.status = 'picked_up' and old.status is distinct from 'picked_up' then
    for r in select product_id, sum(quantity)::int q from public.order_items
             where order_id = new.id and product_id is not null group by product_id loop
      perform public.move_stock(r.product_id, -r.q, 'picked_up', new.id, null);
    end loop;
  elsif old.status = 'picked_up' and new.status <> 'picked_up' then
    for r in select product_id, sum(quantity)::int q from public.order_items
             where order_id = new.id and product_id is not null group by product_id loop
      perform public.move_stock(r.product_id, r.q, 'pickup_undone', new.id, null);
    end loop;
  end if;
  return new;
end; $$;

drop trigger if exists orders_stock_on_pickup on public.orders;
create trigger orders_stock_on_pickup after update of status on public.orders
  for each row execute function public.stock_on_pickup();

-- Admin actions.
create or replace function public.inventory_set_count(p_product uuid, p_count integer, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_now integer;
begin
  if not public.is_admin() then raise exception 'Only the admin can change inventory.'; end if;
  if p_count is null or p_count < 0 then raise exception 'Enter a count of 0 or more.'; end if;
  select coalesce((select on_hand from public.inventory where product_id = p_product), 0) into v_now;
  perform public.move_stock(p_product, p_count - v_now, 'count', null, p_note);
end; $$;

create or replace function public.inventory_receive(p_product uuid, p_qty integer, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can change inventory.'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Enter how many you received.'; end if;
  perform public.move_stock(p_product, p_qty, 'received', null, p_note);
end; $$;

create or replace function public.inventory_set_levels(p_product uuid, p_reorder_point integer, p_reorder_qty integer)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only the admin can change inventory.'; end if;
  insert into public.inventory (product_id) values (p_product) on conflict do nothing;
  update public.inventory
     set reorder_point = greatest(coalesce(p_reorder_point, 0), 0),
         reorder_qty = greatest(coalesce(p_reorder_qty, 0), 0),
         updated_at = now()
   where product_id = p_product;
end; $$;

-- One row per product: on hand, what open orders will take, what's left, and whether to reorder.
create or replace function public.inventory_overview()
returns table (
  product_id uuid, name text, size text, category text, is_active boolean,
  on_hand integer, committed integer, available integer,
  reorder_point integer, reorder_qty integer, needs_reorder boolean, last_counted_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, p.size, p.category, p.is_active,
         coalesce(i.on_hand, 0),
         coalesce(c.q, 0),
         coalesce(i.on_hand, 0) - coalesce(c.q, 0),
         coalesce(i.reorder_point, 0),
         coalesce(i.reorder_qty, 0),
         coalesce(i.reorder_point, 0) > 0 and coalesce(i.on_hand, 0) - coalesce(c.q, 0) <= i.reorder_point,
         i.last_counted_at
    from public.products p
    left join public.inventory i on i.product_id = p.id
    left join (
      select oi.product_id, sum(oi.quantity)::int q
        from public.order_items oi join public.orders o on o.id = oi.order_id
       where o.status in ('pending', 'ready')
       group by oi.product_id
    ) c on c.product_id = p.id
   where public.is_admin()
   order by p.sort_order, p.name;
$$;

revoke execute on function public.inventory_set_count(uuid, integer, text) from anon, public;
revoke execute on function public.inventory_receive(uuid, integer, text) from anon, public;
revoke execute on function public.inventory_set_levels(uuid, integer, integer) from anon, public;
revoke execute on function public.inventory_overview() from anon, public;
grant execute on function public.inventory_set_count(uuid, integer, text) to authenticated;
grant execute on function public.inventory_receive(uuid, integer, text) to authenticated;
grant execute on function public.inventory_set_levels(uuid, integer, integer) to authenticated;
grant execute on function public.inventory_overview() to authenticated;

alter table public.inventory enable row level security;
alter table public.inventory_moves enable row level security;
drop policy if exists "inventory: admin read" on public.inventory;
create policy "inventory: admin read" on public.inventory for select using (public.is_admin());
drop policy if exists "inventory_moves: admin read" on public.inventory_moves;
create policy "inventory_moves: admin read" on public.inventory_moves for select using (public.is_admin());
