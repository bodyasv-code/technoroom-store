import {officeSupplyCategoryPlan} from './product-identity.js?v=20261012-consumables-brands';
import {printerDuplexMode} from './printer-duplex.js?v=20261016-import-guards-2';
import {printerDeviceKind,verifiedCanonPrintMode,printPaperPlan} from './printer-import-context.js?v=20261017-photo-paper';
export const auditSku = value => {
  const sku=String(value ?? '').trim().replace(/^\*+|\*+$/g,'').toUpperCase();
  return /^(?:NULL|UNDEFINED|NONE|—|-)$/.test(sku) ? '' : sku;
};
const text = value => String(value ?? '').trim().toLocaleLowerCase('uk-UA');
const mode = value => {
  const source = text(value);
  const mono = /(?:монохром|чорно[ -]?білий|ч\/б|monochrome|\bmono\b)/iu.test(source);
  const color = /(?:кольоров(?!ість)|\bcolou?r\b)/iu.test(source);
  return mono && color ? 'conflict' : mono ? 'mono' : color ? 'color' : '';
};
const specificationModes = specifications => Object.entries(specifications || {})
  .filter(([key]) => /^(?:тип друку|кольоровість|колірність|режим друку|print(?:ing)? type|print colou?r)$/iu.test(key.trim()))
  .map(([,value]) => mode(Array.isArray(value) ? value.join(' ') : value)).filter(Boolean);

export function createImportAudit(rows, products) {
  const source = new Map(), existing = new Map();
  for (const row of rows) {const sku=auditSku(row.sku); if(sku) source.set(sku,(source.get(sku)||0)+1);}
  for (const product of products) {
    const sku=auditSku(product.sku); if(!sku) continue;
    const group=existing.get(sku)||[]; group.push(product); existing.set(sku,group);
  }
  return (row, metadata = {}) => {
    const sku=auditSku(row.sku), matches=existing.get(sku)||[], current=matches.length===1?matches[0]:null;
    const issues=[];
    const add=(code,level,message)=>issues.push({code,level,message});
    if(!sku) add('missing-sku','block','Немає SKU: неможливо безпечно зіставити товар.');
    if(source.get(sku)>1) add('source-duplicate','block','SKU повторюється у файлі ('+source.get(sku)+' позиції). Залиште одну правильну позицію.');
    if(row.priceDuplicate) add('price-duplicate','block','SKU повторюється у файлі цін. Перевірте, яка ціна та наявність правильні.');
    if(row.contentDuplicate) add('content-duplicate','block','SKU повторюється у файлі контенту. Перевірте характеристики перед імпортом.');
    if(matches.length>1) add('catalog-duplicate','block','У каталозі кілька товарів із цим SKU. Спочатку усуньте дублікат — автоматичне оновлення неоднозначне.');
    if(!String(row.name||'').trim()) add('missing-name','block','Немає назви товару.');
    if(!metadata.mapped) add('missing-category','block','Категорію не визначено. Перевірте групу у файлі.');
    const category=metadata.category||metadata.plan?.childSlug||metadata.plan?.rootSlug||'';
    const name=text(row.name), supply=officeSupplyCategoryPlan(row.name);
    const paper=printPaperPlan(row.name);
    if(paper&&current&&current.category!==paper.childSlug&&/^(?:office-equipment|office-(?:printers|mfp)(?:-(?:mono|color))?|office-consumables-(?:ink|cartridges|toner))$/.test(current.category))
      add('saved-paper-category','review','Папір збережено не в категорії паперу. Потрібна перевірка; автоматично не переноситься.');
    if(supply && category!==supply.childSlug) add('supply-category','block','Витратний матеріал або аксесуар потрапляє до категорії пристроїв.');
    const deviceKind=printerDeviceKind(name);
    const mfp=deviceKind==='mfp';
    const printer=deviceKind==='printer';
    const scanner=/^(?:сканер|scanner)/iu.test(name);
    const consumable=/^(?:картридж|тонер|чорнил|контейнер[^ ]*\s+(?:з\s+)?чорнил|фотобарабан|стрічка|cartridge|toner|ink\b|drum\b|ribbon)/iu.test(name);
    if((mfp||printer||scanner) && /^office-consumables(?:-|$)/.test(category)) add('device-category','block','Основний пристрій визначено як витратний матеріал.');
    if(consumable && /^office-(?:printers|mfp|scanners)(?:-|$)/.test(category)) add('consumable-category','block','Картридж, тонер або чорнила визначено як принтер/сканер.');
    if(mfp && /^office-(?:printers|scanners)(?:-|$)/.test(category)
      || scanner && /^office-(?:printers|mfp)(?:-|$)/.test(category)
      || printer && /^office-(?:mfp|scanners)(?:-|$)/.test(category)) add('device-kind','block','Тип пристрою в назві не відповідає категорії.');
    if(mfp||printer) {
      if(printerDuplexMode(Object.entries(row.specifications||{}))==='conflict')add('duplex-conflict','block','Суперечливий режим двостороннього друку. Звірте модель перед імпортом.');
      const verifiedMode=verifiedCanonPrintMode(row.name);
      const signals=[verifiedMode||mode(row.name),verifiedMode?'':mode([row.subcategory,row.sourceCategory].join(' ')),...specificationModes(row.specifications),
        /-(mono|color)$/.exec(category)?.[1]||''].filter(Boolean);
      if(signals.includes('conflict') || signals.includes('mono') && signals.includes('color')) add('print-conflict','block','Суперечлива кольоровість: назва, група, характеристики або категорія вказують різні типи друку.');
      const savedModes=specificationModes(current?.specifications);
      if(!signals.length && !(savedModes.length===1&&['mono','color'].includes(savedModes[0]))) add('unknown-print','review','Кольоровість пристрою не визначена. Перевірте модель перед імпортом.');
    }
    if(row.hasPrice && (!Number.isFinite(Number(row.price)) || Number(row.price)<0)) add('invalid-price','block','Некоректна ціна: має бути невід’ємне число.');
    else if(!row.hasPrice || Number(row.price)<=0) add('no-price','warning',current
      ? 'У джерелі немає додатної ціни. Наявну ціну буде збережено.'
      : 'Без додатної ціни: товар буде створено лише як приховану чернетку.');
    if(row.hasStock && (!Number.isFinite(Number(row.stock)) || Number(row.stock)<0 || /^\s*-\s*\d/.test(String(row.rawStock||'')))) add('invalid-stock','block','Некоректний залишок: має бути невід’ємне число.');
    if(current?.category && category && category!==current.category && metadata.updateCategory!==false) add('category-change','review','Зміниться категорія наявного товару: '+current.category+' → '+category+'. Потрібна ручна перевірка.');
    if((mfp||printer)&&current?.category&&/^(?:office-accessories|office-consumables(?:-.+)?|.*планшет.*|tablets?)$/iu.test(current.category))
      add('saved-device-category','review','Основний пристрій збережено в категорії аксесуарів, витратних матеріалів або планшетів. Потрібна перевірка; автоматично не переноситься.');
    const incomingModes=specificationModes(row.specifications), currentModes=specificationModes(current?.specifications);
    if((mfp||printer) && incomingModes.length && currentModes.length && incomingModes.some(value=>!currentModes.includes(value)))
      add('saved-print-conflict','block','Тип друку у файлі суперечить збереженим характеристикам. Ручні значення не перезаписуються — перевірте товар в адмінці.');
    const fingerprint=JSON.stringify([sku,row.name,category,row.hasPrice,row.price,row.hasStock,row.stock,row.specifications,current?.category,current?.specifications,issues]);
    return {issues,current,blocked:issues.some(issue=>issue.level==='block'),needsReview:issues.some(issue=>issue.level==='review'),fingerprint};
  };
}

