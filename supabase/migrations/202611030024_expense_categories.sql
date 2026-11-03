begin;
insert into public.expense_categories(code,name) values
 ('SEDGE','Mua lát'),('THREAD','Mua chỉ'),('REPAIR','Sửa máy'),('OTHER','Khác')
on conflict(code) do update set name=excluded.name;
notify pgrst,'reload schema';
commit;
