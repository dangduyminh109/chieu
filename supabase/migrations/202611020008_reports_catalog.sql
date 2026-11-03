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
