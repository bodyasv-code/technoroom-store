// Public product metadata only. No mutations, credentials, customers or orders.
import {readFile} from 'node:fs/promises';
import {specificationContentProblems} from '../public/supplier-specification-parser.js';
const config=await readFile(new URL('../public/supabase-config.js',import.meta.url),'utf8');
const url=/url:\s*'([^']+)'/.exec(config)?.[1],key=/publishableKey:\s*'([^']+)'/.exec(config)?.[1];
if(!url||!key)throw new Error('Missing public catalog configuration');
const products=[];
for(let offset=0;;offset+=1000){
  const endpoint=new URL('/rest/v1/products',url);endpoint.search=new URLSearchParams({select:'id,name,sku,is_active,category,specifications',order:'id',offset:String(offset),limit:'1000'});
  const response=await fetch(endpoint,{headers:{apikey:key},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Catalog read failed '+response.status);
  const rows=await response.json();products.push(...rows);if(rows.length<1000)break;
}
const affected=products.map(p=>({...p,problems:specificationContentProblems(p.specifications)})).filter(p=>p.problems.length);
console.log(JSON.stringify({readOnly:true,total:products.length,affected:affected.length,reasons:Object.fromEntries(['fragment','markup','flattened'].map(reason=>[reason,affected.filter(p=>p.problems.some(x=>x.reason===reason)).length])),examples:affected.slice(0,12).map(p=>({id:p.id,sku:p.sku,name:p.name,problems:p.problems.slice(0,6)})),hpExample:affected.find(p=>p.id===4530)},null,2));
