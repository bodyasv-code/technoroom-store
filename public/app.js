import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(window.TECHNOROOM_SUPABASE.url, window.TECHNOROOM_SUPABASE.publishableKey);
const catalogImageStyles = document.createElement('style');
catalogImageStyles.textContent = '.product-image{overflow:hidden;cursor:zoom-in}.product-image img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2;-webkit-user-drag:none;user-select:none}.product-image:has(img)::before{display:none}.catalog-grid .product,.product-grid .product{display:flex;flex-direction:column;min-width:0}.catalog-grid .product-image,.product-grid .product-image{position:static!important;inset:auto!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;flex:0 0 195px;width:100%!important;height:195px!important;margin:0 0 16px!important;overflow:hidden}.catalog-grid .product-image img,.product-grid .product-image img{position:static!important;display:block;width:100%!important;height:195px!important;object-fit:contain;transform:none!important}.product-detail-visual{overflow:hidden}.product-detail-visual .product-image{position:static!important;inset:auto!important;width:100%!important;height:100%!important;min-height:480px;margin:0!important;display:flex!important;align-items:center;justify-content:center}.product-detail-visual .product-image img{position:static!important;display:block;width:100%!important;height:100%!important;object-fit:contain;transform:none!important}.catalog-grid .product h3,.catalog-grid .product p,.product-grid .product h3,.product-grid .product p,.product-detail-copy h1,.product-detail-copy p,.product-detail-copy dt,.product-detail-copy dd{user-select:none}.image-lightbox{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:32px;background:rgba(8,24,22,.88)}.image-lightbox[hidden]{display:none!important}.image-lightbox img{max-width:min(100%,1200px);max-height:calc(100vh - 64px);object-fit:contain;background:#fff}.image-lightbox button{position:absolute;top:20px;right:24px;width:42px;height:42px;border:0;border-radius:50%;font-size:28px;line-height:1;background:#d8ff37;color:#0b2723;cursor:pointer}';
document.head.append(catalogImageStyles);
const fallbackProducts = [
  { id: 1, name: 'Acer H6830BD', description: '4K UHD проєктор для домашнього кінотеатру', price: 40449, type: 'projector', brand: 'Acer', details: '4000 лм · 3840 × 2160', stock: true },
  { id: 2, name: 'Epson EH-TW9400', description: 'Кінотеатральний Full HD проєктор', price: 150505, type: 'projector', brand: 'Epson', details: '2600 лм · 1920 × 1080', stock: true },
  { id: 3, name: 'KEF Q750', description: 'Підлогова акустична система', price: 47999, type: 'audio', brand: 'KEF', details: '150 Вт · чорний', stock: true },
  { id: 4, name: 'Samsung The Frame 65', description: 'QLED телевізор, 65 дюймів', price: 52999, type: 'tv', brand: 'Samsung', details: '65 дюймів · 4K UHD', stock: true },
];
let products = fallbackProducts;
const cart = JSON.parse(localStorage.getItem('technoroom-cart') || '[]');
const money = (value) => `${new Intl.NumberFormat('uk-UA').format(value)} ₴`;
const get = (id) => products.find((product) => product.id === Number(id));
const save = () => localStorage.setItem('technoroom-cart', JSON.stringify(cart));
const imageUrl = (product) => product.image?.startsWith('http') ? `/api/product-image?id=${product.id}` : product.image ? supabase.storage.from('product-images').getPublicUrl(product.image).data.publicUrl : '';
const image = (product) => product.image ? `<img src="${imageUrl(product)}" alt="${product.name}" draggable="false">` : '';
const lightbox = document.createElement('div');
lightbox.className = 'image-lightbox';
lightbox.hidden = true;
lightbox.innerHTML = '<button type="button" aria-label="Закрити фото">×</button><img alt="Збільшене фото товару">';
document.body.append(lightbox);
const openLightbox = (source, alt) => { const image = lightbox.querySelector('img'); image.src = source; image.alt = alt || 'Збільшене фото товару'; lightbox.hidden = false; };
const closeLightbox = () => { lightbox.hidden = true; lightbox.querySelector('img').removeAttribute('src'); };
lightbox.addEventListener('click', (event) => { if (event.target === lightbox || event.target.tagName === 'BUTTON') closeLightbox(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeLightbox(); });
document.addEventListener('contextmenu', (event) => { if (event.target.closest('.product-image,.image-lightbox,.product-detail-copy,.catalog-grid .product')) event.preventDefault(); });

function add(id) { const product = get(id); if (!product?.stock) return; cart.push(Number(id)); save(); renderCart(); }
function renderCart() { const count = document.getElementById('cartCount'); if (count) count.textContent = cart.length; const root = document.getElementById('cartItems'), total = document.getElementById('cartTotal'), checkoutButton = document.getElementById('checkoutButton'); if (!root) return; const items = cart.map((id, index) => ({ product: get(id), index })).filter((item) => item.product); root.innerHTML = items.length ? items.map(({ product, index }) => `<div class="cart-item"><b>${product.name}</b><strong>${money(product.price)}</strong><span>${product.stock ? 'В наявності' : 'Немає в наявності'}</span><button class="remove" data-remove="${index}">Прибрати</button></div>`).join('') : '<p class="empty-cart">Кошик поки порожній.</p>'; if (total) total.textContent = money(items.reduce((sum, item) => sum + item.product.price, 0)); if (checkoutButton) checkoutButton.disabled = !items.length; root.querySelectorAll('[data-remove]').forEach((button) => button.onclick = () => { cart.splice(Number(button.dataset.remove), 1); save(); renderCart(); }); }
function card(product) { return `<article class="product"><div class="product-image ${product.type}">${image(product)}</div><h3><a href="product.html?id=${product.id}">${product.name}</a></h3><p class="availability">${product.stock ? 'В наявності' : 'Немає в наявності'}</p><p>${product.description || ''}</p><div class="product-footer"><strong class="price">${money(product.price)}</strong><button class="add-button" data-add="${product.id}" ${product.stock ? '' : 'disabled'}>${product.stock ? 'У кошик' : 'Немає'}</button></div></article>`; }
function bind(root = document) { root.querySelectorAll('[data-add]').forEach((button) => button.onclick = () => add(button.dataset.add)); root.querySelectorAll('.product-image img').forEach((image) => image.onclick = () => openLightbox(image.currentSrc || image.src, image.alt)); }
function home() { const root = document.getElementById('productGrid'); if (root) { root.innerHTML = products.slice(0, 4).map(card).join(''); bind(root); } }
function categoryMatch(product, category) { const value = `${product.type || ''} ${product.name || ''} ${product.description || ''}`.toLowerCase(); if (category === 'audio') return /audio|акуст|звук|саундбар|підлогов|колонк/.test(value); if (category === 'projector') return /projector|проєктор|екран/.test(value); if (category === 'tv') return /(^|\s)tv(\s|$)|телевіз|панел|qled/.test(value); return product.type === category; }
function catalog() {
  const root = document.getElementById('catalogGrid');
  if (!root) return;
  const buttons = document.querySelectorAll('[data-category]');
  const search = document.getElementById('catalogSearch');
  const brand = document.getElementById('brandFilter');
  const price = document.getElementById('priceFilter');
  const stock = document.getElementById('stockFilter');
  const sort = document.getElementById('catalogSort');
  let category = new URLSearchParams(location.search).get('category') || 'all';
  const brands = [...new Set(products.map((product) => product.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));
  brand.innerHTML = '<option value="">Усі бренди</option>' + brands.map((value) => `<option value="${escape(value)}">${escape(value)}</option>`).join('');
  const draw = () => {
    buttons.forEach((button) => button.classList.toggle('selected', button.dataset.category === category));
    const term = search.value.trim().toLowerCase();
    let shown = products.filter((product) =>
      (category === 'all' || categoryMatch(product, category)) &&
      (!term || `${product.name} ${product.brand || ''} ${product.description || ''}`.toLowerCase().includes(term)) &&
      (!brand.value || product.brand === brand.value) &&
      (!price.value || Number(product.price) <= Number(price.value)) &&
      (!stock.checked || product.stock)
    );
    if (sort.value === 'price-asc') shown.sort((a, b) => a.price - b.price);
    if (sort.value === 'price-desc') shown.sort((a, b) => b.price - a.price);
    if (sort.value === 'name') shown.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
    root.innerHTML = shown.length ? shown.map(card).join('') : '<p class="empty-cart">За цими параметрами товарів не знайдено.</p>';
    document.getElementById('resultCount').textContent = `${shown.length} товарів`;
    bind(root);
  };
  buttons.forEach((button) => button.onclick = () => {
    category = button.dataset.category;
    const url = new URL(location);
    if (category === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', category);
    history.replaceState({}, '', url);
    draw();
  });
  [search, brand, price, stock, sort].forEach((field) => field.addEventListener(field === stock || field === brand || field === sort ? 'change' : 'input', draw));
  document.getElementById('clearCatalogFilters').onclick = () => {
    search.value = ''; brand.value = ''; price.value = ''; stock.checked = false; sort.value = 'popular'; draw();
  };
  draw();
}
function product() { const root = document.getElementById('productView'); if (!root) return; const item = get(new URLSearchParams(location.search).get('id')) || products[0]; if (!item) return; 
document.title = `${item.name} | TECHNOROOM`;

let metaDescription =
  document.querySelector('meta[name="description"]');

if (!metaDescription) {
  metaDescription = document.createElement('meta');
  metaDescription.name = 'description';
  document.head.appendChild(metaDescription);
}

metaDescription.content =
  (item.description || `${item.name} купити в TECHNOROOM`)
    .substring(0, 160);

let canonical =
  document.querySelector('link[rel="canonical"]');

if (!canonical) {
  canonical = document.createElement('link');
  canonical.rel = 'canonical';
  document.head.appendChild(canonical);
}

canonical.href = window.location.href;

const oldSchema =
  document.getElementById('product-schema');

if (oldSchema) {
  oldSchema.remove();
}

const schema = document.createElement('script');
schema.type = 'application/ld+json';
schema.id = 'product-schema';

schema.textContent = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Product",
  "name": item.name,
  "description": item.description || "",
  "brand": {
    "@type": "Brand",
    "name": item.brand || "TECHNOROOM"
  },
  "offers": {
    "@type": "Offer",
    "price": item.price,
    "priceCurrency": "UAH",
    "availability": item.stock
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock"
  }
});

document.head.appendChild(schema); const specs = item.specifications ? Object.entries(item.specifications).map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('') : `<div><dt>Характеристики</dt><dd>${item.details || 'Уточнюйте у менеджера'}</dd></div>`; root.innerHTML = `<div class="product-detail-visual ${item.type}"><div class="product-image ${item.type}">${image(item)}</div></div><div class="product-detail-copy"><p class="eyebrow">${item.brand || ''}</p><h1>${item.name}</h1><p class="product-description">${item.description || ''}</p><p class="availability">${item.stock ? 'В наявності' : 'Немає в наявності'}</p><strong class="detail-price">${money(item.price)}</strong><div class="detail-actions"><button class="button primary" data-add="${item.id}" ${item.stock ? '' : 'disabled'}>${item.stock ? 'Додати в кошик' : 'Немає в наявності'}</button><a class="button outline" href="catalog.html">До каталогу</a></div><dl class="specs"><div><dt>Виробник</dt><dd>${item.brand || '—'}</dd></div>${specs}</dl></div>`; bind(root); }
function checkout() { const form = document.getElementById('checkoutForm'); if (!form) return; const items = cart.map(get).filter(Boolean), total = items.reduce((sum, item) => sum + item.price, 0), root = document.getElementById('checkoutSummary'); root.innerHTML = items.length ? items.map((item) => `<div><span>${item.name}</span><strong>${money(item.price)}</strong></div>`).join('') + `<div class="checkout-total"><span>Разом</span><strong>${money(total)}</strong></div>` : '<p>Ваш кошик порожній. <a href="catalog.html">Перейти до каталогу</a></p>'; form.onsubmit = async (event) => { event.preventDefault(); if (items.some((item) => !item.stock)) return alert('У кошику є недоступний товар.'); const data = Object.fromEntries(new FormData(form)), button = form.querySelector('button'); button.disabled = true; try { const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { name: data.name, phone: data.phone, email: data.email }, delivery: { city: data.city, address: data.address, comment: data.comment }, items: cart.map((productId) => ({ productId, quantity: 1 })) }) }); if (!response.ok) throw new Error(); localStorage.removeItem('technoroom-cart'); cart.length = 0; renderCart(); document.getElementById('checkoutNotice').hidden = false; button.textContent = 'Замовлення прийнято'; } catch { button.disabled = false; alert('Не вдалося створити замовлення. Спробуйте ще раз.'); } }; }
function mount() { renderCart(); home(); catalog(); product(); checkout(); const drawer = document.getElementById('cartDrawer'), overlay = document.getElementById('overlay'), close = () => { drawer?.classList.remove('open'); if (overlay) overlay.hidden = true; }; document.getElementById('cartButton')?.addEventListener('click', () => { drawer?.classList.add('open'); if (overlay) overlay.hidden = false; }); document.getElementById('closeCart')?.addEventListener('click', close); overlay?.addEventListener('click', close); document.getElementById('checkoutButton')?.addEventListener('click', () => location.href = 'checkout.html'); }
async function loadProducts() { try { const { data, error } = await supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false }); if (!error && data?.length) products = data.map((item) => ({ id: item.id, name: item.name, description: item.description, price: Number(item.price), type: item.category, brand: item.brand, specifications: item.specifications, stock: item.in_stock && Number(item.stock_quantity || 0) > 0, image: item.image_path })); } catch (error) { console.warn('Не вдалося завантажити каталог із Supabase', error); } finally { mount(); } }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadProducts, { once: true });
else loadProducts();


