// Read-only batch audit. Reuses gallery normalization and image header validation.
// Usage: node scripts/audit-projection-images.mjs INPUT.json OUTPUT.json
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {productGalleryPaths} from '../public/admin-product-gallery.js';
import {imageFileInfo} from '../server/icecat-product-images.js';
import {isReviewedProjectorImageUrl} from '../server/reviewed-projector-image-sources.js';
import {isEliteScreenImageUrl} from '../server/elite-screen-image-source.js';
const [inputPath,outputPath]=process.argv.slice(2);
if(!inputPath||!outputPath)throw Error('Input and output paths required');
const input=JSON.parse(await readFile(inputPath,'utf8'));
const origin='https://www.technoroom.com.ua',storage='https://yioxzymgswewjphkuxjs.supabase.co/storage/v1/object/public/product-images/';
const trusted=new Set(['www.technoroom.com.ua','yioxzymgswewjphkuxjs.supabase.co','static.mti.ua','region-resource.optoma.com']);
function allowed(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(trusted.has(u.hostname)||isReviewedProjectorImageUrl(u)||isEliteScreenImageUrl(u));}catch{return false;}}
function imageUrl(path){return /^https?:/i.test(path)?path:storage+path.split('/').map(encodeURIComponent).join('/');}
const tasks=new Map(),cards=[];
function add(url,reference){const entry=tasks.get(url)||{url,references:[]};entry.references.push(reference);tasks.set(url,entry);}
for(const p of input.products){
 const paths=productGalleryPaths(p),stored=(p.image_paths||[]).filter(Boolean),repeated=stored.filter((v,i)=>stored.indexOf(v)!==i);
 const card={id:p.id,sku:p.sku,name:p.name,active:p.is_active,photos:paths.length,mainUrl:null,galleryUrls:[],repeatedPaths:[...new Set(repeated)]};
 if(p.image_path){card.mainUrl=p.is_active&&/^https?:/i.test(p.image_path)?origin+'/api/product-image?id='+p.id:imageUrl(p.image_path);add(card.mainUrl,{id:p.id,role:p.is_active?'customer-main':'hidden-main-source'});}
 paths.forEach((path,index)=>{const url=imageUrl(path);card.galleryUrls.push(url);add(url,{id:p.id,role:'gallery',index:index+1});});cards.push(card);
}
async function check(task){
 if(!allowed(task.url))return {...task,ok:false,issue:'source-not-reviewed'};
 const signal=AbortSignal.timeout(12000);let url=task.url;
 try{
  let response;
  for(let redirects=0;redirects<=3;redirects++){
   response=await fetch(url,{signal,redirect:'manual',headers:{'User-Agent':'Mozilla/5.0 (compatible; TECHNOROOM read-only image audit)',...(new URL(url).hostname==='region-resource.optoma.com'?{Referer:'https://www.optomausa.com/'}:{})}});
   if(![301,302,303,307,308].includes(response.status))break;
   const location=response.headers.get('location');await response.body?.cancel();if(!location)return {...task,ok:false,issue:'redirect-without-location'};
   url=new URL(location,url).href;if(redirects===3||!allowed(url))return {...task,ok:false,issue:'unreviewed-redirect',redirect:url};
  }
  const type=response.headers.get('content-type')||'',length=Number(response.headers.get('content-length'))||null;
  if(!response.ok||!type.startsWith('image/')){await response.body?.cancel();return {...task,ok:false,status:response.status,type,length,issue:response.ok?'not-an-image':'http-error'};}
  const reader=response.body.getReader(),parts=[];let bytes=0,complete=false;
  try{for(;;){const chunk=await reader.read();if(chunk.done){complete=true;break;}const remaining=262144-bytes;parts.push(chunk.value.subarray(0,remaining));bytes+=Math.min(chunk.value.byteLength,remaining);if(bytes>=262144)break;}}finally{await reader.cancel().catch(()=>{});}
  const body=Buffer.concat(parts,bytes),result={...task,ok:true,status:response.status,type,length,prefixBytes:bytes,complete,finalUrl:url};
  if(complete)result.sha256=createHash('sha256').update(body).digest('hex');
  try{const info=imageFileInfo(body,type);result.width=info.width;result.height=info.height;}catch(error){result.ok=false;result.issue='dimensions-or-format-needs-review';result.detail=error.message;}
  return result;
 }catch(error){return {...task,ok:false,issue:'request-failed',detail:error.message};}
}
const pending=[...tasks.values()],results=[];let cursor=0;
console.log(JSON.stringify({cards:cards.length,uniqueImageRequests:pending.length,concurrency:6,bodyLimitPerImage:262144}));
await Promise.all(Array.from({length:6},async()=>{for(;;){const index=cursor++;if(index>=pending.length)break;results.push(await check(pending[index]));if(results.length%30===0)console.log(JSON.stringify({checked:results.length,total:pending.length}));}}));
const byUrl=new Map(results.map(r=>[r.url,r]));
for(const c of cards){c.mainCheck=c.mainUrl?byUrl.get(c.mainUrl):null;c.failedGalleryUrls=c.galleryUrls.filter(url=>!byUrl.get(url)?.ok);c.issues=[...(!c.mainUrl?['missing-main']:[]),...(c.mainCheck&&!c.mainCheck.ok?['main-unavailable-or-needs-review']:[]),...(c.failedGalleryUrls.length?['gallery-needs-review']:[]),...(c.repeatedPaths.length?['repeated-gallery-paths']:[])];}
const hashes=new Map();for(const r of results.filter(r=>r.sha256)){const group=hashes.get(r.sha256)||[];group.push(r.url);hashes.set(r.sha256,group);}
const report={checkedAt:new Date().toISOString(),snapshotAt:input.checked_at,readOnly:true,scope:'Existing 93 cards matched to the owner MTI projection price; live snapshot. No product updates.',method:'HTTP GET, MIME and image header dimensions; at most 256 KiB per URL. Full-body hashes only for files that finished within that limit. Visual model correctness and full image decode are not inferred.',summary:{cards:cards.length,active:cards.filter(c=>c.active).length,uniqueImageRequests:results.length,passed:results.filter(r=>r.ok).length,failedOrNeedsReview:results.filter(r=>!r.ok).length,missingMain:cards.filter(c=>!c.mainUrl).length,cardsNeedingReview:cards.filter(c=>c.issues.length).length,activeCardsWithMainIssue:cards.filter(c=>c.active&&(!c.mainCheck||!c.mainCheck.ok)).length,repeatedPaths:cards.reduce((n,c)=>n+c.repeatedPaths.length,0)},cards,requests:results.sort((a,b)=>a.url.localeCompare(b.url)),identicalSmallFiles:[...hashes].filter(([,urls])=>urls.length>1).map(([sha256,urls])=>({sha256,urls}))};
await writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summary:report.summary,mainProblems:cards.filter(c=>!c.mainCheck||!c.mainCheck.ok).map(c=>({id:c.id,sku:c.sku,active:c.active,issue:c.mainCheck?.issue||'missing-main',status:c.mainCheck?.status})),output:outputPath}));
