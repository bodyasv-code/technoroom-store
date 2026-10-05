-- TECHNOROOM: прибрати застарілу гілку ERC «ТВ, засоби відображення
-- інформації, оргтехніка», не втрачаючи товарів.
--
-- Запускати після repair-office-equipment-products.sql.
-- Безпечно запускати повторно: товари лише переносяться або категорії
-- вимикаються з навігації, нічого не видаляється.

begin;

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
