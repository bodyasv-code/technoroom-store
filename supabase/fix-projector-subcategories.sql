-- TECHNOROOM: one-time correction for items previously imported into
-- «Проєктори» just because their titles contained «проєктор/проектор».
-- Run in Supabase SQL Editor. It only changes currently misfiled products.

begin;

-- Lamps for projectors.
update public.products
set category = 'erc-display-14'
where category = 'projectors'
  and lower(coalesce(name, '')) ~ '(лампа|lamp)';

-- Mounting equipment: mounts, stands, frames, extension tubes and safety cables.
update public.products
set category = 'erc-display-10'
where category = 'projectors'
  and lower(coalesce(name, '')) ~ '(кріплен|mount|bracket|стійк|rack|рам[аи]|frame|труб[аи]|pipe|трос|safety[[:space:]]*cable)';

-- Projection optics.
update public.products
set category = 'erc-display-15'
where category = 'projectors'
  and lower(coalesce(name, '')) ~ '(об[’''`]?єктив|объектив|lens|оптика)';

-- Other equipment which names the projector only as a compatible device.
update public.products
set category = 'erc-display-08'
where category = 'projectors'
  and lower(coalesce(name, '')) ~ '(адаптер|adapter|кабель|cable|пульт|remote|кейс|case|сумк|bag|документ[ -]?камера|camera|стилус|stylus|фільтр|filter|ручка|pen|накoнечник|наконечник|блок управління|комутат)';

commit;

-- Verification: these groups should be in their corresponding subcategories.
select category, count(*) as products
from public.products
where category in ('projectors', 'erc-display-08', 'erc-display-10', 'erc-display-14', 'erc-display-15')
group by category
order by category;
