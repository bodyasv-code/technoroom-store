import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(window.TECHNOROOM_SUPABASE.url, window.TECHNOROOM_SUPABASE.publishableKey);
const state = { products: [], orders: [], categories: [] };
const statusNames = { new: 'Нове', confirmed: 'Підтверджено', paid: 'Оплачено', shipped: 'Відправлено', completed: 'Виконано', cancelled: 'Скасовано' };
const money = (value) => `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(Number(value || 0))} ₴`;
const date = (value) => new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const escape = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const view = (name) => document.querySelectorAll('[data-view]').forEach((item) => { item.hidden = item.dataset.view !== name; });
const notice = (text, error = false) => { const node = document.querySelector('#notice'); node.textContent = text; node.hidden = false; node.classList.toggle('error', error); };
const lowStock = (product) => Number(product.stock_quantity ?? (product.in_stock ? 10 : 0)) <= 3;

function renderMetrics() {
  const active = state.products.filter((product) => product.is_active);
  const newOrders = state.orders.filter((order) => order.status === 'new');
  const revenue = state.orders.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + Number(order.total), 0);
  document.querySelector('#productMetric').textContent = active.length;
  document.querySelector('#productMetricHint').textContent = `із ${state.products.length} усіх товарів`;
  document.querySelector('#orderMetric').textContent = newOrders.length;
  document.querySelector('#orderMetricHint').textContent = newOrders.length ? 'потребують уваги' : 'нових заявок немає';
  document.querySelector('#revenueMetric').textContent = money(revenue);
  document.querySelector('#lowStockMetric').textContent = state.products.filter(lowStock).length;
  document.querySelector('#productsNavCount').textContent = state.products.length || '';
  document.querySelector('#ordersNavCount').textContent = newOrders.length || '';
}

function renderProducts() {
  const term = document.querySelector('#productSearch').value.trim().toLowerCase();
  const filter = document.querySelector('#productFilter').value;
  const products = state.products.filter((product) => {
    const haystack = [product.name, product.brand, product.sku, product.category].join(' ').toLowerCase();
    if (term && !haystack.includes(term)) return false;
    if (filter === 'active') return product.is_active;
    if (filter === 'draft') return !product.is_active;
    if (filter === 'low') return lowStock(product);
    return true;
  });
  document.querySelector('#adminProducts').innerHTML = products.length ? products.map((product) => {
    const quantity = Number(product.stock_quantity ?? (product.in_stock ? 10 : 0));
    const stockClass = quantity === 0 ? 'stock-zero' : lowStock(product) ? 'stock-low' : 'stock-ok';
    return `<tr><td><b>${escape(product.name)}</b><small>${escape(product.brand || 'Без бренду')}</small></td><td><b>${escape(product.sku || '—')}</b><small>${escape(product.category)}</small></td><td>${money(product.price)}</td><td><span class="stock-badge ${stockClass}">${quantity} шт.</span></td><td><span class="visibility ${product.is_active ? 'visible' : 'hidden-status'}">${product.is_active ? 'У каталозі' : 'Приховано'}</span></td><td class="table-actions"><button data-edit-product="${product.id}">Редагувати</button></td></tr>`;
  }).join('') : '<tr><td class="empty-row" colspan="6">Товарів за цим фільтром немає</td></tr>';
}

function renderCategories() {
  const rows = state.categories.map((category) => {
    const count = state.products.filter((product) => product.category === category.slug).length;
    return `<tr><td><b>${escape(category.name)}</b></td><td>${escape(category.slug)}</td><td><span class="visibility ${category.is_active ? 'visible' : 'hidden-status'}">${category.is_active ? 'Активна' : 'Прихована'}</span></td><td>${count}</td><td class="table-actions"><button data-edit-category="${category.id}">Редагувати</button></td></tr>`;
  });
  document.querySelector('#adminCategories').innerHTML = rows.join('') || '<tr><td class="empty-row" colspan="5">Категорій поки немає</td></tr>';
}

