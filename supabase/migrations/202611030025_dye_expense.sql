begin;
insert into public.expense_categories(code,name) values ('DYE','Mua màu nhuộm lát')
on conflict(code) do update set name=excluded.name;
notify pgrst,'reload schema';
commit;
