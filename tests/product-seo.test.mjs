import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createProductPageHandler,loadProductPage,renderProductPage} from '../server/product-page.js';
import {productSeoDetails,productAvailability,selectProductForPage,updateProductSeo,productBreadcrumbMarkup,productPlainText} from '../public/product-seo.js';
import {sitemapUrls} from '../api/sitemap.js';

const template=await readFile(new URL('../server/product-template.html',import.meta.url),'utf8');
const origin='https://www.technoroom.com.ua',storageOrigin='https://storage.example.test';
const projector={id:439,name:'Проєктор Epson EB-FH54',sku:'V11HB60042',brand:'Epson',category:'projectors',description:'Проєктор Full HD для презентацій.',specifications:{'Роздільна здатність':'1920 x 1080'},price:60000,stock_quantity:2,in_stock:true,is_active:true,image_path:'products/projector.jpg'};
const printer={...projector,id:4331,name:'БФП Canon MF667Cdw',sku:'6928C001',brand:'Canon',category:'office-mfp',description:'Кольоровий друк та сканування.',stock_quantity:0,in_stock:false,specifications:{'Формат':'A4'}};
const ink={...projector,id:5019,name:'Картридж Canon PFI-1000B',sku:'0555C001',brand:'Canon',category:'cartridges',description:'80 мл, блакитний.',specifications:{}};
const categories=[{id:1,name:'Проєктори та екрани',slug:'projection',is_active:true},{id:2,parent_id:1,name:'Проєктори',slug:'projectors',is_active:true}];
const dataFor=item=>({base:item,item,variants:[],categories,promotions:[],promotionLinks:new Map()});
const schemaOf=html=>JSON.parse(html.match(/id="product-schema">([^]*?)<\/script>/)[1]);
function clientFor(tables,{failTable}={}){
  const calls=[];
  return {calls,from(table){let filters=[];return {
    select(columns){calls.push({table,columns});return this;},
    eq(key,value){filters.push(row=>row[key]===value);return this;},
    in(key,values){filters.push(row=>values.includes(row[key]));return this;},
    order(){return this;},
    result(){return table===failTable?{error:{message:'PRIVATE DATABASE ERROR'}}:{data:(tables[table]||[]).filter(row=>filters.every(filter=>filter(row))),error:null};},
    async range(start,end){const result=this.result();return result.error?result:{data:result.data.slice(start,end+1),error:null};},
    async maybeSingle(){const result=this.result();return result.error?result:{data:result.data[0]||null,error:null};},
    then(resolve){return Promise.resolve(this.result()).then(resolve);}
  };}};
}
function response(){return {headers:{},statusCode:0,body:null,setHeader(key,value){this.headers[key]=value;},status(code){this.statusCode=code;return this;},send(body){this.body=body;return this;},end(){return this;}};}
const baseTables={products:[projector,printer,ink],categories,promotions:[],articles:[]};

test('first HTML response has unique product content, canonical, safe description and accurate Product/Offer',()=>{
  const pages=[projector,printer,ink].map(item=>renderProductPage(template,dataFor(item),{storageOrigin}));
  assert.equal(new Set(pages.map(html=>html.match(/<title>(.*?)<\/title>/)[1])).size,3);
  for(const [index,item] of [projector,printer,ink].entries()){
    const html=pages[index],schema=schemaOf(html);
    assert.match(html,new RegExp('<h1>[^<]*'+item.sku));
    assert.ok(html.includes('<link rel="canonical" href="'+origin+'/product?id='+item.id+'">'));
    assert.ok(html.includes('<meta name="description" content="'+item.description+'">'));
    assert.equal(schema.sku,item.sku);assert.equal(schema.offers.priceCurrency,'UAH');assert.equal(schema.offers.price,'60000.00');
    assert.equal(schema.image[0],storageOrigin+'/storage/v1/object/public/product-images/products/projector.jpg');
    assert.equal((html.match(/id="product-schema"/g)||[]).length,1);
    assert.match(html,/<span aria-current="page">[^<]+<\/span>/);
    assert.doesNotMatch(html,/\/ Товар<\/p>/);
    assert.ok(html.includes('data-server-rendered="true"'));
    assert.ok(html.includes('<body class="store-modern product-layout-page">'),'Product layout is styled before client hydration');
  }
  assert.equal(schemaOf(pages[0]).offers.availability,'https://schema.org/InStock');
  assert.equal(schemaOf(pages[1]).offers.availability,'https://schema.org/OutOfStock');
  assert.match(pages[0],/Закінчується/);
  assert.ok(pages[0].includes('Проєктори та екрани'));
});

