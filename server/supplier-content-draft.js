import {buildContentPreview} from '../public/product-content-preview.js';
import {limitedJson} from './product-content-preview.js';
export async function handleSupplierContentDraft(request,response,{db,fetcher=fetch,env=process.env}={}){
  response.setHeader('Cache-Control','no-store');
  if(request.method!=='POST')return response.status(405).json({error:'Дозволено лише POST.'});
  try{
    const token=String(request.headers.authorization||'').replace(/^Bearer\s+/iu,'');
    if(!token)return response.status(401).json({error:'Потрібна авторизація.'});
    const auth=await db.auth.getUser(token);
    if(auth.error||!auth.data?.user)return response.status(401).json({error:'Потрібна авторизація.'});
    const profile=await db.from('profiles').select('role').eq('id',auth.data.user.id).maybeSingle();
    if(profile.error||!['owner','manager'].includes(profile.data?.role))return response.status(403).json({error:'Доступ заборонено.'});
    const source=request.body?.product;
    if(!source||!['projectors','erc-display-06','erc-display-10'].includes(source.category)
      ||typeof source.brand!=='string'||!source.brand.trim()||source.brand.length>120
      ||typeof source.sku!=='string'||!source.sku.trim()||source.sku.length>120
      ||typeof source.name!=='string'||!source.name.trim()||source.name.length>500
      ||/[\x00-\x1f<>]/u.test(source.brand+source.sku+source.name))return response.status(400).json({error:'Потрібні точні бренд, артикул і категорія нової позиції.'});
    if(!env.ICECAT_API_TOKEN||!env.ICECAT_CONTENT_TOKEN)return response.status(503).json({error:'Власний доступ Icecat на сервері не налаштований.'});
    const product={name:source.name,sku:source.sku.trim(),brand:source.brand.trim(),category:source.category,specifications:{}};
    // Authentication is required; the URL and credentials are always server-owned.
    const url=new URL('https://live.icecat.biz/api');url.search=new URLSearchParams({lang:'UK',Brand:product.brand,ProductCode:product.sku,content:'generalinfo,featuregroups'});
    const upstream=await fetcher(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'api-token':env.ICECAT_API_TOKEN,'content-token':env.ICECAT_CONTENT_TOKEN,Accept:'application/json'}});
    if(!upstream.ok)return response.status(upstream.status===429?429:502).json({error:'Не отримано контент Icecat для точного артикула.',upstreamStatus:upstream.status});
    const preview=buildContentPreview(product,await limitedJson(upstream));
    return response.status(200).json({preview});
  }catch{return response.status(502).json({error:'Пошук контенту не завершено. Товар не створено.'});}
}
