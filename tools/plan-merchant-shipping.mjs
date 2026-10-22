// Proposal only: no database writes, feed edits or Google account changes.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {readFeedRows} from '../server/merchant-feed.js';
const key=value=>String(value).trim().replace(/:$/,'').toLowerCase();
function scalar(value,label,type){
  const text=String(value??'').trim().toLowerCase().replace(',','.');
  const match=text.match(/^(\d+(?:\.\d+)?)\s*(кг|kg|кілограм(?:ів|и)?|г|g|грам(?:ів|и)?|мм|mm|см|cm|м|m)?$/u);
  if(!match||Number(match[1])<=0)return null;
  const unit=match[2]||label.match(/\b(kg|mm|cm)\b|(?:^|[^а-яіїєґ])(кг|мм|см)(?:$|[^а-яіїєґ])/u)?.slice(1).find(Boolean);
  if(type==='weight')return /^(кг|kg|кілограм)/u.test(unit||'')?Number(match[1]):/^(г|g|грам)/u.test(unit||'')?Number(match[1])/1000:null;
  return /^(мм|mm)$/u.test(unit||'')?Number(match[1])/10:/^(см|cm)$/u.test(unit||'')?Number(match[1]):/^(м|m)$/u.test(unit||'')?Number(match[1])*100:null;
}
export function proposeShippingGroup(product){
  const entries=Object.entries(product.specifications||{}).map(([k,v])=>[key(k),v]);
  // Individual-package gross only: never net weight or a master-carton gross weight.
  const rawWeights=entries.filter(([k])=>/^(?:вага|маса|package weight)/u.test(k)&&/упаков|пакув|package/u.test(k)&&!/нетто|без |короб|картон/u.test(k));
  const weights=rawWeights.map(([k,v])=>scalar(v,k,'weight'));
  const distinct=[...new Set(weights.filter(v=>v!==null))];
  if(!distinct.length)return {group:'needs_data',reason:'missing_explicit_package_gross'};
  if(distinct.length!==1||weights.some(v=>v===null))return {group:'needs_data',reason:'ambiguous_package_gross'};
  const units=entries.find(([k])=>k==='штук в упаковці');
  if(units&&String(units[1]).trim()!=='1')return {group:'needs_data',reason:'multipack_quantity_review'};
  const triples=entries.filter(([k])=>/габарит|розмір|dimension|package size/u.test(k)&&/упаков|пакув|package/u.test(k));
  const dimensions=[];
  for(const [k,v] of triples){
    const parts=String(v).toLowerCase().split(/[xх×]/u).map(v=>scalar(v,k,'length'));
    if(parts.length===3&&parts.every(v=>v!==null))dimensions.push(parts.sort((a,b)=>a-b));
  }
  if(!dimensions.length){
    const axes=['ширина','висота','глибина'].map(axis=>entries.filter(([k])=>k.startsWith(axis)&&/упаков|пакув/u.test(k)).map(([k,v])=>scalar(v,k,'length')));
    if(axes.every(values=>values.length>0&&values.every(v=>v!==null)&&new Set(values).size===1))dimensions.push(axes.map(v=>v[0]).sort((a,b)=>a-b));
  }
  const unique=[...new Map(dimensions.map(d=>[JSON.stringify(d),d])).values()];
  if(unique.length!==1)return {group:'needs_data',reason:unique.length?'conflicting_package_dimensions':'missing_package_dimensions'};
  const dims=unique[0],grossKg=distinct[0],volumetricKg=dims.reduce((a,b)=>a*b,1)/4000,billableKg=Math.max(grossKg,volumetricKg);
  const group=dims.at(-1)>120||billableKg>30?'oversize_review':billableKg<=2?'compact_2kg':billableKg<=10?'medium_10kg':'large_30kg';
  return {group,grossKg,dimensionsCm:dims,volumetricKg:Number(volumetricKg.toFixed(4)),billableKg:Number(billableKg.toFixed(4)),status:'candidate_verify_outer_shipping_packaging'};
}
async function main(){
  const config=fs.readFileSync(new URL('../public/supabase-config.js',import.meta.url),'utf8'),url=config.match(/url: '([^']+)'/)[1],publicKey=config.match(/publishableKey: '([^']+)'/)[1];
  const response=await fetch('https://www.technoroom.com.ua/google-merchant.xml',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Feed HTTP '+response.status);const xml=await response.text();
  const feedPrices=new Map([...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([,body])=>[body.match(/<g:id>(.*?)<\/g:id>/)[1],Number((body.match(/<g:sale_price>([\d.]+) UAH<\/g:sale_price>/)||body.match(/<g:price>([\d.]+) UAH<\/g:price>/))[1])]));
  const rows=await readFeedRows(createClient(url,publicKey,{auth:{persistSession:false}}),'products','id,name,sku,specifications',{filter:['is_active',true]});
  const products=rows.filter(p=>feedPrices.has(String(p.id))).map(p=>({id:p.id,sku:p.sku,name:p.name,feedPrice:feedPrices.get(String(p.id)),freeShippingByPrice:feedPrices.get(String(p.id))>=50000,...proposeShippingGroup(p)}));
  const counts={},reasons={};for(const p of products){counts[p.group]=(counts[p.group]||0)+1;if(p.reason)reasons[p.reason]=(reasons[p.reason]||0)+1;}
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),total:products.length,counts,reasons,freeShippingByPrice:products.filter(p=>p.freeShippingByPrice).length,candidates:products.filter(p=>p.group!=='needs_data'),needsDataIds:products.filter(p=>p.group==='needs_data').map(p=>p.id),notes:['Candidate groups only, no tariffs assigned.','Retail packaging may need a larger protective shipping box.','Master-carton weights are never used for a single sale unit.','Price threshold is separate from package group and does not estimate carrier costs.']},null,2));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
