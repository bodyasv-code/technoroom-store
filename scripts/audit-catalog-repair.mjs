// Read-only public catalog audit. Never reads credentials, customers or orders.
import {readFile} from 'node:fs/promises';
import {hasProductImage,isModelFamily,isPhoneAccessory,familyContentIssue} from '../public/product-quality-rules.js';
import {readPrinterEditorFormat} from '../public/printer-format-editor.js';
const config=await readFile(new URL('../public/supabase-config.js',import.meta.url),'utf8');
const url=/url:\s*'([^']+)'/.exec(config)?.[1],key=/publishableKey:\s*'([^']+)'/.exec(config)?.[1];
if(!url||!key)throw new Error('Missing public catalog configuration');
const products=[];
for(let offset=0;;offset+=1000){
  const endpoint=new URL('/rest/v1/products',url);endpoint.search=new URLSearchParams({select:'id,name,slug,sku,category,brand,price,is_active,parent_product_id,description,specifications,image_path,image_paths',order:'id',offset:String(offset),limit:'1000'});
  const response=await fetch(endpoint,{headers:{apikey:key},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Catalog read failed '+response.status);
  const rows=await response.json();products.push(...rows);if(rows.length<1000)break;
}
const families=products.filter(isModelFamily).map(product=>{const children=products.filter(child=>Number(child.parent_product_id)===Number(product.id));return {id:product.id,name:product.name,active:product.is_active,children:children.length,accessoryChildren:children.filter(isPhoneAccessory).map(child=>({id:child.id,name:child.name})),issue:familyContentIssue(product,products),description:product.description,specKeys:Object.keys(product.specifications||{})}});
console.log(JSON.stringify({readOnly:true,total:products.length,images:{all:products.filter(p=>!hasProductImage(p)).length,active:products.filter(p=>p.is_active&&!hasProductImage(p)).length,oldMainOnly:products.filter(p=>!p.image_path).length},families,printerExamples:products.filter(p=>[4530,4531,4534,4535,4537].includes(Number(p.id))).map(p=>({id:p.id,name:p.name,format:readPrinterEditorFormat(p.specifications,p.name),formatFields:Object.entries(p.specifications||{}).filter(([k])=>/формат/iu.test(k))}))},null,2));
