// Presentation only: never changes product data, prices, stock or cart handlers.
export function productSectionNavigation(hasDescription) {
  return '<nav class="product-section-nav" aria-label="Розділи товару">'
    + (hasDescription ? '<a href="#product-description">Опис</a>' : '')
    + '<a href="#product-specifications">Характеристики</a>'
    + '<a href="#product-delivery">Доставка й оплата</a>'
    + '<a href="#product-warranty">Гарантія</a></nav>';
}

export function productServiceSections() {
  return '<div class="product-information-grid">'
    + '<section class="product-information-card" id="product-delivery" tabindex="-1" aria-labelledby="product-delivery-title"><h2 id="product-delivery-title">Доставка й оплата</h2><p>Перегляньте доступні способи доставки та оплати перед оформленням замовлення.</p><a href="delivery.html">Умови доставки й оплати →</a></section>'
    + '<section class="product-information-card" id="product-warranty" tabindex="-1" aria-labelledby="product-warranty-title"><h2 id="product-warranty-title">Гарантія</h2><p>Щоб уточнити строк та умови гарантії саме на цей товар, зверніться до нашого менеджера.</p><a href="contacts.html">Уточнити умови гарантії →</a><a href="returns.html">Обмін і повернення →</a></section></div>';
}

export function compactProductHeader(scrollY, compact = false) {
  // Hysteresis prevents the shorter header from oscillating around a threshold.
  return compact ? scrollY > 80 : scrollY > 180;
}

export function productSectionOffset(headerHeight, navHeight) {
  return Math.ceil(Math.max(0, headerHeight) + Math.max(0, navHeight) + 20);
}

const mountedRoots = new WeakMap();
const hashHandled = new WeakSet();
export function mountProductPageLayout(root, {win = window, doc = document} = {}) {
  mountedRoots.get(root)?.();
  const header = doc.querySelector('.store-shared-header');
  const nav = root.querySelector('.product-section-nav');
  if (!header || !nav) return () => {};
  const body = doc.body;
  body.classList.add('product-layout-page');
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const sections = links.map(link => doc.getElementById(link.hash.slice(1))).filter(Boolean);
  let frame = 0;
  let compact = body.classList.contains('product-header-compact');
  const measure = () => {
    compact = compactProductHeader(win.scrollY, compact);
    body.classList.toggle('product-header-compact', compact);
    const headerHeight = header.getBoundingClientRect().height;
    const navHeight = nav.getBoundingClientRect().height;
    body.style.setProperty('--product-header-height', Math.ceil(headerHeight) + 'px');
    body.style.setProperty('--product-section-offset', productSectionOffset(headerHeight, navHeight) + 'px');
    const offset = productSectionOffset(headerHeight, navHeight);
    let active = sections[0];
    let activeTop = -Infinity;
    for (const section of sections) {
      const top = section.getBoundingClientRect().top;
      // Delivery and warranty share a desktop row: preserve the clicked target
      // instead of always highlighting whichever card occurs last in the DOM.
      if (top <= offset + 4 && (top > activeTop + 1 || '#' + section.id === win.location.hash)) {
        active = section;
        activeTop = top;
      }
    }
    for (const link of links) {
      if (link.hash === '#' + active?.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };
  const schedule = () => {
    if (!frame) frame = win.requestAnimationFrame(() => { frame = 0; measure(); });
  };
  const navigate = (target, {updateHistory = false, focus = false, instant = false} = {}) => {
    const absoluteTop = target.getBoundingClientRect().top + win.scrollY;
    if (absoluteTop > 180) {
      compact = true;
      body.classList.add('product-header-compact');
    }
    // Measure after compacting, before computing the anchor's final position.
    const headerHeight = header.getBoundingClientRect().height;
    const navHeight = nav.getBoundingClientRect().height;
    body.style.setProperty('--product-header-height', Math.ceil(headerHeight) + 'px');
    body.style.setProperty('--product-section-offset', productSectionOffset(headerHeight, navHeight) + 'px');
    if (updateHistory) win.history.pushState(null, '', '#' + target.id);
    const reduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    win.scrollTo({top: Math.max(0, target.getBoundingClientRect().top + win.scrollY - productSectionOffset(headerHeight, navHeight)), behavior: reduced || instant ? 'instant' : 'smooth'});
    if (focus) target.focus({preventScroll: true});
    schedule();
  };
  const click = event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || !nav.contains(link) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = sections.find(section => '#' + section.id === link.hash);
    if (!target) return;
    event.preventDefault();
    navigate(target, {updateHistory: true, focus: true});
  };
  const hashChange = () => {
    const target = sections.find(section => '#' + section.id === win.location.hash);
    if (target) navigate(target);
  };
  // Images above a deep-linked table can load later and move its heading.
  // Keep only the initial anchor aligned until the visitor starts interacting.
  let initialTarget = !hashHandled.has(root) ? sections.find(section => '#' + section.id === win.location.hash) : null;
  const releaseInitial = () => { initialTarget = null; };
  const imageLoaded = event => {
    if (initialTarget && event.target.tagName === 'IMG' && event.target.getBoundingClientRect().top < initialTarget.getBoundingClientRect().top) navigate(initialTarget,{instant:true});
  };
  root.addEventListener('load',imageLoaded,true);
  for (const type of ['pointerdown','wheel','touchstart','keydown']) win.addEventListener(type,releaseInitial,{passive:true});
  nav.addEventListener('click', click);
  win.addEventListener('scroll', schedule, {passive: true});
  win.addEventListener('resize', schedule);
  win.addEventListener('hashchange', hashChange);
  const observer = win.ResizeObserver ? new win.ResizeObserver(schedule) : null;
  observer?.observe(header);
  observer?.observe(nav);
  measure();
  if (!hashHandled.has(root)) {
    hashHandled.add(root);
    hashChange();
  }
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    nav.removeEventListener('click', click);
    win.removeEventListener('scroll', schedule);
    win.removeEventListener('resize', schedule);
    win.removeEventListener('hashchange', hashChange);
    observer?.disconnect();
    root.removeEventListener('load',imageLoaded,true);
    for (const type of ['pointerdown','wheel','touchstart','keydown']) win.removeEventListener(type,releaseInitial);
    if (frame) win.cancelAnimationFrame(frame);
    mountedRoots.delete(root);
  };
  mountedRoots.set(root, cleanup);
  return cleanup;
}