// Живе меню підкатегорій: дані беруться з дерева категорій у Supabase.
const subcategoryMenuStyle = document.createElement('style');
subcategoryMenuStyle.textContent = `
  .category-constellation { margin: 20px 0 8px; padding: 14px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .category-constellation > span { display: block; margin-bottom: 9px; color: var(--muted); font: 800 10px Manrope; letter-spacing: .08em; text-transform: uppercase; }
  .category-constellation button { display:flex; align-items:center; justify-content:space-between; width:100%; padding:8px 0 8px 14px; border:0; border-left:2px solid #d8ff37; background:transparent; color:var(--ink); text-align:left; font:700 12px Manrope; cursor:pointer; }
  .category-constellation button:hover { background:#eff3eb; }
  .category-constellation button b { color:#6d8c00; font-size:10px; }
  .category-constellation .category-parent { color:var(--muted); font:600 10px Manrope; }
`;
document.head.append(subcategoryMenuStyle);

async function mountSubcategoryMenu() {
  const filters = document.querySelector('.filters');
  const anchor = filters?.querySelector('.catalog-refine');
  if (!filters || !anchor || filters.querySelector('.category-constellation')) return;

  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('id,name,slug,parent_id')
      .eq('is_active', true)
      .order('name');
    if (error || !categories?.length) return;

    const byId = new Map(categories.map((category) => [category.id, category]));
    const nested = categories.filter((category) => category.parent_id && byId.has(category.parent_id));
    if (!nested.length) return;

    const menu = document.createElement('div');
    menu.className = 'category-constellation';
    menu.innerHTML = `<span>Колекції</span>${nested.map((category) => {
      const parent = byId.get(category.parent_id);
      const count = products.filter((product) => product.type === category.slug).length;
      return `<button type="button" data-subcategory="${category.slug}"><i>↳</i><span>${category.name}<small class="category-parent"> · ${parent.name}</small></span><b>${count || '0'}</b></button>`;
    }).join('')}`;
    anchor.before(menu);
  } catch (error) {
    console.warn('Не вдалося завантажити підкатегорії', error);
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-subcategory]');
  if (!button) return;
  const url = new URL(location.href);
  url.searchParams.set('category', button.dataset.subcategory);
  location.href = url.toString();
});

