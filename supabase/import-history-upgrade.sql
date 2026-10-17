-- Run once in Supabase SQL Editor. Safe to run again; no existing product is changed.
begin;
create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check(status in ('running','completed','partial','failed')),
  options jsonb not null default '{}'::jsonb,
  selected_count integer not null check(selected_count between 1 and 100),
  errors jsonb not null default '[]'::jsonb,
  unchanged_count integer not null default 0 check(unchanged_count>=0)
);
create table if not exists public.import_changes (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.import_runs(id),
  product_id bigint not null,
  sku text,
  product_name text,
  action text not null check(action in ('created','updated','images')),
  created_at timestamptz not null default now(),
  before_values jsonb,
  after_values jsonb not null
);
create index if not exists import_changes_run_idx on public.import_changes(run_id,id);
alter table public.import_runs enable row level security;
alter table public.import_changes enable row level security;
revoke all on public.import_runs,public.import_changes from anon,authenticated;
grant select on public.import_runs,public.import_changes to authenticated;
drop policy if exists "admins read import runs" on public.import_runs;
create policy "admins read import runs" on public.import_runs for select to authenticated using(public.is_admin());
drop policy if exists "admins read import changes" on public.import_changes;
create policy "admins read import changes" on public.import_changes for select to authenticated using(public.is_admin());

create or replace function public.start_product_import(p_options jsonb,p_count integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  insert into public.import_runs(actor_id,options,selected_count)
  values(auth.uid(),jsonb_build_object('price',p_options->'price','stock',p_options->'stock',
    'category',p_options->'category','description',p_options->'description',
    'specifications',p_options->'specifications','images',p_options->'images','publish',p_options->'publish'),p_count)
  returning id into result;
  return result;
end $$;

-- The product write and its history entry commit or roll back together.
-- Only the fields used by the importer are accepted. No arbitrary table/column names.
create or replace function public.apply_product_import(p_run uuid,p_id bigint,p_patch jsonb,p_expected jsonb default '{}'::jsonb,p_images boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  old_row public.products; new_row public.products;
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
  if p_id is not null then
    select * into old_row from public.products where id=p_id for update;
    if not found then raise exception 'Product no longer exists'; end if;
    old_json:=to_jsonb(old_row);
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
  return jsonb_build_object('id',new_row.id,'unchanged',after_data='{}'::jsonb);
end $$;

create or replace function public.finish_product_import(p_run uuid,p_errors jsonb,p_unchanged integer,p_failed boolean default false)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_errors is null or jsonb_typeof(p_errors)<>'array' then raise exception 'Invalid error list'; end if;
  update public.import_runs set finished_at=now(),errors=p_errors,unchanged_count=p_unchanged,
    status=case when p_failed or jsonb_array_length(p_errors)>0 then
      case when exists(select 1 from public.import_changes where run_id=p_run) then 'partial' else 'failed' end else 'completed' end
    where id=p_run and actor_id=auth.uid() and status='running';
  if not found then raise exception 'Import is not running or belongs to another user'; end if;
end $$;
revoke all on function public.start_product_import(jsonb,integer),public.apply_product_import(uuid,bigint,jsonb,jsonb,boolean),public.finish_product_import(uuid,jsonb,integer,boolean) from public,anon;
grant execute on function public.start_product_import(jsonb,integer),public.apply_product_import(uuid,bigint,jsonb,jsonb,boolean),public.finish_product_import(uuid,jsonb,integer,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
