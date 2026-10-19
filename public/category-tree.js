// One hierarchy for menus, breadcrumbs, product scope and admin selectors.
const key = value => value == null || value === '' ? '' : String(value);
export function createCategoryTree(categories = []) {
  const rows = [...categories].sort((a,b) => (Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.name).localeCompare(String(b.name),'uk'));
  const byId = new Map(rows.map(row => [key(row.id),row]));
  const bySlug = new Map(rows.map(row => [row.slug,row]));
  const byParent = new Map();
  for (const row of rows) {
    const parent = byId.has(key(row.parent_id)) ? key(row.parent_id) : '';
    const children = byParent.get(parent)||[];
    children.push(row); byParent.set(parent,children);
  }
  const children = id => byParent.get(key(id))||[];
  const branch = slug => {
    const result = new Set([slug]), seen = new Set();
    const visit = row => { if(!row||seen.has(key(row.id)))return; seen.add(key(row.id));result.add(row.slug);children(row.id).forEach(visit); };
    visit(bySlug.get(slug)); return result;
  };
  const path = slug => {
    const result=[],seen=new Set();let row=bySlug.get(slug);
    while(row&&!seen.has(key(row.id))){seen.add(key(row.id));result.unshift(row);row=byId.get(key(row.parent_id));}
    return result;
  };
  const roots=[...children('')],flattened=[],seen=new Set();
  const visit=(row,depth)=>{if(seen.has(key(row.id)))return;seen.add(key(row.id));flattened.push({category:row,depth});children(row.id).forEach(child=>visit(child,depth+1));};
  roots.forEach(row=>visit(row,0));
  // Keep corrupt/cyclic legacy rows repairable in admin, without endless recursion.
  for(const row of rows)if(!seen.has(key(row.id))){roots.push(row);visit(row,0);}
  const canParent=(id,parentId)=>!key(parentId)||byId.has(key(parentId))&&(!byId.has(key(id))||!branch(byId.get(key(id)).slug).has(byId.get(key(parentId)).slug));
  return {rows,roots,children,branch,path,flattened,canParent};
}
export function visibleCategoryRows(categories = []) {
  const byId=new Map(categories.map(row=>[key(row.id),row]));
  return categories.filter(row=>{
    const seen=new Set();let current=row;
    while(current){if(current.is_active===false||seen.has(key(current.id)))return false;seen.add(key(current.id));current=byId.get(key(current.parent_id));}
    return true;
  });
}
export function categoryOptions(categories,escape,{excludeId=null,value='slug',fullPath=false}={}) {
  const tree=createCategoryTree(categories);
  return tree.flattened.filter(({category})=>tree.canParent(excludeId,category.id)).map(({category,depth})=>
    '<option value="'+escape(String(category[value]))+'">'+escape(fullPath?tree.path(category.slug).map(row=>row.name).join(' / '):'— '.repeat(depth)+category.name)+'</option>').join('');
}
export function categoryMenuMarkup(categories,parent,escape) {
  const tree=createCategoryTree(categories),seen=new Set([key(parent.id)]);
  const link=row=>'<a href="catalog.html?category='+encodeURIComponent(row.slug)+'">'+escape(row.name)+'</a>';
  const nested=row=>{
    if(seen.has(key(row.id)))return '';seen.add(key(row.id));
    const descendants=tree.children(row.id).map(nested).join('');
    return '<li>'+link(row)+(descendants?'<ul>'+descendants+'</ul>':'')+'</li>';
  };
  return tree.children(parent.id).map(row=>{
    if(seen.has(key(row.id)))return '';seen.add(key(row.id));
    const descendants=tree.children(row.id).map(nested).join('');
    return '<div class="mega-category-branch">'+link(row)+(descendants?'<ul>'+descendants+'</ul>':'')+'</div>';
  }).join('');
}
