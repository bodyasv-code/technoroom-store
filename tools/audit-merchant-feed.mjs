// Read-only public feed audit. No database writes, no image files saved.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {loadMerchantFeed,readFeedRows} from '../server/merchant-feed.js';

export function imageDimensions(b){
  if(b.length>=24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),format:'png'};
  if(b.length>=10&&/^GIF8[79]a/.test(b.toString('ascii',0,6)))return {width:b.readUInt16LE(6),height:b.readUInt16LE(8),format:'gif'};
  if(b.length>=30&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
    const kind=b.toString('ascii',12,16);
    if(kind==='VP8X')return {width:1+b.readUIntLE(24,3),height:1+b.readUIntLE(27,3),format:'webp'};
    if(kind==='VP8 '&&b[23]===157&&b[24]===1&&b[25]===42)return {width:b.readUInt16LE(26)&16383,height:b.readUInt16LE(28)&16383,format:'webp'};
    if(kind==='VP8L'&&b[20]===47)return {width:1+((b[21]|b[22]<<8)&16383),height:1+((b[22]>>6|b[23]<<2|b[24]<<10)&16383),format:'webp'};
  }
  if(b.length>=4&&b[0]===255&&b[1]===216){
    let i=2;while(i+3<b.length){if(b[i]!==255){i++;continue;}while(b[i]===255)i++;const marker=b[i++];
      if(marker===217||marker===218)break;if(marker===216||marker===1||marker>=208&&marker<=215)continue;
      if(i+2>b.length)break;const length=b.readUInt16BE(i);if(length<2||i+length>b.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7)return {width:b.readUInt16BE(i+5),height:b.readUInt16BE(i+3),format:'jpeg'};
      i+=length;
    }
  }
  return null;
}
export async function inspectImage(url){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch(url,{headers:{Range:'bytes=0-262143'},signal:controller.signal,redirect:'error'});
    if(!r.ok){const retryAfter=r.headers.get('retry-after');await r.body?.cancel();return {status:r.status,error:'http_error',...(retryAfter?{retryAfter}: {})};}
    const type=r.headers.get('content-type')||'',length=Number(r.headers.get('content-length'))||null;
    const range=r.headers.get('content-range');const bytes=range?Number(range.split('/').at(-1))||null:(r.status===200?length:null);
    const reader=r.body.getReader();let chunks=[],size=0;
    while(size<262144){const part=await reader.read();if(part.done)break;const piece=Buffer.from(part.value).subarray(0,262144-size);chunks.push(piece);size+=piece.length;if(imageDimensions(Buffer.concat(chunks)))break;}
    await reader.cancel();const dimensions=imageDimensions(Buffer.concat(chunks));
    return {status:r.status,type,bytes,...dimensions,...(!dimensions?{error:'dimensions_unreadable'}:{})};
  }catch(e){return {error:e.name==='AbortError'?'timeout':'request_failed'};}finally{clearTimeout(timer);}
}
async function main(){
  const config=fs.readFileSync(new URL('../public/supabase-config.js',import.meta.url),'utf8'),url=config.match(/url: '([^']+)'/)[1],key=config.match(/publishableKey: '([^']+)'/)[1];
  const client=createClient(url,key,{auth:{persistSession:false}}),{xml,stats}=await loadMerchantFeed(client,url);
  const products=await readFeedRows(client,'products','id,name,sku,brand,specifications',{filter:['is_active',true]});const byId=new Map(products.map(p=>[String(p.id),p]));
  const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([,body])=>({id:body.match(/<g:id>(.*?)<\/g:id>/)[1],image:body.match(/<g:image_link>(.*?)<\/g:image_link>/)[1].replaceAll('&amp;','&')}));
  const unique=[...new Set(items.map(p=>p.image))],results=new Map();let done=0,stopped=false;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  for(const image of unique){
    if(stopped){results.set(image,{error:'not_checked_after_rate_limit'});continue;}
    let result;
    for(let attempt=0;attempt<3;attempt++){
      result=await inspectImage(image);
      if(result.status!==429)break;
      if(attempt===2){stopped=true;break;}
      const retryAt=Date.parse(result.retryAfter||'');
      const seconds=Math.max(15,Number(result.retryAfter)||(Number.isFinite(retryAt)?Math.ceil((retryAt-Date.now())/1000):20*(attempt+1)));
      if(seconds>60){stopped=true;break;}
      console.error('Rate limited: backoff '+seconds+' seconds');await pause(seconds*1000);
    }
    results.set(image,result);done++;if(done%50===0)console.error('Image checks '+done+'/'+unique.length);
    await pause(350);
  }
  const report=items.map(item=>{const p=byId.get(item.id),photo=results.get(item.image);return {...item,name:p?.name,sku:p?.sku,brand:p?.brand,photo};});
  const counts={items:items.length,uniqueImages:unique.length,readableDimensions:0,under100:0,under500:0,atLeast500:0,over16MB:0,errors:0};
  for(const p of report){const d=p.photo;if(d.error){counts.errors++;continue;}counts.readableDimensions++;if(d.width<100||d.height<100)counts.under100++;if(d.width<500||d.height<500)counts.under500++;else counts.atLeast500++;if(d.bytes>16000000)counts.over16MB++;}
  const brandCounts={};for(const p of report)brandCounts[p.brand]=(brandCounts[p.brand]||0)+1;
  const errorCounts={};for(const p of report)if(p.photo.error){const key=p.photo.status||p.photo.error;errorCounts[key]=(errorCounts[key]||0)+1;}
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),feedStats:stats,counts,errorCounts,brandCounts,issues:report.filter(p=>!p.photo.error&&(p.photo.width<100||p.photo.height<100||p.photo.bytes>16000000)),unresolved:report.filter(p=>p.photo.error).map(({id,photo})=>({id,photo})),upgradeExamples:report.filter(p=>p.photo.width>=100&&p.photo.height>=100&&(p.photo.width<500||p.photo.height<500)).slice(0,4),limitations:['Header dimensions and HTTP only, not visual product identity, watermark or policy certification.','GTIN/MPN absence is explicit feed fields, not proof that manufacturer identifiers do not exist.']},null,2));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
