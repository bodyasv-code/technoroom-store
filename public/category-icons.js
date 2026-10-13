// Decorative, code-native icons: no external downloads or category data changes.
const drawings = {
  projector: '<rect x="3" y="8" width="26" height="16" rx="4"/><circle cx="23" cy="16" r="4"/><path d="M7 13h5m-5 4h5M8 24v3m16-3v3"/>',
  printer: '<path d="M9 11V4h14v7M9 24H5V11h22v13h-4M9 19h14v9H9zM9 8h14M7 15h2M12 23h8"/>',
  audio: '<path d="M5 18v-4a11 11 0 0 1 22 0v4M5 17h4v11H6a3 3 0 0 1-3-3v-5a3 3 0 0 1 2-3Zm22 0h-4v11h3a3 3 0 0 0 3-3v-5a3 3 0 0 0-2-3Z"/>',
  ink: '<path d="M10 4h12v5H10zM8 9h16v19H8zM8 13h16M16 16s-4 4-4 6a4 4 0 0 0 8 0c0-2-4-6-4-6Z"/>',
  appliance: '<rect x="6" y="3" width="20" height="26" rx="3"/><path d="M6 10h20M10 7h4m7 0h1"/><circle cx="16" cy="19" r="6"/><path d="M11 20c3-3 7 3 10 0"/>',
  service: '<path d="M19 5a7 7 0 0 0-8 9L4 21a4 4 0 0 0 6 6l7-7a7 7 0 0 0 9-8l-5 5-6-6 4-6Z"/>',
  display: '<rect x="3" y="5" width="26" height="19" rx="2"/><path d="M12 29h8m-4-5v5M7 20h18"/>',
  mount: '<path d="M5 4v24M5 9h7v7h8v7h7M24 18h5v10h-5M8 6v6M17 13v6"/>',
  power: '<rect x="4" y="8" width="23" height="18" rx="3"/><path d="M27 13h2v8h-2M18 11l-7 8h5l-3 5 8-9h-5l2-4Z"/>',
  solar: '<path d="M6 13h20l3 13H3l3-13ZM12 13l-1 13m9-13 1 13M5 19h22M16 26v4m-5 0h10M16 2v2M7 5l2 2m16-2-2 2"/><path d="M12 9a4 4 0 0 1 8 0"/>',
  electrical: '<path d="M11 3v7m10-7v7M8 10h16v4a8 8 0 0 1-16 0v-4Zm8 12v7"/>',
  phone: '<rect x="9" y="2" width="14" height="28" rx="3"/><path d="M13 6h6m-4 20h2"/>',
  laptop: '<rect x="6" y="5" width="20" height="17" rx="2"/><path d="M6 22l-4 5h28l-4-5M13 25h6"/>',
  memory: '<rect x="3" y="9" width="26" height="14" rx="2"/><path d="M7 23v4m5-4v4m5-4v4m5-4v4m5-4v4M7 13h6v6H7zm12 0h6v6h-6z"/>',
  grid: '<rect x="4" y="4" width="9" height="9" rx="2"/><rect x="19" y="4" width="9" height="9" rx="2"/><rect x="4" y="19" width="9" height="9" rx="2"/><rect x="19" y="19" width="9" height="9" rx="2"/>',
};

const slugs = {
  'cat-projectors': 'projector', 'office-equipment': 'printer',
  'office-consumables': 'ink', 'cat-audio': 'audio', 'cat-displays': 'display',
  'cat-accessories': 'mount', 'cat-power': 'power', 'cat-solar': 'solar',
  'cat-electrical': 'electrical',
};

export function categoryIconKind(category = {}) {
  if (slugs[category.slug]) return slugs[category.slug];
  const name = String(category.name || '').toLowerCase();
  // Specific categories precede broader equipment/compatibility words.
  if (/витратн|картридж|тонер|чорнил|термоетикет/.test(name)) return 'ink';
  if (/кріплен|аксесуар/.test(name)) return 'mount';
  if (/про[єе]ктор|про[єе]кційн/.test(name)) return 'projector';
  if (/оргтех|принтер|бфп|сканер|копір/.test(name)) return 'printer';
  if (/акустик|звук|навушник|аудіо|audio/.test(name)) return 'audio';
  if (/оперативн.*пам|\bram\b/.test(name)) return 'memory';
  if (/automation/.test(name)) return 'electrical';
  if (/побут|пральн|холодильник/.test(name)) return 'appliance';
  if (/послуг|ремонт|сервіс/.test(name)) return 'service';
  if (/телевізор|монітор|диспле/.test(name)) return 'display';
  if (/сонячн/.test(name)) return 'solar';
  if (/живлен|зарядн|акумулятор|батаре/.test(name)) return 'power';
  if (/електротех/.test(name)) return 'electrical';
  if (/смартфон|планшет|телефон/.test(name)) return 'phone';
  if (/ноутбук|комп.?ютер/.test(name)) return 'laptop';
  return 'grid';
}

export function categoryIcon(category) {
  return `<svg class="category-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${drawings[categoryIconKind(category)]}</svg>`;
}
