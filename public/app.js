import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(window.TECHNOROOM_SUPABASE.url, window.TECHNOROOM_SUPABASE.publishableKey);
const catalogImageStyles = document.createElement('style');
catalogImageStyles.textContent = '.product-image{overflow:hidden;cursor:zoom-in}.product-image img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2;-webkit-user-drag:none;user-select:none}.product-image:has(img)::before{display:none}.catalog-grid .product,.product-grid .product{display:flex;flex-direction:column;min-width:0}.catalog-grid .product-image,.product-grid .product-image{position:static!important;inset:auto!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;flex:0 0 195px;width:100%!important;height:195px!important;margin:0 0 16px!important;overflow:hidden}.catalog-grid .product-image img,.product-grid .product-image img{position:static!important;display:block;width:100%!important;height:195px!important;object-fit:contain;transform:none!important}.product-detail-visual{overflow:hidden}.product-detail-visual .product-image{position:static!important;inset:auto!important;width:100%!important;height:100%!important;min-height:480px;margin:0!important;display:flex!important;align-items:center;justify-content:center}.product-detail-visual .product-image img{position:static!important;display:block;width:100%!important;height:100%!important;object-fit:contain;transform:none!important}.catalog-grid .product h3,.catalog-grid .product p,.product-grid .product h3,.product-grid .product p,.product-detail-copy h1,.product-detail-copy p,.product-detail-copy dt,.product-detail-copy dd{user-select:none}.image-lightbox{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:32px;background:rgba(8,24,22,.88)}.image-lightbox[hidden]{display:none!important}.image-lightbox img{max-width:min(100%,1200px);max-height:calc(100vh - 64px);object-fit:contain;background:#fff}.image-lightbox button{position:absolute;top:20px;right:24px;width:42px;height:42px;border:0;border-radius:50%;font-size:28px;line-height:1;background:#d8ff37;color:#0b2723;cursor:pointer}';
document.head.append(catalogImageStyles);

