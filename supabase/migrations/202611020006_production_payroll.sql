begin;
alter table public.work_logs add column version integer not null default 1;
alter table public.work_logs add column reviewed_by uuid references public.profiles(id);
alter table public.work_logs add column reviewed_at timestamptz;
alter table public.work_logs add column review_reason text;

create table public.wage_payments (
 id uuid primary key default gen_random_uuid(),worker_id uuid not null references public.profiles(id),
 payment_date date not null,amount bigint not null check(amount between 1 and 1000000000000000),
 method text not null check(method in ('CASH','BANK')),notes text,
 created_by uuid not null references public.profiles(id),idempotency_key uuid not null,
 request_payload jsonb not null,created_at timestamptz not null default now(),unique(created_by,idempotency_key)
);
create table public.wage_payment_allocations (
 id uuid primary key default gen_random_uuid(),payment_id uuid not null references public.wage_payments(id),
 work_log_id uuid not null references public.work_logs(id),amount bigint not null check(amount>0),unique(payment_id,work_log_id)
);
create index wage_worker_date on public.wage_payments(worker_id,payment_date desc);
create index wage_alloc_work on public.wage_payment_allocations(work_log_id);
alter table public.wage_payments enable row level security;
alter table public.wage_payment_allocations enable row level security;
revoke all on public.wage_payments,public.wage_payment_allocations from anon,authenticated;
grant select on public.wage_payments,public.wage_payment_allocations to authenticated;
create policy wages_read on public.wage_payments for select to authenticated using(public.is_manager() or (public.has_role('WORKER') and worker_id=auth.uid()));
create policy allocations_read on public.wage_payment_allocations for select to authenticated using(exists(select 1 from public.wage_payments p where p.id=payment_id));
create trigger audit_changes after insert or update or delete on public.wage_payments for each row execute function public.audit_change();
create trigger audit_changes after insert or update or delete on public.wage_payment_allocations for each row execute function public.audit_change();

