// Evidence-only comparison. This module deliberately has no write/apply API.
import {manualSpecIdentity} from './product-manual-overrides.js?v=20261020-manual';
import {mapContentFeature,mappedContentKey,contentComparisonValue,contentTechnicalNotes,relatedContentFields} from './content-feature-mapping.js?v=20261025-expanded';
const plain=value=>String(value??'').normalize('NFKC').replace(/\s+/gu,' ').trim();
const identity=value=>plain(value).toLocaleLowerCase('uk-UA');
const comparable=value=>identity(Array.isArray(value)?value.join(' · '):value).replace(/(\d)\s*[xх×]\s*(?=\d)/gu,'$1×');
export function buildContentPreview(product,icecat,{requestedLanguage='UK'}={}){
  const data=icecat?.data,general=data?.GeneralInfo;
  const result={readOnly:true,databaseWrites:0,product:{id:product.id,sku:product.sku,brand:product.brand,name:product.name},source:'Icecat',requestedLanguage,rows:[],warnings:[]};
  if(!general){result.status='unavailable';result.code=icecat?.StatusCode??null;result.warnings.push('Контент недоступний. Відсутність доступу не означає відсутність товару.');return result;}
  if(!plain(product.sku)||!plain(product.brand)||identity(product.sku)!==identity(general.BrandPartCode)||identity(product.brand)!==identity(general.Brand)){
    result.status='identity-mismatch';result.warnings.push('Бренд або артикул не збігається точно. Дані іншої модифікації не пропонуються.');return result;
  }
  if(data.DemoAccount===true){result.status='demo-blocked';result.warnings.push('Демоконтент не використовується в робочому імпорті.');return result;}
  if(data.ContentErrors?.length||icecat.ContentErrors?.length){result.status='incomplete-response';result.warnings.push('Icecat повідомив про невідомі розділи відповіді.');return result;}
  result.status='review';result.icecatId=general.IcecatId;
  result.warnings.push('Точний артикул не гарантує правильності кожного параметра. Збереження в цій перевірці відсутнє.');
  const saved=Object.entries(product.specifications||{}),manual=Object.keys(product.manual_overrides?.specifications||{});
  for(const group of Array.isArray(data.FeaturesGroups)?data.FeaturesGroups:[]){
    for(const feature of Array.isArray(group.Features)?group.Features:[]){
      if(result.rows.length>=500){result.warnings.push('Показано не більше 500 полів; відповідь потребує звуження.');break;}
      const name=plain(feature.Feature?.Name?.Value),value=plain(feature.PresentationValue??feature.Value);
      if(!name||!value||name.length>160||value.length>700)continue;
      const language=plain(feature.Feature?.Name?.Language).toUpperCase();
      const mapping=mapContentFeature(feature,product);
      const canonical=mapping?.canonical||name;
      const token=manualSpecIdentity(canonical,product);
      const existing=saved.filter(([key])=>manualSpecIdentity(mappedContentKey(key,product),product)===token);
      const context=relatedContentFields(canonical,product.specifications).filter(field=>!existing.some(([key])=>key===field.name));
      const protectedField=manual.some(key=>manualSpecIdentity(mappedContentKey(key,product),product)===token)||relatedContentFields(canonical,product.manual_overrides?.specifications).length>0;
      const reasons=[];
      if(protectedField)reasons.push('manual-protected');
      if(context.length)reasons.push('composite-context');
      if(language!==requestedLanguage||/[ыэъё]/iu.test(name+' '+value)||/^Керівництво$/iu.test(value))reasons.push('language-review');
      if(/[<>]/u.test(name+' '+value))reasons.push('markup-review');
      if(!mapping&&!existing.length)reasons.push('mapping-review');
      const status=protectedField?'manual-protected':existing.length?(existing.every(([,old])=>(mapping?contentComparisonValue(canonical,old):comparable(old))===(mapping?contentComparisonValue(canonical,value):comparable(value)))?'same':'conflict'):context.length?'related':reasons.includes('mapping-review')?'unmapped':'new';
      if(status==='conflict')reasons.push('value-conflict');
      // Never turn a generic resolution into a scanner/print or native/input
      // resolution merely because a label contains the same word.
      if(/розділь|resolution/iu.test(name))reasons.push('technical-review');
      const notes=contentTechnicalNotes(mapping,value,product);
      if(notes.length)reasons.push('technical-review');
      result.rows.push({source:'Icecat',featureId:plain(feature.Feature?.ID||feature.ID),group:plain(group.FeatureGroup?.Name?.Value),name,canonical,value,language,
        current:existing.map(([name,value])=>({name,value})),relatedCurrent:context,status,reasons:[...new Set(reasons)],notes,mapping:mapping?.via||null,automatic:false});
    }
  }
  result.descriptionAvailable=Boolean(plain(general.Description?.LongDesc));
  result.imageCount=(Array.isArray(data.Gallery)?data.Gallery.length:0)||(data.Image?.HighPic?1:0);
  result.summary={fields:result.rows.length,conflicts:result.rows.filter(r=>r.status==='conflict').length,protected:result.rows.filter(r=>r.status==='manual-protected').length,
    languageReview:result.rows.filter(r=>r.reasons.includes('language-review')).length,mappingReview:result.rows.filter(r=>r.status==='unmapped').length,related:result.rows.filter(r=>r.relatedCurrent?.length).length};
  if(result.summary.mappingReview)result.warnings.push('Зіставлено лише частину полів. Кількість конфліктів не є оцінкою правильності всієї картки.');
  return result;
}
const escape=value=>String(value??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses={'same':'Збігається','conflict':'Конфлікт','new':'Нове поле','related':'Є пов’язане змішане поле','unmapped':'Відповідність ще не налаштована','manual-protected':'Ручне значення захищене'};
const reasonLabels={'manual-protected':'Ручні дані не замінюються','composite-context':'Пов’язаний контекст не є точною відповідністю. Не створювати дубль без перевірки.','language-review':'Перевірити мову назви та значення','markup-review':'Перевірити розмітку','mapping-review':'Не означає, що характеристики немає в картці','value-conflict':'Значення відрізняються','technical-review':'Перевірити технічний зміст за виробником'};
const fieldText=field=>field.name+': '+(Array.isArray(field.value)?field.value.join(' · '):field.value);
const currentMarkup=row=>escape(row.current.map(fieldText).join('; ')||'—')+((row.relatedCurrent||[]).length?'<br><small>Пов’язаний контекст (не точна відповідність):<br>'+escape(row.relatedCurrent.map(fieldText).join('; '))+'</small>':'');
export function contentPreviewMarkup(preview){
  return '<h3>'+escape(preview.product.name)+' · '+escape(preview.product.sku)+'</h3><p>Лише перегляд. Каталог не змінюється.</p>'
    +'<ul>'+preview.warnings.map(w=>'<li>'+escape(w)+'</li>').join('')+'</ul>'
    +(preview.summary?'<p>Полів: '+preview.summary.fields+' · Конфліктів: '+preview.summary.conflicts+' · Захищено: '+preview.summary.protected+' · Перевірити мову: '+preview.summary.languageReview+' · Без відповідності: '+(preview.summary.mappingReview||0)+' · З пов’язаним контекстом: '+(preview.summary.related||0)+'</p>':'')
    +(preview.rows.length?'<div style="overflow-x:auto"><table class="import-change-table"><thead><tr><th>Поле</th><th>Наявна картка</th><th>Icecat</th><th>Перевірка</th></tr></thead><tbody>'
    +preview.rows.map(r=>'<tr><th>'+escape(r.canonical)+'<br><small>'+escape(r.group)+(r.mapping?'<br>Відповідність: '+escape(r.mapping==='feature-id'?'ID Icecat':'точна назва'):'')+'</small></th><td>'+currentMarkup(r)+'</td><td>'+escape(r.value)+'<br><small>'+escape(r.language||'Мову не вказано')+' · Icecat · '+escape(r.featureId)+'</small></td><td>'+escape(statuses[r.status]||r.status)+r.reasons.map(reason=>'<br>'+escape(reasonLabels[reason]||reason)).join('')+(r.notes||[]).map(note=>'<br>'+escape(note)).join('')+'</td></tr>').join('')+'</tbody></table></div>':'');
}
