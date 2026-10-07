-- TECHNOROOM: короткі назви проєкторів.
-- Прибирає лише технічний перелік після першої коми та додає SKU у дужках.
-- Приклад: «Проєктор ... FHD, 230 lm, LED, Wi-Fi» →
--          «Проєктор ... FHD (SKU)».
-- Запустіть один раз у Supabase SQL Editor.

begin;

with projector_names as (
  select
    id,
    sku,
    name,
    btrim(regexp_replace(
      name,
      '\s*,\s*(?:\d{2,5}\s*(?:лм|lm)\b|(?:led|laser|ламп\w*|wi[ -]?fi|wireless|wlan|bluetooth|\mbt\M|hdmi|usb|tizen|android\s*tv)\b|\d+(?:[.,]\d+)?\s*(?::\s*1)?\b).*$',
      '',
      'i'
    )) as short_name
  from public.products
  where category in (
    'projectors', 'projector', 'laser-proj', 'home-projectors',
    'short-throw-projectors', 'installation-projectors', 'universal-projectors',
    'erc-display-03', 'erc-display-11', 'erc-display-12', 'erc-display-13'
  )
  and coalesce(name, '') ~* '^\s*(?:про[єе]ктор|projector)\b'
), without_old_sku_suffix as (
  select
    id,
    sku,
    case
      -- Старий формат: «Назва — SKU». Прибираємо саме SKU в кінці,
      -- тому дефіси, що є частиною моделі, не зачіпаються.
      when nullif(btrim(sku), '') is not null
        and lower(right(short_name, length(sku))) = lower(sku)
        then btrim(regexp_replace(left(short_name, length(short_name) - length(sku)), '\s*[—–-]\s*$', ''))
      else short_name
    end as base_name
  from projector_names
), prepared as (
  select
    id,
    case
      when nullif(btrim(sku), '') is not null
        and position(lower(sku) in lower(base_name)) = 0
        then base_name || ' (' || sku || ')'
      else base_name
    end as final_name
  from without_old_sku_suffix
)
update public.products product
set name = prepared.final_name
from prepared
where product.id = prepared.id
  and prepared.final_name <> product.name;

commit;

-- Перевірка результату.
select name, sku, category
from public.products
where category = 'projectors'
order by name;
