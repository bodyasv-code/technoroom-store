import {buildContentPreview} from '../public/product-content-preview.js';
const endpoint='https://live.icecat.biz/api';
export async function limitedJson(response){
  if(Number(response.headers.get('content-length'))>2_000_000)throw new Error('oversize');
  if(!response.body)throw new Error('empty');
  const reader=response.body.getReader(),chunks=[];let length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>2_000_000)throw new Error('oversize');chunks.push(value);}}
  finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handleProductContentPreview(request,response,{db,fetcher=fetch,env=process.env}={}){
  response.setHeader('Cache-Control','no-store');
  if(request.method!=='POST')return response.status(405).json({error:'Дозволено лише POST.'});
  try{
    const token=String(request.headers.authorization||'').replace(/^Bearer\s+/i,'');
    if(!token)return response.status(401).json({error:'Потрібна авторизація.'});
    const auth=await db.auth.getUser(token);
    if(auth.error||!auth.data?.user)return response.status(401).json({error:'Потрібна авторизація.'});
    const profile=await db.from('profiles').select('role').eq('id',auth.data.user.id).maybeSingle();
    if(profile.error||!['owner','manager'].includes(profile.data?.role))return response.status(403).json({error:'Доступ лише для адміністрації магазину.'});
    const configured=Boolean(env.ICECAT_API_TOKEN&&env.ICECAT_CONTENT_TOKEN);
    if(request.body?.action==='status')return response.status(200).json({configured,readOnly:true,demoAllowed:false});
    if(request.body?.action!=='preview'||!Number.isSafeInteger(request.body?.productId)||request.body.productId<=0)return response.status(400).json({error:'Вкажіть числовий код наявного товару.'});
    if(!configured)return response.status(503).json({error:'Потрібні власні серверні ICECAT_API_TOKEN та ICECAT_CONTENT_TOKEN. Демодоступ вимкнено.'});
    const found=await db.from('products').select('id,name,sku,brand,category,specifications,manual_overrides').eq('id',request.body.productId).maybeSingle();
    if(found.error)return response.status(503).json({error:'Не вдалося прочитати картку товару. Перевірте доступність обліку ручних правок.'});
    if(!found.data)return response.status(404).json({error:'Товар не знайдено.'});
    const product=found.data;
    if(!product.sku||!product.brand)return response.status(422).json({error:'У картці мають бути бренд і точний артикул виробника.'});
    // Do not accept URLs, credentials, brand or SKU from the request body.
    const url=new URL(endpoint);url.search=new URLSearchParams({lang:'UK',Brand:product.brand,ProductCode:product.sku,content:'generalinfo,featuregroups,image,gallery'});
    const upstream=await fetcher(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'api-token':env.ICECAT_API_TOKEN,'content-token':env.ICECAT_CONTENT_TOKEN,Accept:'application/json'}});
    if(!upstream.ok){const messages={401:'Icecat відхилив авторизацію.',403:'Контент має обмеження доступу або підписки.',404:'Немає відповіді для точного бренду та артикулу.',429:'Ліміт запитів Icecat. Спробуйте пізніше.'};return response.status(upstream.status===429?429:502).json({error:messages[upstream.status]||'Icecat не повернув контент.',upstreamStatus:upstream.status});}
    const body=await limitedJson(upstream);
    const preview=buildContentPreview(product,body);
    return response.status(200).json({preview});
  }catch{return response.status(502).json({error:'Перевірку контенту не завершено. Спробуйте пізніше. Дані товару не змінювалися.'});}
}
