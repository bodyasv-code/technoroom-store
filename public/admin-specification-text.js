import {normalizeSpecifications} from './specification-normalization.js?v=20261017-customer-content';

// Text fields display arrays as comma-separated text. A save without a change
// must retain the original JSON types used by filters and content comparisons.
export function parseProductSpecificationText(text,original={},options={}){
  const previous=normalizeSpecifications(original,options),parsed={};
  for(const line of String(text||'').split('\n')){
    const separator=line.indexOf(':');
    if(separator<0)continue;
    const key=line.slice(0,separator).trim(),value=line.slice(separator+1).trim();
    if(!key)continue;
    const saved=Object.hasOwn(previous,key)&&String(previous[key]).trim()===value?previous[key]:value;
    Object.defineProperty(parsed,key,{value:saved,enumerable:true,writable:true,configurable:true});
  }
  return normalizeSpecifications(parsed,options);
}
