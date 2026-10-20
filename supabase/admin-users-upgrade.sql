-- Run in Supabase SQL Editor before enabling user invitations.
-- No existing account is created, removed, promoted or demoted.
begin;
-- The old self-update policy allowed changing role. Keep only name editing.
revoke insert,delete,update on public.profiles from public,anon,authenticated;
revoke update(id,role,created_at) on public.profiles from public,anon,authenticated;
grant select on public.profiles to authenticated;
grant update(full_name) on public.profiles to authenticated;

create table if not exists public.admin_user_invitations (
  id uuid not null unique default gen_random_uuid(),
  email text primary key check(email=lower(btrim(email)) and length(email)<=254),
  full_name text not null check(length(btrim(full_name)) between 1 and 120),
  role public.user_role not null default 'manager',
  created_by uuid not null references auth.users(id),
  target_user_id uuid references auth.users(id) on delete set null,
  attempt_id uuid not null,
  status text not null check(status in ('preparing','ready','accepted','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_user_invitations enable row level security;
revoke all on public.admin_user_invitations from public,anon,authenticated;

create or replace function public.claim_admin_user_invitation(
  p_actor uuid,p_email text,p_name text,p_role text,p_attempt uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare inv public.admin_user_invitations; target auth.users; code text:=lower(btrim(p_email));
begin
  if not exists(select 1 from profiles where id=p_actor and role='owner') then raise exception 'Owner required' using errcode='42501';end if;
  if code is null or length(code)>254 or code !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_name is null or length(btrim(p_name)) not between 1 and 120
    or p_role is null or p_role not in ('manager','owner') or p_attempt is null then raise exception 'Invalid invitation' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended('admin-invite-actor:'||p_actor::text,0));
  perform pg_advisory_xact_lock(hashtextextended('admin-invite-email:'||code,0));
  select * into inv from admin_user_invitations where email=code for update;
  if found then
    if inv.role::text<>p_role then raise exception 'Existing invitation has a different role';end if;
    if inv.updated_at>now()-interval '60 seconds' or (inv.status in ('preparing','ready') and inv.updated_at>now()-interval '10 minutes') then
      raise exception 'Invitation busy or cooldown' using errcode='55P03';
    end if;
  elsif (select count(*) from admin_user_invitations where created_by=p_actor and created_at>now()-interval '1 day')>=20 then
    raise exception 'Daily invitation limit reached' using errcode='55P03';
  end if;
  select * into target from auth.users where lower(email)=code limit 1;
  if found then
    -- Never silently grant access to an unrelated existing Auth account.
    if inv.id is null or not (coalesce(inv.target_user_id=target.id,false) or coalesce(target.raw_user_meta_data->>'technoroom_admin_invitation','')=inv.id::text) then
      raise exception 'Email already belongs to an existing account';
    end if;
    if target.last_sign_in_at is not null then raise exception 'User already signed in; use password recovery';end if;
  end if;
  if inv.id is null then
    insert into admin_user_invitations(email,full_name,role,created_by,attempt_id,status)
      values(code,btrim(p_name),p_role::public.user_role,p_actor,p_attempt,'preparing') returning * into inv;
  else
    update admin_user_invitations set attempt_id=p_attempt,status='preparing',updated_at=now()
      where email=code returning * into inv;
  end if;
  return jsonb_build_object('id',inv.id,'email',inv.email,'full_name',inv.full_name,
    'role',inv.role,'target_user_id',target.id);
end $$;

create or replace function public.bind_admin_user_invitation(p_actor uuid,p_id uuid,p_attempt uuid,p_target uuid)
returns void language plpgsql security definer set search_path=public as $$
declare inv public.admin_user_invitations;target auth.users;
begin
  if not exists(select 1 from profiles where id=p_actor and role='owner') then raise exception 'Owner required' using errcode='42501';end if;
  select * into inv from admin_user_invitations where id=p_id and attempt_id=p_attempt and status='preparing' for update;
  if not found then raise exception 'Invitation lease lost';end if;
  select * into target from auth.users where id=p_target and lower(email)=inv.email;
  if not found or not (coalesce(inv.target_user_id=p_target,false) or coalesce(target.raw_user_meta_data->>'technoroom_admin_invitation','')=inv.id::text) then
    raise exception 'Target does not belong to invitation';end if;
  insert into profiles(id,full_name,role) values(p_target,inv.full_name,inv.role) on conflict(id) do nothing;
  if not exists(select 1 from profiles where id=p_target and role=inv.role) then raise exception 'Profile role changed';end if;
  update admin_user_invitations set target_user_id=p_target,status='ready',updated_at=now() where id=inv.id;
end $$;

create or replace function public.finish_admin_user_invitation(p_actor uuid,p_id uuid,p_attempt uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from profiles where id=p_actor and role='owner') then raise exception 'Owner required' using errcode='42501';end if;
  if p_status is null or p_status not in ('accepted','failed') then raise exception 'Invalid status';end if;
  update admin_user_invitations set status=p_status,updated_at=now()
    where id=p_id and attempt_id=p_attempt and status in ('preparing','ready');
  if not found then raise exception 'Invitation lease lost';end if;
end $$;

create or replace function public.list_admin_users(p_actor uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not exists(select 1 from profiles where id=p_actor and role='owner') then raise exception 'Owner required' using errcode='42501';end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select p.id,u.email,p.full_name,p.role,p.created_at,u.last_sign_in_at,
      i.status invitation_status,(i.id is not null and u.last_sign_in_at is null) can_resend
    from profiles p join auth.users u on u.id=p.id
      left join admin_user_invitations i on i.target_user_id=p.id
    union all
    select null,i.email,i.full_name,i.role,i.created_at,null,i.status,true
    from admin_user_invitations i where i.target_user_id is null
  )x),'[]'::jsonb);
end $$;

-- Only the server service role may supply p_actor. A browser cannot impersonate
-- an owner by passing somebody else's UUID, even if it knows the UUID.
revoke all on function public.claim_admin_user_invitation(uuid,text,text,text,uuid),
  public.bind_admin_user_invitation(uuid,uuid,uuid,uuid),
  public.finish_admin_user_invitation(uuid,uuid,uuid,text),
  public.list_admin_users(uuid) from public,anon,authenticated;
grant execute on function public.claim_admin_user_invitation(uuid,text,text,text,uuid),
  public.bind_admin_user_invitation(uuid,uuid,uuid,uuid),
  public.finish_admin_user_invitation(uuid,uuid,uuid,text),
  public.list_admin_users(uuid) to service_role;
notify pgrst,'reload schema';
commit;
select count(*)filter(where role='owner') owners,count(*)filter(where role='manager') managers from public.profiles;