mountSubcategoryMenu();


// Вкладені підкатегорії показуються безпосередньо під своєю батьківською категорією.
const nestedCategoryStyle = document.createElement('style');
nestedCategoryStyle.textContent = `
  .category-constellation { display: none !important; }
  .category-nest { margin: -3px 0 8px 14px; padding: 4px 0 4px 12px; border-left: 1px solid #d8ff37; }
  .category-nest button { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 7px 0; border: 0; background: transparent; color: var(--muted); text-align: left; font: 700 11px Manrope; cursor: pointer; }
  .category-nest button:hover { color: var(--ink); }
  .category-nest button span:first-child { color: #799900; margin-right: 6px; }
  .category-nest button b { color: #6d8c00; font-size: 10px; }
`;
document.head.append(nestedCategoryStyle);

async function mountNestedSubcategoryMenu() {
  const filters = document.querySelector('.filters');
  if (!filters || filters.querySelector('.category-nest')) return;

  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('id,name,slug,parent_id')
      .eq('is_active', true)
      .order('name');
    if (error || !categories?.length) return;

    const byId = new Map(categories.map((category) => [category.id, category]));
    const groups = new Map();
    categories.filter((category) => category.parent_id && byId.has(category.parent_id)).forEach((category) => {
      const parent = byId.get(category.parent_id);
      const items = groups.get(parent.id) || { parent, children: [] };
      items.children.push(category);
      groups.set(parent.id, items);
    });

    groups.forEach(({ parent, children }) => {
      const parentButton = filters.querySelector(`[data-category="${CSS.escape(parent.slug)}"]`);
      if (!parentButton) return;
      const nest = document.createElement('div');
      nest.className = 'category-nest';
      children.sort((a, b) => a.name.localeCompare(b.name, 'uk')).forEach((category) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.subcategory = category.slug;
        const count = products.filter((product) => product.type === category.slug).length;
        button.innerHTML = `<span>↳</span><span>${category.name}</span><b>${count || '0'}</b>`;
        nest.append(button);
      });
      parentButton.insertAdjacentElement('afterend', nest);
    });
  } catch (error) {
    console.warn('Не вдалося завантажити вкладені категорії', error);
  }
}

