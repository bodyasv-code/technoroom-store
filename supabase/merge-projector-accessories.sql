-- TECHNOROOM: об'єднати дублікати аксесуарів до проєкційного обладнання.
-- Єдина категорія: «Аксесуари для проєкторів» (erc-display-08).
-- Товари, ціни, фото й характеристики не змінюються.

begin;

update public.products
set category = 'erc-display-08'
where category in (
  select slug
  from public.categories
  where slug <> 'erc-display-08'
    and lower(name) like '%аксесуар%'
    and (lower(name) like '%проекц%' or lower(name) like '%проектор%')
);

delete from public.categories
where slug <> 'erc-display-08'
  and lower(name) like '%аксесуар%'
  and (lower(name) like '%проекц%' or lower(name) like '%проектор%');

commit;

-- Перевірка: має залишитися єдина категорія аксесуарів до проєкторів.
select id, name, slug, parent_id
from public.categories
where lower(name) like '%аксесуар%'
  and (lower(name) like '%проекц%' or lower(name) like '%проектор%')
order by id;
