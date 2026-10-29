const storageKey = 'technoroom-projector-comparison-v1';
const escape = value => String(value ?? '').replace(/[&<>"']/gu, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function comparisonIds(values) {
  return Array.isArray(values) ? [...new Set(values.filter(v => /^\d+$/u.test(String(v))).map(Number).filter(v => Number.isSafeInteger(v) && v > 0))].slice(0,3) : [];
}
export function toggleComparison(values, id) {
  const ids = comparisonIds(values), valid = comparisonIds([id])[0];
  if (!valid) return ids;
  return ids.includes(valid) ? ids.filter(v => v !== valid) : ids.length < 3 ? [...ids,valid] : ids;
}
const normalized = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('uk-UA').replace(/[’ʼ]/gu,"'").replace(/\s+/gu,' ').replace(/\s*\(інше значення \d+\)$/u,'');
const fields = [
  ['Роздільна здатність', /^(?:власна )?роздільна здатність$/u],
  ['Технологія проєкції', /^технологія про[еє]кції$/u],
  ['Джерело світла', /^(?:джерело світла|технологія джерела світла)$/u],
  ['Яскравість (ANSI лм)', /^(?:яскравість|світловий потік).*ansi/iu],
  ['Яскравість (ISO лм)', /^(?:яскравість|світловий потік).*iso/iu],
  ['Яскравість (стандарт не зазначено)', /^(?:яскравість|світловий потік)(?:\s*\((?:лм|lm)\))?$/u],
  ['Проєкційне відношення', /^про[еє]кційне (?:співвідношення|відношення)$/u],
  ['Підключення', /^(?:інтерфейси?|вхід|підключення)$/u],
  ['Бездротовий зв’язок', /^бездротовий зв'язок$/u],
  ['Вага', /^(?:маса|вага)(?:\s*\(кг\))?$/u]
];
export function projectorComparisonRows(items) {
  return fields.map(([label,pattern]) => [label,items.map(item => {
    const matches = (item.entries || []).filter(([key]) => pattern.test(normalized(key)));
    // Combined ISO/ANSI labels and conflicting aliases are not precise measurements.
    if (/яскравість/iu.test(label) && matches.some(([key]) => /iso/iu.test(key) && /ansi/iu.test(key))) return 'Не вказано';
    const values = matches.map(([,value]) => Array.isArray(value) ? value.join(' · ') : String(value ?? '').trim());
    if (label.includes('стандарт не зазначено') && values.some(v=>/ansi|iso/iu.test(v))) return 'Не вказано';
    if (!values.length || values.some(v => !v || v.length > 220 || /[<>\r\n*?]/u.test(v) || /^(?:[-—–]+|n\/?a|н\/?д|true|false)$/iu.test(v) || /уточн|невідом|не вказан|потребує/iu.test(v)) || new Set(values.map(normalized)).size !== 1) return 'Не вказано';
    return label==='Вага' && /\(кг\)/iu.test(matches[0][0]) && !/кг|kg/iu.test(values[0]) ? values[0]+' кг' : values[0];
  })]).filter(([,values]) => values.some(value => value !== 'Не вказано'));
}
export function comparisonButton(item) {
  return '<button type="button" class="projector-compare-button" data-projector-compare="'+Number(item.id)+'" aria-pressed="false">Порівняти</button>';
}
export function comparisonTable(items) {
  const heading = items.map(item => '<th scope="col"><button type="button" data-comparison-remove="'+Number(item.id)+'" aria-label="Прибрати '+escape(item.name)+'">Прибрати ×</button><a href="product.html?id='+Number(item.id)+'">'+escape(item.name)+'</a><small>'+escape(item.sku || '')+'</small><strong>'+escape(item.priceLabel)+'</strong><span>'+escape(item.stockLabel)+'</span></th>').join('');
  return '<p class="comparison-scroll-hint">Гортайте таблицю вбік, щоб переглянути всі моделі →</p><div class="projector-comparison-scroll" role="region" aria-label="Таблиця порівняння проєкторів" tabindex="0"><table><thead><tr><th scope="col">Характеристика</th>'+heading+'</tr></thead><tbody>'+projectorComparisonRows(items).map(([label,values])=>'<tr><th scope="row">'+escape(label)+'</th>'+values.map(value=>'<td>'+escape(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
export function mountProjectorComparison({doc=document,storage,loadItems}) {
  let ids=[];
  try { storage ??= window.sessionStorage; ids=comparisonIds(JSON.parse(storage.getItem(storageKey))); } catch {}
  const tray=doc.createElement('aside');
  tray.className='projector-comparison-tray'; tray.hidden=true;
  tray.setAttribute('aria-label','Вибрані проєктори');
  tray.innerHTML='<span class="comparison-selection"></span><button type="button" data-comparison-open>Порівняти</button><button type="button" data-comparison-clear>Очистити</button><span class="comparison-status" role="status" aria-live="polite"></span>';
  const dialog=doc.createElement('dialog'); dialog.className='projector-comparison-dialog';
  dialog.setAttribute('aria-labelledby','projector-comparison-title');
  dialog.innerHTML='<header><div><h2 id="projector-comparison-title">Порівняння проєкторів</h2><p>До трьох моделей. Не вказані характеристики потребують уточнення. Показники ANSI та ISO наведено окремо.</p></div><button type="button" data-comparison-close aria-label="Закрити порівняння">×</button></header><div class="comparison-content"></div>';
  doc.body.append(tray,dialog);
  let opener=null, request=0;
  const status=tray.querySelector('.comparison-status');
  const refresh=()=>{
    tray.hidden=!ids.length;
    tray.querySelector('.comparison-selection').textContent='Вибрано '+ids.length+' із 3';
    tray.querySelector('[data-comparison-open]').disabled=ids.length<2;
    doc.body.classList.toggle('has-projector-comparison',ids.length>0);
    doc.querySelectorAll('[data-projector-compare]').forEach(button=>{
      const selected=ids.includes(Number(button.dataset.projectorCompare));
      button.setAttribute('aria-pressed',String(selected));
      button.textContent=selected?'У порівнянні ✓':'Порівняти';
    });
  };
  const save=()=>{try{storage.setItem(storageKey,JSON.stringify(ids));}catch{} refresh();};
  const close=()=>{request++;dialog.close();opener?.isConnected&&opener.focus();};
  const draw=async()=>{
    const token=++request, content=dialog.querySelector('.comparison-content');
    content.innerHTML='<p role="status">Завантажуємо актуальні дані…</p>';
    try {
      const items=await loadItems([...ids]);
      if(token!==request || !dialog.open)return;
      const selected=ids.map(id=>items.find(item=>Number(item.id)===id)).filter(Boolean);
      content.innerHTML=(selected.length<ids.length?'<p role="status">Деякі товари вже недоступні. Виберіть інші моделі в каталозі.</p>':'')+comparisonTable(selected);
    } catch {if(token===request)content.innerHTML='<p role="alert">Не вдалося завантажити характеристики. Спробуйте ще раз.</p><button type="button" data-comparison-retry>Повторити</button>';}
  };
  doc.addEventListener('click',event=>{
    const button=event.target.closest('button'); if(!button)return;
    if(button.matches('[data-projector-compare]')){
      const id=Number(button.dataset.projectorCompare);
      if(ids.length===3&&!ids.includes(id)){status.textContent='Можна порівняти до 3 проєкторів. Приберіть одну модель.';return;}
      ids=toggleComparison(ids,id);status.textContent=ids.length===1?'Додайте ще одну модель для порівняння.':'';save();
    } else if(button.matches('[data-comparison-open]')){opener=button;dialog.showModal();draw();}
    else if(button.matches('[data-comparison-close]'))close();
    else if(button.matches('[data-comparison-clear]')){ids=[];save();}
    else if(button.matches('[data-comparison-remove]')){
      ids=ids.filter(id=>id!==Number(button.dataset.comparisonRemove));save();
      if(!ids.length)close();else {draw();dialog.querySelector('[data-comparison-close]').focus();}
    } else if(button.matches('[data-comparison-retry]'))draw();
  });
  dialog.addEventListener('close',()=>{request++;opener?.isConnected&&opener.focus();});
  refresh();return {refresh};
}
