begin;
create function public.manage_worker(p_user uuid,p_skills uuid[],p_active boolean,p_username text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare target public.profiles;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_user=auth.uid() then raise exception 'SELF_PERMISSION_CHANGE';end if;
 if length(trim(coalesce(p_reason,'')))<5 or length(p_reason)>1000 or p_active is null or p_skills is null then raise exception 'REASON_REQUIRED';end if;
 select * into target from public.profiles where id=p_user for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if not public.has_role('ADMIN') and exists(select 1 from public.user_roles where user_id=p_user and role in ('ADMIN','OWNER')) then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.user_roles where user_id=p_user and role='WORKER') then raise exception 'INVALID_WORKER';end if;
 if exists(select 1 from unnest(p_skills) s where not exists(select 1 from public.production_stages where id=s and active)) or (select count(*) from unnest(p_skills))<>(select count(distinct s) from unnest(p_skills) s) then raise exception 'INVALID_SKILL';end if;
 perform set_config('app.audit_reason',p_reason,true);
 -- Role assignments are never modified by this operation.
 delete from public.worker_skills where user_id=p_user;
 insert into public.worker_skills(user_id,stage_id) select p_user,unnest(p_skills);
 update public.profiles set active=p_active,username=lower(trim(p_username)),updated_at=now() where id=p_user;
 return p_user;
end $$;
revoke all on function public.manage_worker(uuid,uuid[],boolean,text,text) from public,anon,authenticated;
grant execute on function public.manage_worker(uuid,uuid[],boolean,text,text) to authenticated;
commit;
