import {normalizeSpecifications} from './specification-normalization.js?v=20261017-customer-content';
import {comparableSpecificationValue} from './specification-values.js?v=20261012-spec-format';
import {isProjectorProduct} from './projector-specs.js?v=20261013-spec-colons';
import {duplexKey} from './printer-duplex.js?v=20261016-import-guards-2';
import {printFormatKey} from './verified-printer-rules.js?v=20261016-import-guards-2';
const own=(object,key)=>Object.hasOwn(object||{},key);
export const manualFields=product=>product?.manual_overrides||{};
export function manualSpecIdentity(key,product={}) {
  if(duplexKey.test(key))return 'duplex';
  if(printFormatKey.test(key))return 'print-format';
  if(/^інтерфейс[и]?\s*[:：]?$/iu.test(key.trim()))return 'interfaces';
  const canonical=Object.keys(normalizeSpecifications({[key]:'manual-field'},{projector:isProjectorProduct(product)}))[0]||key;
  return canonical.trim().toLocaleLowerCase('uk-UA').replace(/\s*\(інше значення \d+\)$/u,'');
}
export function preserveManualSpecifications(merged,current) {
  if(manualFields(current).verified_specifications)return {...current.specifications};
  const result={...merged},saved=current?.specifications||{};
  const keys=Object.keys(manualFields(current).specifications||{});
  for(const key of keys) {
    const identity=manualSpecIdentity(key,current);
    for(const candidate of Object.keys(result))if(manualSpecIdentity(candidate,current)===identity)delete result[candidate];
  }
  // Restore after all alias removals: renaming a manual key creates both a
  // tombstone and a live key, whose JSON ordering must not affect the outcome.
  for(const key of keys)if(own(saved,key))Object.defineProperty(result,key,{value:saved[key],enumerable:true,writable:true,configurable:true});
  return result;
}
export function manualImportConflicts(row,current,category='') {
  const fields=manualFields(current),result=[];
  const compare=(label,before,incoming)=>{
    if(comparableSpecificationValue(label,before)!==comparableSpecificationValue(label,incoming))result.push({label,before:before??null,incoming:incoming??null});
  };
  if(fields.category&&category)compare('Категорія',current.category,category);
  if(fields.brand&&row.vendor)compare('Бренд',current.brand,row.vendor);
  const incoming=row.specifications||{};
  if(fields.verified_specifications){
    for(const [key,value] of Object.entries(incoming)){
      const saved=Object.entries(current.specifications||{}).find(([candidate])=>manualSpecIdentity(candidate,current)===manualSpecIdentity(key,current));
      compare('Перевірена характеристика: '+key,saved?.[1],value);
    }
    return result;
  }
  const keys=Object.keys(fields.specifications||{});
  for(const key of keys)for(const [candidate,value] of Object.entries(incoming)) {
    if(!own(current.specifications,key)&&keys.some(live=>own(current.specifications,live)&&manualSpecIdentity(live,current)===manualSpecIdentity(key,current)))continue;
    if(manualSpecIdentity(candidate,current)===manualSpecIdentity(key,current))compare('Характеристика: '+key,current.specifications?.[key],value);
  }
  return result;
}
export function manualOverrideSummary(product) {
  if(product&&!own(product,'manual_overrides'))return 'Облік ручних правок ще не підключено до бази.';
  const fields=manualFields(product),labels=[fields.category?'категорія':'',fields.brand?'бренд':'',...Object.keys(fields.specifications||{}).map(key=>'«'+key+'»')].filter(Boolean);
  if(fields.verified_specifications)return 'Характеристики перевірено: імпорт зберігає всю таблицю. Ручне редагування доступне.'+(fields.description?' Опис також захищено від імпорту.':'');
  return labels.length?'Виправлено вручну: '+labels.join(', ')+'. Імпорт не змінює ці поля.':'Нові ручні зміни категорії, бренду та характеристик буде захищено від імпорту після збереження.';
}
