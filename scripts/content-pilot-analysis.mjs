// Read-only evidence extraction. It never creates a product update payload.
const text=value=>typeof value==='string'?value.trim():'';
const key=value=>text(value).normalize('NFKC').toLocaleUpperCase('en-US');
export function analyseIcecatResponse(product,response,{language,httpStatus}){
  const data=response?.data,general=data?.GeneralInfo;
  const base={language,httpStatus,message:text(response?.msg)||text(response?.message)||text(response?.Message),error:response?.error??response?.Error??null,statusCode:response?.StatusCode??null};
  if(!general)return {...base,received:false,exactIdentity:false};
  const groups=Array.isArray(data.FeaturesGroups)?data.FeaturesGroups:[];
  const features=groups.flatMap(group=>(Array.isArray(group.Features)?group.Features:[]).map(f=>({
    group:text(group.FeatureGroup?.Name?.Value),
    name:text(f.Feature?.Name?.Value),value:text(f.PresentationValue)||text(f.Value),
    unit:text(f.Feature?.Measure?.Sign),nameLanguage:text(f.Feature?.Name?.Language),
  })));
  const description=general.Description||{};
  return {...base,received:true,
    exactIdentity:key(general.Brand)===key(product.brand)&&key(general.BrandPartCode)===key(product.sku),
    returnedBrand:general.Brand,returnedMpn:general.BrandPartCode,title:general.Title,
    icecatId:general.IcecatId,demoResponse:Object.hasOwn(data,'DemoAccount'),
    groups:groups.length,features:features.length,
    imagePresent:Boolean(data.Image?.HighPic||data.Image?.Pic500x500||data.Image?.LowPic),
    galleryImages:Array.isArray(data.Gallery)?data.Gallery.length:0,
    descriptionPresent:Boolean(text(description.LongDesc)),
    descriptionLanguage:text(description.Language)||text(general.TitleInfo?.Language),
    featureNameLanguages:[...new Set(features.map(f=>f.nameLanguage).filter(Boolean))],
    ukrainianFeatureNames:features.filter(f=>/[іїєґ]/iu.test(f.name)).length,
    // Only diagnostic fields are retained, not complete copyrighted descriptions
    // or media URLs. Requested UK is not proof that returned text is Ukrainian.
    checks:features.filter(f=>/resolution|duplex|brightness|luminous|memory|ethernet|wi.fi|scan|розділь|дуплекс|двосторон|яскрав|пам.ять|скан|native|естествен|оптическ|интерфейс|разрешени/iu.test(f.name)).slice(0,14),
    firstFeatureNames:features.slice(0,5).map(f=>f.name),
  };
}
