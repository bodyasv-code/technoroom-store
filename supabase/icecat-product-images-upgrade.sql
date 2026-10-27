-- Run after import-history-upgrade.sql and product-manual-overrides-upgrade.sql.
-- Append-only image import for existing administrators. No product is changed by setup.
begin;
create or replace function public.append_product_content_image(p_run uuid,p_id bigint,p_path text,p_expected jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  old_row public.products; old_json jsonb; field text; previous_mode text;
  new_main text; new_gallery jsonb; before_data jsonb; after_data jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Access denied' using errcode='42501';end if;
  perform 1 from public.import_runs where id=p_run and actor_id=auth.uid() and status='running' for update;
  if not found then raise exception 'Import is not running or belongs to another user';end if;
  if p_id is null or p_id<=0 or p_path is null or p_path !~ ('^products/icecat/'||p_id::text||'/[a-f0-9]{64}\.(jpg|png|webp)$') then raise exception 'Invalid image path';end if;
  if jsonb_typeof(p_expected) is distinct from 'object' or not (p_expected ?& array['sku','brand','name','image_path','image_paths','manual_overrides']) then raise exception 'Missing expected values';end if;
  if exists(select 1 from jsonb_object_keys(p_expected) k where k not in ('sku','brand','name','image_path','image_paths','manual_overrides')) then raise exception 'Unexpected field';end if;
  select * into old_row from public.products where id=p_id for update;
  if not found then raise exception 'Product no longer exists';end if;
  old_json:=to_jsonb(old_row);
  for field in select jsonb_object_keys(p_expected) loop
    if coalesce(old_json->field,'null'::jsonb) is distinct from p_expected->field then raise exception 'Product changed after preview' using errcode='40001';end if;
  end loop;
  if coalesce(old_json->'manual_overrides'->>'images','false')<>'false'
     or coalesce(old_json->'manual_overrides'->>'image_path','false')<>'false'
     or coalesce(old_json->'manual_overrides'->>'image_paths','false')<>'false' then raise exception 'Images are manually protected';end if;
  new_gallery:=coalesce(nullif(old_row.image_paths,'null'::jsonb),'[]'::jsonb);
  if jsonb_typeof(new_gallery)<>'array' or exists(select 1 from jsonb_array_elements(new_gallery) e where jsonb_typeof(e)<>'string') then raise exception 'Invalid existing gallery';end if;
  if old_row.image_path=p_path or new_gallery ? p_path then return jsonb_build_object('id',p_id,'unchanged',true);end if;
  if jsonb_array_length(new_gallery)>=30 then raise exception 'Gallery limit reached';end if;
  new_main:=coalesce(nullif(old_row.image_path,''),nullif(new_gallery->>0,''),p_path);
  new_gallery:=new_gallery||jsonb_build_array(p_path);
  before_data:=jsonb_build_object('image_path',old_row.image_path,'image_paths',old_row.image_paths);
  after_data:=jsonb_build_object('image_path',new_main,'image_paths',new_gallery);
  previous_mode:=current_setting('technoroom.import_write',true);
  perform set_config('technoroom.import_write','true',true);
  update public.products set image_path=new_main,image_paths=new_gallery where id=p_id;
  -- Side-effecting triggers must not turn this into an unrelated product edit.
  if (select to_jsonb(p)-'image_path'-'image_paths' from public.products p where id=p_id) is distinct from (old_json-'image_path'-'image_paths') then raise exception 'Unexpected product side effect';end if;
  insert into public.import_changes(run_id,product_id,sku,product_name,action,before_values,after_values)
    values(p_run,p_id,old_row.sku,old_row.name,'images',before_data,after_data);
  perform set_config('technoroom.import_write',coalesce(previous_mode,''),true);
  return jsonb_build_object('id',p_id,'unchanged',false);
end $$;
revoke all on function public.append_product_content_image(uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.append_product_content_image(uuid,bigint,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
