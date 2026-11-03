begin;
create function public.update_member(p_user uuid,p_name text,p_username text,p_phone text,p_roles public.app_role[],p_skills uuid[],p_active boolean,p_zero boolean,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_user=auth.uid() then raise exception 'SELF_PERMISSION_CHANGE';end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 120 or length(coalesce(p_phone,''))>30 or p_username is null or p_roles is null or cardinality(p_roles)=0 or array_position(p_roles,null) is not null or p_skills is null or p_active is null or p_zero is null then raise exception 'INVALID_INPUT';end if;
 if length(trim(coalesce(p_reason,'')))<5 or length(p_reason)>1000 then raise exception 'REASON_REQUIRED';end if;
 perform 1 from public.profiles where id=p_user for update;if not found then raise exception 'NOT_FOUND';end if;
 if public.has_role('ADMIN') then
  perform public.configure_member(p_user,p_roles,p_skills,p_zero,p_active,p_reason);
 else
  if p_roles<>array['WORKER']::public.app_role[] or p_zero then raise exception 'FORBIDDEN';end if;
  perform public.manage_worker(p_user,p_skills,p_active,p_username,p_reason);
 end if;
 perform set_config('app.audit_reason',p_reason,true);
 update public.profiles set full_name=trim(p_name),username=lower(trim(p_username)),phone=p_phone,updated_at=now() where id=p_user;
 return p_user;
end $$;
revoke all on function public.update_member(uuid,text,text,text,public.app_role[],uuid[],boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.update_member(uuid,text,text,text,public.app_role[],uuid[],boolean,boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;
