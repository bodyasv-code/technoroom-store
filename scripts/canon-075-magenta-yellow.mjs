import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {cartridgePlans,restoreCartridgesSql} from './canon-075-content.mjs';
import {reviewedSql} from './reviewed-content-pilot.mjs';
export const operationId='canon-075-magenta-yellow-20261028';
export const cartridges=[
 {id:4907,sku:'6367C002',series:'075H',color:'Пурпуровий (Magenta)',pages:2500,source:'https://www.canon.co.uk/store/canon-075-h-high-yield-magenta-toner-cartridge/6367C002/'},
 {id:4908,sku:'6366C002',series:'075H',color:'Жовтий',pages:2500,source:'https://www.canon.co.uk/store/canon-075-h-high-yield-yellow-toner-cartridge/6366C002/'},
 {id:4909,sku:'6363C002',series:'075',color:'Пурпуровий (Magenta)',pages:1300,source:'https://www.canon.co.uk/store/canon-075-magenta-toner-cartridge/6363C002/'},
 {id:4910,sku:'6362C002',series:'075',color:'Жовтий',pages:1300,source:'https://www.canon.co.uk/store/canon-075-yellow-toner-cartridge/6362C002/'}
];
export const scope={operationId,expectedIds:cartridges.map(c=>c.id)};
export const makePlans=rows=>cartridgePlans(rows,cartridges);
const enableTemporaryRls=(sql,table)=>{
 const declaration=`create temporary table ${table}(payload jsonb) on commit drop;`;
 if(!sql.includes(declaration))throw new Error('Expected temporary plan table required');
 return sql.replace(declaration,declaration+`\nalter table ${table} enable row level security;`);
};
export const applySql=plans=>enableTemporaryRls(reviewedSql(plans,scope),'reviewed_plan');
export const restoreSql=plans=>enableTemporaryRls(restoreCartridgesSql(plans,scope),'cartridge_restore_plan');
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const config=await readFile(new URL('../public/supabase-config.js',import.meta.url),'utf8');
 const url=/url:\s*'([^']+)'/.exec(config)[1],key=/publishableKey:\s*'([^']+)'/.exec(config)[1];
 const endpoint=new URL('/rest/v1/products',url);endpoint.search=new URLSearchParams({select:'id,name,sku,brand,category,specifications,description,manual_overrides',id:'in.(4907,4908,4909,4910)',order:'id'});
 const response=await fetch(endpoint,{headers:{apikey:key},signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Read failed '+response.status);
 const plans=makePlans(await response.json());
 await writeFile(new URL('../docs/canon-075-magenta-yellow-plan-2026-10-28.json',import.meta.url),JSON.stringify(plans,null,2)+'\n');
 await writeFile(new URL('../supabase/apply-canon-075-magenta-yellow-20261028.sql',import.meta.url),applySql(plans)+'\n');
 await writeFile(new URL('../supabase/restore-canon-075-magenta-yellow-20261028.sql',import.meta.url),restoreSql(plans)+'\n');
 console.log(JSON.stringify(plans.map(p=>({id:p.id,sku:p.sku,resource:p.after.specifications['Ресурс друку'],color:p.after.specifications['Колір друку']})),null,2));
}
