-- Об'єднання дубля ERC «Аксесуари та опції для сканерів і пристроїв друку»
-- з єдиною категорією «Аксесуари для оргтехніки».
-- Запустіть у Supabase SQL Editor один раз.

begin;

with canonical as (
  select slug
  from public.categories
  where slug = 'office-accessories'
  limit 1
), legacy as (
  select slug
  from public.categories
  where lower(trim(name)) = 'аксесуари та опції для сканерів і пристроїв друку'
    and slug <> 'office-accessories'
)
update public.products
set category = (select slug from canonical)
where category in (select slug from legacy)
  and exists (select 1 from canonical);

delete from public.categories
where lower(trim(name)) = 'аксесуари та опції для сканерів і пристроїв друку'
  and slug <> 'office-accessories';

commit;

-- Перевірка: результат має містити лише одну категорію та всі товари в ній.
select category, count(*) as "Товарів"
from public.products
where category = 'office-accessories'
group by category;