if (document.readyState === 'complete') mountNestedSubcategoryMenu();
else window.addEventListener('load', mountNestedSubcategoryMenu, { once: true });


// Візуальна ієрархія категорій: більший шрифт та помітніший відступ вкладень.
const categoryTypographyStyle = document.createElement('style');
categoryTypographyStyle.textContent = `
  .filters > button[data-category] { font-size: 14px; line-height: 1.35; padding: 11px 0; }
  .category-nest { margin: -2px 0 12px 22px; padding: 6px 0 6px 18px; }
  .category-nest button { font-size: 13px; line-height: 1.4; padding: 9px 0; }
  .category-nest button span:first-child { margin-right: 9px; font-size: 14px; }
  .category-nest button b { font-size: 11px; }
`;
document.head.append(categoryTypographyStyle);


/* Статус «Під замовлення»: товар можна оформити без складського залишку. */
function availability(product) {
  if (product.availabilityStatus === 'under_order') return { label: 'Під замовлення', button: 'Замовити', orderable: true };
  if (product.stock) return { label: 'В наявності', button: 'У кошик', orderable: true };
  return { label: 'Немає в наявності', button: 'Немає', orderable: false };
}
add = (id) => { const item = get(id); if (!item || !availability(item).orderable) return; cart.push(Number(id)); save(); renderCart(); };
renderCart = () => {
  const count = document.getElementById('cartCount'); if (count) count.textContent = cart.length;
  const root = document.getElementById('cartItems'), total = document.getElementById('cartTotal'), checkoutButton = document.getElementById('checkoutButton');
  if (!root) return;
  const items = cart.map((id, index) => ({ product: get(id), index })).filter((item) => item.product);
  root.innerHTML = items.length ? items.map(({ product, index }) => `<div class="cart-item"><b>${product.name}</b><strong>${money(product.price)}</strong><span>${availability(product).label}</span><button class="remove" data-remove="${index}">Прибрати</button></div>`).join('') : '<p class="empty-cart">Кошик поки порожній.</p>';
  if (total) total.textContent = money(items.reduce((sum, item) => sum + item.product.price, 0));
  if (checkoutButton) checkoutButton.disabled = !items.length;
  root.querySelectorAll('[data-remove]').forEach((button) => button.onclick = () => { cart.splice(Number(button.dataset.remove), 1); save(); renderCart(); });
};
card = (product) => { const state = availability(product); return `<article class="product"><div class="product-image ${product.type}">${image(product)}</div><h3><a href="product.html?id=${product.id}">${product.name}</a></h3><p class="availability">${state.label}</p><p>${product.description || ''}</p><div class="product-footer"><strong class="price">${money(product.price)}</strong><button class="add-button" data-add="${product.id}" ${state.orderable ? '' : 'disabled'}>${state.button}</button></div></article>`; };
product = () => {
  const root = document.getElementById('productView'); if (!root) return;
  const item = get(new URLSearchParams(location.search).get('id')) || products[0]; if (!item) return;
  const state = availability(item);
  const specs = item.specifications ? Object.entries(item.specifications).map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('') : `<div><dt>Характеристики</dt><dd>${item.details || 'Уточнюйте у менеджера'}</dd></div>`;
  root.innerHTML = `<div class="product-detail-visual ${item.type}"><div class="product-image ${item.type}">${image(item)}</div></div><div class="product-detail-copy"><p class="eyebrow">${item.brand || ''}</p><h1>${item.name}</h1><p class="product-description">${item.description || ''}</p><p class="availability">${state.label}</p><strong class="detail-price">${money(item.price)}</strong><div class="detail-actions"><button class="button primary" data-add="${item.id}" ${state.orderable ? '' : 'disabled'}>${state.orderable ? (item.availabilityStatus === 'under_order' ? 'Замовити' : 'Додати в кошик') : 'Немає в наявності'}</button><a class="button outline" href="catalog.html">До каталогу</a></div><dl class="specs"><div><dt>Виробник</dt><dd>${item.brand || '—'}</dd></div>${specs}</dl></div>`;
  bind(root);
};
checkout = () => {
  const form = document.getElementById('checkoutForm'); if (!form) return;
  const items = cart.map(get).filter(Boolean), total = items.reduce((sum, item) => sum + item.price, 0), root = document.getElementById('checkoutSummary');
  root.innerHTML = items.length ? items.map((item) => `<div><span>${item.name}</span><strong>${money(item.price)}</strong></div>`).join('') + `<div class="checkout-total"><span>Разом</span><strong>${money(total)}</strong></div>` : '<p>Ваш кошик порожній. <a href="catalog.html">Перейти до каталогу</a></p>';
  form.onsubmit = async (event) => { event.preventDefault(); if (items.some((item) => !availability(item).orderable)) return alert('У кошику є недоступний товар.'); const data = Object.fromEntries(new FormData(form)), button = form.querySelector('button'); button.disabled = true; try { const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { name: data.name, phone: data.phone, email: data.email }, delivery: { city: data.city, address: data.address, comment: data.comment }, items: cart.map((productId) => ({ productId, quantity: 1 })) }) }); if (!response.ok) throw new Error(); localStorage.removeItem('technoroom-cart'); cart.length = 0; renderCart(); document.getElementById('checkoutNotice').hidden = false; button.textContent = 'Замовлення прийнято'; } catch { button.disabled = false; alert('Не вдалося створити замовлення. Спробуйте ще раз.'); } };
};
async function refreshAvailabilityStatuses() {
  const { data, error } = await supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false });
  if (error || !data?.length) return;
  products = data.map((item) => ({ id: item.id, name: item.name, description: item.description, price: Number(item.price), type: item.category, brand: item.brand, specifications: item.specifications, availabilityStatus: item.availability_status || ((item.in_stock && Number(item.stock_quantity || 0) > 0) ? 'in_stock' : 'out_of_stock'), stock: item.in_stock && Number(item.stock_quantity || 0) > 0, image: item.image_path }));
  mount();
}
window.addEventListener('load', refreshAvailabilityStatuses, { once: true });


