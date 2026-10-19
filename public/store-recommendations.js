// A curated-looking selection from loaded live catalog data, not a popularity score.
export function recommendedProducts(products,{currentId=null,allowedCategories=null,limit=4}={}) {
  const current=products.find(product=>Number(product.id)===Number(currentId));
  const excluded=new Set([Number(currentId),Number(current?.parentProductId)].filter(Boolean));
  return products.filter(product=>Number.isSafeInteger(Number(product.id))&&Number(product.id)>0
    &&!excluded.has(Number(product.id))&&!product.parentProductId&&product.stock===true
    &&Number.isFinite(Number(product.price))&&Number(product.price)>0
    &&(!current||product.type===current.type)&&(!allowedCategories||allowedCategories.has(product.type)))
    .sort((a,b)=>Number(Boolean(b.image))-Number(Boolean(a.image)))
    .slice(0,limit);
}
