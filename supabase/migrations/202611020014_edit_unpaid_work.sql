begin;
create or replace function public.guard_approved_work() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status in ('APPROVED','LOCKED') then
  if old.status='LOCKED' or exists(select 1 from public.wage_payment_allocations where work_log_id=old.id) then
   if row(new.worker_id,new.work_date,new.stage_id,new.mat_type_id,new.quantity,new.unit_rate,new.labor_rate_id,new.zero_wage_applied,new.status) is distinct from row(old.worker_id,old.work_date,old.stage_id,old.mat_type_id,old.quantity,old.unit_rate,old.labor_rate_id,old.zero_wage_applied,old.status) then raise exception 'WORK_ALREADY_PAID_OR_LOCKED';end if;
  elsif row(new.worker_id,new.work_date,new.stage_id,new.mat_type_id,new.unit_rate,new.labor_rate_id,new.zero_wage_applied) is distinct from row(old.worker_id,old.work_date,old.stage_id,old.mat_type_id,old.unit_rate,old.labor_rate_id,old.zero_wage_applied) or new.status not in ('APPROVED','LOCKED') then raise exception 'IMMUTABLE_WORK';end if;
 end if;return new;
end $$;
create function public.edit_work_quantity(p_id uuid,p_version integer,p_quantity integer,p_stage uuid default null,p_mat uuid default null,p_date date default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare w public.work_logs;
begin
 if not public.has_role('WORKER') then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll:'||auth.uid()::text,0));
 select * into w from public.work_logs where id=p_id and worker_id=auth.uid() for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if w.version is distinct from p_version then raise exception 'VERSION_CONFLICT';end if;
 if w.status='LOCKED' or exists(select 1 from public.wage_payment_allocations where work_log_id=p_id) then raise exception 'WORK_ALREADY_PAID_OR_LOCKED';end if;
 if w.status not in ('APPROVED','SUBMITTED') then raise exception 'INVALID_TRANSITION';end if;
 if p_quantity is null or p_quantity not between 1 and 1000000 then raise exception 'INVALID_QUANTITY';end if;
 if (p_stage is not null and p_stage<>w.stage_id) or (p_mat is not null and p_mat<>w.mat_type_id) or (p_date is not null and p_date<>w.work_date) then raise exception 'QUANTITY_ONLY';end if;
 perform set_config('app.audit_reason','Người làm cập nhật số lượng công chưa thanh toán',true);
 update public.work_logs set quantity=p_quantity,status='APPROVED',version=version+1,updated_at=now() where id=p_id;
 return p_id;
end $$;
revoke all on function public.edit_work_quantity(uuid,integer,integer,uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.edit_work_quantity(uuid,integer,integer,uuid,uuid,date) to authenticated;
notify pgrst,'reload schema';
commit;
