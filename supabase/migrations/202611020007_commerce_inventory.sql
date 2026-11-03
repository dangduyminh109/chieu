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
