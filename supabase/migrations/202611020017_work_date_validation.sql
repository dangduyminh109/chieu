begin;
create function public.validate_work_date() returns trigger language plpgsql set search_path='' as $$
begin
 if new.work_date is null or new.work_date<date '2000-01-01' or new.work_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'FUTURE_WORK_DATE';end if;
 return new;
end $$;
revoke all on function public.validate_work_date() from public,anon,authenticated;
create trigger validate_work_date before insert or update of work_date on public.work_logs for each row execute function public.validate_work_date();
commit;
