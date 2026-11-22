import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {importBatches,readImportProducts} from '../public/import-batches.js';
import {createMtiOfferJob,applyMtiOfferJob} from '../public/mti-offer-import.js';
import {mtiScopeRows} from '../public/mti-price.js';

test('full selection is split without loss, truncation or oversized database queries',async()=>{
 const rows=Array.from({length:325},(_,id)=>({id}));
 assert.deepEqual(importBatches(rows).map(b=>b.length),[100,100,100,25]);
 assert.deepEqual(importBatches(rows).flat(),rows);
 const queries=[];const client={from(){return {select(){return this;},async in(field,ids){assert.equal(field,'id');queries.push(ids);return {data:ids.map(id=>rows[id])};}};}};
 assert.equal((await readImportProducts(client,rows)).size,325);assert.deepEqual(queries.map(q=>q.length),[100,100,100,25]);
 for(const size of [0,101,1.5])assert.throws(()=>importBatches(rows,size));
 await assert.rejects(readImportProducts({from(){return {select(){return this;},in:async()=>({error:{message:'offline'}})};}},rows),/offline/);
});

test('MTI resumes a lost reply with the same frozen payload and UUID; confirmed chunks are skipped',async()=>{
 let sequence=0,fail=true;const committed=new Map(),calls=[],progress=[];
 const plan={ready:Array.from({length:325},(_,i)=>({key:String(i),offer:{manufacturerSku:'P-'+i,quantity:2}}))};
 const job=createMtiOfferJob(plan,'price.xlsx',()=>String(++sequence));plan.ready[100].offer.quantity=999;
 const client={async rpc(name,args){
  assert.equal(name,'apply_mti_offer_batch');calls.push(args.p_request);
  const old=committed.get(args.p_request);if(old){assert.deepEqual(args.p_rows,old.rows);return {data:old.result};}
  const result={runId:args.p_request,offers:args.p_rows.length,createdDrafts:0,linkedExisting:args.p_rows.length,published:0};
  committed.set(args.p_request,{rows:structuredClone(args.p_rows),result});
  if(args.p_request==='2'&&fail){fail=false;throw Error('Reply lost after commit');}
  return {data:result};
 }};
 await assert.rejects(applyMtiOfferJob(client,job),/Reply lost/);
 assert.equal(job.batches[0].result.offers,100);assert.equal(job.batches[1].result,null);
 const result=await applyMtiOfferJob(client,job,{onProgress:p=>progress.push(p.offers)});
 assert.deepEqual(calls,['1','2','2','3','4']);assert.deepEqual(progress,[100,200,300,325]);
 assert.equal(result.offers,325);assert.equal(result.linkedExisting,325);assert.equal(committed.get('2').rows[0].quantity,2);
 await applyMtiOfferJob(client,job);assert.equal(calls.length,5);
});

test('MTI projection scope controls the whole write selection independently of preview pagination',()=>{
 const rows=['projectors','erc-display-06','erc-display-08','erc-display-10','printers',''].map(category=>({category}));
 assert.equal(mtiScopeRows(rows).length,4);assert.equal(mtiScopeRows(rows,'projectors').length,1);assert.equal(mtiScopeRows(rows,'all'),rows);
});

const adminSource=await readFile(new URL('../public/admin.js',import.meta.url),'utf8');
const controller=adminSource.slice(adminSource.indexOf('  const importSelected = async () => {'),adminSource.indexOf('  let refreshImportHistory;'));
async function runErc(count,failAt){
 const rows=Array.from({length:count},(_,i)=>({key:String(i),sku:'P-'+i,images:[],hasPrice:true,price:100}));
 const products=rows.map((r,i)=>({id:i+1,sku:r.sku,category:'projectors',price:90}));
 const element={disabled:false,textContent:'',checked:false},section={querySelectorAll:()=>[]};
 const starts=[],finishes=[],writes=[];const importer={rows,selected:new Set(rows.map(r=>r.key)),meta:new Map(),report:null};
 const context={Map,Set,Math,Number,Boolean,console,importer,importRunning:false,importPreparing:false,
  state:{catalogReady:true,products,brands:[]},supabase:{},$:id=>id==='#supplierImport'?section:element,
  createImportAudit:()=>()=>({}),canImportRow:()=>true,importUpdateOptions:()=>({category:false}),
  knownBySku:()=>new Map(products.map(p=>[p.sku,p])),plannedImportChanges:()=>({}),showImportChangePlans:async()=>true,esc:v=>v,
  readImportProducts:async()=>new Map(products.map(p=>[p.id,p])),importSnapshot:JSON.stringify,
  async startImportRun(db,options,n){assert.ok(n>0&&n<=100);starts.push(n);return 'run-'+starts.length;},
  async finishImportRun(db,id,report,failed){finishes.push({id,report:structuredClone(report),failed});},
  importRowMeta:()=>({mapped:true}),missingFromSourceFile:()=>[],importerStatus:()=>{},
  buildImportChangePlan:()=>({patch:{price:100},images:'preserve'}),
  async writeImportProduct(db,run,current){writes.push(current.id);if(current.id===failAt)throw Error('connection lost');return {data:{id:current.id}};},
  loadData:async()=>{},renderImportPreview:()=>{},renderImportReport:()=>{},updateImportSelectionSummary:()=>{},refreshImportHistory:null};
 await runInNewContext('(async()=>{'+controller+';await importSelected();})()',context);
 return {starts,finishes,writes,report:importer.report};
}
test('actual ERC controller handles 325 rows with four bounded journals and one complete report',async()=>{
 const result=await runErc(325);
 assert.deepEqual(result.starts,[100,100,100,25]);assert.equal(result.writes.length,325);
 assert.equal(result.report.updated,325);assert.equal(result.report.failures.length,0);assert.equal(result.finishes.length,4);
 assert.ok(result.finishes.every(f=>!f.failed&&f.report.failures.length===0));
});
test('ERC interruption keeps completed journals and lists the unconfirmed row and every unprocessed row',async()=>{
 const result=await runErc(325,118);
 assert.deepEqual(result.starts,[100,100]);assert.equal(result.writes.length,118);assert.equal(result.report.updated,117);
 assert.equal(result.finishes.length,2);assert.equal(result.finishes[0].failed,undefined);assert.equal(result.finishes[1].failed,true);
 assert.equal(result.report.failures.length,208);assert.equal(new Set(result.report.failures.map(f=>f.key)).size,208);
 assert.equal(result.report.failures[0].sku,'P-117');assert.equal(result.report.failures.at(-1).sku,'P-324');
});
