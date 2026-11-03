begin;
alter table public.customers add column bank_name text check(length(bank_name)<=120),add column bank_account text check(length(bank_account)<=64),add column account_holder text check(length(account_holder)<=120),add column qr_path text;
alter table public.suppliers add column bank_name text check(length(bank_name)<=120),add column bank_account text check(length(bank_account)<=64),add column account_holder text check(length(account_holder)<=120),add column qr_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('contact-payment-qr','contact-payment-qr',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy contact_qr_upload on storage.objects for insert to authenticated with check(bucket_id='contact-payment-qr' and public.is_manager() and (storage.foldername(name))[1]=auth.uid()::text);
create policy contact_qr_read on storage.objects for select to authenticated using(bucket_id='contact-payment-qr' and public.is_manager());
create function public.save_contact_payment(p_kind text,p_id uuid,p_name text,p_phone text,p_notes text,p_active boolean,p_bank_name text default null,p_bank_account text default null,p_account_holder text default null,p_qr_path text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;existing text;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if length(coalesce(p_bank_name,''))>120 or length(coalesce(p_bank_account,''))>64 or length(coalesce(p_account_holder,''))>120 then raise exception 'INVALID_INPUT';end if;
 if p_id is not null then
  if p_kind='CUSTOMER' then select qr_path into existing from public.customers where id=p_id for update;else select qr_path into existing from public.suppliers where id=p_id for update;end if;
 end if;
 if nullif(p_qr_path,'') is not null and p_qr_path is distinct from existing then
  if p_qr_path !~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.(jpg|png|webp)$') or not exists(select 1 from storage.objects where bucket_id='contact-payment-qr' and name=p_qr_path) then raise exception 'INVALID_PAYMENT_QR';end if;
 end if;
 result:=public.save_contact(p_kind,p_id,p_name,p_phone,p_notes,p_active);
 if p_kind='CUSTOMER' then
  update public.customers set bank_name=case when p_bank_name is null then bank_name else nullif(trim(p_bank_name),'') end,bank_account=case when p_bank_account is null then bank_account else nullif(trim(p_bank_account),'') end,account_holder=case when p_account_holder is null then account_holder else nullif(trim(p_account_holder),'') end,qr_path=case when p_qr_path is null then qr_path else nullif(p_qr_path,'') end where id=result;
 else
  update public.suppliers set bank_name=case when p_bank_name is null then bank_name else nullif(trim(p_bank_name),'') end,bank_account=case when p_bank_account is null then bank_account else nullif(trim(p_bank_account),'') end,account_holder=case when p_account_holder is null then account_holder else nullif(trim(p_account_holder),'') end,qr_path=case when p_qr_path is null then qr_path else nullif(p_qr_path,'') end where id=result;
 end if;
 return result;
end $$;
revoke all on function public.save_contact_payment(text,uuid,text,text,text,boolean,text,text,text,text) from public,anon,authenticated;
grant execute on function public.save_contact_payment(text,uuid,text,text,text,boolean,text,text,text,text) to authenticated;

create or replace function public.contact_directory(p_kind text,p_search text default '',p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_kind is null or p_kind not in ('CUSTOMER','SUPPLIER') or p_page is null or p_page not between 1 and 100000 or length(coalesce(p_search,''))>120 then raise exception 'INVALID_INPUT';end if;
 with people as (
 select id,name,phone,notes,active,bank_name,bank_account,account_holder,qr_path from public.customers where p_kind='CUSTOMER'
 union all select id,name,phone,notes,active,bank_name,bank_account,account_holder,qr_path from public.suppliers where p_kind='SUPPLIER'
 ), filtered as(select * from people where position(lower(trim(coalesce(p_search,''))) in lower(name||' '||coalesce(phone,'')))>0),
 page_rows as(select * from filtered order by name,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('count',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'phone',p.phone,'notes',p.notes,'active',p.active,'bank_name',p.bank_name,'bank_account',p.bank_account,'account_holder',p.account_holder,'qr_path',p.qr_path,
 'remaining',coalesce((select sum(d.total_amount-coalesce(pay.paid,0)) from public.business_documents d left join lateral(select sum(amount) paid from public.document_payments where document_id=d.id) pay on true where (p_kind='CUSTOMER' and d.kind='SALE' and d.customer_id=p.id) or (p_kind='SUPPLIER' and d.kind in ('FINISHED_PURCHASE','MATERIAL_PURCHASE') and d.supplier_id=p.id)),0)::text) order by p.name,p.id) from page_rows p),'[]'::jsonb)) into result;
 return result;
end $$;

notify pgrst,'reload schema';
commit;
