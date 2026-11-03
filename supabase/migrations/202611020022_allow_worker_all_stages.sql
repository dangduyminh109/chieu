begin;

-- 1. Ensure 'Công việc khác' (OTHER) has a default labor rate so submissions do not fail with RATE_NOT_FOUND
insert into public.labor_rate_history (stage_id, mat_type_id, worker_id, unit_rate, effective_from, created_by)
select
  s.id,
  null,
  null,
  1000,
  date '2000-01-01',
  (select id from public.profiles order by created_at asc limit 1)
from public.production_stages s
where s.code = 'OTHER'
  and not exists (
    select 1 from public.labor_rate_history h where h.stage_id = s.id and h.mat_type_id is null and h.worker_id is null
  );

-- 2. Allow workers to submit work for any active production stage (role/skills are initial defaults, not rigid locks)
create or replace function public.submit_work(
  p_date date,
  p_stage uuid,
  p_mat uuid,
  p_quantity integer,
  p_key uuid,
  p_expected_rate bigint,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
  applied public.labor_rate_history;
  zero_policy boolean;
begin
  p_mat := public.work_mat_scope(p_stage, p_mat);
  if not public.has_role('WORKER') then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select * into applied from public.labor_rate_history where false;
  select id into result from public.work_logs where worker_id = auth.uid() and idempotency_key = p_key;
  if result is not null then
    if not exists(
      select 1 from public.work_logs
      where id = result
        and work_date = p_date
        and stage_id = p_stage
        and mat_type_id is not distinct from p_mat
        and quantity = p_quantity
    ) then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return result;
  end if;

  if p_key is null or p_date is null or p_date < date '2000-01-01' or p_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'INVALID_DATE';
  end if;
  if p_quantity is null or p_quantity not between 1 and 1000000 then
    raise exception 'INVALID_QUANTITY';
  end if;
  if not exists(select 1 from public.production_stages where id = p_stage and active) then
    raise exception 'INVALID_STAGE';
  end if;

  select (zero_wage and public.has_role('OWNER')) into zero_policy from public.profiles where id = auth.uid();
  select * into applied from public.labor_rate_history
  where mat_type_id is not distinct from p_mat
    and stage_id = p_stage
    and effective_from <= p_date
    and (worker_id is null or worker_id = auth.uid())
  order by (worker_id is not null) desc, effective_from desc
  limit 1;

  if not zero_policy and applied.id is null then
    raise exception 'RATE_NOT_FOUND';
  end if;
  if p_expected_rate is null or p_expected_rate <> (case when zero_policy then 0 else applied.unit_rate end) then
    raise exception 'RATE_CHANGED';
  end if;

  insert into public.work_logs(
    worker_id, work_date, stage_id, mat_type_id, quantity,
    labor_rate_id, unit_rate, zero_wage_applied, idempotency_key, notes
  )
  values(
    auth.uid(), p_date, p_stage, p_mat, p_quantity,
    applied.id, case when zero_policy then 0 else applied.unit_rate end,
    zero_policy, p_key, nullif(trim(p_notes), '')
  )
  returning id into result;

  return result;
end $$;

-- 3. Update guard_approved_work to allow updating stage, mat, date, rate on unpaid logs
create or replace function public.guard_approved_work() returns trigger language plpgsql set search_path='' as $$
begin
  if old.status in ('APPROVED','LOCKED') then
    if old.status = 'LOCKED' or exists(select 1 from public.wage_payment_allocations where work_log_id = old.id) then
      if row(new.worker_id, new.work_date, new.stage_id, new.mat_type_id, new.quantity, new.unit_rate, new.labor_rate_id, new.zero_wage_applied, new.status)
         is distinct from
         row(old.worker_id, old.work_date, old.stage_id, old.mat_type_id, old.quantity, old.unit_rate, old.labor_rate_id, old.zero_wage_applied, old.status) then
        raise exception 'WORK_ALREADY_PAID_OR_LOCKED';
      end if;
    elsif new.worker_id <> old.worker_id or new.zero_wage_applied <> old.zero_wage_applied or new.status not in ('APPROVED','LOCKED') then
      raise exception 'IMMUTABLE_WORK';
    end if;
  end if;
  return new;
end $$;

-- 4. Update edit_work_quantity to allow updating stage, mat, date, and notes for unpaid work
create or replace function public.edit_work_quantity(
  p_id uuid,
  p_version integer,
  p_quantity integer,
  p_stage uuid default null,
  p_mat uuid default null,
  p_date date default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  w public.work_logs;
  new_stage uuid;
  new_mat uuid;
  new_date date;
  applied public.labor_rate_history;
  zero_policy boolean;
  new_rate bigint;
begin
  if not public.has_role('WORKER') then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payroll:'||auth.uid()::text, 0));
  select * into w from public.work_logs where id = p_id and worker_id = auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if w.version is distinct from p_version then raise exception 'VERSION_CONFLICT'; end if;
  if w.status = 'LOCKED' or exists(select 1 from public.wage_payment_allocations where work_log_id = p_id) then
    raise exception 'WORK_ALREADY_PAID_OR_LOCKED';
  end if;
  if w.status not in ('APPROVED', 'SUBMITTED') then raise exception 'INVALID_TRANSITION'; end if;
  if p_quantity is null or p_quantity not between 1 and 1000000 then raise exception 'INVALID_QUANTITY'; end if;

  new_date := coalesce(p_date, w.work_date);
  if new_date < date '2000-01-01' or new_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'INVALID_DATE';
  end if;

  new_stage := coalesce(p_stage, w.stage_id);
  if not exists(select 1 from public.production_stages where id = new_stage and active) then
    raise exception 'INVALID_STAGE';
  end if;

  new_mat := public.work_mat_scope(new_stage, case when p_stage is not null or p_mat is not null then coalesce(p_mat, w.mat_type_id) else w.mat_type_id end);

  -- Recalculate rate if stage or mat or date changed
  if new_stage <> w.stage_id or new_mat is distinct from w.mat_type_id or new_date <> w.work_date then
    select (zero_wage and public.has_role('OWNER')) into zero_policy from public.profiles where id = auth.uid();
    select * into applied from public.labor_rate_history
    where mat_type_id is not distinct from new_mat
      and stage_id = new_stage
      and effective_from <= new_date
      and (worker_id is null or worker_id = auth.uid())
    order by (worker_id is not null) desc, effective_from desc
    limit 1;

    if not zero_policy and applied.id is null then
      raise exception 'RATE_NOT_FOUND';
    end if;
    new_rate := case when zero_policy then 0 else applied.unit_rate end;
  else
    applied.id := w.labor_rate_id;
    new_rate := w.unit_rate;
  end if;

  perform set_config('app.audit_reason', 'Người làm cập nhật công việc chưa thanh toán', true);
  update public.work_logs set
    quantity = p_quantity,
    stage_id = new_stage,
    mat_type_id = new_mat,
    work_date = new_date,
    labor_rate_id = applied.id,
    unit_rate = new_rate,
    notes = case when p_notes is not null then nullif(trim(p_notes), '') else notes end,
    status = 'APPROVED',
    version = version + 1,
    updated_at = now()
  where id = p_id;

  return p_id;
end $$;

grant execute on function public.submit_work(date, uuid, uuid, integer, uuid, bigint, text) to authenticated;
grant execute on function public.edit_work_quantity(uuid, integer, integer, uuid, uuid, date, text) to authenticated;
notify pgrst, 'reload schema';
commit;
