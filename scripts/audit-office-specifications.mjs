// Public catalog GETs only. Outputs a proposal; does not apply anything.
import {readFile} from 'node:fs/promises';
import {planOfficeSpecificationCleanup} from './office-specification-cleanup.mjs';
import {isPrinterDevice} from '../public/printer-display.js';
const config=await readFile(new URL('../public/supabase-config.js',import.meta.url),'utf8');
const base=/url:\s*'([^']+)'/.exec(config)?.[1],key=/publishableKey:\s*'([^']+)'/.exec(config)?.[1];
if(!base||!key)throw new Error('Missing public config');
const products=[];
for(let offset=0;;offset+=1000){
  const url=new URL('/rest/v1/products',base);
  url.search=new URLSearchParams({select:'id,name,sku,category,is_active,specifications',is_active:'eq.true',order:'id',offset:String(offset),limit:'1000'});
  const response=await fetch(url,{headers:{apikey:key},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Public read failed '+response.status);
  const rows=await response.json();products.push(...rows);if(rows.length<1000)break;
}
const office=products.filter(p=>p.category?.startsWith('office-')||isPrinterDevice(p));
const plans=products.map(planOfficeSpecificationCleanup);
const changed=plans.filter(p=>p.changes.length),partArg=process.argv.find(a=>a.startsWith('--part='));
const part=partArg?Number(partArg.split('=')[1]):null;
console.log(JSON.stringify({date:'2026-10-24',applied:false,active:products.length,office:office.length,changedCount:changed.length,fieldCount:changed.reduce((sum,p)=>sum+p.changes.length,0),changed:part===null?[]:changed.slice(part*12,(part+1)*12),manual:part===null?plans.filter(p=>p.manual.length).map(({before,after,changes,...rest})=>rest):[]}));
