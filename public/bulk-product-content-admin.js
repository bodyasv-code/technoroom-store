import {bulkContentColumns,prepareBulkProductContent,commitBulkProductContent} from './bulk-product-content.js?v=20261030-bulk';
const esc=value=>String(value??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountBulkProductContent({client,getSelectedIds,onSaved,root=document}){
  const button=root.querySelector('#fillSelectedProductContent');if(!button)return;
  button.onclick=async()=>{
    const ids=[...getSelectedIds()];if(!ids.length||ids.length>20){alert('Оберіть від 1 до 20 товарів за допомогою прапорців.');return;}
    const dialog=root.createElement('dialog');dialog.className='import-review-dialog';
    dialog.innerHTML='<div class="import-review-header"><h2>Заповнення контенту вибраних товарів</h2></div><div class="import-review-body"><p>Джерело — Icecat, точний бренд і артикул. Додаються лише відсутній український опис і нові зіставлені характеристики. Наявні значення та ручні правки зберігаються. Ціни, залишки, фото й видимість не змінюються.</p><p role="status" aria-live="polite" data-status></p><div data-results></div><label><input type="checkbox" data-reviewed disabled> Перевірив український текст і характеристики вибраних доповнень</label></div><div class="import-review-footer"><button type="button" data-close>Скасувати пошук / закрити</button><button type="button" data-save disabled>Зберегти вибрані доповнення</button></div>';
    root.body.append(dialog);dialog.showModal();
    const find=s=>dialog.querySelector(s),status=find('[data-status]'),results=find('[data-results]'),reviewed=find('[data-reviewed]'),save=find('[data-save]');
    const controller=new AbortController();let plans=[],writing=false,consumed=false;
    dialog.addEventListener('cancel',event=>{if(writing)event.preventDefault();});
    dialog.addEventListener('close',()=>{controller.abort();dialog.remove();},{once:true});
    find('[data-close]').onclick=()=>{if(!writing)dialog.close();};
    const selected=()=>plans.filter(plan=>find('[data-pick="'+plan.productId+'"]')?.checked);
    const update=()=>{save.disabled=writing||consumed||!reviewed.checked||!selected().length;};
    reviewed.onchange=update;results.onchange=()=>{reviewed.checked=false;update();};
    try{
      const rows=await client.from('products').select(bulkContentColumns).in('id',ids);
      if(rows.error||rows.data?.length!==ids.length)throw new Error('Не вдалося прочитати всі вибрані картки.');
      const {data:{session}}=await client.auth.getSession();if(!session?.access_token)throw new Error('Увійдіть в адмінку повторно.');
      for(const [index,product] of rows.data.entries()){
        if(controller.signal.aborted)return;
        status.textContent='Пошук: '+(index+1)+' із '+ids.length+'. Запис ще не виконується.';
        let plan;
        try{
          const response=await fetch('/api/erc-catalog',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:'content-preview',productId:product.id}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])});
          const data=await response.json();
          if(!response.ok){if([401,403,429,503].includes(response.status))throw Object.assign(new Error(data.error||'Пошук тимчасово недоступний.'),{stop:true});throw new Error(data.error||'Контент не отримано.');}
          plan=prepareBulkProductContent(product,data.preview);
        }catch(error){if(controller.signal.aborted)return;if(error.stop)throw error;plan={productId:product.id,name:product.name,sku:product.sku,patch:{},notes:[error.name==='TimeoutError'?'Час пошуку вичерпано.':error.message]};}
        const ready=Object.keys(plan.patch).length>0;if(ready)plans.push(plan);
        results.insertAdjacentHTML('beforeend','<section class="import-report"><h3>'+(ready?'<input type="checkbox" checked data-pick="'+product.id+'" aria-label="Додати контент '+esc(product.sku)+'"> ':'')+esc(product.name)+' · '+esc(product.sku)+'</h3><p>'+esc((plan.notes||[]).join(' '))+'</p>'+(plan.patch.description?'<h4>Додати опис у порожнє поле</h4><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto">'+esc(plan.patch.description.replace(/<[^>]+>/gu,' ').replace(/&amp;/gu,'&'))+'</pre>':'')+(plan.added&&Object.keys(plan.added).length?'<h4>Додати характеристики</h4><dl>'+Object.entries(plan.added).map(([key,value])=>'<dt>'+esc(key)+'</dt><dd>'+esc(value)+'</dd>').join('')+'</dl>':'')+'</section>');
      }
      status.textContent='Пошук завершено. Товарів із доповненнями: '+plans.length+' із '+ids.length+'. Перевірте текст перед збереженням. Нічого не записано.';
      reviewed.disabled=!plans.length;
    }catch(error){if(!controller.signal.aborted)status.textContent=error.message+' Нічого не записано.';plans=[];}
    update();
    save.onclick=async()=>{
      if(save.disabled)return;writing=true;consumed=true;const approved=selected();update();find('[data-close]').disabled=true;reviewed.disabled=true;
      results.querySelectorAll('input').forEach(input=>input.disabled=true);
      status.textContent='Зберігаю перевірені доповнення з резервними копіями…';
      try{
        const result=await commitBulkProductContent(client,approved);
        status.textContent='Доповнено карток: '+result.applied+'. Без змін: '+result.unchanged+'. Помилок: '+result.failures.length+'. Журнал: '+result.runId+'.'+(result.uncertain?' Результат частини записів невідомий. Перевірте журнал; повторний запис у цьому перегляді заблоковано.':result.historyIncomplete?' Статус журналу не закрито; перевірте його перед повтором.':'')+' '+result.failures.map(f=>f.sku+': '+f.reason).join(' ');
        try{await onSaved();}catch{status.textContent+=' Оновіть список товарів.';}
      }catch(error){status.textContent=error.message+' Повторний запис у цьому перегляді заблоковано.';}
      finally{writing=false;find('[data-close]').disabled=false;update();}
    };
  };
}
