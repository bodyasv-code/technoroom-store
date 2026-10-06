-- TECHNOROOM: storefront performance upgrade.
-- Run once in Supabase SQL Editor. Safe to run repeatedly.
--
-- Replaces the large client-side read used only to count products in the
-- catalogue menu with a compact server-side aggregation.

create index if not exists products_active_category_parent_idx
  on public.products (category, parent_product_id)
  where is_active = true;

create index if not exists products_active_created_at_idx
  on public.products (created_at desc)
  where is_active = true;

create or replace function public.storefront_category_product_counts()
returns table(category text, product_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select product.category, count(*)::bigint
  from public.products as product
  where product.is_active = true
    and product.parent_product_id is null
  group by product.category;
$$;

grant execute on function public.storefront_category_product_counts() to anon, authenticated;

-- Verification: should return one compact row per category.
select *
from public.storefront_category_product_counts()
order by category;
