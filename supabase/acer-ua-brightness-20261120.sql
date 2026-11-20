begin;
set local lock_timeout='5s';set local statement_timeout='30s';set local technoroom.import_write='false';
do $repair$
declare item jsonb:='{"id":6176,"sku":"MR.JQU11.001","brand":"Acer","source":"https://www.acer.com/ua-uk/projectors/classroom/pdp/MR.JQU11.001","reviewBefore":null,"beforeSpecifications":{"Гарантія":"36 міс.","Призначення":"Короткофокусний","Джерело світла":"Лампа","Роздільна здатність":"1280 × 800","Технологія проєкції":"DLP","Проєкційне співвідношення":"0,52"},"beforeManualOverrides":{"brand":true,"category":true,"specifications":{"Гарантія":true}},"afterSpecifications":{"Гарантія":"36 міс.","Призначення":"Короткофокусний","Джерело світла":"Лампа","Роздільна здатність":"1280 × 800","Технологія проєкції":"DLP","Проєкційне співвідношення":"0,52","Яскравість":"4000 ANSI лм"},"evidence":{"market":"Ukraine","manufacturerSummary":"Standard brightness 4000 lm","manufacturerTable":"4000 ANSI Lumens (Standard), 2880 ANSI Lumens (ECO)","supplierPrice":"4000 lm","decision":"Use the official Ukrainian page for the exact part as requested by the owner. Summary and detailed standard-mode brightness agree. Other inconsistent fields on the page are outside this change."}}'::jsonb;old_row jsonb;new_row jsonb;expected_specs jsonb;expected_marks jsonb;
begin
 if not(select relrowsecurity from pg_class where oid='technoroom_maintenance.product_repair_backup'::regclass) then raise exception 'Private backup required';end if;
 select to_jsonb(p) into old_row from public.products p where id=6176 for update;
 if old_row is null or old_row->>'sku' is distinct from item->>'sku' or old_row->>'brand' is distinct from item->>'brand' then raise exception 'Acer identity changed';end if;
 
 if old_row->'specifications' is distinct from item->'beforeSpecifications' or old_row->'manual_overrides' is distinct from item->'beforeManualOverrides' then raise exception 'Acer changed after preview';end if;
 if exists(select 1 from technoroom_maintenance.reviewed_product_content where product_id=6176) then raise exception 'Acer review already exists';end if;
 insert into technoroom_maintenance.product_repair_backup(operation,product_id,before_row,backed_up_at) values('acer-ua-brightness-20261120',6176,old_row,now());
 insert into technoroom_maintenance.reviewed_product_content(product_id,sku,brand,source,protect_description,specification_keys,operation) values(6176,item->>'sku',item->>'brand',item->>'source',false,array['Яскравість'],'acer-ua-brightness-20261120');
 expected_specs:=item->'afterSpecifications';expected_marks:=item->'beforeManualOverrides'||'{"reviewed_specifications":["Яскравість"]}'::jsonb;
 
 update public.products set specifications=expected_specs where id=6176;
 select to_jsonb(p) into new_row from public.products p where id=6176;
 if new_row->'specifications' is distinct from expected_specs or new_row->'manual_overrides' is distinct from expected_marks or (new_row-array['specifications','manual_overrides','updated_at']) is distinct from (old_row-array['specifications','manual_overrides','updated_at']) then raise exception 'Unexpected Acer side effect';end if;
end $repair$;
commit;
