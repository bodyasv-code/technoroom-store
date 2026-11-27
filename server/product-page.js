import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {applyCustomerProductPolicy} from '../public/product-content-policy.js';
import {createCategoryTree} from '../public/category-tree.js';
import {normalizeSpecificationEntries} from '../public/specification-normalization.js';
import {hasSpecificationCode} from '../public/specification-values.js';
import {isProjectorProduct,resolveProjectorSpecifications,projectorResolutionLabel} from '../public/projector-specs.js';
import {projectorDisplayEntries} from '../public/projector-display.js';
import {isPrinterDevice,printerDisplayEntries} from '../public/printer-display.js';
import {orderSpecificationEntries} from '../public/specification-order.js';
import {groupProductSpecifications,renderProductSpecificationGroups,specificationCountLabel} from '../public/product-specification-groups.js';
import {productSectionNavigation,productServiceSections} from '../public/product-page-layout.js';
import {htmlEscape as e,productPlainText,productSeoDetails,productHeadMarkup,productBreadcrumbMarkup,selectProductForPage} from '../public/product-seo.js';
import {formatProductPrice,hasProductPrice} from '../public/store-pricing.js';

// Explicit public projection: never serialize internal notes, costs or supplier metadata.
export const PUBLIC_PRODUCT_COLUMNS='id,name,sku,brand,brand_id,category,parent_product_id,variant_label,description,specifications,price,stock_quantity,in_stock,availability_status,supplier_available_quantity,supplier_stock_uncertain,image_path,image_paths,is_active';
const idValue=value=>typeof value==='string'&&/^[1-9]\d{0,14}$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):null;
const notFound=()=>Object.assign(new Error('Product not found'),{status:404});
const unavailable=()=>new Error('Product page temporarily unavailable');

async function readPages(client,table,columns,filter) {
  const result=[];
  for(let start=0;start<10000;start+=500){
    let query=client.from(table).select(columns).order('id',{ascending:true});
    if(filter)query=query.eq(...filter);
    if(table==='products')query=query.eq('is_active',true);
    const {data,error}=await query.range(start,start+499);
    if(error||!Array.isArray(data))throw unavailable();
    result.push(...data);if(data.length<500)return result;
  }
  throw unavailable();
}

export async function loadProductPage(client,{id,variant}) {
  const requestedId=idValue(id),variantId=variant==null?null:idValue(variant);
  if(!requestedId||(variant!=null&&!variantId))throw notFound();
  const {data:requested,error}=await client.from('products').select(PUBLIC_PRODUCT_COLUMNS).eq('id',requestedId).eq('is_active',true).maybeSingle();
  if(error)throw unavailable();if(!requested)throw notFound();
  let base=requested;
  if(requested.parent_product_id){
    const parent=await client.from('products').select(PUBLIC_PRODUCT_COLUMNS).eq('id',requested.parent_product_id).eq('is_active',true).maybeSingle();
    if(parent.error)throw unavailable();if(parent.data)base=parent.data;
  }
  const [variants,categories,promotions]=await Promise.all([
    readPages(client,'products',PUBLIC_PRODUCT_COLUMNS,['parent_product_id',base.id]),
    readPages(client,'categories','id,name,slug,parent_id,is_active,sort_order'),
    readPages(client,'promotions','id,discount_type,discount_value,starts_at,ends_at,is_active,target_type,target_value',['is_active',true])
  ]);
  const rows=[...new Map([base,requested,...variants.filter(row=>row.is_active===true)].map(row=>[Number(row.id),row])).values()].map(applyCustomerProductPolicy);
  const selection=selectProductForPage(rows.find(row=>Number(row.id)===requestedId),rows,variantId);
  if(variantId&&Number(selection.item.id)!==variantId)throw notFound();
  const promotionLinks=new Map();
  if(promotions.some(p=>p.target_type==='products')){
    const result=await client.from('promotion_products').select('promotion_id,product_id').in('product_id',[selection.base.id,selection.item.id]);
    if(result.error||!Array.isArray(result.data))throw unavailable();
    for(const row of result.data){const id=Number(row.promotion_id);if(!promotionLinks.has(id))promotionLinks.set(id,new Set());promotionLinks.get(id).add(Number(row.product_id));}
  }
  return {...selection,categories,promotions,promotionLinks};
}

function specificationEntries(item) {
  const projector=isProjectorProduct(item);
  const specifications=projector?resolveProjectorSpecifications(item):item.specifications;
  const stored=normalizeSpecificationEntries(specifications,{projector}).map(([key,value])=>{
    let text=productPlainText(Array.isArray(value)?value.join(' · '):value);
    if(projector&&key==='Роздільна здатність')text=projectorResolutionLabel(text);
    return [productPlainText(key),text];
  }).filter(([key,value])=>key&&value&&!hasSpecificationCode(value));
  const entries=projector?projectorDisplayEntries(stored,item.description):isPrinterDevice(item)?printerDisplayEntries(stored,item.description):stored;
  return orderSpecificationEntries(entries,{projector});
}

