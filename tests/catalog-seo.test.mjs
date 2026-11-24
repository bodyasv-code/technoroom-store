import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {catalogSeoDetails,updateCatalogSeo} from '../public/catalog-seo.js';
import {loadCatalogPage,renderCatalogPage,createCatalogPageHandler} from '../server/catalog-page.js';
import {merchantOfferPolicies} from '../public/merchant-policies.js';
import {productSeoDetails} from '../public/product-seo.js';
import {sitemapUrls} from '../api/sitemap.js';

const origin='https://www.technoroom.com.ua';
const categories=[{id:1,slug:'cat-projectors',name:'Проєктори та екрани',is_active:true},{id:2,parent_id:1,slug:'projectors',name:'Проєктори',is_active:true},{id:3,slug:'office-equipment',name:'Оргтехніка',is_active:true},{id:4,slug:'hidden',name:'PRIVATE CATEGORY',is_active:false},{id:5,parent_id:4,slug:'hidden-child',name:'PRIVATE CHILD',is_active:true}];
const products=Array.from({length:16},(_,i)=>({id:i+1,name:'Проєктор Epson '+(i+1),sku:'P'+(i+1),brand:'Epson',category:'projectors',is_active:true,parent_product_id:null,image_path:'products/p.jpg'})).concat({id:99,name:'PRIVATE PRODUCT',category:'projectors',is_active:false,parent_product_id:null},{id:100,name:'Варіант',category:'projectors',is_active:true,parent_product_id:1});
function client({rows=products,cats=categories,fail=false}={}){
  const calls=[];return {calls,from(table){const filters=[];return {
    select(columns,options){calls.push({table,columns,options});return this;},eq(key,value){filters.push(row=>row[key]===value);return this;},is(key,value){filters.push(row=>(row[key]??null)===value);return this;},in(key,values){filters.push(row=>values.includes(row[key]));return this;},order(){return this;},
    async range(start,end){if(fail)return {error:{message:'PRIVATE ERROR'}};const selected=(table==='categories'?cats:table==='products'?rows:[]).filter(row=>filters.every(fn=>fn(row)));return {data:selected.slice(start,end+1),count:selected.length,error:null};}
  };}};
}
const template=await readFile(new URL('../server/catalog-template.html',import.meta.url),'utf8');
const schemaOf=html=>JSON.parse(html.match(/id="catalog-schema">([^]*?)<\/script>/)[1]);
const response=()=>({headers:{},statusCode:0,body:null,setHeader(k,v){this.headers[k]=v;},status(v){this.statusCode=v;return this;},send(v){this.body=v;return this;},end(){return this;}});

test('initial category HTML has its own title, canonical, real product links and child navigation',async()=>{
  const data=await loadCatalogPage(client(),{category:'cat-projectors'}),html=renderCatalogPage(template,data,'https://storage.example.test');
  assert.match(html,/<title>Проєктори та екрани \| TECHNOROOM<\/title>/);
  assert.ok(html.includes('href="'+origin+'/catalog?category=cat-projectors"'));
  assert.match(html,/<h1 id="catalogTitle">Проєктори та екрани<\/h1>/);
  assert.equal(data.items.length,12);assert.equal(data.count,16);assert.ok(html.includes('/product?id=1'));
  assert.ok(html.includes('id="catalogSubcategories"'));assert.ok(html.includes('/catalog?category=projectors'));
  assert.doesNotMatch(html,/PRIVATE PRODUCT|Варіант/);
  const schema=schemaOf(html);assert.equal(schema['@type'],'CollectionPage');assert.equal(schema.mainEntity.itemListElement.length,12);
  assert.ok(!JSON.stringify(schema).includes('Offer'),'Collection markup must not invent product prices or stock');
});

