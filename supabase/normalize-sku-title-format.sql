-- TECHNOROOM: уніфікація старих назв товарів із SKU.
-- Приклад: «Кріплення проєктору Epson ELPMB68 — V12H006AE0»
--       -> «Кріплення проєктору Epson ELPMB68 (V12H006AE0)».
-- Працює для ВСІХ категорій. Не змінює описів, фото, цін або характеристик.
-- Скрипт можна безпечно запускати повторно.

begin;

with candidates as (
  select
    id,
    btrim(name) as current_name,
    btrim(sku) as clean_sku,
    rtrim(
      left(btrim(name), length(btrim(name)) - length(btrim(sku))),
      E' \t\r\n—–-'
    ) as base_name
  from public.products
  where nullif(btrim(sku), '') is not null
    and lower(right(btrim(name), length(btrim(sku)))) = lower(btrim(sku))
    and right(
      rtrim(left(btrim(name), length(btrim(name)) - length(btrim(sku))), E' \t\r\n'),
      1
    ) in ('—', '–', '-')
)
update public.products as product
set name = candidates.base_name || ' (' || candidates.clean_sku || ')'
from candidates
where product.id = candidates.id
  and candidates.base_name <> ''
  and product.name <> candidates.base_name || ' (' || candidates.clean_sku || ')';

commit;

-- Перевірка: результат має бути порожнім.
select name, sku, category
from public.products
where nullif(btrim(sku), '') is not null
  and lower(right(btrim(name), length(btrim(sku)))) = lower(btrim(sku))
  and right(
    rtrim(left(btrim(name), length(btrim(name)) - length(btrim(sku))), E' \t\r\n'),
    1
  ) in ('—', '–', '-')
order by name;
