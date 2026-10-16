// Never publish distributor-to-dealer programs in customer product content.
const dealerMarker=/(?:програм[аи]\s+(?:захисту\s+рентабельност[іи]|реєстрації\s+про[єе]ктів)|шановн[іи]\s+партнер[иі]|уважаемые\s+партн[её]ры|dear\s+(?:partners|dealers)|(?:акці[яїю]|акци[яию]|промо\p{L}*|знижк\p{L}*|скидк\p{L}*|бонус\p{L}*|спец\p{L}*\s+цін\p{L}*).{0,70}(?:дилер\p{L}*|партнер\p{L}*|партн[её]р\p{L}*)|(?:дилер\p{L}*|dealer).{0,60}(?:акці|акци|промо|promotion|discount|цін|цен|бонус|марж)|(?:dealer|partner)\s+(?:promotion|rebate|incentive|margin|program))/iu;
export const hasDealerContent=value=>dealerMarker.test(String(value??''));
export function cleanCustomerText(value) {
  if(typeof value!=='string'||!hasDealerContent(value))return value;
  // Supplier notices are independent blocks or trailing additions. Keep the
  // preceding technical text; do not retain an unmarked continuation of a notice.
  const normalized=value.replace(/<\/(?:p|div|li|h[1-6])\s*>|<br\s*\/?\s*>/giu,'\n').replace(/<(?:p|div|li|h[1-6])(?:\s[^>]*)?>/giu,'');
  const index=normalized.search(dealerMarker);
  return normalized.slice(0,index).replace(/(?:\s|[:;|•-])+$/gu,'').trim();
}
export function cleanCustomerSpecifications(specifications={}) {
  if(Array.isArray(specifications))return specifications;
  const result={};
  for(const [key,value] of Object.entries(specifications||{})){
    if(hasDealerContent(key))continue;
    if(Array.isArray(value)){
      if(!hasDealerContent(JSON.stringify(value))){result[key]=value;continue;}
      const cleaned=value.map(item=>typeof item==='string'?cleanCustomerText(item):item).filter(item=>item!=='');
      if(cleaned.length)result[key]=cleaned;
    }else{
      const cleaned=cleanCustomerText(value);
      if(cleaned!==''||value==='')result[key]=cleaned;
    }
  }
  return result;
}
export function epsonPrintTechnology(product={}) {
  const name=String(product.name||'').trim(),brand=String(product.brand||'');
  if(brand.trim()&&!/^epson(?:\s|$)/iu.test(brand.trim()))return '';
  if(!/epson/iu.test(brand+' '+name))return '';
  if(!/^(?:принтер|printer|бфп|мфу|mfp|багатофункціональний пристрій)\s/iu.test(name))return '';
  const source=[name,...Object.entries(product.specifications||{}).filter(([key])=>/технолог|метод.*друк|printing method/iu.test(key)).map(([,value])=>value)].join(' ');
  if(/матрич|dot\s*matrix|термо|thermal|лазер|laser|aculaser|\b(?:FX|DFX|LX|LQ|DLQ|PLQ|EPL)[ -]?\d|\bTM-(?!C\d)/iu.test(source))return '';
  if(product.category&& !/^office-(?:printers|mfp|wide-format)(?:-|$)/u.test(product.category))return '';
  return 'Струменевий';
}
export function applyCustomerProductPolicy(product={}) {
  const specifications=cleanCustomerSpecifications(product.specifications);
  const technology=epsonPrintTechnology({...product,specifications});
  if(technology&&!String(specifications['Технологія друку']||specifications['Технологія']||'').trim())specifications['Технологія друку']=technology;
  return {...product,description:cleanCustomerText(product.description),specifications};
}
export function customerProductRepair(product={}) {
  if(Array.isArray(product.specifications))return null;
  const clean=applyCustomerProductPolicy(product),patch={};
  if(clean.description!==product.description)patch.description=clean.description;
  if(JSON.stringify(clean.specifications)!==JSON.stringify(product.specifications||{}))patch.specifications=clean.specifications;
  if(!Object.keys(patch).length)return null;
  return {id:product.id,sku:product.sku,before:product,patch,confidential:hasDealerContent(product.description)||hasDealerContent(JSON.stringify(product.specifications))};
}
export function confirmCustomerProductRepair(plans) {
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='inquiry-dialog';
    const content=document.createElement('div');content.className='inquiry-form';
    const heading=document.createElement('h2');heading.textContent='Очищення інформації про товари';
    const detail=document.createElement('p');detail.textContent='Дилерські повідомлення: '+plans.filter(plan=>plan.confidential).length+' товарів. Усього оновлень: '+plans.length+', включно з прихованими. Також заповнюється відсутня технологія друку Epson, крім матричних, термо- й лазерних моделей. Назви, ціни, категорії, фото й інші технічні характеристики не змінюються.';
    const approve=document.createElement('button');approve.type='button';approve.className='button';approve.textContent='Застосувати '+plans.length+' оновлень';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='button outline';cancel.textContent='Скасувати';
    const finish=approved=>{dialog.close();dialog.remove();resolve(approved)};
    approve.onclick=()=>finish(true);cancel.onclick=()=>finish(false);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false)});
    content.append(heading,detail,approve,cancel);dialog.append(content);document.body.append(dialog);dialog.showModal();
  });
}
export async function applyCustomerProductRepair(client,plan) {
  let request=client.from('products').update(plan.patch).eq('id',plan.id);
  request=plan.sku==null?request.is('sku',null):request.eq('sku',plan.sku);
  // Compare only fields being written. Unchanged descriptions/specifications
  // must neither lengthen the URL nor block unrelated concurrent edits.
  if(Object.hasOwn(plan.patch,'specifications'))request=plan.before.specifications==null?request.is('specifications',null):request.eq('specifications',JSON.stringify(plan.before.specifications));
  if(Object.hasOwn(plan.patch,'description'))request=plan.before.description==null?request.is('description',null):request.eq('description',plan.before.description);
  const result=await request.select('id');
  if(result.error)throw result.error;
  if(result.data?.length!==1)throw new Error('Товар '+plan.id+' змінився. Оновіть дані та повторіть перевірку.');
  return plan.id;
}
