begin;
-- Workshop policy: submitting work records payable wages immediately.
create function public.record_work_immediately() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='SUBMITTED' then
  new.status:='APPROVED';
  new.reviewed_by:=null;
  new.reviewed_at:=now();
  new.review_reason:='Ghi nhận trực tiếp, không cần duyệt';
 end if;
 return new;
end $$;
revoke all on function public.record_work_immediately() from public,anon,authenticated;
create trigger immediate_work_recording before insert or update of status on public.work_logs for each row execute function public.record_work_immediately();
alter table public.work_logs alter column status set default 'APPROVED';
update public.work_logs set status='APPROVED',reviewed_by=null,reviewed_at=now(),review_reason='Chuyển sang ghi nhận trực tiếp theo chính sách xưởng',version=version+1,updated_at=now() where status='SUBMITTED';
notify pgrst,'reload schema';
commit;