function statusSelect(order) {
  return `<select class="status-select status-${order.status}" data-status-order="${order.id}">${Object.entries(statusNames).map(([value, label]) => `<option value="${value}" ${order.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
}

function renderOrders() {
  const term = document.querySelector('#orderSearch').value.trim().toLowerCase();
  const filter = document.querySelector('#orderFilter').value;
  const orders = state.orders.filter((order) => {
    const haystack = [order.id, order.customer_name, order.customer_phone, order.customer_email].join(' ').toLowerCase();
    return (!term || haystack.includes(term)) && (filter === 'all' || order.status === filter);
  });
  document.querySelector('#adminOrders').innerHTML = orders.length ? orders.map((order) => `<tr><td><b>#${order.id}</b><small>${date(order.created_at)}</small></td><td><b>${escape(order.customer_name)}</b><small>${escape(order.customer_phone)}${order.customer_email ? ` · ${escape(order.customer_email)}` : ''}</small></td><td>${order.order_items?.[0]?.count || 0}</td><td><b>${money(order.total)}</b></td><td>${statusSelect(order)}</td><td class="table-actions"><button data-view-order="${order.id}">Деталі</button></td></tr>`).join('') : '<tr><td class="empty-row" colspan="6">Замовлень за цим фільтром немає</td></tr>';
}

function getCustomers() {
  const customers = new Map();
  state.orders.forEach((order) => {
    const key = (order.customer_email || order.customer_phone || order.customer_name).toLowerCase();
    const current = customers.get(key) || { name: order.customer_name, phone: order.customer_phone, email: order.customer_email, count: 0, total: 0, last: order.created_at };
    current.count += 1; current.total += Number(order.total); if (new Date(order.created_at) > new Date(current.last)) current.last = order.created_at;
    customers.set(key, current);
  });
  return [...customers.values()].sort((a, b) => new Date(b.last) - new Date(a.last));
}

function renderCustomers() {
  const term = document.querySelector('#customerSearch').value.trim().toLowerCase();
  const customers = getCustomers().filter((customer) => [customer.name, customer.phone, customer.email].join(' ').toLowerCase().includes(term));
  document.querySelector('#adminCustomers').innerHTML = customers.length ? customers.map((customer) => `<tr><td><b>${escape(customer.name)}</b></td><td>${escape(customer.phone)}<small>${escape(customer.email || 'Email не вказано')}</small></td><td>${customer.count}</td><td><b>${money(customer.total)}</b></td><td>${date(customer.last)}</td></tr>`).join('') : '<tr><td class="empty-row" colspan="5">Клієнтів поки немає</td></tr>';
}

function renderAll() { renderMetrics(); renderProducts(); renderCategories(); renderOrders(); renderCustomers(); }

function productSlug(name) { return name.toLowerCase().trim().replace(/[^a-z0-9а-яіїєґ]+/gi, '-').replace(/^-|-$/g, ''); }
function showProductDialog(product = null) {
  const dialog = document.querySelector('#productDialog'); const form = document.querySelector('#productForm'); form.reset();
  const categorySelect = form.elements.category;
  categorySelect.innerHTML = state.categories.map((category) => `<option value="${escape(category.slug)}">${escape(category.name)}</option>`).join('') || '<option value="projector">Проєктори</option>';
  document.querySelector('#productFormMessage').hidden = true;
  document.querySelector('#productDialogTitle').textContent = product ? 'Редагування товару' : 'Новий товар';
  if (product) Object.entries(product).forEach(([key, value]) => { if (form.elements[key] && key !== 'is_active') form.elements[key].value = value ?? ''; });
  if (product?.specifications) form.elements.specifications_text.value = Object.entries(product.specifications).map(([key, value]) => `${key}: ${value}`).join('\n');
  form.elements.is_active.checked = product ? product.is_active : true;
  form.elements.stock_quantity.value = product?.stock_quantity ?? (product?.in_stock ? 10 : 0);
  dialog.showModal();
}

async function saveProduct(event) {
  event.preventDefault();
  const form = event.currentTarget; const raw = Object.fromEntries(new FormData(form));
  const specifications = raw.specifications_text.split('\n').reduce((all, line) => { const [key, ...values] = line.split(':'); if (key?.trim() && values.length) all[key.trim()] = values.join(':').trim(); return all; }, {});
  const payload = { name: raw.name.trim(), slug: raw.slug.trim() || productSlug(raw.name), sku: raw.sku.trim() || null, brand: raw.brand.trim() || null, category: raw.category.trim(), price: Number(raw.price), stock_quantity: Number(raw.stock_quantity), image_path: raw.image_path.trim() || null, description: raw.description.trim() || null, specifications, is_active: form.elements.is_active.checked };
  payload.in_stock = payload.stock_quantity > 0;
  const query = raw.id ? supabase.from('products').update(payload).eq('id', raw.id).select().single() : supabase.from('products').insert(payload).select().single();
  const { data: product, error } = await query;
  if (error) { const message = document.querySelector('#productFormMessage'); message.textContent = error.code === '23505' ? 'SKU або slug уже використовується.' : 'Не вдалося зберегти товар. Перевірте дані.'; message.hidden = false; return; }
  const imageFile = form.elements.image_file.files[0];
  if (imageFile) { const extension = imageFile.name.split('.').pop().toLowerCase(); const path = `products/${product.id}-${Date.now()}.${extension}`; const { error: uploadError } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: false, contentType: imageFile.type }); if (uploadError || (await supabase.from('products').update({ image_path: path }).eq('id', product.id)).error) { const message = document.querySelector('#productFormMessage'); message.textContent = 'Товар збережено, але фото не завантажилось.'; message.hidden = false; return; } }
  document.querySelector('#productDialog').close(); await loadData();
}

