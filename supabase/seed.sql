-- Catalog examples only. No fictional transactions, wages, or revenue.
insert into public.production_stages(code,name,sort_order) values
 ('WEAVING','Dệt chiếu',1),('CUTTING','Cắt chiếu',2),('SEWING','May chiếu',3),('TYING','Buộc chiếu',4),('OTHER','Công việc khác',5)
on conflict(code) do nothing;
insert into public.expense_categories(code,name) values
 ('SEDGE','Mua lát'),('THREAD','Mua chỉ'),('FABRIC','Mua vải may chiếu'),('DYE','Mua màu nhuộm lát'),('REPAIR','Sửa máy'),('OTHER','Khác') on conflict(code) do nothing;
insert into public.mat_types(code,name,description) values
 ('CHIEU_TRANG','Chiếu trắng',''),('CHIEU_CON_CO','Chiếu con cờ',''),('CHIEU_TRA_NIEN','Chiếu trà niên','') on conflict(code) do nothing;
-- Price seed requires an existing application ADMIN profile; rerun after provisioning it.
do $$ declare actor uuid;m record;s record;kind text;begin
 select p.id into actor from public.profiles p join public.user_roles r on r.user_id=p.id where r.role='ADMIN' and p.active order by p.created_at limit 1;
 if actor is null then return;end if;
 for m in select id,code from public.mat_types where code in ('CHIEU_TRANG','CHIEU_CON_CO','CHIEU_TRA_NIEN') loop
  foreach kind in array array['RETAIL','WHOLESALE'] loop
   if not exists(select 1 from public.mat_price_history where mat_type_id=m.id and price_type=kind) then insert into public.mat_price_history(mat_type_id,price_type,effective_from,unit_price,created_by) values(m.id,kind,date '2000-01-01',100000,actor);end if;
  end loop;
  select id into s from public.production_stages where code='WEAVING';
  if not exists(select 1 from public.labor_rate_history where mat_type_id=m.id and stage_id=s.id and worker_id is null) then insert into public.labor_rate_history(mat_type_id,stage_id,effective_from,unit_rate,created_by) values(m.id,s.id,date '2000-01-01',case when m.code='CHIEU_CON_CO' then 10000 else 8000 end,actor);end if;
 end loop;
 for s in select id,code from public.production_stages where code in ('SEWING','CUTTING','TYING') loop
  -- Explicitly apply requested shared defaults from today; keep old snapshots unchanged.
  if not exists(select 1 from public.labor_rate_history where stage_id=s.id and mat_type_id is null and worker_id is null) then insert into public.labor_rate_history(mat_type_id,stage_id,effective_from,unit_rate,created_by) values(null,s.id,date '2000-01-01',case when s.code='TYING' then 500 else 1000 end,actor);end if;
 end loop;
end $$;
