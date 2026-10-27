import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const canon='https://canon.a.bigcontent.io/v1/static/i-sensys-mf664cdw_i-sensys-mf667cdw_datasheet_uk_final_hr_b009b90bce574bdbb3acd807cc13aea1';
const epson='https://www.epson-africa.com/projectors/professional/business-education/eb-994f-v11hb60042';
export const operation='manufacturer-pilot-20261027';
export function planManufacturerPilot(p){
  const expected=p.id===247?['V11HB60042','Epson']:p.id===4331?['6928C001','Canon']:null;
  if(!expected||p.sku!==expected[0]||p.brand!==expected[1])throw new Error('Exact pilot identity required');
  const s=structuredClone(p.specifications||{});let description=p.description;
  if(p.id===247){
    delete s['Джерело світла (тип, термін роботи)'];
    Object.assign(s,{'Ресурс джерела світла (звичайний режим)':'6500 год','Ресурс джерела світла (екорежим)':'17000 год','Енергоспоживання (Вт)':'284 (звичайний режим)','Енергоспоживання (екорежим)':'181 Вт','Енергоспоживання (режим очікування)':'0,3 Вт','Габарити (мм)':'309 × 293 × 105 (Ш × Г × В)'});
  }else{
    for(const k of ['дозвіл',"пам'ять",'Інтерфейс','Сканер (швидкість','Mopria, Canon PRINT Business -SENSYS MF667Cdw','багатоадресне розсилання','пристрій автоматичної подачі документів (ADF)','до 15 зображень/хв. двосторонній друк до 15 зобр./хв., (A4), дозвіл','10Base-T/100BASE-TX/1000Base-T, бездротовий 802.11b/g/n, бездротове пряме підключення Панель керування'])delete s[k];
    Object.assign(s,{'макс. кількість копій':'999','Мови опису':'UFRII, PCL 5c, PCL6, Adobe PostScript 3','Роздільна здатність друку':'1200 × 1200 dpi','Роздільна здатність копіювання':'600 × 600 dpi','Оптична роздільна здатність сканування':'600 × 600 dpi','Покращена роздільна здатність сканування':'9600 × 9600 dpi','Пам’ять факсу':'До 512 сторінок','Оперативна пам’ять':'1 ГБ','Швидкість факсу':'33,6 кбіт/с','Максимальна кількість адресатів факсу':'299','Інтерфейси':'USB 2.0 Hi-Speed; Ethernet 10/100/1000Base-T; Wi-Fi 802.11b/g/n; пряме бездротове підключення','ADF':'Є (двосторонній, однопрохідний)','Місткість ADF':'50 аркушів','Щільність паперу ADF':'50–105 г/м²','Щільність паперу':'60–163 г/м²; до 200 г/м² для крейдованого паперу','Додаткові функції друку':'Захищений друк; друк з USB; AirPrint; Canon PRINT; Mopria; Microsoft Universal Print; друк штрих-кодів з додатковим комплектом E1E'});
    Object.assign(s,{'Глибина кольору сканування':'24 біти (вхід / вихід)','Швидкість двостороннього друку':'До 15 зобр/хв (A4)','Час виходу першої сторінки':'Ч/б: до 10,90 с; колір: до 10,93 с'});
    if(typeof s['Витратні матеріали']==='string')s['Витратні матеріали']=s['Витратні матеріали'].replace(' '+canon,'');
    description='<!--technoroom-rich-text:v1--><p>Canon i-SENSYS MF667Cdw (6928C001) — кольоровий лазерний БФП формату A4 для друку, копіювання, сканування та роботи з факсом.</p><p>Пристрій підтримує автоматичний двосторонній друк і має однопрохідний двосторонній автоподавач документів. Для підключення доступні USB, Ethernet та Wi-Fi. Керування здійснюється через кольоровий сенсорний дисплей.</p><p>Параметри друку, копіювання й сканування наведено окремо в таблиці характеристик.</p>';
  }
  const changes=Object.keys({...p.specifications,...s}).filter(k=>JSON.stringify(p.specifications?.[k])!==JSON.stringify(s[k]));
  for(const k of changes)if(p.manual_overrides?.specifications?.[k])throw new Error('Manual field protected: '+k);
  if(description!==p.description&&p.manual_overrides?.description)throw new Error('Manual description protected');
  return {id:p.id,sku:p.sku,brand:p.brand,name:p.name,source:p.id===247?epson:canon,before:{specifications:p.specifications,description:p.description,manual_overrides:p.manual_overrides??{}},after:{specifications:s,description},changes};
}
const literal=x=>"'"+JSON.stringify(x).replace(/'/g,"''")+"'::jsonb";
export function manufacturerSql(plans,{rollback=false}={}){
  const payload=literal(plans);
  return `-- Exact manufacturer pilot, two products only. No price/stock/photo/access changes.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';set local standard_conforming_strings=on;
create temporary table manufacturer_plan(payload jsonb) on commit drop;
insert into manufacturer_plan values(${payload});
do $pilot$
declare item jsonb; original_row jsonb; after_row jsonb; saved jsonb; changed_key text;
begin
 if not (select relrowsecurity from pg_class where oid='technoroom_maintenance.product_repair_backup'::regclass) then raise exception 'Protected backup table required';end if;
 if (select jsonb_array_length(payload) from manufacturer_plan)<>2 then raise exception 'Unexpected pilot size';end if;
 perform id from products where id in (247,4331) order by id for update;
 for item in select value from manufacturer_plan,jsonb_array_elements(payload) loop
  if not ((item->>'id'='247' and item->>'sku'='V11HB60042' and item->>'brand'='Epson') or (item->>'id'='4331' and item->>'sku'='6928C001' and item->>'brand'='Canon')) then raise exception 'Unexpected identity';end if;
  select to_jsonb(p) into original_row from products p where id=(item->>'id')::bigint;
  if original_row is null or original_row->>'sku' is distinct from item->>'sku' or original_row->>'brand' is distinct from item->>'brand' or original_row->>'name' is distinct from item->>'name' then raise exception 'Identity changed';end if;
  ${rollback?`select before_row into saved from technoroom_maintenance.product_repair_backup where operation='${operation}' and product_id=(item->>'id')::bigint;
  if saved is null then raise exception 'Backup missing';end if;
  if original_row->'specifications' is distinct from item->'after'->'specifications' or original_row->'description' is distinct from item->'after'->'description' or coalesce(original_row->'manual_overrides','{}'::jsonb) is distinct from item->'before'->'manual_overrides' then raise exception 'Card changed after repair';end if;`:`if exists(select 1 from technoroom_maintenance.product_repair_backup where operation='${operation}' and product_id=(item->>'id')::bigint) then raise exception 'Backups already exist; verify before retry';end if;
  if original_row->'specifications' is distinct from item->'before'->'specifications' or original_row->'description' is distinct from item->'before'->'description' or coalesce(original_row->'manual_overrides','{}'::jsonb) is distinct from item->'before'->'manual_overrides' then raise exception 'Precondition changed';end if;
  for changed_key in select jsonb_object_keys(coalesce(original_row->'manual_overrides'->'specifications','{}'::jsonb)) loop
   if coalesce(original_row->'specifications'->changed_key,'null'::jsonb) is distinct from coalesce(item->'after'->'specifications'->changed_key,'null'::jsonb) then raise exception 'Manual specification protected';end if;
  end loop;
  if original_row->'manual_overrides'->>'description'='true' and original_row->'description' is distinct from item->'after'->'description' then raise exception 'Manual description protected';end if;
  insert into technoroom_maintenance.product_repair_backup(operation,product_id,before_row,backed_up_at) values('${operation}',(item->>'id')::bigint,original_row,now());`}
  perform set_config('technoroom.import_write','true',true);
  update products set specifications=${rollback?"saved->'specifications'":"item->'after'->'specifications'"},description=${rollback?"saved->>'description'":"item->'after'->>'description'"} where id=(item->>'id')::bigint;
  select to_jsonb(p) into after_row from products p where id=(item->>'id')::bigint;
  if after_row->'specifications' is distinct from ${rollback?"saved->'specifications'":"item->'after'->'specifications'"} or after_row->'description' is distinct from ${rollback?"saved->'description'":"item->'after'->'description'"} or (after_row-array['specifications','description','updated_at']) is distinct from (original_row-array['specifications','description','updated_at']) then raise exception 'Unexpected product side effect';end if;
 end loop;
end $pilot$;
commit;`;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const config=await readFile(new URL('../public/supabase-config.js',import.meta.url),'utf8');
 const url=/url:\s*'([^']+)'/.exec(config)[1],key=/publishableKey:\s*'([^']+)'/.exec(config)[1];
 const endpoint=new URL('/rest/v1/products',url);endpoint.search=new URLSearchParams({select:'id,name,sku,brand,category,description,specifications,manual_overrides',id:'in.(247,4331)',order:'id'});
 const response=await fetch(endpoint,{headers:{apikey:key},signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Read failed '+response.status);
 const rows=await response.json();if(rows.length!==2)throw new Error('Two exact products required');const plans=rows.map(planManufacturerPilot);
 await writeFile(new URL('../docs/manufacturer-pilot-plan-2026-10-27.json',import.meta.url),JSON.stringify(plans,null,2)+'\n');
 await writeFile(new URL('../supabase/repair-manufacturer-pilot-20261027.sql',import.meta.url),manufacturerSql(plans)+'\n');
 await writeFile(new URL('../supabase/rollback-manufacturer-pilot-20261027.sql',import.meta.url),manufacturerSql(plans,{rollback:true})+'\n');
 console.log(JSON.stringify(plans.map(p=>({id:p.id,sku:p.sku,changes:p.changes,descriptionChanged:p.before.description!==p.after.description})),null,2));
}
