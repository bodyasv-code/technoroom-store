-- TECHNOROOM: перевірка логіки категорій без жодних змін у даних.
-- Запускати після імпорту XML або перед масовим переміщенням товарів.
-- У результаті будуть лише позиції, які варто перевірити в адмінці.

with source as (
  select
    id, name, sku, category,
    lower(replace(trim(coalesce(name, '')), chr(39), '"')) as name_text,
    lower(concat_ws(' ', name, specifications::text)) as detail_text
  from public.products
  where coalesce(is_active, true) = true
), expected as (
  select *,
    case
      -- Смартфони: лише товар, назва якого починається з відповідного типу.
      when name_text ~ '^(смартфон|smartphone|iphone|мобільн(ий|ого)[[:space:]]+телефон)'
        and name_text !~ '(чохол|case|cover|кабель|cable|зарядн|charger|адаптер|adapter|дисплей|екран|display|запчастин|repair)'
        then 'мобільнии-телефон'
      -- БФП перевіряємо раніше за принтери та сканери.
      when name_text ~ '^(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат))'
        and (name_text ~ '(^|[^0-9])(2[1-9]|[3-9][0-9]|[1-9][0-9]{2})[[:space:]]*("|″|”|дюйм|inch|in\.)'
          or name_text ~ '(^|[^a-z0-9])a[0-2]([^a-z0-9]|$)')
        then 'office-wide-format'
      when name_text ~ '^(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат))'
        and name_text ~ '(color|colour|кольоров)' then 'office-mfp-color'
      when name_text ~ '^(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат))'
        and name_text ~ '(mono|monochrome|монохром|чорно[ -]?білий|laserjet)' then 'office-mfp-mono'
      when name_text ~ '^(принтер|printer)'
        and (name_text ~ '(^|[^0-9])(2[1-9]|[3-9][0-9]|[1-9][0-9]{2})[[:space:]]*("|″|”|дюйм|inch|in\.)'
          or name_text ~ '(^|[^a-z0-9])a[0-2]([^a-z0-9]|$)')
        then 'office-wide-format'
      when name_text ~ '^(принтер|printer)'
        and name_text ~ '(color|colour|кольоров)' then 'office-printers-color'
      when name_text ~ '^(принтер|printer)'
        and name_text ~ '(mono|monochrome|монохром|чорно[ -]?білий|laserjet)' then 'office-printers-mono'
      when name_text ~ '^(сканер|scanner)' then 'office-scanners'
    end as expected_category
  from source
)
select
  id as "ID",
  name as "Товар",
  sku as "SKU",
  category as "Зараз у категорії",
  expected_category as "Має бути"
from expected
where expected_category is not null
  and category is distinct from expected_category
order by expected_category, name;

-- Підсумок розбіжностей за напрямком виправлення.
with source as (
  select category, lower(replace(trim(coalesce(name, '')), chr(39), '"')) as name_text
  from public.products where coalesce(is_active, true) = true
)
select
  case
    when name_text ~ '^(смартфон|smartphone|iphone)' then 'Смартфони поза своєю категорією'
    when name_text ~ '^(бфп|мфу|mfp|multifunction|багатофункціональн)' then 'БФП поза своєю категорією'
    when name_text ~ '^(принтер|printer)' then 'Принтери поза своєю категорією'
    when name_text ~ '^(сканер|scanner)' then 'Сканери поза своєю категорією'
  end as "Перевірка",
  count(*) as "Кількість"
from source
where (name_text ~ '^(смартфон|smartphone|iphone)' and category <> 'мобільнии-телефон')
   or (name_text ~ '^(бфп|мфу|mfp|multifunction|багатофункціональн)' and not (category ~ '^office-mfp' or category = 'office-wide-format'))
   or (name_text ~ '^(принтер|printer)' and not (category ~ '^office-printers' or category = 'office-wide-format'))
   or (name_text ~ '^(сканер|scanner)' and category <> 'office-scanners')
group by 1
order by 1;