test('unknown supplier quantity and inquiry-only items never invent purchasable availability',()=>{
  for(const patch of [{stock_quantity:0,supplier_stock_uncertain:true},{stock_quantity:0,availability_status:'under_order'},{price:0}]){
    const row={...projector,...patch};assert.equal(schemaOf(renderProductPage(template,dataFor(row),{storageOrigin})).offers,undefined);
  }
  assert.equal(productAvailability({...projector,stock_quantity:0,supplier_available_quantity:4}).orderable,true);
  assert.equal(productAvailability({...projector,stock_quantity:0,supplier_stock_uncertain:true}).inquiry,true);
});

test('active promotion prices agree with visible HTML and schema, including family links',()=>{
  const data={...dataFor(projector),promotions:[{id:1,is_active:true,target_type:'products',discount_type:'percent',discount_value:10}],promotionLinks:new Map([[1,new Set([439])]])};
  const html=renderProductPage(template,data,{storageOrigin});assert.equal(schemaOf(html).offers.price,'54000.00');
  assert.match(html,/54[\s\u00a0]000 ₴/);
  const details=productSeoDetails({...data,storageOrigin,now:Date.now()});assert.equal(details.price,54000);
});

test('variants retain the requested identity, canonicalize to the active parent and reject unrelated selection',async()=>{
  const base={...projector,id:10,sku:null,name:'Смартфон тестовий',stock_quantity:0};
  const a={...projector,id:11,parent_product_id:10,variant_label:'128 ГБ',stock_quantity:0};
  const b={...projector,id:12,parent_product_id:10,variant_label:'256 ГБ',stock_quantity:3};
  assert.equal(selectProductForPage(base,[base,a,b]).item.id,12);
  assert.equal(selectProductForPage(a,[base,a,b]).item.id,11);
  const client=clientFor({...baseTables,products:[base,a,b]});
  const data=await loadProductPage(client,{id:'11'});
  assert.equal(data.variants.length,2);assert.equal(data.item.id,11);
  assert.equal(productSeoDetails({...data,storageOrigin}).canonical,origin+'/product?id=10');
  await assert.rejects(loadProductPage(client,{id:'10',variant:'5019'}),error=>error.status===404);
});

test('supplier text cannot break title, attributes, JSON-LD, breadcrumbs or execute scripts',()=>{
  const row={...projector,name:'Проєктор </title><script>alert(1)</script>',sku:'"<&',brand:'</script><img src=x onerror=bad>',description:'<!--technoroom-rich-text:v1--><p>Опис &amp; текст</p><script>PRIVATE_SCRIPT</script>'};
  const html=renderProductPage(template,dataFor(row),{storageOrigin}),schema=schemaOf(html);
  assert.equal((html.match(/id="product-schema"/g)||[]).length,1);
  assert.doesNotMatch(html,/<script>alert|<img src=x|PRIVATE_SCRIPT/);
  assert.equal(schema.description,'Опис & текст');assert.doesNotMatch(html,/<h1>[^]*?<script>/);
  assert.equal(productPlainText('<style>private</style><p>Добре</p>'),'Добре');
  assert.match(productBreadcrumbMarkup([], '<img src=x>'),/&lt;img src=x&gt;/);
  const dollar={...projector,name:"Проєктор $& $' $` $$",description:"Опис $& $' $` $$"};
  const literal=renderProductPage(template,dataFor(dollar),{storageOrigin});
  assert.equal((literal.match(/<!doctype html>/g)||[]).length,1);
  assert.equal(schemaOf(literal).description,dollar.description);
});

