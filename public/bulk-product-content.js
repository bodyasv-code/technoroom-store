import {mtiDraftContent} from './mti-offer-import.js?v=20261030-offers';
import {manualSpecIdentity} from './product-manual-overrides.js?v=20261020-manual';
import {startImportRun,finishImportRun} from './import-history.js?v=20261020-manual';

export const bulkContentColumns='id,name,sku,brand,category,description,specifications,manual_overrides,is_active';
const clone=value=>JSON.parse(JSON.stringify(value));
const identity=value=>String(value??'').trim().toLowerCase();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const snapshot=product=>Object.fromEntries(bulkContentColumns.split(',').filter(key=>key!=='id').map(key=>[key,product[key]??null]));
const safe=value=>typeof value==='string'&&value.trim()&&!/[<>\x00-\x08ыэъё]/iu.test(value);

export function prepareBulkProductContent(product,preview){
  const base={productId:product.id,name:product.name,sku:product.sku,expected:snapshot(product),patch:{},notes:[]};
  if(!Number.isSafeInteger(product.id)||!product.sku||!product.brand){base.notes.push('Потрібні бренд і точний артикул.');return base;}
  if(preview?.status!=='review'||preview.product?.id!==product.id||identity(preview.product?.sku)!==identity(product.sku)||identity(preview.product?.brand)!==identity(product.brand)){
    base.notes.push('Не отримано підтвердженого контенту для точного бренду й артикула.');return base;
  }
  const content=mtiDraftContent({sku:preview.product.sku,vendor:product.brand,content:{name:product.name,specifications:{}}},preview);
  if(!String(product.description??'').trim()&&!product.manual_overrides?.description&&content.description)base.patch.description=content.description;
  else base.notes.push(product.description?'Наявний опис збережено.':'Український опис недоступний або захищений.');
  const specs={...(product.specifications||{})},added={};
  const occupied=new Set([...Object.keys(specs),...Object.keys(product.manual_overrides?.specifications||{})].map(key=>manualSpecIdentity(key,product)));
  const candidates=new Map();
  for(const field of preview.rows||[]){
    if(product.manual_overrides?.verified_specifications||field.status!=='new'||!field.mapping||(field.reasons||[]).length||(field.relatedCurrent||[]).length||(field.current||[]).length||!['UK','UA'].includes(field.language)||!safe(field.canonical)||!safe(field.value))continue;
    const key=manualSpecIdentity(field.canonical,product);
    if(occupied.has(key)||['__proto__','constructor','prototype'].includes(field.canonical))continue;
    const list=candidates.get(key)||[];list.push(field);candidates.set(key,list);
  }
  for(const list of candidates.values()){
    if(new Set(list.map(field=>field.value)).size!==1){base.notes.push('Суперечливе поле пропущено: '+list[0].canonical);continue;}
    added[list[0].canonical]=list[0].value;
  }
  if(Object.keys(added).length)base.patch.specifications={...specs,...added};
  base.added=added;base.icecatId=preview.icecatId??null;
  if(!Object.keys(base.patch).length)base.notes.push('Безпечних доповнень до порожніх полів немає.');
  return clone(base);
}

export async function commitBulkProductContent(db,plans){
  if(!Array.isArray(plans)||!plans.length||plans.length>20||new Set(plans.map(p=>p.productId)).size!==plans.length)throw new Error('Оберіть від 1 до 20 різних товарів із доповненнями.');
  for(const plan of plans){
    if(!plan.expected||!Object.keys(plan.patch||{}).length||Object.keys(plan.patch).some(key=>!['description','specifications'].includes(key)))throw new Error('Некоректний план контенту.');
    const fresh=await db.from('products').select(bulkContentColumns).eq('id',plan.productId).maybeSingle();
    if(fresh.error||!fresh.data||!same(snapshot(fresh.data),plan.expected))throw new Error('Картка змінилася після перегляду: '+plan.sku+'. Підготуйте пошук повторно.');
  }
  const runId=await startImportRun(db,{price:false,stock:false,category:false,description:{source:'icecat-bulk-reviewed',products:plans.map(p=>({id:p.productId,icecatId:p.icecatId}))},specifications:true,images:false,publish:false},plans.length);
  const result={runId,applied:0,unchanged:0,failures:[],uncertain:false};
  for(const plan of plans){
    let response;
    try{response=await db.rpc('apply_product_import',{p_run:runId,p_id:plan.productId,p_patch:plan.patch,p_expected:plan.expected,p_images:false});}
    catch{result.uncertain=true;result.failures.push({sku:plan.sku,reason:'Відповідь запису втрачена. Перевірте журнал перед повтором.'});break;}
    if(response.error){
      result.uncertain=!/^(?:[0-9A-Z]{5}|PGRST\d{3})$/u.test(response.error.code||'');
      result.failures.push({sku:plan.sku,reason:result.uncertain?'Результат невідомий; перевірте журнал.':response.error.message});break;
    }
    if(Number(response.data?.id)!==plan.productId){result.uncertain=true;result.failures.push({sku:plan.sku,reason:'Неочікувана відповідь; перевірте журнал.'});break;}
    if(response.data.unchanged)result.unchanged++;else result.applied++;
  }
  // Leave uncertain writes visibly unfinished; never retry automatically.
  if(!result.uncertain){try{await finishImportRun(db,runId,result,result.applied===0&&result.failures.length>0);}catch{result.historyIncomplete=true;}}
  return result;
}
