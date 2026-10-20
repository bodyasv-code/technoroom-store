-- Apply after admin-users-upgrade.sql. No existing users are changed.
begin;
create table if not exists public.admin_user_change_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  target_id uuid not null,
  old_name text,new_name text,
  old_role text not null,new_role text not null,
  created_at timestamptz not null default now()
);
alter table public.admin_user_change_log enable row level security;
revoke all on public.admin_user_change_log from public,anon,authenticated;

create or replace function public.edit_admin_user(
  p_actor uuid,p_target uuid,p_name text,p_role text,p_expected_name text,p_expected_role text
) returns void language plpgsql security definer set search_path=public as $$
declare target public.profiles;
begin
  -- Serialize owner edits, then recheck the actor inside the same transaction.
  perform pg_advisory_xact_lock(hashtextextended('admin-user-role-edit',0));
  if not exists(select 1 from profiles where id=p_actor and role='owner') then
    raise exception 'Owner required' using errcode='42501';end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 120 or p_name ~ '[[:cntrl:]]'
    or p_role is null or p_role not in ('owner','manager') then
    raise exception 'Invalid edit' using errcode='22023';end if;
  select * into target from profiles where id=p_target for update;
  if not found then raise exception 'User not found' using errcode='P0002';end if;
  if target.full_name is distinct from p_expected_name or target.role::text is distinct from p_expected_role then
    raise exception 'Profile changed; refresh first' using errcode='40001';end if;
  if p_actor=p_target and target.role::text<>p_role then
    raise exception 'Cannot change own role' using errcode='23514';end if;
  if target.role='owner' and p_role<>'owner' and (select count(*) from profiles where role='owner')<=1 then
    raise exception 'Last owner must remain' using errcode='23514';end if;
  -- Invitation contents and unconsumed links must not disagree with the profile.
  if exists(select 1 from admin_user_invitations i join auth.users u on u.id=i.target_user_id
    where i.target_user_id=p_target and (u.last_sign_in_at is null or
      (i.status in ('preparing','ready') and i.updated_at>now()-interval '10 minutes'))) then
    raise exception 'Pending invitation; user must complete first' using errcode='55P03';end if;
  if target.full_name is not distinct from btrim(p_name) and target.role::text=p_role then return;end if;
  update profiles set full_name=btrim(p_name),role=p_role::public.user_role where id=p_target;
  insert into admin_user_change_log(actor_id,target_id,old_name,new_name,old_role,new_role)
    values(p_actor,p_target,target.full_name,btrim(p_name),target.role::text,p_role);
end $$;
revoke all on function public.edit_admin_user(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.edit_admin_user(uuid,uuid,text,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
