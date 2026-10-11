// Every slide uses the space required by the longest copy at the current width.
// Images stay contained, so promotional text inside the artwork is never cropped.
export function sizeBannerSlides(hero,copy,banners,renderCopy){
  let lastWidth=0;
  const refresh=()=>{
    if(!hero.classList.contains('has-banner-image')||!copy)return;
    const width=copy.getBoundingClientRect().width;if(!width)return;
    let copyHeight=0;
    for(const banner of banners){
      const probe=copy.cloneNode(false);
      probe.classList.toggle('has-long-banner-title',Array.from(banner.title||'').length>90);
      probe.setAttribute('aria-hidden','true');probe.inert=true;
      probe.style.cssText=`position:absolute;top:0;left:0;width:${width}px;box-sizing:border-box;height:auto;min-height:0;max-height:none;visibility:hidden;pointer-events:none;margin:0`;
      probe.innerHTML=renderCopy(banner);hero.append(probe);
      copyHeight=Math.max(copyHeight,Math.ceil(probe.getBoundingClientRect().height));probe.remove();
    }
    const mobile=window.matchMedia('(max-width:700px)').matches;
    hero.style.setProperty('--banner-copy-height',copyHeight+'px');
    hero.style.setProperty('--banner-slide-height',(mobile?copyHeight+202:Math.max(320,copyHeight+2))+'px');
  };
  const observer=new ResizeObserver(entries=>{
    const width=entries[0].contentRect.width;
    if(Math.abs(width-lastWidth)>.5){lastWidth=width;refresh()}
  });
  observer.observe(hero);
  document.fonts?.ready.then(refresh);
  return refresh;
}