// Категорії визначаються за прив’язкою товару, а не за словами в описі.
categoryMatch = function (product, category) {
  const categoryTree = { projector: ['projector', 'laser-proj'] };
  return (categoryTree[category] || [category]).includes(product.type);
};


/* Галерея зображень у картці товару. */
const productGalleryStyle = document.createElement('style');
productGalleryStyle.textContent =   '.product-gallery-thumbs{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.product-gallery-thumb{width:76px;height:64px;padding:3px;border:1px solid var(--line);background:#fff;cursor:pointer}.product-gallery-thumb.is-active{outline:2px solid var(--acid);outline-offset:2px}.product-gallery-thumb img{display:block;width:100%;height:100%;object-fit:contain}';
document.head.append(productGalleryStyle);

let galleryByProductId = new Map();
const galleryEntriesFor = (item) => {
  const row = galleryByProductId.get(Number(item.id));
  const primary = row?.image_path || item.image;
  const extra = Array.isArray(row?.image_paths) ? row.image_paths : [];
  return [...new Set([primary, ...extra].filter(Boolean))];
};
const galleryImageUrl = (item, path) => {
  if (!path) return '';
  if (path === item.image) return imageUrl(item);
  return String(path).startsWith('http')
    ? path
    : supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
};

product = function () {
  const root = document.getElementById('productView');
  if (!root) return;
  const id = Number(new URLSearchParams(location.search).get('id'));
  const item = products.find((entry) => entry.id === id);
  if (!item) {
    root.innerHTML = '<p>Товар не знайдено.</p>';
    return;
  }
  const paths = galleryEntriesFor(item);
  const renderProductGallery = (activePath = paths[0]) => {
    const source = galleryImageUrl(item, activePath);
    const thumbs = paths.length > 1
      ? '<div class="product-gallery-thumbs" aria-label="Інші фото товару">' + paths.map((path, index) =>           '<button class="product-gallery-thumb ' + (path === activePath ? 'is-active' : '') + '" type="button" data-gallery-path="' + encodeURIComponent(path) + '" aria-label="Фото ' + (index + 1) + '">' +             '<img src="' + galleryImageUrl(item, path) + '" alt="' + item.name + ' — фото ' + (index + 1) + '" draggable="false">' +           '</button>').join('') + '</div>'
      : '';
    root.innerHTML =       '<div class="product-detail-visual ' + item.type + '"><div class="product-image ' + item.type + '">' + (source ? '<img src="' + source + '" alt="' + item.name + '" draggable="false">' : '') + '</div>' + thumbs + '</div>' +       '<div class="product-detail-copy"><p class="eyebrow">' + item.brand + '</p><h1>' + item.name + '</h1><p class="product-detail-description">' + item.description + '</p><p class="stock ' + (item.inStock ? '' : 'out') + '">' + (item.inStock ? 'В наявності' : 'Під замовлення') + '</p><p class="product-price">' + money(item.price) + '</p><div class="product-actions"><button class="btn btn-primary" data-add="' + item.id + '">Додати в кошик</button><a class="btn btn-outline" href="catalog.html">До каталогу</a></div><dl class="specs">' + Object.entries(item.specs || {}).map(([key, value]) => '<div><dt>' + key + '</dt><dd>' + value + '</dd></div>').join('') + '</dl></div>';
    bind(root);
    root.querySelectorAll('[data-gallery-path]').forEach((button) => {
      button.addEventListener('click', () => renderProductGallery(decodeURIComponent(button.dataset.galleryPath)));
    });
  };
  renderProductGallery();
};

