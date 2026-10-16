// Group only in the catalog filter; retain precise A3/A3+ product specifications.
export function printerFormatFilterValues(source) {
  const values=[];
  if (/(?:^|[^a-zа-яіїєґ0-9])[aа]3(?:$|[^a-zа-яіїєґ0-9])/iu.test(source)) values.push('A3');
  if (/(?:^|[^a-zа-яіїєґ0-9])[aа]4(?:$|[^a-zа-яіїєґ0-9])/iu.test(source)) values.push('A4');
  return values;
}
