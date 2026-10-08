-- TECHNOROOM: перенесення об'єктивів із «Проєкторів» до
-- «Оптики для проєкторів». Інші дані товарів не змінюються.

begin;

update public.products
set category = 'erc-display-15'
where category = 'projectors'
  and (
    name ilike '%об''єктив%'
    or name ilike '%об’єктив%'
    or name ilike '%объектив%'
    or name ilike 'lens %'
    or name ilike '% lens %'
    or name ilike '% lens'
    or name ilike '%оптика%'
  );

commit;

-- Перевірка: результат має показати перенесені об'єктиви в цій категорії.
select name, sku, category
from public.products
where category = 'erc-display-15'
  and (
    name ilike '%об''єктив%'
    or name ilike '%об’єктив%'
    or name ilike '%объектив%'
    or name ilike '%lens%'
  )
order by name;
