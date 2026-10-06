-- TECHNOROOM: створює підкатегорії для «Оргтехніки» та безпечно розподіляє товари.
-- Нерозпізнані позиції залишаються в батьківській категорії «Оргтехніка».
-- Скрипт можна запускати повторно.

begin;

with root as (
  select id
  from public.categories
  where lower(name) like '%оргтех%'
     or slug in ('orgtehnika', 'office-equipment', 'office-tech')
  order by case when lower(name) = 'оргтехніка' then 0 else 1 end, id
  limit 1
), children(name, slug, sort_order) as (
  values
    ('Принтери', 'office-printers', 10),
    ('БФП', 'office-mfp', 20),
    ('Кольорові принтери', 'office-printers-color', 11),
    ('Монохромні принтери', 'office-printers-mono', 12),
    ('Кольорові БФП', 'office-mfp-color', 21),
    ('Монохромні БФП', 'office-mfp-mono', 22),
    ('Принтери та БФП широкоформатні', 'office-wide-format', 25),
    ('Сканери', 'office-scanners', 30),
    ('Копіри', 'office-copiers', 40),
    ('Ламінатори', 'office-laminators', 50),
    ('Знищувачі документів', 'office-shredders', 60)
)
insert into public.categories (name, slug, parent_id, sort_order, is_active)
select children.name, children.slug, root.id, children.sort_order, true
from children cross join root
on conflict (slug) do update
set parent_id = excluded.parent_id,
    sort_order = excluded.sort_order,
    is_active = true;

-- У старому імпорті ERC оргтехніка могла залишитися в об'єднаній категорії
-- «ТВ, засоби відображення інформації, оргтехніка». Враховуємо її прямо,
-- навіть якщо самої старої категорії вже немає у таблиці categories.
-- Принтери: лише пристрої, без картриджів та витратних матеріалів.
update public.products product
set category = 'office-printers'
where (product.category in (select slug from public.categories where lower(name) like '%оргтех%' or slug in ('orgtehnika', 'office-equipment', 'office-tech'))
       or product.category = 'тв-засоби-відображення-інформаціі-оргтехніка')
  and product.name ~* '\m(?:принтер|printer)\M'
  and product.name !~* '\m(?:картридж|тонер|чорнил|ink|cartridge|toner)\M';

-- Багатофункціональні пристрої.
update public.products product
set category = 'office-mfp'
where (product.category in (select slug from public.categories where lower(name) like '%оргтех%' or slug in ('orgtehnika', 'office-equipment', 'office-tech'))
       or product.category = 'тв-засоби-відображення-інформаціі-оргтехніка')
  and product.name ~* '\m(?:бфп|мфу|mfp|multifunction)\M';

update public.products product
set category = 'office-scanners'
where (product.category in (select slug from public.categories where lower(name) like '%оргтех%' or slug in ('orgtehnika', 'office-equipment', 'office-tech'))
       or product.category = 'тв-засоби-відображення-інформаціі-оргтехніка')
  and product.name ~* '\m(?:сканер|scanner)\M';

update public.products product
set category = 'office-copiers'
where (product.category in (select slug from public.categories where lower(name) like '%оргтех%' or slug in ('orgtehnika', 'office-equipment', 'office-tech'))
       or product.category = 'тв-засоби-відображення-інформаціі-оргтехніка')
  and product.name ~* '\m(?:копір|копир|copier)\M';

update public.products product
set category = 'office-laminators'
where (product.category in (select slug from public.categories where lower(name) like '%оргтех%' or slug in ('orgtehnika', 'office-equipment', 'office-tech'))
       or product.category = 'тв-засоби-відображення-інформаціі-оргтехніка')
  and product.name ~* '\m(?:ламінатор|ламинатор|laminator)\M';

update public.products product
set category = 'office-shredders'
where (product.category in (select slug from public.categories where lower(name) like '%оргтех%' or slug in ('orgtehnika', 'office-equipment', 'office-tech'))
       or product.category = 'тв-засоби-відображення-інформаціі-оргтехніка')
  and product.name ~* '\m(?:знищувач|шредер|shredder)\M';

-- Широкоформатні моделі мають пріоритет над типом друку: 21" і більше
-- або A0–A2. Визначається лише з назви товару.
update public.products product
set category = 'office-wide-format'
where product.category = 'office-printers'
  and (
    lower(replace(coalesce(product.name, ''), chr(39), '"')) ~ '(^|[^0-9])(2[1-9]|[3-9][0-9]|[1-9][0-9]{2})[[:space:]]*("|″|”|дюйм|inch|in\.)'
    or lower(replace(coalesce(product.name, ''), chr(39), '"')) ~ '(^|[^a-z0-9])a[0-2]([^a-z0-9]|$)'
  );

update public.products product
set category = 'office-wide-format'
where product.category = 'office-mfp'
  and (
    lower(replace(coalesce(product.name, ''), chr(39), '"')) ~ '(^|[^0-9])(2[1-9]|[3-9][0-9]|[1-9][0-9]{2})[[:space:]]*("|″|”|дюйм|inch|in\.)'
    or lower(replace(coalesce(product.name, ''), chr(39), '"')) ~ '(^|[^a-z0-9])a[0-2]([^a-z0-9]|$)'
  );

-- Після базового розподілу деталізуємо принтери та БФП за типом друку.
-- Не використовуємо звичайне поле «Колір»: воно часто містить колір корпусу.
-- Якщо тип не вказано явно,
-- товар залишається в загальній категорії «Принтери» чи «БФП».
update public.products product
set category = 'office-printers-color'
where product.category = 'office-printers'
  and lower(coalesce(product.name, '')) ~ '(color|colour|кольоров)';

update public.products product
set category = 'office-printers-mono'
where product.category = 'office-printers'
  and lower(coalesce(product.name, '')) ~ '(mono|monochrome|монохром|чорно[ -]?білий|laserjet)';

update public.products product
set category = 'office-mfp-color'
where product.category = 'office-mfp'
  and lower(coalesce(product.name, '')) ~ '(color|colour|кольоров)';

update public.products product
set category = 'office-mfp-mono'
where product.category = 'office-mfp'
  and lower(coalesce(product.name, '')) ~ '(mono|monochrome|монохром|чорно[ -]?білий|laserjet)';

commit;

-- Перевірка результату.
select category.name as "Підкатегорія", count(product.id) as "Товарів"
from public.categories category
left join public.products product on product.category = category.slug
where category.slug in ('office-printers', 'office-mfp', 'office-printers-color', 'office-printers-mono', 'office-mfp-color', 'office-mfp-mono', 'office-wide-format', 'office-scanners', 'office-copiers', 'office-laminators', 'office-shredders')
group by category.id, category.name, category.sort_order
order by category.sort_order, category.name;
