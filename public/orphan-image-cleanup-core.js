export const approvedCleanup={count:1877,bytes:755051158};
export const cleanupBucket='product-images';
export function assetText(tables){return JSON.stringify(tables).toLowerCase().replace(/%2f/g,'/').replace(/%2d/g,'-').replace(/%5f/g,'_').replace(/%2e/g,'.').replace(/%20/g,' ').replace(/\\\//g,'/');}
export function deletedProductPhotoPlan(files,tables,now=Date.now()){
  if(!Array.isArray(tables.products))throw new Error('Не прочитано товари.');
  for(const key of ['categories','brands','banners','articles'])if(!Array.isArray(tables[key]))throw new Error('Не прочитано '+key+'.');
  const ids=new Set(tables.products.map(p=>String(p.id))),text=assetText(tables),seen=new Set();
  const plan=[];
  for(const file of files){
    if(seen.has(file.name))throw new Error('Повтор шляху у сховищі.');seen.add(file.name);
    const match=/^products\/import-([0-9]+)-[0-9]{10,}(-[0-9]+)?\.(jpg|jpeg|png|webp|avif|gif)$/.exec(file.name);
    if(!match||ids.has(String(BigInt(match[1]))))continue;
    const created=Date.parse(file.created_at);
    if(!Number.isFinite(created)||created>now-86400000)continue;
    if(text.includes(file.name.slice(file.name.lastIndexOf('/')+1).toLowerCase()))continue;
    const bytes=Number(file.metadata?.size);
    if(!file.id||!Number.isSafeInteger(bytes)||bytes<0)throw new Error('Неповні метадані файлу '+file.name);
    plan.push({name:file.name,id:file.id,updated_at:file.updated_at,created_at:file.created_at,bytes});
  }
  return plan.sort((a,b)=>a.name.localeCompare(b.name,'en'));
}
export const cleanupBytes=plan=>plan.reduce((sum,x)=>sum+x.bytes,0);
export function assertApprovedCleanup(plan){
  if(plan.length!==approvedCleanup.count||cleanupBytes(plan)!==approvedCleanup.bytes)throw new Error('Список відрізняється від підтверджених 1877 файлів / 755051158 байтів. Видалення заблоковано.');
}
export function assertUnchangedCleanup(expected,current){
  const byName=new Map(current.map(x=>[x.name,x]));
  for(const file of expected){const live=byName.get(file.name);if(!live||live.id!==file.id||live.bytes!==file.bytes||live.updated_at!==file.updated_at)throw new Error('Файл змінено або він знову використовується: '+file.name+'. Очищення зупинено.');}
}
export async function removeVerifiedBatches({plan,readPlan,remove,onProgress=()=>{},batchSize=500}){
  assertApprovedCleanup(plan);
  if(!Number.isInteger(batchSize)||batchSize<1||batchSize>500)throw new Error('Неприпустимий розмір пакета.');
  let removed=0;
  for(let offset=0;offset<plan.length;offset+=batchSize){
    const remaining=plan.slice(offset),current=await readPlan();assertUnchangedCleanup(remaining,current);
    const batch=remaining.slice(0,batchSize);
    const result=await remove(batch.map(x=>x.name));
    if(result.error)throw new Error('Storage API: '+result.error.message+'. Уже підтверджено видалень: '+removed+'. Потрібна нова перевірка, не повторюйте автоматично.');
    const returned=new Set((result.data||[]).map(x=>x.name));
    if(batch.some(x=>!returned.has(x.name)))throw new Error('Неповна відповідь Storage API. Частина файлів могла бути видалена. Очищення зупинено; потрібен повторний підрахунок.');
    removed+=batch.length;onProgress(removed);
  }
  const after=await readPlan();
  if(after.some(x=>plan.some(p=>p.name===x.name)))throw new Error('Не всі файли зникли зі сховища. Потрібна перевірка.');
  return removed;
}
