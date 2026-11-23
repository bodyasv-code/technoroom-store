import {readMtiPriceFile,matchMtiPriceRows,mtiScopeRows} from './mti-price.js?v=20261122-batches';
import {mountMtiOfferImport} from './mti-offer-admin.js?v=20261123-source';
import {mountImportSource} from './supplier-import-source.js?v=20261123';
const esc=value=>String(value??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>value===null?'Не вказано':Number(value).toLocaleString('uk-UA',{maximumFractionDigits:2})+' ₴';
export function mtiPreviewMarkup(rows){
  return '<div class="table-wrap"><table><thead><tr><th>Товар</th><th>Коди</th><th>РРЦ для сайту</th><th>Ціна МТІ</th><th>На складі МТІ</th><th>Перевірка</th></tr></thead><tbody>'+rows.slice(0,200).map(row=>'<tr><td><b>'+esc(row.name)+'</b><small>Рядок '+row.sourceRow+' · '+esc(row.sourceCategory)+'</small></td><td>МТІ: '+esc(row.supplierSku)+'<br>Партномер: '+esc(row.manufacturerPartNumber)+'</td><td>'+esc(row.hasPrice?money(row.price):'Не вказано')+'</td><td>'+esc(money(row.supplierPrice))+'</td><td>'+esc(row.stockDetail.label)+'</td><td>'+esc(row.matchLabel)+(row.issues.length?'<ul class="import-audit-issues">'+row.issues.map(issue=>'<li class="is-review">'+esc(issue)+'</li>').join('')+'</ul>':'')+'</td></tr>').join('')+'</tbody></table></div>';
}
export function mountMtiPricePreview(anchor,getCatalog,{client,onImported,readPriceFile=readMtiPriceFile}={}){
  if(!anchor||anchor.querySelector('[data-mti-preview]'))return;
  const panel=document.createElement('details');panel.dataset.mtiPreview='';panel.className='import-report';
  panel.innerHTML='<summary><b>Прайс МТІ Excel — попередній перегляд</b></summary><p>РРЦ у гривнях використовується як запропонована ціна сайту. Ціна МТІ показана окремо. Файл читається у браузері. Товари, ціни та залишки в базі не змінюються.</p><label>Прайс МТІ (.xlsx) <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-mti-file></label><p role="status" data-mti-status></p><label>Пошук у прайсі <input type="search" data-mti-search placeholder="Бренд, модель або артикул"></label><div data-mti-results></div>';
  anchor.append(panel);
  if(client)panel.querySelector('p').textContent='РРЦ у гривнях — запропонована ціна сайту. Ціна МТІ показана окремо. Читання файлу не змінює каталог. Запис пропозицій доступний нижче після підготовки та перегляду змін.';
  panel.querySelector('[data-mti-search]').closest('label').insertAdjacentHTML('beforebegin','<label>Обсяг імпорту МТІ <select data-mti-scope><option value="projection">Усе проєкційне обладнання</option><option value="projectors">Лише проєктори</option><option value="erc-display-06">Лише екрани</option><option value="erc-display-10">Лише кріплення</option><option value="erc-display-08">Лише аксесуари проєкторів</option><option value="all">Увесь файл</option></select></label><p>Обсяг визначає, які товари підуть на підготовку й запис. Пошук нижче лише допомагає переглядати таблицю.</p>');
  const pager=document.createElement('div');pager.className='admin-controls';pager.dataset.mtiPager='';panel.querySelector('[data-mti-results]').after(pager);
  const status=panel.querySelector('[data-mti-status]'),results=panel.querySelector('[data-mti-results]'),search=panel.querySelector('[data-mti-search]'),scope=panel.querySelector('[data-mti-scope]');
  let parsed=null,generation=0;
  let sourceName='',scopedRows=null,page=1;
  const sourceMeta=mountImportSource(panel.querySelector('[data-mti-file]').closest('label'),{supplier:'MTI',onChange:()=>importer?.reset()});
  const importer=client?mountMtiOfferImport(panel,{client,getRows:()=>scopedRows,getCatalog,getSourceName:()=>sourceName,getSource:()=>sourceMeta.get(),onImported}):null;
  function render(){
    if(!parsed)return;
    const products=getCatalog(),ready=Array.isArray(products);
    const rows=matchMtiPriceRows(scopedRows,products||[]);
    if(!ready)for(const row of rows){row.matchedProductId=null;row.matchLabel='Каталог ще завантажується';}
    const query=search.value.trim().toLowerCase(),filtered=rows.filter(row=>[row.name,row.supplierSku,row.sku].join(' ').toLowerCase().includes(query));
    const pages=Math.max(1,Math.ceil(filtered.length/200));page=Math.min(page,pages);
    status.textContent='Прочитано у файлі: '+parsed.rows.length+'. У вибраному обсязі: '+rows.length+'. Поза обсягом: '+(parsed.rows.length-rows.length)+'. Потребують перевірки: '+rows.filter(row=>row.issues.length).length+'. '+(ready?'Збігів без зауважень: '+rows.filter(row=>row.matchedProductId!==null).length+'. ':'Зіставлення очікує завантаження каталогу. ')+'Знайдено в таблиці: '+filtered.length+'. Сторінка '+page+' із '+pages+'. Саме читання файлу нічого не записує.';
    results.innerHTML=mtiPreviewMarkup(filtered.slice((page-1)*200,page*200));
    pager.hidden=pages===1;pager.innerHTML='<button type="button" data-mti-prev '+(page===1?'disabled':'')+'>← Попередні</button><span>'+page+' / '+pages+'</span><button type="button" data-mti-next '+(page===pages?'disabled':'')+'>Наступні →</button>';
    pager.querySelector('[data-mti-prev]').onclick=()=>{page--;render();};pager.querySelector('[data-mti-next]').onclick=()=>{page++;render();};
  }
  search.addEventListener('input',()=>{page=1;render();});
  scope.addEventListener('change',()=>{scopedRows=parsed?mtiScopeRows(parsed.rows,scope.value):null;page=1;importer?.reset();render();});
  document.addEventListener('technoroom:admin-catalog-loaded',render);
  panel.querySelector('[data-mti-file]').addEventListener('change',async event=>{
    const request=++generation,file=event.target.files?.[0];sourceMeta.invalidate();parsed=null;scopedRows=null;page=1;sourceName=file?.name||'';importer?.reset();results.replaceChildren();pager.replaceChildren();search.value='';
    if(!file){status.textContent='';return;}
    status.textContent='Читаю прайс МТІ…';
    try{const [value]=await Promise.all([readPriceFile(file),sourceMeta.setFiles([{role:'main',file}])]);if(request!==generation)return;parsed=value;scopedRows=mtiScopeRows(parsed.rows,scope.value);render();}
    catch(error){if(request===generation)status.textContent=error.message||'Не вдалося прочитати прайс МТІ.';}
  });
}



