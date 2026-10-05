-- TECHNOROOM: масово виправляє категорії наявних принтерів і БФП.
-- Призначення: старі товари могли залишитися без категорії або в застарілому
-- розділі після імпорту. Опис, характеристики, ціни та видимість не змінюються.
-- Скрипт безпечно запускати повторно.

begin;

with root as (
  select id from public.categories
  where slug = 'office-equipment' or lower(name) like '%оргтех%'
  order by case when slug = 'office-equipment' then 0 else 1 end, id
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

-- Спочатку БФП: назви на кшталт «Багатофункціональний пристрій» часто не
-- містять слова «принтер» або «MFP», тому старе правило їх пропускало.
-- ВАЖЛИВО: тип пристрою визначається тільки з назви. Характеристики можуть
-- містити «LiDAR Scanner» у смартфона, але це не робить його сканером.
with source as (
  select id,
         lower(coalesce(name, '')) as name_text,
         lower(concat_ws(' ', name, description, specifications::text)) as text
  from public.products
  where category like 'office-%'
     or lower(coalesce(name, '')) ~ '(^|[[:space:]])(бфп|мфу|mfp|multifunction|багатофункціональн|принтер|printer|сканер|scanner|копір|копир|copier|ламінатор|ламинатор|laminator|знищувач|шредер|shredder)'
), classified as (
  select id,
    case
      -- Формат 21" і більше має пріоритет над кольоровістю: це
      -- широкоформатний пристрій. Розмір беремо лише з назви.
      when name_text ~ '(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат))'
           and name_text ~ '(^|[^0-9])(2[1-9]|[3-9][0-9]|[1-9][0-9]{2})[[:space:]]*("|″|”|дюйм|inch|in\.)' then 'office-wide-format'
      when name_text ~ '(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат))'
           and name_text ~ '(color|colour|кольоров)' then 'office-mfp-color'
      when name_text ~ '(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат))'
           and name_text ~ '(mono|monochrome|монохром|чорно[ -]?білий|laserjet)' then 'office-mfp-mono'
      when name_text ~ '(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат))' then 'office-mfp'
      when name_text ~ '(принтер|printer)'
           and name_text ~ '(^|[^0-9])(2[1-9]|[3-9][0-9]|[1-9][0-9]{2})[[:space:]]*("|″|”|дюйм|inch|in\.)'
           and text !~ '(картридж|тонер|чорнил|ink|cartridge|drum|фотобарабан)' then 'office-wide-format'
      when name_text ~ '(принтер|printer)'
           and text !~ '(картридж|тонер|чорнил|ink|cartridge|drum|фотобарабан)'
           and name_text ~ '(color|colour|кольоров)' then 'office-printers-color'
      when name_text ~ '(принтер|printer)'
           and text !~ '(картридж|тонер|чорнил|ink|cartridge|drum|фотобарабан)'
           and name_text ~ '(mono|monochrome|монохром|чорно[ -]?білий|laserjet)' then 'office-printers-mono'
      when name_text ~ '(принтер|printer)'
           and text !~ '(картридж|тонер|чорнил|ink|cartridge|drum|фотобарабан)' then 'office-printers'
      when name_text ~ '(сканер|scanner)' then 'office-scanners'
      when name_text ~ '(копір|копир|copier)' then 'office-copiers'
      when name_text ~ '(ламінатор|ламинатор|laminator)' then 'office-laminators'
      when name_text ~ '(знищувач|шредер|shredder)' then 'office-shredders'
    end as category
  from source
)
update public.products product
set category = classified.category
from classified
where product.id = classified.id
  and classified.category is not null
  and product.category is distinct from classified.category;

commit;

-- Контроль після запуску: усі знайдені пристрої й позиції, де ще бракує даних.
select category, count(*) as "Товарів"
from public.products
where category like 'office-%'
group by category
order by category;

select id, name, sku,
  case when nullif(trim(coalesce(description, '')), '') is null then 'немає опису' end as "Опис",
  case when specifications is null or specifications = '{}'::jsonb then 'немає характеристик' end as "Характеристики"
from public.products
where category like 'office-%'
  and (nullif(trim(coalesce(description, '')), '') is null or specifications is null or specifications = '{}'::jsonb)
order by name;
