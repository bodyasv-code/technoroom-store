-- TECHNOROOM: прив'язати імпортовані лазерні проєктори до окремої підкатегорії.
-- Безпечно запускати повторно: будуть оновлені лише активні проєктори,
-- у назві яких є позначка LASER.

begin;

update public.products
set category = 'laser-proj'
where is_active = true
  and category in (
    'erc-display-03',
    'erc-display-11',
    'erc-display-12',
    'erc-display-13'
  )
  and upper(coalesce(name, '')) like '%LASER%';

commit;

