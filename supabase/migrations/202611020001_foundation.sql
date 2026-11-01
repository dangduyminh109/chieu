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
