import assert from 'node:assert/strict';
import {catalogResultState as state} from '../public/catalog-loading-state.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {catalogRequestScope,mergeCatalogRows,applyCatalogScope,cartProductIds} from '../public/catalog-scope.js';
assert.equal(state({count:0,loading:true}),'loading');
assert.equal(state({count:12,loading:true}),'loading-results');
assert.equal(state({count:0,error:true}),'error');
assert.equal(state({count:12,error:true}),'partial-results');
assert.equal(state({count:0}),'empty');
assert.equal(state({count:12}),'results');
assert.notEqual(state({count:0,loading:true}),'empty');
assert.notEqual(state({count:0,error:true}),'empty');
console.log('Catalog loading/empty/error states: OK');
// Exercise the actual loader, including failure after its first render.
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const loader=source.slice(source.indexOf('async function loadProducts()'),source.indexOf("if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadProducts"));
for(const failFirst of [false,true]){
  let redraws=0;
  const query={select(){return this},eq(){return this},order(){return this},async range(from){return from===0&&!failFirst?{data:Array.from({length:60},(_,id)=>({id})),count:120}:{error:new Error('Test connection failure')}}};
  const context={isProductPage:false,cart:[],catalogProductScope:'all',location:{search:''},catalogRequestScope,mergeCatalogRows,applyCatalogScope,cartProductIds,catalogLoadFailed:false,productsHydrating:false,productsLoaded:false,products:[{id:'fallback'}],supabase:{from(){return query}},readStorefrontProductCache:async()=>null,loadActivePromotions:async()=>{},loadStorefrontCategories:async()=>[],storeProductFromRow:row=>row,mount(){},mountMegaCatalog:async()=>{},console:{warn(){}},document:{getElementById:()=>({_catalogDraw(){redraws++;}})}};
  vm.createContext(context);
  await vm.runInContext(loader+';loadProducts();',context);
  assert.equal(context.productsHydrating,false);
  assert.equal(context.catalogLoadFailed,true);
  assert.equal(context.products.length,failFirst?0:60);
  if(!failFirst)assert.equal(redraws,1);
}
