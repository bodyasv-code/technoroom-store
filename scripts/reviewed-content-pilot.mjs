import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
export const operation='reviewed-content-pilot-20261027';
export const upsSource='https://2e-world.com/en/products/2e-od1000-ups-1000va-900w-lcd-usb-2xschuko-2e-od1000/';
export const upsSpecifications={
 'Тип ДБЖ':'Онлайн із подвійним перетворенням',
 'Повна потужність':'1000 ВА','Активна потужність':'900 Вт',
 'Діапазон вхідної напруги':'176–280 В без зниження потужності; 110–176 В зі зниженням залежно від навантаження; 280–300 В зі зниженням потужності на 50%',
 'Частота вхідної напруги':'40–70 Гц','Вихідна напруга':'208 / 220 / 230 / 240 В',
 'Час перемикання на батарею':'0 мс','Вихідні розетки':'2 × Schuko',
 'Вбудовані акумулятори':'2 × 12 В, 9 А·год',
 'Тип акумулятора':'Герметичний свинцево-кислотний',
 'Час заряджання до 90%':'3 год',
 'Інтерфейси':'USB, RS-232; SNMP-адаптер — опція',
 'Дисплей':'LCD','Ступінь захисту':'IP20',
 'Робоча температура':'0–40 °C','Рівень шуму':'До 50 дБ (на відстані 1 м)'
};
export function reviewedPlans(rows,previous){
 if(rows.length!==3||new Set(rows.map(p=>p.id)).size!==3)throw new Error('Three exact cards required');
 return rows.map(p=>{
  if(p.id===576){if(p.sku!=='2E-OD1000'||p.brand!=='2E'||Object.keys(p.specifications||{}).length)throw new Error('UPS identity or empty table changed');}
  else {
   const known=previous.find(q=>q.id===p.id);
   if(!known||p.sku!==known.sku||p.brand!==known.brand||!isDeepStrictEqual(p.specifications,known.after.specifications)||p.description!==known.after.description)throw new Error('Reviewed card changed');
  }
  return {id:p.id,sku:p.sku,brand:p.brand,name:p.name,source:p.id===576?upsSource:previous.find(q=>q.id===p.id).source,
   protectDescription:p.id!==576,
   before:{specifications:p.specifications,description:p.description,manual_overrides:p.manual_overrides},
   after:{specifications:p.id===576?upsSpecifications:p.specifications,description:p.description,
    manual_overrides:{...p.manual_overrides,verified_specifications:true,...(p.id===576?{}:{description:true})}}};
 });
}
export function reviewedSql(plans,{operationId=operation,expectedIds=[247,576,4331]}={}){
 if(!/^[a-z0-9-]+$/.test(operationId)||!expectedIds.length||expectedIds.some(id=>!Number.isSafeInteger(id)||id<=0)||new Set(expectedIds).size!==expectedIds.length||plans.length!==expectedIds.length||new Set(plans.map(p=>p.id)).size!==expectedIds.length||plans.some(p=>!expectedIds.includes(p.id)))throw new Error('Exact unique scope required');
 const literal=JSON.stringify(plans).replaceAll("'","''");
 return `begin;
set local lock_timeout='5s';set local statement_timeout='30s';set local standard_conforming_strings=on;
create temporary table reviewed_plan(payload jsonb) on commit drop;
insert into reviewed_plan values('${literal}'::jsonb);
do $reviewed$
declare item jsonb;before_row jsonb;after_row jsonb;
begin
 if not(select relrowsecurity from pg_class where oid='technoroom_maintenance.product_repair_backup'::regclass) then raise exception 'Protected backup required';end if;
 if (select jsonb_array_length(payload) from reviewed_plan)<>${expectedIds.length} then raise exception 'Unexpected plan size';end if;
 perform id from public.products where id in (${[...expectedIds].sort((a,b)=>a-b).join(',')}) order by id for update;
 for item in select value from reviewed_plan,jsonb_array_elements(payload) loop
  select to_jsonb(p) into before_row from public.products p where id=(item->>'id')::bigint;
  if before_row is null or before_row->>'sku' is distinct from item->>'sku' or before_row->>'brand' is distinct from item->>'brand' or before_row->>'name' is distinct from item->>'name' then raise exception 'Identity changed';end if;
  if before_row->'specifications' is distinct from item->'before'->'specifications' or before_row->'description' is distinct from item->'before'->'description' or before_row->'manual_overrides' is distinct from item->'before'->'manual_overrides' then raise exception 'Card changed after preview';end if;
  if exists(select 1 from technoroom_maintenance.product_repair_backup where operation='${operationId}' and product_id=(item->>'id')::bigint) then raise exception 'Already backed up; verify before retry';end if;
  insert into technoroom_maintenance.product_repair_backup(operation,product_id,before_row,backed_up_at) values('${operationId}',(item->>'id')::bigint,before_row,now());
  insert into technoroom_maintenance.reviewed_product_content(product_id,sku,brand,source,protect_description,operation) values((item->>'id')::bigint,item->>'sku',item->>'brand',item->>'source',(item->>'protectDescription')::boolean,'${operationId}');
  -- A maintenance/manual write, never an importer write.
  perform set_config('technoroom.import_write','false',true);
  update public.products set specifications=item->'after'->'specifications' where id=(item->>'id')::bigint;
  select to_jsonb(p) into after_row from public.products p where id=(item->>'id')::bigint;
  if after_row->'specifications' is distinct from item->'after'->'specifications' or after_row->'description' is distinct from before_row->'description' or (after_row-array['specifications','manual_overrides','updated_at']) is distinct from (before_row-array['specifications','manual_overrides','updated_at']) or after_row->'manual_overrides' is distinct from item->'after'->'manual_overrides' then raise exception 'Unexpected side effect';end if;
 end loop;
end $reviewed$;
commit;`;
}
export function restoreUpsSql(plan){
 if(plan.id!==576||plan.sku!=='2E-OD1000'||plan.brand!=='2E')throw new Error('UPS identity required');
 const expected=JSON.stringify(plan.after).replaceAll("'","''");
 return `begin;
set local lock_timeout='5s';set local statement_timeout='30s';set local standard_conforming_strings=on;
create temporary table restore_ups_plan(payload jsonb) on commit drop;
insert into restore_ups_plan values('${expected}'::jsonb);
do $restore$
declare current_row jsonb;saved jsonb;expected jsonb;after_row jsonb;
begin
 select payload into expected from restore_ups_plan;
 perform id from public.products where id=576 for update;
 select to_jsonb(p) into current_row from public.products p where id=576;
 if current_row is null or current_row->>'sku'<>'2E-OD1000' or current_row->>'brand'<>'2E' then raise exception 'Identity changed';end if;
 if current_row->'specifications' is distinct from expected->'specifications' or current_row->'description' is distinct from expected->'description' or current_row->'manual_overrides' is distinct from expected->'manual_overrides' then raise exception 'UPS changed since enrichment';end if;
 select before_row into saved from technoroom_maintenance.product_repair_backup where operation='${operation}' and product_id=576;
 if saved is null then raise exception 'Backup missing';end if;
 perform set_config('technoroom.import_write','false',true);
 update public.products set specifications=saved->'specifications' where id=576;
 select to_jsonb(p) into after_row from public.products p where id=576;
 if after_row->'specifications' is distinct from saved->'specifications' or (after_row-array['specifications','updated_at']) is distinct from (current_row-array['specifications','updated_at']) then raise exception 'Unexpected restore side effect';end if;
end $restore$;
commit;`;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const config=await readFile(new URL('../public/supabase-config.js',import.meta.url),'utf8');
 const url=/url:\s*'([^']+)'/.exec(config)[1],key=/publishableKey:\s*'([^']+)'/.exec(config)[1];
 const endpoint=new URL('/rest/v1/products',url);endpoint.search=new URLSearchParams({select:'id,name,sku,brand,specifications,description,manual_overrides',id:'in.(247,576,4331)',order:'id'});
 const response=await fetch(endpoint,{headers:{apikey:key},signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Read failed '+response.status);
 const previous=JSON.parse(await readFile(new URL('../docs/manufacturer-pilot-plan-2026-10-27.json',import.meta.url),'utf8'));
 const plans=reviewedPlans(await response.json(),previous);
 await writeFile(new URL('../docs/reviewed-content-plan-2026-10-27.json',import.meta.url),JSON.stringify(plans,null,2)+'\n');
 await writeFile(new URL('../supabase/apply-reviewed-content-pilot-20261027.sql',import.meta.url),reviewedSql(plans)+'\n');
 await writeFile(new URL('../supabase/restore-reviewed-ups-20261027.sql',import.meta.url),restoreUpsSql(plans.find(p=>p.id===576))+'\n');
 console.log(JSON.stringify(plans.map(p=>({id:p.id,sku:p.sku,fields:Object.keys(p.after.specifications).length,protectDescription:p.protectDescription})),null,2));
}
