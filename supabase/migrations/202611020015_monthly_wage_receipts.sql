begin;
create table public.wage_receipts(id uuid primary key default gen_random_uuid(),worker_id uuid not null references public.profiles(id),month date not null check(extract(day from month)=1),amount bigint not null check(amount>0),confirmed_at timestamptz not null default now(),idempotency_key uuid not null,unique(worker_id,idempotency_key));
create table public.wage_receipt_items(id uuid primary key default gen_random_uuid(),receipt_id uuid not null references public.wage_receipts(id),work_log_id uuid not null unique references public.work_logs(id),amount bigint not null check(amount>=0));
create index wage_receipts_month on public.wage_receipts(worker_id,month);
alter table public.wage_receipts enable row level security;
alter table public.wage_receipt_items enable row level security;
revoke all on public.wage_receipts,public.wage_receipt_items from anon,authenticated;
grant select on public.wage_receipts,public.wage_receipt_items to authenticated;
create policy receipts_read on public.wage_receipts for select to authenticated using(public.is_manager() or (public.has_role('WORKER') and worker_id=auth.uid()));
create policy receipt_items_read on public.wage_receipt_items for select to authenticated using(exists(select 1 from public.wage_receipts where id=receipt_id));
create trigger audit_changes after insert on public.wage_receipts for each row execute function public.audit_change();
create trigger audit_changes after insert on public.wage_receipt_items for each row execute function public.audit_change();

create function public.confirm_monthly_wage_receipt(p_month date,p_expected bigint,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;prior public.wage_receipts;total numeric;ids uuid[];
begin
 if not public.has_role('WORKER') then raise exception 'FORBIDDEN';end if;
 if p_month is null or extract(day from p_month)<>1 or p_month<date '2000-01-01' or p_month>(now() at time zone 'Asia/Ho_Chi_Minh')::date or p_key is null then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll:'||auth.uid()::text,0));
 select * into prior from public.wage_receipts where worker_id=auth.uid() and idempotency_key=p_key;
 if found then if prior.month<>p_month or prior.amount is distinct from p_expected then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.id;end if;
 select array_agg(w.id),sum(w.total_amount) into ids,total from (select w.* from public.work_logs w where w.worker_id=auth.uid() and w.work_date>=p_month and w.work_date<(p_month+interval '1 month') and w.status in ('APPROVED','LOCKED') and not exists(select 1 from public.wage_receipt_items where work_log_id=w.id) order by w.id for update) w;
 if total is null or total<=0 or total is distinct from p_expected::numeric then raise exception 'WAGE_RECEIPT_CHANGED';end if;
 insert into public.wage_receipts(worker_id,month,amount,idempotency_key) values(auth.uid(),p_month,total::bigint,p_key) returning id into result;
 insert into public.wage_receipt_items(receipt_id,work_log_id,amount) select result,id,total_amount from public.work_logs where id=any(ids);
 return result;
end $$;
create function public.worker_monthly_wages(p_year integer) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.has_role('WORKER') then raise exception 'FORBIDDEN';end if;
 if p_year is null or p_year not between 2000 and 2100 then raise exception 'INVALID_DATE';end if;
 return coalesce((select jsonb_agg(r order by r.month desc) from (
 select to_char(date_trunc('month',w.work_date),'YYYY-MM') as "month",sum(w.total_amount)::text earned,coalesce(sum(i.amount),0)::text received,(sum(w.total_amount)-coalesce(sum(i.amount),0))::text remaining,count(*) records,max(receipt.confirmed_at) last_received_at
 from public.work_logs w left join public.wage_receipt_items i on i.work_log_id=w.id left join public.wage_receipts receipt on receipt.id=i.receipt_id
 where w.worker_id=auth.uid() and w.status in ('APPROVED','LOCKED') and w.work_date>=make_date(p_year,1,1) and w.work_date<make_date(p_year+1,1,1) group by date_trunc('month',w.work_date)
 ) r),'[]'::jsonb);
end $$;
create function public.guard_received_work() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.wage_receipt_items where work_log_id=old.id) and row(new.worker_id,new.work_date,new.stage_id,new.mat_type_id,new.quantity,new.unit_rate,new.status) is distinct from row(old.worker_id,old.work_date,old.stage_id,old.mat_type_id,old.quantity,old.unit_rate,old.status) then raise exception 'WORK_ALREADY_PAID_OR_LOCKED';end if;return new;
end $$;
create trigger guard_received before update on public.work_logs for each row execute function public.guard_received_work();
revoke all on function public.confirm_monthly_wage_receipt(date,bigint,uuid),public.worker_monthly_wages(integer),public.guard_received_work() from public,anon,authenticated;
grant execute on function public.confirm_monthly_wage_receipt(date,bigint,uuid),public.worker_monthly_wages(integer) to authenticated;
notify pgrst,'reload schema';
commit;
