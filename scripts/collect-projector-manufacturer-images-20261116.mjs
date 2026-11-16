import {writeFile,mkdir} from 'node:fs/promises';
const pages=[
 [6136,'MH560C','https://www.benq.eu/en-eu/business/projector/mh560c.html'],
 [6137,'MX560C','https://www.benq.com/en-in/business/projector/mx560c/specifications.html'],
 [6165,'TK700','https://www.benq.com/en-us/projector/home-projectors/tk700.html'],
 [6166,'TH575i','https://www.benq.com/en-us/projector/cinema/th575i.html'],
 [6167,'GV50','https://www.benq.com/en-us/projector/portable/gv50.html'],
 [6168,'GP520','https://www.benq.com/en-ca/projector/cinema/gp520.html'],
 [6170,'TK705STi','https://www.benq.com/en-us/projector/cinema/tk705sti.html'],
 [6172,'LSD401HD','https://www.viewsonic.com/us/products/projectors/standard-throw/lsd401hd.html'],
 [6173,'LSD600W','https://www.viewsonic.com/education/products/projectors/LSD600W'],
 [6145,'PK32','https://www.optomausa.com/product/photon-life-pk32'],
 [6141,'HZ147X','https://www.optomaeurope.com/product/hz147x'],
 [6142,'HZ151X','https://beta.optomaeurope.com/product/hz151x']
];
await mkdir('.manufacturer-pages-20261116',{recursive:true});
const results=[];
for(let i=0;i<pages.length;i+=4)results.push(...await Promise.all(pages.slice(i,i+4).map(async([id,model,source])=>{
 try{
  const response=await fetch(source,{signal:AbortSignal.timeout(20000)}),html=await response.text();
  await writeFile('.manufacturer-pages-20261116/'+id+'.html',html);
  const imageTags=[...html.matchAll(/<(?:img|meta)\b[^>]*>/giu)].map(m=>m[0]).filter(tag=>/(?:image|og:image)/iu.test(tag));
  const urls=[...new Set([...html.matchAll(/(?:https?:)?\/\/[^\s"'<>]+(?:png|jpe?g|webp)(?:\?[^\s"'<>]*)?/giu)].map(m=>m[0].replaceAll('&amp;','&')))];
  return {id,model,source,status:response.status,title:/<title>([^<]+)/iu.exec(html)?.[1],imageTags,urls};
 }catch(error){return {id,model,source,error:error.message};}
})));
await writeFile('.manufacturer-images-20261116.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(p=>({id:p.id,model:p.model,status:p.status,tags:p.imageTags?.length,urls:p.urls?.length,error:p.error})),null,2));
