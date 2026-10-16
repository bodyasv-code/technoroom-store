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
