// Owner-approved list, verified against Epson/HP documentation on 2026-10-13.
// No model-name guessing, imports, or unrelated product field updates.
export const verifiedDuplexProducts = [
  [4433,'C11CL59405','Ручний'],[4443,'C11CJ19401','Ручний'],[4444,'C11CJ18404','Немає'],
  [4530,'4ZB96A','Ручний (через драйвер)'],[4531,'4ZB97A','Ручний (через драйвер)'],
  [4551,'7MD73A','Немає'],[4599,'7MD67A','Немає'],[4600,'7MD68A','Немає'],[4607,'2Z611A','Ручний'],
];
const duplexKey=/^(?:дуплекс(?:ний друк)?|автоматичний двосторонній друк|двосторонній друк|duplex(?: printing)?)(?:\s*\(інше значення \d+\))?\s*[:：]?$/iu;
export function verifiedDuplexRepair(product) {
  const verified=verifiedDuplexProducts.find(([id,sku])=>Number(product.id)===id&&product.sku===sku);
  if(!verified || !product.specifications || typeof product.specifications!=='object' || Array.isArray(product.specifications)) return null;
  const specifications=Object.fromEntries(Object.entries(product.specifications).filter(([key])=>!duplexKey.test(key.trim())));
  specifications['Дуплексний друк']='Немає';
  specifications['Дуплекс']=verified[2];
  const unchanged=Object.keys(specifications).length===Object.keys(product.specifications).length&&Object.entries(specifications).every(([key,value])=>JSON.stringify(product.specifications[key])===JSON.stringify(value));
  return unchanged?null:{id:verified[0],sku:verified[1],before:product.specifications,specifications};
}

export async function applyVerifiedDuplexRepair(client, plan) {
  const result=await client.from('products').update({specifications:plan.specifications})
    .eq('id',plan.id).eq('sku',plan.sku).eq('specifications',JSON.stringify(plan.before)).select('id');
  if(result.error)throw result.error;
  if(result.data?.length!==1)throw new Error('Товар '+plan.id+' змінився або SKU не збігається. Оновіть каталог і перевірте вручну.');
  return plan.id;
}
