// Shared by reports, product filters and the quality panel.
export const hasProductImage=product=>Boolean(String(product?.image_path||'').trim()||
  (Array.isArray(product?.image_paths)&&product.image_paths.some(path=>typeof path==='string'&&path.trim())));
export const qualityScopeMatches=(product,scope='active')=>scope==='all'||(scope==='draft'?!product.is_active:!!product.is_active);
export const isModelFamily=product=>/^(?:apple-family-iphone-|samsung-family-galaxy-)/u.test(String(product?.slug||''));
export const isPhoneAccessory=product=>/чох[оі]л|чехол|case\b|cover\b|захисн.{0,12}(?:скло|плівк)|кабель|cable\b|зарядн|adapter\b|адаптер/iu.test(String(product?.name||''))||
  /^(?:(?:плетений|силіконовий|захисний|шкіряний|прозорий)\s+)*(?:чохол|чехол|case\b|cover\b|кабель)/iu.test(String(product?.description||'').replace(/<[^>]*>/g,'').trim())||
  Object.keys(product?.specifications||{}).some(key=>/тип чохла/iu.test(key));
export function familyContentIssue(product,products=[]) {
  if(!isModelFamily(product))return '';
  const children=products.filter(row=>Number(row.parent_product_id)===Number(product.id));
  if(isPhoneAccessory({name:'',description:product.description})||Object.keys(product.specifications||{}).some(key=>/тип чохла|підходить до|сумісність/iu.test(key)))return 'Головна картка моделі містить дані аксесуара. Перевірте дочірні товари; опис і характеристики не можна копіювати з чохла.';
  if(!children.length)return 'Головна картка моделі не має жодної модифікації. Перевірте зв’язки з товарами.';
  return '';
}
