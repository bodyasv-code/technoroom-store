-- Technoroom promotions and homepage banners
create table if not exists public.promotions (
 id bigint generated always as identity primary key,
 name text not null, code text, discount_type text not null default 'percent' check(discount_type in ('percent','fixed')),
 discount_value numeric(12,2) not null default 0 check(discount_value>=0),
 starts_at timestamptz, ends_at timestamptz, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists promotions_code_lower_idx on public.promotions(lower(code)) where code is not null and code<>'';
alter table public.promotions enable row level security;
drop policy if exists "public read active promotions" on public.promotions;
create policy "public read active promotions" on public.promotions for select to anon, authenticated using(is_active=true or public.is_admin());
drop policy if exists "admins manage promotions" on public.promotions;
create policy "admins manage promotions" on public.promotions for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.promotions to anon, authenticated; grant insert,update,delete on public.promotions to authenticated;

create table if not exists public.banners (
 id bigint generated always as identity primary key,
 title text not null, subtitle text, image_url text, link_url text, button_text text,
 sort_order integer not null default 0, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.banners enable row level security;
drop policy if exists "public read active banners" on public.banners;
create policy "public read active banners" on public.banners for select to anon, authenticated using(is_active=true or public.is_admin());
drop policy if exists "admins manage banners" on public.banners;
create policy "admins manage banners" on public.banners for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.banners to anon, authenticated; grant insert,update,delete on public.banners to authenticated;
