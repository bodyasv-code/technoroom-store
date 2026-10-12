import {auditSku} from './import-audit.js?v=20261012-guard-4';
import {normalizeSpecificationEntries} from './specification-normalization.js?v=20261012-dedup';
import {isProjectorProduct, resolveProjectorSpecifications, normalizeProjectorResolution} from './projector-specs.js?v=20261012-dedup';

export const qualityLabels = {duplicate_sku:'Повтор SKU', conflict:'Суперечливі характеристики', no_brand:'Без бренду', no_image:'Без фото', no_price:'Без ціни', category:'Перевірити категорію', filters:'Неповні фільтри'};
const text = value => String(value ?? '').trim();
const normalized = value => text(value).toLocaleLowerCase('uk-UA').replace(/\s+/g,' ');
export function createQualityAudit(products, categories=[], brands=[], expectedCategory=()=>null) {
  const skuGroups=new Map(), categoryMap=new Map(categories.map(c=>[c.slug,c])), brandIds=new Set(brands.map(b=>Number(b.id)));
  for(const product of products){const sku=auditSku(product.sku);if(sku){if(!skuGroups.has(sku))skuGroups.set(sku,[]);skuGroups.get(sku).push(product.id);}}
  return products.map(product=>{
    const issues=[], add=(code,detail)=>issues.push({code,detail});
    const duplicateIds=skuGroups.get(auditSku(product.sku))||[];
    if(duplicateIds.length>1)add('duplicate_sku','SKU '+text(product.sku)+' також мають товари ID: '+duplicateIds.filter(id=>id!==product.id).join(', '));
    if(!text(product.brand)&&!brandIds.has(Number(product.brand_id)))add('no_brand','Не вказано бренд і немає зв’язку з довідником брендів.');
    if(!text(product.image_path)&&!(Array.isArray(product.image_paths)&&product.image_paths.some(path=>text(path))))add('no_image','Немає головного фото або фото в галереї.');
    if(!Number.isFinite(Number(product.price))||Number(product.price)<=0)add('no_price','Ціна відсутня, нульова або некоректна.');
    const current=categoryMap.get(product.category), target=expectedCategory(product);
    if(!current)add('category','Категорія відсутня або не знайдена в довіднику.');
    else if(target&&target!==product.category&&categoryMap.has(target))add('category','За назвою може підходити «'+categoryMap.get(target).name+'». Зараз: «'+current.name+'». Потрібна ручна перевірка.');
    const projector=isProjectorProduct(product), entries=normalizeSpecificationEntries(product.specifications,{projector}), grouped=new Map();
    for(const [key,value] of entries){const folded=normalized(key).replace(/\s*\(інше значення \d+\)$/u,'');if(!grouped.has(folded))grouped.set(folded,[]);grouped.get(folded).push({key,value});}
    const conflicts=[...grouped.values()].filter(group=>group.length>1);
    if(conflicts.length)add('conflict',conflicts.map(group=>group[0].key+': '+group.map(item=>Array.isArray(item.value)?item.value.join(', '):text(item.value)).join(' / ')).join('; '));
    if(projector){
      const spec=resolveProjectorSpecifications(product), missing=[];
      if(!/^(?:3LCD|DLP|LCD|LCoS)$/iu.test(text(spec['Технологія проекції'])))missing.push('технологія проєкції');
      if(!normalizeProjectorResolution(spec['Роздільна здатність']))missing.push('роздільна здатність');
      if(!text(spec['Джерело світла']))missing.push('джерело світла');
      if(!text(spec['Призначення']))missing.push('призначення');
      if(missing.length)add('filters','Для проєктора не визначено: '+missing.join(', ')+'.');
    }else if(/^(?:office-printers|office-mfp|office-wide-format)(?:-|$)/u.test(text(product.category))){
      const spec=new Map(entries.map(([key,value])=>[normalized(key),text(value)])), missing=[];
      if(!spec.get('тип друку')&&!spec.get('кольоровість'))missing.push('кольоровість');
      if(!spec.get('технологія друку')&&!spec.get('технологія'))missing.push('технологія друку');
      if(!spec.get('формат'))missing.push('формат');
      if(missing.length)add('filters','Для принтера / БФП не вказано: '+missing.join(', ')+'.');
    }
    return {product,issues,critical:issues.some(issue=>['duplicate_sku','conflict'].includes(issue.code))};
  });
}

