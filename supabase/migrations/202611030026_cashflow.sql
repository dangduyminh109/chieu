begin;
create function public.cashflow_ledger(p_from date,p_to date,p_direction text default null,p_method text default null,p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not public.is_manager() then raise exception 'FORBIDDEN';end if;
 if p_from is null or p_to is null or p_from>p_to or p_page is null or p_page not between 1 and 100000 or (p_direction is not null and p_direction not in ('IN','OUT')) or (p_method is not null and p_method not in ('CASH','BANK')) then raise exception 'INVALID_INPUT';end if;
 with ledger as (
 select 'document:'||p.id::text id,p.payment_date date,p.created_at,p.amount,p.direction,p.method,
 case d.kind when 'SALE' then case d.sale_type when 'WHOLESALE' then 'Bán sỉ' else 'Bán lẻ' end when 'FINISHED_PURCHASE' then 'Mua chiếu' when 'MATERIAL_PURCHASE' then 'Mua nguyên liệu' else coalesce(c.name,'Chi phí') end category,
 concat_ws(' · ',nullif(d.notes,''),nullif(p.notes,'')) notes,coalesce(customer.name,supplier.name,'') person
 from public.document_payments p join public.business_documents d on d.id=p.document_id
 left join public.expense_categories c on c.id=d.expense_category_id
 left join public.customers customer on customer.id=d.customer_id left join public.suppliers supplier on supplier.id=d.supplier_id
 union all
 select 'wage:'||w.id::text,w.payment_date,w.created_at,w.amount,'OUT',w.method,'Trả công',w.notes,p.full_name
 from public.wage_payments w join public.profiles p on p.id=w.worker_id
 ), filtered as (
 select * from ledger where date between p_from and p_to and (p_direction is null or direction=p_direction) and (p_method is null or method=p_method)
 ), page_rows as (select * from filtered order by date desc,created_at desc,id limit 30 offset (p_page-1)*30)
 select jsonb_build_object('income',coalesce(sum(amount) filter(where direction='IN'),0)::text,'expense',coalesce(sum(amount) filter(where direction='OUT'),0)::text,'count',count(*),
 'rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'date',date,'amount',amount::text,'direction',direction,'method',method,'category',category,'notes',notes,'person',person) order by date desc,created_at desc,id) from page_rows),'[]'::jsonb)) into result from filtered;
 return result;
end $$;
revoke all on function public.cashflow_ledger(date,date,text,text,integer) from public,anon,authenticated;
grant execute on function public.cashflow_ledger(date,date,text,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
