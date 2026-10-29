-- =====================================================================
-- Preferred Peptides — order request system
-- Run this whole file once in Supabase: Dashboard → SQL Editor → New query.
-- Then run seed_products.sql to load the price list.
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text not null default '',
  phone       text not null default '',
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  size        text,
  price       numeric(10,2) not null check (price >= 0),
  category    text not null default 'Peptides',
  subcategory text,
  description text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index products_active_idx on public.products (is_active, category, sort_order);

create table public.pickup_dates (
  id           uuid primary key default gen_random_uuid(),
  pickup_date  date not null unique,
  start_time   time,
  end_time     time,
  note         text,
  max_orders   integer check (max_orders is null or max_orders > 0),
  is_open      boolean not null default true,
  created_at   timestamptz not null default now()
);

create type public.order_status as enum ('pending', 'ready', 'picked_up', 'cancelled', 'no_show');

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    bigint generated always as identity (start with 1001) unique,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  pickup_date_id  uuid not null references public.pickup_dates (id),
  status          public.order_status not null default 'pending',
  total           numeric(10,2) not null default 0,
  customer_note   text,
  -- Research Use Agreement: who signed, which version, and when.
  waiver_signed_name  text not null,
  waiver_version      text not null,
  waiver_accepted_at  timestamptz not null default now(),
  picked_up_at        timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- Private shop notes live in their own table so customers can never read them.
create table public.order_admin_notes (
  order_id    uuid primary key references public.orders (id) on delete cascade,
  note        text not null,
  updated_at  timestamptz not null default now()
);

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_pickup_idx on public.orders (pickup_date_id, status);

-- Name, size and price are copied onto each line so order history never
-- changes when you later edit or remove a product.
create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  product_name text not null,
  product_size text,
  unit_price   numeric(10,2) not null,
  quantity     integer not null check (quantity between 1 and 99),
  line_total   numeric(10,2) not null
);
create index order_items_order_idx on public.order_items (order_id);

-- ---------- Helpers ---------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.shop_today()
returns date
language sql stable
as $$ select (now() at time zone 'America/Denver')::date; $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- Picking up the order is the customer's final acceptance of the agreement.
create or replace function public.stamp_pickup()
returns trigger language plpgsql as $$
begin
  if new.status = 'picked_up' and old.status is distinct from 'picked_up' then
    new.picked_up_at := now();
  elsif new.status <> 'picked_up' then
    new.picked_up_at := null;
  end if;
  return new;
end; $$;

create trigger orders_stamp_pickup before update of status on public.orders
  for each row execute function public.stamp_pickup();

-- Create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Placing and cancelling orders ----------------------------
-- Customers can't write to orders directly. They call these functions,
-- which look up prices from the products table so totals can't be faked.

