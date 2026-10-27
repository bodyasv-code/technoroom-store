import {startImportRun,finishImportRun,historySetupMessage} from './import-history.js?v=20261020-manual';
import {articleContentMarker} from './article-format.js?v=20261027-content-format';
const columns='id,name,sku,brand,description,manual_overrides';
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const clone=value=>JSON.parse(JSON.stringify(value));
const escape=value=>String(value??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=value=>/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(String(value||''));
const descriptionOnly=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===1&&Object.hasOwn(value,'description');
const snapshot=row=>Object.fromEntries(['sku','brand','name','description','manual_overrides'].map(key=>[key,row[key]??null]));
const protectedDescription=row=>Boolean(row.manual_overrides?.description);
export function descriptionDraftText(draft){return [...(draft.paragraphs||[]),'',(draft.bullets||[]).map(text=>'- '+text).join('\n')].join('\n\n').trim();}
export function reviewedDescriptionHtml(text,reviewed){
  if(reviewed!==true)throw new Error('Підтвердьте перевірку української мови й технічних даних.');
  if(typeof text!=='string'||!text.trim()||text.length>40000)throw new Error('Опис має містити від 1 до 40 000 символів.');
  if(/[ыэъё]/iu.test(text))throw new Error('В описі є можливий російськомовний текст. Завершіть переклад.');
  if(/Керівництво/iu.test(text))throw new Error('Перевірте неоднозначне «Керівництво» перед збереженням.');
  const blocks=[];let list=[];
  const flush=()=>{if(list.length){blocks.push('<ul>'+list.map(line=>'<li>'+escape(line)+'</li>').join('')+'</ul>');list=[];}};
  for(const line of text.split(/\r?\n/u).map(value=>value.trim()).filter(Boolean)){
    if(/^(?:Bullet Points|Короткий підсумковий опис|Сумарний опис)(?:\s|:|$)/iu.test(line))throw new Error('Приберіть службові заголовки Icecat.');
    if(/^[-•]\s+/u.test(line))list.push(line.replace(/^[-•]\s+/u,''));
    else{flush();blocks.push('<p>'+escape(line)+'</p>');}
  }
  flush();return articleContentMarker+blocks.join('');
}
async function readProduct(db,id){
  if(!Number.isSafeInteger(id)||id<=0)throw new Error('Некоректний код товару.');
  const result=await db.from('products').select(columns).eq('id',id).maybeSingle();
  if(result.error||!result.data)throw new Error('Не вдалося прочитати актуальну картку. Нічого не записано.');
  return result.data;
}
export async function prepareDescriptionChange(db,identity,text,{reviewed=false,icecatId=null}={}){
  const after=reviewedDescriptionHtml(text,reviewed),row=await readProduct(db,identity.id);
  if(!row.sku||!row.brand||row.sku!==identity.sku||row.brand!==identity.brand||row.name!==identity.name)throw new Error('Товар або його ідентифікатори змінилися. Оновіть перегляд.');
  if(protectedDescription(row))throw new Error('Опис захищено ручною правкою. Автоматична заміна заборонена.');
  if(same(row.description,after))throw new Error('Опис уже збігається; запис не потрібен.');
  return clone({productId:row.id,sku:row.sku,name:row.name,brand:row.brand,before:row.description??null,after,expected:snapshot(row),operation:'replace',icecatId});
}
export async function prepareDescriptionRollback(db,runId,productId){
  if(!uuid(runId)||!Number.isSafeInteger(productId)||productId<=0)throw new Error('Некоректний код запису журналу або товару.');
  const result=await db.from('import_changes').select('id,run_id,product_id,sku,product_name,action,before_values,after_values').eq('run_id',runId).eq('product_id',productId).limit(2);
  if(result.error)throw new Error('Не вдалося прочитати резервну копію в журналі.');
  if(result.data?.length!==1)throw new Error('Потрібен рівно один запис зміни опису.');
  const entry=result.data[0];
  if(entry.action!=='updated'||!descriptionOnly(entry.before_values)||!descriptionOnly(entry.after_values)||typeof entry.after_values.description!=='string'||!(entry.before_values.description===null||typeof entry.before_values.description==='string'))throw new Error('Цей запис не є окремою заміною опису.');
  const row=await readProduct(db,productId);
  if(row.sku!==entry.sku||row.name!==entry.product_name||!same(row.description,entry.after_values.description)||protectedDescription(row))throw new Error('Після запису картку або опис змінено вручну. Відкат зупинено.');
  return clone({productId:row.id,sku:row.sku,name:row.name,brand:row.brand,before:row.description??null,after:entry.before_values.description,expected:snapshot(row),operation:'rollback',revertsRunId:runId});
}
export async function commitDescriptionChange(db,plan){
  if(!plan||!['replace','rollback'].includes(plan.operation)||!plan.expected||Object.keys(plan.expected).sort().join(',')!=='brand,description,manual_overrides,name,sku'||!same(plan.before,plan.expected.description)||!(plan.after===null||typeof plan.after==='string')||(!plan.after&&plan.operation==='replace')||(plan.operation==='rollback'&&!uuid(plan.revertsRunId)))throw new Error('Некоректний план опису.');
  const current=await readProduct(db,plan.productId);
  if(!same(snapshot(current),plan.expected)||protectedDescription(current))throw new Error('Опис або картка змінилися після підтвердження. Оновіть перегляд.');
  const runId=await startImportRun(db,{price:false,stock:false,category:false,specifications:false,images:false,publish:false,
    description:{enabled:true,source:'icecat-reviewed-description',operation:plan.operation,icecatId:plan.icecatId??null,revertsRunId:plan.revertsRunId??null}},1);
  let result;
  try{result=await db.rpc('apply_product_import',{p_run:runId,p_id:plan.productId,p_patch:{description:plan.after},p_expected:clone(plan.expected),p_images:false});}
  catch{throw new Error('Результат запису невідомий. Не повторюйте дію; перевірте журнал. Запуск: '+runId);}
  if(result.error){
    const known=/^(?:[0-9A-Z]{5}|PGRST\d{3})$/u.test(result.error.code||'');
    if(!known)throw new Error('Результат запису невідомий. Не повторюйте дію; перевірте журнал. Запуск: '+runId);
    await finishImportRun(db,runId,{failures:[{sku:plan.sku,reason:'Заміна опису відхилена; перевірте актуальність плану.'}]},true).catch(()=>{});
    throw new Error(['42883','PGRST202','42P01'].includes(result.error.code)?historySetupMessage:'Заміна опису відхилена. Товар не змінено цим запитом; оновіть перегляд.');
  }
  if(Number(result.data?.id)!==plan.productId)throw new Error('Неочікувана відповідь запису. Перевірте журнал, не повторюйте дію. Запуск: '+runId);
  let historyComplete=true;
  try{await finishImportRun(db,runId,{failures:[],unchanged:result.data.unchanged?1:0});}catch{historyComplete=false;}
  return {applied:true,runId,productId:plan.productId,historyComplete,
    warning:historyComplete?'':'Опис записано з резервною копією, але статус запуску не закрито. Перевірте журнал; не повторюйте запис.'};
}
