begin;
alter table public.promotions add column if not exists target_type text not null default 'all';
alter table public.promotions add column if not exists target_value text;
alter table public.promotions drop constraint if exists promotions_target_type_check;
alter table public.promotions add constraint promotions_target_type_check check(target_type in ('all','category','brand','products'));
create table if not exists public.promotion_products (
 promotion_id bigint not null references public.promotions(id) on delete cascade,
 product_id bigint not null references public.products(id) on delete cascade,
 primary key(promotion_id,product_id)
);
alter table public.promotion_products enable row level security;
drop policy if exists "public read promotion products" on public.promotion_products;
create policy "public read promotion products" on public.promotion_products for select to anon,authenticated using(true);
drop policy if exists "admins manage promotion products" on public.promotion_products;
create policy "admins manage promotion products" on public.promotion_products for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.promotion_products to anon,authenticated;
grant insert,update,delete on public.promotion_products to authenticated;
commit;