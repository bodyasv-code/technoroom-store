import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {createCategoryTree,visibleCategoryRows} from '../public/category-tree.js';
import {canonicalCategorySlug,catalogCategoryScope} from '../public/catalog-category-scope.js';
import {catalogSeoDetails,catalogHeadMarkup} from '../public/catalog-seo.js';
import {htmlEscape as e,compactProductName,productImageUrl} from '../public/product-seo.js';

const notFound=()=>Object.assign(new Error('Category not found'),{status:404});
export async function loadCatalogPage(client,query={}){
  if(query.category!=null&&typeof query.category!=='string')throw notFound();
  const params=new URLSearchParams(Object.entries(query).filter(([,value])=>typeof value==='string'));
  let categories=[];
  for(let offset=0;offset<10000;offset+=500){
    const result=await client.from('categories').select('id,name,slug,parent_id,is_active,sort_order').order('id',{ascending:true}).range(offset,offset+499);
    if(result.error||!Array.isArray(result.data))throw new Error('Catalog unavailable');
    categories.push(...result.data);if(result.data.length<500)break;
    if(offset===9500)throw new Error('Category limit exceeded');
  }
  categories=visibleCategoryRows(categories);
  const requestedSlug=params.get('category')||'all';
  const slug=canonicalCategorySlug(requestedSlug);
  const category=categories.find(row=>row.slug===slug)||null;
  if(slug!=='all'&&!category)throw notFound();
  const tree=createCategoryTree(categories);
  const details=catalogSeoDetails({category,params});
  let items=[],count=null;
  if(!details.filtered){
    let request=client.from('products').select('id,name,sku,brand,category,image_path,in_stock,created_at',{count:'exact'}).eq('is_active',true).is('parent_product_id',null);
    if(category)request=request.in('category',[...catalogCategoryScope(tree,requestedSlug)]);
    const start=(details.state.page-1)*details.state.size;
    const result=await request.order('in_stock',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(start,start+details.state.size-1);
    if(result.error||!Array.isArray(result.data)||!Number.isFinite(result.count))throw new Error('Catalog unavailable');
    count=result.count;
    if(details.state.page>1&&start>=count)throw notFound();
    items=result.data.map(row=>({...row,name:compactProductName(row.name,row.sku,row.brand)}));
  }
  return {category,categories,items,count,path:category?tree.path(category.slug):[],children:category?tree.children(category.id):[],details:catalogSeoDetails({category,params,items})};
}

export function renderCatalogPage(template,data,storageOrigin){
  const {details,path,children,items,count}=data;
  const crumbs='<a href="/">Головна</a> / '+(path.length?'<a href="/catalog">Каталог</a> / '+path.map((row,index)=>index===path.length-1?'<span aria-current="page">'+e(row.name)+'</span>':'<a href="/catalog?category='+encodeURIComponent(row.slug)+'">'+e(row.name)+'</a>').join(' / '):'<span aria-current="page">Каталог</span>');
  const navigation=children.length?'<nav id="catalogSubcategories" class="catalog-subcategories" aria-label="Підкатегорії">'+children.map(row=>'<a href="/catalog?category='+encodeURIComponent(row.slug)+'">'+e(row.name)+' →</a>').join('')+'</nav>':'';
  const cards=items.map(item=>{
    const image=productImageUrl(item,storageOrigin),href='/product?id='+item.id;
    return '<article class="product"><a class="product-image" href="'+href+'">'+(image?'<img src="'+e(image)+'" alt="'+e(item.name)+'" loading="lazy" style="position:static;width:100%;height:195px;object-fit:contain">':'')+'</a><h3><a href="'+href+'">'+e(item.name)+'</a></h3><p>'+e(item.brand||'')+'</p><a href="'+href+'">Переглянути товар →</a></article>';
  }).join('');
  const pages=count===null?0:Math.ceil(count/details.state.size);
  const pageLink=page=>{const url=new URL(details.canonical);if(page===1)url.searchParams.delete('page');else url.searchParams.set('page',page);return url.pathname+url.search;};
  const pagination=pages>1?(details.state.page>1?'<a href="'+e(pageLink(details.state.page-1))+'">← Попередня</a>':'')+'<span>Сторінка '+details.state.page+' з '+pages+'</span>'+(details.state.page<pages?'<a href="'+e(pageLink(details.state.page+1))+'">Наступна →</a>':''):'';
  return template.replace(/<title>[^]*?<\/title>/,()=>'<title>'+e(details.title)+'</title>')
    .replace('</head>',()=>catalogHeadMarkup(details)+'</head>')
    .replace(/<p class="breadcrumbs" id="catalogBreadcrumbs">[^]*?<\/p>/,()=>'<p class="breadcrumbs" id="catalogBreadcrumbs">'+crumbs+'</p>')
    .replace('<h1 id="catalogTitle">Каталог техніки</h1>',()=>'<h1 id="catalogTitle">'+e(details.heading)+'</h1>'+navigation)
    .replace('<span id="resultCount"></span>',()=>'<span id="resultCount">'+(count===null?'':count+' товарів')+'</span>')
    .replace('<div class="catalog-grid" id="catalogGrid"></div>',()=>'<div class="catalog-grid" id="catalogGrid"'+(cards?' data-server-rendered="true"':'')+'>'+(cards||'<p class="empty-cart">'+(details.filtered?'Завантажуємо результати…':'Наразі товарів у цій категорії немає.')+'</p>')+'</div>')
    .replace('<nav class="catalog-pagination" id="catalogPagination" aria-label="Сторінки каталогу"></nav>',()=>'<nav class="catalog-pagination" id="catalogPagination" aria-label="Сторінки каталогу">'+pagination+'</nav>');
}
let templatePromise;
const templateLoader=()=>templatePromise??=readFile(new URL('./catalog-template.html',import.meta.url),'utf8').catch(error=>{templatePromise=null;throw error;});
export function createCatalogPageHandler({clientFactory=()=>createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(resource,options)=>fetch(resource,{...options,signal:AbortSignal.timeout(10000)})}}),loadTemplate=templateLoader,storageOrigin=()=>process.env.SUPABASE_URL}={}){
  return async(req,res)=>{
    res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
    if(!['GET','HEAD'].includes(req.method||'GET')){res.setHeader('Allow','GET, HEAD');res.setHeader('Cache-Control','no-store');return res.status(405).end();}
    try{
      const [data,template]=await Promise.all([loadCatalogPage(clientFactory(),req.query),loadTemplate()]);
      const html=renderCatalogPage(template,data,storageOrigin());
      res.setHeader('Cache-Control','public, max-age=0, s-maxage=60, must-revalidate');
      if(req.method==='HEAD')return res.status(200).end();return res.status(200).send(html);
    }catch(error){
      const status=error.status===404?404:503;res.setHeader('Cache-Control','no-store');
      if(status===404)res.setHeader('X-Robots-Tag','noindex');else res.setHeader('Retry-After','60');
      if(req.method==='HEAD')return res.status(status).end();
      return res.status(status).send('<!doctype html><html lang="uk"><meta charset="UTF-8"><title>Каталог — TECHNOROOM</title><main><h1>'+(status===404?'Категорію або сторінку не знайдено':'Каталог тимчасово недоступний')+'</h1><a href="/catalog">До каталогу</a></main></html>');
    }
  };
}
export default createCatalogPageHandler();
