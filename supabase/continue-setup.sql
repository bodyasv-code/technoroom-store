-- Continue after profiles/user_role were created by an earlier attempt.
-- This script does not delete or alter existing data.
create table if not exists public.products (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  brand text,
  category text not null,
  description text,
  specifications jsonb not null default '{}'::jsonb,
  price numeric(12,2) not null check (price >= 0),
  in_stock boolean not null default true,
  is_active boolean not null default true,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  status public.order_status not null default 'new',
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  city text,
  address text,
  comment text,
  total numeric(12,2) not null check (total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  product_id bigint references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0)
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "public can read active products" on public.products;
drop policy if exists "admins manage products" on public.products;
drop policy if exists "admins read profiles" on public.profiles;
drop policy if exists "admins update own profile" on public.profiles;
drop policy if exists "admins read orders" on public.orders;
drop policy if exists "admins update orders" on public.orders;
drop policy if exists "admins read order items" on public.order_items;

create policy "public can read active products" on public.products for select to anon, authenticated using (is_active = true);
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read profiles" on public.profiles for select to authenticated using (public.is_admin());
create policy "admins update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admins read orders" on public.orders for select to authenticated using (public.is_admin());
create policy "admins update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read order items" on public.order_items for select to authenticated using (public.is_admin());

revoke all on public.orders, public.order_items from anon, authenticated;
revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant usage, select on all sequences in schema public to authenticated;

