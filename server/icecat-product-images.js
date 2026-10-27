import {createHash,createHmac,timingSafeEqual} from 'node:crypto';

const columns='id,name,sku,brand,image_path,image_paths,manual_overrides';
const bucket='product-images',maxBytes=2_000_000;
const hash=value=>createHash('sha256').update(value).digest('hex');
const sameIdentity=(a,b)=>String(a||'').normalize('NFKC').trim().toLowerCase()===String(b||'').normalize('NFKC').trim().toLowerCase();
const snapshot=p=>Object.fromEntries(['sku','brand','name','image_path','image_paths','manual_overrides'].map(k=>[k,p[k]??null]));
const snapshotHash=p=>hash(JSON.stringify(snapshot(p)));
const blocked=p=>['images','image_path','image_paths'].some(k=>Boolean(p.manual_overrides?.[k]));
class ImageError extends Error{constructor(message,status=422){super(message);this.status=status;}}
const fail=(message,status)=>{throw new ImageError(message,status);};

export function icecatImageUrl(value){
  try{const u=new URL(value);if(u.protocol==='https:'&&['images.icecat.biz','objects.icecat.biz'].includes(u.hostname)&&!u.username&&!u.password&&!u.port&&!u.hash)return u;}catch{}
  return null;
}
export async function boundedImageBody(response,limit=maxBytes){
  if(!response.ok||!response.body||Number(response.headers.get('content-length'))>limit)fail('Файл недоступний або перевищує допустимий розмір.');
  const reader=response.body.getReader(),parts=[];let length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit)fail('Файл перевищує допустимий розмір.');parts.push(value);}}
  finally{await reader.cancel().catch(()=>{});}
  return Buffer.concat(parts,length);
}
export function imageFileInfo(bytes,type){
  const mime=String(type||'').split(';')[0].trim().toLowerCase();let width=0,height=0,ext='';
  if(mime==='image/png'&&bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'){
    width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);ext='png';
  }else if(mime==='image/jpeg'&&bytes.length>10&&bytes[0]===255&&bytes[1]===216){
    for(let i=2;i+9<bytes.length;){if(bytes[i++]!==255)break;while(bytes[i]===255)i++;const code=bytes[i++];if(code===217||code===218)break;if(code===1||(code>=208&&code<=215))continue;const size=bytes.readUInt16BE(i);if(size<2||i+size>bytes.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(code)){height=bytes.readUInt16BE(i+3);width=bytes.readUInt16BE(i+5);ext='jpg';break;}i+=size;
    }
  }else if(mime==='image/webp'&&bytes.length>=30&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){
    const chunk=bytes.toString('ascii',12,16);ext='webp';
    if(chunk==='VP8X'){if(bytes[20]&2)fail('Анімовані зображення не підтримуються.');width=1+bytes.readUIntLE(24,3);height=1+bytes.readUIntLE(27,3);}
    else if(chunk==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=bytes.readUInt16LE(26)&16383;height=bytes.readUInt16LE(28)&16383;}
    else if(chunk==='VP8L'&&bytes[20]===47){const bits=bytes.readUInt32LE(21);width=(bits&16383)+1;height=((bits>>>14)&16383)+1;}
  }
  if(!ext||width<250||height<250||width>12000||height>12000||width*height>40_000_000)fail('Непідтримуваний формат або непридатні розміри фото (мінімум 250 × 250).');
  return {mime,ext,width,height,bytes:bytes.length,sha256:hash(bytes)};
}
export function imageCandidates(body,product){
  const data=body?.data,g=data?.GeneralInfo;
  if(!g||data.DemoAccount===true||data.ContentErrors?.length||body.ContentErrors?.length||!sameIdentity(g.Brand,product.brand)||!sameIdentity(g.BrandPartCode,product.sku))fail('Немає підтвердженого точного збігу бренду й артикула.');
  const result=[],seen=new Set();
  for(const item of [...(Array.isArray(data.Gallery)?data.Gallery:[])].sort((a,b)=>Number(a.No||0)-Number(b.No||0))){
    const type=String(item.Type||'');
    if(!/^(?:ProductImage|Packshot[\w-]*|LifestyleImage|ProductDetailImage|ProductPackagingImage)$/u.test(type)||String(item.IsPrivate??'0')!=='0'||item.TaxonomyName)continue;
    const url=icecatImageUrl(item.Pic);if(!url||!item.ID)continue;
    const key=hash(String(item.ID)+'|'+url.origin+url.pathname);
    if(seen.has(key))continue;seen.add(key);
    result.push({key,id:String(item.ID),type,updated:String(item.Updated||'').slice(0,40),width:Number(item.PicWidth)||0,height:Number(item.PicHeight)||0,url,icecatId:g.IcecatId??null});
    if(result.length===20)break;
  }
  return result;
}
function sign(payload,key){const raw=Buffer.from(JSON.stringify(payload)).toString('base64url');return raw+'.'+createHmac('sha256',key).update('icecat-image-v1:'+raw).digest('base64url');}
function verify(value,key,uid,now){
  if(typeof value!=='string'||value.length>5000)fail('Некоректне підтвердження фото.',400);
  const [raw,mac,extra]=value.split('.');if(!raw||!mac||extra)fail('Некоректне підтвердження фото.',400);
  const expected=createHmac('sha256',key).update('icecat-image-v1:'+raw).digest(),actual=Buffer.from(mac,'base64url');
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual))fail('Підтвердження фото недійсне.',400);
  let p;try{p=JSON.parse(Buffer.from(raw,'base64url'));}catch{fail('Некоректне підтвердження фото.',400);}
  if(p.v!==1||p.uid!==uid||p.exp<now||p.exp>now+600001)fail('Перегляд застарів. Отримайте фото повторно.',409);return p;
}
async function source(db,product,fetcher,env){
  const url=new URL('https://live.icecat.biz/api');url.search=new URLSearchParams({lang:'UK',Brand:product.brand,ProductCode:product.sku,content:'generalinfo,image,gallery'});
  const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'api-token':env.ICECAT_API_TOKEN,'content-token':env.ICECAT_CONTENT_TOKEN,Accept:'application/json'}});
  if(response.status===429)fail('Ліміт Icecat. Спробуйте пізніше.',429);
  if(!response.ok)fail('Icecat не надав доступного контенту для цього артикула.',502);
  let body;try{body=JSON.parse((await boundedImageBody(response)).toString('utf8'));}catch(error){if(error instanceof ImageError)throw error;fail('Не вдалося прочитати контент Icecat.',502);}
  return imageCandidates(body,product);
}
async function download(candidate,fetcher){
  const response=await fetcher(candidate.url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'image/jpeg,image/png,image/webp'}});
  const bytes=await boundedImageBody(response),info=imageFileInfo(bytes,response.headers.get('content-type'));return {bytes,info};
}
const pathFor=(id,info)=>`products/icecat/${id}/${info.sha256}.${info.ext}`;
const duplicate=(p,path)=>p.image_path===path||(Array.isArray(p.image_paths)&&p.image_paths.includes(path));

