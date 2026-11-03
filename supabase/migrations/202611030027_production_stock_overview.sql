begin;
create function public.production_stock_overview(p_date date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_date is null or p_date<date '2000-01-01' or p_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'INVALID_DATE';end if;
 return jsonb_build_object('date',p_date,
 'mats',coalesce((select jsonb_agg(row_data order by row_data.name) from (
   select m.id,m.name,coalesce(stock.quantity,0)::text quantity,coalesce(stock.added,0)::text added_today,
   coalesce(stock.sold,0)::text sold_today,coalesce(woven.quantity,0)::text woven_today
   from public.mat_types m
   left join lateral(select sum(s.quantity) quantity,
     sum(s.quantity) filter(where s.business_date=p_date and s.quantity>0) added,
     -sum(s.quantity) filter(where s.business_date=p_date and s.quantity<0) sold
     from public.finished_stock_movements s where s.mat_type_id=m.id and s.business_date<=p_date) stock on true
   left join lateral(select sum(w.quantity) quantity from public.work_logs w join public.production_stages s on s.id=w.stage_id
     where w.mat_type_id=m.id and s.code='WEAVING' and w.status in ('APPROVED','LOCKED') and w.work_date=p_date) woven on true
   where m.active or coalesce(stock.quantity,0)<>0 or coalesce(stock.added,0)<>0 or coalesce(stock.sold,0)<>0 or coalesce(woven.quantity,0)<>0
 ) row_data),'[]'::jsonb),
 'stages',coalesce((select jsonb_agg(row_data order by row_data.sort_order) from (
   select s.code,s.name,s.sort_order,coalesce(sum(w.quantity) filter(where w.work_date=p_date),0)::text today,
   coalesce(sum(w.quantity),0)::text recorded
   from public.production_stages s left join public.work_logs w on w.stage_id=s.id and w.status in ('APPROVED','LOCKED') and w.work_date<=p_date
   where s.code in ('WEAVING','TYING','CUTTING','SEWING') group by s.id
 ) row_data),'[]'::jsonb));
end $$;
revoke all on function public.production_stock_overview(date) from public,anon,authenticated;
grant execute on function public.production_stock_overview(date) to authenticated;
notify pgrst,'reload schema';
commit;
