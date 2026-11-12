// Plan stock invalidations independently of content/price import eligibility.
// Applying this plan requires a server-side transaction and optimistic checks.
export function planMtiStockInvalidations(rows, offers, {sourceObservedAt, excludedSkus=[]}={}) {
 const sourceTime=Date.parse(sourceObservedAt);
 if(!Number.isFinite(sourceTime))throw new Error('Потрібна дата формування джерела.');
 const key=v=>String(v??'').trim().toUpperCase();
 const excluded=new Set(excludedSkus.map(key));
 const counts=new Map();
 for(const row of rows){const id=key(row.vendor)+'|'+key(row.sku);counts.set(id,(counts.get(id)||0)+1);}
 const ready=[],review=[];
 for(const row of rows){
  if(row.stockDetail?.kind!=='unknown')continue;
  const sku=key(row.sku),brand=key(row.vendor),supplierSku=key(row.supplierSku);
  const reason=!sku||!brand||!supplierSku||!row.supplierId?'Неповна ідентифікація':
   excluded.has(sku)?'Виключено з імпорту':
   counts.get(brand+'|'+sku)!==1?'Повторення артикула у джерелі':
   supplierSku!==sku?'Потрібна підтверджена відповідність кодів':null;
  const candidates=offers.filter(o=>o.supplier==='MTI'&&key(o.supplier_sku)===supplierSku);
  const offer=candidates[0];
  const mismatch=reason|| (candidates.length!==1?'Немає однозначної пропозиції МТІ':
   key(offer.brand)!==brand||key(offer.manufacturer_sku)!==sku||String(offer.supplier_product_id)!==String(row.supplierId)?'Ідентифікація пропозиції відрізняється':
   !Number.isFinite(Date.parse(offer.observed_at))?'Немає дати попереднього спостереження':
   Date.parse(offer.observed_at)>=sourceTime?'Пропозиція має новішу або таку саму дату':null);
  if(mismatch){review.push({sku,reason:mismatch});continue;}
  ready.push({supplier:'MTI',supplierSku,brand:row.vendor,manufacturerSku:row.sku,supplierId:row.supplierId,productId:offer.product_id,
   expectedObservedAt:offer.observed_at,expectedStockKind:offer.stock_kind,
   expectedQuantity:offer.stock_quantity,sourceObservedAt,sourceRow:row.sourceRow,
   stockKind:'unknown',quantity:null});
 }
 return {ready,review};
}

