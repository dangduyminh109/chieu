begin;
alter table public.work_logs add column stock_mat_type_id uuid references public.mat_types(id);
alter table public.business_documents add column work_log_id uuid references public.work_logs(id);
create table public.work_stock_state(work_log_id uuid primary key references public.work_logs(id),mat_type_id uuid not null references public.mat_types(id),stage_code text not null,quantity integer not null,updated_at timestamptz not null default now());
alter table public.work_stock_state enable row level security;
revoke all on public.work_stock_state from anon,authenticated;
grant select on public.work_stock_state to authenticated;
create policy work_stock_read on public.work_stock_state for select to authenticated using(public.is_manager() or exists(select 1 from public.work_logs w where w.id=work_log_id and w.worker_id=auth.uid()));
create or replace function public.track_mat_stage_stock() returns trigger language plpgsql security definer set search_path='' as $$
declare stage_value text;available bigint;take integer;remaining integer;doc public.business_documents;
begin
 select d.* into doc from public.document_items i join public.business_documents d on d.id=i.document_id where i.id=new.item_id;
 if new.quantity>0 then
  stage_value:=coalesce(nullif(current_setting('app.receipt_stage',true),''),'SEWN');
  if stage_value not in ('WOVEN','TIED','CUT','SEWN') then raise exception 'INVALID_INPUT';end if;
  update public.business_documents set receipt_stage=stage_value where id=doc.id;
  insert into public.mat_stage_movements(mat_type_id,stage,quantity,business_date,stock_movement_id,created_by) values(new.mat_type_id,stage_value,new.quantity,new.business_date,new.id,new.created_by);
 elsif doc.work_log_id is not null and doc.kind='FINISHED_RECEIPT' then
  insert into public.mat_stage_movements(mat_type_id,stage,quantity,business_date,stock_movement_id,created_by) values(new.mat_type_id,'WOVEN',new.quantity,new.business_date,new.id,new.created_by);
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

create function public.sync_work_stock() returns trigger language plpgsql security definer set search_path='' as $$
declare previous public.work_stock_state;code_value text;delta integer;source_stage text;target_stage text;doc_id uuid;item_id uuid;previous_setting text;effective_quantity integer;
begin
 if tg_op='DELETE' then
  if exists(select 1 from public.work_stock_state where work_log_id=old.id) then raise exception 'WORK_STOCK_LINKED';end if;
  return old;
 end if;
 if new.stock_mat_type_id is null then return new;end if;
 select * into previous from public.work_stock_state where work_log_id=new.id;
 select code into code_value from public.production_stages where id=new.stage_id;
 if code_value not in ('WEAVING','TYING','CUTTING','SEWING') then return new;end if;
 if previous.work_log_id is not null and (previous.mat_type_id<>new.stock_mat_type_id or previous.stage_code<>code_value or new.work_date<>old.work_date) then raise exception 'QUANTITY_ONLY';end if;
 effective_quantity:=case when new.status in ('APPROVED','LOCKED') then new.quantity else 0 end;
 delta:=effective_quantity-coalesce(previous.quantity,0);
 if delta=0 then return new;end if;
 perform id from public.mat_types where id=new.stock_mat_type_id for update;
 if code_value='WEAVING' then
  insert into public.business_documents(kind,business_date,total_amount,reference,notes,created_by,idempotency_key,request_payload,receipt_stage,work_log_id)
  values('FINISHED_RECEIPT',new.work_date,0,'WORK-'||gen_random_uuid()::text,'Tự động từ ghi công dệt',auth.uid(),gen_random_uuid(),jsonb_build_object('work_log_id',new.id,'quantity_delta',delta),'WOVEN',new.id) returning id into doc_id;
  insert into public.document_items(document_id,line_number,mat_type_id,quantity,unit_price,line_total) values(doc_id,1,new.stock_mat_type_id,abs(delta),0,0) returning id into item_id;
  previous_setting:=current_setting('app.receipt_stage',true);
  perform set_config('app.receipt_stage','WOVEN',true);
  insert into public.finished_stock_movements(mat_type_id,item_id,business_date,quantity,created_by) values(new.stock_mat_type_id,item_id,new.work_date,delta,auth.uid());
  perform set_config('app.receipt_stage',coalesce(previous_setting,''),true);
 else
  source_stage:=case code_value when 'TYING' then 'WOVEN' when 'CUTTING' then 'TIED' when 'SEWING' then 'CUT' end;
  target_stage:=case code_value when 'TYING' then 'TIED' when 'CUTTING' then 'CUT' when 'SEWING' then 'SEWN' end;
  insert into public.mat_stage_movements(mat_type_id,stage,quantity,business_date,created_by) values(new.stock_mat_type_id,source_stage,-delta,new.work_date,auth.uid()),(new.stock_mat_type_id,target_stage,delta,new.work_date,auth.uid());
  perform public.validate_mat_stage_stock(new.stock_mat_type_id);
 end if;
 insert into public.work_stock_state(work_log_id,mat_type_id,stage_code,quantity) values(new.id,new.stock_mat_type_id,code_value,effective_quantity)
 on conflict(work_log_id) do update set quantity=excluded.quantity,updated_at=now();
 return new;
