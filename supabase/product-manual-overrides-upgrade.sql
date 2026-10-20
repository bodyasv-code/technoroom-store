-- Run after import-history-upgrade.sql. Repeatable. No historical product is labelled as manual.
begin;
alter table public.products add column if not exists manual_overrides jsonb not null default '{}'::jsonb;
do $$begin
  if not exists(select 1 from pg_constraint where conrelid='public.products'::regclass and conname='products_manual_overrides_object') then
    alter table public.products add constraint products_manual_overrides_object check(jsonb_typeof(manual_overrides)='object');
  end if;
end $$;
create or replace function public.track_product_manual_overrides()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  marks jsonb; spec_marks jsonb; old_specs jsonb; new_specs jsonb; spec_key text;
begin
  marks:=case when tg_op='UPDATE' then coalesce(old.manual_overrides,'{}'::jsonb) else '{}'::jsonb end;
  new.manual_overrides:=marks;
  -- All importer RPC writes are explicitly scoped and do not acquire manual labels.
  if current_setting('technoroom.import_write',true)='true' or auth.uid() is null or not public.is_admin() then return new;end if;
  if tg_op='INSERT' then
    if nullif(new.category,'') is not null then marks:=marks||'{"category":true}'::jsonb;end if;
    if nullif(new.brand,'') is not null or new.brand_id is not null then marks:=marks||'{"brand":true}'::jsonb;end if;
    old_specs:='{}'::jsonb;
  else
    if new.category is distinct from old.category then marks:=marks||'{"category":true}'::jsonb;end if;
    if new.brand is distinct from old.brand or new.brand_id is distinct from old.brand_id then marks:=marks||'{"brand":true}'::jsonb;end if;
    old_specs:=coalesce(old.specifications,'{}'::jsonb);
  end if;
  new_specs:=coalesce(new.specifications,'{}'::jsonb);
  spec_marks:=coalesce(marks->'specifications','{}'::jsonb);
  for spec_key in select jsonb_object_keys(old_specs||new_specs) loop
    if coalesce(old_specs->spec_key,'null'::jsonb) is distinct from coalesce(new_specs->spec_key,'null'::jsonb) then
      spec_marks:=spec_marks||jsonb_build_object(spec_key,true);
    end if;
  end loop;
  if spec_marks<>'{}'::jsonb then marks:=marks||jsonb_build_object('specifications',spec_marks);end if;
  new.manual_overrides:=marks;
  return new;
end $$;
revoke all on function public.track_product_manual_overrides() from public,anon,authenticated;
drop trigger if exists track_product_manual_overrides on public.products;
create trigger track_product_manual_overrides before insert or update on public.products
for each row execute function public.track_product_manual_overrides();

create or replace function public.apply_product_import(p_run uuid,p_id bigint,p_patch jsonb,p_expected jsonb default '{}'::jsonb,p_images boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  old_row public.products; new_row public.products;
  manual jsonb; manual_key text; previous_mode text;
  allowed text[]; field text; assignments text;
  before_data jsonb; after_data jsonb; old_json jsonb; new_json jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  perform 1 from public.import_runs where id=p_run and actor_id=auth.uid() and status='running' for update;
  if not found then raise exception 'Import is not running or belongs to another user'; end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then raise exception 'Empty or invalid product patch'; end if;
  allowed:=case when p_images then array['image_path','image_paths']
    when p_id is null then array['name','slug','sku','brand_id','brand','category','price','stock_quantity','in_stock','availability_status','description','specifications','is_active']
    else array['category','price','stock_quantity','in_stock','availability_status','description','specifications'] end;
  for field in select jsonb_object_keys(p_patch) loop
    if not field=any(allowed) then raise exception 'Unsupported import field: %',field; end if;
  end loop;
  if p_images and p_id is null then raise exception 'Images require an existing product'; end if;
  previous_mode:=current_setting('technoroom.import_write',true);
  perform set_config('technoroom.import_write','true',true);
  if p_id is not null then
    select * into old_row from public.products where id=p_id for update;
    if not found then raise exception 'Product no longer exists'; end if;
    old_json:=to_jsonb(old_row);
    manual:=coalesce(old_json->'manual_overrides','{}'::jsonb);
    if manual->'category'='true'::jsonb and p_patch ? 'category'
       and old_json->'category' is distinct from p_patch->'category' then
      raise exception 'Category was corrected manually. Refresh import preview.' using errcode='40001';
    end if;
    if p_patch ? 'specifications' then
      for manual_key in select jsonb_object_keys(coalesce(manual->'specifications','{}'::jsonb)) loop
        if coalesce(old_row.specifications->manual_key,'null'::jsonb) is distinct from
           coalesce(p_patch->'specifications'->manual_key,'null'::jsonb) then
          raise exception 'Specification was corrected manually: %',manual_key using errcode='40001';
        end if;
      end loop;
    end if;
    if jsonb_typeof(p_expected) is distinct from 'object' then raise exception 'Missing expected values'; end if;
    for field in select jsonb_object_keys(p_patch) loop
      if not p_expected ? field then raise exception 'Missing expected field: %',field; end if;
    end loop;
    if not p_expected ? 'sku' then raise exception 'Missing expected SKU'; end if;
    for field in select jsonb_object_keys(p_expected) loop
      if coalesce(old_json->field,'null'::jsonb) is distinct from p_expected->field then
        raise exception 'Product changed after preview. Refresh and retry.' using errcode='40001';
      end if;
    end loop;
    if p_images and (nullif(old_row.image_path,'') is not null or jsonb_array_length(coalesce(nullif(old_json->'image_paths','null'::jsonb),'[]'::jsonb))>0) then
      raise exception 'Existing photos must be preserved';
    end if;
    select string_agg(format('%I=(jsonb_populate_record(null::public.products,$1)).%I',key,key),',')
      into assignments from jsonb_object_keys(p_patch) as keys(key);
    execute 'update public.products set '||assignments||' where id=$2 returning *' into new_row using p_patch,p_id;
  else
    new_row:=jsonb_populate_record(null::public.products,p_patch);
    insert into public.products(name,slug,sku,brand_id,brand,category,price,stock_quantity,in_stock,availability_status,description,specifications,is_active)
      values(new_row.name,new_row.slug,new_row.sku,new_row.brand_id,new_row.brand,new_row.category,new_row.price,new_row.stock_quantity,
        new_row.in_stock,new_row.availability_status,new_row.description,coalesce(new_row.specifications,'{}'::jsonb),coalesce(new_row.is_active,false))
      returning * into new_row;
  end if;
  new_json:=to_jsonb(new_row);
  select coalesce(jsonb_object_agg(key,coalesce(old_json->key,'null'::jsonb)),'{}'::jsonb),
         coalesce(jsonb_object_agg(key,new_json->key),'{}'::jsonb)
    into before_data,after_data from jsonb_object_keys(p_patch) as keys(key)
    where p_id is null or coalesce(old_json->key,'null'::jsonb) is distinct from new_json->key;
  if after_data<>'{}'::jsonb then
    insert into public.import_changes(run_id,product_id,sku,product_name,action,before_values,after_values)
      values(p_run,new_row.id,new_row.sku,new_row.name,case when p_images then 'images' when p_id is null then 'created' else 'updated' end,
        case when p_id is null then null else before_data end,after_data);
  end if;
  perform set_config('technoroom.import_write',coalesce(previous_mode,''),true);
  return jsonb_build_object('id',new_row.id,'unchanged',after_data='{}'::jsonb);
end $$;
notify pgrst,'reload schema';
commit;

