import {mergeImportedSpecifications} from './import-specification-rules.js?v=20261017-customer-content';
import {cleanCustomerText} from './product-content-policy.js?v=20261017-customer-content-3';
const same=(left,right)=>JSON.stringify(left??null)===JSON.stringify(right??null);
export const importUpdateDefaults={price:true,stock:true,specifications:true,images:false,category:false,description:true};
export function buildImportChangePlan(row,current,options={},category='') {
  const settings={...importUpdateDefaults,...options},patch={},changes=[],preserved=[];
  const change=(key,label,value)=>{if(!same(current?.[key],value)){patch[key]=value;changes.push({key,label,before:current?.[key]??null,after:value});}};
  if(!current){
    for(const [key,label,value] of [['name','Назва',row.name],['brand','Бренд',row.vendor],['category','Категорія',category],['price','Ціна, ₴',row.hasPrice?row.price:0],['stock_quantity','Залишок, шт.',row.hasStock?row.stock:0],['is_active','Публікувати',Boolean(settings.publish&&row.hasPrice&&Number(row.price)>0)],['description','Опис',cleanCustomerText(row.description||'')],['specifications','Характеристики',row.specifications||{}]])change(key,label,value);
    if(settings.images&&row.images?.length)changes.push({key:'images',label:'Фото',before:null,after:row.images});
    return {isNew:true,patch:{},changes,preserved:['Новий товар: ціна й залишок беруться з джерела; перемикачі оновлень захищають наявні товари'],images:settings.images&&row.images?.length?'add':'preserve'};
  }
  if(settings.category&&category)change('category','Категорія',category);
  if(settings.price&&row.hasPrice&&Number.isFinite(Number(row.price))&&Number(row.price)>0)change('price','Ціна, ₴',Number(row.price));
  else preserved.push('Ціна: збережено наявну');
  if(settings.stock&&row.hasStock&&Number.isFinite(Number(row.stock))&&Number(row.stock)>=0){
    change('stock_quantity','Залишок, шт.',Number(row.stock));
    change('in_stock','У наявності',Number(row.stock)>0);
    change('availability_status','Статус наявності',row.availabilityStatus||(row.stock>0?'in_stock':'out_of_stock'));
  }else preserved.push('Залишок: збережено наявний');
  if(settings.specifications){
    const merged=mergeImportedSpecifications(current.specifications,row.specifications,current);
    if(!same(current.specifications||{},merged)){
      patch.specifications=merged;
      for(const [key,value] of Object.entries(merged))if(!same(current.specifications?.[key],value))changes.push({key:'specifications.'+key,label:'Характеристика: '+key,before:current.specifications?.[key]??null,after:value});
      for(const key of Object.keys(current.specifications||{}))if(!Object.hasOwn(merged,key))changes.push({key:'specifications.'+key,label:'Очищення службового поля',before:'Службовий запис',after:null});
    }
  }
  preserved.push('Наявні значення характеристик не перезаписуються','Назва та бренд збережені');
  if(!settings.category)preserved.push('Категорія збережена');
  const description=cleanCustomerText(row.description||'');
  if(settings.description&&description&&!String(current.description||'').trim())change('description','Опис',description);
  else preserved.push('Наявний опис збережений');
  const hasImages=Boolean(current.image_path)||(current.image_paths||[]).some(Boolean);
  const images=settings.images&&row.images?.length&&!hasImages?'add':'preserve';
  if(images==='add')changes.push({key:'images',label:'Фото',before:null,after:row.images});
  else preserved.push('Наявні фото збережені');
  return {isNew:false,patch,changes,preserved,images};
}
export async function applyImportUpdate(client,current,plan) {
  if(!Object.keys(plan.patch).length)return {data:[{id:current.id}],error:null,unchanged:plan.images!=='add'};
  let request=client.from('products').update(plan.patch).eq('id',current.id).eq('sku',current.sku);
  for(const key of Object.keys(plan.patch))request=current[key]==null?request.is(key,null):request.eq(key,typeof current[key]==='object'?JSON.stringify(current[key]):current[key]);
  const result=await request.select('id');
  if(!result.error&&result.data?.length!==1)return {error:{message:'Товар змінився після перегляду. Оновіть попередній перегляд.'}};
  return result;
}
export const importSnapshot=product=>JSON.stringify(['id','sku','name','brand','category','price','stock_quantity','in_stock','availability_status','description','specifications','image_path','image_paths'].map(key=>product?.[key]??null));
const printable=value=>value==null?'—':Array.isArray(value)?value.join(', '):typeof value==='object'?JSON.stringify(value):String(value);
export function importChangeMarkup(plan,escape) {
  return (plan.changes.length?'<table class="import-change-table"><thead><tr><th>Поле</th><th>Було</th><th>Стане</th></tr></thead><tbody>'+plan.changes.map(change=>'<tr><th>'+escape(change.label)+'</th><td>'+escape(printable(change.before))+'</td><td>'+escape(printable(change.after))+'</td></tr>').join('')+'</tbody></table>':'<p>Змін для наявного товару немає.</p>')+'<ul>'+plan.preserved.map(text=>'<li>'+escape(text)+'</li>').join('')+'</ul>';
}
export function showImportChangePlans(plans,escape,{confirm=false}={}) {
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='import-review-dialog';
    dialog.innerHTML='<div class="import-review-header"><h2>'+(confirm?'Підтвердження імпорту':'Зміни товару: було → стане')+'</h2></div><div class="import-review-body"><p>Позицій: '+plans.length+'. '+(confirm?'Після підтвердження зміни буде записано.':'Це лише перегляд, товари не змінюються.')+'</p>'+plans.map(({row,plan})=>'<section><h3>'+escape(row.name)+' · '+escape(row.sku||'без SKU')+'</h3>'+importChangeMarkup(plan,escape)+'</section>').join('')+'</div><div class="import-review-footer"><button type="button" data-change-cancel>'+(confirm?'Скасувати':'Закрити')+'</button>'+(confirm?'<button type="button" data-review-approve>Підтвердити імпорт</button>':'')+'</div>';
    let approved=false;
    dialog.querySelector('[data-change-cancel]').onclick=()=>dialog.close();
    const submit=dialog.querySelector('[data-review-approve]');if(submit)submit.onclick=()=>{approved=true;dialog.close()};
    dialog.addEventListener('close',()=>{dialog.remove();resolve(approved)},{once:true});
    document.body.append(dialog);dialog.showModal();
  });
}