function showCategoryDialog(category = null) {
  const dialog = document.querySelector('#categoryDialog'); const form = document.querySelector('#categoryForm'); form.reset();
  const parentSelect = form.elements.parent_id;
  parentSelect.innerHTML = `<option value="">— Без батьківської категорії —</option>${state.categories.filter((item) => item.id !== category?.id).map((item) => `<option value="${item.id}">${escape(item.parent_id ? '— ' : '')}${escape(item.name)}</option>`).join('')}`;
  document.querySelector('#categoryFormMessage').hidden = true; document.querySelector('#categoryDialogTitle').textContent = category ? 'Редагування категорії' : 'Нова категорія';
  if (category) { form.elements.id.value = category.id; form.elements.name.value = category.name; form.elements.slug.value = category.slug; form.elements.parent_id.value = category.parent_id || ''; form.elements.is_active.checked = category.is_active; }
  dialog.showModal();
}

async function saveCategory(event) {
  event.preventDefault(); const form = event.currentTarget; const raw = Object.fromEntries(new FormData(form));
  const payload = { name: raw.name.trim(), slug: raw.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'), parent_id: raw.parent_id ? Number(raw.parent_id) : null, is_active: form.elements.is_active.checked };
  const query = raw.id ? supabase.from('categories').update(payload).eq('id', raw.id) : supabase.from('categories').insert(payload);
  const { error } = await query;
  if (error) { const message = document.querySelector('#categoryFormMessage'); message.textContent = error.code === '23505' ? 'Такий slug уже існує.' : 'Не вдалося зберегти категорію.'; message.hidden = false; return; }
  document.querySelector('#categoryDialog').close(); await loadData();
}

async function updateOrderStatus(orderId, status) {
  const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
  if (error) { alert('Не вдалося оновити статус замовлення.'); return; }
  const order = state.orders.find((item) => item.id === Number(orderId)); if (order) order.status = status; renderAll();
}

async function showOrderDialog(orderId) {
  const order = state.orders.find((item) => item.id === Number(orderId)); if (!order) return;
  document.querySelector('#orderDialogNumber').textContent = `#${order.id}`;
  const { data: items, error } = await supabase.from('order_items').select('*').eq('order_id', order.id);
  const lines = error ? '<p>Не вдалося завантажити склад замовлення.</p>' : (items.length ? items.map((item) => `<li><span>${escape(item.product_name)} × ${item.quantity}</span><b>${money(Number(item.unit_price) * item.quantity)}</b></li>`).join('') : '<li>Товари відсутні</li>');
  document.querySelector('#orderDetails').innerHTML = `<div class="order-detail-grid"><div><span>Клієнт</span><b>${escape(order.customer_name)}</b><p>${escape(order.customer_phone)}<br>${escape(order.customer_email || 'Email не вказано')}</p></div><div><span>Доставка</span><b>${escape(order.city || 'Не вказано')}</b><p>${escape(order.address || 'Адресу не вказано')}</p></div><div><span>Дата</span><b>${date(order.created_at)}</b><p>Коментар: ${escape(order.comment || 'немає')}</p></div></div><h3>Склад замовлення</h3><ul class="order-lines">${lines}</ul><div class="order-total"><span>Разом</span><b>${money(order.total)}</b></div><label class="status-editor">Статус ${statusSelect(order)}</label><label>Нотатка менеджера<textarea id="managerNote" rows="3" placeholder="Внутрішня нотатка, не видно покупцю">${escape(order.manager_note || '')}</textarea></label><button class="button outline" data-save-note="${order.id}">Зберегти нотатку</button>`;
  document.querySelector('#orderDialog').showModal();
}

async function loadData() {
  const [{ data: products, error: productError }, { data: orders, error: orderError }, { data: categories, error: categoryError }] = await Promise.all([
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase.from('orders').select('*,order_items(count)').order('created_at', { ascending: false }),
    supabase.from('categories').select('*').order('sort_order').order('name'),
  ]);
  if (productError || orderError || categoryError) { notice('Не вдалося отримати дані. Перевірте права доступу та міграцію адмінки.', true); return; }
  state.products = products || []; state.orders = orders || []; state.categories = categories || []; renderAll();
}

async function dashboard() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile, error: profileError } = await supabase.from('profiles').select('full_name,role').eq('id', user?.id || '').maybeSingle();
  if (!profile) { await supabase.auth.signOut(); view('login'); notice(`Доступ відсутній для ${user?.email || 'цього користувача'}.${profileError ? ' Перевірте профіль у Supabase.' : ''}`, true); return; }
  view('app'); document.querySelector('#adminName').textContent = profile.full_name || 'Адміністраторе'; await loadData();
}

