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
const root = product => product && product.is_active !== false && !product.parentProductId && !product.parent_product_id;
const eligible = product => canon(product) && root(product);
const epson = product => String(product?.brand || '').trim().toLowerCase() === 'epson';
const projector = product => (product?.type || product?.category) === 'projectors';
const screen = product => (product?.type || product?.category) === 'erc-display-06';
const mount = product => (product?.type || product?.category) === 'erc-display-10';
// EB-994F accessories: Epson Europe product 52674; CO-W01: European user guide p.125.
// https://www.epson.eu/en_EU/products/projector/eb-994f-full-hd,-4100-lumens,-wireless-projector-with-exceptional-connectivity/p/52674
// https://www.epson.ua/projectors/professional/business-education/eb-994f-v11hb60042
// https://download3.ebz.epson.net/dsc/f/03/00/17/17/78/2689035c346c9679c2d9dc54563bc828adcde6c7/UsersGuide_COFH01_EN_Rev04.pdf
// UST guidance: https://www.samsung.com/ua/projectors/the-premiere/lpf5-touch-interaction-projector-sp-lpf5dsaxxua/
// Regional projector SKUs are deliberately explicit; compatibility never follows model-name fragments.
export const epsonProjectorCompatibility = {
  V11HB60042: {screens:['V12H002S21','V12H002S26'], mounts:['V12H003B23']},
  V11HA86040: {screens:[], mounts:['V12H003B23']},
};
const epsonAccessories = item => root(item) && epson(item) && projector(item) ? epsonProjectorCompatibility[sku(item)] : null;
export function compatibilityTargetSkus(item) {
  const accessories = epsonAccessories(item);
  if (accessories) return [...accessories.screens,...accessories.mounts];
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
    .eq('brand',epsonAccessories(item)?'Epson':'Canon').eq('is_active',true).is('parent_product_id',null);
  if (error) throw error;
  return data || [];
}
export function productCompatibilityGroups(item, products) {
  const accessories = epsonAccessories(item);
  if (accessories) {
    const find = (codes,kind) => codes.flatMap(code => {
      const matches = products.filter(p => root(p) && epson(p) && kind(p) && sku(p) === code && Number(p.id) !== Number(item.id));
      return matches.length === 1 ? matches : [];
    });
    return [
      {title:'Екрани, рекомендовані Epson',products:find(accessories.screens,screen)},
      {title:'Сумісне стельове кріплення',products:find(accessories.mounts,mount)},
    ].filter(group=>group.products.length);
  }
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
  if (root(item) && projector(item) && String(item.brand || '').toLowerCase() === 'samsung' && sku(item) === 'SP-LPF5DSAXXUA') {
    return '<section class="related-products product-compatibility"><div class="related-heading"><div><p class="section-kicker">Підбір екрана</p><h2>Екран для ультракороткого фокуса</h2><p>Для The Premiere 5 Samsung рекомендує екран, призначений для ультракороткофокусної проєкції (UST). Діагональ і розміщення потрібно підібрати під вашу кімнату.</p><a href="contacts.html">Допомогти з підбором екрана →</a></div></div></section>';
  }
  return productCompatibilityGroups(item, products).map(group =>
    '<section class="related-products product-compatibility"><div class="related-heading"><div><p class="section-kicker">Сумісність</p><h2>' + group.title + '</h2></div></div><div class="product-grid">' + group.products.map(renderCard).join('') + '</div></section>'
  ).join('');
}
