import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import handler,{buildMerchantFeed,loadMerchantFeed,readFeedRows,feedText,validGtin,FEED_COLUMNS} from '../server/merchant-feed.js';
import xmlHandler from '../api/sitemap.js';
const categories=[{id:1,slug:'root',name:'Техніка',is_active:true},{id:2,slug:'projectors',parent_id:1,name:'Проєктори',is_active:true},{id:3,slug:'hidden',is_active:false},{id:4,slug:'child',parent_id:3,is_active:true}];
const base={id:1,name:'Проєктор <b>Epson &amp; X</b>',description:'<p>Опис &amp; техніка</p>',brand:'Epson',brand_id:2,sku:'INTERNAL-SKU',category:'projectors',price:'1000.01',in_stock:true,stock_quantity:2,availability_status:'in_stock',image_path:'products/1 фото.jpg',specifications:{},is_active:true};
const build=(products,extra={})=>buildMerchantFeed({products,categories,storageOrigin:'https://example.supabase.co',...extra});
let result=build([base],{promotions:[{id:2,target_type:'all',discount_type:'percent',discount_value:10,is_active:true}]});
assert.equal(result.stats.included,1);assert.equal(result.stats.missingIdentifiers,1);
for(const fragment of ['<g:id>1</g:id>','Проєктор Epson &amp; X','<g:price>1000.01 UAH</g:price>','<g:sale_price>900.01 UAH</g:sale_price>','<g:availability>in_stock</g:availability>','Техніка &gt; Проєктори','https://www.technoroom.com.ua/product?id=1','products/1%20%D1%84%D0%BE%D1%82%D0%BE.jpg'])assert.ok(result.xml.includes(fragment),fragment);
assert.ok(!/INTERNAL-SKU|identifier_exists|shipping_weight|<g:shipping>|service_role/.test(result.xml));
assert.equal(validGtin('4006381333931'),'4006381333931');assert.equal(validGtin('4006381333932'),'');assert.equal(validGtin('00000000'),'');
result=build([{...base,specifications:{EAN:'4006381333931','Код виробника':'REAL-MPN'}}]);assert.ok(result.xml.includes('<g:gtin>4006381333931</g:gtin>'));assert.ok(result.xml.includes('<g:mpn>REAL-MPN</g:mpn>'));
for(const field of ['EAN Код',' ean код ','EAN-13 Код'])assert.ok(build([{...base,specifications:{[field]:'195949882623'}}]).xml.includes('<g:gtin>195949882623</g:gtin>'),field);
for(const specs of [{'EAN Код':'4006381333932'},{'EAN Код':'195949882623 / 4006381333931'},{'EAN Код':['195949882623']},{'EAN Код':'195949882623',EAN:'4006381333931'}])assert.ok(!build([{...base,specifications:specs}]).xml.includes('<g:gtin>'),JSON.stringify(specs));
assert.ok(build([{...base,specifications:{'EAN Код':'195949882623',UPC:'195949882623'}}]).xml.includes('<g:gtin>195949882623</g:gtin>'));
for(const patch of [{is_active:false},{category:'child'},{category:'unknown'},{availability_status:'under_order'},{in_stock:false},{stock_quantity:0},{image_path:null},{image_path:'https://remote.test/a.jpg'},{image_path:'../private.jpg'},{image_path:'products/%2e%2e/test.jpg'},{description:''},{brand:''},{price:0},{price:'bad'}]){
 const outcome=build([{...base,...patch}]);
 // Percent escapes are escaped again, not traversal; this is a literal storage object name.
 if(patch.image_path==='products/%2e%2e/test.jpg')assert.ok(outcome.xml.includes('%252e%252e'));else assert.equal(outcome.stats.included,0,JSON.stringify(patch));
}
assert.equal(build([base,base]).stats.included,1);
const future={id:1,target_type:'all',discount_type:'percent',discount_value:50,is_active:true,starts_at:'2099-01-01'};assert.ok(!build([base],{promotions:[future]}).xml.includes('sale_price'));
const linked={id:1,target_type:'products',discount_type:'fixed',discount_value:100,is_active:true};assert.ok(build([{...base,parent_product_id:20}],{promotions:[linked],promotionLinks:[{promotion_id:1,product_id:20}]}).xml.includes('900.01 UAH'));
assert.ok(!build([base],{promotions:[{...linked,discount_value:2000}],promotionLinks:[{promotion_id:1,product_id:1}]}).stats.included);
assert.equal(feedText('Добре. Шановні партнери, dealer promotion таємниця'),'Добре.');assert.equal(feedText('<script>secret</script>Текст\u0000 &nbsp; &#38;'),'Текст &');
const rows=Array.from({length:1201},(_,i)=>({...base,id:i+1})),calls=[];
const tables={products:rows,categories,promotions:[],promotion_products:[]};
const client={from(table){return {select(columns){calls.push({table,columns});return this;},order(){return this;},eq(){return this;},async range(start,end){calls.push({table,start,end});return {data:tables[table].slice(start,end+1),error:null};}};}};
assert.equal((await loadMerchantFeed(client,'https://example.supabase.co')).stats.included,1201);assert.ok(calls.some(c=>c.table==='products'&&c.start===1000));
assert.ok(!/supplier|cost|customer|email/.test(FEED_COLUMNS));
await assert.rejects(readFeedRows({from(){return {select(){return this;},order(){return this;},range:async()=>({error:{message:'private'},data:null})};}},'products','id'),/Feed data unavailable/);
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},end(){return this;},send(body){this.body=body;return this;}});
let response=res();await handler({method:'POST'},response);assert.equal(response.code,405);assert.equal(response.headers.Allow,'GET, HEAD');
const oldUrl=process.env.SUPABASE_URL;delete process.env.SUPABASE_URL;try{response=res();await handler({method:'GET'},response);assert.equal(response.code,503);assert.equal(response.headers['Cache-Control'],'no-store');assert.equal(response.body,'Product feed temporarily unavailable');}finally{if(oldUrl!==undefined)process.env.SUPABASE_URL=oldUrl;}
const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));assert.ok(config.rewrites.some(r=>r.source==='/google-merchant.xml'&&r.destination==='/api/sitemap?format=merchant'));
response=res();await xmlHandler({method:'POST',query:{format:'merchant'}},response);assert.equal(response.code,405);
const {readdir}=await import('node:fs/promises');
const functions=(await readdir(new URL('../api/',import.meta.url))).filter(name=>name.endsWith('.js'));
assert.ok(functions.length<=12,'Stay within Vercel Hobby function budget');
assert.ok(!functions.includes('merchant-feed.js'),'Feed implementation must not create a thirteenth function');
console.log('Merchant feed: paginated public fields only, hierarchy/stock/photo gates, actual discounts, XML escaping, no fabricated identifiers/weights/shipping and fail-closed errors: PASS');
