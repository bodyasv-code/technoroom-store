import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCategoryTree,visibleCategoryRows,categoryOptions,categoryMenuMarkup} from '../public/category-tree.js';
const rows=[
 {id:1,slug:'office',name:'Оргтехніка',parent_id:null},
 {id:'2',slug:'special',name:'Спеціалізовані',parent_id:'1'},
 {id:3,slug:'thermal',name:'Термотрансферні',parent_id:2},
 {id:4,slug:'portable',name:'Портативні',parent_id:'3'},
 {id:5,slug:'ink',name:'Струменеві',parent_id:1},
 {id:6,slug:'hidden',name:'Hidden',parent_id:1,is_active:false},
 {id:7,slug:'hidden-child',name:'Child',parent_id:6,is_active:true},
 {id:8,slug:'orphan',name:'Orphan',parent_id:999}
];
const tree=createCategoryTree(rows);
assert.deepEqual(tree.path('portable').map(row=>row.slug),['office','special','thermal','portable']);
assert.deepEqual([...tree.branch('special')],['special','thermal','portable']);
assert.equal(tree.canParent(2,4),false);assert.equal(tree.canParent('2','2'),false);
assert.equal(tree.canParent(3,2),true);assert.equal(tree.canParent(3,''),true);assert.equal(tree.canParent(3,999),false);
assert.deepEqual(tree.flattened.filter(row=>row.category.slug==='portable').map(row=>row.depth),[3]);
assert.equal(tree.roots.some(row=>row.slug==='orphan'),true);
const visible=visibleCategoryRows(rows);
assert.ok(!visible.some(row=>['hidden','hidden-child'].includes(row.slug)));
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const options=categoryOptions(rows,esc,{excludeId:2,value:'id'});
for(const id of [2,3,4])assert.ok(!options.includes('value="'+id+'"'));
assert.ok(categoryOptions(rows,esc,{fullPath:true}).includes('Оргтехніка / Спеціалізовані / Термотрансферні / Портативні'));
const menu=categoryMenuMarkup(visible,rows[0],esc);
assert.ok(menu.includes('category=portable'));assert.ok(menu.includes('<ul>'));assert.ok(!menu.includes('category=hidden'));
assert.ok(categoryMenuMarkup([{id:1,slug:'r',name:'r'},{id:2,slug:'<x>',name:'<script>',parent_id:1}],{id:1},esc).includes('&lt;script>'));
const cyclic=[{id:1,slug:'a',name:'A',parent_id:2},{id:2,slug:'b',name:'B',parent_id:1}];
assert.equal(createCategoryTree(cyclic).flattened.length,2);assert.equal(createCategoryTree(cyclic).path('a').length,2);
assert.deepEqual(visibleCategoryRows(cyclic),[]);assert.equal(createCategoryTree(cyclic).branch('a').size,2);
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
assert.equal((app.match(/categoryMenuMarkup\(cats,/g)||[]).length,2);
assert.ok(app.includes('storefrontTree.path(leaf.slug)'));
assert.ok(app.includes('storefrontTree.children(current.id)'));
assert.ok(app.includes('...storefrontTree.branch(resolved)'));
const admin=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
assert.ok(admin.includes('canParent(r.id,r.parent_id)'));assert.ok(admin.includes('!categoryBranch.has(p.category)'));
console.log('Four-level menus, breadcrumbs, descendant scope, admin choices, hidden ancestors, stable URLs, escaping and cycle guards: OK');
