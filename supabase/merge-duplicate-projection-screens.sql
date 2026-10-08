-- TECHNOROOM: прибрати помилковий дубль «Екрани проєкційні».
-- Усі товари повертаються до основної категорії «Проєкційні екрани»
-- (slug erc-display-06). Інші дані товарів не змінюються.

begin;

update public.products
set category = 'erc-display-06'
where category in (
  select slug
  from public.categories
  where lower(name) in ('екрани проєкційні', 'екрани проекційні')
    and slug <> 'erc-display-06'
);

delete from public.categories
where lower(name) in ('екрани проєкційні', 'екрани проекційні')
  and slug <> 'erc-display-06';

commit;

-- Перевірка: має залишитися один запис.
select id, name, slug, parent_id
from public.categories
where lower(name) like '%екран%проекц%'
   or lower(name) like '%проекц%екран%'
order by id;
