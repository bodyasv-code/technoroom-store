export function catalogRequestScope(search, isCatalog) {
  return isCatalog ? new URLSearchParams(search).get('category') || 'all' : 'all';
}
export function catalogCacheKey(scope='all') {
  return 'technoroom-storefront-products-v3:' + encodeURIComponent(scope);
}
export function mergeCatalogRows(categoryRows, supplementalRows=[]) {
  return [...new Map([...categoryRows,...supplementalRows].map(row=>[Number(row.id),row])).values()];
}
export function applyCatalogScope(request, scope, branch) {
  return scope === 'all' ? request : request.in('category',[...branch]);
}
