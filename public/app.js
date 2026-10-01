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
let productsLoaded = false;
let activePromotions=[]; let promotionProductIds=new Map();
const cart = JSON.parse(localStorage.getItem('technoroom-cart') || '[]');
const money = (value) => `${new Intl.NumberFormat('uk-UA').format(value)} ₴`;
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
// Частина назв з XML постачальника приходить у застарілому %uXXXX-форматі.
// Декодуємо його лише для показу, щоб навігація не перетворювалася на %u041F…
const readableText = (value = '') => {
  let text = String(value);
  try { if (/%u[0-9a-f]{4}/i.test(text)) text = unescape(text); } catch {}
  try { if (/%[0-9a-f]{2}/i.test(text)) text = decodeURIComponent(text); } catch {}
  return text.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
};
const get = (id) => products.find((product) => product.id === Number(id));
const save = () => localStorage.setItem('technoroom-cart', JSON.stringify(cart));
const imageUrl = (product) => product.image?.startsWith('http') ? `/api/product-image?id=${product.id}` : product.image ? supabase.storage.from('product-images').getPublicUrl(product.image).data.publicUrl : '';
const image = (product) => {
  if (product.image) {
    const src=imageUrl(product);
    return '<img src="'+escapeHtml(src)+'" alt="'+escapeHtml(product.name||'Фото товару')+'" loading="lazy">';
  }
  return '<div class="product-placeholder"><span>Фото товару<br>з’явиться незабаром</span></div>';
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
function promotionFor(product){
  return activePromotions.find(p=>{
    const type=p.target_type||'all';
    if(type==='all') return true;
    if(type==='category') return String(p.target_value||'')===String(product.type||'');
    if(type==='brand') return Number(p.target_value)===Number(product.brand_id);
    if(type==='products') return promotionProductIds.get(Number(p.id))?.has(Number(product.id));
    return false;
  });
}
function promotionByProductLink(product){for(const p of activePromotions){if(promotionProductIds.get(Number(p.id))?.has(Number(product.id)))return p}return null}
function salePrice(product){const p=promotionFor(product);if(!p)return Number(product.price);return Math.max(0,p.discount_type==='percent'?Number(product.price)*(1-Number(p.discount_value)/100):Number(product.price)-Number(p.discount_value))}
function card(product) { const promo=promotionFor(product)||promotionByProductLink(product),price=promo?Math.max(0,promo.discount_type==='percent'?Number(product.price)*(1-Number(promo.discount_value)/100):Number(product.price)-Number(promo.discount_value)):Number(product.price),badge=promo?'<span class="sale-badge">'+(promo.discount_type==='percent'?'-'+Number(promo.discount_value)+'%':'АКЦІЯ')+'</span>':'',promoName=promo?'<div class="promotion-name">🏷 Акція: <b>'+escapeHtml(promo.name||'Спеціальна пропозиція')+'</b></div>':''; return `<article class="product">${badge}<div class="product-image ${product.type}">${image(product)}</div>${promoName}<h3><a href="product.html?id=${product.id}">${product.name}</a></h3><p class="availability">${product.stock ? 'В наявності' : 'Немає в наявності'}</p><p>${product.description || ''}</p><div class="product-footer"><div>${promo?'<del class="old-price">'+money(product.price)+'</del>':''}<strong class="price">${money(price)}</strong></div><button class="add-button" data-add="${product.id}" ${product.stock ? '' : 'disabled'}>${product.stock ? 'У кошик' : 'Немає'}</button></div></article>`; }
function bind(root = document) { root.querySelectorAll('[data-add]').forEach((button) => button.onclick = () => add(button.dataset.add)); root.querySelectorAll('[data-inquiry]').forEach((button) => button.onclick = () => openInquiry(button.dataset.inquiry)); root.querySelectorAll('.product-image img').forEach((image) => image.onclick = () => openLightbox(image.currentSrc || image.src, image.alt)); }
async function home() {
  const root=document.getElementById('productGrid'); if(!root || !productsLoaded) return;
  if(root.dataset.homeReady==='true') return;
  root.dataset.homeReady='true';
  let homeProducts=[...products], cats=[];
  try {
    const now=new Date().toISOString();
    const {data:banners,error:bannerError}=await supabase.from('banners').select('*').eq('is_active',true).order('sort_order').order('created_at',{ascending:false});
    if(bannerError) throw bannerError;
    const activeBanners=(banners||[]), hero=document.querySelector('.home-hero');
    if(activeBanners.length&&hero){
      const copy=hero.querySelector('.home-hero-copy'), art=hero.querySelector('.home-projector-art');
      let bannerIndex=0;
      const applyBanner=(index)=>{
        bannerIndex=(index+activeBanners.length)%activeBanners.length;
        const banner=activeBanners[bannerIndex];
        if(copy){
          const title=escapeHtml(banner.title||'TECHNOROOM'), subtitle=escapeHtml(banner.subtitle||''), button=escapeHtml(banner.button_text||'Переглянути');
          copy.innerHTML='<small>TECHNOROOM</small><h1>'+title+'</h1>'+(subtitle?'<p>'+subtitle+'</p>':'')+'<a href="'+escapeHtml(banner.link_url||'catalog.html')+'">'+button+' →</a>';
        }
        hero.style.backgroundImage=banner.image_url?'linear-gradient(90deg,rgba(8,27,56,.96),rgba(8,27,56,.60)),url("'+String(banner.image_url).replace(/["\\]/g,'')+'")':'';
        hero.style.backgroundSize=banner.image_url?'cover':''; hero.style.backgroundPosition=banner.image_url?'center':'';
        if(art) art.style.display=banner.image_url?'none':'';
        hero.querySelectorAll('[data-banner-dot]').forEach((dot,position)=>dot.classList.toggle('is-active',position===bannerIndex));
      };
      if(activeBanners.length>1){
        const controls=document.createElement('div');
        controls.className='home-banner-controls';
        controls.innerHTML='<button type="button" data-banner-prev aria-label="Попередній банер">←</button><div>'+activeBanners.map((_,index)=>'<button type="button" data-banner-dot aria-label="Банер '+(index+1)+'"></button>').join('')+'</div><button type="button" data-banner-next aria-label="Наступний банер">→</button>';
        hero.append(controls);
        controls.querySelector('[data-banner-prev]').onclick=()=>applyBanner(bannerIndex-1);
        controls.querySelector('[data-banner-next]').onclick=()=>applyBanner(bannerIndex+1);
        controls.querySelectorAll('[data-banner-dot]').forEach((dot,index)=>dot.onclick=()=>applyBanner(index));
        window.setInterval(()=>applyBanner(bannerIndex+1),6500);
      }
      applyBanner(0);
    }
    const {data:promos}=await supabase.from('promotions').select('*').eq('is_active',true);
    const active=(promos||[]).filter(p=>(!p.starts_at||p.starts_at<=now)&&(!p.ends_at||p.ends_at>=now));
    if(active.length){const sale=document.querySelector('.home-tabs a[href*="promo=sale"]');if(sale)sale.textContent='Акції ('+active.length+')'}
  } catch(e){console.warn('Промоблоки головної',e)}

  const saleSection=document.getElementById('homeSaleSection'),saleGrid=document.getElementById('homeSaleGrid');
  if(saleSection&&saleGrid){const saleProducts=homeProducts.filter(p=>promotionFor(p)||promotionByProductLink(p));saleSection.hidden=false;if(saleProducts.length){saleGrid.innerHTML=saleProducts.slice(0,6).map(card).join('');bind(saleGrid)}else{saleGrid.innerHTML='<div class="home-sale-empty">Акційні товари з’являться тут після активації акції.</div>'}}
  const cards=document.getElementById('homeCategoryCards');
  try {
    const res=await supabase.from('categories').select('id,name,slug,parent_id,sort_order,image_path').eq('is_active',true).order('sort_order');
    cats=(res.data||[]).map((category) => ({ ...category, name: readableText(category.name) }));
    if(cats.length){
      const ids=new Set(cats.map(c=>c.id)), roots=cats.filter(c=>!c.parent_id||!ids.has(c.parent_id));
      if(cards) cards.innerHTML=roots.slice(0,8).map(c=>{const source=c.image_path?(String(c.image_path).startsWith('http')?c.image_path:supabase.storage.from('product-images').getPublicUrl(c.image_path).data.publicUrl):'';return `<a href="catalog.html?category=${encodeURIComponent(c.slug)}"><div class="home-cat-visual">${source?'<img src="'+escapeHtml(source)+'" alt="" loading="lazy">':'▣'}</div><b>${escapeHtml(c.name)}</b><span>Переглянути →</span></a>`}).join('');
      const mega=document.getElementById('homeCatalogMega'), rootsEl=document.getElementById('homeMegaRoots'), childrenEl=document.getElementById('homeMegaChildren'), toggle=document.getElementById('homeCatalogToggle');
      if(mega&&rootsEl&&childrenEl&&toggle){
        const compactMenu=()=>window.matchMedia('(max-width:700px)').matches;
        const renderRoots=()=>{
          rootsEl.hidden=false;
          childrenEl.hidden=true;
          rootsEl.innerHTML=roots.map(r=>`<button type="button" data-slug="${r.slug}"><span>${escapeHtml(r.name)}</span><b>›</b></button>`).join('');
          rootsEl.querySelectorAll('button').forEach(button=>{
            const root=roots.find(item=>item.slug===button.dataset.slug);
            button.onmouseenter=()=>{if(!compactMenu()) show(root)};
            button.onclick=()=>show(root);
          });
        };
        const show=r=>{
          rootsEl.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.slug===r.slug));
          const kids=cats.filter(c=>c.parent_id===r.id);
          const back=compactMenu()?'<button type="button" class="mega-back" data-mega-back>← Усі категорії</button>':'';
          childrenEl.innerHTML=`${back}<div class="mega-title"><h2>${escapeHtml(r.name)}</h2><a href="catalog.html?category=${encodeURIComponent(r.slug)}">Усі товари →</a></div><div class="mega-grid">${kids.map(c=>`<a href="catalog.html?category=${encodeURIComponent(c.slug)}"><strong>${escapeHtml(c.name)}</strong><span>${products.filter(p=>storefrontCategoryMatches(p,c.slug)).length} товарів</span></a>`).join('')}</div>`;
          if(compactMenu()){
            rootsEl.hidden=true;
            childrenEl.hidden=false;
            childrenEl.querySelector('[data-mega-back]').onclick=renderRoots;
          }else childrenEl.hidden=false;
        };
        renderRoots();
        if(roots[0]&&!compactMenu()) show(roots[0]);
        const setMenuOpen=(isOpen)=>{
          mega.hidden=!isOpen;
          toggle.setAttribute('aria-expanded', String(isOpen));
        };
        // Меню відкривається тільки явним натисканням: на сенсорних екранах і мишкою
        // воно не закривається миттєво через випадковий mouseleave.
        toggle.onclick=(event)=>{
          event.preventDefault();
          event.stopPropagation();
          setMenuOpen(mega.hidden);
        };
        document.addEventListener('pointerdown',(event)=>{
          if(!mega.hidden&&!mega.contains(event.target)&&!toggle.contains(event.target)) setMenuOpen(false);
        });
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
  const search=document.getElementById('homeSearch'),go=document.getElementById('homeSearchGo'),run=()=>{const term=search?.value.trim();location.href='catalog.html'+(term?'?search='+encodeURIComponent(term):'')};
  if(search){const wrap=search.closest('.home-search'),results=document.createElement('div');results.className='home-search-results';results.hidden=true;wrap?.append(results);const normalize=v=>String(v||'').toLocaleLowerCase('uk-UA').replace(/є/g,'е').replace(/['’\-_/.,()]+/g,' ').replace(/\s+/g,' ').trim();const show=()=>{const term=search.value.trim(),query=normalize(term);if(query.length<2){results.hidden=true;return}const words=query.split(' ').filter(Boolean),matches=products.filter(p=>{const hay=normalize([p.name,p.brand,p.sku,p.description].join(' '));return words.every(word=>hay.includes(word))}).slice(0,6),categories=cats.filter(category=>words.every(word=>normalize(category.name+' '+category.slug).includes(word))).slice(0,4),categoryMarkup=categories.length?'<div class="home-search-categories"><b>Категорії</b><div>'+categories.map(category=>'<a href="catalog.html?category='+encodeURIComponent(category.slug)+'">▦ '+escapeHtml(category.name)+'</a>').join('')+'</div></div>':'';results.innerHTML='<div class="home-search-results__head"><b>Знайдено: '+matches.length+(matches.length===6?'+':'')+'</b><span>назва, бренд або SKU</span></div>'+categoryMarkup+(matches.length?matches.map(p=>{const src=imageUrl(p);return '<a href="product.html?id='+p.id+'">'+(src?'<img src="'+escapeHtml(src)+'" alt="" draggable="false">':'<i>▣</i>')+'<span><b>'+escapeHtml(p.name)+'</b><small>'+escapeHtml(p.brand||'TECHNOROOM')+' · '+money(p.price)+'</small></span><em>'+availability(p).label+'</em></a>'}).join(''):'<p>Нічого не знайдено. Спробуйте іншу назву або SKU.</p>')+'<button type="button">Переглянути всі результати для «'+escapeHtml(term)+'» →</button>';results.hidden=false;results.querySelector('button')?.addEventListener('click',run)};search.addEventListener('input',show);search.addEventListener('focus',show);search.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();run()}if(e.key==='Escape')results.hidden=true});document.addEventListener('pointerdown',e=>{if(!wrap?.contains(e.target))results.hidden=true})}if(go)go.onclick=run;
}
const normalizeStoreSearch=(v='')=>String(v).toLowerCase().replace(/['’\-_/.,()]+/g,' ').replace(/\s+/g,' ').trim();
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
  const initialSearch = new URLSearchParams(location.search).get('search') || '';
  if (search && initialSearch) search.value = initialSearch;
  fillBrandSelect(brand,products);
  const maxPrice = Math.max(0, ...products.map((product) => Number(product.price) || 0));
  const rangeMax = Math.max(1000, Math.ceil(maxPrice / 1000) * 1000);
  priceRange.max = rangeMax; priceRange.value = rangeMax; priceMinRange.max = rangeMax; priceMinRange.value = 0; price.value = rangeMax;
  const updatePriceCaption = () => { priceCaption.textContent = `Від ${Number(priceMin.value || 0).toLocaleString('uk-UA')} ₴ до ${Number(price.value || rangeMax).toLocaleString('uk-UA')} ₴`; }; updatePriceCaption();
  const draw = () => {
    buttons.forEach((button) => button.classList.toggle('selected', button.dataset.category === category));
    const term = (search.value || '').trim();
    let shown = products.filter((product) =>
      (!saleOnly || !!promotionFor(product)) &&
      (!promotionOnly || Number(promotionFor(product)?.id)===promotionOnly) &&
      (category === 'all' || categoryMatch(product, category)) &&
      (!term || normalizeStoreSearch(`${product.name} ${product.brand||''} ${product.sku||''} ${product.description||''}`).includes(normalizeStoreSearch(term).split(' ').join(' ')) || normalizeStoreSearch(term).split(' ').every(w=>normalizeStoreSearch(`${product.name} ${product.brand||''} ${product.sku||''} ${product.description||''}`).includes(w))) &&
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
  if (all.length) products = all.map((item) => ({ id: item.id, sku: item.sku, name: compactProductName(item.name, item.sku, item.brand), description: item.description, price: Number(item.price), type: item.category, brand: item.brand, brand_id:item.brand_id, specifications: item.specifications, availabilityStatus: item.availability_status, stockQuantity: Number(item.stock_quantity || 0), stock: item.in_stock && Number(item.stock_quantity || 0) > 0, image: item.image_path }));
  const now=Date.now(),pr=await supabase.from('promotions').select('*').eq('is_active',true);if(pr.error)console.warn('Акції:',pr.error);else{activePromotions=(pr.data||[]).filter(p=>(!p.starts_at||new Date(p.starts_at).getTime()<=now)&&(!p.ends_at||new Date(p.ends_at).getTime()>=now));promotionProductIds.clear();const targeted=activePromotions.filter(p=>p.target_type==='products').map(p=>p.id);if(targeted.length){const pp=await supabase.from('promotion_products').select('promotion_id,product_id').in('promotion_id',targeted);if(pp.error)console.warn('Товари акцій:',pp.error);else(pp.data||[]).forEach(x=>{const key=Number(x.promotion_id);if(!promotionProductIds.has(key))promotionProductIds.set(key,new Set());promotionProductIds.get(key).add(Number(x.product_id))})}}
} catch (error) { console.warn('Не вдалося завантажити каталог із Supabase', error); } finally { productsLoaded = true; mount(); await mountMegaCatalog(); } }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadProducts, { once: true });
else loadProducts();


async function mountMegaCatalog() {
  const mega=document.getElementById('catalogMega'), rootsEl=document.getElementById('megaRoots'), childrenEl=document.getElementById('megaChildren');
  if(!mega||!rootsEl||!childrenEl) return;
  const {data:categoryRows,error}=await supabase.from('categories').select('id,name,slug,parent_id,sort_order').eq('is_active',true).order('sort_order');
  const cats=(categoryRows||[]).map((category)=>({ ...category, name: readableText(category.name) }));
  if(error||!cats?.length) return;
  const ids=new Set(cats.map(c=>c.id)), roots=cats.filter(c=>!c.parent_id||!ids.has(c.parent_id));
  const compactMenu=()=>window.matchMedia('(max-width:700px)').matches;
  const renderRoots=()=>{
    rootsEl.hidden=false;
    childrenEl.hidden=true;
    rootsEl.innerHTML=roots.map(r=>`<button type="button" data-slug="${r.slug}"><span>${r.name}</span><b>›</b></button>`).join('');
    rootsEl.querySelectorAll('button').forEach(button=>{
      const root=roots.find(item=>item.slug===button.dataset.slug);
      button.onmouseenter=()=>{if(!compactMenu()) show(root)};
      button.onclick=()=>show(root);
    });
  };
  const show=(root)=>{
    rootsEl.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.slug===root.slug));
    const kids=cats.filter(c=>c.parent_id===root.id);
    const back=compactMenu()?'<button type="button" class="mega-back" data-mega-back>← Усі категорії</button>':'';
    childrenEl.innerHTML=`${back}<div class="mega-title"><h2>${root.name}</h2><a href="catalog.html?category=${encodeURIComponent(root.slug)}">Усі товари →</a></div><div class="mega-grid">${kids.map(c=>`<a href="catalog.html?category=${encodeURIComponent(c.slug)}"><strong>${c.name}</strong><span>${products.filter(p=>storefrontCategoryMatches(p,c.slug)).length} товарів</span></a>`).join('')}</div>`;
    if(compactMenu()){
      rootsEl.hidden=true;
      childrenEl.hidden=false;
      childrenEl.querySelector('[data-mega-back]').onclick=renderRoots;
    }else childrenEl.hidden=false;
  };
  renderRoots();
  if(roots[0]&&!compactMenu()) show(roots[0]);
  const toggle=document.getElementById('catalogMenuToggle');
  toggle.onclick=(event)=>{ event.preventDefault(); mega.hidden=!mega.hidden; };
  document.addEventListener('pointerdown',(event)=>{
    if(!mega.hidden&&!mega.contains(event.target)&&!toggle.contains(event.target)) mega.hidden=true;
  });
  const search=document.getElementById('headerCatalogSearch'), go=document.getElementById('headerCatalogSearchGo');
  const normalizeSearch=v=>String(v||'').toLowerCase().replace(/є/g,'е').replace(/['’\-_/.,()]+/g,' ').replace(/\s+/g,' ').trim();
  const score=(p,q)=>{const words=normalizeSearch(q).split(' ').filter(Boolean),name=normalizeSearch(p.name),brand=normalizeSearch(p.brand),sku=normalizeSearch(p.sku),desc=normalizeSearch(p.description),hay=[name,brand,sku,desc].join(' ');if(!words.every(w=>hay.includes(w)))return-1;let n=0;words.forEach(w=>{if(name===w)n+=100;else if(name.startsWith(w))n+=60;else if(name.includes(w))n+=40;if(brand===w)n+=30;if(sku===w)n+=50});return n};
  const run=()=>{const q=search?.value.trim();const url=new URL('catalog.html',location.href);if(q)url.searchParams.set('search',q);else url.searchParams.delete('search');location.href=url.href;};
  if(search){
    const wrap=search.closest('.header-search');
    const results=document.createElement('div');
    results.className='header-search-results'; results.hidden=true; results.setAttribute('role','status');
    wrap?.append(results);
    const showResults=()=>{const q=search.value.trim(),normalized=normalizeSearch(q);if(normalized.length<2){results.hidden=true;return}const matches=products.map(product=>({product,rank:score(product,normalized)})).filter(row=>row.rank>=0).sort((a,b)=>b.rank-a.rank).slice(0,6),categories=cats.filter(category=>normalizeSearch(category.name+' '+category.slug).includes(normalized)||normalized.split(' ').every(word=>normalizeSearch(category.name+' '+category.slug).includes(word))).slice(0,4),categoryMarkup=categories.length?'<div class="header-search-categories"><b>Категорії</b><div>'+categories.map(category=>'<a href="catalog.html?category='+encodeURIComponent(category.slug)+'">▦ '+escapeHtml(category.name)+'</a>').join('')+'</div></div>':'';results.innerHTML='<div class="header-search-results__head"><b>Знайдено: '+matches.length+(matches.length===6?'+':'')+'</b><span>за назвою, брендом або SKU</span></div>'+categoryMarkup+(matches.length?matches.map(({product})=>{const source=imageUrl(product),name=escapeHtml(product.name),brand=escapeHtml(product.brand||'TECHNOROOM');return '<a class="header-search-result" href="product.html?id='+product.id+'">'+(source?'<img src="'+escapeHtml(source)+'" alt="" draggable="false">':'<span class="header-search-result__placeholder">▣</span>')+'<span><b>'+name+'</b><small>'+brand+' · '+money(product.price)+'</small></span><em>'+availability(product).label+'</em></a>'}).join(''):'<p class="header-search-empty">Нічого не знайдено. Спробуйте назву, бренд або SKU.</p>')+'<button type="button" class="header-search-all">Переглянути всі результати для «'+escapeHtml(q)+'» →</button>';results.hidden=false;results.querySelector('.header-search-all')?.addEventListener('click',run)};
    const q=new URLSearchParams(location.search).get('search');if(q)search.value=q;
    search.addEventListener('input',showResults);search.addEventListener('focus',showResults);search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();run()}if(event.key==='Escape')results.hidden=true});
    document.addEventListener('pointerdown',event=>{if(!wrap?.contains(event.target))results.hidden=true});
  }
  if(go)go.onclick=run;
}
/* Статус «Під замовлення»: товар можна оформити без складського залишку. */
function availability(product) {
  if (product.availabilityStatus === 'limited_stock') return { label: 'Закінчується', button: 'У кошик', orderable: true };
  if (product.availabilityStatus === 'under_order') return { label: 'Під замовлення — уточнюйте термін', button: 'Уточнити наявність', orderable: false, inquiry: true };
  if (product.stock) return { label: 'В наявності', button: 'У кошик', orderable: true };
  return { label: 'Немає в наявності', button: 'Немає', orderable: false };
}

function openInquiry(id) {
  const item = get(Number(id));
  if (!item) return;
  let dialog = document.getElementById('productInquiryDialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'productInquiryDialog';
    dialog.className = 'inquiry-dialog';
    document.body.append(dialog);
  }
  const name = catalogCardEscape(compactProductName(item.name, item.sku, item.brand));
  dialog.innerHTML = '<form method="dialog" class="inquiry-form">'
    + '<button class="inquiry-close" value="cancel" aria-label="Закрити">×</button>'
    + '<p class="section-kicker">Товар під замовлення</p><h2>Уточнити наявність</h2>'
    + '<p class="inquiry-product"><b>' + name + '</b><span>SKU: ' + catalogCardEscape(item.sku || '—') + '</span></p>'
    + '<p>Залиште контакти — менеджер уточнить строк постачання та підтвердить ціну.</p>'
    + '<label>Ім’я<input name="name" required autocomplete="name" placeholder="Ваше ім’я"></label>'
    + '<label>Телефон<input name="phone" required autocomplete="tel" inputmode="tel" placeholder="+380 …"></label>'
    + '<label>Email <small>(необов’язково)</small><input name="email" type="email" autocomplete="email" placeholder="name@email.com"></label>'
    + '<label>Коментар <small>(необов’язково)</small><textarea name="comment" rows="3" placeholder="Наприклад, потрібна кількість або зручний час для дзвінка"></textarea></label>'
    + '<p class="inquiry-message" aria-live="polite"></p><button class="button product-buy" type="submit">Надіслати запит</button>'
    + '</form>';
  const form = dialog.querySelector('form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const message = form.querySelector('.inquiry-message');
    const data = Object.fromEntries(new FormData(form));
    button.disabled = true;
    message.textContent = 'Надсилаємо запит…';
    try {
      const response = await fetch('/api/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: item.id, customer: data }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Не вдалося надіслати запит');
      message.textContent = 'Запит №' + result.orderId + ' надіслано. Менеджер зв’яжеться з вами для уточнення терміну.';
      form.querySelectorAll('input, textarea, button:not(.inquiry-close)').forEach((control) => { control.disabled = true; });
    } catch (error) {
      message.textContent = error.message || 'Не вдалося надіслати запит. Спробуйте ще раз.';
      button.disabled = false;
    }
  });
  dialog.showModal();
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
// Дані постачальників іноді містять HTML-посилання або <br> замість звичайного
// тексту. У картці товару показуємо лише безпечний і читабельний вміст.
const specificationDisplayText = (value = '') => {
  let text = readableText(Array.isArray(value) ? value.join(', ') : value)
    .replace(/<br\s*\/?\s*>/gi, ' · ');
  const holder = document.createElement('div');
  holder.innerHTML = text;
  text = holder.textContent || holder.innerText || '';
  text = readableText(text).replace(/\s*·\s*(?:·\s*)+/g, ' · ');
  // У деяких XML у поле характеристики помилково потрапляє CSS або код віджета.
  if (/[{};]|(?:@media|iframe|display\s*:|container[-_:]|#\w+[\s\w-]*\{)/iu.test(text)) return '';
  return text;
};
const compactProductName = (value = '', sku = '', brand = '') => {
  let name = readableText(value).replace(/\s*[|•]\s*(?:код|sku|артикул|vendor code)\b.*$/iu, '').replace(/\s*\((?:код|sku|артикул)\s*[:#]?[^)]*\)/iu, '').replace(/\s{2,}/g, ' ').trim();
  if (/^телевізор\b/iu.test(name)) {
    const size = name.match(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:["″]|дюйм(?:ів|и|а)?\b)/iu)?.[1];
    const technology = [
      [/mini\s*-?\s*led/iu, 'miniLED'], [/oled/iu, 'OLED'], [/qled/iu, 'QLED'], [/\bled\b/iu, 'LED']
    ].find(([pattern]) => pattern.test(name))?.[1];
    const excludedModels = new Set(['4K', '8K', 'HDR', 'HDR10', 'HDMI', 'USB', 'WIFI', 'WI-FI', 'LED', 'OLED', 'QLED', 'MINILED', 'FULLHD']);
    const model = [...name.matchAll(/\b[A-ZА-ЯІЇЄ]{1,6}(?:[-_ ]?[A-Z0-9]{2,})+\b/g)]
      .map((match) => match[0]).find((candidate) => candidate.replace(/[-_ ]/g, '').length >= 5 && !excludedModels.has(candidate.replace(/[-_ ]/g, '').toUpperCase()));
    const cleanBrand = readableText(brand).replace(/\s+(?:tv|телевізори)$/iu, '').trim();
    const compact = ['Телевізор', size ? size.replace(',', '.') + '"' : '', cleanBrand, technology || '', model || ''].filter(Boolean).join(' ');
    if (compact) name = compact;
  }
  const parts = name.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  const startsWithProductType = /^(?:про[єе]ктор|телевізор|монітор|екран|саундбар|акустичн|гарнітур|навушник|мікрофон|портативн|зарядн|джерел|ноутбук|планшет|смартфон|годинник|принтер|роутер|камера|клавіатур|миша|кабель|адаптер|блокs+живлення|павербанк|powers*bank)/iu;
  const technicalTail = /\b(?:usb|hdmi|wifi|wi-fi|bluetooth|bt\s*\d|led|oled|qled|mini\s*-?\s*led|fhd|uhd|4k|8k|ips|va|tn|rgb|hdr|гб|gb|тб|tb|гц|hz|вт|w|лм|lm|кг|kg|м|mm\b|чорн|білий|сірий|silver|black|white|gray|grey)\b/iu;
  if (startsWithProductType.test(name) && parts.length >= 2 && (parts.length >= 3 || technicalTail.test(parts.slice(1).join(' ')))) name = parts[0];
  const normaliseToken = (text) => String(text || '').toLocaleLowerCase('uk-UA').replace(/[^\p{L}\p{N}]/gu, '');
  const cleanSku = readableText(sku);
  if (cleanSku && !normaliseToken(name).includes(normaliseToken(cleanSku))) name += ' — ' + cleanSku;
  return name || readableText(value);
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
  const promotion = promotionFor(product) || promotionByProductLink(product);
  const name = catalogCardEscape(compactProductName(product.name, product.sku, product.brand));
  const brand = catalogCardEscape(product.brand || 'TECHNOROOM');
  const source = imageUrl(product);
  const preview = source
    ? `<img src="${source}" alt="${name}" loading="lazy" draggable="false">`
    : '<div class="product-placeholder"><span>Фото товару<br>з’явиться незабаром</span></div>';

  const currentPrice = promotion ? salePrice(product) : Number(product.price);
  const promotionBadge = promotion ? '<span class="sale-badge">' + (promotion.discount_type === 'percent' ? '-' + Number(promotion.discount_value) + '%' : 'АКЦІЯ') + '</span>' : '';
  return `<article class="product product-card">
    ${promotionBadge}<a class="product-image ${product.type}" href="product.html?id=${product.id}" aria-label="Відкрити товар ${name}">${preview}</a>
    <div class="product-card-content">
      <div class="product-card-meta"><span>${brand}</span><span class="availability">${state.label}</span></div>
      <h3><a href="product.html?id=${product.id}">${name}</a></h3>
      ${promotion ? '<div class="promotion-name">🏷 Акція: <b>' + catalogCardEscape(promotion.name || 'Спеціальна пропозиція') + '</b></div>' : ''}
      <div class="product-footer"><div>${promotion ? '<del class="old-price">' + money(product.price) + '</del>' : ''}<strong class="price">${money(currentPrice)}</strong></div>${state.inquiry ? '<button class="add-button" data-inquiry="' + product.id + '">' + state.button + '</button>' : '<button class="add-button" data-add="' + product.id + '" ' + (state.orderable ? '' : 'disabled') + '>' + state.button + '</button>'}</div>
    </div>
  </article>`;
};
// Для проекційних екранів частина постачальників передає параметри лише в назві
// або описі. Витягуємо тільки однозначні значення й не змінюємо збережені дані.
const inferredScreenSpecifications = (product) => {
  if (product.type !== 'erc-display-06') return {};
  const source = readableText([product.name, product.description].filter(Boolean).join(' '));
  const result = {};
  const diagonal = source.match(/(?:^|\s)(\d{2,3}(?:[.,]\d+)?)\s*(?:["″]|дюйм(?:ів|и|а)?\b)/iu)?.[1];
  const format = source.match(/\b(1:1|4:3|16:9|16:10|21:9)\b/u)?.[1];
  const construction = source.match(/\b(настінн\w*|стельов\w*|підлогов\w*|на\s+тринозі|рамн\w*|рулонн\w*|натяжн\w*|переносн\w*)\b/iu)?.[1];
  const drive = source.match(/\b(моторизован\w*|ручн\w*)\b/iu)?.[1];
  if (diagonal) result['Діагональ'] = diagonal.replace(',', '.') + '″';
  if (format) result['Співвідношення сторін'] = format;
  if (construction) result['Тип екрану'] = construction;
  if (construction) result['Монтаж'] = construction;
  if (drive) result['Привід'] = /^моторизован/iu.test(drive) ? 'Моторизований' : 'Ручний';
  return result;
};
const isPhoneProduct = (product) => /(?:iphone|смартфон|smartphone|мобільн\w*\s+телефон)/iu.test(readableText([product.name, product.type, product.description].join(' ')));
const displaySpecificationEntries = (product) => {
  const stored = Object.entries(product.specifications || {})
    .map(([key, value]) => [readableText(key), specificationDisplayText(value)])
    .filter(([key, value]) => key && value);
  if (!stored.length) return Object.entries(inferredScreenSpecifications(product));
  return stored;
};

product = () => {
  const root=document.getElementById('productView'); if(!root)return;
  const item=get(new URLSearchParams(location.search).get('id'))||products[0]; if(!item)return;
  const state=availability(item);
  const safeName=catalogCardEscape(item.name), safeBrand=catalogCardEscape(item.brand||'TECHNOROOM');
  const specEntries=displaySpecificationEntries(item);
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
  products = data.map((item) => ({ id: item.id, sku: item.sku, name: compactProductName(item.name, item.sku, item.brand), description: item.description, price: Number(item.price), type: item.category, brand: item.brand, brand_id: item.brand_id, specifications: item.specifications, availabilityStatus: item.availability_status || ((item.in_stock && Number(item.stock_quantity || 0) > 0) ? 'in_stock' : 'out_of_stock'), stockQuantity: Number(item.stock_quantity || 0), stock: item.in_stock && Number(item.stock_quantity || 0) > 0, image: item.image_path }));
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
  const requestedId = Number(new URLSearchParams(location.search).get('id'));
  const item = requestedId ? get(requestedId) : products[0];
  if (!item) {
    root.innerHTML = productsLoaded
      ? '<div class="empty-cart"><b>Товар не знайдено або його приховано.</b><br><a href="catalog.html">Повернутися до каталогу →</a></div>'
      : '<p class="empty-cart">Завантажуємо товар…</p>';
    return;
  }
  document.title = compactProductName(item.name, item.sku) + ' | TECHNOROOM';
  const state = availability(item);
  const paths = galleryEntriesFor(item);
  const safe = (value) => catalogCardEscape(specificationDisplayText(value));
  const safeName = safe(compactProductName(item.name, item.sku));
  const safeBrand = safe(item.brand || 'TECHNOROOM');
  const specEntries = displaySpecificationEntries(item);
  const specs = specEntries.length
    ? specEntries.map(([key, value]) => '<div><dt>' + safe(key) + '</dt><dd>' + safe(Array.isArray(value) ? value.join(', ') : value) + '</dd></div>').join('')
    : '<div><dt>Характеристики</dt><dd>Уточнюйте у менеджера</dd></div>';
  const related = products.filter((product) => product.id !== item.id && product.type === item.type).slice(0, 4);
  const renderProductGallery = (activePath = paths[0]) => {
    const source = galleryImageUrl(item, activePath);
    const thumbs = paths.length > 1
      ? '<div class="product-gallery-thumbs" aria-label="Інші фото товару">' + paths.map((path, index) => '<button class="product-gallery-thumb ' + (path === activePath ? 'is-active' : '') + '" type="button" data-gallery-path="' + encodeURIComponent(path) + '" aria-label="Фото ' + (index + 1) + '"><img src="' + galleryImageUrl(item, path) + '" alt="' + safeName + ' — фото ' + (index + 1) + '" draggable="false"></button>').join('') + '</div>'
      : '';
    root.innerHTML = '<section class="product-showcase">'
      + '<div class="product-gallery-panel"><div class="product-detail-visual ' + safe(item.type) + '"><div class="product-image ' + safe(item.type) + '">' + (source ? '<img src="' + source + '" alt="' + safeName + '" draggable="false">' : '<div class="product-placeholder"><span>Фото товару<br>з’явиться незабаром</span></div>') + '</div><span class="product-photo-hint">Натисніть на фото, щоб збільшити</span></div>' + thumbs + '</div>'
      + '<div class="product-overview"><div class="product-topline"><a href="catalog.html?category=' + encodeURIComponent(item.type || '') + '" class="product-category-link">Каталог</a><span class="product-code">SKU: ' + safe(item.sku || '—') + ' · Код: ' + item.id + '</span></div>'
      + '<p class="product-brand">' + safeBrand + '</p><h1>' + safeName + '</h1>'
      + '<div class="product-buy-card"><div class="product-availability ' + (state.orderable || state.inquiry ? 'is-available' : 'is-unavailable') + '"><i></i><span>' + state.label + '</span></div>'
      + '<strong class="detail-price">' + money(item.price) + '</strong><p class="product-price-note">Ціна вказана за 1 одиницю товару</p>'
      + '<div class="detail-actions">' + (state.inquiry ? '<button class="button product-buy" data-inquiry="' + item.id + '">Уточнити наявність</button>' : '<button class="button product-buy" data-add="' + item.id + '" ' + (state.orderable ? '' : 'disabled') + '>' + (state.orderable ? 'Додати в кошик' : 'Немає в наявності') + '</button>') + '<a class="button product-back" href="catalog.html">До каталогу</a></div>'
      + '<div class="product-service-grid"><div><b>Доставка</b><span>Підберемо зручний спосіб</span></div><div><b>Гарантія</b><span>Офіційна техніка</span></div><div><b>Консультація</b><span>Допоможемо з вибором</span></div></div></div></div></section>'
      + '<section class="product-content-grid"><article class="product-description-card"><p class="section-kicker">Про товар</p><h2>Опис</h2><p>' + safe(item.description || 'Деталі та комплектацію уточнюйте у менеджера.') + '</p></article><article class="product-specs-card"><div class="product-section-heading"><div><p class="section-kicker">Технічні дані</p><h2>Характеристики</h2></div><span>' + (specEntries.length ? specEntries.length + ' параметрів' : '') + '</span></div><dl class="specs"><div><dt>Виробник</dt><dd>' + safeBrand + '</dd></div>' + specs + '</dl></article></section>'
      + (related.length ? '<section class="related-products"><div class="related-heading"><div><p class="section-kicker">Добірка</p><h2>Схожі товари</h2></div><a href="catalog.html?category=' + encodeURIComponent(item.type || '') + '">Переглянути всі →</a></div><div class="product-grid">' + related.map(card).join('') + '</div></section>' : '');
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


/* Каталог будується за реальним деревом категорій, а не за статичним списком у розмітці. */
let storefrontCategories = [];
let storefrontCategoriesRequest = null;
const legacyCategoryAliases = { projector: 'cat-projectors', audio: 'cat-audio', tv: 'cat-displays' };
const legacyCategoryChildren = {
  'cat-projectors': ['projector', 'laser-proj', 'home-projectors', 'short-throw-projectors', 'installation-projectors', 'universal-projectors', 'projection-screens'],
  'cat-audio': ['audio'],
  'cat-displays': ['tv']
};

const loadStorefrontCategories = async () => {
  if (storefrontCategoriesRequest) return storefrontCategoriesRequest;
  storefrontCategoriesRequest = supabase
    .from('categories')
    .select('id,name,slug,parent_id,sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name')
    .then(({ data, error }) => {
      storefrontCategories = error ? [] : (data || []).map((category) => ({ ...category, name: readableText(category.name) }));
      return storefrontCategories;
    })
    .catch(() => []);
  return storefrontCategoriesRequest;
};

const storefrontCategoryBranch = (slug) => {
  const resolved = legacyCategoryAliases[slug] || slug;
  const byParent = new Map();
  storefrontCategories.forEach((category) => {
    const children = byParent.get(category.parent_id) || [];
    children.push(category);
    byParent.set(category.parent_id, children);
  });
  const root = storefrontCategories.find((category) => category.slug === resolved);
  if (!root) return new Set([slug, resolved, ...(legacyCategoryChildren[resolved] || [])]);
  const branch = new Set([root.slug, ...(legacyCategoryChildren[root.slug] || [])]);
  const visit = (parentId) => (byParent.get(parentId) || []).forEach((child) => {
    branch.add(child.slug);
    visit(child.id);
  });
  visit(root.id);
  return branch;
};

const storefrontCategoryMatches = (product, slug) => storefrontCategoryBranch(slug).has(product.type);

const storefrontCategoryStyle = document.createElement('style');
storefrontCategoryStyle.textContent = '.catalog-taxonomy{margin:0 0 16px}.catalog-taxonomy__root{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left}.catalog-taxonomy__root b,.catalog-taxonomy__child b{color:#6d8c00;font-size:11px}.catalog-taxonomy__root.is-selected{color:#587900}.catalog-taxonomy__group{margin:0 0 3px}.catalog-taxonomy__root-row{display:grid;grid-template-columns:minmax(0,1fr) 32px;align-items:stretch}.catalog-taxonomy__toggle{border:0;border-left:1px solid #e3e8e5;background:transparent;color:#60706d;font-size:17px;cursor:pointer}.catalog-taxonomy__toggle:hover{background:#f1f5ef;color:#587900}.catalog-taxonomy__children{display:none;margin:1px 0 7px 15px;padding:3px 0 4px 14px;border-left:1px solid #d8ff37}.catalog-taxonomy__group.is-open .catalog-taxonomy__children{display:block}.catalog-taxonomy__group.is-open .catalog-taxonomy__toggle{color:#587900}.catalog-taxonomy__child{display:flex!important;align-items:center;justify-content:space-between;gap:8px;padding:8px 0!important;color:#60706d!important;font-size:12px!important}.catalog-taxonomy__child.is-selected{color:#587900!important}.catalog-taxonomy__child span:first-child{padding-right:8px}.catalog-taxonomy__empty{display:none}@media(max-width:780px){.catalog-taxonomy{display:flex;gap:8px;min-width:max-content}.catalog-taxonomy__group{display:contents}.catalog-taxonomy__root-row{display:flex}.catalog-taxonomy__children{display:none!important;position:absolute;z-index:5;margin:42px 0 0;padding:8px;border:1px solid var(--line);background:#fff}.catalog-taxonomy__group.is-open .catalog-taxonomy__children{display:block!important}.catalog-taxonomy__root,.catalog-taxonomy__child{min-width:max-content;width:auto!important;padding:8px 10px!important;border:1px solid var(--line)!important;background:#fff!important}.catalog-taxonomy__root b,.catalog-taxonomy__child b{display:none}.catalog-taxonomy__toggle{width:32px;border:1px solid var(--line);border-left:0}}';
document.head.append(storefrontCategoryStyle);

const renderStorefrontCategoryNavigation = (filters, selectedCategory) => {
  const refine = filters.querySelector('.catalog-refine');
  if (!refine || !storefrontCategories.length) return;
  filters.querySelectorAll('[data-category],.category-nest,.category-constellation,.catalog-taxonomy').forEach((node) => node.remove());

  const byParent = new Map();
  storefrontCategories.forEach((category) => {
    const children = byParent.get(category.parent_id) || [];
    children.push(category);
    byParent.set(category.parent_id, children);
  });
  const quantity = (slug) => products.filter((product) => storefrontCategoryMatches(product, slug)).length;
  const roots = storefrontCategories.filter((category) => !category.parent_id && quantity(category.slug));
  const navigation = document.createElement('div');
  navigation.className = 'catalog-taxonomy';
  const button = (category, child = false) => '<button type="button" class="' + (child ? 'catalog-taxonomy__child' : 'catalog-taxonomy__root') + (selectedCategory === category.slug ? ' is-selected' : '') + '" data-catalog-taxonomy="' + escapeHtml(category.slug) + '"><span>' + escapeHtml(category.name) + '</span><b>' + quantity(category.slug) + '</b></button>';
  const children = (parentId) => (byParent.get(parentId) || []).filter((category) => quantity(category.slug)).map((category) => button(category, true)).join('');
  const group = (category) => {
    const nested = children(category.id);
    const selectedInside = storefrontCategoryBranch(category.slug).has(selectedCategory);
    if (!nested) return button(category);
    return '<div class="catalog-taxonomy__group' + (selectedInside ? ' is-open' : '') + '"><div class="catalog-taxonomy__root-row">' + button(category) + '<button type="button" class="catalog-taxonomy__toggle" data-taxonomy-toggle aria-label="Показати підкатегорії" aria-expanded="' + (selectedInside ? 'true' : 'false') + '">' + (selectedInside ? '−' : '+') + '</button></div><div class="catalog-taxonomy__children">' + nested + '</div></div>';
  };
  navigation.innerHTML = '<button type="button" class="catalog-taxonomy__root' + (selectedCategory === 'all' ? ' is-selected' : '') + '" data-catalog-taxonomy="all"><span>Усі товари</span><b>' + products.length + '</b></button>' + roots.map(group).join('');
  refine.before(navigation);
};

catalog = function () {
  const root = document.getElementById('catalogGrid');
  const filters = document.querySelector('.filters');
  if (!root || !filters || root.dataset.catalogBound === 'true') {
    root?._catalogDraw?.();
    return;
  }

  root.dataset.catalogBound = 'true';
  const params = new URLSearchParams(location.search);
  const saleOnly = params.get('promo') === 'sale';
  const promotionOnly = Number(params.get('promotion') || 0);
  document.title = saleOnly ? 'Акційні товари | TECHNOROOM' : 'Каталог товарів | TECHNOROOM';
  const search = document.getElementById('catalogSearch') || { value: '' };
  const brand = document.getElementById('brandFilter');
  const price = document.getElementById('priceFilter');
  const stock = document.getElementById('stockFilter');
  const sort = document.getElementById('catalogSort');
  const pageSize = document.getElementById('catalogPageSize');
  const pagination = document.getElementById('catalogPagination');
  const priceMin = document.getElementById('priceMin');
  const screenSpecificationFilters = document.getElementById('screenSpecificationFilters');
  const screenCategory = 'erc-display-06';
  const selectedScreenSpecifications = new Map();
  const selectedLuminousFlux = { min: '', max: '' };
  const normaliseSpecificationKey = (value) => readableText(value)
    .toLocaleLowerCase('uk-UA')
    .replace(/[\s:]+$/g, '')
    .replace(/\s+/g, ' ');
  const screenSpecificationDefinitions = [
    { id: 'diagonal', label: 'Діагональ', keys: ['діагональ'], sort: (left, right) => Number.parseFloat(left) - Number.parseFloat(right) },
    { id: 'format', label: 'Формат екрана', keys: ['співвідношення сторін'] },
    { id: 'construction', label: 'Тип конструкції', keys: ['тип екрану'] },
    { id: 'mounting', label: 'Монтаж', keys: ['установка', 'встановлення', 'монтаж'] },
    {
      id: 'drive',
      label: 'Привід',
      keys: ['тип екрану'],
      values: (product) => {
        const type = specificationValues(product, ['тип екрану', 'привід']).join(' ').toLocaleLowerCase('uk-UA');
        return [
          ...(type.includes('моторизован') ? ['Моторизований'] : []),
          ...(type.includes('ручн') ? ['Ручний'] : [])
        ];
      }
    }
  ];
  let activeSpecificationDefinitions = [];
  const specificationValues = (product, keys) => {
    const stored = Object.entries(product.specifications || {})
      .filter(([key]) => keys.includes(normaliseSpecificationKey(key)))
      .flatMap(([, value]) => Array.isArray(value) ? value : [value])
      .map((value) => specificationDisplayText(value))
      .filter(Boolean);
    if (stored.length) return stored;
    const inferred = inferredScreenSpecifications(product);
    return Object.entries(inferred)
      .filter(([key]) => keys.includes(normaliseSpecificationKey(key)))
      .flatMap(([, value]) => Array.isArray(value) ? value : [value])
      .map((value) => specificationDisplayText(value))
      .filter(Boolean);
  };
  const valuesForScreenFilter = (product, definition) => definition.values
    ? definition.values(product)
    : specificationValues(product, definition.keys);
  const normaliseSpecificationValue = (value) => readableText(value)
    .replace(/(\d)\s*[хx×]\s*(\d)/giu, '$1 × $2')
    .replace(/\s+/gu, ' ')
    .trim();
  const normaliseLightSource = (value) => {
    const text = normaliseSpecificationValue(value);
    if (/laser|лазер/iu.test(text)) return 'Лазер';
    if (/led|світлодіод/iu.test(text)) return 'Світлодіод';
    if (/lamp|ламп/iu.test(text)) return 'Лампа';
    return '';
  };
  const luminousFluxFor = (product) => {
    const values = Object.entries(product.specifications || {})
      .filter(([key]) => /(?:світлов\w*\s+потік|яскравість|brightness)/iu.test(readableText(key)))
      .flatMap(([, value]) => Array.isArray(value) ? value : [value]);
    const source = values.length ? values.join(' ') : readableText([product.name, product.description].join(' '));
    const match = String(source).match(values.length ? /\b(\d{2,5})\b/u : /\b(\d{2,5})\s*(?:лм|lm)\b/iu);
    return match ? Number(match[1]) : null;
  };
  const luminousFluxRange = (categoryProducts) => {
    const values = categoryProducts.map(luminousFluxFor).filter(Number.isFinite);
    const min = Math.min(...values), max = Math.max(...values);
    return values.length >= 2 && min !== max ? { min, max } : null;
  };
  const genericSpecificationDefinitions = (categoryProducts) => {
    const byKey = new Map();
    const mainSpecificationPriority = (key) => {
      if (/роздільн/u.test(key)) return 1;
      if (/(?:джерел\w*\s+світла|тип\s+джерела)/u.test(key)) return 2;
      if (/тип\s*(?:екрана|матриці|конструкції|підключення)?|формат/u.test(key)) return 3;
      if (/потужність|ємність|автономн/u.test(key)) return 4;
      if (/колір/u.test(key)) return 5;
      return 0;
    };
    categoryProducts.forEach((product) => {
      const entries = [
        ...Object.entries(product.specifications || {}),
        ...(product.type === screenCategory ? Object.entries(inferredScreenSpecifications(product)) : [])
      ];
      const seen = new Set();
      entries.forEach(([rawKey, rawValue]) => {
        const key = normaliseSpecificationKey(rawKey);
        const label = readableText(rawKey);
        const invalidLabel = !/[\p{L}]/u.test(label) || /^[\d\s.,:×x-]+$/u.test(label);
        const excludedKey = /(?:sku|артикул|код|модель|id|ean|epr|energy|label|nfc|wi-?fi|bluetooth|інтерфейс|підключенн|з'єднан|бездротов|сері[яї]|вага|висота|ширина|довжина|глибина|проекційн\w*\s*(?:віднош|коеф)|технолог\w*\s*(?:проекц|display)|світлов\w*\s+потік|яскравість|brightness)/iu.test(key);
        const priority = mainSpecificationPriority(key);
        if (!key || !label || invalidLabel || excludedKey || !priority || seen.has(key)) return;
        seen.add(key);
        const isLightSource = /(?:джерел\w*\s+світла|тип\s+джерела)/iu.test(key);
        const values = (Array.isArray(rawValue) ? rawValue : [rawValue]).map(isLightSource ? normaliseLightSource : normaliseSpecificationValue).filter((value) => value && value.length <= 48 && !/[<>]|https?:\/\/|href\s*=/iu.test(value) && !/^(?:-|—|–|n\/?a|немає)$/iu.test(value));
        if (!values.length) return;
        const group = byKey.get(key) || { id: 'spec-' + key, label, keys: [key], priority, normaliseValue: isLightSource ? normaliseLightSource : normaliseSpecificationValue, values: new Map(), products: new Set() };
        values.forEach((value) => group.values.set(value.toLocaleLowerCase('uk-UA'), value));
        group.products.add(product.id);
        byKey.set(key, group);
      });
    });
    return [...byKey.values()]
      .filter((group) => group.products.size >= 3 && group.values.size >= 2 && group.values.size <= 10)
      .sort((left, right) => left.priority - right.priority || right.products.size - left.products.size || left.label.localeCompare(right.label, 'uk'))
      .slice(0, 3)
      .map((group) => ({ ...group, options: [...group.values.values()].sort((left, right) => left.localeCompare(right, 'uk')) }));
  };
  const projectorTechnologyValues = (product) => {
    const source = specificationValues(product, ['технологія', 'технологія проекції', 'projection technology']).join(' ');
    return [
      ...( /dlp/iu.test(source) ? ['DLP'] : []),
      ...( /(?:3lcd|\blcd\b)/iu.test(source) ? ['LCD'] : [])
    ];
  };
  const projectorResolutionValues = (product) => {
    const source = specificationValues(product, ['роздільна здатність', 'resolution']).join(' ');
    const normalized = normaliseSpecificationValue(source).toUpperCase().replace(/\s+/g, '');
    if (/3840\s*[×XХ]\s*2160|\b4K\b|\bUHD\b/.test(source.toUpperCase())) return ['4K UHD'];
    if (/2560\s*[×XХ]\s*1600|\bWQXGA\b/.test(source.toUpperCase())) return ['WQXGA'];
    if (/1920\s*[×XХ]\s*1200|\bWUXGA\b/.test(source.toUpperCase())) return ['WUXGA'];
    if (/1920\s*[×XХ]\s*1080|FULL\s*HD|\bFHD\b/.test(source.toUpperCase())) return ['Full HD'];
    if (/1280\s*[×XХ]\s*800|\bWXGA\b/.test(source.toUpperCase())) return ['WXGA'];
    if (/1024\s*[×XХ]\s*768|\bXGA\b/.test(source.toUpperCase())) return ['XGA'];
    if (/800\s*[×XХ]\s*600|\bSVGA\b/.test(source.toUpperCase())) return ['SVGA'];
    return normalized ? [normaliseSpecificationValue(source)] : [];
  };
  const projectorFilterOptions = (categoryProducts) => {
    const definitions = [
      { id: 'projector-technology', label: 'Технологія', values: projectorTechnologyValues, normaliseValue: normaliseSpecificationValue },
      { id: 'projector-resolution', label: 'Роздільна здатність', values: projectorResolutionValues, normaliseValue: normaliseSpecificationValue },
      { id: 'projector-light-source', label: 'Джерело світла', keys: ['джерело світла', 'тип джерела'], values: (product) => specificationValues(product, ['джерело світла', 'тип джерела']).map(normaliseLightSource), normaliseValue: normaliseLightSource }
    ];
    return definitions.map((definition) => {
      const values = new Set();
      categoryProducts.forEach((product) => valuesForScreenFilter(product, definition).filter(Boolean).forEach((value) => values.add((definition.normaliseValue || normaliseSpecificationValue)(value))));
      const options = [...values].filter(Boolean).sort((left, right) => left.localeCompare(right, 'uk'));
      return options.length >= 2 ? { ...definition, options } : null;
    }).filter(Boolean);
  };
  const televisionSource = (product, keys = []) => {
    const stored = keys.length ? specificationValues(product, keys).join(' ') : '';
    return readableText([stored, product.name, product.description].filter(Boolean).join(' '));
  };
  const televisionDiagonalValues = (product) => {
    const source = televisionSource(product, ['діагональ']);
    const value = source.match(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:["″]|дюйм(?:ів|и|а)?\b)/iu)?.[1];
    return value ? [value.replace(',', '.') + '"'] : [];
  };
  const televisionResolutionValues = (product) => {
    const source = televisionSource(product, ['роздільна здатність', 'resolution']);
    const match = source.match(/\b(?:\d{3,4}\s*[×xх]\s*\d{3,4}|8k|4k|uhd|full\s*hd|fhd|hd)\b/iu)?.[0];
    if (!match) return [];
    const normalized = normaliseSpecificationValue(match).toUpperCase().replace(/\s+/g, '');
    if (/^(?:3840×2160|4K|UHD|4KUHD)$/.test(normalized)) return ['4K UHD'];
    if (/^(?:7680×4320|8K|8KUHD)$/.test(normalized)) return ['8K UHD'];
    if (/^(?:1920×1080|FHD|FULLHD)$/.test(normalized)) return ['Full HD'];
    if (/^(?:1366×768|1280×720|HD)$/.test(normalized)) return ['HD'];
    return [normaliseSpecificationValue(match)];
  };
  const televisionPanelValues = (product) => {
    const source = televisionSource(product, ['тип матриці', 'матриця', 'технологія дисплею', 'тип екрану']);
    if (/mini\s*-?\s*led/iu.test(source)) return ['miniLED'];
    if (/oled/iu.test(source)) return ['OLED'];
    if (/qled/iu.test(source)) return ['QLED'];
    if (/\bled\b/iu.test(source)) return ['LED'];
    if (/\blcd\b/iu.test(source)) return ['LCD'];
    return [];
  };
  const televisionRefreshValues = (product) => {
    const source = televisionSource(product, ['частота оновлення', 'частота', 'refresh rate']);
    const value = source.match(/\b(\d{2,3})\s*(?:гц|hz)\b/iu)?.[1];
    return value ? [value + ' Гц'] : [];
  };
  const televisionSmartValues = (product) => /(?:smart\s*tv|google\s*tv|android\s*tv|webos|tizen|vidaa)/iu.test(televisionSource(product)) ? ['Є Smart TV'] : [];
  const televisionFilterOptions = (categoryProducts) => {
    const definitions = [
      { id: 'tv-diagonal', label: 'Діагональ екрана', values: televisionDiagonalValues, normaliseValue: normaliseSpecificationValue },
      { id: 'tv-resolution', label: 'Роздільна здатність', values: televisionResolutionValues, normaliseValue: normaliseSpecificationValue },
      { id: 'tv-panel', label: 'Тип матриці', values: televisionPanelValues, normaliseValue: normaliseSpecificationValue },
      { id: 'tv-refresh', label: 'Частота оновлення', values: televisionRefreshValues, normaliseValue: normaliseSpecificationValue },
      { id: 'tv-smart', label: 'Smart TV', values: televisionSmartValues, normaliseValue: normaliseSpecificationValue, allowSingle: true }
    ];
    return definitions.map((definition) => {
      const values = new Set();
      categoryProducts.forEach((product) => definition.values(product).filter(Boolean).forEach((value) => values.add((definition.normaliseValue || normaliseSpecificationValue)(value))));
      const options = [...values].filter(Boolean).sort((left, right) => left.localeCompare(right, 'uk', { numeric: true }));
      return options.length && (definition.allowSingle || options.length >= 2) ? { ...definition, options } : null;
    }).filter(Boolean);
  };
  const phoneSource = (product, keyPattern, includeName = false) => [
    ...Object.entries(product.specifications || {})
      .filter(([key]) => keyPattern.test(readableText(key)))
      .flatMap(([, value]) => Array.isArray(value) ? value : [value]),
    ...(includeName ? [product.name] : [])
  ].map(specificationDisplayText).filter(Boolean).join(' ');
  const phoneDiagonalValues = (product) => {
    const source = phoneSource(product, /(?:діагональ|розмір).*(?:екран|диспле)|(?:екран|диспле).*(?:діагональ|розмір)/iu, true);
    const match = source.match(/\b(\d(?:[.,]\d{1,2})?)\s*(?:["″]|дюйм)/iu);
    return match ? [match[1].replace(',', '.') + '″'] : [];
  };
  const phoneStorageValues = (product) => {
    const source = phoneSource(product, /(?:вбудован|внутрішн|загальн).*(?:пам.?ят|storage)|(?:пам.?ят|storage).*(?:вбудован|внутрішн|загальн)/iu, true);
    const match = source.match(/\b(\d+(?:[.,]\d+)?)\s*(gb|гб|tb|тб)\b/iu);
    if (!match) return [];
    return [match[1].replace(',', '.') + ' ' + (/tb|тб/iu.test(match[2]) ? 'ТБ' : 'ГБ')];
  };
  const phoneRamValues = (product) => {
    const source = phoneSource(product, /(?:оперативн.*пам.?ят|\bram\b)/iu);
    const match = source.match(/\b(\d+(?:[.,]\d+)?)\s*(gb|гб)\b/iu);
    return match ? [match[1].replace(',', '.') + ' ГБ'] : [];
  };
  const phoneDisplayValues = (product) => {
    const source = phoneSource(product, /(?:технолог.*диспле|тип.*диспле|матриц)/iu);
    const matched = /(super\s*amoled|amoled|oled|ips|lcd)/iu.exec(source)?.[1];
    return matched ? [matched.replace(/\s+/g, ' ').toUpperCase()] : [];
  };
  const phoneColorValues = (product) => {
    const source = phoneSource(product, /(?:колір|color)/iu);
    return source && source.length <= 42 ? [source] : [];
  };
  const phoneFilterOptions = (categoryProducts) => {
    const definitions = [
      { id: 'phone-diagonal', label: 'Діагональ екрана', values: phoneDiagonalValues },
      { id: 'phone-storage', label: 'Вбудована пам’ять', values: phoneStorageValues },
      { id: 'phone-ram', label: 'Оперативна пам’ять', values: phoneRamValues },
      { id: 'phone-display', label: 'Тип дисплея', values: phoneDisplayValues },
      { id: 'phone-color', label: 'Колір', values: phoneColorValues }
    ];
    return definitions.map((definition) => {
      const values = new Set();
      categoryProducts.forEach((product) => definition.values(product).filter(Boolean).forEach((value) => values.add(normaliseSpecificationValue(value))));
      const options = [...values].filter(Boolean).sort((left, right) => left.localeCompare(right, 'uk', { numeric: true }));
      return options.length >= 2 ? { ...definition, options, normaliseValue: normaliseSpecificationValue } : null;
    }).filter(Boolean);
  };
  // Для великих категорій показуємо лише параметри, за якими покупці зазвичай
  // обирають техніку. Службові поля постачальника сюди не потрапляють.
  const compactFilterOptions = (categoryProducts, definitions) => definitions.map((definition) => {
    const values = new Set();
    categoryProducts.forEach((product) => definition.values(product).filter(Boolean).forEach((value) => values.add(normaliseSpecificationValue(value))));
    const options = [...values].filter(Boolean).sort((left, right) => left.localeCompare(right, 'uk', { numeric: true }));
    return options.length >= 2 ? { ...definition, options, normaliseValue: normaliseSpecificationValue } : null;
  }).filter(Boolean);
  const deviceSource = (product, keyPattern, includeName = false) => [
    ...Object.entries(product.specifications || {})
      .filter(([key]) => keyPattern.test(readableText(key)))
      .flatMap(([, value]) => Array.isArray(value) ? value : [value]),
    ...(includeName ? [product.name, product.description] : [])
  ].map(specificationDisplayText).filter(Boolean).join(' ');
  const deviceDiagonalValues = (product) => {
    const source = deviceSource(product, /(?:діагональ|розмір).*(?:екран|диспле)|(?:екран|диспле).*(?:діагональ|розмір)/iu, true);
    const match = source.match(/\b(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:["″]|дюйм)/iu);
    return match ? [match[1].replace(',', '.') + '″'] : [];
  };
  const deviceStorageValues = (product) => {
    const source = deviceSource(product, /(?:вбудован|внутрішн|накопичувач|ssd|storage|пам.?ят)/iu, true);
    const values = [...source.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(gb|гб|tb|тб)\b/giu)]
      .map((match) => ({ amount: Number(match[1].replace(',', '.')), unit: match[2] }));
    const largest = values.sort((left, right) => right.amount * (/tb|тб/iu.test(right.unit) ? 1024 : 1) - left.amount * (/tb|тб/iu.test(left.unit) ? 1024 : 1))[0];
    return largest && largest.amount >= 32 ? [largest.amount + ' ' + (/tb|тб/iu.test(largest.unit) ? 'ТБ' : 'ГБ')] : [];
  };
  const deviceRamValues = (product) => {
    const source = deviceSource(product, /(?:оперативн.*пам.?ят|\bram\b)/iu);
    const match = source.match(/\b(\d+(?:[.,]\d+)?)\s*(gb|гб)\b/iu);
    return match ? [match[1].replace(',', '.') + ' ГБ'] : [];
  };
  const deviceResolutionValues = (product) => {
    const source = deviceSource(product, /(?:роздільн.*здатн|resolution)/iu, true);
    const match = source.match(/\b\d{3,4}\s*[×xх]\s*\d{3,4}\b/iu)?.[0];
    return match ? [normaliseSpecificationValue(match)] : [];
  };
  const deviceRefreshValues = (product) => {
    const source = deviceSource(product, /(?:частота.*(?:оновлення|розгорт)|refresh)/iu, true);
    const match = source.match(/\b(\d{2,3})\s*(?:гц|hz)\b/iu)?.[1];
    return match ? [match + ' Гц'] : [];
  };
  const devicePanelValues = (product) => {
    const source = deviceSource(product, /(?:тип.*(?:матриц|екран|диспле)|технолог.*диспле|panel)/iu, true);
    const value = /mini\s*-?\s*led|oled|ips|va|tn|amoled|lcd/iu.exec(source)?.[0];
    return value ? [value.replace(/\s+/g, ' ').toUpperCase()] : [];
  };
  const deviceProcessorValues = (product) => {
    const source = deviceSource(product, /(?:процесор|processor|cpu|чип)/iu, true);
    const value = /(apple\s+m\d(?:\s+(?:pro|max|ultra))?|intel\s+core\s+i[3-9]|intel\s+core\s+ultra|amd\s+ryzen\s+\d|snapdragon\s+\d+)/iu.exec(source)?.[0];
    return value ? [value.replace(/\s+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())] : [];
  };
  const laptopFilterOptions = (categoryProducts) => compactFilterOptions(categoryProducts, [
    { id: 'laptop-diagonal', label: 'Діагональ екрана', values: deviceDiagonalValues },
    { id: 'laptop-processor', label: 'Процесор', values: deviceProcessorValues },
    { id: 'laptop-ram', label: 'Оперативна пам’ять', values: deviceRamValues },
    { id: 'laptop-storage', label: 'Накопичувач', values: deviceStorageValues }
  ]);
  const tabletFilterOptions = (categoryProducts) => compactFilterOptions(categoryProducts, [
    { id: 'tablet-diagonal', label: 'Діагональ екрана', values: deviceDiagonalValues },
    { id: 'tablet-storage', label: 'Вбудована пам’ять', values: deviceStorageValues },
    { id: 'tablet-ram', label: 'Оперативна пам’ять', values: deviceRamValues },
    { id: 'tablet-panel', label: 'Тип дисплея', values: devicePanelValues }
  ]);
  const monitorFilterOptions = (categoryProducts) => compactFilterOptions(categoryProducts, [
    { id: 'monitor-diagonal', label: 'Діагональ екрана', values: deviceDiagonalValues },
    { id: 'monitor-resolution', label: 'Роздільна здатність', values: deviceResolutionValues },
    { id: 'monitor-panel', label: 'Тип матриці', values: devicePanelValues },
    { id: 'monitor-refresh', label: 'Частота оновлення', values: deviceRefreshValues }
  ]);
  const screenFilterOptions = () => {
    const categoryProducts = products.filter((product) => category !== 'all' && storefrontCategoryMatches(product, category));
    if (!categoryProducts.length) return [];
    if (category === screenCategory) {
      return screenSpecificationDefinitions.map((definition) => {
        const values = new Set();
        categoryProducts.forEach((product) => valuesForScreenFilter(product, definition).forEach((value) => values.add(value)));
        const options = [...values].sort(definition.sort || ((left, right) => left.localeCompare(right, 'uk')));
        return options.length ? { ...definition, options } : null;
      }).filter(Boolean);
    }
    const phoneProducts = categoryProducts.filter((product) => isPhoneProduct(product));
    if (/(?:смартфон|телефон|phone)/iu.test(category) || phoneProducts.length >= Math.max(2, categoryProducts.length * 0.7)) return phoneFilterOptions(phoneProducts.length ? phoneProducts : categoryProducts);
    const projectorProducts = categoryProducts.filter((product) => /(?:про[єе]ктор|projector)/iu.test(readableText(product.name) + ' ' + readableText(product.type)));
    if (/(?:про[єе]ктор|projector)/iu.test(category) || projectorProducts.length >= Math.max(2, categoryProducts.length * 0.7)) return projectorFilterOptions(projectorProducts.length ? projectorProducts : categoryProducts);
    const televisionProducts = categoryProducts.filter((product) => /(?:телевізор|\btv\b)/iu.test(readableText(product.name) + ' ' + readableText(product.type)));
    if (/(?:телевізор|\btv\b)/iu.test(category) || televisionProducts.length >= Math.max(2, categoryProducts.length * 0.7)) return televisionFilterOptions(televisionProducts.length ? televisionProducts : categoryProducts);
    const monitorProducts = categoryProducts.filter((product) => /(?:монітор|monitor)/iu.test(readableText(product.name) + ' ' + readableText(product.type)));
    if (/(?:монітор|monitor)/iu.test(category) || monitorProducts.length >= Math.max(2, categoryProducts.length * 0.7)) return monitorFilterOptions(monitorProducts.length ? monitorProducts : categoryProducts);
    const tabletProducts = categoryProducts.filter((product) => /(?:планшет|tablet|ipad)/iu.test(readableText(product.name) + ' ' + readableText(product.type)));
    if (/(?:планшет|tablet|ipad)/iu.test(category) || tabletProducts.length >= Math.max(2, categoryProducts.length * 0.7)) return tabletFilterOptions(tabletProducts.length ? tabletProducts : categoryProducts);
    const laptopProducts = categoryProducts.filter((product) => /(?:ноутбук|laptop|macbook)/iu.test(readableText(product.name) + ' ' + readableText(product.type)));
    if (/(?:ноутбук|laptop|macbook)/iu.test(category) || laptopProducts.length >= Math.max(2, categoryProducts.length * 0.7)) return laptopFilterOptions(laptopProducts.length ? laptopProducts : categoryProducts);
    return genericSpecificationDefinitions(categoryProducts);
  };
  const renderScreenSpecificationFilters = () => {
    if (!screenSpecificationFilters) return;
    const categoryProducts = products.filter((product) => category !== 'all' && storefrontCategoryMatches(product, category));
    const projectorProducts = categoryProducts.filter((product) => /(?:про[єе]ктор|projector)/iu.test(readableText(product.name) + ' ' + readableText(product.type)));
    const fluxRange = projectorProducts.length >= Math.max(2, categoryProducts.length * 0.7) ? luminousFluxRange(projectorProducts) : null;
    const groups = screenFilterOptions();
    activeSpecificationDefinitions = groups;
    if (!groups.length && !fluxRange) {
      selectedScreenSpecifications.clear();
      selectedLuminousFlux.min = ''; selectedLuminousFlux.max = '';
      screenSpecificationFilters.hidden = true;
      screenSpecificationFilters.replaceChildren();
      return;
    }
    const available = new Map(groups.map((group) => [group.id, new Set(group.options)]));
    selectedScreenSpecifications.forEach((values, id) => {
      const valid = new Set([...values].filter((value) => available.get(id)?.has(value)));
      if (valid.size) selectedScreenSpecifications.set(id, valid); else selectedScreenSpecifications.delete(id);
    });
    screenSpecificationFilters.hidden = false;
    const fluxMarkup = fluxRange
      ? '<fieldset class="screen-specification-filter luminous-flux-filter"><legend>Яскравість, лм</legend><div class="price-values"><input type="number" min="' + fluxRange.min + '" max="' + fluxRange.max + '" placeholder="Від ' + fluxRange.min + '" value="' + selectedLuminousFlux.min + '" data-luminous-flux="min"><input type="number" min="' + fluxRange.min + '" max="' + fluxRange.max + '" placeholder="До ' + fluxRange.max + '" value="' + selectedLuminousFlux.max + '" data-luminous-flux="max"></div></fieldset>'
      : '';
    screenSpecificationFilters.innerHTML = fluxMarkup + groups.map((group) => {
      const selected = selectedScreenSpecifications.get(group.id) || new Set();
      return '<fieldset class="screen-specification-filter"><legend>' + escapeHtml(group.label) + '</legend><div class="screen-specification-filter__options">'
        + group.options.map((value) => '<label><input type="checkbox" data-screen-specification="' + escapeHtml(group.id) + '" value="' + escapeHtml(value) + '"' + (selected.has(value) ? ' checked' : '') + '> <span>' + escapeHtml(value) + '</span></label>').join('')
        + '</div></fieldset>';
    }).join('');
  };
  const matchesSelectedScreenSpecifications = (product) => [...selectedScreenSpecifications].every(([id, selected]) => {
    const definition = activeSpecificationDefinitions.find((item) => item.id === id);
    return !definition || valuesForScreenFilter(product, definition).some((value) => selected.has(value) || selected.has((definition.normaliseValue || normaliseSpecificationValue)(value)));
  });
  const matchesLuminousFlux = (product) => {
    if (!selectedLuminousFlux.min && !selectedLuminousFlux.max) return true;
    const value = luminousFluxFor(product);
    return Number.isFinite(value) && (!selectedLuminousFlux.min || value >= Number(selectedLuminousFlux.min)) && (!selectedLuminousFlux.max || value <= Number(selectedLuminousFlux.max));
  };
  let page = 1;
  let category = legacyCategoryAliases[params.get('category')] || params.get('category') || 'all';
  if (params.get('search')) search.value = params.get('search');

  const draw = () => {
    renderScreenSpecificationFilters();
    const categoryProducts = products.filter((product) => category === 'all' || storefrontCategoryMatches(product, category));
    const brands = [...new Map(categoryProducts.map((product) => cleanBrand(product.brand)).filter(Boolean).map((value) => [value.toLocaleLowerCase('uk-UA'), value])).values()].sort((left, right) => left.localeCompare(right, 'uk'));
    const selectedBrand = brand.value;
    brand.innerHTML = '<option value="">Усі бренди</option>' + brands.map((value) => '<option value="' + escapeHtml(value) + '">' + escapeHtml(readableText(value)) + '</option>').join('');
    if (brands.includes(selectedBrand)) brand.value = selectedBrand;
    const terms = readableText(search.value).toLocaleLowerCase('uk-UA').replace(/є/g, 'е').split(/\s+/).filter(Boolean);
    let shown = products.filter((product) => {
      const promotion = promotionFor(product) || promotionByProductLink(product);
      const searchable = readableText([product.name, product.brand, product.sku, product.description].join(' ')).toLocaleLowerCase('uk-UA').replace(/є/g, 'е');
      return (category === 'all' || storefrontCategoryMatches(product, category))
        && (!saleOnly || Boolean(promotion))
        && (!promotionOnly || Number(promotion?.id) === promotionOnly)
        && (!terms.length || terms.every((term) => searchable.includes(term)))
        && (!brand.value || cleanBrand(product.brand) === brand.value)
        && (!priceMin?.value || Number(product.price) >= Number(priceMin.value))
        && (!price.value || Number(product.price) <= Number(price.value))
        && (!stock.checked || product.stock)
        && matchesSelectedScreenSpecifications(product)
        && matchesLuminousFlux(product);
    });
    // Товари, які можна купити зараз, завжди мають бути над недоступними.
    // Вибране сортування працює вже всередині кожної групи наявності.
    const availabilityRank = (product) => {
      if (product.availabilityStatus === 'limited_stock') return 1;
      if (product.availabilityStatus === 'under_order') return 2;
      if (product.stock) return 0;
      return 3;
    };
    const secondarySort = (left, right) => {
      if (sort.value === 'price-asc') return left.price - right.price;
      if (sort.value === 'price-desc') return right.price - left.price;
      if (sort.value === 'name') return left.name.localeCompare(right.name, 'uk');
      return 0;
    };
    shown.sort((left, right) => availabilityRank(left) - availabilityRank(right) || secondarySort(left, right));
    const size = Number(pageSize?.value || 12);
    const pages = Math.max(1, Math.ceil(shown.length / size));
    page = Math.min(page, pages);
    const visible = shown.slice((page - 1) * size, page * size);
    root.innerHTML = visible.length ? visible.map(card).join('') : '<p class="empty-cart">За цими параметрами товарів не знайдено.</p>';
    document.getElementById('resultCount').textContent = shown.length + ' товарів';
    if (pagination) {
      pagination.hidden = pages <= 1;
      pagination.innerHTML = pages > 1 ? '<button type="button" data-catalog-page="prev" '+(page === 1 ? 'disabled' : '')+'>← Попередні</button><span>Сторінка '+page+' з '+pages+'</span><button type="button" data-catalog-page="next" '+(page === pages ? 'disabled' : '')+'>Наступні →</button>' : '';
    }
    bind(root);
  };

  root._catalogDraw = draw;
  screenSpecificationFilters?.addEventListener('change', (event) => {
    const luminous = event.target.closest('[data-luminous-flux]');
    if (luminous) {
      selectedLuminousFlux[luminous.dataset.luminousFlux] = luminous.value;
      page = 1;
      draw();
      return;
    }
    const input = event.target.closest('[data-screen-specification]');
    if (!input) return;
    const selected = selectedScreenSpecifications.get(input.dataset.screenSpecification) || new Set();
    if (input.checked) selected.add(input.value); else selected.delete(input.value);
    if (selected.size) selectedScreenSpecifications.set(input.dataset.screenSpecification, selected); else selectedScreenSpecifications.delete(input.dataset.screenSpecification);
    page = 1;
    draw();
  });
  filters.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-taxonomy-toggle]');
    if (toggle) {
      const group = toggle.closest('.catalog-taxonomy__group');
      const opened = group.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(opened));
      toggle.textContent = opened ? '−' : '+';
      return;
    }
    const button = event.target.closest('[data-catalog-taxonomy]');
    if (!button) return;
    category = button.dataset.catalogTaxonomy;
    selectedScreenSpecifications.clear();
    selectedLuminousFlux.min = ''; selectedLuminousFlux.max = '';
    page = 1;
    const url = new URL(location.href);
    if (category === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', category);
    history.replaceState({}, '', url);
    draw();
  });
  [search, brand, price, priceMin, stock, sort, pageSize].filter(Boolean).forEach((field) => field.addEventListener(field === stock || field === brand || field === sort || field === pageSize ? 'change' : 'input', () => { page = 1; draw(); }));
  pagination?.addEventListener('click', (event) => {
    const control = event.target.closest('[data-catalog-page]');
    if (!control) return;
    page += control.dataset.catalogPage === 'next' ? 1 : -1;
    draw();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('clearCatalogFilters').addEventListener('click', () => {
    search.value = ''; brand.value = ''; price.value = ''; if(priceMin) priceMin.value = '0'; stock.checked = false; sort.value = 'popular'; selectedScreenSpecifications.clear(); selectedLuminousFlux.min = ''; selectedLuminousFlux.max = ''; page = 1; draw();
  });
  draw();
  loadStorefrontCategories().then(() => draw());
};