create function public.review_work(p_id uuid,p_version integer,p_decision text,p_reason text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare w public.work_logs;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN'; end if;
 select * into w from public.work_logs where id=p_id for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if p_version is null or w.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
 if p_decision is null or p_decision not in ('APPROVE','REJECT','LOCK') then raise exception 'INVALID_TRANSITION'; end if;
 if p_decision in ('APPROVE','REJECT') and w.status<>'SUBMITTED' then raise exception 'INVALID_TRANSITION'; end if;
 if p_decision='LOCK' and w.status<>'APPROVED' then raise exception 'INVALID_TRANSITION'; end if;
 if p_decision='REJECT' and length(trim(coalesce(p_reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
 if length(coalesce(p_reason,''))>1000 then raise exception 'INVALID_INPUT'; end if;
 perform set_config('app.audit_reason',coalesce(p_reason,''),true);
 update public.work_logs set status=(case p_decision when 'APPROVE' then 'APPROVED' when 'REJECT' then 'REJECTED' else 'LOCKED' end)::public.work_status,
 reviewed_by=auth.uid(),reviewed_at=now(),review_reason=p_reason,version=version+1,updated_at=now() where id=p_id;
 return p_id;
end $$;

create function public.resubmit_work(p_id uuid,p_version integer,p_date date,p_stage uuid,p_mat uuid,p_quantity integer,p_expected_rate bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare w public.work_logs;r public.labor_rate_history;zero_policy boolean;rate bigint;
begin
 if not public.has_role('WORKER') then raise exception 'FORBIDDEN'; end if;
 select * into w from public.work_logs where id=p_id and worker_id=auth.uid() for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if p_version is null or w.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
 if w.status not in ('DRAFT','REJECTED') then raise exception 'INVALID_TRANSITION'; end if;
 if p_date is null or p_date<date '2000-01-01' or p_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'INVALID_DATE'; end if;
 if p_quantity is null or p_quantity not between 1 and 1000000 then raise exception 'INVALID_QUANTITY'; end if;
 if not exists(select 1 from public.worker_skills where user_id=auth.uid() and stage_id=p_stage) then raise exception 'SKILL_REQUIRED'; end if;
 if not exists(select 1 from public.mat_types where id=p_mat and active) or not exists(select 1 from public.production_stages where id=p_stage and active) then raise exception 'INACTIVE_CATALOG'; end if;
 select zero_wage and public.has_role('OWNER') into zero_policy from public.profiles where id=auth.uid();
 select * into r from public.labor_rate_history where mat_type_id=p_mat and stage_id=p_stage and effective_from<=p_date and (worker_id is null or worker_id=auth.uid()) order by (worker_id is not null) desc,effective_from desc limit 1;
 if not zero_policy and r.id is null then raise exception 'RATE_NOT_FOUND'; end if;
 rate:=case when zero_policy then 0 else r.unit_rate end;
 if p_expected_rate is null or p_expected_rate<>rate then raise exception 'RATE_CHANGED'; end if;
 update public.work_logs set work_date=p_date,stage_id=p_stage,mat_type_id=p_mat,quantity=p_quantity,labor_rate_id=r.id,unit_rate=rate,zero_wage_applied=zero_policy,status='SUBMITTED',version=version+1,reviewed_by=null,reviewed_at=null,review_reason=null,updated_at=now() where id=p_id;
 return p_id;
end $$;

-- An approved financial snapshot cannot be silently rewritten, even by a future RPC.
create function public.guard_approved_work() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status in ('APPROVED','LOCKED') then
  if row(new.worker_id,new.work_date,new.stage_id,new.mat_type_id,new.quantity,new.unit_rate,new.labor_rate_id,new.zero_wage_applied) is distinct from row(old.worker_id,old.work_date,old.stage_id,old.mat_type_id,old.quantity,old.unit_rate,old.labor_rate_id,old.zero_wage_applied)
   or (old.status='LOCKED' and new.status<>'LOCKED') or (old.status='APPROVED' and new.status not in ('APPROVED','LOCKED')) then raise exception 'IMMUTABLE_WORK'; end if;
 end if;return new;
end $$;
create trigger guard_approved before update on public.work_logs for each row execute function public.guard_approved_work();

create function public.pay_wages(p_worker uuid,p_date date,p_amount bigint,p_method text,p_notes text,p_allocations jsonb,p_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;payload jsonb;previous jsonb;item record;w public.work_logs;paid bigint;allocated numeric;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN'; end if;
 if p_worker is null or p_key is null then raise exception 'INVALID_INPUT'; end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll:'||p_worker::text,0));
 payload:=jsonb_build_object('worker',p_worker,'date',p_date,'amount',p_amount,'method',p_method,'notes',p_notes,'allocations',p_allocations);
 select id,request_payload into result,previous from public.wage_payments where created_by=auth.uid() and idempotency_key=p_key;
 if result is not null then if previous<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return result;end if;
 if p_date is null or p_date<date '2000-01-01' or p_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'INVALID_DATE'; end if;
 if p_amount is null or p_amount not between 1 and 1000000000000000 or p_method is null or p_method not in ('CASH','BANK') or length(coalesce(p_notes,''))>1000 then raise exception 'INVALID_INPUT'; end if;
 if jsonb_typeof(p_allocations) is distinct from 'array' then raise exception 'INVALID_ALLOCATIONS'; end if;
 if jsonb_array_length(p_allocations) not between 1 and 500 then raise exception 'INVALID_ALLOCATIONS'; end if;
 if exists(select 1 from jsonb_to_recordset(p_allocations) as a(work_log_id uuid,amount bigint) group by work_log_id having count(*)>1) then raise exception 'INVALID_ALLOCATIONS'; end if;
 select sum(amount) into allocated from jsonb_to_recordset(p_allocations) as a(work_log_id uuid,amount bigint);
 if allocated is distinct from p_amount::numeric then raise exception 'INVALID_ALLOCATIONS'; end if;
 insert into public.wage_payments(worker_id,payment_date,amount,method,notes,created_by,idempotency_key,request_payload) values(p_worker,p_date,p_amount,p_method,p_notes,auth.uid(),p_key,payload) returning id into result;
 for item in select * from jsonb_to_recordset(p_allocations) as a(work_log_id uuid,amount bigint) order by work_log_id loop
  if item.amount is null or item.amount<=0 then raise exception 'INVALID_ALLOCATIONS'; end if;
  select * into w from public.work_logs where id=item.work_log_id for update;
  if not found or w.worker_id<>p_worker or w.status not in ('APPROVED','LOCKED') or w.work_date>p_date then raise exception 'INVALID_ALLOCATIONS'; end if;
  select coalesce(sum(amount),0) into paid from public.wage_payment_allocations where work_log_id=w.id;
  if paid+item.amount>w.total_amount then raise exception 'OVERPAYMENT'; end if;
  insert into public.wage_payment_allocations(payment_id,work_log_id,amount) values(result,w.id,item.amount);
 end loop;return result;
end $$;

create function public.wage_statement(p_worker uuid,p_from date,p_to date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not public.is_manager() and not (public.has_role('WORKER') and p_worker=auth.uid()) then raise exception 'FORBIDDEN';end if;
 if p_from is null or p_to is null or p_from>p_to then raise exception 'INVALID_DATE';end if;
 select jsonb_build_object('approved',coalesce(sum(w.total_amount),0)::text,'allocated',coalesce(sum(a.paid),0)::text,'unpaid',(coalesce(sum(w.total_amount),0)-coalesce(sum(a.paid),0))::text)
 into result from public.work_logs w left join lateral(select sum(amount) paid from public.wage_payment_allocations where work_log_id=w.id) a on true
 where w.worker_id=p_worker and w.status in ('APPROVED','LOCKED') and w.work_date between p_from and p_to;
 return result;
end $$;
revoke all on function public.review_work(uuid,integer,text,text),public.resubmit_work(uuid,integer,date,uuid,uuid,integer,bigint),public.guard_approved_work(),public.pay_wages(uuid,date,bigint,text,text,jsonb,uuid),public.wage_statement(uuid,date,date) from public,anon,authenticated;
grant execute on function public.review_work(uuid,integer,text,text),public.resubmit_work(uuid,integer,date,uuid,uuid,integer,bigint),public.pay_wages(uuid,date,bigint,text,text,jsonb,uuid),public.wage_statement(uuid,date,date) to authenticated;
commit;
