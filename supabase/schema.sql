-- Run in Supabase SQL Editor. This is the only place where the database model lives.
do $$ begin
  create type public.user_role as enum ('owner', 'manager');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_status as enum ('new', 'confirmed', 'paid', 'shipped', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'manager',
  full_name text,
  created_at timestamptz not null default now()
);

create table public.products (
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

create table public.orders (
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

create table public.order_items (
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

create policy "public can read active products" on public.products for select to anon, authenticated using (is_active = true);
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read profiles" on public.profiles for select to authenticated using (public.is_admin());
create policy "admins update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admins read orders" on public.orders for select to authenticated using (public.is_admin());
create policy "admins update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read order items" on public.order_items for select to authenticated using (public.is_admin());

-- The server's service-role key creates orders; the browser never receives it.
revoke all on public.orders, public.order_items from anon, authenticated;
revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;



-- Brand directory for logos, SEO pages and centralized brand management.
create table if not exists public.brands (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  description text,
  logo_path text,
  website text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists brands_name_lower_idx on public.brands (lower(name));
alter table public.brands enable row level security;
drop policy if exists "public can read active brands" on public.brands;
create policy "public can read active brands" on public.brands for select to anon, authenticated using (is_active = true or public.is_admin());
drop policy if exists "admins manage brands" on public.brands;
create policy "admins manage brands" on public.brands for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.brands to anon, authenticated;
grant insert, update, delete on public.brands to authenticated;
