begin;

-- Enhance production_summary to include recorded/total quantity across active work logs
create or replace function public.production_summary(p_from date, p_to date, p_personal boolean default true) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
 if not public.is_active() then raise exception 'FORBIDDEN'; end if;
 if not p_personal and not public.is_manager() then raise exception 'FORBIDDEN'; end if;
 if p_from is null or p_to is null or p_from > p_to then raise exception 'INVALID_DATE'; end if;
 select jsonb_build_object(
   'records', count(*),
   'submitted_quantity', coalesce(sum(quantity) filter(where status in ('SUBMITTED', 'APPROVED', 'LOCKED')), 0),
   'recorded_quantity', coalesce(sum(quantity) filter(where status in ('SUBMITTED', 'APPROVED', 'LOCKED')), 0),
   'total_quantity', coalesce(sum(quantity) filter(where status in ('SUBMITTED', 'APPROVED', 'LOCKED')), 0),
   'submitted_amount', coalesce(sum(total_amount) filter(where status in ('SUBMITTED', 'APPROVED', 'LOCKED')), 0),
   'approved_amount', coalesce(sum(total_amount) filter(where status in ('APPROVED', 'LOCKED')), 0),
   'by_stage', coalesce((select jsonb_agg(s) from (
     select ps.name, coalesce(sum(w.quantity), 0)::bigint as quantity
     from public.production_stages ps
     left join public.work_logs w on w.stage_id = ps.id
       and w.work_date between p_from and p_to
       and (not p_personal or w.worker_id = auth.uid())
       and w.status in ('SUBMITTED', 'APPROVED', 'LOCKED')
     group by ps.id, ps.name, ps.sort_order
     order by ps.sort_order) s), '[]'::jsonb)
 ) into result from public.work_logs
 where work_date between p_from and p_to
   and (not p_personal or worker_id = auth.uid());
 return result;
end $$;

revoke execute on function public.production_summary(date, date, boolean) from public, anon;
grant execute on function public.production_summary(date, date, boolean) to authenticated;

commit;
