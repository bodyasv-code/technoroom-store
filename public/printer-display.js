import {duplexKey, duplexLabels, printerDuplexMode} from './printer-duplex.js?v=20261016-duplex';
// Conservative presentation repair; original supplier detail strings remain.
export function isPrinterDevice(product = {}) {
  const name = String(product.name || '').trim();
  if (/^(?:картридж|тонер|чорнил|фотобарабан|стрічка|комплект|папір|термоетикет)/iu.test(name)) return false;
  return /^(?:принтер|бфп|багатофункціональн|printer|mfp)(?=\s|$)/iu.test(name)
    || /^office-(?:printers|mfp)(?:-|$)|^office-wide-format$/iu.test(String(product.category || product.type || ''));
}

export function printerDisplayEntries(entries, description = '') {
  const labels = {'дозвіл':'Роздільна здатність', 'windows':'Сумісність з ОС (деталі)'};
  const result = entries.map(([key, value]) => {
    let label = labels[String(key).toLowerCase()] || key;
    if (/^wi[‑-]?fi$/iu.test(key) && String(value).length > 60) label = 'Мережеві функції (деталі)';
    const speedKey=/^Принтер\s*\(швидкість друку\s*(.*)$/iu.exec(key);
    if (speedKey && /стор\s*\/\s*хв|ppm/iu.test(String(value)+' '+speedKey[1])) {
      label='Швидкість друку';
      value=(speedKey[1].trim() ? speedKey[1].trim()+': ' : '')+value;
    } else if (/^Друк$/iu.test(key) && /^швидкість\s/iu.test(String(value)) && /стор\s*\/\s*хв|ppm/iu.test(String(value))) {
      label='Швидкість друку';value=String(value).replace(/^швидкість\s*/iu,'');
    }
    return [label, value];
  });
  const add = (key, value) => {
    if (value && !result.some(([k]) => String(k).toLowerCase() === key.toLowerCase())) result.push([key, value.trim()]);
  };
  // Only explicit print-format labels or the opening device classification;
  // do not use scanner format, tray media, or an arbitrary A4 mention.
  if (!result.some(([key])=>/^(?:формат|формат друку)$/iu.test(key))) {
    const explicit=entries.find(([key,value])=>/^(?:принтер.*|бфп.*)\.\s*формат$/iu.test(key)&&/^[AА][3-6]\+?$/iu.test(String(value).trim()));
    const opening=/^(?:(?:лазерний|кольоровий|монохромний|струменевий)\s+)*(?:БФП|принтер|багатофункціональний пристрій)\s+[AА]([3-6])(\+)?(?=\s|[,(]|$)/iu.exec(String(description).trim());
    if(explicit)add('Формат',String(explicit[1]).replace(/^[Аа]/u,'A').toUpperCase());
    else if(opening)add('Формат','A'+opening[1]+(opening[2]||''));
  }
  for (const [originalKey, raw] of entries) {
    const text = String(raw);
    const duplex = /(?:^|[\s;)])Дуплекс\s*:\s*(так|ні)(?:\s*,\s*(звичайний папір))?(?=\s|$|[.;)])/iu.exec(text);
    if (duplex && !entries.some(([key])=>duplexKey.test(String(key).trim()))) add('Дуплекс', duplex[1].toLowerCase() === 'так' ? 'Так' + (duplex[2] ? ', ' + duplex[2] : '') : 'Ні');
    const scan = /Сканер\s*\(швидкість\s*:\s*(.{1,180}?\([^()]*\))(?=\s*(?:$|[.;]|[А-ЯІЇЄA-Z][\p{L} ]{2,}:))/u.exec(text);
    if (scan) add('Швидкість сканування', scan[1]);
    const flatbed = /Планшет\s*:\s*((?:A\d|Letter)(?:\s*\/\s*(?:A\d|Letter))*\s*\(\d+\s*[xх×]\s*\d+\s*мм\))/iu.exec(text);
    if (flatbed) add('Формат сканування (планшет)', flatbed[1]);
    if (/^(?:Windows|Сумісність з ОС \(деталі\))$/iu.test(originalKey)) {
      const systems = ['Windows', 'macOS', 'Chrome OS'].filter(system => system === 'Windows' || text.toLowerCase().includes(system.toLowerCase()));
      if (systems.length) add('Операційні системи', systems.join(', '));
    }
  }
  const interfaces = result.find(([key]) => key === 'Інтерфейси');
  // Extend only a simple Wi-Fi summary with explicitly described wired ports.
  // Do not rewrite manual/custom interface text or infer optional connections.
  if (interfaces && /^Wi[‑-]?Fi$/iu.test(String(interfaces[1]))) {
    const wired = new Set();
    for (const [, raw] of entries) {
      const text = String(raw);
      if (/опці|optional|не підтрим|відсутн/iu.test(text)) continue;
      if (/\bEthernet\s*:\s*\d+\s*\/\s*\d+/iu.test(text)) wired.add('Ethernet');
      if (/Інтерфейс\s*:\s*(?:Hi-Speed\s*)?USB\s*\(порт\s*[ABАВ]\)/iu.test(text)) wired.add('USB');
    }
    if (wired.size) interfaces[1] = ['Wi-Fi', ...wired].join(', ');
  }
  const mode = printerDuplexMode(result,description);
  if (duplexLabels[mode]) {
    return [...result.filter(([key]) => !duplexKey.test(String(key).trim())), ['Двосторонній друк', duplexLabels[mode]]];
  }
  return result;
}
