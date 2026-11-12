import {planMtiStockInvalidations} from './mti-stock-invalidation.js';
export function mountMtiStockObservations(panel,{client,getRows,getSourceName,onImported=()=>{}}){
 const box=document.createElement('section');box.className='import-report';
 box.innerHTML='<h3>Невизначені залишки МТІ</h3><p>Дата — момент формування прайсу. Новіші перевірки постачальника зберігаються. Старий залишок МТІ перестане підтверджувати доступність; власний склад обліковується окремо.</p><label>Дата й час прайсу <input type="datetime-local" data-date></label> <button data-plan>Перевірити всі невизначені рядки</button> <button data-apply disabled>Застосувати перевірений пакет</button><pre data-result></pre>';
 panel.querySelector('[data-mti-results]').before(box);
 const date=box.querySelector('[data-date]'),prepare=box.querySelector('[data-plan]'),apply=box.querySelector('[data-apply]'),output=box.querySelector('[data-result]');
 let prepared=null,busy=false;
 const reset=()=>{prepared=null;apply.disabled=true;};date.onchange=reset;
 prepare.onclick=async()=>{if(busy)return;reset();busy=true;try{
  if(!date.value)throw new Error('Вкажіть дату й час формування прайсу.');
  const rows=getRows();if(!rows?.length)throw new Error('Спочатку прочитайте прайс.');
  const offers=[];for(let offset=0;;offset+=1000){const r=await client.from('supplier_offers').select('*').eq('supplier','MTI').order('supplier_sku').range(offset,offset+999);if(r.error)throw r.error;offers.push(...r.data);if(r.data.length<1000)break;}
  const excluded=await client.from('product_import_exclusions').select('sku').eq('is_active',true);if(excluded.error)throw excluded.error;
  const observedAt=new Date(date.value).toISOString();
  const plan=planMtiStockInvalidations(rows,offers,{sourceObservedAt:observedAt,excludedSkus:excluded.data.map(r=>r.sku)});
  output.textContent='Готово: '+plan.ready.length+'; потребують перевірки: '+plan.review.length+'\n'+plan.ready.map(r=>r.supplierSku+': '+r.expectedQuantity+' → залишок невідомий').join('\n')+'\n'+plan.review.map(r=>r.sku+': '+r.reason).join('\n');
  prepared={plan,rows,source:getSourceName(),observedAt,ids:[]};apply.disabled=!plan.ready.length;
 }catch(e){output.textContent=e.message;}finally{busy=false;}};
 apply.onclick=async()=>{if(busy||!prepared)return;busy=true;apply.disabled=true;prepare.disabled=true;try{
  if(prepared.rows!==getRows()||prepared.source!==getSourceName())throw new Error('Прайс змінився. Повторіть перевірку.');
  let completed=0;for(let i=0;i<prepared.plan.ready.length;i+=100){const index=i/100;prepared.ids[index]??=crypto.randomUUID();const rows=prepared.plan.ready.slice(i,i+100);
   const r=await client.rpc('apply_mti_stock_observations',{p_request:prepared.ids[index],p_source:prepared.source,p_observed_at:prepared.observedAt,p_rows:rows});if(r.error)throw r.error;if(r.data?.updated!==rows.length)throw new Error('Неочікуваний результат. Перевірте журнал.');completed+=rows.length;output.textContent='Застосовано '+completed+' із '+prepared.plan.ready.length+'.';}
  reset();await onImported();
 }catch(e){output.textContent+='\n'+e.message+' Повторне застосування продовжить той самий запуск.';apply.disabled=false;}finally{busy=false;prepare.disabled=false;}};
 return {reset};
}
