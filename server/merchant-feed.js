// Shared server module, deliberately outside api/ so it is not a separate Vercel function.
import {createClient} from '@supabase/supabase-js';
import {visibleCategoryRows,createCategoryTree} from '../public/category-tree.js';
import {cleanCustomerText} from '../public/product-content-policy.js';
import {matchingPromotion,discountedPrice} from '../public/store-pricing.js';

export const FEED_ORIGIN='https://www.technoroom.com.ua';
const PAGE_SIZE=500,MAX_ROWS=50000;
// Select only storefront data. Never export supplier pricing, orders or customer records.
export const FEED_COLUMNS='id,name,description,brand,brand_id,sku,category,price,in_stock,stock_quantity,availability_status,image_path,specifications,parent_product_id,is_active';
const validXml=value=>String(value??'').replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu,'');
const escape=value=>validXml(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function feedText(value,max=5000){
  const cleaned=String(cleanCustomerText(String(value??''))||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,code)=>{const n=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';})
    .replace(/&(nbsp|amp|lt|gt|quot|apos);/gi,(_,name)=>({nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[name.toLowerCase()]));
  return Array.from(validXml(cleaned).replace(/\s+/g,' ').trim()).slice(0,max).join('');
}
export async function readFeedRows(client,table,columns,{filter,order='id'}={}){
  const rows=[];
  for(let offset=0;offset<MAX_ROWS;offset+=PAGE_SIZE){
    let query=client.from(table).select(columns).order(order,{ascending:true});
    if(table==='promotion_products')query=query.order('promotion_id',{ascending:true});
    if(filter)query=query.eq(...filter);
    const {data,error}=await query.range(offset,offset+PAGE_SIZE-1);
    if(error||!Array.isArray(data))throw new Error('Feed data unavailable');
    rows.push(...data);if(data.length<PAGE_SIZE)return rows;
  }
  throw new Error('Feed size limit exceeded');
}
function imageLink(path,storageOrigin){
  // Initial feed uses uploaded product photos only; no placeholders or unverified remote proxies.
  if(typeof path!=='string'||!path.trim()||path!==path.trim()||/^(?:[a-z]+:|\/)/i.test(path)||/[\\?#\x00-\x1f]/.test(path)||path.split('/').some(x=>!x||x==='.'||x==='..')||! /\.(?:jpe?g|png|webp|gif|avif)$/i.test(path))return '';
  const origin=new URL(storageOrigin);if(origin.protocol!=='https:')throw new Error('Invalid image origin');
  return origin.origin+'/storage/v1/object/public/product-images/'+path.split('/').map(encodeURIComponent).join('/');
}
export function validGtin(value){
  const v=String(value??'').trim();if(!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(v)||/^0+$/.test(v))return '';
  let sum=0;for(let i=v.length-2,m=3;i>=0;i--,m=4-m)sum+=Number(v[i])*m;
  return (10-sum%10)%10===Number(v.at(-1))?v:'';
}
function identifiers(specs){
  const gtins=new Set();let mpn='';
  for(const [key,value] of Object.entries(specs||{})){
    if(typeof value!=='string'&&typeof value!=='number')continue;
    if(/^(?:gtin|ean(?:-?13)?(?:\s+код)?|upc|штрих[ -]?код|штрихкод\s*ean)$/iu.test(key.trim())){const code=validGtin(value);if(code)gtins.add(code);}
    if(/^(?:mpn|manufacturer part number|код виробника|артикул виробника|номер деталі виробника)$/iu.test(key.trim()))mpn ||= feedText(value,70);
  }
  // Supplier/internal SKU is not evidence of a manufacturer MPN. Missing UPIs do not mean identifier_exists=no.
  // Conflicting codes need variant/pack-size review, not an arbitrary first match.
  return {gtin:gtins.size===1?[...gtins][0]:'',mpn};
}
export function buildMerchantFeed({products,categories,promotions=[],promotionLinks=[],storageOrigin,now=Date.now()}){
  const tree=createCategoryTree(categories),visible=new Set(visibleCategoryRows(categories).map(c=>c.slug)),links=new Map(),seen=new Set();
  for(const row of promotionLinks){const id=Number(row.promotion_id);if(!links.has(id))links.set(id,new Set());links.get(id).add(Number(row.product_id));}
  const stats={activeRead:products.length,included:0,excluded:{},missingIdentifiers:0};const items=[];
  const omit=reason=>{stats.excluded[reason]=(stats.excluded[reason]||0)+1;};
  for(const p of products){
    const id=String(p.id);if(!/^\d+$/.test(id)||seen.has(id)){omit('invalid_or_duplicate_id');continue;}seen.add(id);
    if(p.is_active!==true){omit('inactive');continue;}
    if(!visible.has(p.category)){omit('hidden_or_unknown_category');continue;}
    // Inquiry-only and unavailable products are excluded from this first rollout, not labelled as preorder.
    if(p.availability_status==='under_order'||!p.in_stock||!(Number(p.stock_quantity)>0)){omit('not_orderable');continue;}
    const title=feedText(p.name,150),description=feedText(p.description),brand=feedText(p.brand,70);
    if(!title||!description||!brand){omit('missing_title_description_brand');continue;}
    const image=imageLink(p.image_path,storageOrigin);if(!image){omit('no_uploaded_photo');continue;}
    const price=Number(p.price),promo=matchingPromotion({...p,parentProductId:p.parent_product_id},promotions,links,now),effective=discountedPrice(price,promo);
    if(!Number.isFinite(price)||price<=0||!Number.isFinite(effective)||effective<=0){omit('invalid_price');continue;}
    const upi=identifiers(p.specifications);if(!upi.gtin&&!upi.mpn)stats.missingIdentifiers++;
    const fields={id,title,description,link:FEED_ORIGIN+'/product?id='+id,image_link:image,availability:'in_stock',price:price.toFixed(2)+' UAH',condition:'new',brand,product_type:tree.path(p.category).map(c=>feedText(c.name,150)).join(' > ')};
    if(effective<price)fields.sale_price=effective.toFixed(2)+' UAH';
    if(upi.gtin)fields.gtin=upi.gtin;if(upi.mpn)fields.mpn=upi.mpn;
    items.push('<item>'+Object.entries(fields).filter(([,v])=>v!=='').map(([k,v])=>'<g:'+k+'>'+escape(v)+'</g:'+k+'>').join('')+'</item>');
  }
  stats.included=items.length;
  const xml='<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>TECHNOROOM</title><link>'+FEED_ORIGIN+'/</link><description>Каталог товарів TECHNOROOM</description>\n'+items.join('\n')+'\n</channel></rss>';
  if(Buffer.byteLength(xml,'utf8')>4000000)throw new Error('Feed response size limit exceeded');
  return {xml,stats};
}
export async function loadMerchantFeed(client,storageOrigin,now){
  const [products,categories,promotions,promotionLinks]=await Promise.all([
    readFeedRows(client,'products',FEED_COLUMNS,{filter:['is_active',true]}),
    readFeedRows(client,'categories','id,name,slug,parent_id,is_active,sort_order'),
    readFeedRows(client,'promotions','id,discount_type,discount_value,starts_at,ends_at,is_active,target_type,target_value',{filter:['is_active',true]}),
    readFeedRows(client,'promotion_products','promotion_id,product_id',{order:'product_id'})
  ]);
  return buildMerchantFeed({products,categories,promotions,promotionLinks,storageOrigin,now});
}
export default async function handler(req,res){
  if(!['GET','HEAD'].includes(req.method||'GET')){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
  try{
    const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const {xml,stats}=await loadMerchantFeed(client,process.env.SUPABASE_URL);
    if(!stats.included)throw new Error('No eligible products');
    res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','public, s-maxage=300, must-revalidate');
    if(req.method==='HEAD')return res.status(200).end();return res.status(200).send(xml);
  }catch{
    res.setHeader('Cache-Control','no-store');return res.status(503).send('Product feed temporarily unavailable');
  }
}
