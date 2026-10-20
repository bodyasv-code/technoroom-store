export function adminCatalogMessage({catalogLoading,catalogError,catalogReady}) {
  if(catalogLoading)return 'Завантажуємо товари…';
  if(catalogError)return 'Не вдалося завантажити каталог. Спробуйте ще раз.';
  return catalogReady?'':'Завантажуємо товари…';
}
export async function adminRead(request,timeoutMs=45000) {
  let timer;
  try {
    const result=await Promise.race([Promise.resolve(request),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('Час очікування відповіді минув.')),timeoutMs);
    })]);
    if(result?.error)throw result.error;
    return result?.data||[];
  } finally {clearTimeout(timer);}
}
// Independent groups: slow/failed reports must not hold up the product table.
// Keep the public promise pending until both groups settle for existing save flows.
export async function loadAdminDataGroups({catalog,secondary,onCatalog,onSecondary,onCatalogError,onSecondaryError}) {
  await Promise.all([
    Promise.resolve().then(catalog).then(onCatalog).catch(onCatalogError),
    Promise.resolve().then(secondary).then(onSecondary).catch(onSecondaryError),
  ]);
}
