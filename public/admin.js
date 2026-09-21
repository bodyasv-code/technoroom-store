import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(window.TECHNOROOM_SUPABASE.url, window.TECHNOROOM_SUPABASE.publishableKey);
const state = { products: [], orders: [], categories: [], productPage: 1 };
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
  const term = document.querySelector('#productSearch')
    .value
    .trim()
    .toLowerCase();

  const filter =
    document.querySelector('#productFilter').value;

  const products = state.products.filter((product) => {

    const haystack = [
      product.name,
      product.brand,
      product.sku,
      product.category
    ]
      .join(' ')
      .toLowerCase();

    if (term && !haystack.includes(term)) {
      return false;
    }

    if (filter === 'active') {
      return product.is_active;
    }

    if (filter === 'draft') {
      return !product.is_active;
    }

    if (filter === 'low') {
      return lowStock(product);
    }

    return true;
  });
const pageSizeControl =
  document.querySelector('#pageSize');

const pageSize =
  pageSizeControl
    ? pageSizeControl.value
    : '10';

const visibleProducts =
  pageSize === 'all'
    ? products
    : products.slice(
        0,
        Number(pageSize)
      );

  document.querySelector('#adminProducts').innerHTML =
    products.length
      ? visibleProducts.map((product) =>
` {

          const quantity = Number(
            product.stock_quantity ??
            (product.in_stock ? 10 : 0)
          );

          const stockClass =
            quantity === 0
              ? 'stock-zero'
              : lowStock(product)
                ? 'stock-low'
                : 'stock-ok';

          return `
            <tr>
              <td>
                <b>${escape(product.name)}</b>
                <small>${escape(product.brand || 'Без бренду')}</small>
              </td>

              <td>
                <b>${escape(product.sku || '—')}</b>
                <small>${escape(product.category)}</small>
              </td>

              <td>${money(product.price)}</td>

              <td>
                <span class="stock-badge ${stockClass}">
                  ${quantity} шт.
                </span>
              </td>

              <td>
                <span class="visibility ${
                  product.is_active
                    ? 'visible'
                    : 'hidden-status'
                }">
                  ${
                    product.is_active
                      ? 'У каталозі'
                      : 'Приховано'
                  }
                </span>
              </td>

              <td class="table-actions">
                <button data-edit-product="${product.id}">
                  Редагувати
                </button>
              </td>
            </tr>
          `;
        }).join('')

      : `
        <tr>
          <td class="empty-row" colspan="6">
            Товарів за цим фільтром немає
          </td>
        </tr>
      `;
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
  document.querySelector('#orderDetails').innerHTML = `<div class="order-detail-grid"><div><span>Клієнт</span><b>${escape(order.customer_name)}</b><p>${escape(order.customer_phone)}${escape(order.customer_email || 'Email не вказано')}</p></div><div><span>Доставка</span><b>${escape(order.city || 'Не вказано')}</b><p>${escape(order.address || 'Адресу не вказано')}</p></div><div><span>Дата</span><b>${date(order.created_at)}</b><p>Коментар: ${escape(order.comment || 'немає')}</p></div></div><h3>Склад замовлення</h3><ul class="order-lines">${lines}</ul><div class="order-total"><span>Разом</span><b>${money(order.total)}</b></div><label class="status-editor">Статус ${statusSelect(order)}</label><label>Нотатка менеджера<textarea id="managerNote" rows="3" placeholder="Внутрішня нотатка, не видно покупцю">${escape(order.manager_note || '')}</textarea></label><button class="button outline" data-save-note="${order.id}">Зберегти нотатку</button>`;
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


// Дерево категорій: батьківські та вкладені рівні.
const originalRenderCategories = renderCategories;
renderCategories = function () {
  const byParent = new Map();
  state.categories.forEach((category) => {
    const key = category.parent_id || null;
    const items = byParent.get(key) || [];
    items.push(category);
    byParent.set(key, items);
  });

  const ordered = [];
  const visited = new Set();
  const addBranch = (parentId = null, depth = 0) => {
    (byParent.get(parentId) || [])
      .sort((a, b) => a.name.localeCompare(b.name, 'uk'))
      .forEach((category) => {
        if (visited.has(category.id)) return;
        visited.add(category.id);
        ordered.push({ category, depth });
        addBranch(category.id, depth + 1);
      });
  };
  addBranch();
  state.categories.filter((category) => !visited.has(category.id)).forEach((category) => ordered.push({ category, depth: 0 }));

  document.querySelector('#adminCategories').innerHTML = ordered.map(({ category, depth }) => {
    const parent = state.categories.find((item) => item.id === category.parent_id);
    const count = state.products.filter((product) => product.category === category.slug).length;
    const childCount = (byParent.get(category.id) || []).length;
    const marker = depth ? '↳' : '◆';
    const subtitle = parent ? `Підкатегорія · ${escape(parent.name)}` : 'Основна категорія';
    return `<tr class="category-tree-row" style="--tree-depth:${depth}"><td><span class="category-tree-marker">${marker}</span><b>${escape(category.name)}</b><small>${subtitle}${childCount ? ` · ${childCount} підкатегор.` : ''}</small></td><td><code>${escape(category.slug)}</code></td><td><span class="visibility ${category.is_active ? 'visible' : 'hidden-status'}">${category.is_active ? 'Активна' : 'Прихована'}</span></td><td>${count}</td><td class="table-actions"><button data-edit-category="${category.id}">Редагувати</button></td></tr>`;
  }).join('');
};

const categoryTreeStyle = document.createElement('style');
categoryTreeStyle.textContent = `
  .category-tree-row td:first-child { padding-left: calc(18px + var(--tree-depth) * 26px); position: relative; }
  .category-tree-row small { display: block; margin-top: 5px; color: var(--muted); font-size: 10px; }
  .category-tree-marker { display: inline-grid; place-items: center; width: 18px; height: 18px; margin-right: 7px; border-radius: 50%; background: #ecf1e8; color: #577400; font-size: 10px; vertical-align: middle; }
  .category-tree-row[style*="--tree-depth:1"] .category-tree-marker { background: #ddff43; color: #0b2723; }
  .category-tree-row code { color: var(--muted); font: 11px Manrope; }
`;
document.head.append(categoryTreeStyle);
// Керування наявністю товарів: в наявності, під замовлення або відсутній.
const inventoryLabels = {
  in_stock: 'В наявності',
  under_order: 'Під замовлення',
  out_of_stock: 'Немає в наявності'
};
const inventoryStatus = (product) => product.availability_status || ((product.in_stock && Number(product.stock_quantity || 0) > 0) ? 'in_stock' : 'out_of_stock');
const inventoryQuantity = (product) => Number(product.stock_quantity ?? (product.in_stock ? 10 : 0));
const originalRenderMetricsForInventory = renderMetrics;
renderMetrics = function () {
  originalRenderMetricsForInventory();
  document.querySelector('#lowStockMetric').textContent = state.products.filter((product) => inventoryStatus(product) === 'in_stock' && inventoryQuantity(product) <= 3).length;
};
const originalRenderProductsForInventory = renderProducts;
renderProducts = function () {
  const filterControl = document.querySelector('#productFilter');
  if (!filterControl.querySelector('option[value="under_order"]')) {
    filterControl.insertAdjacentHTML('beforeend', '<option value="under_order">Під замовлення</option><option value="out_of_stock">Немає в наявності</option>');
  }
  const header = document.querySelector('#adminProducts').closest('table').querySelector('thead tr');
  if (header.children.length === 6) header.children[4].insertAdjacentHTML('beforebegin', '<th>Наявність</th>');
  const term = document.querySelector('#productSearch').value.trim().toLowerCase();
  const filter = filterControl.value;
  const products = state.products.filter((product) => {
    const haystack = [product.name, product.brand, product.sku, product.category].join(' ').toLowerCase();
    if (term && !haystack.includes(term)) return false;
    if (filter === 'active') return product.is_active;
    if (filter === 'draft') return !product.is_active;
    if (filter === 'low') return inventoryStatus(product) === 'in_stock' && inventoryQuantity(product) <= 3;
    if (filter === 'under_order' || filter === 'out_of_stock') return inventoryStatus(product) === filter;
    return true;
  });
  document.querySelector('#adminProducts').innerHTML = products.length ? products.map((product) => {
    const quantity = inventoryQuantity(product);
    const status = inventoryStatus(product);
    const stockClass = status === 'under_order' ? 'stock-order' : quantity === 0 ? 'stock-zero' : quantity <= 3 ? 'stock-low' : 'stock-ok';
    return '<tr><td><b>' + escape(product.name) + '</b><small>' + escape(product.brand || 'Без бренду') + '</small></td><td><b>' + escape(product.sku || '—') + '</b><small>' + escape(product.category) + '</small></td><td>' + money(product.price) + '</td><td><span class="stock-badge ' + stockClass + '">' + (status === 'under_order' ? 'під замовлення' : quantity + ' шт.') + '</span></td><td><span class="inventory-badge inventory-' + status + '">' + inventoryLabels[status] + '</span></td><td><span class="visibility ' + (product.is_active ? 'visible' : 'hidden-status') + '">' + (product.is_active ? 'У каталозі' : 'Приховано') + '</span></td><td class="table-actions"><button data-edit-product="' + product.id + '">Редагувати</button></td></tr>';
  }).join('') : '<tr><td class="empty-row" colspan="7">Товарів за цим фільтром немає</td></tr>';
};
const originalShowProductForInventory = showProductDialog;
showProductDialog = function (product = null) {
  originalShowProductForInventory(product);
  const form = document.querySelector('#productForm');
  if (!document.querySelector('#availabilityStatusField')) {
    const stockLabel = form.elements.stock_quantity.closest('label');
    stockLabel.insertAdjacentHTML('beforebegin', '<label id="availabilityStatusField">Статус наявності<select name="availability_status"><option value="in_stock">В наявності</option><option value="under_order">Під замовлення</option><option value="out_of_stock">Немає в наявності</option></select></label>');
  }
  form.elements.availability_status.value = product ? inventoryStatus(product) : 'in_stock';
};
async function saveProductWithInventory(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const raw = Object.fromEntries(new FormData(form));
  const specifications = raw.specifications_text.split('\n').reduce((all, line) => {
    const [key, ...values] = line.split(':');
    if (key?.trim() && values.length) all[key.trim()] = values.join(':').trim();
    return all;
  }, {});
  const requestedStatus = raw.availability_status;
  const requestedQuantity = Number(raw.stock_quantity);
  const availability_status = requestedStatus === 'in_stock' && requestedQuantity === 0 ? 'out_of_stock' : requestedStatus;
  const payload = {
    name: raw.name.trim(),
    slug: raw.slug.trim() || productSlug(raw.name),
    sku: raw.sku.trim() || null,
    brand: raw.brand.trim() || null,
    category: raw.category.trim(),
    price: Number(raw.price),
    stock_quantity: availability_status === 'in_stock' ? requestedQuantity : 0,
    image_path: raw.image_path.trim() || null,
    description: raw.description.trim() || null,
    specifications,
    is_active: form.elements.is_active.checked,
    availability_status,
    in_stock: availability_status === 'in_stock' && requestedQuantity > 0
  };
  const query = raw.id ? supabase.from('products').update(payload).eq('id', raw.id).select().single() : supabase.from('products').insert(payload).select().single();
  const { data: product, error } = await query;
  if (error) {
    const message = document.querySelector('#productFormMessage');
    message.textContent = error.code === '23505' ? 'SKU або slug уже використовується.' : 'Не вдалося зберегти товар. Перевірте дані.';
    message.hidden = false;
    return;
  }
  const imageFile = form.elements.image_file.files[0];
  if (imageFile) {
    const extension = imageFile.name.split('.').pop().toLowerCase();
    const path = 'products/' + product.id + '-' + Date.now() + '.' + extension;
    const { error: uploadError } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: false, contentType: imageFile.type });
    if (uploadError || (await supabase.from('products').update({ image_path: path }).eq('id', product.id)).error) {
      const message = document.querySelector('#productFormMessage');
      message.textContent = 'Товар збережено, але фото не завантажилось.';
      message.hidden = false;
      return;
    }
  }
  document.querySelector('#productDialog').close();
  await loadData();
}
document.querySelector('#productForm').onsubmit = saveProductWithInventory;
const inventoryAdminStyle = document.createElement('style');
inventoryAdminStyle.textContent =
  '.inventory-badge{display:inline-block;padding:5px 8px;border-radius:99px;font-size:10px;font-weight:800}.inventory-in_stock{background:#e4f7c8;color:#4e7200}.inventory-under_order,.stock-order{background:#fff0c8;color:#8b5f00}.inventory-out_of_stock{background:#f6ded9;color:#943b2a}#availabilityStatusField select{display:block;width:100%;box-sizing:border-box;margin-top:7px;border:1px solid var(--line);background:#fff;padding:10px;font:13px Manrope}';
document.head.append(inventoryAdminStyle);
renderAll();


// Внутрішні шляхи Supabase Storage (products/...) не є зовнішніми URL.
const productImageField = document.querySelector('#productForm [name="image_path"]');
if (productImageField) {
  productImageField.type = 'text';
  productImageField.placeholder = 'https://... або products/назва-файлу.jpg';
}


/* Галерея зображень: кілька файлів і вибір головного фото. */
const productGalleryForm = document.querySelector('#productForm');
const galleryFilesInput = productGalleryForm.elements.image_file;
const galleryImageInput = productGalleryForm.elements.image_path;
const productGalleryState = { paths: [], primary: '', pending: [] };
galleryFilesInput.multiple = true;
const productGalleryPanel = document.createElement('section');
productGalleryPanel.className = 'product-gallery-editor';
galleryFilesInput.closest('label').insertAdjacentElement('afterend', productGalleryPanel);
const productGalleryCss = document.createElement('style');
productGalleryCss.textContent = '.product-gallery-editor{margin:4px 0 18px}.product-gallery-editor h4{margin:0 0 8px}.gallery-list{display:flex;flex-wrap:wrap;gap:8px}.gallery-card{width:92px;border:1px solid #d8ddd5;padding:5px;background:#fff}.gallery-card.is-main{outline:2px solid #d8ff37}.gallery-card img{display:block;width:80px;height:60px;object-fit:contain;background:#f2f4ee}.gallery-card button{display:block;width:100%;margin-top:5px;font-size:11px}.gallery-note{font-size:12px;color:#66736d}';
document.head.append(productGalleryCss);
const productGalleryUrl = (path) => String(path || '').startsWith('http') ? path : supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
function renderProductGalleryEditor() {
  const cards = productGalleryState.paths.map((path, index) => '<div class="gallery-card ' + (path === productGalleryState.primary ? 'is-main' : '') + '"><img src="' + productGalleryUrl(path) + '" alt="Фото ' + (index + 1) + '"><button type="button" data-gallery-primary="' + encodeURIComponent(path) + '">' + (path === productGalleryState.primary ? 'Головне' : 'Зробити головним') + '</button><button type="button" data-gallery-delete="' + encodeURIComponent(path) + '">Прибрати</button></div>').join('');
  productGalleryPanel.innerHTML = '<h4>Галерея товару</h4>' + (cards ? '<div class="gallery-list">' + cards + '</div>' : '<p class="gallery-note">Завантажте одне або кілька фото.</p>') + (productGalleryState.pending.length ? '<p class="gallery-note">Вибрані нові файли: ' + productGalleryState.pending.join(', ') + '.</p>' : '');
}
productGalleryPanel.addEventListener('click', (event) => {
  const primary = event.target.closest('[data-gallery-primary]');
  const remove = event.target.closest('[data-gallery-delete]');
  if (primary) { productGalleryState.primary = decodeURIComponent(primary.dataset.galleryPrimary); galleryImageInput.value = productGalleryState.primary; renderProductGalleryEditor(); }
  if (remove) { const path = decodeURIComponent(remove.dataset.galleryDelete); productGalleryState.paths = productGalleryState.paths.filter((entry) => entry !== path); if (productGalleryState.primary === path) productGalleryState.primary = productGalleryState.paths[0] || ''; galleryImageInput.value = productGalleryState.primary; renderProductGalleryEditor(); }
});
galleryImageInput.addEventListener('change', () => { const path = galleryImageInput.value.trim(); if (path && !productGalleryState.paths.includes(path)) productGalleryState.paths.unshift(path); if (path) productGalleryState.primary = path; renderProductGalleryEditor(); });
galleryFilesInput.addEventListener('change', () => { productGalleryState.pending = Array.from(galleryFilesInput.files || []).map((file) => file.name); renderProductGalleryEditor(); });
const baseProductDialog = showProductDialog;
showProductDialog = function (product = null) {
  baseProductDialog(product);
  productGalleryState.paths = [...new Set([product?.image_path, ...(Array.isArray(product?.image_paths) ? product.image_paths : [])].filter(Boolean))];
  productGalleryState.primary = product?.image_path || productGalleryState.paths[0] || '';
  productGalleryState.pending = [];
  galleryImageInput.value = productGalleryState.primary;
  renderProductGalleryEditor();
};
async function saveProductGallery(event) {
  event.preventDefault(); const form = event.currentTarget; const raw = Object.fromEntries(new FormData(form));
  const specifications = raw.specifications_text.split('\n').reduce((all, line) => { const [key, ...values] = line.split(':'); if (key?.trim() && values.length) all[key.trim()] = values.join(':').trim(); return all; }, {});
  const manual = raw.image_path.trim(); let paths = [...productGalleryState.paths]; if (manual && !paths.includes(manual)) paths.unshift(manual);
  const payload = { name: raw.name.trim(), slug: raw.slug.trim() || productSlug(raw.name), sku: raw.sku.trim() || null, brand: raw.brand.trim() || null, category: raw.category.trim(), price: Number(raw.price), stock_quantity: Number(raw.stock_quantity), image_path: productGalleryState.primary || manual || paths[0] || null, image_paths: paths, description: raw.description.trim() || null, specifications, is_active: form.elements.is_active.checked };
  const status = form.elements.availability_status?.value; payload.in_stock = status ? status === 'in_stock' : payload.stock_quantity > 0; if (status) payload.availability_status = status;
  const query = raw.id ? supabase.from('products').update(payload).eq('id', raw.id).select().single() : supabase.from('products').insert(payload).select().single();
  const { data: saved, error } = await query; const message = document.querySelector('#productFormMessage');
  if (error) { message.textContent = error.code === '23505' ? 'SKU або slug уже використовується.' : 'Не вдалося зберегти товар. Перевірте дані.'; message.hidden = false; return; }
  const uploaded = [];
  for (const [index, file] of Array.from(galleryFilesInput.files || []).entries()) {
    const ext = (file.name.split('.').pop() || 'webp').toLowerCase(); const path = 'products/' + saved.id + '-' + Date.now() + '-' + index + '.' + ext;
    const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) { message.textContent = 'Товар збережено, але одне з фото не завантажилось.'; message.hidden = false; return; }
    uploaded.push(path);
  }
  if (uploaded.length) { const allPaths = [...new Set([...paths, ...uploaded])]; const { error: photoError } = await supabase.from('products').update({ image_path: payload.image_path || uploaded[0], image_paths: allPaths }).eq('id', saved.id); if (photoError) { message.textContent = 'Фото завантажено, але не вдалося прив’язати його до товару.'; message.hidden = false; return; } }
  document.querySelector('#productDialog').close(); await loadData();
}
productGalleryForm.onsubmit = saveProductGallery;


/* Надійне завантаження галереї з видимим результатом. */
async function saveProductGalleryWithProgress(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const raw = Object.fromEntries(new FormData(form));
  const message = document.querySelector('#productFormMessage');
  const submit = form.querySelector('[type="submit"]');
  const files = Array.from(galleryFilesInput.files || []);
  const specifications = raw.specifications_text.split('\n').reduce((all, line) => {
    const [key, ...values] = line.split(':');
    if (key?.trim() && values.length) all[key.trim()] = values.join(':').trim();
    return all;
  }, {});
  const manual = raw.image_path.trim();
  let paths = [...productGalleryState.paths];
  if (manual && !paths.includes(manual)) paths.unshift(manual);
  const payload = {
    name: raw.name.trim(), slug: raw.slug.trim() || productSlug(raw.name),
    sku: raw.sku.trim() || null, brand: raw.brand.trim() || null,
    category: raw.category.trim(), price: Number(raw.price),
    stock_quantity: Number(raw.stock_quantity),
    image_path: productGalleryState.primary || manual || paths[0] || null,
    image_paths: paths, description: raw.description.trim() || null,
    specifications, is_active: form.elements.is_active.checked
  };
  const status = form.elements.availability_status?.value;
  payload.in_stock = status ? status === 'in_stock' : payload.stock_quantity > 0;
  if (status) payload.availability_status = status;
  const invalid = files.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
  if (invalid) {
    message.textContent = 'Файл «' + invalid.name + '» має непідтримуваний формат. Оберіть JPG, PNG або WebP.';
    message.hidden = false;
    return;
  }
  submit.disabled = true;
  try {
    message.hidden = false;
    message.textContent = files.length ? 'Зберігаємо товар і завантажуємо фото (0 з ' + files.length + ')…' : 'Зберігаємо товар…';
    const query = raw.id
      ? supabase.from('products').update(payload).eq('id', raw.id).select().single()
      : supabase.from('products').insert(payload).select().single();
    const { data: saved, error } = await query;
    if (error) throw new Error(error.code === '23505' ? 'SKU або slug уже використовується.' : 'Не вдалося зберегти товар: ' + error.message);

    const uploaded = [];
    for (const [index, file] of files.entries()) {
      message.textContent = 'Завантажуємо фото ' + (index + 1) + ' з ' + files.length + ': ' + file.name;
      const extension = (file.name.split('.').pop() || 'webp').toLowerCase();
      const path = 'products/' + saved.id + '-' + Date.now() + '-' + index + '.' + extension;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw new Error('Не вдалося завантажити «' + file.name + '»: ' + uploadError.message);
      uploaded.push(path);
    }

    const allPaths = [...new Set([...paths, ...uploaded])];
    const primary = productGalleryState.primary || manual || paths[0] || uploaded[0] || null;
    const { data: finished, error: galleryError } = await supabase.from('products')
      .update({ image_path: primary, image_paths: allPaths }).eq('id', saved.id).select().single();
    if (galleryError) throw new Error('Фото завантажено, але не вдалося прив’язати до товару: ' + galleryError.message);

    productGalleryState.paths = allPaths;
    productGalleryState.primary = primary;
    productGalleryState.pending = [];
    galleryFilesInput.value = '';
    galleryImageInput.value = primary || '';
    renderProductGalleryEditor();
    const index = state.products.findIndex((item) => Number(item.id) === Number(finished.id));
    if (index >= 0) state.products[index] = finished;
    message.textContent = uploaded.length
      ? 'Готово: додано ' + uploaded.length + ' фото. Вони вже показані в галереї нижче.'
      : 'Зміни товару збережено.';
  } catch (error) {
    message.textContent = error.message || 'Не вдалося зберегти товар.';
  } finally {
    message.hidden = false;
    submit.disabled = false;
  }
}
productGalleryForm.onsubmit = saveProductGalleryWithProgress;


/* Зручні поля товару: slug, бренд і черга кількох фото. */
const productNameInput = productGalleryForm.elements.name;
const productSlugInput = productGalleryForm.elements.slug;
const productBrandInput = productGalleryForm.elements.brand;
let slugChangedManually = false;
const brandOptions = document.createElement('datalist');
brandOptions.id = 'productBrandOptions';
document.body.append(brandOptions);
productBrandInput.setAttribute('list', brandOptions.id);
productBrandInput.setAttribute('placeholder', 'Оберіть або введіть бренд');
const refreshBrandOptions = () => {
  const brands = [...new Set(state.products.map((product) => String(product.brand || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'uk'));
  brandOptions.innerHTML = brands.map((brand) => '<option value="' + escape(brand) + '"></option>').join('');
};
productNameInput.addEventListener('input', () => {
  if (!slugChangedManually) productSlugInput.value = productSlug(productNameInput.value);
});
productSlugInput.addEventListener('input', () => {
  slugChangedManually = productSlugInput.value.trim() !== productSlug(productNameInput.value);
});

productGalleryState.pendingFiles = [];
galleryFilesInput.addEventListener('change', () => {
  const selected = Array.from(galleryFilesInput.files || []);
  const known = new Set(productGalleryState.pendingFiles.map((file) => file.name + ':' + file.size + ':' + file.lastModified));
  selected.forEach((file) => {
    const key = file.name + ':' + file.size + ':' + file.lastModified;
    if (!known.has(key)) productGalleryState.pendingFiles.push(file);
  });
  setTimeout(() => {
    productGalleryState.pending = productGalleryState.pendingFiles.map((file) => file.name);
    galleryFilesInput.value = '';
    renderProductGalleryEditor();
  }, 0);
}, true);

const galleryProductDialog = showProductDialog;
showProductDialog = function (product = null) {
  galleryProductDialog(product);
  slugChangedManually = Boolean(product?.slug && product.slug !== productSlug(product.name));
  productGalleryState.pendingFiles = [];
  refreshBrandOptions();
};

async function saveProductGalleryQueued(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const raw = Object.fromEntries(new FormData(form));
  const message = document.querySelector('#productFormMessage');
  const submit = form.querySelector('[type="submit"]');
  const files = [...(productGalleryState.pendingFiles || [])];
  const specifications = raw.specifications_text.split('\n').reduce((all, line) => {
    const [key, ...values] = line.split(':');
    if (key?.trim() && values.length) all[key.trim()] = values.join(':').trim();
    return all;
  }, {});
  const manual = raw.image_path.trim();
  const paths = [...productGalleryState.paths];
  if (manual && !paths.includes(manual)) paths.unshift(manual);
  const payload = {
    name: raw.name.trim(), slug: raw.slug.trim() || productSlug(raw.name),
    sku: raw.sku.trim() || null, brand: raw.brand.trim() || null,
    category: raw.category.trim(), price: Number(raw.price),
    stock_quantity: Number(raw.stock_quantity), image_path: productGalleryState.primary || manual || paths[0] || null,
    image_paths: paths, description: raw.description.trim() || null,
    specifications, is_active: form.elements.is_active.checked
  };
  const status = form.elements.availability_status?.value;
  payload.in_stock = status ? status === 'in_stock' : payload.stock_quantity > 0;
  if (status) payload.availability_status = status;
  const invalid = files.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
  if (invalid) {
    message.textContent = 'Файл «' + invalid.name + '» має непідтримуваний формат. Оберіть JPG, PNG або WebP.';
    message.hidden = false;
    return;
  }
  submit.disabled = true;
  try {
    message.hidden = false;
    message.textContent = files.length ? 'Зберігаємо товар. У черзі ' + files.length + ' фото…' : 'Зберігаємо товар…';
    const query = raw.id
      ? supabase.from('products').update(payload).eq('id', raw.id).select().single()
      : supabase.from('products').insert(payload).select().single();
    const { data: saved, error } = await query;
    if (error) throw new Error(error.code === '23505' ? 'SKU або slug уже використовується.' : 'Не вдалося зберегти товар: ' + error.message);
    const uploaded = [];
    for (const [index, file] of files.entries()) {
      message.textContent = 'Завантажуємо фото ' + (index + 1) + ' з ' + files.length + ': ' + file.name;
      const extension = (file.name.split('.').pop() || 'webp').toLowerCase();
      const path = 'products/' + saved.id + '-' + Date.now() + '-' + index + '.' + extension;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw new Error('Не вдалося завантажити «' + file.name + '»: ' + uploadError.message);
      uploaded.push(path);
    }
    const allPaths = [...new Set([...paths, ...uploaded])];
    const primary = productGalleryState.primary || manual || paths[0] || uploaded[0] || null;
    const { data: finished, error: galleryError } = await supabase.from('products')
      .update({ image_path: primary, image_paths: allPaths }).eq('id', saved.id).select().single();
    if (galleryError) throw new Error('Фото завантажено, але не вдалося прив’язати до товару: ' + galleryError.message);
    productGalleryState.paths = allPaths;
    productGalleryState.primary = primary;
    productGalleryState.pending = [];
    productGalleryState.pendingFiles = [];
    galleryFilesInput.value = '';
    galleryImageInput.value = primary || '';
    renderProductGalleryEditor();
    const itemIndex = state.products.findIndex((item) => Number(item.id) === Number(finished.id));
    if (itemIndex >= 0) state.products[itemIndex] = finished;
    refreshBrandOptions();
    message.textContent = uploaded.length
      ? 'Готово: додано ' + uploaded.length + ' фото. Вони вже у галереї нижче.'
      : 'Зміни товару збережено.';
  } catch (error) {
    message.textContent = error.message || 'Не вдалося зберегти товар.';
  } finally {
    message.hidden = false;
    submit.disabled = false;
  }
}
productGalleryForm.onsubmit = saveProductGalleryQueued;


/* Швидке створення схожих товарів із наявної позиції. */
const productCloneStyle = document.createElement('style');
productCloneStyle.textContent = '.table-actions{white-space:nowrap}.table-actions [data-duplicate-product]{margin-left:10px}.clone-hint{margin:0 0 12px;color:#66736d;font-size:13px}';
document.head.append(productCloneStyle);
const appendDuplicateActions = () => {
  document.querySelectorAll('#adminProducts [data-edit-product]').forEach((editButton) => {
    const id = editButton.dataset.editProduct;
    if (editButton.parentElement.querySelector('[data-duplicate-product="' + id + '"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.duplicateProduct = id;
    button.textContent = 'Дублювати';
    editButton.insertAdjacentElement('afterend', button);
  });
};
new MutationObserver(appendDuplicateActions).observe(document.querySelector('#adminProducts'), { childList: true, subtree: true });
appendDuplicateActions();
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-duplicate-product]');
  if (!button) return;
  const source = state.products.find((product) => Number(product.id) === Number(button.dataset.duplicateProduct));
  if (!source) return;
  const copyName = source.name + ' — копія';
  const copy = {
    ...source,
    id: null,
    name: copyName,
    slug: productSlug(copyName),
    sku: null,
    is_active: false,
    image_paths: Array.isArray(source.image_paths) ? [...source.image_paths] : []
  };
  showProductDialog(copy);
  document.querySelector('#productDialogTitle').textContent = 'Дублювання товару';
  const hint = document.createElement('p');
  hint.className = 'clone-hint';
  hint.textContent = 'Створено чернетку на основі «' + source.name + '». Змініть назву, SKU та за потреби фото, потім збережіть.';
  document.querySelector('#productForm').prepend(hint);
});

const duplicateAwareProductDialog = showProductDialog;
showProductDialog = function (product = null) {
  document.querySelectorAll('.clone-hint').forEach((hint) => hint.remove());
  duplicateAwareProductDialog(product);
};


/* Короткий операційний стан прямо у списку замовлень. */
const orderTableOpsStyle = document.createElement('style');
orderTableOpsStyle.textContent = '.order-ops{min-width:175px}.order-ops b,.order-ops small{display:block}.order-ops b{font-size:12px}.order-ops small{margin-top:4px;color:#66736d;font-size:11px}.order-payment-paid{color:#3c7100}.order-payment-pending{color:#9a6400}.order-payment-unpaid{color:#6c7672}';
document.head.append(orderTableOpsStyle);
const orderPaymentLabels = { unpaid: 'Не оплачено', pending: 'Очікує оплати', paid: 'Оплачено', refunded: 'Повернення' };
const decorateOrderTable = () => {
  const table = document.querySelector('#adminOrders').closest('table');
  const header = table.querySelector('thead tr');
  if (!header.querySelector('[data-order-ops-header]')) {
    const heading = document.createElement('th');
    heading.dataset.orderOpsHeader = 'true';
    heading.textContent = 'Оплата / доставка';
    header.children[4].insertAdjacentElement('beforebegin', heading);
  }
  table.querySelectorAll('tbody tr').forEach((row) => {
    if (row.querySelector('.order-ops')) return;
    const idMatch = row.cells[0]?.textContent.match(/#(\d+)/);
    const order = idMatch && state.orders.find((item) => Number(item.id) === Number(idMatch[1]));
    if (!order || row.cells.length < 5) return;
    const payment = order.payment_status || 'unpaid';
    const delivery = [order.delivery_method, order.tracking_number].filter(Boolean).join(' · ');
    const planned = order.expected_delivery_date ? new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium' }).format(new Date(order.expected_delivery_date)) : '';
    const cell = document.createElement('td');
    cell.className = 'order-ops';
    cell.innerHTML = '<b class="order-payment-' + escape(payment) + '">' + escape(orderPaymentLabels[payment] || 'Не оплачено') + '</b><small>' + escape(delivery || planned || 'Доставку ще не вказано') + '</small>';
    row.children[4].insertAdjacentElement('beforebegin', cell);
  });
};
const renderOrdersWithOperations = renderOrders;
renderOrders = function () {
  renderOrdersWithOperations();
  decorateOrderTable();
};
document.querySelector('#orderSearch').addEventListener('input', decorateOrderTable);
document.querySelector('#orderFilter').addEventListener('input', decorateOrderTable);


/* CRM-картка покупця з історією його замовлень. */
const customerDialog = document.createElement('dialog');
customerDialog.id = 'customerDialog';
customerDialog.innerHTML = '<div class="customer-card-dialog"><div class="dialog-heading"><h2>Картка клієнта</h2><button type="button" aria-label="Закрити">×</button></div><div id="customerCardBody"></div></div>';
document.body.append(customerDialog);
const customerCardStyle = document.createElement('style');
customerCardStyle.textContent = '.customer-card-dialog{width:min(680px,calc(100vw - 32px));padding:26px}.customer-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.customer-summary div{padding:13px;background:#f0f3ec}.customer-summary b,.customer-summary span{display:block}.customer-summary span{font-size:12px;color:#66736d}.customer-order-list{display:grid;gap:8px}.customer-order-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid #e1e5de}.customer-order-row small{display:block;color:#66736d;margin-top:4px}.customer-order-row button{white-space:nowrap}@media(max-width:600px){.customer-summary{grid-template-columns:1fr}.customer-order-row{align-items:flex-start;flex-direction:column}}';
document.head.append(customerCardStyle);
const decorateCustomerTable = () => {
  const table = document.querySelector('#adminCustomers').closest('table');
  const header = table.querySelector('thead tr');
  if (!header.querySelector('[data-customer-card-header]')) {
    const heading = document.createElement('th');
    heading.dataset.customerCardHeader = 'true';
    heading.textContent = 'Картка';
    header.append(heading);
  }
  table.querySelectorAll('tbody tr').forEach((row) => {
    if (row.querySelector('[data-customer-card]')) return;
    const contacts = row.cells[1]?.textContent || '';
    const related = state.orders.find((order) => contacts.includes(order.customer_email || '__') || contacts.includes(order.customer_phone || '__'));
    if (!related || row.cells.length < 5) return;
    const key = related.customer_email || related.customer_phone || String(related.id);
    const cell = document.createElement('td');
    cell.innerHTML = '<button type="button" data-customer-card="' + encodeURIComponent(key) + '">Відкрити</button>';
    row.append(cell);
  });
};
const renderCustomersWithCards = renderCustomers;
renderCustomers = function () {
  renderCustomersWithCards();
  decorateCustomerTable();
};
const showCustomerCard = (key) => {
  const orders = state.orders.filter((order) => (order.customer_email || order.customer_phone || String(order.id)) === key);
  if (!orders.length) return;
  const customer = orders[0];
  const total = orders.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + Number(order.total || 0), 0);
  document.querySelector('#customerCardBody').innerHTML = '<p><b>' + escape(customer.customer_name) + '</b><br>' + escape(customer.customer_phone || 'Телефон не вказано') + (customer.customer_email ? '<br>' + escape(customer.customer_email) : '') + '</p><div class="customer-summary"><div><b>' + orders.length + '</b><span>замовлень</span></div><div><b>' + money(total) + '</b><span>сума покупок</span></div><div><b>' + date(orders[0].created_at) + '</b><span>останнє замовлення</span></div></div><h3>Історія замовлень</h3><div class="customer-order-list">' + orders.map((order) => '<div class="customer-order-row"><div><b>Замовлення #' + order.id + ' · ' + money(order.total) + '</b><small>' + date(order.created_at) + ' · ' + escape(statusNames[order.status] || order.status) + '</small></div><button type="button" data-customer-order="' + order.id + '">Деталі</button></div>').join('') + '</div>';
  customerDialog.showModal();
};
document.addEventListener('click', (event) => {
  const card = event.target.closest('[data-customer-card]');
  const close = event.target.closest('#customerDialog .dialog-heading button');
  const order = event.target.closest('[data-customer-order]');
  if (close) customerDialog.close();
  if (card) showCustomerCard(decodeURIComponent(card.dataset.customerCard));
  if (order) { customerDialog.close(); showOrderDialog(order.dataset.customerOrder); }
});
const customerTableBody = document.querySelector('#adminCustomers');
new MutationObserver(decorateCustomerTable).observe(customerTableBody, { childList: true, subtree: true });
decorateCustomerTable();


/* Операційні звіти для головної сторінки адмінки. */
const dashboardReportStyle = document.createElement('style');
dashboardReportStyle.textContent = '.dashboard-reports{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;margin:24px 0}.dashboard-report{padding:22px;border:1px solid #dce2d9;background:#fff}.dashboard-report h2{margin:0 0 5px;font-size:19px}.dashboard-report>p{margin:0 0 14px;color:#66736d;font-size:12px}.report-list{display:grid;gap:9px}.report-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #e7ebe4}.report-row:first-child{border-top:0}.report-row small{display:block;margin-top:3px;color:#66736d}.stock-overview{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.stock-overview div{padding:14px 10px;background:#f0f3ec}.stock-overview b,.stock-overview span{display:block}.stock-overview b{font-size:24px}.stock-overview span{margin-top:3px;font-size:11px;color:#66736d}@media(max-width:900px){.dashboard-reports{grid-template-columns:1fr}}';
document.head.append(dashboardReportStyle);
const renderDashboardReports = (items) => {
  let section = document.querySelector('#dashboardReports');
  if (!section) {
    section = document.createElement('section');
    section.id = 'dashboardReports';
    section.className = 'dashboard-reports';
    document.querySelector('#overview').insertAdjacentElement('afterend', section);
  }
  const totals = new Map();
  items.forEach((item) => {
    const name = item.product_name || 'Товар без назви';
    const previous = totals.get(name) || { quantity: 0, revenue: 0 };
    previous.quantity += Number(item.quantity || 0);
    previous.revenue += Number(item.quantity || 0) * Number(item.unit_price || 0);
    totals.set(name, previous);
  });
  const popular = [...totals.entries()].sort((a, b) => b[1].quantity - a[1].quantity).slice(0, 5);
  const inStock = state.products.filter((product) => inventoryStatus(product) === 'in_stock').length;
  const underOrder = state.products.filter((product) => inventoryStatus(product) === 'under_order').length;
  const unavailable = state.products.filter((product) => inventoryStatus(product) === 'out_of_stock').length;
  section.innerHTML = '<article class="dashboard-report"><h2>Популярні товари</h2><p>За всіма замовленнями в магазині</p><div class="report-list">' + (popular.length ? popular.map(([name, data], index) => '<div class="report-row"><div><b>' + (index + 1) + '. ' + escape(name) + '</b><small>' + data.quantity + ' шт. у замовленнях</small></div><strong>' + money(data.revenue) + '</strong></div>').join('') : '<p>Продажів для звіту поки немає.</p>') + '</div></article><article class="dashboard-report"><h2>Стан каталогу</h2><p>Швидкий контроль доступності товарів</p><div class="stock-overview"><div><b>' + inStock + '</b><span>в наявності</span></div><div><b>' + underOrder + '</b><span>під замовлення</span></div><div><b>' + unavailable + '</b><span>відсутні</span></div></div></article>';
};
const loadDataWithDashboardReports = loadData;
loadData = async function () {
  await loadDataWithDashboardReports();
  const { data: orderItems, error } = await supabase.from('order_items').select('product_name,quantity,unit_price');
  renderDashboardReports(error ? [] : (orderItems || []));
};


// Експорт замовлень і клієнтів у CSV для Excel.
const exportAdminStyles = document.createElement('style');
exportAdminStyles.textContent = '.admin-export-button{margin-left:auto;white-space:nowrap}.admin-title{display:flex;align-items:flex-start;gap:16px}.admin-title>div{min-width:0}@media(max-width:620px){.admin-title{flex-wrap:wrap}.admin-export-button{margin-left:0}}';
document.head.append(exportAdminStyles);

const csvValue = value => '"' + String(value ?? '').replace(/"/g, '""').replace(/\n/g, ' ') + '"';
const downloadCsv = (filename, rows) => {
  const content = '\uFEFF' + rows.map(row => row.map(csvValue).join(';')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const filteredOrdersForExport = () => {
  const term = document.querySelector('#orderSearch')?.value.trim().toLowerCase() || '';
  const filter = document.querySelector('#orderFilter')?.value || 'all';
  return state.orders.filter(order => {
    const haystack = [order.id, order.customer_name, order.customer_phone, order.customer_email].join(' ').toLowerCase();
    return (!term || haystack.includes(term)) && (filter === 'all' || order.status === filter);
  });
};
const exportOrdersCsv = () => {
  const orders = filteredOrdersForExport();
  const rows = [['№ замовлення', 'Дата', 'Статус', 'Покупець', 'Телефон', 'Email', 'Місто', 'Адреса', 'Сума, ₴', 'Товарів', 'Коментар']];
  orders.forEach(order => rows.push([
    order.id, date(order.created_at), statusNames[order.status] || order.status, order.customer_name,
    order.customer_phone, order.customer_email || '', order.city || '', order.address || '', Number(order.total || 0),
    order.order_items?.[0]?.count || 0, order.comment || ''
  ]));
  downloadCsv('technoroom-zamovlennia-' + new Date().toISOString().slice(0, 10) + '.csv', rows);
  notice('Експортовано замовлень: ' + orders.length + '.');
};
const exportCustomersCsv = () => {
  const grouped = new Map();
  state.orders.forEach(order => {
    const key = (order.customer_email || order.customer_phone || String(order.id)).toLowerCase();
    const current = grouped.get(key) || { name: order.customer_name, phone: order.customer_phone, email: order.customer_email || '', orders: 0, total: 0, last: order.created_at };
    current.orders += 1; current.total += Number(order.total || 0);
    if (new Date(order.created_at) > new Date(current.last)) current.last = order.created_at;
    grouped.set(key, current);
  });
  const rows = [['Клієнт', 'Телефон', 'Email', 'Замовлень', 'Загальна сума, ₴', 'Останнє замовлення']];
  [...grouped.values()].sort((a, b) => new Date(b.last) - new Date(a.last)).forEach(customer => rows.push([
    customer.name, customer.phone, customer.email, customer.orders, customer.total, date(customer.last)
  ]));
  downloadCsv('technoroom-kliienty-' + new Date().toISOString().slice(0, 10) + '.csv', rows);
  notice('Експортовано клієнтів: ' + grouped.size + '.');
};
const addExportButton = (heading, id, label, handler) => {
  if (!heading || document.querySelector('#' + id)) return;
  const button = document.createElement('button');
  button.type = 'button'; button.id = id; button.className = 'button outline admin-export-button'; button.textContent = label;
  button.addEventListener('click', handler); heading.append(button);
};
const mountAdminExports = () => {
  const titles = [...document.querySelectorAll('.admin-title')];
  const orderTitle = titles.find(title => title.querySelector('h2')?.textContent.trim() === 'Замовлення');
  const customerTitle = titles.find(title => title.querySelector('h2')?.textContent.trim() === 'Клієнти');
  addExportButton(orderTitle, 'exportOrdersCsv', 'Експорт замовлень CSV', exportOrdersCsv);
  addExportButton(customerTitle, 'exportCustomersCsv', 'Експорт клієнтів CSV', exportCustomersCsv);
};
mountAdminExports();


// Постійний журнал ключових змін у картці замовлення.
const orderTimelineStyles = document.createElement('style');
orderTimelineStyles.textContent = '.order-timeline{margin-top:28px;padding-top:22px;border-top:1px solid #d8ddd7}.order-timeline h3{margin:0 0 14px}.order-timeline-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}.order-timeline-item{display:grid;grid-template-columns:10px minmax(0,1fr);gap:10px;padding:12px;background:#f4f6f1}.order-timeline-dot{width:10px;height:10px;margin-top:5px;border-radius:999px;background:#cfff2e}.order-timeline-item b{display:block;color:#102b28}.order-timeline-item p{margin:4px 0 0;color:#60706b;font-size:13px}.order-timeline-empty{margin:0;padding:14px;background:#f4f6f1;color:#60706b}';
document.head.append(orderTimelineStyles);

const paymentStatusNames = { unpaid: 'Не оплачено', pending: 'Очікує оплати', paid: 'Оплачено', refunded: 'Повернення коштів' };
const currentOrderIdFromDialog = () => Number((document.querySelector('#orderDialogNumber')?.textContent || '').replace(/\D/g, '')) || null;
const recordOrderEvent = async (orderId, eventType, previousValue, nextValue, summary) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('order_events').insert({
    order_id: Number(orderId), event_type: eventType, previous_value: previousValue || null,
    next_value: nextValue, summary, actor_id: user.id
  });
  return !error;
};
const renderOrderTimeline = async orderId => {
  const details = document.querySelector('#orderDetails');
  if (!details || !orderId) return;
  let section = details.querySelector('#orderTimeline');
  if (!section) {
    section = document.createElement('section');
    section.id = 'orderTimeline';
    section.className = 'order-timeline';
    details.append(section);
  }
  section.innerHTML = '<h3>Історія обробки</h3><p class="order-timeline-empty">Завантажуємо події…</p>';
  const { data: events, error } = await supabase.from('order_events').select('event_type,previous_value,next_value,summary,created_at').eq('order_id', Number(orderId)).order('created_at', { ascending: false });
  if (error) {
    section.innerHTML = '<h3>Історія обробки</h3><p class="order-timeline-empty">Журнал буде доступний після запуску міграції order-history-upgrade.sql.</p>';
    return;
  }
  section.innerHTML = '<h3>Історія обробки</h3>' + (events.length
    ? '<ul class="order-timeline-list">' + events.map(item => '<li class="order-timeline-item"><span class="order-timeline-dot"></span><div><b>' + escape(item.summary) + '</b><p>' + date(item.created_at) + ' · менеджер</p></div></li>').join('') + '</ul>'
    : '<p class="order-timeline-empty">Поки що немає зафіксованих змін.</p>');
};
const mountCurrentOrderTimeline = () => renderOrderTimeline(currentOrderIdFromDialog());
const orderDetailsObserver = new MutationObserver(() => {
  const orderId = currentOrderIdFromDialog();
  if (orderId) setTimeout(() => renderOrderTimeline(orderId), 0);
});
const orderDetailsNode = document.querySelector('#orderDetails');
if (orderDetailsNode) orderDetailsObserver.observe(orderDetailsNode, { childList: true });

// Фіксуємо зміну основного статусу лише після успішного оновлення в базі.
document.addEventListener('change', event => {
  const control = event.target.closest('[data-status-order]');
  if (!control) return;
  const orderId = Number(control.dataset.statusOrder);
  const order = state.orders.find(item => Number(item.id) === orderId);
  const previous = order?.status;
  const next = control.value;
  if (!previous || previous === next) return;
  setTimeout(async () => {
    const { data } = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle();
    if (!data || data.status !== next) return;
    const saved = await recordOrderEvent(orderId, 'status', previous, next, 'Статус: ' + (statusNames[previous] || previous) + ' → ' + (statusNames[next] || next));
    if (saved && currentOrderIdFromDialog() === orderId) renderOrderTimeline(orderId);
  }, 900);
});

// Фіксуємо збережені реквізити оплати і доставки.
document.addEventListener('click', event => {
  const button = event.target.closest('[data-save-operations]');
  if (!button) return;
  const orderId = Number(button.dataset.saveOperations);
  const before = state.orders.find(item => Number(item.id) === orderId) || {};
  const requested = {
    payment_status: document.querySelector('#paymentStatus')?.value || 'unpaid',
    payment_method: document.querySelector('#paymentMethod')?.value.trim() || '',
    delivery_method: document.querySelector('#deliveryMethod')?.value.trim() || '',
    tracking_number: document.querySelector('#trackingNumber')?.value.trim() || '',
    expected_delivery: document.querySelector('#expectedDelivery')?.value || ''
  };
  setTimeout(async () => {
    const { data } = await supabase.from('orders').select('payment_status,payment_method,delivery_method,tracking_number,expected_delivery').eq('id', orderId).maybeSingle();
    if (!data) return;
    const labels = { payment_status: 'Статус оплати', payment_method: 'Спосіб оплати', delivery_method: 'Спосіб доставки', tracking_number: 'Трек-номер', expected_delivery: 'Дата доставки' };
    const changes = Object.keys(requested).filter(key => String(data[key] || '') === String(requested[key] || '') && String(before[key] || '') !== String(data[key] || ''));
    if (!changes.length) return;
    const summary = changes.map(key => labels[key] + ': ' + (key === 'payment_status' ? (paymentStatusNames[data[key]] || data[key]) : data[key])).join('; ');
    const saved = await recordOrderEvent(orderId, 'operations', '', JSON.stringify(requested), summary);
    if (saved && currentOrderIdFromDialog() === orderId) renderOrderTimeline(orderId);
  }, 1100);
});

mountCurrentOrderTimeline();


// Швидкі дії менеджера у картці замовлення.
const orderQuickActionStyles = document.createElement('style');
orderQuickActionStyles.textContent = '.order-quick-actions{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}.order-quick-actions .button{min-height:38px;padding:8px 12px;font-size:13px;text-decoration:none}.order-quick-actions .button.primary{background:#cfff2e;border-color:#cfff2e;color:#102b28}';
document.head.append(orderQuickActionStyles);
const renderOrderQuickActions = () => {
  const details = document.querySelector('#orderDetails');
  const orderId = currentOrderIdFromDialog();
  const order = state.orders.find(item => Number(item.id) === orderId);
  if (!details || !order || details.querySelector('#orderQuickActions')) return;
  const phone = String(order.customer_phone || '').replace(/[^+\d]/g, '');
  const email = String(order.customer_email || '').trim();
  const emailLink = email ? '<a class="button outline" href="mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('Замовлення TECHNOROOM #' + order.id) + '">Написати email</a>' : '';
  const phoneLink = phone ? '<a class="button outline" href="tel:' + phone + '">Подзвонити</a>' : '';
  details.insertAdjacentHTML('afterbegin', '<div class="order-quick-actions" id="orderQuickActions">' + phoneLink + emailLink + '<button class="button outline" type="button" data-copy-order-contact="' + order.id + '">Копіювати контакти</button><button class="button primary" type="button" data-print-order="' + order.id + '">Друк замовлення</button></div>');
};
const quickActionsObserver = new MutationObserver(() => setTimeout(renderOrderQuickActions, 0));
if (document.querySelector('#orderDetails')) quickActionsObserver.observe(document.querySelector('#orderDetails'), { childList: true });

document.addEventListener('click', async event => {
  const copyButton = event.target.closest('[data-copy-order-contact]');
  if (copyButton) {
    const order = state.orders.find(item => Number(item.id) === Number(copyButton.dataset.copyOrderContact));
    if (!order) return;
    const contact = [order.customer_name, order.customer_phone, order.customer_email].filter(Boolean).join('\n');
    try { await navigator.clipboard.writeText(contact); notice('Контакти скопійовано.'); } catch (_) { notice('Не вдалося скопіювати контакти.', true); }
    return;
  }
  const printButton = event.target.closest('[data-print-order]');
  if (!printButton) return;
  const order = state.orders.find(item => Number(item.id) === Number(printButton.dataset.printOrder));
  if (!order) return;
  const printWindow = window.open('', '_blank', 'width=820,height=900');
  if (!printWindow) { notice('Браузер заблокував вікно друку. Дозвольте спливні вікна для сайту.', true); return; }
  printWindow.document.write('<!doctype html><title>Замовлення #' + order.id + '</title><style>body{font:15px/1.45 Arial,sans-serif;color:#172c29;padding:36px;max-width:740px;margin:auto}h1{font-size:30px;margin:0 0 8px}.muted{color:#63736e}table{border-collapse:collapse;width:100%;margin:24px 0}th,td{padding:10px;border-bottom:1px solid #dce2dc;text-align:left}th{text-transform:uppercase;font-size:12px;color:#63736e}.total{font-size:20px;font-weight:700;text-align:right}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:28px 0}.box{padding:16px;background:#f2f5ef}@media print{body{padding:0}}</style><h1>TECHNOROOM · Замовлення #' + order.id + '</h1><p class="muted">' + escape(date(order.created_at)) + '</p><div class="grid"><div class="box"><b>Покупець</b><br>' + escape(order.customer_name) + '<br>' + escape(order.customer_phone || '') + '<br>' + escape(order.customer_email || '') + '</div><div class="box"><b>Доставка</b><br>' + escape(order.city || '—') + '<br>' + escape(order.address || '—') + '</div></div><table><thead><tr><th>Товар</th><th>К-сть</th><th>Сума</th></tr></thead><tbody id="printItems"></tbody></table><p class="total">Разом: ' + money(order.total) + '</p>');
  const { data: items } = await supabase.from('order_items').select('product_name,quantity,unit_price').eq('order_id', order.id);
  const lines = (items || []).map(item => '<tr><td>' + escape(item.product_name) + '</td><td>' + Number(item.quantity) + '</td><td>' + money(Number(item.unit_price) * Number(item.quantity)) + '</td></tr>').join('') || '<tr><td colspan="3">Товари не знайдено</td></tr>';
  printWindow.document.querySelector('#printItems').innerHTML = lines;
  printWindow.document.write('<p class="muted">Статус: ' + escape(statusNames[order.status] || order.status) + '</p>');
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
});
renderOrderQuickActions();


// Масове керування товарами у каталозі.const bulkProductStyles = document.createElement('style');

const bulkProductStyles = document.createElement('style');

bulkProductStyles.textContent = `
.bulk-product-toolbar{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin:12px 0 0;
  padding:12px;
  background:#f2f5ef;
  border:1px solid #dce3da;
}

.bulk-product-toolbar strong{
  margin-right:6px;
  color:#102b28;
}

.bulk-product-toolbar select{
  min-width:190px;
}

.bulk-product-check{
  width:18px;
  height:18px;
}

.bulk-product-header{
  width:42px;
}

@media(max-width:700px){
  .bulk-product-toolbar{
    align-items:stretch;
  }

  .bulk-product-toolbar button,
  .bulk-product-toolbar select{
    width:100%;
  }
}
`;

document.head.append(bulkProductStyles);
const bulkProductIds = new Set();
const selectedBulkProductIds = () => [...bulkProductIds].map(Number).filter(Number.isFinite);
const updateBulkProductToolbar = () => {
  const count = selectedBulkProductIds().length;
  const countNode = document.querySelector('#bulkProductCount');
  if (countNode) countNode.textContent = 'Вибрано: ' + count;
  const visibleChecks = [...document.querySelectorAll('[data-bulk-product-check]')];
  const selectAll = document.querySelector('#bulkProductSelectAll');
  if (selectAll) {
    selectAll.checked = visibleChecks.length > 0 && visibleChecks.every(check => check.checked);
    selectAll.indeterminate = visibleChecks.some(check => check.checked) && !selectAll.checked;
  }
};
const mountBulkProductToolbar = () => {
  if (document.querySelector('#bulkProductToolbar')) return;

  const controls =
    document.querySelector('#productFilter')
      ?.closest('.admin-controls');

  if (!controls) return;

  const toolbar = document.createElement('div');

  toolbar.id = 'bulkProductToolbar';
  toolbar.className = 'bulk-product-toolbar';

  toolbar.innerHTML =
    '<strong id="bulkProductCount">Вибрано: 0</strong>' +
    '<button class="button outline" type="button" data-bulk-product-active="true">Опублікувати</button>' +
    '<button class="button outline" type="button" data-bulk-product-active="false">Приховати</button>' +
    '<select id="bulkProductCategory"><option value="">Перенести до категорії…</option></select>' +
    '<button class="button outline" type="button" data-bulk-product-category>Застосувати категорію</button>';

  controls.insertAdjacentElement(
    'afterend',
    toolbar
  );
};
const refreshBulkCategoryChoices = () => {
  const select = document.querySelector('#bulkProductCategory');
  if (!select) return;
  const selected = select.value;
  select.innerHTML = '<option value="">Перенести до категорії…</option>' + state.categories.filter(category => category.is_active).map(category => '<option value="' + escape(category.slug) + '">' + escape(category.parent_id ? '↳ ' : '') + escape(category.name) + '</option>').join('');
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
};
const enhanceProductBulkSelection = () => {
  mountBulkProductToolbar();
  refreshBulkCategoryChoices();
  const tbody = document.querySelector('#adminProducts');
  const table = tbody?.closest('table');
  const heading = table?.querySelector('thead tr');
  if (heading && !heading.querySelector('#bulkProductSelectAll')) {
    const cell = document.createElement('th');
    cell.className = 'bulk-product-header';
    cell.innerHTML = '<input class="bulk-product-check" id="bulkProductSelectAll" type="checkbox" aria-label="Вибрати усі видимі товари">';
    heading.prepend(cell);
  }
  if (!tbody) return;
  [...tbody.querySelectorAll('tr')].forEach(row => {
    if (row.querySelector('[data-bulk-product-check]')) return;
    const productName = row.querySelector('td b')?.textContent.trim();
    const product = state.products.find(item => item.name === productName);
    if (!product) return;
    const cell = document.createElement('td');
    cell.innerHTML = '<input class="bulk-product-check" type="checkbox" data-bulk-product-check="' + product.id + '" aria-label="Вибрати ' + escape(product.name) + '">';
    const check = cell.firstElementChild;
    check.checked = bulkProductIds.has(Number(product.id));
    row.prepend(cell);
  });
  updateBulkProductToolbar();
};
const applyBulkProductChange = async (payload, title) => {
  const ids = selectedBulkProductIds();
  if (!ids.length) { notice('Спочатку виберіть хоча б один товар.', true); return; }
  const { error } = await supabase.from('products').update(payload).in('id', ids);
  if (error) { notice('Не вдалося застосувати масову дію.', true); return; }
  state.products = state.products.map(product => ids.includes(Number(product.id)) ? { ...product, ...payload } : product);
  bulkProductIds.clear();
  renderAll();
  notice(title + ': ' + ids.length + '.');
};

document.addEventListener('change', event => {
  const check = event.target.closest('[data-bulk-product-check]');
  if (check) {
    const id = Number(check.dataset.bulkProductCheck);
    if (check.checked) bulkProductIds.add(id); else bulkProductIds.delete(id);
    updateBulkProductToolbar();
    return;
  }
  if (event.target.matches('#bulkProductSelectAll')) {
    const checked = event.target.checked;
    document.querySelectorAll('[data-bulk-product-check]').forEach(item => {
      item.checked = checked;
      const id = Number(item.dataset.bulkProductCheck);
      if (checked) bulkProductIds.add(id); else bulkProductIds.delete(id);
    });
    updateBulkProductToolbar();
  }
});
document.addEventListener('click', event => {
  const statusButton = event.target.closest('[data-bulk-product-active]');
  if (statusButton) {
    applyBulkProductChange({ is_active: statusButton.dataset.bulkProductActive === 'true' }, statusButton.dataset.bulkProductActive === 'true' ? 'Опубліковано товарів' : 'Приховано товарів');
    return;
  }
  if (event.target.closest('[data-bulk-product-category]')) {
    const category = document.querySelector('#bulkProductCategory')?.value;
    if (!category) { notice('Оберіть категорію для товарів.', true); return; }
    applyBulkProductChange({ category }, 'Оновлено категорію для товарів');
  }
});
const bulkProductObserver = new MutationObserver(() => setTimeout(enhanceProductBulkSelection, 0));
const bulkProductTable = document.querySelector('#adminProducts');
if (bulkProductTable) bulkProductObserver.observe(bulkProductTable, { childList: true });
setTimeout(enhanceProductBulkSelection, 0);


// Журнал змін товарів і контроль масової видимості.
const productEventStyle = document.createElement('style');
productEventStyle.textContent = '.product-events{margin:18px 0;padding:16px;border:1px solid #d9dfd6;background:#f8faf6}.product-events h3{margin:0 0 10px;font-size:16px}.product-events__row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px 0;border-top:1px solid #e1e6de;font-size:14px}.product-events__row:first-of-type{border-top:0}.product-events__date,.product-events__empty{color:#6f7e75;font-size:12px}.product-events__empty{margin:0;font-size:14px}';
document.head.append(productEventStyle);

const productEventTime = value => {
  try { return value ? new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : ''; }
  catch { return ''; }
};
const addProductEvent = async (productId, eventType, summary) => {
  const { data: auth } = await supabase.auth.getUser();
  if (!productId || !auth?.user?.id) return;
  await supabase.from('product_events').insert({ product_id: Number(productId), event_type: eventType, summary, actor_id: auth.user.id });
};
const showProductEvents = async productId => {
  const form = document.querySelector('#productForm');
  if (!form || !productId) return;
  let panel = form.querySelector('#productEvents');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'productEvents';
    panel.className = 'product-events';
    const actions = form.querySelector('.dialog-actions');
    if (actions) actions.before(panel); else form.append(panel);
  }
  panel.innerHTML = '<h3>Історія товару</h3><p class="product-events__empty">Завантаження журналу…</p>';
  const { data, error } = await supabase.from('product_events').select('summary,created_at').eq('product_id', Number(productId)).order('created_at', { ascending: false }).limit(12);
  if (error) {
    panel.innerHTML = '<h3>Історія товару</h3><p class="product-events__empty">Журнал буде доступний після запуску міграції <b>product-audit-upgrade.sql</b> у Supabase.</p>';
    return;
  }
  panel.innerHTML = '<h3>Історія товару</h3>';
  if (!data?.length) {
    const empty = document.createElement('p');
    empty.className = 'product-events__empty';
    empty.textContent = 'Поки що немає зафіксованих змін.';
    panel.append(empty);
    return;
  }
  data.forEach(item => {
    const row = document.createElement('div'); row.className = 'product-events__row';
    const summary = document.createElement('b'); summary.textContent = item.summary;
    const dateValue = document.createElement('span'); dateValue.className = 'product-events__date'; dateValue.textContent = productEventTime(item.created_at);
    row.append(summary, dateValue); panel.append(row);
  });
};

document.addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-product]');
  if (edit) setTimeout(() => showProductEvents(edit.dataset.editProduct), 120);
});

document.addEventListener('submit', event => {
  const form = event.target.closest('#productForm');
  if (!form) return;
  const fields = new FormData(form);
  const id = String(fields.get('id') || '').trim();
  const slug = String(fields.get('slug') || '').trim();
  const name = String(fields.get('name') || '').trim();
  const previous = id ? state.products.find(item => Number(item.id) === Number(id)) : null;
  setTimeout(async () => {
    let query = supabase.from('products').select('id,name,slug,is_active,category,price,availability_status,stock_quantity');
    query = id ? query.eq('id', Number(id)) : query.eq('slug', slug);
    const { data: saved } = await query.maybeSingle();
    if (!saved || (slug && saved.slug !== slug) || (name && saved.name !== name)) return;
    if (!previous) { await addProductEvent(saved.id, 'created', 'Створено товар'); return; }
    const changed = [];
    if (previous.name !== saved.name) changed.push('назву');
    if (previous.slug !== saved.slug) changed.push('URL');
    if (previous.category !== saved.category) changed.push('категорію');
    if (Number(previous.price) !== Number(saved.price)) changed.push('ціну');
    if (previous.availability_status !== saved.availability_status) changed.push('наявність');
    if (Number(previous.stock_quantity) !== Number(saved.stock_quantity)) changed.push('залишок');
    if (Boolean(previous.is_active) !== Boolean(saved.is_active)) changed.push('видимість');
    await addProductEvent(saved.id, changed.length === 1 && changed[0] === 'видимість' ? 'visibility' : 'updated', changed.length ? 'Оновлено: ' + changed.join(', ') : 'Збережено дані товару');
  }, 1300);
}, true);

document.addEventListener('click', event => {
  const action = event.target.closest('[data-bulk-product-active]');
  if (!action) return;
  const isActive = action.dataset.bulkProductActive === 'true';
  const ids = [...bulkProductIds].filter(id => {
    const product = state.products.find(item => Number(item.id) === Number(id));
    return product && Boolean(product.is_active) !== isActive;
  });
  if (!ids.length) return;
  setTimeout(async () => {
    const { data: products } = await supabase.from('products').select('id,is_active').in('id', ids);
    await Promise.all((products || []).filter(product => Boolean(product.is_active) === isActive).map(product => addProductEvent(product.id, 'visibility', isActive ? 'Опубліковано масово' : 'Приховано / архівовано масово')));
  }, 1300);
});


// ERC XML: локальний попередній перегляд та безпечний імпорт за SKU.
(() => {
  const ercState = { rows: [], selected: new Set() };
  const clean = (value = '') => String(value).replace(/\s+/g, ' ').trim();
  const sourceText = (node, tag) => node.querySelector(tag)?.textContent || '';
  const decodeHtml = (value = '') => {
    let text = String(value || '');
    for (let index = 0; index < 2; index += 1) {
      const area = document.createElement('textarea'); area.innerHTML = text;
      if (area.value === text) break;
      text = area.value;
    }
    return text;
  };
  const numeric = (value) => {
    const number = Number(String(value || '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, ''));
    return Number.isFinite(number) ? number : 0;
  };
  const stock = (value) => Number((String(value || '').match(/\d+/) || ['0'])[0]);
  const compactDescription = (markup) => {
    const documentMarkup = new DOMParser().parseFromString(decodeHtml(markup), 'text/html');
    return clean(documentMarkup.body.textContent).slice(0, 1600);
  };
  const extractSpecs = (markup) => {
    const documentMarkup = new DOMParser().parseFromString(decodeHtml(markup), 'text/html');
    const specs = {};
    documentMarkup.querySelectorAll('tr').forEach((row) => {
      const cells = [...row.querySelectorAll('th,td')].map((cell) => clean(cell.textContent)).filter(Boolean);
      if (cells.length >= 2 && cells[0].length < 120 && cells[1].length < 500) specs[cells[0]] = cells.slice(1).join(' ');
    });
    return specs;
  };
  const getImageLinks = (markup) => (decodeHtml(markup).match(/https?:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]+)?/gi) || []).filter((url) => !/ico-check|logo/i.test(url));
  const normalizeSku = (value = '') => clean(value).replace(/\*+$/g, '').toUpperCase();
  const displayName = (value = '') => clean(decodeHtml(value)).replace(/&quot;/g, '"');
  const deriveBrand = (name, vendor) => {
    const first = displayName(name).split(/\s+/)[0].replace(/[^\w&+.-]/g, '');
    if (first.length > 1 && first.length <= 30) return first;
    return clean(vendor).replace(/\s+(projectors|supplies|peripherals)$/i, '').slice(0, 100) || null;
  };
  const isAccessory = (value) => /(кріпл|ламп|оптик|аксесуар|модул|чохол|кабел|пульт)/i.test(value);
  const classify = (value) => {
    if (isAccessory(value)) return '';
    if (/(проєктор|проектор|проекційн|projector)/i.test(value)) return /екран/i.test(value) ? 'screen' : 'projector';
    if (/(акуст|саундбар|колонк|аудіо)/i.test(value)) return 'audio';
    if (/телевізор/i.test(value)) return 'tv';
    return '';
  };
  const mappedCategory = (row) => {
    const haystack = (row.source + ' ' + row.name + ' ' + row.description).toLowerCase();
    const bySlug = (slug) => state.categories.find((item) => item.slug === slug)?.slug;
    const byName = (pattern) => state.categories.find((item) => pattern.test(item.name))?.slug;
    const projectorRoot = () => bySlug('projector') || byName(/проєктор|проектор/i);
    if (row.kind === 'projector') {
      if (/лазер|laser/.test(haystack)) return bySlug('laser-proj') || byName(/лазер/i) || projectorRoot();
      if (/короткофокус|short\s*throw/.test(haystack)) return bySlug('short-throw-projectors') || projectorRoot();
      if (/домашн|home\s*(cinema|theater)/.test(haystack)) return bySlug('home-projectors') || projectorRoot();
      if (/інсталяційн|installation/.test(haystack)) return bySlug('installation-projectors') || projectorRoot();
      if (/універсальн|universal/.test(haystack)) return bySlug('universal-projectors') || projectorRoot();
      return projectorRoot();
    }
    if (row.kind === 'screen') return bySlug('projection-screens') || byName(/екран/i) || projectorRoot();
    if (row.kind === 'audio') return bySlug('audio') || byName(/акуст|звук/i);
    if (row.kind === 'tv') return bySlug('tv') || byName(/телевізор/i);
    return null;
  };
  const scopes = { all: 'Усі підтримувані', projector: 'Проєктори та екрани', audio: 'Акустика й звук', tv: 'Телевізори' };
  const currentScopeRows = () => {
    const scope = document.querySelector('#ercImportScope')?.value || 'all';
    return ercState.rows.filter((row) => scope === 'all' || (scope === 'projector' ? ['projector', 'screen'].includes(row.kind) : row.kind === scope));
  };
  const currentPageRows = () => currentScopeRows().slice(0, Math.max(1, Math.min(100, Number(document.querySelector('#ercImportLimit')?.value || 50))));
  const importStatus = (message, error = false) => {
    const node = document.querySelector('#ercImportMessage'); if (!node) return;
    node.textContent = message; node.hidden = false; node.classList.toggle('error', error);
  };
  const existingBySku = () => new Map(state.products.filter((item) => item.sku).map((item) => [normalizeSku(item.sku), item]));
  function renderErcPreview() {
    const body = document.querySelector('#ercImportRows'); const summary = document.querySelector('#ercImportSummary');
    if (!body || !summary) return;
    const rows = currentPageRows(); const allRows = currentScopeRows(); const existing = existingBySku();
    summary.textContent = ercState.rows.length ? 'У вибраній групі: ' + allRows.length + '. Показано: ' + rows.length + '. Позначено: ' + ercState.selected.size + '.' : 'Оберіть XML-файл, щоб побачити товари.';
    body.innerHTML = rows.length ? rows.map((row) => {
      const current = existing.get(row.sku); const status = current ? 'Оновлення ціни, залишку й категорії' : 'Нова чернетка';
      const mapped = mappedCategory(row);
      const disabled = !mapped || !row.sku || !row.price;
      const detail = row.images.length ? 'У джерелі є фото: ' + row.images.length : 'Фото у джерелі не знайдено';
      return '<tr><td><input type="checkbox" data-erc-select="' + escape(row.key) + '" ' + (ercState.selected.has(row.key) ? 'checked ' : '') + (disabled ? 'disabled' : '') + '></td><td><b>' + escape(row.name) + '</b><small>' + escape(row.vendor) + ' · ' + escape(row.sourceCategory) + '</small></td><td>' + escape(row.sku) + '</td><td>' + escape(mapped ? (state.categories.find((item) => item.slug === mapped)?.name || mapped) : 'Немає зіставлення') + '<small>' + escape(detail) + '</small></td><td>' + money(row.price) + '<small>залишок: ' + escape(row.stockRaw || '0') + '</small></td><td><span class="visibility ' + (current ? 'visible' : 'hidden-status') + '">' + status + '</span></td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="6">За цим фільтром даних немає</td></tr>';
  }
  function parseErcFile(text) {
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('XML має помилку структури.');
    const rows = [];
    xml.querySelectorAll('vendor > goods').forEach((goods, index) => {
      const vendor = goods.parentElement?.getAttribute('name') || 'Постачальник ERC';
      const name = displayName(sourceText(goods, 'gname')); const sku = normalizeSku(sourceText(goods, 'code'));
      const sourceCategory = clean(sourceText(goods, 'category')); const subcategory = clean(sourceText(goods, 'subcategory'));
      const source = sourceCategory + ' · ' + subcategory;
      const comment = sourceText(goods, 'comment'); const shortDescription = sourceText(goods, 'a_desc');
      const description = compactDescription(shortDescription) || compactDescription(comment);
      const kind = classify(source + ' ' + name);
      const price = numeric(sourceText(goods, 'rprice'));
      if (!kind || !name || !sku || !price) return;
      rows.push({ key: sku + '-' + index, vendor: clean(vendor), name, sku, source, sourceCategory, subcategory, kind, price, stockRaw: clean(sourceText(goods, 'stock')), stock: stock(sourceText(goods, 'stock')), description, specifications: extractSpecs(comment), images: getImageLinks(comment) });
    });
    ercState.rows = rows; ercState.selected.clear();
  }
  const uniqueSlug = (name, sku, used) => {
    const root = productSlug(name) || 'erc-' + sku.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let slug = root; let number = 2;
    while (used.has(slug)) { slug = root + '-' + number; number += 1; }
    used.add(slug); return slug;
  };
  async function importSelected() {
    const chosen = ercState.rows.filter((row) => ercState.selected.has(row.key));
    if (!chosen.length) return importStatus('Позначте хоча б один товар для імпорту.', true);
    if (chosen.length > 100) return importStatus('За один раз можна імпортувати до 100 товарів.', true);
    const existing = existingBySku(); const usedSlugs = new Set(state.products.map((item) => item.slug).filter(Boolean));
    const newRows = []; const updates = []; const content = document.querySelector('#ercImportContent').checked;
    chosen.forEach((row) => {
      const category = mappedCategory(row); if (!category) return;
      const present = existing.get(row.sku);
      if (present) {
        const payload = { category, price: row.price, stock_quantity: row.stock, in_stock: row.stock > 0, availability_status: row.stock > 0 ? 'in_stock' : 'out_of_stock' };
        if (content && (row.description || Object.keys(row.specifications).length)) { payload.description = row.description || present.description; payload.specifications = Object.keys(row.specifications).length ? row.specifications : present.specifications; }
        updates.push({ id: present.id, payload });
      } else {
        newRows.push({ name: row.name, slug: uniqueSlug(row.name, row.sku, usedSlugs), sku: row.sku, brand: deriveBrand(row.name, row.vendor), category, price: row.price, stock_quantity: row.stock, in_stock: row.stock > 0, availability_status: row.stock > 0 ? 'in_stock' : 'out_of_stock', description: row.description || null, specifications: row.specifications, image_path: null, is_active: false });
      }
    });
    if (!newRows.length && !updates.length) return importStatus('Не знайдено товарів із налаштованою категорією.', true);
    const button = document.querySelector('#ercImportApply'); button.disabled = true; button.textContent = 'Імпорт…';
    let created = 0; let updated = 0; const failures = [];
    for (let start = 0; start < newRows.length; start += 25) {
      const batch = newRows.slice(start, start + 25); const { error } = await supabase.from('products').insert(batch);
      if (!error) { created += batch.length; continue; }
      for (const product of batch) { const attempt = await supabase.from('products').insert(product); if (attempt.error) failures.push(product.sku); else created += 1; }
    }
    for (const item of updates) { const { error } = await supabase.from('products').update(item.payload).eq('id', item.id); if (error) failures.push('#' + item.id); else updated += 1; }
    await loadData(); ercState.selected.clear(); renderErcPreview();
    button.disabled = false; button.textContent = 'Імпортувати позначені';
    importStatus('Готово: створено чернеток — ' + created + ', оновлено — ' + updated + (failures.length ? '. Не вдалося: ' + failures.join(', ') : '') + '. Фото не імпортувалися: зовнішні посилання залишилися лише у джерелі.', Boolean(failures.length));
  }
  function mountErcImport() {
    const anchor = document.querySelector('#products'); if (!anchor || document.querySelector('#ercImport')) return;
    anchor.insertAdjacentHTML('afterend', [
      '<section class="admin-section" id="ercImport">',
      '<div class="admin-title"><div><h2>Імпорт ERC XML</h2><span>Ціни, залишки, описи й характеристики за SKU</span></div></div>',
      '<p class="recovery-help">Нові позиції створюються прихованими чернетками. Зовнішні фото не копіюються на сайт автоматично.</p>',
      '<div class="admin-controls"><input id="ercImportFile" type="file" accept=".xml,application/xml,text/xml"><select id="ercImportScope"><option value="all">Усі підтримувані категорії</option><option value="projector">Проєктори та екрани</option><option value="audio">Акустика й звук</option><option value="tv">Телевізори</option></select><input id="ercImportLimit" type="number" min="1" max="100" value="50" title="Скільки товарів показати"></div>',
      '<div class="admin-controls"><button class="button outline" type="button" id="ercImportSelectNew">Позначити нові на сторінці</button><button class="button outline" type="button" id="ercImportClear">Очистити вибір</button><label class="check"><input id="ercImportContent" type="checkbox"> Оновлювати опис і характеристики наявних товарів</label><button class="button primary" type="button" id="ercImportApply">Імпортувати позначені</button></div>',
      '<p class="admin-message" id="ercImportMessage" hidden></p><p class="recovery-help" id="ercImportSummary">Оберіть XML-файл, щоб побачити товари.</p>',
      '<div class="admin-table-wrap"><table><thead><tr><th></th><th>Товар / джерело</th><th>SKU</th><th>Категорія / медіа</th><th>Ціна / залишок</th><th>Дія</th></tr></thead><tbody id="ercImportRows"></tbody></table></div></section>'
    ].join(''));
    const section = document.querySelector('#ercImport');
    document.querySelector('.admin-nav').insertAdjacentHTML('beforeend', '<a href="#ercImport">Імпорт ERC XML</a>');
    document.querySelector('#ercImportFile').addEventListener('change', async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      importStatus('Читаю ' + file.name + ' (' + Math.round(file.size / 1024 / 1024) + ' МБ)…');
      try { await new Promise((resolve) => setTimeout(resolve, 40)); parseErcFile(await file.text()); importStatus('Файл прочитано. Знайдено ' + ercState.rows.length + ' товарів у підтримуваних категоріях.'); renderErcPreview(); } catch (error) { ercState.rows = []; renderErcPreview(); importStatus(error.message || 'Не вдалося прочитати XML.', true); }
    });
    section.addEventListener('input', (event) => { if (event.target.matches('#ercImportLimit')) renderErcPreview(); });
    section.addEventListener('change', (event) => { if (event.target.matches('#ercImportScope')) renderErcPreview(); if (event.target.matches('[data-erc-select]')) { event.target.checked ? ercState.selected.add(event.target.dataset.ercSelect) : ercState.selected.delete(event.target.dataset.ercSelect); renderErcPreview(); } });
    document.querySelector('#ercImportSelectNew').onclick = () => { const existing = existingBySku(); currentPageRows().forEach((row) => { if (!existing.has(row.sku) && mappedCategory(row)) ercState.selected.add(row.key); }); renderErcPreview(); };
    document.querySelector('#ercImportClear').onclick = () => { ercState.selected.clear(); renderErcPreview(); };
    document.querySelector('#ercImportApply').onclick = importSelected;
  }
  mountErcImport();
})();
