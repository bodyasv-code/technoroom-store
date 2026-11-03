-- One-time correction authorized by the store owner.
-- Evidence: user-provided MTI portal screenshot dated 2026-11-02,
-- product 3703528 / Epson V12H002AG0: "Потребує уточнення".
-- No product prices, quantities, content or publication flags are changed.
begin;
do $$
declare
  run_id constant uuid := '738d273b-4609-4439-b3db-2601fab9732c';
  owner_id uuid;
  p public.products;
  offer public.supplier_offers;
begin
  perform pg_advisory_xact_lock(hashtextextended('mti-request:'||run_id::text,0));
  if exists(select 1 from public.supplier_offer_runs where id=run_id) then return; end if;
  if (select count(*) from public.profiles where full_name='Bohdan' and role='owner')<>1 then
    raise exception 'Owner identity must be verified';
  end if;
  select id into owner_id from public.profiles where full_name='Bohdan' and role='owner';
  perform pg_advisory_xact_lock(hashtextextended('product-import:V12H002AG0',0));
  select * into strict p from public.products where id=1180 for update;
  if p.sku<>'V12H002AG0' or p.brand<>'Epson' or p.category<>'erc-display-06' then
    raise exception 'Product identity changed';
  end if;
  if exists(select 1 from public.supplier_offers where supplier='MTI' and supplier_sku='V12H002AG0') then
    raise exception 'A newer supplier offer exists; review before applying';
  end if;
  insert into public.supplier_offer_runs(id,actor_id,source_name,request_data)
    values(run_id,owner_id,'MTI portal screenshot 2026-11-02 / 3703528',jsonb_build_object(
      'action','owner-authorized stock clarification','sourceUrl','https://distri.mti.ua/orgtexnika/prezentaciine-obladnannya/projectionscreens/3703528',
      'sourceDate','2026-11-02','sourceStatus','Потребує уточнення','beforeProduct',to_jsonb(p)));
  insert into public.supplier_offers(supplier,supplier_sku,supplier_product_id,manufacturer_sku,brand,product_id,
      retail_price,supplier_price,currency,stock_quantity,stock_kind,source_row,run_id,content_evidence)
    values('MTI','V12H002AG0','3703528','V12H002AG0','Epson',1180,
      80039,null,'UAH',null,'needs_confirmation',1,run_id,
      '{"status":"existing-content-preserved","photosImported":false,"stockSource":"MTI portal screenshot 2026-11-02"}'::jsonb)
    returning * into offer;
  insert into public.supplier_offer_changes(run_id,supplier,supplier_sku,before_values,after_values,created_product_id)
    values(run_id,'MTI','V12H002AG0',null,to_jsonb(offer),null);
  insert into public.product_suppliers(product_id,supplier,supplier_sku,origin,last_seen_at)
    values(1180,'MTI','V12H002AG0','import',now())
    on conflict(product_id,supplier) do update set supplier_sku=excluded.supplier_sku,last_seen_at=excluded.last_seen_at;
  update public.supplier_offer_runs set result='{"offers":1,"linkedExisting":1,"createdDrafts":0,"published":0}'::jsonb where id=run_id;
end $$;
commit;
select p.id,p.sku,p.supplier_stock_uncertain,p.stock_quantity,p.in_stock,p.is_active,o.stock_kind,o.stock_quantity as mti_quantity
from public.products p join public.supplier_offers o on o.product_id=p.id and o.supplier='MTI' where p.id=1180;
