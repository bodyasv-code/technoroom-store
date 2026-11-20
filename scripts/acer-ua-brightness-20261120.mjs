import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export const operation='acer-ua-brightness-20261120';
export const source='https://www.acer.com/ua-uk/projectors/classroom/pdp/MR.JQU11.001';
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
export function acerBrightnessSql(plan,{restore=false}={}){
 if(plan.id!==6176||plan.sku!=='MR.JQU11.001'||plan.brand!=='Acer'||plan.source!==source||plan.reviewBefore!==null||plan.afterSpecifications.Яскравість!=='4000 ANSI лм')throw Error('Unexpected Acer plan');
 if(Object.keys(plan.afterSpecifications).length!==Object.keys(plan.beforeSpecifications).length+1||Object.entries(plan.beforeSpecifications).some(([key,value])=>JSON.stringify(plan.afterSpecifications[key])!==JSON.stringify(value)))throw Error('Only brightness may change');
 return `begin;
set local lock_timeout='5s';set local statement_timeout='30s';set local technoroom.import_write='false';
do $repair$
declare item jsonb:=${literal(plan)};old_row jsonb;new_row jsonb;expected_specs jsonb;expected_marks jsonb;
begin
 if not(select relrowsecurity from pg_class where oid='technoroom_maintenance.product_repair_backup'::regclass) then raise exception 'Private backup required';end if;
 select to_jsonb(p) into old_row from public.products p where id=6176 for update;
 if old_row is null or old_row->>'sku' is distinct from item->>'sku' or old_row->>'brand' is distinct from item->>'brand' then raise exception 'Acer identity changed';end if;
 ${restore?`
 if not exists(select 1 from technoroom_maintenance.product_repair_backup where operation='${operation}' and product_id=6176) then raise exception 'Backup missing';end if;
 if old_row->'specifications' is distinct from item->'afterSpecifications' or old_row->'manual_overrides' is distinct from (item->'beforeManualOverrides'||'{"reviewed_specifications":["Яскравість"]}'::jsonb) then raise exception 'Acer changed since repair';end if;
 if not exists(select 1 from technoroom_maintenance.reviewed_product_content where product_id=6176 and sku=item->>'sku' and brand=item->>'brand' and operation='${operation}' and source=item->>'source' and specification_keys=array['Яскравість'] and not protect_description) then raise exception 'Acer review changed';end if;
 delete from technoroom_maintenance.reviewed_product_content where product_id=6176 and operation='${operation}';
 expected_specs:=item->'beforeSpecifications';expected_marks:=item->'beforeManualOverrides';
 `:`
 if old_row->'specifications' is distinct from item->'beforeSpecifications' or old_row->'manual_overrides' is distinct from item->'beforeManualOverrides' then raise exception 'Acer changed after preview';end if;
 if exists(select 1 from technoroom_maintenance.reviewed_product_content where product_id=6176) then raise exception 'Acer review already exists';end if;
 insert into technoroom_maintenance.product_repair_backup(operation,product_id,before_row,backed_up_at) values('${operation}',6176,old_row,now());
 insert into technoroom_maintenance.reviewed_product_content(product_id,sku,brand,source,protect_description,specification_keys,operation) values(6176,item->>'sku',item->>'brand',item->>'source',false,array['Яскравість'],'${operation}');
 expected_specs:=item->'afterSpecifications';expected_marks:=item->'beforeManualOverrides'||'{"reviewed_specifications":["Яскравість"]}'::jsonb;
 `}
 update public.products set specifications=expected_specs where id=6176;
 select to_jsonb(p) into new_row from public.products p where id=6176;
 if new_row->'specifications' is distinct from expected_specs or new_row->'manual_overrides' is distinct from expected_marks or (new_row-array['specifications','manual_overrides','updated_at']) is distinct from (old_row-array['specifications','manual_overrides','updated_at']) then raise exception 'Unexpected Acer side effect';end if;
end $repair$;
commit;
`;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const live=JSON.parse(await readFile('.acer-ua-before-20261120.json','utf8')),p=live.product;
 if(Object.hasOwn(p.specifications,'Яскравість'))throw Error('Brightness already populated');
 const plan={id:p.id,sku:p.sku,brand:p.brand,source,reviewBefore:live.review,beforeSpecifications:p.specifications,beforeManualOverrides:p.manual_overrides,afterSpecifications:{...p.specifications,'Яскравість':'4000 ANSI лм'},evidence:{market:'Ukraine',manufacturerSummary:'Standard brightness 4000 lm',manufacturerTable:'4000 ANSI Lumens (Standard), 2880 ANSI Lumens (ECO)',supplierPrice:'4000 lm',decision:'Use the official Ukrainian page for the exact part as requested by the owner. Summary and detailed standard-mode brightness agree. Other inconsistent fields on the page are outside this change.'}};
 await writeFile('docs/acer-ua-brightness-plan-20261120.json',JSON.stringify(plan,null,2)+'\n');
 await writeFile('supabase/acer-ua-brightness-20261120.sql',acerBrightnessSql(plan));
 await writeFile('supabase/restore-acer-ua-brightness-20261120.sql',acerBrightnessSql(plan,{restore:true}));
}
