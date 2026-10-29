-- Only needed if you already ran schema.sql BEFORE the Research Use Agreement was added.
-- (A fresh setup that runs the current schema.sql does not need this file.)

alter table public.orders
  add column if not exists waiver_signed_name text,
  add column if not exists waiver_version text,
  add column if not exists waiver_accepted_at timestamptz default now(),
  add column if not exists picked_up_at timestamptz;

-- Orders placed before the agreement existed.
update public.orders set waiver_signed_name = '(placed before agreement)', waiver_version = 'none'
 where waiver_signed_name is null;
alter table public.orders
  alter column waiver_signed_name set not null,
  alter column waiver_version set not null,
  alter column waiver_accepted_at set not null;

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

drop trigger if exists orders_stamp_pickup on public.orders;
create trigger orders_stamp_pickup before update of status on public.orders
  for each row execute function public.stamp_pickup();

drop function if exists public.place_order(uuid, jsonb, text);

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

revoke execute on function public.place_order(uuid, jsonb, text, text, text) from anon, public;
grant execute on function public.place_order(uuid, jsonb, text, text, text) to authenticated;