export function renderProductPage(template,data,{storageOrigin,now=Date.now()}={}) {
  const details=productSeoDetails({...data,storageOrigin,now});
  const {item,base,variants,categories}=data;
  const path=createCategoryTree(categories).path(item.category);
  const specs=specificationEntries(item);
  const groups=groupProductSpecifications([['Виробник',item.brand||base.brand||'TECHNOROOM'],...specs],{projector:isProjectorProduct(item),printer:isPrinterDevice(item)});
  const count=groups.reduce((sum,group)=>sum+group.entries.length,0);
  const description=productPlainText(item.description);
  const money=formatProductPrice(details.price);
  const variantMarkup=variants.length?'<div class="product-variants"><b>Оберіть варіант</b><div>'+variants.map(row=>'<a class="product-variant'+(row.id===item.id?' is-selected':'')+'" href="/product?id='+base.id+'&amp;variant='+row.id+'">'+e(row.variant_label||row.name)+'</a>').join('')+'</div></div>':'';
  const view='<section class="product-showcase"><div class="product-gallery-panel"><div class="product-detail-visual"><div class="product-image" style="position:static;width:100%;min-height:320px;display:flex;align-items:center;justify-content:center">'
    +(details.image?'<img src="'+e(details.image)+'" alt="'+e(details.heading)+'" style="position:static;width:100%;height:480px;object-fit:contain">':'<div class="product-placeholder">Фото товару з’явиться незабаром</div>')
    +'</div></div></div><div class="product-overview"><div class="product-topline"><span class="product-category-path">'+path.map(category=>'<a href="/catalog?category='+encodeURIComponent(category.slug)+'">'+e(category.name)+'</a>').join(' › ')+'</span><span class="product-code">SKU: '+e(item.sku||'—')+' · Код: '+item.id+'</span></div>'
    +'<p class="product-brand">'+e(base.brand||item.brand||'TECHNOROOM')+'</p><h1>'+e(details.heading)+'</h1>'+variantMarkup
    +'<div class="product-buy-card"><div class="product-availability '+(details.state.orderable||details.state.inquiry?'is-available':'is-unavailable')+'"><i></i><span>'+e(details.state.label)+'</span></div>'
    +'<strong class="detail-price">'+e(money)+'</strong>'+(hasProductPrice(details.price)?'<p class="product-price-note">Ціна вказана за 1 одиницю товару</p>':'')+'<div class="detail-actions">'
    +(details.state.inquiry?'<a class="button product-buy" href="/contacts">'+e(details.state.button)+'</a>':'<button type="button" class="button product-buy" disabled>'+(details.state.orderable?'Додати в кошик':'Немає в наявності')+'</button>')
    +'<a class="button product-back" href="/catalog">До каталогу</a></div><div class="product-service-grid"><div><b>Доставка</b><span>Підберемо зручний спосіб</span></div><div><b>Гарантія</b><span>Офіційна техніка</span></div><div><b>Консультація</b><span>Допоможемо з вибором</span></div></div></div></div></section>'
    +productSectionNavigation(Boolean(description))+'<section class="product-content-grid">'
    +(description?'<article class="product-description-card" id="product-description" tabindex="-1" aria-labelledby="product-description-title"><p class="section-kicker">Про товар</p><h2 id="product-description-title">Опис</h2><div class="product-description-rich"><p>'+e(description)+'</p></div></article>':'')
    +'<article class="product-specs-card" id="product-specifications" tabindex="-1" aria-labelledby="product-specifications-title"><div class="product-section-heading"><div><p class="section-kicker">Технічні дані</p><h2 id="product-specifications-title">Характеристики</h2></div><span>'+specificationCountLabel(count)+'</span></div>'+renderProductSpecificationGroups(groups,{projector:isProjectorProduct(item)})+'</article></section>'+productServiceSections();
  return template.replace(/<title>[^]*?<\/title>/,()=>'<title>'+e(details.title)+'</title>')
    .replace('</head>',()=>productHeadMarkup(details)+'</head>')
    .replace(/<p class="breadcrumbs">[^]*?<\/p>/,()=>'<p class="breadcrumbs">'+productBreadcrumbMarkup(path,details.heading)+'</p>')
    .replace('<div id="productView" class="product-detail"></div>',()=>'<div id="productView" class="product-detail" data-server-rendered="true">'+view+'</div>');
}

let templatePromise;
function loadTemplate(){return templatePromise??=readFile(new URL('./product-template.html',import.meta.url),'utf8').catch(error=>{templatePromise=null;throw error;});}
export function createProductPageHandler({clientFactory=()=>createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),templateLoader=loadTemplate,storageOrigin=()=>process.env.SUPABASE_URL,now=()=>Date.now()}={}) {
  return async function handler(req,res){
    res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
    if(!['GET','HEAD'].includes(req.method||'GET')){res.setHeader('Allow','GET, HEAD');res.setHeader('Cache-Control','no-store');return res.status(405).end();}
    try{
      // Reject malformed and duplicate IDs before constructing a database client.
      if(!idValue(req.query?.id)||(req.query?.variant!=null&&!idValue(req.query.variant)))throw notFound();
      const [data,template]=await Promise.all([loadProductPage(clientFactory(),req.query),templateLoader()]);
      const html=renderProductPage(template,data,{storageOrigin:storageOrigin(),now:now()});
      res.setHeader('Cache-Control','public, max-age=0, s-maxage=60, must-revalidate');
      if(req.method==='HEAD')return res.status(200).end();return res.status(200).send(html);
    }catch(error){
      const status=error.status===404?404:503;
      res.setHeader('Cache-Control','no-store');
      if(status===404)res.setHeader('X-Robots-Tag','noindex');else res.setHeader('Retry-After','60');
      if(req.method==='HEAD')return res.status(status).end();
      return res.status(status).send('<!doctype html><html lang="uk"><meta charset="UTF-8"><title>'+(status===404?'Товар не знайдено':'Сторінка тимчасово недоступна')+' — TECHNOROOM</title><main><h1>'+(status===404?'Товар не знайдено або його приховано':'Сторінка тимчасово недоступна')+'</h1><p>'+(status===404?'Перегляньте інші товари в каталозі.':'Спробуйте оновити сторінку за хвилину.')+'</p><a href="/catalog">До каталогу</a></main></html>');
    }
  };
}
export default createProductPageHandler();