export async function handleIcecatProductImages(request,response,{db,userDb,fetcher=fetch,env=process.env,now=Date.now}={}){
  response.setHeader('Cache-Control','no-store');
  let runId=null,writeAttempted=false;
  try{
    if(request.method!=='POST')fail('Дозволено лише POST.',405);
    if(JSON.stringify(request.body||{}).length>12000)fail('Надто великий запит.',413);
    const token=String(request.headers.authorization||'').replace(/^Bearer\s+/iu,'');if(!token)fail('Потрібна авторизація.',401);
    const auth=await db.auth.getUser(token);if(auth.error||!auth.data?.user)fail('Потрібна авторизація.',401);const uid=auth.data.user.id;
    const profile=await db.from('profiles').select('role').eq('id',uid).maybeSingle();if(profile.error||!['owner','manager'].includes(profile.data?.role))fail('Доступ лише для адміністрації магазину.',403);
    if(!env.ICECAT_API_TOKEN||!env.ICECAT_CONTENT_TOKEN||!env.SUPABASE_SERVICE_ROLE_KEY)fail('Серверний доступ Icecat не налаштований.',503);
    const action=request.body?.action;if(!['icecat-image-list','icecat-image-preview','icecat-image-apply'].includes(action))fail('Невідома дія.',400);
    const plan=action==='icecat-image-apply'?verify(request.body.plan,env.SUPABASE_SERVICE_ROLE_KEY,uid,now()):null;
    const id=plan?.id??request.body.productId;if(!Number.isSafeInteger(id)||id<=0)fail('Вкажіть числовий код товару.',400);
    const found=await db.from('products').select(columns).eq('id',id).maybeSingle();if(found.error||!found.data)fail('Картка товару недоступна.',404);const product=found.data;
    if(!product.sku||!product.brand||blocked(product))fail('Потрібен точний бренд і артикул; захищені фото не імпортуються.',409);
    if(plan&&plan.currentHash!==snapshotHash(product))fail('Фото або ідентифікатори змінилися після перегляду.',409);
    const candidates=await source(db,product,fetcher,env);
    if(action==='icecat-image-list')return response.status(200).json({product:{id:product.id,name:product.name,sku:product.sku,brand:product.brand},existingCount:new Set([product.image_path,...(product.image_paths||[])].filter(Boolean)).size,candidates:candidates.map(({url,...item})=>item)});
    const candidate=candidates.find(c=>c.key===(plan?.key??request.body.key));if(!candidate)fail('Фото відсутнє або змінились умови його доступності.',409);
    const {bytes,info}=await download(candidate,fetcher),path=pathFor(id,info);
    if(duplicate(product,path))fail('Це фото вже імпортоване до картки.',409);
    if(action==='icecat-image-preview')return response.status(200).json({product:{id:product.id,name:product.name,sku:product.sku,brand:product.brand},image:{...info,id:candidate.id,type:candidate.type},dataUrl:`data:${info.mime};base64,${bytes.toString('base64')}`,plan:sign({v:1,uid,id,key:candidate.key,currentHash:snapshotHash(product),sha256:info.sha256,exp:now()+600000},env.SUPABASE_SERVICE_ROLE_KEY)});
    if(info.sha256!==plan.sha256)fail('Файл змінився після перегляду. Перевірте нову версію.',409);
    // Check that the append RPC exists BEFORE uploading a public object.
    const readiness=await userDb.rpc('append_product_content_image',{p_run:'00000000-0000-0000-0000-000000000000',p_id:id,p_path:path,p_expected:snapshot(product)});
    if(!readiness.error||readiness.error.code!=='P0001')fail('Потрібне підключення icecat-product-images-upgrade.sql; фото не записано.',503);
    const options={price:false,stock:false,category:false,description:false,specifications:false,publish:false,images:{source:'Icecat',operation:'append',productId:id,path,icecatId:candidate.icecatId,imageId:candidate.id,type:candidate.type,updated:candidate.updated,sha256:info.sha256,width:info.width,height:info.height,bytes:info.bytes}};
    const started=await userDb.rpc('start_product_import',{p_options:options,p_count:1});if(started.error||!started.data)fail('Не вдалося розпочати журнал. Фото не записано.',503);runId=started.data;
    const storage=db.storage.from(bucket),uploaded=await storage.upload(path,bytes,{contentType:info.mime,upsert:false,cacheControl:'3600',metadata:{source:'Icecat',imageId:candidate.id,sha256:info.sha256,license:'https://iceclog.com/open-content-license/'}});
    if(uploaded.error){
      // A retry can encounter a content-addressed object left by an interrupted attempt.
      // Never overwrite it: reuse only when its bytes have the same hash.
      if(!['409','Duplicate'].includes(String(uploaded.error.statusCode||uploaded.error.error||uploaded.error.code||'')))fail('Не вдалося завантажити фото у сховище.',502);
      const existing=await storage.download(path);if(existing.error||!existing.data||existing.data.size>maxBytes||hash(Buffer.from(await existing.data.arrayBuffer()))!==info.sha256)fail('Об’єкт у сховищі не збігається. Запис зупинено.',409);
    }
    writeAttempted=true;
    const applied=await userDb.rpc('append_product_content_image',{p_run:runId,p_id:id,p_path:path,p_expected:snapshot(product)});
    if(applied.error){
      if(/^(?:[0-9A-Z]{5}|PGRST\d{3})$/u.test(applied.error.code||'')){writeAttempted=false;fail('Картку не змінено цим запитом. Оновіть перегляд; файл у сховищі збережений для перевірки.',409);}
      throw new Error('unknown');
    }
    if(Number(applied.data?.id)!==id)throw new Error('unknown');
    const finished=await userDb.rpc('finish_product_import',{p_run:runId,p_errors:[],p_unchanged:applied.data.unchanged?1:0,p_failed:false});
    return response.status(200).json({applied:true,runId,path,unchanged:Boolean(applied.data.unchanged),warning:finished.error?'Фото додано, але статус журналу не закрито. Не повторюйте запис.':''});
  }catch(error){
    if(runId&&!writeAttempted)await userDb.rpc('finish_product_import',{p_run:runId,p_errors:[{reason:'Фото не прив’язано; перевірте залишений файл у сховищі.'}],p_unchanged:0,p_failed:true}).catch(()=>{});
    const unknown=writeAttempted;
    return response.status(unknown?502:(error.status||502)).json({error:unknown?'Результат прив’язки фото невідомий. Не повторюйте дію; перевірте журнал.':error instanceof ImageError?error.message:'Імпорт фото не завершено. Оновіть перегляд.',...(runId?{runId}:{}),uncertain:unknown});
  }
}
