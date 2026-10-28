// Only known campaign fields, never the complete landing URL or free-text keywords.
const sources = new Set(['google','bing','facebook','instagram','youtube','newsletter']);
const media = new Set(['cpc','ppc','paidsearch','paid_search','paid-social','paid_social','social','email','display','organic','referral']);
const campaignSlugs = new Set(['projectors','printers','office-equipment','consumables','cartridges','canon-075']);
const single = (params,key) => params.getAll(key).length === 1 ? params.get(key) : null;
export function attributionParameters(params) {
  const result = new URLSearchParams();
  // IDs are case-sensitive opaque tokens. Never persist or copy them to links.
  for (const key of ['gclid','gbraid','wbraid']) {
    const value = single(params,key);
    if (value && /^[A-Za-z0-9_-]{10,512}$/.test(value) && /[A-Za-z]/.test(value)) result.set(key,value);
  }
  const source = single(params,'utm_source'), medium = single(params,'utm_medium');
  if (sources.has(source) && media.has(medium)) {
    result.set('utm_source',source);
    result.set('utm_medium',medium);
    for (const key of ['utm_campaign','utm_id']) {
      const value = single(params,key);
      if (value && (/^[1-9]\d{0,19}$/.test(value) || key === 'utm_campaign' && campaignSlugs.has(value))) result.set(key,value);
    }
  }
  return result;
}
