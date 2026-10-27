export function mountIcecatImages({host,client,productId}){
  const doc=host.ownerDocument,section=doc.createElement('section');section.className='import-report content-description-review';
  section.innerHTML='<h3>Фото з Icecat — перевірка перед додаванням</h3><p>Точний бренд і артикул перевіряються на сервері. Імпортується по одному публічному фото у наше сховище. Наявні фото не видаляються; головне фото не замінюється. Приватні зображення й логотипи пропускаються.</p><button type="button" data-images-list>Знайти доступні фото</button><div data-images-choice hidden><label>Фото виробника<select data-images-select></select></label><button type="button" data-images-preview>Переглянути вибране фото</button></div><div data-images-review hidden><img data-images-img alt="Фото Icecat для перевірки" style="display:block;width:100%;max-width:520px;max-height:420px;object-fit:contain;background:white"><p data-images-details></p><label><input type="checkbox" data-images-approved> Перевірив, що фото відповідає саме цьому товару й модифікації</label><button type="button" data-images-apply>Додати одне фото до галереї</button></div><p role="status" aria-live="polite" data-images-message></p>';
  host.append(section);
  const find=s=>section.querySelector(s),message=find('[data-images-message]'),select=find('select'),review=find('[data-images-review]'),approved=find('[data-images-approved]'),image=find('img');
  let plan=null,pending=false,uncertain=false;
  const clear=()=>{plan=null;approved.checked=false;review.hidden=true;image.removeAttribute('src');};select.onchange=clear;
  const request=async(action,extra={})=>{
    const {data:{session}}=await client.auth.getSession();if(!session?.access_token)throw new Error('Увійдіть в адмінку повторно.');
    const response=await fetch('/api/import-product-images',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({action,productId,...extra}),signal:AbortSignal.timeout(55000)});
    const data=await response.json();if(!response.ok)throw new Error((data.error||'Імпорт фото не завершено.')+(data.runId?' Запуск: '+data.runId:''));return data;
  };
  const perform=async action=>{
    if(pending||uncertain)return;pending=true;section.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
    try{await action();}catch(error){message.textContent=error.message+(uncertain?' Не повторюйте запис без перевірки журналу.':'');clear();}
    finally{pending=false;section.querySelectorAll('button,input,select').forEach(el=>el.disabled=uncertain);}
  };
  find('[data-images-list]').onclick=()=>perform(async()=>{
    clear();select.replaceChildren();find('[data-images-choice]').hidden=true;message.textContent='Перевіряю точний артикул…';
    const data=await request('icecat-image-list');
    for(const candidate of data.candidates){const option=doc.createElement('option');option.value=candidate.key;option.textContent='Фото '+candidate.id+' · '+candidate.type+' · '+candidate.width+' × '+candidate.height;select.append(option);}
    find('[data-images-choice]').hidden=!data.candidates.length;
    message.textContent=data.product.name+' · SKU '+data.product.sku+'. Наявних фото: '+data.existingCount+'. Доступних кандидатів: '+data.candidates.length+'. Каталог не змінено.';
  });
  find('[data-images-preview]').onclick=()=>perform(async()=>{
    clear();message.textContent='Завантажую фото для перевірки; картка не змінюється…';
    const data=await request('icecat-image-preview',{key:select.value});
    if(typeof data.dataUrl!=='string'||data.dataUrl.length>2800000||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/u.test(data.dataUrl))throw new Error('Непідтримуваний перегляд зображення.');
    image.src=data.dataUrl;review.hidden=false;plan=data.plan;
    find('[data-images-details]').textContent=data.product.name+' · '+data.product.sku+' · '+data.image.width+' × '+data.image.height+' · '+Math.ceil(data.image.bytes/1024)+' КБ. Точні дублікати серед імпортованих фото не додаються.';
    message.textContent='Перевірте фото й підтвердьте відповідність. Запис ще не виконано.';
  });
  find('[data-images-apply]').onclick=()=>perform(async()=>{
    if(!plan||!approved.checked)throw new Error('Перевірте фото й позначте підтвердження відповідності.');
    const confirmed=plan;plan=null;uncertain=true;message.textContent='Завантажую фото у наше сховище та записую журнал…';
    const data=await request('icecat-image-apply',{plan:confirmed});
    uncertain=false;clear();message.textContent=(data.unchanged?'Фото вже було додано. ':'Фото додано до галереї; наявне головне фото збережено. ')+'Запуск журналу: '+data.runId+'. '+(data.warning||'Інші поля товару не змінювалися.');
  });
}
