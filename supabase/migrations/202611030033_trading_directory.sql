begin;
-- Check after the initial payment has been inserted, in the same transaction.
create function public.guard_named_trade_debt() returns trigger language plpgsql security definer set search_path='' as $$
declare d public.business_documents;paid numeric;
begin
 select * into d from public.business_documents where id=new.id;
 if d.kind in ('SALE','FINISHED_PURCHASE','MATERIAL_PURCHASE') then
  select coalesce(sum(amount),0) into paid from public.document_payments where document_id=d.id;
  if d.total_amount>paid and ((d.kind='SALE' and d.customer_id is null) or (d.kind<>'SALE' and d.supplier_id is null)) then raise exception 'DEBT_CONTACT_REQUIRED';end if;
 end if;
 return new;
end $$;
create constraint trigger named_trade_debt after insert or update on public.business_documents deferrable initially deferred for each row execute function public.guard_named_trade_debt();
revoke all on function public.guard_named_trade_debt() from public,anon,authenticated;
create function public.trading_history(p_from date,p_to date,p_kind text default null,p_unpaid boolean default false,p_contact uuid default null,p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_from is null or p_to is null or p_from>p_to or p_page is null or p_page not between 1 and 100000 or (p_kind is not null and p_kind not in ('SALE','PURCHASE')) then raise exception 'INVALID_INPUT';end if;
 with docs as (
 select d.id,d.kind,d.business_date,d.total_amount,d.notes,d.sale_type,d.created_at,
 coalesce(c.name,s.name,'Khách / nhà cung cấp chưa lưu') person,coalesce(c.id,s.id) contact_id,
 coalesce(p.paid,0) paid,d.total_amount-coalesce(p.paid,0) remaining
 from public.business_documents d
 left join public.customers c on c.id=d.customer_id left join public.suppliers s on s.id=d.supplier_id
 left join lateral(select sum(amount) paid from public.document_payments where document_id=d.id) p on true
 where d.kind in ('SALE','FINISHED_PURCHASE','MATERIAL_PURCHASE') and d.business_date between p_from and p_to
 and (p_kind is null or (p_kind='SALE' and d.kind='SALE') or (p_kind='PURCHASE' and d.kind in ('FINISHED_PURCHASE','MATERIAL_PURCHASE')))
 and (p_contact is null or coalesce(d.customer_id,d.supplier_id)=p_contact)
 ),filtered as(select * from docs where not coalesce(p_unpaid,false) or remaining>0), page_rows as(select * from filtered order by business_date desc,created_at desc,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('count',count(*),'total',coalesce(sum(total_amount),0)::text,'paid',coalesce(sum(paid),0)::text,
 'receivable',coalesce(sum(remaining) filter(where kind='SALE'),0)::text,'payable',coalesce(sum(remaining) filter(where kind<>'SALE'),0)::text,
 'rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'date',business_date,'total',total_amount::text,'paid',paid::text,'remaining',remaining::text,'person',person,'notes',notes,'sale_type',sale_type,'contact_id',contact_id) order by business_date desc,created_at desc,id) from page_rows),'[]'::jsonb)) into result from filtered;
 return result;
end $$;

create function public.contact_directory(p_kind text,p_search text default '',p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_kind is null or p_kind not in ('CUSTOMER','SUPPLIER') or p_page is null or p_page not between 1 and 100000 or length(coalesce(p_search,''))>120 then raise exception 'INVALID_INPUT';end if;
 with people as (
 select id,name,phone,notes,active from public.customers where p_kind='CUSTOMER'
 union all select id,name,phone,notes,active from public.suppliers where p_kind='SUPPLIER'
 ), filtered as(select * from people where position(lower(trim(coalesce(p_search,''))) in lower(name||' '||coalesce(phone,'')))>0),
 page_rows as(select * from filtered order by name,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('count',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'phone',p.phone,'notes',p.notes,'active',p.active,
 'remaining',coalesce((select sum(d.total_amount-coalesce(pay.paid,0)) from public.business_documents d left join lateral(select sum(amount) paid from public.document_payments where document_id=d.id) pay on true where (p_kind='CUSTOMER' and d.kind='SALE' and d.customer_id=p.id) or (p_kind='SUPPLIER' and d.kind in ('FINISHED_PURCHASE','MATERIAL_PURCHASE') and d.supplier_id=p.id)),0)::text) order by p.name,p.id) from page_rows p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.trading_history(date,date,text,boolean,uuid,integer),public.contact_directory(text,text,integer) from public,anon,authenticated;
grant execute on function public.trading_history(date,date,text,boolean,uuid,integer),public.contact_directory(text,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