async function hydrateProductGallery() {
  const { data, error } = await supabase.from('products').select('id,image_path,image_paths').eq('is_active', true);
  if (!error && data) {
    galleryByProductId = new Map(data.map((row) => [Number(row.id), row]));
    product();
  }
}
hydrateProductGallery();


/* Сумісна версія галереї з актуальними статусами та характеристиками. */
product = function () {
  const root = document.getElementById('productView');
  if (!root) return;
  const item = get(new URLSearchParams(location.search).get('id')) || products[0];
  if (!item) return;
  const state = availability(item);
  const paths = galleryEntriesFor(item);
  const specs = item.specifications
    ? Object.entries(item.specifications).map(([key, value]) => '<div><dt>' + key + '</dt><dd>' + value + '</dd></div>').join('')
    : '<div><dt>Характеристики</dt><dd>' + (item.details || 'Уточнюйте у менеджера') + '</dd></div>';
  const renderProductGallery = (activePath = paths[0]) => {
    const source = galleryImageUrl(item, activePath);
    const thumbs = paths.length > 1
      ? '<div class="product-gallery-thumbs" aria-label="Інші фото товару">' + paths.map((path, index) => '<button class="product-gallery-thumb ' + (path === activePath ? 'is-active' : '') + '" type="button" data-gallery-path="' + encodeURIComponent(path) + '" aria-label="Фото ' + (index + 1) + '"><img src="' + galleryImageUrl(item, path) + '" alt="' + item.name + ' — фото ' + (index + 1) + '" draggable="false"></button>').join('') + '</div>'
      : '';
    root.innerHTML = '<div class="product-detail-visual ' + item.type + '"><div class="product-image ' + item.type + '">' + (source ? '<img src="' + source + '" alt="' + item.name + '" draggable="false">' : '') + '</div>' + thumbs + '</div><div class="product-detail-copy"><p class="eyebrow">' + (item.brand || '') + '</p><h1>' + item.name + '</h1><p class="product-description">' + (item.description || '') + '</p><p class="availability">' + state.label + '</p><strong class="detail-price">' + money(item.price) + '</strong><div class="detail-actions"><button class="button primary" data-add="' + item.id + '" ' + (state.orderable ? '' : 'disabled') + '>' + (state.orderable ? (item.availabilityStatus === 'under_order' ? 'Замовити' : 'Додати в кошик') : 'Немає в наявності') + '</button><a class="button outline" href="catalog.html">До каталогу</a></div><dl class="specs"><div><dt>Виробник</dt><dd>' + (item.brand || '—') + '</dd></div>' + specs + '</dl></div>';
    bind(root);
    root.querySelectorAll('[data-gallery-path]').forEach((button) => button.addEventListener('click', () => renderProductGallery(decodeURIComponent(button.dataset.galleryPath))));
  };
  renderProductGallery();
};


