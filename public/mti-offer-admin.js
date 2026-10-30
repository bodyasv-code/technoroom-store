import {prepareMtiOfferBatch,mtiOfferSnapshot,applyMtiOfferBatch} from './mti-offer-import.js?v=20261030-offers';
const escape=value=>String(value??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mtiOfferReviewMarkup(plan){
  return '<p>Пропозицій МТІ: '+plan.ready.length+'. Нових прихованих чернеток: '+plan.ready.filter(r=>!r.offer.expectedProductId).length+'. Відкладено: '+plan.deferred.length+'.</p><p>Ціни, залишки, описи та фото наявних карток не зміняться. Нові картки отримають РРЦ і точний залишок МТІ та залишаться прихованими до перевірки контенту. Фото з Icecat не завантажуються.</p><div class="table-wrap"><table><thead><tr><th>Артикул</th><th>Дія</th><th>РРЦ, ₴</th><th>Залишок МТІ</th><th>Опис</th></tr></thead><tbody>'+plan.ready.map(({offer})=>'<tr><td>'+escape(offer.brand)+' '+escape(offer.manufacturerSku)+'</td><td>'+escape(offer.expectedProductId?'Окрема пропозиція для наявного товару':'Нова прихована чернетка')+'</td><td>'+escape(offer.retailPrice)+'</td><td>'+escape(offer.quantity)+'</td><td>'+escape(offer.expectedProductId?'Наявний збережено':offer.draft.description?'Icecat, потрібна редакторська перевірка':'Контент потребує доповнення')+'</td></tr>').join('')+'</tbody></table></div>';
}
function review(plan){
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='import-review-dialog';
    dialog.innerHTML='<div class="import-review-header"><h2>Збереження пропозицій МТІ</h2></div><div class="import-review-body">'+mtiOfferReviewMarkup(plan)+'</div><div class="import-review-footer"><button type="button" data-cancel>Скасувати</button><button type="button" data-save>Зберегти '+plan.ready.length+' пропозицій</button></div>';
    let approved=false;dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
    dialog.querySelector('[data-save]').onclick=()=>{approved=true;dialog.close()};
    dialog.addEventListener('close',()=>{dialog.remove();resolve(approved)},{once:true});document.body.append(dialog);dialog.showModal();
  });
}
export function mountMtiOfferImport(panel,{client,getRows,getCatalog,getSourceName,onImported=()=>{}}){
  const controls=document.createElement('div');controls.className='import-report';
  controls.innerHTML='<h3>Зберегти пропозиції МТІ</h3><p>Зберігаються лише позиції без зауважень. Ціни й залишки МТІ обліковуються окремо від ERC. Нові картки завжди створюються прихованими; контент Icecat потребує редакторської перевірки.</p><button type="button" data-prepare>Підготувати пропозиції й контент Icecat</button> <button type="button" data-write disabled>Переглянути зміни та зберегти</button><p role="status" data-offer-message></p><div data-offer-plan></div>';
  panel.querySelector('[data-mti-results]').before(controls);
  const prepare=controls.querySelector('[data-prepare]'),write=controls.querySelector('[data-write]'),message=controls.querySelector('[data-offer-message]'),result=controls.querySelector('[data-offer-plan]');
  const saved=document.createElement('details');saved.innerHTML='<summary>Збережені пропозиції МТІ</summary><button type="button">Оновити список</button><div data-saved-offers></div>';controls.append(saved);
  const savedResult=saved.querySelector('[data-saved-offers]');
  async function loadSaved(){
    savedResult.textContent='Завантажую пропозиції…';
    const response=await client.from('supplier_offers').select('supplier_sku,brand,product_id,retail_price,supplier_price,stock_quantity,observed_at').eq('supplier','MTI').order('observed_at',{ascending:false}).limit(200);
    if(response.error){savedResult.textContent='Не вдалося прочитати пропозиції. Перевірте оновлення бази та права доступу.';return;}
    savedResult.innerHTML='<p>Показано останніх пропозицій: '+response.data.length+' (до 200).</p><div class="table-wrap"><table><thead><tr><th>Артикул</th><th>Картка</th><th>РРЦ МТІ, ₴</th><th>Ціна МТІ, ₴</th><th>Залишок МТІ</th></tr></thead><tbody>'+response.data.map(row=>'<tr><td>'+escape(row.brand)+' '+escape(row.supplier_sku)+'</td><td>'+escape(row.product_id)+'</td><td>'+escape(row.retail_price)+'</td><td>'+escape(row.supplier_price??'Не вказано')+'</td><td>'+escape(row.stock_quantity)+'</td></tr>').join('')+'</tbody></table></div>';
  }
  saved.querySelector('button').onclick=()=>loadSaved().catch(()=>{savedResult.textContent='Не вдалося прочитати пропозиції.';});
  let prepared=null,sourceRows=null,exclusions=[],previews=new Map(),generation=0,busy=false,requestId=null,abort=null;
  const reset=()=>{generation++;abort?.abort();prepared=null;requestId=null;previews=new Map();write.disabled=true;message.textContent='';result.replaceChildren();};
  async function readExclusions(){
    const values=[];
    for(let offset=0;;offset+=1000){const response=await client.from('product_import_exclusions').select('sku').eq('is_active',true).order('sku').range(offset,offset+999);if(response.error)throw new Error('Не вдалося перевірити виключення імпорту: '+response.error.message);values.push(...response.data.map(row=>row.sku));if(response.data.length<1000)return values;}
  }
  prepare.onclick=async()=>{
    if(busy)return;reset();const token=++generation;sourceRows=getRows();
    if(!sourceRows?.length||!Array.isArray(getCatalog())){message.textContent='Спочатку прочитайте прайс і дочекайтеся завантаження каталогу.';return;}
    busy=true;prepare.disabled=true;abort=new AbortController();
    try{
      const setup=await client.from('supplier_offers').select('supplier').limit(0);
      if(setup.error)throw new Error('Спочатку виконайте supplier-offers-upgrade.sql у Supabase SQL Editor. Імпорт не розпочато.');
      exclusions=await readExclusions();let plan=prepareMtiOfferBatch(sourceRows,getCatalog(),previews,exclusions);
      if(!plan.ready.length||plan.ready.length>100)throw new Error('Для одного запуску потрібно від 1 до 100 позицій без зауважень.');
      const fresh=plan.ready.filter(row=>!row.offer.expectedProductId);
      const {data:{session}}=await client.auth.getSession();if(!session?.access_token)throw new Error('Увійдіть в адмінку повторно.');
      let fetched=0,unavailable=0;
      for(const row of fresh){
        if(token!==generation)return;
        const original=sourceRows.find(item=>item.key===row.key);
        message.textContent='Контент Icecat: '+fetched+' із '+fresh.length+'. Товари ще не записуються.';
        try{
          const response=await fetch('/api/erc-catalog',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:'supplier-content-draft',product:{name:original.name,brand:original.vendor,sku:original.sku,category:original.category}}),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(25000)])});
          const data=await response.json();
          if(response.ok)previews.set(row.key,data.preview);else{unavailable++;if([401,403].includes(response.status))throw new Error('Доступ до контенту втрачено. Повторіть вхід.');if([429,503].includes(response.status))break;}
        }catch(error){if(token!==generation)return;if(/Доступ до контенту/.test(error.message))throw error;unavailable++;}
        fetched++;
      }
      if(token!==generation||sourceRows!==getRows())return;
      prepared=prepareMtiOfferBatch(sourceRows,getCatalog(),previews,exclusions);requestId=crypto.randomUUID();
      result.innerHTML=mtiOfferReviewMarkup(prepared);write.disabled=!prepared.ready.length;
      message.textContent='Готово до перегляду: '+prepared.ready.length+'. Відкладено: '+prepared.deferred.length+'. Контент нових карток без перевіреного джерела залишиться порожнім. Нічого не записано.';
    }catch(error){if(token===generation)message.textContent=error.message;}
    finally{busy=false;prepare.disabled=false;}
  };
  write.onclick=async()=>{
    if(busy||!prepared)return;
    if(sourceRows!==getRows()||!Array.isArray(getCatalog())||mtiOfferSnapshot(prepared)!==mtiOfferSnapshot(prepareMtiOfferBatch(sourceRows,getCatalog(),previews,exclusions))){reset();message.textContent='Дані змінилися. Підготуйте перегляд повторно.';return;}
    busy=true;prepare.disabled=true;write.disabled=true;
    try{
      if(!await review(prepared))return;
      message.textContent='Записую пропозиції МТІ…';
      const value=await applyMtiOfferBatch(client,prepared,{requestId,sourceName:getSourceName()});
      prepared=null;result.replaceChildren();
      message.textContent='Збережено пропозицій: '+value.offers+'. Прив’язано до наявних товарів: '+value.linkedExisting+'. Створено прихованих чернеток: '+value.createdDrafts+'. Опубліковано: 0. Журнал: '+value.runId;
      try{await onImported();}catch{message.textContent+=' Пропозиції збережено, але список товарів потрібно оновити.';}
      await loadSaved().catch(()=>{});
    }catch(error){message.textContent=error.message;}
    finally{busy=false;prepare.disabled=false;write.disabled=!prepared;}
  };
  return {reset};
}
