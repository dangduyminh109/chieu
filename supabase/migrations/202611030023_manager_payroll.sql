begin;
create function public.manager_payroll(p_month date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'FORBIDDEN'; end if;
 if p_month is null or extract(day from p_month)<>1 or p_month<date '2000-01-01' or p_month>date '2100-12-01' then raise exception 'INVALID_DATE'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'active',p.active,
 'logs',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'date',w.work_date,'stage',s.name,'mat',m.name,'quantity',w.quantity,'rate',w.unit_rate::text,'earned',w.total_amount::text,
 'paid',coalesce(a.paid,0)::text,'received',coalesce(i.amount,0)::text) order by w.work_date,w.id)
 from public.work_logs w join public.production_stages s on s.id=w.stage_id left join public.mat_types m on m.id=w.mat_type_id
 left join lateral(select sum(amount) paid from public.wage_payment_allocations where work_log_id=w.id) a on true
 left join public.wage_receipt_items i on i.work_log_id=w.id
 where w.worker_id=p.id and w.status in ('APPROVED','LOCKED') and w.work_date>=p_month and w.work_date<p_month+interval '1 month'),'[]'::jsonb),
 'payments',coalesce((select jsonb_agg(jsonb_build_object('id',wp.id,'date',wp.payment_date,'amount',wp.amount::text,'method',wp.method,'notes',wp.notes) order by wp.payment_date desc,wp.id)
 from public.wage_payments wp where wp.worker_id=p.id and exists(select 1 from public.wage_payment_allocations a join public.work_logs w on w.id=a.work_log_id where a.payment_id=wp.id and w.work_date>=p_month and w.work_date<p_month+interval '1 month')),'[]'::jsonb)) order by p.full_name,p.id)
 from public.profiles p where exists(select 1 from public.user_roles r where r.user_id=p.id and r.role='WORKER')
 or exists(select 1 from public.work_logs w where w.worker_id=p.id and w.work_date>=p_month and w.work_date<p_month+interval '1 month')),'[]'::jsonb);
end $$;

create function public.pay_monthly_wages(p_worker uuid,p_month date,p_amount bigint,p_method text,p_notes text,p_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare remaining bigint:=p_amount; allocations jsonb:='[]'::jsonb; item record; portion bigint; prior public.wage_payments; memo text;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN'; end if;
 if p_worker is null or p_month is null or extract(day from p_month)<>1 or p_month<date '2000-01-01' or p_month>(now() at time zone 'Asia/Ho_Chi_Minh')::date or p_key is null or p_amount is null or p_amount not between 1 and 1000000000000000 or length(coalesce(p_notes,''))>900 then raise exception 'INVALID_INPUT';end if;
 memo:=to_char(p_month,'YYYY-MM')||' | '||coalesce(p_notes,'');
 perform pg_advisory_xact_lock(hashtextextended('payroll:'||p_worker::text,0));
 select * into prior from public.wage_payments where created_by=auth.uid() and idempotency_key=p_key;
 if found then
  if prior.worker_id<>p_worker or prior.amount<>p_amount or prior.method is distinct from p_method or prior.notes is distinct from memo then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return prior.id;
 end if;
 for item in select w.id,w.total_amount-coalesce((select sum(a.amount) from public.wage_payment_allocations a where a.work_log_id=w.id),0) available
 from public.work_logs w where w.worker_id=p_worker and w.work_date>=p_month and w.work_date<p_month+interval '1 month' and w.status in ('APPROVED','LOCKED')
 and not exists(select 1 from public.wage_receipt_items i where i.work_log_id=w.id)
 order by w.work_date,w.id for update loop
  portion:=least(remaining,item.available);
  if portion>0 then allocations:=allocations||jsonb_build_array(jsonb_build_object('work_log_id',item.id,'amount',portion));remaining:=remaining-portion;end if;
  exit when remaining=0;
 end loop;
 if remaining<>0 then raise exception 'OVERPAYMENT';end if;
 return public.pay_wages(p_worker,(now() at time zone 'Asia/Ho_Chi_Minh')::date,p_amount,p_method,memo,allocations,p_key);
end $$;
revoke all on function public.manager_payroll(date),public.pay_monthly_wages(uuid,date,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.manager_payroll(date),public.pay_monthly_wages(uuid,date,bigint,text,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
