import assert from 'node:assert/strict';
import {removeUnusedBrandDuplicate} from '../public/brand-cleanup.js';
import {canonicalBrandName} from '../public/brand-normalization.js';
const old={id:2,name:'CANON Photo Video'},target={id:1,name:'Canon'};
assert.equal(canonicalBrandName(old.name),'Canon');
function mock({linked=0,textLinked=0,targetActive=true,queryError=null,deleted=1}={}){
  const calls=[];
  const client={from(table){let operation='read',filter={};const query={select(){return query;},eq(key,value){filter[key]=value;return query;},single(){return Promise.resolve({data:{...target,is_active:targetActive},error:null});},delete(){operation='delete';return query;},then(resolve,reject){calls.push({table,operation,filter});const response=operation==='delete'?{data:Array.from({length:deleted},()=>({id:2})),error:null}:{count:filter.brand_id!=null?linked:textLinked,error:queryError};return Promise.resolve(response).then(resolve,reject);}};return query;}};
  return {client,calls};
}
let test=mock();assert.equal((await removeUnusedBrandDuplicate(test.client,old,target)).removed,true);assert.deepEqual(test.calls.at(-1).filter,{id:2,name:old.name});
for(const setup of [{linked:1},{textLinked:1}]){test=mock(setup);assert.equal((await removeUnusedBrandDuplicate(test.client,old,target)).removed,false);assert.equal(test.calls.some(call=>call.operation==='delete'),false);}
test=mock({queryError:new Error('denied')});await assert.rejects(removeUnusedBrandDuplicate(test.client,old,target));assert.equal(test.calls.some(call=>call.operation==='delete'),false);
test=mock({targetActive:false});await assert.rejects(removeUnusedBrandDuplicate(test.client,old,target));assert.equal(test.calls.length,0);
test=mock({deleted:0});await assert.rejects(removeUnusedBrandDuplicate(test.client,old,target));
test=mock();await assert.rejects(removeUnusedBrandDuplicate(test.client,target,target));assert.equal(test.calls.length,0);
console.log('Unused brand cleanup safety: checks passed');
