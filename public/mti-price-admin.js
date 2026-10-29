import {readMtiPriceFile,matchMtiPriceRows} from './mti-price.js?v=20261029-mti';
const esc=value=>String(value??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>value===null?'Не вказано':Number(value).toLocaleString('uk-UA',{maximumFractionDigits:2})+' ₴';
export function mtiPreviewMarkup(rows){
  return '<div class="table-wrap"><table><thead><tr><th>Товар</th><th>Коди</th><th>РРЦ для сайту</th><th>Ціна МТІ</th><th>На складі МТІ</th><th>Перевірка</th></tr></thead><tbody>'+rows.slice(0,200).map(row=>'<tr><td><b>'+esc(row.name)+'</b><small>Рядок '+row.sourceRow+' · '+esc(row.sourceCategory)+'</small></td><td>МТІ: '+esc(row.supplierSku)+'<br>Партномер: '+esc(row.manufacturerPartNumber)+'</td><td>'+esc(row.hasPrice?money(row.price):'Не вказано')+'</td><td>'+esc(money(row.supplierPrice))+'</td><td>'+esc(row.stockDetail.label)+'</td><td>'+esc(row.matchLabel)+(row.issues.length?'<ul class="import-audit-issues">'+row.issues.map(issue=>'<li class="is-review">'+esc(issue)+'</li>').join('')+'</ul>':'')+'</td></tr>').join('')+'</tbody></table></div>';
}
export function mountMtiPricePreview(anchor,getCatalog){
  if(!anchor||anchor.querySelector('[data-mti-preview]'))return;
  const panel=document.createElement('details');panel.dataset.mtiPreview='';panel.className='import-report';
  panel.innerHTML='<summary><b>Прайс МТІ Excel — попередній перегляд</b></summary><p>РРЦ у гривнях використовується як запропонована ціна сайту. Ціна МТІ показана окремо. Файл читається у браузері. Товари, ціни та залишки в базі не змінюються.</p><label>Прайс МТІ (.xlsx) <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-mti-file></label><p role="status" data-mti-status></p><label>Пошук у прайсі <input type="search" data-mti-search placeholder="Бренд, модель або артикул"></label><div data-mti-results></div>';
  anchor.append(panel);
  const status=panel.querySelector('[data-mti-status]'),results=panel.querySelector('[data-mti-results]'),search=panel.querySelector('[data-mti-search]');
  let parsed=null,generation=0;
  function render(){
    if(!parsed)return;
    const products=getCatalog(),ready=Array.isArray(products);
    const rows=matchMtiPriceRows(parsed.rows,products||[]);
    if(!ready)for(const row of rows){row.matchedProductId=null;row.matchLabel='Каталог ще завантажується';}
    const query=search.value.trim().toLowerCase(),filtered=rows.filter(row=>[row.name,row.supplierSku,row.sku].join(' ').toLowerCase().includes(query));
    status.textContent='Прочитано: '+rows.length+'. Потребують перевірки: '+rows.filter(row=>row.issues.length).length+'. '+(ready?'Збігів без зауважень: '+rows.filter(row=>row.matchedProductId!==null).length+'. ':'Зіставлення очікує завантаження каталогу. ')+'Показано '+Math.min(filtered.length,200)+' із '+filtered.length+'. Імпорт у базу не виконується.';
    results.innerHTML=mtiPreviewMarkup(filtered);
  }
  search.addEventListener('input',render);
  document.addEventListener('technoroom:admin-catalog-loaded',render);
  panel.querySelector('[data-mti-file]').addEventListener('change',async event=>{
    const request=++generation,file=event.target.files?.[0];parsed=null;results.replaceChildren();search.value='';
    if(!file){status.textContent='';return;}
    status.textContent='Читаю прайс МТІ…';
    try{const value=await readMtiPriceFile(file);if(request!==generation)return;parsed=value;render();}
    catch(error){if(request===generation)status.textContent=error.message||'Не вдалося прочитати прайс МТІ.';}
  });
}