// Product gallery lightbox navigation
const productGalleryLightboxStyle = document.createElement('style');
productGalleryLightboxStyle.textContent = '.image-lightbox .lightbox-close{top:20px;right:24px}.image-lightbox .lightbox-prev,.image-lightbox .lightbox-next{top:50%;right:auto;transform:translateY(-50%);width:52px;height:52px;font-size:32px}.image-lightbox .lightbox-prev{left:24px}.image-lightbox .lightbox-next{right:24px}.image-lightbox .lightbox-counter{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);margin:0;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.92);color:#0b2723;font:600 14px/1.2 Arial,sans-serif}.image-lightbox .lightbox-prev[disabled],.image-lightbox .lightbox-next[disabled]{opacity:.38;cursor:default}@media(max-width:640px){.image-lightbox{padding:16px}.image-lightbox .lightbox-prev{left:10px}.image-lightbox .lightbox-next{right:10px}.image-lightbox .lightbox-prev,.image-lightbox .lightbox-next{width:44px;height:44px}}';
document.head.append(productGalleryLightboxStyle);

const productGalleryLightbox = { sources: [], index: 0, alt: '' };
lightbox.innerHTML = '<button type="button" class="lightbox-close" aria-label="Закрити фото">×</button><button type="button" class="lightbox-prev" aria-label="Попереднє фото">←</button><img alt="Збільшене фото товару"><button type="button" class="lightbox-next" aria-label="Наступне фото">→</button><p class="lightbox-counter" aria-live="polite"></p>';
const renderProductGalleryLightbox = () => {
  const image = lightbox.querySelector('img');
  const total = productGalleryLightbox.sources.length;
  if (!total) return;
  productGalleryLightbox.index = (productGalleryLightbox.index + total) % total;
  image.src = productGalleryLightbox.sources[productGalleryLightbox.index];
  image.alt = productGalleryLightbox.alt || 'Збільшене фото товару';
  lightbox.querySelector('.lightbox-counter').textContent = total > 1 ? String(productGalleryLightbox.index + 1) + ' / ' + String(total) : '';
  lightbox.querySelector('.lightbox-prev').disabled = total < 2;
  lightbox.querySelector('.lightbox-next').disabled = total < 2;
};
const openProductGalleryLightbox = (sources, index, alt) => {
  productGalleryLightbox.sources = sources.filter(Boolean);
  productGalleryLightbox.index = Math.max(0, index || 0);
  productGalleryLightbox.alt = alt;
  renderProductGalleryLightbox();
  lightbox.hidden = false;
};
const closeProductGalleryLightbox = () => {
  lightbox.hidden = true;
  lightbox.querySelector('img').removeAttribute('src');
};
const changeProductGalleryLightbox = (step) => {
  if (productGalleryLightbox.sources.length < 2) return;
  productGalleryLightbox.index += step;
  renderProductGalleryLightbox();
};
lightbox.addEventListener('click', (event) => {
  const control = event.target.closest('.lightbox-close,.lightbox-prev,.lightbox-next');
  if (!control) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (control.classList.contains('lightbox-close')) closeProductGalleryLightbox();
  if (control.classList.contains('lightbox-prev')) changeProductGalleryLightbox(-1);
  if (control.classList.contains('lightbox-next')) changeProductGalleryLightbox(1);
}, true);
document.addEventListener('keydown', (event) => {
  if (lightbox.hidden) return;
  if (event.key === 'ArrowLeft') changeProductGalleryLightbox(-1);
  if (event.key === 'ArrowRight') changeProductGalleryLightbox(1);
});
document.addEventListener('click', (event) => {
  const image = event.target.closest('.product-detail-visual .product-image img');
  if (!image) return;
  const product = get(new URLSearchParams(location.search).get('id'));
  const paths = product ? galleryEntriesFor(product) : [];
  const sources = paths.map((path) => galleryImageUrl(product, path));
  if (!sources.length) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const selected = sources.findIndex((source) => source === (image.currentSrc || image.src));
  openProductGalleryLightbox(sources, selected < 0 ? 0 : selected, product.name);
}, true);


