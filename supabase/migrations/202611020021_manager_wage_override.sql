begin;
alter table public.work_logs add column rate_override_reason text;
create or replace function public.guard_approved_work() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status in ('APPROVED','LOCKED') then
  if old.status='LOCKED' or exists(select 1 from public.wage_payment_allocations where work_log_id=old.id) then
   if row(new.worker_id,new.work_date,new.stage_id,new.mat_type_id,new.quantity,new.unit_rate,new.labor_rate_id,new.zero_wage_applied,new.status) is distinct from row(old.worker_id,old.work_date,old.stage_id,old.mat_type_id,old.quantity,old.unit_rate,old.labor_rate_id,old.zero_wage_applied,old.status) then raise exception 'WORK_ALREADY_PAID_OR_LOCKED';end if;
  elsif row(new.worker_id,new.work_date,new.stage_id,new.mat_type_id,new.labor_rate_id,new.zero_wage_applied) is distinct from row(old.worker_id,old.work_date,old.stage_id,old.mat_type_id,old.labor_rate_id,old.zero_wage_applied) or new.status not in ('APPROVED','LOCKED') or (new.unit_rate<>old.unit_rate and not public.is_manager()) then raise exception 'IMMUTABLE_WORK';end if;
 end if;return new;
end $$;
create function public.override_work_rate(p_id uuid,p_version integer,p_rate bigint,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare w public.work_logs;worker uuid;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_rate is null or p_rate not between 0 and 1000000000 or length(trim(coalesce(p_reason,'')))<5 or length(p_reason)>1000 then raise exception 'INVALID_INPUT';end if;
 select worker_id into worker from public.work_logs where id=p_id;if not found then raise exception 'NOT_FOUND';end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll:'||worker::text,0));
 select * into w from public.work_logs where id=p_id for update;
 if w.version is distinct from p_version then raise exception 'VERSION_CONFLICT';end if;
 if w.status='LOCKED' or exists(select 1 from public.wage_payment_allocations where work_log_id=p_id) or exists(select 1 from public.wage_receipt_items where work_log_id=p_id) then raise exception 'WORK_ALREADY_PAID_OR_LOCKED';end if;
 perform set_config('app.audit_reason',p_reason,true);
 update public.work_logs set unit_rate=p_rate,rate_override_reason=p_reason,version=version+1,updated_at=now() where id=p_id;return p_id;
end $$;
revoke all on function public.override_work_rate(uuid,integer,bigint,text) from public,anon,authenticated;
grant execute on function public.override_work_rate(uuid,integer,bigint,text) to authenticated;
notify pgrst,'reload schema';
commit;
