begin;
-- Called only by the server's secret client after verifying the acting user's session.
create function public.provision_worker(p_actor uuid,p_user uuid,p_skills uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.profiles where id=p_actor and active for update;
 if not found or not exists(select 1 from public.user_roles where user_id=p_actor and role in ('ADMIN','OWNER')) then raise exception 'FORBIDDEN'; end if;
 if p_actor=p_user or exists(select 1 from public.user_roles where user_id=p_user) then raise exception 'INVALID_TARGET'; end if;
 if exists(select 1 from unnest(p_skills) s where not exists(select 1 from public.production_stages where id=s and active)) then raise exception 'INVALID_SKILL'; end if;
 insert into public.user_roles(user_id,role) values(p_user,'WORKER');
 insert into public.worker_skills(user_id,stage_id) select p_user,unnest(p_skills);
 insert into public.audit_logs(actor_id,action,entity_name,entity_id,new_values,reason)
 values(p_actor,'PROVISION','profiles',p_user,jsonb_build_object('role','WORKER','skills',p_skills),'Tạo tài khoản thợ');
end $$;
revoke all on function public.provision_worker(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.provision_worker(uuid,uuid,uuid[]) to service_role;
commit;