document.querySelector('#loginForm').onsubmit = async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password }); if (error) { notice('Невірна email-адреса або пароль', true); return; } document.querySelector('#notice').hidden = true; dashboard(); };
document.querySelector('#recoveryForm').onsubmit = async (event) => { event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); const message = document.querySelector('#recoveryNotice'); if (data.password !== data.confirmPassword) { message.textContent = 'Паролі не збігаються.'; message.hidden = false; return; } const { error } = await supabase.auth.updateUser({ password: data.password }); if (error) { message.textContent = 'Посилання недійсне або вже використане. Запросіть скидання пароля ще раз.'; message.hidden = false; return; } await supabase.auth.signOut(); history.replaceState({}, document.title, location.pathname); view('login'); notice('Пароль успішно оновлено. Увійдіть з новим паролем.'); };
document.querySelector('#logout').onclick = async () => { await supabase.auth.signOut(); view('login'); };
document.querySelectorAll('[data-add-product]').forEach((button) => { button.onclick = () => showProductDialog(); });
document.querySelector('#addCategory').onclick = () => showCategoryDialog();
document.querySelector('#productForm').onsubmit = saveProduct;
document.querySelector('#categoryForm').onsubmit = saveCategory;
document.querySelectorAll('[data-close-dialog]').forEach((button) => { button.onclick = () => button.closest('dialog').close(); });
['#productSearch', '#productFilter'].forEach((selector) => document.querySelector(selector).addEventListener('input', renderProducts));
['#orderSearch', '#orderFilter'].forEach((selector) => document.querySelector(selector).addEventListener('input', renderOrders));
document.querySelector('#customerSearch').addEventListener('input', renderCustomers);
document.addEventListener('click', async (event) => { const edit = event.target.closest('[data-edit-product]'); const category = event.target.closest('[data-edit-category]'); const order = event.target.closest('[data-view-order]'); const note = event.target.closest('[data-save-note]'); if (edit) showProductDialog(state.products.find((item) => item.id === Number(edit.dataset.editProduct))); if (category) showCategoryDialog(state.categories.find((item) => item.id === Number(category.dataset.editCategory))); if (order) showOrderDialog(order.dataset.viewOrder); if (note) { const { error } = await supabase.from('orders').update({ manager_note: document.querySelector('#managerNote').value }).eq('id', note.dataset.saveNote); if (error) return alert('Не вдалося зберегти нотатку.'); const current = state.orders.find((item) => item.id === Number(note.dataset.saveNote)); if (current) current.manager_note = document.querySelector('#managerNote').value; note.textContent = 'Збережено'; } });
document.addEventListener('change', (event) => { if (event.target.matches('[data-status-order]')) updateOrderStatus(event.target.dataset.statusOrder, event.target.value); });
supabase.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') view('recovery'); });
const recoveryType = new URLSearchParams(location.hash.slice(1)).get('type');
supabase.auth.getSession().then(({ data: { session } }) => recoveryType === 'recovery' ? view('recovery') : session ? dashboard() : view('login'));


