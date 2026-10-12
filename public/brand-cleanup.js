// Called only after an explicit admin confirmation and completed product reassignment.
export async function removeUnusedBrandDuplicate(client,oldBrand,targetBrand) {
  if(!oldBrand?.id||!targetBrand?.id||Number(oldBrand.id)===Number(targetBrand.id))throw new Error('Не можна видалити основний бренд.');
  const target=await client.from('brands').select('id,name,is_active').eq('id',targetBrand.id).single();
  if(target.error)throw target.error;
  if(!target.data?.is_active||target.data.name!==targetBrand.name)throw new Error('Основний бренд змінився. Оновіть список і перевірте його.');
  // Check all products, including drafts, and both ways a brand can be stored.
  const references=await Promise.all([
    client.from('products').select('id',{count:'exact',head:true}).eq('brand_id',oldBrand.id),
    client.from('products').select('id',{count:'exact',head:true}).eq('brand',oldBrand.name)
  ]);
  for(const reference of references){if(reference.error)throw reference.error;if(reference.count==null)throw new Error('Не вдалося перевірити зв’язки бренду.');}
  if(references.some(reference=>reference.count>0))return {removed:false,reason:'До старого бренду ще прив’язані товари.'};
  const result=await client.from('brands').delete().eq('id',oldBrand.id).eq('name',oldBrand.name).select('id');
  if(result.error)throw result.error;
  if(result.data?.length!==1)throw new Error('Бренд не видалено: запис змінився або бракує прав доступу.');
  return {removed:true};
}
