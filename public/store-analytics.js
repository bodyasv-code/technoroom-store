import {COMMERCE_EVENT,ANALYTICS_READY,normalizeCommerce} from './store-commerce-events.js?v=20261021-commerce';
// GA4 basic consent: no Google script or request before explicit analytics opt-in.
export const MEASUREMENT_ID='G-L3NG1R28PY';
export const CONSENT_KEY='technoroom-analytics-consent-v2';
const CONSENT_AGE=180*24*60*60*1000;
const PAGES={'/':'TECHNOROOM','/index':'TECHNOROOM','/catalog':'Каталог — TECHNOROOM','/product':'Товар — TECHNOROOM','/articles':'Статті — TECHNOROOM','/article':'Стаття — TECHNOROOM','/checkout':'Оформлення — TECHNOROOM','/contacts':'Контакти — TECHNOROOM'};
const hostAllowed=hostname=>['technoroom.com.ua','www.technoroom.com.ua'].includes(hostname);

export function analyticsPage(raw,referrer='') {
  const source=new URL(raw);
  const path=source.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/';
  if(!hostAllowed(source.hostname)||!PAGES[path])return null;
  const clean=new URL(path==='/index'?'/':path,'https://www.technoroom.com.ua');
  const key=path==='/product'?'id':path==='/catalog'?'category':path==='/article'?'slug':'';
  const value=source.searchParams.get(key);
  if(key&&value&&(key==='id'?/^[1-9]\d{0,15}$/.test(value):/^[\p{L}\p{N}_-]{1,180}$/u.test(value)))clean.searchParams.set(key,value);
  let safeReferrer='';
  try{const url=new URL(referrer);if(['http:','https:'].includes(url.protocol))safeReferrer=url.origin+'/';}catch{}
  return {page_location:clean.href,page_title:PAGES[path],page_referrer:safeReferrer};
}

export function createAnalyticsController(win,doc,onChange=()=>{}) {
  const context=analyticsPage(win.location.href,doc.referrer);
  if(!context)return null;
  const disableKey='ga-disable-'+MEASUREMENT_ID;
  win[disableKey]=true;
  let choice=null,loaded=false;
  let diagnostic='Очікуємо дії з товаром.';
  let sdkStatus='Тег ще не завантажувався.';
  const debug=(()=>{try{
    const requested=new URL(win.location.href).searchParams.get('analytics_debug');
    if(requested==='1')win.sessionStorage.setItem('technoroom-ga-debug','1');
    if(requested==='0')win.sessionStorage.removeItem('technoroom-ga-debug');
    return requested==='1'||requested!=='0'&&win.sessionStorage.getItem('technoroom-ga-debug')==='1';
  }catch{return false;}})();
  const notify=()=>onChange(choice,{debug,diagnostic,sdkStatus});
  let checkoutTracked=false;
  const transactions=new Set();
  const stored=()=>{
    try{const data=JSON.parse(win.localStorage.getItem(CONSENT_KEY));return data&&['granted','denied'].includes(data.choice)&&Number.isFinite(data.at)&&data.at<=Date.now()&&Date.now()-data.at<CONSENT_AGE?data.choice:null;}catch{return null;}
  };
  const clearCookies=()=>{
    // Only our analytics cookies; never touch carts, authentication or other storage.
    for(const name of ['_ga','_ga_'+MEASUREMENT_ID.slice(2).replace(/-/g,'')]){
      for(const domain of ['',win.location.hostname,'technoroom.com.ua'])doc.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax'+(domain?'; Domain='+domain:'');
    }
  };
  const start=()=>{
    if(choice!=='granted'||loaded)return;
    loaded=true;win[disableKey]=false;
    win.dataLayer=win.dataLayer||[];
    win.gtag=function(){win.dataLayer.push(arguments);};
    win.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    win.gtag('consent','update',{analytics_storage:'granted'});
    win.gtag('js',new Date());
    win.gtag('set',context);
    win.gtag('config',MEASUREMENT_ID,{...context,send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,cookie_expires:15552000});
    win.gtag('event','page_view',{...context,send_to:MEASUREMENT_ID});
    const script=doc.createElement('script');script.id='storeGoogleAnalytics';script.async=true;
    script.src='https://www.googletagmanager.com/gtag/js?id='+MEASUREMENT_ID;
    script.referrerPolicy='origin';
    sdkStatus='Завантажуємо тег Google…';
    script.onload=()=>{sdkStatus='Тег Google завантажився.';notify();};
    script.onerror=()=>{sdkStatus='Не вдалося завантажити тег Google (можливе блокування).';notify();};
    doc.head.append(script);
  };
  const apply=next=>{
    const previous=choice;choice=next;
    if(next==='granted'){
      if(loaded&&previous!=='granted'){
        win[disableKey]=false;
        win.gtag('consent','update',{analytics_storage:'granted'});
        // A repeat opt-in on this page must not duplicate its page_view.
      }else start();
    }else{
      win[disableKey]=true;
      clearCookies();
      // Do not issue a denied-consent ping: the global opt-out flag blocks GA collection.
    }
    notify();
    if(choice==='granted'&&doc.dispatchEvent&&win.CustomEvent)doc.dispatchEvent(new win.CustomEvent(ANALYTICS_READY));
  };
  const choose=next=>{
    if(!['granted','denied'].includes(next))return;
    try{win.localStorage.setItem(CONSENT_KEY,JSON.stringify({choice:next,at:Date.now()}));}catch{}
    apply(next);
  };
  win.addEventListener('storage',event=>{if(event.key===CONSENT_KEY||event.key===null)apply(stored());});
  doc.addEventListener?.(COMMERCE_EVENT,event=>{
    const {name,detail}=event.detail||{},payload=normalizeCommerce(name,detail);
    const label=['add_to_cart','begin_checkout','purchase'].includes(name)?name:'невідома подія';
    if(choice!=='granted'||win[disableKey]||typeof win.gtag!=='function'){
      diagnostic=label+': не надіслано — немає дозволу на аналітику.';notify();return;
    }
    if(!payload){diagnostic=label+': не надіслано — некоректні ID, ціна або кількість.';notify();return;}
    if(!payload||name==='begin_checkout'&&checkoutTracked)return;
    if(name==='purchase'){
      if(transactions.has(payload.transaction_id))return;
      try{if(win.sessionStorage.getItem('technoroom-ga-'+payload.transaction_id)==='sent')return;}catch{}
    }
    try{
      win.gtag('event',name,{...payload,...context,send_to:MEASUREMENT_ID,...(debug?{debug_mode:true}:{})});
      diagnostic=label+': передано тегу ('+new Date().toLocaleTimeString('uk-UA')+'). Це ще не підтвердження отримання Google.';notify();
      if(name==='begin_checkout')checkoutTracked=true;
      if(name==='purchase'){
        transactions.add(payload.transaction_id);
        try{win.sessionStorage.setItem('technoroom-ga-'+payload.transaction_id,'sent');}catch{}
      }
    }catch{diagnostic=label+': помилка виклику тега.';notify();}
  });
  apply(stored());
  return {choose,getChoice:()=>choice,getDiagnostics:()=>({debug,diagnostic,sdkStatus})};
}

