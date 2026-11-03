begin;

-- Capacity that can be consumed without invalidating later dated movements.
create function public.sale_stage_capacity(p_mat uuid,p_stage text,p_date date) returns bigint
language sql stable security definer set search_path='' as $$
 select greatest(0,coalesce(min(balance),0))::bigint from (
  select business_date,sum(quantity) over(order by business_date) balance from (
   select business_date,sum(quantity) quantity from (
    select business_date,quantity::bigint from public.mat_stage_movements where mat_type_id=p_mat and stage=p_stage
    union all select p_date,0::bigint
   ) movements group by business_date
  ) daily
 ) balances where business_date>=p_date
$$;
revoke all on function public.sale_stage_capacity(uuid,text,date) from public,anon,authenticated;

-- Sale allocation must use the same capacity as the automatic receipt calculation.
do $$
declare definition text;old_query text := 'select coalesce(sum(quantity),0) into available from public.mat_stage_movements where mat_type_id=new.mat_type_id and stage=stage_value and business_date<=new.business_date;';
begin
 select pg_get_functiondef('public.track_mat_stage_stock()'::regprocedure) into definition;
 if position(old_query in definition)=0 then raise exception 'Unexpected stock trigger definition';end if;
 execute replace(definition,old_query,'select public.sale_stage_capacity(new.mat_type_id,stage_value,new.business_date) into available;');
end $$;

create or replace function public.post_document_stage(p_kind text,p_date date,p_items jsonb,p_key uuid,p_receipt_stage text default 'SEWN',p_supplier uuid default null,p_customer uuid default null,p_sale_type text default null,p_category uuid default null,p_amount bigint default 0,p_paid bigint default 0,p_method text default 'CASH',p_reference text default null,p_notes text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;prior public.business_documents;previous_setting text;product record;missing bigint;part integer;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_key is null or p_receipt_stage is null or p_receipt_stage not in ('WOVEN','TIED','CUT','SEWN') then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('document:'||auth.uid()::text||p_key::text,0));
 select * into prior from public.business_documents where created_by=auth.uid() and idempotency_key=p_key;
 if found and p_kind in ('FINISHED_PURCHASE','FINISHED_RECEIPT') and prior.receipt_stage<>p_receipt_stage then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 previous_setting:=current_setting('app.receipt_stage',true);
 if p_kind='SALE' and prior.id is null then
  if p_date is null or p_date<date '2000-01-01' or p_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'INVALID_DATE';end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'INVALID_ITEMS';end if;
  if jsonb_array_length(p_items) not between 1 and 100 then raise exception 'INVALID_ITEMS';end if;
  -- All stock writers share these product locks. Receipts and the sale commit together.
  perform id from public.mat_types where id in(select (v->>'mat_type_id')::uuid from jsonb_array_elements(p_items) v) order by id for update;
  for product in select (v->>'mat_type_id')::uuid mat,sum((v->>'quantity')::numeric) quantity from jsonb_array_elements(p_items) v group by 1 order by 1 loop
   if product.mat is null or product.quantity is null or product.quantity<=0 or product.quantity<>trunc(product.quantity) or product.quantity>100000000 then raise exception 'INVALID_ITEMS';end if;
   missing:=greatest(0,product.quantity-public.sale_stage_capacity(product.mat,'SEWN',p_date)-public.sale_stage_capacity(product.mat,'CUT',p_date));
   perform set_config('app.receipt_stage','CUT',true);
   while missing>0 loop
    part:=least(missing,1000000)::integer;
    perform public.post_document('FINISHED_RECEIPT',p_date,jsonb_build_array(jsonb_build_object('mat_type_id',product.mat,'quantity',part,'unit_price',0)),gen_random_uuid(),p_reference:='AUTO-SALE-'||p_key::text,p_notes:='Bổ sung tồn khi bán · Mã giao dịch: '||p_key::text);
    missing:=missing-part;
   end loop;
  end loop;
 end if;
 perform set_config('app.receipt_stage',p_receipt_stage,true);
 result:=public.post_document(p_kind,p_date,p_items,p_key,p_supplier,p_customer,p_sale_type,p_category,p_amount,p_paid,p_method,p_reference,p_notes);
 perform set_config('app.receipt_stage',coalesce(previous_setting,''),true);
 return result;
end $$;
notify pgrst,'reload schema';
commit;
