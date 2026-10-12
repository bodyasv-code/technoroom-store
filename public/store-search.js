export const normalizeSearch = (value = '') => String(value).normalize('NFKC')
  .toLocaleLowerCase('uk-UA').replace(/є/g, 'е')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const compact = value => normalizeSearch(value).replace(/ /g, '');

export function searchScore(product, query) {
  const term = normalizeSearch(query);
  if (!term) return 0;
  const name = normalizeSearch(product.name), sku = normalizeSearch(product.sku);
  const brand = normalizeSearch(product.brand);
  const haystack = [name, sku, brand, normalizeSearch(product.description)].join(' ');
  const model = compact(product.name), code = compact(product.sku), wanted = compact(term);
  const exactCode = Boolean(code && code === wanted);
  if (!exactCode && !term.split(' ').every(word => haystack.includes(word)
    || code.includes(word) || model.includes(word))) return -1;
  return (exactCode ? 1000 : 0) + (name === term ? 500 : 0)
    + (code && code.startsWith(wanted) ? 200 : 0)
    + (name.startsWith(term) ? 100 : 0)
    + term.split(' ').reduce((score, word) => score + (name.includes(word) ? 30 : 0)
      + (brand === word ? 20 : 0) + (sku.includes(word) ? 40 : 0), 0);
}

export function findSearchProducts(products, query) {
  return products.filter(product => !product.parentProductId)
    .map(product => ({product, score:searchScore(product, query)}))
    .filter(row => row.score >= 0).sort((left, right) => right.score - left.score)
    .map(row => row.product);
}

