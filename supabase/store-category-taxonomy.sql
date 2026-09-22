-- TECHNOROOM store taxonomy. Run after erc-category-hierarchy.sql.
-- Reorganizes the current ERC subcategories by product type instead of supplier sections.
-- Safe to run repeatedly. Products keep their existing subcategory slug.

insert into public.categories (slug,name,is_active,sort_order,parent_id) values
('cat-projectors','Проєкційне обладнання',true,100,null),
('cat-displays','Телевізори, монітори та дисплеї',true,200,null),
('cat-audio','Аудіо',true,300,null),
('cat-power','ДБЖ та резервне живлення',true,400,null),
('cat-solar','Альтернативна енергетика',true,500,null),
('cat-electrical','Електротехніка',true,600,null),
('cat-accessories','Аксесуари та кріплення',true,700,null)
on conflict (slug) do update set name=excluded.name,is_active=true,sort_order=excluded.sort_order,parent_id=null;

with map(child_slug,parent_slug) as (values
('erc-display-03','cat-projectors'),('erc-display-06','cat-projectors'),('erc-display-08','cat-projectors'),
('erc-display-09','cat-projectors'),('erc-display-11','cat-projectors'),('erc-display-12','cat-projectors'),
('erc-display-13','cat-projectors'),('erc-display-14','cat-projectors'),('erc-display-15','cat-projectors'),
('erc-display-01','cat-displays'),('erc-display-02','cat-displays'),('erc-display-07','cat-displays'),
('erc-display-16','cat-displays'),('erc-display-17','cat-displays'),('erc-display-19','cat-displays'),('erc-display-20','cat-displays'),
('erc-consumer-01','cat-audio'),('erc-consumer-02','cat-audio'),('erc-consumer-03','cat-audio'),
('erc-consumer-04','cat-audio'),('erc-consumer-05','cat-audio'),('erc-consumer-06','cat-audio'),
('erc-consumer-07','cat-audio'),('erc-consumer-08','cat-audio'),('erc-consumer-09','cat-audio'),
('erc-consumer-10','cat-audio'),('erc-consumer-11','cat-audio'),('erc-consumer-12','cat-audio'),
('erc-consumer-13','cat-audio'),('erc-consumer-14','cat-audio'),
('erc-business-01','cat-power'),('erc-business-02','cat-power'),('erc-business-03','cat-power'),
('erc-business-04','cat-power'),('erc-business-05','cat-power'),('erc-business-06','cat-power'),
('erc-business-16','cat-solar'),('erc-business-17','cat-solar'),
('erc-business-07','cat-electrical'),('erc-business-08','cat-electrical'),('erc-business-09','cat-electrical'),
('erc-business-10','cat-electrical'),('erc-business-11','cat-electrical'),('erc-business-12','cat-electrical'),
('erc-business-13','cat-electrical'),('erc-business-14','cat-electrical'),('erc-business-15','cat-electrical'),
('erc-business-18','cat-electrical'),
('erc-display-04','cat-accessories'),('erc-display-05','cat-accessories'),('erc-display-10','cat-accessories'),
('erc-display-18','cat-accessories')
)
update public.categories c
set parent_id=p.id,is_active=true
from map m join public.categories p on p.slug=m.parent_slug
where c.slug=m.child_slug;

-- Retire supplier-only root sections from navigation once their children are reassigned.
update public.categories set is_active=false
where slug in ('erc-display','erc-business','erc-consumer');
