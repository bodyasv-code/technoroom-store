export const adminSectionIds=['overview','reports','quality','products','categories','brands','orders','customers','promotions','banners','articles','supplierImport','supplierRegistry','ercCatalogApi','adminUsers'];
export function adminSectionFromHash(hash,ids=adminSectionIds){
  let id='';try{id=decodeURIComponent(String(hash||'').replace(/^#/,''))}catch{}
  return ids.includes(id)?id:(ids.includes('overview')?'overview':ids[0]);
}
export function mountAdminNavigation({root=document,view=window}={}){
  const main=root.querySelector('.admin-main');if(!main)return;
  const sections=[...root.querySelectorAll('.admin-main > section[id]')].filter(section=>adminSectionIds.includes(section.id));
  const ids=sections.map(section=>section.id);
  const links=[...root.querySelectorAll('.admin-nav a[href^="#"]')].filter(link=>ids.includes(link.getAttribute('href').slice(1)));
  const labels=new Map(links.map(link=>[link.getAttribute('href').slice(1),[...link.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent).join('').trim()]));
  for(const link of links)link.dataset.section=link.getAttribute('href').slice(1);
  const pickerLabel=root.createElement('label');pickerLabel.className='admin-section-picker';pickerLabel.textContent='Розділ адмінки';
  const picker=root.createElement('select');picker.id='adminSectionPicker';picker.setAttribute('aria-label','Розділ адмінки');
  for(const id of ids){const option=root.createElement('option');option.value=id;option.textContent=labels.get(id)||id;picker.append(option)}
  pickerLabel.append(picker);main.prepend(pickerLabel);
  const show=(id,scroll=false)=>{
    for(const section of sections)section.hidden=section.id!==id;
    for(const link of links){const active=link.dataset.section===id;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')}
    picker.value=id;root.title=(labels.get(id)||'Огляд')+' — Адмінка — TECHNOROOM';
    if(scroll){main.scrollIntoView({block:'start',behavior:'auto'});const heading=sections.find(section=>section.id===id)?.querySelector('h2');if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true})}}
  };
  const navigate=id=>{if(!ids.includes(id))return;if(view.location.hash==='#'+id)show(id,true);else view.location.hash=id};
  const click=event=>{
    if(event.defaultPrevented||event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest('a[href^="#"]');if(!link||link.target==='_blank'||link.hasAttribute('download'))return;
    const id=link.getAttribute('href').slice(1);if(!ids.includes(id))return;
    event.preventDefault();navigate(id);
  };
  const changed=()=>show(adminSectionFromHash(view.location.hash,ids),true);
  root.addEventListener('click',click);view.addEventListener('hashchange',changed);picker.onchange=()=>navigate(picker.value);
  // Do not rewrite unknown hashes: Supabase password-recovery fragments must stay intact.
  show(adminSectionFromHash(view.location.hash,ids));
  return()=>{root.removeEventListener('click',click);view.removeEventListener('hashchange',changed);pickerLabel.remove()};
}
