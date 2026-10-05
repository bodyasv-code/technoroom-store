-- TECHNOROOM: прибрати застарілу гілку ERC «ТВ, засоби відображення
-- інформації, оргтехніка», не втрачаючи товарів.
--
-- Запускати після repair-office-equipment-products.sql.
-- Безпечно запускати повторно: товари лише переносяться або категорії
-- вимикаються з навігації, нічого не видаляється.

begin;

-- Розкладаємо всі прямі товари зі старої збірної категорії. Якщо тип не
-- вдалося визначити однозначно, товар лишається у корені «Оргтехніка» —
-- не у застарілій категорії ERC.
with legacy_source as (
  select id, lower(concat_ws(' ', name, description, specifications::text)) as text
  from public.products
  where category in (
    'тв-засоби-відображення-інформаціі-оргтехніка',
    'tv-zasobi-vidobrazhennya-informatsiyi-orgtehnika'
  )
), distributed as (
  select id, case
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
    when text ~ '(лоток|підставк|стенд|tray|stand|accessor|аксесуар)' then 'office-accessories'
    else 'office-equipment'
  end as category
  from legacy_source
)
update public.products product
set category = distributed.category
from distributed
where product.id = distributed.id;

-- Підкатегорія зі старого XML дублює сучасну «Монохромні БФП».
update public.products
set category = 'office-mfp-mono'
where category = 'бфп-лазерні-монохромні';

-- Інші варіанти старого slug, які могли з'явитися залежно від кодування XML.
update public.products
set category = 'office-mfp-mono'
where category in (
  'bfp-laser-mono',
  'bfp-lazerni-monokhromni',
  'бфп-лазерні-монохромні'
);

-- Ці дублікати більше не показуються в каталозі або в адмін-навігації.
-- Рядки залишаються в БД, тож операцію можна скасувати без втрати даних.
update public.categories
set is_active = false
where slug in (
  'бфп-лазерні-монохромні',
  'bfp-laser-mono',
  'bfp-lazerni-monokhromni'
);

-- Якщо стара збірна гілка вже не має товарів і активних підкатегорій,
-- також прибираємо її з навігації. Наявні товари в інших її підкатегоріях
-- зберігають свої категорії й не приховуються.
update public.categories legacy
set is_active = false
where legacy.slug in (
  'тв-засоби-відображення-інформаціі-оргтехніка',
  'tv-zasobi-vidobrazhennya-informatsiyi-orgtehnika'
)
  and not exists (select 1 from public.products product where product.category = legacy.slug)
  and not exists (
    select 1 from public.categories child
    where child.parent_id = legacy.id and child.is_active = true
  );

commit;

-- Контрольний звіт: старі дублікати мають бути неактивні, а товари з них —
-- у «Монохромних БФП».
select category, count(*) as "Товарів"
from public.products
where category in ('office-mfp-mono', 'бфп-лазерні-монохромні', 'bfp-laser-mono', 'bfp-lazerni-monokhromni')
group by category
order by category;

select name, slug, is_active
from public.categories
where slug in (
  'бфп-лазерні-монохромні',
  'bfp-laser-mono',
  'bfp-lazerni-monokhromni',
  'тв-засоби-відображення-інформаціі-оргтехніка',
  'tv-zasobi-vidobrazhennya-informatsiyi-orgtehnika'
)
order by name;