export function mountStoreAnalytics(win=window,doc=document) {
  if(!analyticsPage(win.location.href,doc.referrer)||doc.getElementById('storeAnalyticsConsent'))return;
  const banner=doc.createElement('section');banner.id='storeAnalyticsConsent';banner.className='analytics-consent';
  banner.setAttribute('aria-label','Налаштування аналітики');
  banner.innerHTML='<div class="analytics-consent-copy"><strong>Аналітика магазину</strong><p>Дозволити Google Analytics вимірювати відвідування сайту? Це необов’язково: покупки працюють і без аналітики.</p><details><summary>Що збирається?</summary><p>Після вашої згоди Google отримує дані про переглянуті сторінки, додавання товарів у кошик, створені замовлення, браузер і пристрій та використовує аналітичні cookies. Поля замовлення, телефон, email і текст пошуку не передаємо. Рекламну персоналізацію не вмикаємо. Вибір зберігаємо на цьому пристрої до 180 днів; його можна змінити кнопкою «Налаштування аналітики» внизу сторінки. <a href="https://policies.google.com/privacy?hl=uk" target="_blank" rel="noopener noreferrer">Конфіденційність Google</a>.</p></details></div><div class="analytics-consent-actions"><button type="button" data-analytics-choice="denied">Відхилити</button><button type="button" data-analytics-choice="granted">Дозволити</button></div>';
  const footer=doc.createElement('div');footer.className='analytics-settings';
  const settings=doc.createElement('button');settings.type='button';settings.textContent='Налаштування аналітики';
  settings.setAttribute('aria-controls',banner.id);settings.setAttribute('aria-expanded','false');footer.append(settings);
  const diagnostics=doc.createElement('p');diagnostics.hidden=true;diagnostics.setAttribute('aria-live','polite');
  diagnostics.style.cssText='max-width:700px;margin:8px auto;font:12px/1.6 Arial,sans-serif;color:#173b62;overflow-wrap:anywhere';
  footer.append(diagnostics);
  const controller=createAnalyticsController(win,doc,(choice,state)=>{
    banner.hidden=choice!==null;settings.setAttribute('aria-expanded',String(choice===null));
    diagnostics.hidden=!state.debug;
    diagnostics.textContent='Діагностика аналітики · '+(choice==='granted'?'дозволено':choice==='denied'?'відхилено':'вибір не зроблено')+' · '+state.sdkStatus+' '+state.diagnostic;
  });
  settings.onclick=()=>{banner.hidden=false;settings.setAttribute('aria-expanded','true');banner.querySelector('button').focus({preventScroll:true});};
  banner.querySelectorAll('[data-analytics-choice]').forEach(button=>{button.onclick=()=>{controller.choose(button.dataset.analyticsChoice);settings.focus({preventScroll:true});};});
  doc.body.append(footer,banner);
}
if(typeof document!=='undefined')mountStoreAnalytics();
