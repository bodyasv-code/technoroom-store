// Public metadata GET + public Icecat demo GET only. No auth secrets or DB writes.
import {readFile} from 'node:fs/promises';
import {analyseIcecatResponse} from './content-pilot-analysis.mjs';
const ids=[4331,4530,439,159,247,684,576,2522,2618,3360,4033,4381];
const cfg=await readFile(new URL('../public/supabase-config.js',import.meta.url),'utf8');
const base=/url:\s*'([^']+)'/.exec(cfg)?.[1],key=/publishableKey:\s*'([^']+)'/.exec(cfg)?.[1];
if(!base||!key)throw new Error('Missing public config');
const url=new URL('/rest/v1/products',base);
url.search=new URLSearchParams({select:'id,name,sku,category,brand',is_active:'eq.true',id:'in.('+ids.join(',')+')'});
const catalog=await fetch(url,{headers:{apikey:key},signal:AbortSignal.timeout(20000)});
if(!catalog.ok)throw new Error('Public catalog read failed '+catalog.status);
const products=await catalog.json();
if(products.length!==ids.length)throw new Error('Pilot sample changed: expected 12 active products');
async function request(product,language){
  const endpoint=new URL('https://live.icecat.biz/api');
  endpoint.search=new URLSearchParams({lang:language,shopname:'openicecat-live',Brand:product.brand,ProductCode:product.sku});
  try{
    const response=await fetch(endpoint,{signal:AbortSignal.timeout(20000)});
    if(response.status===429)throw new Error('Rate limit: stop and retry later');
    let body;try{body=await response.json();}catch{return {language,httpStatus:response.status,received:false,exactIdentity:false,error:'non-json'};}
    return analyseIcecatResponse(product,body,{language,httpStatus:response.status});
  }catch(error){
    if(error.message.startsWith('Rate limit'))throw error;
    return {language,received:false,exactIdentity:false,error:error.name};
  }
}
const results=[];
// Bounded three-product batches, two documented locales per product.
for(let offset=0;offset<products.length;offset+=3){
  results.push(...await Promise.all(products.slice(offset,offset+3).map(async product=>({
    ...product,english:await request(product,'EN'),ukrainianRequest:await request(product,'UK'),
  }))));
}
console.log(JSON.stringify({date:new Date().toISOString(),readOnly:true,databaseWrites:0,credentialsUsed:false,
  access:'Documented public demo account openicecat-live, not the user subscription',
  sampleSize:results.length,results,
  summary:{receivedEnglish:results.filter(p=>p.english.received).length,
    exactEnglish:results.filter(p=>p.english.exactIdentity).length,
    withFeatures:results.filter(p=>p.english.exactIdentity&&p.english.features>0).length,
    withImages:results.filter(p=>p.english.exactIdentity&&p.english.imagePresent).length,
    receivedUkRequests:results.filter(p=>p.ukrainianRequest.received).length,
    // This is an indicator, not proof of a completely translated data sheet.
    ukNameIndicator:results.filter(p=>p.ukrainianRequest.ukrainianFeatureNames>0).length},
  limitations:['Non-random 12-product sample; not catalog-wide coverage',
    'Demo access is not a license or proof of production entitlement',
    'Exact identity does not validate every technical value',
    'UK request may return fallback languages; no automatic translation/publication']
}));