test('hidden and malformed IDs return 404 without content; temporary failures return non-cacheable 503',async()=>{
  const hidden={...projector,id:99,is_active:false,name:'PRIVATE HIDDEN PRODUCT'};
  const client=clientFor({...baseTables,products:[...baseTables.products,hidden]});let factoryCalls=0;
  const handler=createProductPageHandler({clientFactory:()=>{factoryCalls++;return client;},templateLoader:async()=>template,storageOrigin:()=>storageOrigin});
  for(const id of ['0','-1','1 or 1=1','01',['439','5019'],undefined]){
    const res=response();await handler({query:{id}},res);assert.equal(res.statusCode,404);assert.equal(res.headers['X-Robots-Tag'],'noindex');
  }
  assert.equal(factoryCalls,0);
  const hiddenRes=response();await handler({query:{id:'99'}},hiddenRes);assert.equal(hiddenRes.statusCode,404);assert.ok(!hiddenRes.body.includes(hidden.name));
  const failure=createProductPageHandler({clientFactory:()=>clientFor(baseTables,{failTable:'products'}),templateLoader:async()=>template,storageOrigin:()=>storageOrigin});
  const failed=response();await failure({query:{id:'439'}},failed);assert.equal(failed.statusCode,503);assert.equal(failed.headers['Cache-Control'],'no-store');assert.equal(failed.headers['Retry-After'],'60');assert.doesNotMatch(failed.body,/PRIVATE/);
});

test('GET and HEAD share status/headers, unsafe methods are rejected and all agents get the same HTML',async()=>{
  const client=clientFor(baseTables);
  const handler=createProductPageHandler({clientFactory:()=>client,templateLoader:async()=>template,storageOrigin:()=>storageOrigin,now:()=>1000});
  const get=response(),head=response(),bot=response(),post=response();
  await handler({method:'GET',query:{id:'439'}},get);
  await handler({method:'HEAD',query:{id:'439'}},head);
  await handler({method:'GET',query:{id:'439'},headers:{'user-agent':'Googlebot'}},bot);
  await handler({method:'POST',query:{id:'439'}},post);
  assert.equal(get.statusCode,200);assert.equal(head.statusCode,200);assert.equal(head.body,null);assert.deepEqual(get.headers,head.headers);assert.equal(get.body,bot.body);assert.equal(post.statusCode,405);
  assert.ok(client.calls.length>0);
  assert.ok(client.calls.every(call=>!call.columns.includes('supplier_price')&&!call.columns.includes('*')));
});

test('client refresh updates one canonical and one schema; tracking and fragments never become canonical',()=>{
  const nodes=[];
  const doc={title:'',head:{append(node){node.parentNode=this;nodes.push(node);}},createElement(tagName){return {tagName,attributes:{},setAttribute(k,v){this.attributes[k]=v;},remove(){nodes.splice(nodes.indexOf(this),1);}};},getElementById(id){return nodes.find(n=>n.id===id);},querySelector(selector){return nodes.find(n=>selector==='link[rel="canonical"]'?n.attributes.rel==='canonical':selector==='meta[name="description"]'?n.attributes.name==='description':n.attributes.property===selector.match(/property="([^"]+)"/)?.[1]);}};
  for(const row of [projector,ink,printer])updateProductSeo(doc,productSeoDetails({...dataFor(row),storageOrigin}));
  assert.equal(nodes.filter(n=>n.attributes.rel==='canonical').length,1);
  assert.equal(nodes.filter(n=>n.id==='product-schema').length,1);
  assert.equal(doc.querySelector('link[rel="canonical"]').attributes.href,origin+'/product?id=4331');
});

test('sitemap excludes variant duplicates, retains active orphans; production route cannot be shadowed by a generic file',async()=>{
  const rows=[{...projector,id:10},{...projector,id:11,parent_product_id:10},{...projector,id:12,parent_product_id:999}];
  const urls=await sitemapUrls(clientFor({...baseTables,products:rows}));
  assert.ok(urls.includes(origin+'/product?id=10'));assert.ok(!urls.includes(origin+'/product?id=11'));assert.ok(urls.includes(origin+'/product?id=12'));
  const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.ok(config.rewrites.some(r=>r.source==='/product'&&r.destination==='/api/sitemap?view=product'));
  assert.ok(config.redirects.some(r=>r.source==='/product.html'&&r.destination==='/product'&&r.permanent));
  await assert.rejects(readFile(new URL('../public/product.html',import.meta.url)),{code:'ENOENT'});
  assert.ok(config.functions['api/sitemap.js'].includeFiles.includes('server/*-template.html'));
  assert.ok((await readdir(new URL('../api',import.meta.url))).filter(name=>name.endsWith('.js')).length<=12,'Stay within the existing function budget');
});
