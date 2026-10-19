import {createCategoryTree} from './category-tree.js?v=20261019-nested';

export function mobileCategoryMarkup(tree,currentSlug,escape,icon=()=> '') {
  const path=tree.path(currentSlug),current=path.at(-1);
  const rows=current?tree.children(current.id):tree.roots;
  const heading=current?.name||'Каталог товарів';
  const back=current?'<button type="button" class="mobile-catalog-back" data-mobile-back>← Назад</button>':'';
  const all=current?'<a class="mobile-catalog-all" href="catalog.html?category='+encodeURIComponent(current.slug)+'">Усі товари категорії →</a>':'';
  return '<div class="mobile-catalog-header"><h2 tabindex="-1">'+escape(heading)+'</h2><button type="button" class="mobile-catalog-close" data-mobile-close aria-label="Закрити каталог">×</button></div>'
    +'<div class="mobile-catalog-location">'+back+(current?'<p>'+escape(path.map(row=>row.name).join(' / '))+'</p>':'')+'</div>'
    +'<div class="mobile-catalog-list">'+all+rows.map(row=>{
      const content=icon(row)+'<span>'+escape(row.name)+'</span><b aria-hidden="true">›</b>';
      return tree.children(row.id).length
        ?'<button type="button" class="mobile-catalog-row" data-mobile-open="'+escape(row.slug)+'">'+content+'</button>'
        :'<a class="mobile-catalog-row" href="catalog.html?category='+encodeURIComponent(row.slug)+'">'+content+'</a>';
    }).join('')+'</div>';
}

export function mountMobileCategoryMenu({menu,toggle,categories,escape,icon,restoreDesktop}) {
  if(menu.dataset.mobileCatalogBound)return;
  menu.dataset.mobileCatalogBound='true';
  if(!document.getElementById('mobile-category-menu-style')){
    const style=document.createElement('link');style.id='mobile-category-menu-style';style.rel='stylesheet';
    style.href=new URL('./mobile-category-menu.css?v=20261019-drilldown',import.meta.url).href;document.head.append(style);
  }
  const tree=createCategoryTree(categories),compact=window.matchMedia('(max-width:700px)');
  const panel=document.createElement('div');panel.className='mobile-catalog-panel';panel.hidden=true;
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Каталог товарів');menu.append(panel);
  let opened=false,currentSlug='',previousBodyOverflow='',previousPageOverflow='';
  const render=()=>{
    panel.innerHTML=mobileCategoryMarkup(tree,currentSlug,escape,icon);
    panel.querySelector('.mobile-catalog-list').scrollTop=0;
    panel.querySelector('h2').focus({preventScroll:true});
  };
  const close=(focus=true)=>{
    if(!opened)return;
    opened=false;menu.hidden=true;panel.hidden=true;menu.classList.remove('is-mobile-catalog-open');
    document.body.style.overflow=previousBodyOverflow;document.documentElement.style.overflow=previousPageOverflow;
    toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus({preventScroll:true});
  };
  toggle.addEventListener('click',event=>{
    if(!compact.matches)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(opened){close();return;}
    opened=true;currentSlug='';previousBodyOverflow=document.body.style.overflow;previousPageOverflow=document.documentElement.style.overflow;
    document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';
    menu.hidden=false;panel.hidden=false;menu.classList.add('is-mobile-catalog-open');toggle.setAttribute('aria-expanded','true');render();
  },true);
  panel.addEventListener('click',event=>{
    if(event.target.closest('[data-mobile-close]')){close();return;}
    if(event.target.closest('[data-mobile-back]')){currentSlug=tree.path(currentSlug).at(-2)?.slug||'';render();return;}
    const branch=event.target.closest('[data-mobile-open]');
    if(branch){currentSlug=branch.dataset.mobileOpen;render();return;}
    if(event.target.closest('a[href]'))close(false);
  });
  menu.addEventListener('click',event=>{if(event.target===menu)close();});
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    const items=[...panel.querySelectorAll('button,a[href]')],first=items[0],last=items.at(-1);
    if(event.shiftKey&&(document.activeElement===first||!items.includes(document.activeElement))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
  compact.addEventListener('change',()=>{close(false);menu.hidden=true;restoreDesktop();});
}
