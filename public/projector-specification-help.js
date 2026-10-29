// General buying guidance, never inferred specifications of an individual model.
// Sources: BenQ business projector buying guide (throw ratio), Epson EF21/22
// technical specifications (native pixels, brightness measurement and modes).
const topics = [
  [/^(?:власна )?роздільна здатність$/u, 'Кількість пікселів зображення: наприклад, Full HD — 1920 × 1080. Власна роздільна здатність і підтримка вхідного сигналу 4K — різні характеристики. Для дрібного тексту звертайте увагу саме на власну роздільну здатність.'],
  [/^(?:яскравість|світловий потік)(?:$|\s|\()/u, 'Світловий потік показує, скільки світла дає проєктор. Сприйняття зображення також залежить від освітлення кімнати, розміру й покриття екрана. Порівнюйте значення за однаковим стандартом вимірювання та режимом роботи. ANSI, ISO й люмени без зазначеного стандарту не перераховуємо автоматично.'],
  [/^про[еє]кційне (?:співвідношення|відношення)$/u, 'Відношення відстані від об’єктива до екрана до ширини зображення. Наприклад, для ширини 2 м і відношення 1,5:1 орієнтовна відстань — 3 м. Це ширина, а не діагональ. Точне розміщення перевіряйте за інструкцією конкретної моделі; для ультракороткофокусних проєкторів особливо важливі монтажні розміри.']
];
export function projectorSpecificationHelp(label) {
  const key=String(label??'').normalize('NFKC').toLocaleLowerCase('uk-UA').trim().replace(/\s+/gu,' ').replace(/\s*\(інше значення \d+\)$/u,'');
  return topics.find(([pattern])=>pattern.test(key))?.[1] || '';
}
const escape=value=>String(value).replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderProjectorSpecificationHelp(label) {
  const text=projectorSpecificationHelp(label);
  return text?'<details class="projector-spec-help"><summary aria-label="Пояснення: '+escape(label)+'">Що це означає?</summary><p>'+escape(text)+'</p></details>':'';
}
