-- TECHNOROOM commerce upgrade. Run once in Supabase SQL Editor.
-- Existing products and orders are preserved.

create table if not exists public.categories (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.categories (slug, name)
select distinct category, initcap(replace(category, '-', ' '))
from public.products
where category is not null and category <> ''
on conflict (slug) do nothing;

alter table public.products add column if not exists specifications jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists manager_note text;
alter table public.orders add column if not exists updated_at timestamptz not null default now();

alter table public.categories enable row level security;
drop policy if exists "public can read active categories" on public.categories;
drop policy if exists "admins manage categories" on public.categories;
create policy "public can read active categories" on public.categories for select to anon, authenticated using (is_active = true);
create policy "admins manage categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function public.touch_order_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists touch_order_updated_at_before_write on public.orders;
create trigger touch_order_updated_at_before_write
before update on public.orders
for each row execute function public.touch_order_updated_at();

-- Creates an order and decrements stock in one transaction.
-- This function is called only by the Vercel server using the service-role key.
create or replace function public.create_store_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_city text,
  p_address text,
  p_comment text,
  p_items jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_total numeric(12,2) := 0;
  v_order_id bigint;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must include at least one item';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := greatest(1, coalesce((v_item->>'quantity')::integer, 1));
    select * into v_product from public.products
      where id = (v_item->>'productId')::bigint and is_active = true
      for update;
    if not found or not v_product.in_stock or v_product.stock_quantity < v_quantity then
      raise exception 'Product % is unavailable', v_item->>'productId';
    end if;
    v_total := v_total + v_product.price * v_quantity;
  end loop;

  insert into public.orders (customer_name, customer_phone, customer_email, city, address, comment, total)
  values (p_customer_name, p_customer_phone, nullif(p_customer_email, ''), nullif(p_city, ''), nullif(p_address, ''), nullif(p_comment, ''), v_total)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := greatest(1, coalesce((v_item->>'quantity')::integer, 1));
    select * into v_product from public.products where id = (v_item->>'productId')::bigint for update;
    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_quantity);
    update public.products set stock_quantity = stock_quantity - v_quantity where id = v_product.id;
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.create_store_order(text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_store_order(text, text, text, text, text, text, jsonb) to service_role;

