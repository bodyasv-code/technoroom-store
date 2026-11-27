import {isSpecificationLabel} from './supplier-specification-parser.js?v=20261127-cleanup';

const plain=value=>String(value??'').normalize('NFKC').replace(/\s+/gu,' ').trim();
const identity=value=>plain(value).toLocaleLowerCase('uk-UA').replace(/\s*\(інше значення \d+\)$/u,'');
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');
const projection=new Set(['cat-projectors','projectors','erc-display-06','erc-display-08','erc-display-10','erc-display-14','erc-display-15']);
export const duplicateTailScope=product=>String(product?.category||'').startsWith('office-')||projection.has(product?.category);

// Shorten only exact, explicitly labelled repeats already stored in sibling
// fields. Never extract missing facts, convert units or resolve disagreements.
function duplicateTailPass(product={}) {
  const before=product.specifications;
  if(!before||typeof before!=='object'||Array.isArray(before))return {after:before,changes:[]};
  const after={...before},changes=[];
  if(!duplicateTailScope(product)||product.manual_overrides?.verified_specifications)return {after,changes};
  const reviewed=product.manual_overrides?.reviewed_specifications;
  const protectedKeys=new Set([...Object.keys(product.manual_overrides?.specifications||{}),...(Array.isArray(reviewed)?reviewed:[])].map(identity));
  const entries=Object.entries(before),targets=entries.filter(([key,value])=>isSpecificationLabel(key)
    &&!Object.keys(before).some(other=>other!==key&&identity(other)===identity(key))
    &&(typeof value==='string'||typeof value==='number'&&Number.isFinite(value))&&plain(value));
  for(const [key,raw] of entries){
    if(typeof raw!=='string'||!isSpecificationLabel(key)||protectedKeys.has(identity(key)))continue;
    let value=raw;const removed=[];
    for(let pass=0;pass<entries.length;pass++){
      const candidates=[];
      for(const [target,expected] of targets){
        if(target===key)continue;
        const label=plain(target);
        const pattern=new RegExp('\\s+'+escape(label).replace(/ /gu,'\\s+')+'\\s*[:：]\\s*([\\s\\S]+)$','iu');
        const match=pattern.exec(value);
        if(!match||plain(match[1])!==plain(expected))continue;
        const prefix=value.slice(0,match.index).trim();
        // A label inside a longer label is not a reliable boundary.
        if(!prefix||/(?:оперативна|вбудована|максимальна|мінімальна|оптична|цифрова|тип|модель|версія|частота)\s*$/iu.test(prefix))continue;
        candidates.push({target,prefix,index:match.index});
      }
      if(!candidates.length)break;
      candidates.sort((a,b)=>a.index-b.index);
      const candidate=candidates[0];value=candidate.prefix;removed.unshift(candidate.target);
    }
    if(value!==raw){after[key]=value;changes.push({key,before:raw,after:value,duplicates:removed});}
  }
  return {after,changes};
}

export function planDuplicateSpecificationTails(product={}) {
  let after=product.specifications;const changes=new Map();
  // A sibling may itself contain the same repeated suffix. Resolve the whole
  // chain now so a later import does not keep changing already cleaned fields.
  for(let pass=0;pass<=Object.keys(product.specifications||{}).length;pass++){
    const next=duplicateTailPass({...product,specifications:after});after=next.after;
    if(!next.changes.length)break;
    for(const change of next.changes){
      const previous=changes.get(change.key);
      changes.set(change.key,previous?{...previous,after:change.after,duplicates:[...change.duplicates,...previous.duplicates]}:change);
    }
  }
  return {after,changes:[...changes.values()]};
}
