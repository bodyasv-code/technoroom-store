-- Technoroom: migrate legacy products.brand values into public.brands
-- Safe to run repeatedly.
begin;

update public.products
set brand = nullif(trim(regexp_replace(replace(brand, '&amp;', '&'), '\\s+', ' ', 'g')), '')
where brand is not null;

with source as (
  select distinct on (lower(brand)) brand as name, lower(brand) as name_key
  from public.products
  where brand is not null and trim(brand) <> ''
  order by lower(brand), brand
),
prepared as (
  select name, name_key,
    trim(both '-' from regexp_replace(lower(name), '[^a-z0-9а-яіїєґ]+', '-', 'gi')) as base_slug
  from source
)
insert into public.brands (name, slug, is_active, sort_order)
select p.name,
  case
    when coalesce(p.base_slug, '') = '' then 'brand-' || substr(md5(p.name_key), 1, 10)
    when exists (select 1 from public.brands b where b.slug=p.base_slug and lower(b.name)<>p.name_key)
      then p.base_slug || '-' || substr(md5(p.name_key), 1, 8)
    else p.base_slug
  end,
  true, 0
from prepared p
where not exists (select 1 from public.brands b where lower(trim(b.name))=p.name_key)
on conflict do nothing;

update public.products p
set brand_id=b.id, brand=b.name
from public.brands b
where p.brand is not null
  and lower(trim(p.brand))=lower(trim(b.name))
  and (p.brand_id is distinct from b.id or p.brand is distinct from b.name);

commit;

select
  (select count(*) from public.brands) as brand_count,
  (select count(*) from public.products where brand is not null) as products_with_brand,
  (select count(*) from public.products where brand is not null and brand_id is null) as unlinked_products;
