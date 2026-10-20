export const supplierCodes=['ERC','ASBIS'];
export const supplierSku=value=>String(value??'').trim().toUpperCase();
export const supplierSetupMessage='Постачальники ще не підключені. Виконайте supabase/product-suppliers-upgrade.sql. Імпорт заблоковано до підключення захисту.';
export function productSupplierLabels(links,id){return [...new Set(links.filter(row=>Number(row.product_id)===Number(id)).map(row=>row.supplier))].sort();}
export function supplierImportBlock(registry,row){
  if(!registry.ready)return supplierSetupMessage;
  if(!supplierCodes.includes(row.supplier))return 'Постачальника джерела не визначено. Повторно відкрийте файл.';
  return registry.exclusions.some(x=>x.is_active&&supplierSku(x.sku)===supplierSku(row.sku))?'SKU виключено з імпорту: товар поки не потрібен.':'';
}
export async function readSupplierRegistry(db){
  const read=async table=>{const key=table==='catalog_suppliers'?'code':table==='product_suppliers'?'product_id':'sku';const rows=[];for(let offset=0;;offset+=1000){const result=await db.from(table).select('*').order(key).order(table==='product_suppliers'?'supplier':key).range(offset,offset+999);if(result.error)throw result.error;rows.push(...result.data);if(result.data.length<1000)return rows;}};
  const [links,exclusions,suppliers]=await Promise.all([read('product_suppliers'),read('product_import_exclusions'),read('catalog_suppliers')]);return {ready:true,links,exclusions,suppliers};
}
