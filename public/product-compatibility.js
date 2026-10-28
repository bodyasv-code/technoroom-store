// Canon's European 075 series: exact manufacturer item codes, never name fragments.
// https://www.canon.co.uk/store/toner-cartridge-075/
export const canon075Compatibility = {
  devices: ['6928C008', '6928C001', '6929C007', '6929C001'],
  standard: ['6365C002', '6364C002', '6363C002', '6362C002'],
  highYield: ['6369C002', '6368C002', '6367C002', '6366C002'],
};
const sku = product => String(product?.sku || '').trim().toUpperCase();
const canon = product => String(product?.brand || '').trim().toLowerCase() === 'canon';
const device = product => /^office-(?:printers|mfp)(?:-|$)/.test(product?.type || product?.category || '');
const cartridge = product => (product?.type || product?.category) === 'office-consumables-cartridges';
const eligible = product => canon(product) && product.is_active !== false && !product.parentProductId && !product.parent_product_id;
export function compatibilityTargetSkus(item) {
  if (!eligible(item)) return [];
  const map = canon075Compatibility;
  if (device(item) && map.devices.includes(sku(item))) return [...map.standard,...map.highYield];
  if (cartridge(item) && [...map.standard,...map.highYield].includes(sku(item))) return [...map.devices];
  return [];
}
export async function loadCompatibleProductRows(client, item) {
  const codes = compatibilityTargetSkus(item);
  if (!codes.length) return [];
  const {data,error} = await client.from('products').select('*').in('sku',codes)
    .eq('brand','Canon').eq('is_active',true).is('parent_product_id',null);
  if (error) throw error;
  return data || [];
}
export function productCompatibilityGroups(item, products) {
  if (!eligible(item)) return [];
  const map = canon075Compatibility;
  const find = (codes, kind) => codes.flatMap(code => {
    const matches = products.filter(p => eligible(p) && kind(p) && sku(p) === code && Number(p.id) !== Number(item.id));
    // Duplicate item codes require review rather than an arbitrary product choice.
    return matches.length === 1 ? matches : [];
  });
  let groups = [];
  if (device(item) && map.devices.includes(sku(item))) {
    groups = [
      {title:'Картриджі стандартної ємності', products:find(map.standard, cartridge)},
      {title:'Картриджі підвищеної ємності', products:find(map.highYield, cartridge)},
    ];
  } else if (cartridge(item) && [...map.standard, ...map.highYield].includes(sku(item))) {
    groups = [{title:'Сумісні принтери та БФП', products:find(map.devices, device)}];
  }
  return groups.filter(group => group.products.length);
}
export function renderProductCompatibility(item, products, renderCard) {
  return productCompatibilityGroups(item, products).map(group =>
    '<section class="related-products product-compatibility"><div class="related-heading"><div><p class="section-kicker">Сумісність</p><h2>' + group.title + '</h2></div></div><div class="product-grid">' + group.products.map(renderCard).join('') + '</div></section>'
  ).join('');
}
