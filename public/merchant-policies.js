// Keep these facts aligned with the published /delivery and /returns pages.
const origin='https://www.technoroom.com.ua';
export const FREE_DELIVERY_THRESHOLD=50000;
export function merchantReturnPolicy(){
  return {'@type':'MerchantReturnPolicy',applicableCountry:'UA',returnPolicyCategory:'https://schema.org/MerchantReturnFiniteReturnWindow',merchantReturnDays:14,returnMethod:['https://schema.org/ReturnByMail','https://schema.org/ReturnInStore'],returnFees:'https://schema.org/FreeReturn',merchantReturnLink:origin+'/returns'};
}
export function merchantOfferPolicies(price){
  const result={hasMerchantReturnPolicy:merchantReturnPolicy()};
  // Below the order threshold the carrier charges its own variable tariff.
  // Do not turn an unknown carrier price into free or flat-rate shipping.
  if(Number.isFinite(price)&&price>=FREE_DELIVERY_THRESHOLD)result.shippingDetails={'@type':'OfferShippingDetails',shippingDestination:{'@type':'DefinedRegion',addressCountry:'UA'},shippingRate:{'@type':'MonetaryAmount',value:0,currency:'UAH'}};
  return result;
}