test('legacy scope aliases retain the same category branch with a clean canonical',async()=>{
  const data=await loadCatalogPage(client(),{category:'projector'});
  assert.equal(data.details.canonical,origin+'/catalog?category=cat-projectors');assert.equal(data.count,16);
  assert.equal((await loadCatalogPage(client(),{category:'home-projectors'})).details.canonical,origin+'/catalog?category=projectors');
  const legacy=await loadCatalogPage(client({rows:[...products,{...products[0],id:500,category:'home-projectors'}]}),{category:'home-projectors'});
  assert.equal(legacy.count,17,'An explicitly requested legacy product category remains in scope');
  const urls=await sitemapUrls(client({cats:[...categories,{id:9,slug:'projector',name:'Legacy',is_active:true}]}));
  assert.equal(urls.filter(url=>url===origin+'/catalog?category=cat-projectors').length,1);
  assert.ok(!urls.includes(origin+'/catalog?category=projector'));
});

test('pagination keeps distinct URLs and product links; facets and tracking cannot poison canonicals',async()=>{
  const data=await loadCatalogPage(client(),{category:'projectors',page:'2',utm_source:'google',email:'PRIVATE'});
  const html=renderCatalogPage(template,data,'https://storage.example.test');
  assert.equal(data.details.canonical,origin+'/catalog?category=projectors&page=2');
  assert.equal(data.items[0].id,13);assert.ok(!html.includes('PRIVATE'));assert.ok(html.includes('сторінка 2'));
  assert.ok(html.includes('href="/catalog?category=projectors"'));
  const db=client();const filtered=await loadCatalogPage(db,{category:'projectors',brand:'Epson',page:'2',search:'PRIVATE',max:'50000'});
  assert.equal(filtered.details.canonical,origin+'/catalog?category=projectors');assert.equal(filtered.items.length,0);
  assert.ok(db.calls.every(call=>call.table==='categories'),'Filtered pages wait for the existing client filter engine rather than showing unrelated products');
  const malformed=catalogSeoDetails({category:categories[1],params:new URLSearchParams('page=2&sort=invalid&min=bad&specs=broken')});
  assert.equal(malformed.canonical,origin+'/catalog?category=projectors&page=2');
});

test('inactive, unknown, duplicate categories and out-of-range pages return 404; outages are 503',async()=>{
  const handler=createCatalogPageHandler({clientFactory:()=>client(),loadTemplate:async()=>template,storageOrigin:()=>origin});
  for(const query of [{category:'hidden'},{category:'hidden-child'},{category:'unknown'},{category:['projectors','office-equipment']},{category:'projectors',page:'3'}]){
    const res=response();await handler({query},res);assert.equal(res.statusCode,404);assert.equal(res.headers['X-Robots-Tag'],'noindex');assert.ok(!res.body.includes('PRIVATE'));
  }
  const res=response();await createCatalogPageHandler({clientFactory:()=>client({fail:true}),loadTemplate:async()=>template})({query:{}},res);
  assert.equal(res.statusCode,503);assert.equal(res.headers['Cache-Control'],'no-store');assert.ok(!res.body.includes('PRIVATE'));
});

test('root catalog, empty categories, HEAD and method guards work without private projections',async()=>{
  const db=client(),handler=createCatalogPageHandler({clientFactory:()=>db,loadTemplate:async()=>template,storageOrigin:()=>origin});
  const get=response(),head=response(),post=response();
  await handler({method:'GET',query:{}},get);await handler({method:'HEAD',query:{}},head);await handler({method:'POST',query:{}},post);
  assert.equal(get.statusCode,200);assert.equal(head.statusCode,200);assert.equal(head.body,null);assert.deepEqual(get.headers,head.headers);assert.equal(post.statusCode,405);
  assert.ok(db.calls.every(call=>!call.columns.includes('*')&&!call.columns.includes('supplier_price')));
  const empty=await loadCatalogPage(client(),{category:'office-equipment'});assert.equal(empty.count,0);assert.ok(renderCatalogPage(template,empty,origin).includes('Наразі товарів'));
});

