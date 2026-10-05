-- TECHNOROOM: широкоформатні принтери й БФП.
-- Правило: якщо саме в назві пристрою вказано формат понад 20",
-- позиція належить до широкоформатної підкатегорії.
-- Безпечно запускати повторно: опис, характеристики, фото й ціни не змінюються.

begin;

with root as (
  select id from public.categories
  where slug = 'office-equipment' or lower(name) like '%оргтех%'
  order by case when slug = 'office-equipment' then 0 else 1 end, id
  limit 1
), children(name, slug, sort_order) as (
  values
    ('Принтери та БФП широкоформатні', 'office-wide-format', 25)
)
insert into public.categories (name, slug, parent_id, sort_order, is_active)
select children.name, children.slug, root.id, children.sort_order, true
from children cross join root
on conflict (slug) do update
set parent_id = excluded.parent_id,
    sort_order = excluded.sort_order,
    is_active = true;

-- 21" і більше. Перевіряється лише назва товару, а не опис або параметри.
-- Це не дає випадковим числам у характеристиках змінити категорію.
with classified as (
  select id,
    case
      when lower(coalesce(name, '')) ~ '(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат))'
       and lower(coalesce(name, '')) ~ '(^|[^0-9])(2[1-9]|[3-9][0-9]|[1-9][0-9]{2})[[:space:]]*("|″|”|дюйм|inch|in\.)'
        then 'office-wide-format'
      when lower(coalesce(name, '')) ~ '(принтер|printer)'
       and lower(coalesce(name, '')) !~ '(картридж|тонер|чорнил|ink|cartridge|drum|фотобарабан)'
       and lower(coalesce(name, '')) ~ '(^|[^0-9])(2[1-9]|[3-9][0-9]|[1-9][0-9]{2})[[:space:]]*("|″|”|дюйм|inch|in\.)'
        then 'office-wide-format'
    end as category
  from public.products
)
update public.products product
set category = classified.category
from classified
where product.id = classified.id
  and classified.category is not null
  and product.category is distinct from classified.category;

-- Попередня версія правила могла створити дві окремі підкатегорії.
-- Об'єднуємо їх у спільну, не змінюючи жодних інших даних товару.
update public.products
set category = 'office-wide-format'
where category in ('office-printers-wide', 'office-mfp-wide');

update public.categories
set is_active = false
where slug in ('office-printers-wide', 'office-mfp-wide')
  and not exists (select 1 from public.products product where product.category = categories.slug);

commit;

select category, count(*) as "Товарів"
from public.products
where category = 'office-wide-format'
group by category
order by category;
