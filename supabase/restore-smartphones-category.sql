-- TECHNOROOM: аварійно повертає смартфони до правильного розділу.
-- Виправляє наслідок старого правила, яке могло прочитати слово
-- «Scanner» у технічних характеристиках iPhone як тип товару.
-- Торкається лише товарів, назва яких починається зі смартфона / iPhone;
-- чохли, кабелі, дисплеї та інші аксесуари не змінюються.

begin;

update public.products product
set category = 'мобільнии-телефон'
where lower(trim(coalesce(product.name, '')))
      ~ '^(смартфон|smartphone|iphone|мобільн(ий|ого)[[:space:]]+телефон)'
  and lower(coalesce(product.name, ''))
      !~ '(чохол|case|cover|захисн[^ ]*[[:space:]]+скло|screen[[:space:]]+protector|кабель|cable|зарядн|charger|адаптер|adapter|дисплей|екран|display|запчастин|repair)';

commit;

-- Контроль: усі смартфони повинні бути лише у «Мобільному телефоні».
select category, count(*) as "Товарів"
from public.products
where lower(trim(coalesce(name, '')))
      ~ '^(смартфон|smartphone|iphone|мобільн(ий|ого)[[:space:]]+телефон)'
  and lower(coalesce(name, ''))
      !~ '(чохол|case|cover|захисн[^ ]*[[:space:]]+скло|screen[[:space:]]+protector|кабель|cable|зарядн|charger|адаптер|adapter|дисплей|екран|display|запчастин|repair)'
group by category
order by category;
