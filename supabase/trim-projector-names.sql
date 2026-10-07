-- TECHNOROOM: єдиний формат SKU у назвах товарів.
-- Для ВСІХ товарів: «Назва — SKU» → «Назва (SKU)».
-- Для всіх товарів додатково забирає технічний перелік після коми.
-- Характеристики товарів при цьому не змінюються.
-- Запустіть один раз у Supabase SQL Editor.

begin;

with source as (
  select
    id,
    sku,
    name,
    category,
    coalesce(name, '') ~* '^[[:space:]]*(?:про[єе]ктор|projector)(?:[[:space:][:punct:]]|$)' as is_projector,
    category in ('cat-projectors', 'projectors', 'erc-display-06', 'erc-display-14', 'erc-display-15')
      or coalesce(name, '') ~* '^[[:space:]]*(?:екран[[:space:]]+проекційн|проекційн[[:space:]]+екран|projection[[:space:]]+screen)(?:[[:space:][:punct:]]|$)' as is_projection_equipment,
    coalesce(name, '') ~* '^[[:space:]]*(?:принтер|printer|бфп|мфу|mfp|multifunction|багатофункціональн|сканер|scanner|копір|copier)(?:[[:space:][:punct:]]|$)' as is_office,
    coalesce(name, '') ~* '[[:space:]]*,[[:space:]]*(?:usb|hdmi|wi[ -]?fi|wireless|wlan|bluetooth|bt|ethernet|lan|nfc|led|oled|qled|fhd|uhd|4k|8k|ips|va|tn|amoled|rgb|hdr|ram|ssd|hdd|tizen|webos|android|windows|macos|ios|color|colour|mono|laser|ink|duplex|manual|motorized|electric|black|white|gray|grey|silver|чорн|білий|сірий|кольоров|монохром|лазер|струмен|дуплекс|ручн|моторизован|a[0-9]|[0-9]+[[:space:]]*(?:лм|lm|гб|gb|тб|tb|гц|hz|вт|w|кг|kg|мм|mm|dpi|ppm|mah|маг)|[0-9]+[[:space:]]*(?:x|х|×)[[:space:]]*[0-9]+|[0-9]+[[:space:]]*:[[:space:]]*[0-9]+)' as is_technical_tail
  from public.products
  where nullif(btrim(sku), '') is not null
), shortened as (
  select
    id,
    sku,
    name,
    is_projector,
    is_projection_equipment,
    is_office,
    is_technical_tail,
    case
      when is_projector then btrim(regexp_replace(
        name,
        '[[:space:]]*,[[:space:]]*(?:[0-9]{2,5}[[:space:]]*(?:лм|lm)|(?:led|laser|ламп[[:alnum:]_]*|wi[ -]?fi|wireless|wlan|bluetooth|bt|hdmi|usb|tizen|android[[:space:]]*tv)|[0-9]+(?:[.,][0-9]+)?[[:space:]]*(?::[[:space:]]*1)?).*$',
        '', 'i'
      ))
      when is_office then btrim(regexp_replace(
        name,
        '[[:space:]]*,[[:space:]]*(?:(?:a[0-9]|color|colour|mono(?:chrome)?|чорно[ -]?білий|кольоров[[:alnum:]_]*|лазер[[:alnum:]_]*|laser|струмен[[:alnum:]_]*|ink(?:jet)?|wi[ -]?fi|wireless|wlan|bluetooth|bt|ethernet|lan|usb|duplex|дуплекс|двосторон|[0-9]{1,4}[[:space:]]*(?:ppm|стр/хв|dpi|т/д))).*$',
        '', 'i'
      ))
      when is_projection_equipment then btrim(regexp_replace(
        name,
        '[[:space:]]*,[[:space:]]*(?:(?:[0-9]+[[:space:]]*(?:x|х|×)[[:space:]]*[0-9]+|[0-9]+[[:space:]]*:[[:space:]]*[0-9]+|manual|motorized|electric|настінн[[:alnum:]_]*|стельов[[:alnum:]_]*|моторизован[[:alnum:]_]*|ручн[[:alnum:]_]*|wi[ -]?fi|wireless|wlan|bluetooth|bt|hdmi|usb)).*$',
        '', 'i'
      ))
      when is_technical_tail then btrim(regexp_replace(
        name,
        '[[:space:]]*,[[:space:]]*(?:usb|hdmi|wi[ -]?fi|wireless|wlan|bluetooth|bt|ethernet|lan|nfc|led|oled|qled|fhd|uhd|4k|8k|ips|va|tn|amoled|rgb|hdr|ram|ssd|hdd|tizen|webos|android|windows|macos|ios|color|colour|mono|laser|ink|duplex|manual|motorized|electric|black|white|gray|grey|silver|чорн|білий|сірий|кольоров|монохром|лазер|струмен|дуплекс|ручн|моторизован|a[0-9]|[0-9]+[[:space:]]*(?:лм|lm|гб|gb|тб|tb|гц|hz|вт|w|кг|kg|мм|mm|dpi|ppm|mah|маг)|[0-9]+[[:space:]]*(?:x|х|×)[[:space:]]*[0-9]+|[0-9]+[[:space:]]*:[[:space:]]*[0-9]+).*$',
        '', 'i'
      ))
      else name
    end as short_name
  from source
), without_legacy_suffix as (
  select
    id,
    sku,
    name,
    is_projector,
    is_projection_equipment,
    is_office,
    is_technical_tail,
    short_name,
    nullif(btrim(sku), '') is not null
      and lower(right(short_name, length(sku))) = lower(sku)
      and left(short_name, length(short_name) - length(sku)) ~ '[—–-][[:space:]]*$' as has_legacy_suffix,
    case
      when nullif(btrim(sku), '') is not null
        and lower(right(short_name, length(sku))) = lower(sku)
        and left(short_name, length(short_name) - length(sku)) ~ '[—–-][[:space:]]*$'
        then btrim(regexp_replace(left(short_name, length(short_name) - length(sku)), '[[:space:]]*[—–-][[:space:]]*$', ''))
      else short_name
    end as base_name
  from shortened
), prepared as (
  select
    id,
    case
      when has_legacy_suffix then base_name || ' (' || sku || ')'
      when (is_technical_tail or is_projector or is_projection_equipment or is_office) and base_name <> name
        and position(lower(sku) in lower(base_name)) = 0
        then base_name || ' (' || sku || ')'
      else base_name
    end as final_name
  from without_legacy_suffix
)
update public.products product
set name = prepared.final_name
from prepared
where product.id = prepared.id
  and prepared.final_name <> product.name;

commit;

-- Перевірка: не має залишитися формату «— SKU» у кінці назви.
select name, sku, category
from public.products
where nullif(btrim(sku), '') is not null
  and lower(right(name, length(sku))) = lower(sku)
  and left(name, length(name) - length(sku)) ~ '[—–-][[:space:]]*$'
order by name;
