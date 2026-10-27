import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {reviewedSql} from './reviewed-content-pilot.mjs';
export const operationId='canon-075-content-20261027';
export const cartridges=[
 {id:4903,sku:'6365C002',series:'075',color:'Чорний',pages:1400,source:'https://www.canon.co.uk/store/store/canon-075-black-toner-cartridge/6365C002/'},
 {id:4904,sku:'6364C002',series:'075',color:'Блакитний (Cyan)',pages:1300,source:'https://www.canon.co.uk/store/canon-075-cyan-toner-cartridge/6364C002/'},
 {id:4905,sku:'6369C002',series:'075H',color:'Чорний',pages:3500,source:'https://www.canon.co.uk/store/canon-075-h-high-yield-black-toner-cartridge/6369C002/'},
 {id:4906,sku:'6368C002',series:'075H',color:'Блакитний (Cyan)',pages:2500,source:'https://www.canon.co.uk/store/canon-075-h-high-yield-cyan-toner-cartridge/6368C002/'}
];
export const expectedIds=cartridges.map(c=>c.id);
export function cartridgePlans(rows){
 if(rows.length!==4||new Set(rows.map(p=>p.id)).size!==4)throw new Error('Four unique cards required');
 return rows.map(p=>{
  const c=cartridges.find(c=>c.id===p.id);
  if(!c||p.sku!==c.sku||p.brand!=='Canon'||p.category!=='office-consumables-cartridges')throw new Error('Exact cartridge identity required');
  if(!p.specifications||Array.isArray(p.specifications)||Object.keys(p.specifications).length||Object.keys(p.manual_overrides?.specifications||{}).length||p.manual_overrides?.verified_specifications)throw new Error('Empty unprotected table required');
  return {id:p.id,sku:p.sku,brand:p.brand,name:p.name,source:c.source,protectDescription:false,
   before:{specifications:p.specifications,description:p.description,manual_overrides:p.manual_overrides},
   after:{specifications:{'Тип витратного матеріалу':'Тонер-картридж','Серія картриджа':c.series,'Колір друку':c.color,'Ресурс друку':`До ${c.pages} сторінок`,'Ємність картриджа':c.series==='075H'?'Підвищена':'Стандартна','Сумісний бренд':'Canon','Сумісні пристрої':'Canon i-SENSYS MF664Cdw; MF667Cdw; LBP646Cdw; LBP647Cdw'},description:p.description,manual_overrides:{...p.manual_overrides,verified_specifications:true}}};
 });
}
export const applyCartridgesSql=plans=>reviewedSql(plans,{operationId,expectedIds});
export function restoreCartridgesSql(plans){
 // Validate unique identities using the same generator as the apply path.
 applyCartridgesSql(plans);
 return `begin;
set local lock_timeout='5s';set local statement_timeout='30s';set local standard_conforming_strings=on;
create temporary table cartridge_restore_plan(payload jsonb) on commit drop;
insert into cartridge_restore_plan values('${JSON.stringify(plans).replaceAll("'","''")}'::jsonb);
do $restore$
declare item jsonb;current_row jsonb;saved jsonb;after_row jsonb;
begin
 perform id from public.products where id in (4903,4904,4905,4906) order by id for update;
 for item in select value from cartridge_restore_plan,jsonb_array_elements(payload) loop
  select to_jsonb(p) into current_row from public.products p where id=(item->>'id')::bigint;
  if current_row is null or current_row->>'sku' is distinct from item->>'sku' or current_row->>'brand' is distinct from item->>'brand' or current_row->>'name' is distinct from item->>'name' then raise exception 'Identity changed';end if;
  if current_row->'specifications' is distinct from item->'after'->'specifications' or current_row->'description' is distinct from item->'after'->'description' or current_row->'manual_overrides' is distinct from item->'after'->'manual_overrides' then raise exception 'Card changed since enrichment';end if;
  select before_row into saved from technoroom_maintenance.product_repair_backup where operation='${operationId}' and product_id=(item->>'id')::bigint;
  if saved is null then raise exception 'Backup missing';end if;
  perform set_config('technoroom.import_write','false',true);
  update public.products set specifications=saved->'specifications' where id=(item->>'id')::bigint;
  select to_jsonb(p) into after_row from public.products p where id=(item->>'id')::bigint;
  if after_row->'specifications' is distinct from saved->'specifications' or (after_row-array['specifications','updated_at']) is distinct from (current_row-array['specifications','updated_at']) then raise exception 'Unexpected restore side effect';end if;
 end loop;
end $restore$;
commit;`;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const config=await readFile(new URL('../public/supabase-config.js',import.meta.url),'utf8');
 const url=/url:\s*'([^']+)'/.exec(config)[1],key=/publishableKey:\s*'([^']+)'/.exec(config)[1];
 const endpoint=new URL('/rest/v1/products',url);endpoint.search=new URLSearchParams({select:'id,name,sku,brand,category,specifications,description,manual_overrides',id:'in.(4903,4904,4905,4906)',order:'id'});
 const response=await fetch(endpoint,{headers:{apikey:key},signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Read failed '+response.status);
 const plans=cartridgePlans(await response.json());
 await writeFile(new URL('../docs/canon-075-content-plan-2026-10-27.json',import.meta.url),JSON.stringify(plans,null,2)+'\n');
 await writeFile(new URL('../supabase/apply-canon-075-content-20261027.sql',import.meta.url),applyCartridgesSql(plans)+'\n');
 await writeFile(new URL('../supabase/restore-canon-075-content-20261027.sql',import.meta.url),restoreCartridgesSql(plans)+'\n');
 console.log(JSON.stringify(plans.map(p=>({id:p.id,sku:p.sku,fields:Object.keys(p.after.specifications).length})),null,2));
}
