begin;
create function public.manager_statistics(p_anchor date,p_period text,p_worker uuid default null,p_stage uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare start_date date;end_date date;result jsonb;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_anchor is null or p_anchor<date '2000-01-01' or p_anchor>(now() at time zone 'Asia/Ho_Chi_Minh')::date or p_period is null or p_period not in ('month','year') then raise exception 'INVALID_DATE';end if;
 start_date:=date_trunc(p_period,p_anchor)::date;
 end_date:=(start_date+case p_period when 'year' then interval '1 year' else interval '1 month' end-interval '1 day')::date;
 with buckets as (
 select d::date bucket from generate_series(start_date::timestamp,end_date::timestamp,case p_period when 'year' then interval '1 month' else interval '1 day' end) d
 ), work as (
 select w.*,date_trunc(case p_period when 'year' then 'month' else 'day' end,w.work_date)::date bucket,
 coalesce(a.paid,0) paid,coalesce(i.amount,0) received
 from public.work_logs w
 left join lateral(select sum(amount) paid from public.wage_payment_allocations where work_log_id=w.id) a on true
 left join public.wage_receipt_items i on i.work_log_id=w.id
 where w.status in ('APPROVED','LOCKED') and w.work_date between start_date and end_date and (p_worker is null or w.worker_id=p_worker) and (p_stage is null or w.stage_id=p_stage)
 ), cash as (
 select payment_date,amount,direction from public.document_payments where payment_date between start_date and end_date
 union all select payment_date,amount,'OUT' from public.wage_payments where payment_date between start_date and end_date
 ), points as (
 select b.bucket,
 coalesce((select sum(quantity) from work where bucket=b.bucket),0)::text quantity,
 coalesce((select sum(total_amount) from work where bucket=b.bucket),0)::text earned,
 coalesce((select sum(paid) from work where bucket=b.bucket),0)::text paid,
 coalesce((select sum(total_amount-greatest(paid,received)) from work where bucket=b.bucket),0)::text remaining,
 coalesce((select sum(amount) from cash where direction='IN' and date_trunc(case p_period when 'year' then 'month' else 'day' end,payment_date)::date=b.bucket),0)::text income,
 coalesce((select sum(amount) from cash where direction='OUT' and date_trunc(case p_period when 'year' then 'month' else 'day' end,payment_date)::date=b.bucket),0)::text expense
 from buckets b
 )
 select jsonb_build_object('points',(select jsonb_agg(p order by p.bucket) from points p),
 'workers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name) order by p.full_name,p.id) from public.profiles p where exists(select 1 from public.user_roles r where r.user_id=p.id and r.role='WORKER') or exists(select 1 from public.work_logs w where w.worker_id=p.id)),'[]'::jsonb),
 'stages',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'code',code) order by sort_order,id) from public.production_stages ps where active or exists(select 1 from public.work_logs w where w.stage_id=ps.id)),'[]'::jsonb),
 'comparison',coalesce((select jsonb_agg(r order by r.quantity::numeric desc,r.name) from (select p.id,p.full_name name,sum(w.quantity)::text quantity,sum(w.total_amount)::text earned from work w join public.profiles p on p.id=w.worker_id group by p.id) r),'[]'::jsonb),
 'records',(select count(*) from work), 'work_days',(select count(distinct work_date) from work)) into result;
 return result;
end $$;
revoke all on function public.manager_statistics(date,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.manager_statistics(date,text,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
