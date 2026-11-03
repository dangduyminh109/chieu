begin;
create table public.mat_cost_history(id uuid primary key default gen_random_uuid(),mat_type_id uuid not null references public.mat_types(id),effective_from date not null,unit_cost bigint check(unit_cost between 0 and 1000000000),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now());
create index mat_cost_revision on public.mat_cost_history(mat_type_id,effective_from desc,created_at desc,id desc);
alter table public.mat_cost_history enable row level security;
revoke all on public.mat_cost_history from anon,authenticated;
grant select on public.mat_cost_history to authenticated;
create policy cost_read on public.mat_cost_history for select to authenticated using(public.is_manager());
create trigger audit_changes after insert on public.mat_cost_history for each row execute function public.audit_change();
alter table public.document_items add column unit_cost bigint check(unit_cost between 0 and 1000000000),add column cost_history_id uuid references public.mat_cost_history(id),add column cost_override_reason text,add column cost_amount bigint generated always as ((quantity*unit_cost)::bigint) stored;

create function public.snapshot_sale_cost() returns trigger language plpgsql security definer set search_path='' as $$
declare d public.business_documents;
begin
 select * into d from public.business_documents where id=new.document_id;
 if d.kind='SALE' then
  select id,unit_cost into new.cost_history_id,new.unit_cost from public.mat_cost_history where mat_type_id=new.mat_type_id and effective_from<=d.business_date order by effective_from desc,created_at desc,id desc limit 1;
 end if;
 return new;
end $$;
create trigger snapshot_cost before insert on public.document_items for each row execute function public.snapshot_sale_cost();

