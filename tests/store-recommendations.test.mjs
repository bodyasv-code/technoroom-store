import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {recommendedProducts} from '../public/store-recommendations.js';
const product=(id,extra={})=>({id,name:'Live product '+id,type:'printers',price:100,stock:true,image:'photo.jpg',...extra});
const rows=[product(20),product(21),product(22,{image:null}),product(23,{type:'audio'}),product(24,{parentProductId:20}),product(25,{stock:false}),product(26,{price:0}),product(27,{price:-1})];
assert.deepEqual(recommendedProducts(rows,{currentId:20}).map(row=>row.id),[21,22]);
assert.deepEqual(recommendedProducts(rows,{allowedCategories:new Set(['audio'])}).map(row=>row.id),[23]);
assert.deepEqual(recommendedProducts([product(1),product(2,{stock:undefined})]).map(row=>row.id),[1]); // Real database ID 1 is not a forbidden demo ID.
assert.deepEqual(recommendedProducts([product(20),product(24,{parentProductId:20})],{currentId:24}),[]);
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
assert.ok(!source.includes('fallbackProducts'));assert.ok(source.includes('let products = [];'));
assert.ok(!source.includes('<h2>Популярні товари</h2>'));
assert.ok(source.includes('checkout(); refreshStorefrontRecommendations();'));
assert.ok(!source.includes('[0, 700, 1800]'));
const block=source.slice(source.indexOf('const recommendationEscape'),source.indexOf('/* Каталог будується за реальним деревом'));
const events=new Map(),storage=new Map();let root=null;
const main={append(node){root=node;}};
const context={products:[],productsLoaded:false,isProductPage:true,catalogProductScope:'all',location:{search:'?id=20'},URLSearchParams,
 recommendedProducts,get:id=>context.products.find(row=>Number(row.id)===Number(id)),imageUrl:row=>row.image||'',salePrice:row=>row.price,money:String,
 localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
 document:{querySelector:selector=>selector==='main'?main:root,createElement:()=>({innerHTML:'',remove(){root=null;}}),addEventListener:(name,callback)=>events.set(name,callback)}};
vm.createContext(context);vm.runInContext(block+';this.refresh=refreshStorefrontRecommendations;',context);
context.refresh();assert.equal(root,null);assert.equal(storage.size,0);
// Simulate a slow response after any old fixed timer would have expired.
context.products=rows;context.productsLoaded=true;context.refresh();
assert.ok(root.innerHTML.includes('<h2>Рекомендуємо</h2>'));assert.ok(root.innerHTML.includes('Live product 21'));
assert.ok(!root.innerHTML.includes('Live product 23'));assert.ok(!root.innerHTML.includes('Live product 25'));
assert.equal(JSON.parse(storage.get('technoroom-recently-viewed'))[0],20);
// Full hydration replaces the first screen and updates recommendations again.
context.products=[product(20),product(30)];events.get('technoroom:catalog-ready')();
assert.ok(root.innerHTML.includes('Live product 30'));assert.ok(!root.innerHTML.includes('Live product 21'));
context.products=[];context.refresh();assert.equal(root,null);
console.log('No demo cards or timed races, late data/hydration, genuine catalog IDs, category scope, stock/price, variants and recent-history guards: OK');
