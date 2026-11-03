begin;
alter table public.work_logs alter column mat_type_id drop not null;
alter table public.labor_rate_history alter column mat_type_id drop not null;
create unique index stage_default_rate_date on public.labor_rate_history(stage_id,effective_from) where mat_type_id is null and worker_id is null;
create unique index stage_worker_rate_date on public.labor_rate_history(stage_id,worker_id,effective_from) where mat_type_id is null and worker_id is not null;
create function public.work_mat_scope(p_stage uuid,p_mat uuid) returns uuid language plpgsql stable security definer set search_path='' as $$
declare stage_code text;
begin
 select code into stage_code from public.production_stages where id=p_stage and active;
 if not found then raise exception 'INACTIVE_CATALOG';end if;
 if stage_code='WEAVING' then
  if p_mat is null or not exists(select 1 from public.mat_types where id=p_mat and active) then raise exception 'INACTIVE_CATALOG';end if;
  return p_mat;
 end if;
 return null;
end $$;
revoke all on function public.work_mat_scope(uuid,uuid) from public,anon,authenticated;
-- Carry forward only unambiguous stage prices. Conflicting mat-specific prices require manager setup.
insert into public.labor_rate_history(mat_type_id,stage_id,worker_id,effective_from,unit_rate,created_by)
select null,r.stage_id,r.worker_id,r.effective_from,min(r.unit_rate),(array_agg(r.created_by order by r.created_at))[1]
from public.labor_rate_history r join public.production_stages s on s.id=r.stage_id
where s.code<>'WEAVING' and r.mat_type_id is not null
group by r.stage_id,r.worker_id,r.effective_from having count(distinct r.unit_rate)=1;

create or replace function public.add_labor_rate(p_mat uuid,p_stage uuid,p_worker uuid,p_date date,p_rate bigint) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
 p_mat:=public.work_mat_scope(p_stage,p_mat);
 if not public.is_manager() then raise exception 'FORBIDDEN'; end if;
 if p_date is null or p_date < date '2000-01-01' or p_date > date '2100-12-31' then raise exception 'INVALID_DATE'; end if;
 -- Stage and optional mat scope are validated above.
 if p_worker is not null and not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where r.user_id=p_worker and r.role='WORKER' and p.active) then raise exception 'INVALID_WORKER'; end if;
 insert into public.labor_rate_history(mat_type_id,stage_id,worker_id,effective_from,unit_rate,created_by) values(p_mat,p_stage,p_worker,p_date,p_rate,auth.uid()) returning id into result;
 return result;
end $$;
create or replace function public.submit_work(p_date date,p_stage uuid,p_mat uuid,p_quantity integer,p_key uuid,p_expected_rate bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; applied public.labor_rate_history; zero_policy boolean;
begin
 p_mat:=public.work_mat_scope(p_stage,p_mat);
 if not public.has_role('WORKER') then raise exception 'FORBIDDEN'; end if;
 -- Serialize same user's submissions to make retries safe, including concurrent requests.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into applied from public.labor_rate_history where false;
 select id into result from public.work_logs where worker_id=auth.uid() and idempotency_key=p_key;
 if result is not null then
 if not exists(select 1 from public.work_logs where id=result and work_date=p_date and stage_id=p_stage and mat_type_id is not distinct from p_mat and quantity=p_quantity) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 return result; end if;
 if p_key is null or p_date is null or p_date < date '2000-01-01' or p_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'INVALID_DATE'; end if;
 if p_quantity is null or p_quantity not between 1 and 1000000 then raise exception 'INVALID_QUANTITY'; end if;
 if not exists(select 1 from public.worker_skills where user_id=auth.uid() and stage_id=p_stage) then raise exception 'SKILL_REQUIRED'; end if;
 -- Stage and optional mat scope are validated above.
 select (zero_wage and public.has_role('OWNER')) into zero_policy from public.profiles where id=auth.uid();
 select * into applied from public.labor_rate_history where mat_type_id is not distinct from p_mat and stage_id=p_stage and effective_from<=p_date and (worker_id is null or worker_id=auth.uid()) order by (worker_id is not null) desc,effective_from desc limit 1;
 if not zero_policy and applied.id is null then raise exception 'RATE_NOT_FOUND'; end if;
 if p_expected_rate is null or p_expected_rate <> (case when zero_policy then 0 else applied.unit_rate end) then raise exception 'RATE_CHANGED'; end if;
 insert into public.work_logs(worker_id,work_date,stage_id,mat_type_id,quantity,labor_rate_id,unit_rate,zero_wage_applied,idempotency_key)
 values(auth.uid(),p_date,p_stage,p_mat,p_quantity,applied.id,case when zero_policy then 0 else applied.unit_rate end,zero_policy,p_key) returning id into result;
 return result;
end $$;
create or replace function public.resubmit_work(p_id uuid,p_version integer,p_date date,p_stage uuid,p_mat uuid,p_quantity integer,p_expected_rate bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare w public.work_logs;r public.labor_rate_history;zero_policy boolean;rate bigint;
begin
 p_mat:=public.work_mat_scope(p_stage,p_mat);
 if not public.has_role('WORKER') then raise exception 'FORBIDDEN'; end if;
 select * into w from public.work_logs where id=p_id and worker_id=auth.uid() for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if p_version is null or w.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
 if w.status not in ('DRAFT','REJECTED') then raise exception 'INVALID_TRANSITION'; end if;
 if p_date is null or p_date<date '2000-01-01' or p_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'INVALID_DATE'; end if;
 if p_quantity is null or p_quantity not between 1 and 1000000 then raise exception 'INVALID_QUANTITY'; end if;
 if not exists(select 1 from public.worker_skills where user_id=auth.uid() and stage_id=p_stage) then raise exception 'SKILL_REQUIRED'; end if;
 -- Stage and optional mat scope are validated above.
 select zero_wage and public.has_role('OWNER') into zero_policy from public.profiles where id=auth.uid();
 select * into r from public.labor_rate_history where mat_type_id is not distinct from p_mat and stage_id=p_stage and effective_from<=p_date and (worker_id is null or worker_id=auth.uid()) order by (worker_id is not null) desc,effective_from desc limit 1;
 if not zero_policy and r.id is null then raise exception 'RATE_NOT_FOUND'; end if;
 rate:=case when zero_policy then 0 else r.unit_rate end;
 if p_expected_rate is null or p_expected_rate<>rate then raise exception 'RATE_CHANGED'; end if;
 update public.work_logs set work_date=p_date,stage_id=p_stage,mat_type_id=p_mat,quantity=p_quantity,labor_rate_id=r.id,unit_rate=rate,zero_wage_applied=zero_policy,status='SUBMITTED',version=version+1,reviewed_by=null,reviewed_at=null,review_reason=null,updated_at=now() where id=p_id;
 return p_id;
end $$;
notify pgrst,'reload schema';
commit;