end $$;
create trigger sync_work_stock after insert or update or delete on public.work_logs for each row execute function public.sync_work_stock();

create function public.submit_work_stock(p_date date,p_stage uuid,p_mat uuid,p_quantity integer,p_key uuid,p_expected_rate bigint,p_notes text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;code_value text;prior_stock uuid;already_exists boolean;
begin
 if not public.has_role('WORKER') then raise exception 'FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll:'||auth.uid()::text,0));
 select code into code_value from public.production_stages where id=p_stage and active;
 if code_value in ('WEAVING','TYING','CUTTING','SEWING') and (p_mat is null or not exists(select 1 from public.mat_types where id=p_mat and active)) then raise exception 'STOCK_MAT_REQUIRED';end if;
 select exists(select 1 from public.work_logs where worker_id=auth.uid() and idempotency_key=p_key) into already_exists;
 if already_exists and exists(select 1 from public.work_logs where worker_id=auth.uid() and idempotency_key=p_key and stock_mat_type_id is not null and stock_mat_type_id is distinct from p_mat) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 result:=public.submit_work(p_date,p_stage,case when code_value='WEAVING' then p_mat else null end,p_quantity,p_key,p_expected_rate,p_notes);
 if not already_exists and code_value in ('WEAVING','TYING','CUTTING','SEWING') then
  update public.work_logs set stock_mat_type_id=p_mat where id=result;
 end if;
 return result;
end $$;
-- Internal submit functions remain available to the wrapper, so clients cannot bypass stock synchronization.
revoke execute on function public.submit_work(date,uuid,uuid,integer,uuid,bigint),public.submit_work(date,uuid,uuid,integer,uuid,bigint,text) from public,anon,authenticated;
revoke all on function public.sync_work_stock(),public.submit_work_stock(date,uuid,uuid,integer,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.submit_work_stock(date,uuid,uuid,integer,uuid,bigint,text) to authenticated;
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
 left join lateral(select sum(f.quantity) filter(where d.kind<>'SALE') added,-sum(f.quantity) filter(where d.kind='SALE') sold from public.finished_stock_movements f join public.document_items i on i.id=f.item_id join public.business_documents d on d.id=i.document_id where f.mat_type_id=m.id and f.business_date=p_date) t on true
 where m.active or coalesce(s.quantity,0)<>0 or coalesce(t.added,0)<>0 or coalesce(t.sold,0)<>0
 ) r),'[]'::jsonb), 'stages',coalesce((select jsonb_agg(r) from(select ps.code,ps.name,coalesce(sum(w.quantity) filter(where w.work_date=p_date),0)::text today,coalesce(sum(w.quantity),0)::text recorded from public.production_stages ps left join public.work_logs w on w.stage_id=ps.id and w.work_date<=p_date and w.status in ('APPROVED','LOCKED') where ps.code in ('WEAVING','TYING','CUTTING','SEWING') group by ps.id) r),'[]'::jsonb));
end $$;

do $$ declare definition text;begin
 select pg_get_functiondef('public.manager_payroll(date)'::regprocedure) into definition;
 definition:=regexp_replace(definition,'m\.id\s*=\s*w\.mat_type_id','m.id=coalesce(w.stock_mat_type_id,w.mat_type_id)','g');
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
