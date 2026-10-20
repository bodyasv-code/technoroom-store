// Keep the admin's inclusive matching, but rank identities ahead of compatibility lists.
export const adminSearchText=(value='')=>String(value??'').toLocaleLowerCase('uk-UA')
  .replace(/[ʼ'’`]/g,'').replace(/[\s_\-–—/.,]+/g,'');
const accessoryTitle=/^\s*(?:картридж|тонер|стрічк|чорнил|комплект\s+для|папір|фотопапір|кабел|адаптер|лампа|чохол|cartridge|toner|ink\b|ribbon)/iu;
const compatibility=/\s+(?:для|до|принтерів|принтера|сумісн\S*|for|compatible)\s+/iu;
function exactModelPhrase(title,query) {
  const words=String(title||'').toLocaleLowerCase('uk-UA').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for(let start=0;start<words.length;start++) {
    let phrase='';
    for(let end=start;end<words.length&&phrase.length<query.length;end++) {
      phrase+=words[end];
      if(phrase===query)return true;
    }
  }
  return false;
}
export function adminProductSearchScore(product,query) {
  const q=adminSearchText(query);
  if(!q)return 0;
  const name=adminSearchText(product.name),sku=adminSearchText(product.sku);
  const hay=adminSearchText([product.id,product.name,product.brand,product.sku,product.slug,product.category].join(' '));
  if(!hay.includes(q))return -1;
  if(sku===q||String(product.id)===q)return 10000;
  if(name===q)return 9000;
  if(sku&&sku.startsWith(q))return 8000;
  const mainTitle=accessoryTitle.test(product.name||'')
    ? String(product.name).split(compatibility)[0] : product.name;
  if(adminSearchText(mainTitle).includes(q))return exactModelPhrase(mainTitle,q)?6000:5000;
  if(name.includes(q))return 2000;
  return 1000;
}
export function rankAdminProducts(products,query) {
  if(!adminSearchText(query))return products;
  return products.map((product,index)=>({product,index,score:adminProductSearchScore(product,query)}))
    .filter(row=>row.score>=0).sort((a,b)=>b.score-a.score||a.index-b.index).map(row=>row.product);
}