// Операційні поля замовлення: оплата, доставка та відстеження.
const originalShowOrderDialog = showOrderDialog;
showOrderDialog = async function (orderId) {
  await originalShowOrderDialog(orderId);
  const order = state.orders.find((item) => item.id === Number(orderId));
  if (!order) return;

  const paymentLabels = {
    unpaid: 'Не оплачено',
    pending: 'Очікує оплати',
    paid: 'Оплачено',
    refunded: 'Повернення коштів'
  };

  document.querySelector('#orderDetails').insertAdjacentHTML('beforeend', `
    <h3>Оплата та доставка</h3>
    <div class="order-detail-grid">
      <label>Статус оплати
        <select id="paymentStatus" class="status-select">
          ${Object.entries(paymentLabels).map(([value, label]) => `<option value="${value}" ${(order.payment_status || 'unpaid') === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </label>
      <label>Спосіб оплати
        <input id="paymentMethod" value="${escape(order.payment_method || '')}" placeholder="Наприклад: картка або післяплата">
      </label>
      <label>Спосіб доставки
        <input id="deliveryMethod" value="${escape(order.delivery_method || '')}" placeholder="Наприклад: Нова пошта">
      </label>
      <label>Трек-номер
        <input id="trackingNumber" value="${escape(order.tracking_number || '')}" placeholder="Номер відправлення">
      </label>
      <label>Очікувана дата доставки
        <input id="expectedDelivery" type="date" value="${order.expected_delivery_at ? escape(order.expected_delivery_at.slice(0, 10)) : ''}">
      </label>
    </div>
    <button class="button primary" data-save-operations="${order.id}">Зберегти оплату й доставку</button>
  `);
};

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-save-operations]');
  if (!button) return;

  const expectedDate = document.querySelector('#expectedDelivery').value;
  const payload = {
    payment_status: document.querySelector('#paymentStatus').value,
    payment_method: document.querySelector('#paymentMethod').value.trim() || null,
    delivery_method: document.querySelector('#deliveryMethod').value.trim() || null,
    tracking_number: document.querySelector('#trackingNumber').value.trim() || null,
    expected_delivery_at: expectedDate ? `${expectedDate}T12:00:00+00:00` : null
  };

  const { error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', Number(button.dataset.saveOperations));

  if (error) {
    alert('Не вдалося зберегти оплату та доставку.');
    return;
  }

  const currentOrder = state.orders.find((item) => item.id === Number(button.dataset.saveOperations));
  if (currentOrder) Object.assign(currentOrder, payload);
  button.textContent = 'Збережено';
});


// Читабельна картка замовлення на великих і малих екранах.
const orderReadabilityStyle = document.createElement('style');
orderReadabilityStyle.textContent = `
  #orderDialog {
    width: min(920px, calc(100vw - 32px));
    max-width: 920px;
    max-height: calc(100vh - 32px);
    padding: 0;
    border: 0;
    overflow: auto;
  }
  #orderDialog .order-dialog {
    width: 100%;
    padding: 32px;
    box-sizing: border-box;
  }
  #orderDetails > h3:last-of-type + .order-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
    padding: 18px;
    margin-top: 10px;
    border: 1px solid var(--line);
    background: #f7f8f5;
  }
  #orderDetails > h3:last-of-type + .order-detail-grid label {
    display: block;
    min-width: 0;
    font: 800 11px Manrope;
  }
  #orderDetails > h3:last-of-type + .order-detail-grid input,
  #orderDetails > h3:last-of-type + .order-detail-grid select {
    width: 100%;
    box-sizing: border-box;
    margin-top: 7px;
    border: 1px solid var(--line);
    background: #fff;
    border-radius: 0;
    padding: 11px 12px;
    font: 13px Manrope;
  }
  #orderDetails [data-save-operations] {
    width: 100%;
    margin-top: 14px;
  }
  @media (max-width: 700px) {
    #orderDialog { width: calc(100vw - 20px); max-height: calc(100vh - 20px); }
    #orderDialog .order-dialog { padding: 22px 18px; }
    #orderDetails > .order-detail-grid,
    #orderDetails > h3:last-of-type + .order-detail-grid { grid-template-columns: 1fr; }
  }
`;
document.head.append(orderReadabilityStyle);
