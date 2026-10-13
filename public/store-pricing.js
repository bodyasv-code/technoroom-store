// One promotion per product; no stacking. Lowest promotion ID wins.
export function matchingPromotion(product, promotions, links, now=Date.now()) {
  return [...promotions].sort((a,b)=>Number(a.id)-Number(b.id)).find(p => {
    if (p.is_active === false || (p.starts_at && Date.parse(p.starts_at)>now)
      || (p.ends_at && Date.parse(p.ends_at)<now)) return false;
    const type=p.target_type||'all';
    if(type==='all') return true;
    if(type==='category') return String(p.target_value)===String(product.type??product.category);
    if(type==='brand') return Number(p.target_value)===Number(product.brand_id);
    if(type==='products') return links.get(Number(p.id))?.has(Number(product.id))
      || (product.parentProductId && links.get(Number(p.id))?.has(Number(product.parentProductId)));
    return false;
  }) || null;
}
export function discountedPrice(price, promotion) {
  const base=Number(price);
  const discount=Number(promotion?.discount_value||0);
  const value=!promotion?base:promotion.discount_type==='percent'
    ?base*(1-discount/100):base-discount;
  return Math.round((Math.max(0,value)+Number.EPSILON)*100)/100;
}
