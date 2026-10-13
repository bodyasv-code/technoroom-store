// Conservative presentation repair; original supplier detail strings remain.
export function isPrinterDevice(product = {}) {
  const name = String(product.name || '').trim();
  if (/^(?:картридж|тонер|чорнил|фотобарабан|стрічка|комплект|папір|термоетикет)/iu.test(name)) return false;
  return /^(?:принтер|бфп|багатофункціональн|printer|mfp)(?=\s|$)/iu.test(name)
    || /^office-(?:printers|mfp)(?:-|$)|^office-wide-format$/iu.test(String(product.category || product.type || ''));
}

export function printerDisplayEntries(entries) {
  const labels = {'дозвіл':'Роздільна здатність', 'windows':'Сумісність з ОС (деталі)'};
  const result = entries.map(([key, value]) => {
    let label = labels[String(key).toLowerCase()] || key;
    if (/^wi[‑-]?fi$/iu.test(key) && String(value).length > 60) label = 'Мережеві функції (деталі)';
    return [label, value];
  });
  const add = (key, value) => {
    if (value && !result.some(([k]) => String(k).toLowerCase() === key.toLowerCase())) result.push([key, value.trim()]);
  };
  for (const [originalKey, raw] of entries) {
    const text = String(raw);
    const duplex = /(?:^|[\s;)])Дуплекс\s*:\s*(так|ні)(?:\s*,\s*(звичайний папір))?(?=\s|$|[.;)])/iu.exec(text);
    if (duplex) add('Дуплекс', duplex[1].toLowerCase() === 'так' ? 'Так' + (duplex[2] ? ', ' + duplex[2] : '') : 'Ні');
    const scan = /Сканер\s*\(швидкість\s*:\s*(.{1,180}?\([^()]*\))(?=\s*(?:$|[.;]|[А-ЯІЇЄA-Z][\p{L} ]{2,}:))/u.exec(text);
    if (scan) add('Швидкість сканування', scan[1]);
    const flatbed = /Планшет\s*:\s*((?:A\d|Letter)(?:\s*\/\s*(?:A\d|Letter))*\s*\(\d+\s*[xх×]\s*\d+\s*мм\))/iu.exec(text);
    if (flatbed) add('Формат сканування (планшет)', flatbed[1]);
    if (/^(?:Windows|Сумісність з ОС \(деталі\))$/iu.test(originalKey)) {
      const systems = ['Windows', 'macOS', 'Chrome OS'].filter(system => system === 'Windows' || text.toLowerCase().includes(system.toLowerCase()));
      if (systems.length) add('Операційні системи', systems.join(', '));
    }
  }
  return result;
}