// Добірки товарів: популярне та нещодавно переглянуте у цьому браузері.
const storefrontRecommendationStyles = document.createElement('style');
storefrontRecommendationStyles.textContent = '.storefront-recommendations{max-width:1240px;margin:72px auto 0;padding:0 24px 72px}.storefront-recommendation-section{border-top:1px solid #d8ddd7;padding-top:28px;margin-top:48px}.storefront-recommendation-heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:22px}.storefront-recommendation-heading h2{margin:0;font-size:clamp(28px,3vw,44px);line-height:1;color:#102b28}.storefront-recommendation-heading p{margin:0;color:#647470;max-width:420px;text-align:right}.storefront-recommendation-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.storefront-recommendation-card{display:flex;flex-direction:column;min-width:0;background:#fff;border:1px solid #e1e5df;transition:transform .2s ease,box-shadow .2s ease}.storefront-recommendation-card:hover{transform:translateY(-4px);box-shadow:0 12px 28px rgba(16,43,40,.12)}.storefront-recommendation-image{display:grid;place-items:center;height:210px;padding:18px;background:#f1f3ed;overflow:hidden}.storefront-recommendation-image img{width:100%;height:100%;object-fit:contain;user-select:none;-webkit-user-drag:none}.storefront-recommendation-image span{color:#71807b;font-size:14px;text-align:center}.storefront-recommendation-content{padding:18px}.storefront-recommendation-brand{margin:0 0 8px;color:#72817d;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.storefront-recommendation-name{display:inline-block;margin:0 0 16px;color:#102b28;font-size:19px;line-height:1.15;font-weight:700;text-decoration:none}.storefront-recommendation-name:hover{text-decoration:underline}.storefront-recommendation-meta{display:flex;align-items:center;justify-content:space-between;gap:10px}.storefront-recommendation-price{color:#102b28;font-size:20px;font-weight:700}.storefront-recommendation-stock{color:#718e16;font-size:13px;font-weight:700}.storefront-recommendation-empty{margin:0;padding:22px;background:#f1f3ed;color:#61716c}@media(max-width:900px){.storefront-recommendation-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.storefront-recommendations{padding:0 16px 48px;margin-top:48px}.storefront-recommendation-heading{align-items:start;flex-direction:column}.storefront-recommendation-heading p{text-align:left}.storefront-recommendation-grid{grid-template-columns:1fr}.storefront-recommendation-image{height:230px}}';
document.head.append(storefrontRecommendationStyles);

const recommendationEscape = value => String(value ?? '').replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' })[char]);
const recentlyViewedKey = 'technoroom-recently-viewed';
const readRecentlyViewed = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(recentlyViewedKey) || '[]');
    return Array.isArray(saved) ? saved.map(Number).filter(Number.isFinite) : [];
  } catch (_) {
    return [];
  }
};
const saveRecentlyViewed = ids => {
  try { localStorage.setItem(recentlyViewedKey, JSON.stringify(ids.slice(0, 8))); } catch (_) {}
};
const currentStoreProductId = () => Number(new URLSearchParams(location.search).get('id')) || null;
const rememberCurrentProduct = () => {
  const id = currentStoreProductId();
  if (!id || !get(id)) return false;
  saveRecentlyViewed([id, ...readRecentlyViewed().filter(savedId => savedId !== id)]);
  return true;
};
const recommendationImage = product => {
  const source = imageUrl(product);
  return source
    ? '<img src="' + source + '" alt="' + recommendationEscape(product.name) + '" loading="lazy" draggable="false">'
    : '<span>Фото товару<br>з’явиться незабаром</span>';
};
const recommendationCard = product => {
  const id = Number(product.id);
  const name = recommendationEscape(product.name);
  const brand = recommendationEscape(product.brand || 'TECHNOROOM');
  const availability = product.stock === false ? 'Немає в наявності' : 'В наявності';
  return '<article class="storefront-recommendation-card">'
    + '<a class="storefront-recommendation-image" href="product.html?id=' + id + '" aria-label="Відкрити ' + name + '">' + recommendationImage(product) + '</a>'
    + '<div class="storefront-recommendation-content">'
    + '<p class="storefront-recommendation-brand">' + brand + '</p>'
    + '<a class="storefront-recommendation-name" href="product.html?id=' + id + '">' + name + '</a>'
    + '<div class="storefront-recommendation-meta"><span class="storefront-recommendation-price">' + money(product.price) + '</span><span class="storefront-recommendation-stock">' + availability + '</span></div>'
    + '</div></article>';
};
const renderStorefrontRecommendations = () => {
  const main = document.querySelector('main');
  if (!main || !products.length) return;
  let root = document.querySelector('#storefront-recommendations');
  if (!root) {
    root = document.createElement('section');
    root.id = 'storefront-recommendations';
    root.className = 'storefront-recommendations';
    main.append(root);
  }
  const currentId = currentStoreProductId();
  const available = products.filter(product => product.stock !== false);
  const popular = available.filter(product => Number(product.id) !== currentId).slice(0, 4);
  const recent = readRecentlyViewed().filter(id => id !== currentId).map(id => get(id)).filter(Boolean).slice(0, 4);
  root.innerHTML = '<section class="storefront-recommendation-section">'
    + '<div class="storefront-recommendation-heading"><h2>Популярні товари</h2><p>Добірка техніки, яку найчастіше обирають для сучасного дому та бізнесу.</p></div>'
    + '<div class="storefront-recommendation-grid">' + (popular.length ? popular.map(recommendationCard).join('') : '<p class="storefront-recommendation-empty">Товари з’являться після оновлення каталогу.</p>') + '</div></section>'
    + '<section class="storefront-recommendation-section">'
    + '<div class="storefront-recommendation-heading"><h2>Нещодавно переглянуті</h2><p>Зберігаємо цю добірку лише у вашому браузері — щоб швидко повернутися до товарів.</p></div>'
    + (recent.length ? '<div class="storefront-recommendation-grid">' + recent.map(recommendationCard).join('') + '</div>' : '<p class="storefront-recommendation-empty">Перегляньте будь-який товар — він одразу з’явиться у цій добірці.</p>')
    + '</section>';
};

[0, 700, 1800].forEach(delay => setTimeout(() => {
  rememberCurrentProduct();
  renderStorefrontRecommendations();
}, delay));
