-- TECHNOROOM: повертає БФП, які помилково стали «Аксесуарами для оргтехніки»
-- через слова «лоток» або «стенд» у назві базового пристрою.
-- Зачіпає лише позиції, назва яких починається з БФП / МФУ /
-- «Багатофункціональний пристрій». Справжні комплекти й аксесуари не змінюються.

begin;

with classified as (
  select id,
    case
      when lower(coalesce(name, '')) ~ '(color|colour|кольоров)' then 'office-mfp-color'
      when lower(coalesce(name, '')) ~ '(mono|monochrome|монохром|чорно[ -]?білий)' then 'office-mfp-mono'
      else 'office-mfp'
    end as category
  from public.products
  where category = 'office-accessories'
    and lower(trim(coalesce(name, '')))
        ~ '^(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат))'
)
update public.products product
set category = classified.category
from classified
where product.id = classified.id;

commit;

select category, count(*) as "Товарів"
from public.products
where category in ('office-mfp', 'office-mfp-color', 'office-mfp-mono', 'office-accessories')
group by category
order by category;
