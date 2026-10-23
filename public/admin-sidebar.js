// Presentation only: move existing links without replacing their nodes or handlers.
export const sidebarGroups = [
  {label:'Магазин', ids:['overview','reports','quality','products','categories','brands','orders','customers']},
  {label:'Контент', ids:['promotions','banners','articles']},
  {label:'Постачальники', ids:['supplierImport','supplierRegistry','ercCatalogApi']},
  {label:'Налаштування', ids:['adminUsers']}
];
const paths = {
  overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  reports:'M4 20V10 M10 20V4 M16 20v-8 M22 20H2',
  quality:'M12 3 2 21h20L12 3Z M12 9v5 M12 17v.1',
  products:'m3 7 9-4 9 4v10l-9 4-9-4V7Z m0 0 9 4 9-4 M12 11v10 M7.5 5 17 9',
  categories:'M3 5h7l2 3h9v12H3V5Z',
  brands:'M3 3h8l10 10-8 8L3 11V3Z M7 7h.01',
  orders:'M6 3h12v18H6V3Z M9 8h6 M9 12h6 M9 16h4',
  customers:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4',
  promotions:'M4 4h16v16H4z M8 16l8-8 M8 8h.01 M16 16h.01',
  banners:'M3 4h18v16H3z M3 15l5-5 5 5 3-3 5 5 M16 8h.01',
  articles:'M5 3h11l4 4v14H5V3Z M14 3v6h6 M8 13h9 M8 17h6',
  supplierImport:'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  supplierRegistry:'M3 8h12v11H3z M15 12h4l3 4v3h-7 M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  ercCatalogApi:'m8 6-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18',
  adminUsers:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z m-4 9 3 3 5-6',
  store:'M14 3h7v7 M21 3l-9 9 M10 5H3v16h16v-7',
  logout:'M9 3H3v18h6 M13 7l5 5-5 5 M7 12h15',
  collapse:'M4 3h16v18H4z M9 3v18 m7-13-4 4 4 4'
};
export function sidebarIcon(id,root=document){
  const svg=root.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false',class:'admin-nav-icon'}))svg.setAttribute(key,value);
  const path=root.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',paths[id]||paths.products);svg.append(path);return svg;
}
export function mountAdminSidebar({root=document,view=window}={}){
  const nav=root.querySelector('.admin-nav'),shell=root.querySelector('.admin-shell');
  if(!nav||!shell||nav.dataset.sidebarMounted)return;
  nav.dataset.sidebarMounted='true';nav.setAttribute('aria-label','Керування магазином');
  const header=root.createElement('div');header.className='admin-nav-header';
  const brand=nav.querySelector('.brand'),caption=nav.querySelector(':scope > p');
  if(brand)header.append(brand);if(caption)header.append(caption);nav.prepend(header);
  const toggle=root.createElement('button');toggle.type='button';toggle.className='admin-nav-toggle';toggle.append(sidebarIcon('collapse',root));header.append(toggle);
  const body=root.createElement('nav');body.className='admin-nav-body';body.id='adminSidebarSections';body.setAttribute('aria-label','Розділи адмінки');nav.append(body);
  toggle.setAttribute('aria-controls',body.id);
  const decorate=(link,id)=>{link.setAttribute('title',link.textContent.trim());link.prepend(sidebarIcon(id,root));};
  for(const [index,group] of sidebarGroups.entries()){
    const links=group.ids.map(id=>[id,nav.querySelector('a[href="#'+id+'"]')]).filter(([,link])=>link);
    if(!links.length)continue;
    const section=root.createElement('div');section.className='admin-nav-group';
    const title=root.createElement('h2');title.id='adminNavGroup'+index;title.textContent=group.label;section.setAttribute('aria-labelledby',title.id);section.append(title);
    for(const [id,link] of links){decorate(link,id);section.append(link)}body.append(section);
  }
  const footer=root.createElement('div');footer.className='admin-nav-footer';
  for(const [selector,id] of [[':scope > a:not([href^="#"]):not(.brand)','store'],['#logout','logout']]){const link=nav.querySelector(selector);if(link){decorate(link,id);footer.append(link)}}
  nav.append(footer);
  let collapsed=false;try{collapsed=view.localStorage.getItem('technoroom.admin.sidebar')==='collapsed'}catch{}
  const render=()=>{shell.classList.toggle('admin-sidebar-collapsed',collapsed);toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',collapsed?'Розгорнути бокову панель':'Згорнути бокову панель');toggle.title=collapsed?'Розгорнути меню':'Згорнути меню'};
  toggle.onclick=()=>{collapsed=!collapsed;render();try{view.localStorage.setItem('technoroom.admin.sidebar',collapsed?'collapsed':'expanded')}catch{}};
  render();
}
