import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {reviewedDescriptionHtml,descriptionDraftText,prepareDescriptionChange,prepareDescriptionRollback,commitDescriptionChange} from '../public/content-description-change.js';

test('Reviewed descriptions: language gate, service headings, escaped markup and bullet grouping',()=>{
  assert.throws(()=>reviewedDescriptionHtml('Текст',false),/Підтвердьте/);
  for(const text of ['', 'x'.repeat(40001),'Чёрный проектор','Фокус: Керівництво','Bullet Points Epson','Короткий підсумковий опис: x','Сумарний опис'])assert.throws(()=>reviewedDescriptionHtml(text,true));
  assert.equal(reviewedDescriptionHtml('Опис <img src=x onerror=alert(1)>\n- Перший\n• Другий',true),'<p>Опис &lt;img src=x onerror=alert(1)&gt;</p><ul><li>Перший</li><li>Другий</li></ul>');
  assert.match(descriptionDraftText({paragraphs:['Опис'],bullets:['Перша перевага']}),/- Перша перевага/);
});

test('Review UI is separate, clears stale approvals and offers rollback without an Icecat request',async()=>{
  const ui=await readFile(new URL('../public/content-description-change-admin.js',import.meta.url),'utf8');
  const panel=await readFile(new URL('../public/product-content-preview-admin.js',import.meta.url),'utf8');
  assert.match(ui,/preview.status==='review'/);
  assert.match(ui,/text.oninput=.*reviewed.checked=false;clear\(\)/);
  assert.match(ui,/if\(pending\|\|uncertain\)return/);
  assert.match(ui,/uncertain=true/);
  assert.match(ui,/\.textContent=next.after/);
  assert.ok(!/\.update\(|\.insert\(|localStorage|sessionStorage/u.test(ui));
  assert.ok(panel.indexOf("if(action==='restore')")<panel.indexOf('client.auth.getSession()'));
  assert.match(panel,/Відновити опис із журналу без Icecat/);
});

test('Single description apply and rollback use real atomic journal, CAS and preserve all other fields',async()=>{
  const pg=await PGlite.create(),admin='11111111-1111-1111-1111-111111111111';
  const calls=[];
  try{
    await pg.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);insert into auth.users values('${admin}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function public.is_admin() returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;
      grant usage on schema auth to authenticated;
      create table products(id bigint generated always as identity primary key,name text,slug text unique,sku text unique,brand_id bigint,brand text,category text,price numeric,stock_quantity integer,in_stock boolean,availability_status text,description text,specifications jsonb,is_active boolean,image_path text,image_paths jsonb,manual_overrides jsonb default '{}');
      insert into products(name,slug,sku,brand,category,price,stock_quantity,in_stock,description,specifications,is_active,image_path,image_paths)
        values('Проєктор','projector','EXACT-SKU','Epson','projectors',12345,7,true,'<p>Старий опис</p>','{"Друк":"Не застосовується"}',true,'products/photo.jpg','["products/photo.jpg"]');`);
    await pg.exec(await readFile(new URL('../supabase/import-history-upgrade.sql',import.meta.url),'utf8'));
    await pg.exec(`grant select on products to authenticated;set role authenticated;set request.jwt.claim.sub='${admin}';`);
    let beforeRpc=null;
    const db={
      from(table){
        assert.ok(['products','import_changes'].includes(table));let columns='*',filters=[],limit=2;
        const query={select(value){assert.match(value,/^[a-z_,]+$/u);columns=value;return this;},eq(key,value){assert.ok(['id','run_id','product_id'].includes(key));filters.push([key,value]);return this;},limit(value){limit=value;return this;},
          async execute(single=false){try{const result=await pg.query(`select ${columns} from ${table} where ${filters.map(([key],i)=>key+'=$'+(i+1)).join(' and ')} limit ${limit}`,filters.map(([,value])=>value));return {data:single?(result.rows[0]||null):result.rows,error:null};}catch(error){return {error:{code:error.code,message:error.message}};}},
          maybeSingle(){return this.execute(true);},then(resolve,reject){return this.execute().then(resolve,reject);}};return query;
      },
      async rpc(name,args){calls.push({name,args:structuredClone(args)});if(beforeRpc)await beforeRpc(name);
        try{const values=Object.values(args).map(value=>value&&typeof value==='object'?JSON.stringify(value):value);
          const result=await pg.query(`select public.${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) as value`,values);return {data:result.rows[0].value,error:null};
        }catch(error){return {data:null,error:{code:error.code,message:error.message}};}
      }
    };
    const row=()=>db.from('products').select('id,name,sku,brand,description,manual_overrides').eq('id',1).maybeSingle().then(result=>result.data);
    const identity=await row(),original=(await pg.query('select * from products')).rows[0];
    const unchangedFields=async()=>{const current=(await pg.query('select * from products')).rows[0];delete current.description;const expected={...original};delete expected.description;assert.deepEqual(current,expected);};
    await assert.rejects(()=>prepareDescriptionChange(db,{...identity,sku:'WRONG'},'Новий опис',{reviewed:true}),/ідентифікатори/);
    assert.equal(calls.length,0);
    const plan=await prepareDescriptionChange(db,identity,'Новий опис\n- Перевірена перевага',{reviewed:true,icecatId:123});
    const saved=await commitDescriptionChange(db,plan);assert.equal(saved.historyComplete,true);
    assert.equal((await row()).description,plan.after);await unchangedFields();
    const write=calls.find(call=>call.name==='apply_product_import');
    assert.deepEqual(write.args.p_patch,{description:plan.after});assert.equal(write.args.p_images,false);
    const options=calls[0].args.p_options;
    for(const key of ['price','stock','category','specifications','images','publish'])assert.equal(options[key],false);
    assert.equal(options.description.source,'icecat-reviewed-description');
    const journal=(await pg.query('select before_values,after_values from import_changes')).rows[0];
    assert.deepEqual(journal.before_values,{description:identity.description});assert.deepEqual(journal.after_values,{description:plan.after});
    await assert.rejects(()=>commitDescriptionChange(db,plan),/змінилися/);
    const undo=await prepareDescriptionRollback(db,saved.runId,1);
    await commitDescriptionChange(db,undo);assert.equal((await row()).description,identity.description);await unchangedFields();
    await assert.rejects(()=>prepareDescriptionRollback(db,saved.runId,1),/змінено вручну/);

    // A competing edit after client refresh must still be rejected by PostgreSQL CAS.
    const stale=await prepareDescriptionChange(db,identity,'Інший опис',{reviewed:true});
    beforeRpc=async name=>{if(name==='apply_product_import'){beforeRpc=null;await pg.exec("reset role;update products set description='Ручна правка';set role authenticated;");}};
    await assert.rejects(()=>commitDescriptionChange(db,stale),/відхилена/);
    assert.equal((await row()).description,'Ручна правка');
    await pg.exec("reset role;update products set manual_overrides='{\"description\":true}';set role authenticated;");
    await assert.rejects(()=>prepareDescriptionChange(db,identity,'Опис',{reviewed:true}),/захищено/);
    await pg.exec("reset role;update products set manual_overrides='{}';create function reject_description_history() returns trigger language plpgsql as $$begin raise exception 'History failed';end$$;create trigger reject_description_history before insert on import_changes for each row execute function reject_description_history();set role authenticated;");
    const atomic=await prepareDescriptionChange(db,identity,'Атомарна заміна',{reviewed:true});
    await assert.rejects(()=>commitDescriptionChange(db,atomic),/відхилена/);assert.equal((await row()).description,'Ручна правка');
    await pg.exec('reset role;drop trigger reject_description_history on import_changes;set role authenticated;');

    // Lost response: never retry the write, nor report that nothing changed.
    let writes=0;
    const lost={...db,rpc:async(name,args)=>{if(name==='apply_product_import'){writes++;throw new Error('transport');}return db.rpc(name,args);}};
    await assert.rejects(()=>commitDescriptionChange(lost,atomic),/Результат запису невідомий/);assert.equal(writes,1);
    const finishFails={...db,rpc:async(name,args)=>name==='finish_product_import'?{error:{code:'FETCH_ERROR'}}:db.rpc(name,args)};
    const pending=await commitDescriptionChange(finishFails,atomic);assert.equal(pending.applied,true);assert.equal(pending.historyComplete,false);assert.match(pending.warning,/не повторюйте/);
  }finally{await pg.close();}
});