const instances = new WeakMap();
export function attachStoreSearch(input, button, options) {
  if (!input) return;
  if (instances.has(input)) {
    const existing = instances.get(input); existing.options = options;
    if (document.activeElement === input) existing.refresh();
    return;
  }
  const state = {options, active:-1, sequence:0};
  instances.set(input, state);
  const wrapper = input.parentElement;
  wrapper.classList.add('store-search-wrap');
  const panel = document.createElement('div');
  panel.className = 'store-search-panel'; panel.hidden = true;
  panel.id = input.id + '-suggestions';
  const status = document.createElement('span');
  status.className = 'store-search-status'; status.setAttribute('role', 'status');
  wrapper.append(panel, status);
  input.setAttribute('aria-label', 'Пошук товарів за назвою, моделлю або артикулом');
  input.setAttribute('aria-controls', panel.id);
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('autocomplete', 'off');
  const initialQuery = new URLSearchParams(location.search).get('search');
  if (initialQuery && !input.value) input.value = initialQuery;
  if (button) button.setAttribute('aria-label', 'Знайти товари');
  const close = () => {state.sequence += 1; panel.hidden = true; input.setAttribute('aria-expanded', 'false'); state.active = -1;};
  const run = () => {
    const url = new URL('catalog.html', location.href);
    const query = input.value.trim(); if (query) url.searchParams.set('search', query);
    location.href = url.href;
  };
  const render = async () => {
    const sequence = ++state.sequence;
    const query = input.value.trim();
    if (normalizeSearch(query).length < 2) {close(); status.textContent = ''; return;}
    const {products, escape, image, price, availability, text, categories, lookup} = state.options;
    let sourceProducts = products(), remote = false;
    if (lookup) {
      try {
        const request = lookup(query);
        panel.innerHTML = '<div class="store-search-empty">Шукаємо товари…</div>';
        panel.hidden = false; input.setAttribute('aria-expanded', 'true'); state.active = -1;
        const rows = await request;
        if (sequence !== state.sequence) return;
        if (rows) {sourceProducts = rows; remote = true;}
      } catch {
        if (sequence !== state.sequence) return;
        panel.innerHTML = '<div class="store-search-empty">Не вдалося завантажити підказки. Натисніть Enter, щоб відкрити пошук у каталозі.</div>';
        return;
      }
    }
    const all = findSearchProducts(sourceProducts.map(product => ({...product,
      name:text(product.name), brand:text(product.brand), description:text(product.description)})), query);
    const matches = all.slice(0, 6);
    const categoryMatches = (categories?.() || []).filter(category => normalizeSearch(query).split(' ')
      .every(word => normalizeSearch(text(category.name) + ' ' + category.slug).includes(word))).slice(0, 4);
    panel.innerHTML = '<div class="store-search-heading"><b>' + (all.length ? (remote ? 'Підказки пошуку' : 'Знайдено товарів: ' + all.length) : 'Товарів не знайдено')
      + '</b><small>Назва · модель · артикул</small></div>'
      + (categoryMatches.length ? '<div class="store-search-categories">' + categoryMatches.map(category =>
        '<a href="catalog.html?category=' + encodeURIComponent(category.slug) + '">' + escape(text(category.name)) + '</a>').join('') + '</div>' : '')
      + (matches.length ? matches.map(product => {
        const source = image(product), stock = availability(product);
        return '<a class="store-search-item" href="product.html?id=' + encodeURIComponent(product.id) + '">'
          + '<span class="store-search-image">' + (source ? '<img src="' + escape(source) + '" alt="" loading="lazy">' : 'TR') + '</span>'
          + '<span class="store-search-copy"><b>' + escape(product.name) + '</b><small>'
          + escape(text(product.brand) || 'TECHNOROOM') + (product.sku ? ' · Арт. ' + escape(product.sku) : '')
          + '</small><span class="store-search-stock' + (!stock.orderable ? ' is-unavailable' : '') + '">' + escape(stock.label) + '</span></span>'
          + '<strong class="store-search-price">' + (Number(product.price) > 0 ? price(product.price) : 'Ціну уточнюйте') + '</strong></a>';
      }).join('') : '<div class="store-search-empty"><b>Не знайшли «' + escape(query) + '»</b><p>Спробуйте коротшу назву, модель або артикул з упаковки. Наприклад: Epson, MF664Cdw чи 6928C008.</p></div>')
      + '<button class="store-search-all" type="button">' + (all.length ? 'Усі результати пошуку →' : 'Відкрити пошук у каталозі →') + '</button>';
    panel.querySelector('button').addEventListener('click', run);
    panel.hidden = false; input.setAttribute('aria-expanded', 'true'); state.active = -1;
    status.textContent = all.length ? 'Знайдено товарів: ' + all.length + '. Стрілка вниз — вибрати підказку.' : 'Товарів не знайдено. Спробуйте модель або артикул.';
  };
  state.refresh = render;
  document.addEventListener('technoroom:catalog-ready', () => {if (document.activeElement === input) render();});
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    close();
    debounce = setTimeout(render, 160);
  });
  input.addEventListener('focus', render);
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {clearTimeout(debounce); close(); return;}
    if (event.key === 'ArrowDown' && panel.hidden) render();
    const links = [...panel.querySelectorAll('.store-search-item')];
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !panel.hidden && links.length) {
      event.preventDefault();
      state.active = event.key === 'ArrowDown' ? (state.active + 1) % links.length : (state.active <= 0 ? links.length - 1 : state.active - 1);
      links.forEach((link, index) => link.classList.toggle('is-active', index === state.active));
      links[state.active].scrollIntoView({block:'nearest'});
      status.textContent = links[state.active].textContent;
    }
    if (event.key === 'Enter') {
      clearTimeout(debounce);
      event.preventDefault();
      if (!panel.hidden && state.active >= 0 && links[state.active]) location.href = links[state.active].href;
      else run();
    }
  });
  wrapper.addEventListener('focusout', event => {if (!wrapper.contains(event.relatedTarget)) {clearTimeout(debounce); close();}});
  document.addEventListener('pointerdown', event => {if (!wrapper.contains(event.target)) {clearTimeout(debounce); close();}});
  if (button) button.onclick = run;
}
