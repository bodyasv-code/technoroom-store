import test from 'node:test';
import assert from 'node:assert/strict';
import {canon075Compatibility as map, productCompatibilityGroups as groups, renderProductCompatibility as render, loadCompatibleProductRows} from '../public/product-compatibility.js';
const devices = map.devices.map((sku,i) => ({id:100+i,sku,brand:'Canon',type:'office-mfp-color'}));
const cartridges = [...map.standard,...map.highYield].map((sku,i) => ({id:200+i,sku,brand:'Canon',type:'office-consumables-cartridges'}));
const products = [...devices,...cartridges];
test('each exact device links all eight cartridges in capacity and color order', () => {
  for (const device of devices) assert.deepEqual(groups(device,products).map(g => g.products.map(p => p.sku)), [map.standard,map.highYield]);
});
test('each cartridge links all four devices, including products without stock', () => {
  for (const item of cartridges) assert.deepEqual(groups(item,products.map(p=>({...p,stock:false}))).flatMap(g=>g.products.map(p=>p.sku)),map.devices);
});
test('similar model text, wrong brand, category, region and accessories never establish compatibility', () => {
  for (const changes of [{sku:'6365C001'}, {sku:'6365C002-compatible'}, {brand:'Other'}, {type:'office-accessories'}, {sku:'',name:'Canon 075 MF664Cdw'}]) {
    assert.deepEqual(groups({...cartridges[0],...changes},products),[]);
  }
});
test('hidden products, variants, duplicates and unrelated codes are excluded', () => {
  const candidates = products.map(p=>p.sku===map.standard[0]?{...p,is_active:false}:p.sku===map.standard[1]?{...p,parentProductId:99}:p);
  candidates.push({...cartridges[2],id:999});
  assert.deepEqual(groups(devices[0],candidates)[0].products.map(p=>p.sku),[map.standard[3]]);
  assert.deepEqual(groups({...devices[0],is_active:false},products),[]);
});
test('rendering uses the storefront card and omits empty blocks', () => {
  const html=render(devices[0],products,p=>`<article data-id="${p.id}"></article>`);
  assert.equal((html.match(/<article /g)||[]).length,8);
  assert.match(html,/Картриджі підвищеної ємності/);
  assert.equal(render(devices[0],[],()=>assert.fail()),'');
});
test('product pages explicitly fetch the other category with active and root filters; errors remain visible to caller', async () => {
  const calls=[];
  const query={};
  for (const method of ['select','in','eq','is']) query[method]=(...args)=>{calls.push([method,...args]);return query;};
  query.then=resolve=>resolve({data:cartridges,error:null});
  const client={from:table=>{assert.equal(table,'products');return query;}};
  assert.equal((await loadCompatibleProductRows(client,devices[0])).length,8);
  assert.deepEqual(calls.find(c=>c[0]==='in'),['in','sku',[...map.standard,...map.highYield]]);
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='is_active'&&c[2]===true));
  assert.ok(calls.some(c=>c[0]==='is'&&c[1]==='parent_product_id'&&c[2]===null));
  assert.deepEqual(await loadCompatibleProductRows({from:()=>assert.fail()}, {...devices[0],sku:'unknown'}),[]);
  query.then=resolve=>resolve({data:null,error:new Error('unavailable')});
  await assert.rejects(loadCompatibleProductRows(client,devices[0]),/unavailable/);
});
