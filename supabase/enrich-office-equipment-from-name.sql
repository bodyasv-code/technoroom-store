-- TECHNOROOM: заповнює лише безпечні базові дані для старої оргтехніки,
-- де постачальник раніше не передав опис і характеристики.
-- Дані витягуються виключно з назви: тип пристрою, формат A3/A4/A5/A6,
-- а для явно позначених моделей — кольоровий або монохромний друк.
-- Наявні описи та характеристики не перезаписуються.

begin;

with source as (
  select id, name,
    lower(coalesce(name, '')) as text,
    case
      when lower(coalesce(name, '')) ~ '(бфп|мфу|mfp|multifunction|багатофункціональн[^ ]*[[:space:]]+(пристрій|апарат))' then 'БФП'
      when lower(coalesce(name, '')) ~ '(принтер|printer)' then 'Принтер'
      when lower(coalesce(name, '')) ~ '(сканер|scanner)' then 'Сканер'
      when lower(coalesce(name, '')) ~ '(копір|копир|copier)' then 'Копір'
      when lower(coalesce(name, '')) ~ '(ламінатор|ламинатор|laminator)' then 'Ламінатор'
      when lower(coalesce(name, '')) ~ '(знищувач|шредер|shredder)' then 'Знищувач документів'
    end as device_type,
    (regexp_match(upper(coalesce(name, '')), '(^|[^A-Z0-9])A([3-6])([^A-Z0-9]|$)'))[2] as paper_size,
    case
      when lower(coalesce(name, '')) ~ '(color|colour|кольоров)' then 'Кольоровий'
      when lower(coalesce(name, '')) ~ '(mono|monochrome|монохром|чорно[ -]?білий)' then 'Монохромний'
    end as print_type
  from public.products
  where category like 'office-%'
), prepared as (
  select id, device_type, paper_size, print_type,
    jsonb_strip_nulls(jsonb_build_object(
      'Тип пристрою', device_type,
      'Формат', case when paper_size is not null then 'A' || paper_size end,
      'Тип друку', print_type
    )) as inferred_specs
  from source
  where device_type is not null
)
update public.products product
set specifications = case
      when product.specifications is null or product.specifications = '{}'::jsonb then prepared.inferred_specs
      else product.specifications
    end,
    description = case
      when nullif(trim(coalesce(product.description, '')), '') is null
        then prepared.device_type || coalesce(' формату A' || prepared.paper_size, '') || '. Детальні характеристики уточнюються.'
      else product.description
    end
from prepared
where product.id = prepared.id
  and (
    product.specifications is null
    or product.specifications = '{}'::jsonb
    or nullif(trim(coalesce(product.description, '')), '') is null
  );

commit;

-- Лише для контролю: позиції, для яких назви недостатньо для безпечного опису.
select id, name, sku, category
from public.products
where category like 'office-%'
  and (specifications is null or specifications = '{}'::jsonb)
order by name;
