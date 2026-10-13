const common = [
  /^(тип пристрою|тип продукту|тип товару)$/u,
  /^(технологія друку|технологія проекції|технологія проєкції)$/u,
  /^(тип друку|кольоровість|кольоровість друку)$/u,
  /^(формат|формат друку|максимальний формат)$/u,
  /^(роздільна здатність|роздільна здатність друку|дозвіл|resolution)$/u,
  /^(швидкість друку|швидкість чорно-білого друку|швидкість кольорового друку)(?:\s*\([^)]*\))?$/u,
  /^(дуплекс|автоматичний двосторонній друк|двосторонній друк)(?:\s*\([^)]*\))?$/u,
  /^(інтерфейси|інтерфейс|підключення)$/u,
  /^(діагональ|діагональ екрана|процесор|оперативна пам.?ять|обсяг пам.?яті|ємність|потужність)(?:\s*\([^)]*\))?$/u,
];
const projector = [
  /^(технологія проекції|технологія проєкції)$/u,
  /^роздільна здатність$/u,
  /^яскравість(?:, лм| за різних режимів)?$/u,
  /^джерело світла$/u,
  /^призначення$/u,
  /^(проекційне співвідношення|проєкційне співвідношення)$/u,
  /^контраст$/u,
  /^(вхід|вихід|інтерфейси)$/u,
];

// Stable presentation order only; unknown fields retain their relative order.
export function orderSpecificationEntries(entries, {projector: isProjector = false} = {}) {
  const priorities = isProjector ? projector : common;
  const rank = key => {
    const name = String(key).trim().replace(/[:：]+$/u, '').toLocaleLowerCase('uk-UA');
    const index = priorities.findIndex(pattern => pattern.test(name));
    return index < 0 ? priorities.length : index;
  };
  return entries.map((entry, index) => ({entry, index, rank:rank(entry[0])}))
    .sort((a,b) => a.rank-b.rank || a.index-b.index).map(item => item.entry);
}
