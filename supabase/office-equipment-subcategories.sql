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

-- Принтери: лише пристрої, без картриджів та витратних матеріалів.
update public.products product
set category = 'office-printers'
where product.category in (select slug from public.categories where lower(name) like '%оргтех%' or slug in ('orgtehnika', 'office-equipment', 'office-tech'))
  and product.name ~* '\m(?:принтер|printer)\M'
  and product.name !~* '\m(?:картридж|тонер|чорнил|ink|cartridge|toner)\M';

-- Багатофункціональні пристрої.
update public.products product
set category = 'office-mfp'
where product.category in (select slug from public.categories where lower(name) like '%оргтех%' or slug in ('orgtehnika', 'office-equipment', 'office-tech'))
  and product.name ~* '\m(?:бфп|мфу|mfp|multifunction)\M';

update public.products product
set category = 'office-scanners'
where product.category in (select slug from public.categories where lower(name) like '%оргтех%' or slug in ('orgtehnika', 'office-equipment', 'office-tech'))
  and product.name ~* '\m(?:сканер|scanner)\M';

update public.products product
set category = 'office-copiers'
where product.category in (select slug from public.categories where lower(name) like '%оргтех%' or slug in ('orgtehnika', 'office-equipment', 'office-tech'))
  and product.name ~* '\m(?:копір|копир|copier)\M';

update public.products product
set category = 'office-laminators'
where product.category in (select slug from public.categories where lower(name) like '%оргтех%' or slug in ('orgtehnika', 'office-equipment', 'office-tech'))
  and product.name ~* '\m(?:ламінатор|ламинатор|laminator)\M';

update public.products product
set category = 'office-shredders'
where product.category in (select slug from public.categories where lower(name) like '%оргтех%' or slug in ('orgtehnika', 'office-equipment', 'office-tech'))
  and product.name ~* '\m(?:знищувач|шредер|shredder)\M';

commit;

-- Перевірка результату.
select category.name as "Підкатегорія", count(product.id) as "Товарів"
from public.categories category
left join public.products product on product.category = category.slug
where category.slug in ('office-printers', 'office-mfp', 'office-scanners', 'office-copiers', 'office-laminators', 'office-shredders')
group by category.id, category.name, category.sort_order
order by category.sort_order, category.name;
