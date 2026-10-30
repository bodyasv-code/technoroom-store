import {matchMtiPriceRows} from './mti-price.js?v=20261030-offers';
import {articleContentMarker} from './article-format.js?v=20261027-content-format';

export function mtiDraftContent(row,preview){
  const matched=preview?.status==='review'&&preview.product?.sku===row.sku&&String(preview.product?.brand||'').toLowerCase()===row.vendor.toLowerCase();
  const draft=preview?.descriptionDraft;
  const languageOk=draft?.languages?.length&&draft.languages.every(language=>['UK','UA'].includes(language));
  const usable=matched&&draft?.available&&languageOk&&!draft.translation?.remainingRussian;
  const escape=value=>String(value).replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const description=usable?articleContentMarker+(draft.paragraphs||[]).map(p=>'<p>'+escape(p)+'</p>').join('')+
    ((draft.bullets||[]).length?'<ul>'+draft.bullets.map(p=>'<li>'+escape(p)+'</li>').join('')+'</ul>':''):null;
  const specifications={...row.content.specifications};
  // Only already mapped, Ukrainian, non-conflicting fields can supplement a draft.
  if(matched)for(const field of preview.rows||[]){
    if(field.status==='new'&&field.mapping&&!(field.reasons||[]).length&&!Object.hasOwn(specifications,field.canonical))specifications[field.canonical]=field.value;
  }
  return {name:row.content.name,description,specifications,
    evidence:{source:description?'Icecat':null,icecatId:matched?preview.icecatId:null,descriptionNeedsReview:Boolean(description),
      status:description?'editorial-review':matched&&draft?.available?'language-review':'content-unavailable',photosImported:false}};
}

export function prepareMtiOfferBatch(rows,products,previews=new Map(),excludedSkus=[]){
  const excluded=new Set(excludedSkus.map(code=>String(code).trim().toUpperCase()));
  const assessed=matchMtiPriceRows(rows,products),ready=[],deferred=[];
  for(const row of assessed){
    const reasons=[...row.issues];
    if(excluded.has(row.sku.toUpperCase()))reasons.push('Товар виключено з імпорту.');
    if(!row.hasPrice||!row.hasStock||row.stockDetail.kind!=='exact'||row.reserved!==0)reasons.push('Ціну або точний залишок потрібно перевірити.');
    if(row.supplierSku.trim().toUpperCase()!==row.sku.trim().toUpperCase())reasons.push('Потрібне підтвердження кодів товару.');
    const candidates=products.filter(p=>String(p.sku||'').trim().toUpperCase()===row.sku.toUpperCase());
    if(candidates.some(p=>p.parent_product_id||p.parentProductId))reasons.push('У каталозі є модифікація з цим артикулом.');
    if(candidates.some(p=>p.category&&p.category!==row.category))reasons.push('Категорія збереженого товару відрізняється від прайсу.');
    if(reasons.length){deferred.push({key:row.key,sku:row.sku,reasons:[...new Set(reasons)]});continue;}
    const content=mtiDraftContent(row,previews.get(row.key));
    ready.push({key:row.key,offer:{supplierSku:row.supplierSku.trim().toUpperCase(),supplierId:row.supplierId,
      manufacturerSku:row.sku.trim().toUpperCase(),brand:row.vendor,category:row.category,
      expectedProductId:row.matchedProductId??null,retailPrice:row.price,supplierPrice:row.supplierPrice,
      currency:'UAH',priceBasis:'rrp',quantity:row.stock,stockKind:'exact',reserved:0,reviewRequired:false,sourceRow:row.sourceRow,
      draft:row.matchedProductId?null:{name:content.name,description:content.description,specifications:content.specifications},
      contentEvidence:row.matchedProductId?{status:'existing-content-preserved',photosImported:false}:content.evidence}});
  }
  return {ready,deferred};
}
export const mtiOfferSnapshot=plan=>JSON.stringify(plan.ready.map(row=>row.offer));
export async function applyMtiOfferBatch(client,plan,{requestId,sourceName}){
  if(!plan.ready.length||plan.ready.length>100)throw new Error('Оберіть від 1 до 100 перевірених позицій.');
  const {data,error}=await client.rpc('apply_mti_offer_batch',{p_request:requestId,p_source_name:sourceName,p_rows:plan.ready.map(row=>row.offer)});
  if(error)throw new Error(['42883','42P01','PGRST202','PGRST205'].includes(error.code)?'Потрібне оновлення бази supplier-offers-upgrade.sql. Нічого не записано.':error.message);
  if(!data||data.offers!==plan.ready.length||data.published!==0)throw new Error('Неочікувана відповідь імпорту. Перевірте журнал перед повторним записом.');
  return data;
}
