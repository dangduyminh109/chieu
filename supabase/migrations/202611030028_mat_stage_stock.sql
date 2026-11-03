begin;
alter table public.business_documents add column receipt_stage text not null default 'SEWN' check(receipt_stage in ('WOVEN','TIED','CUT','SEWN'));
create table public.mat_stage_movements(
 id uuid primary key default gen_random_uuid(),mat_type_id uuid not null references public.mat_types(id),
 stage text not null check(stage in ('WOVEN','TIED','CUT','SEWN')),quantity integer not null check(quantity<>0),
 business_date date not null,stock_movement_id uuid references public.finished_stock_movements(id),
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create index mat_stage_lookup on public.mat_stage_movements(mat_type_id,stage,business_date);
-- Existing receipts were explicitly recorded as finished goods. Preserve that interpretation.
insert into public.mat_stage_movements(mat_type_id,stage,quantity,business_date,stock_movement_id,created_by)
select mat_type_id,'SEWN',quantity,business_date,id,created_by from public.finished_stock_movements;
create table public.mat_stage_transfers(id uuid primary key default gen_random_uuid(),mat_type_id uuid not null references public.mat_types(id),from_stage text not null,to_stage text not null,quantity integer not null check(quantity between 1 and 1000000),business_date date not null,created_by uuid not null references public.profiles(id),idempotency_key uuid not null,created_at timestamptz not null default now(),unique(created_by,idempotency_key));
alter table public.mat_stage_movements enable row level security;
alter table public.mat_stage_transfers enable row level security;
revoke all on public.mat_stage_movements,public.mat_stage_transfers from anon,authenticated;
grant select on public.mat_stage_movements,public.mat_stage_transfers to authenticated;
create policy stage_stock_read on public.mat_stage_movements for select to authenticated using(public.is_manager());
create policy stage_transfers_read on public.mat_stage_transfers for select to authenticated using(public.is_manager());
create trigger audit_changes after insert on public.mat_stage_movements for each row execute function public.audit_change();
create trigger audit_changes after insert on public.mat_stage_transfers for each row execute function public.audit_change();

create function public.validate_mat_stage_stock(p_mat uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from (select sum(sum(quantity)) over(partition by stage order by business_date) balance from public.mat_stage_movements where mat_type_id=p_mat group by stage,business_date) b where balance<0) then raise exception 'INSUFFICIENT_STAGE_STOCK';end if;
end $$;
create function public.track_mat_stage_stock() returns trigger language plpgsql security definer set search_path='' as $$
declare stage_value text;available bigint;take integer;remaining integer;doc public.business_documents;
begin
 select d.* into doc from public.document_items i join public.business_documents d on d.id=i.document_id where i.id=new.item_id;
 if new.quantity>0 then
  stage_value:=coalesce(nullif(current_setting('app.receipt_stage',true),''),'SEWN');
  if stage_value not in ('WOVEN','TIED','CUT','SEWN') then raise exception 'INVALID_INPUT';end if;
  update public.business_documents set receipt_stage=stage_value where id=doc.id;
  insert into public.mat_stage_movements(mat_type_id,stage,quantity,business_date,stock_movement_id,created_by) values(new.mat_type_id,stage_value,new.quantity,new.business_date,new.id,new.created_by);
 else
  remaining:=-new.quantity;
  foreach stage_value in array array['SEWN','CUT'] loop
   select coalesce(sum(quantity),0) into available from public.mat_stage_movements where mat_type_id=new.mat_type_id and stage=stage_value and business_date<=new.business_date;
   take:=least(remaining,available);
   if take>0 then insert into public.mat_stage_movements(mat_type_id,stage,quantity,business_date,stock_movement_id,created_by) values(new.mat_type_id,stage_value,-take,new.business_date,new.id,new.created_by); remaining:=remaining-take;end if;
   exit when remaining=0;
  end loop;
  if remaining>0 then raise exception 'MATS_NOT_READY_FOR_SALE';end if;
 end if;
 perform public.validate_mat_stage_stock(new.mat_type_id);
 return new;
end $$;
create trigger track_stage_stock after insert on public.finished_stock_movements for each row execute function public.track_mat_stage_stock();

create function public.post_document_stage(p_kind text,p_date date,p_items jsonb,p_key uuid,p_receipt_stage text default 'SEWN',p_supplier uuid default null,p_customer uuid default null,p_sale_type text default null,p_category uuid default null,p_amount bigint default 0,p_paid bigint default 0,p_method text default 'CASH',p_reference text default null,p_notes text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;prior public.business_documents;previous_setting text;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_receipt_stage is null or p_receipt_stage not in ('WOVEN','TIED','CUT','SEWN') then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('document:'||auth.uid()::text||p_key::text,0));
 select * into prior from public.business_documents where created_by=auth.uid() and idempotency_key=p_key;
 if found and p_kind in ('FINISHED_PURCHASE','FINISHED_RECEIPT') and prior.receipt_stage<>p_receipt_stage then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 previous_setting:=current_setting('app.receipt_stage',true);
 perform set_config('app.receipt_stage',p_receipt_stage,true);
 result:=public.post_document(p_kind,p_date,p_items,p_key,p_supplier,p_customer,p_sale_type,p_category,p_amount,p_paid,p_method,p_reference,p_notes);
 perform set_config('app.receipt_stage',coalesce(previous_setting,''),true);
 return result;
end $$;

create function public.advance_mat_stage(p_mat uuid,p_from text,p_quantity integer,p_date date,p_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare target text;result uuid;prior public.mat_stage_transfers;available bigint;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 target:=case p_from when 'WOVEN' then 'TIED' when 'TIED' then 'CUT' when 'CUT' then 'SEWN' end;
 if target is null or p_quantity is null or p_quantity not between 1 and 1000000 or p_date is null or p_date<date '2000-01-01' or p_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date or p_key is null then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('stage-transfer:'||auth.uid()::text||p_key::text,0));
 select * into prior from public.mat_stage_transfers where created_by=auth.uid() and idempotency_key=p_key;
 if found then if prior.mat_type_id<>p_mat or prior.from_stage<>p_from or prior.quantity<>p_quantity or prior.business_date<>p_date then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.id;end if;
 perform id from public.mat_types where id=p_mat for update;
 if not found then raise exception 'NOT_FOUND';end if;
 select coalesce(sum(quantity),0) into available from public.mat_stage_movements where mat_type_id=p_mat and stage=p_from and business_date<=p_date;
 if available<p_quantity then raise exception 'INSUFFICIENT_STAGE_STOCK';end if;
 insert into public.mat_stage_transfers(mat_type_id,from_stage,to_stage,quantity,business_date,created_by,idempotency_key) values(p_mat,p_from,target,p_quantity,p_date,auth.uid(),p_key) returning id into result;
 insert into public.mat_stage_movements(mat_type_id,stage,quantity,business_date,created_by) values(p_mat,p_from,-p_quantity,p_date,auth.uid()),(p_mat,target,p_quantity,p_date,auth.uid());
 perform public.validate_mat_stage_stock(p_mat);
 return result;
end $$;

create or replace function public.production_stock_overview(p_date date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_date is null or p_date<date '2000-01-01' or p_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'INVALID_DATE';end if;
 return jsonb_build_object('date',p_date,'mats',coalesce((select jsonb_agg(r order by r.name) from (
 select m.id,m.name,coalesce(s.quantity,0)::text quantity,coalesce(s.woven,0)::text woven,coalesce(s.tied,0)::text tied,coalesce(s.cut,0)::text cut,coalesce(s.sewn,0)::text sewn,
 coalesce(t.added,0)::text added_today,coalesce(t.sold,0)::text sold_today,
 coalesce((select sum(w.quantity) from public.work_logs w join public.production_stages ps on ps.id=w.stage_id where w.mat_type_id=m.id and ps.code='WEAVING' and w.work_date=p_date and w.status in ('APPROVED','LOCKED')),0)::text woven_today
 from public.mat_types m
 left join lateral(select sum(quantity) quantity,sum(quantity) filter(where stage='WOVEN') woven,sum(quantity) filter(where stage='TIED') tied,sum(quantity) filter(where stage='CUT') cut,sum(quantity) filter(where stage='SEWN') sewn from public.mat_stage_movements where mat_type_id=m.id and business_date<=p_date) s on true
 left join lateral(select sum(quantity) filter(where quantity>0) added,-sum(quantity) filter(where quantity<0) sold from public.finished_stock_movements where mat_type_id=m.id and business_date=p_date) t on true
 where m.active or coalesce(s.quantity,0)<>0 or coalesce(t.added,0)<>0 or coalesce(t.sold,0)<>0
 ) r),'[]'::jsonb), 'stages',coalesce((select jsonb_agg(r) from(select ps.code,ps.name,coalesce(sum(w.quantity) filter(where w.work_date=p_date),0)::text today,coalesce(sum(w.quantity),0)::text recorded from public.production_stages ps left join public.work_logs w on w.stage_id=ps.id and w.work_date<=p_date and w.status in ('APPROVED','LOCKED') where ps.code in ('WEAVING','TYING','CUTTING','SEWING') group by ps.id) r),'[]'::jsonb));
end $$;
revoke all on function public.validate_mat_stage_stock(uuid),public.track_mat_stage_stock(),public.post_document_stage(text,date,jsonb,uuid,text,uuid,uuid,text,uuid,bigint,bigint,text,text,text),public.advance_mat_stage(uuid,text,integer,date,uuid) from public,anon,authenticated;
grant execute on function public.post_document_stage(text,date,jsonb,uuid,text,uuid,uuid,text,uuid,bigint,bigint,text,text,text),public.advance_mat_stage(uuid,text,integer,date,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
