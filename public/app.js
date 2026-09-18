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
function product() { const root = document.getElementById('productView'); if (!root) return; const item = get(new URLSearchParams(location.search).get('id')) || products[0]; if (!item) return; const specs = item.specifications ? Object.entries(item.specifications).map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('') : `<div><dt>Характеристики</dt><dd>${item.details || 'Уточнюйте у менеджера'}</dd></div>`; root.innerHTML = `<div class="product-detail-visual ${item.type}"><div class="product-image ${item.type}">${image(item)}</div></div><div class="product-detail-copy"><p class="eyebrow">${item.brand || ''}</p><h1>${item.name}</h1><p class="product-description">${item.description || ''}</p><p class="availability">${item.stock ? 'В наявності' : 'Немає в наявності'}</p><strong class="detail-price">${money(item.price)}</strong><div class="detail-actions"><button class="button primary" data-add="${item.id}" ${item.stock ? '' : 'disabled'}>${item.stock ? 'Додати в кошик' : 'Немає в наявності'}</button><a class="button outline" href="catalog.html">До каталогу</a></div><dl class="specs"><div><dt>Виробник</dt><dd>${item.brand || '—'}</dd></div>${specs}</dl></div>`; bind(root); }
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
