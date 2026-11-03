begin;
create function public.provision_account(p_actor uuid,p_user uuid,p_roles public.app_role[],p_skills uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare actor_admin boolean;
begin
 perform 1 from public.profiles where id=p_actor and active for update;
 if not found or not exists(select 1 from public.user_roles where user_id=p_actor and role in ('ADMIN','OWNER')) then raise exception 'FORBIDDEN';end if;
 select exists(select 1 from public.user_roles where user_id=p_actor and role='ADMIN') into actor_admin;
 if p_roles is null or cardinality(p_roles)=0 or array_position(p_roles,null) is not null or p_skills is null then raise exception 'INVALID_INPUT';end if;
 if not actor_admin and p_roles<>array['WORKER']::public.app_role[] then raise exception 'FORBIDDEN';end if;
 if p_actor=p_user or not exists(select 1 from public.profiles where id=p_user) or exists(select 1 from public.user_roles where user_id=p_user) then raise exception 'INVALID_TARGET';end if;
 if cardinality(p_skills)>0 and not ('WORKER'=any(p_roles)) then raise exception 'SKILL_REQUIRED';end if;
 if exists(select 1 from unnest(p_skills) s where not exists(select 1 from public.production_stages where id=s and active)) then raise exception 'INVALID_SKILL';end if;
 insert into public.user_roles(user_id,role) select p_user,r from (select distinct unnest(p_roles) r) roles;
 insert into public.worker_skills(user_id,stage_id) select p_user,s from (select distinct unnest(p_skills) s) skills;
 insert into public.audit_logs(actor_id,action,entity_name,entity_id,new_values,reason) values(p_actor,'PROVISION','profiles',p_user,jsonb_build_object('roles',p_roles,'skills',p_skills),'Tạo tài khoản và phân vai trò');
end $$;
revoke all on function public.provision_account(uuid,uuid,public.app_role[],uuid[]) from public,anon,authenticated;
grant execute on function public.provision_account(uuid,uuid,public.app_role[],uuid[]) to service_role;
notify pgrst, 'reload schema';
commit;