const escape = raw => String(raw??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function mountQualityPanel(host, onEdit) {
  host.innerHTML='<div class="quality-heading"><div><p class="quality-eyebrow">КОНТРОЛЬ ЯКОСТІ КАТАЛОГУ</p><h2>Потребують уваги</h2><p>Перевірка підказує проблеми, але не змінює товари автоматично.</p></div><span class="quality-total" data-quality-total></span></div><div class="quality-summary" data-quality-summary></div><div class="quality-controls"><input type="search" data-quality-search aria-label="Пошук у проблемних товарах" placeholder="Назва, SKU або ID товару"><select data-quality-kind aria-label="Тип проблеми"><option value="all">Усі проблеми</option>'+Object.entries(qualityLabels).map(([code,label])=>'<option value="'+code+'">'+label+'</option>').join('')+'</select><select data-quality-scope aria-label="Видимість товарів"><option value="active">Активні товари</option><option value="all">Усі товари</option><option value="draft">Приховані товари</option></select></div><p class="quality-note">Повтори SKU перевіряються також серед прихованих товарів. Неповні фільтри — для проєкторів і принтерів / БФП.</p><div class="quality-list" data-quality-list aria-live="polite"></div><div class="quality-pagination"><button type="button" data-quality-prev>← Назад</button><span data-quality-page></span><button type="button" data-quality-next>Далі →</button></div>';
  let audit=[],page=1;
  const el=selector=>host.querySelector(selector), limit=20;
  const render=()=>{
    const scope=el('[data-quality-scope]').value, kind=el('[data-quality-kind]').value, query=normalized(el('[data-quality-search]').value);
    const scoped=audit.filter(row=>scope==='all'||(scope==='active'?row.product.is_active:!row.product.is_active));
    const attention=scoped.filter(row=>row.issues.length);
    el('[data-quality-total]').textContent=attention.length+' із '+scoped.length+' товарів';
    el('[data-quality-summary]').innerHTML=Object.entries(qualityLabels).map(([code,label])=>'<button type="button" data-quality-filter="'+code+'" aria-pressed="'+(kind===code)+'"><strong>'+attention.filter(row=>row.issues.some(issue=>issue.code===code)).length+'</strong><span>'+label+'</span></button>').join('');
    const rows=attention.filter(row=>(kind==='all'||row.issues.some(issue=>issue.code===kind))&&(!query||normalized([row.product.id,row.product.name,row.product.sku,row.product.brand].join(' ')).includes(query))).sort((a,b)=>Number(b.critical)-Number(a.critical)||b.issues.length-a.issues.length||Number(a.product.id)-Number(b.product.id));
    const pages=Math.max(1,Math.ceil(rows.length/limit));page=Math.min(page,pages);
    el('[data-quality-list]').innerHTML=rows.length?rows.slice((page-1)*limit,page*limit).map(({product,issues,critical})=>'<article class="quality-product '+(critical?'quality-critical':'')+'"><div class="quality-product-title"><h3>'+escape(product.name||'Без назви')+'</h3><small>ID '+escape(product.id)+' · SKU: '+escape(product.sku||'—')+' · '+(product.is_active?'У каталозі':'Приховано')+'</small></div><ul>'+issues.map(issue=>'<li><b>'+escape(qualityLabels[issue.code])+'</b><span>'+escape(issue.detail)+'</span></li>').join('')+'</ul><button type="button" data-quality-edit="'+escape(product.id)+'">Редагувати →</button></article>').join(''):'<div class="quality-empty">За обраними умовами товарів, що потребують уваги, не знайдено.</div>';
    el('[data-quality-page]').textContent=rows.length?'Показано '+((page-1)*limit+1)+'–'+Math.min(page*limit,rows.length)+' із '+rows.length:'0 товарів';
    el('[data-quality-prev]').disabled=page<=1;el('[data-quality-next]').disabled=page>=pages;
  };
  host.addEventListener('input',event=>{if(event.target.matches('[data-quality-search]')){page=1;render();}});
  host.addEventListener('change',event=>{if(event.target.matches('[data-quality-kind],[data-quality-scope]')){page=1;render();}});
  host.addEventListener('click',event=>{const filter=event.target.closest('[data-quality-filter]'),edit=event.target.closest('[data-quality-edit]');if(filter){el('[data-quality-kind]').value=filter.dataset.qualityFilter;page=1;render();}else if(edit)onEdit(Number(edit.dataset.qualityEdit));else if(event.target.closest('[data-quality-prev]')){page--;render();}else if(event.target.closest('[data-quality-next]')){page++;render();}});
  return rows=>{audit=rows;render();};
}
