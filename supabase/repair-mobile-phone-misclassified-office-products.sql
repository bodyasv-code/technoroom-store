-- TECHNOROOM: очистити «Мобільний телефон» від товарів, які помилково
-- потрапили туди під час ранніх імпортів.
-- Смартфони та телефони не змінюються. Скрипт безпечно запускати повторно.
-- Перед запуском мають існувати підкатегорії office-*, які створює
-- repair-office-equipment-products.sql.

begin;

-- Окрема підкатегорія для чохлів, кабелів і зарядних пристроїв: вони не
-- повинні змішуватися зі смартфонами.
with accessories_root as (
  select id from public.categories where slug = 'cat-accessories' limit 1
)
insert into public.categories (name, slug, parent_id, sort_order, is_active)
select 'Аксесуари для смартфонів', 'phone-accessories', id, 20, true
from accessories_root
on conflict (slug) do update set parent_id = excluded.parent_id, is_active = true;

-- Повертаємо реальні смартфони, які ранні правила могли помилково
-- віднести до будь-якої іншої категорії через слово в описі чи параметрах.
-- Орієнтуємося лише на початок назви, тому чохли на кшталт «iPhone case»
-- або запасні частини не зачіпаються.
update public.products product
set category = 'мобільнии-телефон'
where lower(coalesce(product.name, '')) ~ '^[[:space:]]*(смартфон|smartphone|iphone)'
  and lower(coalesce(product.name, '')) !~ '(чохол|case|cover|захисн[^ ]*[[:space:]]+скло|screen[[:space:]]+protector|кабель|cable|зарядн|charger|адаптер|adapter|дисплей|екран|display|запчастин|repair)';

with source as (
  select id,
    lower(coalesce(name, '')) as name_text,
    lower(concat_ws(' ', name, description, specifications::text)) as text
  from public.products
  where category in ('мобільнии-телефон', 'mobile-phone', 'mobile-phones')
), classified as (
  select id,
    case
      -- Назва смартфона має пріоритет над випадковими словами в описі.
      when name_text ~ '^[[:space:]]*(смартфон|smartphone|iphone)'
           and name_text !~ '(чохол|case|cover|захисн[^ ]*[[:space:]]+скло|screen[[:space:]]+protector|кабель|cable|зарядн|charger|адаптер|adapter)' then 'мобільнии-телефон'
      -- БФП перевіряємо першим: у його параметрах часто є «сканер».
      when text ~ '(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат))'
           and text ~ '(color|colour|кольоров)' then 'office-mfp-color'
      when text ~ '(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат))'
           and text ~ '(mono|monochrome|монохром|чорно[ -]?білий)' then 'office-mfp-mono'
      when text ~ '(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат))' then 'office-mfp'
      when text ~ '(принтер|printer)' and text ~ '(color|colour|кольоров)' then 'office-printers-color'
      when text ~ '(принтер|printer)' and text ~ '(mono|monochrome|монохром|чорно[ -]?білий)' then 'office-printers-mono'
      when text ~ '(принтер|printer)' then 'office-printers'
      when text ~ '(сканер|scanner)' then 'office-scanners'
      when text ~ '(копір|копир|copier)' then 'office-copiers'
      when text ~ '(ламінатор|ламинатор|laminator)' then 'office-laminators'
      when text ~ '(знищувач|шредер|shredder)' then 'office-shredders'
      when text ~ '(планшет|tablet|ipad)' then 'планшетнии-комп-ютер'
      when text ~ '(apple[[:space:]-]?watch|смарт[[:space:]-]?годинник|smart[[:space:]]?watch)' then 'apple-watch'
      when text ~ '(навушник|headphone|headset|гарнітур|airpods)' then 'headphones'
      when text ~ '(чохол|case|cover|захисн[^ ]*[[:space:]]+скло|screen[[:space:]]+protector|кабель|cable|зарядн[^ ]*[[:space:]]+пристрій|charger|адаптер|adapter|кріплен|mount)' then 'phone-accessories'
    end as category
  from source
)
update public.products product
set category = classified.category
from classified
where product.id = classified.id
  and classified.category is not null;

commit;

-- Контроль: тут мають лишитися лише телефони та смартфони. Результат
-- показує неоднозначні позиції, які варто перевірити вручну.
select id, name, sku, category
from public.products
where category in ('мобільнии-телефон', 'mobile-phone', 'mobile-phones')
  and lower(concat_ws(' ', name, description, specifications::text))
      !~ '(смартфон|smartphone|iphone|мобільн[^ ]*[[:space:]]+телефон|mobile[[:space:]]+phone|телефон)'
order by name;

select category, count(*) as "Товарів"
from public.products
where category in (
  'мобільнии-телефон', 'office-printers', 'office-printers-color',
  'office-printers-mono', 'office-mfp', 'office-mfp-color', 'office-mfp-mono',
  'office-scanners', 'office-copiers', 'office-laminators', 'office-shredders'
)
group by category
order by category;
