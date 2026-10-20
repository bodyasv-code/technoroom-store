import {importChangeMarkup} from './import-change-plan.js?v=20261020-manual';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={running:'Не завершено / виконується',completed:'Завершено',partial:'Частково виконано',failed:'Помилка'};
const fields={name:'Назва',slug:'URL',sku:'SKU',brand:'Бренд',brand_id:'ID бренду',category:'Категорія',price:'Ціна, ₴',stock_quantity:'Залишок, шт.',in_stock:'У наявності',availability_status:'Статус наявності',description:'Опис',specifications:'Характеристики',is_active:'Публікувати',image_path:'Головне фото',image_paths:'Галерея'};
export const historySetupMessage='Журнал ще не підключено. Виконайте supabase/import-history-upgrade.sql у Supabase SQL Editor. Товари не змінено.';
const setupError=error=>['42P01','42883','PGRST202','PGRST205'].includes(error?.code);
export async function startImportRun(db,options,count){
  const result=await db.rpc('start_product_import',{p_options:options,p_count:count});
  if(result.error)throw new Error(setupError(result.error)?historySetupMessage:result.error.message);
  return result.data;
}
export async function writeImportProduct(db,runId,current,patch,{images=false,supplier=null}={}){
  if(current&&!Object.keys(patch).length&&!supplier)return {data:{id:current.id,unchanged:true},error:null};
  const expected=current?Object.fromEntries(['sku',...Object.keys(patch)].map(key=>[key,current[key]??null])):{};
  if(current&&Object.hasOwn(current,'manual_overrides'))expected.manual_overrides=current.manual_overrides;
  if(supplier)return db.rpc('apply_product_supplier_import',{p_run:runId,p_id:current?.id??null,p_patch:patch,p_expected:expected,p_supplier:supplier});
  return db.rpc('apply_product_import',{p_run:runId,p_id:current?.id??null,p_patch:patch,p_expected:expected,p_images:images});
}
export async function finishImportRun(db,runId,report,failed=false){
  const result=await db.rpc('finish_product_import',{p_run:runId,p_errors:(report.failures||[]).map(({sku,reason})=>({sku,reason})),p_unchanged:report.unchanged||0,p_failed:failed});
  if(result.error)throw new Error('Не вдалося завершити журнал. Записані зміни збережено, але запуск залишиться незавершеним. '+result.error.message);
}
export function importHistoryDetailsMarkup(changes){
  return changes.map(change=>'<section><h3>'+escape(change.product_name)+' · '+escape(change.sku)+' — '+(change.action==='created'?'Створено':change.action==='images'?'Додано фото':'Оновлено')+'</h3>'+importChangeMarkup({changes:Object.entries(change.after_values||{}).map(([key,after])=>({label:fields[key]||key,before:change.before_values?.[key]??null,after})),preserved:[]},escape)+'</section>').join('')||'<p>Записаних змін товарів немає.</p>';
}
export function mountImportHistory(db,anchor){
  const panel=document.createElement('section');panel.className='import-report';
  panel.innerHTML='<h3>Журнал імпорту</h3><p>Історія зберігається з моменту підключення журналу. Незавершений запуск міг частково змінити товари — відкрийте деталі. Автоматичне відновлення поки не виконується.</p><button type="button" data-history-refresh>Оновити журнал</button><div data-history-list></div>';
  anchor.after(panel);
  const list=panel.querySelector('[data-history-list]');let offset=0;
  const load=async()=>{
    list.textContent='Завантаження журналу…';
    const result=await db.from('import_runs').select('id,started_at,status,selected_count,unchanged_count,errors').order('started_at',{ascending:false}).range(offset,offset+19);
    if(result.error){list.textContent=setupError(result.error)?historySetupMessage:'Не вдалося прочитати журнал. '+result.error.message;return;}
    list.innerHTML=(result.data||[]).map(run=>'<div class="import-history-run"><b>'+escape(new Date(run.started_at).toLocaleString('uk-UA',{timeZone:'Europe/Kyiv'}))+'</b> · '+escape(labels[run.status]||run.status)+' · Вибрано: '+run.selected_count+' · Без змін: '+run.unchanged_count+' · Помилок: '+(run.errors||[]).length+' <button type="button" data-import-run="'+escape(run.id)+'">Деталі</button></div>').join('')||'<p>Запусків ще немає.</p>';
    list.insertAdjacentHTML('beforeend','<button type="button" data-history-prev '+(!offset?'disabled':'')+'>Новіші</button> <button type="button" data-history-next '+((result.data||[]).length<20?'disabled':'')+'>Старіші</button>');
    list.querySelector('[data-history-prev]').onclick=()=>{offset=Math.max(0,offset-20);load()};
    list.querySelector('[data-history-next]').onclick=()=>{offset+=20;load()};
    for(const button of list.querySelectorAll('[data-import-run]'))button.onclick=async()=>{
      button.disabled=true;
      try{
        const run=result.data.find(row=>row.id===button.dataset.importRun);
        const details=await db.from('import_changes').select('id,product_name,sku,action,before_values,after_values').eq('run_id',run.id).order('id').limit(1000);
        if(details.error)throw new Error(details.error.message);
        const dialog=document.createElement('dialog');dialog.className='import-review-dialog';
        dialog.innerHTML='<div class="import-review-header"><h2>Зміни імпорту</h2></div><div class="import-review-body">'+importHistoryDetailsMarkup(details.data||[])+'<h3>Помилки запуску</h3><ul>'+(run.errors||[]).map(error=>'<li>'+escape(error.sku)+' — '+escape(error.reason)+'</li>').join('')+'</ul></div><div class="import-review-footer"><button type="button">Закрити</button></div>';
        dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
      }catch(error){list.insertAdjacentHTML('afterbegin','<p>'+escape(error.message)+'</p>')}finally{button.disabled=false}
    };
  };
  panel.querySelector('[data-history-refresh]').onclick=()=>{offset=0;load()};
  return load;
}
