-- Run once in Supabase SQL Editor on the new project.
-- Creates application schema; no account passwords or secrets.


-- 202611020001_foundation.sql
begin;
create type public.app_role as enum ('ADMIN','OWNER','WORKER');
create type public.work_status as enum ('DRAFT','SUBMITTED','APPROVED','REJECTED','LOCKED');
create table public.profiles (
 id uuid primary key references auth.users(id), full_name text not null check(length(full_name) between 1 and 120),
 phone text, email text, active boolean not null default true, zero_wage boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (user_id uuid references public.profiles(id), role public.app_role not null, primary key(user_id,role));
create table public.production_stages (
 id uuid primary key default gen_random_uuid(), code text unique not null, name text not null,
 active boolean not null default true, sort_order integer not null default 0
);
create table public.worker_skills (user_id uuid references public.profiles(id), stage_id uuid references public.production_stages(id), primary key(user_id,stage_id));
create table public.mat_types (
 id uuid primary key default gen_random_uuid(), code text unique not null check(code ~ '^[A-Z0-9_-]{1,32}$'),
 name text not null check(length(name) between 1 and 120), dimensions text, description text,
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.labor_rate_history (
 id uuid primary key default gen_random_uuid(), mat_type_id uuid not null references public.mat_types(id),
 stage_id uuid not null references public.production_stages(id), worker_id uuid references public.profiles(id),
 effective_from date not null, unit_rate bigint not null check(unit_rate between 0 and 1000000000),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create unique index default_rate_date on public.labor_rate_history(mat_type_id,stage_id,effective_from) where worker_id is null;
create unique index worker_rate_date on public.labor_rate_history(mat_type_id,stage_id,worker_id,effective_from) where worker_id is not null;
create index rates_lookup on public.labor_rate_history(mat_type_id,stage_id,effective_from desc);
create table public.work_logs (
 id uuid primary key default gen_random_uuid(), worker_id uuid not null references public.profiles(id),
 work_date date not null, stage_id uuid not null references public.production_stages(id),
 mat_type_id uuid not null references public.mat_types(id), quantity integer not null check(quantity between 1 and 1000000),
 labor_rate_id uuid references public.labor_rate_history(id), unit_rate bigint not null check(unit_rate between 0 and 1000000000),
 total_amount bigint generated always as (quantity::bigint * unit_rate) stored,
 zero_wage_applied boolean not null default false, status public.work_status not null default 'SUBMITTED',
 idempotency_key uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(worker_id,idempotency_key)
);
create index work_worker_date on public.work_logs(worker_id,work_date desc);
create index work_status_date on public.work_logs(status,work_date);
create table public.expense_categories (id uuid primary key default gen_random_uuid(), code text unique not null, name text not null);
create table public.app_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id), action text not null,
 entity_name text not null, entity_id uuid, previous_values jsonb, new_values jsonb,
 reason text, created_at timestamptz not null default now()
);
create index audit_recent on public.audit_logs(created_at desc);

create function public.has_role(required public.app_role) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where r.user_id=auth.uid() and r.role=required and p.active)
$$;
create function public.is_manager() returns boolean language sql stable security definer set search_path = '' as $$
 select public.has_role('ADMIN') or public.has_role('OWNER')
$$;
create function public.is_active() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active)
$$;

create function public.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare before_row jsonb; after_row jsonb; row_id uuid;
begin
 if TG_OP <> 'INSERT' then before_row := to_jsonb(old); end if;
 if TG_OP <> 'DELETE' then after_row := to_jsonb(new); end if;
 row_id := coalesce(after_row->>'id',before_row->>'id',after_row->>'user_id',before_row->>'user_id')::uuid;
 -- Authentication credentials never enter these business tables. Omit contact fields from audit.
 insert into public.audit_logs(actor_id,action,entity_name,entity_id,previous_values,new_values,reason)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,row_id,before_row - 'email' - 'phone',after_row - 'email' - 'phone',nullif(current_setting('app.audit_reason',true),''));
 return coalesce(new,old);
end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','worker_skills','mat_types','labor_rate_history','work_logs'] loop
 execute format('create trigger audit_changes after insert or update or delete on public.%I for each row execute function public.audit_change()',t);
 end loop;
end $$;

-- Create unprivileged profile only; roles are NEVER derived from user metadata.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,full_name,email) values(new.id,coalesce(nullif(left(new.raw_user_meta_data->>'full_name',120),''),'Thành viên mới'),new.email);
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.worker_skills enable row level security;
alter table public.production_stages enable row level security;
alter table public.mat_types enable row level security;
alter table public.labor_rate_history enable row level security;
alter table public.work_logs enable row level security;
alter table public.expense_categories enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(public.is_active() and (id=auth.uid() or public.is_manager()));
create policy roles_read on public.user_roles for select to authenticated using(public.is_active() and (user_id=auth.uid() or public.is_manager()));
create policy skills_read on public.worker_skills for select to authenticated using(public.is_active() and (user_id=auth.uid() or public.is_manager()));
create policy stages_read on public.production_stages for select to authenticated using(public.is_active());
create policy mats_read on public.mat_types for select to authenticated using(public.is_active());
create policy rates_read on public.labor_rate_history for select to authenticated using(public.is_active() and (public.is_manager() or (public.has_role('WORKER') and (worker_id is null or worker_id=auth.uid()))));
create policy work_read on public.work_logs for select to authenticated using(public.is_active() and (public.is_manager() or (public.has_role('WORKER') and worker_id=auth.uid())));
create policy categories_read on public.expense_categories for select to authenticated using(public.is_manager());
create policy settings_read on public.app_settings for select to authenticated using(public.has_role('ADMIN'));
create policy audit_read on public.audit_logs for select to authenticated using(public.has_role('ADMIN'));

-- Application roles receive read-only table privileges; all writes use scoped, validated functions.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles,public.user_roles,public.worker_skills,public.production_stages,public.mat_types,public.labor_rate_history,public.work_logs,public.expense_categories,public.app_settings,public.audit_logs to authenticated;

