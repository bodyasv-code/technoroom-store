import {descriptionDraftText,prepareDescriptionChange,prepareDescriptionRollback,commitDescriptionChange} from './content-description-change.js?v=20261027-format';

// The comparison remains read-only. Writes require a separate reviewed plan and confirmation.
export function mountDescriptionReview({host,client,preview}){
  if(!preview?.product?.id)return;
  const hasDraft=preview.status==='review'&&Boolean(preview.descriptionDraft);
  const doc=host.ownerDocument,section=doc.createElement('section');
  section.className='import-report content-description-review';
  section.innerHTML='<h3>Окрема заміна одного опису</h3><p>Перевірте переклад і технічні дані. Старий опис буде збережено в журналі. Раніше написані вручну описи не завжди мають захисну позначку — обов’язково звірте їх перед заміною. Ціни, залишки, фото й характеристики не змінюються.</p><label>Текст українською<textarea rows="12" data-description-text></textarea></label><label><input type="checkbox" data-description-reviewed> Перевірив українську мову й технічні дані</label><p><button type="button" data-description-prepare>Переглянути заміну опису</button></p><details><summary>Відновити опис із журналу, зокрема після перезавантаження</summary><label>Код запуску журналу <input type="text" data-description-run></label><p>Відновлення стосується лише цієї картки. Якщо опис після запису змінили, відкат зупиниться.</p><button type="button" data-description-rollback>Переглянути відкат</button></details><p role="status" aria-live="polite" data-description-message></p><div data-description-plan hidden><h4>Було</h4><pre data-description-before style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto"></pre><h4>Стане</h4><pre data-description-after style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto"></pre><button type="button" data-description-confirm>Підтвердити зміну одного опису</button></div>';
  host.append(section);
  const find=s=>section.querySelector(s),text=find('[data-description-text]'),reviewed=find('[data-description-reviewed]'),message=find('[data-description-message]'),planBox=find('[data-description-plan]'),run=find('[data-description-run]');
  text.value=hasDraft?descriptionDraftText(preview.descriptionDraft):'';
  if(!hasDraft){
    section.querySelector('h3').textContent='Відновлення одного опису з журналу';
    text.closest('label').hidden=true;reviewed.closest('label').hidden=true;
    find('[data-description-prepare]').hidden=true;section.querySelector('details').open=true;
  }
  let plan=null,pending=false,uncertain=false;
  const clear=()=>{plan=null;planBox.hidden=true;};
  const controls=[...section.querySelectorAll('button,input,textarea')];
  const perform=async action=>{
    if(pending||uncertain)return;
    pending=true;controls.forEach(el=>el.disabled=true);
    try{await action();}catch(error){message.textContent=error.message+(uncertain?' Повторний запис заблоковано в цьому перегляді. Перевірте журнал перед новою спробою.':'');clear();}
    finally{pending=false;controls.forEach(el=>el.disabled=uncertain);}
  };
  text.oninput=()=>{reviewed.checked=false;clear();};reviewed.onchange=clear;run.oninput=clear;
  const show=next=>{
    plan=next;find('[data-description-before]').textContent=next.before||'(порожній опис)';find('[data-description-after]').textContent=next.after||'(порожній опис)';planBox.hidden=false;
    message.textContent=next.name+' · SKU '+next.sku+' · ID '+next.productId+'. Перевірте обидва варіанти. Збереження ще не виконано.';
  };
  find('[data-description-prepare]').onclick=()=>perform(async()=>{clear();show(await prepareDescriptionChange(client,preview.product,text.value,{reviewed:reviewed.checked,icecatId:preview.icecatId}));});
  find('[data-description-rollback]').onclick=()=>perform(async()=>{clear();show(await prepareDescriptionRollback(client,run.value.trim(),preview.product.id));});
  find('[data-description-confirm]').onclick=()=>perform(async()=>{
    if(!plan)return;
    // One attempt per confirmation, including on a lost response: no automatic retries.
    const confirmed=plan;clear();
    message.textContent='Зберігаю один опис і резервну копію…';
    uncertain=true;
    const result=await commitDescriptionChange(client,confirmed);
    uncertain=false;run.value=result.runId;reviewed.checked=false;
    message.textContent=(confirmed.operation==='rollback'?'Попередній опис відновлено. ':'Опис збережено. ')+'Запуск журналу: '+result.runId+'. '+(result.warning||'Резервна копія збережена; інші поля не змінювались.');
  });
}
