import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const supabase=createClient(window.TECHNOROOM_SUPABASE.url,window.TECHNOROOM_SUPABASE.publishableKey);
const state={products:[],orders:[],categories:[],brands:[],promotions:[],banners:[],page:1,brandPage:1,selectedProducts:new Set(),categoryTreeOpen:new Set()};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
// Product data often contains long descriptions and many specifications. Keep the
// editor wide enough to make those fields practical without affecting other dialogs.
const productDialogStyle=document.createElement('style');
productDialogStyle.textContent=`
#productDialog{box-sizing:border-box;width:min(980px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow-x:hidden;overflow-y:auto}
#productDialog form{box-sizing:border-box;width:100%;padding:30px 34px}
#productDialog .dialog-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 20px}
#productDialog label{min-width:0}
#productDialog input,#productDialog select,#productDialog textarea{box-sizing:border-box;max-width:100%}
#productDialog textarea{min-height:150px;resize:vertical}
#productDialog .projector-editor-fields{margin:4px 0 18px;padding:16px;border:1px solid #dbe6f3;border-radius:12px;background:#f8fbff}
#productDialog .projector-editor-fields legend{padding:0 6px;font-weight:800;color:#102d53}
#productDialog .projector-editor-fields__grid{display:grid;grid-template-columns:2fr 1fr;gap:14px 20px;align-items:start}
#productDialog .projector-editor-fields__options{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:8px}
#productDialog .projector-editor-fields__options label{display:flex;align-items:center;gap:6px;font-size:14px}
#productDialog .projector-editor-fields small{display:block;margin-top:10px;color:#60748c;line-height:1.4}
@media(max-width:700px){#productDialog .projector-editor-fields__grid{grid-template-columns:1fr}}
@media(max-width:700px){#productDialog{width:calc(100vw - 20px);max-height:calc(100vh - 20px)}#productDialog form{padding:20px}#productDialog .dialog-grid{grid-template-columns:1fr}}
`;
document.head.append(productDialogStyle);
const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const txt=(v='')=>String(v??'').toLocaleLowerCase('uk-UA').replace(/[ʼ'’`]/g,'').replace(/[\s_\-–—/.,]+/g,'');
const canonicalBrandNames={"2e":"2E",acer:"Acer",asus:"ASUS",dell:"Dell",digitus:"DIGITUS",epos:"EPOS",fsp:"FSP",legrand:"Legrand",ledvance:"LEDVANCE",lg:"LG",msi:"MSI",oneplus:"OnePlus",philips:"Philips",samsung:"Samsung",sony:"Sony",tcl:"TCL"};
const canonicalBrandName=(v='')=>{const name=String(v??'').replace(/\s+/g,' ').trim(),root=name.replace(/\s+(?:accessories|audio|displays|energy(?:\s+ups)?|gaming|lfd|mobile|monitors|mounts|multimedia|retail|screens|scs|tv|ups)\s*$/i,'').trim();return canonicalBrandNames[txt(root)]||root};
const money=v=>new Intl.NumberFormat('uk-UA',{maximumFractionDigits:2}).format(Number(v||0))+' ₴';
const date=v=>new Intl.DateTimeFormat('uk-UA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
const notice=(m,e=false)=>{const n=$('#notice');if(!n)return;n.textContent=m;n.hidden=false;n.classList.toggle('error',e)};
const view=n=>$$('[data-view]').forEach(x=>x.hidden=x.dataset.view!==n);
const slug=v=>String(v||'').toLocaleLowerCase('uk-UA').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9а-яіїєґ]+/gi,'-').replace(/^-|-$/g,'');
const inventory=p=>p.availability_status||((p.in_stock&&Number(p.stock_quantity||0)>0)?'in_stock':'out_of_stock');
async function allProducts(){const a=[];for(let from=0;;from+=1000){const r=await supabase.from('products').select('*').order('created_at',{ascending:false}).range(from,from+999);if(r.error)throw r.error;a.push(...(r.data||[]));if(!r.data||r.data.length<1000)break}return a}
async function loadData(){
 try{const [products,orders,categories,brands,promotions,banners]=await Promise.all([allProducts(),supabase.from('orders').select('*,order_items(product_name,quantity,unit_price)').order('created_at',{ascending:false}),supabase.from('categories').select('*').order('sort_order').order('name'),supabase.from('brands').select('*').order('name'),supabase.from('promotions').select('*').order('created_at',{ascending:false}),supabase.from('banners').select('*').order('sort_order').order('created_at',{ascending:false})]);for(const r of [orders,categories,brands,promotions,banners])if(r.error)throw r.error;state.products=products;state.orders=orders.data||[];state.categories=categories.data||[];state.brands=brands.data||[];state.promotions=promotions.data||[];state.banners=banners.data||[];renderAll()}catch(e){notice('Помилка завантаження адмінки: '+e.message,true)}
}
function renderMetrics(){const active=state.products.filter(p=>p.is_active).length,newOrders=state.orders.filter(o=>o.status==='new').length,revenue=state.orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+Number(o.total||0),0);$('#productMetric').textContent=active;$('#productMetricHint').textContent='із '+state.products.length+' усіх товарів';$('#orderMetric').textContent=newOrders;$('#orderMetricHint').textContent=newOrders?'потребують уваги':'нових заявок немає';$('#revenueMetric').textContent=money(revenue);$('#lowStockMetric').textContent=state.products.filter(p=>Number(p.stock_quantity||0)<=3).length;$('#productsNavCount').textContent=state.products.length||'';$('#ordersNavCount').textContent=newOrders||''}
const missingCategory=p=>!p.category||!state.categories.some(c=>c.slug===p.category);
const duplicateSkuGroups=()=>{const groups=new Map();state.products.forEach(product=>{const sku=txt(product.sku||'');if(!sku)return;const group=groups.get(sku)||[];group.push(product);groups.set(sku,group)});return[...groups.entries()].filter(([,products])=>products.length>1)};
const emptyLeafCategories=()=>{const parents=new Set(state.categories.filter(category=>category.parent_id!=null).map(category=>Number(category.parent_id)));return state.categories.filter(category=>category.is_active&&!parents.has(Number(category.id))&&!state.products.some(product=>product.category===category.slug))};
function renderCatalogAudit(){const host=$('#reports');if(!host)return;let panel=$('#catalogAuditDetails');if(!panel){panel=document.createElement('div');panel.id='catalogAuditDetails';panel.className='owner-report-details';host.append(panel)}const duplicateGroups=duplicateSkuGroups(),emptyCategories=emptyLeafCategories(),duplicateRows=duplicateGroups.slice(0,6).map(([sku,products])=>'<li><b>SKU: '+esc(sku)+'</b><span>'+products.length+' товарів</span></li>').join(''),emptyRows=emptyCategories.slice(0,6).map(category=>'<li><button type="button" class="catalog-audit-category" data-catalog-audit-category="'+esc(category.name)+'">'+esc(category.name)+'</button><span>без товарів</span></li>').join('');panel.innerHTML='<article><h3>Повторювані SKU <small>('+duplicateGroups.length+')</small></h3>'+(duplicateRows?'<ul class="owner-report-list">'+duplicateRows+'</ul>':'<p class="owner-report-empty">Повторів SKU не знайдено.</p>')+'</article><article><h3>Порожні підкатегорії <small>('+emptyCategories.length+')</small></h3>'+(emptyRows?'<ul class="owner-report-list">'+emptyRows+'</ul>':'<p class="owner-report-empty">Порожніх підкатегорій немає.</p>')+'</article>';panel.querySelectorAll('[data-catalog-audit-category]').forEach(button=>button.onclick=()=>{const search=$('#categoryAdminSearch');search.value=button.dataset.catalogAuditCategory;renderCategories();location.hash='categories';$('#categories').scrollIntoView({behavior:'smooth',block:'start'})})}
function renderOwnerReports(){const products=state.products,hasSpecs=p=>p.specifications&&Object.keys(p.specifications).length>0,underOrder=products.filter(p=>inventory(p)==='under_order').length,low=products.filter(p=>Number(p.stock_quantity||0)<=3).length,reports=[['no_image','Без фото',products.filter(p=>!p.image_path).length,'Додайте головне зображення'],['no_price','Без ціни',products.filter(p=>Number(p.price||0)<=0).length,'Не можна показати покупцю'],['no_description','Без опису',products.filter(p=>!String(p.description||'').trim()).length,'Додайте короткий опис'],['no_specifications','Без характеристик',products.filter(p=>!hasSpecs(p)).length,'Заповніть технічні дані'],['no_category','Без категорії',products.filter(missingCategory).length,'Перенесіть у правильний розділ'],['low','Потрібно поповнити',low,'Залишок 3 шт. або менше'],['under_order','Під замовлення',underOrder,'Термін потрібно уточнити'],['draft','Приховані товари',products.filter(p=>!p.is_active).length,'Не відображаються покупцям']];$('#ownerReportCards').innerHTML=reports.map(([filter,title,count,hint])=>'<button class="owner-report-card '+(count?'alert':'')+'" type="button" data-owner-report-filter="'+filter+'"><span>'+title+'</span><strong>'+count+'</strong><small>'+hint+'</small></button>').join('');const brandCounts=new Map();products.forEach(p=>{const name=String(p.brand||'').trim();if(name)brandCounts.set(name,(brandCounts.get(name)||0)+1)});const brands=[...brandCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'uk')).slice(0,5);$('#ownerReportBrands').innerHTML=brands.length?'<ul class="owner-report-list">'+brands.map(([name,count])=>'<li><b>'+esc(name)+'</b><span>'+count+' товарів</span></li>').join('')+'</ul>':'<p class="owner-report-empty">Бренди ще не вказані.</p>';const inquiries=state.orders.filter(o=>/під замовлення|уточн|постачальник/i.test([o.status,o.comment,o.manager_note].filter(Boolean).join(' '))).slice(0,5);$('#ownerReportInquiries').innerHTML=inquiries.length?'<ul class="owner-report-list">'+inquiries.map(o=>'<li><b>Замовлення #'+esc(o.id)+'</b><span>'+esc(o.customer_name||'Без імені')+' · '+money(o.total)+'</span></li>').join('')+'</ul>':'<p class="owner-report-empty">Активних запитів немає.</p>'}
function fillFilters(){const c=$('#categoryFilter'),b=$('#brandFilter'),cv=c.value,bv=b.value;c.innerHTML='<option value="all">Усі категорії</option>'+state.categories.map(x=>'<option value="'+esc(x.slug)+'">'+esc(x.name)+'</option>').join('');const names=[...new Map(state.products.map(p=>String(p.brand||'').trim()).filter(Boolean).map(n=>[txt(n),n])).values()].sort((a,b)=>a.localeCompare(b,'uk'));b.innerHTML='<option value="all">Усі бренди</option>'+names.map(n=>'<option>'+esc(n)+'</option>').join('');c.value=[...c.options].some(o=>o.value===cv)?cv:'all';b.value=[...b.options].some(o=>o.value===bv)?bv:'all'}
function renderProducts(){const q=txt($('#productSearch').value),cat=$('#categoryFilter').value,brand=$('#brandFilter').value,filter=$('#productFilter').value;let a=state.products.filter(p=>{const hay=txt([p.id,p.name,p.brand,p.sku,p.slug,p.category].join(' '));if(q&&!hay.includes(q))return false;if(cat!=='all'&&p.category!==cat)return false;if(brand!=='all'&&String(p.brand||'').trim()!==brand)return false;if(filter==='active'&&!p.is_active)return false;if(filter==='draft'&&p.is_active)return false;if(filter==='low'&&Number(p.stock_quantity||0)>3)return false;if(filter==='under_order'&&inventory(p)!=='under_order')return false;if(filter==='no_image'&&p.image_path)return false;if(filter==='no_price'&&Number(p.price||0)>0)return false;if(filter==='no_description'&&p.description)return false;if(filter==='no_specifications'&&p.specifications&&Object.keys(p.specifications).length)return false;if(filter==='no_category'&&!missingCategory(p))return false;return true});const size=$('#pageSize').value==='all'?a.length:Number($('#pageSize').value||10),pages=Math.max(1,Math.ceil(a.length/Math.max(size,1)));state.page=Math.min(state.page,pages);const rows=a.slice((state.page-1)*size,state.page*size);$('#adminProducts').innerHTML=rows.length?rows.map(p=>{const q=Number(p.stock_quantity||0),st=inventory(p),catName=state.categories.find(c=>c.slug===p.category)?.name||p.category||'—',stockLabel=st==='limited_stock'?'Є в наявності — закінчується':st==='in_stock'?'В наявності':st==='under_order'?'Під замовлення':'Немає';return '<tr><td><input type="checkbox" data-select-product="'+p.id+'" '+(state.selectedProducts.has(Number(p.id))?'checked':'')+' aria-label="Виділити товар"></td><td><b>'+esc(p.name)+'</b><small>'+esc(p.brand||'Без бренду')+' · SKU: '+esc(p.sku||'—')+'</small></td><td>'+esc(catName)+'</td><td>'+money(p.price)+'</td><td><span class="stock-badge">'+q+' шт.</span></td><td><span class="visibility '+(/^(in_stock|limited_stock)$/.test(st)?'visible':'hidden-status')+'">'+stockLabel+'</span></td><td><span class="visibility '+(p.is_active?'visible':'hidden-status')+'">'+(p.is_active?'У каталозі':'Приховано')+'</span></td><td class="table-actions"><button type="button" data-edit-product="'+p.id+'">Редагувати</button><button type="button" data-duplicate-product="'+p.id+'">Дублювати</button><button type="button" class="danger-action" data-delete-product="'+p.id+'">Видалити</button></td></tr>'}).join(''):'<tr><td colspan="8" class="empty-row">Товарів не знайдено</td></tr>';$('#productPagination').innerHTML=pages>1?'<button type="button" data-page="-1" '+(state.page===1?'disabled':'')+'>←</button> <span>'+state.page+' / '+pages+'</span> <button type="button" data-page="1" '+(state.page===pages?'disabled':'')+'>→</button>':''}
function renderBrands(){
 const q=String($('#brandAdminSearch').value||'').trim().toLocaleLowerCase('uk-UA'),counts=new Map(),status=$('#brandStatusFilter')?.value||'all';
 state.products.forEach(p=>{const k=txt(p.brand);if(k)counts.set(k,(counts.get(k)||0)+1)});
 let all=state.brands.filter(b=>(!q||String(b.name||'').toLocaleLowerCase('uk-UA').includes(q)||String(b.slug||'').toLocaleLowerCase('uk-UA').includes(q))&&(status==='all'||(status==='active'?b.is_active:!b.is_active)));
 if($('#brandSort').value==='count')all.sort((x,y)=>(counts.get(txt(y.name))||0)-(counts.get(txt(x.name))||0)||x.name.localeCompare(y.name,'uk'));else all.sort((x,y)=>x.name.localeCompare(y.name,'uk'));
 const pageSize=5,pages=Math.max(1,Math.ceil(all.length/pageSize));state.brandPage=Math.min(Math.max(1,state.brandPage),pages);const rows=all.slice((state.brandPage-1)*pageSize,state.brandPage*pageSize);
 $('#brandCountMetric').textContent=state.brands.length+' брендів';$('#brandProductMetric').textContent=state.products.filter(p=>p.brand).length+' товарів із брендом';
 $('#adminBrands').innerHTML=rows.length?rows.map(b=>'<tr><td><div class="product-cell"><span class="product-thumb">'+(b.logo_path?'<img src="'+esc(b.logo_path)+'" alt="">':'<span>'+esc((b.name||'?').slice(0,2).toUpperCase())+'</span>')+'</span><span class="product-main"><b>'+esc(b.name)+'</b><small>'+esc(b.website||'Без сайту')+'</small></span></div></td><td>'+esc(b.slug)+'</td><td><span class="stock-badge">'+(counts.get(txt(b.name))||0)+' товарів</span></td><td><span class="visibility '+(b.is_active?'visible':'hidden-status')+'">'+(b.is_active?'Активний':'Прихований')+'</span></td><td class="table-actions"><button type="button" data-edit-brand="'+b.id+'">Редагувати</button><button type="button" class="danger-action" data-delete-brand="'+b.id+'">Видалити</button></td></tr>').join(''):'<tr><td colspan="5" class="empty-row">Брендів не знайдено</td></tr>';
 $('#brandPagination').innerHTML=pages>1?'<button type="button" data-brand-page="-1" '+(state.brandPage===1?'disabled':'')+'>←</button> <span>Показано '+((state.brandPage-1)*5+1)+'–'+Math.min(state.brandPage*5,all.length)+' з '+all.length+'</span> <button type="button" data-brand-page="1" '+(state.brandPage===pages?'disabled':'')+'>→</button>':'';
}
function renderCategories(){
 const byParent=new Map();state.categories.forEach(c=>{const k=c.parent_id==null?'root':Number(c.parent_id);if(!byParent.has(k))byParent.set(k,[]);byParent.get(k).push(c)});
 const query=txt($('#categoryAdminSearch')?.value||''),visibleIds=new Set();
 if(query){const addParents=id=>{const item=state.categories.find(x=>Number(x.id)===Number(id));if(!item||visibleIds.has(Number(item.id)))return;visibleIds.add(Number(item.id));if(item.parent_id!=null)addParents(item.parent_id)};state.categories.filter(c=>txt([c.name,c.slug].join(' ')).includes(query)).forEach(c=>addParents(c.id))}
 const isVisible=c=>!query||visibleIds.has(Number(c.id));
 const roots=state.categories.filter(c=>(!c.parent_id||!state.categories.some(x=>Number(x.id)===Number(c.parent_id)))&&isVisible(c));
 const rows=[];
 const add=(c,depth=0)=>{const count=state.products.filter(p=>p.category===c.slug).length,parent=state.categories.find(x=>Number(x.id)===Number(c.parent_id)),children=(byParent.get(Number(c.id))||[]).filter(isVisible),type=depth===0?'Батьківська категорія':'Підкатегорія',opened=query?true:state.categoryTreeOpen.has(Number(c.id)),toggle=children.length?'<button type="button" class="category-tree-toggle" data-toggle-category="'+c.id+'" aria-label="'+(opened?'Згорнути':'Розгорнути')+' підкатегорії" aria-expanded="'+opened+'">'+(opened?'−':'+')+'</button>':'<span class="category-tree-toggle-placeholder"></span>';
 rows.push('<tr class="category-tree-row" style="--tree-depth:'+depth+'"><td><span class="category-tree-marker">'+(depth===0?'◆':'↳')+'</span>'+toggle+'<b>'+esc(c.name)+'</b><small>'+type+(children.length?' · '+children.length+' підкатегорій':'')+(parent?' · Батьківська: '+esc(parent.name):'')+'</small></td><td>'+esc(c.slug)+'</td><td><span class="visibility '+(c.is_active?'visible':'hidden-status')+'">'+(c.is_active?'Активна':'Прихована')+'</span></td><td>'+count+'</td><td class="table-actions"><button type="button" data-move-category="up" data-category-id="'+c.id+'" aria-label="Перемістити вище">↑</button><button type="button" data-move-category="down" data-category-id="'+c.id+'" aria-label="Перемістити нижче">↓</button><button type="button" data-edit-category="'+c.id+'">Редагувати</button><button type="button" data-add-child-category="'+c.id+'">+ Підкатегорія</button><button type="button" data-toggle-category-visibility="'+c.id+'">'+(c.is_active?'Приховати':'Показати')+'</button><button type="button" class="danger-action" data-delete-category="'+c.id+'">Видалити</button></td></tr>');
 if(!opened)return;
 children.sort((x,y)=>(x.sort_order||0)-(y.sort_order||0)||x.name.localeCompare(y.name,'uk')).forEach(x=>add(x,depth+1));};
 roots.sort((x,y)=>(x.sort_order||0)-(y.sort_order||0)||x.name.localeCompare(y.name,'uk')).forEach(x=>add(x,0));
 $('#adminCategories').innerHTML=rows.join('')||'<tr><td colspan="5" class="empty-row">Категорій поки немає</td></tr>';
}
const orderStatusLabel={new:'Нове',processing:'В обробці',supplier_check:'Очікуємо постачальника',confirmed:'Підтверджене',paid:'Оплачене',shipped:'Відправлене',completed:'Виконане',cancelled:'Скасоване'};
const isSupplierInquiry=(order)=>/запит на товар під замовлення/iu.test(String(order?.comment||''));
const contactPhone=(value)=>{let phone=String(value||'').replace(/\D/g,'');if(phone.startsWith('0'))phone='38'+phone;return phone};
const orderItemsMarkup=(order)=>{const items=Array.isArray(order.order_items)?order.order_items:[];if(!items.length)return '<p class="order-items-empty">Склад замовлення не вказано.</p>';const lines=items.map(item=>{const quantity=Math.max(1,Number(item.quantity||1)),unitPrice=Number(item.unit_price||0),lineTotal=quantity*unitPrice;return '<li><span><b>'+esc(item.product_name||'Товар без назви')+'</b><small>'+quantity+' шт. × '+money(unitPrice)+'</small></span><strong>'+money(lineTotal)+'</strong></li>'}).join('');return '<section class="order-items"><h3>Товари у замовленні</h3><ul class="order-lines">'+lines+'</ul><div class="order-total"><span>Разом</span><b>'+money(order.total)+'</b></div></section>'};
function renderOrders(){const q=txt($('#orderSearch').value),f=$('#orderFilter').value;const a=state.orders.filter(o=>(!q||txt([o.id,o.customer_name,o.customer_phone,o.customer_email,o.comment].join(' ')).includes(q))&&(f==='all'||(f==='inquiry'?isSupplierInquiry(o):o.status===f)));$('#ordersCountMetric').textContent=a.length+' замовлень';$('#ordersTotalMetric').textContent='На суму '+money(a.reduce((n,o)=>n+Number(o.total||0),0));$('#adminOrders').innerHTML=a.length?a.map(o=>'<tr><td><b>#'+o.id+'</b><small>'+date(o.created_at)+'</small></td><td><b>'+esc(o.customer_name)+'</b><small>'+esc(o.customer_phone||'')+(o.customer_email?' · '+esc(o.customer_email):'')+'</small>'+(isSupplierInquiry(o)?'<span class="order-kind">Під замовлення</span>':'')+'</td><td>'+(o.order_items?.length||0)+'</td><td><b>'+money(o.total)+'</b></td><td><span class="visibility '+(o.status==='cancelled'?'hidden-status':'visible')+'">'+esc(orderStatusLabel[o.status]||o.status)+'</span></td><td><button type="button" data-view-order="'+o.id+'">Деталі</button></td></tr>').join(''):'<tr><td colspan="6" class="empty-row">Замовлень не знайдено</td></tr>'}
function customerRows(){const map=new Map();state.orders.forEach(o=>{const k=txt(o.customer_email||o.customer_phone||o.customer_name);if(!k)return;const x=map.get(k)||{name:o.customer_name,phone:o.customer_phone,email:o.customer_email,count:0,total:0,last:o.created_at,orders:[]};x.count++;x.total+=Number(o.total||0);x.orders.push(o);if(new Date(o.created_at)>new Date(x.last))x.last=o.created_at;map.set(k,x)});return [...map.values()]}
function renderCustomers(){const q=txt($('#customerSearch').value),all=customerRows(),a=all.filter(x=>!q||txt([x.name,x.phone,x.email].join(' ')).includes(q));$('#customersCountMetric').textContent=all.length+' клієнтів';$('#repeatCustomersMetric').textContent=all.filter(x=>x.count>1).length+' повторних';$('#adminCustomers').innerHTML=a.length?a.sort((x,y)=>new Date(y.last)-new Date(x.last)).map(x=>'<tr><td><b>'+esc(x.name)+'</b></td><td>'+esc(x.phone||'')+'<small>'+esc(x.email||'')+'</small></td><td>'+x.count+'</td><td><b>'+money(x.total)+'</b></td><td>'+date(x.last)+'</td></tr>').join(''):'<tr><td colspan="5" class="empty-row">Клієнтів не знайдено</td></tr>'}
function renderPromotions(){const q=txt($('#promotionSearch').value),f=$('#promotionFilter').value;const a=state.promotions.filter(x=>(!q||txt([x.name,x.code].join(' ')).includes(q))&&(f==='all'||(f==='active')===!!x.is_active));$('#adminPromotions').innerHTML=a.length?a.map(x=>'<tr><td><b>'+esc(x.name)+'</b><small>'+esc(x.code||'Без промокоду')+'</small></td><td>'+money(x.discount_value)+(x.discount_type==='percent'?' %':'')+'</td><td>'+(x.starts_at?date(x.starts_at):'Без обмежень')+'<small>'+(x.ends_at?'до '+date(x.ends_at):'')+'</small></td><td><span class="visibility '+(x.is_active?'visible':'hidden-status')+'">'+(x.is_active?'Активна':'Неактивна')+'</span></td><td class="table-actions"><button data-edit-promotion="'+x.id+'">Редагувати</button><button class="danger-action" data-delete-promotion="'+x.id+'">Видалити</button></td></tr>').join(''):'<tr><td colspan="5">Акцій немає</td></tr>'}
function renderBanners(){const q=txt($('#bannerSearch').value),f=$('#bannerFilter').value;const a=state.banners.filter(x=>(!q||txt([x.title,x.subtitle].join(' ')).includes(q))&&(f==='all'||(f==='active')===!!x.is_active));$('#adminBanners').innerHTML=a.length?a.map(x=>'<tr><td><b>'+esc(x.title)+'</b><small>'+esc(x.subtitle||'')+'</small></td><td>'+esc(x.link_url||'—')+'</td><td>'+Number(x.sort_order||0)+'</td><td><span class="visibility '+(x.is_active?'visible':'hidden-status')+'">'+(x.is_active?'Показується':'Прихований')+'</span></td><td class="table-actions"><button data-edit-banner="'+x.id+'">Редагувати</button><button class="danger-action" data-delete-banner="'+x.id+'">Видалити</button></td></tr>').join(''):'<tr><td colspan="5">Банерів немає</td></tr>'}
async function promotionTargets(){const f=$('#promotionForm'),type=f.elements.target_type.value,wrap=$('#promotionTargetWrap'),products=$('#promotionProductsWrap'),sel=f.elements.target_value;wrap.hidden=type==='all'||type==='products';products.hidden=type!=='products';if(type==='category')sel.innerHTML=state.categories.map(x=>'<option value="'+esc(x.slug)+'">'+esc(x.name)+'</option>').join('');if(type==='brand')sel.innerHTML=state.brands.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');if(type==='products')$('#promotionProducts').innerHTML=state.products.map(x=>'<option value="'+x.id+'">'+esc(x.name)+' · '+esc(x.sku||'')+'</option>').join('')}
async function promotionDialog(x=null){const f=$('#promotionForm');f.reset();if(x){for(const k of ['id','name','code','discount_type','discount_value','target_type','target_value'])if(f.elements[k])f.elements[k].value=x[k]??'';f.elements.starts_at.value=x.starts_at?x.starts_at.slice(0,16):'';f.elements.ends_at.value=x.ends_at?x.ends_at.slice(0,16):'';f.elements.is_active.checked=!!x.is_active}await promotionTargets();if(x?.target_value)f.elements.target_value.value=x.target_value;if(x?.id&&f.elements.target_type.value==='products'){const r=await supabase.from('promotion_products').select('product_id').eq('promotion_id',x.id);const ids=new Set((r.data||[]).map(v=>Number(v.product_id)));[...$('#promotionProducts').options].forEach(o=>o.selected=ids.has(Number(o.value)))}$('#promotionDialog').showModal()}
function bannerDialog(x=null){const f=$('#bannerForm');f.reset();if(x){for(const k of ['id','title','subtitle','image_url','link_url','button_text','sort_order'])if(f.elements[k])f.elements[k].value=x[k]??'';f.elements.is_active.checked=!!x.is_active}$('#bannerDialog').showModal()}
function updateSelectionUI(){const n=state.selectedProducts.size;$('#selectedProductsCount').textContent=n+' вибрано';$('#deleteSelectedProducts').disabled=!n;$('#showSelectedProducts').disabled=!n;$('#hideSelectedProducts').disabled=!n;$('#bulkProductCategory').disabled=!n;$('#moveSelectedProducts').disabled=!n||!$('#bulkProductCategory').value;$('#bulkProductBrand').disabled=!n;$('#brandSelectedProducts').disabled=!n||!$('#bulkProductBrand').value;const all=$('#adminProducts [data-select-product]');$('#selectAllProducts').checked=all.length>0&&all.every(x=>x.checked)}function fillBulkCategory(){const sel=$('#bulkProductCategory'),value=sel.value;const roots=state.categories.filter(c=>!c.parent_id),options=[];const add=(c,depth=0)=>{options.push('<option value="'+esc(c.slug)+'">'+('— '.repeat(depth))+esc(c.name)+'</option>');state.categories.filter(x=>Number(x.parent_id)===Number(c.id)).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||a.name.localeCompare(b.name,'uk')).forEach(x=>add(x,depth+1))};roots.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||a.name.localeCompare(b.name,'uk')).forEach(x=>add(x));sel.innerHTML='<option value="">Перенести в категорію...</option>'+options.join('');if([...sel.options].some(o=>o.value===value))sel.value=value}function fillBrandControls(){const opts=state.brands.filter(b=>b.is_active).sort((a,b)=>a.name.localeCompare(b.name,'uk')).map(b=>'<option value="'+b.id+'">'+esc(b.name)+'</option>').join('');$('#bulkProductBrand').innerHTML='<option value="">Змінити бренд...</option>'+opts}function renderAll(){renderMetrics();fillFilters();fillBulkCategory();fillBrandControls();renderOwnerReports();renderProducts();renderBrands();renderCategories();renderOrders();renderCustomers();renderPromotions();renderBanners();updateSelectionUI()}
function productDialog(p=null){const f=$('#productForm');f.reset();f.elements.brand_id.innerHTML='<option value="">— Без бренду —</option>'+state.brands.filter(b=>b.is_active||Number(b.id)===Number(p?.brand_id)).sort((a,b)=>a.name.localeCompare(b.name,'uk')).map(b=>'<option value="'+b.id+'">'+esc(b.name)+'</option>').join('');f.elements.category.innerHTML=state.categories.map(c=>'<option value="'+esc(c.slug)+'">'+esc(c.name)+'</option>').join('');const parentOptions=state.products.filter(item=>Number(item.id)!==Number(p?.id)&&!item.parent_product_id).sort((a,b)=>a.name.localeCompare(b.name,'uk')).map(item=>'<option value="'+item.id+'">'+esc(item.name)+' · '+esc(item.sku||'без SKU')+'</option>').join('');f.elements.parent_product_id.innerHTML='<option value="">— Окремий товар —</option>'+parentOptions;$('#productDialogTitle').textContent=p?'Редагування товару':'Новий товар';const gallery=Array.isArray(p?.image_paths)?p.image_paths:[];$('#productGalleryExisting').textContent=gallery.length?'У галереї зараз '+gallery.length+' фото. Нові файли буде додано до них.':'Можна вибрати одразу кілька файлів';if(p){if(!p.brand_id&&p.brand){const match=state.brands.find(b=>txt(b.name)===txt(p.brand));if(match)p.brand_id=match.id}Object.entries(p).forEach(([k,v])=>{if(f.elements[k]&&k!=='is_active'&&k!=='image_paths')f.elements[k].value=v??''});f.elements.specifications_text.value=p.specifications?Object.entries(p.specifications).map(([k,v])=>k+': '+v).join('\n'):'';f.elements.is_active.checked=!!p.is_active}else f.elements.is_active.checked=true;$('#productDialog').showModal()}
async function saveProduct(e){e.preventDefault();const f=e.currentTarget,r=Object.fromEntries(new FormData(f)),spec={};String(r.specifications_text||'').split('\n').forEach(line=>{const [k,...v]=line.split(':');if(k?.trim()&&v.length)spec[k.trim()]=v.join(':').trim()});const chosenBrand=state.brands.find(b=>Number(b.id)===Number(r.brand_id)),current=state.products.find(p=>Number(p.id)===Number(r.id));let imagePath=r.image_path.trim()||current?.image_path||null;let imagePaths=Array.isArray(current?.image_paths)?[...current.image_paths]:[];if(current?.image_path&&current.image_path!==imagePath)imagePaths=imagePaths.filter(path=>path!==current.image_path);const files=[...(f.elements.image_files?.files||[])];if(files.length){$('#productFormMessage').textContent='Завантаження фото: 0 з '+files.length+'…';$('#productFormMessage').hidden=false;const uploaded=[];for(let index=0;index<files.length;index++){const file=files[index],ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,''),key='products/'+(r.id||Date.now())+'-'+Date.now()+'-'+index+'.'+ext,up=await supabase.storage.from('product-images').upload(key,file,{cacheControl:'3600',upsert:true,contentType:file.type});if(up.error){$('#productFormMessage').textContent='Не вдалося завантажити фото '+(index+1)+': '+up.error.message;return}uploaded.push(key);$('#productFormMessage').textContent='Завантаження фото: '+(index+1)+' з '+files.length+'…'}if(!imagePath)imagePath=uploaded[0]||null;imagePaths=[...new Set([imagePath,...imagePaths,...uploaded].filter(Boolean))]}else imagePaths=[...new Set([imagePath,...imagePaths].filter(Boolean))];const payload={name:r.name.trim(),slug:r.slug.trim()||slug(r.name),sku:r.sku.trim()||null,brand_id:chosenBrand?.id||null,brand:chosenBrand?.name||null,category:r.category,price:Number(r.price),stock_quantity:Number(r.stock_quantity),in_stock:Number(r.stock_quantity)>0,parent_product_id:r.parent_product_id?Number(r.parent_product_id):null,variant_label:r.variant_label.trim()||null,image_path:imagePath,image_paths:imagePaths,description:r.description.trim()||null,specifications:spec,is_active:f.elements.is_active.checked};const res=r.id?await supabase.from('products').update(payload).eq('id',r.id):await supabase.from('products').insert(payload);if(res.error){$('#productFormMessage').textContent=res.error.message+(res.error.code==='42703'?' Запустіть product-variants-upgrade.sql у Supabase SQL Editor.':'');$('#productFormMessage').hidden=false;return}$('#productDialog').close();await loadData()}
function brandDialog(b=null){const form=$('#brandForm'),slugField=$('#brandSlug');form.reset();$('#brandId').value=b?.id||'';$('#brandName').value=b?.name||'';slugField.value=b?.slug||'';slugField.readOnly=!!b;slugField.title=b?'Внутрішній код не змінюється під час перейменування':'';let hint=form.querySelector('[data-brand-slug-hint]');if(!hint){hint=document.createElement('small');hint.dataset.brandSlugHint='true';slugField.parentElement.append(hint)}hint.textContent=b?'Внутрішній код збережено: нова назва автоматично з’явиться в товарах, фільтрах та імпорті.':'Для нового бренду це його постійний внутрішній код та URL.';$('#brandDescription').value=b?.description||'';$('#brandLogo').value=b?.logo_path||'';$('#brandWebsite').value=b?.website||'';$('#brandActive').checked=b?.is_active!==false;$('#brandDialog').showModal()}
async function syncBrandName(current,name){if(!current||current.name===name)return 0;const ids=state.products.filter(product=>Number(product.brand_id)===Number(current.id)||(!product.brand_id&&txt(product.brand)===txt(current.name))).map(product=>product.id);let updated=0;for(let from=0;from<ids.length;from+=100){const result=await supabase.from('products').update({brand_id:current.id,brand:name}).in('id',ids.slice(from,from+100)).select('id');if(result.error)throw result.error;updated+=(result.data||[]).length}if(updated!==ids.length)throw new Error('Оновлено '+updated+' з '+ids.length+' товарів бренду.');return updated}
async function saveBrand(e){e.preventDefault();const form=e.currentTarget,id=$('#brandId').value,message=$('#brandFormMessage'),submit=form.querySelector('[type="submit"]'),name=$('#brandName').value.trim(),current=state.brands.find(brand=>Number(brand.id)===Number(id)),brandSlug=current?.slug||slug($('#brandSlug').value||name);message.hidden=true;if(!name||!brandSlug){message.textContent='Вкажіть назву бренду та slug.';message.hidden=false;return}const duplicate=state.brands.find(brand=>(txt(brand.slug)===txt(brandSlug)||txt(brand.name)===txt(name))&&Number(brand.id)!==Number(id));if(duplicate){message.textContent='Назва або slug уже належать бренду «'+duplicate.name+'». Для варіантів на кшталт «ASUS monitors» використовуйте «Впорядкувати бренди», а не ручне перейменування.';message.hidden=false;return}let logoPath=$('#brandLogo').value.trim()||current?.logo_path||null;submit.disabled=true;try{const file=$('#brandLogoFile').files?.[0];if(file){message.textContent='Завантажую логотип…';message.hidden=false;logoPath=await uploadCatalogAsset(file,'brands')}const p={name,slug:brandSlug,description:$('#brandDescription').value.trim()||null,logo_path:logoPath,website:$('#brandWebsite').value.trim()||null,is_active:$('#brandActive').checked,updated_at:new Date().toISOString()};const r=id?await supabase.from('brands').update(p).eq('id',id):await supabase.from('brands').insert(p).select('*').single();if(r.error){message.textContent='Помилка збереження: '+r.error.message;message.hidden=false;return}const updated=await syncBrandName(current,name);$('#brandDialog').close();await loadData();notice(current&&current.name!==name?'Бренд перейменовано: оновлено товарів — '+updated+'.':'Бренд збережено')}catch(error){message.textContent='Не вдалося зберегти бренд: '+error.message;message.hidden=false}finally{submit.disabled=false}}
async function uploadCatalogAsset(file,folder){if(!file)return '';const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg',key=folder+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.'+ext,result=await supabase.storage.from('product-images').upload(key,file,{cacheControl:'3600',upsert:true,contentType:file.type});if(result.error)throw result.error;return key}
function categoryDialog(c=null,parent=null){const f=$('#categoryForm'),slugField=f.elements.slug;f.reset();const descendants=new Set();const walk=id=>state.categories.filter(x=>Number(x.parent_id)===Number(id)).forEach(x=>{descendants.add(Number(x.id));walk(x.id)});if(c)walk(c.id);const permitted=state.categories.filter(x=>Number(x.id)!==Number(c?.id)&&!descendants.has(Number(x.id))),byParent=new Map();permitted.forEach(x=>{const key=x.parent_id==null?'root':Number(x.parent_id);if(!byParent.has(key))byParent.set(key,[]);byParent.get(key).push(x)});const options=[];const add=(item,depth=0)=>{options.push('<option value="'+item.id+'">'+esc('— '.repeat(depth)+item.name)+'</option>');(byParent.get(Number(item.id))||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||a.name.localeCompare(b.name,'uk')).forEach(child=>add(child,depth+1))};(byParent.get('root')||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||a.name.localeCompare(b.name,'uk')).forEach(item=>add(item));f.elements.parent_id.innerHTML='<option value="">— Без батьківської —</option>'+options.join('');let slugHint=f.querySelector('[data-category-slug-hint]');if(!slugHint){slugHint=document.createElement('small');slugHint.dataset.categorySlugHint='true';slugField.parentElement.append(slugHint)}if(c){f.elements.id.value=c.id;f.elements.name.value=c.name;slugField.value=c.slug;slugField.readOnly=true;slugField.title='Внутрішній код не змінюється під час перейменування';slugHint.textContent='Внутрішній код збережено: назва зміниться по всьому сайту, а товари, імпорт і фільтри залишаться пов’язаними.';f.elements.image_path.value=c.image_path||'';f.elements.parent_id.value=c.parent_id||'';f.elements.sort_order.value=c.sort_order||0;f.elements.is_active.checked=!!c.is_active}else{slugField.readOnly=false;slugField.title='';slugHint.textContent='Для нової категорії це її постійний внутрішній код та URL.';f.elements.parent_id.value=parent?.id||'';f.elements.sort_order.value=parent?Math.max(0,...state.categories.filter(x=>Number(x.parent_id)===Number(parent.id)).map(x=>Number(x.sort_order||0)))+10:0;f.elements.is_active.checked=true}$('#categoryDialogTitle').textContent=c?'Редагування категорії':parent?'Нова підкатегорія: '+parent.name:'Нова категорія';$('#categoryFormMessage').hidden=true;$('#categoryDialog').showModal()}
async function saveCategory(e){e.preventDefault();const f=e.currentTarget,r=Object.fromEntries(new FormData(f)),message=$('#categoryFormMessage'),current=state.categories.find(c=>Number(c.id)===Number(r.id));let imagePath=String(r.image_path||'').trim()||current?.image_path||null;message.hidden=true;try{const file=f.elements.image_file?.files?.[0];if(file){message.textContent='Завантажую фото категорії…';message.hidden=false;imagePath=await uploadCatalogAsset(file,'categories')}const categorySlug=current?.slug||slug(String(r.slug||'').trim()||r.name);const p={name:r.name.trim(),slug:categorySlug,image_path:imagePath,parent_id:r.parent_id?Number(r.parent_id):null,sort_order:Number(r.sort_order||0),is_active:f.elements.is_active.checked};const x=r.id?await supabase.from('categories').update(p).eq('id',r.id):await supabase.from('categories').insert(p);if(x.error)throw x.error;$('#categoryDialog').close();await loadData();notice(current?'Категорію перейменовано: товари, посилання, фільтри та правила імпорту збережено.':'Категорію збережено.')}catch(error){message.textContent=(error.message||error.code||'Не вдалося зберегти категорію')+(error.code==='42703'?' Запустіть category-media-upgrade.sql у Supabase SQL Editor.':'');message.hidden=false}}
document.addEventListener('click',e=>{const toggle=e.target.closest('[data-toggle-category]');if(!toggle)return;const id=Number(toggle.dataset.toggleCategory);if(state.categoryTreeOpen.has(id))state.categoryTreeOpen.delete(id);else state.categoryTreeOpen.add(id);renderCategories()});
document.addEventListener('click',event=>{const card=event.target.closest('[data-owner-report-filter]');if(!card)return;const filter=card.dataset.ownerReportFilter,control=$('#productFilter');if(!control||![...control.options].some(option=>option.value===filter))return;control.value=filter;$('#productSearch').value='';$('#categoryFilter').value='all';$('#brandFilter').value='all';state.page=1;renderProducts();location.hash='products';$('#products').scrollIntoView({behavior:'smooth',block:'start'})});
// Фільтри проєктора мають бути редаговані й тоді, коли постачальник не передав
// їх у XML. Значення зберігаємо у звичайних характеристиках товару, тому вони
// одразу працюють і в каталозі, і в наступних імпортах.
const projectorCategorySlugs=new Set(['projectors','projector','laser-proj','erc-display-03','erc-display-11','erc-display-12','erc-display-13','home-projectors','short-throw-projectors','installation-projectors','universal-projectors']);
const projectorPurposeOptions=['Лазерний','Домашній','Короткофокусний','Ультракороткофокусний','Інсталяційний','Універсальний'];
const projectorResolutionOptions=['SVGA','XGA','WXGA','HD','Full HD','WUXGA','WQXGA','4K UHD','8K UHD','1920 × 1080','3840 × 2160'];
const officePrintCategorySlugs=new Set(['office-printers','office-printers-color','office-printers-mono','office-mfp','office-mfp-color','office-mfp-mono','office-wide-format']);
const officeInterfaceOptions=['Wi‑Fi','Ethernet','USB','Bluetooth'];
const parseAdminSpecifications=value=>Object.fromEntries(String(value||'').split('\n').map(line=>{const [key,...parts]=line.split(':');return[key?.trim(),parts.join(':').trim()]}).filter(([key,value])=>key&&value));
const writeAdminSpecifications=(form,specifications)=>{form.elements.specifications_text.value=Object.entries(specifications).map(([key,value])=>key+': '+value).join('\n')};
const mountProjectorEditorFields=(form,product)=>{
  let panel=form.querySelector('#projectorEditorFields');
  if(!panel){
    panel=document.createElement('fieldset');panel.id='projectorEditorFields';panel.className='projector-editor-fields';
    panel.innerHTML='<legend>Фільтри проєктора</legend><div class="projector-editor-fields__grid"><div><b>Тип і призначення</b><div class="projector-editor-fields__options">'+projectorPurposeOptions.map(value=>'<label><input type="checkbox" name="projector_purpose" value="'+value+'"> '+value+'</label>').join('')+'</div></div><label>Джерело світла<select name="projector_light_source"><option value="">— Не вказано —</option><option value="Лампа">Лампа</option><option value="Лазер">Лазер</option><option value="Світлодіод">LED / світлодіодний</option></select></label><label>Роздільна здатність<select name="projector_resolution_select"><option value="">— Не вказано —</option>'+projectorResolutionOptions.map(value=>'<option value="'+value+'">'+value+'</option>').join('')+'<option value="__custom">Інша — ввести вручну</option></select></label><label data-projector-resolution-custom hidden>Власна роздільна здатність<input name="projector_resolution_custom" type="text" placeholder="Напр. 1366 × 768"></label><label>Проекційне співвідношення<input name="projector_throw_ratio" type="text" placeholder="Напр. 0.5 : 1 або 1.3–2.1 : 1"></label><label>Яскравість, лм<input name="projector_brightness" type="number" min="1" step="1" placeholder="Напр. 4000"></label><label>Технологія проекції<select name="projector_technology"><option value="">— Не вказано —</option><option value="DLP">DLP</option><option value="LCD">LCD</option><option value="3LCD">3LCD</option><option value="LCoS">LCoS</option></select></label></div><small>За потреби вкажіть дані вручну: вони мають пріоритет над автоматичним визначенням із XML.</small>';
    const description=form.elements.description?.closest('label');if(description)description.before(panel);else form.append(panel);
  }
  const specifications=product?.specifications||parseAdminSpecifications(form.elements.specifications_text?.value);
  const purposeText=String(specifications['Призначення']||specifications['Тип / призначення']||'');
  panel.querySelectorAll('[name="projector_purpose"]').forEach(input=>input.checked=purposeText.includes(input.value));
  const source=String(specifications['Джерело світла']||specifications['Тип джерела']||'');
  panel.querySelector('[name="projector_light_source"]').value=/лазер/iu.test(source)?'Лазер':/(?:світлодіод|\bled\b)/iu.test(source)?'Світлодіод':/(?:ламп|lamp)/iu.test(source)?'Лампа':'';
  const resolution=String(specifications['Роздільна здатність']||specifications['Resolution']||'');
  const resolutionSelect=panel.querySelector('[name="projector_resolution_select"]'),resolutionCustom=panel.querySelector('[name="projector_resolution_custom"]'),resolutionCustomLabel=panel.querySelector('[data-projector-resolution-custom]');
  resolutionSelect.value=projectorResolutionOptions.includes(resolution)?resolution:(resolution?'__custom':'');resolutionCustom.value=projectorResolutionOptions.includes(resolution)?'':resolution;
  const toggleResolutionCustom=()=>{resolutionCustomLabel.hidden=resolutionSelect.value!=='__custom'};resolutionSelect.onchange=toggleResolutionCustom;toggleResolutionCustom();
  const technology=String(specifications['Технологія проекції']||specifications['Projection technology']||'');
  panel.querySelector('[name="projector_technology"]').value=/3lcd/iu.test(technology)?'3LCD':/lcos/iu.test(technology)?'LCoS':/\bdlp\b/iu.test(technology)?'DLP':/\blcd\b/iu.test(technology)?'LCD':'';
  panel.querySelector('[name="projector_throw_ratio"]').value=String(specifications['Проекційне співвідношення']||specifications['Проекційне відношення']||specifications['Projection ratio']||specifications['Throw ratio']||'');
  panel.querySelector('[name="projector_brightness"]').value=String(specifications['Яскравість']||specifications['Світловий потік']||specifications['Brightness']||'').match(/\d{2,5}/)?.[0]||'';
  const toggle=()=>{panel.hidden=!projectorCategorySlugs.has(form.elements.category.value)};
  form.elements.category.onchange=toggle;toggle();
};
const mountOfficePrinterEditorFields=(form,product)=>{
  let panel=form.querySelector('#officePrinterEditorFields');
  if(!panel){
    panel=document.createElement('fieldset');panel.id='officePrinterEditorFields';panel.className='projector-editor-fields';
    panel.innerHTML='<legend>Фільтри принтера / БФП</legend><div class="projector-editor-fields__grid"><label>Кольоровість<select name="office_print_color"><option value="">— Не вказано —</option><option value="Монохромний">Монохромний</option><option value="Кольоровий">Кольоровий</option></select></label><label>Технологія друку<select name="office_print_technology"><option value="">— Не вказано —</option><option value="Лазерний">Лазерний</option><option value="Струменевий">Струменевий</option></select></label><label>Формат<select name="office_print_format"><option value="">— Не вказано —</option><option value="A4">A4</option><option value="A3">A3</option></select></label><div><b>Інтерфейси</b><div class="projector-editor-fields__options">'+officeInterfaceOptions.map(value=>'<label><input type="checkbox" name="office_print_interface" value="'+value+'"> '+value+'</label>').join('')+'</div></div><label><input type="checkbox" name="office_print_duplex"> Автоматичний двосторонній друк (дуплекс)</label></div><small>Значення зберігаються у характеристиках товару та мають пріоритет над даними XML.</small>';
    const description=form.elements.description?.closest('label');if(description)description.before(panel);else form.append(panel);
  }
  const specifications=product?.specifications||parseAdminSpecifications(form.elements.specifications_text?.value);
  const color=String(specifications['Тип друку']||specifications['Кольоровість']||'');
  panel.querySelector('[name="office_print_color"]').value=/кольоров|\bcolor\b|\bcolour\b/iu.test(color)?'Кольоровий':/(?:моно|чорно[ -]?білий)/iu.test(color)?'Монохромний':'';
  const technology=String(specifications['Технологія друку']||specifications['Технологія']||'');
  panel.querySelector('[name="office_print_technology"]').value=/(?:струмен|струйн|\bink\b|inkjet)/iu.test(technology)?'Струменевий':/(?:лазер|laser)/iu.test(technology)?'Лазерний':'';
  panel.querySelector('[name="office_print_format"]').value=String(specifications['Формат']||'').match(/\bA[34]\b/iu)?.[0]?.toUpperCase()||'';
  const interfaces=String(specifications['Інтерфейси']||specifications['Інтерфейс']||specifications['Interface']||'');
  const optionalWifi=/(?:wi[ -]?fi|wireless|wlan).{0,80}(?:опц|optional|не\s*(?:вход|входить)|докуп|add[ -]?on|модул)|(?:опц|optional|не\s*(?:вход|входить)|докуп|add[ -]?on|модул).{0,80}(?:wi[ -]?fi|wireless|wlan)/iu.test(interfaces);
  panel.querySelectorAll('[name="office_print_interface"]').forEach(input=>{const pattern=input.value==='Wi‑Fi'?/(?:wi[ -]?fi|wireless|wlan)/iu:input.value==='Ethernet'?/ethernet|\blan\b|rj[ -]?45/iu:input.value==='USB'?/\busb(?:\s|$|[0-9])?/iu:/bluetooth/iu;input.checked=pattern.test(interfaces)&&!(input.value==='Wi‑Fi'&&optionalWifi)});
  const duplex=String(specifications['Дуплексний друк']||specifications['Дуплекс']||'');
  const optionalDuplex=/(?:дуплекс|двосторон|duplex).{0,80}(?:опц|optional|не\s*(?:вход|входить)|докуп|add[ -]?on|модул)|(?:опц|optional|не\s*(?:вход|входить)|докуп|add[ -]?on|модул).{0,80}(?:дуплекс|двосторон|duplex)/iu.test(duplex);
  panel.querySelector('[name="office_print_duplex"]').checked=/(?:є|так|yes|true|дуплекс|двосторон|duplex)/iu.test(duplex)&&!optionalDuplex;
};
const productDialogElement=$('#productDialog');
new MutationObserver(()=>{if(productDialogElement.open){const form=$('#productForm'),id=form.elements.id?.value;const product=state.products.find(item=>Number(item.id)===Number(id))||null;mountProjectorEditorFields(form,product);mountOfficePrinterEditorFields(form,product);const sync=()=>{form.querySelector('#projectorEditorFields').hidden=!projectorCategorySlugs.has(form.elements.category.value);form.querySelector('#officePrinterEditorFields').hidden=!officePrintCategorySlugs.has(form.elements.category.value)};form.elements.category.onchange=sync;sync()}}).observe(productDialogElement,{attributes:true,attributeFilter:['open']});
const originalSaveProduct=saveProduct;
async function saveProductWithProjectorFields(event){
  const form=event.currentTarget,panel=form.querySelector('#projectorEditorFields');
  if(panel&&!panel.hidden){
    const specifications=parseAdminSpecifications(form.elements.specifications_text.value);
    delete specifications['Призначення'];delete specifications['Тип / призначення'];delete specifications['Джерело світла'];delete specifications['Тип джерела'];delete specifications['Роздільна здатність'];delete specifications['Resolution'];delete specifications['Проекційне співвідношення'];delete specifications['Проекційне відношення'];delete specifications['Projection ratio'];delete specifications['Throw ratio'];delete specifications['Яскравість'];delete specifications['Світловий потік'];delete specifications['Brightness'];delete specifications['Технологія проекції'];delete specifications['Projection technology'];
    const purposes=[...panel.querySelectorAll('[name="projector_purpose"]:checked')].map(input=>input.value);
    const source=panel.querySelector('[name="projector_light_source"]').value;
    const resolutionChoice=panel.querySelector('[name="projector_resolution_select"]').value;
    const resolution=resolutionChoice==='__custom'?panel.querySelector('[name="projector_resolution_custom"]').value.trim():resolutionChoice;
    const technology=panel.querySelector('[name="projector_technology"]').value;
    const throwRatio=panel.querySelector('[name="projector_throw_ratio"]').value.trim();
    const brightness=panel.querySelector('[name="projector_brightness"]').value.trim();
    if(purposes.length)specifications['Призначення']=purposes.join(' · ');
    if(source)specifications['Джерело світла']=source;
    if(resolution)specifications['Роздільна здатність']=resolution;
    if(throwRatio)specifications['Проекційне співвідношення']=throwRatio;
    if(brightness)specifications['Яскравість']=brightness+' лм';
    if(technology)specifications['Технологія проекції']=technology;
    writeAdminSpecifications(form,specifications);
  }
  const officePanel=form.querySelector('#officePrinterEditorFields');
  if(officePanel&&!officePanel.hidden){
    const specifications=parseAdminSpecifications(form.elements.specifications_text.value);
    delete specifications['Тип друку'];delete specifications['Кольоровість'];delete specifications['Технологія друку'];delete specifications['Технологія'];delete specifications['Формат'];delete specifications['Інтерфейси'];delete specifications['Інтерфейс'];delete specifications['Interface'];delete specifications['Дуплексний друк'];delete specifications['Дуплекс'];
    const color=officePanel.querySelector('[name="office_print_color"]').value,technology=officePanel.querySelector('[name="office_print_technology"]').value,format=officePanel.querySelector('[name="office_print_format"]').value,interfaces=[...officePanel.querySelectorAll('[name="office_print_interface"]:checked')].map(input=>input.value);
    if(color)specifications['Тип друку']=color;
    if(technology)specifications['Технологія друку']=technology;
    if(format)specifications['Формат']=format;
    if(interfaces.length)specifications['Інтерфейси']=interfaces.join(', ');
    if(officePanel.querySelector('[name="office_print_duplex"]').checked)specifications['Дуплексний друк']='Є';
    writeAdminSpecifications(form,specifications);
  }
  return originalSaveProduct(event);
}
async function dashboard(){const {data:{user}}=await supabase.auth.getUser();if(!user){view('login');return}const {data:profile}=await supabase.from('profiles').select('full_name,role').eq('id',user.id).maybeSingle();if(!profile){await supabase.auth.signOut();view('login');notice('Доступ відсутній.',true);return}view('app');$('#adminName').textContent=profile.full_name||'Адміністраторе';await loadData()}
$('#loginForm').onsubmit=async e=>{e.preventDefault();const r=Object.fromEntries(new FormData(e.currentTarget));const {error}=await supabase.auth.signInWithPassword({email:r.email,password:r.password});if(error){notice('Невірна email-адреса або пароль',true);return}dashboard()};
$('#requestPasswordReset').onclick=async()=>{const email=$('#loginForm').elements.email.value.trim();if(!email){notice('Введіть email, на який надіслати посилання для відновлення.',true);return}const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/admin'});if(error){notice('Не вдалося надіслати посилання: '+error.message,true);return}notice('Перевірте пошту: надіслано посилання для створення нового пароля.')};
$('#recoveryForm').onsubmit=async e=>{e.preventDefault();const r=Object.fromEntries(new FormData(e.currentTarget));if(r.password!==r.confirmPassword)return;await supabase.auth.updateUser({password:r.password});await supabase.auth.signOut();view('login')};
$('#logout').onclick=async()=>{await supabase.auth.signOut();view('login')};
$$('[data-add-product]').forEach(b=>b.onclick=()=>productDialog());
$('#addCategory').onclick=()=>categoryDialog();$('#addBrand').onclick=()=>brandDialog();$('#closeBrandDialog').onclick=()=>$('#brandDialog').close();
$('#categoryAdminSearch').addEventListener('input',renderCategories);$('#categoryAdminSearch').addEventListener('search',renderCategories);$('#expandAllCategories').onclick=()=>{state.categories.filter(c=>state.categories.some(x=>Number(x.parent_id)===Number(c.id))).forEach(c=>state.categoryTreeOpen.add(Number(c.id)));renderCategories()};$('#collapseAllCategories').onclick=()=>{state.categoryTreeOpen.clear();renderCategories()};
$$('[data-close-dialog]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#productForm').onsubmit=saveProductWithProjectorFields;$('#categoryForm').onsubmit=saveCategory;$('#brandForm').addEventListener('submit',saveBrand);
['#productSearch','#categoryFilter','#brandFilter','#pageSize','#productFilter'].forEach(s=>{const el=$(s);const rerender=()=>{state.page=1;renderProducts()};el.addEventListener('input',rerender);el.addEventListener('change',rerender);if(s==='#productSearch')el.addEventListener('search',rerender)});
$('#brandAdminSearch').addEventListener('input',()=>{state.brandPage=1;renderBrands()});$('#brandAdminSearch').addEventListener('search',()=>{state.brandPage=1;renderBrands()});$('#brandSort').addEventListener('change',()=>{state.brandPage=1;renderBrands()});$('#brandStatusFilter').addEventListener('change',()=>{state.brandPage=1;renderBrands()});$('#saveOrderStatus').addEventListener('click',async()=>{const id=Number($('#orderDialog').dataset.orderId),status=$('#orderStatusEdit').value,manager_note=$('#orderManagerNote').value.trim();if(!id)return;const r=await supabase.from('orders').update({status,manager_note}).eq('id',id).select('id');if(r.error){notice('Помилка збереження: '+r.error.message+(r.error.code==='42703'?' Запустіть order-workflow-upgrade.sql у Supabase SQL Editor.':'') ,true);return}$('#orderDialog').close();await loadData();notice('Зміни для замовлення #'+id+' збережено.')});$('#orderSearch').addEventListener('input',renderOrders);$('#orderFilter').addEventListener('change',renderOrders);$('#customerSearch').addEventListener('input',renderCustomers);
$('#brandName').addEventListener('input',()=>{if(!$('#brandId').value)$('#brandSlug').value=slug($('#brandName').value)});
$('#selectAllProducts').addEventListener('change',e=>{$$('#adminProducts [data-select-product]').forEach(x=>{x.checked=e.target.checked;const id=Number(x.dataset.selectProduct);if(e.target.checked)state.selectedProducts.add(id);else state.selectedProducts.delete(id)});updateSelectionUI()});document.addEventListener('change',e=>{const x=e.target.closest('[data-select-product]');if(!x)return;const id=Number(x.dataset.selectProduct);if(x.checked)state.selectedProducts.add(id);else state.selectedProducts.delete(id);updateSelectionUI()});$('#bulkProductCategory').addEventListener('change',updateSelectionUI);$('#moveSelectedProducts').addEventListener('click',async()=>{const ids=[...state.selectedProducts],category=$('#bulkProductCategory').value;if(!ids.length||!category)return;const c=state.categories.find(x=>x.slug===category);if(!c)return;if(!confirm('Перенести вибрані товари ('+ids.length+') у категорію «'+c.name+'»?'))return;const r=await supabase.from('products').update({category}).in('id',ids).select('id');if(r.error){notice('Помилка перенесення: '+r.error.message,true);return}if((r.data||[]).length!==ids.length){notice('Оновлено '+(r.data||[]).length+' з '+ids.length+' товарів. Перевірте права доступу.',true);return}state.selectedProducts.clear();$('#bulkProductCategory').value='';await loadData();notice('Перенесено товарів: '+ids.length)});$('#bulkProductBrand').addEventListener('change',updateSelectionUI);$('#brandSelectedProducts').addEventListener('click',async()=>{const ids=[...state.selectedProducts],brand=state.brands.find(b=>Number(b.id)===Number($('#bulkProductBrand').value));if(!ids.length||!brand)return;if(!confirm('Змінити бренд для вибраних товарів ('+ids.length+') на «'+brand.name+'»?'))return;const r=await supabase.from('products').update({brand_id:brand.id,brand:brand.name}).in('id',ids).select('id');if(r.error){notice('Помилка зміни бренду: '+r.error.message,true);return}if((r.data||[]).length!==ids.length){notice('Оновлено '+(r.data||[]).length+' з '+ids.length+' товарів.',true);return}state.selectedProducts.clear();$('#bulkProductBrand').value='';await loadData();notice('Бренд змінено для товарів: '+ids.length)});$('#deleteSelectedProducts').addEventListener('click',async()=>{const ids=[...state.selectedProducts];if(!ids.length)return;if(!confirm('Видалити вибрані товари ('+ids.length+')?'))return;const r=await supabase.from('products').delete().in('id',ids).select('id');if(r.error){notice('Помилка видалення: '+r.error.message,true);return}const deleted=new Set((r.data||[]).map(x=>Number(x.id))),missing=ids.filter(id=>!deleted.has(Number(id)));if(missing.length){notice('Supabase не дозволив видалити '+missing.length+' товар(и). ID: '+missing.join(', ')+'. Перевіряю права/RLS.',true);return}state.selectedProducts.clear();await loadData();notice('Видалено товарів: '+deleted.size)});document.addEventListener('click',async e=>{let b;if(b=e.target.closest('[data-edit-product]'))return productDialog(state.products.find(p=>p.id===Number(b.dataset.editProduct)));if(b=e.target.closest('[data-duplicate-product]')){const p=state.products.find(x=>x.id===Number(b.dataset.duplicateProduct));if(p){const copy={...p,id:'',name:p.name+' — копія',sku:'',slug:p.slug+'-copy'};return productDialog(copy)}}if(b=e.target.closest('[data-delete-product]')){const id=Number(b.dataset.deleteProduct),p=state.products.find(x=>x.id===id);if(!p||!confirm('Видалити товар «'+p.name+'»?'))return;const r=await supabase.from('products').delete().eq('id',id).select('id');if(r.error){notice('Помилка видалення: '+r.error.message,true);return}if(!r.data?.length){notice('Supabase не видалив товар ID '+id+'. Найімовірніше, операцію блокує RLS/політика доступу.',true);return}state.selectedProducts.delete(id);await loadData();notice('Товар видалено.');return}if(b=e.target.closest('[data-edit-brand]'))return brandDialog(state.brands.find(x=>x.id===Number(b.dataset.editBrand)));if(b=e.target.closest('[data-delete-brand]')){const id=Number(b.dataset.deleteBrand),brand=state.brands.find(x=>x.id===id);if(!brand)return;const count=state.products.filter(p=>Number(p.brand_id)===id||txt(p.brand)===txt(brand.name)).length;if(count){notice('Не можна видалити «'+brand.name+'»: до бренду прив’язано '+count+' товарів. Спочатку перепризначте їх.',true);return}if(!confirm('Видалити бренд «'+brand.name+'»?'))return;const r=await supabase.from('brands').delete().eq('id',id);if(r.error){notice('Помилка видалення бренду: '+r.error.message,true);return}await loadData();notice('Бренд видалено.');return}if(b=e.target.closest('[data-brand-page]')){state.brandPage+=Number(b.dataset.brandPage);renderBrands();return}if(b=e.target.closest('[data-edit-category]'))return categoryDialog(state.categories.find(x=>x.id===Number(b.dataset.editCategory)));if(b=e.target.closest('[data-delete-category]')){const id=Number(b.dataset.deleteCategory),c=state.categories.find(x=>x.id===id);if(!c)return;const count=state.products.filter(p=>p.category===c.slug).length,children=state.categories.filter(x=>Number(x.parent_id)===id).length;if(count||children){notice('Не можна видалити «'+c.name+'»: '+count+' товарів, '+children+' підкатегорій. Спочатку перенесіть товари та підкатегорії.',true);return}if(!confirm('Видалити категорію «'+c.name+'»?'))return;const r=await supabase.from('categories').delete().eq('id',id);if(r.error){notice('Помилка видалення категорії: '+r.error.message,true);return}await loadData();notice('Категорію видалено.');return}if(b=e.target.closest('[data-edit-promotion]'))return promotionDialog(state.promotions.find(x=>x.id===Number(b.dataset.editPromotion)));if(b=e.target.closest('[data-delete-promotion]')){const id=Number(b.dataset.deletePromotion);if(confirm('Видалити акцію?')){const r=await supabase.from('promotions').delete().eq('id',id);if(r.error)return notice(r.error.message,true);await loadData();notice('Акцію видалено.')}return}if(b=e.target.closest('[data-edit-banner]'))return bannerDialog(state.banners.find(x=>x.id===Number(b.dataset.editBanner)));if(b=e.target.closest('[data-delete-banner]')){const id=Number(b.dataset.deleteBanner);if(confirm('Видалити банер?')){const r=await supabase.from('banners').delete().eq('id',id);if(r.error)return notice(r.error.message,true);await loadData();notice('Банер видалено.')}return}if(b=e.target.closest('[data-page]')){state.page+=Number(b.dataset.page);renderProducts();return}if(b=e.target.closest('[data-view-order]')){const o=state.orders.find(x=>Number(x.id)===Number(b.dataset.viewOrder));if(!o)return;$('#orderDialog').dataset.orderId=o.id;$('#orderDialogNumber').textContent='#'+o.id;$('#orderStatusEdit').value=o.status;$('#orderDetails').innerHTML='<div class="order-admin-details"><p><b>'+esc(o.customer_name)+'</b><br>'+esc(o.customer_phone||'')+(o.customer_email?'<br>'+esc(o.customer_email):'')+'</p><p><b>Доставка</b><br>'+esc(o.city||'—')+(o.address?'<br>'+esc(o.address):'')+'</p><p><b>Сума:</b> '+money(o.total)+'</p>'+(o.comment?'<p><b>Коментар:</b><br>'+esc(o.comment)+'</p>':'')+'</div>';$('#orderDialog').showModal()}});
document.addEventListener('click',event=>{const button=event.target.closest('[data-view-order]');if(!button)return;const order=state.orders.find(item=>Number(item.id)===Number(button.dataset.viewOrder));if(!order)return;const phone=contactPhone(order.customer_phone);$('#orderManagerNote').value=order.manager_note||'';$('#orderDetails').innerHTML='<div class="order-admin-details"><p><b>'+esc(order.customer_name)+'</b><br>'+esc(order.customer_phone||'')+(order.customer_email?'<br>'+esc(order.customer_email):'')+(phone?'<span class="order-contact-actions"><a href="tel:+'+phone+'">Подзвонити</a><a href="https://wa.me/'+phone+'" target="_blank" rel="noopener">WhatsApp</a></span>':'')+'</p><p><b>Доставка</b><br>'+esc(order.city||'—')+(order.address?'<br>'+esc(order.address):'')+'</p><p><b>Сума:</b> '+money(order.total)+'</p>'+(isSupplierInquiry(order)?'<p><span class="order-kind">Запит під замовлення</span></p>':'')+(order.comment?'<p><b>Коментар покупця</b><br>'+esc(order.comment)+'</p>':'')+'</div>'+orderItemsMarkup(order)});
const setSelectedProductVisibility=async(isActive)=>{const ids=[...state.selectedProducts],label=isActive?'показати в каталозі':'приховати з каталогу';if(!ids.length)return;if(!confirm((isActive?'Показати':'Приховати')+' вибрані товари ('+ids.length+')?'))return;const r=await supabase.from('products').update({is_active:isActive}).in('id',ids).select('id');if(r.error){notice('Помилка зміни видимості: '+r.error.message,true);return}const changed=(r.data||[]).length;if(changed!==ids.length){notice('Змінено видимість для '+changed+' з '+ids.length+' товарів. Перевірте права доступу.',true);return}state.selectedProducts.clear();await loadData();notice('Готово: товарів '+label+': '+changed+'.')};
$('#showSelectedProducts').addEventListener('click',()=>setSelectedProductVisibility(true));$('#hideSelectedProducts').addEventListener('click',()=>setSelectedProductVisibility(false));
document.addEventListener('click',async event=>{const addChild=event.target.closest('[data-add-child-category]'),toggleVisibility=event.target.closest('[data-toggle-category-visibility]'),move=event.target.closest('[data-move-category]');if(addChild){const parent=state.categories.find(c=>Number(c.id)===Number(addChild.dataset.addChildCategory));if(parent)categoryDialog(null,parent);return}if(move){const category=state.categories.find(c=>Number(c.id)===Number(move.dataset.categoryId));if(!category)return;const siblings=state.categories.filter(c=>Number(c.parent_id||0)===Number(category.parent_id||0)).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||a.name.localeCompare(b.name,'uk')),index=siblings.findIndex(c=>Number(c.id)===Number(category.id)),target=siblings[index+(move.dataset.moveCategory==='up'?-1:1)];if(!target)return;const result=await Promise.all([supabase.from('categories').update({sort_order:target.sort_order||0}).eq('id',category.id),supabase.from('categories').update({sort_order:category.sort_order||0}).eq('id',target.id)]);if(result.some(item=>item.error)){notice('Не вдалося змінити порядок категорії.',true);return}await loadData();notice('Порядок категорій оновлено.');return}if(toggleVisibility){const category=state.categories.find(c=>Number(c.id)===Number(toggleVisibility.dataset.toggleCategoryVisibility));if(!category)return;const next=!category.is_active;if(!confirm((next?'Показати':'Приховати')+' категорію «'+category.name+'» у каталозі?'))return;const result=await supabase.from('categories').update({is_active:next}).eq('id',category.id);if(result.error){notice('Помилка зміни видимості категорії: '+result.error.message,true);return}await loadData();notice('Категорію «'+category.name+'» '+(next?'показано':'приховано')+'.')}});
$('#addPromotion').onclick=()=>promotionDialog();$('#promotionTargetType').onchange=promotionTargets;$('#addBanner').onclick=()=>bannerDialog();$('#promotionSearch').oninput=renderPromotions;$('#promotionFilter').onchange=renderPromotions;$('#bannerSearch').oninput=renderBanners;$('#bannerFilter').onchange=renderBanners;
$('#promotionForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,r=Object.fromEntries(new FormData(f)),type=r.target_type;const p={name:r.name.trim(),code:r.code.trim()||null,discount_type:r.discount_type,discount_value:Number(r.discount_value),starts_at:r.starts_at||null,ends_at:r.ends_at||null,is_active:f.elements.is_active.checked,target_type:type,target_value:(type==='category'||type==='brand')?(r.target_value||null):null};let id=Number(r.id)||null,z;if(id)z=await supabase.from('promotions').update(p).eq('id',id).select('id').single();else z=await supabase.from('promotions').insert(p).select('id').single();if(z.error){notice('Помилка акції: '+z.error.message,true);return}id=z.data.id;if(type==='products'){await supabase.from('promotion_products').delete().eq('promotion_id',id);const ids=[...$('#promotionProducts').selectedOptions].map(o=>Number(o.value));if(ids.length){const q=await supabase.from('promotion_products').insert(ids.map(product_id=>({promotion_id:id,product_id})));if(q.error){notice('Акцію збережено, але товари не прив’язано: '+q.error.message,true);return}}}else await supabase.from('promotion_products').delete().eq('promotion_id',id);$('#promotionDialog').close();await loadData();notice('Акцію збережено.')});
$('#bannerForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,r=Object.fromEntries(new FormData(f));const p={title:r.title.trim(),subtitle:r.subtitle.trim()||null,image_url:r.image_url.trim()||null,link_url:r.link_url.trim()||null,button_text:r.button_text.trim()||null,sort_order:Number(r.sort_order||0),is_active:f.elements.is_active.checked};const q=r.id?supabase.from('banners').update(p).eq('id',r.id):supabase.from('banners').insert(p);const z=await q;if(z.error){notice('Помилка банера: '+z.error.message,true);return}$('#bannerDialog').close();await loadData();notice('Банер збережено.')});
$('#normalizeBrands').onclick=async()=>{
 const grouped=new Map();
 const ensureGroup=canonical=>{if(!grouped.has(canonical))grouped.set(canonical,{canonical,brands:[],products:[]});return grouped.get(canonical)};
 state.brands.forEach(brand=>ensureGroup(canonicalBrandName(brand.name)).brands.push(brand));
 state.products.filter(product=>product.brand||product.brand_id).forEach(product=>{const linked=state.brands.find(brand=>Number(brand.id)===Number(product.brand_id));ensureGroup(canonicalBrandName(product.brand||linked?.name)).products.push(product)});
 const groups=[...grouped.values()].filter(group=>group.canonical&&(
   group.brands.length>1||group.brands.some(brand=>brand.name!==group.canonical||brand.slug!==slug(group.canonical))||group.products.some(product=>product.brand!==group.canonical)
 ));
 const affected=groups.reduce((total,group)=>total+group.products.length,0);
 if(!groups.length){notice('Назви брендів уже впорядковано.');return}
 if(!confirm('Впорядкувати '+groups.length+' груп брендів і переприв’язати до канонічних назв '+affected+' товарів? Старі записи не видалятимуться — вони будуть приховані.'))return;
 let updated=0,hidden=0;
 for(const group of groups){
   let canonical=group.brands.find(brand=>brand.name===group.canonical);
   if(!canonical&&group.brands.length===1){const renamed=await supabase.from('brands').update({name:group.canonical,slug:slug(group.canonical),is_active:true,updated_at:new Date().toISOString()}).eq('id',group.brands[0].id).select('*').single();if(renamed.error){notice('Зупинено на бренді «'+group.canonical+'»: '+renamed.error.message,true);await loadData();return}canonical=renamed.data}
   if(!canonical){const created=await supabase.from('brands').insert({name:group.canonical,slug:slug(group.canonical),is_active:true,updated_at:new Date().toISOString()}).select('*').single();if(created.error){notice('Зупинено на бренді «'+group.canonical+'»: '+created.error.message,true);await loadData();return}canonical=created.data}
   else if(!canonical.is_active){const enabled=await supabase.from('brands').update({is_active:true,updated_at:new Date().toISOString()}).eq('id',canonical.id).select('*').single();if(enabled.error){notice('Зупинено на бренді «'+group.canonical+'»: '+enabled.error.message,true);await loadData();return}canonical=enabled.data}
   const sourceIds=new Set(group.brands.filter(brand=>Number(brand.id)!==Number(canonical.id)).map(brand=>Number(brand.id)));
   const products=group.products.filter(product=>product.brand!==group.canonical||Number(product.brand_id)!==Number(canonical.id)||sourceIds.has(Number(product.brand_id)));
   let changed=0;
   for(let offset=0;offset<products.length;offset+=100){const ids=products.slice(offset,offset+100).map(product=>product.id),result=await supabase.from('products').update({brand_id:canonical.id,brand:group.canonical}).in('id',ids).select('id');if(result.error){notice('Оновлено '+updated+' товарів, але сталася помилка: '+result.error.message,true);await loadData();return}changed+=(result.data||[]).length}
   if(changed!==products.length){notice('Оновлено '+updated+changed+' з '+affected+' товарів. Старі бренди залишено активними для безпеки.',true);await loadData();return}
   updated+=changed;
   const duplicates=group.brands.filter(brand=>Number(brand.id)!==Number(canonical.id));
   if(duplicates.length){const deactivated=await supabase.from('brands').update({is_active:false,updated_at:new Date().toISOString()}).in('id',duplicates.map(brand=>brand.id));if(deactivated.error){notice('Товари для «'+group.canonical+'» уже оновлено, але старі записи не приховано: '+deactivated.error.message,true);await loadData();return}hidden+=duplicates.length}
 }
 await loadData();notice('Готово: оновлено '+updated+' товарів, приховано дублікати брендів: '+hidden+'.')
};
supabase.auth.onAuthStateChange(ev=>{if(ev==='PASSWORD_RECOVERY')view('recovery')});
supabase.auth.getSession().then(({data:{session}})=>session?dashboard():view('login'));

// Універсальний імпорт XML: читає поширені структури постачальників і не перезаписує ручні дані.
(() => {
  const importer = { rows: [], selected: new Set(), page: 1, prices: new Map(), meta: new Map(), report: null };
  const supportedImageHosts = new Set(['www.tradeinn.com','www.audiotrends.com.au','static-ecapac.acer.com','media4home.com.pl','media.sonos.com','images.samsung.com','assets2.razerzone.com','d7qztf2ityad6.cloudfront.net','hp.widen.net','img06.en25.com','koss.com.ua','ssl-product-images.www8-hp.com','www.3ona51.com','www.hp.com','www.koss.com','yugcontract.ua','www.it4profit.com','content.it4profit.com','erc.ua','www.erc.ua']);
  const cleanImportText = (value = '') => String(value).replace(/\s+/g, ' ').trim();
  const decodeEntities = (value = '') => {
    let text = String(value || '');
    for (let pass = 0; pass < 3; pass += 1) {
      const field = document.createElement('textarea');
      field.innerHTML = text;
      if (field.value === text) break;
      text = field.value;
    }
    return text;
  };
  const textFrom = (node, names) => {
    for (const name of names) {
      const found = node.querySelector(name);
      const value = cleanImportText(found?.textContent || '');
      if (value) return value;
    }
    return '';
  };
  const importNumber = (value) => {
    const parsed = Number(String(value || '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const importQuantity = (value) => Math.max(0, Number((String(value || '').match(/\d+/) || ['0'])[0]));
  // ERC інколи передає не число, а текстовий складський стан на кшталт
  // «Є в наявності, закінчується». Це все ще товар, який можна купити.
  const importAvailabilityStatus = (value = '') => {
    const status = normaliseCategory(value);
    if (!status) return '';
    if (/закінчу|обмеж|limited|low stock/i.test(status)) return 'limited_stock';
    if (/по запиту|під замовлення|under order/i.test(status)) return 'under_order';
    if (/немає|відсут|out of stock|no stock|^ні$/i.test(status)) return 'out_of_stock';
    if (/є в наявності|в наявності|in stock|available|^так$|^yes$/i.test(status)) return 'in_stock';
    return '';
  };
  const normaliseSku = (value = '') => cleanImportText(value).replace(/^\*+|\*+$/g, '').toUpperCase();
  const normaliseCategory = (value = '') => cleanImportText(value).toLocaleLowerCase('uk-UA').replace(/[ʼ’']/g, '').replace(/\s+/g, ' ');
  const normaliseSpecKey = (value = '') => cleanImportText(value).toLocaleLowerCase('uk-UA').replace(/[:\s]+$/g, '');
  const canonicalSpecKey = (value) => {
    const key = normaliseSpecKey(value);
    if (/діагонал/.test(key)) return 'Діагональ';
    if (/(?:вбудован|внутрішн|загальн).*(?:пам.?ят|storage)|(?:пам.?ят|storage).*(?:вбудован|внутрішн|загальн)/.test(key)) return 'Вбудована пам’ять';
    if (/оперативн.*пам.?ят|\bram\b/.test(key)) return 'Оперативна пам’ять';
    if (/процесор|processor|\bcpu\b|чипсет|чип\b/.test(key)) return 'Процесор';
    if (/накопичувач|\bssd\b|обсяг.*диск/.test(key)) return 'Накопичувач';
    if (/роздільн.*здатн|\bresolution\b/.test(key)) return 'Роздільна здатність';
    if (/технолог.*проекц|projection technology/.test(key)) return 'Технологія проекції';
    if (/проекційн.*(?:співвіднош|віднош)|throw\s*ratio/.test(key)) return 'Проекційне співвідношення';
    if (/світлов.*потік|яскравість|\bbrightness\b/.test(key)) return 'Яскравість';
    if (/джерел.*світла|тип.*джерела/.test(key)) return 'Джерело світла';
    if (/частота.*(?:оновлення|розгорт)|refresh rate/.test(key)) return 'Частота оновлення';
    if (/тип.*матриц|матриця|panel type/.test(key)) return 'Тип матриці';
    if (/smart\s*tv|смарт\s*тв/.test(key)) return 'Smart TV';
    if (/камер/.test(key)) return 'Камера';
    if (/співвідношення.*сторін|формат.*екран|формат.*матриц/.test(key)) return 'Співвідношення сторін';
    if (/тип.*екран|форм.?фактор|конструкц/.test(key)) return 'Тип екрану';
    if (/установк|встановлен|монтаж/.test(key)) return 'Установка';
    return cleanImportText(value).replace(/:$/, '');
  };
  const parseDescription = (markup = '') => {
    const parsed = new DOMParser().parseFromString(decodeEntities(markup), 'text/html');
    return cleanImportText(parsed.body.textContent || '').slice(0, 3000);
  };
  const isSupplierPromotionText = (value = '') => /(?:програма\s+захисту\s+рентабельності|зареєструват(?:ись|и)|знижк[ау]\s+на\s+бізнес|дилерськ(?:ого|ий)\s+прайс|кінцев(?:ого|ий)\s+замовник|представництв[ао]\s+epson)/iu.test(value);
  const importDescription = (...values) => values.map(parseDescription).find((value) => value && !isSupplierPromotionText(value)) || '';
  const parseSpecifications = (markup = '') => {
    const parsed = new DOMParser().parseFromString(decodeEntities(markup), 'text/html');
    const specifications = {};
    const add = (key, value) => {
      const label = canonicalSpecKey(key), text = cleanImportText(value);
      if (label && text && label.length <= 120 && text.length <= 700) specifications[label] = text;
    };
    parsed.querySelectorAll('tr').forEach((row) => {
      const cells = [...row.querySelectorAll('th,td')].map((cell) => cleanImportText(cell.textContent)).filter(Boolean);
      if (cells.length >= 2) add(cells[0], cells.slice(1).join(' '));
    });
    // ERC нерідко передає параметри не окремим XML-блоком, а рядками у
    // ProductDescription: <br>, абзацами чи списком. Зберігаємо межі цих
    // рядків, щоб «Параметр: значення» також став характеристикою.
    const lineMarkup=decodeEntities(markup).replace(/<(?:br\s*\/?|\/(?:p|div|li|tr|h[1-6]))\s*[^>]*>/giu, '\n');
    const lineDocument=new DOMParser().parseFromString(lineMarkup, 'text/html');
    [parsed.body.innerText || '', lineDocument.body.textContent || ''].join('\n').split(/[\n;]+/).forEach((line) => {
      const match = cleanImportText(line).match(/^([^:]{2,120}):\s*(.+)$/);
      if (match) add(match[1], match[2]);
    });
    return specifications;
  };
  const attributeSpecifications = (node) => {
    const specifications = {};
    const add = (rawKey, rawValue) => {
      const key = canonicalSpecKey(rawKey || ''), value = cleanImportText(rawValue || '');
      if (key && value && key.length <= 120 && value.length <= 700) specifications[key] = value;
    };
    [...node.querySelectorAll('AttrList element, attrlist element, attribute, attr, parameter, property, specification, spec, feature, characteristic')].forEach((item) => {
      add(item.getAttribute('Name') || item.getAttribute('name') || item.getAttribute('Key') || item.getAttribute('key') || item.getAttribute('Label') || item.getAttribute('label') || item.querySelector('name,key,label,title')?.textContent, item.getAttribute('Value') || item.getAttribute('value') || item.getAttribute('Data') || item.getAttribute('data') || item.querySelector('value,data,content')?.textContent || item.textContent);
    });
    return specifications;
  };
  const titleSpecifications = (name = '') => {
    const specifications = {};
    const diagonal = String(name).match(/(?:^|[\s,(])([1-9]\d{1,2}(?:[.,]\d+)?)\s*(?:&quot;|\")/i);
    const ratio = String(name).match(/\b(\d{1,2}:\d{1,2})\b/);
    if (diagonal) specifications['Діагональ'] = diagonal[1].replace(',', '.') + '"';
    if (ratio) specifications['Співвідношення сторін'] = ratio[1];
    return specifications;
  };
  // Шаблони не прибирають жодної характеристики з XML. Вони лише додають
  // відсутні ключові параметри з назви, щоб фільтри й картка товару мали
  // однакові, зрозумілі назви полів.
  const templateSpecifications = (source = '') => {
    const text = cleanImportText(source);
    const specifications = {};
    const add = (key, value) => { if (value && !specifications[key]) specifications[key] = value; };
    const diagonal = text.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*(?:["″]|дюйм(?:ів|и|а)?\b)/iu)?.[1];
    const resolution = text.match(/\b\d{3,4}\s*[×xх]\s*\d{3,4}\b/iu)?.[0] || text.match(/\b(?:8k|4k|uhd|full\s*hd|fhd|wuxga|wqxga|wxga|xga)\b/iu)?.[0];
    const ram = text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:гб|gb)\s*(?:ram|оперативн)/iu)?.[1];
    const storageMatches = [...text.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(?:гб|gb|тб|tb)\b/giu)];
    const storage = storageMatches.map((match) => ({ value: match[1].replace(',', '.') + ' ' + (/тб|tb/iu.test(match[2]) ? 'ТБ' : 'ГБ'), size: Number(match[1].replace(',', '.')) * (/тб|tb/iu.test(match[2]) ? 1024 : 1) })).filter((item) => item.size >= 32).sort((a, b) => b.size - a.size)[0]?.value;
    const processor = /(apple\s+m\d(?:\s+(?:pro|max|ultra))?|intel\s+core\s+(?:i[3-9]|ultra)|amd\s+ryzen\s+\d|snapdragon\s+\d+)/iu.exec(text)?.[0];
    const brightness = text.match(/\b(\d{2,5})\s*(?:лм|lm)\b/iu)?.[1];
    const throwRatio = text.match(/\b(\d+(?:[.,]\d+)?\s*(?:[-–—]\s*\d+(?:[.,]\d+)?)?\s*:\s*1)\b/u)?.[1]?.replace(/\s+/g, ' ').replace(',', '.');
    if (/(?:смартфон|телефон|iphone|android)/iu.test(text)) { add('Діагональ', diagonal && diagonal.replace(',', '.') + '″'); add('Вбудована пам’ять', storage); add('Оперативна пам’ять', ram && ram.replace(',', '.') + ' ГБ'); }
    if (/(?:ноутбук|laptop|macbook)/iu.test(text)) { add('Діагональ', diagonal && diagonal.replace(',', '.') + '″'); add('Процесор', processor); add('Оперативна пам’ять', ram && ram.replace(',', '.') + ' ГБ'); add('Накопичувач', storage); }
    if (/^\s*(?:про[єе]ктор|projector)\b/iu.test(text)) {
      const projectorPurposes = [];
      if (/(?:лазер|laser)/iu.test(text)) projectorPurposes.push('Лазерний');
      if (/(?:домашн|home\s*(?:cinema|theater|theatre))/iu.test(text)) projectorPurposes.push('Домашній');
      if (/(?:ультра\s*-?\s*короткофокус|ultra\s*-?\s*short\s*-?\s*throw)/iu.test(text)) projectorPurposes.push('Ультракороткофокусний', 'Короткофокусний');
      else if (/(?:короткофокус|short\s*-?\s*throw)/iu.test(text)) projectorPurposes.push('Короткофокусний');
      if (/(?:інсталяційн|installation)/iu.test(text)) projectorPurposes.push('Інсталяційний');
      if (/(?:універсальн|universal)/iu.test(text)) projectorPurposes.push('Універсальний');
      add('Роздільна здатність', resolution); add('Яскравість', brightness && brightness + ' лм'); add('Проекційне співвідношення', throwRatio); add('Технологія проекції', /\b3lcd\b/iu.test(text) ? '3LCD' : /\bdlp\b/iu.test(text) ? 'DLP' : /\blcos\b/iu.test(text) ? 'LCoS' : /\blcd\b/iu.test(text) ? 'LCD' : ''); add('Призначення', [...new Set(projectorPurposes)].join(' · ')); add('Джерело світла', /лазер|laser/iu.test(text) ? 'Лазер' : /світлодіод|\bled\b/iu.test(text) ? 'Світлодіод' : /ламп|lamp/iu.test(text) ? 'Лампа' : '');
    }
    if (/(?:телевізор|\btv\b)/iu.test(text)) { add('Діагональ', diagonal && diagonal.replace(',', '.') + '″'); add('Роздільна здатність', resolution); add('Тип матриці', /mini\s*-?\s*led/iu.test(text) ? 'miniLED' : /oled/iu.test(text) ? 'OLED' : /qled/iu.test(text) ? 'QLED' : /\bled\b/iu.test(text) ? 'LED' : ''); add('Smart TV', /(?:smart\s*tv|google\s*tv|android\s*tv|webos|tizen|vidaa)/iu.test(text) ? 'Є' : ''); }
    const officeType = /(?:бфп|мфу|mfp|multifunction|багатофункціональн\w*\s+(?:пристрій|апарат))/iu.test(text) ? 'БФП' : /(?:принтер|printer)/iu.test(text) ? 'Принтер' : /(?:сканер|scanner)/iu.test(text) ? 'Сканер' : /(?:копір|копир|copier)/iu.test(text) ? 'Копір' : /(?:ламінатор|ламинатор|laminator)/iu.test(text) ? 'Ламінатор' : /(?:знищувач|шредер|shredder)/iu.test(text) ? 'Знищувач документів' : '';
    if (officeType) {
      const interfaces=[];
      const optionalWifi=/(?:wi[ -]?fi|wireless|wlan).{0,80}(?:опц|optional|не\s*(?:вход|входить)|докуп|add[ -]?on|модул)|(?:опц|optional|не\s*(?:вход|входить)|докуп|add[ -]?on|модул).{0,80}(?:wi[ -]?fi|wireless|wlan)/iu.test(text);
      const optionalDuplex=/(?:дуплекс|двосторон|duplex).{0,80}(?:опц|optional|не\s*(?:вход|входить)|докуп|add[ -]?on|модул)|(?:опц|optional|не\s*(?:вход|входить)|докуп|add[ -]?on|модул).{0,80}(?:дуплекс|двосторон|duplex)/iu.test(text);
      if (/(?:wi[ -]?fi|wireless|wlan)/iu.test(text)&&!optionalWifi) interfaces.push('Wi‑Fi');
      if (/(?:ethernet|\blan\b|rj[ -]?45)/iu.test(text)) interfaces.push('Ethernet');
      if (/\busb(?:\s|$|[0-9])?/iu.test(text)) interfaces.push('USB');
      if (/bluetooth/iu.test(text)) interfaces.push('Bluetooth');
      add('Тип пристрою', officeType); add('Формат', text.match(/\bA([3-6])\b/iu)?.[0]?.toUpperCase()); add('Тип друку', /(?:color|colour|кольоров)/iu.test(text) ? 'Кольоровий' : /(?:mono|monochrome|монохром|чорно[ -]?білий)/iu.test(text) ? 'Монохромний' : ''); add('Технологія друку', /(?:струмен|струйн|\bink\b|inkjet)/iu.test(text) ? 'Струменевий' : /(?:лазер|laser)/iu.test(text) ? 'Лазерний' : ''); add('Інтерфейси', interfaces.join(', ')); add('Дуплексний друк', /(?:дуплекс|двосторон|duplex|two[ -]?sided)/iu.test(text)&&!optionalDuplex?'Є':'');
    }
    return specifications;
  };
  const mergeMissingSpecifications = (specifications, inferred) => ({ ...inferred, ...specifications });
  // Повна назва з джерела зберігається в описі, а в заголовку лишається модель.
  const compactImportName = (value = '', sku = '', brand = '') => {
    let name = decodeEntities(cleanImportText(value))
      .replace(/\s*[|•]\s*(?:код|sku|артикул|vendor code)\b.*$/iu, '')
      .replace(/\s*\((?:код|sku|артикул)\s*[:#]?[^)]*\)/iu, '')
      .replace(/\s{2,}/g, ' ').trim();
    if (/^телевізор\b/iu.test(name)) {
      const size = name.match(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:["″]|дюйм(?:ів|и|а)?\b)/iu)?.[1];
      const technology = [[/mini\s*-?\s*led/iu, 'miniLED'], [/oled/iu, 'OLED'], [/qled/iu, 'QLED'], [/\bled\b/iu, 'LED']].find(([pattern]) => pattern.test(name))?.[1];
      const excludedModels = new Set(['4K', '8K', 'HDR', 'HDR10', 'HDMI', 'USB', 'WIFI', 'WI-FI', 'LED', 'OLED', 'QLED', 'MINILED', 'FULLHD']);
      const model = [...name.matchAll(/\b[A-ZА-ЯІЇЄ]{1,6}(?:[-_ ]?[A-Z0-9]{2,})+\b/g)].map((match) => match[0]).find((candidate) => candidate.replace(/[-_ ]/g, '').length >= 5 && !excludedModels.has(candidate.replace(/[-_ ]/g, '').toUpperCase()));
      const cleanBrand = cleanImportText(brand).replace(/\s+(?:tv|телевізори)$/iu, '').trim();
      const compact = ['Телевізор', size ? size.replace(',', '.') + '"' : '', cleanBrand, technology || '', model || ''].filter(Boolean).join(' ');
      if (compact) name = compact;
    }
    const parts = name.split(/[;,]/).map(cleanImportText).filter(Boolean);
    const startsWithProductType = /^(?:про[єе]ктор|телевізор|монітор|екран|саундбар|акустичн|гарнітур|навушник|мікрофон|портативн|зарядн|джерел|ноутбук|планшет|смартфон|годинник|принтер|роутер|камера|клавіатур|миша|кабель|адаптер|блок\s+живлення|павербанк|power\s*bank)/iu;
    const technicalTail = /\b(?:usb|hdmi|wifi|wi-fi|bluetooth|bt\s*\d|led|oled|qled|mini\s*-?\s*led|fhd|uhd|4k|8k|ips|va|tn|rgb|hdr|гб|gb|тб|tb|гц|hz|вт|w|лм|lm|кг|kg|м\b|mm\b|чорн|білий|сірий|silver|black|white|gray|grey)\b/iu;
    if (startsWithProductType.test(name) && parts.length >= 2 && (parts.length >= 3 || technicalTail.test(parts.slice(1).join(' ')))) name = parts[0];
    const normaliseToken = (text) => String(text || '').toLocaleLowerCase('uk-UA').replace(/[^\p{L}\p{N}]/gu, '');
    const cleanSku = cleanImportText(sku);
    if (cleanSku && !normaliseToken(name).includes(normaliseToken(cleanSku))) name += ' (' + cleanSku + ')';
    return name || cleanImportText(value);
  };
  const isSupportedImageHost = (hostname = '') => supportedImageHosts.has(hostname) || hostname === 'erc.ua' || hostname.endsWith('.erc.ua');
  const allowedImage = (value) => {
    try {
      const url = new URL(value);
      const isAsbisPlaceholder = url.hostname === 'www.it4profit.com' && /^\/catalogimg\/wic\//i.test(url.pathname);
      return url.protocol === 'https:' && isSupportedImageHost(url.hostname) && !isAsbisPlaceholder ? url.href : '';
    } catch { return ''; }
  };
  const imagesFrom = (node, markup) => {
    const fromTags = [...node.querySelectorAll('image,Image,photo,Photo,picture,Picture,img,image_url,photo_url')].map((item) => item.getAttribute('src') || item.getAttribute('href') || item.textContent || '');
    const fromMarkup = decodeEntities(markup).match(/https?:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]+)?/gi) || [];
    return [...new Set([...fromTags, ...fromMarkup].map(allowedImage).filter(Boolean))].slice(0, 6);
  };
  // ASBIS groups most AENO equipment under "Other".  Keep those products in a
  // useful Ukrainian catalogue tree instead of creating a catch-all "Other".
  const aenoCategoryPlan = (row) => {
    if (normaliseCategory(row.vendor) !== 'aeno') return null;
    const source = [row.name, row.subcategory, row.sourceCategory].map(cleanImportText).join(' ').toLocaleLowerCase('uk-UA');
    const groups = [
      [/acc\s*-?\s*vacuum\s*sealer|vacuum\s*(?:seal\s*)?bags?|seal\s*bags?/i, 'Аксесуари для вакууматорів'],
      [/vacuum\s*sealer|вакууматор/i, 'Вакууматори'],
      [/vacuum\s*cleaner\s*robot|robot\s*vacuum|робот[и-]?пилосос/i, 'Роботи-пилососи'],
      [/vacuum\s*cleaner\s*transformer|wet\s*and\s*dry\s*cleaning|миюч[аі]\s*пилосос/i, 'Миючі пилососи'],
      [/vacuum\s*cleaner\s*stick|stick\s*vacuum|вертикальн[іи]\s*пилосос/i, 'Вертикальні пилососи'],
      [/пилосос|vacuum\s*cleaner|robot\s*cleaner/i, 'Аксесуари для пилососів'],
      [/smart\s*space\s*heater|smart\s*обігрівач|\bheater\b|обігрівач/i, 'Обігрівачі'],
      [/irrigator|іригатор/i, 'Іригатори'],
      [/brush\s*head|насадк[аи]\s*для\s*зубн/i, 'Аксесуари для зубних щіток'],
      [/toothbrush|tooth\s*brush|зубн[іи]?\s*щітк/i, 'Електричні зубні щітки'],
      [/air\s*purifier|очищувач[і]?\s*повітря/i, 'Аксесуари для очищувачів повітря'],
      [/аксесуар[и]?\s*до\s*паров[іи]?\s*швабр|steam\s*mop.*(?:accessor|mop|brush|nozzle)|(?:mop|brush|nozzle).*steam\s*mop/i, 'Аксесуари для парових швабр'],
      [/steam\s*mop|паров[іи]?\s*швабр/i, 'Парові швабри'],
      [/acc\s*-?\s*multibaker|grill.*(?:plate|accessor)|(?:plate|accessor).*grill/i, 'Аксесуари для електрогрилів'],
      [/grill|грил/i, 'Електрогрилі'],
      [/toaster|тостер/i, 'Тостери'],
      [/electric\s*kettle|\bkettle\b|чайник/i, 'Електрочайники'],
      [/hand\s*garment\s*steamer|\bsteamer\b|відпарювач/i, 'Відпарювачі'],
      [/sous\s*vide|су-?від/i, 'Су-від'],
      [/kitchen\s*scale|кухонн[іи]?\s*ваг/i, 'Кухонні ваги'],
      [/body\s*scale|підлогов[іи]?\s*ваг/i, 'Підлогові ваги'],
      [/hair\s*dryer|hair\s*styler|фен|технік[аи]\s*для\s*волосс/i, 'Техніка для волосся'],
      [/blender|блендер/i, 'Блендери'],
      [/robot\s*kitchen|cooking\s*robot|кухонн[іи]?\s*робот/i, 'Кухонні машини']
    ];
    const match = groups.find(([pattern]) => pattern.test(source));
    return { rootSlug: 'pobutova-tehnika', rootName: 'Побутова техніка', childName: match ? match[1] : '' };
  };
  // Формат понад 20 дюймів означає широкоформатний пристрій. Розмір
  // визначаємо тільки з назви, щоб випадкове число в характеристиках не
  // змінило категорію товару.
  const isWideFormat = (value = '') => /(?:^|[^0-9])(?:2[1-9]|[3-9][0-9]|[1-9][0-9]{2})\s*(?:"|'|″|′|”|''|дюйм(?:ів|и|а)?|inch(?:es)?|in\.?)(?=$|[^\p{L}\p{N}])/iu.test(value)
    || /(?:^|[^a-z0-9])a[0-2](?=$|[^a-z0-9])/iu.test(value);
  // «Color: Black» часто описує корпус, а не кольоровий друк. Тому
  // кольоровість визначаємо з назви або лише з профільного поля про друк.
  const printColourMode = (name = '', specifications = {}) => {
    const title = cleanImportText(name).toLocaleLowerCase('uk-UA');
    if (/(?:\bcolor\b|\bcolour\b|кольоров)/iu.test(title)) return 'color';
    if (/(?:\bmono\b|monochrome|монохром|чорно[ -]?білий|\blaserjet\b)/iu.test(title)) return 'mono';
    const printDetails = Object.entries(specifications || {})
      .filter(([key]) => /(?:тип\s+друку|технолог.*друку|print\s*(?:type|mode|technolog)|color\s*mode|кольоровість)/iu.test(cleanImportText(key)))
      .flatMap(([, value]) => Array.isArray(value) ? value : [value]).map(cleanImportText).join(' ').toLocaleLowerCase('uk-UA');
    if (/(?:\bmono\b|monochrome|монохром|чорно[ -]?білий)/iu.test(printDetails)) return 'mono';
    if (/(?:\bcolor\b|\bcolour\b|кольоров)/iu.test(printDetails)) return 'color';
    return '';
  };
  // У різних XML ERC одна й та сама група може називатися «БФП лазерні
  // кольорові», «Кольорові БФП» тощо. Для таких назв завжди повертаємо
  // постійну внутрішню категорію, а не створюємо ще одну підкатегорію.
  const officeSourceCategoryPlan = (row) => {
    const source = [row.subcategory, row.sourceCategory].map(cleanImportText).join(' ').toLocaleLowerCase('uk-UA');
    const name = cleanImportText(row.name).toLocaleLowerCase('uk-UA');
    const mainDevice = /(?:бфп|мфу|\bmfp\b|multifunction|багатофункціональн\w*\s+(?:пристрій|апарат)|принтер|\bprinter\b)/iu.test(name);
    const accessory = /(?:картридж|тонер|чорнил|cartridge|drum|фотобарабан|лоток|підставк|стенд|tray\b|stand\b|accessor|аксесуар)/iu.test(name);
    // «Базовий блок БФП, 1 лоток» — це пристрій, а не лоток як аксесуар.
    if (!source || (accessory && !mainDevice)) return null;
    const isMfp=/(?:бфп|мфу|\bmfp\b|multifunction|багатофункціональн)/iu.test(source);
    const isPrinter=!isMfp&&/(?:принтер|\bprinter\b)/iu.test(source);
    if (!isMfp&&!isPrinter) return null;
    const mode=/(?:color|colour|кольоров)/iu.test(source)?'color':/(?:mono|monochrome|монохром|чорно[ -]?білий)/iu.test(source)?'mono':'';
    const kind=isMfp?'mfp':'printers';
    return { rootSlug: 'office-equipment', rootName: 'Оргтехніка', childSlug: mode?'office-'+kind+'-'+mode:'office-'+kind, childName: mode==='color'?(isMfp?'Кольорові БФП':'Кольорові принтери'):mode==='mono'?(isMfp?'Монохромні БФП':'Монохромні принтери'):(isMfp?'БФП':'Принтери') };
  };
  // Принтери й БФП розкладаємо одразу під час імпорту: кольорові та
  // монохромні моделі не повинні спочатку потрапляти у стару змішану категорію ERC.
  const officeEquipmentCategoryPlan = (row) => {
    // Тип пристрою визначаємо виключно за назвою. Слова на кшталт
    // «scanner» у характеристиках смартфона (наприклад LiDAR Scanner)
    // не повинні перетворювати його на сканер.
    const nameSource = cleanImportText(row.name).toLocaleLowerCase('uk-UA');
    const source = [row.name, row.subcategory, row.sourceCategory, ...Object.values(row.specifications || {})]
      .map(cleanImportText).join(' ').toLocaleLowerCase('uk-UA');
    if (/(?:^|[\s-])(?:смартфон|smartphone|iphone|мобільн(?:ий|ого)?\s+телефон)/iu.test(nameSource)) return null;
    if (/(?:^|[\s-])(?:планшет|tablet|ipad)/iu.test(nameSource)) return null;
    // Тип основного пристрою має пріоритет над словами «лоток», «стенд» тощо:
    // базовий блок БФП може містити лотки, але не є аксесуаром.
    const isMfp = /(?:бфп|мфу|\bmfp\b|multifunction|багатофункціональн\w*\s+(?:пристрій|апарат))/iu.test(nameSource);
    const isPrinter = /(?:принтер|\bprinter\b)/iu.test(nameSource);
    const isScanner = /(?:сканер|scanner)/iu.test(nameSource);
    const isCopier = /(?:копір|копир|copier)/iu.test(nameSource);
    const isLaminator = /(?:ламінатор|ламинатор|laminator)/iu.test(nameSource);
    const isShredder = /(?:знищувач|шредер|shredder)/iu.test(nameSource);
    if (/(?:термо|thermal|label printer|етикет)/iu.test(source)) return null;
    if (/(?:навушник|headphone|headset|гарнітур)/iu.test(source)) return { rootSlug: 'audio', rootName: 'Audio', childSlug: 'headphones', childName: 'Навушники' };
    if (!(isMfp || isPrinter || isScanner || isCopier || isLaminator || isShredder) && /(?:лоток|підставк|стенд|tray\b|stand\b|accessor|аксесуар|додатковий\s+планшет)/iu.test(source)) return { rootSlug: 'cat-accessories', rootName: 'Кріплення та аксесуари', childSlug: 'office-accessories', childName: 'Аксесуари для оргтехніки' };
    if (/(?:послуг|service|активац|технічн\w*\s+підтримк)/iu.test(source)) return { rootSlug: 'services', rootName: 'Послуги', childSlug: 'technical-support', childName: 'Технічна підтримка' };
    // У JavaScript \b не розпізнає кирилицю як межу слова. Тому БФП/МФУ
    // перевіряємо без нього й обробляємо раніше за сканери: у БФП часто
    // є характеристика «сканер» або «копіювання».
    // Якщо в назві моделі тип друку не вказано, беремо його з назви
    // вихідної групи ERC: «БФП струменеві кольорові» — це все одно
    // «Кольорові БФП», а не нова категорія.
    const sourcePrintMode = /(?:color|colour|кольоров)/iu.test(source) ? 'color'
      : /(?:mono|monochrome|монохром|чорно[ -]?білий)/iu.test(source) ? 'mono' : '';
    const printMode = printColourMode(row.name, row.specifications) || sourcePrintMode;
    if (isMfp || isPrinter) {
      const kind = isMfp ? 'mfp' : 'printers';
      if (isWideFormat(nameSource)) return { rootSlug: 'office-equipment', rootName: 'Оргтехніка', childSlug: 'office-wide-format', childName: 'Принтери та БФП широкоформатні' };
      if (printMode === 'mono') return { rootSlug: 'office-equipment', rootName: 'Оргтехніка', childSlug: 'office-' + kind + '-mono', childName: isMfp ? 'Монохромні БФП' : 'Монохромні принтери' };
      if (printMode === 'color') return { rootSlug: 'office-equipment', rootName: 'Оргтехніка', childSlug: 'office-' + kind + '-color', childName: isMfp ? 'Кольорові БФП' : 'Кольорові принтери' };
      return { rootSlug: 'office-equipment', rootName: 'Оргтехніка', childSlug: 'office-' + kind, childName: isMfp ? 'БФП' : 'Принтери' };
    }
    if (isScanner) return { rootSlug: 'office-equipment', rootName: 'Оргтехніка', childSlug: 'office-scanners', childName: 'Сканери' };
    if (isCopier) return { rootSlug: 'office-equipment', rootName: 'Оргтехніка', childSlug: 'office-copiers', childName: 'Копіри' };
    if (isLaminator) return { rootSlug: 'office-equipment', rootName: 'Оргтехніка', childSlug: 'office-laminators', childName: 'Ламінатори' };
    if (isShredder) return { rootSlug: 'office-equipment', rootName: 'Оргтехніка', childSlug: 'office-shredders', childName: 'Знищувачі документів' };
    return null;
  };
  // Загальні правила застосовуємо лише до однозначних типів товарів. Вони
  // доповнюють назви категорій із XML, але не переносять аксесуари до самих пристроїв.
  const standardCategoryPlan = (row) => {
    // Для основної категорії достатньо назви товару. Параметри залишаємо
    // для фільтрів: вони не можуть випадково перекласифікувати товар.
    const nameSource = cleanImportText(row.name).toLocaleLowerCase('uk-UA');
    const source = [row.name, row.subcategory, row.sourceCategory]
      .map(cleanImportText).join(' ').toLocaleLowerCase('uk-UA');
    const isAccessory = /(?:чохол|case\b|cover\b|захисн(?:е|ий)? скло|screen protector|аксесуар|accessor|кабель|cable|адаптер|adapter|кріплен|mount)/iu.test(nameSource);
    const projectorName = /(?:про[єе]ктор|projector)/iu.test(nameSource);
    if (!isAccessory && projectorName) {
      if (/(?:лампа|lamp)/iu.test(nameSource)) return { rootSlug: 'cat-projectors', rootName: 'Проєктори та екрани', childSlug: 'erc-display-14', childName: 'Лампи для проєкторів' };
      if (/(?:об[’'`]?єктив|оптика|lens)/iu.test(nameSource)) return { rootSlug: 'cat-projectors', rootName: 'Проєктори та екрани', childSlug: 'erc-display-15', childName: 'Оптика для проєкторів' };
      return { rootSlug: 'cat-projectors', rootName: 'Проєктори та екрани', childSlug: 'projectors', childName: 'Проєктори' };
    }
    const rules = [
      [/(?:проекційн|projection).*(?:екран|screen)|(?:екран|screen).*(?:проекційн|projection)/iu, 'cat-projectors', 'Проєктори та екрани', 'erc-display-06', 'Проєкційні екрани'],
      [/(?:^|\s)(?:монітор|monitor)\b/iu, 'cat-displays', 'Телевізори, монітори та дисплеї', 'erc-display-01', 'Монітори'],
      [/(?:^|\s)(?:телевізор|television|tv)\b/iu, 'cat-displays', 'Телевізори, монітори та дисплеї', 'erc-display-07', 'Телевізори'],
      [/(?:^|\s)(?:смартфон|smartphone|iphone|мобільн(?:ий|ого)? телефон)\b/iu, 'смартфони-телефони', 'Смартфони/Телефони', 'мобільнии-телефон', 'Мобільний телефон'],
      [/(?:^|\s)(?:планшет|tablet|ipad)\b/iu, 'планшети', 'Планшети', 'планшетнии-комп-ютер', "Планшетний комп'ютер"],
      [/(?:airpods)\b/iu, 'audio', 'Audio', 'airpods', 'AirPods'],
      [/(?:apple watch|смарт-?годинник|smart ?watch)\b/iu, 'home-office-automation', 'Home / Office Automation', 'apple-watch', 'Apple Watch']
    ];
    if (isAccessory) return null;
    const match = rules.find(([pattern]) => pattern.test(nameSource));
    return match ? { rootSlug: match[1], rootName: match[2], childSlug: match[3], childName: match[4] } : null;
  };
  const categoryFor = (row) => {
    const aenoPlan = aenoCategoryPlan(row);
    if (aenoPlan) {
      const root = state.categories.find((category) => category.slug === aenoPlan.rootSlug) || findImportCategory(aenoPlan.rootName, null);
      // Якщо підкатегорія вже була створена раніше, повторно її не додаємо,
      // навіть коли її старе розміщення у дереві відрізняється.
      const child = root && aenoPlan.childName ? (findImportCategory(aenoPlan.childName, root.id) || findImportCategory(aenoPlan.childName)) : null;
      return child ? child.slug : '';
    }
    const officePlan = officeEquipmentCategoryPlan(row);
    if (officePlan) {
      const root = state.categories.find((category) => category.slug === officePlan.rootSlug) || findImportCategory(officePlan.rootName, null);
      const child = root && (state.categories.find((category) => category.slug === officePlan.childSlug) || findImportCategory(officePlan.childName, root.id));
      return child ? child.slug : '';
    }
    const sourceOfficePlan = officeSourceCategoryPlan(row);
    if (sourceOfficePlan) {
      const root = state.categories.find((category) => category.slug === sourceOfficePlan.rootSlug) || findImportCategory(sourceOfficePlan.rootName, null);
      const child = root && (state.categories.find((category) => category.slug === sourceOfficePlan.childSlug) || findImportCategory(sourceOfficePlan.childName, root.id));
      return child ? child.slug : '';
    }
    const standardPlan = standardCategoryPlan(row);
    if (standardPlan) {
      const root = state.categories.find((category) => category.slug === standardPlan.rootSlug) || findImportCategory(standardPlan.rootName, null);
      const child = root && (state.categories.find((category) => category.slug === standardPlan.childSlug) || findImportCategory(standardPlan.childName, root.id));
      return child ? child.slug : '';
    }
    const candidates = [row.subcategory, row.sourceCategory].map(normaliseCategory).filter(Boolean);
    const exact = state.categories.find((category) => candidates.includes(normaliseCategory(category.name)) || candidates.includes(normaliseCategory(category.slug)));
    if (exact) return exact.slug;
    const alias = [
      [/екран.*про[єе]кц|projection screen/i, 'erc-display-06'],
      [/про[єе]ктор|projector/i, 'projectors'],
      [/телевізор|tv/i, 'tv'],
      [/монітор/i, 'monitor'],
      [/акуст|навуш|гарнітур|саундбар|мікрофон/i, 'audio'],
      [/power station|ups|uninterruptible|зарядн.*станц|джерел.*безпереб|акумулятор|battery/i, 'cat-power'],
      [/кабел|адаптер|кронштейн|кріплен|accessor/i, 'cat-accessories']
    ].find(([pattern]) => pattern.test(row.subcategory + ' ' + row.sourceCategory));
    return alias && state.categories.some((category) => category.slug === alias[1]) ? alias[1] : '';
  };
  const translatedImportCategory = (value = '') => {
    const source = cleanImportText(value);
    const labels = {
      'power station': 'Зарядні станції', ups: 'Джерела безперебійного живлення',
      projector: 'Проєктори', 'projection screen': 'Проєкційні екрани',
      television: 'Телевізори', tv: 'Телевізори', monitor: 'Монітори', display: 'Дисплеї',
      soundbar: 'Саундбари', headphones: 'Навушники', headset: 'Гарнітури',
      cable: 'Кабелі та адаптери', adapter: 'Кабелі та адаптери', battery: 'Акумулятори'
    };
    return labels[normaliseCategory(source)] || source;
  };
  const categoryPlan = (row) => {
    const aenoPlan = aenoCategoryPlan(row);
    if (aenoPlan) return aenoPlan;
    const officePlan = officeEquipmentCategoryPlan(row);
    if (officePlan) return officePlan;
    const sourceOfficePlan = officeSourceCategoryPlan(row);
    if (sourceOfficePlan) return sourceOfficePlan;
    const standardPlan = standardCategoryPlan(row);
    if (standardPlan) return standardPlan;
    const source = (row.subcategory + ' ' + row.sourceCategory).toLocaleLowerCase('uk-UA');
    const roots = [
      // У старому XML ERC назва «ТВ, засоби відображення інформації,
      // оргтехніка» є технічною збірною групою, а не категорією магазину.
      // Не даємо їй створюватися знову: конкретні пристрої розкладає
      // officeEquipmentCategoryPlan, інші залишаються в «Оргтехніці».
      [/оргтех|office\s*equipment/i, 'office-equipment', 'Оргтехніка'],
      [/про[єе]ктор|projection screen/i, 'cat-projectors', 'Проєктори та екрани'],
      [/телевізор|\btv\b|монітор|display/i, 'cat-displays', 'Телевізори, монітори та дисплеї'],
      [/акуст|навуш|гарнітур|саундбар|мікрофон|soundbar|headphone/i, 'cat-audio', 'Акустика й звук'],
      [/power station|ups|uninterruptible|зарядн.*станц|джерел.*безпереб|акумулятор|battery/i, 'cat-power', 'Резервне живлення'],
      [/solar|сонячн/i, 'cat-solar', 'Сонячна енергетика'],
      [/кабел|адаптер|кронштейн|кріплен|accessor/i, 'cat-accessories', 'Кріплення та аксесуари']
    ].find(([pattern]) => pattern.test(source));
    const rawChild = cleanImportText(row.subcategory);
    const ignored = /^(other|інше|misc|n\/a)$/i.test(rawChild);
    if (roots) return { rootSlug: roots[1], rootName: roots[2], childName: rawChild && !ignored ? translatedImportCategory(rawChild) : '' };
    const rawRoot = cleanImportText(row.sourceCategory);
    if (!rawRoot || /^(other|інше|misc|n\/a)$/i.test(rawRoot)) return null;
    return { rootSlug: slug(rawRoot), rootName: translatedImportCategory(rawRoot), childName: rawChild && !ignored && normaliseCategory(rawChild) !== normaliseCategory(rawRoot) ? translatedImportCategory(rawChild) : '' };
  };
  const findImportCategory = (name, parentId = undefined) => state.categories.find((category) => normaliseCategory(category.name) === normaliseCategory(name) && (parentId === undefined || Number(category.parent_id || 0) === Number(parentId || 0)));
  const createImportCategory = async (name, parentId = null, preferredSlug = '') => {
    const base = preferredSlug || slug(name) || 'category';
    let categorySlug = base, index = 2;
    while (state.categories.some((category) => category.slug === categorySlug)) categorySlug = base + '-' + index++;
    const sortOrder = Math.max(0, ...state.categories.filter((category) => Number(category.parent_id || 0) === Number(parentId || 0)).map((category) => Number(category.sort_order || 0))) + 10;
    const result = await supabase.from('categories').insert({ name, slug: categorySlug, parent_id: parentId, sort_order: sortOrder, is_active: true }).select('*').single();
    if (result.error) throw result.error;
    state.categories.push(result.data);
    return result.data;
  };
  const ensureImportCategory = async (row) => {
    const aenoPlan = aenoCategoryPlan(row);
    if (aenoPlan) {
      let root = state.categories.find((category) => category.slug === aenoPlan.rootSlug) || findImportCategory(aenoPlan.rootName, null);
      if (!root) root = await createImportCategory(aenoPlan.rootName, null, aenoPlan.rootSlug);
      if (!aenoPlan.childName) return root.slug;
      let child = findImportCategory(aenoPlan.childName, root.id) || findImportCategory(aenoPlan.childName);
      if (!child) child = await createImportCategory(aenoPlan.childName, root.id);
      return child.slug;
    }
    const officePlan = officeEquipmentCategoryPlan(row);
    if (officePlan) {
      let root = state.categories.find((category) => category.slug === officePlan.rootSlug) || findImportCategory(officePlan.rootName, null);
      if (!root) root = await createImportCategory(officePlan.rootName, null, officePlan.rootSlug);
      let child = state.categories.find((category) => category.slug === officePlan.childSlug) || findImportCategory(officePlan.childName, root.id);
      if (!child) child = await createImportCategory(officePlan.childName, root.id, officePlan.childSlug);
      return child.slug;
    }
    const sourceOfficePlan = officeSourceCategoryPlan(row);
    if (sourceOfficePlan) {
      let root = state.categories.find((category) => category.slug === sourceOfficePlan.rootSlug) || findImportCategory(sourceOfficePlan.rootName, null);
      if (!root) root = await createImportCategory(sourceOfficePlan.rootName, null, sourceOfficePlan.rootSlug);
      let child = state.categories.find((category) => category.slug === sourceOfficePlan.childSlug) || findImportCategory(sourceOfficePlan.childName, root.id);
      if (!child) child = await createImportCategory(sourceOfficePlan.childName, root.id, sourceOfficePlan.childSlug);
      return child.slug;
    }
    const standardPlan = standardCategoryPlan(row);
    if (standardPlan) {
      let root = state.categories.find((category) => category.slug === standardPlan.rootSlug) || findImportCategory(standardPlan.rootName, null);
      if (!root) root = await createImportCategory(standardPlan.rootName, null, standardPlan.rootSlug);
      let child = state.categories.find((category) => category.slug === standardPlan.childSlug) || findImportCategory(standardPlan.childName, root.id);
      if (!child) child = await createImportCategory(standardPlan.childName, root.id, standardPlan.childSlug);
      return child.slug;
    }
    const direct = state.categories.find((category) => [row.subcategory, row.sourceCategory].map(normaliseCategory).includes(normaliseCategory(category.name)));
    if (direct) return direct.slug;
    const plan = categoryPlan(row);
    if (!plan) return categoryFor(row);
    let root = state.categories.find((category) => category.slug === plan.rootSlug) || findImportCategory(plan.rootName, null);
    if (!root) root = await createImportCategory(plan.rootName, null, plan.rootSlug);
    if (!plan.childName || normaliseCategory(plan.childName) === normaliseCategory(root.name)) return root.slug;
    let child = findImportCategory(plan.childName, root.id) || findImportCategory(plan.childName);
    if (!child) child = await createImportCategory(plan.childName, root.id, plan.childSlug || '');
    return child.slug;
  };
  const applyPriceData = () => importer.rows.forEach((row) => {
    const price = importer.prices.get(row.sku);
    if (!price) return;
    Object.assign(row, price);
  });
  const parsePriceFile = (content) => {
    const xml = new DOMParser().parseFromString(content, 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('XML цін містить помилку структури.');
    const prices = new Map();
    [...xml.querySelectorAll('PRICE,Price,price')].forEach((node) => {
      const sku = normaliseSku(textFrom(node, ['WIC','wic','SKU','sku','ProductCode']));
      const priceText = textFrom(node, ['RETAIL_PRICE','retail_price','Price','price','MY_PRICE','my_price']);
      if (!sku || !cleanImportText(priceText)) return;
      const availability = textFrom(node, ['AVAIL','avail','Availability','availability']);
      const availabilityStatus = importAvailabilityStatus(availability) || 'out_of_stock';
      prices.set(sku, { price: importNumber(priceText), hasPrice: true, stock: /^(in_stock|limited_stock)$/.test(availabilityStatus) ? 1 : 0, hasStock: true, availabilityStatus });
    });
    if (!prices.size) throw new Error('У файлі цін не знайдено позицій.');
    importer.prices = prices;
    applyPriceData();
    return prices.size;
  };
  const knownBySku = () => new Map(state.products.filter((product) => product.sku).map((product) => [normaliseSku(product.sku), product]));
  const missingImportedBrands = () => {
    const existing = new Set(state.brands.map((brand) => txt(brand.name)).filter(Boolean));
    return [...new Map(importer.rows.map((row) => [txt(canonicalBrandName(row.vendor)), canonicalBrandName(row.vendor)]).filter(([key, name]) => key && name && !existing.has(key))).values()]
      .sort((a, b) => a.localeCompare(b, 'uk'));
  };
  const createImportedBrands = async () => {
    const names = missingImportedBrands();
    if (!names.length) return importerStatus('Усі бренди з завантаженого файлу вже є в довіднику.');
    const button = $('#supplierImportBrands');
    button.disabled = true; button.textContent = 'Створення брендів…';
    const usedSlugs = new Set(state.brands.map((brand) => brand.slug).filter(Boolean));
    const rows = names.map((name) => {
      const base = slug(name) || 'brand'; let brandSlug = base, index = 2;
      while (usedSlugs.has(brandSlug)) brandSlug = base + '-' + index++;
      usedSlugs.add(brandSlug);
      return { name, slug: brandSlug, is_active: true, updated_at: new Date().toISOString() };
    });
    let created = 0;
    try {
      for (let from = 0; from < rows.length; from += 100) {
        const result = await supabase.from('brands').insert(rows.slice(from, from + 100));
        if (result.error) throw result.error;
        created += Math.min(100, rows.length - from);
      }
      await loadData();
      importerStatus('Готово: створено брендів — ' + created + '.');
    } catch (error) {
      importerStatus('Не вдалося створити бренди: ' + (error.message || error.code || 'невідома помилка'), true);
    } finally {
      button.disabled = false; button.textContent = 'Створити відсутні бренди';
    }
  };
  const importerStatus = (message, isError = false) => {
    const target = $('#supplierImportMessage');
    target.textContent = message;
    target.hidden = false;
    target.classList.toggle('error', isError);
  };
  const importRowMeta = (row) => {
    const cached = importer.meta.get(row.key);
    if (cached) return cached;
    const category = categoryFor(row), plan = categoryPlan(row);
    const categoryName = category ? (state.categories.find((item) => item.slug === category)?.name || category) : (plan?.childName || plan?.rootName || '');
    const meta = { category, plan, categoryName, mapped: Boolean(category || plan) };
    importer.meta.set(row.key, meta);
    return meta;
  };
  const importGroup = (row, existing = knownBySku()) => {
    if (!importRowMeta(row).mapped) return 'problem';
    return existing.has(row.sku) ? 'update' : 'new';
  };
  const missingFromSourceFile = () => {
    const sourceBrands = new Set(importer.rows.map((row) => txt(row.vendor)).filter(Boolean));
    if (!sourceBrands.size) return [];
    const sourceSkus = new Set(importer.rows.map((row) => row.sku));
    return state.products.filter((product) => product.sku && sourceBrands.has(txt(product.brand)) && !sourceSkus.has(normaliseSku(product.sku)));
  };
  const renderImportReport = () => {
    const target = $('#supplierImportReport');
    if (!target) return;
    const report = importer.report;
    if (!report) { target.hidden = true; target.innerHTML = ''; return; }
    const failures = report.failures || [];
    const skipped = report.skipped || 0;
    const unmapped = report.unmapped || 0;
    const missing = report.missing || 0;
    target.hidden = false;
    const waiting = [];
    if (skipped) waiting.push('Не вибрано для цього запуску: <b>'+skipped+'</b>');
    if (unmapped) waiting.push('Без категорії: <b>'+unmapped+'</b>');
    if (missing) waiting.push('Відсутні у цьому файлі: <b>'+missing+'</b>');
    target.innerHTML = '<div class="import-report-heading"><b>Результат останнього імпорту</b><span>Вибрано: '+report.attempted+' із '+(report.total || report.attempted)+'</span></div><div class="import-report-cards"><span>Створено <b>'+report.created+'</b></span><span>Оновлено <b>'+report.updated+'</b></span><span>Відкладено <b>'+skipped+'</b></span><span class="'+(failures.length || unmapped ? 'is-problem' : '')+'">Потрібна увага <b>'+(failures.length + unmapped)+'</b></span></div>'+(waiting.length?'<p class="recovery-help">'+waiting.join(' · ')+'. Відсутні у файлі товари автоматично не приховуються.</p>':'')+(failures.length?'<div class="import-report-problems"><b>Потрібна увага</b><ul>'+failures.slice(0,8).map((failure)=>'<li><code>'+esc(failure.sku||'без SKU')+'</code> — '+esc(failure.reason)+'</li>').join('')+'</ul><button class="button outline" type="button" id="supplierImportRetryIssues">Повторити проблемні ('+failures.length+')</button></div>':'<p class="import-report-ok">Імпорт завершено без помилок.</p>');
    $('#supplierImportRetryIssues')?.addEventListener('click', () => { importer.selected = new Set(failures.map((failure) => failure.key)); renderImportPreview(); importerStatus('Виділено проблемні позиції для повторної спроби.'); });
  };
  const updateImportSelectionSummary = () => {
    const target = $('#supplierImportSelectedCount');
    if (target) target.textContent = importer.selected.size;
  };
  const importFilteredRows = (existing = knownBySku()) => {
    const query = txt($('#supplierImportSearch')?.value || '');
    const status = $('#supplierImportStatus')?.value || 'all';
    return importer.rows.filter((row) => {
      const meta = importRowMeta(row);
      const current = existing.get(row.sku);
      const haystack = txt([row.name, row.sku, row.vendor, row.sourceCategory, row.subcategory, meta.categoryName].join(' '));
      if (query && !haystack.includes(query)) return false;
      if (status === 'new' && current) return false;
      if ((status === 'existing' || status === 'update') && !current) return false;
      if (status === 'ready' && !meta.mapped) return false;
      if ((status === 'unmapped' || status === 'problem') && meta.mapped) return false;
      return true;
    });
  };
  const importPageRows = (rows = importFilteredRows()) => {
    const size = Math.max(1, Math.min(100, Number($('#supplierImportLimit').value || 50)));
    const pages = Math.max(1, Math.ceil(rows.length / size));
    importer.page = Math.min(Math.max(1, importer.page), pages);
    return rows.slice((importer.page - 1) * size, importer.page * size);
  };
  const renderImportPreview = () => {
    const body = $('#supplierImportRows'), summary = $('#supplierImportSummary'), pager = $('#supplierImportPagination');
    const existing = knownBySku(), filtered = importFilteredRows(existing), rows = importPageRows(filtered), size = Math.max(1, Math.min(100, Number($('#supplierImportLimit').value || 50)));
    const pages = Math.max(1, Math.ceil(filtered.length / size));
    const hasSearch = Boolean($('#supplierImportSearch')?.value || ($('#supplierImportStatus')?.value && $('#supplierImportStatus').value !== 'all'));
    const groups = importer.rows.reduce((result, row) => { result[importGroup(row, existing)] += 1; return result; }, { new: 0, update: 0, problem: 0 });
    const missing = missingFromSourceFile().length;
    summary.innerHTML = importer.rows.length ? '<div class="import-preview-summary"><span>Нові <b>'+groups.new+'</b></span><span>Оновити <b>'+groups.update+'</b></span><span class="'+(groups.problem?'is-problem':'')+'">Проблемні <b>'+groups.problem+'</b></span><span title="Позиції брендів із файлу, що вже є на сайті, але не знайдені у поточному XML. Автоматично не приховуються.">Відсутні у файлі <b>'+missing+'</b></span></div>'+`${hasSearch ? 'Знайдено за умовами: ' : 'У файлі: '}${filtered.length} з ${importer.rows.length} товарів. Вибрано: <b id="supplierImportSelectedCount" aria-live="polite">${importer.selected.size}</b>. ${filtered.length ? `На сторінці ${importer.page} з ${pages}.` : ''}` : 'Оберіть XML-файл для попереднього перегляду.';
    pager.hidden = pages <= 1;
    pager.innerHTML = pages > 1 ? `<button class="button outline" type="button" data-import-page="prev" ${importer.page === 1 ? 'disabled' : ''}>← Попередні</button><span>Сторінка ${importer.page} з ${pages}</span><button class="button outline" type="button" data-import-page="next" ${importer.page === pages ? 'disabled' : ''}>Наступні →</button>` : '';
    body.innerHTML = rows.length ? rows.map((row) => {
      const meta = importRowMeta(row), category = meta.category, plannedCategory = meta.plan, current = existing.get(row.sku), disabled = !row.sku || !row.name || !meta.mapped;
      const sourceInfo = [row.vendor, row.subcategory || row.sourceCategory].filter(Boolean).join(' · ');
      const group = importGroup(row, existing), mode = group === 'problem' ? 'Проблема: категорія' : current ? 'Оновити' : (row.hasPrice ? 'Новий' : 'Чернетка без ціни');
      const categoryLabel = category
        ? (state.categories.find((item) => item.slug === category)?.name || category)
        : (plannedCategory ? `Буде створено: ${plannedCategory.childName || plannedCategory.rootName}` : 'Немає зіставлення');
      return `<tr><td><input type="checkbox" data-import-select="${esc(row.key)}" ${importer.selected.has(row.key) ? 'checked ' : ''}${disabled ? 'disabled' : ''}></td><td><b>${esc(row.name)}</b><small>${esc(sourceInfo || 'Постачальник не вказаний')}</small></td><td>${esc(row.sku || '—')}</td><td>${esc(categoryLabel)}</td><td>${Object.keys(row.specifications).length} хар. · ${row.images.length} фото${row.hasPrice ? '' : ' · без ціни'}</td><td><span class="visibility ${group === 'update' ? 'visible' : group === 'problem' ? 'hidden-status' : ''}">${mode}</span></td></tr>`;
    }).join('') : `<tr><td colspan="6" class="empty-row">${importer.rows.length ? 'За заданими умовами товарів не знайдено' : 'Даних для імпорту немає'}</td></tr>`;
  };
  const parseFile = (content) => {
    const isAsbis = /<ProductCatalog(?:\s|>)/i.test(content);
    const xml = isAsbis ? null : new DOMParser().parseFromString(content, 'application/xml');
    if (xml?.querySelector('parsererror')) throw new Error('XML містить помилку структури.');
    const nodes = isAsbis ? content.matchAll(/<Product\b[^>]*>[\s\S]*?<\/Product>/gi) : xml.querySelectorAll('goods,good,offer,product,item');
    const nameFields = isAsbis ? ['ProductDescription'] : ['gname','name','model','title'];
    importer.rows = [];
    let index = 0;
    for (const sourceNode of nodes) {
      const node = isAsbis ? new DOMParser().parseFromString(sourceNode[0], 'application/xml').documentElement : sourceNode;
      if (!textFrom(node, nameFields)) continue;
      const vendorNode = node.closest('vendor,supplier,provider,brand');
      const vendor = canonicalBrandName(cleanImportText(isAsbis ? textFrom(node, ['Vendor']) : (vendorNode?.getAttribute('name') || textFrom(node, ['vendor','supplier','brand','manufacturer']))));
      const sku = normaliseSku(isAsbis ? textFrom(node, ['ProductCode']) : (textFrom(node, ['code','sku','article','vendor_code','id']) || node.getAttribute('id')));
      const sourceName = decodeEntities(textFrom(node, nameFields));
      const name = compactImportName(sourceName, sku, vendor);
      const sourceCategory = cleanImportText(textFrom(node, isAsbis ? ['ProductCategory'] : ['category','category_name','group']));
      const subcategory = cleanImportText(textFrom(node, isAsbis ? ['ProductType'] : ['subcategory','subcategory_name','subgroup']));
      const comment = textFrom(node, isAsbis ? ['MarketingInfo'] : ['comment','description','full_description','details']);
      const shortDescription = textFrom(node, isAsbis ? ['ProductDescription'] : ['a_desc','short_description','summary']);
      const priceValue = textFrom(node, ['rprice','price','retail_price','price_uah','Price']);
      const stockValue = textFrom(node, ['stock','quantity','qty','available','Stock']);
      const availabilityValue = textFrom(node, ['availability','Availability','AVAIL','avail','stock_status','StockStatus','availability_status','AvailabilityStatus','in_stock','InStock']);
      const availabilityStatus = importAvailabilityStatus(availabilityValue) || importAvailabilityStatus(stockValue);
      // У ERC технічні дані можуть бути як у MarketingInfo, так і прямо в
      // ProductDescription. Обидва джерела доповнюють XML-атрибути, але не
      // перезаписують уже надану виробником характеристику.
      const importedSpecifications = { ...parseSpecifications(shortDescription), ...parseSpecifications(comment), ...attributeSpecifications(node), ...titleSpecifications(name) };
      const specifications = mergeMissingSpecifications(importedSpecifications, templateSpecifications([sourceName, sourceCategory, subcategory, shortDescription, comment].filter(Boolean).join(' ')));
      const parsedStock = importQuantity(stockValue);
      const stock = parsedStock || (/^(in_stock|limited_stock)$/i.test(availabilityStatus) ? 1 : 0);
      const row = { key: sku + '-' + index, vendor, name: cleanImportText(name), sku, sourceCategory, subcategory, price: importNumber(priceValue), hasPrice: Boolean(cleanImportText(priceValue)), stock, hasStock: Boolean(cleanImportText(stockValue) || availabilityStatus), availabilityStatus: availabilityStatus || undefined, description: importDescription(shortDescription, comment) || cleanImportText(sourceName), specifications, images: imagesFrom(node, comment) };
      if (row.name && row.sku) importer.rows.push(row);
      index += 1;
    }
    importer.selected.clear();
    importer.meta.clear();
    importer.report = null;
    importer.page = 1;
    $('#supplierImportSearch').value = '';
    $('#supplierImportStatus').value = 'all';
    applyPriceData();
    renderImportReport();
    if (!importer.rows.length) throw new Error('У файлі не знайдено товарних позицій.');
  };
  // ERC also provides selected-vendor workbooks. They are a content supplement:
  // rows are joined by SKU, so the normal XML/API import remains the source for
  // price and stock while this file contributes description, specs and photos.
  const ercWorkbookHeader = (headers, matcher) => headers.findIndex((header) => matcher.test(cleanImportText(header || '')));
  const ercWorkbookRows = async (file) => {
    let XLSX;
    try { XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'); XLSX = XLSX.default || XLSX; }
    catch { throw new Error('Не вдалося відкрити модуль читання Excel. Перевірте з’єднання та спробуйте ще раз.'); }
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const sourceRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const headerRow = sourceRows.findIndex((row) => row.some((cell) => /^(?:sku|код|артикул|код товару)$/iu.test(cleanImportText(cell || ''))));
    if (headerRow < 0) throw new Error('У файлі Excel не знайдено колонку SKU / «Код».');
    const headers = sourceRows[headerRow];
    const column = (pattern, fallback = -1) => {
      const index = ercWorkbookHeader(headers, pattern);
      return index >= 0 ? index : fallback;
    };
    const skuColumn = column(/^(?:sku|код|артикул|код товару)$/iu, 4);
    const nameColumn = column(/^(?:найменування|назва|name|product name)$/iu, 3);
    const vendorColumn = column(/^(?:виробник|вендор|бренд|vendor|brand)$/iu, 0);
    const categoryColumn = column(/^(?:категорія|category)$/iu, 1);
    const subcategoryColumn = column(/^(?:підкатегорія|subcategory|група)$/iu, 2);
    const imageColumn = column(/(?:url|посилання).*(?:зображ|фото)|(?:зображ|фото).*(?:url|посилання)|^(?:image|photo)$/iu);
    const descriptionColumn = column(/^(?:опис товару|опис|description|product description)$/iu);
    const extraDescriptionColumn = column(/(?:повн.*опис|додатк.*опис|marketing)/iu);
    const weightColumn = column(/^(?:вага|weight)$/iu);
    const widthColumn = column(/^(?:ширина|width)$/iu);
    const heightColumn = column(/^(?:висота|height)$/iu);
    const depthColumn = column(/^(?:глибина|depth)$/iu);
    const rows = [];
    sourceRows.slice(headerRow + 1).forEach((source, index) => {
      const value = (position) => position >= 0 ? cleanImportText(source[position] ?? '') : '';
      const sku = normaliseSku(value(skuColumn));
      const sourceName = value(nameColumn);
      if (!sku || !sourceName) return;
      const vendor = canonicalBrandName(value(vendorColumn));
      const description = importDescription(value(descriptionColumn), value(extraDescriptionColumn));
      const dimensions = [value(widthColumn), value(heightColumn), value(depthColumn)].filter(Boolean).join(' × ');
      const rawSpecifications = {
        ...parseSpecifications([value(descriptionColumn), value(extraDescriptionColumn)].filter(Boolean).join('\n')),
        ...(value(weightColumn) ? { 'Вага': value(weightColumn) } : {}),
        ...(dimensions ? { 'Габарити': dimensions } : {}),
      };
      // The ERC content catalogue uses the SKU as the image file name. A URL
      // present in the workbook wins; the predictable SKU URL is a fallback.
      const imageUrl = ercImage(value(imageColumn)) || ercImage('https://www.erc.ua/i/goods/' + encodeURIComponent(sku) + '.jpg');
      const name = compactImportName(sourceName, sku, vendor);
      rows.push({
        key: 'erc-xlsx-' + sku + '-' + index, vendor, name, sku,
        sourceCategory: value(categoryColumn), subcategory: value(subcategoryColumn),
        price: 0, hasPrice: false, stock: 0, hasStock: false, availabilityStatus: '',
        description, specifications: mergeMissingSpecifications(rawSpecifications, templateSpecifications([name, sourceName, description].join(' '))),
        images: imageUrl ? [imageUrl] : [],
      });
    });
    if (!rows.length) throw new Error('У файлі Excel не знайдено жодного товару з назвою та SKU.');
    return rows;
  };
  const mergeErcWorkbookRows = (contentRows) => {
    const currentBySku = new Map(importer.rows.map((row) => [normaliseSku(row.sku), row]));
    let enriched = 0, added = 0;
    contentRows.forEach((content) => {
      const current = currentBySku.get(content.sku);
      if (!current) { importer.rows.push(content); currentBySku.set(content.sku, content); added += 1; return; }
      if (content.description && content.description.length > String(current.description || '').length) current.description = content.description;
      current.vendor ||= content.vendor;
      current.sourceCategory ||= content.sourceCategory;
      current.subcategory ||= content.subcategory;
      current.specifications = { ...content.specifications, ...(current.specifications || {}) };
      current.images = [...new Set([...(current.images || []), ...(content.images || [])])];
      enriched += 1;
    });
    importer.selected.clear(); importer.meta.clear(); importer.report = null; importer.page = 1;
    return { enriched, added };
  };
  const newSlug = (name, sku, used) => {
    const base = (slug(name) || 'product') + '-' + (slug(sku) || 'item');
    let result = base, index = 2;
    while (used.has(result)) result = base + '-' + index++;
    used.add(result);
    return result;
  };
  const mergeSpecifications = (current, incoming) => ({ ...incoming, ...(current || {}) });
  const importProductImages = async (productId, urls) => {
    if (!urls.length) return;
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/import-product-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session?.access_token || '') },
      body: JSON.stringify({ productId, urls })
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Не вдалося завантажити фото');
    }
  };
  const importSelected = async () => {
    const selectedRows = importer.rows.filter((row) => importer.selected.has(row.key));
    if (!selectedRows.length) return importerStatus('Виберіть хоча б один товар.', true);
    if (selectedRows.length > 100) return importerStatus('За один раз можна імпортувати до 100 товарів.', true);
    const updateSpecifications = $('#supplierImportSpecifications').checked;
    const importImages = $('#supplierImportImages').checked;
    const publishNew = $('#supplierImportPublish').checked;
    const existing = knownBySku(), usedSlugs = new Set(state.products.map((product) => product.slug).filter(Boolean));
    const failures = []; const fail = (row, reason) => failures.push({ key: row.key, sku: row.sku, reason }); let created = 0, updated = 0;
    const selectedKeys = new Set(selectedRows.map((row) => row.key));
    const unmapped = importer.rows.filter((row) => !importRowMeta(row).mapped).length;
    const skipped = importer.rows.filter((row) => !selectedKeys.has(row.key) && importRowMeta(row).mapped).length;
    const reportBase = { attempted: selectedRows.length, total: importer.rows.length, skipped, unmapped, missing: missingFromSourceFile().length };
    const button = $('#supplierImportApply'); button.disabled = true; button.textContent = 'Імпорт…';
    importerStatus(`Починаю імпорт: 0 із ${selectedRows.length}. Не закривайте сторінку до завершення.`);
    try {
    for (const [index, row] of selectedRows.entries()) {
      if (index === 0 || index % 5 === 0) importerStatus(`Імпорт: ${index} із ${selectedRows.length}. Створено: ${created}, оновлено: ${updated}.`);
      let category = ''; const current = existing.get(row.sku);
      try { category = await ensureImportCategory(row); } catch (error) { fail(row, 'не вдалося створити категорію (' + (error.message || error.code) + ')'); continue; }
      if (!category) { fail(row, 'не знайдено категорію'); continue; }
      const images = importImages ? row.images : [];
      const inventory = { category };
      if (row.hasPrice) inventory.price = row.price;
      if (row.hasStock) Object.assign(inventory, { stock_quantity: row.stock, in_stock: row.stock > 0, availability_status: row.availabilityStatus || (row.stock > 0 ? 'in_stock' : 'out_of_stock') });
      if (current) {
        const payload = { ...inventory };
        // Коли джерело вже дало коротку назву проєктора, прибираємо лише
        // очевидний технічний перелік у старій назві. Ручні короткі назви не
        // перезаписуються.
        const currentProjectorName = String(current.name || '');
        const isTechnicalProjectorTail = /^\s*(?:про[єе]ктор|projector)\b.*?,\s*(?:\d{2,5}\s*(?:лм|lm)\b|(?:led|laser|ламп\w*|wi[ -]?fi|wireless|wlan|bluetooth|\bbt\b|hdmi|usb|tizen|android\s*tv)\b|\d+(?:[.,]\d+)?\s*(?::\s*1)?\b)/iu.test(currentProjectorName);
        if (isTechnicalProjectorTail && row.name && row.name.length < currentProjectorName.length) payload.name = row.name;
        if (updateSpecifications && Object.keys(row.specifications).length) payload.specifications = mergeSpecifications(current.specifications, row.specifications);
        if (row.description && (!current.description || isSupplierPromotionText(current.description))) payload.description = row.description;
        const shouldImportImages = !current.image_path && images.length;
        const result = await supabase.from('products').update(payload).eq('id', current.id);
        if (result.error) fail(row, result.error.message || result.error.code);
        else {
          updated += 1;
          if (shouldImportImages) {
            try { await importProductImages(current.id, images); } catch (error) { fail(row, error.message); }
          }
        }
      } else {
        const importedBrand = state.brands.find((brand) => brand.is_active && txt(brand.name) === txt(row.vendor));
        const payload = { ...inventory, price: row.hasPrice ? row.price : 0, stock_quantity: row.hasStock ? row.stock : 0, in_stock: row.hasStock && row.stock > 0, availability_status: row.availabilityStatus || (row.hasStock && row.stock > 0 ? 'in_stock' : 'out_of_stock'), name: row.name, slug: newSlug(row.name, row.sku, usedSlugs), sku: row.sku, brand_id: importedBrand?.id || null, brand: importedBrand?.name || row.vendor || null, description: row.description || null, specifications: row.specifications, is_active: publishNew && row.hasPrice };
        const result = await supabase.from('products').insert(payload).select('id').single();
        if (result.error) fail(row, result.error.message || result.error.code);
        else {
          created += 1;
          if (images.length) {
            try { await importProductImages(result.data.id, images); } catch (error) { fail(row, error.message); }
          }
        }
      }
    }
    await loadData();
    importer.meta.clear();
    importer.report = { ...reportBase, created, updated, failures };
    importer.selected.clear(); renderImportPreview();
    renderImportReport();
    importerStatus(`Готово: створено ${created}, оновлено ${updated}.${failures.length ? ' Проблемних позицій: ' + failures.length + '.' : ''}`, Boolean(failures.length));
    } catch (error) {
      importer.report = { ...reportBase, created, updated, failures };
      renderImportReport();
      importerStatus(`Імпорт зупинено: ${error.message || error.code || 'невідома помилка'}. Створено: ${created}, оновлено: ${updated}.`, true);
    } finally {
      button.disabled = false;
      button.textContent = 'Імпортувати вибрані';
    }
  };
  const mountImporter = () => {
    const anchor = $('#products');
    if (!anchor || $('#supplierImport')) return;
    anchor.insertAdjacentHTML('afterend', `<section class="admin-section" id="supplierImport"><div class="admin-title"><div><h2>Імпорт ERC та ASBIS XML</h2><span>Товари, характеристики, ціни, залишки та посилання на фото від постачальників</span></div></div><p class="recovery-help"><b>ERC:</b> оберіть лише основний XML-файл — імпорт працює як раніше. <b>ASBIS:</b> оберіть <b>itemList.xml</b> і додатково <b>PriceAvail.xml</b>; вони з’єднаються за SKU. Характеристики додаються лише до порожніх полів, а вручну внесені значення залишаються без змін.</p><div class="admin-controls"><label>Основний XML (ERC або ASBIS itemList) <input id="supplierImportFile" type="file" accept=".xml,application/xml,text/xml"></label><label>Ціни та наявність ASBIS — необов’язково <input id="supplierImportPriceFile" type="file" accept=".xml,application/xml,text/xml"></label><label>Контент ERC Excel — необов’язково <input id="supplierImportContentFile" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></label><input id="supplierImportLimit" type="number" min="1" max="100" value="50" title="Товарів на сторінці попереднього перегляду"></div><div class="admin-controls"><label>Пошук у попередньому перегляді <input id="supplierImportSearch" type="search" placeholder="Назва, SKU, бренд або категорія" autocomplete="off"></label><label>Показати <select id="supplierImportStatus"><option value="all">Усі товари</option><option value="new">Нові товари</option><option value="update">Оновити наявні</option><option value="ready">Зіставлені з категорією</option><option value="problem">Проблемні — без категорії</option></select></label></div><div class="admin-controls"><button class="button outline" type="button" id="supplierImportBrands">Створити відсутні бренди</button><button class="button outline" type="button" id="supplierImportSelectNew">Вибрати нові на сторінці</button><button class="button outline" type="button" id="supplierImportSelectVisible">Вибрати всі на сторінці</button><button class="button outline" type="button" id="supplierImportSelectMatched">Виділити всі знайдені (до 100)</button><button class="button outline" type="button" id="supplierImportClear">Очистити вибір</button><label class="check"><input id="supplierImportSpecifications" type="checkbox" checked> Додати відсутні характеристики</label><label class="check"><input id="supplierImportImages" type="checkbox"> Додати доступні фото</label><label class="check"><input id="supplierImportPublish" type="checkbox"> Публікувати нові товари</label><button class="button primary" type="button" id="supplierImportApply">Імпортувати вибрані</button></div><p class="admin-message" id="supplierImportMessage" hidden></p><p class="recovery-help" id="supplierImportSummary">Оберіть XML-файл для попереднього перегляду.</p><div id="supplierImportReport" class="import-report" hidden></div><div class="admin-controls" id="supplierImportPagination" hidden></div><div class="admin-table-wrap"><table><thead><tr><th></th><th>Товар / джерело</th><th>SKU</th><th>Категорія</th><th>Дані джерела</th><th>Дія</th></tr></thead><tbody id="supplierImportRows"></tbody></table></div></section>`);
    document.querySelector('.admin-nav').insertAdjacentHTML('beforeend', '<a href="#supplierImport">Імпорт ERC / ASBIS</a>');
    const section = $('#supplierImport');
    $('#supplierImportFile').addEventListener('change', async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      importerStatus('Читаю ' + file.name + '…');
      try { parseFile(await file.text()); importerStatus('Файл прочитано: ' + importer.rows.length + ' товарів.'); renderImportPreview(); } catch (error) { importer.rows = []; renderImportPreview(); importerStatus(error.message || 'Не вдалося прочитати XML.', true); }
    });
    $('#supplierImportPriceFile').addEventListener('change', async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      importerStatus('Читаю ціни та наявність з ' + file.name + '…');
      try {
        const main = $('#supplierImportFile').files?.[0];
        if (main && main.name === file.name && main.size === file.size) throw new Error('Ви вдруге обрали itemList.xml. Для цін і наявності потрібен окремий файл PriceAvail.xml.');
        const count = parsePriceFile(await file.text());
        renderImportPreview();
        importerStatus('Файл цін прочитано: ' + count + ' позицій. Дані з’єднано за SKU.');
      } catch (error) { importerStatus(error.message || 'Не вдалося прочитати XML цін.', true); }
    });
    $('#supplierImportContentFile').addEventListener('change', async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      importerStatus('Читаю контент ERC з ' + file.name + '…');
      try {
        const contentRows = await ercWorkbookRows(file);
        const result = mergeErcWorkbookRows(contentRows);
        renderImportPreview();
        importerStatus(`Контент ERC додано: ${result.enriched} зіставлено за SKU, ${result.added} додано до перегляду. Увімкніть «Додати доступні фото» перед імпортом.`);
      } catch (error) { importerStatus(error.message || 'Не вдалося прочитати Excel ERC.', true); }
    });
    section.addEventListener('input', (event) => { if (event.target.matches('#supplierImportLimit, #supplierImportSearch')) { importer.page = 1; renderImportPreview(); } });
    section.addEventListener('change', (event) => { if (event.target.matches('#supplierImportStatus')) { importer.page = 1; renderImportPreview(); return; } const checkbox = event.target.closest('[data-import-select]'); if (!checkbox) return; if (checkbox.checked) importer.selected.add(checkbox.dataset.importSelect); else importer.selected.delete(checkbox.dataset.importSelect); updateImportSelectionSummary(); });
    section.addEventListener('click', (event) => { const pageButton = event.target.closest('[data-import-page]'); if (!pageButton || pageButton.disabled) return; importer.page += pageButton.dataset.importPage === 'next' ? 1 : -1; renderImportPreview(); });
    $('#supplierImportSelectNew').onclick = () => { const existing = knownBySku(); importPageRows().forEach((row) => { if (!existing.has(row.sku) && (categoryFor(row) || categoryPlan(row))) importer.selected.add(row.key); }); renderImportPreview(); };
    $('#supplierImportSelectVisible').onclick = () => { importPageRows().forEach((row) => { if (categoryFor(row) || categoryPlan(row)) importer.selected.add(row.key); }); renderImportPreview(); };
    $('#supplierImportSelectMatched').onclick = () => {
      const existing = knownBySku();
      const eligible = importFilteredRows(existing).filter((row) => importRowMeta(row).mapped);
      importer.selected.clear();
      eligible.slice(0, 100).forEach((row) => importer.selected.add(row.key));
      renderImportPreview();
      importerStatus(eligible.length > 100 ? 'Виділено перші 100 із ' + eligible.length + ' знайдених позицій — це безпечний розмір одного імпорту.' : 'Виділено всі знайдені позиції: ' + eligible.length + '.');
    };
    $('#supplierImportClear').onclick = () => { importer.selected.clear(); renderImportPreview(); };
    $('#supplierImportBrands').onclick = createImportedBrands;
    $('#supplierImportApply').onclick = importSelected;
  };
  const ercImage = (value = '') => {
    const source = String(value || '').trim();
    const absolute = source.startsWith('//') ? 'https:' + source : source.startsWith('/') ? 'https://www.erc.ua' + source : source;
    return allowedImage(absolute.replace(/^http:\/\/((?:[a-z0-9-]+\.)?erc\.ua)\//i, 'https://$1/'));
  };
  const ercSpecifications = (source = {}) => {
    const specifications = {};
    const add = (key, value) => {
      const label = canonicalSpecKey(key || ''), text = cleanImportText(value || '');
      if (label && text && label.length <= 120 && text.length <= 700) specifications[label] = text;
    };
    const visit = (value, depth = 0) => {
      if (depth > 4 || value == null) return;
      if (typeof value === 'string') { Object.assign(specifications, parseSpecifications(value)); return; }
      if (Array.isArray(value)) { value.forEach((entry) => visit(entry, depth + 1)); return; }
      if (typeof value !== 'object') return;
      const key = value.name || value.Name || value.key || value.Key || value.title || value.Title || value.label || value.Label || value.parameter || value.Parameter;
      const fieldValue = value.value ?? value.Value ?? value.data ?? value.Data ?? value.content ?? value.Content ?? value.text ?? value.Text;
      if (key && fieldValue != null && typeof fieldValue !== 'object') add(key, fieldValue);
      Object.entries(value).forEach(([entryKey, entryValue]) => {
        if (entryValue == null || entryKey === key || /^(?:name|key|title|label|parameter|value|data|content|text)$/i.test(entryKey)) return;
        if (typeof entryValue === 'string' || typeof entryValue === 'number' || typeof entryValue === 'boolean') add(entryKey, entryValue);
        else visit(entryValue, depth + 1);
      });
    };
    ['specifications', 'Specifications', 'characteristics', 'Characteristics', 'attributes', 'Attributes', 'attrs', 'Attrs', 'parameters', 'Parameters', 'features', 'Features'].forEach((key) => visit(source[key]));
    return specifications;
  };
  const ercRow = (item, index) => {
    const source = item && typeof item === 'object' ? item : {};
    const sku = normaliseSku(source.code || source.Code || source.sku || source.SKU || source.ware || source.Ware);
    const vendor = canonicalBrandName(source.vendor || source.Vendor || source.vendorName || source.VendorName || '');
    const sourceName = cleanImportText(source.gname || source.GName || source.name || source.Name || '');
    const name = compactImportName(sourceName, sku, vendor);
    const warehouses = Array.isArray(source.whs) ? source.whs : Array.isArray(source.WHS) ? source.WHS : [];
    const stock = warehouses.reduce((total, entry) => total + importQuantity(entry?.q ?? entry?.Q ?? entry?.quantity ?? entry?.Quantity), 0);
    const hasStock = warehouses.length > 0 || source.stock != null || source.Stock != null;
    const rawPrice = source.sprice ?? source.SPrice ?? source.price ?? source.Price;
    const price = importNumber(rawPrice);
    const rawSpecs = {
      ...(source.warranty || source.Warranty ? { 'Гарантія': cleanImportText(source.warranty || source.Warranty) } : {}),
      ...(source.weight || source.Weight ? { 'Вага': cleanImportText(source.weight || source.Weight) } : {}),
      ...(source.width || source.Width || source.height || source.Height || source.depth || source.Depth ? { 'Габарити': [source.width || source.Width, source.height || source.Height, source.depth || source.Depth].filter(Boolean).join(' × ') } : {}),
    };
    const description = importDescription(source.description, source.Description, source.fullDescription, source.FullDescription, source.gdesc, source.GDesc);
    const sourceSpecifications = { ...parseSpecifications(description), ...ercSpecifications(source), ...rawSpecs };
    return {
      key: 'erc-' + (sku || index), vendor, name, sku, sourceCategory: cleanImportText(source.category || source.Category || source.categoryName || ''), subcategory: cleanImportText(source.subcategory || source.Subcategory || ''),
      price, hasPrice: rawPrice != null && price > 0, stock: hasStock ? stock : 0, hasStock, availabilityStatus: hasStock ? (stock > 0 ? 'in_stock' : 'out_of_stock') : '',
      description, specifications: mergeMissingSpecifications(sourceSpecifications, templateSpecifications([name, sourceName, description].join(' '))), images: [ercImage(source.pic || source.Pic || source.image || source.Image)].filter(Boolean),
    };
  };
  const setErcMessage = (message, error = false) => {
    const element = $('#ercApiMessage'); if (!element) return;
    element.textContent = message; element.classList.toggle('error', error); element.hidden = !message;
  };
  const ercRequest = async (payload) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Потрібно знову увійти в адмінку.');
    const response = await fetch('/api/erc-catalog', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Не вдалося отримати дані ERC.');
    return data;
  };
  const mountErcCatalogApi = () => {
    const anchor = $('#supplierImport');
    if (!anchor || $('#ercCatalogApi')) return;
    anchor.insertAdjacentHTML('afterend', `<section class="admin-section" id="ercCatalogApi"><div class="admin-title"><div><h2>ERC API</h2><span>Завантаження каталогу ERC у звичний попередній перегляд імпорту</span></div></div><p class="recovery-help">Дані входу ERC не зберігаються в браузері. Для першої перевірки вкажіть один SKU; після цього товари можна переглянути, зіставити з категоріями та імпортувати у розділі вище.</p><div class="admin-controls"><label>SKU ERC <input id="ercApiSku" type="text" placeholder="Напр. C11CJ88405"></label><label>Коди брендів ERC <input id="ercApiVendors" type="text" placeholder="Через кому"></label><label>Коди категорій ERC <input id="ercApiCategories" type="text" placeholder="Через кому"></label></div><div class="admin-controls"><label class="check"><input id="ercApiOnlyFree" type="checkbox"> Лише доступні товари</label><label class="check"><input id="ercApiNew" type="checkbox"> Лише новинки</label><button class="button outline" type="button" id="ercApiCheck">Перевірити підключення</button><button class="button primary" type="button" id="ercApiLoad">Завантажити у попередній перегляд</button></div><p class="admin-message" id="ercApiMessage" hidden></p></section>`);
    document.querySelector('.admin-nav')?.insertAdjacentHTML('beforeend', '<a href="#ercCatalogApi">ERC API</a>');
    $('#ercApiCheck').onclick = async () => {
      const button = $('#ercApiCheck'); button.disabled = true;
      try { const result = await ercRequest({ action: 'status' }); setErcMessage(result.configured ? 'Підключення налаштоване. Для фактичної перевірки введіть SKU і завантажте товар.' : 'Потрібно додати облікові дані ERC у налаштування сервера.'); }
      catch (error) { setErcMessage(error.message, true); } finally { button.disabled = false; }
    };
    $('#ercApiLoad').onclick = async () => {
      const button = $('#ercApiLoad');
      const sku = $('#ercApiSku').value.trim(), vendorIds = $('#ercApiVendors').value.trim(), categoryIds = $('#ercApiCategories').value.trim();
      if (!sku && !vendorIds && !categoryIds) { setErcMessage('Вкажіть SKU або код бренду чи категорії ERC.', true); return; }
      button.disabled = true; setErcMessage('Завантажую дані ERC…');
      try {
        const result = await ercRequest({ action: 'catalog', sku, vendorIds, categoryIds, onlyFree: $('#ercApiOnlyFree').checked, isNew: $('#ercApiNew').checked });
        importer.rows = (result.items || []).map(ercRow).filter((row) => row.sku && row.name);
        importer.selected.clear(); importer.meta.clear(); importer.report = null; importer.page = 1;
        renderImportPreview();
        importerStatus('ERC: отримано ' + importer.rows.length + ' товарів. Перевірте їх у попередньому перегляді нижче перед імпортом.');
        $('#supplierImport')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setErcMessage('Готово: ' + importer.rows.length + ' товарів передано у попередній перегляд.');
      } catch (error) { setErcMessage(error.message || 'Не вдалося завантажити дані ERC.', true); }
      finally { button.disabled = false; }
    };
  };
  const mountImportTools = () => { mountImporter(); mountErcCatalogApi(); };
  window.addEventListener('load', mountImportTools, { once: true });
  if (document.readyState !== 'loading') mountImportTools();
  const expectedCategoryFromName = (product) => {
    const name = String(product?.name || '').trim().toLocaleLowerCase('uk-UA');
    const printMode = printColourMode(product?.name, product?.specifications);
    if (/^(смартфон|smartphone|iphone|мобільн(?:ий|ого)\s+телефон)/iu.test(name) && !/(чохол|case|cover|кабель|cable|зарядн|charger|адаптер|adapter|дисплей|екран|display|запчастин|repair)/iu.test(name)) return 'мобільнии-телефон';
    if (/^(бфп|мфу|mfp|multifunction|багатофункціональн\w*\s+(?:пристрій|апарат))/iu.test(name)) {
      if (isWideFormat(name)) return 'office-wide-format';
      if (printMode === 'color') return 'office-mfp-color';
      if (printMode === 'mono') return 'office-mfp-mono';
      return '';
    }
    if (/^(принтер|printer)/iu.test(name)) {
      if (isWideFormat(name)) return 'office-wide-format';
      if (printMode === 'color') return 'office-printers-color';
      if (printMode === 'mono') return 'office-printers-mono';
      return '';
    }
    if (/^(сканер|scanner)/iu.test(name)) return 'office-scanners';
    return '';
  };
  const renderCategoryIntegrityAudit = () => {
    const host = $('#reports');
    if (!host) return;
    let panel = $('#categoryIntegrityAudit');
    if (!panel) { panel = document.createElement('div'); panel.id = 'categoryIntegrityAudit'; panel.className = 'owner-report-details'; host.append(panel); }
    const problems = state.products.filter((product) => product.is_active && expectedCategoryFromName(product) && product.category !== expectedCategoryFromName(product));
    const rows = problems.slice(0, 8).map((product) => {
      const target = expectedCategoryFromName(product);
      const currentName = state.categories.find((item) => item.slug === product.category)?.name || product.category || 'Без категорії';
      const targetName = state.categories.find((item) => item.slug === target)?.name || target;
      return '<li><button type="button" class="catalog-audit-product" data-catalog-audit-product="' + product.id + '">' + esc(product.name) + '</button><span>' + esc(currentName) + ' → ' + esc(targetName) + '</span></li>';
    }).join('');
    panel.innerHTML = '<article><h3>Контроль категорій <small>(' + problems.length + ')</small></h3>' + (rows ? '<p class="owner-report-hint">Назва товару не відповідає категорії. Натисніть позицію, щоб перевірити та виправити.</p><ul class="owner-report-list">' + rows + '</ul>' + (problems.length > 8 ? '<p class="owner-report-empty">Показано 8 із ' + problems.length + ' позицій.</p>' : '') : '<p class="owner-report-empty">Розбіжностей у перевірених типах товарів не знайдено.</p>') + '</article>';
    panel.querySelectorAll('[data-catalog-audit-product]').forEach((button) => button.onclick = () => productDialog(state.products.find((product) => Number(product.id) === Number(button.dataset.catalogAuditProduct))));
  };
const renderAllWithCatalogAudit = renderAll;
renderAll = () => { renderAllWithCatalogAudit(); renderCatalogAudit(); renderCategoryIntegrityAudit(); };
})();
