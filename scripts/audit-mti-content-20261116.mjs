import {readFile,writeFile} from 'node:fs/promises';
import {resolveProjectorSpecifications,isProjectorProduct} from '../public/projector-specs.js';
import {hasProductImage} from '../public/product-quality-rules.js';
const live=JSON.parse(await readFile(process.argv[2]||'.mti-equipment-live-20261116.json','utf8'));
const price=JSON.parse(await readFile('docs/mti-projection-audit-2026-11-12.json','utf8'));
const token=value=>String(value||'').trim().toUpperCase();
const rows=price.rows.map(source=>{
  const direct=live.products.filter(p=>token(p.sku)===token(source.sku)&&token(p.brand)===token(source.brand));
  const linked=live.products.filter(p=>live.offers.some(o=>o.product_id===p.id&&token(o.manufacturer_sku)===token(source.sku)&&token(o.brand)===token(source.brand)));
  const candidates=[...new Map([...direct,...linked].map(p=>[p.id,p])).values()];
  if(candidates.length!==1)return {sku:source.sku,brand:source.brand,status:candidates.length?'ambiguous':'missing',candidateIds:candidates.map(p=>p.id)};
  const p=candidates[0],specifications=resolveProjectorSpecifications(p),projector=isProjectorProduct(p);
  const description=String(p.description||'').replace(/<[^>]*>/gu,'').trim();
  const missing=projector?['Роздільна здатність','Яскравість','Джерело світла','Технологія проекції'].filter(key=>!specifications[key]):[];
  return {id:p.id,sku:p.sku,brand:p.brand,name:p.name,category:p.category,is_active:p.is_active,
    descriptionLength:description.length,hasPhoto:hasProductImage(p),photoCount:p.image_paths?.length||0,
    specificationCount:Object.keys(p.specifications||{}).length,missingProjectorFields:missing,
    descriptionProtected:!!(p.manual_overrides?.description||p.manual_overrides?.reviewed_description),
    protectedSpecificationKeys:p.manual_overrides?.verified_specifications?'all':[...new Set([...Object.keys(p.manual_overrides?.specifications||{}),...(p.manual_overrides?.reviewed_specifications||[])])],
    issues:[...(!hasProductImage(p)?['missing-photo']:[]),...(description.length<50?['short-description']:[]),...(Object.keys(p.specifications||{}).length<3?['few-specifications']:[]),...missing.map(key=>'missing: '+key)]};
});
const report={checkedAt:'2026-11-16',priceSource:price.source,readOnly:true,summary:{priceRows:rows.length,matched:rows.filter(p=>p.id).length,missing:rows.filter(p=>p.status==='missing').length,ambiguous:rows.filter(p=>p.status==='ambiguous').length,cardsWithGaps:rows.filter(p=>p.issues?.length).length},rows};
await writeFile(process.argv[3]||'docs/mti-projection-content-audit-20261116.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));console.log(JSON.stringify(rows.filter(p=>p.issues?.length||p.status),null,2));
