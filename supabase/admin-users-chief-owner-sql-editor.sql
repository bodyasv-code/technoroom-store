-- SQL Editor version: replace the ENTIRE editor contents with this file.
-- Run after admin-users-upgrade.sql and admin-users-edit-upgrade.sql.
-- Only bodyasv@gmail.com may manage admin users. No roles or passwords change.
begin;
do '
declare signature text; definition text;
  old_guard text:=''if not exists(select 1 from profiles where id=p_actor and role=''''owner'''')'';
  new_guard text:=''if not exists(select 1 from profiles p join auth.users u on u.id=p.id where p.id=p_actor and p.role=''''owner'''' and lower(u.email)=''''bodyasv@gmail.com'''')'';
begin
  if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id
    where lower(u.email)=''bodyasv@gmail.com'' and p.role=''owner'') then
    raise exception ''bodyasv@gmail.com must already have an owner profile. Nothing changed.'';
  end if;
  foreach signature in array array[
    ''public.claim_admin_user_invitation(uuid,text,text,text,uuid)'',
    ''public.bind_admin_user_invitation(uuid,uuid,uuid,uuid)'',
    ''public.finish_admin_user_invitation(uuid,uuid,uuid,text)'',
    ''public.list_admin_users(uuid)'',
    ''public.edit_admin_user(uuid,uuid,text,text,text,text)''
  ] loop
    if to_regprocedure(signature) is null then raise exception ''Apply earlier admin user migrations first: %'',signature;end if;
    definition:=pg_get_functiondef(to_regprocedure(signature));
    if strpos(definition,old_guard)>0 then definition:=replace(definition,old_guard,new_guard);end if;
    if strpos(definition,new_guard)=0 then raise exception ''Unexpected function definition; no changes applied: %'',signature;end if;
    execute definition;
    execute format(''revoke all on function %s from public,anon,authenticated'',signature);
    execute format(''grant execute on function %s to service_role'',signature);
  end loop;
end;
';
notify pgrst,'reload schema';
commit;
select u.email,p.role,'Головний власник — керування користувачами' as access
from public.profiles p join auth.users u on u.id=p.id where lower(u.email)='bodyasv@gmail.com' and p.role='owner';
