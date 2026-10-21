// Presentation only: existing filter fields, events and URL state are unchanged.
export function mountCatalogLayout(doc=document,media=window.matchMedia('(max-width:900px)')) {
  const panel=doc.getElementById('catalogFilterPanel');
  const done=doc.getElementById('catalogShowResults');
  if(!panel||!done) return;
  const sync=()=>{panel.open=!media.matches;done.hidden=!media.matches;};
  sync();
  media.addEventListener('change',sync);
  // Desktop filters stay visible; mobile uses native keyboard-accessible disclosure.
  panel.addEventListener('toggle',()=>{if(!media.matches&&!panel.open) panel.open=true;});
  done.addEventListener('click',()=>{
    if(!media.matches) return;
    panel.open=false;
    panel.querySelector('summary').focus({preventScroll:true});
    panel.scrollIntoView({block:'start'});
  });
}
if(typeof document!=='undefined') mountCatalogLayout();
