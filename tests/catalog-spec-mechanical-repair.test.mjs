import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {planOfficeSpecificationCleanup} from '../scripts/office-specification-cleanup.mjs';
const plan=JSON.parse(await readFile(new URL('../docs/catalog-spec-mechanical-2026-10-24.json',import.meta.url),'utf8'));
const sql=await readFile(new URL('../supabase/repair-catalog-spec-mechanical-20261024.sql',import.meta.url),'utf8');
const verify=await readFile(new URL('../supabase/verify-catalog-spec-mechanical-20261024.sql',import.meta.url),'utf8');
assert.equal(plan.changed.length,136);assert.equal(plan.fieldCount,211);
for(const p of plan.changed){
  assert.deepEqual(planOfficeSpecificationCleanup({...p,specifications:p.before}).after,p.after,'Reproducible proposal '+p.id);
  assert.equal(planOfficeSpecificationCleanup({...p,specifications:p.after}).changes.length,0,'Idempotent '+p.id);
}
async function fixture(){
  const db=new PGlite();
  await db.exec(`CREATE TABLE products(id bigint PRIMARY KEY,sku text,category text,is_active boolean,specifications jsonb,price numeric,stock_quantity integer,description text,image_path text);
    CREATE SCHEMA technoroom_maintenance;
    CREATE TABLE technoroom_maintenance.product_repair_backup(operation text,product_id bigint,before_row jsonb,backed_up_at timestamptz,PRIMARY KEY(operation,product_id));
    ALTER TABLE technoroom_maintenance.product_repair_backup ENABLE ROW LEVEL SECURITY;`);
  for(const p of plan.changed)await db.query('INSERT INTO products VALUES($1,$2,$3,true,$4::jsonb,123.45,7,$5,$6)',[p.id,p.sku,p.category,JSON.stringify(p.before),'Опис не змінювати','photo.jpg']);
  return db;
}
const db=await fixture();
await db.exec(sql);
const check=(await db.query(verify)).rows[0];
assert.deepEqual(Object.values(check).map(v=>typeof v==='string'?Number(v):v),[136,136,136,136,136,0,true]);
for(const p of plan.changed){
  const row=(await db.query('SELECT * FROM products WHERE id=$1',[p.id])).rows[0];
  assert.deepEqual(row.specifications,p.after);assert.equal(Number(row.price),123.45);assert.equal(row.stock_quantity,7);assert.equal(row.description,'Опис не змінювати');
}
await assert.rejects(db.exec(sql),/already has backups/);await db.exec('ROLLBACK');await db.close();
const stale=await fixture();
await stale.query('UPDATE products SET specifications=specifications || $1::jsonb WHERE id=$2',[JSON.stringify({'Ручна правка':'Зберегти'}),plan.changed.at(-1).id]);
await assert.rejects(stale.exec(sql),/Snapshot changed/);await stale.exec('ROLLBACK');
assert.equal((await stale.query('SELECT count(*)::int n FROM technoroom_maintenance.product_repair_backup')).rows[0].n,0);
assert.deepEqual((await stale.query('SELECT specifications FROM products WHERE id=$1',[plan.changed[0].id])).rows[0].specifications,plan.changed[0].before);
await stale.close();
const failure=await fixture();
await failure.exec('CREATE FUNCTION corrupt() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.price=999; RETURN NEW; END$$; CREATE TRIGGER corrupt BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION corrupt()');
await assert.rejects(failure.exec(sql),/Unexpected fields changed/);await failure.exec('ROLLBACK');
assert.equal((await failure.query('SELECT count(*)::int n FROM products WHERE price=123.45')).rows[0].n,136);
assert.equal((await failure.query('SELECT count(*)::int n FROM technoroom_maintenance.product_repair_backup')).rows[0].n,0);
await failure.close();
console.log('Exact catalog SQL: 136 protected full-row backups, 211 reproducible edits, unrelated values retained, stale/repeated writes rejected, rollback on trigger side effects: PASS');