create function public.save_mat_catalog_cost(p_id uuid,p_code text,p_name text,p_dimensions text,p_description text,p_active boolean,p_sale bigint,p_weaving bigint,p_sewing bigint,p_cutting bigint,p_tying bigint,p_image_path text default null,p_cost bigint default null,p_cost_provided boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;prior bigint;has_prior boolean;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_cost is not null and p_cost not between 0 and 1000000000 then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog-rates',0));
 result:=public.save_mat_catalog_image(p_id,p_code,p_name,p_dimensions,p_description,p_active,p_sale,p_weaving,p_sewing,p_cutting,p_tying,p_image_path);
 if p_cost_provided then
  select unit_cost into prior from public.mat_cost_history where mat_type_id=result and effective_from<=(now() at time zone 'Asia/Ho_Chi_Minh')::date order by effective_from desc,created_at desc,id desc limit 1;
  has_prior:=found;
  if prior is distinct from p_cost or (not has_prior and p_cost is not null) then insert into public.mat_cost_history(mat_type_id,effective_from,unit_cost,created_by) values(result,(now() at time zone 'Asia/Ho_Chi_Minh')::date,p_cost,auth.uid());end if;
 end if;
 return result;
end $$;

create table public.sale_cost_edits(id uuid primary key default gen_random_uuid(),item_id uuid not null references public.document_items(id),unit_cost bigint not null,reason text not null,created_by uuid not null references public.profiles(id),idempotency_key uuid not null,created_at timestamptz not null default now(),unique(created_by,idempotency_key));
alter table public.sale_cost_edits enable row level security;
revoke all on public.sale_cost_edits from anon,authenticated;
grant select on public.sale_cost_edits to authenticated;
create policy cost_edits_read on public.sale_cost_edits for select to authenticated using(public.is_manager());
create trigger audit_changes after insert on public.sale_cost_edits for each row execute function public.audit_change();
create function public.set_sale_item_cost(p_item uuid,p_cost bigint,p_reason text,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare prior public.sale_cost_edits;d_id uuid;d_kind text;result uuid;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_cost is null or p_cost not between 0 and 1000000000 or length(trim(coalesce(p_reason,''))) not between 5 and 1000 or p_key is null then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('sale-cost:'||auth.uid()::text||p_key::text,0));
 select * into prior from public.sale_cost_edits where created_by=auth.uid() and idempotency_key=p_key;
 if found then if prior.item_id<>p_item or prior.unit_cost<>p_cost or prior.reason<>p_reason then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.id;end if;
 select document_id into d_id from public.document_items where id=p_item;
 select kind into d_kind from public.business_documents where id=d_id for update;
 if d_kind is distinct from 'SALE' then raise exception 'INVALID_INPUT';end if;
 perform id from public.document_items where id=p_item for update;
 perform set_config('app.audit_reason',p_reason,true);
 update public.document_items set unit_cost=p_cost,cost_history_id=null,cost_override_reason=p_reason where id=p_item;
 insert into public.sale_cost_edits(item_id,unit_cost,reason,created_by,idempotency_key) values(p_item,p_cost,p_reason,auth.uid(),p_key) returning id into result;
 return result;
end $$;

create function public.profit_report(p_anchor date,p_period text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare start_date date;end_date date;result jsonb;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_anchor is null or p_anchor<date '2000-01-01' or p_anchor>(now() at time zone 'Asia/Ho_Chi_Minh')::date or p_period is null or p_period not in ('month','year') then raise exception 'INVALID_DATE';end if;
 start_date:=date_trunc(p_period,p_anchor)::date;
 end_date:=(start_date+case p_period when 'year' then interval '1 year' else interval '1 month' end-interval '1 day')::date;
 with sales as (
 select i.*,d.business_date,date_trunc(case p_period when 'year' then 'month' else 'day' end,d.business_date)::date bucket
 from public.document_items i join public.business_documents d on d.id=i.document_id where d.kind='SALE' and d.business_date between start_date and end_date
 ),expenses as (
 select d.business_date,d.total_amount,date_trunc(case p_period when 'year' then 'month' else 'day' end,d.business_date)::date bucket
 from public.business_documents d join public.expense_categories c on c.id=d.expense_category_id where d.kind='EXPENSE' and d.business_date between start_date and end_date and c.code not in ('SEDGE','THREAD','DYE')
 ),buckets as (select d::date bucket from generate_series(start_date::timestamp,end_date::timestamp,case p_period when 'year' then interval '1 month' else interval '1 day' end) d),
 points as (
 select b.bucket,coalesce(s.revenue,0)::text revenue,coalesce(s.cogs,0)::text cogs,coalesce(s.missing,0)::bigint::text missing,
 coalesce(e.amount,0)::text expenses,
 case when coalesce(s.missing,0)>0 then null else (coalesce(s.revenue,0)-coalesce(s.cogs,0))::text end gross,
 case when coalesce(s.missing,0)>0 then null else (coalesce(s.revenue,0)-coalesce(s.cogs,0)-coalesce(e.amount,0))::text end profit
 from buckets b left join lateral(select sum(line_total) revenue,sum(cost_amount) cogs,sum(quantity) filter(where unit_cost is null) missing from sales where bucket=b.bucket) s on true
 left join lateral(select sum(total_amount) amount from expenses where bucket=b.bucket) e on true
 ) select jsonb_build_object('points',(select jsonb_agg(p order by p.bucket) from points p),
 'revenue',coalesce((select sum(line_total) from sales),0)::text,'cogs',coalesce((select sum(cost_amount) from sales),0)::text,
 'missing_quantity',coalesce((select sum(quantity) from sales where unit_cost is null),0)::bigint::text,
 'expenses',coalesce((select sum(total_amount) from expenses),0)::text,
 'by_mat',coalesce((select jsonb_agg(r order by r.name) from (select m.id,m.name,sum(s.quantity)::bigint::text quantity,sum(s.line_total)::text revenue,coalesce(sum(s.cost_amount),0)::text cogs,coalesce(sum(s.quantity) filter(where s.unit_cost is null),0)::bigint::text missing from sales s join public.mat_types m on m.id=s.mat_type_id group by m.id) r),'[]'::jsonb),
 'missing_sales',coalesce((select jsonb_agg(r order by r.business_date desc,r.id) from(select distinct d.id,d.business_date from sales s join public.business_documents d on d.id=s.document_id where s.unit_cost is null order by d.business_date desc,d.id limit 20) r),'[]'::jsonb),
 'missing_documents',(select count(distinct document_id) from sales where unit_cost is null)) into result;
 return result;
end $$;
revoke all on function public.snapshot_sale_cost(),public.save_mat_catalog_cost(uuid,text,text,text,text,boolean,bigint,bigint,bigint,bigint,bigint,text,bigint,boolean),public.set_sale_item_cost(uuid,bigint,text,uuid),public.profit_report(date,text) from public,anon,authenticated;
grant execute on function public.save_mat_catalog_cost(uuid,text,text,text,text,boolean,bigint,bigint,bigint,bigint,bigint,text,bigint,boolean),public.set_sale_item_cost(uuid,bigint,text,uuid),public.profit_report(date,text) to authenticated;
notify pgrst,'reload schema';
commit;