export const auditEligible = (assessment, reviewed) => !assessment.blocked
  && (!assessment.needsReview || reviewed.has(assessment.fingerprint));
export function auditMarkup(assessment, escape) {
  return assessment.issues.length ? '<ul class="import-audit-issues">'+assessment.issues.map(issue=>
    '<li class="is-'+issue.level+'">'+escape(issue.message)+'</li>').join('')+'</ul>' : '<span class="import-audit-ok">✓ Перевірки пройдено</span>';
}

export function showImportReview(row, assessment, escape) {
  return new Promise(resolve => {
    const dialog=document.createElement('dialog');
    dialog.className='import-review-dialog';
    dialog.setAttribute('aria-labelledby','import-review-title');
    dialog.innerHTML='<div class="import-review-header"><h2 id="import-review-title">Ручна перевірка позиції</h2>'
      +'<button type="button" data-review-cancel aria-label="Закрити">×</button></div>'
      +'<div class="import-review-body"><b>'+escape(row.name)+'</b><p>SKU: '+escape(row.sku)+'</p>'
      +auditMarkup(assessment,escape)+'<p>Перевірте модель, характеристики та запропоновану категорію. Підтвердження лише дозволить вибрати позицію — імпорт ще не запускається.</p></div>'
      +'<div class="import-review-footer"><button type="button" data-review-cancel>Скасувати</button><button type="button" data-review-approve>Перевірено, дозволити вибір</button></div>';
    let approved=false;
    dialog.querySelectorAll('[data-review-cancel]').forEach(button=>button.onclick=()=>dialog.close());
    dialog.querySelector('[data-review-approve]').onclick=()=>{approved=true;dialog.close();};
    dialog.addEventListener('close',()=>{dialog.remove();resolve(approved);},{once:true});
    document.body.append(dialog);
    dialog.showModal();
  });
}