create function public.save_mat(p_id uuid,p_code text,p_name text,p_dimensions text,p_description text,p_active boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN'; end if;
 if length(coalesce(p_dimensions,''))>120 or length(coalesce(p_description,''))>1000 then raise exception 'INVALID_INPUT'; end if;
 if p_id is null then
 insert into public.mat_types(code,name,dimensions,description,active) values(upper(trim(p_code)),trim(p_name),p_dimensions,p_description,p_active) returning id into result;
 else
 update public.mat_types set code=upper(trim(p_code)),name=trim(p_name),dimensions=p_dimensions,description=p_description,active=p_active,updated_at=now() where id=p_id returning id into result;
 if result is null then raise exception 'NOT_FOUND'; end if;
 end if; return result;
end $$;
create function public.delete_mat(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_manager() then raise exception 'FORBIDDEN'; end if;
 delete from public.mat_types where id=p_id;
 if not found then raise exception 'NOT_FOUND'; end if;
 -- Foreign keys prevent deleting a mat used by rates or work. Deactivate it instead.
end $$;

create function public.add_labor_rate(p_mat uuid,p_stage uuid,p_worker uuid,p_date date,p_rate bigint) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN'; end if;
 if p_date is null or p_date < date '2000-01-01' or p_date > date '2100-12-31' then raise exception 'INVALID_DATE'; end if;
 if not exists(select 1 from public.mat_types where id=p_mat and active) or not exists(select 1 from public.production_stages where id=p_stage and active) then raise exception 'INACTIVE_CATALOG'; end if;
 if p_worker is not null and not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where r.user_id=p_worker and r.role='WORKER' and p.active) then raise exception 'INVALID_WORKER'; end if;
 insert into public.labor_rate_history(mat_type_id,stage_id,worker_id,effective_from,unit_rate,created_by) values(p_mat,p_stage,p_worker,p_date,p_rate,auth.uid()) returning id into result;
 return result;
end $$;

create function public.submit_work(p_date date,p_stage uuid,p_mat uuid,p_quantity integer,p_key uuid,p_expected_rate bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; applied public.labor_rate_history; zero_policy boolean;
begin
 if not public.has_role('WORKER') then raise exception 'FORBIDDEN'; end if;
 -- Serialize same user's submissions to make retries safe, including concurrent requests.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into applied from public.labor_rate_history where false;
 select id into result from public.work_logs where worker_id=auth.uid() and idempotency_key=p_key;
 if result is not null then
 if not exists(select 1 from public.work_logs where id=result and work_date=p_date and stage_id=p_stage and mat_type_id=p_mat and quantity=p_quantity) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 return result; end if;
 if p_key is null or p_date is null or p_date < date '2000-01-01' or p_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'INVALID_DATE'; end if;
 if p_quantity is null or p_quantity not between 1 and 1000000 then raise exception 'INVALID_QUANTITY'; end if;
 if not exists(select 1 from public.worker_skills where user_id=auth.uid() and stage_id=p_stage) then raise exception 'SKILL_REQUIRED'; end if;
 if not exists(select 1 from public.mat_types where id=p_mat and active) or not exists(select 1 from public.production_stages where id=p_stage and active) then raise exception 'INACTIVE_CATALOG'; end if;
 select (zero_wage and public.has_role('OWNER')) into zero_policy from public.profiles where id=auth.uid();
 select * into applied from public.labor_rate_history where mat_type_id=p_mat and stage_id=p_stage and effective_from<=p_date and (worker_id is null or worker_id=auth.uid()) order by (worker_id is not null) desc,effective_from desc limit 1;
 if not zero_policy and applied.id is null then raise exception 'RATE_NOT_FOUND'; end if;
 if p_expected_rate is null or p_expected_rate <> (case when zero_policy then 0 else applied.unit_rate end) then raise exception 'RATE_CHANGED'; end if;
 insert into public.work_logs(worker_id,work_date,stage_id,mat_type_id,quantity,labor_rate_id,unit_rate,zero_wage_applied,idempotency_key)
 values(auth.uid(),p_date,p_stage,p_mat,p_quantity,applied.id,case when zero_policy then 0 else applied.unit_rate end,zero_policy,p_key) returning id into result;
 return result;
end $$;

create function public.update_my_profile(p_name text,p_phone text) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_active() then raise exception 'FORBIDDEN'; end if;
 if length(coalesce(p_phone,''))>30 then raise exception 'INVALID_PHONE'; end if;
 update public.profiles set full_name=trim(p_name),phone=p_phone,updated_at=now() where id=auth.uid();
end $$;

-- Admin-only membership updates. Owners never gain role-assignment power.
create function public.configure_member(p_user uuid,p_roles public.app_role[],p_skills uuid[],p_zero boolean,p_active boolean,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.has_role('ADMIN') then raise exception 'FORBIDDEN'; end if;
 if p_user=auth.uid() then raise exception 'SELF_PERMISSION_CHANGE'; end if;
 if p_reason is null or length(trim(p_reason))<5 then raise exception 'REASON_REQUIRED'; end if;
 if not exists(select 1 from public.profiles where id=p_user) then raise exception 'NOT_FOUND'; end if;
 if p_zero and not ('OWNER'=any(p_roles) and 'WORKER'=any(p_roles)) then raise exception 'INVALID_ZERO_POLICY'; end if;
 perform set_config('app.audit_reason',p_reason,true);
 delete from public.user_roles where user_id=p_user;
 insert into public.user_roles(user_id,role) select p_user,unnest(p_roles);
 delete from public.worker_skills where user_id=p_user;
 insert into public.worker_skills(user_id,stage_id) select p_user,unnest(p_skills);
 update public.profiles set zero_wage=p_zero,active=p_active,updated_at=now() where id=p_user;
end $$;

-- Deny execute by default, including trigger functions, then expose only intended RPCs.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.has_role(public.app_role),public.is_manager(),public.is_active() to authenticated;
grant execute on function public.save_mat(uuid,text,text,text,text,boolean),public.delete_mat(uuid),public.add_labor_rate(uuid,uuid,uuid,date,bigint),public.submit_work(date,uuid,uuid,integer,uuid,bigint),public.update_my_profile(text,text),public.configure_member(uuid,public.app_role[],uuid[],boolean,boolean,text) to authenticated;
commit;


-- 202611020002_dashboard.sql
begin;
-- Bound result size without truncating source data. RLS still applies (security invoker).
create function public.production_summary(p_from date,p_to date,p_personal boolean default true) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
 if not public.is_active() then raise exception 'FORBIDDEN'; end if;
 if not p_personal and not public.is_manager() then raise exception 'FORBIDDEN'; end if;
 if p_from is null or p_to is null or p_from>p_to then raise exception 'INVALID_DATE'; end if;
 select jsonb_build_object(
 'records',count(*),
 'submitted_quantity',coalesce(sum(quantity) filter(where status='SUBMITTED'),0),
 'submitted_amount',coalesce(sum(total_amount) filter(where status='SUBMITTED'),0),
 'approved_amount',coalesce(sum(total_amount) filter(where status in ('APPROVED','LOCKED')),0),
 'by_stage',coalesce((select jsonb_agg(s) from (
 select ps.name,coalesce(sum(w.quantity),0)::bigint as quantity from public.production_stages ps left join public.work_logs w on w.stage_id=ps.id and w.work_date between p_from and p_to and (not p_personal or w.worker_id=auth.uid()) and w.status in ('SUBMITTED','APPROVED','LOCKED')
 group by ps.id,ps.name,ps.sort_order order by ps.sort_order) s),'[]'::jsonb)
 ) into result from public.work_logs where work_date between p_from and p_to and (not p_personal or worker_id=auth.uid());
 return result;
end $$;
revoke execute on function public.production_summary(date,date,boolean) from public,anon;
grant execute on function public.production_summary(date,date,boolean) to authenticated;
commit;


-- 202611020003_provision_workers.sql
begin;
-- Called only by the server's secret client after verifying the acting user's session.
create function public.provision_worker(p_actor uuid,p_user uuid,p_skills uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.profiles where id=p_actor and active for update;
 if not found or not exists(select 1 from public.user_roles where user_id=p_actor and role in ('ADMIN','OWNER')) then raise exception 'FORBIDDEN'; end if;
 if p_actor=p_user or exists(select 1 from public.user_roles where user_id=p_user) then raise exception 'INVALID_TARGET'; end if;
 if exists(select 1 from unnest(p_skills) s where not exists(select 1 from public.production_stages where id=s and active)) then raise exception 'INVALID_SKILL'; end if;
 insert into public.user_roles(user_id,role) values(p_user,'WORKER');
 insert into public.worker_skills(user_id,stage_id) select p_user,unnest(p_skills);
 insert into public.audit_logs(actor_id,action,entity_name,entity_id,new_values,reason)
 values(p_actor,'PROVISION','profiles',p_user,jsonb_build_object('role','WORKER','skills',p_skills),'Tạo tài khoản thợ');
end $$;
revoke all on function public.provision_worker(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.provision_worker(uuid,uuid,uuid[]) to service_role;
commit;



-- Profiles for Auth accounts that existed before the trigger was installed.
insert into public.profiles(id,full_name,email)
select id,coalesce(nullif(left(raw_user_meta_data->>'full_name',120),''),'Thành viên mới'),email from auth.users
on conflict(id) do nothing;


-- Catalog examples only. No fictional transactions, wages, or revenue.
insert into public.production_stages(code,name,sort_order) values
 ('WEAVING','Dệt chiếu',1),('CUTTING','Cắt chiếu',2),('SEWING','May chiếu',3),('TYING','Buộc chiếu',4),('OTHER','Công việc khác',5)
on conflict(code) do nothing;
insert into public.expense_categories(code,name) values
 ('REPAIR','Sửa máy'),('MAINTENANCE','Bảo dưỡng máy'),('TRANSPORT','Vận chuyển'),('UTILITIES','Điện nước'),('OTHER','Chi phí khác') on conflict(code) do nothing;
insert into public.mat_types(code,name,dimensions,description) values
 ('CHIEU_16','Chiếu lát 1,6 m','1,6 × 2 m','Danh mục minh họa. Hãy chỉnh theo sản phẩm của xưởng.'),
 ('CHIEU_18','Chiếu lát 1,8 m','1,8 × 2 m','Danh mục minh họa. Chưa thiết lập đơn giá.') on conflict(code) do nothing;

begin;
-- Preserve existing entry point but forbid destructive catalog operations.
create or replace function public.delete_mat(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 raise exception 'DELETION_DISABLED';
end $$;
revoke execute on function public.delete_mat(uuid) from public,anon,authenticated,service_role;
commit;

begin;
alter table public.profiles add column username text;
alter table public.profiles add constraint profiles_username_format check(username is null or username ~ '^[a-z0-9][a-z0-9_.-]{2,31}$');
create unique index profiles_username_unique on public.profiles(lower(username)) where username is not null;
-- Initial administrator's requested login alias; no password changes.
update public.profiles set username='dangduyminh109',updated_at=now() where email='dangduyminh109@gmail.com' and username is null;
notify pgrst, 'reload schema';
commit;


-- 202611020006_production_payroll.sql
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


-- 202611020007_commerce_inventory.sql
begin;
create table public.suppliers(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 120),phone text,notes text,active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.customers(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 120),phone text,notes text,active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.materials(id uuid primary key default gen_random_uuid(),code text unique not null check(code ~ '^[A-Z0-9_-]{1,32}$'),name text not null check(length(trim(name)) between 1 and 120),unit text not null check(unit in ('BUNDLE','KG','METER','PIECE','LITER')),is_sedge boolean not null default false,active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(not is_sedge or unit='BUNDLE'));
create table public.mat_price_history(id uuid primary key default gen_random_uuid(),mat_type_id uuid not null references public.mat_types(id),price_type text not null check(price_type in ('RETAIL','WHOLESALE','PURCHASE')),effective_from date not null,unit_price bigint not null check(unit_price between 0 and 1000000000),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(mat_type_id,price_type,effective_from));
-- One immutable document header for business operations; line and stock tables retain typed FKs.
create table public.business_documents(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('MATERIAL_PURCHASE','MATERIAL_ISSUE','FINISHED_PURCHASE','FINISHED_RECEIPT','SALE','EXPENSE')),
 business_date date not null,supplier_id uuid references public.suppliers(id),customer_id uuid references public.customers(id),sale_type text check(sale_type in ('RETAIL','WHOLESALE')),
 expense_category_id uuid references public.expense_categories(id),total_amount bigint not null check(total_amount between 0 and 1000000000000000),
 reference text,notes text,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),idempotency_key uuid not null,request_payload jsonb not null,
 unique(created_by,idempotency_key),check((kind='SALE')=(sale_type is not null)),check((kind='EXPENSE')=(expense_category_id is not null))
);
create unique index finished_completion_reference on public.business_documents(reference) where kind='FINISHED_RECEIPT';
create index business_date_kind on public.business_documents(business_date,kind);
create table public.document_items(
 id uuid primary key default gen_random_uuid(),document_id uuid not null references public.business_documents(id),line_number integer not null,
 mat_type_id uuid references public.mat_types(id),material_id uuid references public.materials(id),quantity numeric(18,3) not null check(quantity>0 and quantity<=1000000),
 unit_price bigint not null check(unit_price between 0 and 1000000000),line_total bigint not null check(line_total between 0 and 1000000000000000),
 reference_price_id uuid references public.mat_price_history(id),override_reason text,weight_kg numeric(18,3) check(weight_kg>0),
 unique(document_id,line_number),check((mat_type_id is null)<>(material_id is null))
);
create table public.material_bundles(id uuid primary key default gen_random_uuid(),item_id uuid not null references public.document_items(id),weight_kg numeric(18,3) not null check(weight_kg>0 and weight_kg<=1000000),purchase_price bigint not null check(purchase_price between 0 and 1000000000),lon_count integer check(lon_count>=0));
create table public.material_stock_movements(id uuid primary key default gen_random_uuid(),material_id uuid not null references public.materials(id),item_id uuid not null unique references public.document_items(id),business_date date not null,quantity numeric(18,3) not null check(quantity<>0),weight_kg numeric(18,3),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now());
create table public.finished_stock_movements(id uuid primary key default gen_random_uuid(),mat_type_id uuid not null references public.mat_types(id),item_id uuid not null unique references public.document_items(id),business_date date not null,quantity integer not null check(quantity<>0),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now());
create index material_stock_lookup on public.material_stock_movements(material_id,business_date);
create index finished_stock_lookup on public.finished_stock_movements(mat_type_id,business_date);
create index bundles_item on public.material_bundles(item_id);
create table public.document_payments(id uuid primary key default gen_random_uuid(),document_id uuid not null references public.business_documents(id),payment_date date not null,amount bigint not null check(amount between 1 and 1000000000000000),direction text not null check(direction in ('IN','OUT')),method text not null check(method in ('CASH','BANK')),notes text,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),idempotency_key uuid not null,unique(created_by,idempotency_key));
create index doc_payments_document on public.document_payments(document_id);
create index doc_payments_date on public.document_payments(payment_date);
do $$ declare t text;begin
 foreach t in array array['suppliers','customers','materials','mat_price_history','business_documents','document_items','material_bundles','material_stock_movements','finished_stock_movements','document_payments'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy manager_read on public.%I for select to authenticated using(public.is_manager())',t);
  execute format('create trigger audit_changes after insert or update or delete on public.%I for each row execute function public.audit_change()',t);
 end loop;
end $$;

create function public.save_contact(p_kind text,p_id uuid,p_name text,p_phone text,p_notes text,p_active boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_kind is null or p_kind not in ('CUSTOMER','SUPPLIER') or length(trim(coalesce(p_name,''))) not between 1 and 120 or length(coalesce(p_phone,''))>30 or length(coalesce(p_notes,''))>1000 or p_active is null then raise exception 'INVALID_INPUT';end if;
 if p_kind='CUSTOMER' then
  if p_id is null then insert into public.customers(name,phone,notes,active) values(trim(p_name),p_phone,p_notes,p_active) returning id into result;
  else update public.customers set name=trim(p_name),phone=p_phone,notes=p_notes,active=p_active,updated_at=now() where id=p_id returning id into result;end if;
 else
  if p_id is null then insert into public.suppliers(name,phone,notes,active) values(trim(p_name),p_phone,p_notes,p_active) returning id into result;
  else update public.suppliers set name=trim(p_name),phone=p_phone,notes=p_notes,active=p_active,updated_at=now() where id=p_id returning id into result;end if;
 end if;
 if result is null then raise exception 'NOT_FOUND';end if;return result;
end $$;

create function public.save_material(p_id uuid,p_code text,p_name text,p_unit text,p_sedge boolean,p_active boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;m public.materials;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_id is null then insert into public.materials(code,name,unit,is_sedge,active) values(upper(trim(p_code)),trim(p_name),p_unit,p_sedge,p_active) returning id into result;
 else
  select * into m from public.materials where id=p_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if (m.unit<>p_unit or m.is_sedge<>p_sedge) and exists(select 1 from public.document_items where material_id=p_id) then raise exception 'UNIT_IN_USE';end if;
  update public.materials set code=upper(trim(p_code)),name=trim(p_name),unit=p_unit,is_sedge=p_sedge,active=p_active,updated_at=now() where id=p_id returning id into result;
 end if;return result;
end $$;

create function public.add_mat_price(p_mat uuid,p_type text,p_date date,p_price bigint) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_date is null or p_date<date '2000-01-01' or p_date>date '2100-12-31' then raise exception 'INVALID_DATE';end if;
 if not exists(select 1 from public.mat_types where id=p_mat and active) then raise exception 'INACTIVE_CATALOG';end if;
 insert into public.mat_price_history(mat_type_id,price_type,effective_from,unit_price,created_by) values(p_mat,p_type,p_date,p_price,auth.uid()) returning id into result;return result;
end $$;

create function public.record_document_payment(p_document uuid,p_date date,p_amount bigint,p_method text,p_notes text,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.business_documents;prior public.document_payments;result uuid;paid numeric;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_key is null then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('payment:'||auth.uid()::text||p_key::text,0));
 select * into prior from public.document_payments where created_by=auth.uid() and idempotency_key=p_key;
 if found then
  if row(prior.document_id,prior.payment_date,prior.amount,prior.method,prior.notes) is distinct from row(p_document,p_date,p_amount,p_method,p_notes) then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.id;
 end if;
 select * into d from public.business_documents where id=p_document for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if d.kind not in ('SALE','MATERIAL_PURCHASE','FINISHED_PURCHASE','EXPENSE') then raise exception 'INVALID_PAYMENT';end if;
 if p_date is null or p_date<d.business_date or p_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date or p_amount is null or p_amount<=0 or length(coalesce(p_notes,''))>1000 then raise exception 'INVALID_PAYMENT';end if;
 select coalesce(sum(amount),0) into paid from public.document_payments where document_id=p_document;
 if paid+p_amount>d.total_amount then raise exception 'OVERPAYMENT';end if;
 insert into public.document_payments(document_id,payment_date,amount,direction,method,notes,created_by,idempotency_key) values(p_document,p_date,p_amount,case when d.kind='SALE' then 'IN' else 'OUT' end,p_method,p_notes,auth.uid(),p_key) returning id into result;
 return result;
end $$;

-- A single posting RPC ensures stock, snapshots, header, lines, payment and audit commit together.
create function public.post_document(p_kind text,p_date date,p_items jsonb,p_key uuid,p_supplier uuid default null,p_customer uuid default null,p_sale_type text default null,p_category uuid default null,p_amount bigint default 0,p_paid bigint default 0,p_method text default 'CASH',p_reference text default null,p_notes text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;previous jsonb;payload jsonb;item jsonb;bundle jsonb;item_id uuid;mat uuid;material uuid;line_no integer:=0;
 qty numeric;weight numeric;unit_price bigint;line_total numeric;total numeric:=0;rate public.mat_price_history;m public.materials;
 stock numeric;stock_weight numeric;override_reason text;bundle_count integer;item_total bigint;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_key is null or p_kind is null or p_kind not in ('MATERIAL_PURCHASE','MATERIAL_ISSUE','FINISHED_PURCHASE','FINISHED_RECEIPT','SALE','EXPENSE') then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('document:'||auth.uid()::text||p_key::text,0));
 payload:=jsonb_build_object('kind',p_kind,'date',p_date,'items',p_items,'supplier',p_supplier,'customer',p_customer,'sale_type',p_sale_type,'category',p_category,'amount',p_amount,'paid',p_paid,'method',p_method,'reference',p_reference,'notes',p_notes);
 select id,request_payload into result,previous from public.business_documents where created_by=auth.uid() and idempotency_key=p_key;
 if result is not null then if previous<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return result;end if;
 if p_date is null or p_date<date '2000-01-01' or p_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'INVALID_DATE';end if;
 if length(coalesce(p_notes,''))>1000 or length(coalesce(p_reference,''))>120 or p_paid is null or p_paid<0 or p_method is null or p_method not in ('CASH','BANK') then raise exception 'INVALID_INPUT';end if;
 if p_supplier is not null and (p_kind not in ('MATERIAL_PURCHASE','FINISHED_PURCHASE') or not exists(select 1 from public.suppliers where id=p_supplier and active)) then raise exception 'INVALID_SUPPLIER';end if;
 if p_customer is not null and (p_kind<>'SALE' or not exists(select 1 from public.customers where id=p_customer and active)) then raise exception 'INVALID_CUSTOMER';end if;
 if p_kind='SALE' then if p_sale_type is null or p_sale_type not in ('RETAIL','WHOLESALE') then raise exception 'INVALID_INPUT';end if;
 elsif p_sale_type is not null then raise exception 'INVALID_INPUT';end if;
 if p_kind='EXPENSE' then
  if p_category is null or not exists(select 1 from public.expense_categories where id=p_category) or p_amount is null or p_amount<=0 then raise exception 'INVALID_INPUT';end if;total:=p_amount;
 elsif p_category is not null or p_amount is distinct from 0::bigint then raise exception 'INVALID_INPUT';end if;
 if p_kind='FINISHED_RECEIPT' and length(trim(coalesce(p_reference,'')))<3 then raise exception 'REFERENCE_REQUIRED';end if;
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'INVALID_ITEMS';end if;
 if (p_kind='EXPENSE' and jsonb_array_length(p_items)<>0) or (p_kind<>'EXPENSE' and jsonb_array_length(p_items) not between 1 and 100) then raise exception 'INVALID_ITEMS';end if;
 -- Lock every product/material in deterministic order. All stock writers use these locks.
 perform id from public.mat_types where id in(select (v->>'mat_type_id')::uuid from jsonb_array_elements(p_items) v where v->>'mat_type_id' is not null) order by id for update;
 perform id from public.materials where id in(select (v->>'material_id')::uuid from jsonb_array_elements(p_items) v where v->>'material_id' is not null) order by id for update;
 insert into public.business_documents(kind,business_date,supplier_id,customer_id,sale_type,expense_category_id,total_amount,reference,notes,created_by,idempotency_key,request_payload) values(p_kind,p_date,p_supplier,p_customer,p_sale_type,p_category,0,p_reference,p_notes,auth.uid(),p_key,payload) returning id into result;
 for item in select value from jsonb_array_elements(p_items) loop
  line_no:=line_no+1;mat:=nullif(item->>'mat_type_id','')::uuid;material:=nullif(item->>'material_id','')::uuid;
  qty:=(item->>'quantity')::numeric;weight:=nullif(item->>'weight_kg','')::numeric;unit_price:=coalesce((item->>'unit_price')::bigint,0);override_reason:=nullif(trim(item->>'override_reason'),'');
  rate:=null;line_total:=0;
  if p_kind in ('MATERIAL_PURCHASE','MATERIAL_ISSUE') then
   if material is null or mat is not null then raise exception 'INVALID_ITEMS';end if;
   select * into m from public.materials where id=material and active;if not found then raise exception 'INACTIVE_CATALOG';end if;
   if m.is_sedge and p_kind='MATERIAL_PURCHASE' then
    if jsonb_typeof(item->'bundles') is distinct from 'array' then raise exception 'INVALID_BUNDLES';end if;
    bundle_count:=jsonb_array_length(item->'bundles');if bundle_count not between 1 and 1000 then raise exception 'INVALID_BUNDLES';end if;
    select sum((v->>'weight_kg')::numeric),sum((v->>'purchase_price')::bigint) into weight,line_total from jsonb_array_elements(item->'bundles') v;
    qty:=bundle_count;unit_price:=0; -- Per-bundle prices are authoritative, not a fictional average.
   else
    if item ? 'bundles' then raise exception 'INVALID_BUNDLES';end if;
    if m.unit in ('BUNDLE','PIECE') and qty<>trunc(qty) then raise exception 'INVALID_QUANTITY';end if;
    if m.is_sedge and (weight is null or weight<=0) then raise exception 'INVALID_WEIGHT';end if;
    if not m.is_sedge and weight is not null then raise exception 'INVALID_WEIGHT';end if;
    if p_kind='MATERIAL_ISSUE' then
     if unit_price<>0 then raise exception 'INVALID_INPUT';end if;
     select coalesce(sum(quantity),0),coalesce(sum(weight_kg),0) into stock,stock_weight from public.material_stock_movements where material_id=material;
     if qty>stock or (m.is_sedge and weight>stock_weight) then raise exception 'INSUFFICIENT_STOCK';end if;
    else line_total:=qty*unit_price;end if;
   end if;
  else
   if mat is null or material is not null or qty<>trunc(qty) then raise exception 'INVALID_ITEMS';end if;
   if not exists(select 1 from public.mat_types where id=mat and active) then raise exception 'INACTIVE_CATALOG';end if;
   if p_kind='FINISHED_RECEIPT' then if unit_price<>0 then raise exception 'INVALID_INPUT';end if;
   else
    select * into rate from public.mat_price_history where mat_type_id=mat and price_type=case when p_kind='SALE' then p_sale_type else 'PURCHASE' end and effective_from<=p_date order by effective_from desc limit 1;
    if (rate.id is null or unit_price<>rate.unit_price) and length(coalesce(override_reason,''))<5 then raise exception 'OVERRIDE_REASON_REQUIRED';end if;
    if p_kind='SALE' then select coalesce(sum(quantity),0) into stock from public.finished_stock_movements where mat_type_id=mat;if qty>stock then raise exception 'INSUFFICIENT_STOCK';end if;end if;
    line_total:=qty*unit_price;
   end if;
  end if;
  if qty is null or qty<=0 or qty>1000000 or qty<>round(qty,3) or unit_price<0 or unit_price>1000000000 or line_total is null or line_total<0 or line_total<>trunc(line_total) or line_total>1000000000000000 or length(coalesce(override_reason,''))>1000 or (weight is not null and (weight<=0 or weight>1000000000 or weight<>round(weight,3))) then raise exception 'INVALID_ITEMS';end if;
  item_total:=line_total::bigint;total:=total+line_total;
  insert into public.document_items(document_id,line_number,mat_type_id,material_id,quantity,unit_price,line_total,reference_price_id,override_reason,weight_kg) values(result,line_no,mat,material,qty,unit_price,item_total,rate.id,override_reason,weight) returning id into item_id;
  if material is not null then
   if m.is_sedge and p_kind='MATERIAL_PURCHASE' then
    for bundle in select value from jsonb_array_elements(item->'bundles') loop
     if bundle->>'weight_kg' is null or bundle->>'purchase_price' is null or (bundle->>'weight_kg')::numeric<>round((bundle->>'weight_kg')::numeric,3) then raise exception 'INVALID_BUNDLES';end if;
     insert into public.material_bundles(item_id,weight_kg,purchase_price,lon_count) values(item_id,(bundle->>'weight_kg')::numeric,(bundle->>'purchase_price')::bigint,(bundle->>'lon_count')::integer);
    end loop;
   end if;
   insert into public.material_stock_movements(material_id,item_id,business_date,quantity,weight_kg,created_by) values(material,item_id,p_date,case when p_kind='MATERIAL_ISSUE' then -qty else qty end,case when p_kind='MATERIAL_ISSUE' then -weight else weight end,auth.uid());
  else insert into public.finished_stock_movements(mat_type_id,item_id,business_date,quantity,created_by) values(mat,item_id,p_date,case when p_kind='SALE' then -qty::integer else qty::integer end,auth.uid());end if;
  -- Backdated outflows may not make any historical daily closing stock negative.
  if material is not null then
   if exists(select 1 from (select sum(sum(quantity)) over(order by business_date) q,sum(sum(coalesce(weight_kg,0))) over(order by business_date) w from public.material_stock_movements where material_id=material group by business_date) balances where q<0 or w<0) then raise exception 'INSUFFICIENT_STOCK';end if;
  else
   if exists(select 1 from (select sum(sum(quantity)) over(order by business_date) q from public.finished_stock_movements where mat_type_id=mat group by business_date) balances where q<0) then raise exception 'INSUFFICIENT_STOCK';end if;
  end if;
 end loop;
 if total>1000000000000000 or p_paid>total or (p_kind in ('MATERIAL_ISSUE','FINISHED_RECEIPT') and p_paid<>0) then raise exception 'INVALID_PAYMENT';end if;
 update public.business_documents set total_amount=total::bigint where id=result;
 if p_paid>0 then perform public.record_document_payment(result,p_date,p_paid,p_method,'Thanh toán khi ghi nhận',p_key);end if;
 return result;
end $$;

revoke all on function public.save_contact(text,uuid,text,text,text,boolean),public.save_material(uuid,text,text,text,boolean,boolean),public.add_mat_price(uuid,text,date,bigint),public.record_document_payment(uuid,date,bigint,text,text,uuid),public.post_document(text,date,jsonb,uuid,uuid,uuid,text,uuid,bigint,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.save_contact(text,uuid,text,text,text,boolean),public.save_material(uuid,text,text,text,boolean,boolean),public.add_mat_price(uuid,text,date,bigint),public.record_document_payment(uuid,date,bigint,text,text,uuid),public.post_document(text,date,jsonb,uuid,uuid,uuid,text,uuid,bigint,bigint,text,text,text) to authenticated;
commit;


-- 202611020008_reports_catalog.sql
begin;
create function public.inventory_summary() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object(
 'materials',coalesce((select jsonb_agg(r) from (select m.id,m.name,m.unit,m.is_sedge,coalesce(sum(s.quantity),0)::text quantity,coalesce(sum(s.weight_kg),0)::text weight_kg from public.materials m left join public.material_stock_movements s on s.material_id=m.id group by m.id order by m.name) r),'[]'::jsonb),
 'finished',coalesce((select jsonb_agg(r) from (select m.id,m.name,coalesce(sum(s.quantity),0)::text quantity from public.mat_types m left join public.finished_stock_movements s on s.mat_type_id=m.id group by m.id order by m.name) r),'[]'::jsonb));
end $$;

create function public.document_balance(p_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 select jsonb_build_object('id',d.id,'kind',d.kind,'total',d.total_amount::text,'paid',coalesce(sum(p.amount),0)::text,'remaining',(d.total_amount-coalesce(sum(p.amount),0))::text) into result from public.business_documents d left join public.document_payments p on p.document_id=d.id where d.id=p_id group by d.id;
 if result is null then raise exception 'NOT_FOUND';end if;return result;
end $$;

create function public.financial_summary(p_from date,p_to date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_from is null or p_to is null or p_from>p_to then raise exception 'INVALID_DATE';end if;
 select jsonb_build_object(
 'revenue',coalesce(sum(total_amount) filter(where kind='SALE'),0)::text,
 'retail_revenue',coalesce(sum(total_amount) filter(where kind='SALE' and sale_type='RETAIL'),0)::text,
 'wholesale_revenue',coalesce(sum(total_amount) filter(where kind='SALE' and sale_type='WHOLESALE'),0)::text,
 'inventory_purchases',coalesce(sum(total_amount) filter(where kind in ('MATERIAL_PURCHASE','FINISHED_PURCHASE')),0)::text,
 'operating_expenses',coalesce(sum(total_amount) filter(where kind='EXPENSE'),0)::text,
 'approved_labor',(select coalesce(sum(total_amount),0)::text from public.work_logs where status in ('APPROVED','LOCKED') and work_date between p_from and p_to),
 'cash_in',(select coalesce(sum(amount),0)::text from public.document_payments where direction='IN' and payment_date between p_from and p_to),
 'cash_out',(select (coalesce((select sum(amount) from public.document_payments where direction='OUT' and payment_date between p_from and p_to),0)+coalesce((select sum(amount) from public.wage_payments where payment_date between p_from and p_to),0))::text),
 'cash_wages',(select coalesce(sum(amount),0)::text from public.wage_payments where payment_date between p_from and p_to),
 'receivable',(select coalesce(sum(d.total_amount-coalesce(p.paid,0)),0)::text from public.business_documents d left join lateral(select sum(amount) paid from public.document_payments where document_id=d.id and payment_date<=p_to) p on true where d.kind='SALE' and d.business_date<=p_to),
 'purchase_payable',(select coalesce(sum(d.total_amount-coalesce(p.paid,0)),0)::text from public.business_documents d left join lateral(select sum(amount) paid from public.document_payments where document_id=d.id and payment_date<=p_to) p on true where d.kind in ('MATERIAL_PURCHASE','FINISHED_PURCHASE') and d.business_date<=p_to),
 'unpaid_wages',(select (coalesce((select sum(total_amount) from public.work_logs where status in ('APPROVED','LOCKED') and work_date<=p_to),0)-coalesce((select sum(a.amount) from public.wage_payment_allocations a join public.wage_payments p on p.id=a.payment_id where p.payment_date<=p_to),0))::text)
 ) into result from public.business_documents where business_date between p_from and p_to;
 -- These are revenue, expense, cash and balances. No invented profit or COGS.
 return result;
end $$;

create function public.save_stage(p_id uuid,p_code text,p_name text,p_active boolean,p_order integer) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_code is null or p_code !~ '^[A-Z0-9_-]{1,32}$' or length(trim(coalesce(p_name,''))) not between 1 and 120 or p_active is null or p_order is null or p_order not between 0 and 1000 then raise exception 'INVALID_INPUT';end if;
 if p_id is null then insert into public.production_stages(code,name,active,sort_order) values(p_code,trim(p_name),p_active,p_order) returning id into result;
 else update public.production_stages set code=p_code,name=trim(p_name),active=p_active,sort_order=p_order where id=p_id returning id into result;end if;
 if result is null then raise exception 'NOT_FOUND';end if;return result;
end $$;
create function public.save_expense_category(p_id uuid,p_code text,p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_code is null or p_code !~ '^[A-Z0-9_-]{1,32}$' or length(trim(coalesce(p_name,''))) not between 1 and 120 then raise exception 'INVALID_INPUT';end if;
 if p_id is null then insert into public.expense_categories(code,name) values(p_code,trim(p_name)) returning id into result;
 else update public.expense_categories set code=p_code,name=trim(p_name) where id=p_id returning id into result;end if;
 if result is null then raise exception 'NOT_FOUND';end if;return result;
end $$;
create trigger audit_changes after insert or update or delete on public.production_stages for each row execute function public.audit_change();
create trigger audit_changes after insert or update or delete on public.expense_categories for each row execute function public.audit_change();
revoke all on function public.inventory_summary(),public.document_balance(uuid),public.financial_summary(date,date),public.save_stage(uuid,text,text,boolean,integer),public.save_expense_category(uuid,text,text) from public,anon,authenticated;
grant execute on function public.inventory_summary(),public.document_balance(uuid),public.financial_summary(date,date),public.save_stage(uuid,text,text,boolean,integer),public.save_expense_category(uuid,text,text) to authenticated;
commit;


-- 202611020009_worker_management.sql
begin;
create function public.manage_worker(p_user uuid,p_skills uuid[],p_active boolean,p_username text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare target public.profiles;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_user=auth.uid() then raise exception 'SELF_PERMISSION_CHANGE';end if;
 if length(trim(coalesce(p_reason,'')))<5 or length(p_reason)>1000 or p_active is null or p_skills is null then raise exception 'REASON_REQUIRED';end if;
 select * into target from public.profiles where id=p_user for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if not public.has_role('ADMIN') and exists(select 1 from public.user_roles where user_id=p_user and role in ('ADMIN','OWNER')) then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.user_roles where user_id=p_user and role='WORKER') then raise exception 'INVALID_WORKER';end if;
 if exists(select 1 from unnest(p_skills) s where not exists(select 1 from public.production_stages where id=s and active)) or (select count(*) from unnest(p_skills))<>(select count(distinct s) from unnest(p_skills) s) then raise exception 'INVALID_SKILL';end if;
 perform set_config('app.audit_reason',p_reason,true);
 -- Role assignments are never modified by this operation.
 delete from public.worker_skills where user_id=p_user;
 insert into public.worker_skills(user_id,stage_id) select p_user,unnest(p_skills);
 update public.profiles set active=p_active,username=lower(trim(p_username)),updated_at=now() where id=p_user;
 return p_user;
end $$;
revoke all on function public.manage_worker(uuid,uuid[],boolean,text,text) from public,anon,authenticated;
grant execute on function public.manage_worker(uuid,uuid[],boolean,text,text) to authenticated;
commit;

begin;
-- Catalog deletion is ADMIN-only; existing foreign keys protect historical records.
create or replace function public.delete_mat(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.has_role('ADMIN') then raise exception 'FORBIDDEN';end if;
 delete from public.mat_types where id=p_id;
 if not found then raise exception 'NOT_FOUND';end if;
end $$;
revoke all on function public.delete_mat(uuid) from public,anon,authenticated,service_role;
grant execute on function public.delete_mat(uuid) to authenticated;
commit;

begin;
create function public.provision_account(p_actor uuid,p_user uuid,p_roles public.app_role[],p_skills uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare actor_admin boolean;
begin
 perform 1 from public.profiles where id=p_actor and active for update;
 if not found or not exists(select 1 from public.user_roles where user_id=p_actor and role in ('ADMIN','OWNER')) then raise exception 'FORBIDDEN';end if;
 select exists(select 1 from public.user_roles where user_id=p_actor and role='ADMIN') into actor_admin;
 if p_roles is null or cardinality(p_roles)=0 or array_position(p_roles,null) is not null or p_skills is null then raise exception 'INVALID_INPUT';end if;
 if not actor_admin and p_roles<>array['WORKER']::public.app_role[] then raise exception 'FORBIDDEN';end if;
 if p_actor=p_user or not exists(select 1 from public.profiles where id=p_user) or exists(select 1 from public.user_roles where user_id=p_user) then raise exception 'INVALID_TARGET';end if;
 if cardinality(p_skills)>0 and not ('WORKER'=any(p_roles)) then raise exception 'SKILL_REQUIRED';end if;
 if exists(select 1 from unnest(p_skills) s where not exists(select 1 from public.production_stages where id=s and active)) then raise exception 'INVALID_SKILL';end if;
 insert into public.user_roles(user_id,role) select p_user,r from (select distinct unnest(p_roles) r) roles;
 insert into public.worker_skills(user_id,stage_id) select p_user,s from (select distinct unnest(p_skills) s) skills;
 insert into public.audit_logs(actor_id,action,entity_name,entity_id,new_values,reason) values(p_actor,'PROVISION','profiles',p_user,jsonb_build_object('roles',p_roles,'skills',p_skills),'Tạo tài khoản và phân vai trò');
end $$;
revoke all on function public.provision_account(uuid,uuid,public.app_role[],uuid[]) from public,anon,authenticated;
grant execute on function public.provision_account(uuid,uuid,public.app_role[],uuid[]) to service_role;
notify pgrst, 'reload schema';
commit;

begin;
create function public.update_member(p_user uuid,p_name text,p_username text,p_phone text,p_roles public.app_role[],p_skills uuid[],p_active boolean,p_zero boolean,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_user=auth.uid() then raise exception 'SELF_PERMISSION_CHANGE';end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 120 or length(coalesce(p_phone,''))>30 or p_username is null or p_roles is null or cardinality(p_roles)=0 or array_position(p_roles,null) is not null or p_skills is null or p_active is null or p_zero is null then raise exception 'INVALID_INPUT';end if;
 if length(trim(coalesce(p_reason,'')))<5 or length(p_reason)>1000 then raise exception 'REASON_REQUIRED';end if;
 perform 1 from public.profiles where id=p_user for update;if not found then raise exception 'NOT_FOUND';end if;
 if public.has_role('ADMIN') then
  perform public.configure_member(p_user,p_roles,p_skills,p_zero,p_active,p_reason);
 else
  if p_roles<>array['WORKER']::public.app_role[] or p_zero then raise exception 'FORBIDDEN';end if;
  perform public.manage_worker(p_user,p_skills,p_active,p_username,p_reason);
 end if;
 perform set_config('app.audit_reason',p_reason,true);
 update public.profiles set full_name=trim(p_name),username=lower(trim(p_username)),phone=p_phone,updated_at=now() where id=p_user;
 return p_user;
end $$;
revoke all on function public.update_member(uuid,text,text,text,public.app_role[],uuid[],boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.update_member(uuid,text,text,text,public.app_role[],uuid[],boolean,boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;

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

begin;
alter table public.work_logs alter column mat_type_id drop not null;
alter table public.labor_rate_history alter column mat_type_id drop not null;
create unique index stage_default_rate_date on public.labor_rate_history(stage_id,effective_from) where mat_type_id is null and worker_id is null;
create unique index stage_worker_rate_date on public.labor_rate_history(stage_id,worker_id,effective_from) where mat_type_id is null and worker_id is not null;
create function public.work_mat_scope(p_stage uuid,p_mat uuid) returns uuid language plpgsql stable security definer set search_path='' as $$
declare stage_code text;
begin
 select code into stage_code from public.production_stages where id=p_stage and active;
 if not found then raise exception 'INACTIVE_CATALOG';end if;
 if stage_code='WEAVING' then
  if p_mat is null or not exists(select 1 from public.mat_types where id=p_mat and active) then raise exception 'INACTIVE_CATALOG';end if;
  return p_mat;
 end if;
 return null;
end $$;
revoke all on function public.work_mat_scope(uuid,uuid) from public,anon,authenticated;
-- Carry forward only unambiguous stage prices. Conflicting mat-specific prices require manager setup.
insert into public.labor_rate_history(mat_type_id,stage_id,worker_id,effective_from,unit_rate,created_by)
select null,r.stage_id,r.worker_id,r.effective_from,min(r.unit_rate),(array_agg(r.created_by order by r.created_at))[1]
from public.labor_rate_history r join public.production_stages s on s.id=r.stage_id
where s.code<>'WEAVING' and r.mat_type_id is not null
group by r.stage_id,r.worker_id,r.effective_from having count(distinct r.unit_rate)=1;

create or replace function public.add_labor_rate(p_mat uuid,p_stage uuid,p_worker uuid,p_date date,p_rate bigint) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
 p_mat:=public.work_mat_scope(p_stage,p_mat);
 if not public.is_manager() then raise exception 'FORBIDDEN'; end if;
 if p_date is null or p_date < date '2000-01-01' or p_date > date '2100-12-31' then raise exception 'INVALID_DATE'; end if;
 -- Stage and optional mat scope are validated above.
 if p_worker is not null and not exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id where r.user_id=p_worker and r.role='WORKER' and p.active) then raise exception 'INVALID_WORKER'; end if;
 insert into public.labor_rate_history(mat_type_id,stage_id,worker_id,effective_from,unit_rate,created_by) values(p_mat,p_stage,p_worker,p_date,p_rate,auth.uid()) returning id into result;
 return result;
end $$;
create or replace function public.submit_work(p_date date,p_stage uuid,p_mat uuid,p_quantity integer,p_key uuid,p_expected_rate bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; applied public.labor_rate_history; zero_policy boolean;
begin
 p_mat:=public.work_mat_scope(p_stage,p_mat);
 if not public.has_role('WORKER') then raise exception 'FORBIDDEN'; end if;
 -- Serialize same user's submissions to make retries safe, including concurrent requests.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into applied from public.labor_rate_history where false;
 select id into result from public.work_logs where worker_id=auth.uid() and idempotency_key=p_key;
 if result is not null then
 if not exists(select 1 from public.work_logs where id=result and work_date=p_date and stage_id=p_stage and mat_type_id is not distinct from p_mat and quantity=p_quantity) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 return result; end if;
 if p_key is null or p_date is null or p_date < date '2000-01-01' or p_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'INVALID_DATE'; end if;
 if p_quantity is null or p_quantity not between 1 and 1000000 then raise exception 'INVALID_QUANTITY'; end if;
 if not exists(select 1 from public.worker_skills where user_id=auth.uid() and stage_id=p_stage) then raise exception 'SKILL_REQUIRED'; end if;
 -- Stage and optional mat scope are validated above.
 select (zero_wage and public.has_role('OWNER')) into zero_policy from public.profiles where id=auth.uid();
 select * into applied from public.labor_rate_history where mat_type_id is not distinct from p_mat and stage_id=p_stage and effective_from<=p_date and (worker_id is null or worker_id=auth.uid()) order by (worker_id is not null) desc,effective_from desc limit 1;
 if not zero_policy and applied.id is null then raise exception 'RATE_NOT_FOUND'; end if;
 if p_expected_rate is null or p_expected_rate <> (case when zero_policy then 0 else applied.unit_rate end) then raise exception 'RATE_CHANGED'; end if;
 insert into public.work_logs(worker_id,work_date,stage_id,mat_type_id,quantity,labor_rate_id,unit_rate,zero_wage_applied,idempotency_key)
 values(auth.uid(),p_date,p_stage,p_mat,p_quantity,applied.id,case when zero_policy then 0 else applied.unit_rate end,zero_policy,p_key) returning id into result;
 return result;
end $$;
create or replace function public.resubmit_work(p_id uuid,p_version integer,p_date date,p_stage uuid,p_mat uuid,p_quantity integer,p_expected_rate bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare w public.work_logs;r public.labor_rate_history;zero_policy boolean;rate bigint;
begin
 p_mat:=public.work_mat_scope(p_stage,p_mat);
 if not public.has_role('WORKER') then raise exception 'FORBIDDEN'; end if;
 select * into w from public.work_logs where id=p_id and worker_id=auth.uid() for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if p_version is null or w.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
 if w.status not in ('DRAFT','REJECTED') then raise exception 'INVALID_TRANSITION'; end if;
 if p_date is null or p_date<date '2000-01-01' or p_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'INVALID_DATE'; end if;
 if p_quantity is null or p_quantity not between 1 and 1000000 then raise exception 'INVALID_QUANTITY'; end if;
 if not exists(select 1 from public.worker_skills where user_id=auth.uid() and stage_id=p_stage) then raise exception 'SKILL_REQUIRED'; end if;
 -- Stage and optional mat scope are validated above.
 select zero_wage and public.has_role('OWNER') into zero_policy from public.profiles where id=auth.uid();
 select * into r from public.labor_rate_history where mat_type_id is not distinct from p_mat and stage_id=p_stage and effective_from<=p_date and (worker_id is null or worker_id=auth.uid()) order by (worker_id is not null) desc,effective_from desc limit 1;
 if not zero_policy and r.id is null then raise exception 'RATE_NOT_FOUND'; end if;
 rate:=case when zero_policy then 0 else r.unit_rate end;
 if p_expected_rate is null or p_expected_rate<>rate then raise exception 'RATE_CHANGED'; end if;
 update public.work_logs set work_date=p_date,stage_id=p_stage,mat_type_id=p_mat,quantity=p_quantity,labor_rate_id=r.id,unit_rate=rate,zero_wage_applied=zero_policy,status='SUBMITTED',version=version+1,reviewed_by=null,reviewed_at=null,review_reason=null,updated_at=now() where id=p_id;
 return p_id;
end $$;
notify pgrst,'reload schema';
commit;

begin;
create function public.validate_work_date() returns trigger language plpgsql set search_path='' as $$
begin
 if new.work_date is null or new.work_date<date '2000-01-01' or new.work_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'FUTURE_WORK_DATE';end if;
 return new;
end $$;
revoke all on function public.validate_work_date() from public,anon,authenticated;
create trigger validate_work_date before insert or update of work_date on public.work_logs for each row execute function public.validate_work_date();
commit;

begin;
-- Price changes can have multiple revisions on a business date; transactions retain snapshots.
drop index public.default_rate_date;
drop index public.worker_rate_date;
drop index public.stage_default_rate_date;
drop index public.stage_worker_rate_date;
alter table public.mat_price_history drop constraint mat_price_history_mat_type_id_price_type_effective_from_key;
create index labor_rate_revision on public.labor_rate_history(stage_id,mat_type_id,worker_id,effective_from desc,created_at desc);
create index mat_price_revision on public.mat_price_history(mat_type_id,price_type,effective_from desc,created_at desc);
do $$ declare f record;definition text;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('submit_work','resubmit_work','post_document') loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition,'effective_from desc limit 1','effective_from desc,created_at desc,id desc limit 1');
  execute definition;
 end loop;
end $$;

create function public.save_mat_catalog(p_id uuid,p_code text,p_name text,p_dimensions text,p_description text,p_active boolean,p_sale bigint,p_weaving bigint,p_sewing bigint,p_cutting bigint,p_tying bigint) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;s record;price bigint;current_price bigint;today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_sale is null or p_weaving is null or p_sewing is null or p_cutting is null or p_tying is null or least(p_sale,p_weaving,p_sewing,p_cutting,p_tying)<0 or greatest(p_sale,p_weaving,p_sewing,p_cutting,p_tying)>1000000000 then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog-rates',0));
 result:=public.save_mat(p_id,coalesce(nullif(p_code,''),'CHIEU_'||substr(replace(gen_random_uuid()::text,'-',''),1,12)),p_name,p_dimensions,p_description,p_active);
 for s in select unnest(array['RETAIL','WHOLESALE']) kind loop
  select unit_price into current_price from public.mat_price_history where mat_type_id=result and price_type=s.kind and effective_from<=today order by effective_from desc,created_at desc,id desc limit 1;
  if current_price is distinct from p_sale then insert into public.mat_price_history(mat_type_id,price_type,effective_from,unit_price,created_by) values(result,s.kind,today,p_sale,auth.uid());end if;
 end loop;
 for s in select id,code from public.production_stages where code in ('WEAVING','SEWING','CUTTING','TYING') loop
  price:=case s.code when 'WEAVING' then p_weaving when 'SEWING' then p_sewing when 'CUTTING' then p_cutting else p_tying end;
  select unit_rate into current_price from public.labor_rate_history where stage_id=s.id and mat_type_id is not distinct from (case when s.code='WEAVING' then result else null end) and worker_id is null and effective_from<=today order by effective_from desc,created_at desc,id desc limit 1;
  if current_price is distinct from price then insert into public.labor_rate_history(mat_type_id,stage_id,effective_from,unit_rate,created_by) values(case when s.code='WEAVING' then result else null end,s.id,today,price,auth.uid());end if;
 end loop;return result;
end $$;
revoke all on function public.save_mat_catalog(uuid,text,text,text,text,boolean,bigint,bigint,bigint,bigint,bigint) from public,anon,authenticated;
grant execute on function public.save_mat_catalog(uuid,text,text,text,text,boolean,bigint,bigint,bigint,bigint,bigint) to authenticated;
notify pgrst,'reload schema';
commit;

begin;
insert into public.mat_types(code,name,description) values
('CHIEU_TRANG','Chiếu trắng',''),('CHIEU_CON_CO','Chiếu con cờ',''),('CHIEU_TRA_NIEN','Chiếu trà niên','')
on conflict(code) do update set name=excluded.name,active=true;
-- Retire only the two original illustrative catalog entries; preserve their history.
update public.mat_types set active=false where code in ('CHIEU_16','CHIEU_18') and description like 'Danh mục minh họa.%';
do $$ declare actor uuid;m record;s record;kind text;begin
 select p.id into actor from public.profiles p join public.user_roles r on r.user_id=p.id where r.role='ADMIN' and p.active order by p.created_at limit 1;
 if actor is null then raise exception 'ADMIN_REQUIRED_FOR_PRICE_SEED';end if;
 for m in select id,code from public.mat_types where code in ('CHIEU_TRANG','CHIEU_CON_CO','CHIEU_TRA_NIEN') loop
  foreach kind in array array['RETAIL','WHOLESALE'] loop
   if not exists(select 1 from public.mat_price_history where mat_type_id=m.id and price_type=kind) then insert into public.mat_price_history(mat_type_id,price_type,effective_from,unit_price,created_by) values(m.id,kind,date '2000-01-01',100000,actor);end if;
  end loop;
  select id into s from public.production_stages where code='WEAVING';
  if not exists(select 1 from public.labor_rate_history where mat_type_id=m.id and stage_id=s.id and worker_id is null) then insert into public.labor_rate_history(mat_type_id,stage_id,effective_from,unit_rate,created_by) values(m.id,s.id,date '2000-01-01',case when m.code='CHIEU_CON_CO' then 10000 else 8000 end,actor);end if;
 end loop;
 for s in select id,code from public.production_stages where code in ('SEWING','CUTTING','TYING') loop
  -- Explicitly apply requested shared defaults from today; keep old snapshots unchanged.
  insert into public.labor_rate_history(mat_type_id,stage_id,effective_from,unit_rate,created_by) values(null,s.id,(now() at time zone 'Asia/Ho_Chi_Minh')::date,case when s.code='TYING' then 500 else 1000 end,actor);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;

begin;
alter table public.work_logs add column rate_override_reason text;
create or replace function public.guard_approved_work() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status in ('APPROVED','LOCKED') then
  if old.status='LOCKED' or exists(select 1 from public.wage_payment_allocations where work_log_id=old.id) then
   if row(new.worker_id,new.work_date,new.stage_id,new.mat_type_id,new.quantity,new.unit_rate,new.labor_rate_id,new.zero_wage_applied,new.status) is distinct from row(old.worker_id,old.work_date,old.stage_id,old.mat_type_id,old.quantity,old.unit_rate,old.labor_rate_id,old.zero_wage_applied,old.status) then raise exception 'WORK_ALREADY_PAID_OR_LOCKED';end if;
  elsif row(new.worker_id,new.work_date,new.stage_id,new.mat_type_id,new.labor_rate_id,new.zero_wage_applied) is distinct from row(old.worker_id,old.work_date,old.stage_id,old.mat_type_id,old.labor_rate_id,old.zero_wage_applied) or new.status not in ('APPROVED','LOCKED') or (new.unit_rate<>old.unit_rate and not public.is_manager()) then raise exception 'IMMUTABLE_WORK';end if;
 end if;return new;
end $$;
create function public.override_work_rate(p_id uuid,p_version integer,p_rate bigint,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare w public.work_logs;worker uuid;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_rate is null or p_rate not between 0 and 1000000000 or length(trim(coalesce(p_reason,'')))<5 or length(p_reason)>1000 then raise exception 'INVALID_INPUT';end if;
 select worker_id into worker from public.work_logs where id=p_id;if not found then raise exception 'NOT_FOUND';end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll:'||worker::text,0));
 select * into w from public.work_logs where id=p_id for update;
 if w.version is distinct from p_version then raise exception 'VERSION_CONFLICT';end if;
 if w.status='LOCKED' or exists(select 1 from public.wage_payment_allocations where work_log_id=p_id) or exists(select 1 from public.wage_receipt_items where work_log_id=p_id) then raise exception 'WORK_ALREADY_PAID_OR_LOCKED';end if;
 perform set_config('app.audit_reason',p_reason,true);
 update public.work_logs set unit_rate=p_rate,rate_override_reason=p_reason,version=version+1,updated_at=now() where id=p_id;return p_id;
end $$;
revoke all on function public.override_work_rate(uuid,integer,bigint,text) from public,anon,authenticated;
grant execute on function public.override_work_rate(uuid,integer,bigint,text) to authenticated;
notify pgrst,'reload schema';
commit;
