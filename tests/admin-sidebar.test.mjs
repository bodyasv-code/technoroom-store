import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sidebarGroups,mountAdminSidebar} from '../public/admin-sidebar.js';
import {adminSectionIds} from '../public/admin-navigation.js';
assert.deepEqual(sidebarGroups.flatMap(g=>g.ids).sort(),[...adminSectionIds].sort());
class Element{
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.textContent='';this.values=new Set();this.classList={toggle:(name,on)=>on?this.values.add(name):this.values.delete(name)}}
  setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]??null}
  append(node){if(node.parent)node.parent.children.splice(node.parent.children.indexOf(node),1);this.children.push(node);node.parent=this}
  prepend(node){this.append(node);this.children.unshift(this.children.pop())}
  querySelector(selector){const all=this.children.flatMap(c=>[c,...c.descendants()]);if(selector==='.brand')return all.find(c=>c.className==='brand');if(selector===':scope > p')return this.children.find(c=>c.tag==='p');if(selector==='#logout')return all.find(c=>c.id==='logout');if(selector.startsWith('a[href='))return all.find(c=>c.href===selector.slice(8,-2));if(selector.startsWith(':scope > a'))return this.children.find(c=>c.tag==='a'&&!c.href.startsWith('#')&&c.className!=='brand');return null}
  descendants(){return this.children.flatMap(c=>[c,...c.descendants()])}
}
const nav=new Element(),shell=new Element(),brand=new Element('a'),caption=new Element('p');brand.className='brand';brand.href='index.html';nav.append(brand);nav.append(caption);
const links=adminSectionIds.map(id=>{const a=new Element('a');a.href='#'+id;a.textContent=id;a.handler=()=>id;nav.append(a);return a});
const store=new Element('a');store.href='index.html';store.textContent='Відкрити магазин';nav.append(store);const logout=new Element('button');logout.id='logout';logout.textContent='Вийти';logout.onclick=()=>42;nav.append(logout);
const root={querySelector:s=>s==='.admin-nav'?nav:shell,createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t)};
const saved=new Map(),view={localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)}};
mountAdminSidebar({root,view});
assert.equal(nav.children.length,3);assert.equal(nav.children[1].children.length,4);
assert.equal(nav.children[2].children[0],store);assert.equal(nav.children[2].children[1],logout);assert.equal(logout.onclick(),42);
for(const a of links){assert.equal(a.handler(),a.textContent);assert.equal(a.children[0].tag,'svg');assert.ok(a.attrs.title)}
const toggle=nav.children[0].children[2];assert.equal(toggle.attrs['aria-expanded'],'true');toggle.onclick();assert.equal(toggle.attrs['aria-expanded'],'false');assert.ok(shell.values.has('admin-sidebar-collapsed'));assert.equal(saved.get('technoroom.admin.sidebar'),'collapsed');toggle.onclick();assert.equal(shell.values.size,0);
mountAdminSidebar({root,view});assert.equal(nav.children.length,3,'Mount is idempotent');
const source=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');assert.ok(source.lastIndexOf('mountAdminSidebar();')>source.lastIndexOf('mountAdminUsers(supabase);'));
console.log('Sidebar: all routes grouped, original links and handlers preserved, accessible toggle, preference persistence and idempotency: PASS');