const saleStyle=document.createElement('style');saleStyle.textContent='.product{position:relative}.sale-badge{position:absolute;z-index:3;top:10px;left:10px;background:#e52629;color:#fff;border-radius:6px;padding:6px 9px;font-weight:800;font-size:12px}.old-price{display:block;color:#8996a8;font-size:12px;margin-bottom:2px}.product-footer .price{display:block;color:#e52629}';document.head.append(saleStyle);
const fallbackProducts = [
  { id: 1, name: 'Acer H6830BD', description: '4K UHD проєктор для домашнього кінотеатру', price: 40449, type: 'projector', brand: 'Acer', details: '4000 лм · 3840 × 2160', stock: true },
  { id: 2, name: 'Epson EH-TW9400', description: 'Кінотеатральний Full HD проєктор', price: 150505, type: 'projector', brand: 'Epson', details: '2600 лм · 1920 × 1080', stock: true },
  { id: 3, name: 'KEF Q750', description: 'Підлогова акустична система', price: 47999, type: 'audio', brand: 'KEF', details: '150 Вт · чорний', stock: true },
  { id: 4, name: 'Samsung The Frame 65', description: 'QLED телевізор, 65 дюймів', price: 52999, type: 'tv', brand: 'Samsung', details: '65 дюймів · 4K UHD', stock: true },
];
let products = fallbackProducts;
let activePromotions=[]; let promotionProductIds=new Map();
const cart = JSON.parse(localStorage.getItem('technoroom-cart') || '[]');
const money = (value) => `${new Intl.NumberFormat('uk-UA').format(value)} ₴`;
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const get = (id) => products.find((product) => product.id === Number(id));
const save = () => localStorage.setItem('technoroom-cart', JSON.stringify(cart));
const imageUrl = (product) => product.image?.startsWith('http') ? `/api/product-image?id=${product.id}` : product.image ? supabase.storage.from('product-images').getPublicUrl(product.image).data.publicUrl : '';
const image = (product) => {
  if (product.image) {
    return `${imageUrl(product)}`;
  }

  return `
    <div class="product-placeholder">
      <span>Фото відсутнє</span>
    </div>
  `;
};
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
function promotionFor(product){return activePromotions.find(p=>p.target_type==='all'||(p.target_type==='category'&&p.target_value===product.type)||(p.target_type==='brand'&&Number(p.target_value)===Number(product.brand_id))||(p.target_type==='products'&&promotionProductIds.get(Number(p.id))?.has(Number(product.id))))}
function salePrice(product){const p=promotionFor(product);if(!p)return Number(product.price);return Math.max(0,p.discount_type==='percent'?Number(product.price)*(1-Number(p.discount_value)/100):Number(product.price)-Number(p.discount_value))}
function card(product) { const promo=promotionFor(product),price=salePrice(product),badge=promo?'<span class="sale-badge">'+(promo.discount_type==='percent'?'-'+Number(promo.discount_value)+'%':'АКЦІЯ')+'</span>':'',promoName=promo?'<div class="promotion-name">🏷 Акція: <b>'+escapeHtml(promo.name||'Спеціальна пропозиція')+'</b></div>':''; return `<article class="product">${badge}<div class="product-image ${product.type}">${image(product)}</div>${promoName}<h3><a href="product.html?id=${product.id}">${product.name}</a></h3><p class="availability">${product.stock ? 'В наявності' : 'Немає в наявності'}</p><p>${product.description || ''}</p><div class="product-footer"><div>${promo?'<del class="old-price">'+money(product.price)+'</del>':''}<strong class="price">${money(price)}</strong></div><button class="add-button" data-add="${product.id}" ${product.stock ? '' : 'disabled'}>${product.stock ? 'У кошик' : 'Немає'}</button></div></article>`; }
function bind(root = document) { root.querySelectorAll('[data-add]').forEach((button) => button.onclick = () => add(button.dataset.add)); root.querySelectorAll('.product-image img').forEach((image) => image.onclick = () => openLightbox(image.currentSrc || image.src, image.alt)); }
async function home() {
  const root=document.getElementById('productGrid'); if(!root) return;
  let homeProducts=[...products], cats=[];
  try {
    const now=new Date().toISOString();
    const {data:banners,error:bannerError}=await supabase.from('banners').select('*').eq('is_active',true).order('sort_order').order('created_at',{ascending:false});
    if(bannerError) throw bannerError;
    const banner=(banners||[])[0], hero=document.querySelector('.home-hero');
    if(banner&&hero){
      const copy=hero.querySelector('.home-hero-copy');
      if(copy){
        const title=escapeHtml(banner.title||'TECHNOROOM'), subtitle=escapeHtml(banner.subtitle||''), button=escapeHtml(banner.button_text||'Переглянути');
        copy.innerHTML='<small>TECHNOROOM</small><h1>'+title+'</h1>'+(subtitle?'<p>'+subtitle+'</p>':'')+'<a href="'+escapeHtml(banner.link_url||'catalog.html')+'">'+button+' →</a>';
      }
      if(banner.image_url){hero.style.backgroundImage='linear-gradient(90deg,rgba(8,27,56,.96),rgba(8,27,56,.60)),url("'+String(banner.image_url).replace(/["\\]/g,'')+'")';hero.style.backgroundSize='cover';hero.style.backgroundPosition='center';const art=hero.querySelector('.home-projector-art');if(art)art.style.display='none'}
    }
    const {data:promos}=await supabase.from('promotions').select('*').eq('is_active',true);
    const active=(promos||[]).filter(p=>(!p.starts_at||p.starts_at<=now)&&(!p.ends_at||p.ends_at>=now));
    if(active.length){const sale=document.querySelector('.home-tabs a[href*="promo=sale"]');if(sale)sale.textContent='Акції ('+active.length+')'}
  } catch(e){console.warn('Промоблоки головної',e)}

  const saleSection=document.getElementById('homeSaleSection'),saleGrid=document.getElementById('homeSaleGrid');
  if(saleSection&&saleGrid){const saleProducts=homeProducts.filter(p=>promotionFor(p));saleSection.hidden=false;if(saleProducts.length){saleGrid.innerHTML=saleProducts.slice(0,6).map(card).join('');bind(saleGrid)}else{saleGrid.innerHTML='<div class="home-sale-empty">Акційні товари з’являться тут після активації акції.</div>'}}
  const cards=document.getElementById('homeCategoryCards');
  try {
    const res=await supabase.from('categories').select('id,name,slug,parent_id,sort_order').eq('is_active',true).order('sort_order');
    cats=res.data||[];
    if(cats.length){
      const ids=new Set(cats.map(c=>c.id)), roots=cats.filter(c=>!c.parent_id||!ids.has(c.parent_id));
      if(cards) cards.innerHTML=roots.slice(0,8).map(c=>`<a href="catalog.html?category=${encodeURIComponent(c.slug)}"><div class="home-cat-visual">▣</div><b>${escapeHtml(c.name)}</b><span>Переглянути →</span></a>`).join('');
      const mega=document.getElementById('homeCatalogMega'), rootsEl=document.getElementById('homeMegaRoots'), childrenEl=document.getElementById('homeMegaChildren'), toggle=document.getElementById('homeCatalogToggle');
      if(mega&&rootsEl&&childrenEl&&toggle){
        const show=r=>{rootsEl.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.slug===r.slug)); const kids=cats.filter(c=>c.parent_id===r.id); childrenEl.innerHTML=`<div class="mega-title"><h2>${escapeHtml(r.name)}</h2><a href="catalog.html?category=${encodeURIComponent(r.slug)}">Усі товари →</a></div><div class="mega-grid">${kids.map(c=>`<a href="catalog.html?category=${encodeURIComponent(c.slug)}"><strong>${escapeHtml(c.name)}</strong><span>${homeProducts.filter(p=>p.type===c.slug).length} товарів</span></a>`).join('')}</div>`;};
        rootsEl.innerHTML=roots.map(r=>`<button type="button" data-slug="${r.slug}"><span>${escapeHtml(r.name)}</span><b>›</b></button>`).join('');
        rootsEl.querySelectorAll('button').forEach(b=>b.onmouseenter=b.onclick=()=>show(roots.find(r=>r.slug===b.dataset.slug)));
        if(roots[0]) show(roots[0]);
        let timer; const open=()=>{clearTimeout(timer);mega.hidden=false;toggle.setAttribute('aria-expanded','true')}, close=()=>{timer=setTimeout(()=>{mega.hidden=true;toggle.setAttribute('aria-expanded','false')},180)};
        toggle.onclick=()=>mega.hidden?open():(mega.hidden=true,toggle.setAttribute('aria-expanded','false')); toggle.onmouseenter=open; toggle.onmouseleave=close; mega.onmouseenter=()=>clearTimeout(timer); mega.onmouseleave=close;
      }
    }
  } catch(e){ console.warn('Категорії головної',e); }
  const q=document.getElementById('homeSideSearch'), brand=document.getElementById('homeBrand'), minI=document.getElementById('homePriceMin'), maxI=document.getElementById('homePriceMax'), minR=document.getElementById('homePriceMinRange'), maxR=document.getElementById('homePriceMaxRange'), cap=document.getElementById('homePriceCaption'), stock=document.getElementById('homeStockOnly'), sort=document.getElementById('homeSort');
  fillBrandSelect(brand,homeProducts);
  const rangeMax=Math.max(1000,Math.ceil(Math.max(0,...homeProducts.map(p=>Number(p.price)||0))/1000)*1000); [minR,maxR].forEach(x=>x.max=rangeMax); minR.value=0; maxR.value=rangeMax; minI.value=0; maxI.value=rangeMax;
  const sync=(source)=>{let lo=Math.max(0,Math.min(Number(source==='minI'?minI.value:minR.value)||0,rangeMax)), hi=Math.max(0,Math.min(Number(source==='maxI'?maxI.value:maxR.value)||rangeMax,rangeMax)); if(lo>hi){if(source.startsWith('min'))hi=lo;else lo=hi} minI.value=minR.value=lo; maxI.value=maxR.value=hi; cap.textContent=`Від ${lo.toLocaleString('uk-UA')} ₴ до ${hi.toLocaleString('uk-UA')} ₴`;};
  const render=()=>{sync('render'); const term=q.value.trim().toLowerCase(),lo=Number(minI.value||0),hi=Number(maxI.value||rangeMax); let rows=homeProducts.filter(p=>(!term||[p.name,p.brand,p.description].some(v=>String(v||'').toLowerCase().includes(term)))&&(!brand.value||p.brand===brand.value)&&p.price>=lo&&p.price<=hi&&(!stock.checked||p.stock)); if(sort.value==='price-asc')rows.sort((a,b)=>a.price-b.price);if(sort.value==='price-desc')rows.sort((a,b)=>b.price-a.price);if(sort.value==='name')rows.sort((a,b)=>a.name.localeCompare(b.name,'uk'));root.innerHTML=rows.slice(0,6).map(card).join('');bind(root);};
  minR.oninput=()=>{sync('minR');render()};maxR.oninput=()=>{sync('maxR');render()};minI.oninput=()=>{sync('minI');render()};maxI.oninput=()=>{sync('maxI');render()};
  document.querySelectorAll('.home-price-presets button').forEach(b=>b.onclick=()=>{minI.value=minR.value=Number(b.dataset.min||0);maxI.value=maxR.value=Math.min(Number(b.dataset.max||rangeMax),rangeMax);render()});
  document.getElementById('homeApplyFilters').onclick=render; document.getElementById('homeSideSearchGo').onclick=render; q.onkeydown=e=>{if(e.key==='Enter')render()}; [brand,stock,sort].forEach(x=>x.onchange=render);
  document.getElementById('homeClearFilters').onclick=()=>{q.value='';brand.value='';minI.value=minR.value=0;maxI.value=maxR.value=rangeMax;stock.checked=false;sort.value='popular';render()};
  sync('render');render();
  const search=document.getElementById('homeSearch'),go=document.getElementById('homeSearchGo'),run=()=>{const term=search?.value.trim();location.href='catalog.html'+(term?'?search='+encodeURIComponent(term):'')};if(go)go.onclick=run;if(search)search.onkeydown=e=>{if(e.key==='Enter')run()};
}
function categoryMatch(product, category) { return product.type === category || (categoryChildren.get(category) || []).includes(product.type); }
function catalog() {

  const root = document.getElementById('catalogGrid');
  const catalogParams=new URLSearchParams(location.search),saleOnly=catalogParams.get('promo')==='sale',promotionOnly=Number(catalogParams.get('promotion')||0);
  if (!root) return;

  document.title = saleOnly ? 'Акційні товари | TECHNOROOM' : 'Каталог товарів | TECHNOROOM';

  let metaDescription =
    document.querySelector('meta[name="description"]');

if (!metaDescription) {
  metaDescription = document.createElement('meta');
  metaDescription.name = 'description';
  document.head.appendChild(metaDescription);
}

metaDescription.content =
  'Каталог проєкторів, телевізорів, акустики та AV-рішень TECHNOROOM. Актуальні ціни, характеристики та наявність.';

let canonical =
  document.querySelector('link[rel="canonical"]');

if (!canonical) {
  canonical = document.createElement('link');
  canonical.rel = 'canonical';
  document.head.appendChild(canonical);
}

canonical.href =
  location.origin + '/catalog.html';

const oldCatalogSchema =
  document.getElementById('catalog-schema');

if (oldCatalogSchema) {
  oldCatalogSchema.remove();
}

const catalogSchema =
  document.createElement('script');

catalogSchema.type = 'application/ld+json';
catalogSchema.id = 'catalog-schema';

catalogSchema.textContent =
  JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Каталог TECHNOROOM",
    "description":
      "Проєктори, телевізори, акустика та AV-рішення",
    "url": canonical.href
  });

