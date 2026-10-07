-- TECHNOROOM: єдині категорії для принтерів і БФП.
-- Запустити ОДИН РАЗ у Supabase SQL Editor.
--
-- Нові XML-імпорти вже нормалізують назви в admin.js. Цей скрипт
-- переносить наявні товари зі старих варіантів на кшталт
-- «БФП лазерні кольорові» у чотири сталих категорії.
-- Дублікати не видаляються, а приховуються після перенесення товарів.

begin;

-- Сталі категорії, на які посилаються правила імпорту.
insert into public.categories (name, slug, parent_id, is_active)
select 'Кольорові принтери', 'office-printers-color', root.id, true
from public.categories root
where root.slug = 'office-equipment'
on conflict (slug) do update set
  name = excluded.name,
  parent_id = excluded.parent_id,
  is_active = true;

insert into public.categories (name, slug, parent_id, is_active)
select 'Монохромні принтери', 'office-printers-mono', root.id, true
from public.categories root
where root.slug = 'office-equipment'
on conflict (slug) do update set
  name = excluded.name,
  parent_id = excluded.parent_id,
  is_active = true;

insert into public.categories (name, slug, parent_id, is_active)
select 'Кольорові БФП', 'office-mfp-color', root.id, true
from public.categories root
where root.slug = 'office-equipment'
on conflict (slug) do update set
  name = excluded.name,
  parent_id = excluded.parent_id,
  is_active = true;

insert into public.categories (name, slug, parent_id, is_active)
select 'Монохромні БФП', 'office-mfp-mono', root.id, true
from public.categories root
where root.slug = 'office-equipment'
on conflict (slug) do update set
  name = excluded.name,
  parent_id = excluded.parent_id,
  is_active = true;

-- Перекидаємо товари лише зі старих категорій, де явно зазначено тип
-- пристрою та колір друку. Широкоформатні товари (A0–A2 / понад 20")
-- не зачіпаються: для них лишається окрема категорія.
with source_categories as (
  select
    c.slug as old_slug,
    lower(concat_ws(' ', c.name, c.slug)) as label
  from public.categories c
), moves as (
  select
    sc.old_slug,
    case
      when sc.label ~ '(бфп|мфу|mfp|multifunction|багатофункціональн)'
       and sc.label ~ '(color|colour|кольоров)' then 'office-mfp-color'
      when sc.label ~ '(бфп|мфу|mfp|multifunction|багатофункціональн)'
       and sc.label ~ '(mono|monochrome|монохром|чорно[ -]?білий)' then 'office-mfp-mono'
      when sc.label !~ '(бфп|мфу|mfp|multifunction|багатофункціональн)'
       and sc.label ~ '(принтер|printer)'
       and sc.label ~ '(color|colour|кольоров)' then 'office-printers-color'
      when sc.label !~ '(бфп|мфу|mfp|multifunction|багатофункціональн)'
       and sc.label ~ '(принтер|printer)'
       and sc.label ~ '(mono|monochrome|монохром|чорно[ -]?білий)' then 'office-printers-mono'
    end as new_slug
  from source_categories sc
  where sc.old_slug not in (
    'office-printers-color', 'office-printers-mono',
    'office-mfp-color', 'office-mfp-mono',
    'office-wide-format'
  )
    and sc.label !~ '(wide[ -]?format|широкоформат|\ba0\b|\ba1\b|\ba2\b)'
), applicable_moves as (
  select * from moves where new_slug is not null
)
update public.products p
set category = m.new_slug
from applicable_moves m
where p.category = m.old_slug
  and p.category <> m.new_slug;

-- Ховаємо звільнені старі псевдокатегорії. Дані лишаються в базі для аудиту.
with source_categories as (
  select
    c.id,
    c.slug,
    lower(concat_ws(' ', c.name, c.slug)) as label
  from public.categories c
), legacy_categories as (
  select sc.id
  from source_categories sc
  where sc.slug not in (
    'office-printers-color', 'office-printers-mono',
    'office-mfp-color', 'office-mfp-mono',
    'office-wide-format'
  )
    and sc.label !~ '(wide[ -]?format|широкоформат|\ba0\b|\ba1\b|\ba2\b)'
    and (
      (sc.label ~ '(бфп|мфу|mfp|multifunction|багатофункціональн)'
       and sc.label ~ '(color|colour|кольоров|mono|monochrome|монохром|чорно[ -]?білий)')
      or
      (sc.label !~ '(бфп|мфу|mfp|multifunction|багатофункціональн)'
       and sc.label ~ '(принтер|printer)'
       and sc.label ~ '(color|colour|кольоров|mono|monochrome|монохром|чорно[ -]?білий)')
    )
)
update public.categories c
set is_active = false
where c.id in (select id from legacy_categories)
  and not exists (select 1 from public.products p where p.category = c.slug);

-- Перевірка результату: у нормі залишаються тільки чотири категорії нижче.
select c.name, c.slug, count(p.id) as products
from public.categories c
left join public.products p on p.category = c.slug
where c.slug in (
  'office-printers-color', 'office-printers-mono',
  'office-mfp-color', 'office-mfp-mono'
)
group by c.id, c.name, c.slug
order by c.slug;

commit;
