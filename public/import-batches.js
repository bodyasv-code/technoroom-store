export function importBatches(rows,size=100){
  if(!Array.isArray(rows)||!Number.isInteger(size)||size<1||size>100)throw new Error('Некоректний розмір порції імпорту.');
  return Array.from({length:Math.ceil(rows.length/size)},(_,index)=>rows.slice(index*size,(index+1)*size));
}

export async function readImportProducts(client,products){
  const live=new Map();
  for(const batch of importBatches(products)){
    const result=await client.from('products').select('*').in('id',batch.map(p=>p.id));
    if(result.error)throw new Error('Не вдалося перевірити актуальність каталогу: '+result.error.message);
    for(const row of result.data||[])live.set(row.id,row);
  }
  return live;
}