create or replace function public.place_order(
  p_pickup_date_id uuid,
  p_items jsonb,          -- [{"product_id": "...", "quantity": 2}, ...]
  p_note text default null,
  p_waiver_name text default null,
  p_waiver_version text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_pickup   public.pickup_dates%rowtype;
  v_order_id uuid;
  v_item     jsonb;
  v_product  public.products%rowtype;
  v_qty      integer;
  v_total    numeric(10,2) := 0;
  v_count    integer;
begin
  if v_user is null then
    raise exception 'Sign in to place an order.';
  end if;

  if length(trim(coalesce(p_waiver_name, ''))) < 3 or coalesce(p_waiver_version, '') = '' then
    raise exception 'Sign the Research Use Agreement by typing your full legal name.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your order has no items.';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'Too many different items in one order.';
  end if;

  select * into v_pickup from public.pickup_dates where id = p_pickup_date_id for update;
  if not found or not v_pickup.is_open or v_pickup.pickup_date < public.shop_today() then
    raise exception 'That pickup date is no longer available. Choose another date.';
  end if;

  if v_pickup.max_orders is not null then
    select count(*) into v_count from public.orders
      where pickup_date_id = p_pickup_date_id and status not in ('cancelled');
    if v_count >= v_pickup.max_orders then
      raise exception 'That pickup date is full. Choose another date.';
    end if;
  end if;

  insert into public.orders (user_id, pickup_date_id, customer_note, waiver_signed_name, waiver_version)
  values (
    v_user,
    p_pickup_date_id,
    nullif(left(trim(coalesce(p_note, '')), 1000), ''),
    left(trim(p_waiver_name), 200),
    left(trim(p_waiver_version), 40)
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Quantities must be between 1 and 99.';
    end if;

    select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and is_active;
    if not found then
      raise exception 'An item in your cart is no longer available. Remove it and try again.';
    end if;

    insert into public.order_items (order_id, product_id, product_name, product_size, unit_price, quantity, line_total)
    values (v_order_id, v_product.id, v_product.name, v_product.size, v_product.price, v_qty, v_product.price * v_qty);

    v_total := v_total + v_product.price * v_qty;
  end loop;

  update public.orders set total = v_total where id = v_order_id;
  return v_order_id;
end;
$$;

create or replace function public.cancel_my_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.orders
     set status = 'cancelled'
   where id = p_order_id and user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Only orders that are still pending can be cancelled.';
  end if;
end;
$$;

-- Lets the checkout page show which dates still have room without
-- exposing other customers' orders.
create or replace function public.available_pickup_dates()
returns table (id uuid, pickup_date date, start_time time, end_time time, note text, spots_left integer)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.pickup_date, d.start_time, d.end_time, d.note,
         case when d.max_orders is null then null
              else d.max_orders - (select count(*)::int from public.orders o
                                   where o.pickup_date_id = d.id and o.status <> 'cancelled')
         end
    from public.pickup_dates d
   where d.is_open and d.pickup_date >= public.shop_today()
     and (d.max_orders is null or d.max_orders > (select count(*) from public.orders o
                                   where o.pickup_date_id = d.id and o.status <> 'cancelled'))
   order by d.pickup_date;
$$;

revoke execute on function public.place_order(uuid, jsonb, text, text, text) from anon, public;
revoke execute on function public.cancel_my_order(uuid) from anon, public;
grant execute on function public.place_order(uuid, jsonb, text, text, text) to authenticated;
grant execute on function public.cancel_my_order(uuid) to authenticated;
grant execute on function public.available_pickup_dates() to anon, authenticated;

-- ---------- Row level security ---------------------------------------

alter table public.profiles     enable row level security;
alter table public.products     enable row level security;
alter table public.pickup_dates enable row level security;
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;
alter table public.order_admin_notes enable row level security;

-- Profiles: you see and edit your own; admins see everyone.
create policy "profiles: read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
-- Customers may only change these two columns (never is_admin).
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone) on public.profiles to authenticated;

-- Products: anyone can browse active products; admins manage all.
create policy "products: public read active" on public.products
  for select using (is_active or public.is_admin());
create policy "products: admin insert" on public.products
  for insert with check (public.is_admin());
create policy "products: admin update" on public.products
  for update using (public.is_admin()) with check (public.is_admin());
create policy "products: admin delete" on public.products
  for delete using (public.is_admin());

-- Pickup dates: admins only (customers use available_pickup_dates()).
create policy "pickup_dates: read" on public.pickup_dates
  for select using (true);
create policy "pickup_dates: admin insert" on public.pickup_dates
  for insert with check (public.is_admin());
create policy "pickup_dates: admin update" on public.pickup_dates
  for update using (public.is_admin()) with check (public.is_admin());
create policy "pickup_dates: admin delete" on public.pickup_dates
  for delete using (public.is_admin());

-- Orders: customers read their own; admins read and update all.
create policy "orders: read own or admin" on public.orders
  for select using (user_id = auth.uid() or public.is_admin());
create policy "orders: admin update" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());
create policy "orders: admin delete" on public.orders
  for delete using (public.is_admin());

create policy "order_items: read own or admin" on public.order_items
  for select using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

create policy "order_admin_notes: admin only" on public.order_admin_notes
  for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- Office staff accounts + inventory
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

-- =====================================================================
-- Staging with bin location, who-did-what, tighter staff rules
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

-- ---------- Make yourself the admin ----------------------------------
-- After you sign up on the site, run this once with your email:
--
--   update public.profiles set is_admin = true where email = 'you@example.com';