document.head.appendChild(catalogSchema);
  const buttons = document.querySelectorAll('[data-category]');
  const search = document.getElementById('catalogSearch');
  const brand = document.getElementById('brandFilter');
  const price = document.getElementById('priceFilter');
  const priceMin = document.getElementById('priceMin');
  const priceRange = document.getElementById('priceRange');
  const priceMinRange = document.getElementById('priceMinRange');
  const priceCaption = document.getElementById('priceRangeCaption');
  const stock = document.getElementById('stockFilter');
  const sort = document.getElementById('catalogSort');
  let category = new URLSearchParams(location.search).get('category') || 'all';
  const initialParams=new URLSearchParams(location.search); const initialSort=initialParams.get('sort'); if(initialSort==='new') sort.value='newest'; else if(initialSort==='popular'||initialSort==='recommended') sort.value='default';
  fillBrandSelect(brand,products);
  const maxPrice = Math.max(0, ...products.map((product) => Number(product.price) || 0));
  const rangeMax = Math.max(1000, Math.ceil(maxPrice / 1000) * 1000);
  priceRange.max = rangeMax; priceRange.value = rangeMax; priceMinRange.max = rangeMax; priceMinRange.value = 0; price.value = rangeMax;
  const updatePriceCaption = () => { priceCaption.textContent = `Від ${Number(priceMin.value || 0).toLocaleString('uk-UA')} ₴ до ${Number(price.value || rangeMax).toLocaleString('uk-UA')} ₴`; }; updatePriceCaption();
  const draw = () => {
    buttons.forEach((button) => button.classList.toggle('selected', button.dataset.category === category));
    const term = search.value.trim().toLowerCase();
    let shown = products.filter((product) =>
      (!saleOnly || !!promotionFor(product)) &&
      (!promotionOnly || Number(promotionFor(product)?.id)===promotionOnly) &&
      (category === 'all' || categoryMatch(product, category)) &&
      (!term || `${product.name} ${product.brand || ''} ${product.description || ''}`.toLowerCase().includes(term)) &&
      (!brand.value || product.brand === brand.value) &&
      Number(product.price) >= Number(priceMin.value || 0) &&
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
  const syncRanges = (source) => {
    let min = Math.max(0, Math.min(Number(priceMinRange.value), rangeMax));
    let max = Math.max(0, Math.min(Number(priceRange.value), rangeMax));
    if (min > max) { if (source === 'min') max = min; else min = max; }
    priceMinRange.value = min; priceRange.value = max; priceMin.value = min; price.value = max;
    updatePriceCaption(); draw();
  };
  priceMinRange.addEventListener('input', () => syncRanges('min'));
  priceRange.addEventListener('input', () => syncRanges('max'));
  price.addEventListener('input', () => { priceRange.value = Math.min(Math.max(Number(price.value || 0), 0), rangeMax); syncRanges('max'); });
  priceMin.addEventListener('input', () => { priceMinRange.value = Math.min(Math.max(Number(priceMin.value || 0), 0), rangeMax); syncRanges('min'); });
  document.querySelectorAll('.price-presets button').forEach((button) => button.onclick = () => {
    priceMinRange.value = Number(button.dataset.priceMin || 0);
    priceRange.value = Math.min(Number(button.dataset.priceMax || rangeMax), rangeMax);
    syncRanges('min');
  });
  [search, brand, stock, sort].forEach((field) => field.addEventListener(field === stock || field === brand || field === sort ? 'change' : 'input', draw));
  document.getElementById('clearCatalogFilters').onclick = () => {
    search.value = ''; brand.value = ''; priceMin.value = 0; price.value = rangeMax; priceMinRange.value = 0; priceRange.value = rangeMax; updatePriceCaption(); stock.checked = false; sort.value = 'popular'; draw();
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

setMetaProperty('og:title', item.name);

setMetaProperty(
  'og:description',
  item.description || item.name
);

setMetaProperty('og:url', window.location.href);

setMetaProperty('og:type', 'product');

if (imageUrl(item)) {
  setMetaProperty(
    'og:image',
    imageUrl(item)
  );
}const setMetaProperty = (property, content) => {
  let tag = document.querySelector(
    `meta[property="${property}"]`
  );

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }

  tag.content = content;
};

setMetaProperty('og:title', item.name);

setMetaProperty(
  'og:description',
  item.description || item.name
);

setMetaProperty('og:url', window.location.href);

setMetaProperty('og:type', 'product');

if (imageUrl(item)) {
  setMetaProperty(
    'og:image',
    imageUrl(item)
  );
}

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
async function loadProducts() { try {
  const pageSize = 1000;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  if (all.length) products = all.map((item) => ({ id: item.id, name: item.name, description: item.description, price: Number(item.price), type: item.category, brand: item.brand, brand_id:item.brand_id, specifications: item.specifications, stock: item.in_stock && Number(item.stock_quantity || 0) > 0, image: item.image_path }));
  const now=Date.now(),pr=await supabase.from('promotions').select('*').eq('is_active',true);if(pr.error)console.warn('Акції:',pr.error);else{activePromotions=(pr.data||[]).filter(p=>(!p.starts_at||new Date(p.starts_at).getTime()<=now)&&(!p.ends_at||new Date(p.ends_at).getTime()>=now));promotionProductIds.clear();const targeted=activePromotions.filter(p=>p.target_type==='products').map(p=>p.id);if(targeted.length){const pp=await supabase.from('promotion_products').select('promotion_id,product_id').in('promotion_id',targeted);if(pp.error)console.warn('Товари акцій:',pp.error);else(pp.data||[]).forEach(x=>{const key=Number(x.promotion_id);if(!promotionProductIds.has(key))promotionProductIds.set(key,new Set());promotionProductIds.get(key).add(Number(x.product_id))})}}
} catch (error) { console.warn('Не вдалося завантажити каталог із Supabase', error); } finally { mount(); await mountMegaCatalog(); } }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadProducts, { once: true });
else loadProducts();


async function mountMegaCatalog() {
  const mega=document.getElementById('catalogMega'), rootsEl=document.getElementById('megaRoots'), childrenEl=document.getElementById('megaChildren');
  if(!mega||!rootsEl||!childrenEl) return;
  const {data:cats,error}=await supabase.from('categories').select('id,name,slug,parent_id,sort_order').eq('is_active',true).order('sort_order');
  if(error||!cats?.length) return;
  const ids=new Set(cats.map(c=>c.id)), roots=cats.filter(c=>!c.parent_id||!ids.has(c.parent_id));
  const show=(root)=>{
    rootsEl.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.slug===root.slug));
    const kids=cats.filter(c=>c.parent_id===root.id);
    childrenEl.innerHTML=`<div class="mega-title"><h2>${root.name}</h2><a href="catalog.html?category=${encodeURIComponent(root.slug)}">Усі товари →</a></div><div class="mega-grid">${kids.map(c=>`<a href="catalog.html?category=${encodeURIComponent(c.slug)}"><strong>${c.name}</strong><span>${products.filter(p=>p.type===c.slug).length} товарів</span></a>`).join('')}</div>`;
  };
  rootsEl.innerHTML=roots.map(r=>`<button type="button" data-slug="${r.slug}"><span>${r.name}</span><b>›</b></button>`).join('');
  rootsEl.querySelectorAll('button').forEach(b=>{b.onmouseenter=b.onclick=()=>show(roots.find(r=>r.slug===b.dataset.slug));});
  if(roots[0]) show(roots[0]);
  const toggle=document.getElementById('catalogMenuToggle');
  let closeTimer;
  const cancelClose=()=>clearTimeout(closeTimer);
  const scheduleClose=()=>{ clearTimeout(closeTimer); closeTimer=setTimeout(()=>{ mega.hidden=true; },180); };
  toggle.onclick=()=>{ mega.hidden=!mega.hidden; };
  toggle.onmouseenter=()=>{ cancelClose(); mega.hidden=false; };
  toggle.onmouseleave=scheduleClose;
  mega.onmouseenter=cancelClose;
  mega.onmouseleave=scheduleClose;
  const search=document.getElementById('headerCatalogSearch'), go=document.getElementById('headerCatalogSearchGo');
  const run=()=>{const q=search.value.trim(); if(q) location.href='catalog.html?search='+encodeURIComponent(q);};
  go.onclick=run; search.onkeydown=e=>{if(e.key==='Enter') run();};
}
/* Статус «Під замовлення»: товар можна оформити без складського залишку. */
function availability(product) {
  if (product.availabilityStatus === 'under_order') return { label: 'Під замовлення', button: 'Замовити', orderable: true };
  if (product.stock) return { label: 'В наявності', button: 'У кошик', orderable: true };
  return { label: 'Немає в наявності', button: 'Немає', orderable: false };
}
add = (id) => {
  const item = get(id);

  if (!item || !availability(item).orderable) return;

  const existing = cart.find(
    entry => Number(entry.productId) === Number(id)
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      productId: Number(id),
      quantity: 1
    });
  }

  save();
  renderCart();
};
renderCart = () => {
  const count=document.getElementById('cartCount'),root=document.getElementById('cartItems'),total=document.getElementById('cartTotal'),checkoutButton=document.getElementById('checkoutButton');
  const quantityTotal=cart.reduce((sum,e)=>sum+Number(e.quantity||1),0); if(count)count.textContent=quantityTotal; if(!root)return;
  const items=cart.map((entry,index)=>({product:get(Number(entry.productId??entry)),quantity:Number(entry.quantity||1),index})).filter(x=>x.product);
  root.innerHTML=items.length?items.map(({product,quantity,index})=>{const state=availability(product),src=imageUrl(product);return `
    <div class="cart-item cart-item-rich">
      <a class="cart-thumb" href="product.html?id=${product.id}">${src?`<img src="${src}" alt="${catalogCardEscape(product.name)}">`:'<span>Фото</span>'}</a>
      <div class="cart-item-main"><a href="product.html?id=${product.id}" class="cart-item-name">${catalogCardEscape(product.name)}</a><span class="cart-item-stock">${state.label}</span><div class="cart-qty"><button type="button" data-cart-minus="${index}" aria-label="Зменшити">−</button><input type="number" min="1" max="99" value="${quantity}" data-cart-qty="${index}"><button type="button" data-cart-plus="${index}" aria-label="Збільшити">+</button></div></div>
      <div class="cart-item-side"><strong>${money(product.price*quantity)}</strong><small>${money(product.price)} / шт.</small><button type="button" class="cart-remove" data-cart-remove="${index}">Видалити</button></div>
    </div>`}).join(''):'<div class="cart-empty-state"><b>Кошик порожній</b><span>Додайте товари з каталогу</span><a href="catalog.html">Перейти до каталогу →</a></div>';
  const sum=items.reduce((acc,x)=>acc+x.product.price*x.quantity,0); if(total)total.textContent=money(sum); if(checkoutButton)checkoutButton.disabled=!items.length;
  const updateQty=(i,q)=>{if(!cart[i])return;cart[i].quantity=Math.max(1,Math.min(99,Number(q)||1));save();renderCart()};
  root.querySelectorAll('[data-cart-minus]').forEach(b=>b.onclick=()=>updateQty(Number(b.dataset.cartMinus),Number(cart[Number(b.dataset.cartMinus)]?.quantity||1)-1));
  root.querySelectorAll('[data-cart-plus]').forEach(b=>b.onclick=()=>updateQty(Number(b.dataset.cartPlus),Number(cart[Number(b.dataset.cartPlus)]?.quantity||1)+1));
  root.querySelectorAll('[data-cart-qty]').forEach(input=>input.onchange=()=>updateQty(Number(input.dataset.cartQty),input.value));
  root.querySelectorAll('[data-cart-remove]').forEach(b=>b.onclick=()=>{cart.splice(Number(b.dataset.cartRemove),1);save();renderCart()});
  let tools=root.parentElement?.querySelector('.cart-tools'); if(items.length&&!tools){tools=document.createElement('div');tools.className='cart-tools';tools.innerHTML='<button type="button" id="cartClear">Очистити кошик</button><a href="catalog.html">+ Продовжити покупки</a>';root.after(tools);tools.querySelector('#cartClear').onclick=()=>{cart.length=0;save();renderCart();tools.remove()}} else if(!items.length&&tools)tools.remove();
};
const cleanBrand = (value) => {
  let text=String(value??'').trim();
  try { if(/%u[0-9a-f]{4}|%[0-9a-f]{2}/i.test(text)) text=unescape(text); } catch {}
  try { if(/%[0-9a-f]{2}/i.test(text)) text=decodeURIComponent(text); } catch {}
  text=text.replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&nbsp;/gi,' ').replace(/%20/gi,' ').replace(/\s+/g,' ').trim();
  const suffixes=/\s+(monitors?|accessories|displays?|energy(?:\s*ups)?|gaming|mounts?|multimedia|screens?|tv)$/i;
  text=text.replace(suffixes,'').trim();
  return text;
};
const fillBrandSelect = (select, source) => {
  if(!select)return;
  const map=new Map();
  source.map(p=>cleanBrand(p.brand)).filter(Boolean).forEach(v=>{const key=v.toLocaleLowerCase('uk-UA');if(!map.has(key))map.set(key,v)});
  const brands=[...map.values()].sort((a,b)=>a.localeCompare(b,'uk'));
  select.replaceChildren(new Option('Усі бренди',''),...brands.map(v=>new Option(v,v)));
};
const catalogCardEscape = (value) => String(value ?? '').replace(/[&<>\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
card = (product) => {
  const state = availability(product);
  const name = catalogCardEscape(product.name);
  const brand = catalogCardEscape(product.brand || 'TECHNOROOM');
  const source = imageUrl(product);
  const preview = source
    ? `<img src="${source}" alt="${name}" loading="lazy" draggable="false">`
    : '<div class="product-placeholder"><span>Фото товару<br>з’явиться незабаром</span></div>';

  return `<article class="product product-card">
    <a class="product-image ${product.type}" href="product.html?id=${product.id}" aria-label="Відкрити товар ${name}">${preview}</a>
    <div class="product-card-content">
      <div class="product-card-meta"><span>${brand}</span><span class="availability">${state.label}</span></div>
      <h3><a href="product.html?id=${product.id}">${name}</a></h3>
      <div class="product-footer"><strong class="price">${money(product.price)}</strong><button class="add-button" data-add="${product.id}" ${state.orderable ? '' : 'disabled'}>${state.button}</button></div>
    </div>
  </article>`;
};
product = () => {
  const root=document.getElementById('productView'); if(!root)return;
  const item=get(new URLSearchParams(location.search).get('id'))||products[0]; if(!item)return;
  const state=availability(item);
  const safeName=catalogCardEscape(item.name), safeBrand=catalogCardEscape(item.brand||'TECHNOROOM');
  const specEntries=item.specifications?Object.entries(item.specifications):[];
  const specs=specEntries.length?specEntries.map(([key,value])=>`<div><dt>${catalogCardEscape(key)}</dt><dd>${catalogCardEscape(Array.isArray(value)?value.join(', '):value)}</dd></div>`).join(''):`<div><dt>Характеристики</dt><dd>${catalogCardEscape(item.details||'Уточнюйте у менеджера')}</dd></div>`;
  const related=products.filter(p=>p.id!==item.id&&p.type===item.type).slice(0,4);
  root.innerHTML=`
    <section class="product-main-card">
      <div class="product-detail-visual ${item.type}">
        <div class="product-image ${item.type}">${image(item)}</div>
        <span class="product-photo-hint">Натисніть на фото, щоб збільшити</span>
      </div>
      <div class="product-detail-copy">
        <div class="product-brand-row"><span>${safeBrand}</span><span class="product-code">Код: ${item.id}</span></div>
        <h1>${safeName}</h1>
        <p class="product-description">${catalogCardEscape(item.description||'')}</p>
        <div class="product-status ${state.orderable?'ok':'no'}"><i></i>${state.label}</div>
        <strong class="detail-price">${money(item.price)}</strong>
        <div class="detail-actions"><button class="button product-buy" data-add="${item.id}" ${state.orderable?'':'disabled'}>🛒 ${state.orderable?(item.availabilityStatus==='under_order'?'Замовити':'У кошик'):'Немає в наявності'}</button><a class="button product-back" href="catalog.html">← До каталогу</a></div>
        <div class="product-benefits"><div><b>✓ Швидка доставка</b><span>По всій Україні</span></div><div><b>◇ Гарантія</b><span>Офіційна техніка</span></div><div><b>↺ Підтримка</b><span>Допоможемо з вибором</span></div></div>
      </div>
    </section>
    <section class="product-info-card"><h2>Характеристики</h2><dl class="specs"><div><dt>Виробник</dt><dd>${safeBrand}</dd></div>${specs}</dl></section>
    ${related.length?`<section class="related-products"><div class="related-heading"><h2>Схожі товари</h2><a href="catalog.html?category=${encodeURIComponent(item.type)}">Переглянути всі →</a></div><div class="product-grid">${related.map(card).join('')}</div></section>`:''}`;
  bind(root);
};
checkout = () => {

  const form =
    document.getElementById('checkoutForm');

  if (!form) return;

  const root=document.getElementById('checkoutSummary');
  const renderSummary=()=>{
    const items=cart.map((entry,index)=>({product:get(Number(entry.productId)),quantity:Number(entry.quantity||1),index})).filter(x=>x.product);
    const total=items.reduce((sum,x)=>sum+x.product.price*x.quantity,0);
    root.innerHTML=items.length?items.map(({product,quantity,index})=>{const src=imageUrl(product);return `<div class="checkout-item checkout-item-editable">
      <a class="checkout-item-thumb" href="product.html?id=${product.id}">${src?`<img src="${src}" alt="${catalogCardEscape(product.name)}">`:'<span>Фото</span>'}</a>
      <div class="checkout-item-info"><a href="product.html?id=${product.id}">${catalogCardEscape(product.name)}</a><small>${money(product.price)} / шт.</small><div class="checkout-mini-qty"><button type="button" data-checkout-minus="${index}">−</button><b>${quantity}</b><button type="button" data-checkout-plus="${index}">+</button></div></div>
      <div class="checkout-item-price"><strong>${money(product.price*quantity)}</strong><button type="button" data-checkout-remove="${index}" aria-label="Видалити">✕</button></div>
    </div>`}).join('')+`<div class="checkout-summary-count"><span>Товари (${items.reduce((n,x)=>n+x.quantity,0)})</span><b>${money(total)}</b></div><div class="checkout-total"><span>До сплати</span><strong>${money(total)}</strong></div>`:'<div class="checkout-empty"><b>Кошик порожній</b><a href="catalog.html">Перейти до каталогу →</a></div>';
    const setQty=(i,q)=>{if(!cart[i])return;cart[i].quantity=Math.max(1,Math.min(99,q));save();renderCart();renderSummary()};
    root.querySelectorAll('[data-checkout-minus]').forEach(b=>b.onclick=()=>setQty(+b.dataset.checkoutMinus,Number(cart[+b.dataset.checkoutMinus].quantity||1)-1));
    root.querySelectorAll('[data-checkout-plus]').forEach(b=>b.onclick=()=>setQty(+b.dataset.checkoutPlus,Number(cart[+b.dataset.checkoutPlus].quantity||1)+1));
    root.querySelectorAll('[data-checkout-remove]').forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.checkoutRemove,1);save();renderCart();renderSummary()});
  };
  renderSummary();

  const deliveryRadios=form.querySelectorAll('[name="deliveryMethod"]'), addressLabel=document.getElementById('deliveryAddressLabel'), companyToggle=document.getElementById('companyOrder'), companyFields=document.getElementById('companyFields');

  const phone=form.querySelector('[name="phone"]'), deliveryHelp=document.getElementById('deliveryHelp');
  if(phone) phone.addEventListener('input',()=>{let d=phone.value.replace(/\D/g,'');if(d.startsWith('380'))d=d.slice(3);else if(d.startsWith('0'))d=d.slice(1);d=d.slice(0,9);const p=['+380'];if(d.length)p.push(' ('+d.slice(0,2)+(d.length>=2?') ':''));if(d.length>2)p.push(d.slice(2,5));if(d.length>5)p.push('-'+d.slice(5,7));if(d.length>7)p.push('-'+d.slice(7,9));phone.value=p.join('')});
  const updateDelivery=()=>{const method=form.querySelector('[name="deliveryMethod"]:checked')?.value; const input=addressLabel?.querySelector('input'); if(!addressLabel||!input)return; if(method==='nova_poshta'){addressLabel.firstChild.textContent='Відділення / поштомат *';input.placeholder='№ відділення або поштомату';input.required=true;if(deliveryHelp)deliveryHelp.textContent='Вкажіть номер відділення або поштомату Нової пошти.'}else if(method==='courier'){addressLabel.firstChild.textContent='Адреса доставки *';input.placeholder='Вулиця, будинок, квартира';input.required=true;if(deliveryHelp)deliveryHelp.textContent='Вкажіть повну адресу для кур’єрської доставки.'}else{addressLabel.firstChild.textContent='Деталі самовивозу';input.placeholder='Необов’язково';input.required=false;if(deliveryHelp)deliveryHelp.textContent='Менеджер погодить місце та час самовивозу після замовлення.'}};
  deliveryRadios.forEach(r=>r.onchange=updateDelivery); updateDelivery();
  if(companyToggle)companyToggle.onchange=()=>{companyFields.hidden=!companyToggle.checked;companyFields.querySelectorAll('input').forEach(i=>i.required=companyToggle.checked)};
  const paymentLabels={cod:'При отриманні',invoice:'За рахунком',card:'Карткою онлайн'},deliveryLabels={nova_poshta:'Нова пошта',courier:'Кур’єр',pickup:'Самовивіз'},paymentNote=document.getElementById('paymentNote');
  const updateReview=()=>{const name=[form.elements.name?.value,form.elements.lastName?.value].filter(Boolean).join(' ')||'Заповніть контактні дані';const dm=form.querySelector('[name="deliveryMethod"]:checked')?.value,pm=form.querySelector('[name="paymentMethod"]:checked')?.value;const city=form.elements.city?.value.trim(),address=form.elements.address?.value.trim();document.getElementById('reviewCustomer').textContent=name+(form.elements.phone?.value?' · '+form.elements.phone.value:'');document.getElementById('reviewDelivery').textContent=[deliveryLabels[dm],city,address].filter(Boolean).join(' · ')||'Оберіть спосіб доставки';document.getElementById('reviewPayment').textContent=paymentLabels[pm]||'—';if(paymentNote){const notes={cod:['Оплата при отриманні','Сплатите замовлення після огляду товару.'],invoice:['Оплата за рахунком','Менеджер перевірить реквізити та надішле рахунок.'],card:['Оплата карткою онлайн','Онлайн-оплату підключимо після інтеграції платіжного сервісу.']};const n=notes[pm]||notes.cod;paymentNote.innerHTML='<b>'+n[0]+'</b><span>'+n[1]+'</span>'}};
  form.querySelectorAll('input,textarea').forEach(el=>{el.addEventListener('input',updateReview);el.addEventListener('change',updateReview)});updateReview();

  form.onsubmit = async (event) => {

    event.preventDefault();

    const currentItems=cart.map(entry=>({product:get(Number(entry.productId)),quantity:Number(entry.quantity||1)})).filter(x=>x.product);
    if (!currentItems.length) return alert('Кошик порожній.');
    if (currentItems.some(item=>!availability(item.product).orderable)) return alert('У кошику є недоступний товар.');

    const data =
      Object.fromEntries(
        new FormData(form)
      );

    const button =
      form.querySelector('button');

    button.disabled = true;

    try {

      const response =
        await fetch('/api/orders', {

          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({

            customer: {
              name: data.name,
              lastName: data.lastName,
              phone: data.phone,
              email: data.email || null,
              newsletter: Boolean(data.newsletter)
            },

            delivery: {
              method: data.deliveryMethod,
              city: data.city,
              address: data.address,
              comment: data.comment
            },
            payment: { method: data.paymentMethod },
            company: data.companyOrder ? { name: data.companyName, code: data.companyCode, contact: data.companyContact, invoiceEmail: data.invoiceEmail } : null,

            items: cart.map(item => ({
              productId: item.productId,
              quantity: item.quantity
            }))

          })

        });

      if (!response.ok)
        throw new Error();

      localStorage.removeItem(
        'technoroom-cart'
      );

      cart.length = 0;

      renderCart();

      document.getElementById(
        'checkoutNotice'
      ).hidden = false;

      button.textContent =
        'Замовлення прийнято';
      form.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=true);
      document.getElementById('checkoutNotice').hidden=false;
      document.getElementById('checkoutNotice').scrollIntoView({behavior:'smooth',block:'center'});

    } catch {

      button.disabled = false;

      alert(
        'Не вдалося створити замовлення. Спробуйте ще раз.'
      );

    }

  };

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