test('hostile category names and replacement dollar sequences cannot break HTML or JSON',async()=>{
  const name="Проєктори </title><script>bad</script> $& $' $` $$";
  const data=await loadCatalogPage(client({cats:categories.map(row=>row.id===2?{...row,name}:row)}),{category:'projectors'});
  const html=renderCatalogPage(template,data,origin);assert.equal((html.match(/<!doctype html>/gi)||[]).length,1);assert.doesNotMatch(html,/<script>bad<\/script>/);assert.ok(schemaOf(html).name.includes('$&'));
});

test('client metadata updates as category/page changes and stays deduplicated',()=>{
  const nodes=[];const doc={head:{append(node){node.parentNode=this;nodes.push(node);}},createElement(tag){return {tag,attributes:{},setAttribute(k,v){this.attributes[k]=v;}};},getElementById(id){return nodes.find(n=>n.id===id);},querySelector(selector){return nodes.find(n=>selector==='link[rel="canonical"]'?n.attributes.rel==='canonical':selector==='meta[name="description"]'?n.attributes.name==='description':n.attributes.property===selector.match(/property="([^"]+)"/)?.[1]);}};
  for(const category of [categories[0],categories[1]])updateCatalogSeo(doc,catalogSeoDetails({category,params:new URLSearchParams('page=2')}));
  assert.equal(doc.title,'Проєктори — сторінка 2 | TECHNOROOM');assert.equal(nodes.filter(n=>n.id==='catalog-schema').length,1);assert.equal(nodes.filter(n=>n.attributes.rel==='canonical').length,1);
});

test('shipping/return markup uses approved policy and discounted price, without fabricated rates, dates or reviews',async()=>{
  for(const price of [0,1,49999.99,NaN])assert.equal(merchantOfferPolicies(price).shippingDetails,undefined);
  for(const price of [50000,59999])assert.equal(merchantOfferPolicies(price).shippingDetails.shippingRate.value,0);
  const row={id:1,name:'Проєктор',price:55000,stock_quantity:2,description:'Опис'};
  const full=productSeoDetails({base:row,item:row,storageOrigin:origin});
  assert.equal(full.schema.offers.hasMerchantReturnPolicy.merchantReturnDays,14);
  assert.equal(full.schema.offers.hasMerchantReturnPolicy.returnFees,'https://schema.org/FreeReturn');
  const discounted=productSeoDetails({base:row,item:row,storageOrigin:origin,promotions:[{id:1,is_active:true,target_type:'all',discount_type:'percent',discount_value:20}]});
  assert.equal(discounted.schema.offers.price,'44000.00');assert.equal(discounted.schema.offers.shippingDetails,undefined);
  assert.equal(discounted.schema.review,undefined);assert.equal(discounted.schema.aggregateRating,undefined);assert.equal(discounted.schema.offers.priceValidUntil,undefined);
  const delivery=await readFile(new URL('../public/delivery.html',import.meta.url),'utf8'),returns=await readFile(new URL('../public/returns.html',import.meta.url),'utf8');
  assert.ok(delivery.includes('від 50 000 грн включно доставка безкоштовна'));assert.ok(returns.includes('14 днів'));assert.ok(returns.includes('покладаються на продавця'));
});

test('routing preserves the function budget and cannot be shadowed by generic category HTML',async()=>{
  const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.ok(config.rewrites.some(row=>row.source==='/catalog'&&row.destination==='/api/sitemap?view=catalog'));
  assert.ok(config.redirects.some(row=>row.source==='/catalog.html'&&row.destination==='/catalog'&&row.permanent));
  await assert.rejects(readFile(new URL('../public/catalog.html',import.meta.url)),{code:'ENOENT'});
  assert.ok((await readdir(new URL('../api',import.meta.url))).filter(name=>name.endsWith('.js')).length<=12);
});
