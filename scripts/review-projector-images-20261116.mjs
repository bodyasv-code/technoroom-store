import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const rows=JSON.parse(await readFile('.manufacturer-images-20261116.json','utf8'));
const source='https://www.benq.com/en-us/projector/home-projectors/tk705i.html';
const extra=await fetch(source,{signal:AbortSignal.timeout(20000)});const html=await extra.text();
await writeFile('.manufacturer-pages-20261116/6169.html',html);
rows.push({id:6169,model:'TK705i',source,imageTags:[...html.matchAll(/<(?:img|meta)\b[^>]*>/giu)].map(m=>m[0])});
const candidates=[];
for(const row of rows){
 if([6141,6142].includes(row.id))continue;
 let original=row.imageTags.find(tag=>/property="og:image"/iu.test(tag))?.match(/content="([^"]+)"/iu)?.[1];
 if(row.id===6136)original=row.imageTags.find(tag=>/src="https:\/\/image\.benq.*front/iu.test(tag))?.match(/src="([^"]+)"/iu)?.[1];
 if(row.id===6145)original=row.urls.find(url=>url.includes('/products/images/'));
 if(!original)throw Error('No exact manufacturer image for '+row.id);
 const url=new URL(original.replaceAll('&amp;','&'));
 if(url.hostname==='image.benq.com'){url.search='';url.searchParams.set('wid','1200');url.searchParams.set('fmt','png-alpha');}
 candidates.push({id:row.id,model:row.model,source:row.source,original,url:url.href});
}
await mkdir('.photo-review/projectors-20261116',{recursive:true});
const result=[];
for(let i=0;i<candidates.length;i+=4)result.push(...await Promise.all(candidates.slice(i,i+4).map(async p=>{
 try{
  const response=await fetch(p.url,{headers:{'User-Agent':'Mozilla/5.0',Referer:p.source},signal:AbortSignal.timeout(20000)}),bytes=Buffer.from(await response.arrayBuffer()),type=response.headers.get('content-type');
  if(!response.ok||!type?.startsWith('image/')||bytes.length<1000)throw Error('Image HTTP '+response.status+' '+type);
  const file='.photo-review/projectors-20261116/'+p.id+(type.includes('png')?'.png':'.jpg');await writeFile(file,bytes);
  return {...p,file,type,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 }catch(error){return {...p,error:error.message};}
})));
await writeFile('.manufacturer-image-candidates-20261116.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result.map(p=>({id:p.id,model:p.model,file:p.file,bytes:p.bytes,error:p.error})),null,2));
